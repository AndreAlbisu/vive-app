# Decisiones estrategicas

## ❌ La Academia no entra en VIVE (al menos no en esta etapa)

**Fecha:** Junio 2026

**Decisión:** La Academia queda descartada como feature del producto, tanto en el MVP como en el corto plazo.

**Razonamiento:**

El modelo de Academia — módulos, niveles, XP, misiones, perfil con progreso — es técnicamente complejo y conceptualmente no diferenciador. Apps como Duolingo, Headspace, Calm y Blinkist ya hacen eso con años y millones de dólares de ventaja.

La identidad de VIVE no está ahí. Está en la curaduría, la calidez y la conexión humana a través de Conexiones. Agregar una Academia convierte a VIVE en "otra app de desarrollo personal con un poco de todo", diluye el foco y genera comparaciones donde ya se pierde por volumen de contenido.

**Lo que se rescata:**

La *intención* detrás de la Academia — orientar al usuario y ayudarlo a profundizar — se puede cumplir de forma más liviana con Recursos y de forma más inteligente con SOFIA. No se necesitan módulos ni gamificación para eso.

**Regla para el futuro:**

Si la Academia vuelve a aparecer como idea, la pregunta es: ¿esto no lo puede hacer ya Recursos + SOFIA? Si la respuesta es sí, no se construye.

## 🛠️ Definición de qué es un recurso en VIVE

**Fecha:** Junio 2026

**Decisión:** Los recursos de VIVE son herramientas prácticas que el usuario activa y usa en el momento — no información para leer ni contenido para consumir.

**Regla central:**

Las herramientas prácticas son el centro. La información existe solo para darle sentido a la herramienta, nunca sola. Si un contenido no tiene una acción asociada, no es un recurso de VIVE.

**Lo que sí es un recurso:**

- Meditación guiada — audio que el usuario sigue
- Journaling — espacio para escribir con un prompt que lo guía
- Ejercicio de respiración — técnica guiada paso a paso
- Ejercicio práctico — una acción concreta con instrucciones simples
- Audio contemplativo — para escuchar, experiencia guiada
- Visualización guiada — audio o texto que lleva al usuario a un estado

**Lo que NO es un recurso:**

- Artículos informativos
- Guías de "cómo hacer X"
- Tips o datos (ej. cuánta agua tomar)
- Teoría o resúmenes de conceptos

**El rol de la información:**

VIVE no compite con Google o ChatGPT en información. El valor de VIVE es saber qué es relevante para el usuario en su momento actual y presentarlo de forma que lo mueva a la acción. La información puede existir como contexto breve dentro de una herramienta — por ejemplo, tres líneas antes de una meditación que explican por qué la respiración regula el sistema nervioso — pero nunca como destino en sí mismo.

## 🧪 Complejidad y tipos de recursos — decisión MVP

**Fecha:** Junio 2026

**Decisión:** El MVP de Recursos es un experimento, no una versión definitiva. El objetivo es testear qué tipo de recurso valora más el usuario antes de invertir en una dirección.

**Las tres hipótesis a validar:**

- **Lecturas breves** — texto curado, corto (2-3 minutos), que da contexto o perspectiva. Sin acción obligatoria, pero sin ser un artículo largo. Más cerca de una reflexión que de un ensayo. Es la hipótesis más incierta de las tres y la que más necesita validación — si los datos dicen que nadie lo usa, se saca; si funcionan, se desarrollan.
- **Herramientas interactivas** — recursos que el usuario usa activamente (check-in, tracker, respiración personalizable)
- **Guías guiadas** — audio o experiencia paso a paso que el usuario sigue

**En el MVP se incluyen los tres, en su versión más mínima.** No se apuesta por ninguno en particular. Los datos de uso deciden hacia dónde va la V2.

**Nota sobre la filosofía:** el principio central de Recursos es que si un contenido no tiene una acción asociada, no es un recurso. Las lecturas breves son la excepción controlada a ese principio — se incluyen en el MVP específicamente para validar si el formato lectura tiene valor para los usuarios de VIVE. No son el norte del producto.

## 🔄 Recursos — biblioteca propia de VIVE + contribuciones de coaches

**Fecha:** Junio 2026

