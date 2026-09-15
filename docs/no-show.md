# No-show — qué pasa cuando alguien no aparece

> Salida de la discusión del 13/09/2026 (Andre + consejo de 5). **Nada de esto
> está construido todavía**: es la regla acordada, para que lo que se escriba
> después la implemente en vez de inventarla.
>
> Se escribe como decisión y no como fix por el mismo motivo que
> `docs/decisiones-pagos.md`: no hay un solo cliente real, así que esto es fijar
> el comportamiento correcto antes del primer usuario. Quien vea después los
> umbrales —10 para el coach, 20 para el cliente, 10 de solapamiento— sin este
> contexto va a pensar que son arbitrarios, o peor, va a "emparejarlos".

## El estado de hoy, que es peor que "no hay política"

`complete_confirmed_sessions()` marca la reserva **`completada` 20 minutos
después del horario, sin mirar asistencia**. O sea que hoy, una sesión donde el
coach no apareció:

- queda registrada como cumplida;
- le dispara al cliente plantado la notificación `invitacion_review`;
- cuenta para el tramo de comisión reducida en `mp-create-payment`;
- y **habilita el pago al coach en el riel internacional**, porque
  `admin-actions → mark_coach_paid` exige `status = 'completada'` y ese guard
  parece verificar que la sesión ocurrió cuando verifica que pasó la hora.

Un solo cambio de condición cierra las cuatro. Es lo primero que hay que hacer y
no depende de ninguna de las decisiones de abajo.

🔴 **Y además hay que moverla en el tiempo.** Con la tolerancia del cliente en 20
minutos, una sesión con alguien demorado **recién está empezando** cuando esa
función corre. No alcanza con que mire asistencia: **tiene que correr después del
fin de la sesión**, no a los 20 minutos del inicio. Las dos cosas se resuelven
juntas.

## La regla

Se miden **dos hechos por parte**, los dos derivables de `join_time` +
`duration` por participante dentro de `session_attendance.raw`:

- **Cumplimiento** — cada parte tiene el suyo, y **no son el mismo número**:
  - **El coach** tiene que estar desde el horario y **quedarse hasta que llegue
    el cliente o hasta el minuto 20**.
  - **El cliente** tiene que llegar **antes del minuto 20**; y si el coach no
    está, puede irse **desde el minuto 10** sin perder nada.
- **Solapamiento** — ¿cuánto tiempo estuvieron los dos a la vez? El mínimo es
  **10 minutos**, y es una pregunta distinta de las de arriba.

El veredicto sale en **dos pasos, no en uno**:

**Paso 1 — ¿ocurrió?** Solapamiento ≥ 10 min → sí. El coach cobra, sin importar
quién llegó tarde. Se terminó ahí.

**Paso 2 — si no ocurrió, ¿quién lo causó?** El que no cumplió:

| Coach cumplió | Cliente cumplió | Veredicto |
|---|---|---|
| sí | no | Responsabilidad del cliente. **Coach cobra** |
| no | sí | **No-show del coach.** Reembolso |
| no | no | Sin culpable. Reembolso, **sin sanción** |
| sí | sí | Imposible — si el coach se quedó hasta que el otro llegó y el otro llegó antes de los 20, se solaparon |

La última fila es la prueba de que la regla es consistente: no hay ningún caso
donde los dos cumplieron y aun así nadie es responsable.

### Dónde se le dice esto al coach

En **Ajustes → Cómo funciona** (`screens/CoachComoFuncionaScreen.tsx`, bloque
`ausencias`). Antes vivía en una línea suelta debajo de la tarjeta de la próxima
sesión, en el Inicio, y decía *"Esperá hasta 20 minutos. Si no llega, la sesión
se te paga igual."* — **mal dicho en dos puntos**: la espera se termina antes si
la persona llega, y con 10 minutos de solapamiento la sesión ya ocurrió y se
cobra sin importar quién llegó tarde. Se sacó de la Home el 14/09/2026.

⚠️ Si cambia alguno de los tres umbrales (20 del coach, 20 del cliente, 10 de
solapamiento), esa pantalla cambia en el mismo commit.

### Por qué los plazos son asimétricos, y por qué la obligación del coach no es "estar en el minuto 10"

**Decidido el 13/09 a propuesta de Andre:** el coach cobra igual, así que el que
llega tarde debería poder **alcanzar** la sesión en vez de perder la plata. Un
cliente 12 minutos tarde —tráfico, un llamado que se estiró, un chico— es
muchísimo más común que uno que no viene, y con 40 minutos por delante todavía
hay sesión. Por eso el plazo del cliente es 20 y no 10.

