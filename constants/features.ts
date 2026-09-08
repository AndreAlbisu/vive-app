// Flags de features. Se leen en tiempo de build (Expo inlinea las
// `EXPO_PUBLIC_*`), así que cambiarlas pide recargar la app, no un deploy.

/**
 * ¿La devolución de la tarjeta "Sobre vos" la redacta un modelo?
 *
 * ✅ **ENCENDIDA el 04/09/2026**, sin consulta paga. El análisis está en
 * `docs/transferencias-internacionales.md` §5 bis y se resume así: **al proveedor
 * no le llega ningún identificador ni seudónimo**, y nada se almacena que ligue
 * una llamada con una persona — pasada la llamada, ni Vita puede reconstruir de
 * quién era. La Ley 25.326 art. 2 define dato personal como el referido a
 * personas *determinadas o determinables*; una etiqueta de categoría y tres
 * enteros no describen a nadie determinable, así que el art. 12 no se activa.
 *
 * Declarado igualmente en Política §6 y §7 — no porque haga falta, sino porque
 * es honesto y porque si alguien discute el encuadre, haber declarado juega a
 * favor.
 *
 * 🔴 **ESTO NO HABILITA MANDAR MÁS DATOS.** El §5 bis de `la-voz-de-sofia.md`
 * propone enviar la forma de los días ("hoy bajón, ayer bajón, anteayer bien").
 * Una secuencia larga empieza a singularizar y el contenido pasa a ser
 * inequívocamente sobre la salud de alguien: **las dos patas del análisis se
 * caen**. Es otra decisión y pide otro análisis. Si estás por agregar campos al
 * `facts` que se manda, pará y leé esa sección primero.
 *
 * 📌 Pendiente y recomendado, aunque no bloquea: **pedirle retención cero a
 * Anthropic**. No hace falta para el encuadre —si no es dato personal, cuánto se
 * guarda es indiferente— pero elimina el único punto donde el contenido persiste
 * y abarata el escenario en que alguien lea el encuadre distinto.
 *
 * ⚠️ **Lo que este flag NO protege (chequeo del 01/09/2026).** Tenerlo apagado
 * evita una transferencia anónima de tres enteros. Las transferencias grandes
 * —ánimo, diario, gratitud y mensajes a Supabase, video a Daily, push a Expo,
 * todos en EEUU, que no está en la lista de países adecuados de la AAIP—
 * ocurren igual, con o sin IA. El pendiente real es el instrumento de esas
 * transferencias (pregunta A.3 de `docs/paquete-abogado.md`), y este flag no
 * tiene nada que ver con él. No leas este `false` como "estamos cubiertos".
 *
 * Con esto en `false` la app usa el texto determinístico de
 * `lib/weeklyReflection.ts`, que es igual el piso cuando no hay red o el
 * modelo falla. Encenderlo no reemplaza nada: cambia quién redacta.
 *
 * Hay un segundo interruptor del lado del servidor: sin `ANTHROPIC_API_KEY`,
 * la edge function devuelve 503 y el cliente cae a las reglas igual.
 */
export const AI_REFLECTION_ENABLED =
  process.env.EXPO_PUBLIC_AI_REFLECTION === 'true';

/**
 * ¿La tarjeta "Sobre vos" muestra el **piso de seguridad**?
 *
 * Es el punto donde deja de hacer de amigo: cuando alguien viene registrando el
 * fondo, una voz cálida no alcanza y no puede simular que sí
 * (`docs/la-voz-de-sofia.md` §5 ter).
 *
 * ✅ **ENCENDIDO el 07/09/2026, sin la revisión profesional, y con el motivo
 * escrito porque la decisión es discutible.**
 *
 * 🔴 **El contrafáctico no era "un texto revisado": era NADA.** Se le pidió la
 * revisión a Mónica Grando y no hubo respuesta. Con el flag apagado, quien lleva
 * dos semanas registrando el fondo recibe una tarjeta cálida y **ninguna mención
 * de que existe ayuda**, teniendo `/ayuda` construida con los números de T&C
 * §5.3 verificados. Esperar indefinidamente una revisión que puede no llegar, con
 * la red apagada mientras tanto, es peor que una frase imperfecta pero fundada.
 *
 * **Y desde el 07/09 la frase está fundada, que es lo que faltaba.**
 * `la-voz-de-sofia.md` §2 ter (la personalidad de Sofía, contada por Andre): ella
 * aligeraba el golpe en lo común, **pero en situaciones serias daba su opinión
 * 100% transparente**. El piso es, por definición, una situación seria — así que
 * ahí no se aligera. La frase directa, sin variantes por día y sin suavizantes,
 * resulta correcta **por principio y no por intuición**.
 *
 * 📌 **Y se arregló lo que la revisión no habría visto**, porque no era del
 * texto: la tarjeta **nombraba el límite y no abría ninguna puerta**. Tocarla
 * abría el momento a pantalla completa con "Seguir" y "Ver mi progreso completo".
 * Ahora va a `/ayuda` y el CTA dice a dónde va. Encender sin ese arreglo habría
 * shippeado el modo de falla exacto que el piso viene a evitar.
 *
 * ⚠️ **El pedido a Mónica sigue abierto y ahora es más barato:** tiene el texto
 * escrito para corregir, en vez de una consigna para redactar. Corregir son dos
 * minutos; redactar es tarea, y puede ser por eso que no contestó. **Y no tiene
 * que ser ella**: que una persona esté ocupada no puede tener de rehén una
 * salvaguarda.
 *
 * 📝 Estuvo en `false` desde el 04/09 con este motivo, que se deja como historia:
 * La maquinaria está entera y testeada —`lib/pisoSeguridad.ts` decide cuándo, y
 * `buildReflection` tiene la rama arriba de todo—, pero lo que se muestra es la
 * única frase de la app donde equivocarse sale caro de verdad. El umbral lo
 * podemos decidir nosotros (y está justificado en el encabezado de
 * `pisoSeguridad.ts`); el texto no.
 *
 * ✅ **La pantalla de las líneas ya existe** (`/ayuda`, 04/09/2026), con los
 * números de T&C §5.3 tocables. Al construirla apareció que no dependía de la
 * revisión del texto —los números ya están escritos y verificados en los T&C—,
 * así que se separó de este flag. **Queda una sola cosa pendiente, y es un
 * mail.**
 *
 * A diferencia de `AI_REFLECTION_ENABLED`, este flag NO espera nada legal:
 * espera una revisión de contenido y una pantalla.
 */
export const SAFETY_FLOOR_ENABLED = true;
