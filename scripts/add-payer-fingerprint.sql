-- add-payer-fingerprint.sql
--
-- `bookings.payer_fingerprint` — una huella del pagador de Mercado Pago, para
-- poder saber si dos cuentas distintas son la misma persona.
--
-- ⚠️ PENDIENTE DE CORRER.
--
-- ── Por qué ahora y no después ───────────────────────────────────────────────
--
-- 🔴 **Es el único dato de toda la discusión de comisiones que NO se puede
-- reconstruir retroactivamente.** Los pagos que entren sin esto quedan ciegos
-- para siempre: Mercado Pago no guarda el histórico consultable por nosotros y
-- el objeto del pago solo pasa por el webhook una vez.
--
-- El caso que lo motiva: al coach se le va a cobrar menos por los clientes que
-- trae él. Eso crea el incentivo de pedirle a un cliente que VIVE le consiguió
-- que **se cree una cuenta nueva** con su link, y convertir una relación que
-- VIVE le presentó en "cliente propio" barato. Con mail nuevo no hay forma de
-- notarlo… salvo por el medio de pago: **la misma persona casi siempre paga con
-- la misma cuenta de Mercado Pago.**
--
-- 📌 Vale con cualquier esquema de comisión que se elija, incluso con ninguno:
-- también sirve para disputas y contracargos, donde probar quién pagó vale
-- plata.
--
-- ── Por qué una HUELLA y no el id del pagador ────────────────────────────────
--
-- Lo que se necesita responder es *"¿este pagador es el mismo que aquel?"*, y
-- para eso alcanza con comparar. **No hace falta guardar quién es.** Se guarda
-- `sha256(secreto + payer.id)`: se puede comparar, no se puede leer, y quien
-- acceda a la base no se lleva identificadores de Mercado Pago de nadie.
--
-- El secreto (`PAYER_FINGERPRINT_SALT`) va en las variables de la edge function.
-- 🔴 **Si se pierde o se cambia, las huellas viejas dejan de ser comparables con
-- las nuevas** — no se rompe nada, pero se pierde la continuidad. Es el precio
-- de que no sea reversible por fuerza bruta: el id de MP es un número corto y
-- sin sal se adivina probando.
--
-- ── ⚠️ Lo que hay que declarar antes de usarlo ───────────────────────────────
--
-- 🔴 **Esto es un tratamiento de datos con una finalidad NUEVA** —detectar que
-- dos cuentas son la misma persona— y bajo la Ley 25.326 va **declarado en la
-- política de privacidad ANTES del primer pago**, no después. No alcanza con
-- que sea una huella: sigue siendo un dato derivado de una persona.
--
-- 📌 Va con los placeholders que ya esperan al abogado (mismo criterio que
-- `session_attendance`, que también es metadato y también quedó anotado para
-- declarar). **Guardar la columna desde ya es correcto; usarla para negarle una
-- tarifa a alguien, recién cuando esté declarado.**

begin;

alter table public.bookings add column if not exists payer_fingerprint text;

-- Para la única consulta que esta columna habilita: "¿este pagador ya pagó
-- alguna vez a este coach?". Parcial, porque la enorme mayoría de las filas no
-- la va a tener (las viejas, y todo lo que no sea Mercado Pago).
create index if not exists bookings_payer_fingerprint_idx
  on public.bookings (coach_id, payer_fingerprint)
  where payer_fingerprint is not null;

commit;

-- ── VERIFICACIÓN ─────────────────────────────────────────────────────────────

-- 1) La columna existe y es nullable. Esperado: 1 fila, is_nullable = YES.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'bookings' and column_name = 'payer_fingerprint';

-- 2) El índice quedó. Esperado: 1 fila.
select indexname from pg_indexes
where schemaname = 'public' and tablename = 'bookings'
  and indexname = 'bookings_payer_fingerprint_idx';

-- 3) 🔴 El coach NO la puede escribir. La escribe el webhook con service role.
--    Esperado: 0 filas.
select column_name
from information_schema.column_privileges
where grantee in ('authenticated', 'anon')
  and table_schema = 'public' and table_name = 'bookings'
  and privilege_type = 'UPDATE' and column_name = 'payer_fingerprint';

-- 4) Después del primer pago real: que se esté llenando.
--    Esperado: al menos 1 fila con huella, de las pagadas por Mercado Pago.
select
  count(*) filter (where payment_provider = 'mp' and payment_status = 'aprobado') as pagadas_mp,
  count(*) filter (where payer_fingerprint is not null)                           as con_huella
from public.bookings;
