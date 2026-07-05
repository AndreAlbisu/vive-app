# Protocolo de revisión de propuestas de recursos

> Para Andre y Joaquín. La revisión es **manual, vía Supabase SQL Editor** — decisión de
> producto (sesión 52), no hay pantalla admin ni automatismos. Este doc es el único
> procedimiento: si los dos revisamos igual, el coach recibe la misma experiencia
> sin importar quién revisó.

## Regla de oro

**`descartada` es solo para propuestas fuera de scope** (tema/formato que VITA no publica).
**Nunca por calidad** — todo lo que "no está listo pero podría estarlo" va a `necesita_ajustes`,
siempre con notas concretas y accionables. La revisión es no punitiva: el coach tiene que
salir de cada estado sabiendo qué está bien, qué falta y que puede volver a intentar.

## Modo rápido (recomendado)

Requiere `scripts/add-review-functions.sql` corrido. Cada acción es una línea,
transaccional (o pasa todo o no pasa nada), con el copy y las notificaciones ya adentro:

```sql
SELECT * FROM cola_revision;                                  -- la cola completa

SELECT revisar_aprobar('PROPOSAL_ID');                        -- publica usando los ejes propuestos
SELECT revisar_aprobar('PROPOSAL_ID', ARRAY['mente','alma']); -- o pisando los ejes
SELECT revisar_ajustes('PROPOSAL_ID', 'qué está bien + qué falta + invitación a reenviar');
SELECT revisar_descartar('PROPOSAL_ID', 'motivo — solo fuera de scope, nunca por calidad');
```

`revisar_aprobar` devuelve el `RESOURCE_ID` (útil para linkear tags a mano después).
Las funciones resuelven solas el `attributed_to_coach_id` vía `coaches.profile_id` y
rechazan propuestas que no estén en `enviada`. Los tags propuestos siguen siendo
decisión manual aparte (paso 3 de abajo). Los bloques siguientes son la versión
desplegada de lo mismo — referencia y fallback.

## 1. Ver la cola

```sql
SELECT rp.id, p.name AS coach, rp.type, rp.title, rp.topic, rp.axes, rp.tags,
       rp.description, rp.duration_min, rp.content, rp.updated_at
FROM resource_proposals rp
JOIN coaches c  ON c.id = rp.coach_id
JOIN profiles p ON p.id = c.profile_id
WHERE rp.status = 'enviada'
ORDER BY rp.updated_at;
```

Las reenviadas tras ajustes reaparecen acá (vuelven a `enviada`); `reviewer_notes`
conserva lo que se le pidió antes — revisarlo para ver si lo resolvió.

## 2. Checklist editorial

- [ ] Título y descripción claros, sin promesas ("vas a lograr...") ni urgencia
- [ ] **Autonavegable**: ¿alguien lo puede usar sin que nadie se lo explique?
- [ ] Tono no ansiogénico: sin culpa, sin presión, sin métricas de exigencia
- [ ] Si es audio: la URL del bucket reproduce bien (abrila en el navegador) y el contenido coincide con la descripción
- [ ] Si es guía: los pasos se entienden solos y en orden
- [ ] Si es lectura: la fuente (si la cita) es real
- [ ] No duplica journaling/gratitud (exclusivos de VITA) ni un recurso ya publicado
- [ ] `axes`/`tags`/`topic` propuestos son razonables (son pista, no vinculantes —
      el vínculo real lo definimos nosotros al publicar)

## 3. Acciones

En todos los snippets reemplazar `PROPOSAL_ID`. El trigger de protección no bloquea
nada desde el SQL Editor (sin JWT, `auth.uid()` es NULL).

### 3a. Aprobar y publicar

Correr como un solo bloque. El `UNIQUE` de `resources.proposal_id` impide publicar
dos veces la misma propuesta aunque se corra por error de nuevo.

