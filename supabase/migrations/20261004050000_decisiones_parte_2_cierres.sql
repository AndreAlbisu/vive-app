-- Decisiones del 04/10/2026, PARTE 2: cierra las columnas.
--
-- 🔴 Correr DESPUÉS de publicar la web y recargar la app con el código nuevo.
-- La versión anterior lee `coaches.suspendido_hasta` y escribe la aceptación con
-- un UPDATE: si esto se corre antes, el catálogo y /c dejan de cargar.

begin;

-- L15: la fecha de suspensión ya no se lee con la clave pública ni con una cuenta.
revoke select (suspendido_hasta) on public.coaches from anon, authenticated;

-- L17: la constancia de edad y de Términos solo la escribe `registrar_aceptacion`.
revoke update (accepted_terms, accepted_terms_at, accepted_terms_version, age_confirmed)
  on public.profiles from anon, authenticated;

commit;