**Decisión:** VIVE tiene su propia biblioteca de recursos — producidos o curados por el equipo. Esa es la base. Los coaches pueden contribuir con recursos adicionales, que VIVE revisa y aprueba antes de publicar.

**Dos tipos de recursos:**

- **Recursos de VIVE** — producidos o curados por el equipo, la base de la biblioteca
- **Recursos propuestos por coaches** — contribuciones de la comunidad de profesionales, revisadas y aprobadas por VIVE

**Por qué es un valor agregado:**

- Le da legitimidad al contenido — tiene autor y credencial real
- Le da a los coaches un incentivo adicional para estar en VIVE más allá de conseguir clientes
- Crea un canal de descubrimiento natural: usuario usa recurso → le gusta → ve el perfil del coach → agenda sesión

**Para el MVP:** los recursos iniciales los cura VIVE manualmente. El sistema de propuesta por coaches es V2.

---

## 🏗️ Separación de cuentas: usuario y coach conviven en la misma app

**Fecha:** Junio 2026

**Decisión:** Una cuenta de coach y una cuenta de usuario son entidades separadas. Si un coach quiere usar VIVE como usuario (reservar sesiones, usar recursos), necesita crear una cuenta distinta.

**Razonamiento:** Un perfil híbrido (usuario + coach en la misma cuenta) complejiza significativamente el sistema — la interfaz, los permisos, la navegación y la lógica de negocio tendrían que manejar dos roles simultáneos. La fricción de tener dos cuentas es menor que el costo de construir y mantener un sistema híbrido.

**Cómo conviven:** Es la misma app de VIVE. Al abrir la app, la pantalla 2 del onboarding pregunta si el usuario viene a crecer o a acompañar. Cada rol tiene su propio flujo de onboarding y su propia interfaz adaptada.

---

## 🔀 Bifurcación temprana del onboarding — Pantalla 2

**Fecha:** Junio 2026

**Decisión:** La pantalla 2 del onboarding general de VIVE bifurca entre dos roles: usuario y coach. *(Copy exacto a definir con el equipo de marca.)*

**Razonamiento:** Integrar el acceso de coaches en el onboarding principal es más elegante que tener dos apps separadas o dos URLs distintas. El coach entra por el mismo lugar que el usuario, pero desde el primer momento la app reconoce que son perfiles distintos y les da experiencias distintas.

**Flujo del coach desde esa pantalla:**

1. Elige el rol de coach
2. Completa el formulario de aplicación dentro de la app
3. La app muestra estado "pendiente de aprobación"
4. VIVE revisa, entrevista, y decide por mail
5. Si acepta → cuenta se activa y el coach completa su perfil público

---

## 🚀 Coaches para el lanzamiento del MVP

**Fecha:** Junio 2026

**Decisión:** VIVE lanza con un mínimo de 2-3 coaches por categoría (Cuerpo, Mente, Alma) — entre 6 y 9 coaches en total. En un catálogo chico, la calidad de cada coach importa mucho más que en uno grande. El proceso de selección inicial es crítico para la reputación de VIVE desde el día uno.

**Comisión en el MVP:** los primeros coaches no pagan comisión. Entran como coaches fundadores — ayudan a construir y darle forma a la plataforma, reciben visibilidad temprana e historial de reviews, y cuando VIVE escale ya tienen una posición establecida. Se les explica desde el principio cómo funcionará el modelo de comisión una vez que el MVP esté validado.

**Por qué esta decisión:** elimina la fricción económica para conseguir los primeros coaches, permite enfocarse en que la experiencia funcione bien antes de activar el modelo de negocio, y genera un vínculo más cercano con los profesionales que van a ser la cara de VIVE en sus primeros meses.

---

## 💳 Medios de pago — MVP

**Fecha:** Junio 2026

**Decisión:** VIVE integra dos medios de pago para el MVP:

- **Mercado Pago** — obligatorio para Argentina. Es donde vive el usuario argentino, soporta cuotas, y reduce la fricción de pago significativamente.
- **Stripe** — para pagos internacionales y coaches fuera de Argentina.

**Por qué los dos:** Stripe solo deja afuera a una parte importante del mercado argentino. Mercado Pago solo limita la expansión futura. Para el MVP el foco es Mercado Pago, Stripe como complemento.

