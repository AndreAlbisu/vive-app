-- ============================================================
-- Recursos v2 — Migración F1
-- Fecha: 2026-07-13
-- Aplicar en: Supabase Dashboard → SQL Editor
--
-- QUÉ HACE:
--   1. Crea 4 tablas nuevas (coach_resources, resource_recommendations,
--      resource_saves, resource_events) con RLS.
--   2. Extiende messages con columna metadata jsonb (nullable, backwards-compat).
--   3. Sube el límite del bucket resource-audio de 20 MB a 30 MB.
--
-- QUÉ NO TOCA:
--   - Tablas existentes: resources, resource_proposals, saved_resources,
--     resource_completions, resource_feedback, resource_axes, resource_tags,
--     resource_tag_links, resource_topics — sin cambios.
--   - La constraint CHECK de messages.sender_type — no la tocamos; las
--     recomendaciones de recursos viajan con sender_type='coach' + metadata.
--
-- NOTA SOBRE TAXONOMÍA:
--   La tabla vieja usa resource_axes (3 ejes: cuerpo/mente/alma) y los
--   28 subtemas de AXES. La nueva usa topic_id (las 10 puertas de Conexiones:
--   ansiedad, animo, relaciones, foco, descanso, nutricion, sexualidad,
--   proposito, identidad, espiritualidad). Son taxonomías distintas que
--   coexisten sin conflicto.
--
-- NOTA SOBRE VIDEO:
--   La tabla vieja guarda video en Supabase Storage (bucket resource-video).
--   coach_resources.format='video' usa URL de YouTube (campo url). Son
--   mecanismos distintos que coexisten.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. TABLA: coach_resources
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coach_resources (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- coach_id → coaches.id (PK interno, mismo criterio que coach_topics,
  -- coach_availability, coach_weekly_pattern, bookings)
  coach_id         uuid        NOT NULL REFERENCES public.coaches(id) ON DELETE RESTRICT,
  title            text        NOT NULL,
  description      text,
  -- format: qué tipo de contenido es (determina cómo se reproduce)
  format           text        NOT NULL CHECK (format IN ('audio', 'podcast', 'video', 'lectura')),
  -- source: dónde vive el archivo (native = Storage, external = link)
  source           text        NOT NULL CHECK (source IN ('native', 'external')),
  -- url: para podcast (Spotify/Apple/YouTube) y video (YouTube)
  url              text,
  -- storage_path: para audio nativo en bucket resource-audio
  storage_path     text,
  -- body_md: para lectura (markdown)
  body_md          text,
  -- topic_id: una de las 10 puertas de Conexiones (sin CHECK — la lista
  -- vive en el frontend, mismo criterio que coach_topics.topic)
  topic_id         text        NOT NULL,
  duration_seconds integer,
  -- status: ciclo de vida del recurso (moderación manual vía editor Supabase)
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'published', 'rejected', 'archived')),
  -- rejection_rule: número de regla de contenido incumplida (1-6)
  rejection_rule   smallint    CHECK (rejection_rule BETWEEN 1 AND 6),
  -- is_author_declared: el coach aceptó las reglas al subir
  is_author_declared boolean   NOT NULL DEFAULT false,
  created_at       timestamptz DEFAULT now()
);

-- Validaciones en cliente (no constraints en DB — mismo criterio que el resto):
--   title:       máx. 80 chars
--   description: máx. 200 chars
--   audio:       storage_path requerido, source='native', máx. 30 MB
--   podcast:     url requerida, source='external', dominio spotify/apple/youtube
--   video:       url requerida, source='external', dominio youtube.com/youtu.be
--   lectura:     body_md requerido, source='native', máx. ~1000 palabras

-- Índices
CREATE INDEX IF NOT EXISTS idx_coach_resources_status
  ON public.coach_resources(status);
