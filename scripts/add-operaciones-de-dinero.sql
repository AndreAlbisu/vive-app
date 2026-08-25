-- Registro de operaciones de dinero — D8 de `docs/decisiones-pagos.md`
-- --------------------------------------------------------------------
-- 🔴 CORRECCIÓN DE LA DECISIÓN ORIGINAL. D8 decía "no hay ningún registro de
-- operaciones" y proponía una tabla append-only nueva. **Eso era falso**:
-- `admin_audit_log` ya existe, ya es append-only, ya guarda quién hizo qué sobre
-- qué y cuándo, y ya lo escribe `audit()` en cada acción del panel.
--
-- Lo que de verdad faltaba es más chico: **los montos viven sueltos dentro del
-- `details` jsonb**, con nombres distintos según la acción, y `mark_coach_paid`
-- directamente no guardaba cuánto se transfirió. O sea que se podía contestar
-- "quién hizo qué el martes" pero no "cuánta plata movimos".
--
-- Esto no crea una tabla: **fija una forma para los campos de dinero** dentro de
-- `details` y expone una vista que los saca tipados.

-- ── La forma acordada ────────────────────────────────────────────────────────
-- Toda acción del panel que mueva dinero escribe, además de lo suyo:
--   monto              numérico, en la moneda de abajo
--   moneda             'ARS' | 'USD'
--   riel               'mp' | 'paypal' | 'usdt'
--   referencia         hash de la tx o número de operación
--   tipo_cambio        solo si hubo conversión (hoy no hay: ver D4)
--   fuente_tipo_cambio de dónde salió esa cotización
--
-- ⚠️ `tipo_cambio` y `fuente_tipo_cambio` existen aunque hoy nunca se usen. Con
-- la regla espejo (D4) VIVE no convierte moneda para pagarle a nadie, así que
-- están vacíos por diseño. Quedan porque **el día que haya una excepción manual,
-- el lugar donde anotarla tiene que existir de antes** — si no, se anota en
-- ningún lado y se pierde.

create or replace view public.operaciones_de_dinero as
  select
    l.id,
    l.created_at,
    l.admin_email,
    l.action,
    l.target_id                              as booking_id,
    (l.details->>'monto')::numeric           as monto,
    l.details->>'moneda'                     as moneda,
    l.details->>'riel'                       as riel,
    l.details->>'referencia'                 as referencia,
    (l.details->>'tipo_cambio')::numeric     as tipo_cambio,
    l.details->>'fuente_tipo_cambio'         as fuente_tipo_cambio,
    -- El detalle entero queda accesible: la vista es una comodidad para
    -- consultar, no un reemplazo del registro.
    l.details                                as detalle_completo
  from public.admin_audit_log l
  where l.action in ('mark_coach_paid', 'mark_usdt_refunded');

comment on view public.operaciones_de_dinero is
  'Las acciones del panel que mueven plata, con los campos de dinero sacados del details. No es una tabla: la fuente sigue siendo admin_audit_log, que es append-only.';

-- Solo el admin, como el log del que sale.
revoke all on public.operaciones_de_dinero from anon, authenticated;

-- ── Verificación ─────────────────────────────────────────────────────────────
-- 1) La vista existe y lee:
--    select * from public.operaciones_de_dinero order by created_at desc limit 10;
--
-- 2) ⚠️ Las filas ANTERIORES a este cambio van a tener `monto` en null: se
--    escribieron sin la forma acordada. No se rellenan — el registro no se
--    reescribe. Para saber cuántas son:
--    select action, count(*) filter (where (details->>'monto') is null) as sin_monto,
--           count(*) as total
--      from public.admin_audit_log
--     where action in ('mark_coach_paid','mark_usdt_refunded')
--     group by 1;
--
-- 3) Que el log siga siendo append-only (nadie más que el service role escribe):
--    select polname, polcmd from pg_policy
--     where polrelid = 'public.admin_audit_log'::regclass;

-- ── Revertir ─────────────────────────────────────────────────────────────────
--   drop view if exists public.operaciones_de_dinero;
