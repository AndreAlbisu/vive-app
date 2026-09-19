-- add-session-call-feedback.sql
--
-- M4 (docs/problemas-abiertos.md): calificar la VIDEOLLAMADA aparte del
-- profesional. Sale de la comparación con Selia, que pregunta por separado
-- "atención del especialista" y "calidad de la videollamada".
--
-- Por qué importa:
--   1. Hoy la reseña es una sola nota con estrellas. Si el video se cortó, esa
--      nota castiga al profesional por algo que no hizo, y la reseña es pública
--      y alimenta la barra de calidad del deck de Conexiones.
--   2. La videollamada nunca se probó con dos personas (L1). El primer mes es
--      cuando más necesitamos enterarnos de que falla, y la única señal hoy es
--      que alguien escriba al mail.
--
-- Decisiones:
--   - Tabla aparte, NO una columna en `reviews`: la reseña es una por PAR
--     (usuario, profesional) y se edita; la llamada es una por SESIÓN.
--   - PRIVADA: la lee solo quien la escribió. No la ve el profesional ni el
--     público. Vita la lee con service role (panel o SQL).
--   - Se puede dejar con la reserva `confirmada` o `completada`: una sesión en
--     la que no se pudo entrar puede no llegar nunca a `completada` (el cron
--     exige dos personas en la sala), y ese es justo el caso más importante.
--   - Baja de cuenta: la fila se CONSERVA colgada de la lápida de `profiles`
--     (que no se borra), igual que `bookings`. No tiene contenido personal: es
--     una opción de tres y una lista de problemas técnicos.
--
-- Fecha: 2026-09-17

create table if not exists public.session_call_feedback (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  user_id     uuid not null default auth.uid() references public.profiles(id),
  quality     text not null check (quality in ('bien', 'con_problemas', 'no_anduvo')),
  problems    text[] not null default '{}'
              check (problems <@ array['audio', 'imagen', 'se_corto', 'no_pude_entrar']::text[]),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (booking_id, user_id)
);

create index if not exists session_call_feedback_quality_idx
  on public.session_call_feedback (quality, created_at desc);

-- updated_at
create or replace function public.touch_session_call_feedback()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  -- booking y autor quedan fijos: se edita la opinión, no a qué sesión pertenece.
  new.booking_id := old.booking_id;
  new.user_id    := old.user_id;
  return new;
end $$;

drop trigger if exists trg_touch_session_call_feedback on public.session_call_feedback;
create trigger trg_touch_session_call_feedback
  before update on public.session_call_feedback
  for each row execute function public.touch_session_call_feedback();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.session_call_feedback enable row level security;

drop policy if exists call_feedback_select_own on public.session_call_feedback;
create policy call_feedback_select_own on public.session_call_feedback
  for select to authenticated
  using (user_id = auth.uid());

-- Solo sobre una reserva PROPIA que llegó a confirmarse.
drop policy if exists call_feedback_insert_own_booking on public.session_call_feedback;
create policy call_feedback_insert_own_booking on public.session_call_feedback
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.bookings b
      where b.id = session_call_feedback.booking_id
        and b.user_id = auth.uid()
        and b.status in ('confirmada', 'completada')
    )
  );

drop policy if exists call_feedback_update_own on public.session_call_feedback;
create policy call_feedback_update_own on public.session_call_feedback
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Sin política de DELETE: no se borra desde la app.

-- ── Privilegios por columna (reglas críticas 20 y 21 de SCHEMA.md) ───────────
revoke all on public.session_call_feedback from anon, authenticated;
grant select on public.session_call_feedback to authenticated;
grant insert (booking_id, quality, problems) on public.session_call_feedback to authenticated;
grant update (quality, problems) on public.session_call_feedback to authenticated;

-- ── VERIFICACIÓN ────────────────────────────────────────────────────────────
do $$
declare
  v_rls boolean;
  v_pol int;
  v_anon int;
  v_extra int;
  v_ins text;
  v_upd text;
begin
  create temp table if not exists _res (chequeo text, valor text, ok boolean);
  truncate _res;

  select relrowsecurity into v_rls from pg_class where oid = 'public.session_call_feedback'::regclass;
  insert into _res values ('rls_activa', v_rls::text, v_rls);

  select count(*) into v_pol from pg_policy where polrelid = 'public.session_call_feedback'::regclass;
  insert into _res values ('policies (esperado 3)', v_pol::text, v_pol = 3);

  select count(*) into v_anon from information_schema.table_privileges
   where table_schema = 'public' and table_name = 'session_call_feedback' and grantee = 'anon';
  insert into _res values ('privilegios de anon (esperado 0)', v_anon::text, v_anon = 0);

  select count(*) into v_extra from information_schema.table_privileges
   where table_schema = 'public' and table_name = 'session_call_feedback' and grantee = 'authenticated'
     and privilege_type not in ('SELECT');
  insert into _res values ('privilegios de tabla de authenticated ademas de SELECT (esperado 0)', v_extra::text, v_extra = 0);

  select string_agg(column_name, ',' order by column_name) into v_ins from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'session_call_feedback' and grantee = 'authenticated' and privilege_type = 'INSERT';
  insert into _res values ('columnas INSERT', v_ins, v_ins = 'booking_id,problems,quality');

  select string_agg(column_name, ',' order by column_name) into v_upd from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'session_call_feedback' and grantee = 'authenticated' and privilege_type = 'UPDATE';
  insert into _res values ('columnas UPDATE', v_upd, v_upd = 'problems,quality');
end $$;

select * from _res;