---

## 🛡️ Garantía de primera sesión

**Fecha:** Junio 2026

**Decisión:** VIVE ofrece una garantía en la primera sesión con cualquier coach: si el usuario no queda conforme, VIVE le devuelve el dinero o le ofrece una nueva sesión con un coach distinto sin costo adicional.

**Por qué:** La mayor barrera de entrada en Argentina al coaching online es la desconfianza — pagar por algo que no conocés. La garantía baja esa barrera a casi cero. Es la señal de confianza más poderosa que VIVE puede dar en sus primeros meses.

**Cómo se activa:** el usuario tiene un período de tiempo post-sesión (a definir) para solicitar la garantía. VIVE evalúa el caso y resuelve. No es automática — pasa por el equipo de VIVE para evitar abusos.

NO INCLUIR CONTENIDO DE LECTURAS

Son muchos mas pasos en comparacion a la IA.

---

## 🗣️ Lenguaje y tono de voz de VIVE

**Fecha:** Junio 2026

**Decisión:** El lenguaje de toda la app es directo, argentino y amigable.

**Qué significa en práctica:**

- **Directo** — frases cortas, sin rodeos, sin lenguaje corporativo ni clínico. El usuario entiende qué hacer en un segundo.
- **Argentino** — tuteo de "vos", expresiones locales naturales ("dale", "arrancá", "guardado ✓ — buenísimo"), no español neutro ni traducido del inglés.
- **Amigable** — tono cálido, como un amigo que sabe de lo que habla. Nunca de gurú, nunca de médico, nunca de profesor.

**Principio de comunicación central — VIVE es una presencia, no un sistema:**

El usuario tiene que sentir que alguien le está hablando. No una app, no un menú, no un formulario. Una voz real, cálida y consistente que lo conoce y le habla a él. Eso aplica a cada texto de la app — desde la bienvenida hasta el mensaje de error.

**Regla de oro: siempre ofrecer, nunca ordenar.**

VIVE siempre ofrece, nunca da órdenes. Cada acción que el usuario puede tomar es una invitación, no una instrucción.

VIVE acompaña al usuario, no lo empuja. Esto se refleja en cada texto de la app. En lugar de poner la carga en el usuario, VIVE ya está ahí moviéndose con él.

- ✅ "Empezamos" — VIVE ya arrancó, el usuario se suma
- ❌ "Empecemos" — le estás pidiendo que haga algo
- ✅ "Te mostramos algunas opciones" — VIVE ofrece
- ❌ "Elegí una opción" — VIVE ordena

Esta distinción aplica a botones, títulos, mensajes de confirmación, estados vacíos y notificaciones. Cualquier texto que suene a instrucción se reescribe como invitación.

**Qué evitar:**

- Lenguaje corporativo: "optimizá tu experiencia de bienestar"
- Jerga clínica o psicológica que aleje
- Mayúsculas agresivas o exclamaciones excesivas
- Textos largos en pantalla
- Sonar como una app traducida del inglés

**Referencia:** el tono de TikTok de Andre — cercano, real, sin solemne.

---

## 🚪 Posicionamiento central — La puerta de entrada

**Fecha:** Junio 2026

**Decisión:** VIVE es la puerta de entrada al mundo del desarrollo personal. El timbre.

No es una app para quienes ya meditan, ya van al coach, ya hacen terapia. Es el primer paso — el lugar donde alguien que nunca hizo nada de esto entra por primera vez, sin barreras, sin jerga, sin sentirse raro o intimidado.

**Implicaciones en todo el producto:**

- **Lenguaje** — nunca usar terminología que asuste. "Hablá con alguien" en vez de "reservá una sesión terapéutica".
- **Onboarding** — la entrada más cálida y simple posible. El usuario no necesita saber nada para empezar.
- **Conexiones** — el cuestionario de matching es crítico. El usuario no sabe qué tipo de profesional necesita y no tiene por qué saberlo. VIVE lo guía.
- **Recursos** — accesibles para alguien que nunca hizo nada de esto, no para alguien avanzado.
- **Orientación profesional** — VIVE orienta sin que el usuario sienta que está siendo diagnosticado o categorizado.

