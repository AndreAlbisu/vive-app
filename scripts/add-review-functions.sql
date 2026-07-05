-- ============================================================
-- Vita — funciones de revisión de propuestas (una línea por acción)
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER
-- Requiere: todo el batch de la sesión 54 corrido (axes/tags, retired_at,
--           notification types propuesta_publicada/propuesta_ajustes)
-- Fecha: 2026-07-05
--
-- La revisión sigue siendo manual y humana (decisión sesión 52) — esto
-- solo empaqueta los bloques multi-paso de docs/revision-recursos.md en
-- una llamada transaccional cada uno, para sacarle fricción:
--
--   SELECT * FROM cola_revision;
--   SELECT revisar_aprobar('PROPOSAL_ID');                    -- usa los ejes propuestos
--   SELECT revisar_aprobar('PROPOSAL_ID', ARRAY['mente']);    -- o pisalos
--   SELECT revisar_ajustes('PROPOSAL_ID', 'nota para el coach');
--   SELECT revisar_descartar('PROPOSAL_ID', 'motivo');
--
-- Seguridad (lección 18 de SCHEMA.md): Supabase da EXECUTE a anon y
-- authenticated sobre toda función nueva vía default privileges — acá se
-- revoca de ambos EXPLÍCITAMENTE. Solo el rol postgres del SQL Editor /
-- service role pueden llamarlas. No son SECURITY DEFINER a propósito.
-- La vista es security_invoker para que no bypasee la RLS de
-- resource_proposals si alguien llegara a poder seleccionarla.
--
-- Los tags siguen siendo manuales (promoción a 'oficial' y linkeo es una
-- decisión aparte por tag, ver docs/revision-recursos.md paso 3).
-- ============================================================

-- 0. Vista de la cola
DROP VIEW IF EXISTS public.cola_revision;
CREATE VIEW public.cola_revision
WITH (security_invoker = true) AS
SELECT rp.id, p.name AS coach, rp.type, rp.title, rp.topic, rp.axes, rp.tags,
       rp.description, rp.duration_min, rp.content, rp.reviewer_notes, rp.updated_at
FROM public.resource_proposals rp
JOIN public.coaches c  ON c.id = rp.coach_id
JOIN public.profiles p ON p.id = c.profile_id
WHERE rp.status = 'enviada'
ORDER BY rp.updated_at;

REVOKE ALL ON public.cola_revision FROM PUBLIC, anon, authenticated;

-- 1. Aprobar y publicar (todo el bloque 3a en una transacción)
CREATE OR REPLACE FUNCTION public.revisar_aprobar(
  p_proposal_id uuid,
  p_axes text[] DEFAULT NULL  -- NULL = usar los ejes propuestos por el coach
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_resource_id uuid;
  v_axes text[];
  v_axis text;
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

-- 2. Pedir ajustes (bloque 3b)
CREATE OR REPLACE FUNCTION public.revisar_ajustes(p_proposal_id uuid, p_notas text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_notas IS NULL OR btrim(p_notas) = '' THEN
    RAISE EXCEPTION 'Las notas son obligatorias — nunca un estado sin explicación.';
  END IF;

  UPDATE public.resource_proposals
  SET status = 'necesita_ajustes', reviewer_notes = p_notas
  WHERE id = p_proposal_id AND status = 'enviada';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Propuesta % no existe o no está en enviada.', p_proposal_id;
  END IF;

  INSERT INTO public.notifications (recipient_id, type, title, body)
  SELECT c.profile_id, 'propuesta_ajustes',
         'Tu propuesta está casi lista',
         'Tu propuesta «' || rp.title || '» está casi lista. Te dejamos un par de sugerencias para terminarla juntos.'
  FROM public.resource_proposals rp
  JOIN public.coaches c ON c.id = rp.coach_id
  WHERE rp.id = p_proposal_id;
END;
$$;

-- 3. Descartar (bloque 3c — solo fuera de scope, sin notificación a propósito)
CREATE OR REPLACE FUNCTION public.revisar_descartar(p_proposal_id uuid, p_motivo text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'El motivo es obligatorio — nunca un descarte sin explicación.';
  END IF;

  UPDATE public.resource_proposals
  SET status = 'descartada', reviewer_notes = p_motivo
  WHERE id = p_proposal_id AND status = 'enviada';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Propuesta % no existe o no está en enviada.', p_proposal_id;
  END IF;
END;
$$;

-- 4. Permisos: solo SQL Editor / service role (lección 18 — revocar de
--    anon Y authenticated explícito, REVOKE FROM PUBLIC no alcanza)
REVOKE ALL ON FUNCTION public.revisar_aprobar(uuid, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revisar_ajustes(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revisar_descartar(uuid, text) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
