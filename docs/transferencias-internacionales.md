# Transferencias internacionales de datos — dónde está cada dato y con qué se ampara

> **01/09/2026.** Investigación hecha para responder la pregunta **A.3** de
> `paquete-abogado.md` sin depender de una consulta paga. **No es asesoramiento
> legal**: es el relevamiento de los hechos y de la norma aplicable, con las
> fuentes citadas, para poder decidir con fundamento. Lo que queda como riesgo
> residual está dicho al final, sin maquillar.
>
> Lo que motivó esto: la Política §7 dice hoy que Vita *"procurará que existan
> garantías adecuadas"*. Eso es una intención, no un instrumento, y mientras
> tanto la app transfiere dato sensible al exterior todos los días.

---

## 1. Qué dice la norma

**Ley 25.326, art. 12.** Prohíbe, como principio, transferir datos personales a
países que no tengan un nivel adecuado de protección. Admite excepciones, y las
dos que importan acá son el **consentimiento del titular** y que existan
**cláusulas contractuales u otros instrumentos** que garanticen un nivel de
protección equivalente.

**Disposición DNPDP 60-E/2016 — la lista de países adecuados.** Estados miembro
de la UE y del EEE, Reino Unido, Suiza, Guernsey, Jersey, Isla de Man, Islas
Feroe, Canadá (solo sector privado), Andorra, Nueva Zelanda, Uruguay e Israel
(solo datos con tratamiento automatizado).

> 🔴 **Ni Brasil ni Estados Unidos están en la lista.** Los dos países donde
> viven o por donde pasan los datos de Vita quedan del lado que necesita
> instrumento.

**Resolución AAIP 198/2023 — las cláusulas contractuales modelo.** Aprobó las
CCM de la Red Iberoamericana de Protección de Datos (RIPD), en dos variantes:
responsable→responsable y responsable→encargado. Tres cosas que verifiqué en el
texto de la resolución y que cambian el tamaño del problema:

1. **No son de uso obligatorio.** Son un mecanismo disponible entre varios
   (también valen las normas corporativas vinculantes, los códigos de conducta,
   u otro contrato). La propia AAIP las presenta como *"una alternativa
   económicamente viable"* para no tener que negociar acuerdos individuales.
2. **No derogan la Disposición 60-E/2016**: la complementan, y las dos coexisten.
3. **No hay obligación de registrar ni presentar el contrato ante la AAIP.** El
   articulado no la prevé.

⚠️ **Límite de esta investigación.** El contenido cláusula por cláusula de las
CCM está en el anexo de la resolución, un PDF de 109 páginas con fuentes
incrustadas que no pude extraer de forma confiable desde acá. Lo que sigue
compara **a nivel de principios y de obligaciones**, no palabra por palabra. Si
en algún momento hay presupuesto para una sola pregunta a un abogado/a, es
**esta**: si el DPA de Supabase satisface el estándar de las CCM argentinas.

## 2. Dónde está cada dato — verificado, no supuesto

| Proveedor | Qué recibe | Dónde queda | Sede |
|---|---|---|---|
| **Supabase** | 🔴 todo lo sensible: ánimo, diario, gratitud, contenido de los mensajes | **Brasil** — `sa-east-1`, São Paulo | EEUU |
| **Daily.co** | audio y video de las sesiones, **en tránsito** | **En ningún lado** (ver abajo) | EEUU |
| **Expo** | token del dispositivo + texto de la notificación | Token sí; **contenido no** | EEUU |
| **Mercado Pago** | datos de pago del riel en pesos | Argentina | Argentina |
| **PayPal** | datos de pago del riel en dólares | EEUU | EEUU |
| **Anthropic** | *(nada hoy — flag apagado)* | — | EEUU |

**Cómo se verificó cada fila:**

- **Supabase** — `supabase projects list` devuelve `"region":"sa-east-1"`. Es un
  dato de la consola, no una estimación.
- **Daily.co** — su documentación dice que *nunca* almacena audio, video ni
  pantalla compartida salvo a través de sus API de grabación. Y no las usamos:
  `supabase/functions/create-meeting-room/index.ts` crea las salas sin
  `enable_recording`. O sea que Daily **transporta y no conserva**. Sí guarda
  logs de acceso (metadatos) en AWS.
- **Expo** — guarda el token del dispositivo porque sin él no puede entregar la
  notificación; el **contenido** va por memoria y colas hasta pasárselo a Apple o
  Google, y no se persiste en una base.

