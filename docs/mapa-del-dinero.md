# Mapa del dinero — qué cobra Vita, cómo, a quién, y qué hay que facturar

> **22/09/2026.** Escrito **verificando contra el código y la base de producción**,
> no contra la documentación: varios números que circulaban en otros archivos
> estaban viejos y se corrigen acá.
>
> No es asesoramiento contable ni legal. Es la descripción exacta de lo que el
> sistema hace hoy, más las preguntas que quedan abiertas.
>
> Hermanos: [`fiscal-instrucciones.md`](./fiscal-instrucciones.md) (lo que hay que
> preguntarle al contador) y [`decisiones-pagos.md`](./decisiones-pagos.md).

---

## 1. Qué se cobra, y quién fija el precio

El precio de una sesión **lo fija cada profesional**, y el sistema lo lee de la
base en el momento de cobrar: **nunca** del teléfono de quien reserva. Son dos
columnas distintas, no una convertida:

| | dónde vive | para qué riel |
|---|---|---|
| Precio en pesos | `coaches.price_per_session` | Mercado Pago |
| Precio en dólares | `coaches.price_usd` | PayPal y USDT |

🔴 **No hay ninguna cotización en el medio.** El profesional fija los dos por
separado, y un mismo profesional puede tener uno, el otro o los dos.

⚠️ **Verificado en el código**: las tres funciones de cobro comparan que la
reserva sea de quien está pagando (403 si no) y derivan el precio de la base. El
monto no puede venir manipulado desde afuera. Esto fue un bug real en su momento
(sesión 107) y hoy está cerrado.

---

## 2. Cómo entra la plata, y en manos de quién queda

Hay **dos modelos distintos**, y la diferencia es la que más importa para todo lo
demás:

### A. En pesos, por Mercado Pago: la plata NO pasa por Vita

Es un **pago dividido** de marketplace. El cliente paga, y Mercado Pago deposita
directamente en la cuenta **del profesional**, ya descontada la comisión de Vita,
que MP transfiere aparte.

- El vendedor ante Mercado Pago es **el profesional** (él es el `collector`).
- Vita nunca toca esa plata: recibe solo su comisión.
- La tarifa de Mercado Pago **la paga el profesional**, no Vita. Es del **4,30%**,
  medido el 21/09 contra tres pagos reales de $4.500 (`mercadopago_fee` 193,63).
  Ese número ya incluye IVA.

### B. Desde el exterior (PayPal y USDT): la plata SÍ pasa por Vita

El cliente le paga a Vita, y Vita después le transfiere al profesional lo que le
corresponde.

- Vita **retiene transitoriamente fondos de terceros**.
- Los costos del riel los **absorbe Vita**: 5,40% + USD 0,30 de PayPal al
  recibir, ~2% al pagar, USD 1,50 de red en USDT.
- 📌 En USDT el cliente paga **hasta 0,99 USD menos** que el precio: los centavos
  identifican la transferencia y desde el 08/09 se restan en vez de sumarse. **Esa
  diferencia la absorbe Vita**; el profesional cobra siempre sobre el precio entero.

🔴 **Esta diferencia es la que hay que llevarle al abogado y al contador.** En el
modelo A, Vita es intermediaria pura. En el B, recibe plata de otro antes de
liquidarla. Los Términos §8.2 ya describen las dos modalidades desde el 22/09,
con un corchete pidiendo confirmar el encuadre.

---

## 3. Cuánto se queda Vita

La comisión **sale del riel**, porque cubre lo que cuesta cobrar por ese riel:

| | primera sesión del par | de la segunda en adelante |
|---|---|---|
| Mercado Pago (pesos) | **20%** | **15%** |
| PayPal y USDT (dólares) | **25%** | **20%** |
| Cliente que llegó por el link del profesional | **0%** | 15% o 20% según el riel |

- El contador de "sesiones del par" es **uno solo** y no mira el riel: quien pagó
  una vez por PayPal y después por Mercado Pago, en la segunda paga 15%.
- La comisión es **pura, sin IVA**, mientras Vita sea Monotributo. Lo que se
  retiene es exactamente lo que Vita percibe.
- ✅ **Verificado en producción** con el pago con tarjeta del 21/09: la
  `application_fee` fue el 15% exacto, o sea que **el split está activo y no está
  en modo de prueba**. Los dos interruptores (`MP_SPLIT_ENABLED`, `MP_TEST_MODE`)
  se comprobaron por evidencia, no leyendo la configuración.
- ✅ **No hay ninguna promoción activa**: `FOUNDER_PROMO_UNTIL` no está definida,
  y sin esa variable no hay promo.

📌 **Y hay un descuento nuevo que sale de la comisión, no del profesional** (M7,
21/09): quien llega invitado por el código de otro paga **10% menos** en su
primera sesión, y ese descuento se resta de la comisión de Vita. El profesional
cobra lo mismo. Solo funciona en Mercado Pago.

---

## 4. Qué hay que facturar, y quién

| Qué | Quién la emite | A quién |
|---|---|---|
| **La sesión** | **El profesional** | Al cliente |
| **La comisión de Vita** | **Vita** | **Al profesional** |

🔴 **Vita no le factura nada al cliente.** La sesión es una prestación del
profesional, y Vita no es agente de retención ni de percepción. Está así en los
Términos §8.5.

**No es una factura por sesión.** La comisión de un profesional a lo largo de un
mes puede ir en **una sola factura mensual**. Con diez profesionales activos son
diez facturas por mes.

