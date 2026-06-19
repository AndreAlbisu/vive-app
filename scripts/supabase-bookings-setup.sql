-- ============================================================
-- Vita — Booking Supabase setup
-- Correr en: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Recrear bookings (la tabla existente tiene otro schema)
DROP TABLE IF EXISTS public.bookings CASCADE;

CREATE TABLE public.bookings (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id        uuid        REFERENCES public.coaches(id) ON DELETE SET NULL,
  coach_name      text        NOT NULL,
  coach_specialty text        NOT NULL DEFAULT '',
  scheduled_date  date        NOT NULL,
  scheduled_time  text        NOT NULL,
  amount          integer     NOT NULL DEFAULT 0,
  status          text        NOT NULL DEFAULT 'pendiente'
                                CHECK (status IN ('pendiente','confirmada','completada','cancelada')),
  room_url        text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 2. Trigger: generar room_url automáticamente al insertar
CREATE OR REPLACE FUNCTION public.fn_generate_room_url()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.room_url := 'https://meet.jit.si/vita-' || encode(gen_random_bytes(8), 'hex');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_booking_room_url
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_generate_room_url();

-- 3. RLS en bookings
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings_select_own" ON public.bookings
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "bookings_insert_own" ON public.bookings
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "bookings_update_own" ON public.bookings
  FOR UPDATE USING (user_id = auth.uid());

-- 4. Tabla de eventos de analytics
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES auth.users(id),
  event_name  text        NOT NULL,
  properties  jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado (incluyendo anónimos) puede insertar
CREATE POLICY "analytics_insert_auth" ON public.analytics_events
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 5. Refrescar cache de PostgREST
NOTIFY pgrst, 'reload schema';
