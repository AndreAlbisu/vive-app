-- Contracargos y disputas — D10 de `docs/decisiones-pagos.md`
-- ----------------------------------------------------------
-- 🔴 Hoy un contracargo de Mercado Pago se guarda con el MISMO valor que un
-- reembolso voluntario (`mp-webhook` mapea `charged_back → 'reembolsado'`). En
-- los datos son indistinguibles: no se puede contar cuántos hubo, ni detectar un
-- patrón, ni saber si un coach los acumula.
--
-- Y las disputas de PayPal directamente no llegan: el webhook procesa dos eventos
-- y el registrado en producción tiene suscritos exactamente esos dos.
--
-- ⚠️ La exposición es estructural: PayPal le da al comprador hasta 180 días para
-- disputar, y al coach se le paga a la semana de la sesión, sin reserva retenida.

-- ── 1. Un contracargo NO es un reembolso ─────────────────────────────────────
alter table public.bookings drop constraint if exists bookings_payment_status_check;
alter table public.bookings add constraint bookings_payment_status_check
  check (payment_status in
    ('no_iniciado','pendiente','aprobado','rechazado',
     'reembolso_pendiente','reembolsado','contracargo'));

-- 📝 Los dos son "la plata volvió", y por eso comparten `refunded_at`. Lo que los
-- separa es **quién lo decidió**: en el reembolso, nosotros o el coach; en el
-- contracargo, el comprador y su banco, sin pedirnos permiso. Esa diferencia es
-- la que hay que poder contar.

-- ── 2. La disputa, que es anterior al contracargo ────────────────────────────
-- Una disputa abierta todavía no movió plata: es el aviso de que puede moverse.
-- Se guarda aparte del estado del pago justo por eso — el pago sigue 'aprobado'
-- mientras la disputa está en curso.
alter table public.bookings
  add column if not exists disputed_at timestamptz,
  add column if not exists dispute_reason text;

comment on column public.bookings.disputed_at is
  'Cuándo se abrió una disputa sobre este pago. El payment_status NO cambia: la plata todavía no se movió.';
comment on column public.bookings.dispute_reason is
  'Motivo informado por el procesador. Texto libre: cada uno usa su propio vocabulario.';

-- Índice parcial: la consulta que importa es "qué hay abierto", no el histórico.
create index if not exists bookings_disputed_idx
  on public.bookings (disputed_at)
  where disputed_at is not null;

-- ── 3. La consulta que hoy nadie hace ────────────────────────────────────────
-- 🔴 Nada mira `paid_out_at` cuando la plata se va para atrás. Si un contracargo
-- cae sobre una sesión YA transferida al coach, la pierde VIVE — en silencio y
-- sin ningún registro de que eso fue lo que pasó.
--
-- Esta vista no arregla el problema (eso es recuperar la plata, y necesita el
-- registro de operaciones de D8), pero hace que se pueda VER.
create or replace view public.reversiones_despues_de_pagar as
  select
    b.id,
    b.coach_id,
    b.coach_name,
    b.payment_provider,
    b.payment_status,
    b.amount,
    b.currency,
    b.paid_out_at,
    b.payout_reference,
    b.refunded_at,
    b.disputed_at
  from public.bookings b
  where b.paid_out_at is not null
    and (b.payment_status in ('contracargo','reembolsado','reembolso_pendiente')
         or b.disputed_at is not null);

comment on view public.reversiones_despues_de_pagar is
  'Reservas donde la plata volvió (o está en disputa) DESPUÉS de habérsela transferido al coach. Cada fila es plata que hay que recuperar o dar por perdida.';

-- La ve solo el admin, como el resto del panel.
revoke all on public.reversiones_despues_de_pagar from anon, authenticated;


-- ── Verificación ─────────────────────────────────────────────────────────────
-- 1) El estado nuevo se acepta:
--    select pg_get_constraintdef(oid) from pg_constraint
--     where conname = 'bookings_payment_status_check';
--
-- 2) Las columnas:
--    select column_name from information_schema.columns
--     where table_name = 'bookings' and column_name in ('disputed_at','dispute_reason');
--
-- 3) La vista (debería devolver 0 filas hoy):
--    select * from public.reversiones_despues_de_pagar;
--
-- 4) Ningún contracargo viejo quedó escondido como reembolso — al 25/08/2026 no
--    hay ninguno, pero conviene mirarlo antes de confiar en el conteo:
--    select payment_status, count(*) from public.bookings
--     where payment_status in ('reembolsado','contracargo') group by 1;

-- ── Revertir ─────────────────────────────────────────────────────────────────
-- ⚠️ Volver atrás el CHECK con alguna fila en 'contracargo' FALLA, y está bien.
--   drop view if exists public.reversiones_despues_de_pagar;
--   drop index if exists bookings_disputed_idx;
--   alter table public.bookings drop column if exists disputed_at, drop column if exists dispute_reason;
