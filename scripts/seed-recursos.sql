DO $$
DECLARE
  v_coach_id         uuid;
  v_coach_profile_id uuid;
  v_sala_id          uuid;
  v_user_id          uuid;
  v_resource_id      uuid;
  r_audio1   uuid;
  r_audio2   uuid;
  r_podcast1 uuid;
  r_podcast2 uuid;
  r_video1   uuid;
  r_video2   uuid;
  r_lectura1 uuid;
  r_lectura2 uuid;
BEGIN
  SELECT c.id, c.profile_id INTO v_coach_id, v_coach_profile_id
  FROM public.coaches c LIMIT 1;

  IF v_coach_id IS NULL THEN
    RAISE NOTICE '[SEED] No hay coaches — seed omitido.';
    RETURN;
  END IF;

  RAISE NOTICE '[SEED] Usando coach_id=%', v_coach_id;

  INSERT INTO public.coach_resources
    (coach_id, title, description, format, source, topic_id, duration_seconds, status, is_author_declared, storage_path)
  VALUES (v_coach_id, '[SEED] Respiración para dormir mejor', 'Práctica guiada de 8 minutos para calmar el sistema nervioso antes de dormir.', 'audio', 'native', 'descanso', 480, 'published', true, 'seed/respiracion-dormir.mp3')
  RETURNING id INTO r_audio1;

  INSERT INTO public.coach_resources
    (coach_id, title, description, format, source, topic_id, duration_seconds, status, is_author_declared, storage_path)
  VALUES (v_coach_id, '[SEED] Práctica para momentos de ansiedad', 'Escaneo corporal corto para bajar la activación cuando la ansiedad aparece.', 'audio', 'native', 'ansiedad', 600, 'published', true, 'seed/ansiedad-scan.mp3')
  RETURNING id INTO r_audio2;

  INSERT INTO public.coach_resources
    (coach_id, title, description, format, source, topic_id, duration_seconds, status, is_author_declared, url)
  VALUES (v_coach_id, '[SEED] Cómo construir hábitos que duran', 'Los 3 pilares del cambio de hábitos según la neurociencia del comportamiento.', 'podcast', 'external', 'foco', 1920, 'published', true, 'https://open.spotify.com/episode/seed-habitos-placeholder')
  RETURNING id INTO r_podcast1;

  INSERT INTO public.coach_resources
    (coach_id, title, description, format, source, topic_id, duration_seconds, status, is_author_declared, url)
  VALUES (v_coach_id, '[SEED] La ciencia del sueño profundo', 'Qué pasa en tu cerebro mientras dormís y cómo mejorar la calidad del descanso.', 'podcast', 'external', 'descanso', 2700, 'published', true, 'https://open.spotify.com/episode/seed-sueno-placeholder')
  RETURNING id INTO r_podcast2;

  INSERT INTO public.coach_resources
    (coach_id, title, description, format, source, topic_id, duration_seconds, status, is_author_declared, url)
  VALUES (v_coach_id, '[SEED] Técnica de reencuadre para emociones difíciles', 'Video de 12 minutos con la técnica de reencuadre cognitivo aplicada al enojo y la tristeza.', 'video', 'external', 'animo', 720, 'published', true, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  RETURNING id INTO r_video1;

  INSERT INTO public.coach_resources
    (coach_id, title, description, format, source, topic_id, duration_seconds, status, is_author_declared, url)
  VALUES (v_coach_id, '[SEED] Movimiento consciente para liberar tensión', 'Secuencia de 10 minutos para soltar la tensión acumulada en el cuerpo durante el día.', 'video', 'external', 'ansiedad', 600, 'published', true, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  RETURNING id INTO r_video2;

  INSERT INTO public.coach_resources
    (coach_id, title, description, format, source, topic_id, status, is_author_declared, body_md)
  VALUES (v_coach_id, '[SEED] Cómo hablar con tu crítico interno', 'Una guía práctica para identificar la voz autocrítica y transformar su impacto.', 'lectura', 'native', 'identidad', 'published', true,
    E'## La voz que te habla todo el día\n\nTodos tenemos un crítico interno.\n\n## Paso 1: Identificarla\n\nPreguntate: *¿a quién le pertenece esta voz?*\n\n## Paso 2: Ponerle nombre\n\nDarle un nombre al crítico lo externaliza.\n\n## Paso 3: Responderle con curiosidad\n\nPreguntale: *¿de qué me estás tratando de proteger?*')
  RETURNING id INTO r_lectura1;

  INSERT INTO public.coach_resources
    (coach_id, title, description, format, source, topic_id, status, is_author_declared, body_md)
  VALUES (v_coach_id, '[SEED] El mapa de tus relaciones', 'Ejercicio para visualizar y entender la red de vínculos en tu vida.', 'lectura', 'native', 'relaciones', 'published', true,
    E'## Tu red de vínculos\n\nDibujá un círculo con tu nombre. Tres anillos alrededor.\n\n**Anillo 1**: las 1-5 personas con quienes hablarías si algo difícil pasara.\n\n**Anillo 2**: personas que te importan y ves regularmente.\n\n**Anillo 3**: conocidos significativos.\n\n## Una acción esta semana\n\nContactá a alguien del anillo 2 o 3 sin motivo.')
  RETURNING id INTO r_lectura2;

  RAISE NOTICE '[SEED] Insertados 8 recursos para coach_id=%', v_coach_id;

  SELECT s.id, s.user_id INTO v_sala_id, v_user_id
  FROM public.salas s WHERE s.coach_id = v_coach_profile_id LIMIT 1;

  IF v_sala_id IS NULL THEN
    RAISE NOTICE '[SEED] Sin salas — recomendación omitida.';
    RETURN;
  END IF;

  INSERT INTO public.resource_recommendations (resource_id, coach_id, user_id, room_id, note)
  VALUES (r_audio1, v_coach_id, v_user_id, v_sala_id, '[SEED] Escuchalo esta noche antes de dormir. 8 minutos y notás la diferencia.')
  RETURNING id INTO v_resource_id;

  RAISE NOTICE '[SEED] Recomendación insertada: %', v_resource_id;

END $$;
