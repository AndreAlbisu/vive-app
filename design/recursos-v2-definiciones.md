# Recursos v2 — Documento de definiciones (FINAL)

**Versión cerrada · 13 jul 2026 · Joaquin + revisión de propuesta**

Este documento es la fuente de verdad de producto para la implementación.

---

## 1. El concepto

Dos fuentes de recursos, con roles distintos:

- **Vita** aporta solo **herramientas prácticas de uso diario** — no contenido informativo, para no asumir la responsabilidad de mantener información actualizada.
- **Los coaches** aportan todo el **contenido** (audios, podcasts, videos, lecturas). Cada recurso cumple doble función: herramienta clínica (el coach lo manda por chat a su paciente: "escuchá este audio esta noche") y exposición (un recurso popular le puede traer clientes).
- **Vita cura**: los coaches proponen, Vita aprueba qué entra.
- Principio rector: **todo lo que el coach necesita que el usuario haga fuera de la sesión, vive dentro de la app.**

---

## 2. Herramientas de Vita ✅ CERRADO

Solo estas cuatro, como funcionalidades nativas de la app (no filas en la base de recursos):

1. **Respiración** (ejercicios guiados, incluye 4-7-8)
2. **Ruidos** (blanco, lluvia, etc.)
3. **Diario** (escritura libre)
4. **Diario de gratitud**

**Decisión cerrada:** "Sueño" NO entra como herramienta de Vita — dormir es territorio de contenido de coaches (más flywheel para ellos). Las herramientas que hoy existan en la UI fuera de estas cuatro se retiran de la vista, sin borrar su código.

---

## 3. Formatos de recursos de coaches ✅ CERRADO

| Formato | Cómo vive | Se reproduce | Color de cover |
|---|---|---|---|
| **Audio** (práctica guiada, ≤ 15 min: meditación, dormir, ejercicios) | Archivo nativo en Supabase Storage (mp3/m4a, máx. 30 MB) | Dentro de la app | Terracota |
| **Podcast** (episodio para aprender, > 15 min) | Link externo (Spotify / Apple / YouTube) | Abre la fuente, con atribución ("abre en Spotify") | Azul |
| **Video** | Link de YouTube embebido (canal del coach, público o unlisted) | Embebido en la app | Violeta |
| **Lectura** (fusiona "lecturas breves" + "guías de pasos") | Texto nativo (markdown), máx. ~1.000 palabras | Dentro de la app | Verde |

Frontera audio vs podcast: audio **se hace** (práctica corta), podcast **se escucha** (aprendizaje largo).

Video: YouTube embebido en v1 (costo cero, streaming resuelto, visibilidad doble para el coach). El campo en DB es `url` genérico — si algún día se migra a Mux/Cloudflare Stream, cambia el reproductor, no el schema.

---

## 4. Navegación del usuario ✅ CERRADO

- El usuario explora por **necesidad, no por formato**: las mismas **10 puertas de Conexiones** (un solo lenguaje en toda la app; mismo array, sin duplicar). El formato es metadato en la card y filtro secundario.

Estructura de la pantalla Recursos (de arriba a abajo):

1. Header + racha (queda como está)
2. Bloque según mood del día (queda como está — apunta a herramientas de Vita)
3. "Continuar donde dejaste" (queda como está)
4. **"De tus coaches"** — recursos que TUS coaches te recomendaron por chat, con su nota, badge NUEVO y estado visto/pendiente. Si no hay recomendaciones, la sección no aparece.
5. **"Herramientas de Vive"** — las 4 de Vita, fila compacta de tiles.
6. **"Explorar por tema"** — chips de las 10 puertas + filtros secundarios de formato + "Guardados · N" → grilla de recursos de coaches con autor visible.

---

## 5. La card de recurso ✅ CERRADO

- Cover coloreada **por formato** (colores de la tabla de arriba) con ícono + etiqueta del formato
- Título (máx. 80 chars) + meta: duración y "en la app" / "abre en Spotify/YouTube"
- **Autor siempre visible**: avatar chico + "por María González" → tap lleva al perfil del coach (acá nace el flywheel)
- Bookmark para guardar (relleno terracota al activar)
- Chip de puerta ("Descanso")

---

## 6. Flujo "coach recomienda por chat" ✅ CERRADO

