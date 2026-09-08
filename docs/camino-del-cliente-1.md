# El camino del cliente #1 — de dónde sale la primera transacción

> 08/09/2026. Abierto a pedido de Andre, como consecuencia de la segunda pasada
> sobre el Inicio del coach (`docs/inicio-del-coach.md` §0). **No es un plan: es
> el problema, escrito, con lo que se verificó y lo que queda por decidir.**
>
> Nada de acá está implementado.

## 1. Por qué existe este documento

La pregunta que se traía era *"¿qué cards van en el Inicio del coach?"*. La
respuesta resultó chica —medio día de trabajo, ver §0.4 del otro doc— y el peso
se movió a otro lado:

**El lanzamiento no depende de la Home del coach. Depende de un camino que hoy no
existe: el que va desde el WhatsApp del coach hasta la primera sesión pagada.**

El hallazgo que lo destapó, y que cazaron cuatro de cinco revisores por separado:
**nadie caminó el lado del cliente.** Dos rondas enteras de análisis sobre lo que
ve el coach, y ninguna sobre lo que le pasa a la persona que llega.

## 2. La tesis, y su objeción

**La tesis.** El día 1 VIVE no tiene demanda propia. El único que tiene clientes
reales es el coach: sus 4-10 personas que ya le pagan por transferencia. Eso no
es tráfico futuro, es GMV que existe hoy y está a un link de distancia. Con 10
coaches iniciales son decenas de transacciones reales en el mes 1, sin pauta y
sin SEO. Dicho crudo: **el día 1 VIVE no es un marketplace, es un riel de cobro +
video + notas para transacciones que ya existían afuera.**

El upside que lo hace algo más que un Calendly: **los clientes que el coach trae
son usuarios de VIVE desde el minuto uno.** Reservan con su coach y después ven
la app; esa persona vuelve a buscar para otro tema, otro momento. El coach paga
su propia adquisición y encima regala demanda cruzada. Es el playbook de
Calendly/Cal.com: la herramienta individual bootstrapea el marketplace, no al
revés.

**La objeción, que no tuvo respuesta en el consejo.** Si la jugada es que el
coach traiga su propia gente, entonces VIVE es un Calendly con comisión — y
🔴 **la comisión decreciente cobra el máximo justo en la primera sesión con
clientes que él ya tenía y que hoy le pagan el 100%.** Ese coach hace la cuenta
en la sesión 2 y se va. Es la medida anti-fuga #3 aplicada al usuario
equivocado.

**Es un problema de pricing, no de UI, y hay que resolverlo antes de pedirle al
coach que comparta el link.** Las salidas posibles, sin decidir: invertir la
escala para clientes importados (barato el primero, normal después), no cobrar la
primera sesión de un cliente que entró por su link, o distinguir en `bookings` el
origen del cliente y derivar la comisión de ahí.

📌 El corolario que desactiva la objeción por el otro lado: **si el cliente se
queda por VIVE y no solo por su coach, la comisión se defiende sola.** Eso
depende de qué ve esa persona al terminar la sesión 1 — y hoy no está diseñado.

## 3. Lo que se verificó contra el código

- ✅ Están `react-native-web` y `react-dom`; `app.json` tiene
  `web.output: "static"`. O sea: un build web es posible.
- 🔴 **No hay hosting ni dominio deployado.** No existe la ruta pública.
- 🔴 **No existe `coaches.slug`.**
- 🔴 **No hay lectura pública del perfil por anon** para esa ruta.
- 🔴 **`app.json` no tiene `associatedDomains` (iOS) ni `intentFilters`
  (Android)**: hoy un link no abre la app.
- ✅ El backend de la transacción está entero y probado con plata real: Mercado
  Pago marketplace, PayPal, USDT, reembolsos, disputas, videollamada (Daily),
  notas de sesión.

**Conclusión: es la única infraestructura NUEVA del lanzamiento.** Todo lo demás
del backlog es ejecución sobre cosas que ya existen. Por eso no se puede estimar
antes de decidir su forma.

## 4. La decisión que bloquea a las demás

🔴 **¿El link reserva y cobra en web, o solo muestra el perfil y manda a la
store?**

- **Si cobra en web:** el embudo se cierra en el navegador y la app queda para
  después de la reserva. Requiere hosting, checkout web y decidir qué riel de
  pago vive ahí. Es el camino que hace que el link sea un producto.
- **Si manda a la store:** el link es una landing y el embudo tiene un salto
  duro en el medio. Requiere deep links bien configurados para que la persona
  vuelva a caer en el coach correcto después de instalar — y aun así, cada paso
  corta.

⚠️ **Y hay un supuesto que nadie chequeó:** si la app todavía no está aprobada en
las tiendas, el segundo camino no lleva a ninguna parte.

## 5. El embudo, escrito entero

Lo que hoy no está caminado, paso por paso. Cada uno corta:

1. El coach comparte el link por WhatsApp. *(¿con qué texto? ¿lo escribe él?)*
2. La persona lo toca. *(¿qué ve: perfil, precio, horarios?)*
3. Instala / abre. *(salto duro si es por store)*
4. Se registra. *(¿mail, Google? ¿cuántos pasos?)*
5. 🔴 **Pasa el onboarding — que hoy está pensado para DESCUBRIMIENTO**, no para
   alguien que viene con nombre y apellido a ver a su coach de siempre. Es el
   paso más desalineado de todos.
6. Elige horario y paga.
7. Sesión.
8. 🔴 **Y termina la sesión, ¿y entonces qué?** Acá está el marketplace: *"viste
   ansiedad con Sofi, ¿querés ver quién trabaja sueño?"*. No existe.

## 6. Qué queda abierto

1. **La forma del link** (§4). Bloquea todo lo demás.
2. **La comisión sobre clientes importados** (§2).
3. **Un camino de onboarding corto para quien llega invitado**, distinto del de
   descubrimiento (§5.5).
4. **Qué ve el cliente al terminar la sesión 1** (§5.8).
5. **Sin dueño y anotado aparte:** no hay screening de coaches ni protocolo de
   crisis, en una app que toca ánimo bajo Ley 25.326.
