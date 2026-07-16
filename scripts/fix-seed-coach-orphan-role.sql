-- fix-seed-coach-orphan-role.sql
-- YA CORRIDO EN PRODUCCIÓN el 16/07/2026 vía `supabase db query --linked`.
-- Este archivo queda como registro/auditoría — no hace falta volver a correrlo
-- a menos que el seed se haya insertado de nuevo apuntando al coach roto.
--
-- Contexto: scripts/seed-recursos.sql eligió el coach con `LIMIT 1` sin
-- filtrar por profiles.role, y le tocó un coach ("andre") cuyo profile tiene
-- role='user'. La RLS de `profiles` ("Perfiles de coaches visibles para
-- todos") solo expone perfiles con role='coach', así que el join
-- coaches→profiles de la query de "Explorar por tema" no resolvía nada bajo
-- RLS para ningún otro usuario — los 8 recursos sembrados existían en la
-- tabla pero eran invisibles en la app. Ver hallazgo documentado en
-- SCHEMA.md (sección `coach_resources` y `coaches`).
--
-- Fix: reasignar los recursos [SEED] a un coach real (profiles.role='coach').
-- scripts/seed-recursos.sql y recursos-v2-migration.sql ya se corrigieron
-- para que el seed elija bien el coach en el futuro (JOIN + WHERE role='coach').

UPDATE public.coach_resources
SET coach_id = (
  SELECT c.id
  FROM public.coaches c
  JOIN public.profiles p ON p.id = c.profile_id
  WHERE p.role = 'coach'
  ORDER BY c.created_at
  LIMIT 1
)
WHERE title LIKE '[SEED]%';

-- Verificación:
-- SELECT cr.title, p.name, p.role
-- FROM public.coach_resources cr
-- JOIN public.coaches c ON c.id = cr.coach_id
-- JOIN public.profiles p ON p.id = c.profile_id
-- WHERE cr.title LIKE '[SEED]%';
