-- ============================================================
-- Vita — resource_feedback (señal binaria "sirvió" post-uso)
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER
-- Requiere: scripts/add-resources.sql corrido antes (FK a resources.id)
-- Fecha: 2026-07-03
--
-- Migración 6/7. Idempotente.
--
-- Qué hace:
--   1. Crea resource_feedback — un booleano por (resource, user), nunca
--      expuesto como número público. UNIQUE(resource_id, user_id): un
--      usuario puede cambiar de opinión (UPDATE) pero no votar dos veces.
--   2. RLS de la TABLA: el usuario solo lee/crea/edita su propia fila.
--      A PROPÓSITO no hay ninguna policy que le dé al coach acceso de
--      fila a esta tabla — ni filtrada por sus recursos, ni nada.
--      Motivo: una policy de SELECT solo puede filtrar FILAS, no
--      columnas — si el coach tuviera acceso de fila a sus recursos
--      atribuidos, podría igual pedir `select user_id` y ver el
--      detalle de quién dejó cada feedback, violando "nunca expuesta
--      ... por usuario". Por eso el coach tiene CERO acceso directo a
--      esta tabla vía API/PostgREST.
--   3. Para que el coach vea el agregado (conteo), se expone la función
--      get_my_resource_feedback_summary() — SECURITY DEFINER, corre con
--      permisos elevados, filtra internamente por
--      resources.attributed_to_coach_id = auth.uid(), y devuelve SOLO
--      counts agregados por recurso. Nunca selecciona ni devuelve
--      user_id. Es el único camino que tiene un coach para ver esta
--      información — no hay policy alternativa que la exponga.
--
-- NO implementa todavía la detección de umbral ni el disparo de
-- notificación — eso es lógica de aplicación, fuera de este trabajo
-- (se arma en un paso posterior, sobre esta función).
-- ============================================================

-- 1. Tabla
CREATE TABLE IF NOT EXISTS public.resource_feedback (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id  uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sirvio       boolean NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_resource_feedback_resource_id ON public.resource_feedback(resource_id);

-- 2. RLS — solo el propio usuario, nunca el coach
ALTER TABLE public.resource_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resource_feedback_select_own" ON public.resource_feedback;
DROP POLICY IF EXISTS "resource_feedback_insert_own" ON public.resource_feedback;
DROP POLICY IF EXISTS "resource_feedback_update_own" ON public.resource_feedback;

CREATE POLICY "resource_feedback_select_own"
  ON public.resource_feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "resource_feedback_insert_own"
  ON public.resource_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "resource_feedback_update_own"
  ON public.resource_feedback FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Sin DELETE: si el usuario cambia de opinión, actualiza `sirvio`, no borra el rastro.

-- 3. Función agregada para el coach (única vía de acceso a esta señal)
CREATE OR REPLACE FUNCTION public.get_my_resource_feedback_summary()
RETURNS TABLE (
  resource_id      uuid,
  resource_title   text,
  sirvio_count     bigint,
  no_sirvio_count  bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    r.id,
    r.title,
    COUNT(*) FILTER (WHERE f.sirvio) AS sirvio_count,
    COUNT(*) FILTER (WHERE NOT f.sirvio) AS no_sirvio_count
  FROM public.resources r
  JOIN public.resource_feedback f ON f.resource_id = r.id
  WHERE r.attributed_to_coach_id = auth.uid()
  GROUP BY r.id, r.title;
$$;

REVOKE ALL ON FUNCTION public.get_my_resource_feedback_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_resource_feedback_summary() TO authenticated;

-- 4. Refrescar caché PostgREST
NOTIFY pgrst, 'reload schema';
