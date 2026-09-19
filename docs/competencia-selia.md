# Selia — el competidor que hace lo mismo

> **Versión 4, 17/09/2026 (sesión 255).** El §24 agrega el análisis de las reseñas de las tiendas
> (qué hizo bien y mal Selia según sus propios usuarios).
>
> **Versión 3, 17/09/2026.** Andre pidió primero una investigación
> (sesión 252), después *"completa y meticulosa"* (254), y ahora *"todas sus features,
> su onboarding, sus políticas, precios. NECESITO TODO. así podemos ver qué aprovechar
> de ellos, qué evitar, y qué oportunidades tenemos. Un FODA completo."*
>
> **Cómo se investigó** (para saber cuánto confiar en cada dato):
> 1. Las ~40 páginas públicas de `selia.co` bajadas y leídas completas, más su mapa del sitio (5.000+ direcciones).
> 2. **La app web de Selia (`app.selia.co`, versión 2.13.98) por dentro**: sus 125 archivos traen todos los
>    textos de pantalla. Se extrajeron ~1.100 en español. Así se reconstruyeron el registro, el matching, el
>    pago, la sesión y el después **sin crear una cuenta**. Lo que dice una pantalla es seguro; en qué orden
>    aparecen o a quién se le muestran, no siempre.
> 3. **Los dos PDF de términos**, con las cláusulas de plata, datos, credenciales y conducta leídas enteras:
>    usuarios (28/11/2023) y **especialistas (versión 2.0 de 2026)**.
> 4. Prensa 2023–2024, App Store, Y Combinator.
> 5. **(v4)** Las 138 reseñas públicas con texto de Google Play y App Store, bajadas enteras, más el
>    reparto de estrellas de las dos fichas. Es lo único de todo esto que viene de usuarios reales: ver §24.
>
> ⚠️ Las cifras de tamaño las publica la propia Selia: sirven para dimensionar, no están auditadas.

---

## 0. Lo esencial en una página

**Qué es:** la plataforma de salud mental en español más armada de la región. Colombiana, con Y Combinator,
~US$2M facturados en 2023 (proyectaba US$4M en 2024), 600 especialistas, 400.000+ sesiones, 100+ empresas.
Mismo núcleo que Vita: matching, profesionales, sesión por video, herramientas entre sesiones, comisión.

**Lo que no sabíamos hasta esta versión:**
1. **Tiene IA en serio.** "Lía", una asistente que orienta, hace un primer chequeo de ánimo y **prepara la sesión
   con el usuario y le pasa un resumen al especialista**. Y **notas automáticas de sesión**: transcribe el audio
   y genera notas, con consentimiento.
2. **Una persona te ayuda a elegir**: orientación de 15 minutos por video con un psicólogo orientador. Lo que
   pagás por ella vuelve como crédito.
3. **"Garantía de Match":** si no hubo match en la primera cita, la segunda es gratis. Y si querés cambiar de
   especialista, te dan una sesión sin costo con otro.
4. **Cobra de mil maneras**: tarjeta, PSE, Nequi, "comprá ahora, pagá después" (Addi y Bancolombia), cuotas
   sin interés, créditos, cupones, referidos (50% al amigo), tarjetas de regalo, alianzas (Banco Falabella 50%).
5. **Cuentas familiares**: un adulto administra y paga la terapia de su pareja o de sus hijos.
6. **Con los profesionales es dura**: **Selia fija el precio**, no el profesional; puede cobrarles una tarifa
   de registro; les descuenta los reembolsos de sus pagos siguientes; les prohíbe hablar mal de Selia; y durante
   **12 meses después de irse** no pueden atender por fuera a nadie que conocieron ahí, con multa.
7. **Su apuesta más fuerte fuera de Colombia son los latinos que viven afuera** (EE.UU., España, Canadá,
   Australia), desde USD 25. Es exactamente el público del riel internacional de Vita.

**Lo que ya sabíamos y se confirma:** en Argentina está de costado (dólares, sin Mercado Pago, sin matrícula
visible, pocos profesionales argentinos). Sus reglas con la plata son duras (sin reembolso pasadas 24 h de la
compra, saldo que vence, perdés todo si das de baja la cuenta). Por escrito dice que no puede garantizar que los
títulos de sus especialistas sean auténticos.

**Cómo usar este documento:** qué es Selia por dentro (§1–15), comparación (§16), FODA (§17–18), qué copiar,
qué evitar y oportunidades (§19–21), qué vigilar (§22), y **cómo comunicar Vita** (§23).

**El FODA en cuatro líneas** (detalle en §17–18):
- **Fortaleza de Vita:** hecha para Argentina, con reglas justas y una propuesta mejor para el profesional.
- **Debilidad de Vita:** cero usuarios, cero reseñas, sin IA, sin orientación humana, sin paquetes, sin empresas.
- **Oportunidad:** argentinos (acá y afuera) que quieren un profesional argentino, pagando como pagan acá; y
  profesionales argentinos que no aceptarían las condiciones de Selia.
- **Amenaza:** que Selia decida venir en serio. Tiene todo armado menos lo local, y lo local se copia rápido.

---

## 1. Quién es

- **Selia**, marca de **Heal Room Inc.**, sociedad de **Delaware** (domicilio en Wilmington). Opera desde
  **Bogotá**; Y Combinator la lista en **Miami**. Empezó en **diciembre de 2020** como clínica virtual de salud
  en general y se enfocó en salud mental.
- **Fundadores:** **Santiago de Bedout** (CEO; antes fue de los primeros empleados de Rappi, donde manejó el
  negocio de bebidas alcohólicas), **Luciano Jaramillo** y **Jaime Castro**. Algunas notas suman a Gustavo
  Santamaría y Pablo Rojas.
- **Equipo:** unas **20 personas** según Y Combinator (sin contar especialistas).
- **Inversión:** Y Combinator (invierno 2022); seed de ~**US$1,5M**; **US$300.000** en octubre de 2023 del premio
  Forbes 30 Under 30 Latinx (Bad Bunny, jurado, puso US$100.000). **Ninguna ronda nueva encontrada en 2025–2026.**
- **Sigue muy activa:** el mapa del sitio se actualizó **hoy**, publica notas de blog de septiembre de 2026, la
  app va por la versión 2.13.98 y los términos de especialistas son versión 2.0 de 2026.

### Cómo creció (cifras propias)

| Fecha | Sesiones/mes | Sesiones totales | Especialistas | Empresas | Facturación |
|---|---|---|---|---|---|
| dic 2023 | ~6.000 | 100.000+ | 350+ | 50+ | objetivo US$2M en 2023 |
| jul 2024 | 10.000+ | 160.000+ | 350+ | — | proyecta US$4M en 2024 |
| hoy (web) | — | **400.000+** | **600+** | **100+** | — |

- Dice **40.000+** personas atendidas en una página y **50.000+** en otra; **4,92/5** con "83.000" o "100.000"
  reseñas según la página.
- En julio de 2024 dijo haberles pagado **US$700.000** a los especialistas. Cruzado con la facturación sugiere que
  **se queda con una parte grande de cada sesión**, pero no dice el período: es una pista, no un dato.

---

## 2. Cómo está hecha

| Pieza | Qué usa | Qué significa |
|---|---|---|
| App | **Una web (Vue) empaquetada como app** (Capacitor), la misma para web, iOS y Android | Un solo producto para mantener. Por eso casi todo pasa en la web |
| Video | **Agora**, dentro de la app, con sala de espera | Igual que Vita (que usa Daily.co) |
| Pagos | **Stripe** (internacional), **Wompi, PSE y Nequi** (Colombia), **Addi y Bancolombia** (pagar después) | Cero medios argentinos. No hay Mercado Pago en ningún lado del código |
| Datos y marketing | Amplitude, Segment, HubSpot, Sentry, Typeform | Mide cada paso del matching (hay eventos de "presupuesto", "género", "enfoque") |
| Web pública | Webflow, con **pruebas A/B de la home** (`home-test/home-a` y `home-b`) | Optimiza la conversión |
| Idiomas | Español, inglés y **portugués** en toda la app | Preparada para Brasil, aunque no lo anuncia |