1. En la sala, el coach toca "Recomendar recurso" → elige de SUS recursos publicados → agrega nota opcional (máx. 200 chars, ej.: "escuchalo esta noche antes de dormir").
2. Al usuario le llega como **mensaje tipo card** en el chat: cover, título, nota del coach, botón "Abrir".
3. Al abrirlo: se marca como visto (`opened_at`) y el recurso **se guarda automáticamente** en "De tus coaches" / Guardados — no depende de que el usuario lo marque; el objetivo es que no se pierda.
4. El coach ve el estado de su recomendación: "Sin abrir" / "Abierto ✓" — útil para el seguimiento en la próxima sesión.

---

## 7. Reglas de contenido (guidelines del veto) ✅ CERRADO

1. **Autoría**: solo contenido creado por vos. Lo de terceros, únicamente como link a la fuente original.
2. **Sin promesas clínicas**: nada de "cura/elimina". Sí "puede ayudarte a".
3. **Sin venta dentro del recurso**: tu nombre y perfil como autor son tu exposición; el contenido no es un aviso.
4. **Alcance profesional**: dentro de tu área.
5. **Calidad mínima**: audio limpio, video estable, voz clara.
6. **Seguridad**: nada que pueda dañar a una persona vulnerable.

Al subir, checkbox obligatorio: *"Declaro que este contenido es de mi autoría y acepto las reglas de contenido."* (queda registrado en `is_author_declared`).

**Moderación v1**: recurso sube en estado `pending` → Joaquin/André revisan desde el editor de tablas de Supabase (sin panel de admin) → `published` o `rejected` con número de regla como motivo (`rejection_rule`). El coach ve el estado y, si fue rechazado, la regla incumplida. Panel propio recién cuando el volumen lo pida.

---

## 8. Modelo de datos ✅ CERRADO

- **`coach_resources`**: id, coach_id, title, description, format (audio/podcast/video/lectura), source (native/external), url, storage_path, body_md, topic_id (puerta), duration_seconds, status (pending/published/rejected/archived), rejection_rule, is_author_declared, created_at. RLS: published visible para todos; el coach ve y gestiona solo los suyos; nadie borra (se archiva).

  > Nota de implementación: el nombre es `coach_resources` (no `resources`) para no entrar en conflicto con la tabla `resources` existente que contiene contenido de Vita.

- **`resource_recommendations`**: id, resource_id, coach_id, user_id, room_id, note, opened_at, created_at. RLS: solo emisor y receptor.

- **`resource_saves`**: user_id + resource_id uuid (pk compuesta), created_at. RLS: solo el dueño.

  > Nota: separada de `saved_resources` existente (que usa `resource_id` como text para slugs de herramientas).

- **`resource_events`** (métrica flywheel): user_id, resource_id, event (view / play / complete / coach_profile_visit / booking_started), created_at. Lectura solo interna.

- **`messages`**: agregar columna `metadata jsonb null`. Para recomendaciones, `sender_type='coach'` con `metadata={type:'resource', resource_id, recommendation_id}`. Encriptar el content con el mismo cipher existente para el fallback de texto.

- Storage: bucket `resource-audio`, mp3/m4a, máx. 30 MB.

**La métrica que valida todo**: conversión recurso → visita al perfil del coach → reserva. Si existe, el pitch a coaches nuevos se vende solo.

---

## 9. Límites v1 ✅ CERRADO

- Máx. **10 recursos publicados por coach** (evita spam, fuerza curaduría propia; con 10 llenos, la app sugiere archivar)
- Audio: máx. 15 min / 30 MB, mp3 o m4a
- Lectura: máx. ~1.000 palabras
- Nota de recomendación: máx. 200 chars
- Sin límite de recomendaciones por chat (es su herramienta de trabajo)

---

## 10. Decisiones cerradas (antes abiertas)

1. **"Sueño"**: territorio de coaches, no herramienta de Vita.
2. **Visibilidad**: los recursos publicados son visibles para **todos** los usuarios, no solo para pacientes del coach autor — sin visibilidad pública no hay flywheel de exposición.
3. **Tope de 10 recursos publicados por coach**: confirmado como arranque.

---

## 11. Deudas conocidas (anotadas, no bloquean v1)

- Audio persistente para Ruidos (que siga sonando al navegar) si hoy no existe.
- Tope de 10 como trigger en DB (v1 puede validar solo en cliente).
- Panel de moderación propio (v1 = editor de Supabase).
- Migración de video a hosting propio (Mux/Cloudflare Stream) si la feature valida.
