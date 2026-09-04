# Derecho de consumo — jurisdicción, arrepentimiento, cancelación y precio en dólares

> **01/09/2026.** Investigación para responder **A.1, A.5, A.6 y A.9** de
> `paquete-abogado.md` sin consulta paga. **No es asesoramiento legal.**
>
> Dos de estos cuatro tienen respuesta clara y la podés aplicar hoy. Los otros
> dos no la tienen y digo por qué.
>
> Tercero de la serie, con [`transferencias-internacionales.md`](./transferencias-internacionales.md) (A.3)
> y [`consentimiento-datos-sensibles.md`](./consentimiento-datos-sensibles.md) (A.2, B.3).

---

## A.1 — Jurisdicción: la cláusula que tenés se tiene por no escrita

✅ **Esta tiene respuesta y no admite mucha discusión.**

**CCyC art. 1109:**

> *"En los contratos celebrados fuera de los establecimientos comerciales, a
> distancia, y con utilización de medios electrónicos o similares, se considera
> lugar de cumplimiento aquel en el que el consumidor recibió o debió recibir la
> prestación. Ese lugar fija la jurisdicción aplicable a los conflictos derivados
> del contrato. **La cláusula de prórroga de jurisdicción se tiene por no
> escrita.**"*

Vita es exactamente ese supuesto: contrato a distancia por medios electrónicos.
Así que:

- **Poner CABA no sirve de nada.** No es que sea riesgoso: es que la cláusula se
  tiene por no escrita y el juez competente termina siendo el del domicilio del
  consumidor igual.
- **Que operes desde Córdoba tampoco cambia nada.** Es irrelevante para la
  jurisdicción frente a un consumidor.
- Lo mismo sostiene el art. 36 in fine de la Ley 24.240 para su ámbito, y hay
  jurisprudencia consolidada anulando prórrogas predispuestas en relaciones de
  consumo.

**Texto propuesto para T&C §22.2** — reemplaza el corchete que quedaba:

> 22.2. Para toda controversia derivada de estos Términos con un Usuario que
> revista la calidad de consumidor, será competente el tribunal correspondiente
> al lugar donde el consumidor recibió o debió recibir la prestación, conforme
> al artículo 1109 del Código Civil y Comercial de la Nación. **No se aplican
> prórrogas de jurisdicción en perjuicio del consumidor.** Quedan a salvo los
> derechos irrenunciables de la Ley 24.240 de Defensa del Consumidor.
>
> Para controversias con Profesionales, que no revisten la calidad de
> consumidores respecto de la Plataforma, serán competentes los tribunales
> ordinarios de la Ciudad de Córdoba.

📌 Ese segundo párrafo es el que **sí** podés elegir: el profesional contrata
como proveedor, no como consumidor, así que ahí la prórroga es válida y conviene
ponerla donde estás.

**Con esto se cierra el último corchete de contenido del Paso 2.**

## A.9 — Precio en dólares: hay norma nueva y es de 2025

✅ **También tiene respuesta, y cambió hace poco.**

La **Resolución 7/2002**, que es la que probablemente aparezca si buscás, **está
derogada**. La reemplazó la **Resolución 4/2025** de la Secretaría de Industria y
Comercio (BO 17/01/2025). Lo que dice:

- **Obligatorio exhibir el precio en pesos**, moneda de curso legal.
- **Se puede exhibir además en dólares u otra moneda extranjera**, y —esto es lo
  que cambió— **ya no tiene que ser en caracteres más chicos**. Antes la moneda
  extranjera iba obligatoriamente menos destacada; ahora pueden ir del mismo
  tamaño.
- Suma la leyenda *"precio sin impuestos nacionales"* donde corresponda.

**Qué significa para Vita, caso por caso:**

