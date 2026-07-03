-- ============================================================
-- Vita — fix: revocar EXECUTE de anon en get_my_resource_feedback_summary()
-- ⚠️  REVISAR CON ANDRE/JOAQUÍN ANTES DE CORRER
-- Requiere: scripts/add-resource-feedback.sql ya corrido
-- Fecha: 2026-07-03
--
-- Hallazgo: `REVOKE ALL ... FROM PUBLIC` en add-resource-feedback.sql no
-- alcanzó — Supabase otorga EXECUTE a `anon` en todo el schema public por
-- default privileges a nivel de base, no a través del pseudo-rol PUBLIC.
-- Verificado: la función no filtraba datos (auth.uid() es NULL para
-- anon, así que `= auth.uid()` nunca da true y devuelve vacío igual),
-- pero el permiso de ejecución en sí quedaba mal. Se corrige explícito.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.get_my_resource_feedback_summary() FROM anon;

NOTIFY pgrst, 'reload schema';
