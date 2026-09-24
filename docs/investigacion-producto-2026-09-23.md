# Vita: qué falta y qué conviene cambiar antes de publicar

Investigación del 23 de septiembre de 2026. Revisión del código local hasta `ac14d4a0`, documentación del proyecto y fuentes públicas de Selia y Terapify consultadas en esta fecha. No se modificó la app durante esta investigación.

**Conclusión:** Vita ya cubre gran parte del recorrido principal. La inversión más útil ahora es hacer confiable y comprensible el servicio completo: saber con quién reservás, qué pasa con tu pago, cómo pedir ayuda y cómo continuar después. Agregar más funciones antes de observar a personas usando ese recorrido tendría menos fundamento.

Todos los coaches, usuarios, recursos y transacciones actuales son de prueba, según lo aclarado por Andre. No se tomaron como profesionales reales, demanda comprobada, reseñas auténticas ni evidencia de pérdidas de clientes. Tenerlos durante el desarrollo es normal; su retiro corresponde al paso previo a abrir al público.

**Qué pude comprobar y qué sigue siendo una hipótesis**

Leí las rutas y partes relevantes del código de entrada, perfiles, selección, reservas, sala, reseñas, analítica, contacto y devoluciones. Contrasté el estado con el registro de pendientes. Esta es una investigación de producto basada en código y fuentes públicas: no reemplaza una prueba completa de la última build en iPhone y Android, entrevistas ni una auditoría completa nueva. La landing pública de Vita no respondió a la herramienta de navegación; para ella revisé el código local, sin dar por confirmado su estado desplegado.

Las recomendaciones de interfaz se presentan como hipótesis para probar. Los problemas de implementación identificados se señalan por separado. Las fuentes comerciales de competidores describen lo que anuncian, no una certificación independiente de cómo funciona cada servicio.

**La comparación anterior necesita actualizarse**

La investigación de Selia del 17/09 ya no describe bien varias capacidades actuales de Vita:

| Capacidad | Evidencia actual de Vita | Decisión |
|---|---|---|
| Recomendaciones explicadas y alternativas | `screens/QuizScreen.tsx`, `lib/quizMatch.ts` | Ya existe; probar comprensión y calidad con perfiles reales. |
| Solicitar aviso de disponibilidad | `availability_waitlist`, función `availability-notices`, documentación M3 | Ya construida; validar recorrido visible. |
| Mover sesiones y aceptar propuestas del profesional | Sala, calendario y reservas; M15/M16 | Ya existe; probarlo desde ambos roles y en distintos plazos. |
| Garantía solicitada desde la app | `screens/SalaScreen.tsx:653`, función `guarantee-claim` | Ya existe; mejorar visibilidad del seguimiento. |
| Próxima sesión sugerida | `lib/proximaSesion.ts`, tarjeta de cierre | Ya existe; medir si ayuda a volver. |
| Referidos | Registro, `lib/referidos.ts`, checkout | Ya existe en el circuito documentado de MP; los enlaces y la cobertura por proveedor necesitan verificación. |
| Preparar la sesión | `app/paquete.tsx`, `lib/paquete.ts` | Ya existe; no construir otro resumen paralelo. |
| IA acotada | `supabase/functions/weekly-reflection/index.ts` y Sofía | La frase «Vita no tiene IA» está desactualizada. No equivale a un chat terapéutico. |

