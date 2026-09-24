# Qué le preguntamos a un profesional para postularse

Análisis del 24/09/2026, a pedido de Andre: ¿estamos haciendo las preguntas correctas, sobre todo en metodología? Basado en `docs/competencia-selia.md` y en cómo trabaja un profesional antes de atender. Es una propuesta para validar con los 2 o 3 profesionales de la beta, no una conclusión de datos.

## Qué se preguntaba al 24/09

Especialidad (texto libre) · presentación breve · temas que trabaja · cómo acompaña (escucha / herramientas / las dos) · cuánto guía (propone el camino / sigue el de la persona / depende) · sobre qué trabaja (historia / presente / rumbo) · fecha de nacimiento · sexo · nacionalidad · precio · video. Aparte, después: credenciales y, solo con matrícula de psicología verificada, la escuela (cognitivo conductual, psicoanalítico, sistémico, gestáltico, humanístico, integrativo).

## Donde Vita ya está mejor que Selia

- **Cómo trabaja cada profesional.** Selia muestra "Mi estilo de terapia" en texto libre y un rótulo de escuela. Vita pregunta tres ejes concretos que el cliente también contesta, y el match explica en qué coinciden.
- **Credenciales.** Selia dice que no puede garantizar que sean auténticas; Vita revisa la matrícula a mano y la profesión sale de la matrícula verificada.

## Los huecos, por importancia

1. **Metodología de quien no es psicólogo.** Solo los psicólogos declaraban escuela. Un coach no tenía dónde decir si hace ontológico, PNL, sistémico o ejecutivo; una nutricionista, si trabaja con enfoque no dieta, intuitiva o deportiva. Para la mayoría del catálogo, el perfil no decía cómo trabajan. Propuesta: lista de metodologías por profesión, hasta 3, cada una con una frase, igual que las escuelas.
2. **Qué hace ante un caso que no le corresponde.** Selia no lo pregunta. Un coach no puede tratar lo clínico (Ley 23.277) y cualquiera puede encontrarse con alguien en riesgo. Propuesta: a los coaches, compromiso explícito de derivar lo clínico; a todos, una pregunta corta que se revisa a mano: "¿Qué hacés si alguien te cuenta que piensa en hacerse daño?".
3. **Qué es la persona, antes de pedirle credenciales.** La especialidad es texto libre y recién después se sabe qué matrícula pedir. Propuesta: preguntar de entrada psicología / nutrición / coaching / otra.
4. **Desde dónde atiende.** Se preguntaba la nacionalidad, pero lo que importa es dónde vive y ejerce: matrícula (nacional o provincial), cobro, zona horaria, impuestos. Todo el sistema supone Argentina y nunca se preguntaba. Propuesta: país y provincia.

Para después (confianza, no críticos): 5. años de experiencia (Selia los muestra) · 6. "¿Cómo es tu primera sesión con alguien?" (Selia lo tiene; baja la ansiedad de quien nunca fue) · 7. supervisión, solo psicología y opcional.

No preguntar: población (menores, parejas, familias: fuera de alcance por decisión), consultorio presencial (solo online), idiomas (no es prioridad).

## Dónde va cada cosa

La postulación se acababa de rediseñar en tres bloques, y cada pregunta de más es un profesional que abandona. En la postulación va solo lo que se revisa para aprobar: 2, 3 y 4, cortos. La metodología (1), los años (5) y la primera sesión (6) van a "completá tu perfil" después de la aprobación, junto a temas.

## Estado

- 24/09/2026: **3 ya estaba cubierto** (en la postulación la especialidad es una elección entre Psicólogo/a, Coach y Nutricionista; texto libre es solo después, en el perfil). **Hechos 2 y 4**: compromiso de derivar (coaches y nutricionistas), pregunta de riesgo (todos), país y provincia de atención; nacionalidad pasa a opcional. Ver SCHEMA "Postulación: límites y lugar de atención".
- Pendiente: 1 (metodologías por profesión), 5, 6, 7.
- Para la beta: ¿las metodologías de coaching y nutrición de la lista son las que usan? ¿La pregunta de riesgo les resulta razonable o invasiva?

## ⏸️ RETOMAR: metodologías de coaches y nutricionistas

Pausado el 24/09/2026 (Andre reinicia la compu). Para retomar, decir: **"retomemos las metodologías de coaches y nutricionistas"**.

Qué es: el hueco 1 de este documento. Hoy solo los psicólogos declaran escuela (`coaches.enfoques`, `lib/enfoque.ts` → `ENFOQUES`, pantalla `screens/CoachEnfoqueScreen.tsx`, visible solo con `coaches.profesion = 'psicologia'`). Coaches y nutricionistas no tienen dónde decir cómo trabajan.

Plan acordado:
1. Armar dos listas, cada opción con una frase que la explique (mismo formato que `ENFOQUES`):
   - Coaching: por ejemplo ontológico, PNL, sistémico, ejecutivo/organizacional, de vida, con base en mindfulness. A revisar: que sean escuelas reales y reconocibles en Argentina.
   - Nutrición: por ejemplo no dieta / alimentación intuitiva, deportiva, clínica, vegetariana y vegana, conducta alimentaria (ojo: los trastornos de la conducta alimentaria son clínicos, ver si corresponde).
2. Dónde se pregunta: en "completá tu perfil" después de la aprobación (`CoachEnfoqueScreen`), NO en la postulación. Hasta 3, como las escuelas.
3. Base: decidir si se reusa `coaches.enfoques` con valores por profesión o una columna nueva; el trigger `trg_enfoques_requieren_matricula` hoy vacía `enfoques` si no es psicología, así que reusarla exige tocarlo. Recordar: toda columna nueva de `coaches` que lea el catálogo necesita sumarse al grant de SELECT (lista blanca) y, si la escribe el profesional, al de UPDATE.
4. Perfil público (`screens/ProfesionalScreen.tsx`): mostrarlas igual que las escuelas.
5. Match (`lib/quizMatch.ts`): decidir si pesan en la recomendación o solo se muestran.

Antes de construir, conviene validar las dos listas con los 2 o 3 profesionales de la beta.

Después de esto, en orden: años de experiencia (5), "¿cómo es tu primera sesión con alguien?" (6), supervisión para psicólogos (7).
