-- add-notifications-emailed-at.sql
--
-- `notifications.emailed_at` — cuándo se mandó por mail esa notificación.
--
-- ✅ CORRIDO el 09/09/2026, y el backfill verificado: **0 pendientes**.
-- ✅ Cron `mail-notificaciones` agendado (job 11, cada 5 minutos) **y verificado
--    contra su RESPUESTA, no contra `active = true`**: `net._http_response` tiene
--    un **200 con `sin pendientes`** a las 19:10:00 del 09/09.
--
-- 📌 Esa distinción no es formalismo: el cron de reembolsos estuvo dando 401
--    cada 5 minutos durante semanas con `active = true`, porque el Vault tenía
--    un placeholder. Lo único que prueba que un cron anda es su respuesta.
--
-- 📌 La prueba de que el backfill quedó bien no fue mirar la tabla: se invocó la
-- función a mano y devolvió **"sin pendientes"**. Si el backfill hubiera
-- fallado, esa llamada habría empezado a mandar mails viejos ahí mismo.
--
-- ── Por qué esto y no cuatro mails sueltos ───────────────────────────────────
--
-- Faltaban cuatro mails transaccionales: aprobación del coach, vencimiento a las
-- 24hs, cancelación y reembolso. Al ir a escribirlos apareció que **los cuatro
-- eventos YA insertan una fila en `notifications`** — incluido el vencimiento,
-- que lo hace el cron SQL `expire_pending_bookings()`.
--
-- 📌 O sea que ya existe el registro de *"pasó algo que esta persona tiene que
-- saber"*. El mail no es un evento nuevo: **es otro transporte del mismo
-- evento**, igual que la push. Así que en vez de cuatro caminos nuevos —cada uno
-- en un archivo distinto, cada uno con su forma de fallar— hay uno solo que
-- recorre lo que ya está anotado.
--
-- ⚠️ Lo que NO cubre: el aviso de "recibimos tu reserva" cuando el pago se
-- acredita y el coach todavía no confirmó. Ese caso **no inserta notificación
-- para el usuario** (la que se inserta es para el coach), así que ese mail sale
-- directo desde `_shared/booking-effects.ts`. Son dos mecanismos y está bien que
-- lo sean: uno avisa de un evento registrado, el otro de uno que no lo está.
--
-- ── 🔴 El backfill es lo más importante de este script ───────────────────────
--
-- Se marcan TODAS las notificaciones existentes como ya enviadas. **Sin esto, la
-- primera corrida del cron le mandaría un mail a cada persona por cada
-- notificación vieja que tenga** — meses de historia, de golpe, a gente que no
-- espera nada. Es el error clásico de agregar una cola sobre una tabla que ya
-- tiene datos, y no se puede deshacer una vez que los mails salieron.
--
-- No se pone `now()` por prolijidad: se pone porque el valor correcto de
-- "cuándo se mandó" para algo que nunca se va a mandar es "no lo mandes".

begin;

alter table public.notifications add column if not exists emailed_at timestamptz;

-- 🔴 EL BACKFILL. Ver arriba: todo lo viejo queda como ya enviado.
update public.notifications set emailed_at = now() where emailed_at is null;

-- Índice parcial para la consulta del cron, que es la única que usa la columna:
-- "las que faltan mandar". Al estar todo backfilleado, el índice nace casi
-- vacío y se mantiene chico — solo tiene lo pendiente.
create index if not exists notifications_pendientes_de_mail_idx
  on public.notifications (created_at)
  where emailed_at is null;

commit;

-- ── VERIFICACIÓN ─────────────────────────────────────────────────────────────

-- 1) 🔴 La que importa: NO puede quedar ninguna pendiente después del backfill.
--    Esperado: pendientes = 0. Si da cualquier otra cosa, NO agendes el cron
--    todavía — cada fila acá es un mail que va a salir.
select
  count(*)                                  as total,
  count(*) filter (where emailed_at is null) as pendientes
from public.notifications;

-- 2) La columna y el índice existen.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'notifications' and column_name = 'emailed_at';

select indexname from pg_indexes
where schemaname = 'public' and tablename = 'notifications'
  and indexname = 'notifications_pendientes_de_mail_idx';

-- 3) Después de que el cron corra un rato: qué se está mandando.
select type, count(*) as mandados, max(emailed_at) as ultimo
from public.notifications
where emailed_at > now() - interval '1 day'
group by type
order by mandados desc;
