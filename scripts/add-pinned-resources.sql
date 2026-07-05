-- ============================================================
-- Vita — pinned_resources (hasta 4 recursos fijados al inicio)
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER
-- Fecha: 2026-07-05
--
-- Concepto NUEVO y distinto de saved_resources: "guardar" es la
-- biblioteca (ilimitada); "pinnear" es una selección curada de hasta
-- 4 que el usuario fija en su pantalla de inicio. El usuario pinnea
-- desde la ficha del recurso (screens/ResourceDetailScreen.tsx).
--
-- resource_id es text (mismo criterio que saved_resources): guarda el
-- uuid de resources serializado. La lista viene del detalle de recurso,
-- que hoy son recursos de coaches (tabla resources) — el inicio los
-- carga desde ahí y navega a /recurso.
--
-- El tope de 4 se hace por trigger (RLS no puede contar filas) —
-- mismo espíritu que fn_resource_proposals_protect_review_fields.
-- ============================================================

-- 1. Tabla
CREATE TABLE IF NOT EXISTS public.pinned_resources (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  resource_id  text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_pinned_resources_user
  ON public.pinned_resources(user_id, created_at DESC);

-- 2. RLS — solo el dueño ve/gestiona sus pins (igual que saved_resources)
ALTER TABLE public.pinned_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pinned_resources_select_own" ON public.pinned_resources;
DROP POLICY IF EXISTS "pinned_resources_insert_own" ON public.pinned_resources;
DROP POLICY IF EXISTS "pinned_resources_delete_own" ON public.pinned_resources;

CREATE POLICY "pinned_resources_select_own"
  ON public.pinned_resources FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "pinned_resources_insert_own"
  ON public.pinned_resources FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "pinned_resources_delete_own"
  ON public.pinned_resources FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Sin UPDATE: pinnear/despinnear es insert/delete.

-- 3. Tope de 4 por usuario (RLS no cuenta filas)
CREATE OR REPLACE FUNCTION public.fn_pinned_resources_max_four()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT count(*) FROM public.pinned_resources WHERE user_id = NEW.user_id) >= 4 THEN
    RAISE EXCEPTION 'No podés pinnear más de 4 recursos al inicio.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pinned_resources_max_four ON public.pinned_resources;
CREATE TRIGGER trg_pinned_resources_max_four
  BEFORE INSERT ON public.pinned_resources
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_pinned_resources_max_four();

-- 4. Refrescar caché PostgREST
NOTIFY pgrst, 'reload schema';
