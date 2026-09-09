# Problemas abiertos — registro con IDs estables

> **08/09/2026.** Consolida lo que salió de: los tres consejos asesores
> (`consejo-sofia.md` y los dos de esta sesión), la devolución de Mónica Grando,
> la primera prueba en dispositivo del piso de seguridad, y la auditoría de las
> 22 frases visibles.
>
> 🔴 **Los IDs son estables y sirven para hablar por número** (*"cerremos B2"*).
> Si algo se resuelve, se marca acá — no se borra.
>
> Marcado: ✅ **verificado contra el código o la base** · ⚠️ **hipótesis sin
> verificar** · 🔴 **sin solución conocida**.

---

## A. Exposición — no es producto, es riesgo vivo

**Nada de las secciones B–F vale más que esto.** La revisión de ejecutabilidad
lo dijo así: *"las cinco respuestas debaten calidad de frases mientras hay riesgo
de seguridad y plata real corriendo sin auditar"*. Un equipo grande paraleliza;
dos hermanos no.

| ID | Problema | Solución | Costo |
|---|---|---|---|
| **A1** | ⏭️ **ASIGNADO A JOAQUÍN el 08/09** (device review). 🔴 **Dos de las tres ramas del piso de seguridad nunca se probaron.** Es la única feature que le habla a alguien en crisis. ✅ El 07/09 una hora de teléfono encontró un bug que **540 tests no vieron** (le prometía una sesión inexistente), porque el bug no estaba en una función sino en la relación entre dos partes de una pantalla. | Forzar los dos casos que faltan: sin ninguna sesión, y con una agendada. | 15 min |
| **A2** | ⏸️ **DECIDIDO el 08/09: se queda hasta el lanzamiento.** Es **"Coach Prueba"** (`e58d2ec3`, especialidad *"Especialidad de prueba"*), `verified` y `activo`, con MP conectado y `price_per_session = 1` — `mp-create-payment` deriva el precio de esa columna, así que cobraría $1 real. **Andre lo deja porque hace falta un coach para ejercitar los flujos, y con cero usuarios el riesgo es cero.** 🔴 **El riesgo no es tenerlo: es olvidárselo el día que abran** — y ya llevaba varias sesiones apareciendo en "pendiente" sin que eso lo moviera. | ✅ **Mitigado, no resuelto: `scripts/verificar-pre-lanzamiento.sql`** (solo lectura, 5 chequeos, devuelve filas solo si hay problema). Correrlo con la service key **antes de dejar entrar a la primera persona** deja de depender de que alguien se acuerde. | — |
| **A4** | ⏭️ **ASIGNADO A JOAQUÍN el 08/09.** 🔴 **`authenticated` puede leer las 17 columnas de `profiles` de TODOS los coaches** — mail y `push_token` incluidos. El agujero que se cerró para `anon` ese mismo día **está a un registro de distancia**. | No es de dos líneas: hay que mover al servidor el envío de push (client-side en 6 lugares) y la lectura de mails del panel, y después una vista pública para el catálogo. **Receta abajo.** | Media sesión larga |
| **A5** | ⏭️ **ASIGNADO A JOAQUÍN el 09/09.** 🔴 **El camino del cliente #1 está construido entero y hay tres cosas que solo se prueban con un teléfono y plata.** Sin eso no se puede prender `CHECKOUT_HABILITADO`. | Tres pruebas cortas. **Receta abajo.** | Una hora, más la del 18 |
| **A3** | **Nullability de `price_per_session` sin confirmar.** El guard que se agregó al buscador es necesario o decorativo, y no sabemos cuál. ⚠️ El endpoint OpenAPI de PostgREST exige `service_role`. | Una consulta con la service key. | 2 min |

### A1 — receta para Joaquín (device review del piso de seguridad)

> **HECHO (09/09, Joaquín) — CERRADO.** Se probaron en dispositivo los TRES
> estados, y los tres consistentes con la sección "Tu próxima sesión" de abajo
> (que es donde vivía el bug del 07/09):
> · Estado 1 (completada esta semana, ninguna agendada) → *"Eso es de lo que
>   conviene hablar en sesión"*, abre `/ayuda`. ✅
> · Estado 2 (confirmada futura) → *"Llevalo a tu próxima sesión"* y abajo aparece
>   esa sesión — el estado que **no había visto nadie**. ✅
> · Estado 3 (ni confirmada futura ni completada en 7 días) → *"Hay gente
>   preparada para acompañar esto"*, vacío abajo. ✅
> El bug del 07/09 (la tarjeta contradiciendo la sección de abajo) está corregido
> en los tres. **Persistencia "al día siguiente": garantizada por construcción** —
> la tarjeta sale pura de `detectarPisoSeguridad(...)`, sin ningún flag de
> "ya vista/descartada" en `index.tsx`, así que reaparece cada día que la
> condición se cumpla; el modo de falla de "noticia que se muestra una vez" no
> existe. Data de prueba (5 check-ins bajos + fechas de reserva) revertida. Y los
> teléfonos de `/ayuda` marcan de verdad (verificado). Nada queda abierto de A1.

> Andre lo dejó para vos el 08/09. **Contexto en una línea:** el piso de
> seguridad —la única pantalla que le habla a alguien en crisis— se encendió en
> producción el 07/09 y **solo se vio correr una de sus tres ramas**. Esa prueba
> encontró un bug que 540 tests no habían visto.

