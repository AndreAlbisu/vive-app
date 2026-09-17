-- add-availability-waitlist.sql
--
-- M3 (docs/problemas-abiertos.md): "Avisame cuando tenga horarios".
-- Sale de la comparación con Selia ("Solicitar disponibilidad"). Hoy, si un
-- profesional no tiene turnos libres, el calendario queda vacío y la persona
-- se va sin dejar rastro. Con esto deja anotado que le interesa, y cuando el
-- profesional abre horarios le llega un aviso (campana + push).
--
-- Cómo funciona:
--   1. La app inserta una fila en `availability_waitlist` (una pendiente por
--      persona y profesional).
--   2. La edge function `availability-notices`, cada hora por cron, busca las
--      pendientes cuyo profesional YA tiene al menos un horario libre a futuro,
--      las RECLAMA (update condicionado, igual que `sanction-returns`) y recién
--      ahí avisa. Una sola vez por fila.
--   3. Pedidos de más de 60 días se cierran sin avisar ('vencida'): un "ya hay
--      horarios" dos meses después llega descolgado.
--
-- Por qué cron y no trigger: el aviso lleva push, y el push sale de una edge
-- function. Además `generateWeeklySlots` inserta 56 días de horarios de una
-- vez: un trigger por fila dispararía cientos de veces.
--
-- Privada: cada persona ve solo sus pedidos. El profesional NO ve quién lo
-- espera (sería una lista de clientes potenciales fuera de una reserva).
--
-- Fecha: 2026-09-17

-- ═══ PARTE 1 — tabla, permisos y tipo de aviso ══════════════════════════════
begin;

create table if not exists public.availability_waitlist (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  coach_id         uuid not null references public.coaches(id) on delete cascade,
  created_at       timestamptz not null default now(),
  -- Cuándo la reclamó el cron y qué pasó. NULL = sigue esperando.
  resuelta_at      timestamptz,
  resultado        text check (resultado in ('avisada', 'vencida', 'cancelada')),
  -- El aviso que se mandó, para que tocarlo en la campana abra la ficha.
  notification_id  uuid references public.notifications(id) on delete set null
);

-- Una sola pendiente por persona y profesional. Las resueltas no cuentan:
-- después de un aviso se puede volver a pedir.
create unique index if not exists availability_waitlist_una_pendiente
  on public.availability_waitlist (user_id, coach_id)
  where resuelta_at is null;

create index if not exists availability_waitlist_pendientes_idx
  on public.availability_waitlist (coach_id)
  where resuelta_at is null;

alter table public.availability_waitlist enable row level security;

drop policy if exists waitlist_select_own on public.availability_waitlist;
create policy waitlist_select_own on public.availability_waitlist
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists waitlist_insert_own on public.availability_waitlist;
create policy waitlist_insert_own on public.availability_waitlist
  for insert to authenticated
  with check (user_id = auth.uid());

-- Cancelar el pedido propio: solo pasar de pendiente a 'cancelada'.
drop policy if exists waitlist_cancel_own on public.availability_waitlist;
create policy waitlist_cancel_own on public.availability_waitlist
  for update to authenticated
  using (user_id = auth.uid() and resuelta_at is null)
  with check (user_id = auth.uid() and resultado = 'cancelada');

revoke all on public.availability_waitlist from anon, authenticated;
grant select on public.availability_waitlist to authenticated;
grant insert (coach_id) on public.availability_waitlist to authenticated;
grant update (resuelta_at, resultado) on public.availability_waitlist to authenticated;

-- Tipo de aviso propio, para poder contarlo aparte en la campana.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'reserva_nueva', 'reserva_confirmada', 'reserva_rechazada', 'reserva_cancelada',
    'recordatorio_sesion', 'invitacion_review', 'recurso_feedback_umbral',
    'propuesta_publicada', 'propuesta_ajustes', 'postulacion_aprobada', 'postulacion_rechazada',
    'credencial_verificada', 'credencial_rechazada', 'recurso_publicado', 'recurso_rechazado',
    'sancion_aplicada', 'sancion_levantada', 'profesional_no_disponible', 'profesional_disponible',
    'profesional_con_horarios'
  ));

commit;

notify pgrst, 'reload schema';

-- ── VERIFICACIÓN PARTE 1 ────────────────────────────────────────────────────
do $$
declare v_anon int; v_ins text; v_upd text; v_pol int; v_tipo boolean;
begin
  create temp table if not exists _res (chequeo text, valor text, ok boolean);
  truncate _res;
  select count(*) into v_pol from pg_policy where polrelid = 'public.availability_waitlist'::regclass;
  insert into _res values ('policies (esperado 3)', v_pol::text, v_pol = 3);
  select count(*) into v_anon from information_schema.table_privileges
   where table_schema='public' and table_name='availability_waitlist' and grantee='anon';
  insert into _res values ('privilegios de anon (esperado 0)', v_anon::text, v_anon = 0);
  select string_agg(column_name, ',' order by column_name) into v_ins from information_schema.column_privileges
   where table_schema='public' and table_name='availability_waitlist' and grantee='authenticated' and privilege_type='INSERT';
  insert into _res values ('columnas INSERT', v_ins, v_ins = 'coach_id');
  select string_agg(column_name, ',' order by column_name) into v_upd from information_schema.column_privileges
   where table_schema='public' and table_name='availability_waitlist' and grantee='authenticated' and privilege_type='UPDATE';
  insert into _res values ('columnas UPDATE', v_upd, v_upd = 'resuelta_at,resultado');
  select pg_get_constraintdef(oid) like '%profesional_con_horarios%' into v_tipo from pg_constraint where conname='notifications_type_check';
  insert into _res values ('tipo de aviso nuevo', v_tipo::text, v_tipo);
end $$;
select * from _res;

-- ═══ PARTE 2 — correr DESPUÉS de deployar `availability-notices` ════════════
-- (cortar acá y correr aparte)
--
-- select cron.schedule(
--   'availability-notices',
--   '29 * * * *',
--   $cron$
--   select net.http_post(
--     url     := 'https://ggygiihhnkjrerpinhha.supabase.co/functions/v1/availability-notices',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || (
--         select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'
--       )
--     ),
--     body    := '{}'::jsonb
--   );
--   $cron$
-- );
--
-- Verificar por la RESPUESTA, no por `active = true`:
--   select status_code, content from net._http_response order by created desc limit 3;
