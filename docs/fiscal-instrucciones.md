# Instrucciones — Situación fiscal de Vita

Guía operativa (**no es asesoramiento contable**) para llevar a la reunión con el
contador. Reúne lo que ya está decidido, lo que está sin resolver, y por qué cada
pregunta importa. Escrito el 20/08/2026.

> **La consulta con el contador es hoy el único bloqueante real del riel
> internacional.** Se agotaron las salidas técnicas: PayPal no tiene pagos
> repartidos disponibles, USDT tampoco, y Stripe Connect no paga a Argentina.
> **La plata del exterior pasa sí o sí por la cuenta de Vita**, así que la
> pregunta del tope del Monotributo ya no tiene escapatoria de arquitectura.

## Archivos relacionados
- [`legal-instrucciones.md`](./legal-instrucciones.md) — la contraparte legal (T&C y Privacidad).
- [`terminos-y-condiciones.md`](./terminos-y-condiciones.md) — §8.3 a §8.6 son las cláusulas fiscales.
- [`cobro-internacional-coaches.md`](./cobro-internacional-coaches.md) — su §6 está **bloqueado** esperando estas respuestas.

---

## 1. Lo que YA está decidido

| | |
|---|---|
| **Figura** | Persona humana en **Monotributo**. No sociedad. Decidido 06/08/2026. |
| **Comprobante** | Factura tipo **C**, sin IVA discriminado. |
| **Qué factura Vita** | **Solo su comisión**, por el servicio de intermediación — no la sesión. |
| **Quién factura la sesión** | El profesional, al cliente. Vita no es agente de retención ni percepción. |
| **Comisión local** | 20% la primera sesión del par, 15% de la segunda en adelante. |
| **Comisión internacional** | **25% plano**, sin tramos. Decidido e implementado 20/08/2026. |

**Por qué no sociedad:** una SAS o SRL obliga a Responsable Inscripto, lo que
traería IVA sobre la comisión con cero facturación todavía. Y como el split de
Mercado Pago hace que el ingreso declarable sea solo la comisión y no el total
transado, el tope del Monotributo quedaba lejos.

⚠️ **Contra asumida:** se responde con patrimonio personal. La mitigación
elegida fue redactar bien §5 y §18-19 de los T&C, no constituir sociedad.

---

## 2. 🔴 Lo que hay que preguntar, en orden

### 2.1 ¿Estoy facturando lo que tengo que facturar?

**Esta va primera aunque parezca la menos interesante, porque es la única que ya
está corriendo con plata real.**

Vita cobró con plata real desde el **09/08/2026**, y **el sistema no emite
ninguna factura** — no hay una sola referencia a facturación, ARCA o AFIP en todo
el código.

⚠️ **Pero el volumen es mínimo y casi todo se revirtió.** Todos los movimientos
fueron pruebas del pipeline de pagos, no ventas a clientes:

| Fecha | Qué | Comisión de Vita | Estado |
|---|---|---|---|
| 09/08 | 4 pagos de $1 ARS | ~$0,20 c/u | uno reembolsado |
| 19/08 | Sesión $4.500, tramo 15% | ~$675 | **cancelada y reembolsada** |
| 19/08 | Sesión $4.500, instantánea | ~$675 | confirmada, sin reembolso |
| 18/08 | 6,28 USDT | **ninguna** | fue a la billetera personal, sin split |

O sea que lo que quedó con comisión retenida y no devuelta es **un solo
movimiento de ~$675**. Los reembolsados normalmente revierten también la
comisión, y el de USDT no tuvo split.

🔴 **Que hayan sido pruebas no determina por sí solo si son facturables** — eso
depende de cómo se documente el movimiento, no de la intención con que se hizo.
Pero conviene llevar el dato exacto y no la pregunta general.

**Para traer los números reales** (en vez de esta reconstrucción del changelog):

```sql
select b.id, b.scheduled_date, b.amount, b.platform_fee_pct,
       round(b.amount * b.platform_fee_pct / 100, 2) as comision,
       b.payment_status, b.payment_provider, b.status
  from public.bookings b
 where b.payment_status in ('aprobado','reembolsado')
 order by b.created_at;
```

Preguntar:
- ¿Con qué **frecuencia** y en qué **formato** se factura la comisión? ¿Una por
  reserva, o un resumen mensual por profesional?
- ¿A quién se le factura exactamente — al profesional, dado que la comisión sale
  de su parte vía el split?
- ¿Cómo se documenta una comisión **retenida por un tercero** (Mercado Pago) que
  nunca pasó por una cuenta de Vita?
- **¿Ese único movimiento de ~$675 hay que facturarlo?** ¿Y los reembolsados, que revirtieron la comisión?
- Hacia adelante, cuando haya ventas de verdad: ¿desde qué momento hay que tener la emisión resuelta?

### 2.2 ¿La plata de terceros me computa para el tope?

Es la que decide si el riel internacional tiene techo.

En PayPal y USDT **entra el total a la cuenta de Vita** y después se le
transfiere al profesional. La pregunta es si ese total computa como ingreso
bruto para la categoría del Monotributo, aunque la mayor parte sea de terceros.

⚠️ **Lo que ya se investigó y sugiere que sí:** el art. 3 del Anexo de la Ley
24.977 define el ingreso bruto como el obtenido *"por cuenta propia **o
ajena**"*. Si eso aplica, estructurarlo como intermediación **no salva el tope**.

Preguntar:
- ¿Computa o no?
- Si computa, **¿cuál es el techo real de sesiones internacionales por mes?**
- ¿Cambia si se documenta explícitamente como cobranza por cuenta y orden de
  terceros?