**Setup, una sola vez:** los 5 registros bajos ya están cargados (dentro de los
14 días). Abrí la app y **tocá Bajón** para que haya check-in de hoy — sin eso la
tarjeta muestra su estado neutro y no se ve nada.

⚠️ El `user_id` de las consultas es el de Andre
(`8b16e5b7-e0e3-4988-9ccc-f8ba447fcb8c`); si probás con tu cuenta, cambialo y
cargá primero los 5 registros bajos (5 días distintos dentro de 14, todos en 1
o 2, y que sean **los 5 más recientes**).

**Son TRES estados, no dos** — el fix del 07/09 cambió lo que sale con la
configuración actual, así que ese tampoco está confirmado:

| # | qué tiene que decir | setup |
|---|---|---|
| 1 | *"Eso es de lo que conviene hablar **en sesión**."* | **Ninguno.** Es lo que sale con sesión completada esta semana y ninguna agendada. 🔴 Ayer en ese mismo estado salía *"Llevalo a tu próxima sesión"* mientras abajo decía "Sin sesiones agendadas" — **ese era el bug**. |
| 2 | *"**Llevalo a tu próxima sesión**."* | Una reserva `confirmada` con fecha ≥ hoy (ver SQL abajo). **Nadie la vio nunca.** |
| 3 | *"**Hay gente preparada para acompañar esto**."* | Ninguna `confirmada` futura **ni** ninguna `completada` en los últimos 7 días. |

```sql
-- Ver dónde estás parado
select id, scheduled_date, status from bookings
where user_id = '8b16e5b7-e0e3-4988-9ccc-f8ba447fcb8c'
order by scheduled_date desc limit 5;

-- Estado 2: una confirmada a futuro
update bookings set scheduled_date = current_date + 2, status = 'confirmada'
where id = 'PEGÁ_UNO_DE_ARRIBA';

-- Estado 3: sin nadie. Mueve fechas al pasado en vez de borrar, así se revierte.
update bookings set scheduled_date = current_date - 30
where user_id = '8b16e5b7-e0e3-4988-9ccc-f8ba447fcb8c'
  and scheduled_date >= current_date - 7;
```

**Qué mirar en los tres:**

- El CTA dice **"→ Si lo necesitás, hay líneas de ayuda"**, no *"Ver más"*.
- **Tocarla abre `/ayuda`**, no el momento a pantalla completa con *"Ver mi
  progreso completo"* — ofrecerle eso a alguien que lleva dos semanas en el fondo
  era el agujero que se tapó el 07/09.
- 🔴 **Que no se contradiga con la sección de abajo** ("Tu próxima sesión"). Ese
  fue exactamente el bug del 07/09 y es el que más fácil vuelve: **el bug no
  estaba en una función, estaba en la relación entre dos partes de la pantalla**,
  que es lo que ningún test puede ver.
- Que los teléfonos de `/ayuda` **marquen** de verdad.
- **Al día siguiente: que siga apareciendo.** No es una noticia que se muestra
  una vez — tiene que estar todos los días que dure la condición.

📌 No interfiere el aviso nuevo de `recurso-del-coach` aunque tengas
recomendaciones sin abrir: el piso le gana.

### A5 — receta para Joaquín (las pruebas que faltan del checkout web)

> Andre te las dejó el 09/09. **Contexto en una línea:** ese día se construyó y
> se probó el camino entero del cliente que entra por el link del coach —
> `/c/<slug>` → horario → código por mail → pago → `/reserva` → sala web — y
> quedaron tres cosas que **no se pueden verificar sin un teléfono y plata
> real**.
>
> 🔴 **Mientras no estén, `CHECKOUT_HABILITADO` no se prende** (está en
> `web/c/index.html`). Con el interruptor apagado la página muestra perfil y
> horarios pero no pide nada; con `?probar=1` se enciende **solo para vos**, y
> avisa en rojo que la reserva y el cobro son reales.

**Lo que ya está probado y no hace falta repetir** (09/09, con plata real): la
reserva se crea, el pago se acredita, el horario desaparece de los disponibles,
`/reserva` muestra el estado, y **los dos mails llegan** — "Recibimos tu reserva"
al instante y "Sesión confirmada" por el cron, a bandeja principal.

#### Prueba 1 — el checkout, otra vez, mirando el nombre

El 09/09 la prueba salió bien salvo una cosa: **el coach veía "Alguien"** en vez
del nombre de quien reservó. La cuenta nace del código, que solo pedía el mail,
así que `profiles.name` quedaba vacío. Se arregló pidiendo el nombre, **y ese
arreglo no se volvió a probar.**

1. `vitaapp.com.ar/c/coach-prueba?probar=1` — es el único con horarios cargados,
   y su precio es **$1**.
2. Elegí un horario, poné **nombre y mail** (usá un alias `+algo` de tu Gmail),
   aceptá los Términos, confirmá el código, pagá.
3. 🔴 **Entrá a la app como coach y mirá la tarjeta "espera tu respuesta":
   tiene que aparecer TU NOMBRE**, no "Alguien". Eso es lo único nuevo a probar.
