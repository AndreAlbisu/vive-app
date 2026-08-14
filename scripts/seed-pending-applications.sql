-- seed-pending-applications.sql
--
-- 3 postulaciones de coach SIN APROBAR, para poder ver funcionar el panel de
-- administración de punta a punta: listarlas, aprobar una, y confirmar que
-- efectivamente aparece en Conexiones.
--
-- ⚠️ ESCRIBE EN PRODUCCIÓN. No hay staging.
--    Mientras estén sin aprobar son invisibles para cualquier usuario
--    (`coachesCache` filtra `verified = true`), así que no ensucian el catálogo.
--    **Una vez que apruebes una desde el panel, esa SÍ pasa a ser visible y
--    reservable por cualquiera.** Correr `unseed-pending-applications.sql`
--    cuando termines de probar.
--
-- Marca de borrado: email `@prueba.panel.local`. Es un dominio DISTINTO del
-- `@seed.vive.local` de `seed-fake-coaches.sql` a propósito — así los dos
-- unseed no se pisan y podés limpiar estas 3 sin tocar el seed del deck.
--
-- No toca `auth.users`: `profiles.id` ya no tiene FK contra auth (dropeada el
-- 06/08/2026). Estas cuentas no pueden loguearse, que es justo lo que queremos.
--
-- Las 3 tienen forma distinta a propósito, para ejercitar la pantalla:
--   1. Completa   — bio larga, video, precio y temas. El caso feliz.
--   2. Mínima     — sin bio y sin video. Prueba que la card no se rompa cuando
--                   faltan los campos opcionales (el link de video es condicional).
--   3. Rara       — bio de una línea, precio muy alto, sin temas. Al aprobarla
--                   NO va a aparecer en ninguna puerta de Conexiones: sin temas
--                   no entra a ninguna. Sirve para ver que aprobar y ser visible
--                   son dos cosas distintas.
--
-- Correr en el SQL editor de Supabase (rol postgres ⇒ sin RLS).

begin;

do $$
begin
  if exists (select 1 from public.profiles where email like '%@prueba.panel.local') then
    raise exception 'Ya hay postulaciones de prueba. Corré unseed-pending-applications.sql primero.';
  end if;
end $$;

with nuevos as (
  insert into public.profiles (id, email, name, role, accepted_terms)
  values
    (gen_random_uuid(), 'lucia@prueba.panel.local',  'Lucía Ferreyra [PRUEBA]',  'coach', true),
    (gen_random_uuid(), 'martin@prueba.panel.local', 'Martín Ocampo [PRUEBA]',   'coach', true),
    (gen_random_uuid(), 'sofia@prueba.panel.local',  'Sofía Rinaldi [PRUEBA]',   'coach', true)
  returning id, email
),
-- `created_at` escalonado hacia atrás: el panel ordena las postulaciones de más
-- vieja a más nueva (es una cola con reloj), así que sin esto las tres entran
-- con el mismo timestamp y no se puede ver que el orden funcione.
insertados as (
  insert into public.coaches (
    profile_id, specialty, bio, price_per_session, nationality,
    application_video_url, verified, availability_status, created_at
  )
  select
    n.id,
    case n.email
      when 'lucia@prueba.panel.local'  then 'Psicóloga'
      when 'martin@prueba.panel.local' then 'Coach'
      else 'Nutricionista'
    end,
    case n.email
      when 'lucia@prueba.panel.local'  then 'Trabajo hace ocho años con ansiedad y crisis de pánico desde un enfoque cognitivo-conductual. Me interesa especialmente acompañar a personas que están atravesando cambios grandes —mudanzas, duelos, cambios de trabajo— y que sienten que perdieron el piso. Sesiones de 50 minutos, con seguimiento entre encuentros si hace falta.'
      when 'martin@prueba.panel.local' then null
      else 'Nutrición sin dietas restrictivas.'
    end,
    case n.email
      when 'lucia@prueba.panel.local'  then 18000
      when 'martin@prueba.panel.local' then 9500
      else 47000
    end,
    'Argentina',
    case n.email
      when 'lucia@prueba.panel.local'  then 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      when 'martin@prueba.panel.local' then null
      else 'https://drive.google.com/file/d/PRUEBA/view'
    end,
    false,                 -- ← lo que las hace aparecer en el panel
    'activo',
    now() - case n.email
      when 'lucia@prueba.panel.local'  then interval '6 days'
      when 'martin@prueba.panel.local' then interval '2 days'
      else interval '3 hours'
    end
  from nuevos n
  returning id, profile_id
)
-- Temas: solo para las dos primeras. La tercera queda sin temas a propósito
-- (ver la nota de arriba).
insert into public.coach_topics (coach_id, topic)
select i.id, t.topic
from insertados i
join public.profiles p on p.id = i.profile_id
cross join lateral (
  select unnest(
    case p.email
      when 'lucia@prueba.panel.local'  then array['Ansiedad', 'Ansiedad social', 'Duelo']
      when 'martin@prueba.panel.local' then array['Procrastinación', 'Hábitos']
      else array[]::text[]
    end
  ) as topic
) t;

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación (correr aparte):
--
--   select p.name, c.specialty, c.price_per_session, c.verified,
--          c.application_video_url is not null as tiene_video,
--          (select count(*) from public.coach_topics ct where ct.coach_id = c.id) as temas,
--          c.created_at
--   from public.coaches c
--   join public.profiles p on p.id = c.profile_id
--   where p.email like '%@prueba.panel.local'
--   order by c.created_at;
--   -- esperado: 3 filas, todas verified = false, con 3 / 2 / 0 temas.
--
-- Después de probar: correr scripts/unseed-pending-applications.sql
