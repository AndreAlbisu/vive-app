# No-show — qué pasa cuando alguien no aparece

> Salida de la discusión del 13/09/2026 (Andre + consejo de 5). **Nada de esto
> está construido todavía**: es la regla acordada, para que lo que se escriba
> después la implemente en vez de inventarla.
>
> Se escribe como decisión y no como fix por el mismo motivo que
> `docs/decisiones-pagos.md`: no hay un solo cliente real, así que esto es fijar
> el comportamiento correcto antes del primer usuario. Quien vea después el
> umbral de 10 minutos sin este contexto va a pensar que es arbitrario.

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

## La regla

Se miden **dos hechos por parte**, los dos derivables de `join_time` +
`duration` por participante dentro de `session_attendance.raw`:

- **Puntualidad** — ¿estaba en la sala en el minuto 10 desde el horario
  agendado, o se cruzó con el otro antes de eso?
- **Solapamiento** — ¿cuánto tiempo estuvieron los dos a la vez?

El veredicto sale en **dos pasos, no en uno**:

**Paso 1 — ¿ocurrió?** Solapamiento ≥ 10 min → sí. El coach cobra, sin importar
quién llegó tarde. Se terminó ahí.

**Paso 2 — si no ocurrió, ¿quién lo causó?** El que no fue puntual:

| Coach puntual | Cliente puntual | Veredicto |
|---|---|---|
| sí | no | Responsabilidad del cliente. **Coach cobra** |
| no | sí | **No-show del coach.** Reembolso |
| no | no | Sin culpable. Reembolso, **sin sanción** |
| sí | sí | Imposible — si los dos estuvieron en el minuto 10, se solaparon |

La última fila es la prueba de que la regla es consistente: no hay ningún caso
donde los dos cumplieron y aun así nadie es responsable.

### Por qué dos pasos y no un umbral

🔴 **La primera versión de esta regla tenía un agujero que la invalidaba**, y lo
encontró el consejo: usaba un solo número para decidir dos cosas distintas. El
solapamiento dice *si la sesión ocurrió*; no dice *quién la impidió*.

Con un solo umbral, **el cliente arrepentido entra en el minuto 51, solapa 9
minutos y se lleva una cancelación gratis**: el veredicto daba "no ocurrió, sin
culpable" → reembolso, coach sin cobrar y nadie sancionado. La regla del
solapamiento es simétrica y solo se la había pensado contra el coach.

Con los dos pasos, ese cliente no estaba en el minuto 10 y el coach sí → fila 1,
el coach cobra.

Y arregla un segundo caso que la versión anterior también fallaba: **coach entra
en el minuto 2, ve la sala vacía, se va en el minuto 5; el cliente entra en el
minuto 7.** Con "¿entró el coach? sí" zafaba. Midiendo la puntualidad *al final
de la ventana*, no estaba en el minuto 10 y no se cruzó con nadie → no-show del
coach. Esperar 3 minutos no es haber estado.

### Un solo número, dos usos

Los 10 minutos son **la tolerancia** (cuánto hay que esperar al otro) **y el
mínimo de solapamiento** (cuánto juntos cuenta como sesión). Que sea el mismo
número no es una coincidencia cómoda: es lo que permite escribirlo en los ToS en
una línea, sin tabla de verdad.

> **Si tu coach no está en los primeros 10 minutos, no pagás.**

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
10 minutos porque la app se lo dijo **ya cumplió la puntualidad** —estaba ahí
cuando venció la tolerancia—, así que la regla lo protege sin necesidad de
registrar el abandono sugerido como hecho aparte.

### 🔴 El mecanismo no existe todavía, y la causa no es el cron

Ninguna de las dos puntas sabe quién está en la sala en tiempo real:

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

**La app vende sesiones hasta 42 días más allá de donde llega la protección.** Y
hay un defecto aparte, independiente del no-show: **el mismo coach ofrece dos
agendas distintas según la puerta por la que entró el cliente.**

### Decidido: horizonte de 10 días, mismo valor en las dos superficies

No 14: poner el horizonte igual al colchón deja margen cero. La cuenta es la del
camino completo, no la de la sesión:

```
t=0        pago aprobado
t=H        la sesión
t=H+1      veredicto de no-show (el cron es horario)
t=H+1..3   el paso humano (mail → Andre aprieta el botón)
t≈14       MP libera los fondos
```

Con H=10 quedan 3-4 días de margen. Con H=14 no queda ninguno.

**Y 10 no aprieta nada en la práctica**: una cadencia semanal necesita 7 días de
horizonte, y la re-reserva 1-tap al terminar cada sesión —medida 1 del
anti-fuga— entra siempre. El horizonte largo solo sirve para el caso que hoy no
existe: agendar a dos meses.

📌 **El tope va en la reserva, no en la generación.** `generateWeeklySlots()`
sigue poblando 56 días: eso es el coach declarando disponibilidad, que es otra
cosa. Lo que se acota es hasta dónde se puede **comprar**.

El costo de equivocarse es asimétrico y reversible en una sola dirección: subir
el tope después es cambiar un número; recuperar plata de un coach que ya retiró
no tiene mecanismo — el runbook de garantía ya lo dice.

### En el riel internacional no hay nada que construir

Ahí VIVE cobra entero y transfiere después. `mark_coach_paid` exige
`status = 'completada'`, `payment_status = 'aprobado'` y `paid_out_at is null`.
La retención ya existe y ya es más estricta de lo que pidió el consejo —
**siempre que se arregle `complete_confirmed_sessions()`**, porque hoy ese guard
cuelga de un `completada` que no verifica nada.

## No-show del cliente

**El coach cobra el 100%, con la misma tolerancia de 10 minutos.** Sale de la
fila 1 de la tabla: si el coach estuvo y el cliente no, la responsabilidad es del
cliente.

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

1. 🔴 **Que Daily devuelva `user_id` por participante.** Toda la regla cuelga de
   poder distinguir al coach del cliente. `create-meeting-room` acuña el token
   con `user_id` e `is_owner: true`, pero **nunca se miró una respuesta real de
   `/v1/meetings`**. Se mira en la primera videollamada real, abriendo el JSON.

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
   la misma pasada cuesta cero, y con ese número el 10 se ajusta con fundamento.

## Defecto menor a corregir de paso

`session-attendance` calcula `finAprox` a partir de `scheduled_date +
scheduled_time` **sin sumarle `duration_minutes`** — es el inicio, no el fin. Con
el umbral de 24hs no cambia nada hoy, pero el nombre miente y va a confundir
cuando ese número baje (y tiene que bajar: la espera de 24hs existe porque una
sala vacía puede significar "todavía no empezó", ambigüedad que **no aplica** al
caso "el cliente está adentro y el coach no aparece").