| Situación | Veredicto |
|---|---|
| Coach con precio en pesos y en dólares, usuario en Argentina ve los dos | ✅ Correcto, y ahora podés mostrarlos con el mismo peso visual |
| Usuario en Argentina elige pagar en dólares teniendo el precio en pesos a la vista | ✅ Sin problema |
| 🔴 **Coach que solo acepta rieles en dólares → al usuario argentino no se le ofrece precio en pesos** | **Ese es el caso que no cierra** |

El tercero es el que vos mismo identificaste, y la respuesta es que **incumple la
obligación de exhibir en pesos**. Dos salidas, y las dos son de producto:

1. **Mostrarle igual un precio en pesos** al usuario argentino, aunque después el
   cobro se ejecute en dólares. Convertido a algún tipo de cambio declarado.
2. **No ofrecerle ese coach** a quien está en Argentina. Es lo que ya hace la
   "regla espejo" con los medios de pago (`docs/decisiones-pagos.md` D4): se
   ofrecen solo los rieles que el coach acepta. Extenderla al precio es
   coherente con lo que ya está construido.

⚠️ Esto se cruza con `bookings.user_tz_observed`, que existe justamente para
saber dónde estaba quien reservó. La decisión de qué mostrar depende de eso.

## A.5 y A.6 — Acá no hay respuesta cómoda

🔴 **Estas dos no las cierro, y el motivo es que la ley argentina no las
contempla expresamente.** Lo que puedo darte es la mejor posición construible y
sus puntos flojos.

### El problema de fondo: son dos institutos distintos y tu contrato los mezcla

Ya lo tenías detectado (`legal-instrucciones.md`, desajustes del 25/08): **§9.1
dice que dentro de las 24hs no se puede cancelar y §9.4 reconoce un derecho de
revocación irrenunciable de 10 días.** El contrato se contradice a sí mismo y el
código implementa solo §9.1.

No es un error de redacción. Son cosas diferentes:

- **La revocación** (art. 34 LDC, CCyC arts. 1110-1116) deshace **el contrato**
  dentro de los 10 días de celebrado. Es **irrenunciable** y no puede costarle
  nada al consumidor.
- **La política de cancelación** administra **la reserva**: cuánto aviso hace
  falta para liberar el horario del profesional.

**Una política de cancelación no puede derogar la revocación.** Si alguien
reserva hoy una sesión para dentro de tres días y al día siguiente revoca, está
dentro de los 10 días y §9.1 no lo puede frenar.

### A.5 — Qué pasa si la sesión ya se prestó dentro de los 10 días

**No hay norma expresa.** El CCyC art. 1116 lista las excepciones al derecho de
revocar —productos personalizados o que por su naturaleza no pueden devolverse,
software decodificado, publicaciones periódicas— y **una sesión ya prestada no
figura**. El derecho europeo sí tiene una regla para esto (el consumidor paga la
parte proporcional si pidió empezar antes del vencimiento del plazo); Argentina
no la copió.

**La posición defendible que se puede construir**, y sus dos patas:

1. **El art. 1116 inciso (a)** habla de prestaciones que *"por su naturaleza, no
   pueden ser devueltos"*. Una sesión de una hora ya ocurrida encaja en esa
   descripción. Es un argumento por analogía, no una subsunción limpia.
2. **Pedir conformidad expresa para empezar antes.** Si al reservar una sesión
   que cae dentro de los 10 días la persona declara expresamente que quiere que
   se preste igual y que entiende que después no podrá revocar esa prestación ya
   cumplida, la posición mejora bastante. Es una casilla en el checkout, y sin
   ella no tenés nada.

⚠️ **Lo que NO se puede hacer:** decir en el contrato que la revocación no
aplica. Es irrenunciable. Lo que se puede es acotar su **efecto** sobre lo ya
cumplido, y eso es un argumento, no una certeza.

📌 Un dato a favor: la retención sería la **contraprestación de un servicio
efectivamente recibido**, no una penalidad. Enriquecimiento sin causa (CCyC
arts. 1794-1795) juega para tu lado — quien recibió la sesión completa y recupera
todo se enriquece sin causa a costa del profesional, que no es Vita sino un
tercero.