Selia anuncia matching explicado, alternativas y orientación; son referencias útiles para evaluar claridad. Terapify también presenta matching, materiales entre sesiones y garantía. Varias de estas funciones ya son parte de Vita. [Selia: preguntas frecuentes](https://www.selia.co/faq), [Terapify](https://www.terapify.com/).

## Cambios prioritarios

**1. Definir con precisión la profesión y qué se verificó. Antes del primer profesional real.**

Hallazgo confirmado: `lib/tipoProfesional.ts:33` decide entre psicólogo, nutricionista y coach usando palabras de `specialty` y un indicador genérico de matrícula. El propio archivo describe la limitación: una matrícula de una profesión no demuestra otra. Además, la ficha muestra «Verificado por Vita» (`screens/ProfesionalScreen.tsx:363`), una etiqueta más amplia que la información que representa.

Propuesta: guardar profesión como dato estructurado, vincular la credencial revisada con esa profesión y mostrar qué se comprobó. El perfil debe explicar cómo trabaja esa persona y qué servicio ofrece. Antes de publicarlo, comprobar además precio, medio de cobro, disponibilidad y presentación.

Criterio de aceptación: escribir «psicología» en una descripción no cambia la categoría profesional; una credencial de nutrición no habilita una categoría de psicología. Esto es prevención para el alta futura, no una acusación sobre los perfiles ficticios actuales. Esfuerzo estimado: medio.

**2. Dar una salida clara cuando la sesión falla. Antes de abrir.**

Hallazgo confirmado: ante un fallo al preparar o abrir la videollamada, `screens/SalaScreen.tsx:788` ofrece un aviso para reintentar. El contacto central existe en `lib/contacto.ts:15`, pero no encontré un acceso general a soporte en la configuración del usuario revisada. Por otra parte, `screens/ReviewScreen.tsx:127` exige estrellas del profesional antes de guardar; la opinión técnica se guarda después de la reseña. Quien no pudo entrar necesita reportarlo sin calificar una atención que no recibió.

Propuesta mínima: «Tengo un problema con esta sesión» junto a la reserva, utilizable antes y después del horario. Ofrecer motivos concretos: no puedo entrar, no se escucha, el profesional no llegó, problema con el cobro. Adjuntar el identificador de reserva y el estado técnico necesario; no el diario ni el contenido del chat. Mostrar recepción del caso, responsable y un plazo de respuesta que el equipo pueda cumplir. Una bandeja simple puede ser suficiente; no hace falta soporte 24/7.

Las reseñas consultadas de Selia incluyen fallos de cámara, audio y acceso, incluso de personas satisfechas con sus profesionales. Son ejemplos cualitativos, no una medida de la frecuencia de fallos ni prueba de que todas esas versiones sigan fallando. Selia publica, además, canales y horario de soporte. [Reseñas de Selia en App Store](https://apps.apple.com/co/app/selia-bienestar-mental/id1587213440), [Contacto de Selia](https://www.selia.co/contacto).

Criterio de aceptación: una persona que no logró entrar puede dejar un reporte privado sin dar estrellas al profesional y sabe dónde volver a ver la respuesta. Esfuerzo: medio.

**3. Mostrar el estado del dinero en un lugar estable. Antes de abrir, en versión mínima.**

El circuito de pagos y reembolsos existe. La brecha encontrada es su visibilidad para el usuario: no encontré una pantalla general de historial de pagos/devoluciones en las rutas y pantallas revisadas. `screens/SessionsScreen.tsx:260` contempla el caso específico de una devolución USDT que necesita dirección, pero eso no sustituye un seguimiento general para MP y PayPal.

Propuesta: un detalle accesible desde la sesión, con importe, moneda, proveedor, estado del pago y, si corresponde, estado de devolución. Diferenciar «solicitada», «en proceso» y «confirmada por el proveedor», sin prometer que el banco ya acreditó el dinero. Agregar cómo pedir ayuda. Un comprobante de pago no debe presentarse como factura.

Criterio de aceptación: después de cancelar, la persona puede cerrar y volver a abrir la app y entender dónde está su devolución. El dato debe venir del servidor. Esfuerzo: medio. Confianza en la brecha: media-alta; falta comprobar todas las variantes visuales de la build final.

**4. Corregir qué se mide y detectar errores que ocurren fuera de nuestros teléfonos. Antes de la beta.**

Hallazgo confirmado: `screens/BookingScreen_Confirm.tsx:531` emite `reserva_confirmada` inmediatamente después de insertar la reserva, antes de iniciar el checkout. Ese evento puede registrar una operación que luego nunca se paga. No debe usarse como conversión a reserva efectivamente confirmada.

Ya hay analítica en `lib/analytics.ts`; no hace falta comenzar de cero. Separar solicitud creada, checkout iniciado, pago aprobado y reserva confirmada. El pago debe comprobarse con registros del servidor y no depender de que la persona vuelva a la app. Para evitar duplicados, vincular los eventos a la reserva y a la transición real.

Además, `lib/logging.ts:1` conserva errores en memoria y consola. No encontré en esa implementación un envío central de esos errores del cliente. Conviene una captura mínima de fallos de entrada, pago y sala con versión, plataforma y código de error, excluyendo textos personales y credenciales.

Criterio de aceptación: abandonar el checkout no cuenta como reserva confirmada; un pago aprobado con la app cerrada sí aparece en la medición. Esfuerzo: bajo a medio.

**5. Validar el recorrido con personas ajenas al desarrollo. Antes de la apertura pública.**

La falta de usuarios reales no es un defecto del código: significa que aún no sabemos qué se entiende, dónde se duda y qué se valora. La próxima evidencia útil puede venir de una beta pequeña, voluntaria, con tareas de prueba y sin exigir que nadie cuente problemas personales.

Propuesta inicial: 5–8 personas para detectar problemas de comprensión, y 2–3 profesionales para evaluar su lado del flujo. Es una muestra cualitativa propuesta, no suficiente para estimar conversión comercial. Probar en una build instalada de iOS y Android; algunas capacidades nativas no se comprueban en Expo Go.

Criterio de aceptación: cada problema crítico se reproduce, se corrige y se vuelve a probar. La cantidad de tests automáticos no reemplaza este recorrido. No hay promesa de «riesgo cero» por aprobarlo.

**6. Conectar bien los enlaces con la app instalada. Al preparar la publicación.**

El proyecto documenta L56 y el `app.json` revisado no declara los dominios asociados ni los filtros de enlaces correspondientes. El link del profesional puede llevar al checkout web aunque la app esté instalada, obligando a identificarse otra vez. El referido compartido también necesita un destino claro.

Propuesta: implementar y probar los enlaces al perfil del profesional y a la reserva, respetando la sesión existente. Mantener el camino web cuando no está instalada. Conservar la decisión ya tomada de poder escribir el código de referido: no hace falta incorporar identificación del dispositivo para perseguirlo a través de la instalación.

Criterio de aceptación: un enlace abre el mismo profesional en iPhone, Android y web, sin perder el destino durante el ingreso. Esfuerzo: medio; depende de la configuración de distribución.

**7. Probar si el lenguaje de entrada comunica la propuesta. Hipótesis para la beta.**

La bifurcación dice «Quiero crecer» y su descripción habla de herramientas (`screens/OnboardingBifurcacion.tsx:158`). Alguien que llegó buscando reservar con un profesional podría no reconocer de inmediato su camino. Eso es una hipótesis, no evidencia de que haya que rediseñar toda la entrada.

Propuesta: probar una descripción que incluya explícitamente «Encontrar un profesional o usar herramientas para mí». Mantener la cuenta al entrar, que es una decisión existente del producto. Observar también si las personas encuentran su reserva bajo «Mensajes» sin recibir instrucciones.

Criterio de aceptación propuesto: la mayoría de los participantes identifica su camino y su próxima sesión en el primer intento; registrar las dudas antes de cambiar navegación o nombres. Esfuerzo: bajo.

**8. Mejorar continuidad con lo que ya existe. Primer mes, según uso.**

Vita ya tiene diario, recursos, preparación y sugerencia de próxima sesión. Una mejora acotada sería un recordatorio opcional del diario, reutilizando el motor de recordatorios existente. En `app/diario.tsx` no encontré ese enlace; el pendiente M17 coincide.

Antes de sumar programas largos, observar si la persona encuentra el recurso que le dejó su profesional y puede llevar una nota a la siguiente sesión. Evitar aumentar notificaciones por defecto.

Criterio de aceptación: la persona elige horario, puede apagar el recordatorio y no recibe contenido sensible en la pantalla bloqueada. Esfuerzo: bajo a medio. Prioridad posterior al recorrido de reserva y sesión.

## Lo que falta fuera del código

La apertura necesita una oferta real suficiente para lo que se anuncie. Recomiendo empezar con pocos profesionales, bien presentados y con turnos verificables, en lugar de publicitar toda combinación de tema, presupuesto y horario. Los perfiles de prueba no sirven para juzgar esa cobertura. No propongo borrarlos durante la investigación: el retiro debe formar parte del procedimiento de lanzamiento, preservando las cuentas de revisión necesarias.

La documentación aún marca revisión legal pendiente, y `constants/legal.ts:511` mantiene `LEGAL_IS_DRAFT = true`. Esto requiere reconciliar el texto con las reglas finales del producto y completar la revisión indicada por el proyecto. No hice una revisión jurídica ni fiscal en esta investigación.

El acceso a ayuda urgente ya existe, pero el registro L14 todavía distingue entre tener la pantalla y encontrarla fácilmente. En la beta debe comprobarse que sea accesible sin depender de una detección de Sofía y sin confundirla con soporte técnico. Revisar también lectura con texto grande y el recorrido crítico con VoiceOver/TalkBack.

## Qué no priorizaría ahora

- Otro chat de IA o transcripción automática: la necesidad de preparar la sesión ya tiene una solución en Vita; primero comprobar si se usa.
- Paquetes, billetera y gift cards: agregan decisiones de cobro, devoluciones y operación. Investigar demanda después de comprobar que la gente vuelve.
- Empresas, menores, familias y grupos: respetar las decisiones de alcance ya registradas; son líneas de servicio adicionales.
- Una biblioteca enorme de contenido: empezar con recursos útiles, revisados y conectados con lo que el profesional recomienda.
- Descuentos grandes permanentes: no hay evidencia de Vita que justifique usarlos como motor principal.
- Un rediseño general por parecerse a Selia: las dudas de uso deben decidir qué pantallas cambiar.

La orientación humana de Selia no se recomienda automáticamente para Vita: el proyecto ya la descartó por capacidad operativa. Tampoco tomo la ausencia de menciones a IA en la muestra vieja de reseñas como prueba de que a nadie le importe.

## Diferenciación que sí puede sostenerse

Conviene vender una experiencia que se pueda verificar: entender quién atiende, cuánto se paga, qué pasa al cambiar de horario y cómo se responde ante un problema. La página argentina de Selia ya anuncia especialistas argentinos y latinos, de modo que «tener profesionales argentinos» por sí solo no es una exclusividad defendible. También anuncia sesiones desde USD 35 y paquetes; son precios publicados, no una comparación de checkout completada. [Selia en Argentina](https://www.selia.co/latam/argentina).

La ventaja potencial de Vita está en ejecutar bien sus reglas y su experiencia local. El pago en pesos, la claridad de condiciones, las credenciales precisas y el acompañamiento entre sesiones pueden respaldarla cuando estén disponibles con profesionales reales. No usaría cifras, reseñas ni resultados de las cuentas de prueba para comunicarla.

## Prueba concreta para decidir qué construir después

| Tarea de la beta | Qué observar | Cuándo la consideraría aprobada |
|---|---|---|
| Entrar por primera vez con mail, Google o Apple | Dudas, retornos, errores y pérdida del destino | Puede ingresar sin ayuda del equipo. |
| Encontrar un profesional con presupuesto y horario determinados | Comprensión del perfil, precio y alternativas | Elige explicando por qué y entiende cuando no hay coincidencia. |
| Crear una reserva de prueba y abandonar el pago | Estado que se muestra después | No interpreta que tiene una sesión confirmada. |
| Completar un pago de prueba por un medio habilitado y volver | Persistencia y claridad de confirmación | Importe y estado coinciden entre los dos roles. |
| Mover la sesión desde cada rol | Visibilidad del menú y aceptación | Ambos entienden qué horario quedó vigente. |
| Entrar a la sala; repetir con permiso denegado o conexión deficiente | Posibilidad de recuperar o reportar el problema | Hay una salida comprensible sin calificar al profesional. |
| Cancelar y consultar la devolución | Información disponible tras reabrir | Puede localizar el estado y pedir ayuda. |
| Preparar y reservar la siguiente sesión | Descubrimiento del material y de la sugerencia | Encuentra lo compartido y sabe cómo continuar. |

Medir primero: ingreso completado, primera reserva efectivamente pagada, entrada de ambos participantes a la llamada, incidencias, devoluciones pendientes y segunda sesión. Definir siempre el denominador y el período. Con la beta pequeña, usar esas observaciones para detectar fallos; no proyectarlas como tasas de mercado.

**Orden recomendado:** aclarar profesión/verificación → soporte ligado a la sesión → estado del dinero → medición fiable → beta cerrada → resolver sus fallos → apertura acotada. Los enlaces de la app se preparan con la distribución. El diario y otras mejoras de continuidad se priorizan con el uso observado.

**Límites pendientes:** no se entrevistó a usuarios ni profesionales, no se completaron compras en competidores, no se revisaron sus apps detrás del registro, no se validaron todos los estados visuales de la build actual y no se actualizaron precios comparables por cada profesional. Las reseñas públicas son autoseleccionadas y algunas describen versiones anteriores. El informe permite ordenar trabajo; no demuestra todavía qué función aumentará la conversión de Vita.
