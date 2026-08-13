-- add-guarantee-claims.sql
--
-- Garantía de primera sesión (T&C §9.3): mecanismo.
--
-- ── Lo que NO hace falta construir ──────────────────────────────────────────
-- El reembolso ya existe. `mp-process-refunds` selecciona SOLO por
-- payment_status = 'reembolso_pendiente' y nunca mira `status`, así que una
-- sesión 'completada' marcada así la reembolsa el cron que ya corre, con su
-- `status` intacto. La nota vieja que decía que esto exigía reescribir el
-- status histórico partía de una lectura equivocada de esa función.
--
-- Lo que faltaba era (a) permiso para poner esa marca —el RLS de usuario solo
-- deja UPDATE hacia status='cancelada'— y (b) alguien que valide §9.3.
-- Ambas viven en la edge function `guarantee-claim`; esto es su registro.
--
-- ── Por qué tabla y no una columna en bookings ──────────────────────────────
-- La solicitud tiene ciclo propio (pedida → aprobada | rechazada) y §9.3 exige
-- poder DENEGAR por uso abusivo. Una columna no sabe expresar "pedida y
-- rechazada", y perder ese registro es justo lo que haría imposible detectar a
-- quien reincide — que es la única defensa que la cláusula se reservó.

create table if not exists public.guarantee_claims (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references public.bookings(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  -- coaches.id (igual que bookings.coach_id), NO profiles.id — reglas 1 y 2 de SCHEMA.md.
  coach_id      uuid not null references public.coaches(id) on delete cascade,
  status        text not null default 'pedida'
                check (status in ('pedida', 'aprobada', 'rechazada')),
  requested_at  timestamptz not null default now(),
  resolved_at   timestamptz,
  resolved_by   text,     -- quién la resolvió (mail del equipo); no hay panel admin todavía
  notes         text,     -- contexto de la decisión, sobre todo si se rechaza
  -- Una sola solicitud por reserva: reclamar dos veces la misma sesión no es un
  -- caso válido, y sin esto un reintento del mail duplicaría el reembolso.
  constraint guarantee_claims_one_per_booking unique (booking_id)
);

-- "Una sola vez por Cliente en toda la Plataforma" (§9.3) se resuelve contando
-- por user_id. Ver el comentario de la edge function sobre por qué cuenta
-- APROBADAS y no pedidas.
create index if not exists guarantee_claims_user_idx
  on public.guarantee_claims (user_id, status);

-- Consulta típica del equipo: lo pedido sin resolver, más viejo primero (es una
-- promesa con reloj, al revés que `reports`).
create index if not exists guarantee_claims_status_idx
  on public.guarantee_claims (status, requested_at);

alter table public.guarantee_claims enable row level security;

-- SELECT: el Cliente ve sus propias solicitudes. Sirve para poder mostrarle el
-- estado sin exponerle las de nadie más.
drop policy if exists guarantee_claims_select_own on public.guarantee_claims;
create policy guarantee_claims_select_own on public.guarantee_claims
  for select to authenticated
  using (user_id = auth.uid());

-- Sin INSERT/UPDATE/DELETE desde el cliente A PROPÓSITO. El intake es por mail
-- (§9.3) y la única vía de escritura es la edge function `guarantee-claim` con
-- service role, que es la que valida las condiciones. Si el día de mañana se
-- agrega un botón en la app, ese botón llama a la misma función — NO se abre
-- una policy de INSERT, porque entonces el cliente podría crear una solicitud
-- salteándose las validaciones.


-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación después de correr (pegar en el SQL editor, DE A UNA:
-- el editor de Supabase muestra solo el resultado de la última sentencia):
--
--   select column_name, data_type, is_nullable
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'guarantee_claims'
--   order by ordinal_position;
--   -- esperado: 9 filas
--
--   select polname, cmd from pg_policy
--   where polrelid = 'public.guarantee_claims'::regclass;
--   -- esperado: 1 fila — guarantee_claims_select_own / SELECT
