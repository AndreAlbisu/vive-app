-- ============================================================
-- Vita — guardar el EJE que la persona declaró en el onboarding
-- Correr en: Supabase Dashboard → SQL Editor
-- ✅ CORRIDO y VERIFICADO por Andre el 31/08/2026
-- Fecha: 2026-08-31
--
-- QUÉ RESUELVE
-- La app tiene DOS agrupamientos distintos de los mismos temas y no coinciden:
--   · el onboarding agrupa por universo: cuerpo / mente / alma;
--   · `user_quiz_answers.topic` usa cinco valores que
--     `hooks/useRecommendedResource.ts` vuelve a traducir a un eje.
--
-- En tres de las nueve categorías del onboarding los dos se contradicen:
--   · "Sexualidad e intimidad" → el onboarding la pone en CUERPO, y el topic
--     que mejor la describe (`relaciones`) cae en alma.
--   · "Mis vínculos"           → onboarding MENTE, `relaciones` cae en alma.
--   · "Trabajo y carrera"      → onboarding ALMA,  `trabajo` cae en mente.
--
-- Hasta hoy había que elegir cuál de los dos datos sacrificar: o el mapa
-- respeta el universo y la etiqueta que lee la persona miente ("algo para tu
-- salud" cuando habló de sexualidad), o respeta el significado y el recurso
-- sugerido sale de un eje que la persona no eligió.
--
-- Con esta columna no hace falta sacrificar ninguno: el EJE decide qué
-- recomendar y el TOPIC decide qué decir.
--
-- 📝 De paso le da casa al universo, que hasta ahora quedaba solo en
-- AsyncStorage porque no había dónde guardarlo.
--
-- QUÉ HACE
--   1. Agrega `user_quiz_answers.axis` (text, nullable).
--   2. Le pone un CHECK con los tres valores, que son los mismos que ya usan
--      `resource_axes` y `resource_proposals.axes`.
--
-- Nullable a propósito: quien hizo el quiz de la app (`QuizScreen`) NO declara
-- universo — contesta tema, tipo de profesional y presupuesto. Para esas filas
-- la columna queda en null y el eje se sigue deduciendo del topic, como hoy.
--
-- Idempotente: se puede correr dos veces sin romper nada.
-- ============================================================

-- 1. La columna
ALTER TABLE public.user_quiz_answers
  ADD COLUMN IF NOT EXISTS axis text;

-- 2. El CHECK, solo si no está
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.user_quiz_answers'::regclass
       AND conname  = 'user_quiz_answers_axis_check'
  ) THEN
    ALTER TABLE public.user_quiz_answers
      ADD CONSTRAINT user_quiz_answers_axis_check
      CHECK (axis IS NULL OR axis IN ('cuerpo', 'mente', 'alma'));
    RAISE NOTICE 'CHECK agregado';
  ELSE
    RAISE NOTICE 'el CHECK ya estaba';
  END IF;
END $$;

-- 3. Refrescar caché de PostgREST (si no, la columna nueva no existe para la app)
NOTIFY pgrst, 'reload schema';


-- ── Verificación ─────────────────────────────────────────────────────────────
-- Esperado: una fila, `tipo = text`, `acepta_null = YES`, `tiene_check = true`.
--
-- select c.column_name,
--        c.data_type                                    as tipo,
--        c.is_nullable                                  as acepta_null,
--        exists (
--          select 1 from pg_constraint
--           where conrelid = 'public.user_quiz_answers'::regclass
--             and conname  = 'user_quiz_answers_axis_check'
--        )                                              as tiene_check
--   from information_schema.columns c
--  where c.table_schema = 'public'
--    and c.table_name   = 'user_quiz_answers'
--    and c.column_name  = 'axis';
--
-- Que el CHECK realmente muerda (tiene que FALLAR con 23514):
-- insert into public.user_quiz_answers (user_id, axis)
-- values ('00000000-0000-0000-0000-000000000000', 'espiritu');
