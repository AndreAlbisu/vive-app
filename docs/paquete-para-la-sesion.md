# El paquete para la sesión — propuesta

> 26/08/2026. Idea de Andre, después de consultarle a una psicóloga. **Nada de
> esto está implementado.** Reemplaza el enfoque de `docs/animo-compartido.md`
> en su parte central — ver §7.

## 1. Qué es

Antes de una sesión, la persona **arma un paquete** con lo que registró desde la
última vez —sus check-ins de ánimo, una nota suya, y opcionalmente entradas de
su diario que elija una por una— lo revisa, y se lo manda a su profesional por
el chat.

No es un panel, no es un permiso, no es una conclusión de la app. Es **material
para la sesión**, armado y enviado por quien lo vivió.

## 2. De dónde sale, y qué corrigió

La consulta a **Mónica Grando**, psicóloga, sobre mostrarle el registro de ánimo
al profesional. Lo que contestó, y por qué cambió el diseño:

> *"Sí, está bueno. Y en sesión se trabaja y se asocia eso que sintió con lo que
> estaba sucediendo, y también yo preguntaría en la sesión si ahora, mirando la
> situación con un poquito de distancia: sentiría, pensaría y accionaría de igual
> manera que ese día del registro, por qué sí, por qué no. También le preguntaría
> qué le produce o genera registrar. Y en base a lo que va saliendo en sesión se
> puede dar una variedad de posibles aperturas para el trabajo terapéutico.*
> *Inclusive, lo he pedido en algunos pacientes."*

Tres cosas se leen ahí:

