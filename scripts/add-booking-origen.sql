-- add-booking-origen.sql
--
-- `bookings.origen` — por dónde entró esta reserva.
--
-- ✅ CORRIDO el 09/09/2026. La columna existe y `web-book` ya escribe `'link'`.
-- ⚠️ El CHECK no se pudo verificar desde afuera: RLS bloquea el insert antes de
--    llegar a él (correcto — `anon` no inserta reservas). Queda la verificación
--    2 de abajo, desde el editor.
--
-- ── Por qué ahora ────────────────────────────────────────────────────────────
--
-- Decisión de Andre (08/09/2026): la columna de origen **se diseña junto con el
-- link**, porque el link define cómo llega el dato. El link ya está
-- (`/c/<slug>`, con su checkout), así que es ahora.
--
-- 🔴 **Y es del mismo tipo que `payer_fingerprint`: no se puede reconstruir.**
-- Una reserva que entra hoy sin marca queda indistinguible para siempre de una
-- del catálogo. Por eso se agrega antes de abrir el checkout y no después.
--
-- ── Para qué sirve ───────────────────────────────────────────────────────────
--
-- 1. **La comisión del link.** Al coach se le va a cobrar distinto por los
--    clientes que trae él (recomendación del consejo: la primera sesión sin
--    comisión). Sin esta columna no hay forma de saber cuáles son.
-- 2. **Saber si el link funciona.** Es la única manera de contestar "¿cuántas
--    reservas trajo el canal del coach?" — que es la pregunta que decide si esa
--    estrategia de lanzamiento sirvió o no.
--
-- ── Por qué texto libre acotado y no un booleano ─────────────────────────────
--
-- `es_del_link` sería suficiente hoy y estaría mal mañana: ya se ve venir al
-- menos un tercer caso (una reserva hecha por el coach a nombre de alguien). Un
-- booleano obliga a agregar otra columna; un texto con CHECK se extiende
-- agregando un valor.
--
-- ⚠️ **`null` significa "no sabemos", no "app"**, y es a propósito: todas las
-- filas viejas quedan en null, y llamarlas 'app' sería afirmar algo que nadie
-- verificó. La app empieza a marcarse cuando alguien lo agregue a
-- `BookingScreen_Confirm`; hasta entonces, null.

begin;

alter table public.bookings add column if not exists origen text;

-- El CHECK acepta null: es el estado de todo lo anterior y de la app hasta que
-- se marque. Lo que NO acepta es un valor inventado.
alter table public.bookings drop constraint if exists bookings_origen_check;
alter table public.bookings add constraint bookings_origen_check
  check (origen is null or origen in ('link', 'app', 'catalogo'));

-- Para la pregunta que esta columna habilita: "las reservas del link de este
-- coach". Parcial porque la enorme mayoría de las filas no la va a tener.
create index if not exists bookings_origen_idx
  on public.bookings (coach_id, origen)
  where origen is not null;

commit;

-- ── VERIFICACIÓN ─────────────────────────────────────────────────────────────

-- 1) La columna existe y es nullable. Esperado: 1 fila, is_nullable = YES.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'bookings' and column_name = 'origen';

-- 2) El CHECK rechaza lo que no está en la lista. Esperado: ERROR.
--    ⚠️ Correr suelto: si falla, la transacción de arriba ya está commiteada.
-- update public.bookings set origen = 'inventado' where id = (select id from bookings limit 1);

-- 3) 🔴 El coach/usuario NO la puede escribir: la pone `web-book` con service
--    role. Esperado: 0 filas.
select column_name
from information_schema.column_privileges
where grantee in ('authenticated', 'anon')
  and table_schema = 'public' and table_name = 'bookings'
  and privilege_type = 'UPDATE' and column_name = 'origen';

-- 4) Después de la primera reserva por el link: que se esté marcando.
select coalesce(origen, '(sin marcar)') as origen, count(*) as reservas
from public.bookings
group by 1
order by reservas desc;