El panel de Administración ya tiene la pestaña **Facturación**, que muestra la
comisión agrupada por mes, profesional, moneda y riel, con las reembolsadas
aparte. Es el insumo para cargarlas a mano.

⚠️ **El sistema no emite ninguna factura**, y no hay una sola referencia a ARCA en
el código. Automatizarlo exige certificados y un servicio web o un intermediario
pago: **no vale la pena con diez facturas mensuales**. El día que sean cincuenta,
sí.

---

## 5. Cuánta plata se movió de verdad, hasta hoy

Medido en la base el 22/09/2026:

| riel | estado | operaciones | bruto | comisión de Vita |
|---|---|---|---|---|
| Mercado Pago | aprobado | 17 | $17 | **$2,70** |
| Mercado Pago | reembolsado | 16 | $31.509 | $4.726,50 (devueltos) |
| Mercado Pago | reembolso pendiente | 1 | $1 | $0,20 |
| PayPal | reembolsado | 4 | USD 91 | USD 22,75 (devueltos) |
| USDT | aprobado | 1 | USD 6 | **USD 1,20** |

🔴 **La comisión que Vita retuvo y NO devolvió, en toda su historia, es de $2,70
y USD 1,20.** Todo lo demás se reembolsó.

⚠️ **Esto corrige a `fiscal-instrucciones.md` §2.1**, que dice que quedó
"un solo movimiento de ~$675". Ese pago de $4.500 del 19/08 figura hoy
**reembolsado** en la base, igual que los otros seis de precio real.

### 🔴 Y el dato que ordena todo lo anterior: no hubo ni una venta real

**Las 19 operaciones que movieron plata tienen a `coach-prueba` como
profesional**, que es una cuenta de Andre (`viveappp@gmail.com`). Del lado del
cliente: Andre (13), Joaquín (2), `amazonalbisu@` (2), una cuenta ya borrada (1) y
`eli@` (1), todas cuentas propias o de su hermano.

O sea que **fue siempre su propia plata yendo a sus propias cuentas**, para
ejercitar el pipeline de cobro. **Vita nunca le cobró a un cliente real, ni le
pagó a un profesional real.** Verificado uno por uno en la base el 22/09/2026.

Dos consecuencias:

- 📌 **No existe la deuda de USD 4,80** que figuraba acá hace un rato: la sesión de
  USDT es de Andre hacia su propio `coach-prueba`. No hay a quién liquidarle.
- 📌 **La pregunta de si hay que facturar cambia de forma.** No es "¿facturo
  $2,70?", es **"¿cómo se documenta un movimiento entre dos cuentas mías?"**. Una
  persona no se presta un servicio a sí misma, así que probablemente no haya
  venta que facturar; pero los movimientos **sí existen en los registros de
  Mercado Pago bajo el mismo CUIT**, y eso es lo que hay que saber cómo explicar.
  Es una pregunta mejor que la anterior, y es la que conviene llevar.

⚠️ **Y un reembolso trabado desde el 9 de agosto**: $1 en `reembolso_pendiente`
hace seis semanas. Es plata simbólica, pero es el camino por el que va a volver
la plata de la primera persona que cancele.

---

## 6. Qué preguntarle al contador, en orden

Las tres primeras son las que pueden cambiar decisiones. El resto ya está en
[`fiscal-instrucciones.md`](./fiscal-instrucciones.md), que está listo para
mandarse tal cual.

1. 🔴 **¿La plata de terceros del riel internacional me computa para el tope del
   Monotributo?** En PayPal y USDT pasa por la cuenta de Vita **el importe entero
   de la sesión**, no solo la comisión. Si computa, el tope llega mucho antes de
   lo que sugiere lo que Vita realmente gana, y eso empuja a Responsable
   Inscripto, que trae IVA sobre la comisión y cambia el precio del servicio.
2. **¿Cómo se documenta lo que ya pasó, si fue plata mía hacia cuentas mías?**
   No hubo **ninguna** venta real: las 19 operaciones tienen a `coach-prueba`
   (cuenta de Andre) como profesional, y del otro lado cuentas propias o de su
   hermano. La comisión "retenida" es **$2,70 y USD 1,20**, y se retuvo de sí
   mismo. La pregunta no es cuánto facturar sino **cómo se explican esos
   movimientos**, que sí figuran en Mercado Pago bajo el mismo CUIT.
3. **¿La comisión se factura mensual por profesional, o por operación?** De esto
   depende si son diez facturas por mes o cien.
4. **¿Cómo se factura la comisión sobre una sesión cobrada en dólares?** Tipo de
   cambio, momento, y si cambia algo que el servicio se haya aprovechado afuera.
5. **¿Qué pasa con una comisión ya facturada sobre una sesión que después se
   reembolsa?** Hoy pasa: el reembolso de Mercado Pago devuelve también la
   comisión.

---

## 7. Lo que falta para poder abrir sin sorpresas

- 🔴 **La consulta con el contador** (punto 1 de arriba). Es lo único que puede
  cambiar el modelo de negocio.
- 🔴 **La revisión del abogado** (L5), con el corchete nuevo de §8.2 sobre el
  encuadre de la plata de terceros.
- ⚠️ **Destrabar el reembolso de $1** parado desde el 9 de agosto, que es lo que
  prueba que ese camino funciona.
- 📌 **Ningún cambio de código es necesario para facturar.** Se hace a mano con la
  pestaña de Facturación, y se automatiza recién cuando el volumen lo justifique.