```sql
BEGIN;

-- 1. Publicar el recurso.
--    ⚠️ attributed_to_coach_id toma c.profile_id (profiles.id), NUNCA c.id (coaches.id).
--    Si se pone coaches.id no hay error de FK ni de ninguna clase: el recurso queda
--    huérfano en silencio y no aparece ni en el perfil del coach ni en la biblioteca.
--    El SELECT de abajo ya lo resuelve bien — no reemplazar por un uuid a mano.
INSERT INTO resources (proposal_id, attributed_to_coach_id, type, title, description, duration_min, content)
SELECT rp.id, c.profile_id, rp.type, rp.title, rp.description, rp.duration_min, rp.content
FROM resource_proposals rp
JOIN coaches c ON c.id = rp.coach_id
WHERE rp.id = 'PROPOSAL_ID'
RETURNING id;  -- anotar este RESOURCE_ID para los pasos 2 y 3

-- 2. Ejes (1 a 3 filas; usar rp.axes como pista, decidimos nosotros)
INSERT INTO resource_axes (resource_id, axis)
VALUES ('RESOURCE_ID', 'mente');  -- 'cuerpo' | 'mente' | 'alma'

-- 3. Tags (opcional). Si el coach propuso un tag nuevo, ya existe en resource_tags
--    con status='propuesto': promoverlo o fusionarlo con uno oficial, después linkear.
-- UPDATE resource_tags SET status = 'oficial' WHERE label = 'LABEL' AND status = 'propuesto';
-- INSERT INTO resource_tag_links (resource_id, tag_id)
--   SELECT 'RESOURCE_ID', id FROM resource_tags WHERE label = 'LABEL';

-- 4. Marcar la propuesta
UPDATE resource_proposals SET status = 'aprobada' WHERE id = 'PROPOSAL_ID';

-- 5. Avisarle al coach
INSERT INTO notifications (recipient_id, type, title, body)
SELECT c.profile_id, 'propuesta_publicada',
       '🌱 Tu recurso ya está publicado',
       'Tu recurso «' || rp.title || '» ya está en VITA. Tus clientes ya pueden usarlo desde tu perfil.'
FROM resource_proposals rp
JOIN coaches c ON c.id = rp.coach_id
WHERE rp.id = 'PROPOSAL_ID';

COMMIT;
```

Publicado = visible al instante en el perfil público del coach ("Recursos de {nombre}")
y en el carrusel "Recursos de nuestros coaches" de la biblioteca.

### 3b. Pedir ajustes

Las notas siguen la estructura: **qué está bien → qué falta (concreto) → invitación a reenviar.**
Nunca "no cumple", "rechazada", ni listas de errores.

```sql
BEGIN;

UPDATE resource_proposals
SET status = 'necesita_ajustes',
    reviewer_notes = '¡Nos gustó mucho la idea! Para publicarla necesitamos que [AJUSTE CONCRETO]. Reenviala cuando la tengas y la priorizamos.'
WHERE id = 'PROPOSAL_ID';

INSERT INTO notifications (recipient_id, type, title, body)
SELECT c.profile_id, 'propuesta_ajustes',
       'Tu propuesta está casi lista',
       'Tu propuesta «' || rp.title || '» está casi lista. Te dejamos un par de sugerencias para terminarla juntos.'
FROM resource_proposals rp
JOIN coaches c ON c.id = rp.coach_id
WHERE rp.id = 'PROPOSAL_ID';

COMMIT;
```

### 3c. Descartar (solo fuera de scope)

**Sin notificación** — a propósito: una push de descarte es lo más punitivo del sistema.
El coach lo ve en "Mis propuestas" con las notas, que siempre explican el porqué e
invitan a proponer otra cosa.

```sql
UPDATE resource_proposals
SET status = 'descartada',
    reviewer_notes = 'Gracias por proponerlo. Este [tema/formato] hoy queda fuera de lo que publicamos en Recursos porque [MOTIVO]. Ojalá nos acerques otra idea — las leemos todas.'
WHERE id = 'PROPOSAL_ID';
```

## 4. Retirar un recurso publicado

**UPDATE, nunca DELETE** — el DELETE arrastra por CASCADE los votos de `resource_feedback`.
Decisión editorial, sin notificación automática; si corresponde avisarle al coach, es por
el canal humano.

```sql
UPDATE resources SET retired_at = now() WHERE id = 'RESOURCE_ID';
```

Desaparece de todas las listas (las queries filtran `retired_at IS NULL`) pero conserva
su historia. Para republicar: `SET retired_at = NULL`.