📊 **El dato que da urgencia a esto** (investigado en la sesión 102): a **150
sesiones internacionales por mes la cuota del Monotributo supera todo el ingreso
de esas sesiones**, porque te categoriza por plata que no es tuya. Las mismas 150
sesiones locales dan el mismo ingreso con una cuota **28 veces menor**.

### 2.3 ¿Quién factura la exportación?

Vender una sesión a alguien fuera del país es **exportar servicios**, y eso tiene
comprobante propio (**factura E**, que se puede emitir siendo monotributista) y
su trámite. La pregunta es quién es el exportador.

**Opción A — el profesional.** Da la sesión, le factura al cliente del exterior.
Cada profesional que tome una sesión internacional pasa a ser exportador, con su
propio trámite. Es lo que dicen hoy los T&C §8.5.

**Opción B — Vita.** Le vende la sesión al cliente del exterior y le factura;
el profesional le factura a Vita, como cualquier trabajo local. Un solo
exportador. Es para lo que se construyó la arquitectura.

🔴 **Las dos están escritas en el proyecto, en lugares distintos.** La
contradicción vive en tres lados:

| Dice | Dónde | Qué modelo |
|---|---|---|
| "el Profesional emite al Cliente los comprobantes por la Sesión" | T&C §8.5 | **A** |
| "cobra Vita para tener un solo circuito de compliance en vez de N" | CHANGELOG, sesión 101 | **B** |
| "él nos factura a nosotros en vez de al usuario" | `screens/CoachProfileScreen.tsx:313` | **B** |

⚠️ **No hay que llegar con una redacción para defender.** Los T&C son un
**borrador sin revisión legal**, escrito para el caso argentino antes de que
existiera el riel internacional. Cambiarlo cuesta editar un `.md` y correr
`sync:legal`. **La pregunta correcta es "¿qué tendría que decir acá?", no "¿esto
está bien?"**.

⚠️ **Y la opción B tiene un costo que hay que poner sobre la mesa:** se pasa de
facturar la comisión a facturar el total. Es **multiplicar por cinco la
facturación bruta para el mismo margen**, con impacto inmediato en la categoría.

### 2.4 ¿Conviene pasar a Responsable Inscripto?

Y acá el hallazgo que más sorprende de todo lo investigado: **lo que define la
figura fiscal es el marketing, no el volumen.**

Como monotributista, el IVA dentro de cada gasto **se pierde**. Como Responsable
Inscripto con ventas de exportación (que son exentas), ese mismo IVA es **crédito
recuperable**. Con pauta publicitaria por encima de **$500.000 al mes**, conviene
RI aunque el volumen de sesiones sea chico.

Preguntar:
- ¿A partir de qué nivel de gasto en pauta se da vuelta la ecuación?
- ¿Qué otros gastos generan crédito recuperable? (Supabase, Daily.co y Anthropic
  son importación de servicios.)
- ¿Cuánto cuesta administrativamente ser RI?

⚠️ **Si algún día se pasa a RI hay una decisión de precio esperando:** o el
profesional pasa a pagar **24,2%** (20% + IVA), o el 20% se vuelve IVA incluido y
el ingreso real cae a **~16,5%**. Hay que cambiar **a la vez** el cálculo del
servidor, el copy del perfil del profesional y el §8.4 de los T&C — si se toca
uno solo, los tres se contradicen.

### 2.5 Preguntas menores, pero que conviene llevar

- **Devaluación y tope.** El tope del Monotributo está fijo en pesos y se
  actualiza cada seis meses; la facturación internacional está en dólares. Una
  devaluación te acerca al tope sin que el negocio cambie. *(A $1300 el tope eran
  USD 97.393; a $1500, USD 84.407.)*
- **IIBB en Córdoba.** El art. 238 inc. b) del Código Tributario Provincial
  excluye la parte de terceros e inc. g) las exportaciones. ¿Aplica?
- **Cobro en cripto.** Recibir USDT como pago de un servicio exportado, ¿qué
  tratamiento tiene? ¿Cambia algo respecto de recibir dólares?
- **Constancia de inscripción de los profesionales.** ¿Hace falta pedírsela como
  campo de onboarding?

---

## 3. Qué depende de cada respuesta

| Respuesta | Qué se destraba |
|---|---|
| **2.1** Frecuencia y formato de factura | Regularizar lo cobrado desde agosto. Decidir si hay que automatizar la emisión. |
| **2.2** Si computa el total | Saber si el riel internacional tiene techo de volumen, y cuál. |
| **2.3** Quién exporta | Desbloquea el §6 de `cobro-internacional-coaches.md`, que hoy no se puede mandar. Y define si hay que reescribir §8.5 de los T&C. |
| **2.4** Monotributo o RI | Define si el esquema de comisiones actual sobrevive o hay que rehacerlo con IVA. |

---

## 4. Contexto económico, por si lo pide

**Costos fijos: ~USD 41/mes.** Supabase 25 · Anthropic 7,50 · Apple 8,25.
Daily.co es gratis hasta 83 sesiones mensuales y después USD 0,48 por sesión.

**Punto de equilibrio: ~5 sesiones internacionales por mes.** Los costos fijos no
son el problema — el negocio se define por volumen y margen variable.

**Margen por sesión internacional de USD 60:** entre USD 8,56 y 13,20 según cómo
pague el cliente y cómo cobre el profesional.

⚠️ **Lo único sin medir es el costo de cambio de moneda** (estimado 2-4%): traer
dólares de PayPal a pesos, y vender USDT por pesos. Son el mismo costo, no dos.