🔴 **Pero subir el número solo, sin reformular la obligación del coach, rompe la
regla en silencio.** Con "puntual = estaba en el minuto 10" y dos umbrales
distintos aparece este caso: coach entra 15:00 y se va 15:11; cliente entra
15:15. Los dos "puntuales", **solapamiento cero** — la fila imposible se vuelve
posible, y el coach cobraría habiéndose ido antes de que venciera el plazo del
otro.

Por eso el cumplimiento del coach **se extiende hasta el plazo del cliente**:
tiene que quedarse hasta el minuto 20 o hasta que el otro entre. Con eso la
propiedad vuelve a cerrar.

### Por qué dos pasos y no un umbral

🔴 **La primera versión de esta regla tenía un agujero que la invalidaba**, y lo
encontró el consejo: usaba un solo número para decidir dos cosas distintas. El
solapamiento dice *si la sesión ocurrió*; no dice *quién la impidió*.

Con un solo umbral, **el cliente arrepentido entra en el minuto 51, solapa 9
minutos y se lleva una cancelación gratis**: el veredicto daba "no ocurrió, sin
culpable" → reembolso, coach sin cobrar y nadie sancionado. La regla del
solapamiento es simétrica y solo se la había pensado contra el coach.

Con los dos pasos, ese cliente no llegó antes del minuto 20 y el coach sí
cumplió → fila 1, el coach cobra.

Y arregla un segundo caso que la versión anterior también fallaba: **coach entra
en el minuto 2, ve la sala vacía, se va en el minuto 5; el cliente entra en el
minuto 7.** Con "¿entró el coach? sí" zafaba. Midiendo el cumplimiento *como
permanencia y no como un instante*, se fue mucho antes del minuto 20 y no se
cruzó con nadie → no-show del coach. Esperar 3 minutos no es haber estado.

### Cómo se dice sin tabla de verdad

Son **dos frases, una por parte**. Si la regla necesita una tabla para
entenderse, no es una política: es una especificación interna.

> Si tu coach no está en los primeros **10 minutos**, no pagás.
> Si llegás más de **20 minutos** tarde, la sesión se cobra igual.

### Dónde se le dice esto al cliente

**Una vez, al reservar**: en `BookingScreen_Confirm`, debajo de la política de
cancelación, con las dos frases. **Y en el momento**, en `web/sala` (avisos de
los 2 y 10 minutos).

📌 Hasta el 14/09/2026 la primera frase vivía también en la tarjeta de la próxima
sesión de `SalaScreen`. Se sacó: repetida en cada sesión futura, antes de que
pasara nada, se leía como anticipar que el coach iba a faltar, y decía solo la
mitad que le conviene al cliente. Además la veía el coach (la pantalla es también
su chat), hablándole de "tu coach".

⚠️ **Hueco aceptado**: "Unirse" en la app abre Daily directo, sin `web/sala`, así
que desde la app no hay aviso en el momento — solo lo que se leyó al reservar.
Mismo criterio que "No se toca `SalaScreen`" más abajo.

⚠️ Si cambia alguno de los umbrales, cambian en el mismo commit
`BookingScreen_Confirm`, `CoachComoFuncionaScreen` y `web/sala`.

El **solapamiento mínimo de 10 minutos** no se publica como número: es el criterio
interno de "¿pasó suficiente sesión?", y decirlo invita a discutir el reloj en vez
del hecho.

El veredicto vive en una **vista derivada, no en una columna**: el umbral se va a
querer mover después de las primeras diez sesiones reales, y en una columna eso
obliga a reescribir historia. Mismo criterio que `user_tz_observed` →
`clasificacion_de_operaciones`.

## Quién actúa

| Qué | Quién | Por qué |
|---|---|---|
| Detectar | Automático | El dato ya se guarda desde el 25/08 |
| Avisarle al cliente | Automático | Hacer reclamar a alguien a quien plantaron traslada la carga de la prueba sobre un hecho ya registrado |
| Frenar la `invitacion_review` | Automático | Es el peor mail posible y hoy sale solo |
| Reembolsar | **Humano, por ahora** | La regla nunca corrió contra datos reales |
| Sancionar | **Humano, por ahora** | Un falso positivo castiga a un coach inocente |