1. 🔴 **La asociación es el acto terapéutico, y ocurre EN SESIÓN.** Se estaba por
   construir lo contrario: que la app entregara la conclusión ya hecha ("el
   ánimo sube después de tus sesiones"). Eso no ayuda al trabajo — lo hace por
   adelantado, peor, sin contexto y sin la persona.
2. **Ella no afirma: pregunta.** Su movimiento es abrir, no cerrar. Una
   devolución que concluye le saca a la persona el trabajo de mirar su propio
   registro con distancia.
3. ✅ **"Lo he pedido en algunos pacientes."** El flujo ya existe fuera de la app
   y una profesional ya lo pide a mano. Es demanda comprobada, no una hipótesis
   nuestra.

## 3. El principio: material, no conclusión

| | forma | efecto |
|---|---|---|
| Lo que hay hoy | "Hiciste 3 prácticas. Eso ya es una rutina." | cierra |
| Lo que se iba a construir | "El ánimo sube después de tus sesiones." | cierra, pero más impresionante |
| Esto | el registro crudo, elegido por ella, para mirarlo juntos | **abre** |

## 4. Qué entra — y el apareamiento, que es el punto

🔴 **Un check-in solo es un número del 1 al 5 con una fecha.** Mandarle al
profesional *"12 de agosto: bajón"* es el mismo problema de "informativo e
inútil", movido de lugar. Mónica no asocia el registro con nada: asocia *"eso que
sintió con **lo que estaba sucediendo**"* — y eso no está en el check-in.

El paquete vale por el apareamiento, no por la lista:

| Pieza | Cómo entra | Nota |
|---|---|---|
| **Check-ins de ánimo** con fecha | siempre — es la columna vertebral | El nivel y el día |
| **Una nota de la persona** por día incluido | opcional, la escribe ella | Es el contexto que falta, y es el trabajo que su profesional le pediría igual |
| **Entradas de diario o gratitud** | 🔴 **opcional y voluntario, elegidas UNA POR UNA** | Ver §5 |
| **Lo que hizo** — herramienta usada, si hubo sesión | opcional, automático | Contexto barato y no íntimo |
| **Las devoluciones de "Sobre vos"** | ❌ afuera | Son palabras de la app, no de la persona. Lo que sirve es qué registró ella, no qué le contestamos nosotros |

**Ventana por default: desde la última sesión.** Es la unidad natural —"qué pasó
entre que nos vimos"— y es exactamente el encuadre del trabajo. Además evita el
otro modo de falla: un paquete de treinta días que nadie va a leer.

## 5. El diario, y por qué esto NO contradice la regla de ayer

`docs/animo-compartido.md` §3 dice: **el diario y la gratitud no se comparten,
nunca.** Sigue valiendo, y esto no es una excepción sino otro caso:

> Esa regla es sobre **acceso continuo concedido de fondo**. Acá la persona
> **elige entrada por entrada** y **ve exactamente qué manda antes de mandarlo**.
> Llevarle una hoja del cuaderno al terapeuta es lo más normal del mundo;
> entregarle el cuaderno no lo es.

⚠️ **La distinción es toda la selección.** Si alguna vez esto se convierte en
"compartir mi diario" —un tilde, un rango de fechas, un default— vuelve a estar
mal y hay que sacarlo.

## 6. No negociables

- 🔴 **Se revisa antes de mandar. Siempre.** Nada de generar y enviar. Se arma,
  se muestra completo, se puede sacar cualquier pieza, y recién ahí se manda. Es
  lo único que vuelve legítimo incluir texto libre.
- 🔴 **Lo inicia la persona.** El profesional no puede pedirlo — mismo argumento
  que en `animo-compartido.md` §4: entre ellos hay desnivel de autoridad, y una
  solicitud suya no es una pregunta, es una presión.
- **Va al chat**, como un mensaje más. La persona manda algo suyo por un canal
  que ya usa para eso: la forma legal más simple que existe, y donde el
  profesional ya mira.
- **Se ofrece una vez, antes de la sesión, y se puede descartar.** *"Tenés sesión
  el sábado. ¿Querés armar algo para llevar?"* Si insiste, la app deja de
  acompañar y pasa a exigir — que es exactamente lo que este producto dice no ser.

## 7. Qué reemplaza

🔴 **Esto puede jubilar la feature D entera** (`MOSTRAR_ANIMO_AL_COACH`, hoy
apagada) **y con ella la pregunta A.10 al abogado**, que es la más difícil que
tenemos abierta.

Si la persona arma un paquete antes de cada sesión, **el profesional no necesita
acceso permanente**: no hay permiso continuo, no hay revocación, no hay "qué pasa
con lo que ya vio", no hay aviso cuando alguien deja de compartir. Todo el
aparato de consentimiento de `animo-compartido.md` §4-§5 deja de hacer falta.

La función `mood_trend_for_client` puede quedar como está —apagada— o borrarse.

## 8. Lo que sigue abierto

- ⚠️ **A.11 (deber de actuar) se vuelve MÁS filosa, no menos.** Mónica es
  psicóloga: sabe qué hacer con un día malo. En Vita hay coaches de hábitos,
  guías y nutricionistas — **su flujo es clínico y el de ellos no**. Y acá la
  persona además **eligió deliberadamente** mostrar algo, lo que sube la
  expectativa de respuesta. Si manda un paquete duro y no le contestan en tres
  días, ¿en qué posición queda cada uno?
- **Pregunta nueva para el abogado:** ¿cambia algo que la persona envíe texto
  libre suyo —diario— por el chat, frente a que lo comparta por un permiso? La
  lectura nuestra es que es un mensaje como cualquier otro y no una cesión de
  datos a un tercero, pero conviene confirmarlo.
- **Un profesional que no lo lee.** Si alguien se toma el trabajo de armar un
  paquete y del otro lado no pasa nada, es peor que no haberlo ofrecido. No hay
  arreglo técnico; hay que decidir si se le pide algo al profesional.

## 8 bis. 📌 Estado al 04/09/2026 — las reglas, construidas

`lib/paquete.ts` (puro, 15 tests). Es el paso previo a cualquier pantalla: las
decisiones que este documento deja tomadas, escritas donde se pueden revisar en
aislado. **Todavía no hay UI ni tabla.**

Dos decisiones que el doc no cerraba y hubo que tomar para poder codearlo:

- **`TOPE_DIAS = 30`.** La ventana es "desde la última sesión", pero la primera
  vez no hay tal cosa. Sin tope, quien registra hace tres meses manda noventa
  días — y ahí aparece el otro modo de falla que el §4 nombra: *un paquete que
  nadie va a leer*. El paquete avisa cuándo se topeó (`ventanaTopeada`), porque
  no es lo mismo "esto es todo lo que pasó desde que nos vimos" que "esto es el
  último mes".
- **`OFRECER_DESDE_DIAS = 3`.** Se ofrece hasta tres días antes y hasta el mismo
  día de la sesión. Antes queda viejo; después ya no hay qué preparar.

Y una que sí estaba y quedó fijada con un test: **el día de la sesión anterior NO
entra en la ventana**. Es lo que pasó *después* de verse; incluirlo mezclaría
material ya conversado con material nuevo.

⚠️ **Hay un test que fija la FORMA del paquete** —que no devuelva promedios, ni
tendencias, ni nada de "Sobre vos"—. No es un test de tipos: es el §3 puesto
donde se rompa si alguien alguna vez agrega una lectura de la app.

## 8 ter. 📌 La nota, y por qué probablemente el diario no haga falta

> 04/09/2026, a partir de una duda de Andre: *"tienen su diario personal, podrían
> leerlo; me da la duda si podría ser un poco invasivo leerlo y extraer los datos
> para hacer un paquete."*

La duda es correcta y el §5 ya la contesta a medias —lo invasivo sería que **la
app extraiga**; lo diseñado es que **la persona elija entrada por entrada**—.
Pero hay dos cosas que no estaban.

**1. Lo incómodo no es la extracción, es el ofrecimiento.** Aunque elija una por
una, si la app propone *"¿querés agregar algo del diario?"*, empuja hacia adentro
de lo privado. Repetido, eso corre el límite aunque cada acto individual sea
voluntario. 🔴 **Regla nueva: la app no ofrece el diario.** Que esté disponible
si la persona lo busca, pero que nunca lo proponga. La diferencia entre "está ahí
si querés" y "¿no querés?" es toda.

**2. La nota y una entrada de diario no son lo mismo aunque digan lo mismo.** La
nota **se escribe sabiendo que se va a compartir**; el diario se escribió para
uno. Un texto cambia de naturaleza según para quién fue escrito.

De ahí sale lo que puede resolver la duda entera: **si la nota funciona, el
diario quizás no necesita entrar nunca.** El §9 ya lo pone último; puede que la
respuesta sea que no vaya.

`scripts/add-mood-nota.sql` (⚠️ pendiente de correr) agrega `mood_entries.nota`,
con tope de 280 caracteres. El tope es también una señal de para qué es: un campo
sin límite invita a escribir ahí lo que va en el diario, y entonces sí estaríamos
moviendo lo íntimo de lugar.

## 9. Por dónde empezaría

1. **Check-ins con fecha + nota propia**, ventana desde la última sesión,
   revisión y envío al chat. Es el esqueleto entero y no toca nada íntimo.
2. **El ofrecimiento antes de la sesión**, una vez y descartable.
3. **El diario, entrada por entrada.** Último a propósito: es lo más valioso y lo
   único que necesita que el resto ya esté bien hecho.

## 10. Lo que NO haría

- Que el paquete se arme y se mande solo.
- Que el profesional pueda pedirlo.
- "Compartir mi diario" como una sola acción.
- Meter las devoluciones de "Sobre vos" como si fueran material de la persona.
- Insistir con el ofrecimiento.