4. De paso: que la card esté **debajo** de "Tu próxima sesión" (decisión de Andre
   del 09/09), y que al tocar Aceptar desaparezca.

#### Prueba 2 — la videollamada, el 18/09 a las 11:00

Es la única parte del camino que **nunca se ejercitó**, y solo se puede el día de
la sesión: la sala se abre 15 minutos antes.

1. **Vos como cliente**, desde el navegador: `vitaapp.com.ar/sala?booking=<id>`.
   El link también llega en el mail de "Sesión confirmada".
   ⚠️ **Te va a pedir el código de nuevo, y es normal**: el token de acceso dura
   una hora, así que quien entra el día de la sesión siempre se re-identifica. Si
   eso se siente mal, decilo — es lo primero que revisaríamos.
2. **El coach desde la compu**: en el Inicio, tarjeta de la próxima sesión,
   **"Hacerla desde la computadora"** → comparte el link, lo abrís en el
   escritorio. Es como va a trabajar de verdad: la app es solo móvil y nadie da
   una sesión de una hora con el teléfono en la mano.
3. Que **se vean y se escuchen las dos puntas**. Ahí el camino está cerrado.

#### Prueba 3 — cuánto cobra Mercado Pago de verdad

📊 **Todo el desglose que el coach ve en "Cómo te pagamos" depende de un número
medido sobre un pago de $1**: `mercadopago_fee` 0,04 sobre 1,00, o sea ≈4%. A ese
monto, cualquier componente fijo de la tarifa distorsiona el porcentaje.

Buscá en el panel de Mercado Pago el pago **de $4.500 del 19/08/2026** (segunda
sesión pagada de verdad, par Joaquín + Coach Prueba) y mirá el desglose:

- cuánto se llevó **Mercado Pago**,
- cuánto se llevó **VIVE** (`application_fee`),
- cuánto quedó **neto para el coach**.

Si el porcentaje de MP no da ~4%, hay que actualizar `MP_FEE_PCT_OBSERVED` en
`lib/pricing.ts` — y con él cambia lo que la app le promete al coach.

#### Y una cosa de DNS, si te queda a mano

**Falta el DMARC** de `vitaapp.com.ar`. Sin él, Gmail y Yahoo son más duros con
un remitente nuevo y los mails pueden caer en spam — que es peor que no llegar,
porque parece que funcionó. La zona vive en **Vercel** (no en DonWeb, ver
`docs/hosting.md`): un TXT en `_dmarc` con

```
v=DMARC1; p=none; rua=mailto:andrealbisu@gmail.com
```

`p=none` no rechaza nada, solo reporta.

### A4 — receta para Joaquín (`authenticated` lee el mail de todos los coaches)

> **ESTADO (09/09, Joaquín): FASE 1 HECHA.** El envío de push se movió al server:
> nueva edge function `send-push` (validada por contexto — el que llama tiene que
> compartir sala o booking con el destinatario, cierra el vector de spam), y los
> 9 reads client-side de `push_token` (5 archivos) pasan por ella vía
> `notifyViaServer` en `lib/notifications.ts`. `sendPushNotification` (envío
> directo) se borró. Deployada y verificada con JWT real: sala/booking ajenos →
> 403, sin auth → 401. tsc 0, 570 tests. Push confirmado en dispositivo.
>
> **FASE 2 HECHA (09/09).** La única lectura de admin que traía el MAIL del coach
> (`listCoachApplications`, `profiles!inner(name, email)` desde `lib/admin.ts`)
> pasó a `admin-actions` (nueva acción `list_coach_applications`, tras confirmar
> `is_admin`, con service role). Verificado: un no-admin recibe 403. Los otros
> reads directos de admin son `name` (reports) o `paypal_email` de otra tabla,
> fuera del scope de A4. Confirmado además que la query directa
> `coaches`→`profiles.email` TODAVÍA devuelve filas para un `authenticated`
> no-admin: eso es lo que cierra la fase 3.
>
> **FASE 3 HECHA (09/09) — A4 CERRADO.** `authenticated` ya no puede leer `email`
> ni `push_token` de `profiles`. `scripts/restrict-authenticated-profiles-columns.sql`:
> se le sacó el SELECT a nivel TABLA (era `authenticated=ardm`, un grant de tabla
> cubre todas las columnas y no se puede revocar un subconjunto) y se re-granteó
> el SELECT de las 15 columnas restantes. Efecto lateral bueno: al pasar de tabla
> a columnas, una columna sensible NUEVA en `profiles` ya no queda legible sola
> (cierra la asimetría de la 207, para `profiles`).
>
> **Decisión (Joaquín, 09/09): revoke-only en vez de la vista.** La auditoría
> mostró que NADA client-side lee `email`/`push_token` de `profiles` (ni de otros
> ni de la fila propia — el mail propio sale de la sesión de auth; el push_token
> solo se ESCRIBE), y que los 4 lectores del catálogo piden solo columnas seguras.
> Así que el revoke de las dos columnas cierra el agujero sin tocar el catálogo ni
> el código. La trampa del FILTRO se auditó: `RegisterScreen` ya no filtra por
> `email` (usa la RPC `email_es_de_coach` desde la 206), y nada más filtra por
> esas columnas.
>
> ✅ Verificado en vivo con JWT `authenticated` real: `coaches→email` y
> `push_token` → **42501**; catálogo (coachesCache/search3) y columnas seguras de
> la fila propia → **OK**. Sin cambios de código de app.
>
> 🟡 **QUEDA COMO MEJORA APARTE, PARA ANDRE — la vista pública.** No cierra nada de
> A4 (ya cerrado), pero taparía además `is_admin`, `birth_date` y `nationality` de
> `authenticated` y sería a prueba de columnas futuras. No se hizo ahora porque el
> catálogo embebe `profiles` vía PostgREST desde `coaches` (`profiles!inner(...)`),
> y repuntarlo a una vista es un refactor con riesgo de regresión en búsqueda/
> catálogo — territorio de arquitectura de Andre. 🔴 Esas tres columnas NO se
> pueden revocar sin la vista: los grants son por rol y `EditProfileScreen` lee
> `birth_date/gender/nationality` de la fila PROPIA.