La asimetría que justifica el corte: **el cliente ya sabe la verdad, la plata
no.** Si el veredicto se equivoca y le llega un mensaje que no corresponde, lo
ignora y no pasó nada. Si se equivoca y mueve plata, sancionó a alguien que sí
dio la sesión.

**El paso humano tiene fecha, no contador.** Atarlo a "20 casos" es atarlo a algo
que a este volumen tarda meses; se revisa cuando los casos acumulados coincidan
con la realidad, y el caso **aparece solo en el panel sin que nadie reclame** —
esa es la diferencia con §9.3, cuyo intake es por mail porque el hecho que evalúa
("no quedé conforme") es subjetivo.

## El escalonado en vivo

| Momento | Qué pasa |
|---|---|
| Horario agendado, cliente presente y coach no | Push al coach: *"te están esperando"* |
| +2 min | Al cliente: *"todavía no llegó nadie"* — lo importante no es la plata, es que sepa **que el problema no es su conexión** |
| +5 min | Segundo push al coach |
| +10 min | Al cliente: podés irte, **con el monto y el plazo dichos** |
| +20 min | Al coach que esperó y no vino nadie: *"podés cerrar — esta sesión se te paga igual"*. Es el espejo del mensaje del cliente: sin esto, el que esperó de más se queda sin saber si puede irse |
| Cuando el que llegó tarde entra a una sala vacía | *"Tu coach esperó hasta las 15:20 y se fue"* (o al revés). Cuesta casi nada una vez que hay presencia, y es la diferencia entre una regla y un portazo |

📌 **El aviso al coach va en el horario, no cuando el cliente entra**: `nbf` deja
entrar 15 minutos antes, y avisar en el minuto −15 es ruido que enseña a ignorar
el aviso.

📌 **El de los 10 minutos dice el número**: *"te devolvemos $X a tu Mercado Pago
en hasta N días"*, no "no perdés nada". Nadie cree una promesa sin plazo, y la
ambigüedad plata-tiempo es lo que convierte un plantón en una reseña de una
estrella.

📌 **No se ofrece "recuperá tu plata o esperá más".** Poner una decisión
financiera sobre alguien ya molesto y con información incompleta —no sabe si el
coach está llegando o se olvidó— hace que una elección mal hecha se sienta como
una trampa. Quitarle la consecuencia a la decisión es mejor que ofrecerla: irse o
quedarse no cambia el resultado.

🟢 **Esto resuelve solo el conflicto entre relojes.** El cliente que se va a los
10 minutos porque la app se lo dijo **ya cumplió** —estaba ahí desde el horario, y
el que no cumplió fue el coach—, así que la regla lo protege sin necesidad de
registrar el abandono sugerido como hecho aparte.

### ✅ Construido el 13/09/2026 — y la causa del bloqueo no era el cron

**Hasta ese día ninguna de las dos puntas sabía quién estaba en la sala en
tiempo real**, y el consejo lo atribuyó al cron horario. Era otra cosa:

- `web/sala` → `entrar(url)` hace `f.src = url` sobre un `<iframe>` pelado. Cero
  eventos.
- `SalaScreen` (app) → abre la URL afuera. No hay `@daily-co` en `package.json`.

**Decidido: la primitiva de presencia va solo en `web/sala`** — cambiar
`entrar()` por `DailyIframe.createFrame()` + `join({ url })` da
`participant-joined` / `participant-left` en el navegador. Una función, un
archivo, sin webhook de Daily ni infraestructura nueva.

**No se toca `SalaScreen`**: las apps no están publicadas, la web es el camino
real y desde la sesión 222 sirve a las dos puntas. Meter `@daily-co/daily-js` en
React Native es una dependencia nativa con costo real y pago cero hoy.

No es un parche: es la misma pieza que después sostiene llegadas tarde, "estoy
entrando" y reprogramar en un tap.

`send-push` ya acepta `{ bookingId, recipientId, title, body }` y autoriza por
relación, y la página tiene el `bookingId` y un `access_token` válido — así que
el aviso al coach **no necesita nada nuevo del lado del servidor**.

#### Lo que se construyó, y lo que quedó afuera a propósito

✅ **Hecho** (`web/sala/index.html` + `create-meeting-room`):

- `DailyIframe.wrap()` sobre el iframe que ya existía → `participant-joined` /
  `participant-left` en el navegador, sin webhook ni backend.
- **Falla abierto**: si el script de Daily no carga, se cae al `src` de siempre y
  la sesión entra igual, sin avisos. La presencia es una mejora, **nunca** una
  condición para entrar — mismo criterio que `web/captcha.js`.