### A.6 — La cancelación dentro de las 24hs

El test es el **art. 37 de la Ley 24.240**: son abusivas las cláusulas que
desnaturalicen las obligaciones, limiten la responsabilidad por daños, o
importen renuncia o restricción de los derechos del consumidor.

**A favor de que se sostenga:**

- Es **usual y proporcionada** en servicios con horario reservado. El profesional
  bloqueó una hora y no puede recolocarla.
- Es **recíproca en la práctica**: el usuario puede pedirle al profesional que
  cancele, y §9.3 le da una garantía de reintegro en la primera sesión.
- **Está informada antes de contratar** (`BookingScreen_Confirm` lo muestra).

**En contra, y es lo que hay que arreglar:**

- 🔴 **"No se puede cancelar" es distinto de "se cancela sin reembolso".** Hoy
  §9.1 impide la acción. Impedirle a alguien terminar el contrato es más
  atacable que cobrarle por hacerlo tarde. **Cambiar eso es gratis y mejora la
  posición**: que siempre pueda cancelar, y que dentro de las 24hs no haya
  reembolso.
- La cláusula **no puede tocar la revocación de los 10 días**, y hoy en el papel
  la toca.

**Recomendación concreta**, que es de producto y no necesita permiso de nadie:

1. Reescribir §9.1: **siempre se puede cancelar**; con más de 24hs de aviso hay
   reintegro, con menos no.
2. Agregar en §9.4 que la revocación de 10 días **convive** con lo anterior y
   prevalece cuando corresponde.
3. Casilla de conformidad expresa en el checkout cuando la sesión cae dentro de
   los 10 días de la reserva.
4. Alinear el código con eso.

✅ **Los cuatro hechos el 04/09/2026.** `canCancelConfirmed` pasó a llamarse
`hayReembolsoAlCancelar` y dejó de bloquear nada: las pantallas siempre dejan
cancelar y el cartel de confirmación dice si vuelve la plata o no. Apareció de
paso que **el cliente le prohibía algo que la base permite** — el trigger
`mark_refund_on_cancel` ya aceptaba la cancelación tardía, marcaba
`cancelled_late` y no reembolsaba. O sea que el servidor implementaba la política
correcta desde el 19/08 y el bloqueo del cliente era una regla paralela que lo
contradecía.

## Qué queda para preguntar

Si en algún momento hay una sola consulta disponible, las de este documento se
ordenan así:

1. 🔴 **A.5** — el efecto de la revocación sobre una sesión ya prestada. Es la
   única sin respuesta en la norma, y la que más plata puede costar.
2. **A.6** — si la reescritura propuesta alcanza para que no sea abusiva.
3. A.1 y A.9 no hace falta preguntarlas. Están contestadas.

---

## Fuentes

- [Código Civil y Comercial, art. 1109](https://leyfacil.com.ar/codigo-civil-y-comercial/articulo-1109/) — lugar de cumplimiento y jurisdicción; la prórroga se tiene por no escrita.
- [CCyC arts. 1110 a 1116](https://leyfacil.com.ar/codigo-civil-y-comercial/articulo-1116/) — revocación en contratos a distancia y sus excepciones.
- [Ley 24.240](https://www.argentina.gob.ar/normativa/nacional/ley-24240-638/actualizacion) — arts. 34 (revocación), 36 in fine (jurisdicción), 37 (cláusulas abusivas), 53.
- [Resolución 4/2025, Secretaría de Industria y Comercio](https://www.argentina.gob.ar/normativa/nacional/norma-408455/texto) — exhibición de precios; deroga la Res. 7/2002.
- [Actualización normativa — Exhibición de precios (Res. 4/2025)](https://www.argentina.gob.ar/sites/default/files/exhibicion_de_precios_resolucion_4_2025.pdf).