CREATE INDEX IF NOT EXISTS idx_coach_resources_coach_id
  ON public.coach_resources(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_resources_topic_id
  ON public.coach_resources(topic_id);

-- RLS
ALTER TABLE public.coach_resources ENABLE ROW LEVEL SECURITY;

-- Usuarios (y coaches visitando la biblioteca): solo los published
-- El propio coach: ve TODOS los suyos (cualquier status)
CREATE POLICY "coach_resources_select"
  ON public.coach_resources FOR SELECT
  USING (
    status = 'published'
    OR
    coach_id IN (SELECT id FROM public.coaches WHERE profile_id = auth.uid())
  );

-- Solo el coach dueño puede insertar (el status arranca en 'pending')
CREATE POLICY "coach_resources_insert"
  ON public.coach_resources FOR INSERT
  WITH CHECK (
    coach_id IN (SELECT id FROM public.coaches WHERE profile_id = auth.uid())
    AND is_author_declared = true
  );

-- Solo el coach dueño puede actualizar (para archivar o editar borradores)
-- El pasaje pending→published/rejected lo hace VITA desde el editor (service role),
-- que no pasa por RLS de authenticated.
CREATE POLICY "coach_resources_update"
  ON public.coach_resources FOR UPDATE
  USING (
    coach_id IN (SELECT id FROM public.coaches WHERE profile_id = auth.uid())
  )
  WITH CHECK (
    coach_id IN (SELECT id FROM public.coaches WHERE profile_id = auth.uid())
  );

-- Sin política de DELETE — nadie borra, se archiva (status → 'archived')


-- ────────────────────────────────────────────────────────────
-- 2. TABLA: resource_recommendations
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.resource_recommendations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid        NOT NULL REFERENCES public.coach_resources(id) ON DELETE RESTRICT,
  -- coach_id → coaches.id (mismo criterio que coach_topics, bookings.coach_id)
  coach_id    uuid        NOT NULL REFERENCES public.coaches(id) ON DELETE RESTRICT,
  -- user_id → profiles.id (el usuario que recibe la recomendación)
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- room_id → salas.id (la sala de la que surgió la recomendación)
  room_id     uuid        NOT NULL REFERENCES public.salas(id) ON DELETE CASCADE,
  -- nota opcional del coach ("escuchalo esta noche antes de dormir")
  note        text        CHECK (char_length(note) <= 200),
  -- opened_at: null = sin abrir; not null = visto (set por el usuario al abrir)
  opened_at   timestamptz,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resource_recommendations_user_id
  ON public.resource_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_resource_recommendations_coach_id
  ON public.resource_recommendations(coach_id);
CREATE INDEX IF NOT EXISTS idx_resource_recommendations_resource_id
  ON public.resource_recommendations(resource_id);

ALTER TABLE public.resource_recommendations ENABLE ROW LEVEL SECURITY;

-- Solo el coach que envió y el usuario que recibe pueden ver la recomendación
CREATE POLICY "resource_recommendations_select"
  ON public.resource_recommendations FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    coach_id IN (SELECT id FROM public.coaches WHERE profile_id = auth.uid())
  );

-- Solo el coach puede crear recomendaciones
CREATE POLICY "resource_recommendations_insert"
  ON public.resource_recommendations FOR INSERT
  WITH CHECK (
    coach_id IN (SELECT id FROM public.coaches WHERE profile_id = auth.uid())
  );

-- Solo el usuario receptor puede marcar como abierto (update opened_at)
CREATE POLICY "resource_recommendations_update"
  ON public.resource_recommendations FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- 3. TABLA: resource_saves