- Los avisos de los **2 / 10 / 20 minutos**, con los plazos asimétricos ya
  aplicados. 📌 **Al coach no se le dice nada antes de los 20**: antes de eso
  todavía está obligado a estar, y un cartel a los 2 minutos lo invitaría a irse
  justo cuando la regla le pide quedarse.
- `create-meeting-room` pasó a devolver **`es_coach`** y **`empieza`**, dos datos
  que ya calculaba y tiraba. Sin el primero, el aviso *"tu coach no llegó"* se le
  mostraba **al propio coach**. Sin el segundo, los plazos se anclarían al
  momento en que la persona entró — y `nbf` deja entrar 15 minutos antes, así que
  quien llega temprano vería "no llegó nadie" a los 2 minutos **de su espera** y
  no del horario. `empieza` viaja ya resuelto a UTC para que la cuenta no dependa
  de la zona del dispositivo (el error ya cometido en `cancelled_late`).

⏭️ **Afuera a propósito**: el **push al coach**. Suma dos lecturas más y sus
caminos de error, y sobre todo **depende de que el coach tenga `push_token`, que
sigue sin medirse**. El aviso en pantalla paga seguro el 18/09; el push no.

⚠️ **Y no se promete un monto** en el mensaje de los 10 minutos: la página no
tiene el importe, e inventarlo sería peor que no decirlo. Queda para cuando
`create-meeting-room` lo devuelva.

## La plata: el colchón de Mercado Pago y el horizonte de reserva

**En MP no se puede retener el payout.** Verificado contra la documentación en
07/2026 y anotado en `mp-create-payment:189`: Checkout Pro **no tiene parámetro
para demorar el release por transacción**; `money_release_date` es un campo de
*respuesta* (~14 días post-aprobación por default) y cambiar el timing es
configuración **a nivel cuenta**, con el account manager. Y en marketplace el
split le paga al coach **en el momento del cobro**.

O sea que la recomendación que el consejo puso como bloqueante de todo lo demás
—"retené el payout"— **no se puede implementar en el riel que más se va a usar**.
No por falta de trabajo: no existe la palanca.

Lo que sí existe es el colchón: **si la sesión y un eventual reembolso caen
dentro de los ~14 días, los fondos siguen retenidos en MP**. Y hoy los tres
números no coinciden:

| Superficie | Horizonte | Dónde |
|---|---|---|
| App | **56 días** | `availabilityGenerator.ts:41`; el calendario no tiene tope hacia adelante |
| Web `/c/<slug>` | **21 días** | `slots_libres(p_slug, p_dias default 21)`, techo duro de 60; la web llama sin `p_dias` |
| Colchón de MP | **~14 días** | release por default post-aprobación |

**La app vende sesiones hasta 42 días más allá de donde llega el colchón.** Eso
no es de por sí un problema —ver abajo por qué acortar el horizonte fue la
respuesta equivocada— pero sí es una franja de reservas cuyo reembolso depende
del balance del coach y no de fondos retenidos, y hasta hoy nadie sabía cuán
ancha es.

Y hay un defecto aparte, independiente del no-show y de todo lo demás: **el mismo
coach ofrece dos agendas distintas según la puerta por la que entró el cliente.**

### Decidido: horizonte de 30 días, mismo valor en las dos superficies

🔴 **La primera versión de esta decisión fue 10 días, y estaba mal.** Queda
escrito el error para que nadie lo "arregle" de vuelta: se derivó mirando **solo**
el colchón de MP —hacer entrar toda sesión y su eventual reembolso dentro de los
~14 días— y se pagó con restricciones sobre los casos más comunes. Las tres que
lo rompen, planteadas por Andre:

1. 🔴 **El coach lleno.** Si sus próximos 14 días están ocupados, con tope de 10
   **aparece con cero disponibilidad y desaparece en la práctica**. El sistema
   castiga exactamente a los coaches que mejor funcionan, y se agrava solo:
   cuanta más demanda, menos reservable.
2. 🔴 **Reservar el mes.** Un vínculo de acompañamiento es "cuatro sesiones, una
   por semana"; con 10 días entran dos. Y **quien quiere dejar cerradas las
   cuatro y no puede, las arregla por afuera con el coach** — o sea que el tope
   empujaba justo la fuga que el proyecto entero trata de evitar.
3. **El viaje.** Alguien que sabe su agenda y reserva a dos semanas es el cliente
   más organizado que hay, y quedaba bloqueado.