## 3. Qué instrumento existe hoy para cada uno

### Supabase — probablemente ya cubierto, y sin haber firmado nada

Su **Data Processing Addendum** (v1, 01/08/2026):

- **Se incorpora solo.** La cláusula 12.2 dice que aceptar el acuerdo tiene el
  mismo efecto que firmar las cláusulas contractuales tipo. Para clientes
  self-serve no hay PDF que firmar — y por eso tampoco hay uno en la carpeta.
- **Incorpora las SCC de la UE** (Decisión de Ejecución 2021/914), Módulos Dos
  (responsable→encargado) y Tres (encargado→subencargado).
- **Obligaciones que asume**, y que son las que hay que comparar contra el
  estándar argentino:

| Obligación | Qué dice el DPA |
|---|---|
| Confidencialidad | personal con acceso mínimo necesario y deber de confidencialidad |
| Seguridad | Schedule 1: AES-256, TLS 1.2, acceso mínimo, auditorías |
| Subencargados | autorización general sobre lista publicada, contrato equivalente, **Supabase responde por ellos** |
| Derechos del titular | asiste al responsable a responder solicitudes |
| Brechas | **notificación en 48 horas** + asistencia en la investigación |
| Fin del contrato | retención 30 días y después eliminación completa |
| Auditoría | SOC 2 / ISO 27001, más una auditoría anual |

- 📌 **Y una cláusula que conviene tener presente: la 6.1.** Si el cliente
  indica una región geográfica, Supabase se obliga a almacenar y procesar
  principalmente ahí. Vita eligió `sa-east-1`, así que la permanencia en Brasil
  no es una casualidad de configuración: es contractual.

**Lectura:** el contenido cubre lo que la Ley 25.326 le pide a un instrumento de
transferencia — finalidad limitada, seguridad, confidencialidad, subencargados,
derechos del titular, devolución/supresión. La Res. 198/2023 admite
expresamente un contrato distinto del modelo, y este lo es.

### Daily.co — exposición baja, pero hay que aceptar el DPA

Ofrece DPA y aparece alineado con el Data Privacy Framework. **No almacena** el
contenido de las sesiones, así que lo que hay que amparar es el **tránsito** y
los logs de acceso, no un depósito de dato sensible. Falta confirmar cómo se
acepta su DPA en nuestra cuenta.

### Expo — el dato es mínimo

