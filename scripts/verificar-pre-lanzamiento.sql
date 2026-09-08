-- verificar-pre-lanzamiento.sql — SOLO LECTURA. Correr ANTES de abrir la app.
--
-- ── Por qué existe ───────────────────────────────────────────────────────────
-- Hay cosas que son inofensivas con cero usuarios y peligrosas con uno. El caso
-- que lo motivó: **"Coach Prueba" está publicado en el catálogo con
-- `price_per_session = 1`**, y desde el 26/08 `mp-create-payment` deriva el
-- precio de esa columna — o sea que cobraría $1 de verdad.
--
-- 🔴 Se decidió DEJARLO hasta el lanzamiento (08/09/2026), porque hace falta un
-- coach para ejercitar los flujos. La decisión es correcta y el riesgo hoy es
-- cero. **El riesgo es olvidárselo.** Este archivo existe para que no dependa de
-- que alguien se acuerde: es la lista que hay que correr con la service key
-- antes de dejar entrar a la primera persona.
--
-- Cada chequeo devuelve filas SOLO si hay un problema. **Todo vacío = pasa.**
--
-- Mismo criterio que `verificar-riel-paypal.sql`: el estado real se le pregunta
-- a la base, no al changelog.

-- ── 1. 🔴 Coaches publicados con precio irrisorio ───────────────────────────
-- Lo que cobra la app sale de `coaches.price_per_session`, y no hay CHECK ni
-- trigger que lo valide (SCHEMA.md: "la garantía son las tres funciones de
-- cobro"). Un coach de prueba olvidado es plata real de una persona real.
select 'coach con precio irrisorio' as problema,
       c.id, p.name, c.price_per_session, c.availability_status
from coaches c
join profiles p on p.id = c.profile_id
where c.availability_status = 'activo'
  and c.verified = true
  and c.price_per_session < 1000;

-- ── 2. Coaches visibles sin precio ──────────────────────────────────────────
-- `search3.tsx` formatea el precio sin chequear null. Hoy no hay ninguno (0 de
-- 34, verificado el 07/09) y no se sabe si la columna es NOT NULL — este
-- chequeo lo responde solo el día que aparezca uno.
select 'coach visible sin precio' as problema,
       c.id, p.name, c.availability_status
from coaches c
join profiles p on p.id = c.profile_id
where c.availability_status = 'activo'
  and c.verified = true
  and c.price_per_session is null;

-- ── 3. Coaches que anuncian internacional sin poder cobrarlo ────────────────
-- `accepts_international` es derivada, pero los rieles se leen sueltos: un coach
-- con PayPal/USDT en true y sin `price_usd` aparecería en el catálogo del
-- exterior y la pantalla de pago lo rechazaría con 409.
select 'anuncia internacional sin precio en USD' as problema,
       c.id, p.name, c.accepts_paypal, c.accepts_usdt, c.price_usd
from coaches c
join profiles p on p.id = c.profile_id
where c.availability_status = 'activo'
  and (c.accepts_paypal or c.accepts_usdt)
  and c.price_usd is null;

-- ── 4. Reservas de prueba con fechas movidas a mano ─────────────────────────
-- Durante las pruebas se mueven fechas para forzar señales (el banner del
-- paquete, las ramas del piso de seguridad). Una reserva confirmada a futuro que
-- nadie va a atender le promete una sesión a alguien.
select 'reserva confirmada a futuro con coach en pausa o sin verificar' as problema,
       b.id, b.scheduled_date, b.status, p.name
from bookings b
join coaches c on c.id = b.coach_id
join profiles p on p.id = c.profile_id
where b.status = 'confirmada'
  and b.scheduled_date >= current_date
  and (c.availability_status <> 'activo' or c.verified = false);

-- ── 5. Filas de ánimo con fecha centinela ───────────────────────────────────
-- Las verificaciones contra la base usan fechas centinela (`2020-01-01`) y se
-- limpian después. Si quedó alguna, es basura de prueba en datos sensibles.
select 'registro de ánimo con fecha centinela' as problema,
       user_id, entry_date, mood_id
from mood_entries
where entry_date < '2024-01-01';

-- ── Qué NO chequea esto ──────────────────────────────────────────────────────
-- Las feature flags (`AI_REFLECTION_ENABLED`, `SAFETY_FLOOR_ENABLED`) viven en
-- el bundle, no en la base — se leen en `constants/features.ts`. Y el estado de
-- lo que solo se verifica en dispositivo (el piso de seguridad, la matrícula en
-- vivo) está en `docs/problemas-abiertos.md`, bloque A.