📌 **El error de razonamiento, anotado porque es reutilizable:** se trató "la
sesión cae fuera del colchón" como si fuera "el reembolso es imposible", y no lo
es. Pasados los ~14 días el refund **sigue saliendo del balance del coach**;
falla solo si además retiró y no le quedó saldo. Es una falla probabilística y
poco frecuente, y se la estaba previniendo con un candado que rompe casos de
todos los días.

**El horizonte deja de ser la protección.** Se elige por demanda:

- **30 días**, mismo valor en la app y en la web. Cubre el paquete mensual, el
  viaje y al coach lleno, y es la mitad de los 56 actuales — que nadie eligió:
  salieron de la generación de slots.
- Se sigue arreglando el defecto real, que es independiente de todo esto: hoy
  **el mismo coach ofrece 56 días por la app y 21 por la web**. Eso no era una
  decisión, era una inconsistencia.
- La exposición pasa de **prevenirse** a **verse**: las reservas con
  `scheduled_date - paid_at > 14 días` son una consulta. Saber cuántas son y
  cuánta plata representan vale más que prohibirlas.

📌 **El tope va en la reserva, no en la generación.** `generateWeeklySlots()`
sigue poblando 56 días: eso es el coach declarando disponibilidad, que es otra
cosa. Lo que se acota es hasta dónde se puede **comprar**.

### Lo que lo resolvería de verdad, y por qué no ahora

**Cobrar cerca de la sesión y no al reservar**: la reserva se hace a 60 días y el
cobro sale 10 días antes. Así **toda sesión queda dentro del colchón sin importar
con cuánta anticipación se reservó**, y de paso habilita los paquetes.

Pero cambia el modelo entero —hoy es cobro al reservar, y de ahí cuelgan
`expire_unpaid_checkouts()`, el split, la comisión y los tres rieles— y crea una
falla nueva: el cobro que falla después, con la sesión agendada y el horario
tomado. No es para ahora, pero **es la respuesta correcta el día que haya
paquetes**.

### En el riel internacional no hay nada que construir

Ahí VIVE cobra entero y transfiere después. `mark_coach_paid` exige
`status = 'completada'`, `payment_status = 'aprobado'` y `paid_out_at is null`.
La retención ya existe y ya es más estricta de lo que pidió el consejo —
**siempre que se arregle `complete_confirmed_sessions()`**, porque hoy ese guard
cuelga de un `completada` que no verifica nada.

## No-show del cliente

**El coach cobra el 100%, con tolerancia de 20 minutos.** Sale de la fila 1 de la
tabla: si el coach cumplió —estuvo desde el horario y esperó hasta el minuto 20—
y el cliente no llegó, la responsabilidad es del cliente.

⚠️ **El coach plantado pierde 20 minutos y no 10**, que es el costo real de esta
decisión. Se paga a cambio de que el cliente demorado alcance la sesión en vez de
perder la plata, y se compensa avisándole bien a los 20 (ver el escalonado).

⚠️ **Pero el evento no debería disparar castigo, sino reenganche.** En un
producto de acompañamiento, el que falta muchas veces no falta por fraude: falta
porque está mal, y es la señal de abandono más temprana que va a haber. Cobrar la
sesión y además sancionar a alguien en crisis es el peor error posible acá.

## Lo que esto NO resuelve, dicho de frente

1. **`session_attendance` prueba presencia, no servicio.** Un coach que entra,
   deja la cámara apagada y no habla 11 minutos pasa la regla con nota. Ningún
   dato de asistencia lo agarra. **Ese caso ya tiene mecanismo**: la garantía
   §9.3 devuelve la plata de la primera sesión sin necesidad de expresar motivo.
   No hay que construir nada; hay que acordarse de que existe y no resolverlo dos
   veces.
2. **Los reclamos post-sesión quedan afuera de cualquier colchón.** §9.3 se pide
   *después* de la sesión, así que cae cerca o después del release. Ningún
   horizonte la protege. Exposición conocida y sin mecanismo.
3. **El coach que retira apenas puede** derrota el colchón igual. La única
   palanca real sigue siendo comercial, con el account manager de MP.
4. **Daily identifica tokens, no personas.** El token se acuña con el `user_id`
   de quien lo pidió autenticado: si alguien reenvía su link `?t=`, el que entra
   aparece **como esa persona**.
5. **Publicar el umbral le enseña la línea al oportunista.** Es el costo de tener
   una regla escrita, y se paga: una regla secreta es peor.