-- ────────────────────────────────────────────────────────────
-- Nota: separada de saved_resources existente (que usa resource_id TEXT
-- y acepta slugs de tools de VITA). Esta tabla es solo para UUIDs de
-- coach_resources — PK compuesta limpia, sin mezclar tipos.
CREATE TABLE IF NOT EXISTS public.resource_saves (
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  resource_id uuid        NOT NULL REFERENCES public.coach_resources(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_resource_saves_user_id
  ON public.resource_saves(user_id);

ALTER TABLE public.resource_saves ENABLE ROW LEVEL SECURITY;

-- Solo el dueño puede ver y gestionar sus guardados
CREATE POLICY "resource_saves_all"
  ON public.resource_saves FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- 4. TABLA: resource_events (métrica flywheel)
-- ────────────────────────────────────────────────────────────
-- La métrica que valida todo: view → play → complete → coach_profile_visit
-- → booking_started. Si ese funnel existe, el pitch a coaches nuevos se
-- vende solo.
CREATE TABLE IF NOT EXISTS public.resource_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  resource_id uuid        NOT NULL REFERENCES public.coach_resources(id) ON DELETE CASCADE,
  event       text        NOT NULL
                          CHECK (event IN ('view', 'play', 'complete', 'coach_profile_visit', 'booking_started')),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resource_events_resource_id
  ON public.resource_events(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_events_user_id
  ON public.resource_events(user_id);

ALTER TABLE public.resource_events ENABLE ROW LEVEL SECURITY;

-- Solo el usuario puede insertar sus propios eventos
CREATE POLICY "resource_events_insert"
  ON public.resource_events FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Lectura solo para service_role (analítica interna) — sin política SELECT
-- → ni anon ni authenticated pueden leer; solo service role / SQL Editor.
-- Mismo patrón que coach_mp_accounts.


-- ────────────────────────────────────────────────────────────
-- 5. ALTER TABLE messages: columna metadata
-- ────────────────────────────────────────────────────────────
-- Añade metadata jsonb nullable. Todos los mensajes existentes quedan con
-- metadata = NULL (backwards-compatible, no hay que migrar datos).
--
-- Uso para recomendaciones de recursos:
--   sender_type = 'coach'  (ya válido en el CHECK constraint existente)
--   content     = encryptMessage(titulo + nota) → texto fallback si no hay render
--   metadata    = { "type": "resource", "resource_id": "uuid", "recommendation_id": "uuid" }
--
-- El renderer en SalaScreen chequea metadata?.type === 'resource' para
-- mostrar la card embebida. Si metadata es null o type desconocido, cae
-- al render normal de burbuja de texto.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Sin cambios a RLS de messages — hereda las políticas existentes.


-- ────────────────────────────────────────────────────────────
-- 6. BUCKET resource-audio: límite 20 MB → 30 MB
-- ────────────────────────────────────────────────────────────
UPDATE storage.buckets
  SET file_size_limit = 31457280   -- 30 MB en bytes
WHERE id = 'resource-audio';

-- Verificar que quedó:
-- SELECT id, file_size_limit FROM storage.buckets WHERE id = 'resource-audio';


-- ────────────────────────────────────────────────────────────
-- 7. SEED — datos de prueba (BORRAR antes de producción)
-- ────────────────────────────────────────────────────────────
-- Para borrar el seed completo:
--   DELETE FROM public.coach_resources WHERE title LIKE '[SEED]%';
--   (cascade borra resource_recommendations y resource_saves relacionados)
--
-- El seed toma el primer coach disponible en la base. Si no hay ninguno,
-- el bloque DO emite un NOTICE y no inserta nada.
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_coach_id         uuid;
  v_coach_profile_id uuid;
  v_sala_id          uuid;
  v_user_id          uuid;
  v_resource_id      uuid;

  -- IDs de recursos seed (fijos para poder borrarlos por nombre igualmente)
  r_audio1   uuid;
  r_audio2   uuid;
  r_podcast1 uuid;
  r_podcast2 uuid;
  r_video1   uuid;
  r_video2   uuid;
  r_lectura1 uuid;
  r_lectura2 uuid;
BEGIN

  -- ── Buscar primer coach disponible (con profile.role='coach' real) ──────────
  -- JOIN contra profiles.role: hay filas en `coaches` cuyo profile vinculado
  -- tiene role='user' (cuentas de test). La RLS de `profiles` ("Perfiles de
  -- coaches visibles para todos") solo expone perfiles con role='coach', así
  -- que un coach_id apuntando a una de esas deja el join coaches→profiles de
  -- la query de exploración sin resolver bajo RLS (fila entera invisible).
  SELECT c.id, c.profile_id
    INTO v_coach_id, v_coach_profile_id
  FROM public.coaches c
  JOIN public.profiles p ON p.id = c.profile_id
  WHERE p.role = 'coach'
  LIMIT 1;

  IF v_coach_id IS NULL THEN
    RAISE NOTICE '[SEED] No hay coaches con profile.role=coach — seed omitido.';
    RETURN;
  END IF;

  RAISE NOTICE '[SEED] Usando coach_id=%', v_coach_id;

  -- ── Audio ────────────────────────────────────────────────────────────────
  INSERT INTO public.coach_resources
    (coach_id, title, description, format, source, topic_id, duration_seconds,
     status, is_author_declared, storage_path)
  VALUES
    (v_coach_id,
     '[SEED] Respiración para dormir mejor',
     'Práctica guiada de 8 minutos para calmar el sistema nervioso antes de dormir.',
     'audio', 'native', 'descanso', 480,
     'published', true,
     'seed/respiracion-dormir.mp3')
  RETURNING id INTO r_audio1;

  INSERT INTO public.coach_resources
    (coach_id, title, description, format, source, topic_id, duration_seconds,
     status, is_author_declared, storage_path)
  VALUES
    (v_coach_id,
     '[SEED] Práctica para momentos de ansiedad',
     'Escaneo corporal corto para bajar la activación cuando la ansiedad aparece.',
     'audio', 'native', 'ansiedad', 600,
     'published', true,
     'seed/ansiedad-scan.mp3')
  RETURNING id INTO r_audio2;

  -- ── Podcast ──────────────────────────────────────────────────────────────
  INSERT INTO public.coach_resources
    (coach_id, title, description, format, source, topic_id, duration_seconds,
     status, is_author_declared, url)
  VALUES
    (v_coach_id,
     '[SEED] Cómo construir hábitos que duran',
     'Los 3 pilares del cambio de hábitos según la neurociencia del comportamiento.',
     'podcast', 'external', 'foco', 1920,
     'published', true,
     'https://open.spotify.com/episode/seed-habitos-placeholder')
  RETURNING id INTO r_podcast1;

  INSERT INTO public.coach_resources
    (coach_id, title, description, format, source, topic_id, duration_seconds,
     status, is_author_declared, url)
  VALUES
    (v_coach_id,
     '[SEED] La ciencia del sueño profundo',
     'Qué pasa en tu cerebro mientras dormís y cómo mejorar la calidad del descanso.',
     'podcast', 'external', 'descanso', 2700,
     'published', true,
     'https://open.spotify.com/episode/seed-sueno-placeholder')
  RETURNING id INTO r_podcast2;

  -- ── Video ────────────────────────────────────────────────────────────────
  INSERT INTO public.coach_resources
    (coach_id, title, description, format, source, topic_id, duration_seconds,
     status, is_author_declared, url)
  VALUES
    (v_coach_id,
     '[SEED] Técnica de reencuadre para emociones difíciles',
     'Video de 12 minutos con la técnica de reencuadre cognitivo aplicada al enojo y la tristeza.',
     'video', 'external', 'animo', 720,
     'published', true,
     'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  RETURNING id INTO r_video1;

  INSERT INTO public.coach_resources
    (coach_id, title, description, format, source, topic_id, duration_seconds,
     status, is_author_declared, url)
  VALUES
    (v_coach_id,
     '[SEED] Movimiento consciente para liberar tensión',
     'Secuencia de 10 minutos para soltar la tensión acumulada en el cuerpo durante el día.',
     'video', 'external', 'ansiedad', 600,
     'published', true,
     'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  RETURNING id INTO r_video2;

  -- ── Lectura ──────────────────────────────────────────────────────────────
  INSERT INTO public.coach_resources
    (coach_id, title, description, format, source, topic_id,
     status, is_author_declared, body_md)
  VALUES
    (v_coach_id,
     '[SEED] Cómo hablar con tu crítico interno',
     'Una guía práctica para identificar la voz autocrítica y transformar su impacto.',
     'lectura', 'native', 'identidad',
     'published', true,
     E'## La voz que te habla todo el día\n\nTodos tenemos un crítico interno. Esa voz que dice "no podés", "lo arruinaste de nuevo", "nunca vas a cambiar".\n\nLa buena noticia: esa voz no sos vos.\n\n## Paso 1: Identificarla\n\nLa próxima vez que notes autocrítica, pausá y preguntate: *¿a quién le pertenece esta voz?* Muchas veces viene de alguien de tu infancia.\n\n## Paso 2: Ponerle nombre\n\nDarle un nombre al crítico lo externaliza. "Ahí va Marta de nuevo." Esto crea distancia.\n\n## Paso 3: Responderle con curiosidad\n\nEn lugar de pelear con la voz, preguntale: *¿de qué me estás tratando de proteger?* Casi siempre hay un miedo legítimo detrás.\n\n## Para seguir\n\nEscribí en tu diario esta noche: ¿qué te dijo tu crítico hoy? ¿Qué tenía miedo de que pasara?')
  RETURNING id INTO r_lectura1;

  INSERT INTO public.coach_resources
    (coach_id, title, description, format, source, topic_id,
     status, is_author_declared, body_md)
  VALUES
    (v_coach_id,
     '[SEED] El mapa de tus relaciones',
     'Ejercicio para visualizar y entender la red de vínculos en tu vida.',
     'lectura', 'native', 'relaciones',
     'published', true,
     E'## Tu red de vínculos\n\nDibujá un círculo en el centro con tu nombre. Alrededor, tres anillos concéntricos.\n\n**Anillo 1** (los más cercanos): las 1-5 personas con quienes hablarías si algo muy difícil pasara.\n\n**Anillo 2** (vínculos importantes): personas con quienes te reunís regularmente y que te importan.\n\n**Anillo 3** (conocidos significativos): personas que enriquecen tu vida aunque no los veas seguido.\n\n## Qué observar\n\n- ¿Qué anillo está más vacío de lo que te gustaría?\n- ¿Hay alguien en un anillo lejano que en realidad debería estar más cerca?\n- ¿Hay vínculos que te drenan y ocupan lugar central?\n\n## Una acción esta semana\n\nElegí una persona del anillo 2 o 3 y contactala sin motivo. Solo para decirle que la tenés en mente.')
  RETURNING id INTO r_lectura2;

  RAISE NOTICE '[SEED] Insertados 8 recursos published para coach_id=%', v_coach_id;

  -- ── Recomendación de prueba ───────────────────────────────────────────────
  -- Solo si existe una sala para este coach (requiere al menos un usuario real)
  SELECT s.id, s.user_id
    INTO v_sala_id, v_user_id
  FROM public.salas s
  WHERE s.coach_id = v_coach_profile_id   -- salas.coach_id → profiles.id
  LIMIT 1;

  IF v_sala_id IS NULL THEN
    RAISE NOTICE '[SEED] No hay salas para este coach — recomendación de prueba omitida.';
    RETURN;
  END IF;

  INSERT INTO public.resource_recommendations
    (resource_id, coach_id, user_id, room_id, note)
  VALUES
    (r_audio1, v_coach_id, v_user_id, v_sala_id,
     '[SEED] Escuchalo esta noche antes de dormir. 8 minutos y notás la diferencia.')
  RETURNING id INTO v_resource_id;

  RAISE NOTICE '[SEED] Recomendación de prueba insertada: recommendation_id=%', v_resource_id;

END $$;


-- ────────────────────────────────────────────────────────────
-- VERIFICACIÓN (correr después de aplicar)
-- ────────────────────────────────────────────────────────────
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--   AND table_name IN ('coach_resources','resource_recommendations','resource_saves','resource_events')
--   ORDER BY table_name;
--
-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'messages'
--   AND column_name = 'metadata';
--
-- SELECT id, file_size_limit FROM storage.buckets WHERE id = 'resource-audio';
--
-- SELECT title, format, topic_id, status FROM public.coach_resources
--   WHERE title LIKE '[SEED]%' ORDER BY format, created_at;
