-- Volver a publicar a un profesional despublicado (04/10/2026, decisión de Andre).
--
-- `set_coach_verified` false deja `application_status = 'aprobada'`, y esta
-- función exigía 'pendiente': despublicar desde el panel no tenía vuelta.
-- Ahora también acepta a quien ya estuvo aprobado y hoy no está publicado, con
-- las mismas exigencias que una aprobación (entrevista, identidad, matrícula).
-- En ese caso no se pisan las notas ni la fecha de la revisión original.
-- Una cuenta eliminada no se vuelve a publicar: la baja borra su constancia de
-- identidad, y además se comprueba `deleted_at`.

begin;

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
  v_republica boolean;
begin
  if not exists (select 1 from public.profiles p where p.id = p_admin_id and p.is_admin) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  select * into v_coach from public.coaches c where c.id = p_coach_id for update;
  if v_coach.id is null or v_coach.verified
     or v_coach.application_status not in ('pendiente', 'aprobada') then
    raise exception 'solicitud_no_pendiente' using errcode = '23514';
  end if;
  v_republica := v_coach.application_status = 'aprobada';

  if exists (select 1 from public.profiles p where p.id = v_coach.profile_id and p.deleted_at is not null) then
    raise exception 'cuenta_eliminada' using errcode = '23514';
  end if;
  if not exists (select 1 from public.coach_application_interviews i where i.coach_id = p_coach_id) then
    raise exception 'entrevista_pendiente' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.identity_verifications iv
     where iv.profile_id = v_coach.profile_id and iv.status = 'verificada'
  ) then
    raise exception 'identidad_pendiente' using errcode = '23514';
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
         application_reviewed_at = case when v_republica then c.application_reviewed_at else now() end,
         application_notes = case when v_republica then c.application_notes else p_notes end
   where c.id = p_coach_id;

  return query select c.id, c.verified, c.profile_id, c.application_status
    from public.coaches c where c.id = p_coach_id;
end;
$$;

revoke all on function public.approve_coach_application(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.approve_coach_application(uuid, uuid, text)
  to service_role;

commit;