6. **No hay protocolo de contención.** Nadie definió quién chequea a la persona
   plantada si estaba mal. Se cruza con "protocolo de crisis", que figura en el
   changelog como pendiente **sin dueño**.
7. **Reemplazar al coach en el momento no se promete.** Tres advisors lo
   pidieron; se descartó por dos motivos independientes: prometer un pool on-call
   que no existe es una oferta publicada que obliga (Ley 24.240), y acá **el
   vínculo es el servicio** — ofrecer un desconocido en dos horas se puede leer
   como descarte, no como reparación. La reparación se ofrece caso por caso, a
   mano, hasta que haya oferta real detrás.

## Lo que hay que medir antes de construir

1. ✅ **RESUELTA el 13/09/2026 — Daily SÍ devuelve `user_id` por participante.**
   Era la única medición bloqueante: toda la regla cuelga de poder distinguir al
   coach del cliente. Verificado contra la respuesta real guardada en
   `session_attendance.raw` (la única fila con gente, del 28/08):
   - `data[].participants[]` trae **`user_id`, `user_name`, `participant_id`,
     `join_time`, `duration`** — o sea las tres cosas que hacen falta: identidad,
     cuándo entró y cuánto se quedó.
   - Y el `user_id` **es nuestro uuid de perfil, no un id interno de Daily**:
     cruzó exacto contra `bookings.user_id` de esa reserva (`es_el_cliente:
     true`, `es_el_coach: false`).
   - `data[]` trae además **`max_participants`**, que es de donde sale
     `max_simultaneous`.

   📌 **Consecuencia: el paso 2 de la regla (quién no cumplió) queda
   desbloqueado.** El solapamiento real y la asignación de responsabilidad se
   pueden calcular desde `raw` sin pedirle nada nuevo a Daily, y el `where` de
   `complete_confirmed_sessions()` puede graduar de `max_simultaneous >= 2` a la
   vista derivada del veredicto.

   ⚠️ **Lo que sigue sin probarse es el caso de DOS personas.** La única fila con
   datos tiene un solo participante durante 5 segundos: nunca hubo una
   videollamada real de dos puntas, así que el cruce coach-vs-cliente está
   verificado de un lado solo.

2. 🔴 **Cuántos coaches tienen `push_token`.** El aviso preventivo al coach es la
   única medida que evita el problema en vez de administrarlo, y
   `registerForPushNotifications` exige `Device.isDevice` + token de Expo: el
   coach tiene que tener **la app en un teléfono real**, y las apps no están
   publicadas. Si la cobertura es baja, la medida no hace nada para esos casos,
   **en silencio**.

   ```sql
   select
     count(*)                                          as coaches,
     count(*) filter (where p.push_token is not null)  as con_push
   from coaches c
   join profiles p on p.id = c.profile_id
   where c.verified = true;
   ```

   ⚠️ **El mail no es reemplazo**: `mail-notificaciones` es un cron de 5 minutos,
   y un aviso "de los 2 minutos" que llega en el minuto 7 no es preventivo.
   Sirve como segundo toque, no como el primero. **Para un coach sin push token,
   hoy no hay canal preventivo** — no se tapa con un mail que llega tarde.

3. **`money_release_date` real**, que vuelve en la respuesta del pago de MP. El
   "~14 días" sale de la documentación, no de un pago medido. Ya hay una tarea
   abierta que abre ese JSON (la medición de la tarifa real de MP, A5): leerlo en
   la misma pasada cuesta cero, y es lo que dice cuán ancha es de verdad la
   franja de reservas expuestas.

4. **Cómo se comporta un refund de MP cuando los fondos YA se liberaron**: si
   sale igual contra el balance del coach, si puede dejarlo en negativo, o si lo
   rechaza. De esto depende cuán grave es la exposición de las reservas fuera del
   colchón — y por lo tanto si el horizonte de 30 días está bien. **No está en el
   repo ni en la documentación pública**: es pregunta para el account manager, la
   misma conversación que ya quedó abierta para el timing del release.

## Defecto menor a corregir de paso

`session-attendance` calcula `finAprox` a partir de `scheduled_date +
scheduled_time` **sin sumarle `duration_minutes`** — es el inicio, no el fin. Con
el umbral de 24hs no cambia nada hoy, pero el nombre miente y va a confundir
cuando ese número baje (y tiene que bajar: la espera de 24hs existe porque una
sala vacía puede significar "todavía no empezó", ambigüedad que **no aplica** al
caso "el cliente está adentro y el coach no aparece").