**Su máquina de Google** (del mapa del sitio): **2.840 páginas solo para México**, **1.482 reseñas de pacientes
publicadas una por una** como páginas, **815 notas de blog**, **676 perfiles de especialistas**, 20 temas, 10 tests,
6 programas, páginas por país (Argentina, Colombia, México) y por país de migración (EE.UU., España, Canadá,
Australia). Cada reseña publicada como página propia es contenido gratis que Google indexa.

**Descuidos visibles** (señal de que mueven rápido y revisan poco):
- La página de **psiquiatría** tiene en "Nuestro enfoque" el texto de **nutrición** ("sin contar calorías").
- En la home B, la tarjeta de **Burnout** tiene el texto de **ruptura**.
- La web dice "**4,9** en las tiendas". La App Store muestra **4,3 con 103 calificaciones** y Google Play **3,7 con 264 reseñas**, con un 17% de una estrella (§24).
- Orientación de "15 minutos" en la app y "20 minutos" en la web.
- Los términos de usuarios dicen **solo mayores de 18**; los de especialistas y la app **aceptan menores** con
  consentimiento de los padres.
- La landing argentina muestra la **línea de crisis de Colombia**.

---

## 3. El registro, paso a paso

Reconstruido de los textos de la app (y de la web, que dice lo mismo):

1. **Pantallas de bienvenida**: *"Tu espacio para cuidar tu bienestar emocional"*, *"Apoyo de especialistas
   que conectan contigo"*, *"Recursos personalizados para sentirte mejor"*, *"Hazle seguimiento a tu evolución
   emocional"*.
2. **Crear cuenta**: **Apple, Google, o mail con código de 6 dígitos** (también mail y contraseña). Bloquea
   dominios de mail descartables.
3. **Preguntas de a una por pantalla**: *¿Cómo te llamas?* → *¿Con qué género te identificás?* (incluye mujer y
   hombre transgénero) → *¿Cuál es tu fecha de nacimiento?* (si sos menor, pide consentimiento de los padres) →
   *¿Cómo es tu número de teléfono?* (*"solo para notificarte sobre tu atención"*) → **"¿Qué te trajo a buscar
   ayuda hoy?"** → **"¿Qué te gustaría hacer en Selia?"**