Este posicionamiento es el diferencial más claro de VIVE frente a Menta y las apps globales — que están pensadas para quienes ya están en el mundo del bienestar.

---

## 🔗 VIVE es un canal, no un destino

**Fecha:** Junio 2026

**Decisión:** VIVE no es el fin. Es el canal.

Un canal hacia un coach, hacia un psicólogo, hacia una herramienta concreta. El valor de VIVE no está en el contenido que tiene sino en la calidad de lo que conecta y en la facilidad con la que te lleva ahí.

Esto define todo:

- No competimos con la IA en información — la IA siempre va a saber más
- Competimos en acción — VIVE hace hacer, no informa
- El contenido existe para llevar al usuario a hacer algo, no para que lea
- La conexión con un profesional real es el diferencial que ninguna IA puede reemplazar

**VIVE no informa. VIVE conecta y hace hacer.**

---

## 🧠 Los psicólogos como puerta de entrada estratégica

**Fecha:** Junio 2026

**Decisión:** Los psicólogos no son solo un tipo de profesional más en VIVE — son una estrategia de adquisición.

En Argentina el psicólogo tiene legitimidad cultural que el coach todavía no tiene completamente. El usuario joven entra con confianza por algo que ya conoce ("voy a hablar con un psicólogo"), y dentro de VIVE descubre coaches, herramientas y recursos. La resistencia al coaching baja naturalmente porque ya está dentro del ecosistema.

**El psicólogo es la puerta más conocida. VIVE es el pasillo que lleva al resto.**

Esto refuerza el posicionamiento de VIVE como canal y puerta de entrada — no forzamos nada, simplemente mostramos que hay más mundo del que el usuario conocía.

---

## ⚖️ 80/20 — Las sesiones son el core

**Fecha:** Junio 2026

**Decisión:** El 80% del valor de VIVE está en las sesiones con profesionales. Los recursos son el 20% — complemento, no core.

Esto define prioridades de desarrollo, diseño y energía. Si hay que elegir entre mejorar la experiencia de Conexiones o la de Recursos, siempre gana Conexiones. Las sesiones son el negocio, la retención y el diferencial. Los recursos apoyan la relación entre sesiones, pero no la reemplazan.

---

## ⚖️ Disclaimer legal — VIVE no promete curas

**Fecha:** Junio 2026

**Decisión:** VIVE aclara explícitamente que no promete curas ni resultados garantizados. Todo lo que ofrece — recomendaciones de profesionales, recursos, matching guiado — son sugerencias, no diagnósticos ni tratamientos médicos o clínicos.

**Por qué:** con psicólogos matriculados dentro de la plataforma, VIVE entra en un territorio que tiene implicaciones legales concretas en Argentina. No aclarar esto expone a la plataforma a responsabilidades que no le corresponden.

**Dónde aparece este disclaimer:**

- En el onboarding, antes de que el usuario empiece a usar la app
- En el matching guiado, antes de mostrar las recomendaciones
- En los perfiles de profesionales
- En los términos y condiciones

**Tono:** el disclaimer tiene que estar en el lenguaje de VIVE — directo, humano, sin jerga legal que asuste. Algo como: *"Las recomendaciones que te hacemos son eso — recomendaciones. VIVE no diagnostica ni trata. Los profesionales que encontrás acá son independientes y responsables de su propia práctica."*

---

## 📊 Barra de progreso en flujos de preguntas

**Fecha:** Junio 2026

**Decisión:** En cualquier flujo de preguntas de VIVE (onboarding, matching de coach, cuestionarios) aparece una barra de progreso con el porcentaje completado.

**Objetivo:** reducir la ansiedad del usuario mostrando que el proceso es corto y que está avanzando. El usuario sabe en todo momento cuánto falta.

**Diseño:**

- Barra horizontal en la parte superior de la pantalla
- Color de progreso: terracota (#E8743B)
- Fondo de la barra: gris claro
- Porcentaje visible al lado o debajo de la barra
- Animación suave al avanzar entre pasos

**Aplica a:**

- Onboarding (pantallas 2 en adelante)
- Matching guiado de coaches (3 pantallas)
- Cualquier cuestionario futuro dentro de la app

**Referencia:** Noom y Duolingo usan este patrón con gran efectividad para reducir el abandono en flujos de múltiples pasos.