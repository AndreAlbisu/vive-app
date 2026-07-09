-- ============================================================
-- revisar_aprobar — ahora también materializa resource_topics
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER
-- Requiere: add-resource-topics.sql corrido primero.
-- Fecha: 2026-07-09
--
-- Antes rp.topic era solo una "pista" textual para el revisor y no quedaba
-- linkeado a nada. Ahora, al aprobar, se inserta como fila real en
-- resource_topics para que la biblioteca sea filtrable por subtema.
--
-- Se agrega el param opcional p_topics text[] (default: el único rp.topic).
-- Como cambia la firma, se DROPea la versión vieja (uuid, text[]) primero para
-- no dejar una sobrecarga ambigua — las llamadas de 1 y 2 args siguen andando
-- por los DEFAULT de la nueva versión de 3 args.
-- ============================================================

DROP FUNCTION IF EXISTS public.revisar_aprobar(uuid, text[]);

CREATE OR REPLACE FUNCTION public.revisar_aprobar(
  p_proposal_id uuid,
  p_axes   text[] DEFAULT NULL,   -- NULL = usar los ejes propuestos por el coach
  p_topics text[] DEFAULT NULL    -- NULL = usar el subtema propuesto (rp.topic)
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_resource_id uuid;
  v_axes   text[];
  v_axis   text;
  v_topics text[];
  v_topic  text;
BEGIN
  -- attributed_to_coach_id toma c.profile_id (profiles.id), NUNCA c.id —
  -- resuelto por join acá adentro para que no se pueda equivocar nadie.
  INSERT INTO public.resources (proposal_id, attributed_to_coach_id, type, title, description, duration_min, content)
  SELECT rp.id, c.profile_id, rp.type, rp.title, rp.description, rp.duration_min, rp.content
  FROM public.resource_proposals rp
  JOIN public.coaches c ON c.id = rp.coach_id
  WHERE rp.id = p_proposal_id AND rp.status = 'enviada'
  RETURNING id INTO v_resource_id;

  IF v_resource_id IS NULL THEN
    RAISE EXCEPTION 'Propuesta % no existe o no está en enviada (¿ya fue revisada?)', p_proposal_id;
  END IF;

  -- Ejes (cuerpo/mente/alma) → resource_axes
  SELECT COALESCE(p_axes, rp.axes) INTO v_axes
  FROM public.resource_proposals rp WHERE rp.id = p_proposal_id;

  IF v_axes IS NOT NULL THEN
    FOREACH v_axis IN ARRAY v_axes LOOP
      -- el CHECK de resource_axes valida cuerpo/mente/alma; un valor inválido
      -- aborta toda la transacción (no queda nada a medias)
      INSERT INTO public.resource_axes (resource_id, axis)
      VALUES (v_resource_id, v_axis)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Subtemas AXES (28) → resource_topics. Default: el único topic propuesto.
  -- Se puede pisar/extender con p_topics si el revisor quiere más de un subtema.
  SELECT COALESCE(
           p_topics,
           CASE WHEN rp.topic IS NULL THEN NULL ELSE ARRAY[rp.topic] END
         ) INTO v_topics
  FROM public.resource_proposals rp WHERE rp.id = p_proposal_id;

  IF v_topics IS NOT NULL THEN
    FOREACH v_topic IN ARRAY v_topics LOOP
      INSERT INTO public.resource_topics (resource_id, topic)
      VALUES (v_resource_id, v_topic)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  UPDATE public.resource_proposals SET status = 'aprobada' WHERE id = p_proposal_id;

  INSERT INTO public.notifications (recipient_id, type, title, body)
  SELECT c.profile_id, 'propuesta_publicada',
         '🌱 Tu recurso ya está publicado',
         'Tu recurso «' || rp.title || '» ya está en VITA. Tus clientes ya pueden usarlo desde tu perfil.'
  FROM public.resource_proposals rp
  JOIN public.coaches c ON c.id = rp.coach_id
  WHERE rp.id = p_proposal_id;

  RETURN v_resource_id;
END;
$$;

-- Permisos: solo SQL Editor / service role (lección 18 — revocar de anon Y
-- authenticated explícito, REVOKE FROM PUBLIC no alcanza).
REVOKE ALL ON FUNCTION public.revisar_aprobar(uuid, text[], text[]) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