4. **Código de empresa** (opcional): si la empresa paga, se verifica con cédula y aparece el beneficio (*"El
   {x}% de descuento en tus siguientes {n} sesiones"*).
5. **Lía entra en escena**: *"Hola, soy Lía, tu guía en bienestar emocional"*. Propone *"Una primera mirada a tu
   bienestar: 5 preguntas sobre cómo te has sentido las últimas dos semanas"*, y si hace falta, sigue con los
   tests de ansiedad y depresión (*"Solo toma 3 minutos"*, se puede saltar).
6. **Recomendación**: *"Camino sugerido"* (Lía) o *"Prefiero explorar por ahora"*.
7. **Tres caminos para elegir especialista** (§4).
8. Detecta la **zona horaria** y pregunta si actualizarla.

**Comparado con Vita:** mismo principio de una pregunta por pantalla. Diferencia de fondo: Selia **registra primero
y muestra valor después**; el onboarding de Vita se pensó al revés (valor antes del registro). Selia pide teléfono,
género y fecha de nacimiento de entrada: mucha fricción, pero la usa para avisar y para el matching.

---

## 4. Cómo se elige especialista

Selia ofrece **tres caminos** en la misma pantalla (*"Selecciona un método"*):

### a) Matching ("Tu Match")
- 2–3 minutos. Pregunta: **motivos** (qué te trae), **género del especialista** (opcional), **enfoque** (opcional),
  **presupuesto** y **disponibilidad** (días y horarios).
- Devuelve **3 especialistas** y **explica por qué** cada uno (enfoque, experiencia con casos parecidos). Si no hay
  coincidencia exacta: *"creemos que estos especialistas pueden ser de tu interés"*.
- Hay una versión con IA en prueba (`ai_matching_version` en sus métricas) y una **"Búsqueda inteligente"**:
  *"Cuéntanos qué necesitas y encontraremos especialistas para ti"*.
- Se puede rehacer cuando se quiera.

### b) Orientación con una persona
- **Videollamada de 15 minutos con un "psicólogo orientador"** que recomienda especialistas. *"Estamos
  seleccionando a la orientadora con la mejor disponibilidad para ti."*
- **Se paga, pero vuelve como crédito**: *"Después de la orientación, lo recibirás como créditos para usar en tu
  próxima compra"*. En la práctica, gratis para quien después reserva.
- Es la salida cuando el matching no convence: *"¿No te gustan estas recomendaciones? Habla gratis con uno de
  nuestros psicólogos"*.

### c) Directorio y buscador
- Busca **por nombre, especialidad o síntoma**. Favoritos.

### El perfil del especialista
Experiencia en años, *"Especialista destacado"*, *"Mi estilo de terapia"*, *"Trabajo con:"*, *"¿Cómo será tu
primera sesión?"*, dirección de consultorio si atiende presencial, reseñas con calificación, contador de citas
completadas, *"Excelente continuidad en los procesos"* (una insignia por retención), y avisos de *"no está
recibiendo nuevos consultantes"*.

- **Si no hay horarios**: botón **"Solicitar disponibilidad"** (elegís días y franjas, *"después de las 6:00 PM"*,
  y te avisan cuando el especialista responde).
- **Aviso de habilitación de otro país** (clave para Argentina): *"Este especialista está habilitado y acreditado
  en {país}, no en tu país de residencia"*, con una casilla que el usuario tiene que tildar: *"He leído y entiendo
  la información proporcionada"*. O sea: **a un argentino le puede tocar una psicóloga colombiana sin matrícula
  argentina, y Selia lo resuelve con un tilde**.

---

## 5. Reservar y pagar

- **Elegís servicio** (individual, pareja, psiquiatría, coaching, nutrición), día y hora (reservas hasta 6 meses
  adelante), y escribís el **motivo de consulta** (obligatorio).
- **Te guardan el turno 10 minutos** mientras pagás (*"¡Perderás tu cita! Si cancelas el pago de tu cita, tu cupo
  se liberará"*). Con Nequi, 5 minutos.
- **"Pagaré en otro momento"**: se puede reservar sin pagar; si no se paga en **24 horas**, se puede cancelar.
- **Medios:** tarjeta (guardada), PSE, Nequi, Addi, "Paga después" de Bancolombia, **cuotas sin interés**, créditos
  y cupones.
- En el checkout: *"¡Garantía de Match! Si no hay match en tu primera cita, te obsequiamos la segunda."* y
  *"¡Ahorra hasta X en esta sesión con un paquete de sesiones!"*.
- **Consentimiento informado con firma electrónica** (*"¡Firma completada!"*, llega por mail).
- **Contacto de emergencia** en el perfil.

---

## 6. La sesión y el después

**Antes:**
- **Lía prepara la sesión** con el usuario: *"¿Qué te gustaría tener presente para tu sesión? Puedo ayudarte a
  ordenar tus ideas para llegar con más claridad"*. Arma un **"Resumen para tu sesión"** que *"estará disponible
  para tu especialista antes de la sesión"*. Se puede *"seguir hablando con Lía durante el día"*.
- Recordatorio de permisos de cámara, recomendaciones para la primera sesión, sala de espera.

**Durante:**
- Video (Agora), voz o chat.
- **Notas automáticas**: pide permiso (*"Autoriza la transcripción de tus sesiones para generar notas
  automáticas"*), con opción de recordarlo o preguntar cada vez, y *"Rechazar no afecta tu sesión"*. El especialista
  también puede frenarlas. Las notas (*"generadas automáticamente por IA a partir del audio de la sesión. Solo tú y
  tu especialista tienen acceso"*) traen resumen, *"Recomendaciones de la sesión"* y *"Reflexión final"*.

**Después:**
- **Calificación en tres partes**: atención del especialista, **calidad de la videollamada**, y *"¿Cómo te
  sentiste?"*. Reseña anónima para *"la comunidad"*.
- **"¿Quieres continuar con este especialista?"** Si decís que no: *"Podrás acceder a una cita sin costo adicional
  para que conozcas a otro especialista"* (con otro de **igual o menor precio**).
- **Empuje a la continuidad**, muy trabajado: *"Estás construyendo constancia"*, *"La terapia funciona mejor
  cuando hay continuidad"*, **"Próxima sesión sugerida"** por el especialista, una barra de progreso, y *"En promedio,
  los usuarios de Selia empiezan a notar mejoría alrededor de este número de sesiones"*.
- Botón **"Agendar próxima sesión"** y la oferta de paquete.
- **Si el especialista no se conectó**: *"Parece que tu especialista tuvo un inconveniente para conectarse"*,
  con reagendar o buscar otro.

---

## 7. Entre sesiones

- **Chequeos mensuales** de bienestar, ansiedad y depresión, con **gráficos de evolución** (*"Así ha evolucionado
  tu nivel de ansiedad 🌱"*) e interpretación por rangos.
- **Diario emocional** con registro de ánimo.
- **Hábitos**, **"Caminos"** con cuestionario, **programas**, **meditaciones** (100+), respiración, biblioteca de
  contenido, *"Contenido para ti"*.
- **Eventos y conferencias** con cupos, y **terapia grupal** de 8 a 14 personas, sin grabar.
- **Reto de bienestar de 10 días** (web), con ejercicios escritos y newsletter.
- **Chat con el especialista**, que se habilita después de reservar.

**Tests gratuitos** (con instrumento validado y nombre): depresión (**PHQ-9**), ansiedad (**GAD-7**), inteligencia
emocional (**WLEIS**), insomnio (**AIS**), conducta alimentaria (**EAT-26**), burnout (**CBI**), trauma infantil
(**ACE**), autoestima, dependencia emocional, pareja. Cada uno termina en *"agendá con un especialista"*.

**Programas:** ansiedad, depresión, burnout, duelo (incluye migración y mascotas), pareja y **"Programa Tusa"**
(ruptura). Son sesiones + contenido + seguimiento, y se compran como paquete (*"¡Comprar mi programa!"*).

---

## 8. Precios y todas las formas de cobrar

### Sesiones

| Mercado | Sesión desde | Primera sesión | Notas |
|---|---|---|---|
| Colombia | COP 80.000–100.000 (hasta ~150.000) | 30% off (INICIO30) | Promos a COP 51.000 |
| México | MXN 590 | 30% off | |
| Argentina | **USD 35** | 30% off (AR30) | |
| Latinos afuera | **USD 25** | 30% off | *"En muchos países la terapia privada puede costar entre USD 150 y 300"* |

- **Duración:** 45–60 minutos según la web (hay usuarios que se quejan de sesiones de 35 minutos).
- **El precio lo fija Selia** por especialista, según formación y experiencia (términos de especialistas §2.3.4).

### Paquetes
- **4, 8 y 12 sesiones, hasta 12% de descuento**, por tipo de servicio y rango de precio (*"Estos paquetes aplican
  para especialistas que ofrecen {servicio} por un valor de {precio}"*). El paquete **no está atado a un
  especialista**, sino a una franja de precio: se puede cambiar de especialista dentro de la franja.
- **Vencen al año** (*"Estos paquetes expiraron porque ha pasado más de un año desde su compra"*). Cuotas sin interés.

### Todo lo demás
| Mecanismo | Cómo funciona |
|---|---|
| **Créditos** | *"Saldo acumulado por referidos, gift cards y devoluciones"*. Parte de los reembolsos vuelven como crédito |
| **Referidos** | Tu código le da **50% en la primera sesión** al amigo; vos recibís créditos. Mensaje listo para compartir |
| **Tarjetas de regalo** | Recargables, desde COP 42.000 o USD 20 |
| **Cupones** | AR30, INICIO30, AMARILLO (50%, campaña de prevención del suicidio), FALABELLA50 |
| **Alianzas** | **Banco Falabella**: 50% en la primera cita pagando con su tarjeta. Podcasts ("Vos Podés", "Los hombres sí lloran") |
| **Empresas** | Pago por uso con descuentos por colaborador (§11) |
| **Orientación** | Paga, devuelta como crédito |
| **Pagar después** | Addi y Bancolombia |

---

## 9. Las reglas para el usuario

De los términos (28/11/2023) y de los textos de la app:

| Tema | Regla de Selia |
|---|---|
| Arrepentimiento | Reintegro total **solo dentro de las 24 h de la compra** |
| Después de eso | **Solo reprogramar**, hasta 24 h antes. *"No se permiten reagendamientos con menos de 24 horas"* |
| A menos de 24 h | Decide el especialista si reprograma |
| Insatisfacción | Reintegro "si considera que lo merece", caso por caso; en la práctica, *Garantía de Match* (segunda sesión gratis) |
| Saldo y paquetes | **Vencen al año**, no se devuelven en efectivo |
| Dar de baja la cuenta | **Perdés todo lo que no usaste**, sin devolución |
| Credenciales | *"No tiene ningún control sobre las calidades académicas y habilitaciones legales… no puede garantizar que los documentos y acreditaciones sean válidos o auténticos"*; le pide al usuario verificarlas |
| Hablar mal | **Prohibido** comentar negativamente en público o en redes sobre Selia |
| Disputas | Ley y tribunales de **Delaware** |
| Edad | 18+ (con excepciones y consentimiento de padres) |
| Datos | *"Selia no comparte datos con inmigración"* (para latinos en EE.UU.) |
| Borrar cuenta | Desde la app, pidiendo el motivo |

⚠️ **Lectura nuestra, no de un abogado:** para un consumidor argentino, perder el saldo al dar de baja la cuenta,
prohibir reseñas negativas y mandar los reclamos a Delaware son cláusulas que la **Ley 24.240** (art. 37) permite
tener por no escritas, y el Código Civil y Comercial le da competencia al juez del domicilio del consumidor.

---

## 10. Las reglas para el especialista (términos 2026, versión 2.0)

**Esto es nuevo y es lo que más sirve para reclutar profesionales en Argentina.**

| Tema | Regla de Selia |
|---|---|
| **Precio** | **Lo fija Selia**, según formación y experiencia. Si el profesional no está de acuerdo, puede pedir revisión o irse (§2.3.4) |
| **Comisión** | No está en los términos: va en una **"Propuesta de Servicios" privada por mail**, y Selia puede cambiarla con aviso (§3.1) |
| **Tarifa de registro** | Selia **puede cobrarle al profesional por registrarse** o una tarifa periódica, y pagarla *"no te garantiza que serás elegido"* (§3.1.1) |
| **Cobro** | Selia cobra y le paga **semanal, quincenal o mensual**, calendario modificable. Puede exigirle abrir cuenta en un proveedor aliado (§3.4) |
| **Reembolsos** | Si Selia le devuelve la plata a un paciente por una falla del servicio, **se lo descuenta al profesional de su pago siguiente** (§3.5) |
| **No elusión** | No puede atender por fuera a **nadie que conoció en Selia**, ni a sus empresas, **mientras esté activo y 12 meses después de irse**. Si lo hace: suspensión, **multa descontada del pago** e indemnización (§3.10) |
| **Empresas** | Talleres y charlas a clientes de Selia, solo a través de Selia (§3.11) |
| **Métricas** | Selia lo evalúa por **calidad, retención y satisfacción**; si no llega, **deja de asignarle pacientes nuevos** (§2.3.11) |
| **Hablar mal** | Prohibido, igual que al usuario |
| **IA** | Selia puede implementar herramientas de IA; si el profesional sigue usando la plataforma, **las avala bajo su propia responsabilidad** (§3.2.1) |
| **Historia clínica y datos** | Selia da la herramienta, pero **el responsable legal es el profesional**, y tiene que mantener indemne a Selia ante cualquier multa (§2.3.9) |
| **Consentimiento informado** | Obligatorio, el de Selia o uno propio |
| **Factura** | Selia no garantiza factura al paciente; el profesional tiene que avisar antes si no puede emitirla (§2.3.10) |
| **Horario** | Lo fija el profesional |
| **Disputas** | Delaware |

**Lo que Selia les ofrece a cambio:** pacientes de cualquier país, agenda y recordatorios, cobro resuelto, historia
clínica, consentimiento con firma electrónica, notas automáticas, comunidad de colegas, trabajo 100% remoto.

---

## 11. Empresas (B2B)

- **Clientes que muestra:** Coca-Cola FEMSA, Natura & Avon, Visa, Bavaria, Starbucks, KPMG, WeWork, Nutresa,
  Alquería, Alkosto, Experian, Habi. **Casos de éxito publicados:** Cenit, Coca-Cola FEMSA, Colfondos, Coninsa,
  KPMG, Levapan, Mineros, Promigas, Yuno.
- **Modelo:** *"Solo pagas por lo que tu equipo utiliza"*. El empleado entra con un **código de empresa** y recibe un
  descuento configurable (en todas, en la primera o en las siguientes N sesiones).
- **Incluye:** sesiones, talleres, tests de burnout y estrés, bienestar financiero, **tableros de métricas** para RR.HH.
- Dice **82% de adopción** promedio.
- **México:** todo armado alrededor de la **NOM-035**, la norma que obliga a las empresas a medir riesgo psicosocial.
  En Argentina no encontramos una norma equivalente que obligue.

---

## 12. Crisis y seguridad

- **Página de líneas** (`/hotlines`) con 11 países; la de Argentina está bien (0800-999-0091, Provincia de Buenos
  Aires, Mendoza, Neuquén), pero **no incluye el 135** del Centro de Asistencia al Suicida.
- **Campaña "Por si acaso"** (septiembre, mes de prevención del suicidio): líneas de Colombia, Argentina y México,
  guía para quien está preocupado por otro, preguntas para quien está mal, un bloque *"Hablar es de hombres"*, y un
  cupón de 50%. Bien hecha, aunque la respuesta a *"siento que ya no quiero seguir, ¿qué hago ahora?"* solo da
  números de **Colombia**.
- **Landing argentina**: muestra la línea de **Colombia**.
- Términos: *"no recomendada para emergencias"*, en mayúsculas.
- Contacto de emergencia en el perfil del usuario.

---

## 13. Marketing y adquisición

1. **Google, a escala**: miles de páginas (tests, temas, reseñas, perfiles, países) y 800+ notas.
2. **Tests gratis** como puerta: *"Empieza por entenderte. 10 tests científicamente validados"* → agendar.
3. **Descuento de entrada** en todos lados (30%, 50% con referidos, alianzas y campañas).
4. **Latinos en el extranjero**: *"sin seguro médico, sin estatus migratorio, desde USD 25, en tu idioma"*, con
   testimonios de migrantes.
5. **Alianzas** con bancos y podcasts.
6. **Empresas**, con casos de éxito y demo.
7. **Campañas temáticas** (prevención del suicidio, el Mundial y la salud mental).
8. **Pruebas A/B** de la home.

---

## 14. En Argentina

- **Página propia** en voseo parcial (*"Conectá con psicólogos desde Buenos Aires, Córdoba, Rosario"*, mezclado con
  *"encuentras"*). Dice *"especialistas argentinos y latinos"* y que *"Argentina tiene una de las culturas de terapia
  de pareja más desarrolladas de LATAM"*.
- **USD 35**, cupón AR30. **Sin pesos, sin Mercado Pago**, sin cuotas argentinas.
- **Sin matrícula visible**; con el aviso de *"habilitado en otro país"*.
- **Al menos una psicóloga argentina** en la red (psicoanalista, 36 reseñas, contra 700+ de las colombianas más
  pedidas): la red argentina existe, pero es chica.
- Sin prensa argentina, sin obras sociales, sin factura garantizada.

---

## 15. Otros que compiten en Argentina

- **Terapify** (México): dice operar en Argentina y España, 30.000+ usuarios, 400+ psicólogos, recluta argentinos.
- **Psyred**: psicólogos de la región desde USD 10–30.
- **Directorios locales**: Tu Terapia, BuscoPsi, TerapyX, Psychology Today Argentina.
- **Software de turnos con Mercado Pago** (Turnito y similares): compite con la parte "agenda y cobro" que Vita le da al profesional.
- **Startups argentinas de salud mental**: Yerbo, Sigmind, Neomente.
- **La alternativa más fuerte**: la obra social o prepaga, el hospital público, o el psicólogo que alguien recomienda.
- **Precio de referencia 2026**: $20.000–55.000 por sesión en CABA, $12.000–40.000 en el interior.

---

## 16. Selia contra Vita, punto por punto

| | Selia | Vita |
|---|---|---|
| Profesiones | psicología, psiquiatría, coaching emocional, nutrición | psicología, coaching, nutrición |
| Registro | primero la cuenta, después el valor; pide teléfono, género y nacimiento | valor antes que registro (principio de diseño) |
| Elegir | matching con 3 recomendaciones explicadas, IA, orientación humana de 15 min, directorio | quiz, puertas por tema, deck de Conexiones, buscador |
| IA | Lía (orienta, chequea ánimo, prepara la sesión), notas automáticas | no |
| Sesión | video (Agora), voz, chat; presencial; grupal | video (Daily.co, **sin probar con dos personas**, L1) y chat |
| Precio lo fija | **Selia** | **el profesional** |
| Moneda en Argentina | dólares | pesos |
| Medios de pago | tarjeta, PSE, Nequi, pagar después, cuotas; nada argentino | Mercado Pago (con cuotas); PayPal y USDT para afuera |
| La plata | Selia la retiene y paga semanal a mensual | con MP va directo al profesional |
| Comisión | privada, cambiable, más posible tarifa de registro | pública: 20% primera sesión del vínculo, 15% después, **0% en la primera si el cliente lo trajo el profesional** |
| Paquetes | 4/8/12, hasta 12%, vencen al año | no |
| Créditos, referidos, gift cards | sí | no |
| Cancelar | reintegro solo 24 h después de comprar; después reprogramar | **reintegro total cancelando con 24 h o más** |
| Insatisfecho | segunda sesión gratis ("Garantía de Match") o cambio gratis | **reintegro de la primera sesión** (una vez por cliente) |
| Si el especialista no va | reagendar o cambiar | reembolso automático si cancela o no confirma |
| Credenciales | "no podemos garantizar que sean auténticos"; tilde de "habilitado en otro país" | **matrícula revisada a mano**; "Psicólogo" en el catálogo solo con matrícula verificada |
| Reseñas negativas | prohibidas por contrato | permitidas, moderadas |
| No elusión | hasta 12 meses después de irse + multa | durante el vínculo; detección de contacto y escalera de sanciones revisada a mano |
| Link propio del profesional | prohibido llevarse pacientes | sí, sin comisión en la primera sesión |
| Seguimiento | chequeos mensuales con gráficos, empuje a continuidad | registro de ánimo, diario, gratitud |
| Herramientas | meditaciones, diario, hábitos, caminos, programas, eventos | respiración, meditación, sueño, ruido, relajación, escáner corporal, anclaje, lecturas, recursos de profesionales |
| Familia | cuentas familiares | no |
| Empresas | fuerte | no |
| Crisis en Argentina | landing con línea de Colombia; página de líneas correcta | pantalla con líneas argentinas y horarios verificados, en usuario y profesional |
| Disputas | Delaware | juez del domicilio del consumidor |
| Tamaño | 400.000 sesiones, 600 especialistas | **cero usuarios**, pre-lanzamiento |

---

## 17. FODA de Selia

**Fortalezas**
- Escala y prueba social: 400.000 sesiones, 600 especialistas, miles de reseñas, clientes corporativos conocidos.
- Producto completo de punta a punta: tres formas de elegir, orientación humana, pagos flexibles, seguimiento,
  empuje a la continuidad muy trabajado.
- **IA aplicada donde duele**: preparar la sesión y documentarla.
- Motor B2B con casos, tableros y un gancho regulatorio en México.
- Máquina de Google enorme y pruebas A/B: adquisición barata.
- Monetización diversificada: paquetes, créditos, referidos, alianzas, pagar después.
- Respaldo de Y Combinator y un equipo que itera rápido.

**Debilidades**
- **Condiciones duras con el profesional** (precio fijado, pagos diferidos, descuentos de reembolsos, tarifa posible,
  12 meses de no competencia, métricas que cortan pacientes). Terreno fértil para que los buenos se vayan.
- **Condiciones duras con el usuario** (sin reembolsos, saldo que vence, se pierde al irse, prohibido criticar).
- **Credenciales sin respaldo**: "certificados" en la web y "no podemos garantizar" en los términos; resuelve la
  habilitación extranjera con un tilde.
- **Descuidos** de textos y datos inconsistentes (§2): mucha velocidad, poca revisión.
- **Nada local fuera de Colombia**: sin pagos locales en Argentina, ni en México más allá de la tarjeta.
- Pocas descargas reales de la app (103 calificaciones en iOS): depende de la web y de Google.
- **Sin noticias de inversión desde 2023**: o crece con ingresos propios, o tiene poco margen para expandirse.

**Oportunidades (para Selia)**
- Brasil (ya tiene portugués), latinos en EE.UU. y España, IA como diferencial, más empresas.
- Venir en serio a Argentina con cobro en pesos y psicólogos argentinos.

**Amenazas (para Selia)**
- Regulación de telepsicología por país (matrícula local, datos de salud, consumidor).
- Riesgo de privacidad y confianza con la transcripción de sesiones.
- Competidores locales mejor adaptados en cada país.
- Profesionales que se van por las condiciones; reseñas negativas que igual aparecen.

---

## 18. FODA de Vita frente a Selia

**Fortalezas**
1. **Argentina de punta a punta**: pesos, Mercado Pago con cuotas, voseo real, crisis local verificada.
2. **Reglas justas y públicas con la plata**: reembolso total cancelando a tiempo, garantía con reintegro,
   comisión publicada.
3. **La mejor oferta para el profesional**: fija su precio, cobra en su Mercado Pago, el link propio sin comisión en
   la primera sesión, sin tarifa de registro, sin no competencia posterior, sanciones revisadas a mano.
4. **Matrícula revisada a mano** y "Psicólogo" solo con matrícula verificada.
5. **Riel para argentinos afuera** (PayPal y USDT) ya construido.
6. Anti-fuga pensado para no castigar al profesional (comisión escalonada, detección que advierte antes de sancionar).
7. Equipo chico que decide rápido y con costos bajos.

**Debilidades**
1. **Cero usuarios, cero reseñas reales, marca desconocida.** Es la brecha más grande.
2. **Lo que bloquea el lanzamiento** (sección L de `problemas-abiertos.md`): videollamada sin probar con dos
   personas, comisión real de MP sin medir, checkout web apagado, legales sin revisar.
3. **Sin orientación humana** para quien no sabe elegir, y sin explicar por qué se recomienda a alguien.
4. **Sin paquetes, créditos, referidos ni gift cards.** Con Mercado Pago la plata va al profesional, y eso los complica.
5. **Sin IA** para preparar o documentar sesiones.
6. **Sin empresas**, sin psiquiatría, sin terapia grupal.
7. **Sin presencia en Google**: no hay blog, tests públicos ni páginas por tema.
8. Catálogo chico, con datos de prueba todavía adentro (L8), y "profesión" no es un campo estructurado.
9. Equipo de dos: cada frente nuevo compite con el lanzamiento.

**Oportunidades**
1. **Argentinos que quieren un profesional argentino**, sobre todo **afuera**: Selia les ofrece "latinos"; Vita les
   puede ofrecer **argentinos con matrícula, en su propia cultura terapéutica**, pagando en dólares o USDT.
2. **Reclutar profesionales con las condiciones de Selia como contraste**: *"vos ponés tu precio, cobrás en tu Mercado
   Pago, tus pacientes son tuyos, sin multas por irte"*.
3. **Confianza como posicionamiento**: matrícula verificada, reglas de reembolso claras, reseñas libres. Todo lo que
   Selia no puede decir.
4. **Google en voseo**: Selia tiene una página flaca para Argentina. Tests y temas escritos para acá, sin competencia seria.
5. **Reintegro de obras sociales y prepagas**: Selia no garantiza factura. Ayudar al paciente a pedir el reintegro con
   la factura del profesional matriculado puede ser un diferencial concreto (a validar: qué piden las prepagas).
6. **Empresas argentinas**, más adelante, sin competir contra el gancho de la NOM-035.
7. **Llegar primero**: Selia no está enfocada acá y no hay señales de que lo vaya a estar pronto.

**Amenazas**
1. **Que Selia venga en serio**: tiene todo armado; le falta cobrar en pesos (con Stripe o dLocal no le llevaría
   mucho) y reclutar argentinos.
2. **Terapify** y otras plataformas que ya reclutan psicólogos argentinos.
3. **El listón de producto sube**: IA, orientación, paquetes y seguimiento pasan a ser lo esperable.
4. **Selia es más barata para quien paga en dólares** (USD 25 desde afuera) y gana en Google.
5. **La alternativa gratis o cubierta** (obra social, hospital) y el psicólogo por recomendación.
6. **Regulación y reputación**: un incidente de crisis o de credenciales pega más fuerte a una marca que recién empieza.

---

## 19. Qué aprovechar de ellos

Ordenado por impacto sobre costo para Vita. **Ninguna es para antes del lanzamiento.**

| # | Idea | Por qué | Costo o choque |
|---|---|---|---|
| 1 | **Explicar por qué se recomienda a alguien** en el quiz y en Conexiones | Selia lo pone como argumento central; baja la ansiedad de elegir | Bajo: es texto sobre datos que ya existen |
| 2 | **Salida para "no sé a quién elegir"**: rehacer el quiz, ver otras opciones, o hablar con alguien | La orientación es su red de seguridad | Una persona orientando no escala para dos; empezar por rehacer y ver 3 opciones |
| 3 | **Cambio de profesional sin culpa**: *"¿Querés seguir con esta persona?"* después de la primera sesión | Retiene a quien no hizo match, en vez de perderlo | Choca con la garantía de reintegro: decidir si se ofrece cambio, reintegro, o elegir |
| 4 | **Empuje a la continuidad** después de cada sesión: próxima sesión sugerida por el profesional, reservar de nuevo en un toque | Es la medida anti-fuga n.º 1 de Vita, y Selia la tiene muy pulida | Medio; ya está en la lista de anti-fuga |
| 5 | **Calificar la calidad de la videollamada** aparte del profesional | Separa "el video anduvo mal" de "no me gustó"; detecta fallas técnicas | Bajo |
| 6 | **"Solicitar disponibilidad"** cuando no hay horarios | No perder a quien llegó al perfil | Bajo a medio |
| 7 | **Tests validados públicos** (PHQ-9, GAD-7) en voseo, en la web | La puerta de entrada de Google de Selia | Medio; cuidar "Vita guía, no diagnostica" y derivar a crisis si el resultado es severo |
| 8 | **Referidos** | Adquisición barata | Con MP la plata va al profesional; el descuento sale de la comisión de Vita |
| 9 | **Paquetes** | La demanda existe | Mismo obstáculo; empezar por PayPal y USDT, donde Vita retiene |
| 10 | **Preparar la sesión** ("qué quiero trabajar hoy"), aunque sea sin IA | El paciente llega mejor y el profesional valora el resumen | Medio; con IA, alto y con riesgo de privacidad |
| 11 | **Aviso honesto de habilitación**: si un profesional no tiene matrícula argentina, decirlo claro | Selia lo resuelve con un tilde; Vita puede hacerlo mejor y convertirlo en confianza | Bajo |
| 12 | **Cuentas familiares** | Padres que pagan la terapia de hijos grandes | Alto; Vita es solo 18+ |

---

## 20. Qué evitar

1. **Fijarle el precio al profesional.** Es lo contrario de la promesa de Vita.
2. **Quedarse con la plata del usuario**: saldo que vence o se pierde al irse, reembolsos que vuelven solo como crédito.
3. **Prohibir críticas** o mandar los reclamos a otra jurisdicción.
4. **No competencia posterior con multas** para el profesional: aleja a los buenos y en Argentina es discutible.
5. **Decir "certificados" sin poder respaldarlo**, o resolver la habilitación con un tilde.
6. **Transcribir sesiones** sin un marco de datos de salud muy sólido (Ley 25.326, datos sensibles). Si algún día se
   hace: consentimiento por sesión y sin guardar el audio.
7. **Páginas por país sin revisión local**: la línea de crisis equivocada es exactamente el error que no se puede tener.
8. **Descuentos permanentes de entrada** (30% a 50%) que acostumbran a no pagar precio lleno.
9. **Pedir teléfono, género y nacimiento antes de mostrar valor.**
10. **Métricas de retención que le cortan pacientes al profesional** sin explicarle por qué.

---

## 21. Oportunidades concretas, en orden

1. **Lanzar.** Todo lo demás depende de cerrar la sección L. Selia no está enfocada en Argentina, y esa ventana
   no dura para siempre.
2. **Salir a buscar profesionales argentinos con la comparación de condiciones** (§10 contra lo de Vita). Es el
   diferencial más fuerte y el más fácil de comunicar. Una página de una hoja para profesionales.
3. **Posicionar a Vita en confianza**: matrícula verificada, reembolso claro, reseñas libres.
4. **Argentinos afuera** como segundo público: el riel ya existe; falta el mensaje (*"un psicólogo argentino, estés
   donde estés"*) y profesionales que acepten internacionales.
5. **Google en voseo** después del lanzamiento: tests y temas.
6. **Reintegro de prepagas**: averiguar qué piden y ayudar con eso.
7. **Paquetes y referidos** por los rieles donde Vita retiene plata.
8. **Empresas**, cuando haya usuarios y reseñas para mostrar.

---

## 22. Señales a vigilar

- Precios en **pesos** o **Mercado Pago** en `selia.co/latam/argentina`, o cobro en ARS dentro de su app.
- Búsquedas de **psicólogos argentinos** en su portal, o una alianza con un banco o prepaga argentina.
- **Prensa argentina**, una ronda de inversión nueva, o una campaña con influencers argentinos.
- Cambios en sus **términos de especialistas** (hoy versión 2.0 de 2026).
- Qué hace **Terapify** en Argentina.

Una forma barata de seguirlo: mirar la página argentina y el mapa del sitio de Selia una vez por mes.

---

## 23. Cómo comunicar Vita (lo que sale de todo esto)

> Agregado en la sesión 256, a pedido de Andre: *"aprender de sus fortalezas y errores
> para marcar nuestro camino, y para saber publicitarnos mejor"*. Las frases son
> **puntos de partida**, no copy final: pasan por la voz de Vita y por el abogado (L5)
> antes de publicarse.

### 23.1 El principio

**Selia vende escala y comodidad** ("+600 especialistas", "400.000 sesiones", "desde USD 25", descuentos
en todos lados). **Vita no puede competir en eso** (cero usuarios) **y no le conviene**: su ventaja es
**confianza y cercanía**. Todo lo que se diga tiene que poder verificarse en la app el mismo día.

Tres ideas madre, en este orden:
1. **Sabés con quién hablás.** Matrícula revisada por una persona; en el catálogo, "Psicólogo" solo con matrícula verificada.
2. **Reglas claras con tu plata.** Pesos, Mercado Pago, reembolso si cancelás a tiempo, garantía de la primera sesión.
3. **Hecha acá, para acá.** Voseo, profesionales argentinos, las líneas de ayuda de acá.

### 23.2 Por público

**a) La persona en Argentina que busca acompañamiento**

| Qué le preocupa | Qué decir | Respaldo en Vita |
|---|---|---|
| "¿Y si no es un profesional de verdad?" | *Cada matrícula la revisa una persona antes de que aparezca.* | Credenciales verificadas a mano; `has_matricula`. ⚠️ No decir "si dice psicólogo, lo es": la marca dice que hay matrícula verificada, no de qué profesión (falta un campo estructurado) |
| "¿Y si no me gusta?" | *Si tu primera sesión no te sirvió, te devolvemos la plata.* | T&C §9.3 (48 h, una vez por persona) |
| "¿Y si me surge algo?" | *Cancelá con 24 horas y te devolvemos todo.* | T&C §9.1, reembolso automático |
| "¿Cuánto me sale y cómo pago?" | *En pesos, con Mercado Pago. El precio lo ves antes de reservar.* | Checkout de MP; precio en el perfil |
| "No sé por dónde empezar" | *Contanos qué te pasa y te mostramos con quién hablar.* | Quiz y puertas por tema |

Contraste con Selia, **sin nombrarla**: dólares, reglas que se quedan con tu saldo, "no podemos garantizar
las credenciales". La frase *"en pesos y con Mercado Pago"* ya marca la diferencia sola.

**b) El argentino que vive afuera**

Es donde Selia pone más fuerza ("latinos en el extranjero"). Vita no le gana en precio ni en tamaño. Le gana en
**algo que Selia no puede ofrecer: un profesional argentino**.
- *Un psicólogo argentino, estés donde estés.*
- *Hablá con alguien que entiende de dónde venís, sin traducir nada.*
- *Pagás desde afuera con PayPal o USDT.*

⚠️ Antes de usarlo: que haya **profesionales que acepten internacionales** en el catálogo, y revisar qué implica
atender a alguien en otro país con matrícula argentina (Selia lo tapa con un tilde; Vita tiene que decirlo claro).

**c) El profesional (psicólogo, coach, nutricionista)**

El público donde la comparación con Selia es **más fuerte** (§10). Lo que dicen sus términos, al revés:

| Selia | Vita, dicho en una frase |
|---|---|
| El precio lo fija la plataforma | *Tu precio lo ponés vos.* |
| Cobra y te paga semanal a mensual | *Cobrás en tu propia cuenta de Mercado Pago.* |
| Comisión privada, cambiable, posible tarifa de registro | *Sin costo de alta. Comisión publicada: 20% en la primera sesión con alguien nuevo, 15% después.* ⚠️ Hoy no se cobra alta, pero los T&C no lo dicen: escribirlo antes de prometerlo |
| Prohibido traer y llevarte pacientes, 12 meses de no competencia | *¿Ya tenés pacientes? Traelos con tu link: la primera sesión no paga comisión.* |
| Te descuenta reembolsos, te corta pacientes por métricas | *Si hay un problema, lo revisa una persona y te avisamos por qué.* |

Frase madre para profesionales: *"Te cobramos por presentarte a alguien nuevo, no por la relación que construís
después."* (ya usada con coaches; memoria de pagos).

⚠️ La promo fundador (0%) tiene fecha de fin sin definir: no anunciarla hasta tenerla.

### 23.3 Dónde aparecer (lo que a Selia le funciona, a escala de dos personas)

| Canal | Qué hace Selia | Versión Vita |
|---|---|---|
| Google | miles de páginas, tests, temas | **Pocas páginas, bien hechas, en voseo**: "psicólogo online en pesos", "cuánto cuesta un psicólogo online en Argentina", 2 o 3 tests (ansiedad, ánimo) que terminen en el quiz, con derivación a ayuda si el resultado es alto |
| Profesionales como canal | los usa como oferta, les prohíbe traer gente | **El link de cada profesional** es el canal: cada uno que se suma trae a sus pacientes y los muestra en sus redes |
| Alianzas | banco (Falabella), podcasts | Más adelante: podcasts y cuentas argentinas de salud mental, colegios profesionales |
| Referidos | 50% al amigo | Después del lanzamiento, pagado de la comisión de Vita |
| Campañas por fecha | mes de prevención del suicidio, el Mundial | Fechas argentinas, con cuidado: nunca usar crisis o suicidio para vender |
| Reseñas | publica cada reseña como página | Cuando haya reseñas reales. **Nunca inventarlas** (las 24 de prueba se borran en L8) |

### 23.4 Qué no decir (errores de Selia que no hay que repetir)

1. **Números que no tenemos.** Nada de "+X profesionales" o "miles de sesiones" hasta que sean reales.
2. **"Certificados" o "verificados" en general.** Decir exactamente qué se revisó: la matrícula.
3. **"Terapia" o "psicólogo" para coaches.** La Ley 23.277 reserva el tratamiento a quien tiene matrícula; Vita
   ya lo separa en la app, la publicidad tiene que hacer lo mismo.
4. **Promesas de resultados** ("vas a sentirte mejor en 4 semanas", "sanar"). Vita guía, no diagnostica.
5. **Crisis como gancho comercial.** Selia pone un cupón de 50% en su página de prevención del suicidio; Vita no.
6. **Descuentos permanentes** como mensaje principal: acostumbran a no pagar precio lleno.
7. **Páginas o anuncios por país sin revisión local**, empezando por cualquier número de ayuda.
8. **Nombrar a Selia** en anuncios: es publicidad comparativa y la tiene que mirar el abogado. Decir lo propio
   alcanza ("en pesos", "matrícula revisada", "tu precio lo ponés vos").
9. **Mostrar la raya "—"** en textos públicos (regla de la casa).

### 23.5 Orden sugerido

1. **Antes de lanzar:** la página de una hoja para profesionales (§23.2 c). Es lo único que sirve sin usuarios: se
   usa para sumar profesionales, que a su vez traen gente con su link.
2. **Al lanzar:** la página de Vita con las tres ideas madre (§23.1) y las frases para la persona en Argentina.
3. **Después:** Google en voseo, el mensaje para argentinos afuera, referidos, alianzas.

---

## 24. Lo que dicen las reseñas (qué hicieron bien y qué mal, según sus usuarios)

> **Cómo se leyó:** las reseñas públicas de las tiendas, bajadas enteras el 17/09/2026.
> **138 reseñas con texto**: 78 de Google Play (Colombia) y 60 de la App Store (tiendas de
> Colombia y Estados Unidos, que es donde hay). Los números de estrellas son de las fichas.
> No es una encuesta: en las tiendas escribe el que está muy contento o muy enojado.

### 24.1 El dato que más dice: las dos tiendas no coinciden

| | App Store (CO) | Google Play (CO) |
|---|---|---|
| Nota | **4,3** | **3,7** |
| Calificaciones | 103 | 264 |
| 5 estrellas | mayoría | 129 (50%) |
| 1 estrella | pocas | **43 (17%)** |

En Play el reparto es **bimodal**: 129 personas ponen 5 y 43 ponen 1, y casi nadie queda en el medio
(30 de cuatro, 28 de tres, 28 de dos). Eso no es un producto mediocre: es un producto que a la mitad
le cambia la vida y a una sexta parte **no le funciona literalmente**. Los dos grupos no hablan de lo
mismo. Los de 5 hablan del servicio (el psicólogo, las herramientas). Los de 1 hablan de la app
(no carga, no puedo registrarme, no me devuelven la plata).

La brecha iOS/Android es la misma historia: **el Android de Selia está peor**. Nueve de las 78 reseñas
de Play dicen alguna versión de *"la instalé y me encontró una pantalla en blanco"*.

### 24.2 Qué hicieron bien (lo que la gente elogia sola, sin que se lo pregunten)

Ordenado por cuántas veces aparece:

1. **"Fácil de usar", "intuitiva", "sencilla".** Es lejos lo más repetido, unas 25 veces de 138. Es *la*
   promesa que Selia cumple. Aparece incluso en reseñas de 3 estrellas que se quejan de otra cosa.
2. **La calidad de los profesionales.** ~20 menciones. Y es notable que aparece **incluso dentro de las
   reseñas de 1 estrella**: *"Los especialistas son buenos, pero la aplicación es TERRIBLE"*. La gente
   separa al profesional de la plataforma.
3. **Encontrar al indicado.** ~12 menciones al catálogo, al test que orienta, al **video de presentación
   del especialista** y a los filtros. *"No tienen idea cuánto tiempo me costó encontrar a un terapeuta
   ideal para mí"*. El video de presentación se elogia por nombre.
4. **Agendar y pagar sin fricción.** ~8 menciones a que reservar y pagar es simple, y a poder ver la
   agenda del profesional en vez de coordinar por chat.
5. **Las herramientas entre sesiones.** ~8 menciones: meditaciones, el diario de emociones, los chequeos
   mensuales de bienestar, el material audiovisual. El **diario** se menciona con cariño (*"Excelente el
   diario"*, y alguien pide recordatorios para llenarlo).
6. **Los 15 minutos de orientación gratis.** Poco mencionado pero muy bien cuando aparece:
   *"Me regalaron 15 minutos de orientación y me conectaron con Mauricio (el mejor!)"*.
7. **La constancia.** Varias personas dicen que gracias a Selia **sostuvieron** la terapia en el tiempo,
   que es distinto de empezarla. *"La uso hace más de un año y continúo con la misma terapeuta"*.

**Lo que NADIE menciona: la IA.** Cero reseñas hablan de Lía, del resumen automático para el especialista
o de las notas de sesión. Selia invirtió ahí y sus usuarios no lo notan, o no les importa. Lo que sí
nombran es lo aburrido: que se entienda, que el psicólogo sea bueno, que agendar funcione.

### 24.3 Qué hicieron mal (por orden de daño)

**1. La puerta de entrada se rompe.** El problema más grave, porque mata al usuario antes de que pague.
~9 de 78 reseñas de Play: *"no se puede registrar"*, *"se quedó cargando, lo intenté más de 3 veces, la
desinstalé"*, *"me encontré con una hoja en blanco"*, *"no pasa del primer aviso"*. En iOS, el login con
Google que vuelve a la pantalla inicial. Cada una de esas es un 1 estrella público y una persona que
buscaba ayuda y se fue.

**2. La plata: reembolsos, cobros raros y "dinero canjeable".** Es el tema que genera las reseñas más
furiosas, las que usan la palabra **estafa**. Los patrones concretos:
- El especialista no se presenta o cancela y el reembolso no aparece, o tarda *"25 días hábiles"*.
- El reembolso no vuelve como plata sino como crédito dentro de la app: *"Cobran y luego te lo dan como
  'dinero canjeable' dentro de la app"*.
- Paquetes comprados que no se pueden usar ni devolver.
- *"una vez pagas ese dinero ya jamás regresará sin importar qué"*.

Esto es **exactamente** el reverso de lo que Vita ya decidió (cobro al reservar + reembolso claro). La
reseña de 1 estrella de Selia es el argumento de venta de Vita, escrito por sus propios clientes.

**3. La política de reagendar a 24 horas.** El tema más repetido en la App Store, con reseñas largas y
razonadas, no insultos. Dos versiones:
- *"que no deje reagendar 24 horas antes de la cita es horrible… con salud mental de por medio uno termina
  peor por esta situación"*. Piden 4 o 5 horas, aunque sea con cargo.
- La asimétrica, que es peor: **el especialista sí puede reagendar después de las 24 horas**, y lo hace a
  un horario que el paciente no puede. *"Pierdo mi dinero y tiempo… no el que le dé la gana"*. Dos personas
  cuentan lo mismo.

**4. La videollamada falla.** ~6 menciones repartidas en las dos tiendas: se cae el audio, no se ve la
cámara, la app se bloquea en mitad de la sesión, y una perla de soporte: *"confirmaron que no soportan
audífonos bluetooth"*. Varios terminan pasándose a WhatsApp o Meet, que es fuga del marketplace por
falla técnica.

**5. La sesión (el login) se cierra sola.** Aparece en las dos tiendas y el comentario que lo explica mejor
es este: *"la sesión se cierra cada poco tiempo, y en estados de ansiedad o depresión donde se busca
atención rápida, eso es una gran barrera pues no hay mente para recordar correos o contraseña"*.

**6. El soporte.** *"escalan el caso a un área imaginaria, pues nunca vuelven a responder"*, *"en servicio
al cliente son súper groseros"*, *"no he podido contactar a servicio al cliente"*. El patrón: cuando algo
falla, no hay a quién agarrar. Eso convierte un problema chico en una reseña de 1 estrella.

**7. Profesionales que no se presentan o cancelan sobre la hora.** ~5 menciones. *"no asistió el
especialista a la primera cita… Parece SCAM"*. Con 600 profesionales, la calidad promedio es buena pero
la cola es larga, y el que cae en la cola escribe.

**8. El precio, y sobre todo cómo se comunica.** ~5 menciones. No es solo que sea caro (*"¿quién no tiene
los recursos para pagar los 170.000?"*). Es el **desajuste de expectativa**: dos personas dicen que
llegaron por un podcast que la presentaba como *"ayuda humanizada y al servicio de la comunidad"* y se
encontraron con precios de consultorio privado. Otra: *"Mienten con el precio"*. Y otra pide convenios
con prepagas, que no hay.

**9. Rediseños que empeoran.** *"Me gustaba mucho la experiencia anterior, esta nueva actualización me
parece menos amigable y me cuesta más encontrar las opciones por los colores que se manejan"*, *"Terrible
recent update, super slow"*.

**10. Detalles que igual duelen.** No se pueden descargar los archivos que manda el terapeuta por el chat
(hay que abrir la web). Nadie atiende fines de semana. Llamadas y mensajes **de madrugada** recordando
pagos que ni siquiera vencieron. Y una observación de fondo: *"la mayoría de los especialistas son muy
jóvenes, todos egresados de la Universidad de los Andes"*.

### 24.4 Qué se lleva Vita de esto

**Lo que hay que copiar sin vergüenza:**
- **La simplicidad es el producto.** Lo que la gente elogia no es una feature, es no tener que pensar.
  Si Vita agrega algo que complica agendar, está perdiendo la única batalla que Selia ganó.
- **El video de presentación del especialista.** Se elogia por nombre y resuelve el problema real de
  elegir. Es barato de hacer y ya está en el radar de §19.
- **El diario y los chequeos de bienestar** sostienen la relación entre sesiones. Alguien pidió
  recordatorio para el diario: ese es un pedido gratis, ya validado.
- **La orientación gratis de 15 minutos** convierte, y la gente la agradece.

**Lo que hay que evitar, que es donde está la oportunidad:**
- **El registro tiene que funcionar en Android viejo y con poca señal.** El 17% de 1 estrella de Selia
  es, en buena parte, gente que nunca entró. Vale más que cualquier feature.
- **Reembolso en plata, a la tarjeta, con plazo escrito.** Nunca crédito interno. Esto ya es la decisión
  de Vita: ahora hay que **decirlo** en la página, porque es el dolor número uno del competidor.
- **Reagendar simétrico y humano.** Si el profesional reagenda, el usuario elige el nuevo horario entre
  los disponibles, o se le devuelve la plata. Y la ventana del usuario no puede ser de 24 horas rígidas.
- **Que la sesión no se cierre sola.** Nadie en crisis se acuerda de la contraseña.
- **Un soporte con cara.** No hace falta un call center: hace falta que alguien responda y que se note
  que es una persona. Con cero usuarios, Andre puede responder él.
- **La videollamada tiene que aguantar**, incluida la salida de audio por bluetooth, que es como escucha
  la mitad de la gente.
- **Decir el precio antes.** El daño no lo hace el precio: lo hace enterarse tarde.

**La frase que resume todo**, dicha por un usuario de 1 estrella de Selia:
*"Los especialistas son buenos, pero la aplicación es TERRIBLE… Al final es un negocio donde ellos nunca
pierden y tú no importas como cliente."*
Ese es el hueco. No es de features: es de **trato cuando algo sale mal**.

---

## Lo que no se pudo ver

- **Cuánto se queda Selia de cada sesión**: la comisión va en una propuesta privada por mail.
- **El orden exacto de las pantallas** y a quién se le muestra cada una: sale de los textos, no de usar la app.
- **Cómo verifica credenciales** en la práctica.
- Reseñas de empleados en Glassdoor y Computrabajo (bloqueados). Las de Google Play y App Store sí se leyeron: ver §24.
- Facturación o inversión de 2025–2026: no hay publicaciones.

---

## Correcciones a versiones anteriores

- **Sesión 252:** decía que no había profesionales argentinos a la vista (hay al menos una) y que la línea de crisis
  argentina estaba mal en general (solo en la landing; la página de líneas está bien).
- **Sesión 254:** decía que el precio lo fija el especialista. **Lo fija Selia** (términos de especialistas §2.3.4).
  Decía que Selia "no tiene nada" para el profesional que trae a sus pacientes: en realidad **se lo prohíbe**. Y que
  los términos estaban "leídos completos": se leyeron las cláusulas clave, que es lo que sigue siendo cierto.

---

## Fuentes

**Selia, páginas públicas:**
[Inicio](https://www.selia.co/) ·
[Argentina](https://www.selia.co/latam/argentina) ·
[Costos](https://www.selia.co/terapia-online-costo) ·
[Costos México](https://www.selia.co/mx/terapia-online-costo) ·
[Preguntas frecuentes](https://www.selia.co/faq) ·
[Tu Match](https://www.selia.co/tu-match) ·
[Programas](https://www.selia.co/programs) ·
[Programa Tusa](https://www.selia.co/programs/programa-tusa) ·
[Tests](https://www.selia.co/tests) ·
[Psiquiatría](https://www.selia.co/services/psiquiatria) ·
[Nutrición](https://www.selia.co/services/nutricion) ·
[Tarjetas de regalo](https://www.selia.co/tarjetas-regalo) ·
[Alianzas](https://www.selia.co/alianzas) ·
[Falabella](https://www.selia.co/alianzas/falabella) ·
[Latinos en EE.UU.](https://www.selia.co/latinos-en-el-extranjero/estados-unidos) ·
[Por si acaso](https://www.selia.co/por-si-acaso) ·
[Líneas de emergencia](https://www.selia.co/hotlines) ·
[Opiniones](https://www.selia.co/opiniones) ·
[Empresas México](https://www.selia.co/mx/empresas) ·
[Casos de éxito](https://www.selia.co/empresas/casos-de-exito) ·
[Reto de 10 días](https://www.selia.co/herramientas/reto-bienestar-10-dias) ·
[Home B (prueba A/B)](https://www.selia.co/home-test/home-b) ·
[Para especialistas](https://www.selia.co/for-specialists) ·
[Postulaciones](https://aplicaciones.selia.co/) ·
[Mapa del sitio](https://www.selia.co/sitemap.xml)

**Selia, producto y contratos:**
[App web](https://app.selia.co/) (versión 2.13.98, textos extraídos el 17/09/2026) ·
[Términos de usuarios (PDF, 28/11/2023)](https://s3.amazonaws.com/assets.selia.co/terms_and_conditions_users.pdf) ·
[Términos de especialistas (PDF, v2.0 2026)](https://s3.amazonaws.com/assets.selia.co/terms_and_conditions_specialists.pdf) ·
[App Store](https://apps.apple.com/co/app/selia-bienestar-mental/id1587213440) ·
[Perfil Cecilia Carranza (Argentina)](https://www.selia.co/terapeutas-psicologos-en-linea/cecilia-carranza) ·
[Perfil Valentina Maya (Colombia)](https://www.selia.co/terapeutas-psicologos-en-linea/valentina-maya)

**Prensa y bases:**
[Y Combinator](https://www.ycombinator.com/companies/selia) ·
[Startups Latam](https://startupslatam.com/bad-bunny-invirtio-en-ella-conoce-a-la-mental-healthtech-selia/) ·
[Contxto (29/12/2023)](https://contxto.com/en/artificial-intelligence/selia-hits-100k-virtual-therapies-eyes-2m-revenue-in-2023/) ·
[El Colombiano (12/01/2024)](https://www.elcolombiano.com/negocios/empresas/selia-la-app-de-salud-mental-que-ya-factura-us-2-millones-CG23520552) ·
[Yahoo Finanzas / Valora Analitik (27/07/2024)](https://es-us.finanzas.yahoo.com/noticias/plataforma-salud-mental-selia-inyectado-010000188.html) ·
[Portafolio](https://www.portafolio.co/emprendimiento/plataforma-selia-ampliara-su-radio-de-accion-tras-una-inyeccion-de-us-300-000-592382) ·
[La República](https://www.larepublica.co/salud-ejecutiva/las-principales-startups-en-america-latina-que-se-enfocan-en-atender-la-salud-mental-3910814)

**Mercado argentino:**
[Tu Terapia, precios 2026](https://www.tuterapia.com.ar/blog/cuanto-cuesta-un-psicologo-online-en-argentina-en-2026/) ·
[Psyred, precios 2026](https://psyred.org/cuanto-cuesta-un-psicologo/argentina/) ·
[Terapify, unirse como psicólogo](https://terapify.reamaze.com/kb/soy-terapeuta/unirme-a-terapify-como-psicologo)