> Andre lo dejó para vos el 08/09. **Contexto en una línea:** ese día se cerró
> que **cualquiera con la anon key** pudiera leer el mail y el `push_token` de
> los 34 coaches, y quedó abierto que **cualquiera con una cuenta** todavía
> puede. Es el mismo agujero, una puerta más adentro.

**Por qué importa más de lo que parece un dato de contacto.** No es solo
privacidad: **es la estrategia anti-fuga al revés.** Con una cuenta gratis,
una plataforma competidora se baja el roster entero de VIVE con los mails y les
escribe uno por uno. Es el activo más difícil de construir que tenemos.

**Lo que ya está hecho y no hay que rehacer** (sesión 205):
- `anon` quedó con **`id`, `name`, `avatar_url`, `gender`** y nada más, por
  grants de columna (`scripts/restrict-anon-profiles-columns.sql`, corrido).
- Verificado que la RLS **sí** está bien: las cuatro policies de `profiles` no
  le dejan a un usuario logueado leer perfiles de **otros usuarios**. El
  problema es solo con las filas de coaches, por la policy *"Perfiles de coaches
  visibles para todos"* (`role = 'coach' OR auth.uid() = id`).

**El problema de fondo, que es el que define la solución.** Con grants de
columna **no se puede decir "tu propia fila entera, la de los coaches solo
cuatro campos"**: los grants son por ROL, no por fila. Por eso no alcanza con
repetir lo que se hizo con `anon`.

**El orden importa — al revés se rompen las notificaciones de reserva que se
arreglaron el mismo día (sesión 201, ya deployada).**

1. **Mover el envío de push al servidor.** Hoy es client-side en **6 lugares**:
   `lib/coachBookingActions.ts` (×2), `lib/bookingCancel.ts`,
   `screens/SalaScreen.tsx` (×2), `screens/BookingScreen_Confirm.tsx` y
   `screens/CoachReservasScreen.tsx`. En todos, **el que manda lee el
   `push_token` del que recibe desde el dispositivo**. El patrón a copiar ya
   existe y anda: `supabase/functions/_shared/booking-effects.ts` manda push con
   service role.
2. **Mover la lectura de mails del panel de admin.** `lib/admin.ts` lee
   `profiles!inner(name, email)` desde el cliente; va a `admin-actions`, que ya
   corre con service role.
3. **Recién ahí**, achicar lo que ve `authenticated`. La salida correcta es una
   **vista pública** para el catálogo (`id, name, avatar_url, gender` de los
   coaches) y dejar la tabla `profiles` para la fila propia. Hay que repuntar
   `coachesCache`, `search3`, `ProfesionalScreen` y `FavoritosScreen` a la vista.

🔴 **La trampa que ya pisamos una vez, no la pises de nuevo.** Al sacarle
`email` a `anon` se rompió `RegisterScreen`, que **filtraba** por esa columna
(`.eq('email', …)`): **filtrar por una columna exige SELECT sobre ella**, no
solo seleccionarla. Y **falló abierto** —el código descartaba el error— así que
no se vio hasta el barrido. Antes de tocar grants, buscá quién FILTRA por la
columna, no solo quién la selecciona. Se arregló con una función
`security definer` (`scripts/add-email-es-de-coach.sql`).

📌 **Cómo verificar sin adivinar:** el `.env` tiene la anon key, y con `curl`
contra `/rest/v1/` se prueba exactamente lo que ve un atacante. Es como se
verificaron los tres scripts de ese día. Para el rol `authenticated` hace falta
una sesión real, así que ahí sí conviene el teléfono o un token de prueba.

### Lo demás de device review, también de Joaquín

Viene arrastrándose de las sesiones 157-163 y ninguna se cerró:

- 🔴 **Matrícula en vivo** — cargar una credencial, aprobarla desde admin, ver que
  `has_matricula` pasa sola a `true` y aparece la insignia. **Es lo único de todo
  el backlog que no se puede verificar estáticamente**; el pre-flight ya validó
  las 4 superficies y el trigger por lectura. Hoy 0 coaches con matrícula, así
  que nada lo ejercita.
