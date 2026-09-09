-- add-payer-fingerprint.sql
--
-- `bookings.payer_fingerprint` — una huella del pagador de Mercado Pago, para
-- poder saber si dos cuentas distintas son la misma persona.
--
-- ✅ CORRIDO el 09/09/2026. La columna y el índice existen.
-- ✅ `PAYER_FINGERPRINT_SALT` creada por CLI (`supabase secrets set`) el mismo
--    día, y `mp-webhook` redeployada a **v33** con el código que la usa.
--
-- ✅ **PROBADO CON PLATA REAL el 09/09/2026, y con el caso exacto que motiva
-- todo esto** — apareció solo, probando el checkout web:
--
--     reservas_con_huella | pagadores_distintos | cuentas_distintas
--              3          |          1          |         2
--
-- 🔴 **Dos cuentas de la app distintas, un solo pagador.** Es literalmente el
-- escenario que esta columna viene a detectar: la misma persona reservando
-- desde dos usuarios diferentes, reconocible solo por el medio de pago. Salió
-- de que Andre probó el flujo con su mail y con un alias, pagando las dos veces
-- con la misma cuenta de Mercado Pago. **Vale más que cualquier test**: es el
-- caso real, con plata real, y demuestra que la huella identifica a la PERSONA
-- y no al pago.
--
-- 📌 Los otros 8 pagos por MP de la base no tienen huella y está bien: son
-- anteriores al deploy. Por eso se hizo antes de seguir — hacia atrás no se
-- reconstruye.
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

-- 4 bis) 🔴 LA CONSULTA QUE ESTO HABILITA — el mismo pagador desde cuentas
--    distintas, con el mismo coach. Es la señal de que una relación se "lavó"
--    a una cuenta nueva para caer en la tarifa del link.
--
--    ⚠️ **No es una acusación por sí sola**: una pareja que comparte la cuenta
--    de Mercado Pago, o alguien que le paga la sesión a otro, dan lo mismo. Es
--    el punto de partida de una conversación, no una regla automática — y
--    encaja con la medida anti-fuga #5, la detección diferida.
--
--    ⚠️ Y antes de usarla para negarle una tarifa a alguien hay que declarar la
--    finalidad en la política de privacidad (ver arriba).
select
  b.coach_id,
  b.payer_fingerprint,
  count(distinct b.user_id) as cuentas_distintas,
  count(*)                  as reservas,
  min(b.created_at)         as primera,
  max(b.created_at)         as ultima
from public.bookings b
where b.payer_fingerprint is not null
group by b.coach_id, b.payer_fingerprint
having count(distinct b.user_id) > 1
order by cuentas_distintas desc, reservas desc;

-- 4) Después del primer pago real: que se esté llenando.
--    Esperado: al menos 1 fila con huella, de las pagadas por Mercado Pago.
select
  count(*) filter (where payment_provider = 'mp' and payment_status = 'aprobado') as pagadas_mp,
  count(*) filter (where payer_fingerprint is not null)                           as con_huella
from public.bookings;
