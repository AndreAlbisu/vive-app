-- Filas que apuntan a herramientas retiradas de la vista (sesión 236).
--
-- Contexto: `constants/tools.ts` marca como `visible: false` a sueno, meditacion,
-- escaner, relajacion, lecturas y anclaje. El picker de hábitos las ofrecía igual
-- (leía el catálogo crudo), así que puede haber filas de `user_habits` y de
-- `resource_reminders` apuntando a una herramienta que ya no se puede abrir: su
-- ruta ahora redirige a /recursos. Un recordatorio así dispara un push que no
-- lleva a ningún lado.
--
-- ✅ **CORRIDO EL 15/09/2026 (paso 1): 0 filas.** No había nada que limpiar — el
-- leak existía pero nadie lo ejerció, porque no hay usuarios todavía. El paso 2
-- NO se corrió y no hace falta. El script queda para el día que se retire otra
-- herramienta, o si alguna de las 6 vuelve a ofrecerse por error: es la consulta
-- que dice si quedó suciedad.
--
-- ⚠️ CORRER EL PASO 1 PRIMERO. Si devuelve 0 filas, no hay nada que hacer y el
-- paso 2 no se corre. Si devuelve filas, mirá de quién son antes de borrar:
-- con 0 usuarios reales deberían ser solo cuentas de prueba.
--
-- No hay ningún cambio de esquema acá. Es limpieza de datos, y es la única parte
-- del arreglo que no está en el código.

-- ── 1. Ver qué hay (solo lectura) ────────────────────────────────────────────
WITH retiradas(tool_id) AS (
  VALUES ('sueno'), ('meditacion'), ('escaner'), ('relajacion'), ('lecturas'), ('anclaje')
)
SELECT 'user_habits' AS tabla, h.user_id, h.tool_id AS ref, h.created_at
FROM user_habits h JOIN retiradas r ON r.tool_id = h.tool_id
UNION ALL
SELECT 'resource_reminders', rr.user_id, rr.ref, rr.created_at
FROM resource_reminders rr
JOIN retiradas r ON r.tool_id = rr.ref
WHERE rr.kind = 'tool'
ORDER BY created_at;

-- ── 2. Borrar (solo si el paso 1 devolvió filas y las revisaste) ──────────────
-- Descomentar para correr.
--
-- BEGIN;
--
-- WITH retiradas(tool_id) AS (
--   VALUES ('sueno'), ('meditacion'), ('escaner'), ('relajacion'), ('lecturas'), ('anclaje')
-- )
-- DELETE FROM user_habits h
-- USING retiradas r
-- WHERE r.tool_id = h.tool_id;
--
-- WITH retiradas(tool_id) AS (
--   VALUES ('sueno'), ('meditacion'), ('escaner'), ('relajacion'), ('lecturas'), ('anclaje')
-- )
-- DELETE FROM resource_reminders rr
-- USING retiradas r
-- WHERE r.tool_id = rr.ref AND rr.kind = 'tool';
--
-- COMMIT;

-- 📌 `resource_completions`, `saved_resources` y `pinned_resources` NO se tocan.
-- Son historia (lo que la persona hizo) y curaduría (lo que eligió guardar), no
-- promesas a futuro: un completion de Meditación del mes pasado sigue siendo
-- cierto, y un guardado sigue resolviendo su label vía VITA_TOOL_MAP. Solo
-- hábitos y recordatorios generan acción futura, y son los únicos que mienten.
