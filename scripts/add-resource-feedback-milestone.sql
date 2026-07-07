-- ============================================================
-- Vita — trigger de hito en resource_feedback
-- Fecha: 2026-07-07
--
-- Dispara una notificación al coach cuando un recurso suyo
-- acumula exactamente 10, 25 o 50 votos positivos ("sirvió").
--
-- Depende de:
--   - resource_feedback (resource_id, user_id, sirvio) — ya existe
--   - notifications (recipient_id, type, title, body) — ya existe
--   - notifications.type CHECK incluye 'recurso_feedback_umbral' — ya existe
--   - resources.attributed_to_coach_id — ya existe
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_resource_feedback_milestone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count     integer;
  v_coach_id  uuid;
  v_titulo    text;
BEGIN
  -- Solo nos importan los votos positivos
  IF NOT NEW.sirvio THEN
    RETURN NEW;
  END IF;

  -- Contar sirvió=true para este recurso (incluyendo el voto recién insertado)
  SELECT count(*) INTO v_count
  FROM public.resource_feedback
  WHERE resource_id = NEW.resource_id AND sirvio = true;

  -- Solo disparar en hitos exactos: 10, 25, 50
  IF v_count NOT IN (10, 25, 50) THEN
    RETURN NEW;
  END IF;

  -- Buscar el coach atribuido y el título del recurso
  SELECT attributed_to_coach_id, title
  INTO v_coach_id, v_titulo
  FROM public.resources
  WHERE id = NEW.resource_id;

  -- Sin coach atribuido → no hay a quién notificar
  IF v_coach_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insertar la notificación
  INSERT INTO public.notifications (recipient_id, type, title, body)
  VALUES (
    v_coach_id,
    'recurso_feedback_umbral',
    'Tu recurso está ayudando',
    format('A %s personas les sirvió "%s".', v_count, v_titulo)
  );

  RETURN NEW;
END;
$$;

-- REVOKE de anon explícito (mismo patrón que get_my_resource_feedback_summary)
REVOKE EXECUTE ON FUNCTION public.fn_resource_feedback_milestone() FROM anon;

DROP TRIGGER IF EXISTS trg_resource_feedback_milestone ON public.resource_feedback;
CREATE TRIGGER trg_resource_feedback_milestone
  AFTER INSERT OR UPDATE OF sirvio ON public.resource_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_resource_feedback_milestone();

NOTIFY pgrst, 'reload schema';