- ✅ **Cancelación tardía — HECHO (09/09), verificado en dispositivo + base.**
  Usuario canceló una confirmada a ~2hs (pago aprobado): el trigger
  `mark_refund_on_cancel` marcó `cancelled_late = true` y dejó `payment_status`
  en `aprobado` (NO `reembolso_pendiente`) — o sea que **no se disparó reembolso**,
  y el mensaje al usuario fue el de política ("cancelaste con menos de 24hs… no
  corresponde reembolso"). Era el camino que toca plata y no se había ejercitado
  nunca. Data de prueba revertida (reserva a confirmada / 09-26).
- **Diario nuevo** (el colapso con el teclado, que la franja se llene sola al
  guardar), **"Sobre vos" early**, y ~~**el aviso de `recurso-del-coach`**~~.
  - ✅ **`recurso-del-coach` HECHO (09/09) — con bug encontrado y arreglado.** La
    tarjeta *"Tu coach te dejó algo"* aparece bien con una recomendación en
    `opened_at = null`, y tocarla lleva a `mis-recomendaciones`. 🔴 **Pero al
    abrir las recomendaciones y volver a Inicio, la tarjeta SEGUÍA** — `opened_at`
    se marcaba bien en la base, pero `useWeeklySignals` cargaba una sola vez y no
    re-leía al volver a foco (Inicio es tab, no re-monta). **El mismo bug que
    `useMoodHistory` en la 191.** Arreglado igual: `refetch` en el hook +
    `useFocusEffect` en `index.tsx`. `tsc` 0, 570 tests.
  - **Matrícula en vivo** y **Diario nuevo** de arriba: ya cerrados por Joaquín en
    la sesión 191 (este doc los listaba sin saberlo).

---

## B. La arquitectura de la voz — el hallazgo de raíz

| ID | Problema | Solución propuesta |
|---|---|---|
| **B1** | 🔴 **La tarjeta es AUTORA: cada día tiene que inventar algo con casi ninguna entrada.** De ahí salen el horóscopo, la absolución sistemática y que el modelo copie los ejemplos del prompt. El outsider: *"a la segunda semana la esquivo con la vista, como los banners de «completá tu perfil»"*. | **Volverla MENSAJERA.** Hay cosas reales para entregar que no necesitan ni memoria ni texto libre. **Resuelve B2, B3 y B5 de una**, y da vuelta el techo del apego: si el vínculo se ata al paquete y a lo que manda el coach, **el apego empuja hacia el profesional en vez de competir con él.** |
| **B2** | ✅ **RESUELTO el 08/09.** Nueva señal `recurso-del-coach` en el motor: si hay una fila con `opened_at IS NULL`, la tarjeta avisa y tocarla lleva a `/mis-recomendaciones`. ~~Movimiento 5 (acercarte un recurso): 0 de 22 frases.** ✅ **VERIFICADO: `resource_recommendations` existe con 7 filas reales** — un profesional elige un recurso para una persona, con nota, y queda registrado si se abrió. Tiene pantalla propia (`app/mis-recomendaciones.tsx`). **La tarjeta no la mira nunca.** | ✅ Hecho. 📌 **NO dependía de E1** (un coach recomienda desde el catálogo que ya existe; cómo crece el catálogo es otra pregunta). 📌 **La dependencia del guardarraíl se resolvió mejor de lo previsto:** en vez de un flag en los `facts`, la señal **no la escribe un modelo** —es un aviso, no una devolución— así que no viaja ningún dato nuevo, y `ACOMPANANTE` acepta `recurso-del-coach` como prueba de que el coach existe. ⚠️ **Lo cazó un test, no una revisión.** |
| **B3** | **El paquete para la sesión vive aislado.** Usa el mismo material crudo que la tarjeta (check-in, diario, gratitud) y nunca se tocan. Es **lo único que un usuario de prueba validó sin que se lo pidieran** (*"buenísimo, lo usaría"*). | Que la tarjeta lo empuje cuando hay sesión cerca. Le da un propósito verificable en vez de una frase linda que se ignora. |
| **B4** | 🔴 **Movimiento 1 (recordar) imposible: la tarjeta no sabe qué dijo ayer.** §3.1 lo pide desde el 28/08 y nada lo implementa. Sin él, los movimientos 2 a 5 no tienen de qué agarrarse. | ⚠️ **Cuidado con la solución fácil.** La adjudicación separó dos ejes que veníamos mezclando: **la falla es "cero memoria", no "cero texto"**. Pero **memoria de señales NO es gratis**: una trayectoria de meses de ánimo día a día es un perfil longitudinal y **singulariza igual que un diario**, aunque no haya una palabra escrita. Que viva solo en el teléfono cambia el análisis **legal**, no el ético. 📌 **La versión mínima segura: aflojar la VENTANA, no guardar historia** — mandar un agregado de 7 días (*"bajón sostenido"*) en vez de números sueltos de hoy. |
| **B5** | **El modelo escribe a ciegas.** Nunca ve la frase de las reglas; recibe `señal / tono / dos números` y escribe una alternativa que reemplaza entera o se descarta entera. ✅ Por eso, en tres corridas de ensayo, **copió los ejemplos del prompt textualmente**. | Con B1 el modelo pasa a **anunciar en vez de inventar**, que es lo que sí sabe hacer con poca entrada. |
| **B6** | ~~⚠️ Hipótesis: los 14 guardarrales premian lo genérico~~ ✅ **DESCARTADA el 08/09, y el resultado es bueno: los guardarrales NO bloquean los movimientos que faltan.** Prueba de resta empírica — **11 de 11 frases candidatas pasan**: la expectativa (*"Eso no te lo dio nadie"*), la confianza con evidencia (*"Ya saliste de tramos así antes"*), el recurso, el paquete, la memoria, y hasta el humor liviano. Los dos controles (elogio vacío, consejo) se rechazan como corresponde. | 🔴 **El diagnóstico correcto es más simple y más barato: nadie las escribió.** Los guardarrales eliminan los gestos cálidos **baratos** —elogiar, aconsejar, prometer, fingir sentir— y dejan **absolver** como el camino de menor resistencia: es cálido, no requiere saber nada de la persona, y **ninguna regla lo apunta**. No es que el filtro castigue la especificidad: es que la especificidad **cuesta escribirla** y la absolución no. **C1 y C2 quedan DESBLOQUEADOS.** |
| **B7** | 📌 **El error de raíz, dicho con precisión** (adjudicación de privacidad): *"calcaron el modelo de voz de alguien que **sí recuerda** sobre un sistema que decidió no hacerlo"*. | Existe una versión honesta que no pide saber más: **acompañamiento por presencia, no por historia** — reconocer el patrón de hoy sin comparar contra ayer. No finge una memoria que no tiene. |

---

## C. El contenido de las 35 frases

✅ **DESBLOQUEADO el 08/09 por B6.** Se verificó que los guardarrales no impiden
ninguno de los movimientos que faltan: **reescribir el banco sí va a funcionar.**
Lo que falta es escribirlas, no arreglar el filtro.

| ID | Problema | Solución |
|---|---|---|
| **C1** | ✅ **RESUELTO el 08/09: de 10 absoluciones sobre 22 a 5.** Se reescribieron 7 frases. Las que quedan absolviendo son las que corresponde (un día que recién se cayó, una semana pareja) — no se eliminó el gesto, se dejó de ser el default. ~~10 de 22 frases "absuelven"~~ (*"no le debés nada a nadie"*, *"no todas tienen que rendir"*, *"está bien que algunas sean así"*). Es la categoría **más grande**, y no es ninguno de los cinco movimientos. **El sistema inventó un sexto movimiento que nadie pidió**, porque es el único ejecutable sin saber nada de la persona. | Rebalancear la distribución a mano. Después de B6. |
| **C2** | ✅ **RESUELTO el 08/09: de 1 sobre 22 a 8.** Ahora aparece en `sharp-drop`, `sustained-low` (×2), `trend-down`, `sessions`, `streak` (×2) y `level`. ~~Movimiento 4: 1 de 22.~~ Es el movimiento central del modelo de voz y aparece en una sola frase, escrita el 07/09. | Idem. |
| **C3** | ✅ **RESUELTO el 08/09: el toque lleva al Diario con esa pregunta.** El buzón ya existía y nadie los había unido. Y lo que se escriba ahí **termina en el paquete que va al profesional**, así que la pregunta no muere en la app. ~~Hace preguntas y no hay dónde contestarlas.~~ 7 de 22 preguntan al vacío. El outsider: *"es como si alguien te pregunta algo en la calle y se va caminando. **Si no hay buzón, no preguntes.**"* | O hay buzón, o no se pregunta. Se cruza con E2 (el chat que no existe). |
| **C4** | **Repetición detectable en ~2 semanas**: 2-3 variantes por categoría y sin memoria puede repetir literal la misma frase. *"Ahí se cae la ilusión de que Sofía es algo. Ese es el momento exacto en que dejo de creer."* | Más variantes no alcanza si el problema es B1. |
| **C5** | ✅ **REPLANTEADO y parcialmente resuelto el 08/09 — el diagnóstico estaba mal.** ~~Cero humor.~~ §2 ter dice que era *"graciosa, cálida, amable para los problemas del resto"*. Ninguna de las 22 tiene liviandad. | 🔴 **§3.5 nunca prohibió la calidez: dice textual *"cálida y presente, sí"*.** Nadie usó el permiso — misma forma que B6. **Y el problema no era que faltaran chistes: era que todo estaba dicho en tono solemne.** El único dato real es del usuario del consejo: rescató *"un día flojo no borra la semana"* (*"tiene onda, se siente como algo que diría un amigo"*) y rechazó *"¿lo notás vos también?"* (*"me suena a chatbot de call center"*). **La diferencia es hablar llano contra actuar cercanía.** ✅ Dos frases cambiadas y la regla aclarada en §3.5. ⚠️ Queda pendiente el resto del banco. |
| **C6** | ✅ **RESUELTO el 08/09.** ~~Se pierde la negrita cuando gana la IA~~ (`withCopy` deja `bold` vacío): la tarjeta se ve distinta según qué camino ganó. | El modelo ya devolvía salida estructurada, así que se le sumó un campo `destacado` — un trozo literal de la línea. 🔴 **Toda falla degrada a texto plano**, que es como se veía antes: el modelo puede no mejorar la tarjeta, no puede romperla. ⚠️ El cache guarda línea + destacado juntos (si guardara solo la línea, la tarjeta se vería con destacado el día que se genera y sin él al reabrir), con lectura tolerante de las entradas viejas. |

---

### C7 — nueva (08/09): la voz vive en más de una pantalla y solo una está vigilada

✅ **Encontrado pasando los prompts del Diario por `rejectCopy`.** Son la **misma
voz de Sofía en otra pantalla**, se escribieron antes de que las reglas
existieran, y **nada los verifica**.

| prompt | veredicto |
|---|---|
| *"Se nota que estás **cansado**."* (ánimo 2) | 🔴 **Violación real y doble**: *"se nota que"* es la app de testigo (prohibido por nombre en el `SYSTEM`) y *"cansado"* le asigna género a quien lee — el mismo bug que Andre cazó con *"parejo"*. ✅ **Corregido**: *"Hoy venís con poca energía."* |
| *"Un día **tranquilo**."* (ánimo 3) | ⚠️ **Falso positivo del guardarraíl, no del prompt.** Ahí `tranquilo` concuerda con *"día"* y es correcto. En la tarjeta nunca puede serlo (el sujeto tácito es *la semana*). Anotado en `NIVEL_MASCULINO`. |
| *"**¡**Hoy estás brillando**!**"* (ánimo 5) | 📌 **Decisión de Andre**: el `SYSTEM` prohíbe exclamaciones en la tarjeta. ¿Vale la misma regla en el Diario, o es otro registro a propósito? |

#### ✅ Barrido completo del 08/09

Se recorrieron las otras superficies buscando los patrones que las reglas ya
frenan en la tarjeta: adjetivo con género sobre quien lee, la app de testigo,
exclamaciones, tuteo.

| superficie | resultado |
|---|---|
| **Gratitud** | 🔴 **Una violación real: *"¿Por qué estás **agradecido** hoy?"*** — mismo bug que *"cansado"* y *"parejo"*. ✅ Corregido: **"¿Qué agradecés hoy?"**, que además no necesita ningún adjetivo. |
| **Check-in** (`MoodCheckIn`) | ✅ Limpio. Su copy sale de `ViveMoods` y de texto dinámico; no hay frases fijas dirigidas a la persona. |
| **Panel del orbe** | ✅ Limpio en cuanto a reglas. Sus cuatro atajos no generan ni observan. (Su problema es otro y está en E2.) |
| **Sala / chat** | 📌 *"¡Empezá la conversación!"* tiene exclamación, **pero no es la voz de Sofía**: es el vacío del chat entre dos personas. Superficie distinta, registro distinto. No se tocó. |
| **Diario** | Ya barrido arriba: 1 corregida, 1 falso positivo del guardarraíl, 1 decisión de Andre. |

📌 **Dos violaciones en total, en dos pantallas distintas, y las dos del mismo
tipo: un adjetivo masculino sobre quien lee.** No es casualidad — es el error más
fácil de cometer en español y el único que **la tarjeta tiene cuatro reglas para
evitar** mientras el resto de la app no tiene ninguna.

🔴 **Lo que sigue abierto: nada verifica esto.** El barrido fue a mano y no queda
nada que impida que la próxima pantalla nazca con el mismo error. La tarjeta
tiene un test que barre sus 35 frases contra `rejectCopy`; **el resto de la app
no tiene equivalente**, y no es obvio cómo hacerlo (el copy vive suelto en JSX,
no en un banco enumerable).

---

## D. Abierto y sin solución conocida

| ID | Problema | Estado |
|---|---|---|
| **D1** | 🔴 **Inferencia causal.** *"No es que hayas dejado de intentar"* — niega una causa que nadie planteó y **al negarla la introduce**. Reproche de contrabando dentro de un consuelo, sin ninguna palabra prohibida. | Cuatro corridas de ensayo confirman que **no se arregla con el prompt**. `rejectCopy` mira vocabulario. |
| **D2** | 🔴 **A.11 — qué hace Vita frente al riesgo real.** No puede preguntar sin crear un deber que no puede sostener. | Veredicto del consejo: **no agregar la pregunta hasta que la respuesta valga algo.** *"Preguntar «¿querés dejar de vivir?» y contestar con una pantalla de teléfonos es funcionalmente idéntico a no preguntar — pero le costó a la persona decir que sí."* 📌 **Tercera vía propuesta:** no *"¿querés morir?"* sino **"¿querés que alguien te llame ahora?"** con la llamada en un tap. |
| **D3** | 🔴 **El umbral no distingue "mal tramo" de "riesgo"**, y no sabemos cómo hacerlo sin preguntar. Mónica: *"las sesiones pueden destapar ansiedades como parte del proceso de sanación"* — el detector puede dispararse sobre alguien cuyo tratamiento funciona. | Lo hecho: **dejar de afirmar la distinción que no podemos medir**. La pregunta de fondo sigue abierta y atada a D2. |
| **D4** | **El acceso a crisis depende del detector.** Deja afuera el caso que Mónica nombró: **violencia intrafamiliar**, que la escala de ánimo no ve nunca. | Sacarlo del control del algoritmo: permanente y a un tap, no contingente. Hoy está en el perfil, que es mejor que nada pero hay que ir a buscarlo. |
| **D5** | **Nadie externo firma nada.** Las dos revisiones llegaron solas: *"la salida obvia frente a «no podemos preguntar ni sostener un sí» es un socio externo — una línea de crisis con convenio, una ONG, un asesor clínico que co-diseñe el protocolo"*. Para dos personas es **la acción de más apalancamiento y de las más baratas**. | Nadie lo empezó. |
| **D6** | **¿Se enteran ustedes cuando el piso dispara?** Hoy no hay logging ni alerta propia. Sin eso no pueden aprender ni hacer seguimiento al día siguiente — *"la única forma de cuidado sostenible sin guardia 24/7"*. | Sin decidir. |

---

## E. Decisiones frenadas que bloquean otras cosas

| ID | Qué | Quién | Bloquea |
|---|---|---|---|
| **E1** | **Cómo crece el catálogo de recursos.** Marcada por ustedes como la más importante, frenada hace semanas. 📌 §2 bis le dio una pista fuerte: *"un recurso si lo tenía a mano"* — **nunca fabricado**. Y si el problema es peso y no escasez, **más recursos lo empeoran**. | 30 min con Joaquín | B2 |
| **E2** | **Los dos Sofía / el orbe** (D-1 y D-2 de `consejo-sofia.md`). ✅ Verificado que apagarlo no deja nada inaccesible. | Pausado con Joaquín | C3 |
| **E3** | **Consentimiento en el onboarding** (PC-4). La página `sobre-nosotros` existe, pero **hay que ir a buscarla** — que es la letra chica que PC-4 critica. | Andre | — |
| **E4** | **Hablar con Sofía (la persona) y dejar algo escrito.** Hoy **no tiene voz formal en un producto que lleva su nombre**, y nadie calculó el costo reputacional para ella si el producto falla en una crisis. | Andre | — |
| **E6** | 🔴 **¿La voz puede tratarte en género?** Idea de Andre (08/09). Hoy la app no sabe, y **cuatro de los catorce guardarrales existen solo por eso** (`GENDERED`, `GENDERED_PERIFRASIS`, `NIVEL_MASCULINO`, `CONCORDANCIA_SEMANA`). Saberlo desbloquearía calidez hoy imposible: *"no estás sola"*, *"venís cansada"*. **Ver el análisis abajo.** | Andre | C5 |
| **E5** | **Visto bueno de voz** sobre la frase nueva de `sustained-low` y sobre *"estar ahí con vos"* (§1 la avala, §3.5 la roza). | Andre | — |

---

### E6 — ¿la voz puede tratarte en género? (análisis del 08/09)

**El dato existe**: `profiles.gender`, con cuatro opciones —`Prefiero no decir`
(**el default**), `Masculino`, `Femenino`, `No binario`— editable en el perfil.
✅ Verificado: **hoy tiene un solo uso en toda la app**, `search3.tsx:331`, el
filtro para elegir profesional por sexo.

**Lo que se ganaría** es real: desaparecería toda la gimnasia de *"que el
adjetivo califique a la semana y no a la persona"*, y con ella cuatro reglas.

**Tres problemas, y el tercero es el que decide:**

1. **Solo sirve para dos de las cuatro opciones.** `Prefiero no decir` es el
   default y `No binario` no tiene forma gramatical en español que no sea la
   neutra. **La voz neutra tiene que existir igual** — no se elimina trabajo, se
   agrega un segundo banco de frases.
2. **No se sabe cuántos lo completaron** (la RLS no deja contarlo con la anon
   key) y el default es "prefiero no decir".
3. 🔴 **El campo se pidió para otra cosa.** Alguien lo completó **para que le
   ofrezcan una psicóloga mujer**, no para autorizar que la app le hable con
   adjetivos todos los días. ⚠️ **El modo de falla es concreto:** una persona
   trans que puso `Masculino` para el filtro, o que no actualizó el campo, y la
   app empieza a tratarla en masculino todas las mañanas. **El costo cae justo
   sobre quien la app tenía que cuidar mejor — que es el motivo por el que la
   regla existe.**

**Propuesta (sin decidir):**

- 🟢 **No leer el campo: preguntar aparte.** *"¿Cómo preferís que te hable?"*, un
  toque, con el propósito dicho. No repurposea nada, le da control sobre **cómo
  le hablan** —que es distinto de su género— y deja *"me da igual"* como
  respuesta válida y probablemente la más elegida.
- 🟢 **Y el dato no tiene por qué ir al modelo.** El motor de reglas corre en el
  teléfono: si las 35 frases usan el género y el payload sigue siendo el de
  siempre, **no se toca el encuadre legal ni viaja un dato más**. Se acepta que
  lo que escribe la IA sigue siendo neutro.
- **Los guardarrales quedan en pie** para todos los que no contesten, que van a
  ser la mayoría.

📌 Se cruza con **C5** (la voz no tiene humor ni calidez propia): parte de esa
frialdad viene de que no puede usar un solo adjetivo sobre la persona.

---

## F. El problema de método

🔴 **Cero usuarios reales. Nada de esto está validado.**

Tres consejos, 18 sesiones de trabajo de voz, ~540 tests — y la única persona que
simuló ser usuario dijo que a las dos semanas la ignoraría y que **no la
extrañaría si desapareciera**.

**La prueba más barata que salió, y contesta la pregunta de fondo mejor que
cualquier análisis:** mandar la tarjeta **en versión reglas-only, sin IA** a 5-10
personas reales durante dos semanas, sin avisarles que es un experimento, y
preguntarles el sábado antes de la sesión: **"¿leíste algo esta semana que te
sirvió?"**.

> *"Esa respuesta vale más que los 540 tests."*
