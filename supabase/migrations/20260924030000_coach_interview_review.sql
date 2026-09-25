-- Constancia privada de la entrevista previa a la decisión de admisión.
create table if not exists public.coach_application_interviews (
  coach_id uuid primary key references public.coaches(id) on delete cascade,
  interviewer_id uuid not null references public.profiles(id),
  interviewed_at timestamptz not null default now(),
  notes text not null check (length(btrim(notes)) between 10 and 2000),
  recorded_at timestamptz not null default now()
);

alter table public.coach_application_interviews enable row level security;
revoke all on public.coach_application_interviews from public, anon, authenticated;
grant select, insert, update on public.coach_application_interviews to service_role;
-- Solo admin-actions, después de validar el JWT y el rol, lee y escribe con
-- service_role. Las notas de entrevista nunca forman parte del perfil público.

-- La comprobación vive también en la base: no se puede publicar a un nuevo
-- profesional saltando el panel o usando otra función con service_role.
create or replace function public.require_interview_before_coach_publication()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.verified then
      raise exception 'aprobacion_requiere_postulacion' using errcode = '23514';
    end if;
    return new;
  end if;

  if new.verified is true and old.verified is false then
    if not exists (
       select 1 from public.coach_application_interviews i
       where i.coach_id = new.id
    ) then
      raise exception 'entrevista_pendiente' using errcode = '23514';
    end if;
    if new.specialty in ('Psicólogo/a', 'Nutricionista')
       and not exists (
         select 1 from public.coach_credentials cc
         where cc.coach_id = new.id and cc.kind = 'matricula'
           and cc.status = 'verificada'
           and cc.profesion = case new.specialty
             when 'Psicólogo/a' then 'psicologia' else 'nutricion' end
       ) then
      raise exception 'matricula_pendiente' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_require_interview_before_coach_publication on public.coaches;
create trigger trg_require_interview_before_coach_publication
before insert or update of verified on public.coaches
for each row execute function public.require_interview_before_coach_publication();

-- Un reenvío tras rechazo es una nueva revisión. La entrevista anterior queda
-- documentada; el equipo puede decidir si corresponde otra conversación.
revoke execute on function public.require_interview_before_coach_publication()
  from public, anon, authenticated;

-- Aprobación y cambio de rol comparten transacción. Un fallo en cualquiera
-- deja la solicitud pendiente y sin publicación.
create or replace function public.approve_coach_application(
  p_coach_id uuid,
  p_admin_id uuid,
  p_notes text default null
) returns table (
  id uuid, verified boolean, profile_id uuid, application_status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_coach public.coaches%rowtype;
begin
  if not exists (select 1 from public.profiles p where p.id = p_admin_id and p.is_admin) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  select * into v_coach from public.coaches c where c.id = p_coach_id for update;
  if v_coach.id is null or v_coach.verified
     or v_coach.application_status <> 'pendiente' then
    raise exception 'solicitud_no_pendiente' using errcode = '23514';
  end if;
  if not exists (select 1 from public.coach_application_interviews i where i.coach_id = p_coach_id) then
    raise exception 'entrevista_pendiente' using errcode = '23514';
  end if;
  if v_coach.specialty in ('Psicólogo/a', 'Nutricionista')
     and not exists (
       select 1 from public.coach_credentials cc
       where cc.coach_id = p_coach_id
         and cc.kind = 'matricula'
         and cc.status = 'verificada'
         and cc.profesion = case v_coach.specialty
           when 'Psicólogo/a' then 'psicologia' else 'nutricion' end
     )
  then
    raise exception 'matricula_pendiente' using errcode = '23514';
  end if;

  update public.profiles p set role = 'coach' where p.id = v_coach.profile_id;
  if not found then
    raise exception 'perfil_no_encontrado' using errcode = '23514';
  end if;

  update public.coaches c
     set verified = true,
         application_status = 'aprobada',
         application_reviewed_at = now(),
         application_notes = p_notes
   where c.id = p_coach_id;

  return query select c.id, c.verified, c.profile_id, c.application_status
    from public.coaches c where c.id = p_coach_id;
end;
$$;

revoke all on function public.approve_coach_application(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.approve_coach_application(uuid, uuid, text)
  to service_role;
