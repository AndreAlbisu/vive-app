-- Verificación de identidad de profesionales (Claude, 01/10/2026, decidido por
-- Andre: "sí", manual por ahora y obligatoria para aprobar; los aprobados de
-- hoy son de prueba y no se les pide).
--
-- QUÉ RESUELVE
-- La matrícula prueba que existe una matrícula, no que quien está detrás de la
-- cuenta sea esa persona: alguien podía subir la de otro. Y a los coaches sin
-- matrícula no se les verificaba la identidad en absoluto. En una app donde
-- alguien cuenta cosas íntimas por videollamada, eso es lo mínimo.
--
-- CÓMO
-- En la postulación, el profesional sube tres fotos: DNI frente, DNI dorso y
-- una selfie sosteniendo el DNI. Tienen que ir ahí y no después, porque al
-- enviar la postulación se le cierra la sesión hasta que lo aprueben. Un admin
-- las compara (cara, nombre del DNI contra el de la cuenta) y marca la
-- identidad como verificada. En ese momento las tres fotos SE BORRAN: queda
-- solo la constancia (quién verificó, cuándo, con qué nombre). La selfie es un
-- dato biométrico y no tiene sentido guardarla más de lo necesario.
--
-- `approve_coach_application` exige la identidad verificada, igual que ya exige
-- entrevista y matrícula. No hay forma de aprobar salteándola.

begin;

-- ── 1) El bucket privado ─────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'identity-docs',
  'identity-docs',
  false,
  10 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Cada uno en su carpeta (`{auth.uid()}/...`). Lectura propia porque el upsert
-- la necesita; el admin no tiene policy: mira por URL firmada de admin-actions.
drop policy if exists identity_docs_insert on storage.objects;
create policy identity_docs_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'identity-docs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists identity_docs_update on storage.objects;
create policy identity_docs_update on storage.objects
  for update to authenticated
  using (bucket_id = 'identity-docs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists identity_docs_select on storage.objects;
create policy identity_docs_select on storage.objects
  for select to authenticated
  using (bucket_id = 'identity-docs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists identity_docs_delete on storage.objects;
create policy identity_docs_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'identity-docs' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── 2) La constancia ─────────────────────────────────────────────────────────
-- Por `profile_id` y no por `coaches.id`: en una postulación nueva la fila de
-- `coaches` todavía no existe cuando se suben las fotos.
create table if not exists public.identity_verifications (
  profile_id       uuid primary key references public.profiles(id) on delete cascade,
  status           text not null default 'pendiente'
                     check (status in ('pendiente', 'verificada')),
  enviada_at       timestamptz not null default now(),
  reviewed_at      timestamptz,
  reviewed_by      uuid references public.profiles(id) on delete set null,
  -- El nombre de la cuenta en el momento de verificar, que el admin confirmó
  -- igual al del DNI. Desde ahí el nombre queda fijo (trg_limitar_cambio_de_nombre).
  verified_name    text,
  files_deleted_at timestamptz
);

alter table public.identity_verifications enable row level security;

revoke all on public.identity_verifications from anon, authenticated;
grant select on public.identity_verifications to authenticated;

drop policy if exists identity_verifications_select_own on public.identity_verifications;
create policy identity_verifications_select_own on public.identity_verifications
  for select to authenticated
  using (profile_id = auth.uid());

-- ── 3) Enviar las fotos a revisión ───────────────────────────────────────────
-- El cliente no escribe la tabla: llama a esto, que confirma que las tres fotos
-- están en su carpeta. Una identidad ya verificada no vuelve a pendiente.
create or replace function public.enviar_identidad()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  faltan int;
  actual text;
begin
  if uid is null then
    raise exception 'sin_sesion' using errcode = '42501';
  end if;

  select status into actual from public.identity_verifications where profile_id = uid;
  if actual = 'verificada' then
    return 'verificada';
  end if;

  select 3 - count(distinct o.name) into faltan
    from storage.objects o
   where o.bucket_id = 'identity-docs'
     and o.name in (uid::text || '/dni-frente.jpg', uid::text || '/dni-dorso.jpg', uid::text || '/selfie.jpg');
  if faltan > 0 then
    raise exception 'identidad_incompleta' using errcode = '23514';
  end if;

  insert into public.identity_verifications (profile_id, status, enviada_at)
  values (uid, 'pendiente', now())
  on conflict (profile_id) do update
    set status = 'pendiente', enviada_at = now(), files_deleted_at = null;

  return 'pendiente';
end;
$$;

revoke all on function public.enviar_identidad() from public, anon;
grant execute on function public.enviar_identidad() to authenticated;

-- ── 4) Aprobar exige la identidad verificada ─────────────────────────────────
-- Igual a la versión de 20260924030000 (comparada con la de producción el
-- 01/10), más el chequeo de identidad.
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

commit;