Actúa como encargado, cumple GDPR/CCPA/**Data Privacy Framework**, y publica su
lista de subencargados en `/privacy/subprocessors`. Lo único que persiste es el
token del dispositivo. Falta confirmar si hay DPA para aceptar.

### Mercado Pago y PayPal — otro encuadre

Procesan pagos por cuenta propia y bajo su propia normativa; no son encargados
de Vita en el sentido del art. 12. Van declarados en §6 como destinatarios, pero
no son el problema de este documento.

## 4. Lo que hay que hacer

Ninguno de estos pasos necesita un abogado. Los cuatro primeros los podés hacer
vos en una tarde.

- [ ] **1. Guardar copia fechada del DPA de Supabase**, del de Daily y del de
      Expo, con la fecha en que se aceptaron los términos. No hay firma que
      exhibir, así que la constancia es la copia + la fecha de alta de la cuenta.
- [ ] **2. Bajar las CCM de la Res. AAIP 198/2023** y tenerlas en el repo. Si
      alguna vez hay que reforzar el amparo de un proveedor, esa es la
      herramienta y es gratis.
- [ ] **3. Confirmar el DPA de Daily y de Expo** — escribirles y preguntar cómo
      se acepta en la cuenta. Es un mail.
- [ ] **4. Reescribir Política §6 y §7** con el texto de abajo, y correr
      `npm run sync:legal`.
- [ ] 5. Evaluar **mover la base a una región europea**. La UE **sí** está en la
      lista de la AAIP, así que eso haría desaparecer el problema para la
      transferencia que más importa, en vez de ampararlo. Técnicamente es una
      migración, no un rediseño. ⚠️ Contra: latencia desde Argentina. A favor:
      es la única opción que **elimina** la pregunta en lugar de contestarla.

## 5. Texto propuesto para la Política

Reemplaza el `[Validar con abogado…]` de §7 por algo verificable. **No afirma
nada que no sea cierto hoy**, que es la única regla que no se negocia acá.

> ### 7. Transferencia Internacional de Datos
>
> Parte de los datos se almacenan o procesan fuera de la Argentina:
>
> - **Supabase** (base de datos, autenticación y almacenamiento): los datos se
>   alojan en la región de **San Pablo, Brasil**.
> - **Daily.co** (videollamadas): el audio y el video **no se graban ni se
>   almacenan**; se transmiten en el momento de la sesión. Se conservan
>   metadatos técnicos de conexión.
> - **Expo** (notificaciones): se conserva el identificador del dispositivo; el
>   contenido de la notificación no se almacena.
> - **PayPal** (pagos en dólares): en los Estados Unidos, conforme sus propias
>   políticas.
>
> Brasil y Estados Unidos no integran la nómina de países con nivel adecuado de
> protección de la Disposición DNPDP 60-E/2016. Para esas transferencias Vita se
> ampara en los acuerdos de tratamiento de datos suscriptos con cada proveedor,
> que incorporan cláusulas contractuales de protección equivalentes a las
> previstas en la Resolución AAIP 198/2023, e incluyen obligaciones de
> confidencialidad, medidas de seguridad, control de subencargados, asistencia
> en el ejercicio de derechos del titular, notificación de incidentes y supresión
> de los datos al finalizar el servicio.
>
> El Usuario puede solicitar información sobre estos acuerdos escribiendo a
> vitaappar@gmail.com.

Y en **§6**, agregar la fila que falta:

> - **PayPal** — procesamiento de los pagos en dólares (sujeto a sus propias
>   políticas).

⚠️ **Anthropic NO se declara todavía.** El flag está apagado y no recibe nada.
Declarar un destinatario que no recibe datos es tan falso como omitir uno que sí.
Se agrega el día que se encienda, no antes.

## 6. Un punto que no estaba en el paquete

**Acceso desde Australia.** Joaquín trabaja desde allá y accede a la base de
producción. Australia **tampoco** está en la lista de países adecuados. Es un
supuesto distinto del de los proveedores —es personal propio, no un encargado—
pero es el mismo capítulo de la ley y conviene resolverlo en el mismo movimiento:
o se documenta como acceso interno con las mismas garantías, o se limita el
acceso a datos de producción. Lo primero es más realista.

## 7. Riesgo residual, dicho sin maquillar

Lo que esta investigación **no** cierra:

1. **Si el DPA de Supabase satisface el estándar argentino.** La Res. 198/2023
   admite contratos distintos del modelo siempre que reflejen los mismos
   principios, y el de Supabase los refleja — pero la comparación cláusula por
   cláusula contra el anexo no la pude hacer. Es una posición defendible, no una
   certeza.
2. **Si el consentimiento de Política §3 alcanza** para dato sensible, o hace
   falta uno específico. Es la pregunta **A.2** y sigue abierta.
3. **Cuánto pesa la sede del proveedor** además de la ubicación del servidor.
   Supabase es estadounidense aunque el dato esté en Brasil.

Aun con eso: la situación **después** de aplicar la sección 4 es
incomparablemente mejor que la de hoy, donde el amparo es la palabra
*"procurará"*. Pasar de ninguna garantía documentada a un DPA con obligaciones
concretas, copia fechada y un texto público que describe la realidad es el tramo
grande. Lo que queda es afinado.

📌 **Y hay una consulta gratis disponible:** la AAIP atiende consultas de
responsables de bases de datos. Es la autoridad que aplicaría la norma, así que
para los puntos 1 y 2 su respuesta vale más que una opinión privada. Vale
preguntarle antes que a nadie.

---

## Fuentes

- Ley 25.326, art. 12 — transferencia internacional.
- [Disposición DNPDP 60-E/2016](https://www.argentina.gob.ar/normativa/nacional/norma-267922/texto) — nómina de países adecuados y contratos modelo.
- [Resolución AAIP 198/2023](https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-198-2023-391538/texto) — aprobación de las CCM de la RIPD.
- [AAIP — Transferencias internacionales](https://www.argentina.gob.ar/transferencias-internacionales).
- [Guía de Implementación de CCM para TIDP (RIPD)](https://www.argentina.gob.ar/sites/default/files/guia_de_implementacion_de_clausulas_contractuales_modelo_de_transferencias_internacionales_de_datos_personales_tidp.pdf) — anexo de la Res. 198/2023.
- [Supabase — Data Processing Addendum](https://supabase.com/legal/customer-resources/data-processing-addendum).
- [Daily.co — Data Protection](https://www.daily.co/security/data-protection/).
- [Expo — Privacy Explained](https://expo.dev/privacy-explained) y [Security & compliance](https://expo.dev/security).
