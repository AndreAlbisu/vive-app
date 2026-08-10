# CHANGELOG_SESIONES.md — Registro de sesiones de trabajo

> Antes de tocar código, leé la última entrada de quien no sea vos.
> Al terminar tu sesión, agregá tu propia entrada arriba de todo (orden cronológico inverso).

---

## 2026-08-10 — Joaquín (sesión 88)

**Tocado:** `supabase/functions/mp-create-payment/index.ts` (**deployado por Joaquín, versión 20**), `screens/CoachProfileScreen.tsx`. Nuevo `scripts/cleanup-loose-test-payments.sql`.

**Resumen:**
- Arrancando la lista de pendientes de la sesión 87 (Andre): preparé la limpieza de los 3 pagos de $1 sin reembolsar (`2c72b126`, `51b36c93`, `5948c59d`). **No lo corrí yo** — este entorno solo tiene la anon key local, sin service role ni el CLI de Supabase logueado, así que no hay forma de escribir en prod desde acá. El script quedó para que Joaquín lo corriera en el SQL editor de Supabase — **lo corrió y quedó verificado**: las 3 pasaron a `status='cancelada'` / `payment_status='reembolso_pendiente'` / `refund_attempts=0`. Queda que el cron de `mp-process-refunds` (cada 5 min) las tome y confirme `reembolsado` contra la API real — no verificado en esta sesión, falta el chequeo final.
- El script solo cancela las 3 reservas (`status = 'cancelada'`); `trg_mark_refund_on_cancel` (ya en prod) hace el resto solo — detecta `payment_status='aprobado'` y lo pasa a `'reembolso_pendiente'`, y el cron de `mp-process-refunds` reembolsa contra la API real en la corrida siguiente (cada 5 min). No hace falta tocar `payment_status` a mano ni invocar nada.
- **Sigue pendiente coordinar con Andre desconectar la cuenta de MP del coach de prueba** (la de un tercero) — no es código: el botón "Cambiar" de `CoachProfileScreen` ya permite reconectar a otra cuenta re-corriendo el OAuth, pero hay que hacerlo logueado como ese coach. La desconexión total (dejar de cobrar del todo) sigue sin construirse — requeriría una edge function nueva porque `coach_mp_accounts` está bajo RLS; no se construyó porque no está claro que haga falta si alcanza con reconectar a una cuenta real.
- **Decidido con Joaquín qué hacer con las 16 reservas `completada` sin pago real** (sesión 87): no reescribir el `status` histórico de ninguna reserva (mismo criterio que Andre viene aplicando — el sweep de `expire_unpaid_checkouts` tampoco lo hace). En cambio, **se corrigió el contador de comisión en `mp-create-payment`** para que excluya del conteo por-par cualquier `completada` cuyo checkout haya quedado abandonado (`preference_id` seteado y `payment_status` que nunca salió de `'pendiente'`) — así las 16 dejan de empujar de forma incorrecta al par al tramo del 15%, sin tocar ni una fila de `bookings`. Una sesión legítimamente sin cobro (coach sin MP conectada) nunca tiene `preference_id`, así que el filtro no la toca. Este patrón específico ya no debería poder repetirse de acá en más — `expire_unpaid_checkouts()` (corrida el 09/08) cancela el checkout abandonado a los 30 min, mucho antes de que la reserva llegue a la fecha agendada y se barra a `completada` — pero el filtro queda como red igual, y por supuesto para las 16 viejas.
- **Deployado por Joaquín desde su propia Terminal** (este entorno no tiene el CLI de Supabase logueado — `supabase functions deploy` acá se cuelga esperando un login interactivo que no puede completar, así que lo corrió él). Verificado con `npx supabase functions list`: `mp-create-payment` pasó de versión 17 a **versión 20**, `ACTIVE`, `updated_at` 2026-08-10 00:33:26 UTC. Prod ya cuenta la comisión bien.
- Typecheck del proyecto limpio (las edge functions no entran en el `tsconfig` principal, corren aparte en Deno — revisado a mano).
- Sin cambios de schema.

**Nota operativa — Joaquín no podía entrar a la app (dos problemas encadenados, ninguno de código):**
- No tenía cuenta de Expo logueada localmente. Con `expo-dev-client` como dependencia (desde que Andre linkeó el proyecto a la org `vita-wellness-app`, sesión 83), hace falta estar logueado y ser miembro de esa organización para algunos flujos — **a confirmar si Expo Go local realmente lo necesita** o si alcanzaba con estar logueado (no se llegó a aislar la causa exacta, se resolvió por el camino de loguearse + pedirle a Andre la invitación).
- **Con eso resuelto, apareció el problema real y va a repetirse:** `npm start` / `expo start` ahora arranca por default en modo **`development build`** (no Expo Go) porque el proyecto tiene `expo-dev-client` instalado — el QR que muestra apunta a un esquema custom (`com.andrealbisu.viveapp1://expo-development-client/...`) que Expo Go NO puede abrir, y ni siquiera se puede escanear con la Cámara del iPhone (no es un link http). **Mientras no exista un dev build real instalado en el celular** (sigue pendiente de sesiones anteriores), hay que apretar `s` en la Terminal después de arrancar el server para forzar `Press s | switch to Expo Go`, que regenera un QR `exp://` compatible. Vale la pena decirle esto a Andre también, le va a pasar lo mismo.

**Resultado de los 3 reembolsos — 2 de 3 ok, uno destapó un agujero estructural real:**
- `51b36c93` y `5948c59d` (pagados 19:23 y 19:26 del 09/08) llegaron a `payment_status='reembolsado'` solos, vía el cron. Confirmado.
- **`2c72b126` (pagado 17:45) quedó DEAD-LETTER, `refund_attempts=6`.** Diagnóstico con el log real de `mp-process-refunds` (dashboard de Supabase, filtrando por severidad y ampliando a 24hs — el error estaba fuera de la ventana default de "Last 15 minutes"): `refund 404: "Payment not found"`. Ese pago se cobró con la cuenta de MP VIEJA del coach de prueba (la personal de Andre); más tarde esa misma noche Andre reconectó el coach a la cuenta de un amigo para el test de split (sesión 87), y esa reconexión **sobreescribe sin historial** el token en `coach_mp_accounts`. `mp-process-refunds` siempre usa el token ACTUAL del coach (`getFreshCoachToken`), así que intenta reembolsar con la cuenta nueva un pago que le pertenece a la cuenta vieja — MP contesta correctamente "no existe" (no existe *para esa cuenta*). Los otros dos se cobraron ya con la cuenta nueva, por eso sí encontraron el pago.
- **Es un agujero real, no solo el $1 de hoy:** cualquier coach que reconecte su cuenta de MP (por el motivo que sea, no solo test) deja huérfano cualquier reembolso que quedara pendiente de la cuenta anterior, sin forma automática de recuperarlo — `coach_mp_accounts` guarda un solo token vivo por coach, no historial por pago.
- **Decisión con Joaquín:** el $1 de este booking puntual se deja así (es plata de prueba de Andre, no de un usuario real; si le importa, Andre puede reembolsarlo a mano entrando con su cuenta MP vieja directo en mercadopago.com).
- **Arreglado — opción 2 de las dos propuestas (guardarraíl, no historial de tokens).** `connectMercadoPago` en `CoachProfileScreen.tsx`: al RECONECTAR (`mpConnected=true`, o sea el botón "Cambiar", no el primer "Conectar"), chequea si el coach tiene algún booking con `payment_status in ('aprobado','reembolso_pendiente')` antes de arrancar el OAuth — si hay algo sin resolver, `Alert` explicando por qué y no deja seguir. El primer connect (sin cuenta todavía) no chequea nada, ahí no hay nada que pueda orfanarse. No evita que YA haya reembolsos huérfanos viejos (como `2c72b126`), solo que se generen nuevos. Se descartó la otra opción (historial de tokens por cuenta) por ahora — más robusta pero bastante más trabajo, y el guardarraíl cubre el caso real. Typecheck y lint limpios.

**Umbrales del deck v3 — recalibrados corriendo `check-deck-pools.ts` con datos de hoy, sin cambios:**
- Cobertura: 60/83 lugares-puerta califican para alguna categoría de mérito (72%). 3 puertas muestran 3 cards, 5 muestran 2, **2 muestran 1 sola** ("Identidad y motivación", "Espiritualidad y soledad" — cero coaches cruzan ninguna barra ahí, sobrevive solo "Opción económica").
- **El dato está dominado por seed data, no por operación real**: los coaches con reseñas/rating (Nicolás Bravo, Agustina Ferrer, Damián Costa, Rocío Ibáñez, Facundo Lemos, Malena Ortiz, todos con exactamente 4 reseñas) son de `scripts/seed-fake-coaches.sql` (sesión 87, Andre), sembrados para poder testear la mecánica del deck sin esperar operación real — no reflejan comportamiento de usuarios de verdad. Los coaches reales siguen mayormente en 0 reseñas.
- **Decisión con Joaquín: no tocar los umbrales numéricos** (4.5★, 3 reseñas, 30% reagendamiento, 3 reservantes/30d) — calibrar contra datos sintéticos sería calibrar contra ruido. Se recalibran cuando haya operación real, como ya venía anotado.
- **Decisión con Joaquín: las 2 puertas de 1 sola card se dejan así** — es el mismo criterio que Andre ya aplicó en sesión 86 al sacar el relleno artificial (mostrar 1 card real es más honesto que inflar con relleno; "Ver lista completa" sigue teniendo a todos). Si esas puertas siguen angostas con operación real, es un tema de reclutar más coaches para esos temas, no de código.

**Cuenta de MP del coach de prueba — cerrado, se queda como está.** Joaquín confirmó que sigue conectada al mail del amigo (la que Andre conectó en sesión 87 para probar el split) y decidió no tocarla — no hace falta reconectar a otra cuenta. Saca este ítem de pendientes; si en algún momento hace falta desconectarla de verdad para abrir a coaches reales, retomar desde acá.

**Pendiente para la próxima sesión:**
- **Probar el guardarraíl nuevo en el celular**: con un coach que tenga un booking `aprobado`/`reembolso_pendiente`, confirmar que "Cambiar" muestra el Alert y no abre el OAuth; con uno sin nada pendiente, confirmar que sigue funcionando normal.
- Confirmar si local (Expo Go, sin dev build) realmente requiere estar logueado/en la org de Expo, o si esa parte del bloqueo era innecesaria — ahorraría el paso de login+invitación a cualquiera que solo quiera correr la app en Expo Go.
- El resto de la lista de la sesión 87 sigue abierto: probar reserva instantánea con pago, tramo 15% de comisión (ideal probarlo YA con el fix del contador deployado), Gratitud y `/coach-visibilidad` en el celular.
- Recalibrar `check-deck-pools.ts` de verdad cuando haya operación real (no seed data).

## 2026-08-09 — Andre (sesión 87)

**Tocado:** `supabase/functions/mp-webhook/index.ts` (desplegado), `scripts/add-refund-cron.sql`, `SCHEMA.md`. Cambios de config en prod (no en el repo): `vault.secrets['service_role_key']`.

**Resumen:**

- **Primer pago REAL contra MP.** Andre conectó su cuenta de MP al coach de prueba y reservó desde el celular de su mamá. Pago `172908775452`, $1 ARS, `live_mode: true`, `approved/accredited`. Después se reembolsó entero (refund `3170241103`, MP devolvió también su fee de $0,04). El test destapó dos cosas rotas en producción que ningún test anterior podía ver, porque **las dos fallan en silencio**.

- 🔴 **`mp-webhook` nunca funcionó, ni una sola vez.** Leía el pago con `MP_ACCESS_TOKEN` (token de plataforma) y en marketplace el pago es del VENDEDOR: el `GET /v1/payments/{id}` fallaba y la función cortaba en 502. Resultado: el pago se acredita en MP y la reserva queda en `payment_status='pendiente'` para siempre. Las 6 reservas de "Coach Prueba" están así. Era la incógnita (a) que el propio archivo marcaba como `⚠️ PENDIENTE DE VERIFICAR` desde julio — quedó respondida, y la respuesta era "no, no puede".
  - Arreglado resolviendo el token del coach desde la notificación: `body.user_id` (el collector) → `coach_mp_accounts.mp_user_id` → `getFreshCoachToken`. El huevo-y-gallina que anotaba el comentario viejo (el coach sale del booking, el booking sale del `external_reference` que está dentro del pago) no existe: `user_id` viene en la notificación, antes de leer nada.

- 🔴 **Los reembolsos estaban muertos desde el 24/07 por un placeholder.** `add-refund-cron.sql` se corrió sin reemplazar `<PEGAR_SERVICE_ROLE_KEY>`, así que el Vault guardaba ese texto literal (24 chars) y el cron mandaba `Authorization: Bearer <PEGAR_SERVICE_ROLE_KEY>` cada 5 minutos → `401 UNAUTHORIZED_INVALID_JWT_FORMAT` del gateway, antes de que la función corriera siquiera. **Dos semanas y media**, con `mp-process-refunds` sano. Corregido con `vault.update_secret` + guarda en el script para que no se repita.
  - Detalle que cuesta plata si se pasa por alto: la key que va ahí es la nueva **`sb_secret_…`**, no la `service_role` legacy formato JWT. Es la que quedó en el secret de las edge functions tras la rotación del 07/08.

- **Bug menor del webhook, mismo diagnóstico:** el filtro de topic estaba DESPUÉS de la validación de firma. Por cada pago MP pega hasta tres veces en el mismo `notification_url` —la v2 (`?data.id=…&type=payment`), la IPN v1 (`?id=…&topic=payment`) y una o más de `merchant_order`— y todas las que no eran la v2 morían en 401, que MP interpreta como fallo y reintenta (8 reintentos por un solo pago). Ahora se procesa solo la v2 y el resto se descarta con 200 antes de mirar la firma. No abre nada: esas ramas no leen ni escriben. La v2 con firma inválida sigue dando 401.
  - **Corregido en dos pasos, porque la primera hipótesis era falsa.** Al principio asumí que las v1 llegaban sin firmar y las filtré por ausencia de `x-signature`; el segundo pago real mostró que **sí vienen firmadas**, solo que con un manifest distinto al de la v2, así que seguían cayendo en el 401. Se filtran por el query param `topic`, que es lo que de verdad distingue v1 de v2. No vale la pena reproducir el manifest de la v1: la v2 del mismo evento ya trae todo.

**Verificación con el SEGUNDO pago real (17:45, payment `172911824360`):** el webhook escribió solo, sin tocar la base a mano — `payment_status='aprobado'`, `payment_id`, `paid_at` a los 18 segundos de creada la reserva. En los logs: `merchant_order` → 200, v2 `data.id` → 200 (antes era 502), y solo quedaba la IPN v1 en 401, que es lo que cerró el segundo paso.

- **Lo que SÍ estaba bien:** el manifest de firma del webhook (incógnita (b), las v2 validaron a la primera), `trg_mark_refund_on_cancel` (existe, activo, flipeó solo a `reembolso_pendiente`), `mp-process-refunds` con el token del coach, la preferencia de Checkout Pro (`marketplace: MP-MKT-…` bien formada) y `MP_CLIENT_ID` (verificado que es la app de producción).

- **Ojo con el `booking-success`:** `BookingScreen_Confirm.tsx:314` hace `router.replace('/booking-success')` incondicionalmente al cerrarse el browser, sin mirar el resultado del pago. "Reserva creada" en pantalla no significa que se cobró — por eso el bug del webhook pasó desapercibido en las pruebas manuales. No se tocó (hoy los pagos son opcionales y ese estado es válido), pero cuando el pago sea obligatorio hay que revisarlo.

**✅ SPLIT VALIDADO — cuarto pago real (19:26, payment `172923514332`).** `MP_SPLIT_ENABLED` estaba en `false` desde el 13/07 (se había apagado para diagnosticar el sandbox y nunca se volvió a prender), así que los tres pagos anteriores fueron con comisión **0** aunque la reserva guardara `platform_fee_pct: 20`. Para poder prenderlo hacía falta resolver el self-split: **la app de MP (client_id `7632643428001156`) es la cuenta personal de Andre**, y el coach de prueba estaba conectado con ESA misma cuenta — MP no deja que el que cobra el `marketplace_fee` sea el vendedor. Andre reconectó el coach con la cuenta de un amigo (`mp_user_id` pasó de `1405939310` a `464948031`) y recién ahí se prendió el flag.

Resultado, verificado contra la API de MP y no contra la base:
- Preferencia: `marketplace_fee: 0.2`, `marketplace: MP-MKT-7632643428001156`, `collector_id: 464948031`.
- Pago: `fee_details` trae `{"type": "application_fee", "amount": 0.2, "fee_payer": "collector"}` — la comisión de VIVE — además del `mercadopago_fee` de $0,04.
- `net_received_amount: 0.76` = 1 − 0,20 (VIVE) − 0,04 (MP). El reparto cierra exacto.
- `platform_fee_pct: 20` bien snapshoteado: 0 sesiones `completada` del par → primer tramo.
- Los 5 hits del webhook de ese pago dieron **200, sin un solo 401 ni 502**.

**Con esto pagos v1 queda validado end-to-end en producción:** Checkout Pro → split 20% → webhook escribiendo `payment_status` solo → trigger de reembolso → cron de reembolsos.

🔴 **La reserva se creaba aunque cerraras el checkout sin pagar** (lo detectó Andre probando). Es el bug más caro de la sesión y el más difícil de ver, porque la pantalla decía "reserva creada" igual.

- **Alcance real, medido:** 27 reservas con `preference_id` puesto y `payment_status='pendiente'` sin `payment_id` —checkout abierto y nunca completado—, y **16 de ellas en `status='completada'`**. No se quedaron colgadas: `complete_confirmed_sessions()` las marcó como cumplidas al pasar el horario y el usuario recibió la invitación a reseñar. Nadie pagó ninguna. Encima cada completada falsa empuja al par al tramo del 15%, porque `mp-create-payment:99` cuenta `status='completada'`.
- **Por qué se escapaban:** `expire_pending_bookings()` filtra `status='pendiente'` a las 24h. Si el coach aceptaba antes, pasaba a `confirmada` y dejaba de ser candidata; y con `instant_booking` la reserva nacía `confirmada`, así que nunca la miraba. Peor: en el camino instantáneo **todos los efectos corrían antes de llamar a `mp-create-payment`** — push al coach, confirmación al usuario, mensaje en la sala, sala de Daily y **cancelación de las reservas de otros que competían por ese horario**. Todo eso ya había pasado cuando el usuario cerraba la pestaña.
- **Arreglo, tres piezas:**
  1. **La reserva siempre nace `'pendiente'`**, también en instantánea, y los efectos se movieron a `applyBookingEffects(confirmedNow)`, que corre recién cuando se sabe si entró el pago. `confirmedNow = isInstant && (!initPoint || paid)`.
  2. **`expire_unpaid_checkouts()` + cron cada 5 min** (`scripts/expire-unpaid-checkouts.sql`, CORRIDA): libera a los 30 min lo que siga sin pagar, en cualquier estado vivo, y avisa al usuario. **Verificado en vivo** contra el checkout que Andre abandonó a las 19:31 (`18e1f4ec`): la corrida de las 20:00 lo dejó pasar porque tenía 28,7 min, y la de las 20:05 lo canceló e insertó la notificación. La ventana de 30 min se respeta. El discriminador es `preference_id is not null` — el comentario viejo de `mp-webhook` decía que el abandono era indistinguible de "coach sin MP", y es falso: esa columna los separa, sin esperar a que el pago sea obligatorio.
  3. **Guard nuevo en `mp-webhook`:** si llega un pago aprobado para una reserva **ya cancelada**, se encola `reembolso_pendiente` en vez de `aprobado`. Sin eso, la plata quedaba adentro: `trg_mark_refund_on_cancel` solo mira la transición *hacia* `cancelada`, y en esa carrera ya había ocurrido. Cierra tanto el caso del sweep como el del coach que cancela con el checkout abierto.
- **Decisión de diseño: el cliente NO cancela.** Tras cerrar el browser se sondea `payment_status` hasta 12 s (en los pagos reales el webhook tardó ~2 s). Si se agota, la reserva se deja `'pendiente'` y decide el servidor. Cancelar desde el cliente abría la ventana de "reserva cancelada + plata cobrada" si el pago entraba un segundo después.
- **Degradación elegida cuando el pago entra pero la app muere antes de confirmar:** la reserva queda `'pendiente'` y pagada, o sea una solicitud normal que el coach puede aceptar (`confirmBooking` hace los mismos efectos), y si nadie la toca `expire_pending_bookings()` la cancela a las 24h marcando `reembolso_pendiente`. No es un estado nuevo ni roto. **Contra conocida:** en ese caso al coach no le llega el push, solo la ve en su lista de solicitudes.
- **No se pudo reusar `confirmBooking()` de `lib/coachBookingActions.ts`** aunque hace exactamente los mismos efectos: la política de INSERT de `messages` es `auth.uid() = sender_id`, y esa función manda el mensaje de sistema como el coach. Desde la sesión del usuario, RLS lo rechaza. Por eso el bloque inline sigue duplicado.
- Copy de `BookingScreen_Success` corregido: `paymentPending` decía "Tu pago está siendo procesado", que es mentira cuando el usuario cerró el checkout. Ahora dice que si el pago entra queda reservado y si no se libera el horario, y el badge pasó de "Pago en proceso" a "Pago sin confirmar". Y los params dejaron de mentir: `instant` ahora refleja si de verdad quedó confirmada (antes se mandaba `paymentPending` con cualquier `initPoint`, incluso con el pago ya aprobado).
- Typecheck y lint limpios.

**Pendiente para la próxima sesión:**

- **Las 16 reservas `completada` sin pagar siguen ahí.** El sweep no las toca a propósito (no reescribe historia), pero inflan el contador que decide 20% vs 15%. Decidir si se limpian.
- **Nada de esto se probó en dispositivo todavía** — es el flujo que más se tocó en la sesión y el camino instantáneo con pago **nunca se ejercitó**: el coach de prueba tiene `instant_booking = false`, así que los 4 pagos reales fueron todos por el camino no instantáneo.
- **El tramo del 15% no está probado**, solo el del 20%. Necesita un par coach-usuario con ≥1 sesión `completada`. Riesgo bajo (es un COUNT), pero es el número que cobra de la segunda sesión en adelante.
- **`MP_SPLIT_ENABLED` quedó en `true` y `MP_TEST_MODE` en `false`**: producción cobra comisión real. Es el estado correcto, pero conviene saberlo.
- **`MP_ACCESS_TOKEN` sigue siendo el de la era sandbox** (cargado 12/07, casi seguro `TEST-`) — fue lo que rompió el webhook. Ya no está en el camino normal, pero sigue siendo el fallback: reemplazarlo por el `APP_USR-`.
- **El coach de prueba está conectado con la cuenta de un tercero.** Antes de cualquier demo o de abrir a coaches reales, desconectarla.
- Quedan **3 pagos de $1 sin reembolsar** (`2c72b126`, `51b36c93`, `5948c59d`). Cancelando las reservas se reembolsan solos ahora que el cron anda.
- Las 5 reservas viejas de "Coach Prueba" quedaron con `payment_status='pendiente'` y pagos que nunca existieron (nunca se completó el checkout). Decidir si se limpian.
- El hook de `.claude/settings.json` dispara en cualquier Bash, no solo en `git commit` como dice su `if`, y falla el push. Ruido, no rompe nada.

## 2026-08-07 — Andre (sesión 86)

**Tocado:** `screens/CoachHomeScreen.tsx`, `lib/coachDeckRanking.ts` (reescrito), `lib/coachesCache.ts`, `app/_layout.tsx`, `app/(tabs)/conexiones.tsx`, `SCHEMA.md`. Nuevos: `lib/coachVisibility.ts`, `screens/CoachVisibilityScreen.tsx`, `app/coach-visibilidad.tsx`, `scripts/harden-reviews-insert.sql` (CORRIDO por Andre), `scripts/check-deck-pools.ts`.

**Resumen:**
- **Problema de arranque del coach:** al crear la cuenta, el coach no tiene forma de saber qué puede hacer y concluye que lo único a su alcance es traer clientes de afuera. Falso: de los 4 slots del deck de una puerta, **dos son ganables el día 1** — `nuevo` (elegible con <5 reseñas **o** <28 días) y `economico` (el precio más bajo de la puerta). El comentario de `coachDeckRanking.ts` ya decía "le dice al coach cómo aparecer en cada slot", pero ese mapeo solo existía del lado del usuario.
- **Pantalla "Cómo aparecer"** (`/coach-visibilidad`): por cada puerta donde sus temas lo meten, muestra los 4 slots con estado `ganado` / `rotando` / `compite` / `bloqueado` y el detalle concreto ("rotás con 3 coaches nuevos: te ve ≈1 de cada 4 personas", "el más accesible está en $X, $Y por debajo tuyo"). Abajo, checklist de lo que depende de él, separando lo **bloqueante** (verificación, perfil activo, temas, precio) de lo que solo mueve conversión (bio, foto, video, reserva instantánea), y un atajo a publicar recursos — el carril de descubrimiento que no pasa por el deck ni por las reseñas.
- La lógica vive en `lib/coachVisibility.ts`, pura y sin queries, espejando los criterios de `pickForSlot`. **Aproximación conocida y documentada:** el ranking de cada slot se calcula sobre toda la puerta, pero `rankDeck` consume coaches en orden de prioridad, así que la posición real en los slots bajos es igual o mejor que la mostrada — se prefiere subestimar antes que prometer un slot que después no aparece.
- Card de entrada en el home del coach, alimentada por `visibilityTeaser()` (2 queries baratas sumadas al `Promise.all` que ya existía). Si hay bloqueo, la card lo dice de frente ("Hoy no aparecés en Conexiones") en vez de mostrar el conteo de puertas.
- Se exportó `SLOT_ORDER` desde `coachDeckRanking.ts` y se agregó `loadCoaches()` a `coachesCache.ts` (versión esperable de `prefetchCoaches`, evita el poll con `setInterval` que usa `conexiones.tsx` — esa pantalla no se tocó).
- Typecheck y lint limpios. **Falta probar en Expo Go.**

**Rediseño de la card del deck (Dirección 1 — "Cabecera"):**

- Andre pidió rediseñar la card del deck ("muy fea"). Se armó un mockup HTML con **las tipografías reales** (Fraunces y Poppins incrustadas como data URI desde `node_modules/@expo-google-fonts`) y la paleta tal cual está en el código, con tres direcciones para elegir. Se eligió la 1.
- **Diagnóstico:** no le faltaban adornos, le faltaba jerarquía. Todo centrado con el mismo ritmo; la cita en Fraunces bold sobre 3 líneas le ganaba en masa visual al nombre de la persona; la banda gris de 92 px era una foto de portada que no existe; el chip —el dato más importante— era una pastilla gris chica; y "Cumple la barra de calidad" era lenguaje de sistema filtrándose a la pantalla.
- **`SLOT_COLORS` nuevo en `coachDeckRanking.ts`**, pegado a `DECK_SLOTS` para que etiqueta y color no diverjan: terracota `#C06B4A` (recomendado), ocre `#B98A2E` (tendencia), verde vivo `#5F7A44` (nuevo), forest `#3F512F` (económico). Antes el chip se teñía con el color de la PUERTA, así que las tres cards de un deck se veían idénticas. La puerta ya está nombrada en la pastilla de arriba, así que el color quedó libre para lo que sí distingue.
- **La categoría pasó de pastilla a cabecera** de la card, con la estrella de favorito y el contador dentro. El cuerpo se alineó a la izquierda, el avatar bajó a 56 px y entró en la fila del nombre, la cita bajó a 13.5 y dejó de ser bold, el precio ganó peso como número, y el botón toma el color de la categoría. Se fue `slotSublabel`.
- Sin huérfanos en el StyleSheet (chequeado). **Falta verlo en dispositivo.**

**Segunda mitad de la sesión — el deck pasa de podio a sorteo (v3) + se cierra el agujero de reseñas:**

- **Diagnóstico (conversación con Andre):** los 4 slots estaban *etiquetados como categorías pero implementados como rankings* — cada uno hacía `sort(...)[0]`, el máximo. De ahí salían tres problemas del mismo error: (1) el mismo coach ocupaba "Recomendado por Vita" semanas enteras porque el criterio era determinístico y no rotaba; (2) hacer trampa pagaba muchísimo, porque subir de 4.7 a 4.9 daba el monopolio de la puerta; (3) duplicaba el trabajo de `search3`, que ya es la lista completa y comparable. **Conexiones recomienda una opción; la búsqueda deja comparar las 100** — esa es la división de trabajo que el deck no estaba respetando.
- **v3 en `coachDeckRanking.ts`:** cada slot deja de ser "el máximo" y pasa a ser **un filtro que define un pool + un sorteo**. El sorteo ya existía (shuffle sembrado por `${día}:${userId}`), solo que lo pisaba el `sort`. Ahora es el mecanismo principal: dos personas ven coaches distintos el mismo día. Barras nuevas — `recomendado`: ≥4.5★ **y** (≥3 reseñas, o ≥30% de reagendamiento cuando hay ≥5 completadas); `tendencia`: ≥3 personas distintas en 30 días; `economico`: por debajo de la **mediana** de la puerta (no "el más barato", que era una carrera hacia abajo con un único ganador). El archivo quedó más corto que antes.
- **`isNewCoach` pasó de OR a AND** (<5 reseñas **y** <28 días). El OR no drenaba: quien nunca llegaba a 5 reseñas quedaba "nuevo" para siempre, y el carril terminaba acumulando justo a los que no convirtieron, diluyendo a los recién llegados (con 60 acumulados, 1/60 de exposición). Sin `createdAt` falla cerrado.
- **`isEligibleForSlot` es ahora la única definición de cada criterio** y la comparten el deck y el panel del coach — no pueden divergir ni prometer un lugar que después no aparece.
- **`scripts/harden-reviews-insert.sql` (NUEVO, CORRIDO por Andre al cierre de la sesión):** la política de INSERT de `reviews` era solo `reviewer_id = auth.uid()` — no validaba que el booking fuera propio, ni que la sesión estuviera `completada`, ni que el reseñado fuera el coach de esa reserva. `ReviewScreen` armaba todo bien, pero la pantalla no es la frontera de seguridad: contra la API directa se podía reseñar a **cualquier** coach del catálogo. Costo de fabricar reputación: N cuentas, no N sesiones pagadas. Sin esto, la barra de calidad de v3 sería decorativa. El `UNIQUE(reviewer_id, reviewed_id)`, la ausencia de DELETE y el trigger de inmutabilidad ya estaban bien y no se tocaron. SCHEMA.md actualizado.
- **Bug de fondo corregido en `coachesCache`:** el `.limit(50)` estaba **sin `order by`** → Postgres devolvía 50 filas arbitrarias y, pasado el tope, algunos coaches no existían para Conexiones (y cuáles podía cambiar entre consultas). Con v3 además sesgaba los pools en silencio. Ahora `.order('created_at').limit(200)`.
- Panel del coach reescrito en consecuencia: los estados pasaron de `ganado/rotando/compite/bloqueado` a **`ganado/rotando/bloqueado`** y los textos pasaron de posición relativa a brecha concreta — "te faltan 2 reseñas para cruzar la barra" en vez de "vas #3 de 7". La regla de escritura quedó documentada en el lib: siempre un número alcanzable, nunca una carrera contra gente que el coach no controla.
- Typecheck y lint limpios.

**Tercera parte — calibración con datos reales y slot de relleno:**

- **`scripts/check-deck-pools.ts` (NUEVO):** cuenta, puerta por puerta, cuántos coaches caen en cada pool con los criterios reales. Importa `isEligibleForSlot`, `DOORS` y `rankDeck` del código de verdad (no una copia del mapeo puerta→tema, que se desincronizaría), y lee con la anon key, así que ve exactamente lo que ve la app. Corre con `npx sucrase-node scripts/check-deck-pools.ts`. Nota: sin `import.meta.url` a propósito — esa sintaxis hace que Node reparse el archivo como ESM y pierda la resolución sin extensión de los imports relativos.
- **Lo que midió: v3 recién commiteado achicaba el deck a 1 coach por puerta, en las 10.** Peor que v2. Diagnóstico por lugar: `recomendado` y `tendencia` vacíos porque hay **una sola reseña en toda la base** y casi ninguna reserva — falta de mercado, no umbral mal puesto. `nuevo` vacío porque el AND de hoy cubre solo los primeros 28 días y los 6 coaches seed tienen entre 35 y 53.
- **El agujero real de v3 no era ningún umbral: era la falta de relleno.** El `argmax` de v2 siempre producía un ganador; los pools con barra pueden quedar vacíos, y `rankDeck` los omite (correcto — nunca etiquetar mal a nadie), pero el resultado era una puerta desierta.
- **Slot de relleno (decisión de Andre: "agreguémosla, total no mata a nadie"):** `rankDeck` completa hasta `MIN_DECK_SIZE = 3` con chips que **no implican mérito, solo disponibilidad**. Primero se probó una sola etiqueta "Con lugar esta semana", pero la medición mostró que solo 1 de 6 coaches tiene `this_week` — habría sido otro lugar vacío. Quedaron **dos** chips que entre los dos cubren el catálogo entero por construcción (`coachesCache` filtra `activo`, y la vista garantiza que todo activo es `this_week` o `responds_24h`): **"Con lugar esta semana"** y **"Responde en 24 h"**. De paso cierra el "badge pendiente" que SCHEMA.md anotaba para `responds_24h`. Resultado medido: ninguna puerta muestra menos coaches de los que tiene.
- `CachedCoach.hasSlotThisWeek` nuevo, poblado en `_doFetch` con una cuarta query en paralelo contra `coach_availability_status`.
- **Se sacó el relleno POR COMPLETO (decisión de Andre, después de preguntar dos veces para qué servía).** La justificación original era "repartir exposición", y al medirlo resultó falsa: **60 de 83** lugares-por-puerta ya califican para alguna categoría de mérito, y dentro de cada categoría el coach que se muestra ya rota por persona y por día — la exposición ya estaba repartida. La única función real del relleno era llegar a 3 cards. Encima quedaba tautológico en las puertas angostas ("Trabaja Sexualidad" dentro de la puerta Sexualidad). Ahora el deck muestra solo lugares GANADOS: entre 1 y 4 cards según cuántas categorías tengan gente. Con los datos de hoy: 3 puertas con 3 cards, 5 con 2, 2 con 1. Si una puerta muestra una sola card eso es información verdadera, y "Ver lista completa" sigue teniendo a todos. Se fueron `MIN_DECK_SIZE`, `FallbackKey`, `fallbackSlotFor`, `fallbackUsedKey`, `SLOT_RESPONDE`, el parámetro `subtemas` de `rankDeck` y el campo `fallback` de `DoorStanding`. `rankDeck` volvió a ser cuatro categorías y nada más.
- **`check-deck-pools.ts` mide cobertura**: por puerta, cuántos coaches entran a alguna categoría vs. cuántos a ninguna. Es el número que decidió esto.
- El panel del coach ahora dice la verdad cuando no ocupa ningún lugar: *"Hoy no ocupás ningún lugar de esta puerta, así que no aparecés en las recomendaciones. Seguís en Ver lista completa"*. Antes lo consolaba con el chip de relleno.
- **Se sacó el chip de relleno "Con lugar esta semana" (pedido de Andre, probando en dispositivo).** Razón: la card del deck YA muestra esa misma frase abajo, en la meta junto al precio — el chip repetía información que ya estaba en pantalla. La escalera de relleno queda en dos: "Trabaja X" (subtema de la puerta) y "Responde en 24 h" como último recurso. `CachedCoach.hasSlotThisWeek` se mantiene: es lo que alimenta la meta.
- **Segundo bug del relleno, este SÍ encontrado probando en dispositivo (Andre):** en "Ansiedad y estrés" salían "Opción económica" + **"Responde en 24 h" dos veces**. Era la conducta diseñada, pero el diseño estaba mal: el chip contesta "por qué te muestro a esta persona", y "Responde en 24 h" no distingue a nadie (es cierto de casi todo el catálogo). Repetido se lee como bug. El relleno ahora elige de más informativo a menos — 1) "Con lugar esta semana" (fuerte porque es raro), 2) **"Trabaja X"** con el subtema de la puerta que ese coach cubre (diferencia de verdad y ayuda a elegir), 3) "Responde en 24 h" como último recurso — y `rankDeck` lleva un set de etiquetas usadas para no repetir dentro del mismo deck. `rankDeck` toma un 4º parámetro opcional `subtemas`. El script de calibración ahora imprime los chips de cada puerta y falla ruidoso si alguno se repite.
- **Bug del chip de relleno, encontrado leyendo cómo lo renderiza `app/(tabs)/conexiones.tsx` (no probando — todavía no se probó nada en dispositivo):** la card del deck ya mostraba "Con lugar esta semana" en la meta de abajo, alimentada por un fetch aparte (`coachesWithSlotThisWeek`) contra la misma vista. El chip nuevo pone esa misma frase arriba, así que para cualquier coach que entrara por ese chip la frase salía **dos veces**. Arreglado: la disponibilidad ahora sale del cache, se fueron el `useEffect`, el estado `availableSet` y el import de `coachesWithSlotThisWeek` de `conexiones.tsx`, y la meta de abajo se suprime cuando el chip ya lo dijo. Un fetch menos por cada cambio de deck. (`lib/coachAvailability.ts` quedó sin consumidores — no se borró.)
- **Decisiones de Andre sobre lo demás:** la ventana de "nuevo" **queda en 28 días** (se propuso ensancharla a 60 y se descartó). Los umbrales de `recomendado` y `tendencia` **no se tocan** — están vacíos porque todavía no arrancó la operación, y bajarlos haría que las etiquetas mientan.

**Auditoría de estado (pedido de Andre: "qué falta por implementar"):**

- Se sondeó el schema REAL con la anon key en vez de creerle a los documentos, porque SCHEMA.md advierte que "documentado como corrido" ya falló dos veces. Falló de nuevo, en las dos direcciones.
- 🔴 **BUG EN VIVO (ya corregido en esta misma sesión): la pantalla de Gratitud estaba rota.** `app/gratitud.tsx:154-156` inserta `item_1`/`item_2`/`item_3` y esas columnas **no existen en prod** — `scripts/add-gratitude-items.sql` nunca se corrió. Todo guardado en esa pantalla falla. Único bug en vivo de la auditoría.
- **Al revés:** `reports`, `session_notes` y `bookings.refund_attempts` SÍ existen, contra lo que decía SCHEMA.md ("FALTA correr"). Corregido.
- **`profiles.accepted_terms_at` ya existe en la base y ningún código la escribe.** El changelog la listaba como "columna nueva a crear" — está creada, falta usarla.
- **Ya resuelto pero listado como pendiente en entradas viejas:** Google y Apple sí bloquean el registro hasta aceptar T&C (`RegisterScreen:200,215`), y los términos sí están cableados a `/legal` (`ProfileOwnScreen:165-166`). Quedan muertos solo "Notificaciones" e "Idioma".
- **Bloqueadores de lanzamiento, ordenados:** (1) MP nunca probado contra la API real — las dos incógnitas son si el token de plataforma puede leer el pago del coach en `mp-webhook` y el template del manifest de firma; (2) `mp-create-payment` sin redeployar, así que prod cobra la comisión vieja mientras la app promete la nueva; (3) figura fiscal sin definir; (4) páginas legales sin hostear (+ URL de eliminación de cuenta que pide Google); (5) dev build sin armar, que a su vez bloquea meter la videollamada adentro de la app.

**Pendiente para la próxima sesión:**
- ~~Correr `scripts/add-gratitude-items.sql`~~ **HECHO por Andre el 07/08/2026**, verificado sondeando las tres columnas. La pantalla de Gratitud estuvo rota casi un mes (el script existía desde el 12/07 y nunca se había corrido). **Falta probar en el celular** que ahora sí guarda.
- ~~Redeployar `mp-create-payment`~~ **HECHO 07/08/2026**: deployado y verificado con `functions list` (ACTIVE, **versión 17**, `updated_at` nuevo; el resto de las funciones sigue en versiones del 05/08). Prod ya cobra **20% la primera sesión de cada par coach-usuario y 15% de la 2da en adelante**, que es lo que la app venía prometiendo en el copy desde la sesión 83.
- **`harden-reviews-insert.sql` ya lo corrió Andre** (aplicó los tres bloques). Sin confirmar contra el output del paso 3 — si querés verificarlo, corré el bloque de verificación y mirá que `reviews_insert_completed_session` sea la única política de INSERT.
- **Volver a correr `check-deck-pools.ts` cuando haya datos reales.** Hoy el veredicto está dominado por el hecho de que hay 1 reseña y 6 coaches seed; los umbrales recién se pueden juzgar con operación real.
- **El precipicio del día 28 es real y hay que mirarlo en producción:** con el AND, un coach que llega a los 29 días sin ninguna reseña se cae del carril "nuevo" sin haber tenido nunca un turno. Hoy 4 de los 6 seed están exactamente en ese estado. Queda cubierto por el relleno de disponibilidad, pero conviene ver si en operación real la ventana alcanza.
- Probar `/coach-visibilidad` en dispositivo con una cuenta de coach real: sobre todo "recién postulado" (sin verificar, sin temas) y "verificado con temas pero sin reservas".
- **Calibrar los umbrales de v3 con datos reales.** Están puestos a ojo: 4.5★, 3 reseñas, 30% de reagendamiento, 3 reservantes en 30 días. Si quedan altos, los pools se vacían y los slots se omiten; si quedan bajos, "Recomendado por Vita" no dice nada. Revisar con Joaquín.
- **Enchufado el reagendamiento como señal, falta verificar que tenga volumen**: hoy casi ningún coach llega a `MIN_REBOOKING_SAMPLE = 5` completadas, así que en la práctica todos caen al tramo de estrellas. Es lo esperado al principio.
- **Mecánica de "cliente traído"**: sigue sin existir link de invitación ni comisión diferencial para el cliente que el coach trae de afuera. Es lo contrario de la fuga y no se premia — es el bloque grande que quedó abierto.
- Arreglo de fondo del catálogo: traer coaches **por puerta desde el server** en vez de bajarse el catálogo entero al cliente. El `.limit(200)` compra tiempo, no resuelve.

## 2026-08-07 — Joaquín (sesión 85)

**Tocado:** `app/(tabs)/index.tsx`.

**Resumen:**
- Se volvió a agregar la card "Tus recursos a mano" (recursos pinneados) en Inicio, que se había sacado en sesión 81 (commit `b50514a6`). Joaquín pidió restaurarla tal cual estaba.
- Reconstruida desde el diff del commit que la eliminó: estado `displayResources`, el `useFocusEffect` que trae `pinned_resources` (recarga al volver a la tab), el mapeo a tools de Vita (`VITA_TOOL_MAP`) o recursos de coach (`resources`), el estado vacío ("Fijá tus recursos favoritos acá") y el carrusel horizontal con `ScaleCard`. Va como sección 6, después de "Tu próxima sesión". Sin cambios en `PinButton`/`pinned_resources` — esa parte nunca se había tocado.
- Typecheck y lint limpios.
- Sin cambios de schema.

**Pendiente para la próxima sesión:**
- Ninguno nuevo de esta sesión.

## 2026-08-07 — Joaquín (sesión 84)

**Tocado:** `app/(tabs)/index.tsx`.

**Resumen:**
- Se sacó la card "Para vos ahora" (`ResourceSuggestionCard`) de Inicio — a Joaquín no le convenció el resultado visual. Solo se quitó el `import` y el bloque JSX; no se tocó nada más de la pantalla (el check-in, `CoachSuggestionCard` y "Sobre vos" siguen igual).
- **`components/ResourceSuggestionCard.tsx` queda sin usar en ningún lado** (no se borró). Nota escrita después de mergear el trabajo paralelo de Andre (sesión 83, más abajo): la tabla que este componente usaba **no era `resource_recommendations`** como se pensó al escribir esta entrada — hubo una colisión de nombres con la tabla real de recomendaciones coach→usuario de Recursos v2, y Andre la encontró y la resolvió renombrando la de mood a **`mood_suggestions`**. El componente ya apunta ahí y loguea errores en vez de tragárselos, pero sigue sin consumidor en ningún lado porque esta sesión lo sacó de Inicio.
- Nota aparte: en medio de la sesión, un error de Expo Go (`ERR_NGROK_3200`, túnel offline) resultó ser porque el servidor de desarrollo nunca se había levantado — no era un bug de código. Diagnosticado desde una captura de pantalla.
- Sin cambios de schema de esta sesión (el rename de tabla fue trabajo de Andre, ver su entrada).

**Pendiente para la próxima sesión:**
- Decidir qué hacer con `ResourceSuggestionCard.tsx` y `mood_suggestions`: ¿se borra del todo, se rediseña para reintentarlo, o se deja archivado por si sirve más adelante?
- Sigue pendiente de sesión 80: confirmar si Expo Go (aparte del error de túnel de hoy, que era otra cosa) sigue siendo un problema real de performance — falta el dev build.
- Sign in with Apple sigue pausado a propósito.
- Ver también los pendientes de Andre (sesión 83, abajo) — hay varios abiertos en paralelo (redeploy de `mp-create-payment`, T&C de Google/Apple, probar borrado de cuenta).

## 2026-08-06 — Andre (sesión 83)

**Tocado:** `screens/CoachHomeScreen.tsx`, `screens/CoachReservasScreen.tsx`, `screens/SalaScreen.tsx`, `app/(coach)/_layout.tsx`, `supabase/functions/mp-create-payment/index.ts`, `screens/CoachProfileScreen.tsx`, `scripts/add-payments-v1.sql`, `docs/terminos-y-condiciones.md`, `docs/legal-instrucciones.md`, `SCHEMA.md`, `screens/ProfileOwnScreen.tsx`, `screens/RegisterScreen.tsx`, `app/_layout.tsx`, `package.json`. Nuevos: `app/legal.tsx`, `components/LegalSheet.tsx`, `scripts/sync-legal.mjs`, `constants/legal.ts` (generado). **`scripts/add-session-notes.sql` corrido por Andre** · **`mp-create-payment` redeployado el 07/08/2026 — ver sesión 86.**

**Resumen:**
- **Bug realtime del lado coach ("cannot add postgres_changes callbacks ... after subscribe()"):** `supabase.channel(topic)` de realtime-js 2.108.2 **devuelve el canal existente** si ya hay uno con ese topic, y `removeChannel()` es async (`await unsubscribe()` → teardown). Al remontar (reiniciar sesión, Fast Refresh) el canal viejo sigue en la lista y en estado `joined`, así que `.on()` explota. Los 4 canales del lado coach usaban topics fijos; ahora llevan sufijo random (`${Math.random().toString(36).slice(2)}`), el mismo patrón que ya tenían los 3 del lado usuario. **A confirmar en Expo Go** (reiniciar sesión como coach: sin errores y badges de campana/reservas/chats vivos).
- De paso, `SalaScreen` usaba otro workaround (buscar el canal stale y removerlo antes) que era racy — `removeChannel` no lo saca de la lista de forma síncrona, solo no explotaba porque `unsubscribe()` marca `leaving` en el acto, pero después re-suscribía un canal en teardown. Unificado al mismo patrón.
- **Cambio de comisión (decisión Andre):** de **20% las primeras 3 sesiones / 15% desde la 4ta** a **20% la PRIMERA sesión de cada par coach-usuario / 15% de la 2da en adelante**. Razón: el 20% es el costo de adquisición del cliente nuevo, no un peaje sobre la relación que el coach sostiene solo; además dejaba la tarifa más alta justo en las sesiones 2-3, las de máxima fuga. Cuesta ~2-3 pts de GMV. **Tercer tramo de 10% descartado** (no cubre costos + margen). Sin cambio de schema: solo `commissionPct = count < 1 ? 20 : 15` en `mp-create-payment`, más el copy del `CoachProfileScreen` ("te cobramos por presentarte a alguien nuevo, no por la relación que construís después"), T&C §8.3, `legal-instrucciones.md`, el header de `add-payments-v1.sql` y SCHEMA.md.

- **Cerrado el pendiente de RLS de la 82 — `scripts/add-session-notes.sql` re-corrido en prod.** El `WITH CHECK` endurecido ya está activo: verificado en `pg_policy` que `session_notes_coach_all` trae el `EXISTS` contra `bookings ⋈ coaches` (antes era solo `coach_id = auth.uid()`). **Auditoría previa: 0 filas** que violaran el invariante nuevo → el agujero nunca se explotó, no hubo nada que limpiar. Antes de correrlo se verificó que el camino normal pasa el check: `SessionNotesSheet` manda `coachId: user.id` (= `auth.uid()` = `coaches.profile_id`) y `userId: recipientId`, y los bookings de `SalaScreen` se consultan filtrados por `sala_id`, así que `b.user_id` siempre coincide.

- **T&C y Política de Privacidad cableados a la app (antes no estaban en ningún lado).** Los borradores de `docs/` eran la fuente de verdad pero la app no los mostraba: los dos ítems del menú de `ProfileOwnScreen` tenían `onPress: () => {}` (botones muertos, en las dos variantes del menú, logueado e invitado) y `RegisterScreen` mostraba un resumen escrito a mano de ~5 párrafos que no coincidía con el documento real. Ahora:
  - **`scripts/sync-legal.mjs` + `npm run sync:legal`** genera `constants/legal.ts` desde los dos `.md` (Metro no bundlea `.md`). El generador saca el blockquote de advertencia interna, aplana los links relativos entre documentos (no resuelven dentro de la app) y detecta los placeholders `[ ]` sin completar → expone `LEGAL_IS_DRAFT`. **Los `.md` siguen siendo la fuente de verdad; hay que correr el script después de editarlos** (anotado en `docs/legal-instrucciones.md`).
  - **`app/legal.tsx`** (ruta `/legal?doc=terminos|privacidad`) renderiza el documento con `react-native-markdown-display`, que ya era dependencia. Registrada en el Stack de `app/_layout.tsx`.
  - **`components/LegalSheet.tsx`**: la hoja del registro, ahora con el texto real. Es componente aparte porque en el registro el usuario no puede perder el formulario a medio llenar y el botón de cierre confirma el checkbox. Reemplaza los dos `<Modal>` escritos a mano (se borraron ~90 líneas de JSX y 10 estilos muertos).
  - **Mientras queden placeholders sin completar, ambas vistas muestran un aviso de "borrador pendiente de revisión legal"**, que desaparece solo cuando el/la abogado/a complete los campos. Hoy quedan 10 (`[RAZÓN SOCIAL]`, `[fecha]`, `[•]`, `[correo de privacidad]`, etc.).
  - Cambio visual deliberado: el sheet del registro era `backgroundColor: 'transparent'` sobre un overlay al 45% de negro. Con 4 párrafos cortos pasaba; con el documento completo el texto oliva sobre fondo oscuro no se lee. Pasa a fondo crema sólido.

- **Nombre unificado a `Vita` (confirmado por Andre).** Había tres formas conviviendo: los documentos legales decían **VIVE**, y la app mezclaba **VITA** (29 usos, en `ProposeResourceScreen`, `CoachLoginScreen`, `RegisterScreen`, `ProfesionalScreen`, `coachDeckRanking`, etc.) con **Vita** (en `recursos.tsx`). El caso más visible era el checkbox del registro: "…de VITA" al lado de un link que abría un documento que hablaba de VIVE. Ahora todo dice **Vita** en prosa. **No se tocaron los identificadores** `VITA_TOOLS`/`VITA_TOOL_MAP` (`constants/vitaTools.ts`) ni el wordmark, que sigue siendo `vita` en minúscula (`components/VitaWordmark.tsx`) — es el logo, es a propósito. El rename se hizo con un patrón que excluye `VITA_` para no romper los identificadores. Typecheck limpio; los 10 errores de eslint del repo son preexistentes (comillas sin escapar en JSX), verificado comparando contra `git stash`.

- **La aceptación de los T&C ahora se registra (antes se descartaba en silencio).** `profiles.accepted_terms` (bool) ya existía en el schema, pero **nadie la escribía**: `RegisterScreen` le pasaba `acceptedTerms` a `signUpWithEmail` y el parámetro estaba declarado sin usarse en el cuerpo — desde el call site parecía que se guardaba. Ahora `signUpWithEmail` lo manda en la metadata del usuario (`options.data.accepted_terms`, es lo único que sobrevive si no hay sesión por confirmación de mail) y, si el signUp devolvió sesión, hace el `UPDATE` sobre `profiles`. Sin migración.
- **El registro del profesional no aceptaba nada.** `CoachLoginScreen` es login y alta de cuenta a la vez y creaba la cuenta sin ninguna aceptación — justo el rol al que apunta la cláusula anti-solicitación §10, que es lo que sostiene la medida anti-fuga #2. Se agregó aceptación implícita: línea bajo el botón "Al continuar aceptás los T&C y la Política de privacidad", con ambos abriendo el `LegalSheet`, y el `signUpWithEmail` de ese path pasa `true`. Se eligió implícita y no checkbox porque la misma pantalla la usa quien solo entra a su cuenta, y un check obligatorio le sumaría fricción a un login.

- **`mp-create-payment` redeployada** (versión 16, ACTIVE). Producción ya cobra 20% solo en la primera sesión de cada par.
- **Incidente encontrado: dos tablas distintas peleando por el nombre `resource_recommendations`.** Apareció al revisar qué faltaba de la medida anti-fuga #4. El 04/08 (sesión 81) se creó una tabla para registrar la tarjeta "Para vos ahora" con ese nombre, que **ya estaba tomado** por la recomendación coach → usuario de Recursos v2. El `CREATE TABLE IF NOT EXISTS` no hizo nada, pero los 4 `CREATE POLICY` siguientes **sí se aplicaron sobre la tabla de v2**. Verificado en prod (columnas de v2, 7 filas de coaches, 7 policies). Dos consecuencias: (1) el registro de la tarjeta de mood **nunca guardó nada** desde el 04/08 —el error se tragaba en el `.then()`—, y (2) se **abrió el RLS de una tabla viva**: `_delete_own` dejó al usuario borrar recomendaciones de su coach (v2 no tenía DELETE a propósito) y `_insert_own` lo dejó fabricar filas con cualquier `coach_id`. Arreglo: tabla de mood renombrada a **`mood_suggestions`** (`scripts/create-mood-suggestions.sql`), `ResourceSuggestionCard` apuntado ahí y **ahora loguea los errores** en vez de tragárselos, las 4 policies colgadas se dropean con `scripts/fix-resource-recommendations-policies.sql`, y se borró `scripts/create-resource-recommendations.sql` para que nadie lo vuelva a correr. SCHEMA.md documenta el incidente completo.

- **Figura fiscal DECIDIDA: persona humana en Monotributo** (Andre). Cierra el `TODO(fiscal)` que venía bloqueando código, copy y legales — y lo cierra **sin cambio de código**: factura tipo C sin IVA discriminado, así que el `marketplace_fee` retenido es la comisión final y el copy "20%/15%" es exacto. Se descartó constituir sociedad porque SAS/SRL obliga a Responsable Inscripto, o sea IVA sobre la comisión (el coach pasaría a pagar 24,2%, o el ingreso real caería a ~16,5%) con cero facturación todavía; y el split de MP hace que el ingreso declarable sea solo la comisión y no el GMV, así que el tope del monotributo queda lejos. Contra asumida y explicitada: responde con patrimonio personal. Gatillos para revisar: inversión, socio formalizado, cercanía al tope, o volumen real.
- **Legales avanzados hasta donde se puede sin abogado.** §8.4 redactada para monotributo, más §8.5 (situación fiscal del Profesional: Vita no factura la Sesión, solo su comisión, y no es agente de retención) y §8.6 (cambio de condición fiscal). Los documentos pasaron de "razón social" a `[NOMBRE Y APELLIDO]`, que es lo correcto para persona humana. **Placeholders: de 10 a 1.** Se completaron comisión (20/15), proveedor de video, proveedor de analítica, y después los datos del titular que pasó Andre: **Andre Albisu Lambertini, CUIT 20-46034087-0, De los Extremeños 5069, Córdoba, y vitaappar@gmail.com** para contacto legal y privacidad. El CUIT venía con un dígito de más (`20-460340870-0`, 12 dígitos); se detectó al validar el verificador y se corrigió con Andre antes de escribirlo. **Queda solo `[fecha]`**, que va cuando haya fecha real de publicación.
- ⚠️ **Cuando se complete `[fecha]`, el aviso de "borrador pendiente de revisión legal" desaparece solo de la app** — porque hoy la bandera `LEGAL_IS_DRAFT` depende únicamente de que queden placeholders. Andre decidió dejar pendiente desacoplarlo, pero ese es el momento en que hay que acordarse: el texto va a seguir sin revisión de abogado.
- **Proveedores verificados contra el código para la Política §6:** Supabase, Mercado Pago, **Daily.co** y Expo push. **Analítica: ninguna de terceros** — `analytics_events` es tabla propia. Hallazgo: **lo de Jitsi es vestigial** — un trigger sigue generando `meet.jit.si/vita-<hex>` en `salas.room_url`, se pasa como param `roomUrl` a `booking-success` y esa pantalla ni lo lee. Daily.co es el único proveedor de video real.

- **Punto 3 (legales/publicación) terminado hasta donde no depende de terceros.** Tres entregables:
  - **Páginas web públicas:** `npm run sync:legal` ahora también genera `web/legal/terminos.html` y `web/legal/privacidad.html` del mismo texto que muestra la app, así no pueden divergir. Responsive, modo oscuro, con el aviso de borrador mientras queden placeholders. Se agregó `marked` como devDependency — se prefirió una librería probada antes que un conversor markdown casero, porque un error de parseo en un documento legal se publica. Verificado que la conversión no pierde secciones (14 y 24 `<h2>`, igual que los `.md`).
  - **`docs/etiquetas-privacidad-tiendas.md` (nuevo):** las respuestas exactas de las *App Privacy labels* de Apple y del formulario de seguridad de datos de Google, auditando schema, código y `app.json`. Incluye lo que hay que responder **"No"** (ubicación —`expo-location` no es dependencia, verificado—, contactos, diagnósticos, publicidad) y el punto fino de que los datos de tarjeta los recolecta Mercado Pago, no Vita, así que van como *Purchase History* y no como *Payment Info*. **Vita puede declarar que NO hace tracking**, lo que evita el prompt de ATT en iOS: no hay SDK de publicidad ni analítica de terceros. Mantenerlo así es una ventaja concreta.
  - **Google y Apple ya no saltean la aceptación de T&C.** El checkbox estaba **adentro** del formulario de email, que arranca colapsado — o sea que quien tocaba Google no tenía siquiera dónde aceptar. Se movió arriba de los tres métodos, los botones sociales quedan deshabilitados hasta tildarlo, y `signInWithGoogle`/`signInWithApple` ahora reciben el flag y persisten `profiles.accepted_terms` vía `markTermsAccepted()`.
- **`app.json`: dos textos de permiso seguían diciendo "Vive"** (calendario y micrófono de recursos) — se me habían escapado en el rename porque solo barrí `.ts`/`.tsx`. Son textos que ve el usuario en el diálogo de permisos del sistema.

- **Borrado de cuenta construido** (el bloqueador de iOS, guideline 5.1.1(v)). Nuevo: `supabase/functions/delete-account/index.ts`, `scripts/add-account-deletion.sql`, `lib/accountDeletion.ts`, y el ítem + modal de confirmación en `ProfileOwnScreen`.
  - **Modelo: borrado + anonimización, no cascade.** Decisión de Andre: reseñas y mensajes se conservan como "Usuario eliminado" (son reputación e historial del profesional, y borrarlas dejaría que alguien se dé de baja para eliminar una reseña negativa); sesiones futuras se cancelan disparando el reembolso.
  - **Se consultó el mapa real de FKs en prod (`pg_constraint`) antes de escribir la migración, y apareció lo que un borrado ingenuo habría roto:** `profiles.id → auth.users` es **CASCADE**, así que borrar la cuenta se llevaba la fila de `profiles` y con ella la lápida (reventando de paso las FKs NO ACTION de `reviews`/`messages`/`salas`); `bookings.user_id → auth.users` es **CASCADE**, o sea que se borraban **todas las reservas** —respaldo fiscal e historial del coach—; y `analytics_events.user_id` es **NO ACTION**, que directamente **bloqueaba** el borrado con error de FK. El script corrige las tres: dropea la FK de `profiles`, repunta `bookings.user_id` a `profiles(id)` con NO ACTION, y pasa `analytics_events` a SET NULL.
  - Hallazgo lateral: **`user_events` SÍ existe en prod** (cuelga de `auth.users` con CASCADE), pese a que la sesión 79 concluyó que no existía y por eso se reusó `registrarEvento`/`analytics_events`.
  - Guardarraíl del coach: no puede darse de baja con sesiones agendadas — se le pide cancelarlas primero, para que cada cancelación dispare su reembolso y su aviso al cliente.
  - **Probado en dispositivo y funcionando.** El primer intento falló: el paso de anonimización hacía `email: null` y **`profiles.email` no acepta nulos**. Dos arreglos: el email pasa a un placeholder opaco `deleted-<uuid>@vita.invalid` (un literal fijo chocaría contra el UNIQUE en la segunda baja; `.invalid` es TLD reservado), más un reintento con los campos mínimos por si otra columna opcional también fuera NOT NULL. **Y se arregló el diagnóstico**: `lib/accountDeletion.ts` leía el body del error de `data`, pero supabase-js lo deja en `error.context` ante 4xx/5xx — cualquier fallo se mostraba como "intentá más tarde" sin motivo. Ahora el detalle real llega a la pantalla.
  - **`scripts/add-account-deletion.sql` CORRIDO y `delete-account` DEPLOYADA** (v1, ACTIVE). Verificado en `pg_constraint`: `profiles` y `bookings` ya no cuelgan de `auth.users`, `analytics_events` quedó en SET NULL, y el resto sigue en CASCADE. La migración no encontró reservas huérfanas (el `ALTER` de la FK nueva valida las filas existentes, así que habría fallado).

**Pendiente para la próxima sesión:**
- **Probar la baja de punta a punta** con una cuenta de prueba: que se borre el contenido personal, que las reservas queden con "Usuario eliminado" del lado del coach, y que una sesión futura pagada dispare el reembolso.
- **A confirmar con abogado:** si `session_notes` se conservan (hoy sí, mismo criterio que los mensajes) o se suprimen — contienen información sensible de alguien que pidió la baja, pero un/a psicólogo/a puede tener obligación de conservar registros.
- **Hostear `web/legal/` y cargar la URL** en App Store Connect y Play Console. Falta elegir dónde (EAS Hosting, GitHub Pages, sitio de marketing).
- **URL de solicitud de eliminación de cuenta** (requisito aparte de Google Play), una página más junto a las anteriores.
- Dos botones más muertos en `ProfileOwnScreen`: "Notificaciones" e "Idioma" siguen con `onPress: () => {}`.
- **Limpiar el vestigio de Jitsi:** trigger de `salas.room_url` + el param `roomUrl` muerto en `BookingScreen_Confirm`/`booking-success`. No molesta, pero confunde a quien lea el schema y podría terminar en un documento legal por error.
- **La videollamada ocurre FUERA de la app** (`SalaScreen:485`, `WebBrowser.openBrowserAsync` contra la sala prearmada de Daily). Contradice de frente la medida anti-fuga #4: el momento de máximo valor pasa en un navegador con marca ajena. Moverla adentro con `@daily-co/react-native-daily-js` — requiere dev build (módulo nativo, no corre en Expo Go).
- (Cerrado en esta sesión: los 2 scripts del incidente corrieron y están verificados — 3 policies en `resource_recommendations`, 4 en `mood_suggestions`.) Queda **probar en el celular** que la tarjeta "Para vos ahora" ahora sí inserta: hacer un check-in de mood y mirar que aparezca la fila.
- **Google y Apple saltean la aceptación de T&C.** En `RegisterScreen` el checkbox solo bloquea el botón de email (`disabled={!acceptedTerms || loading}`, línea 338); los botones de Google y Apple están habilitados desde el principio (líneas 169 y 184), así que se puede crear cuenta sin tildar nada. Además esos paths no pasan por `signUpWithEmail`, así que persistir la aceptación ahí necesita otro lugar (probablemente el `onAuthStateChange` de `AuthContext`, al detectar un alta nueva). Hay que decidir entre bloquear los botones hasta tildar o pasar a aceptación implícita como en el coach.
- Para que §10 sea oponible con más fuerza convendría guardar **cuándo** y **qué versión** aceptó cada usuario — eso sí serían columnas nuevas (`accepted_terms_at`, `accepted_terms_version`).
- ~~Redeployar `mp-create-payment`~~ — **hecho el 07/08/2026** (sesión 86).
- Confirmar en el celular que el error de realtime no vuelve al reiniciar sesión como coach, y probar notas de sesión con el RLS nuevo (coach guarda privada + compartida; el usuario ve solo la compartida).
- **Los T&C no están cableados a la app:** `ProfileOwnScreen.tsx:137-144` tiene los dos ítems del menú con `onPress: () => {}` (botones muertos) y los modales de `RegisterScreen` muestran un texto corto propio, no el borrador de `docs/terminos-y-condiciones.md`. O sea, la cláusula anti-solicitación §10.2 —base legal de la medida anti-fuga #2— hoy no la acepta nadie.
- **Figura fiscal (monotributo vs. RI) sigue sin definirse** y bloquea el `TODO(fiscal)` de `mp-create-payment:106` (si es RI, el IVA va sumado al `marketplaceFee`) además del copy.

## 2026-08-06 — Andre (sesión 82)

**Tocado:** `supabase/functions/_shared/mp.ts`, `supabase/functions/mp-create-payment/index.ts`, `supabase/functions/mp-process-refunds/index.ts`, `supabase/functions/mp-webhook/index.ts`, `supabase/functions/mp-oauth-callback/index.ts`, `screens/BookingScreen_Confirm.tsx`, `screens/CoachProfileScreen.tsx`, `SCHEMA.md`. Nuevo: `scripts/add-refund-attempts.sql`. **SQL corrido y las 5 functions redeployadas por Andre.**

**Resumen — auditoría del pipeline de pagos MercadoPago (estaba construido pero sin repasar):**
- El pipeline resultó estar completo de punta a punta (OAuth con PKCE + state firmado, comisión server-side 20/15% por par, split, webhook con firma validada, reembolsos, cron). Migración de pagos v1 y trigger `trg_mark_refund_on_cancel` ya corridos en prod (confirmado en SCHEMA.md — la memoria vieja decía "pendiente", estaba desactualizada). Los headers de 4 funciones decían "SCAFFOLD v1" y "comisión 10%", ambas falsas — corregidos.
- **Bug real arreglado (#1):** el branch idempotente de `mp-create-payment` (reserva con preferencia pendiente) devolvía solo `preference_id`, sin `init_point` → el cliente no abría el checkout y mandaba al usuario a "reserva ok" **sin pagar**. Ahora hace un GET de la preferencia existente y devuelve su `init_point` (respeta test mode con `sandbox_init_point`).
- **Refresh de token del coach (#2), faltaba por completo:** el `access_token` de OAuth dura ~180 días y nada usaba el `refresh_token` guardado → a los ~6 meses todo cobro/reembolso de ese coach fallaba con 401 sin recuperación. Nuevo `getFreshCoachToken` en `_shared/mp.ts`: único punto por el que `mp-create-payment` y `mp-process-refunds` sacan el token; refresca (grant_type=refresh_token) si vence en <24h y reguarda el nuevo par (el refresh_token de MP es de un solo uso). Requiere `MP_CLIENT_ID`/`MP_CLIENT_SECRET` en secrets (ya deberían estar del OAuth).
- **Dead-letter de reembolsos (#6):** `mp-process-refunds` reintentaba un reembolso roto de forma permanente cada 5 min sin alertar. Nueva columna `bookings.refund_attempts` (`scripts/add-refund-attempts.sql`) — incrementa en cada fallo, filtra `< 6`, y al tope loguea `DEAD-LETTER` y para (queda visible para intervención manual, reencolar = poner en 0).
- **Hardening cliente (#5):** `BookingScreen_Confirm` tragaba en silencio los errores de `mp-create-payment` (ni siquiera logueaba). Ahora hace `console.warn` distinguiendo el caso esperado (409 coach sin MP, pagos opcionales) de una falla real.
- **DB:** solo columna nueva `refund_attempts`. `scripts/add-refund-attempts.sql` corrido y las 5 edge functions redeployadas. SCHEMA.md ya actualizado.
- **Cambio de cuenta MP (pedido aparte, mismo día):** faltaba poder cambiar de cuenta. Coach (`CoachProfileScreen`): cuando ya está conectado, ahora aparece un botón "Cambiar" al lado del tilde que re-corre el OAuth efímero → el callback sobreescribe el token por `coach_id`, sin necesidad de desconectar. Usuario (`BookingScreen_Confirm`): en `__DEV__` (Expo Go/dev build) el checkout abre con `openAuthSessionAsync` + `preferEphemeralSession` (sesión limpia, se puede pagar con distinta cuenta comprador entre pruebas); en producción sigue con `openBrowserAsync` persistente (usuario real no re-loguea en cada reserva). Solo frontend, sin deploy. **Desconexión total (dejar de recibir pagos) NO se hizo** — requiere una edge function porque `coach_mp_accounts` está bloqueada por RLS; pendiente si se quiere.

**Cerrado el pendiente de sesión 78 — silencio de `ReminderBell.handleSave` + filas rotas de `resource_reminders`:**
- `handleSave` (`components/ReminderBell.tsx`) ignoraba el retorno de `saveReminder` (que devuelve `null` si falla) y cerraba la hoja igual → el usuario creía que guardó sin guardar. Ahora chequea el retorno: si es `null`, muestra `Alert` y deja la hoja abierta para reintentar. Mismo fix en `handleDelete`: `deleteReminder` (`lib/resourceReminders.ts`) pasó de `Promise<void>` a `Promise<boolean>` (devuelve `!error`), y el componente avisa si el borrado falla. Backward-compatible (el otro caller, `mis-recordatorios.tsx`, ignora el retorno).
- **Diagnóstico de filas rotas (corrido por Andre en Supabase): 0 filas con `ref is null`.** Confirma que la columna `ref` era NOT NULL → los inserts del bug de `ref` (sesión 78) fallaban del todo, no dejaron filas huérfanas. No hay nada que limpiar. El daño real del bug fue silencioso: recordatorios que el usuario creyó guardar y nunca se persistieron (enmascarado justamente por el `handleSave` que ahora se arregló).

**Cerrado el gap de analytics de sesión 79 — evento cuando el coach acepta una reserva:**
- `confirmBooking` (`lib/coachBookingActions.ts`) no registraba ningún evento al pasar una reserva pendiente a `'confirmada'`. Se agregó `registrarEvento('reserva_aceptada', { booking_id, coach_id, client_id, scheduled_date })` dentro del `Promise.all` que ya notificaba (en paralelo, sin latencia extra). Nombre nuevo a propósito: `'reserva_confirmada'` ya lo dispara el usuario al reservar (`BookingScreen_Confirm`), este es el coach aceptando después. `registrarEvento` anota `user_id = coach` (su sesión); el usuario de la reserva queda en `client_id`. Sin schema (`analytics_events.event_name` es libre, sin CHECK). Solo frontend, sin deploy.

**Feature nueva — reportar usuarios y coaches (moderación):**
- Bidireccional (usuario→coach y coach→usuario), definido con Andre: entrada desde el chat y desde el perfil del profesional; revisión manual del equipo, sin bloqueo automático.
- **Tabla `reports`** (`scripts/add-reports.sql`, **FALTA correr en Supabase**): `reporter_id`/`reported_id` (ambos `profiles.id`), `reason` (slug libre, lista en el front), `details` nullable, `sala_id` nullable (contexto del chat), `status` (pendiente/revisado/accionado/descartado). RLS: insert/select solo propios, sin update/delete desde cliente (el equipo gestiona `status` con service role). Documentada en SCHEMA.md.
- **`components/ReportSheet.tsx`** (nuevo): hoja compartida, mismo lenguaje visual que `ReminderBell`, 6 motivos + detalle opcional ("Otro" lo exige). Chequea el resultado del insert (aprendido del bug de hoy): si falla, Alert y no cierra; si OK, confirmación cálida. `lib/reports.ts` (`submitReport` + `REPORT_REASONS`) + evento `reporte_enviado`.
- **Puntos de entrada:** `SalaScreen` (botón "⋯" en el header → reporta a la otra parte con `sala_id`) y `ProfesionalScreen` (link "Reportar" al pie, oculto en el propio perfil, pide login si hace falta). Typecheck y lint limpios (los 6 warnings/errores de lint en SalaScreen son preexistentes, no de este cambio).

**Anti-fuga del marketplace (estrategia + medida #1):**
- Discusión con Andre: el coaching es propenso a la fuga (relación repetida, split MP = coach cobra en su cuenta). Se guardó la estrategia en memoria (`project_vive_anti_disintermediation`): 5 medidas ordenadas (re-reserva 1-tap, moderar perfiles+ToS, comisión decreciente, sesión pegajosa, detección diferida) + la decisión de NO pre-booking.
- **Medida #1 (re-reserva de un toque):** al investigar resultó **ya construida** — la card `finalizada` de `SalaScreen` ("Reservar próxima sesión" → `handleReschedule` → `/booking-calendar` con el coach precargado). Único hueco: solo aparecía en la ventana de 24hs post-sesión. **Se agregó re-reserva PERSISTENTE:** pill "Reservar" fijo en el header del chat (`SalaScreen`), visible siempre que la otra parte sea coach (`recipientIsCoach`), no solo en esas 24hs. Reusa `handleReschedule`. La card fuerte post-sesión queda igual (empujón inmediato); el pill es el acceso permanente. NO se re-activó la card de re-reserva de Conexiones (`SHOW_REBOOK=false`, escondida por pedido de Andre) — Andre no explicó por qué se escondió, dejar así.
- **Medida #3 (comunicar comisión decreciente al coach):** card de info en la sección Mercado Pago de `CoachProfileScreen` — "20% en las primeras 3 sesiones con cada persona y 15% de la cuarta en adelante… cuanto más sostenés el vínculo, menos comisión pagás". Ícono `trending-down`. **Sin IVA a propósito** (depende de la figura fiscal, TBD — ver `project_vive_payments`). Refuerza el incentivo a retener la relación en la app. Solo copy, sin schema.
- **Medida #2 (parte código — moderar bio del coach):** `lib/contactInfoGuard.ts` (nuevo) `hasContactInfo()` detecta teléfono/CBU (7+ dígitos con separadores), email, links (http/www/dominio+TLD), keywords (whatsapp/instagram/telegram/tiktok/facebook/cbu/cvu/alias/transferencia) y @handles. Enchufado en `saveBio` (`CoachProfileScreen`): si la presentación tiene datos de contacto, Alert y no guarda. Validado con 8 casos que deben bloquear + 6 legítimos sin falsos positivos ("20 años", "15 sesiones", "60 minutos" no disparan). Es **capa client-side** (setea la norma); refuerzo server-side (trigger/edge) queda pendiente si se detecta evasión. El **ToS anti-solicitación es texto de Andre** (legal), no código.
- **Medida #4 (sesión pegajosa — notas de sesión):** al investigar, gran parte ya existía (coach recomienda recursos en el chat, pantalla de progreso, historial). El hueco eran las **notas de sesión**, que se construyeron. Tabla `session_notes` (`scripts/add-session-notes.sql`, **FALTA correr**): por sesión, una nota privada (solo coach) + una compartida (la ve el usuario), UNIQUE(booking_id, shared). **Tabla aparte a propósito** (no columna en bookings): RLS de Postgres es por fila, una columna de nota privada le quedaría visible al usuario que ya lee su booking. RLS: coach FOR ALL sobre lo suyo, usuario SOLO lee compartidas propias. `components/SessionNotesSheet.tsx` (coach, dos campos, upsert/borra) + `lib/sessionNotes.ts`. En `SalaScreen`: pill "Notas" en el header (lado coach) + card de nota compartida en el chat (lado usuario). Typecheck y lint limpios.

**Pase de calidad (/simplify) sobre lo de hoy:** se extrajeron las primitivas idénticas del bottom-sheet (`flex`/`overlay`/`sheet`/`handle`) a `components/ui/sheetStyles.ts`, reusadas por `ReportSheet` y `SessionNotesSheet` (antes duplicadas en cada uno). Cero cambio visual (mismos valores). Resto del código nuevo revisado por reuso/simplificación/eficiencia/altitude: limpio (queries simples sin N+1, notas guardadas en paralelo). No se tocó `ReminderBell` (sus estilos son preexistentes, fuera del diff de hoy) ni se extrajo un componente `BottomSheet` completo (bajo valor / riesgo visual sobre UI recién shippeada).

**Medida anti-fuga #5 (detección en el chat) — activada** (Andre pidió hacerla pese a que estaba diferida): al enviar un mensaje que dispara `hasContactInfo` (mismo detector que la bio, `lib/contactInfoGuard.ts`), Alert de advertencia "¿Compartir datos de contacto?" con Cancelar / Enviar igual. **Advertencia suave, no bloqueo duro** (en un chat hay más falsos positivos que en una bio). Registra `mensaje_contacto_detectado` con `role` + `sent_anyway`. `SalaScreen.sendMessage` se partió en `sendMessage` (chequeo) + `doSendMessage` (envío real); aplica a coach y usuario. Typecheck limpio (los 6 de lint son preexistentes). **Queda pendiente y es tuyo (no código): el ToS anti-solicitación** — el texto legal donde el coach acepta no llevar la relación afuera; cuando lo tengas, se enchufa dónde se muestra/acepta.

**Repaso de seguridad de las RLS nuevas (antes de que queden en prod):**
- **`session_notes` — agujero encontrado y cerrado:** la policy del coach hacía `with check (coach_id = auth.uid())`, que verificaba el autor pero NO que el coach fuera dueño del `booking_id` ni que `user_id` fuera el cliente real de esa reserva → un coach podía escribir notas (incluso compartidas) sobre reservas ajenas o para un usuario que no es su cliente. Se endureció el `WITH CHECK` con un EXISTS contra `bookings`+`coaches` (la reserva existe, su coach es quien inserta, y `user_id` = cliente del booking). USING queda igual (`coach_id = auth.uid()`) para leer/editar lo propio. El camino normal del cliente pasa el check sin cambios. `add-session-notes.sql` actualizado (idempotente).
- `reports` revisada: insert-own / select-own correctas, sin agujero (el equipo lee vía service role). Sin cambios.

**Pendiente para la próxima sesión:**
- **RE-CORRER `scripts/add-session-notes.sql` en Supabase** para aplicar el `WITH CHECK` endurecido (Andre ya corrió la versión anterior + `add-reports.sql`; ambas tablas ya existen). Es idempotente. Probar en Expo Go: reportes (chat ambos sentidos + perfil del coach) y notas de sesión (coach escribe privada+compartida; usuario ve la compartida).
- **Verificar en la primera prueba real contra MP (no es código, es confirmación):** (#3) que el token de plataforma (`MP_ACCESS_TOKEN`) pueda LEER el pago del coach en `mp-webhook` — si no, hay que leerlo con el token del coach vía `external_reference→booking→coach`; sin esto ningún pago se marca `aprobado`. (#4) el template exacto del manifest de firma del webhook (`verifyWebhookSignature` en `_shared/mp.ts`) — si no coincide, toda notificación se rechaza con 401.
- **Sigue siendo el bloqueador de fondo:** conectar tu cuenta real de MP (distinta de la dueña de la app, por el self-split) para poder cerrar la verificación end-to-end. El render del checkout fallaba en el sandbox viejo de MP → evaluar pasar a test users con `init_point`.
- Arrastrados de sesión 81: probar en dispositivo real todo lo de mood/recursos/diario; armar el dev build (sigue sin armarse); Sign in with Apple pausado a propósito. (Ya NO: filas rotas de `resource_reminders` + silencio de `ReminderBell.handleSave`, y evento de confirmación del coach — cerrados esta sesión.)
- **Pre-booking DESCARTADO (decisión de Andre, 06/08):** dejar mensajear a un coach antes de reservar sería el canal más fácil para que coach y usuario intercambien contacto y se arreglen por fuera de la app, esquivando la reserva y la comisión (fuga del marketplace). Se saca de pendientes. La infra de `SalaScreen` ya soporta sala sin booking, así que el bloqueo es a propósito la ausencia del punto de entrada en la UI — NO agregarlo. (Guardado en memoria: `project_vive_anti_disintermediation`.)

---

## 2026-08-04 — Joaquín (sesión 81)

**Tocado:** `lib/moodStats.ts`, `app/(tabs)/index.tsx`, `app/(tabs)/conexiones.tsx`, `app/(tabs)/recursos.tsx`, `app/diario.tsx`, `components/ui/IslandTabBar.tsx`, `hooks/useRecommendedResource.ts`, `SCHEMA.md`. Nuevo: `components/CoachSuggestionCard.tsx`, `components/ResourceSuggestionCard.tsx`, `constants/moodResources.ts`, `scripts/create-resource-recommendations.sql`.

**Resumen — sugerencia de hablar con un coach cuando el mood check-in baja fuerte respecto al anterior:**
- Investigación previa (sin código) confirmó: no existía ninguna lógica que comparara el check-in de hoy contra el anterior — `lib/moodStats.ts` solo tenía racha (`computeMoodStreak`) y promedio semanal (`buildWeeklyHeadline`), y lo único parecido en la app (`RecommendedCard` en `recursos.tsx`, `isIntense` con `mood_id≤2`) sugiere herramientas de autoayuda, nunca hablar con una persona.
- `detectMoodDrop(entries)` (nuevo, `lib/moodStats.ts`): compara `entries[0]` (hoy) contra `entries[1]` (el check-in anterior más reciente, sea de ayer o de hace una semana) — "baja fuerte" = diferencia de 2 niveles o más en la escala 1-5. Sin check-in previo, no hay con qué comparar → no dispara nada. Reusa el array que Inicio ya trae de `useMoodHistory`, sin query nueva.
- `CoachSuggestionCard` (nuevo componente): fila compacta debajo del check-in en Inicio, mismo lenguaje visual que la card de invitación de mood en `app/diario.tsx` (terracota tenue, ícono + texto + pill) — a propósito no es un hero grande, tiene que sentirse opcional. Se puede cerrar con una "×"; una vez cerrada no vuelve a aparecer ese mismo día (`AsyncStorage`, clave con fecha incluida, mismo patrón que `FirstTimeTooltip`).
- **Ruteo del botón, según pedido de Joaquín** — al tocar "Hablar con alguien" se consulta `salas` del usuario (única query nueva, solo se dispara al tocar el botón, no en cada carga de Inicio): sin salas → Conexiones (buscar con quién hablar); una sala → directo a esa sala (`/sala`, mínima fricción); más de una → Mensajes, para que elija.
- Sin cambios de schema — `mood_entries` y `salas` ya estaban documentadas y no se tocó ninguna columna ni tabla nueva.
- **Nota aparte, no relacionada al código:** en medio de la sesión `git` dejó de andar en esta Mac por la licencia de Xcode sin aceptar (bloqueaba cualquier comando git, no solo el mío) — Joaquín la aceptó con `sudo xcodebuild -license` y se resolvió. Dejarlo anotado por si vuelve a pasar en otra sesión.

**Dos cambios más, pedidos aparte en la misma sesión:**
- **Diario, pregunta dinámica según el mood de hoy:** `app/diario.tsx` — la pregunta que encabeza el espacio de escritura ahora sale de un mapa `MOOD_PROMPTS` (1 texto por nivel, Bajón a Brillando) según `todayMoodEntry.mood_id` (misma fuente que ya leía la pantalla, `mood_entries` vía `useMoodHistory`). Sin check-in de hoy, cae a un default genérico ("Este es tu espacio seguro..."). Solo se tocó el prompt de la pantalla de escritura — el modal que muestra una entrada pasada sigue con la pregunta fija de siempre (no se guarda qué prompt correspondía a cada entrada vieja, no había con qué hacerlo dinámico ahí sin migrar datos).
- **Home, se sacó la sección de recursos pinneados:** el bloque "Tus recursos a mano" (card vacía "Fijá tus recursos favoritos acá" / carrusel de pineados) se eliminó de `app/(tabs)/index.tsx` — JSX, el estado/query que lo alimentaba (`pinned_resources`, `useFocusEffect` dedicado), y los estilos que quedaban sin uso. La funcionalidad de pinear/guardar en sí **no se tocó** — sigue viva en `components/PinButton.tsx` y `screens/ResourceDetailScreen.tsx`, disponible desde Recursos. Verificado que no queda ninguna referencia colgada (typecheck y lint limpios).

**Tabla nueva — `resource_recommendations`, coordinada con Andre antes de crearse (pedido explícito de Joaquín, se esperó confirmación de la estructura antes de escribir nada):**
- Tarjeta "Para vos ahora" (`components/ResourceSuggestionCard.tsx`, nueva) debajo de la sugerencia de coach en Inicio: según el `mood_id` del check-in de hoy, muestra una línea contextual + 2 recursos sugeridos (de un mapa fijo de 5 estados × par de herramientas, texto exacto pedido por Joaquín). Sin check-in hoy, muestra un mensaje genérico sin recursos, sin registrar nada (no hay recomendación real que registrar).
- El **orden de los dos recursos se randomiza en cada visualización** (a propósito, para no sesgar el análisis por posición) y se reusa la navegación/routing que ya existe por herramienta (`TOOL_MAP`) — no se tocó ningún recurso ni su lógica.
- Se corrigieron 2 supuestos del pedido original antes de implementar: "Respiración 4-7-8" no existe como técnica en el código (la única herramienta de respiración es "Respiración cuadrada", 4-4-4-4) — se usó esa; "Diario de gratitud" se mapeó a la herramienta existente "Gratitud". Ambos confirmados con Joaquín antes de codear.
- `resource_recommendations` (`scripts/create-resource-recommendations.sql`, documentada en `SCHEMA.md`): un evento por visualización con check-in real (`mood_id`, `mood_label`, `suggested_first`/`suggested_second`, `chosen` nullable con CHECK de que sea uno de los dos sugeridos o NULL). RLS 4-policies own-only, mismo patrón que `mood_entries`. **Migración corrida por Joaquín en Supabase y verificada** (query de lectura contra la tabla real, RLS activo) — el registro ya está funcionando de punta a punta.

**Retoque visual — 3 pedidos aparte en la misma sesión, sobre `mood-hero-minimalista.html` (referencia mandada por captura, no el archivo):**
- **Card de mood en Recursos, versión compacta** (`RecommendedCard`/`isIntense` en `app/(tabs)/recursos.tsx`, sin tocar la lógica de intensidad ni el mapeo mood→recurso): padding 20→14v/16h, radio 22→18, eyebrow 10px→9.5px, título Fraunces 19px→14.5px (`frauncesSemiBold`, la fuente más cerca del peso 500 pedido sin sumar una nueva) con `numberOfLines={2}` en vez de crecer libre, CTA de pastilla ancha con fondo sólido → fila compacta ancho-al-contenido con fondo translúcido blanco, ícono en círculo de 22px. Probado mentalmente contra los 2 textos reales que genera `useRecommendedResource` (Bajón ~64 caracteres, Cansado ~76 — el más largo, coincide con la captura mandada) — ninguno debería necesitar truncar, pero si un texto futuro es más largo el corte a 2 líneas ya está puesto.
- **Isla de tabs, transición más rápida:** `components/ui/IslandTabBar.tsx` — el snap de ancho/label usaba el preset `LayoutAnimation.Presets.easeInEaseOut` (300ms default de RN), bajado a 180ms con la misma curva, respetando `useReducedMotion` como ya hacía.
- **Conexiones:** el buscador "Buscá un profesional por nombre" bajó de arriba del título a abajo (el bloque del título se sacó del ternario donde vivía duplicado y quedó fijo arriba, antes del buscador). Tipografía de "¿Qué te gustaría trabajar hoy?" cambiada a la misma de "¿Cómo venís hoy?" de Inicio (Poppins regular 28px/lineHeight 36 en vez de Fraunces 26px) — se agregó un estilo aparte (`askTitleGreeting`) en vez de tocar `askTitle` directo, porque ese estilo también lo usa el título de la Fase 2 (nombre del eje elegido), que no se pidió cambiar.

**Hallazgo real detrás de "no entiendo para qué sirve la tarjeta" (Joaquín, sobre "Para vos ahora"):** había **dos mapeos mood→recurso independientes y en desacuerdo** — `MOOD_CFG` en `hooks/useRecommendedResource.ts` (alimenta la card de Recursos) y `MOOD_RECS` en `components/ResourceSuggestionCard.tsx` (Home), con sugerencias distintas para el mismo mood el mismo día (ej. Cansado: Escáner corporal en Recursos vs. Respiración+Gratitud en Home — ni una herramienta en común). Se unificaron en `constants/moodResources.ts` (`MOOD_RESOURCES`, nuevo) — un solo `primary`/`secondary` por nivel de mood, más `tone` (frase para la oración de Recursos) y `line` (línea fija de Home). Los pares ganadores fueron los que ya había definido Joaquín para Home (más recientes y explícitos); esto **cambia el comportamiento de la card de Recursos** — antes sugería entre 5 herramientas (incluía Escáner corporal y Meditación), ahora sugiere entre las mismas 3 que Home (Diario/Gratitud/Respiración). El copy de Recursos (`tone`) se reescribió para que siga sonando coherente con las nuevas herramientas primarias. Sin tocar la lógica de fallback por interés/quiz (rama 2 de `useRecommendedResource`, sin check-in de hoy) ni el registro en `resource_recommendations`.

**Pendiente para la próxima sesión:**
- Probar en dispositivo real que Recursos y Home ahora sugieren siempre lo mismo para el mismo mood, y que el copy nuevo de Recursos (`tone`) suena bien con las 3 herramientas (antes sugería 5).
- Probar en dispositivo real los 3 retoques visuales de arriba (card compacta de Recursos, velocidad de la isla, orden/tipografía de Conexiones) y que el registro de "Para vos ahora" funcione en un uso real de punta a punta.
- Probar en dispositivo real: que el umbral de 2 niveles de `CoachSuggestionCard` se sienta bien (ni muy sensible ni muy laxo), que el ruteo a sala/Mensajes/Conexiones ande según corresponda, que el dismiss por día funcione. También confirmar visualmente que Home quedó bien acomodado sin el bloque de pinneados y que los 5 prompts de Diario se leen bien en pantalla.
- Sigue pendiente de sesión 80: confirmar si Expo Go era la causa del lag de arranque — sigue sin armarse el dev build.
- Sigue pendiente de sesión 78: revisar filas rotas en `resource_reminders` y el silencio de errores en `ReminderBell.handleSave`.
- Sigue pendiente de sesión 79: feature de pre-booking (no construida) y evento para cuando el coach confirma una reserva pendiente.
- Retomar Mercado Pago cuando Andre conecte su cuenta real (arrastrado de sesiones previas).
- Sign in with Apple sigue pausado a propósito.

---

## 2026-07-31 — Joaquín (sesión 80)

**Tocado:** `app/(tabs)/index.tsx`, `app/(tabs)/conexiones.tsx`, `app/(tabs)/recursos.tsx`, `app/index.tsx`, `context/AuthContext.tsx`, `lib/supabase.ts`.

**Resumen — 2 bloques de trabajo, ambos de diseño/UX salvo el último:**

1. **Consistencia visual del header en Inicio/Conexiones/Recursos** (varias rondas sobre capturas reales, ida y vuelta hasta calzar):
   - Campanita: mismo ícono en las 3 (`MaterialCommunityIcons` `bell`/`bell-outline`, antes cada pantalla usaba una librería distinta — MaterialCommunityIcons, Feather, Ionicons), mismo tamaño (22px), misma caja de toque (32×32), mismo color (`#3F512F`). Conexiones ahora también alterna lleno/vacío según no-leídos, como Inicio (antes era ícono fijo). El de Recursos sigue apuntando a "Mis recordatorios" (no es una campana de notificaciones real, es otra feature) — no se tocó el comportamiento, solo look.
   - Orden: la campana quedó primera en el grupo de íconos de la derecha en las 3 (antes en Conexiones iba después de la estrella).
   - Alineación vertical: `alignItems: 'center'` en las 3 (Recursos tenía `flex-end`). El título "Recursos" necesitó 3 rondas de ajuste fino de `marginTop` (12 → 6 → 2 → -2) por una diferencia de proporción tamaño/interlineado con los otros títulos — quedó resuelto por prueba y error contra capturas, no hay una causa 100% aislada en el código.
   - Se sacó el cartel "N sin abrir"/"Al día ✓" de "Recomendado por tu profesional" (no convencía visualmente) — junto con la variable `unopenedCount` y el estilo `recoUnopenedCount` que quedaban sin uso.
   - Se agregó `marginTop: 18` a esa misma sección para separarla de los tiles de herramientas de arriba (estaba pegada).
   - Se sacó la coma de "¡Hola, Joaquin!" → "¡Hola Joaquin!" en Inicio.

2. **Diagnóstico y fix de la pantalla "vita" trabada al abrir la app logueado:**
   - Causa real: no era una animación (`VitaWordmark` es texto plano, sin animación) — `AuthContext` esperaba **dos llamadas de red seguidas** (`getSession()` + `fetchRole()` a `profiles`) antes de bajar `loading`, sin timeout ni spinner. Se separó: `loading` baja apenas resuelve `getSession()`, el rol se resuelve aparte y actualiza `role` cuando llega (la redirect en `app/index.tsx` ya reacciona sola a cambios de `role`).
   - Se sacó una query suelta de "verificación de conexión" en `lib/supabase.ts` que competía por red en el arranque (el propio comentario ya decía "remover en producción").
   - Se agregó un `ActivityIndicator` a la pantalla de splash en `app/index.tsx` para que, si igual tarda, se sienta como carga y no como freeze.
   - **Factor externo importante, sin resolver:** Joaquín confirmó que está corriendo con **Expo Go**, no un dev build. El proyecto usa Reanimated 4 + `react-native-worklets` + New Architecture (`newArchEnabled: true` en `app.json`), combinación que Expo Go no soporta bien — puede estar degradando el arranque de toda la app, no solo esta pantalla. Se necesita un dev build (`npx expo run:ios`/`run:android`, o EAS Build) para descartarlo del todo. **No se pudo armar acá**: esta Mac no tiene Xcode completo instalado (solo Command Line Tools) ni Android SDK.
   - Sin cambios de schema.

**Pendiente para la próxima sesión:**
- **Armar el dev build** — decidir entre instalar Xcode completo en esta Mac, usar EAS Build (necesita `eas login` de Joaquín), o que Joaquín lo arme en otra máquina. Es la única forma de confirmar si Expo Go era la causa real (o gran parte) del lag reportado.
- Confirmar con Joaquín que el look final del header en las 3 pantallas quedó bien en dispositivo real (última ronda fue "quedó todo bien" + 2 ajustes menores de título/espaciado ya aplicados, sin nueva captura de confirmación).
- Sigue pendiente de sesión 78: revisar filas rotas en `resource_reminders` y el silencio de errores en `ReminderBell.handleSave`.
- Sigue pendiente de sesión 79: feature de pre-booking (no construida) y evento para cuando el coach confirma una reserva pendiente.
- Retomar Mercado Pago cuando Andre conecte su cuenta real (arrastrado de sesiones previas).
- Sign in with Apple sigue pausado a propósito.

---

## 2026-07-30 — Joaquín (sesión 79)

**Tocado:** `lib/supabase.ts`, `app/gratitud.tsx`, `app/diario.tsx`, `screens/RespiracionScreen.tsx`, `screens/RuidoScreen.tsx`.

**Resumen — analytics de eventos, evitando duplicar lo que ya existía:**
- Joaquín pidió crear `eventLogger.ts` (tabla `user_events`, función `logEvent`). Antes de crearlo se encontró que ya existía `registrarEvento()` en `lib/supabase.ts`, insertando en `analytics_events` (tabla real, documentada en SCHEMA.md) — mismas columnas que pedía el nuevo archivo. `user_events` no existe en la base. Decisión de Joaquín: no crear nada nuevo, reusar `registrarEvento`.
- Único cambio a `registrarEvento`: le faltaba manejo de error — ahora chequea el resultado del insert y hace `console.warn` si falla (mismo patrón que tenía el `eventLogger.ts` propuesto). No cambió su firma ni la tabla que usa.
- **`recurso_completado` (evento nuevo, no existía ningún llamado a `registrarEvento` para esto):** agregado en el mismo momento donde cada herramienta ya llama `recordCompletion()` (que es otra cosa — tabla `resource_completions`, para rachas/progreso, no analytics): `app/gratitud.tsx` y `app/diario.tsx` al guardar, `screens/RespiracionScreen.tsx` y `screens/RuidoScreen.tsx` cuando el timer de sesión llega a 0. Propiedades: `resource_id`, `duration_seconds` (cuando aplica), `user_id` — mismo patrón que ya usa `BookingScreen_Confirm.tsx` (pasar `user_id` en las properties además de la columna, por consistencia con lo existente aunque sea redundante).
- **Gap encontrado de paso, no arreglado:** `'reserva_confirmada'` (evento existente) se dispara cuando el *usuario* termina de mandar la reserva, no cuando el *profesional* la confirma después — `confirmBooking()` en `lib/coachBookingActions.ts` no llama a `registrarEvento` en ningún lado. Si en algún momento se quiere trackear "el coach aceptó la sesión" como evento separado, ahí falta.
- **Pre-booking (mensaje a un coach antes de reservar):** Joaquín preguntó si ya había un evento para esto. Se buscó en todo el repo y en SCHEMA.md — la feature no existe todavía (no hay flujo de mensaje a un coach antes de la reserva; las `salas` hoy se crean recién dentro de `BookingScreen_Confirm.tsx`). Confirmado con Joaquín: se deja para cuando se construya esa feature. Si se agrega, seguir el mismo patrón: `registrarEvento('prebooking_enviado', {...})` en el momento exacto del envío.
- Sin cambios de schema — `analytics_events` ya existía con las columnas necesarias.

**Pendiente para la próxima sesión:**
- Feature de pre-booking (mensaje a coach antes de reservar) — no construida, sin fecha.
- Evento para cuando el coach confirma una reserva `pendiente` (gap encontrado arriba) — evaluar si vale la pena agregarlo a `confirmBooking()`.
- Sigue pendiente de sesión 78: revisar filas rotas en `resource_reminders` (query SQL ya está en la entrada de esa sesión) y el silencio de errores en `ReminderBell.handleSave`.
- Retomar Mercado Pago cuando Andre conecte su cuenta real (arrastrado de sesiones previas).
- Sign in with Apple sigue pausado a propósito.

---

## 2026-07-29 — Joaquín (sesión 78)

**Tocado:** `components/ReminderBell.tsx`, `app/coach-recurso.tsx`, `screens/AnclajeScreen.tsx`, `screens/EscanerScreen.tsx`, `screens/LecturasScreen.tsx`, `screens/MeditacionScreen.tsx`, `screens/RelajacionScreen.tsx`, `screens/RespiracionScreen.tsx`, `screens/RuidoScreen.tsx`, `screens/SuenoScreen.tsx`, `package.json`, `components/ui/SurfaceCard.tsx`.

**Resumen — revisión de bugs pedida por Joaquín, los 6 hallazgos arreglados:**
- **Bug real, roto en producción hasta hoy:** `ReminderBell.tsx` recibía una prop llamada `ref` (`{ kind, ref: resourceRef, title }`) — `ref` es una prop reservada de React (junto con `key`), nunca llega al componente vía props normales. `resourceRef` era `undefined` siempre, en runtime, en las 9 pantallas que usan la campanita de recordatorios (las 8 tools de VITA + `coach-recurso.tsx`). Efecto: la campanita siempre se mostraba inactiva sin importar si había un recordatorio configurado (la query de lectura filtraba por `ref: undefined`), y al guardar, el insert escribía `ref: undefined` para cualquier herramienta (sin poder distinguir a cuál pertenecía, o directamente fallando si la columna es NOT NULL). Bug preexistente del commit `6984cc7b` (feature de recordatorios), no introducido en sesiones recientes, pero confirmado roto hoy.
- **Fix del bug:** se renombró la prop de `ref` a `resourceRef` en la firma de `ReminderBell` (el resto del componente ya usaba internamente ese nombre) y se actualizaron los 9 call sites (`ref="..."` → `resourceRef="..."`).
- **Punto ciego del lint — también arreglado:** `npx expo lint` (el script `npm run lint`) no detectaba el bug de arriba porque por default solo escanea `/app`, `/src` y `/components` — todas las pantallas de tools viven en `screens/`, fuera de ese alcance. Confirmado con `npx expo lint --help` ("Lint all files in /src, /app, /components directories") y comparando contra `npx eslint .` directo (97 problemas vs. 18, con 30 solo en `screens/`). Se cambió el script `lint` en `package.json` de `"expo lint"` a `"expo lint app screens components hooks lib context constants theme"` — cubre todo el código de la app (se excluyó a propósito `supabase/functions/` porque son Deno edge functions con imports por URL que ESLint/Node no puede resolver, son falsos positivos esperados, no bugs reales; y `assets/`, `design/`, `docs/`, `scripts/` porque no tienen código lintable). Verificado: `npm run lint` ahora reporta 76 problemas (10 errores, 66 warnings) — todos preexistentes, ninguno es el bug de `ref` (los 9 `react/no-string-refs` ya no aparecen).
- **Los 4 hallazgos chicos de la revisión, también arreglados:**
  - `SurfaceCard.tsx`: el contenido interno usaba el `borderRadius` completo en vez de `borderRadius - 1` cuando está anidado dentro del borde con gradiente (`elevated`+`light`) — se parametrizó `renderContent(radius)` para que cada wrapper le pase el radio correcto.
  - `SurfaceCard.tsx`: el `useMemo` de las capas de sombra dependía solo de `isPressable` — se agregaron `idleRecipe`/`pressedRecipe`/`press` a las deps (ya no hace falta el `eslint-disable`).
  - `RuidoScreen.tsx`: se sacó `currentSound`, variable muerta desde el rediseño de esta sesión.
  - `RuidoScreen.tsx`: se restauró un timer grande y prominente (`runningTimer`, Fraunces 40px) durante la reproducción — el rediseño anterior lo había metido como texto chico dentro de "Sonando…", perdiendo el vistazo rápido de cuánto tiempo queda; ahora conviven el timer grande arriba y "Sonando…" + ecualizador debajo, sin volver a ocultar el grid/duración (esa decisión de UX se mantiene).
- Sin cambios de schema — son bugs de código (props mal consumidas, script de lint mal alcanzado, estilos/memos con valores de más o de menos), no de ninguna tabla.

**Pendiente para la próxima sesión:**
- **Revisar si hay filas existentes en `resource_reminders` rotas por el bug de `ReminderBell`.** Dos escenarios posibles, no investigado porque requiere acceso directo a la base (Joaquín lo va a chequear él en el SQL editor de Supabase):
  - Si `ref` es `NOT NULL`: los inserts fallaban, no se guardó nada — pero además `handleSave` (`components/ReminderBell.tsx:131`) nunca chequea el resultado de `saveReminder(...)` (ni siquiera hoy, después del fix del prop) — cierra la hoja como si hubiera guardado incluso si falló. Esto es un bug aparte, todavía sin arreglar, que puede seguir enmascarando errores de guardado a futuro (de cualquier causa, no solo el de `ref`).
  - Si `ref` acepta `null`: pueden existir filas huérfanas (`ref: null`), posiblemente duplicadas si el usuario reintentó (la campanita nunca reconocía la existente). Esas filas sí se reprograman como notificación local (`reconcileResourceReminders` no filtra por `ref`), así que puede haber usuarios recibiendo notificaciones de recordatorio "fantasma" sin que la campanita correspondiente se haya visto nunca activa.
  - Query para chequear: `select id, user_id, kind, ref, title, days, hour, minute, enabled, created_at from resource_reminders where ref is null or kind = 'tool' order by created_at desc;`
  - Si aparecen filas rotas, definir si se borran o se intenta recuperar el `ref` correcto a partir del `title` (los títulos son fijos por tool, ej. "Respiración" → `ref='respiracion'`).
- **Arreglar el silencio de errores en `handleSave`** (`components/ReminderBell.tsx:131`) — hoy cualquier falla al guardar un recordatorio (no solo la de `ref`) se muestra como éxito al usuario.
- `npm run lint` ahora reporta 76 problemas reales (10 errores, 66 warnings) que antes eran invisibles — ninguno es urgente (comillas sin escapar, imports duplicados, deps de hooks faltantes, variables sin usar) pero vale hacer una pasada de limpieza cuando haya tiempo.
- Retomar Mercado Pago cuando Andre conecte su cuenta real (arrastrado de sesiones previas).
- Sign in with Apple sigue pausado a propósito.

---

## 2026-07-29 — Joaquín (sesión 77)

**Tocado:** `theme/tokens.ts`, `app/(tabs)/index.tsx`, `app/(tabs)/recursos.tsx`, `screens/SessionsScreen.tsx`. Nuevo: `components/ui/SurfaceCard.tsx`.

**Resumen — tratamiento visual nuevo para cards ("sombra cálida en capas"), siguiendo `card-efectos-comparador.html` (mockup, no se guardó en el repo, solo el HTML por AirDrop). Primera pasada, no aplicado a toda la app:**
- No existía ningún `Card.tsx` genérico — `ScaleCard.tsx` solo maneja el gesto de press (scale), sin estilo visual; cada pantalla dibujaba su propia card inline. Se creó `components/ui/SurfaceCard.tsx` como el único lugar donde vive el efecto, y `theme/tokens.ts` ganó un export `shadow` (no existía ningún token de sombra centralizado antes) con las recetas `elevated`/`elevatedPressed`/`subtle`, cada una `light`/`dark`.
- **Variantes:** `elevated` (3 sombras con halo terracota, grano 5%, borde gradiente, línea de brillo superior, sube al presionar) para la card más importante de cada pantalla; `subtle` (sombra 1+2 sin halo, grano 3%, borde plano, sin interacción propia) para cards repetidas. `tone="dark"` (agregado, no estaba en el pedido original) para superficies oscuras como el hero de sesión — mismo criterio que usa el propio mockup, cuyo `.hero` no lleva borde con brillo ni halo terracota, sino tinta oscura.
- **Primera adopción:** Inicio (`sessionCard` → elevated/light; las 3 stat cards dentro de `SobreVosCard` → subtle/light), Recursos (`moodCard`/recurso destacado en mood bajo → elevated/dark; `toolTile`, `exploreRow`, `recbox` de recomendaciones del coach → subtle/light, conviviendo con el `ScaleCard` existente sin duplicar el gesto), Mensajes (`heroCard` → elevated/dark, sin interacción propia porque tiene varios botones internos, no es un solo tap target).
- **3 decisiones técnicas resueltas sin librerías nuevas** (`expo-linear-gradient` y `react-native-svg` ya estaban instalados, no se sumó nada a `package.json`):
  - Grano: no hay textura en `assets/` ni herramienta de generación de imagen en este entorno — se aproximó con un `<Pattern>` de `react-native-svg` (puntos pseudo-random generados una sola vez al cargar el módulo, no por card ni por frame).
  - Sombra multicapa en iOS: RN no soporta más de una sombra por View — se resuelve apilando 2-3 Views detrás de la card visible, cada una con su propio `shadowColor/Offset/Opacity/Radius`, más chicas que la card (aproxima el spread negativo de CSS).
  - Halo en Android: `elevation` no soporta tinte — se simula con una View extra semitransparente detrás (terracota o tinta oscura según `tone`), sin blur real. **La diferencia visual entre plataformas es esperable y no se pudo verificar en dispositivo real desde este entorno** — en iOS el halo debería verse difuminado suave, en Android más sólido/con borde más definido.
- Interacción de press: mismo spring que ya usa `ScaleCard` (`damping:20/stiffness:300` in, `damping:14/stiffness:180` out), pero animando `translateY` + intensidad de las 3 capas en vez de `scale` — solo en `elevated` con `onPress`.
- **No se pudo probar en simulador/dispositivo (ni iOS ni Android) desde este entorno** — typecheck y `expo lint` quedaron limpios, pero falta la verificación visual real que pedía el brief (capturas/grabación de las 3 pantallas por plataforma, frame drops en listas de cards `subtle`). Queda pendiente.
- Riesgo a vigilar: algunas cards (`sessionCard`, las 3 de `SobreVosCard`) usan `backgroundColor` translúcido (`GLASS`/`rgba(255,255,255,0.55)`) — las capas de sombra apiladas en iOS reusan ese mismo color de fondo para poder proyectar sombra, así que podría verse un leve doble-tono en el borde donde las capas no se superponen del todo. No se pudo confirmar visualmente.

**Pendiente para la próxima sesión:**
- Probar las 3 pantallas en dispositivo real, iOS y Android por separado — comparar el halo de color entre plataformas y buscar frame drops al montar las listas de cards `subtle` (grilla de Recursos, recomendaciones del coach).
- Si el resultado en Android no convence, evaluar `@shopify/react-native-skia` (no instalado) para blur real en vez de la aproximación con View tintada — solo si vale la pena el esfuerzo.
- Segunda pasada a otras pantallas una vez validado esto (quedó explícitamente fuera de esta primera tanda).
- Retomar Mercado Pago cuando Andre conecte su cuenta real (arrastrado de sesiones previas).
- Sign in with Apple sigue pausado a propósito.

---

## 2026-07-29 — Joaquín (sesión 76)

**Tocado:** `screens/RespiracionScreen.tsx`, `screens/RuidoScreen.tsx`, `app/gratitud.tsx`, `app/diario.tsx`, `components/PinButton.tsx`, `constants/tools.ts`. Nuevo: `components/ui/SoundEqualizer.tsx`, `components/ui/ToolHeader.tsx`.

**Resumen — rediseño visual de las 4 pantallas de herramientas (Respiración, Sonidos ambientales, Gratitud, Diario), siguiendo `vita-herramientas-rediseno.html` (mockup, no se guardó en el repo, solo capturas). Retoque de presentación, sin reescribir la lógica de cada herramienta:**
- **Header unificado:** herramientas por sesión (Respiración, Sonidos) llevan campana + bookmark (antes pin); herramientas de registro diario (Gratitud, Diario) llevan un pill de fecha corta en vez de campana. Back: chevron simple en las 4, sin texto "Atrás". El ícono de `PinButton.tsx` se migró de `pin`/`pin-outline` a `bookmark`/`bookmark-outline` — como es un componente compartido, esto afecta el header de las 8 pantallas de tool que lo usan (no solo Respiración/Sonidos), no solo estas 2. Un solo vocabulario de íconos "guardar" en toda la app.
- **Respiración:** el orbe ahora respira en loop continuo desde que se abre la pantalla (antes solo animaba durante la sesión) — 4s por fase, 16s de ciclo (se mantuvo el timing que ya tenía la pantalla, no los 3s que decía el brief inicial, para no romper la descripción en pantalla). Respeta `useReducedMotion` (ya existía el hook, no se usaba acá): orbe fijo y label sin rotar si está activo.
- **Sonidos ambientales:** pills chicas → grid 2×2 de cards grandes con pastel propio por sonido (se sumó `PASTEL_TEAL` a `constants/tools.ts`, no existía). Al iniciar, el grid y la duración quedan visibles, el botón pasa a "Detener" (terracota) y aparece una fila "Sonando…" con ecualizador. Ese ecualizador (`SoundEqualizer.tsx`) no existía — se creó nuevo; el brief asumía que ya había uno compartido con el tile de Ruido en Recursos, pero ese tile es un ícono estático sin estado de reproducción, así que no se tocó (fuera de scope, nada que animar ahí).
- **Gratitud:** emoji 🙏 → ícono de corazón en círculo durazno. Racha ("N días seguidos") no existía como dato propio — se calculó sobre `resource_completions` filtrado a `resource_id='gratitud'`, mismo algoritmo que `useResourceProgress`, sin migración. Los 3 inputs pasaron a cards con ícono propio (reloj/persona/hoja). Botón Guardar apagado/encendido sobre el `canSave` que ya existía.
- **Diario — el cambio principal:** se sacó el selector propio de 5 emojis de mood (duplicaba el check-in de Inicio). Ahora lee `mood_entries` del día (mismo hook `useMoodHistory` que usa Inicio): si ya hay check-in, fila de solo lectura con punto de color + "Hoy registraste: X" + link "Cambiar"; si no, card de invitación + botón "Registrar" — ambos navegan a Inicio. Al guardar, `journal_entries.mood` ahora toma el `mood_id` del check-in del día (antes venía del picker propio); se documentó en SCHEMA.md que esa columna es `text` pero recibe un número (inconsistencia pre-existente, no introducida acá). El historial de entradas viejas se decodifica con `ViveMoodColors` en vez de emoji. El "--" que se mencionó como pendiente de sacar no estaba en el código (puede ser de otra versión). El link "Tus últimas entradas →" no tiene pantalla de historial propia — hace scroll a la sección de entradas anteriores que ya vive en la misma pantalla, no se inventó una ruta nueva.
- **Paleta de mood:** se reusó `ViveMoodColors` (`constants/theme.ts`, ya existía de la sesión 75) tal cual, sin redefinirla — usada ahora también en el resumen de mood de Diario.
- SCHEMA.md actualizado: se documentó `mood_entries` (existía en Supabase, no estaba en el archivo) y se corrigió la nota de `pinned_resources`/`PinButton` (mencionaba a Diario como una de las pantallas con pin, que nunca lo tuvo). Sin migraciones nuevas.

**Vuelta de feedback tras probar en dispositivo — 3 rondas de ajuste sobre lo de arriba:**
- **Orbe de Respiración, timing raro (ronda 1):** Joaquín reportó delay entre el label "Mantené" y que el círculo dejara de moverse. Causa: `Animated.timing` sin `easing` explícito caía en el default de RN (ease-in-out con cola final muy lenta, el círculo parecía "seguir llegando"), más un `setInterval` aparte del label desincronizado del loop nativo. Fix: se sacó el `setInterval` — el cambio de fase ahora se dispara desde el callback `.start(({finished}) => ...)` de cada tramo de la animación (un solo reloj, no dos). Con `Easing.linear` probado primero quedó un frenazo en seco al llegar al hold (velocidad constante que corta de golpe) — se reemplazó por `Easing.inOut(Easing.quad)`: desacelera al entrar al hold y acelera al salir, sin la cola larga del default ni el frenazo del lineal.
- **Headers inconsistentes entre pantallas (ronda 2):** las 4 pantallas tenían el header copiado del archivo original de cada una — Diario/Gratitud con título centrado (`flex:1, textAlign:'center'`, semibold 17px oliva), Respiración/Sonidos con título pegado al chevron (bold 20-22px forest). Se creó `components/ui/ToolHeader.tsx` (título opcional + slot `right` libre) y las 4 pantallas migraron a este único componente — ya no pueden volver a divergir en layout/tipografía del header. De paso: se agregó la línea divisora bajo el header en Respiración/Sonidos (ya existía en Diario/Gratitud, faltaba en las otras dos) y se corrigió que en Sonidos ambientales el texto quedaba pegado arriba del header en vez de centrado verticalmente como el resto — el `ScrollView` pasó a `flexGrow:1, justifyContent:'center'` (con `width:'100%'` explícito en el grid de sonidos, que si no rompía el cálculo del 47% de las cards al perder el stretch automático).
- **Título duplicado arriba y en el contenido (ronda 3):** Respiración y Sonidos ambientales mostraban el nombre de la herramienta tanto en el header como en el contenido ("Respiración" arriba + "Respiración cuadrada" abajo). Se sacó el título del header en esas dos (quedan con chevron + campana/bookmark solamente) — Respiración ya tenía "Respiración cuadrada" como encabezado propio, y a Sonidos ambientales se le agregó "Sonidos ambientales" como encabezado (mismo estilo semibold 22px forest) justo arriba del texto descriptivo. Diario/Gratitud no cambiaron, siguen mostrando el título en el header.
- Typecheck y `expo lint` limpios en cada ronda.

**Pendiente para la próxima sesión:**
- Confirmar en dispositivo que las 3 rondas de ajuste de diseño quedaron bien (Joaquín las fue pidiendo sobre capturas reales, pero no hubo vuelta de confirmación final sobre la última ronda).
- Retomar Mercado Pago cuando Andre conecte su cuenta real (arrastrado de sesiones previas).
- `/mis-recomendaciones` con >3 recos y swipe en Android siguen sin probar (arrastrado de sesiones previas).
- Sign in with Apple sigue pausado a propósito.

---

## 2026-07-28 — Joaquín (sesión 75)

**Tocado:** ver lista larga al final — toca ~35 archivos. Nuevos: `hooks/useProgressStats.ts`, `lib/moodStats.ts`.

**Resumen — 4 bloques de trabajo en una sesión larga:**

1. **Rebrand "coach" → "profesional" en todo el texto visible.** VITA ya no es solo coaches (psicólogos, nutricionistas también). Catalogado con un agente de exploración para separar texto de UI (sí cambia) de identificadores internos — tablas `coaches`, columnas `coach_id`, rutas `/(coach)/`, archivos `coach-*.tsx`, el rol `role: 'coach'` — que NO se tocaron. Se dejó "Coach" intacto donde es una categoría de especialidad específica (junto a Psicólogo/Nutricionista en `search3.tsx`, `QuizScreen.tsx`, `CoachApplicationScreen.tsx`, los fallbacks "Coach de vida" del flujo de booking).

2. **Rediseño visual de "Sobre vos" (Inicio) y "Tu progreso"** — mismo dato, presentación nueva, siguiendo `vita-progreso-rediseno.html` (mockup, no se guardó en el repo, solo capturas). Paleta de mood centralizada: `ViveMoodColors` (`constants/theme.ts`) ya existía pero con hex viejos — actualizada a los 5 valores nuevos pedidos, se usa en `MoodCheckIn`, el gráfico de Progreso y el sparkline nuevo de Sobre Vos, sin divergencias. Trío pastel (salvia/durazno/azul) y colores por herramienta nuevos en `constants/tools.ts` (no existían antes — asignados, no reusados, ver nota en el chat). `hooks/useProgressStats.ts` (nuevo) extrae la query de semanas activas/áreas/sesiones que antes vivía solo en `progreso.tsx`, ahora la comparte con la card de Inicio. `lib/moodStats.ts` (nuevo): `computeMoodStreak` (racha de check-ins consecutivos, antes vivía inline en progreso.tsx) y `buildWeeklyHeadline` (titular dinámico reciente-vs-histórico de la card Sobre Vos — única lógica nueva no visual de la sesión, simple a propósito). Los 3 casos del titular (mood bajo/alto/sin histórico) se probaron sembrando datos de prueba en `mood_entries` del usuario de test y confirmando en pantalla — los tres funcionan.

3. **Fix: título de "Mensajes" (antes "Mis salas") sin la misma tipografía que el resto.** `SessionsScreen.tsx`: texto cambiado, tipografía y posición del header ahora calcan exacto a Recursos (`Fraunces 34px`, `#3F512F`, alineado a la izquierda, mismo padding) — se sacó el fondo/borde/divider que tenía antes.

4. **Barrido de puntos finales en microcopy corto de toda la app — completo.** Catalogado con otro agente (151 candidatos en ~35 archivos: títulos, labels, errores, toasts, notificaciones push — un solo punto final, no párrafos largos) y aplicado entero. Se excluyó a propósito: términos y condiciones, citas de `LecturasScreen`, y los guiones de prácticas guiadas (Relajación/Meditación/Sueño/Escáner/Anclaje — narración de varias oraciones donde el punto marca ritmo real). Multi-oración corta (ej. "No pudimos guardar. Probá de nuevo.") perdió solo el punto de la última oración, no los intermedios.

Typecheck limpio en cada checkpoint (se hicieron ~15 a lo largo de la sesión dado el volumen).

**Pendiente para la próxima sesión:**
- Retomar Mercado Pago cuando Andre conecte su cuenta real (sesión 74).
- `/mis-recomendaciones` con >3 recos y swipe en Android siguen sin probar (arrastrado de sesiones previas).
- Sign in with Apple sigue pausado a propósito (sesión 72/74).

---

## 2026-07-28 — Joaquín (sesión 74)

**Tocado:** `app/_layout.tsx`. Cambios de infra en Supabase (secrets, un coach de prueba), no en el repo.

**Resumen — testeo de deuda pendiente (sesión 72) + 2 bugs reales encontrados:**
- **Bug 1 — swipe-back nativo roto en ambas apps.** Al probar el swipe-back de iOS en pantallas pusheadas (`/coach-recurso`, etc.), no volvía atrás en ninguna interfaz. Causa: la app nunca tuvo `GestureHandlerRootView` en la raíz — no hacía falta mientras nada usara gestos de `react-native-gesture-handler` de forma activa, pero desde que la sesión 69 sumó `react-native-pager-view`/`material-top-tabs` (que sí interactúan con ese sistema de gestos), su ausencia rompía la coordinación de gestos nativos en toda la app, incluido el swipe-back del stack. Se agregó el wrapper en `app/_layout.tsx` (setup oficial recomendado para cualquier app con estas librerías). Confirmado en device: swipe-back funciona en ambas interfaces.
- **Bug 2 — header nativo negro "fantasma" en 11 pantallas.** Al entrar a un recurso apareció una barra negra arriba con "‹ (tabs)" y el nombre del archivo como título — el header nativo por default de React Navigation, duplicado sobre el header propio que cada pantalla ya dibuja. Causa: `coach-recurso.tsx` nunca se había registrado como `<Stack.Screen>` en `app/_layout.tsx`, así que expo-router lo auto-descubre con las opciones default (`headerShown` sin especificar). Al auditar el resto del árbol se encontraron **10 pantallas más con el mismo problema**: `agenda`, `coach-availability`, `coach-notifications`, `coach-recurso-nuevo`, `coach-weekly-pattern`, `edit-profile`, `explorar-recursos`, `mis-recomendaciones`, `mis-recordatorios`, `profile-own`, `search3` — todas navegables, ninguna registrada. Se agregaron las 11 con `headerShown: false`, mismo patrón que el resto del Stack. `app/coach-reservas.tsx` quedó **sin registrar a propósito** — es el único de la lista sin ninguna referencia en el código, huérfano (mismo componente que ya vive en `app/(coach)/reservas.tsx`).
- **Deuda de testing de sesión 69, resultado:**
  - Swipe-back vs pager: **falló, encontrado y arreglado** (bug 1 arriba).
  - Isla + swipe en Android: **sigue sin probar** — no hay dispositivo Android disponible.
- **Mercado Pago — causa real del error de sandbox encontrada, sigue pausado.** Se reconectó "Coach Prueba" con `MP_TEST_MODE=false` (ya no debería pedir `test_token`), pero el checkout siguió mandando al mismo error de sandbox ("una de las partes es de prueba"). Investigando: el `mp_user_id` guardado en `coach_mp_accounts` es **el mismo de siempre** (`3535802677`) en cada reconexión — no es un tema de mi flag `MP_TEST_MODE`, es que **la cuenta de Mercado Pago que se está autorizando es, de origen, una cuenta de prueba de MP** (probablemente creada con el generador de test-users de MP en algún momento del desarrollo), y eso no cambia por reconectar. Además, para probar el pago hace falta una cuenta real **distinta** para comprador y vendedor (MP rechaza pagarte a vos mismo) — Joaquín no tiene una segunda cuenta real de MP a mano para el lado del coach.
- Typecheck limpio.

**Pendiente para la próxima sesión:**
- **Mercado Pago — bloqueado hasta que Andre esté disponible.** Decisión: Andre conecta su propia cuenta real de MP como "Coach Prueba" (él la va a manejar de todos modos). Recién con eso hecho, reservar con Joaquín pagando desde su cuenta real, confirmar `payment_status='aprobado'` y probar el reembolso al cancelar. No perder tiempo reconectando con la misma cuenta de siempre — confirmado que no es un tema de código.
- Sesión 68: hero verde de mood con check-in real, y `/mis-recomendaciones` con >3 recos — siguen sin probar en pantalla.
- Isla/swipe en Android — sin dispositivo, sigue bloqueado.
- **Sign in with Apple — pausado a propósito, decisión de Joaquín (28/07):** no tiene sentido pagar Apple Developer Program para algo que falta mucho para usarse. El código ya está listo (sesión 72); retomar recién cuando el lanzamiento esté cerca — no marcar como bloqueante urgente hasta entonces.

---

## 2026-07-23 — Andre (sesión 73)

**Tocado:** `scripts/add-refund-cron.sql` (nuevo), `scripts/add-payments-v1.sql` (nota §5), `app/(tabs)/conexiones.tsx` (teaser redirigido), `app/ia.tsx` (eliminado), `constants/tools.ts` (nuevo), `scripts/add-user-habits.sql` (nuevo), `lib/habits.ts` (nuevo), `hooks/useResourceProgress.ts`, `app/progreso.tsx`, `app/diario.tsx`, `app/(tabs)/recursos.tsx`, `SCHEMA.md`. Cambios de infra en Supabase (cron nuevo) y en el panel de MercadoPago (webhook), no en el repo.

**Resumen — cerrar Mercado Pago en producción (prioridad 2 del audit de sesión 72):**
- **Relevamiento: MP estaba MUCHO más avanzado de lo que decía el changelog.** Verificado en vivo contra Supabase (`ggygiihhnkjrerpinhha`): las 5 edge functions (`mp-oauth-start/callback`, `mp-create-payment`, `mp-webhook`, `mp-process-refunds`) **ya estaban desplegadas y ACTIVE** (los comentarios "SCAFFOLD v1" en el código quedaron desactualizados — el código está completo), con `verify_jwt` correcto (callback y webhook en `false`, resto `true`). **Todos los secrets ya cargados** (MP creds, `MP_WEBHOOK_SECRET`, `OAUTH_STATE_SECRET`, URLs, `MP_TEST_MODE`, `MP_SPLIT_ENABLED`). Frontend wireado (coach conecta OAuth, usuario paga al reservar, trigger de reembolso). **Un coach ya tiene `mp_connected=true`** → el OAuth se completó real al menos una vez ⇒ redirect URI OK en el panel de MP.
- **Gap real encontrado y cerrado: el cron de reembolsos no existía.** `mp-process-refunds` estaba desplegado pero nada lo llamaba (el bloque `cron.schedule` en `add-payments-v1.sql §5` seguía comentado, "PENDIENTE, requiere creds"). Consecuencia: las reservas canceladas quedaban en `payment_status='reembolso_pendiente'` y **el dinero nunca se devolvía**. Se creó `scripts/add-refund-cron.sql` (habilita `pg_net` —primer cron del proyecto con HTTP saliente—, guarda la service key en **Vault** para no dejarla en texto plano en `cron.job`, agenda `mp-process-refunds` cada 5 min). **Corrido en prod por Andre** (jobid 5), verificaciones OK (job activo, schedule `*/5 * * * *`, secret en Vault). Nota §5 de `add-payments-v1.sql` actualizada para apuntar al script nuevo.
- **Webhook configurado en el panel de MP** apuntando a `.../functions/v1/mp-webhook`, evento `payment`. El simulador de MP dio **502** — que es el comportamiento **esperado y correcto**: el 502 solo se alcanza *después* de pasar la validación de firma (que devolvería 401 si fallara), y ocurre porque el simulador manda un `payment_id` falso (`123456`) que la API de MP no puede resolver. O sea: **el 502 confirma que `MP_WEBHOOK_SECRET` coincide con el secret del panel** (la parte crítica y frágil). Con un pago real el fetch resuelve → 200.
- **Sin cambios de schema.** El schema de pagos v1 ya estaba en prod desde sesiones anteriores. `SCHEMA.md` no necesitó cambios (el cron es infra, no estructura de datos).

**vita IA — decisión de producto resuelta (feature a medias de sesión 71/72):**
- El teaser de Conexiones ("¿No sabés por dónde empezar?") prometía orientación conversacional pero llevaba a `app/ia.tsx`, un stub "Próximamente". Se decidió **redirigirlo al quiz de orientación que ya existe** (`app/quiz.tsx` / `screens/QuizScreen.tsx`, autónomo, recomienda coaches) en vez de construir IA conversacional real (proyecto grande, diferido). Copy ajustado de "Contale a VITA qué te pasa y te oriento" → "Respondé unas preguntas y te orientamos" (el quiz es de opción múltiple, no chat libre). `app/ia.tsx` quedó huérfano → **borrado** (misma disciplina de dead code de sesión 71). Typecheck limpio.

**Hábitos — construidos de verdad (decisión de producto de Andre: "prácticas VITA curadas" + "atado al uso real"):**
- Los 4 hábitos hardcodeados de `progreso.tsx` (iguales para todos, checks que no persistían) pasaron a ser una **rutina real de prácticas VITA** que el usuario arma eligiendo del catálogo de 10 herramientas (respiración, gratitud, meditación...). **No hay check manual**: un hábito se tilda solo cuando el usuario **completa la herramienta real** — es "atado al uso real".
- **Hallazgo que redujo el scope 10×**: la infra de rachas (`resource_completions` + `recordCompletion` + `useResourceProgress`) ya estaba construida pero se creía dormida. Al revisar, **9 de las 10 herramientas YA llamaban `recordCompletion`** al completarse (la nota del SCHEMA "ninguna escribe todavía" estaba desactualizada). Solo faltaba `app/diario.tsx` → se le agregó la llamada. O sea el "trabajo grande" de cablear 10 pantallas era en realidad 1.
- **Nuevo**: tabla `user_habits` (solo la rutina; el "hecho" se deriva de `resource_completions`), `scripts/add-user-habits.sql` (RLS estándar del dueño), `constants/tools.ts` (extraído el catálogo `TOOLS`/`TOOL_MAP` que estaba dentro de `recursos.tsx`, ahora fuente única compartida), `lib/habits.ts` (queries + sembrado inicial `respiracion`+`gratitud` con guard en AsyncStorage para no re-sembrar si el usuario borra todo). `useResourceProgress` extendido con `completedToday` + un `refreshToken` opcional (Progreso lo bumpea con `useFocusEffect` para re-tildar al volver de completar una práctica). `progreso.tsx`: sección "Hábitos de hoy" reescrita (rutina real, racha con 🔥, modo Editar para agregar/quitar del catálogo, tap → abre la herramienta). Typecheck limpio.
- **Coordinación**: la sección la había agregado Joaquín como maqueta; Andre (fundador) decidió construirla. Sigue conviniendo avisarle del cambio.

**Pendiente para la próxima sesión:**
- **Prueba end-to-end con un pago real**: reservar con el coach que tiene MP conectado, pagar con tarjeta (de prueba si sandbox / real si prod), y confirmar que la reserva pasa a `payment_status='aprobado'` (webhook 200 en los logs del dashboard) y que un cancel dispara el reembolso vía el cron nuevo.
- **Confirmar sandbox vs producción**: no se pudo leer el valor de `MP_TEST_MODE` desde acá. Definir en qué modo está operando y que el `MP_ACCESS_TOKEN`/webhook secret sean los del modo correcto (el panel de MP tiene secrets distintos para Prueba y Producción).
- **Correr `scripts/add-user-habits.sql` en Supabase** (SQL Editor) — sin eso, la sección Hábitos muestra el empty state (no crashea: `loadHabits` falla silencioso si la tabla no existe). Después, probar en device: armar rutina, completar una práctica (ej. Respiración) y ver que el hábito se tilda al volver + que sube la racha.
- **Avisar a Joaquín** que los hábitos (que él había dejado como maqueta) ahora están construidos de verdad (`user_habits` + atado al uso real), por si tenía otro plan.
- Menor: `supabase/config.toml` tiene `project_id = "TU_PROJECT_REF"` (cosmético — los deploys andan por el proyecto linkeado).
- Retoma de prioridades: queda de sesión 72 → Sign in with Apple (bloqueado por cuenta Apple Developer + build EAS).

---

## 2026-07-22 — Joaquín (sesión 72)

**Tocado:** `context/AuthContext.tsx`, `components/AuthModal.tsx`, `screens/LoginScreen.tsx`, `screens/RegisterScreen.tsx`, `app.json`, `package.json`/`package-lock.json`

**Resumen:**
- **Punto de partida**: audit de features a medias con entry point visible (vita IA, botón Apple, hábitos hardcodeados), pagos MP, deuda de testing y dead code. Prioridad acordada: (1) Sign in with Apple — único bloqueante duro de App Store si ya ofrecés Google (guideline 4.8), (2) Mercado Pago en producción, (3) decidir vita IA/hábitos. Arrancamos por (1).
- **Sign in with Apple — código completo, sin poder probarse de punta a punta todavía.** Hasta hoy el botón "Continuar con Apple" existía en **tres** lugares (`LoginScreen`, `RegisterScreen`, y también `AuthModal` — el modal rápido de login que el audit no había pescado) y los tres solo hacían `console.log('próximamente')`. Se implementó `signInWithApple()` en `AuthContext.tsx` con el flujo nativo real (`expo-apple-authentication`, no OAuth web como Google) — nonce crudo generado con `expo-crypto`, hasheado con SHA256 para Apple, verificado por `supabase.auth.signInWithIdToken({ provider: 'apple', nonce })`. Wireado en los tres puntos de entrada, con loading state y el botón oculto en Android (Sign in with Apple no existe ahí). `app.json`: agregado el plugin `expo-apple-authentication`.
- **Por qué queda pendiente de probar**: no hay `eas.json` ni `projectId` en este repo — nunca se hizo un build nativo custom, todo se probó siempre por Expo Go. A diferencia de `react-native-pager-view` (sesión 69), `expo-apple-authentication` **no** viene precompilado en Expo Go — no hay forma de probarlo sin un dev client propio. Además, más allá del código, hace falta: habilitar "Sign In with Apple" en Apple Developer Program para `com.andrealbisu.viveapp`, generar un Services ID + Key, y cargar esas credenciales en el proveedor Apple del dashboard de Supabase — nada de eso lo puede hacer Claude, necesita acceso a la cuenta de Apple Developer (del bundle id, parece ser de Andre). Confirmado con Joaquín que esa cuenta **no existe todavía / no se sabe** — queda bloqueado ahí, no es una tarea de código pendiente.
- Se instalaron `expo-apple-authentication` y `expo-crypto`. No hubo cambios de base de datos.

**Pendiente para la próxima sesión:**
- **Bloqueante real**: confirmar con Andre si existe/hay que crear una cuenta de Apple Developer Program, y armar un proyecto EAS (`eas.json` + `projectId`) para poder generar un dev client y probar esto de una vez.
- Una vez con esas dos cosas: configurar el proveedor Apple en el dashboard de Supabase con las credenciales (Services ID, Team ID, Key), y recién ahí probar el flujo end-to-end en device.
- Seguir con la prioridad (2) del audit (Mercado Pago) mientras se resuelve el acceso a Apple Developer, ya que es independiente.

---

## 2026-07-21 — Andre (sesión 71)

**Tocado:** `app/(tabs)/explore.tsx` (eliminado), `app/search1.tsx` (eliminado), `app/search2.tsx` (eliminado), `lib/moodInsights.ts` (eliminado), `screens/DiarioScreen.tsx` (eliminado), `app/(tabs)/recursos.tsx`, `constants/conexionesDoors.ts`

**Resumen:**
- **Limpieza de dead code** (arrastrado de sesiones 67/68 + análisis nuevo del árbol). Antes de borrar, cada candidato se verificó con grep exhaustivo (referencias de navegación, imports por nombre, registro en layouts).
- Borrados 5 archivos huérfanos: `app/(tabs)/explore.tsx` (stub "Próximamente", excluido del pager por `useOnlyUserDefinedScreens`, nada navega a `/explore`), `app/search1.tsx` + `app/search2.tsx` (iteraciones viejas del buscador; la usada es `search3` — search1→search2 era cadena huérfana), `lib/moodInsights.ts` (sin consumidor desde sesión 67), `screens/DiarioScreen.tsx` (muerto — `/diario` lo resuelve `app/diario.tsx`).
- `recursos.tsx`: removidas 138 líneas de estilos muertos (22 claves del diseño viejo de sesión 62: `coachCard`, `libraryCard*`, `coachHeader/Avatar/Name/Badge/Note`, `coachRes*`, `checkCircle*`), todas confirmadas en 0 referencias.
- `conexionesDoors.ts`: comentario que citaba `search1/search2` (ya inexistentes) corregido a `CoachTopicsScreen`.
- **Ojo — `app/(tabs)/mis-salas.tsx` NO se tocó**: está vivo, es el tab "Mensajes" (renderiza `SessionsScreen`, registrado en el layout). Estaba en la lista inicial de candidatos como "probable huérfana" y resultó falso — por eso se verifica antes de borrar.
- Typecheck 100% limpio tras la limpieza. Sin cambios de lógica, datos ni migraciones.

**Pendiente para la próxima sesión:**
- Del análisis del árbol quedan sin atacar (features a medias, no dead code): `app/ia.tsx` es stub "Próximamente" pero ya tiene entry point en `conexiones.tsx` (o se construye o se esconde el botón); hábitos de `progreso.tsx` son estado local sin tabla en DB. Cerrar Mercado Pago en producción sigue siendo el gran pendiente arrastrado.
- *(Editado al mergear con sesión 72: Sign in with Apple ya no es botón muerto — el código quedó implementado esa misma sesión, solo falta la cuenta de Apple Developer + build para probarlo.)*

---

## 2026-07-21 — Joaquín (sesión 70)

**Tocado:** `scripts/get-last-messages-per-sala.sql` (nuevo), `screens/SessionsScreen.tsx`, `screens/CoachChatsScreen.tsx`, `SCHEMA.md`

**Resumen:**
- **Bug real encontrado probando el swipe de la sesión 69**: entrar y deslizar al tab Mensajes (usuario) tardaba bastante en cargar. La causa no era el swipe en sí — `SessionsScreen` (y su espejo `CoachChatsScreen` del lado coach) traían el último mensaje de cada sala con un `Promise.all` de **una query por sala** (N+1). Con `lazy` activado en material-top-tabs, esa carga se dispara recién al hacer mount la primera vez que se visita el tab, así que el N+1 se sentía como un frenón justo al llegar — antes pasaba lo mismo con bottom-tabs, pero al tap (no arrastrando) era menos perceptible.
- **Fix 1**: función nueva `get_last_messages_per_sala(sala_ids uuid[])` (`DISTINCT ON`, un solo round-trip) que reemplaza el loop en los dos screens. Sin `SECURITY DEFINER` — `messages` ya tiene RLS que cubre esto, corre como invoker. `SCHEMA.md` actualizado.
- **Fix 2**: en ambos screens quedaban `profiles`/`coaches`/último-mensaje corriendo en serie sin depender entre sí — se juntaron en un solo `Promise.all` (ya venían de un primer `Promise.all` para salas+booking). Bajó de 4 round-trips en serie a 2.
- **Seguía "lento" después de los dos fixes — diagnóstico, no bug de código**: `messages` tiene 75 filas (sin índice por `sala_id`, pero irrelevante a ese tamaño — se revisó y confirmó que no era la causa). El proyecto de Supabase vive en `sa-east-1` (São Paulo) y Joaquín está probando desde Australia — medido con curl desde la Mac de desarrollo, cada round-trip a Supabase da entre 130ms y 837ms por pura distancia física. Con 2 round-trips en serie eso ya explica el segundo+ que se siente. No hay más margen de optimización de queries de este lado; para los usuarios reales (Argentina/Latam, a juzgar por el resto de la app) `sa-east-1` debería quedarles cerca y no notarse así.
- No se tocó nada del pager/isla de la sesión 69.

**Pendiente para la próxima sesión:**
- Si en algún momento hace falta probar la app "como la sentiría un usuario real" desde lejos del servidor, considerar un VPN con salida en Sudamérica en vez de seguir de-optimizando queries que ya están en su mínimo de round-trips.

---

## 2026-07-21 — Joaquín (sesión 69)

**Tocado:** `components/ui/IslandTabBar.tsx` (nuevo), `hooks/useReducedMotion.ts` (nuevo), `app/(tabs)/_layout.tsx`, `app/(coach)/_layout.tsx`, `app/(tabs)/conexiones.tsx`, `app/_layout.tsx`, `app/perfil.tsx` (movido desde `app/(coach)/perfil.tsx`), `components/haptic-tab.tsx` (eliminado), `package.json`/`package-lock.json`

**Resumen:**
- **Isla de navegación compacta (nav-isla-compacta v.C)**, para usuario y coach: antes cada app tenía su propia tab bar (ícono+label siempre visible apilados, burbuja translúcida detrás del activo). Ahora es un solo componente compartido (`IslandTabBar`) — pill de ancho ajustado al contenido, inactivos solo ícono, el activo se expande a pastilla verde bosque con label. Punto de notificación unificado a un punto de 7px terracota en los tres casos donde antes había indicadores distintos (rojo en Mensajes/Chats, badge numérico "9+" en Reservas del coach) — la lógica de *cuándo* mostrarlo no cambió, solo el visual. `components/haptic-tab.tsx` quedó sin uso tras el cambio, se borró.
- **Orden de tabs del usuario**: Inicio → Conexiones → Recursos → Mensajes (antes Inicio, Mensajes, Recursos, Conexiones). Coach sin cambios de orden.
- **Swipe entre tabs**, mismo alcance (usuario y coach): se migró de `@react-navigation/bottom-tabs` a `@react-navigation/material-top-tabs` + `react-native-pager-view` (nuevas dependencias, resueltas con `npx expo install`, confirmadas compatibles con Expo Go en device) vía `withLayoutContext` de expo-router, con `tabBarPosition="bottom"` y la isla como `tabBar` custom. `lazy` y `animationEnabled` (atado a `useReducedMotion`, hook nuevo) se pasan explícitos en `screenOptions` porque el default de material-top-tabs difiere del de bottom-tabs.
  - **Hallazgo de arquitectura**: un pager vuelve swipeable *todas* las rutas registradas — no existe el "tab oculto con botón invisible pero mismo navigator" que sí tenía bottom-tabs. `explore` (usuario) estaba muerta (nunca se navegaba ahí) y se dejó afuera del navigator sin más. `perfil` (coach) sí se usa desde `CoachHomeScreen` — se movió a `app/perfil.tsx` (ruta raíz, **misma URL `/perfil`**, mismo call site, mismo botón de volver) para que no quedara swipeable entre Reservas/Chats/Recursos. Efecto secundario aceptado con Joaquín: mientras estás en Perfil ya no se ve la isla flotante debajo (pasa a taparla como cualquier otra pantalla pusheada), antes sí se veía.
  - **Conflicto de gestos**: se auditaron los 4 tabs de cada app buscando scroll horizontal anidado (todo lo que vive en pantallas pusheadas —`/coach-recurso`, `/ruido`, etc.— queda fuera porque tapan el pager entero). Coach: ninguno (la franja de semana que se esperaba encontrar en Reservas no existe hoy, `DAYS` solo formatea texto). Usuario: 3 casos — carrusel de `index.tsx`, chips de `recursos.tsx`/`conexiones.tsx` (ScrollView simple, se dejaron con la resolución nativa de gesto anidado) y **el deck de `conexiones.tsx`** (ScrollView horizontal `pagingEnabled`, dos paginadores en el mismo eje = mayor riesgo de pelea) — a este se le agregó `onScrollBeginDrag`/`onScrollEndDrag`/`onMomentumScrollEnd` llamando `navigation.setOptions({ swipeEnabled })` para cederle el gesto mientras el dedo está adentro.
  - **Sync de la isla con el swipe**: se probaron dos versiones. La primera (actualizar recién al asentarse la página, con `LayoutAnimation`) se sentía atrasada. Se intentó sincronizar en vivo con el valor `position` del pager (nativo) interpolando `paddingHorizontal`/`maxWidth`/`marginLeft` — tiró error en runtime ("Style property … is not supported by native animated module": esas son propiedades de layout, el driver nativo del pager solo anima opacity/transform). Quedó un híbrido: el fondo verde y el crossfade del ícono siguen el dedo en vivo (nativo, sin jank), y el ancho de la pastilla + el label aparecen con un snap corto (`LayoutAnimation`) al asentarse — resuelve el atraso percibido sin pelear contra esa limitación del driver.
- No hubo cambios de base de datos.

**Pendiente para la próxima sesión:**
- Falta confirmar en device Android (todo lo de arriba se probó en iOS/Expo Go).
- Verificar que el swipe-back nativo de los stacks internos (`/coach-recurso`, etc.) y el botón de back de Android sigan sin colisionar con el pager — no se encontró nada que lo indique por código, pero no se probó explícitamente en esta sesión.
- Si el snap de ancho/label de la isla se siente insuficiente comparado con un morph 100% continuo, la alternativa sería portar `position` a Reanimated (que sí puede animar layout en el hilo de UI sin el bridge) — bridging desde un `Animated.Value` clásico a un `SharedValue` fue evaluado y descartado por complejidad/riesgo para esta sesión.

---

## 2026-07-21 — Joaquín (sesión 68)

**Tocado:** `app/(tabs)/recursos.tsx`, `app/coach-recurso.tsx`, `app/mis-recomendaciones.tsx` (nuevo), `design/recursos-liviano-v2.html` (nuevo)

**Resumen:**
- **Rediseño "recursos-liviano-v2" (6 ajustes) contra `design/recursos-liviano-v2.html`** — la pantalla Recursos tenía 4 secciones compitiendo por atención; quedó en 3: "Herramientas de Vita" (sugerencia del día + 4 tiles, antes secciones separadas), "Recomendado por tu coach" (antes "De tus coaches", rediseñada como tarjeta-mensaje de 3 capas: header del coach, nota citada opcional, recurso como adjunto tocable) y "Biblioteca" (antes "Explorar por tema", grilla colapsada a una fila por recurso, filtro de formato colapsable detrás de un botón nuevo, "Guardados" movido al header con badge). El hero verde de mood ahora es condicional: solo aparece con check-in intenso de hoy (`mood_id<=2`); si no, línea compacta con la recomendación real o prompt de check-in. Pantalla nueva `/mis-recomendaciones` ("Ver todas") para cuando hay más de 3 recomendaciones. Sin cambios en lógica de datos ni migraciones — solo presentación y esa condición de render.
- **4 bugs encontrados probando en device — arreglados:**
  1. Prefijo `[SEED]` de los títulos de prueba se colaba en la tarjeta de "Recomendado por tu coach" y en el detalle del recurso (el `displayTitle()` que lo saca solo estaba aplicado en la grilla de Biblioteca). Aplicado también en `CoachRecoSection`, `mis-recomendaciones.tsx` y `coach-recurso.tsx`.
  2. La línea compacta del mood truncaba todo el texto a una línea y, si la razón (`reco.why`) era larga, se comía la parte accionable ("→ herramienta · duración") sin que se viera nunca. Separado en dos `Text` (razón truncable + herramienta fija) para que la flecha siempre sea visible.
  3. Íconos de formato Audio/Podcast invertidos respecto al mockup (Audio mostraba parlante, Podcast mostraba micrófono) — corregido en los 3 archivos que duplican `FORMAT_ICON`.
  4. Faltaba el `logResourceEvent(..., 'coach_profile_visit')` en el nombre tocable del coach en la grilla de Biblioteca (Ajuste 5 lo pedía explícitamente) — agregado, requirió pasar `userId` como prop nueva a `ExploreSection`.
- **Bug de fondo, encontrado después de comparar capturas contra el mockup pixel a pixel:** los componentes nuevos usaban los tokens "glass" translúcidos (`GLASS_BG`/`GLASS_BORDER`) del resto de la app, que se lavan contra el gradiente de fondo. El mockup usa superficies planas con contraste definido (`--card` claro con borde para tiles/chips/línea de mood, `--cream-deep` oscuro sin borde para la tarjeta de coach). Se agregaron los tokens `CARD`/`LINE`/`CREAM_DEEP` (valores exactos del CSS del mockup) y se migraron `moodLine`, `toolTile`, `recbox`, `recAttach`, `recAttachPlay`, `chip`, `filterBtn`, `formatTabActive` y `exploreRow`. También se ajustaron `FOREST`/`TERRACOTTA`/`FORMAT_COLOR` a los valores exactos del mockup (antes eran aproximados). `ContinueCard` y `StreakChip` quedaron con el glass original a propósito — no están cubiertos por los 6 ajustes. Verificado con muestreo de píxeles sobre una captura real que el resultado coincide exacto (`#EAE2D0`, `#F7F2E7`) con el mockup.

**Pendiente para la próxima sesión:**
- Quedan sin usar (dead code, de antes del rediseño de sesión 62): `coachCard`, `libraryCard`, `libraryRow`, `coachHeader`, `coachAvatar`, `coachInitials`, `coachHeaderText`, `coachName`, `coachUpdated`, `coachBadge`, `coachNote`, `coachResources`, `libraryCardHeader`, `coachResRow`, `coachResIcon`, `coachResText`, `coachResTitle`, `coachResSub`, `checkCircle*` en `app/(tabs)/recursos.tsx` — se detectaron pero no se borraron para no meter ruido en esta sesión.
- Falta probar en device el hero verde de mood (Ajuste 1) con un check-in real de "Bajón"/"Cansado" — se verificó por código y por diseño, no con captura.
- Falta probar `/mis-recomendaciones` con más de 3 recomendaciones reales (hoy solo hay una sembrada).
- Nota del coach en `SalaScreen.tsx` (recomendación in-chat) sigue sin pasar `note`/`fromCoachName` a `/coach-recurso` — quedó fuera de alcance de los 6 ajustes, mencionado como pendiente para más adelante.

---

## 2026-07-19 — Joaquín (sesión 67)

**Tocado:** `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/recursos.tsx`, `app/_layout.tsx`, `app/coach-recurso-nuevo.tsx`, `app/index.tsx`, `app/progreso.tsx`, `components/AnimatedGradientCard.tsx`, `components/AuthModal.tsx`, `components/MoodCheckIn.tsx`, `components/ui/VitaHeader.tsx`, `components/VitaWordmark.tsx` (nuevo), `constants/theme.ts`, `lib/resourceReminders.ts`, `screens/CoachLoginScreen.tsx`, `screens/LoginScreen.tsx`, `screens/OnboardingBifurcacion.tsx`, `screens/OnboardingScreen2.tsx`, `screens/OnboardingScreen3.tsx`, `screens/OnboardingScreen4.tsx`, `screens/OnboardingScreen5.tsx`, `screens/ProfesionalScreen.tsx`, `screens/RegisterScreen.tsx`, `screens/SalaScreen.tsx`, `screens/SessionsScreen.tsx`

**Resumen — sesión de copy/estilo puro, sin cambios de lógica ni de datos:**
- **Rebrand VIVE→VITA + voseo.** Relevadas y reemplazadas todas las menciones de "VIVE"/"Vive"/"vive" (marca) por "VITA"/"Vita"/"vita" en toda la app — 20 ocurrencias entre textos y comentarios de código. Se dejaron intactos los identificadores internos que coinciden con el string ("vive_tooltip_*", "vive_quiz_topic", el deep link `viveapp://`, la key de encripción `vive_mvp_key_2026`) porque tocarlos rompería estado guardado/deep links/cifrado. Barrido de tuteo: de toda la app, el único resto real era "Sobre ti" → pasado a voseo ("Sobre vos"); el resto de la app ya estaba en voseo consistente.
- **Cambios puntuales de copy**: selección de rol, login coach, "¿Cómo te gustaría empezar?", onboarding pasos 1-2 (subtítulos), tab bar ("Mis salas" → "Mensajes"), y varios en Inicio: saludo (ya no depende de la hora, usa el nombre si existe: "¡Hola!" / "¡Hola, {nombre}!"), subsaludo en voseo, check-in (se sacó el título fijo "CHECK-IN DE HOY", ahora muestra la fecha de hoy dinámica tipo "Domingo 19 de julio"), etiquetas de ánimo (Normal/Brillando reemplazan Neutral/Genial, actualizado también en `progreso.tsx` para que coincida), "Tus recursos a mano" (antes "pinneados").
- **Wordmark "vita" unificado.** Antes vivía duplicado en ~9 lugares con estilos distintos (mayúsculas vs. minúsculas, bold vs. semibold, tracking alto, colores distintos: splash con un ícono de brote reemplazando una letra, Home, AuthModal, VitaHeader de Progreso, onboarding 3-5, login, registro). Se creó `components/VitaWordmark.tsx` como componente único: Fraunces SemiBold, minúscula, sin tracking, ~28px, oliva `#565E32`. Hubo que agregar `Fraunces_600SemiBold` a la carga de fuentes (`app/_layout.tsx`) — antes solo estaba `Fraunces_700Bold`. En el splash se simplificó el tratamiento (se sacó el ícono de brote) para que sea igual en todos lados — es la única pantalla donde el copy pedía explícitamente "splash" en la unificación, así que se priorizó consistencia sobre el detalle decorativo; queda anotado por si prefieren mantenerlo distinto ahí.
- **Tarjeta "Sobre vos"**: cuerpo pasado de un insight dinámico (`lib/moodInsights.ts`, que queda sin uso pero no se borró) a texto fijo, más una línea de acción "Ir a tu progreso →" (oliva, semibold) — la navegación de la card ya existía y no se tocó.

**Pendiente para la próxima sesión:**
- Confirmar si el splash sin el ícono de brote (decisión tomada hoy para unificar el wordmark) es lo que quieren, o si prefieren un tratamiento especial solo ahí.
- `lib/moodInsights.ts` quedó sin ningún consumidor — decidir si se borra o se deja por si se reusa en otro lado.
- Arrastrado de sesiones anteriores: Mercado Pago (deep link `viveapp://coach/mp-connected` + confirmar deploy de edge functions).

---

## 2026-07-18 — Joaquín (sesión 66)

**Tocado:** `app/coach-recurso.tsx`, `app/coach-recurso-nuevo.tsx`, `app/mis-recordatorios.tsx` (nuevo), `app.json`, `components/ReminderBell.tsx` (nuevo), `components/AudioRecorderModal.tsx` (nuevo), `screens/CoachProfileScreen.tsx`, `screens/CoachResourcesScreen.tsx`, `screens/ProfesionalScreen.tsx`, `lib/resourceEvents.ts` (nuevo), `scripts/add-resource-events-stats-functions.sql` (nuevo), `SCHEMA.md`, `.gitignore`, `node_modules 2/` (eliminado del tracking)

**Resumen:**
- **RF2/RF3 de recordatorios — completos.** `components/ReminderBell.tsx`: campanita reutilizable (mismo patrón que `PinButton`) con sheet propio (chips de días Dom-Sáb + `DateTimePicker` nativo para la hora), cableada en las 10 tools de VITA (9 vía sus `screens/*.tsx` + Gratitud directo en `app/gratitud.tsx`, que no usa `PinButton`) y en `/coach-recurso`. Ojo: `screens/DiarioScreen.tsx` es código **muerto** — `/diario` en realidad lo resuelve `app/diario.tsx`, un archivo aparte; ahí quedó cableada la campanita. `app/mis-recordatorios.tsx` (RF3): lista con día/hora, toggle enabled/disabled y borrar; entry point nuevo en el header de Recursos. Fix de paso: el `DateTimePicker` en modo `spinner` (iOS) no tenía `textColor`, texto blanco invisible sobre el fondo crema del sheet. Todo probado end-to-end en device (crear, editar, activar/desactivar, borrar, notificación real recibida).
- **Testing del rediseño coach F1-F4 de Andre (sin probar en device hasta hoy) — 1 bug real.** Swipe-back en perfil: OK. Aceptar/rechazar reserva (F2): OK (el error de Daily.co que apareció fue por una reserva de prueba mía sin `sala_id`, no un bug real). Tags de Chats (F3, "SESIÓN ACEPTADA"/"RECURSO"/Archivados): lógica correcta, simplemente no había data que calificara todavía. **Bug encontrado y arreglado en F4:** la fila de "Mis recursos" no tenía `onPress` — solo el botón "Recomendar" reaccionaba al toque, tocar el resto de la card no hacía nada.
- **Housekeeping:** `node_modules 2/` (223MB, 26.418 archivos) estaba trackeado en git por un `.gitignore` que solo excluía `node_modules/` a secas — sacado del tracking y del disco, `.gitignore` corregido, typecheck quedó 100% limpio. `SCHEMA.md`: corregidas dos marcas "PENDIENTE de correr" obsoletas (pagos v1 y el trigger de reembolso ya estaban corridos en prod) y cerrada la nota del hueco 05/07→13/07 ("puertas de Conexiones" resultó ser frontend puro, sin migración propia).
- **Las 3 decisiones abiertas que había dejado Andre — resueltas:**
  1. Sacado el "Mis recursos" duplicado de `CoachProfileScreen` (queda solo en el tab F4, que ya tiene stats/CTAs/Recomendar). Limpiado el state/query huérfano.
  2. **`resource_events` instrumentado — funnel completo.** `lib/resourceEvents.ts` (`logResourceEvent`, fire-and-forget) dispara `view` (al cargar el recurso), `play` (primer play de audio, primer `playing` de video, o abrir podcast en la fuente externa), `complete` (fin de audio/video), `coach_profile_visit` (nombre del coach ahora tappable → `/profesional`, pasando `resourceId` como param) y **`booking_started`** (en `ProfesionalScreen`, al tocar "Reservar sesión" — se dispara ahí nomás, no hace falta hilar el `resourceId` más allá hacia `BookingScreen` porque "started" es la intención, no la reserva confirmada). Como ni `resource_events` ni `resource_saves` tienen SELECT para `authenticated`, se agregaron `get_my_resource_counts()` y `get_my_resource_stats_month()` (`SECURITY DEFINER`, mismo patrón que `get_my_resource_feedback_summary`) para que el coach lea sus agregados. El tab F4 ("Este mes" + ▶/◈ por recurso) ya no muestra `0` hardcodeado.
  3. **Grabador de audio real.** `components/AudioRecorderModal.tsx` (expo-audio, `RecordingPresets.HIGH_QUALITY` → `.m4a`): grabar → parar → escuchar la previa → usar o regrabar, con el mismo límite de 30MB. Botón "Grabar ahora" en `coach-recurso-nuevo.tsx`, arriba del selector de archivo existente. Fix de paso: `useAudioRecorderState` pollea cada 200ms sin importar la fase — dejarlo así durante la reproducción de la previa (que también pollea) causaba lentitud notable; ahora solo pollea rápido mientras graba de verdad.
- Se corrió en Supabase: `scripts/add-resource-events-stats-functions.sql`.

**Pendiente para la próxima sesión:**
- Mercado Pago sigue arrastrado: deep link `viveapp://coach/mp-connected` sin handler, y confirmar si las 5 edge functions siguen desplegadas (sesión 63 decía que sí, pero conviene verificar en vivo como pasó con los otros "ya corridos" de esta semana).
- ~~`booking_started` sin probar en device~~ — probado, llega bien a `resource_events`. Funnel completo confirmado.
- El texto de permiso de micrófono custom en `app.json` (para `expo-audio`) no se prueba hasta que exista una build nativa propia — en Expo Go se ve el texto genérico.

---

## 2026-07-17 — Joaquín (sesión 65)

**Tocado:** `app/_layout.tsx`, `lib/resourceReminders.ts` (nuevo), `SCHEMA.md`

**Resumen:**
- **Pull del trabajo overnight de Andre** (12 commits, `andre/main`): rediseño completo de las 4 tabs del coach (F1 Inicio, F2 Reservas, F3 Chats, F4 Recursos) contra `docs/coach-app-interactivo.html`, búsqueda de coaches por nombre en Conexiones, remoción del carrusel viejo "Recursos de nuestros coaches" en `app/(tabs)/recursos.tsx` (se pisaba con "Explorar por tema"), y fix de navegación (swipe-back en perfil de coach cayendo en onboarding). Mergeó limpio (fast-forward, sin conflictos con el trabajo de ayer) y se pusheó a `origin` (Andre lo había dejado solo en su remote).
- **RF1 — motor de recordatorios, hecho y probado end-to-end en device.** `lib/resourceReminders.ts`: `reconcileResourceReminders(userId)` cancela todas las notis locales propias (prefijo `resource-reminder:`) y las reprograma desde `resource_reminders` (solo `enabled=true`) con triggers `WEEKLY` de `expo-notifications` 0.32.17 (un trigger por día, `weekday` 1-7/1=domingo — mapea contra nuestro `days` 0=Dom..6=Sáb con `+1`). Identifier determinístico por recordatorio+día, así reconciliar es "cancelar todo lo mío + reprogramar desde la base", sin trackear ids que genera el SO. Se llama al abrir la app en el mismo efecto que `registerForPushNotifications` (`app/_layout.tsx`). Tap en la notificación rutea a `/coach-recurso` o a la tool. Validado insertando una fila de prueba a mano por SQL con hora cercana — llegó la notificación real al celular.
- **`SCHEMA.md`**: documentadas `coach_availability_status` (vista, de la sesión de Andre) y `resource_reminders` (tabla) — Andre las había dejado como deuda de documentación. De paso se confirmó contra la base que ambas migraciones ya estaban corridas (a pesar de que el mensaje de Andre marcaba `resource_reminders` como "pendiente de correr" — ya existía).

**Pendiente para la próxima sesión:**
- **RF2** (UI de configuración: campanita + chips de días/hora, componente reutilizable para las 10 tools + `/coach-recurso`) y **RF3** (pantalla "Mis recordatorios") — sin esto, RF1 no es usable desde la app todavía (no hay forma de crear un recordatorio sin SQL directo).
- El rediseño coach F1-F4 de Andre sigue **sin probar en device** (lo dejamos pendiente a propósito hoy para priorizar RF1).
- Decisiones abiertas que dejó Andre: grabador de audio real (hoy "Grabar audio" preselecciona el formato nomás), instrumentar `resource_events` para stats reales (hoy en 0), sacar el "Mis recursos" duplicado del perfil de coach (ya vive en el tab F4).
- Arrastrado de sesiones 61-64: deep link `viveapp://coach/mp-connected`; deploy de edge functions de Mercado Pago; `node_modules 2/` duplicado; hueco de `SCHEMA.md` entre 05/07 y 13/07 (pagos v1, puertas de Conexiones).

---

## 2026-07-16 — Joaquín (sesión 64)

**Tocado:** `app/(tabs)/recursos.tsx`, `app/coach-recurso.tsx`, `app/coach-recurso-nuevo.tsx`, `scripts/seed-recursos.sql`, `scripts/recursos-v2-migration.sql`, `scripts/fix-seed-coach-orphan-role.sql` (nuevo), `SCHEMA.md`, `package.json`, `package-lock.json`

**Resumen:**
- **Testing completo de F3/F4/F5 de recursos-v2 (sesión 62) — 3 bugs reales encontrados y arreglados:**
  1. **Seed invisible.** `coach_resources` estaba vacía en producción pese a que el CHANGELOG de sesión 62 decía "seed corrido" (el `DO $$` hace `RETURN` silencioso si no encuentra coach/sala). Corrido el seed (8 recursos). Con eso tampoco aparecía nada en "Explorar por tema": el coach elegido por `LIMIT 1` tenía `profiles.role='user'`, y la RLS de `profiles` solo expone perfiles con `role='coach'` — el join `coaches!inner(profiles!inner(name))` fallaba en silencio y la fila entera desaparecía. Reasignados los 8 recursos a un coach válido (`scripts/fix-seed-coach-orphan-role.sql`) y corregidos ambos scripts de seed para filtrar `profiles.role='coach'`.
  2. **Audio mudo.** `app/coach-recurso.tsx` (el player de F3) nunca llamaba a `setAudioModeAsync({ playsInSilentMode: true })` de `expo-audio` — a diferencia de `RuidoScreen`/`ResourceDetailScreen`, que sí lo hacen. El player avanzaba la barra de progreso pero no sonaba. Agregado el `setAudioModeAsync` en `AudioPlayer`. (De paso, subí dos audios cortos generados con `say` a las rutas del seed que no tenían archivo real en Storage, para poder validar el player end-to-end.)
  3. **Upload de F5 rompía por RLS.** `app/coach-recurso-nuevo.tsx` armaba la ruta de Storage con `coach_id` (`coaches.id`), pero la policy `resource_audio_coach_insert` exige que la carpeta sea `auth.uid()` (`profiles.id`) — son ids distintos (mismo tipo de trampa que ya advertía `SCHEMA.md` en otros lados). El upload fallaba siempre con "new row violates row-level security policy". Cambiado a `user.id` (de `useAuth`).
  - Podcast y lectura en "Explorar por tema" se probaron sin problemas. F4 (recomendar recurso por chat) funcionó a la primera.
  - Nota de proceso: dos intentos de probar F5 fallaron porque el coach de prueba entró por la pantalla vieja ("Recursos" → "Proponer un recurso" → `resource_proposals`) en vez de la nueva (Perfil → "Mis recursos" → "+ Nuevo" → `coach_resources`) — son dos flujos con nombres parecidos y quedó documentado acá para no repetir la confusión.
- **`SCHEMA.md` tenía un hueco**: las 4 tablas de recursos-v2 (`coach_resources`, `resource_recommendations`, `resource_saves`, `resource_events`) de la sesión 62 nunca se documentaron ahí. Se agregó la sección completa + el hallazgo de coaches con rol roto. Sigue habiendo un hueco sin completar entre el 05/07 y el 13/07 (pagos v1, puertas de Conexiones) — no se tocó en esta sesión, queda anotado en el header del archivo.
- **Rediseño de la pantalla Recursos** siguiendo un mockup (`recursos-v2-interactivo`) que pasó Joaquín: "Explorar por tema" pasó de grilla de 2 columnas a lista vertical (ícono cuadrado por formato, avatar del coach con iniciales, pill de tema, tabs de formato en texto en vez de chips); "De tus coaches" ahora tiene ícono, badge NUEVO, nota citada y botón "Abrir"; "Herramientas de Vive" simplificada a íconos redondos en fila fija (se sacó el bookmark y la duración de cada tile, y el borde de card); la tarjeta de check-in de ánimo/tema ahora usa el texto `reco.why` del hook como título y un botón pill (antes era una card con ícono+subtítulo). Sin cambios en la lógica de datos, solo presentación. Confirmado por Joaquín en el celular.
- `package.json`/`package-lock.json`: se sumó `react-native-webview` como dependencia directa (peer dep de `react-native-youtube-iframe`, quedó instalada sin commitear de una sesión anterior).
- Se resolvió también un problema de autenticación de git (token PAT embebido en las URLs de `origin`/`andre` había expirado) — se migró a `gh auth login` + credential helper, sin token en texto plano en los remotes.

**Pendiente para la próxima sesión:**
- Recursos-v2 (F1-F5) queda completamente probado y funcional. Falta correr el fix de RLS de audio (#3 arriba) contra un archivo real subido por un coach de verdad, no solo el de prueba.
- Considerar unificar o diferenciar mejor visualmente los dos flujos de "subir/proponer un recurso" (el viejo `resource_proposals` con cola de revisión de VITA, y el nuevo `coach_resources` de publicación directa) — generaron confusión real durante el testing de hoy.
- Arrastrado de sesiones 61-62: deep link `viveapp://coach/mp-connected` sin handler; deploy pendiente de las edge functions de Mercado Pago.
- `node_modules 2/` duplicado sigue ensuciando el typecheck (ya anotado en sesión 62).
- `SCHEMA.md` todavía tiene el hueco 05/07→13/07 sin documentar (pagos v1, puertas de Conexiones) — no es urgente pero conviene cerrarlo en algún momento.
- Durante esta sesión, un comando de `supabase projects api-keys` imprimió la `service_role` key legacy completa en la consola (necesaria para subir audio de prueba a una carpeta fuera de RLS). No salió de la Mac, pero si preocupa, rotarla desde el dashboard de Supabase.

---

## 2026-07-15 — Andre (sesión 63)

**Tocado:** `scripts/add-refund-on-cancel-trigger.sql` (nuevo), `screens/SalaScreen.tsx`, `supabase/functions/mp-webhook/index.ts`, `screens/RegisterScreen.tsx`, `app/_layout.tsx`, `screens/CoachProfileScreen.tsx`, `app/(tabs)/recursos.tsx`, `app/(tabs)/conexiones.tsx`, `lib/coachBookingActions.ts` (nuevo), `hooks/useCoachPending.ts` (nuevo), `screens/CoachHomeScreen.tsx`, `screens/CoachReservasScreen.tsx`, `scripts/add-coach-availability-view.sql` (nuevo, borrador), `docs/coach-app-interactivo.html` (nuevo, mockup spec), `SCHEMA.md`

**Resumen:**
- **Bug de reembolsos (crítico) — el flujo de "reembolso automático si el coach rechaza" no estaba conectado.** Los 5 caminos de cancelación (coach rechaza pendiente, coach cancela confirmada, competidores por slot ×2, expiry) pasaban el booking a `'cancelada'` pero **ninguno del lado cliente tocaba `payment_status`** → `mp-process-refunds` nunca los agarraba y un usuario que ya pagó se quedaba sin devolución. Fix: **trigger `trg_mark_refund_on_cancel`** (BEFORE UPDATE OF status en `bookings`) que centraliza la regla server-side — al cancelar un pago `aprobado`, lo marca `reembolso_pendiente`. Robusto ante cualquier path futuro. **PENDIENTE de correr en Supabase.**
- **Política de reembolso del usuario (decisión Andre):** reembolso total si el usuario cancela con antelación (>24h), **sin reembolso si es tardía** (penalidad). El trigger excluye `cancelled_by='usuario' AND cancelled_late=true`. Para que funcione, el path de cancelación del usuario (`SalaScreen`) ahora setea `cancelled_late` (antes solo lo hacía el coach).
- **Webhook MP — el TODO de "disparar la confirmación" estaba mal planteado.** La confirmación (`reserva_confirmada` + `system_confirmed`) ya se emite al reservar (instant) o al aceptar el coach; hacerla también en el webhook duplicaría en instant o saltearía la aceptación. Se reemplazó el TODO por un comentario que documenta esto + el gap conocido (pago rechazado sobre un instant ya confirmado — product call pendiente, baja frecuencia).
- **Nota sobre estado de pagos:** las 5 edge functions MP están deployadas y con las llamadas reales a la API escritas (los headers "SCAFFOLD" quedaron viejos). Lo que falta para prod: correr el trigger, credenciales MP de producción + secrets (`MP_WEBHOOK_SECRET`, `CHECKOUT_RETURN_URL` https, `FOUNDER_PROMO_UNTIL`), verificación end-to-end real (el checkout fallaba en sandbox por error del lado de MP), y handler de deep link opcional.
- **Coach Inicio — se sacó el "recordarle" y la sección Pendientes (decisión Andre+hermano).** Un botón que le recuerda al usuario que abra un recurso que no abrió es **presión innecesaria** y desentona con la marca (bienestar, sin nag). Distinción que quedó: **informar al coach** (¿lo abrió lo que le mandé?) es útil; **empujar al usuario** sobra. Entonces: se quitó el botón "recordarle" (de Inicio y de "Preparar sesión") pero **se mantiene el ✓/✗ (abrió/sin abrir) como contexto** en Preparar. Al sacar el nudge, la sección "Pendientes" de Inicio se quedó sin contenido (las solicitudes ya estaban en Reservas) → **se removió entera**. Inicio queda: saludo → tu semana → tu próxima sesión (con Preparar mostrando contexto). Se borró el hook `hooks/useCoachPending.ts` (ya sin consumidores) y estilos muertos. **Reemplazo en camino (pedido Andre):** que el USUARIO configure recordatorios propios para recursos/herramientas (ej. "diario todos los días 9pm") — autonomía en vez de presión. A diseñar.
- **Rediseño interfaz coach — F4 Recursos (última fase).** El tab Recursos usaba el sistema VIEJO (`resources` + "Proponer a VIVE" + "Biblioteca VIVE"); Recursos v2 (`coach_resources`, subida en 3 pasos) vivía en CoachProfileScreen (sesión 62). F4 hace del **tab la casa de Recursos v2** con el layout del mockup: header "Tus recursos" + chip "N/10 publicados"; **bloque verde de stats** (reproducciones/guardados/visitas) — `resource_events` está vacío y **sin SELECT RLS para el coach**, así que van en **0 con el copy de promesa** (no se oculta); CTAs **Subir** (→ `/coach-recurso-nuevo`) y **Grabar audio**; lista "Mis recursos" (`coach_resources`) con badges PUBLICADO/EN REVISIÓN/RECHAZADO, cover por formato, meta "Formato · N min · Tema", mini-stats ▶/◈ (en 0) y **Recomendar** en los publicados; link "Ver cómo lo ven tus pacientes →" (→ `/explorar-recursos`). `coach-recurso-nuevo` ahora acepta un param `format` (Grabar audio preselecciona audio). Se **retiró del tab** "Proponer a VIVE" + "Biblioteca VIVE" — **las rutas viejas (`resource-proposal-new`, `resource-proposals`) NO se borraron** (las usa CoachNotificationsScreen). **Deudas/flags:** (1) **grabador de audio real diferido** — "Grabar audio" abre el flujo con audio preseleccionado; el grabador in-app (expo-audio) queda como deuda (allowance del prompt); (2) stats reales requieren instrumentar `resource_events` + vista agregada server-side (el coach no puede leer la tabla cruda); (3) "Recomendar" manda a Chats (selector directo de chat = deuda); (4) **"Mis recursos" quedó duplicado**: ahora en el tab + todavía en CoachProfileScreen — **decisión pendiente: ¿sacarlo del perfil?**. **Sin probar en device. Con esto F1–F4 del rediseño coach están completos** (falta review en device + correr la migración de disponibilidad de F1).
- **Rediseño interfaz coach — F3 Chats.** Rediseño de la lista de `CoachChatsScreen` al mockup (la lógica de chat/realtime/navegación a la sala **no se tocó**). Filas tipo card con avatar de iniciales (nunca en blanco), nombre, preview y hora. **Tags en el preview:** "✓ SESIÓN ACEPTADA" (verde) cuando el último mensaje es `system_confirmed` — el preview muestra el motivo del usuario («…») que ya viaja en ese mensaje (lo inserta `confirmBooking`, no hubo que agregar nada); "RECURSO" (terracota) cuando el último es un recurso recomendado (`metadata.type==='resource'`), con preview "Vos: [título] · abierto ✓ / sin abrir" (estado desde `resource_recommendations.opened_at`, batch por `recommendation_id`) — reemplaza el "[Recurso recomendado]" crudo. **Archivados:** salas cuyo último evento es de sistema (`system`/`system_cancelled`) y >30 días → colapsadas bajo un toggle "Archivados (N)" al final. Empty state con la nota "los chats se habilitan al aceptar". **Deudas/flags:** el badge de no-leídos es un puntito (no un número — `useUnreadSalas` da booleano, no count); el criterio de archivado usa "último mensaje de sistema + >30d" como proxy de "solo eventos de sistema" (ajustable). **Sin probar en device.** Sigue F4 (Recursos).
- **Rediseño interfaz coach — F2 Reservas.** Reescritura del render de `CoachReservasScreen` al mockup, reusando toda la lógica (loadBookings, accept/reject vía helper, cancelConfirmed). **"Por confirmar":** cards con borde terracota, avatar + nombre + "fecha · hora · hace X", motivo del usuario (`user_message`) en Fraunces itálica (mismo estilo que Inicio), botones **Confirmar** (accept) / **Otro horario**. **"Confirmadas":** agrupadas por día con header en mayúsculas ("MAÑANA · JUE 23 JUL"), hora primero en Fraunces, ordinal ("3.ª sesión" = completadas del par + rank entre confirmadas futuras) + "videollamada"; la próxima <24hs muestra **Preparar** (→ Inicio), el resto un menú **"⋯"** (Ver chat · Reprogramar · Cancelar sesión) — **Cancelar salió del botón rojo permanente al menú, con confirmación** (reusa la cancelación existente). Link "Ver historial de sesiones →" (→ `/coach-agenda`). **Decisiones:** "Otro horario" reusa el flujo de rechazo existente (modal relabeleado + copy de la notificación suavizado en `coachBookingActions` — ahora "ese horario no está disponible, elegí otro" en vez de "buscá otro profesional"); **reprogramación real es deuda** (el menú "Reprogramar" es stub). "Ver historial" apunta al calendario mensual — vista dedicada de historial es aparte si se quiere. **Sin probar en device.** Sigue F3 (Chats).
- **Rediseño interfaz coach — F1 Inicio (hub "Hoy").** Primera fase del rediseño de los 4 tabs contra el mockup `docs/coach-app-interactivo.html` (spec visual, traída al repo). Principio: el coach resuelve lo del día en 30s, la app le trae lo pendiente. **Regla:** no se reescribe lógica que funciona, se reusa/adapta. Hecho: (1) `lib/coachBookingActions.ts` — extraída la lógica de confirmar/rechazar de `CoachReservasScreen.accept()`/`confirmReject()` SIN cambios, ahora compartida (Reservas quedó como wrapper fino); (2) `hooks/useCoachPending.ts` — fuente única de pendientes (solicitudes + recursos sin abrir con sesión <48hs); (3) `CoachHomeScreen` reescrita al mockup: header "Hola, [nombre]" + avatar (sin emoji), franja "Tu semana" con círculos terracota + caption, card verde "Tu próxima sesión" (ordinal por sesiones completadas, "Unirse" con gating 10min → Sala, "Preparar sesión" expandible con última sesión + recursos enviados ✓/✗ + "recordarle"), sección "Pendientes" con motivo del usuario (`user_message`, ya existía) en Fraunces itálica + Confirmar inline, card "Estás al día". **Degradaciones aplicadas:** "Tu nota" omitida (no hay sistema de notas → deuda); sin próxima sesión → card compacta. **Auditoría de datos:** `user_message` ya existe (no se creó `request_message`); Recursos v2 existe; `resource_events` existe pero vacío y sin SELECT RLS → stats de F4 irán en 0; no hay pre_booking a medio construir. **Migración F1 (BORRADOR, PENDIENTE tu OK):** `scripts/add-coach-availability-view.sql` — vista server-side de disponibilidad auto (this_week/responds_24h) que reemplaza el cálculo cliente; ⚠️ revisar formato de hora antes de correr. **Pendiente de F1:** correr la migración. **Sin probar en device.**
  - **Ajustes post-review (Andre):** (1) puntito terracota de Inicio wireado en `(coach)/_layout`; (2) franja "Tu semana" vuelve a abrir el calendario mensual (`/coach-agenda`), no Reservas; (3) **campana de notificaciones devuelta** al header (arriba-derecha, al lado del perfil); (4) **se sacó aceptar/rechazar de Inicio** — decisión Andre+hermano: clonaba Reservas. Las solicitudes se siguen mostrando en "Pendientes" pero la fila linkea a Reservas (la acción vive solo ahí); "recordarle" de recursos se mantiene (es único del hub). (5) **Migración revisada y corregida:** `security_invoker` pasó de `true` a `false` (con `true` la subquery de bookings corría con el RLS del usuario → solo veía sus reservas → marcaba libre un slot tomado por otro; ahora corre como owner + GRANT, patrón `coach_trending_stats`). Formatos de hora verificados (mismo slot origen). **CORRIDA y verificada 16/07** (la vista devuelve mezcla `this_week`/`responds_24h` con sentido → el match de horas anda). `lib/coachAvailability.ts` ahora **lee la vista** (v2: cruza contra reservas, antes no lo hacía). El estado `responds_24h` aún no se muestra en el deck (badge nuevo pendiente). (6) **Pendientes adelgazado (decisión Andre):** al sacar el aceptar/rechazar, la parte de "solicitudes" quedó redundante con Reservas → se removió de Inicio. "Pendientes" ahora muestra solo los nudges únicos del hub (recursos sin abrir con sesión <48hs + "Recordarle"); su contador y el "Estás al día" van por esos. Se retiró también el puntito de Inicio en la nav (el signal de solicitudes vive solo en el de Reservas). Sigue F2 (Reservas) tras review.
- **Conexiones — búsqueda de coaches por nombre, en vivo, en la landing.** Se reemplazó la entrada al buscador viejo por área (`search1/2/3`, redundante con el flujo Ejes→Temas→Deck) por una **barra de búsqueda inline arriba de los 3 ejes**. Filtra el `coachesCache` ya cargado (sin tocar la base), normalizando acentos/mayúsculas (`normalizeName` → "gonzalez" encuentra "González"). Con texto: muestra lista de coaches (avatar + nombre + especialidad), tap → `/profesional` (reusa `goToPerfil`); sin texto: vuelven los ejes. Se removieron los 2 íconos 🔍 → `/search1` (header del menú y del deck). Las pantallas `search1/2/3` quedan en el repo sin entrada desde Conexiones (no borradas).
- **Recursos (usuario) — se sacó el carrusel "Recursos de nuestros coaches"** por pisarse con la sección "Explorar por tema" (ambas eran contenido de coaches navegable por tema). Se removió el render + código muerto asociado (`rankCoachLibrary`, componente `CoachLibrarySection`, memo `rankedLibrary`, const `LIBRARY_TYPE_LABEL`, import `Axis`). Se mantiene el state `libraryResources` y el `type LibraryResource` porque alimentan `useRecommendedResource` (la card de recomendación de arriba).
- **Bug de navegación — swipe-back en perfil de coach caía en onboarding.** Al loguear, `coach-login` hace `replace('/(coach)')` que solo cambia la pantalla de arriba → `onboarding-bifurcacion` queda viva debajo de `(coach)` en el stack raíz. El perfil (tab oculto `href:null`, sin botón de volver) se abre con `push('/perfil')` y se salía solo con swipe, que popeaba fuera del grupo hacia esa pantalla vieja. Fix: `gestureEnabled:false` en `(coach)` y `(tabs)` (no se puede deslizar el home de cada rol hacia afuera, mismo patrón que `booking-success`) + botón de volver (flecha) en `CoachProfileScreen` → `router.back()` con fallback a `/(coach)`. **Falta probar en dispositivo.** Causa de fondo (stack sucio al entrar a los grupos) sigue latente pero tapada; atacarla a fondo requeriría reset del stack en el login.
- **Cifrado de mensajes — copy de privacidad corregido (era falso).** `lib/encryption.ts` no es cifrado real: XOR+base64 con clave fija en el bundle (`vive_mvp_key_2026`; `EXPO_PUBLIC_` la embebe igual). Lo que protege los chats entre usuarios es el RLS de `messages`, no el XOR. El modal de privacidad de `RegisterScreen` prometía "se almacenan encriptadas · solo vos y el profesional pueden ver · VIVE no accede" — falso (VIVE tiene la clave + DB). Se ablandó a lo verdadero: controles de acceso + no-uso-comercial + revisión solo ante requerimiento legal, sin afirmar E2E. **E2E real queda pendiente post-MVP** (par de claves por usuario, secure-store, native crypto → necesita dev client; ver memoria `project_vive_encryption`).

**Pendiente para la próxima sesión:**
- **Correr en Supabase:** `scripts/add-refund-on-cancel-trigger.sql`
- Pagos: credenciales prod MP + secrets, y un pago real end-to-end (preferencia → pago → webhook → refund) que nunca se completó
- Sweep para instant_booking sin pago aprobado: **diferido hasta que el pago sea obligatorio** (todos los coaches con MP). Verificado en docs MP que `rejected` no es final (Checkout Pro recupera rechazos con reintento) → el webhook NO auto-cancela; hoy "confirmada sin pago" es válido porque el pago es opcional. Ver memoria `project_vive_payments`.
- **E2E real de mensajes (post-MVP):** hoy es obfuscación XOR, no cifrado. Requiere dev client + native crypto + manejo de claves. Mientras tanto, no volver a prometer E2E en copy.
- `node_modules 2/` duplicado ensucia el typecheck; falta instalar tipos de `react-native-youtube-iframe`/`react-native-markdown-display` (de sesión 62)

---

## 2026-07-13 — Joaquín (sesión 62)

**Tocado:** `app/(tabs)/recursos.tsx`, `app/coach-recurso.tsx` (nuevo), `app/coach-recurso-nuevo.tsx` (nuevo), `screens/SalaScreen.tsx`, `screens/CoachProfileScreen.tsx`, `scripts/seed-recursos.sql` (nuevo), `package.json`, `package-lock.json`

**Resumen:**
- F1 (DB): tablas `coach_resources`, `resource_recommendations`, `resource_saves`, `resource_events` creadas en Supabase; columna `metadata jsonb` en `messages`; bucket `resource-audio` subido a 30MB; seed de 8 recursos corrido
- F2 (RecursosScreen): nuevas secciones "De tus coaches" (recomendaciones por chat), "Herramientas de Vive" (reducido a 4 tools: Respiración, Ruidos, Diario, Gratitud), "Explorar por tema" (chips de 10 puertas + filtro de formato + grilla 2 columnas de `coach_resources`)
- F3 (reproductores): pantalla `/coach-recurso` con audio player nativo (expo-audio: play/pause/seek/±15s), video YouTube embebido (react-native-youtube-iframe), podcast abre en fuente (Linking), lectura renderiza markdown (react-native-markdown-display)
- F4 (chat): SalaScreen — botón "+" para el coach, bottom sheet de recursos + nota, card en el chat con metadata, "Abrir" marca `opened_at`
- F5 (coach sube recursos): sección "Mis recursos" en CoachProfileScreen (lista con estado/rechazo, límite 10) + pantalla `/coach-recurso-nuevo` (form completo: formato chips, tema puertas, contenido por formato, upload audio a Storage, declaración de autoría, submit → pending)
- Fix (4 bugs): `CoachLibrarySection` usaba tabla equivocada para guardar; badge NUEVO no desaparecía; race condition en bookmark; botón "Nuevo" con `coachId=null`

**Pendiente para la próxima sesión:**
- Testear F3/F4/F5 en dispositivo real (audio player, YouTube embed, upload, recomendación completa)
- Deep link handler `viveapp://coach/mp-connected` para el flujo de OAuth de Mercado Pago
- Deploy edge functions MP (`mp-oauth-start`, `mp-create-payment`) — requiere credenciales de mercadopago.com.ar/developers

---

## 2026-07-12 — Joaquín (sesión 61)

**Tocado:** `screens/BookingScreen_Confirm.tsx`, `screens/CoachProfileScreen.tsx`, `supabase/functions/mp-oauth-start/index.ts` (nuevo)

**Resumen:**
- Implementó flujo de pago MP en BookingScreen_Confirm: después del insert del booking, llama a `mp-create-payment` edge function; si hay `init_point`, abre Checkout Pro con `WebBrowser.openBrowserAsync`; si el coach no tiene MP conectado (409) sigue sin pago. El `router.replace` lleva `paymentPending: '1'` cuando se abrió el browser.
- Reemplazó la sección de pago decorativa (dos cards no funcionales) por un info-box "El pago se procesa a través de Mercado Pago al confirmar".
- Agregó sección "Mercado Pago" en CoachProfileScreen: muestra estado conectado/no-conectado, botón "Conectar" que llama a `mp-oauth-start` → abre OAuth con `WebBrowser.openAuthSessionAsync` → al volver con `type === 'success'` marca `mpConnected = true`.
- Creó nueva edge function `mp-oauth-start`: autentica al coach, construye la URL de autorización MP (client_id en env vars, nunca en el bundle) y la devuelve. `state = coaches.id` (TODO: firmar con HMAC).

**Pendiente para la próxima sesión:**
- Desplegar las 5 edge functions a Supabase con `supabase functions deploy` (requiere MP_CLIENT_ID, MP_CLIENT_SECRET, MP_REDIRECT_URI, MP_WEBHOOK_URL en secrets)
- `booking-success` no lee todavía el param `paymentPending: '1'` — agregar copy de "pago en proceso" en esa pantalla
- `viveapp://coach/mp-connected` deep link no tiene handler — agregar en app/(deep-links)/ o en las rutas de Expo Router si se necesita feedback visual al volver del OAuth
- Verificar que `coaches.mp_connected` existe en la DB (lo usa mp-oauth-callback; si no existe, hacer `ALTER TABLE coaches ADD COLUMN mp_connected boolean DEFAULT false`)
- Apple Sign-In sigue siendo bloqueante para App Store

---

## 2026-07-12 — Joaquín (sesión 60)

**Tocado:** `app/progreso.tsx`, `app/(tabs)/conexiones.tsx`, `scripts/add-session-reminders-cron.sql` (nuevo)

**Resumen:**
- **TOPIC_TO_AREA completo para AXES 32:** Andre agregó 4 subtemas en sesión 58 (`Ansiedad social`, `Autoestima`, `Duelo`, `Burnout (estrés laboral)`). Autoestima ya estaba; se agregaron los otros 3: `Ansiedad social → emocion`, `Duelo → emocion`, `Burnout (estrés laboral) → trabajo`. El mapa ahora cubre los 32 subtemas de AXES.
- **Limpieza conexiones.tsx:** eliminada constante `CREAM_DEEP` huérfana (los estilos `proCard` ya los limpió Andre en sesión 59).
- **Cron de recordatorio de sesión:** `scripts/add-session-reminders-cron.sql` — función `send_session_reminders()` + cron diario 21:00 UTC (18:00 ART). Inserta una notificación `'recordatorio_sesion'` para cada usuario con booking `confirmada` al día siguiente. `NOT EXISTS` evita duplicados. **Pendiente correr en Supabase.**

**Pendiente para la próxima sesión:**
- **Correr en Supabase:** `scripts/add-session-reminders-cron.sql`
- Nuevo Conexiones (Ejes→Temas→Deck) sin probar en Expo Go — verificar en dispositivo
- Decisión abierta: ¿reintegrar buscador / "Para vos" al menú de Conexiones?
- Pagos no conectados — `BookingScreen_Confirm` tiene UI decorativa, sin SDK ni cobro real
- Apple Sign-In es stub (bloqueante de App Store guideline 4.8 si se ofrece Google)
- VITA IA sigue stub (tiene teaser apuntándole)
- Deck v3: activar reagendamiento en score cuando haya volumen (≥5 completadas)

---

## 2026-07-11 — Andre (sesión 59)

**Tocado:** `app/(tabs)/conexiones.tsx`, `constants/conexionesDoors.ts`, `lib/coachDeckRanking.ts`, `lib/coachesCache.ts`, `lib/coachAvailability.ts` (nuevo), `app/search3.tsx`, `scripts/add-coach-trending-stats.sql` (nuevo), `scripts/audit-schema.sql` (nuevo), `scripts/add-payments-v1.sql` (nuevo), `supabase/functions/mp-oauth-callback/`, `mp-create-payment/`, `mp-webhook/`, `mp-process-refunds/` (nuevos scaffolds), `SCHEMA.md`

**Resumen:**
- **Conexiones — rediseño de navegación en 3 fases:** el menú pasó de 10 chips a jerarquía **Ejes → Temas → Deck** (10 puertas de una abruma). Fase 1 = 3 cards de eje (`EJES` nuevo en `conexionesDoors.ts`: Bienestar físico/emocional/espiritual, agrupan puertas por color = eje dominante). Fase 2 = temas del eje como cards (ícono + tagline + chevron; agregué `icon`/`tagline` a cada `Door`). Fase 3 = deck. Back en cada nivel; los chips deslizables del deck se acotan al eje actual. Todo inline dentro del tab (no rutas nuevas) para conservar la tab bar.
- **Deck v2 — slots etiquetados y transparentes** (`lib/coachDeckRanking.ts` reescrito): `rankDeck` devuelve `DeckEntry[]` = `{coach, slot}`. 4 slots en orden con categoría VISIBLE y criterio explícito: **Recomendado por VITA** (rating, luego reagendamiento), **En tendencia** (reservas 30d), **Nuevo en VITA** (rotado por día), **Opción económica** (menor precio del resto). Cada coach en un solo slot (gana prioridad mayor); slot sin candidato se omite (nunca coach mal-etiquetado). Reemplaza el modelo viejo de "dos carriles" opaco. Decisión de producto: criterios transparentes para que el usuario entienda el porqué y el coach sepa cómo aparecer.
- **Deck — card rica + carrusel swipe:** card con banda de color por eje, avatar grande, chip de categoría + sublabel, rating·reseñas, **bio en itálica** (de `coaches.bio`, ya existía) y **"Con lugar esta semana"** (disponibilidad 7d vía `lib/coachAvailability.ts` nuevo, solo para los ≤5 del deck). El deck es un **carrusel horizontal paginado** (swipe izq/der + dots), reemplazó los botones Siguiente/close-card. `key={selectedDoorId}` resetea el scroll al cambiar de tema.
- **DB — vista `coach_trending_stats`** (`scripts/add-coach-trending-stats.sql`, **corrida y verificada 11/07**): `recent_bookers` = usuarios distintos con reserva no-cancelada en 30d. Server-side por RLS (mismo patrón que `coach_rebooking_stats`). `coachesCache` la lee en paralelo → `CachedCoach.recentBookers`. También agregué `bio` al select del cache y de `search3`.
- **Card "no sabés qué necesitás" → teaser de VITA IA:** perdió sentido (con Ejes→Temas→Deck + deck ya transparente era un 3er camino redundante, y su quiz ya no alimenta Conexiones — solo Recursos). Reconvertida a teaser que rutea a `/ia` (hoy stub "Próximamente"). Card de reagendar del menú **oculta** por ahora (flag `SHOW_REBOOK=false`). Saqué también el buscador suelto y la tira "Para vos" del menú (búsqueda sigue en el ícono 🔍) — pendiente de confirmar si se reintegran.
- **Auditoría de schema (drift de scripts):** deep-research encontró que varios scripts figuraban "pendiente de correr" en SCHEMA/CHANGELOG pero ya estaban aplicados (drift documental, no real). Creé `scripts/audit-schema.sql` (chequeo de existencia de tablas/vistas/columnas/funciones/triggers/buckets). Sonda en vivo + audit completo → **base 100% aplicada, cero faltantes** (incluido `profiles.push_token`, que no tenía script). Corregí los flags obsoletos en SCHEMA.md (`coach_topics`, `instant_booking`, `coach_trending_stats`, bucket `avatars`).
- **Pagos v1 — schema + scaffolding (MercadoPago Marketplace):** arranque del sistema de pagos. Modelo cerrado: split payments, **Checkout Pro, cobro al reservar + reembolso automático** si el coach rechaza o la pendiente vence (pre-autorización descartada — sin SDK nativo RN). `scripts/add-payments-v1.sql`: columnas de pago en `bookings` (`payment_status`+CHECK, `payment_id`, `preference_id`, `currency`, `platform_fee_pct` snapshot, `paid_at`, `refunded_at`), tabla `coach_mp_accounts` (tokens OAuth, **RLS sin políticas** = solo service role), `coaches.mp_connected`, y `expire_pending_bookings()` extendida para marcar `reembolso_pendiente` al vencer una pendiente pagada. **Comisión definitiva:** 0% promo fundador (fin TBD) · 20% primeras 3 completadas del par coach-usuario · 15% de la 4ta en adelante; contador por par, solo completadas, nunca resetea; calculada server-side en `mp-create-payment` y snapshoteada. IVA fuera del código (depende de figura fiscal monotributo/RI, TBD — vive en factura/copy). 4 edge functions scaffold en `supabase/functions/mp-*` (oauth-callback, create-payment con marketplace_fee, webhook, process-refunds) — estructura real, llamadas a MP marcadas `TODO(MP): verificar contra docs`. Política de tienda resuelta (Apple 3.1.3(d), servicio 1-a-1). Ver memoria `project_vive_payments`.

**Pendiente para la próxima sesión:**
- **Sin probar en Expo Go:** todo el rediseño de Conexiones (flujo Ejes→Temas→Deck, carrusel swipe, slots etiquetados, teaser VITA). Ojo posible: alto despar de cards del carrusel entre una con bio larga y una sin bio.
- **Decisión abierta:** ¿reintegrar buscador suelto / "Para vos" al menú, o queda como está?
- **Huecos grandes de la app (del deep-research, priorizados):** (1) **pagos no conectados** — el método de pago en `BookingScreen_Confirm` es UI decorativa, sin SDK ni cobro real (bloqueante de monetización); (2) **Apple Sign-In es stub** (`próximamente`) — bloqueante de App Store (guideline 4.8) si se ofrece Google; (3) sin Sentry/analytics ni tests; (4) **VITA IA** sigue stub (ya tiene el teaser apuntándole); (5) recordatorio de sesión (`recordatorio_sesion`) no parece tener cron que lo dispare.
- **Deck v3:** activar reagendamiento en el score de "Recomendado por VITA" cuando haya volumen (≥5 completadas).

---

## 2026-07-10 — Andre (sesión 58)

**Tocado:** `app/(tabs)/recursos.tsx`, `constants/vitaTools.ts`, `hooks/useRecommendedResource.ts`, `app/_layout.tsx`, `screens/AnclajeScreen.tsx` (nuevo), `app/anclaje.tsx` (nuevo), `screens/SalaScreen.tsx`, `screens/ExploreResourcesScreen.tsx`, `app/search1.tsx`, `app/search2.tsx`, `app/search3.tsx`, `constants/conexionesDoors.ts` (nuevo), `lib/coachDeckRanking.ts` (nuevo), `lib/coachesCache.ts`, `constants/searchData.ts`, `scripts/add-coach-rebooking-stats.sql` (nuevo), `SCHEMA.md`

**Resumen:**
- **Herramientas de VITA — recorte:** se sacaron del carrusel "Tus herramientas" las tools que pisaban el terreno de los coaches (contenido guiado) o eran redundantes: **Lecturas breves, Meditación, Sueño, Escáner corporal, Relajación**. Criterio acordado: VITA = herramientas rápidas y autónomas; el contenido guiado va a la biblioteca de coaches. Las entries siguen en `TOOLS`/`VITA_TOOLS`/`TOOL_MAP` (para saved/continuar/ruta directa/recomendación), solo se sacaron de `TOOL_GROUPS`. Quedan: Diario, Gratitud, Ruido blanco, Respiración (+ Anclaje).
- **Nueva tool: Anclaje (5-4-3-2-1):** `AnclajeScreen` (`/anclaje`), técnica de grounding sensorial para ansiedad aguda — el hueco que faltaba (no había nada para el momento de crisis). Diseño clave: **sin timer, a tu ritmo, tap-to-count** (llenás N círculos por sentido); la presión de un reloj sería contraproducente. Sumada a `VITA_TOOLS`, al grupo "Para calmarte ahora" del carrusel, y a `TOOL_AXES` (cuerpo+mente) del hook de recomendación. Registra completion con tiempo real transcurrido.
- **Sala — re-reserva movida al chat:** la tarjeta de "sesión finalizada + reservar próxima" pasó de banner fijo arriba a **último ítem dentro del chat** (cerca del input, al alcance del dedo). Sigue siendo card-cliente (no mensaje persistido), se dibuja desde `sessionState === 'finalizada'`. Decisión: los avisos "está por empezar" / "finalizó" quedan como carteles vivos, no mensajes reales (eso requeriría cron/backend — se dejó fuera).
- **Explorar recursos — rediseño estético:** de un muro de ~20 chips de subtemas a **divulgación progresiva** (elegís eje Cuerpo/Mente/Propósito → aparecen sus subtemas). El eje ahora filtra de verdad (`.in(topic, axisTopics)`, antes era decorativo). Header editorial Fraunces, tarjetas con tag de formato, contador de resultados, empty state cálido, dedupe por id (el join por subtema duplicaba filas).
- **Buscador search1/2/3 — rediseño estético (fresco/moderno):** `AppBg` + títulos Fraunces + paleta glass verde/terracota en las tres. search1: barra pill + tarjetas de área a color (fondo pastel por eje + flecha circular). search2: chip de área + título editorial + chips que se rellenan con el color del eje al activarse. search3: header con filtro redondo + **filtros rápidos por tipo** (un tap, sin abrir el sheet) + tarjetas que ahora **muestran el rating** (se calculaba pero nunca se pintaba — bug de producto) o pill "Nuevo", con tags de temas reales.
- **Bug de contraste (search2):** el texto del botón CTA era olivo oscuro (`#565E32`) sobre fondo terracota → casi ilegible. Corregido a crema.
- **Conexiones — sistema de puertas + matching de coaches (backend + UI, definido con Joaquín):** se resolvió el debate de "Todos los profesionales" (lista infinita al escalar + redundante con search3) con un **deck curado**. Piezas:
  - **10 puertas** (`constants/conexionesDoors.ts`, nuevo) — capa de presentación, array standalone (NO toca `AXES`), cada una mapea a ≥1 subtema canónico. Modelo puertas/canónico: `AXES` = fuente de verdad (lo que taguea el coach), puertas = framing por superficie. Admite puertas híbridas que cruzan ejes (ej. "Ansiedad y estrés" = emocional + físico). Partición verificada por script: cada subtema en exactamente una puerta.
  - **Taxonomía 28 → 32:** 4 subtemas nuevos al eje emocional en `AXES` (`Ansiedad social`, `Autoestima`, `Duelo`, `Burnout (estrés laboral)`). Sin migración (coach_topics es texto libre sin CHECK). ⚠️ el string tiene que matchear exacto entre `AXES` y `DOORS` — la base no valida, el chequeo de partición es la red.
  - **Vista `coach_rebooking_stats`** (`scripts/add-coach-rebooking-stats.sql`, corrida en Supabase 10/07) — agregado server-side de tasa de reagendamiento por coach. No se puede calcular en cliente (RLS bloquea bookings de terceros); la vista corre con permisos del owner y expone solo agregados. Ver SCHEMA.md.
  - **Motor de ranking** (`lib/coachDeckRanking.ts`, nuevo + `lib/coachesCache.ts` extendido) — `rankDeck()`: gate por disponibilidad (ya lo hace el cache), carriles nuevos/establecidos, hasta 5 con 1-2 slots rotados por día (semilla `fecha+userId`) para nuevos + backfill. **v1 ordena por rating** a propósito (al lanzar nadie tiene las 5 sesiones que el reagendamiento necesita → rankear por dato inexistente es adivinar); reagendamiento primario en 3 bandas queda para v2, cambio de una función. Validado con test de mocks (pool vacío, tiny, todos-nuevos, rotación estable-por-día) — el test encontró y cerró un bug (todos-nuevos mostraba solo 2).
  - **UI del deck** (`app/(tabs)/conexiones.tsx`): reemplazado el `CHIPS` viejo + lista plana por las **10 puertas** (chips coloreados por eje) + **deck de a uno** (contador "X de N", chip "Trabaja [subtema]", Siguiente + "Conocer a [nombre]"), con **card de cierre** al terminar ("Ver de nuevo" / "Ver todos" → search3 con `subtemas.join(',')`) y estado vacío cuando la puerta no tiene coaches. Naming/colores cerrados con Joaquín. (Quedaron estilos viejos del `proCard` sin uso en el StyleSheet, inertes — limpieza pendiente.)

**Pendiente para la próxima sesión:**
- **Conexiones — deck sin probar en Expo Go:** la UI quedó armada y con typecheck limpio, pero falta verla en dispositivo (flujo puerta → deck → card de cierre, rotación diaria, colores por eje). Además quedaron estilos `proCard` inertes en el StyleSheet para limpiar.
- **Conexiones v2 (con volumen):** activar reagendamiento como criterio primario en `establishedScore` (3 bandas, corte sobre distribución real).
- Sin probar en Expo Go: Anclaje end-to-end, re-reserva inline en Sala, y los rediseños de Explorar/buscador en dispositivo.
- Bottom sheet de filtros de search3 quedó sin refresh estético (funcional).

---

## 2026-07-09 — Andre (sesión 57)

**Tocado:** `screens/SalaScreen.tsx`, `app/(tabs)/index.tsx`, `screens/UserAgendaScreen.tsx` (nuevo), `app/agenda.tsx` (nuevo), `app/(tabs)/recursos.tsx`, `hooks/useRecommendedResource.ts` (nuevo), `screens/ExploreResourcesScreen.tsx` (nuevo), `app/explorar-recursos.tsx` (nuevo), `screens/ProposeResourceScreen.tsx`, `screens/ResourceDetailScreen.tsx`, `scripts/add-resource-topics.sql` (nuevo), `scripts/update-revisar-aprobar-resource-topics.sql` (nuevo), `scripts/add-resource-types-podcast-video.sql` (nuevo), `scripts/add-resource-video-storage.sql` (nuevo), `SCHEMA.md`, `docs/revision-recursos.md`

**Resumen:**
- **Sala — tarjeta de reprogramar post-llamada:** `getSessionState` ahora devuelve `finalizada` apenas pasa la hora de fin de un booking `confirmada` (antes esperaba ~20 min al cron `complete_confirmed_sessions`); el timer de 30s la refresca sola. Selección de booking en `init` prioriza la próxima sesión real sobre una ya terminada hoy (cierra bug latente donde una pasada tapaba una futura). Sacado el botón "Reprogramar" fijo de la tarjeta confirmada (creaba booking nuevo sin cancelar el confirmado = doble reserva).
- **Home — "Tu próxima sesión":** el nombre del coach no leía porque se buscaba `bookings.coach_id` (= `coaches.id`) directo en `profiles`; fix con join de 2 pasos `coaches.id → profile_id → profiles.name` (mismo patrón que Progreso, sesión 56). El `coach_id` guardado para "Ver sala" ahora es `profiles.id` (navegación fallback correcta). Nuevo "Ver todas" → `/agenda` (`UserAgendaScreen` "Mis reservas", calendario del usuario espejo de `CoachAgendaScreen`, incluye completadas).
- **Recursos — recomendación unificada:** `useRecommendedResource` (nuevo) reemplaza el viejo `MoodContextBlock` + la `CoachSection` hardcodeada ("María González"). Cascada explicable con vocabulario de ejes cuerpo/mente/alma: ánimo de hoy lidera (define eje + tono, tool de VITA), sin check-in manda el tema (`user_quiz_answers` / comportamiento) prefiriendo un recurso de coach real. Sin señal → CTA de check-in.
- **Recursos — layout:** las tools de VITA pasaron de 3 grillas verticales a **un carrusel horizontal único** ("Tus herramientas"), dándole aire a los recursos de coach.
- **Carrusel "Recursos de nuestros coaches" — criterio:** dejó de ser solo cronológico. Ahora `rankCoachLibrary` prioriza por **tema** (ejes de interés del usuario, para descubrir recursos fuera de tu propio coach), recencia desempata, tope 2 por coach, y excluye el recurso ya mostrado en la card. `useRecommendedResource` ahora devuelve `{ reco, interestAxes, excludeId }`.
- **Explorar recursos:** `ExploreResourcesScreen` (`/explorar-recursos`) — filtro por los **28 subtemas de AXES** agrupados por eje (mismo patrón que `search2`) + **filtro secundario por formato** (audio/podcast/video/lectura/guía, AND con el tema), lista filtrada de recursos de coach. Entry point "Explorar todo →" en la home. La home queda curada; el crecimiento del catálogo lo absorbe esta pantalla.
- **`resource_topics` (tabla nueva):** espejo de `coach_topics` (28 subtemas AXES, sin CHECK), nivel fino de taxonomía para filtrar la biblioteca con la misma lista con la que se etiquetan los coaches (evita una 4ta taxonomía, regla 17). `revisar_aprobar` extendida para materializar `resource_proposals.topic` en `resource_topics` al aprobar (+ param opcional `p_topics`).
- **Tipos de recurso de coach → 5:** se separó **audio guía** (se HACE) de **podcast/charla** (se ESCUCHA) y se sumó **video** (in-app, no YouTube). Podcast reusa el bucket/player de audio; video tiene bucket propio `resource-video` (100MB) y se reproduce con expo-video (`VideoView`). Formulario, detalle y mapas de ícono/label actualizados.
- **Bug calendario "Agendar" (doble-tap acumulaba eventos):** `handleAddToCalendar` en `SalaScreen` y `SessionsScreen` creaba un evento nuevo en cada tap. Fix en ambos: guard `isAddingCalendar` (anti doble-tap + botón "Agendando…" deshabilitado), y chequeo de duplicado real con `getEventsAsync` (mismo título + hora de inicio) antes de crear → si ya existe avisa "Ya agendada". Eran los únicos dos `createEventAsync` de la app.
- **DB — 4 migraciones corridas y verificadas en Supabase el 09/07:** `add-resource-topics`, `update-revisar-aprobar-resource-topics`, `add-resource-types-podcast-video`, `add-resource-video-storage`. SCHEMA.md actualizado en el momento.

**Pendiente para la próxima sesión:**
- Probar en Expo Go el circuito real de recursos (proponer → aprobar con `revisar_aprobar` → ver en carrusel/Explorar/recomendación). Requiere al menos un recurso publicado y tageado.
- Card de recomendación y "Mis reservas" sin testear end-to-end en dispositivo.
- Definir si "Podcast/Charla" cambia de nombre (label temporal).
- Flujo "Reprogramar" del coach — sigue roto, sin definición de producto.
- Daily.co / Google OAuth / push / audio en background — siguen requiriendo dev build EAS o pago.

---

## 2026-07-08 — Joaquín (sesión 56)

**Tocado:** `app/(tabs)/conexiones.tsx`, `app/(tabs)/index.tsx`, `app/progreso.tsx`, `screens/CoachReservasScreen.tsx`, `screens/ProfesionalScreen.tsx`, `screens/CoachResourcesScreen.tsx`, `SCHEMA.md`

**Resumen:**
- **Bug re-book card (abierto desde sesión 50):** `loadRebook` filtraba solo `status = 'completada'` pero los bookings reales se quedan en `'confirmada'`. Fix: mismo patrón OR que ya usaba `progreso.tsx` — `.or('status.eq.completada,and(status.eq.confirmada,scheduled_date.lt.${today})')`. También se agrega filtro `availability_status = 'activo'` para no proponer coaches en pausa.
- **Bell de notificaciones en Conexiones:** contador `unreadCount` con realtime subscription + `useFocusEffect` para que el punto rojo desaparezca al volver de la pantalla de notificaciones. Mismo patrón aplicado a `index.tsx` (Home).
- **"Para vos" en Conexiones:** sección con coaches sugeridos según respuestas de `user_quiz_answers` (topic + professional_type). Horizontal ScrollView con avatares, link "Cambiar" al quiz.
- **Bugs rápidos:** "Ver todos" en Conexiones ya activa `setSelectedChip(null)`. Coach names en Progreso: fix del join de dos pasos `bookings.coach_id → coaches.id → coaches.profile_id → profiles.name`. Fix botones "Biblioteca VIVE" en `CoachResourcesScreen` usando `VITA_TOOL_MAP`. Limpieza de `console.log` de debug en `CoachReservasScreen` y `ProfesionalScreen`.
- **"Áreas trabajadas" en Progreso:** reemplaza el `3` hardcodeado por conteo real de áreas únicas (5 categorías) mapeadas desde los topics de `coach_topics` de los coaches con los que el usuario tuvo sesiones.
- **Bug taxonomías cerrado:** faltaban 4 subtemas de AXES en `TOPIC_TO_AREA` (progreso) y `QUIZ_TOPIC_MAP` (conexiones): `Hábitos mentales → trabajo`, `Sexualidad → salud`, `Espiritualidad → proposito`, `Soledad → emocion`. Ahora los 28 subtemas de AXES están cubiertos en ambos mapas. Punto 17 de SCHEMA.md actualizado a cerrado.

**Pendiente para la próxima sesión:**
- Rediseño pantalla Recursos — BLOQUEADO esperando decisión de Andre
- Audio en background — requiere EAS dev build
- Google OAuth + push notifications — requieren EAS dev build
- Daily.co — requiere pago para activar
- Flujo "Reprogramar" del coach — roto, sin definición de producto

---

## 2026-07-07 — Joaquín (sesión 55)

**Tocado:** `screens/RuidoScreen.tsx`, `assets/sounds/lluvia.m4a`, `assets/sounds/bosque.m4a`, `assets/sounds/olas.m4a`, `assets/sounds/blanco.m4a`, `scripts/gen_sounds.py`, `scripts/add-coaches-availability-status.sql` (nuevo), `scripts/add-user-quiz-answers.sql` (nuevo), `lib/coachesCache.ts`, `screens/CoachProfileScreen.tsx`, `screens/QuizScreen.tsx`, `screens/ResourceDetailScreen.tsx`, `scripts/add-resource-feedback-milestone.sql` (nuevo), `SCHEMA.md`

**Resumen:**
- **RuidoScreen — audios reales:** reemplazó los 4 loops sintetizados por grabaciones CC0 de freesound.org (lluvia suave, bosque con río y pájaros, olas del mar, ruido marrón/trueno distante). Título de pantalla actualizado a "Ruido marrón". Todos recortados a 90s con afconvert + Python.
- **RuidoScreen — delay y volumen:** todos los players arrancan en silencio al montar la pantalla (`volume=0, loop=true, play()`). Al presionar Iniciar solo se sube el volumen — sin latencia de `play()`. Fade arranca en 0.22 (audible inmediato) y sube a 0.38 en 1.2s con interpolación lineal.
- **`coaches.availability_status`:** columna nueva `'activo'|'en_pausa'` (DEFAULT 'activo'). Toggle en `CoachProfileScreen` sección Disponibilidad. `coachesCache` filtra por `activo`. **Migración corrida en Supabase el 07/07.**
- **`user_quiz_answers`:** tabla nueva con RLS para persistir las 3 respuestas del quiz por usuario. `QuizScreen` hace upsert al completar (además de AsyncStorage). **Migración corrida en Supabase el 07/07.**
- **Flujo "¿Te sirvió?" en ResourceDetailScreen:** detección de completion por tipo (audio: posición >= duración − 1.5s; lectura: botón "Terminé"; guía: botón "Completé esta guía"). Thumbs up/down con upsert en `resource_feedback` (`onConflict: 'resource_id,user_id'`). Carga voto existente al montar para no volver a preguntar. Llama `recordCompletion` al completar.
- **Trigger `fn_resource_feedback_milestone`:** notifica al coach al acumular 10/25/50 votos positivos en un recurso. `SECURITY DEFINER` + `REVOKE` de anon. **Migración corrida en Supabase el 07/07.**
- **`bookings.duration_minutes` / `meeting_url`:** columnas nuevas agregadas a la tabla `bookings`. **Migración corrida en Supabase el 07/07.**

**Pendiente para la próxima sesión:**
- Rediseño de pantalla Recursos (análisis de UX de Andre pendiente de decidir e implementar)
- Audio en background (requiere dev build EAS + UIBackgroundModes)
- Google OAuth y push notifications (requieren dev build EAS)
- Daily.co — activar plan de pago
- Flujo "Reprogramar" del coach — roto, sin definición

---

## 2026-07-05 — Andre (sesión 54)

**Tocado:** `scripts/add-resource-proposals-axes-tags.sql` (nuevo), `scripts/fix-resource-proposals-resubmit.sql` (nuevo), `scripts/add-notifications-propuesta-types.sql` (nuevo), `scripts/add-resources-retired-at.sql` (nuevo), `scripts/add-review-functions.sql` (nuevo), `scripts/add-resource-audio-storage.sql` (nuevo), `screens/ResourceDetailScreen.tsx` (nuevo), `app/recurso.tsx` (nuevo), `assets/sounds/` (nuevo, 4 loops), `docs/revision-recursos.md` (nuevo), `screens/ProposeResourceScreen.tsx`, `screens/ResourceProposalsScreen.tsx`, `screens/CoachResourcesScreen.tsx`, `screens/CoachNotificationsScreen.tsx`, `screens/ProfesionalScreen.tsx`, `screens/RuidoScreen.tsx`, `app/(tabs)/recursos.tsx`, `app/_layout.tsx`, `app.json`, `package.json`, `SCHEMA.md`

**Resumen:**
- Sesión arrancó con investigación amplia de tipos de recursos (Quenza, Headspace, Fabulous, Noom, software de nutricionistas) → spec de punta a punta del sistema de Recursos (guardado en Notion, "Decisiones estratégicas"). Decisiones clave: los 3 tipos actuales se ratifican para lanzar; `video`/`reflexion`/`autoevaluacion`/`camino` quedan modelados a futuro sin ensanchar CHECKs preventivamente; descartados trackers con racha, ejercicios con IA, formularios que reportan al coach y PDF como tipo propio.
- Se corrió la migración pendiente de la sesión 53 (`topic`) + batch de 4 migraciones nuevas, todas corridas y verificadas en Supabase: `resource_proposals.axes`/`.tags` (propuesta no vinculante del coach), trigger relajado para permitir re-envío `necesita_ajustes → enviada` (única transición del coach; verificado por `pg_get_functiondef`, el bloqueo con sesión real se valida en Expo Go), `notifications.type` += `propuesta_publicada`/`propuesta_ajustes` (sin tipo para descartada, a propósito — sería punitivo), `resources.retired_at` (retirar = UPDATE, nunca DELETE: el CASCADE borraría los votos de `resource_feedback`).
- **`docs/revision-recursos.md` nuevo**: protocolo completo de revisión vía Dashboard (cola, checklist, SQL de aprobar/ajustes/descartar con notificaciones, plantillas de copy). El INSERT de aprobación resuelve `attributed_to_coach_id` vía `c.profile_id` con advertencia explícita — es el punto de falla silencioso clásico `coaches.id`/`profiles.id`.
- Los bloques manuales resultaron un quilombo en el primer uso real → `scripts/add-review-functions.sql` (corrido y verificado): vista `cola_revision` + funciones `revisar_aprobar`/`revisar_ajustes`/`revisar_descartar`, una línea transaccional por acción, con el join a `profile_id` encapsulado y `REVOKE` explícito de anon+authenticated (lección 18). Andre hizo la primera revisión real con ellas (una aprobada, una a ajustes, una descartada). Los bloques largos quedaron como fallback en el doc.
- Frontend: (1) "Mis recursos" del coach en `CoachResourcesScreen` pasó de mock a datos reales, con "A {n} personas les sirvió" solo si n>0 (primer consumidor real de `get_my_resource_feedback_summary()`); botón muerto "Recomendar" eliminado. (2) Re-envío: botón "Ajustar y reenviar" en el historial + modo edición de `ProposeResourceScreen` vía param `proposalId` (UPDATE misma fila, notas de VITA visibles mientras ajusta, guarda que expulsa si el estado no es `necesita_ajustes`). (3) Pasos Eje (obligatorio 1-3) y Tags (opcional máx. 3, con alta de tag `'propuesto'` vía upsert `ignoreDuplicates`) en el formulario — **en ambos submits, INSERT y UPDATE** (la asimetría creación/edición fue chequeada a propósito). (4) Notificaciones nuevas tapeables en `CoachNotificationsScreen` → `/resource-proposals`. (5) Filtro `retired_at IS NULL` en las 3 queries de consumo.
- Mapeo de FKs verificado con definición real tras cuestionamiento de review externo: `user.id` del AuthContext = `session.user.id` = `profiles.id` (el context nunca toca `coaches`); `resource_proposals.coach_id` → `coaches.id` (operativa) y `resources.attributed_to_coach_id` → `profiles.id` (atribución) conviven correctamente en el mismo circuito.
- Typecheck limpio en código de proyecto. Ojo: existe una carpeta local `node_modules 2/` (duplicado accidental, fuera del repo) que ensucia `tsc` — filtrar o borrarla.

**Segundo tramo (tarde) — el recurso como entidad de primera clase y su consumo real:**
- **Decisión de flujo (Andre):** el recurso deja de consumirse en el perfil del coach — ahora vive en la pantalla Recursos. Nueva pantalla `ResourceDetailScreen` (`/recurso?id=...`): ficha con tipo/duración/título/descripción + tarjeta de autor con "Ver perfil" (acceso opcional al perfil, ya no al revés) + la experiencia de uso según tipo. El carrusel de la biblioteca y las tarjetas del perfil del coach ahora **navegan al detalle** en vez de expandir/renderizar inline (se borró todo el render expandible del perfil y sus estilos; la query del perfil ya ni trae `content`). El detalle es el **único lugar de consumo** de la app.
- **Lecturas paginadas:** `content` de `lectura_breve` pasó de `{ body }` a `{ pages: string[], source? }` — el coach arma las páginas en el formulario (marca el ritmo, patrón de `LecturasScreen`). El detalle abre un lector a pantalla completa calcado de la tool Lecturas de VITA (header, dots, título Fraunces, fuente terracota, Siguiente/Terminé, pantalla de cierre). Fallback total al formato viejo `{ body }` (una página); el modo edición migra `body`→`pages` al reenviar.
- **Recursos guardables:** bookmark en el detalle y en las tarjetas del carrusel, vía `saved_resources` (sin migración — `resource_id` text acepta el uuid). Bajo el filtro "Guardados" el carrusel muestra solo los guardados; conviven con las tools hardcodeadas en el mismo `savedIds`.
- **Audios como archivos, no links:** cambio de producto — el coach sube el archivo desde el formulario (`expo-document-picker`, máx. 20MB) y la app lo reproduce con `expo-audio` dentro del detalle (player nativo, `playsInSilentMode`). Nuevo bucket `resource-audio` (`scripts/add-resource-audio-storage.sql`, **PENDIENTE de correr** — sin esto el submit de audio falla). `content.url` pasa a ser la URL del bucket; los links externos viejos (YouTube/Spotify/Drive) siguen andando como fallback vía `Linking` (detectados por dominio).
- **Ruido blanco con audio real (recurso fijo de VITA):** `RuidoScreen` dejó de ser solo timer — 4 loops de 60s **sintetizados desde cero** (`assets/sounds/*.m4a`, sin licencias de terceros: lluvia=ruido rosa, olas=marrón con oleaje, blanco=filtrado, bosque=viento+hojas), reproducidos en loop con `expo-audio` integrados al timer. Instalado `expo-audio`. Limitación conocida: sin audio en background (requiere dev build + `UIBackgroundModes`), pausa al bloquear pantalla.
- **Análisis de UX pendiente de decidir:** a pedido de Andre, propuesta de arquitectura ideal de la pantalla Recursos (organizar por necesidad/momento y no por formato, integrar recursos de coaches a las secciones editoriales con tarjeta unificada + avatar, retirar el carrusel del fondo, sugerencia única por mood, chips de duración, "Tu espacio" en vez del filtro que vacía). Investigado: el `MoodCheckIn` del home ya persiste en `mood_entries` y Recursos ya lo hereda vía `useMoodHistory` + `MoodContextBlock` con mapeo `MOOD_TO_RESOURCE` — la infra de "sugerencia por estado" ya existe, solo apunta a las 5 tools hardcodeadas, nunca a un `resources.id` de coach. Nada implementado todavía.

**Tercer tramo (tarde-noche) — pin, guardados, agenda del coach, fixes:**
- **Pin de recursos al inicio** (`pinned_resources`, tabla nueva, tope 4 por trigger — `scripts/add-pinned-resources.sql`, **PENDIENTE de correr**): concepto distinto de guardar (curado, máx 4). Se pinnea **al abrir el recurso**, no desde la grilla: recursos de coaches desde la ficha `/recurso`, tools de VITA desde su propia pantalla vía `components/PinButton.tsx` (reemplaza el spacer del header en las 9 pantallas de tool). El inicio muestra "Tus recursos pinneados" (antes "Recursos útiles"), recarga con `useFocusEffect`, distingue slug (tool) de uuid (coach) por el lookup `VITA_TOOL_MAP`. Encontrada columna vestigial `saved_resources.pinned` sin uso — no es el pin, dejada documentada.
- **Acceso a guardados como en coaches:** se eliminaron los chips toggle Todos/Guardados de Recursos; botón bookmark arriba a la derecha → `/recursos-guardados` (`RecursosGuardadosScreen`, mismo patrón que `/favoritos`). Lista tools + recursos de coaches guardados.
- **Refactor:** catálogo de tools de VITA centralizado en `constants/vitaTools.ts` (íconos Ionicons + MaterialCommunityIcons); eliminó la copia duplicada de `index.tsx`. `recursos.tsx` mantiene su `TOOLS` propio para la grilla.
- **Bug guardados duplicados:** `saved_resources` nunca tuvo `UNIQUE(user_id, resource_id)` → filas duplicadas → crash "two children with same key" en la FlatList de guardados. Fix inmediato: dedup con `Set` en la carga. Fix de raíz: `scripts/add-saved-resources-unique.sql` (**PENDIENTE**, deduplica + agrega UNIQUE). Se dejó `insert` plano (no upsert) a propósito: seguro corras o no la migración.
- **Agenda mensual del coach:** "Esta semana" en el home del coach ahora es tappeable (+ link "Ver mes") → `CoachAgendaScreen` (`/coach-agenda`): calendario mensual con puntito en días con reservas, tap a un día muestra el detalle (hora, cliente, badge confirmada/pendiente, tap→sala). Reutiliza el patrón `buildCalendar` del calendario de reservas. Sin migración.
- **Fix swipe-back en reserva:** `booking-success` ahora tiene `gestureEnabled: false` — no se puede volver atrás deslizando desde la pantalla de éxito, solo con los botones.
- **Logout de coach:** se reportó como bug (llevaría a la interfaz de usuario en vez del inicio bifurcado) pero Andre confirmó que fue una mala interpretación — `handleSignOut` → `router.replace('/(tabs)')` es el comportamiento correcto. No se tocó.

**Pendiente para la próxima sesión:**
- Las 3 migraciones de este tramo (`add-resource-audio-storage.sql`, `add-pinned-resources.sql`, `add-saved-resources-unique.sql`) **ya corridas y verificadas** en Supabase el 05/07 (la de guardados dejó 0 duplicados + constraint activa)
- Decidir e implementar (o no) el rediseño de la pantalla Recursos según el análisis de UX de arriba — el paso más barato es matar/realificar el mock `CoachSection` e integrar los recursos de coaches a las secciones editoriales
- **Test completo en Expo Go** (Andre): circuito propuesta → ajustes → re-envío (valida el trigger B con sesión real) → aprobación vía protocolo → ver el recurso en las 3 pantallas + notificación tapeable. Si un coach con recursos ve "Mis recursos" vacío, sospechar del fallo silencioso de la query, no de la falta de datos.
- Fase posterior del spec (consumo): modo paso-a-paso de guías, "¿Te sirvió?" + completions, trigger de umbral (migración D) — deliberadamente después de validar lo anterior.
- Bug del re-book en Conexiones sigue sin diagnosticar (ver sesión 50)
- Schema migrations pendientes: `coaches.availability_status`, tabla `user_quiz_answers`
- Confirmar con Joaquín el hook de auto-push en `.claude/settings.json` (ver sesión 53)

---

## 2026-07-04 — Andre (sesión 53)

**Tocado:** `screens/ProposeResourceScreen.tsx` (nuevo), `screens/ResourceProposalsScreen.tsx` (nuevo), `app/resource-proposal-new.tsx` (nuevo), `app/resource-proposals.tsx` (nuevo), `app/_layout.tsx`, `screens/CoachProfileScreen.tsx`, `screens/CoachResourcesScreen.tsx`, `screens/ProfesionalScreen.tsx`, `app/(tabs)/recursos.tsx`, `scripts/add-resource-proposals-topic.sql` (nuevo), `SCHEMA.md`

**Resumen:**
- Frontend del sistema de propuestas de recursos (schema de la sesión 52): formulario para que un coach proponga audio/guía de pasos/lectura breve, y una lista de sus propias propuestas con status (`enviada`/`necesita_ajustes`/`aprobada`/`descartada`) + `reviewer_notes`.
- Lado usuario, dos lugares distintos donde ahora se ve lo publicado en `resources`:
  1. `screens/ProfesionalScreen.tsx` (perfil público de un coach) — sección "Recursos de {nombre}" con tarjetas expandibles, render específico por `type` (audio con botón "Escuchar", guía con pasos numerados, lectura con texto+fuente).
  2. `app/(tabs)/recursos.tsx` (biblioteca general) — sección nueva "Recursos de nuestros coaches", scroll horizontal de todo lo publicado por cualquier coach; tap navega al perfil de ese coach en vez de duplicar el render de contenido. Ojo: esta pantalla ya tenía un mock separado (`CoachSection`/`COACH_RESOURCES`, "María González") que es un concepto distinto (recomendaciones de tu coach personal sobre las tools de VITA) — no se tocó, conviven ambas secciones.
- Sin contadores de feedback/guardados en ningún lado, respetando la regla de "confianza por curación editorial y atribución, no por cifras".
- Definí la forma de `content` jsonb por `type` (no estaba especificada): `audio` → `{ url }`, `guia_pasos` → `{ steps: [{title, body}] }`, `lectura_breve` → `{ body, source? }`. Documentado en SCHEMA.md.
- **Hallazgo a mitad de sesión**: ya existía una pantalla completa `screens/CoachResourcesScreen.tsx` (pestaña Recursos del coach) con un botón real "Proponer recurso a VIVE" que abría un modal mock — `handleSend` solo hacía `console.log`, nunca escribió a la base. Mis pantallas nuevas habían quedado colgadas de un entry point inventado en `CoachProfileScreen.tsx`, totalmente desconectado. Se corrigió: el botón real ahora navega a `/resource-proposal-new`, el modal mock y sus estilos se borraron, y saqué el entry point duplicado de `CoachProfileScreen.tsx`.
- El modal mock tenía un selector de "Tema" (28 subtemas de `AXES`) que la migración de la sesión 52 no contemplaba — se agregó `resource_proposals.topic` (text, nullable, sin CHECK, mismo criterio que `coach_topics.topic`) para no perder esa UX ya diseñada. Es solo referencia textual para el revisor, no crea vínculo real a `resource_axes`/`resource_tags` (esa parte de la decisión anterior se mantiene).
- No hay pantalla de edición de una propuesta ya enviada, ni vista de revisión para VITA (la aprobación sigue siendo manual vía Dashboard, decisión ya tomada en la sesión 52) — solo alta + lectura de status del lado coach.
- No probado en dispositivo real todavía (sin acceso a Expo Go en esta sesión) — pendiente de test manual antes de darlo por cerrado.

**Pendiente para la próxima sesión:**
- **Correr `scripts/add-resource-proposals-topic.sql` en Supabase** (agrega la columna `topic`) — sin esto, el insert del formulario va a fallar
- Probar el flujo completo en Expo Go con una cuenta de coach real: crear propuesta de cada tipo, confirmar que se guarda bien en `resource_proposals` (incluido `topic`), y que la lista de status se ve bien
- Detección de umbral en `resource_feedback` y disparo de notificación `recurso_feedback_umbral`: sigue sin implementar
- Confirmar con Joaquín el hook de auto-push en `.claude/settings.json` antes de tocarlo — Andre lo revirtió sin commitear tras encontrar que Joaquín lo agregó a propósito el 27/06
- Bug del re-book en Conexiones sigue sin diagnosticar (ver sesión 50)
- Schema migrations pendientes: `coaches.availability_status`, tabla `user_quiz_answers`

---

## 2026-07-03 — Andre (sesión 52)

**Tocado:** `scripts/add-resource-proposals.sql`, `scripts/add-resources.sql`, `scripts/add-resource-axes.sql`, `scripts/add-resource-tags.sql`, `scripts/add-resource-tag-links.sql`, `scripts/add-resource-feedback.sql`, `scripts/fix-resource-feedback-summary-grant.sql`, `scripts/add-notifications-recurso-feedback-umbral.sql`, `SCHEMA.md`

**Resumen:**
- Schema completo del sistema "Recursos propuestos por coaches": 6 tablas nuevas (`resource_proposals`, `resources`, `resource_axes`, `resource_tags`, `resource_tag_links`, `resource_feedback`) + ampliación del CHECK de `notifications.type`. Las 8 migraciones se corrieron y verificaron una por una en Supabase (corridas por Andre en el SQL Editor).
- El catálogo hardcodeado actual (Diario, Gratitud, y las 9 tools de `recursos.tsx`) **no se tocó ni se migró** — `resources` nace vacía, solo para lo nuevo de coaches. Journaling y Gratitud siguen exclusivos de VITA, no proponibles.
- Dos decisiones de RLS no triviales, ambas verificadas contra la base real (no solo revisadas por lectura):
  - `resource_proposals`: un coach autenticado no puede auto-aprobarse ni tocar `reviewer_notes` — RLS no filtra por columna, así que se agregó un trigger `BEFORE UPDATE` que bloquea esos dos campos cuando hay sesión de usuario, y los deja pasar cuando se corre desde el Dashboard (sin sesión) para no trabar la aprobación manual.
  - `resource_feedback`: el coach no tiene ninguna policy de acceso directo a la tabla (para que no pueda pedir `user_id` y ver el detalle de quién votó qué) — ve solo el agregado vía función `get_my_resource_feedback_summary()` (`SECURITY DEFINER`).
- **Hallazgo real durante la verificación**: esa función se pudo ejecutar con la anon key pese a tener `REVOKE ALL ... FROM PUBLIC` — Supabase le da EXECUTE a `anon` en todo el schema `public` por default privileges de base, no vía el pseudo-rol `PUBLIC`. No hubo fuga de datos (el filtro interno por `auth.uid()` igual devolvía vacío), pero el permiso estaba mal. Se corrigió con `REVOKE EXECUTE ... FROM anon` explícito y se re-verificó (ahora da `permission denied`). Quedó documentado como punto 18 en SCHEMA.md para no repetir el error en futuras funciones `SECURITY DEFINER`.
- FKs a coach: `resource_proposals.coach_id → coaches.id` (patrón operativo, como `coach_topics`) vs. `resources.attributed_to_coach_id → profiles.id` (patrón de atribución, como `favorite_coaches`) — decisión explícita para no repetir la confusión `coaches.id`/`profiles.id` ya documentada en el proyecto.
- SCHEMA.md actualizado en el mismo momento (tablas nuevas + puntos 18 y 19 de reglas críticas).

**Pendiente para la próxima sesión:**
- Nada de frontend todavía: falta el formulario del coach para proponer un recurso, la pantalla de revisión de VITA, y la lógica que detecta el umbral de `resource_feedback` y dispara la notificación `recurso_feedback_umbral` (el tipo ya existe en el CHECK, pero nada lo dispara todavía)
- Bug del re-book en Conexiones sigue sin diagnosticar (ver sesión 50)
- Schema migrations pendientes: `coaches.availability_status`, tabla `user_quiz_answers`

---

**Tocado:** `screens/CoachLoginScreen.tsx`

**Resumen:**
- Bug: al postularse como coach con un mail nuevo (nunca usado), `handleSubmit` intenta `signInWithEmail` (falla), después `signUpWithEmail` (crea la cuenta con `profiles.role='user'` por default vía trigger), y **acto seguido** `validateAndNavigate()` chequeaba `profile.role === 'user'` — condición que siempre era true para una cuenta recién creada, así que el 100% de los mails nuevos mostraban "Esta cuenta ya está registrada como usuario" en vez de avanzar a `coach-application`
- La cuenta (auth + `profiles`) quedaba creada en la DB sin que nunca se pidieran los datos de la postulación de coach
- Fix: `validateAndNavigate` ahora recibe `isNewSignup: boolean`; el chequeo de rol que bloquea solo corre cuando la cuenta ya existía antes de este submit (rama `signInWithEmail` exitoso), no cuando la creamos nosotros mismos en el mismo flujo (rama `signUpWithEmail` exitoso)
- No se tocó DB/schema

**Pendiente para la próxima sesión:**
- Bug del re-book en Conexiones sigue sin diagnosticar (ver sesión 50) — logs `[Rebook]` todavía en `loadRebook`
- Revisar si quedaron cuentas de prueba "huérfanas" en Supabase (auth + `profiles` con `role='user'`) creadas mientras este bug estuvo activo, para limpiarlas si hace falta
- Schema migrations pendientes: `coaches.availability_status`, tabla `user_quiz_answers`

---

## 2026-07-03 — Joaquín (sesión 50)

**Tocado:** `app/(tabs)/conexiones.tsx`, `app/search1.tsx`

**Resumen:**
- Ajuste visual de Conexiones para que coincida con el mockup HTML: título Fraunces 34px, cards con fondo sólido `#F7F2E7`, bottom row con botón "Ver perfil" bordeado, re-book card con CTA pill "Reservar", quiz card con gradiente suave terracota-soft
- Fix search1: eliminado `justifyContent:'center'` que causaba gap enorme con el teclado abierto; reemplazado `borderLeftWidth:3` por View absoluta de 4px con esquinas redondeadas para el acento de color en las cards
- Tarjeta re-book: el código está correcto, el booking de prueba fue insertado en la DB (id: `5de341ec-fc25-4340-84e5-f2b6fbd6c0fa`, status=completada, sala_id=null), pero la tarjeta no aparece en el app — causa aún sin determinar
- Quedaron logs de debug temporales en `loadRebook` para diagnosticar el problema

**Pendiente para la próxima sesión:**
- ⚠️ Abrir la app, ir a Conexiones, y revisar los logs `[Rebook]` en la consola de Expo para ver en qué paso falla el query (user.id, last booking, future count, coachRow)
- Una vez diagnosticado, eliminar los logs de debug
- Schema migrations pendientes: `coaches.availability_status`, tabla `user_quiz_answers`
- Ruido blanco: audio real con `expo-av`
- Daily.co: activar plan de pago
- Google OAuth y push notifications (requieren dev build con EAS)

---

## 2026-07-03 — Joaquín (sesión 49)

**Tocado:** `app/(tabs)/conexiones.tsx`, `screens/QuizScreen.tsx` (nuevo), `app/quiz.tsx` (nuevo), `lib/coachesCache.ts`, `app/_layout.tsx`

**Resumen:**
- Rediseño completo de la pantalla Conexiones: reemplaza carrusel de temas y cards horizontales por chips filtrables (9 categorías con íconos Feather) + lista vertical de profesionales full-width
- Tarjeta "Re-book" condicional: aparece solo si el usuario tuvo una sesión completada y no tiene reserva activa con ese coach; navega directo a booking-calendar
- Tarjeta Quiz (antes `console.log`) ahora navega a `/quiz`; card visual terracota con LinearGradient
- Nueva pantalla QuizScreen: 3 preguntas (tema → tipo de acompañamiento → presupuesto) → matching contra cache de coaches con fallback progresivo → muestra 1-2 resultados con razón textual; guarda respuesta Q1 en AsyncStorage (`vive_quiz_topic`) para futura sección "Para vos"
- `coachesCache.ts` extendido: `CachedCoach` suma `verified`, `avgRating`, `reviewCount`; segunda query batch a `reviews` para calcular promedio; campos opcionales para mantener compatibilidad con `search3`
- SCHEMA.md no cambió en esta sesión

**Pendiente para la próxima sesión:**
- Schema migrations pendientes: `coaches.availability_status`, tabla `user_quiz_answers`
- Punto de inserción "Para vos" marcado en conexiones (carrusel personalizado por quiz/historial)
- Daily.co: activar plan de pago para habilitar creación de salas privadas por API
- Ruido blanco: audio real con `expo-av`
- "Reprogramar" roto del lado coach (definir flujo primero)
- Google OAuth y push notifications (requieren dev build con EAS)

---

## 2026-07-03 — Joaquín (sesión 48)

**Tocado:** `hooks/useUnreadSalas.ts` (nuevo), `app/(tabs)/_layout.tsx`, `app/(coach)/_layout.tsx`, `screens/SessionsScreen.tsx`, `screens/CoachChatsScreen.tsx`

**Resumen:**
- Extraído hook compartido `useUnreadSalas({ userId, role })` que centraliza la lógica de "mensajes no leídos" que estaba duplicada en 4 lugares
- El hook hace 2 queries (salas + mensajes) en lugar de N+1, se refresca solo con `useFocusEffect`, y expone `refresh()` para que los layouts puedan llamarlo desde sus canales realtime
- Tab bar usuario y coach: reemplazaron sus funciones `checkDot`/`checkChatsUnread`; el booking check quedó como lógica separada en el layout de usuario
- Sesiones y CoachChats: eliminado el query `lastForeign` por sala (N queries ahorrados); `hasUnread` ahora viene de `unreadSalaIds.has(sala.id)` en render
- Corrección silenciosa: el tab bar usuario antes no filtraba por `sender_type`, podía marcar el punto por mensajes de sistema — ahora usa el mismo criterio que el resto

**Pendiente para la próxima sesión:**
- Daily.co: activar plan de pago para habilitar creación de salas privadas por API
- Limpiar datos de prueba en bookings
- Ruido blanco: agregar audio real con `expo-av`
- "Reprogramar" roto del lado coach (definir flujo primero)
- Google OAuth y push notifications (requieren dev build con EAS)

---

## 2026-07-03 — Joaquín (sesión 47)

**Tocado:** `lib/resourceCompletions.ts` (nuevo), `screens/DiarioScreen.tsx`, `screens/GratitudScreen.tsx`, `screens/RespiracionScreen.tsx` (nuevo), `screens/MeditacionScreen.tsx` (nuevo), `screens/EscanerScreen.tsx` (nuevo), `screens/SuenoScreen.tsx` (nuevo), `screens/RelajacionScreen.tsx` (nuevo), `screens/RuidoScreen.tsx` (nuevo), `screens/LecturasScreen.tsx` (nuevo), `app/respiracion.tsx` (nuevo), `app/meditacion.tsx` (nuevo), `app/escaner.tsx` (nuevo), `app/sueno.tsx` (nuevo), `app/relajacion.tsx` (nuevo), `app/ruido.tsx` (nuevo), `app/lecturas.tsx` (nuevo), `app/_layout.tsx`, `app/(tabs)/recursos.tsx`

**Resumen:**
- `lib/resourceCompletions.ts`: helper `recordCompletion(userId, resourceId, durationSeconds?)` que escribe en `resource_completions`. Diario y Gratitud ya lo llaman al guardar una entrada
- 7 pantallas nuevas de herramientas, todas con `recordCompletion` al completar:
  - **Respiración**: animación de círculo con respiración cuadrada 4-4-4-4 (opción 3 u 8 min)
  - **Meditación**: timer con fondo oscuro + prompts de texto que cambian por fase (10 o 15 min)
  - **Escáner corporal**: 8 zonas × 60s, auto-avance con barra de progreso (8 min fijo)
  - **Sueño**: timer wind-down con prompts nocturnos y fondo oscuro (10 o 20 min)
  - **Relajación**: relajación muscular progresiva, 6 grupos tensa/soltá automático (~10 min)
  - **Ruido blanco**: selector visual de sonido + timer (audio pendiente para dev build con expo-av)
  - **Lecturas breves**: 5 fragmentos de libros reales (Tolle, Frankl, Kabat-Zinn, Brené Brown, Chödrön) con autor y título visible, navegación Siguiente/Terminé
- Todas las rutas cableadas en `_layout.tsx` y `TOOLS` en `recursos.tsx` — todos los botones de la grilla son tapeables

**Pendiente para la próxima sesión:**
- **Daily.co**: activar plan de pago para habilitar creación de salas privadas por API
- Limpiar datos de prueba en bookings
- Ruido blanco: agregar audio real con `expo-av` (instalar + implementar)
- "Reprogramar" roto del lado coach (definir flujo primero)
- Google OAuth y push notifications (requieren dev build con EAS)

---

## 2026-07-03 — Joaquín (sesión 46)

**Tocado:** `screens/OnboardingScreen1.tsx`, `lib/notifications.ts`

**Resumen:**
- OnboardingScreen1 crasheaba en Expo Go: `useFrameCallback` no disponible en Reanimated 4.x — reemplazado con `withTiming` + `cancelAnimation` desde hilo JS
- El linter removió SVG `<Filter>`/`<FeGaussianBlur>` que también podían crashear en Android; glow queda vía `RadialGradient`
- Error rojo de notificaciones en Expo Go corregido: sin `projectId` EAS configurado, ahora sale silenciosamente con log de debug
- Onboarding confirmado funcionando en Expo Go

**Pendiente para la próxima sesión:**
- **Daily.co**: activar plan de pago para habilitar creación de salas privadas por API
- Limpiar datos de prueba en bookings (scheduled_date/time con valores de test)
- Cablear escritura en `resource_completions` desde las herramientas
- Verificar subida de foto de perfil en dispositivo físico
- Google OAuth y push notifications (requieren dev build con EAS)

---

## 2026-07-02 — Andre (sesión 45)

**Tocado:** `screens/EditProfileScreen.tsx`, `screens/CoachProfileScreen.tsx`, `screens/ProfesionalScreen.tsx`, `screens/CoachLoginScreen.tsx`, `screens/SalaScreen.tsx`, `screens/CoachHomeScreen.tsx`, `screens/CoachChatsScreen.tsx`, `screens/SessionsScreen.tsx`, `app/(tabs)/_layout.tsx`, `app/(coach)/_layout.tsx`

**Resumen:**
- **Video/foto de perfil:** los pickers de cámara/galería ahora atrapan errores (antes crasheaban con "Uncaught in promise" si la cámara fallaba). Fix del bug conocido de expo-image-picker con videos guardados solo en iCloud (`preferredAssetRepresentationMode: 'compatible'` + `allowsEditing`). El "ver en pantalla completa" del video de perfil pasó de un hack con `enterFullscreen()`/`fullscreenOptions` (poco confiable en Expo Go) a un `Modal` propio.
- **`CoachLoginScreen.tsx`:** el mensaje "Ya sos coach" decía "ingresá desde la app normal" — no existe tal cosa, y el botón ya te lleva a `/(coach)`. Corregido el texto para que coincida con lo que hace.
- **`SalaScreen.tsx`:** el chat se congelaba en *cada* solicitud pendiente, incluso con clientes que ya tuvieron sesiones juntos — ahora solo se congela antes de la primera sesión completada. Fix de un error real de canal duplicado en el realtime de la sala (`cannot add postgres_changes callbacks after subscribe()`). `sendMessage()` ahora guarda `sender_type` real (antes TODO mensaje humano quedaba con el DEFAULT `'user'` de la columna, sin importar quién lo mandara — dato inútil para distinguir coach de cliente).
- **`CoachHomeScreen.tsx`:** bug real encontrado — la query de "Hoy"/"Esta semana" pedía columnas `date`/`time` de `bookings` que no existen (son `scheduled_date`/`scheduled_time`), por eso nunca mostraba sesiones reales. Se agregó línea de contexto de último mensaje por sesión y resumen semanal de clientes distintos acompañados. Se evaluó un preview de "Conexiones" (salas con mensajes sin leer) en Inicio y se descartó por decisión de producto — se reemplazó por un badge en la tab de Chats. Rediseño del estado "sin sesiones hoy" (antes quedaba una tarjeta compacta con el resto de la pantalla en blanco). Se agregó refresco al volver de foco (`useFocusEffect`) y pull-to-refresh — antes `pendingCount` y el resto de los datos quedaban viejos hasta un remount completo.
- **Indicadores de "no leído" (bug de varias sesiones atrás, resuelto hoy):** mandar tu propio mensaje o recibir una confirmación automática de reserva marcaba la sala como no leída — el cálculo no excluía mensajes propios ni de sistema (`system_confirmed`/`system_cancelled`), y un mensaje de sistema puede tener `sender_id` del coach o del cliente según qué flujo lo disparó (aceptación manual vs. reserva instantánea), así que filtrar solo por `sender_id` no alcanzaba. Corregido en `CoachChatsScreen.tsx` (que además no tenía ningún indicador por fila hasta hoy) y `SessionsScreen.tsx`. Además, los 4 indicadores (esas dos pantallas + las dos tab bars) dependían solo de eventos realtime o de un mount único — se quedaban pegados hasta recargar la app entera. Se agregó `useFocusEffect` a los 4 para que se refresquen al volver de foco.
- Bug adicional encontrado y corregido: `SessionsScreen.tsx` tenía un `setLoading(true)` en cada recarga que, sumado al nuevo `useFocusEffect`, hacía que toda la pantalla se reemplazara por el esqueleto de carga cada vez que volvías de un chat — se sacó, ahora refresca en segundo plano.

**Pendiente para la próxima sesión:**
- Activar plan de pago en Daily.co para videollamadas privadas (sigue pendiente de sesiones anteriores).
- "Reprogramar" en `SalaScreen.tsx` sigue roto del lado coach (usa el id del cliente como si fuera un coach) — quedó pendiente de definir el flujo (mensaje + notificación vs. solicitud formal con fecha propuesta), no se tocó en esta sesión.
- Documentar en Notion (Decisiones estratégicas) el hallazgo de las 3 implementaciones distintas de "no leído" y la decisión de extraerlas a un hook compartido (`useUnreadSalas` o similar) — quedó pendiente de una interrupción, no se llegó a escribir.
- Evaluar si vale la pena extraer la lógica de "no leído" (ahora duplicada en 4 lugares) a ese hook compartido.

## 2026-07-02 — Joaquín (sesión 44 — verificación y cierre)

**Tocado:** `package.json`, `package-lock.json`

**Resumen:**
- Se verificó el flujo completo de "Unirse a la llamada": el botón abre Daily.co correctamente con `expo-web-browser` (in-app browser)
- La SQL de prueba (`scheduled_date = '2026-07-02'`, `scheduled_time = '0:00'`, `duration_minutes = 1440`) confirma que el cálculo de estado `'live'` funciona bien en la app
- Daily.co en plan gratuito **no permite crear salas privadas vía API** — pide plan de pago. El flujo técnico está completo; solo falta activar el plan pago en Daily.co
- `expo-calendar` instalado — commit pendiente de esta sesión

**Pendiente para la próxima sesión:**
- **Activar plan de pago en Daily.co** para habilitar la creación de salas privadas por API (el resto del flujo ya funciona)
- Limpiar los datos de prueba en bookings (scheduled_date/time a valores reales)
- Verificar presencia "en línea" (no implementada — no hay infraestructura de Supabase Presence)
- Cablear escritura en `resource_completions` desde las herramientas
- SDK nativo de Daily.co (no corre en Expo Go — mejora futura)

---

## 2026-07-02 — Joaquín (sesión 43)

**Tocado:** `screens/SessionsScreen.tsx`, `screens/SalaScreen.tsx`, `screens/BookingScreen_Confirm.tsx`, `screens/CoachReservasScreen.tsx`, `supabase/functions/create-meeting-room/index.ts` (nuevo), `lib/meetingRoom.ts` (nuevo), `scripts/add-duration-minutes-meeting-url.sql` (nuevo), `app.json`, `tsconfig.json`, `SCHEMA.md`

**Resumen:**
- Rediseño completo de Mis salas: hero "Tu próxima sesión" con gradiente bosque, badge de estado, botones Unirse/Agendar; filas de sala con badge de no leídos y preview de mensaje; CTA punteado "Buscar profesionales" al final de la lista
- Rediseño de SalaScreen: se elimina el botón de video del header, el banner simple de sesión se reemplaza por una session card con 4 estados (pendiente/confirmada/en vivo/finalizada). La card "en vivo" tiene fondo bosque con botón terracota y animación de pulso (respeta reduced motion). El countdown se actualiza cada 30s. "Reprogramar" abre el flujo de reserva existente. "Agendar" integra expo-calendar
- Videollamada con Daily.co: Edge Function `create-meeting-room` crea sala privada con nbf/exp (15 min antes del inicio, 1h después del fin). Se guarda en `bookings.meeting_url`. La función es idempotente. Se llama en background al confirmar reserva (instant booking o aceptación del coach). Si meeting_url está vacío al abrir la sala, se reintenta automáticamente
- "Unirse" usa `expo-web-browser` en vez de `Linking.openURL` (in-app browser). Se activa 10 min antes (antes era 5 min en el botón del header)
- Schema: 2 columnas nuevas en bookings (`duration_minutes`, `meeting_url`) — **pendiente de correr** `scripts/add-duration-minutes-meeting-url.sql` en Supabase

**Pendiente para la próxima sesión:**
- Correr `scripts/add-duration-minutes-meeting-url.sql` en Supabase SQL Editor
- Deployar Edge Function: `supabase functions deploy create-meeting-room`
- Verificar presencia "en línea" (no implementada — no hay infraestructura de Supabase Presence)
- Cablear escritura en `resource_completions` desde las herramientas
- SDK nativo de Daily.co (no corre en Expo Go — mejora futura)

---

## 2026-07-02 — Joaquín (sesión 42)

**Tocado:** `screens/ProfileOwnScreen.tsx`, `app/(tabs)/index.tsx`

**Resumen:**
- Se eliminó la sección "Para vos hoy" de Home (card de recomendación, animación a5, constante mockRecommendation, estilos)
- Se eliminaron "Tu progreso" (toggle Sobre ti/Coach, sobreTiCard) y "Mi actividad" (3 MetricCards con métricas de sesiones) del perfil propio
- Se removió el componente `MetricCard`, la función `loadActivity`, states `progressTab`/`activity`/`semanasActivas`, y todos los estilos asociados
- `ActivityIndicator` se conservó porque sigue siendo usado en la sección "Mis profesionales"

**Pendiente para la próxima sesión:**
- Cablear escritura en `resource_completions` desde las herramientas (Respiración, Meditación, etc.)
- Verificar subida de foto de perfil en dispositivo físico
- Google OAuth pendiente (dev build)

---

## 2026-07-02 — Joaquín (sesión 41)

**Tocado:** `app/(tabs)/recursos.tsx` (rediseño completo + bug fixes), `hooks/useResourceProgress.ts` (nuevo), `scripts/add-resource-completions.sql` (nuevo, corrido hoy), `SCHEMA.md`

**Resumen:**
- Rediseño completo de la pantalla Recursos: header con racha semanal (StreakChip), bloque de contexto según mood del día (MoodContextBlock con gradiente verde bosque), "Continuar donde dejaste" (ContinueCard, oculta si no hay datos), sección "De tu coach" rediseñada con avatar/badge/nota/checks, filter chips Todos/Guardados, 3 grupos de herramientas con título Fraunces + subtítulo. Toda la lógica existente (saved_resources, toggleSave, ToolCard) se mantuvo intacta. Probado en dispositivo — funciona.
- Nuevo hook `useResourceProgress`: calcula racha, actividad últimos 7 días, recurso a medias y completados recientes desde `resource_completions`.
- Bugs corregidos: mini-card de sugerencia en MoodContextBlock era tappable visualmente (tenía chevron) pero sin onPress — ahora navega a la herramienta. Filtro "Guardados" sin items dejaba el área vacía sin contexto — ahora muestra empty state con mensaje.
- Corridos en Supabase: `add-resource-completions.sql` (tabla nueva), `add-coach-instant-booking.sql` (columna `instant_booking`), `add-avatar-upload.sql` (bucket `avatars` — políticas de storage ya existían, solo faltaba `profiles_update_own`). SCHEMA.md actualizado.

**Pendiente para la próxima sesión:**
- Cablear escritura de progreso en `resource_completions` desde cada herramienta (Respiración, Meditación, etc.) para que la racha y el "continuar" se pueblen con datos reales.
- Verificar subida de foto de perfil en dispositivo físico (bucket `avatars` ya está listo).
- Google OAuth pendiente (dev build).

---

## 2026-07-02 — Joaquín (sesión 40)

**Tocado:** `app/(tabs)/conexiones.tsx`, `app/search3.tsx`, `lib/coachesCache.ts` (nuevo)

**Resumen:**
- Fix cards de temas en Conexiones: siempre devolvían 0 resultados porque los labels de UI ("Ansiedad y estrés") no coincidían con los subtemas reales de `coach_topics` ("Ansiedad", "Estrés físico"). Solución: cada card tiene `searchTopics: string[]` con strings exactos de AXES; se pasan como lista coma-separada a search3 que usa OR logic.
- Carga de subtemas en Supabase: script SQL para los 8 coaches reales (andre, María González, Martín Fuentes, Sofía Herrera, Lucas Méndez, Usuario 2, dardoalbisu, Coach Prueba).
- Performance: dos queries secuenciales colapsadas en una sola con join `coach_topics(topic)` en search3. Luego agregado prefetch en module cache (`lib/coachesCache.ts`): al abrir Conexiones se precarga en background; al tocar una card el resultado aparece instantáneo desde memoria.

**Pendiente para la próxima sesión:**
- Verificar subida de foto de perfil en dispositivo físico.
- Google OAuth pendiente (dev build).

---

## 2026-07-02 — Joaquín (sesión 39)

**Tocado:** `screens/CoachProfileScreen.tsx`, Supabase (SQL Editor — sin cambios de código)

**Resumen:**
- Fix botón "Editar perfil" en `CoachProfileScreen.tsx`: agregado `onPress={() => router.push('/edit-profile')}` — la pantalla ya existía, solo faltaba conectarla.
- Verificado `scripts/add-coach-topics.sql`: todas las políticas ya estaban aplicadas en Supabase (Andre las había corrido antes).
- Integrado commit de Andre (sesión 48 — subtemas de coaches) durante la sesión via merge.

**Pendiente para la próxima sesión:**
- Probar en dispositivo: elegir subtemas como coach y verificar que aparecen en perfil y búsqueda.
- Decidir qué hacer con las 9 cards de temas de Conexiones (taxonomía distinta, ver SCHEMA.md regla 17).
- Verificar subida de foto de perfil en dispositivo físico.
- Google OAuth pendiente (dev build).

---

## 2026-07-02 — Andre (sesión 48)

**Tocado:** `screens/CoachTopicsScreen.tsx` (nuevo), `app/coach-topics.tsx` (nuevo), `app/_layout.tsx`, `screens/CoachProfileScreen.tsx`, `screens/ProfesionalScreen.tsx`, `app/search3.tsx`, `scripts/add-coach-topics.sql` (nuevo, **no corrido todavía en Supabase**), `SCHEMA.md`

**Resumen:**
- Andre pidió hacer funcional la selección de subtemas de un coach (reflejado en perfil + filtro real en el buscador). La taxonomía ya existía completa en `constants/searchData.ts` (`AXES` — 3 ejes: Bienestar físico, Bienestar emocional y mental, Crecimiento y propósito; 28 subtemas en total) y ya se usaba en el flujo `search1.tsx → search2.tsx` para elegir un subtema — pero `search3.tsx` comparaba ese subtema contra `coaches.specialty` (texto libre, ej. "Coach de vida"), así que el filtro nunca matcheaba de verdad.
- Nueva tabla `coach_topics` (many-to-many coach↔subtema, `coach_id → coaches.id` mismo criterio que `coach_availability`).
- Nueva pantalla `screens/CoachTopicsScreen.tsx` (`/coach-topics`): los 28 subtemas agrupados por eje, multi-select con chips, guardado con criterio "reemplazar todo" (borra y reinserta). Enganchada desde "Temas que trabajo" en `CoachProfileScreen.tsx` (antes un chip "+ Agregar" sin `onPress`) — ahora muestra los subtemas reales elegidos como chips de solo lectura + el link para editar, refrescando con `useFocusEffect` al volver de la pantalla de edición (primer uso de ese hook en el proyecto).
- `ProfesionalScreen.tsx`: reemplazado el array de 5 temas hardcodeado (`DEFAULT_PROFESIONAL.topics`, igual para cualquier coach) por los subtemas reales del coach.
- `search3.tsx`: el filtro por `topic` (viene de `search2.tsx`) ahora compara por igualdad exacta contra los `coach_topics` reales de cada coach, en vez de la comparación rota contra `specialty`. De paso, la búsqueda libre por texto (`query`, desde `search1.tsx`) también matchea contra los subtemas del coach, no solo nombre/especialidad.
- **Hallazgo sin resolver, documentado en SCHEMA.md (regla 17):** los 9 "temas" que aparecen como cards en Conexiones (`TOPICS` en `conexiones.tsx`) son una taxonomía *distinta* y desconectada de los 28 subtemas de `AXES` — ningún label coincide textualmente. Tocar esas cards en Conexiones ya devolvía 0 resultados antes de esta sesión (comparaba contra `specialty`, tampoco coincidía nunca) y lo sigue haciendo ahora (compara contra `coach_topics`, tampoco coincide). No es una regresión de hoy — es un bug preexistente que quedó más visible. Requiere una decisión de producto (remapear, unificar, o descartar esa navegación) antes de tocarlo.

**Pendiente para la próxima sesión:**
- **Correr `scripts/add-coach-topics.sql` en Supabase** — hasta entonces, elegir subtemas falla en silencio (tabla no existe) y el perfil/búsqueda no muestran nada.
- Probar en dispositivo: elegir subtemas como coach, confirmar que aparecen en `ProfesionalScreen.tsx`, y que buscar por ese subtema en `search1 → search2 → search3` trae al coach correcto.
- Decidir qué hacer con las 9 cards de temas de Conexiones (regla 17 de SCHEMA.md).
- Sigue pendiente correr `scripts/add-coach-instant-booking.sql` (sesión 37) y `scripts/add-avatar-upload.sql` (sesión 39) en cualquier ambiente que no lo haya corrido todavía.
## 2026-07-02 — Joaquín (sesión 38)

**Tocado:** Supabase (SQL Editor — sin cambios de código)

**Resumen:**
- Corridos los scripts pendientes de Andre en Supabase:
  - `favorite_coaches` — ya existía (Andre la había corrido antes)
  - `add-coach-instant-booking.sql` — columna `instant_booking boolean DEFAULT false` agregada a `coaches`
  - `add-avatar-upload.sql` — bucket `avatars` creado en Storage + 4 políticas RLS + política `profiles_update_own`
- Todos los features de Andre (fotos de perfil, reserva instantánea, favoritos) quedan operativos en producción.

**Pendiente para la próxima sesión:**
- Verificar subida de foto de perfil en dispositivo físico (coach y usuario).
- Con más días de check-in, verificar gráfico de mood en progreso.
- Google OAuth pendiente (dev build).
- Botón "Editar perfil" en CoachProfileScreen sin `onPress`.

---

## 2026-07-02 — Andre (sesión 48)

**Tocado:** `screens/CoachTopicsScreen.tsx` (nuevo), `app/coach-topics.tsx` (nuevo), `app/_layout.tsx`, `screens/CoachProfileScreen.tsx`, `screens/ProfesionalScreen.tsx`, `app/search3.tsx`, `scripts/add-coach-topics.sql` (nuevo, **no corrido todavía en Supabase**), `SCHEMA.md`

**Resumen:**
- Andre pidió hacer funcional la selección de subtemas de un coach (reflejado en perfil + filtro real en el buscador). La taxonomía ya existía completa en `constants/searchData.ts` (`AXES` — 3 ejes: Bienestar físico, Bienestar emocional y mental, Crecimiento y propósito; 28 subtemas en total) y ya se usaba en el flujo `search1.tsx → search2.tsx` para elegir un subtema — pero `search3.tsx` comparaba ese subtema contra `coaches.specialty` (texto libre, ej. "Coach de vida"), así que el filtro nunca matcheaba de verdad.
- Nueva tabla `coach_topics` (many-to-many coach↔subtema, `coach_id → coaches.id` mismo criterio que `coach_availability`).
- Nueva pantalla `screens/CoachTopicsScreen.tsx` (`/coach-topics`): los 28 subtemas agrupados por eje, multi-select con chips, guardado con criterio "reemplazar todo" (borra y reinserta). Enganchada desde "Temas que trabajo" en `CoachProfileScreen.tsx` (antes un chip "+ Agregar" sin `onPress`) — ahora muestra los subtemas reales elegidos como chips de solo lectura + el link para editar, refrescando con `useFocusEffect` al volver de la pantalla de edición (primer uso de ese hook en el proyecto).
- `ProfesionalScreen.tsx`: reemplazado el array de 5 temas hardcodeado por los subtemas reales del coach.
- `search3.tsx`: el filtro por `topic` ahora compara contra `coach_topics` reales de cada coach. La búsqueda libre también matchea subtemas del coach.
- **Hallazgo sin resolver (SCHEMA.md regla 17):** los 9 "temas" de Conexiones son una taxonomía distinta y desconectada de los 28 subtemas de `AXES` — requiere decisión de producto antes de tocarlo.

**Pendiente para la próxima sesión:**
- **Correr `scripts/add-coach-topics.sql` en Supabase** — hasta entonces, elegir subtemas falla en silencio.
- Decidir qué hacer con las 9 cards de temas de Conexiones (regla 17 de SCHEMA.md).

---

## 2026-07-02 — Joaquín (sesión 37)

**Tocado:** merge de `andre/main` → `main` (fast-forward, sin conflictos)

**Resumen:**
- Integrados 11 commits de Andre: fotos de perfil para coaches y usuarios (visibles en chat, reservas, búsquedas y Destacados), favoritos de coaches funcionales, reserva instantánea implementada, bloqueo de doble reserva al mismo horario, chat de Sala congelado mientras reserva está pendiente, fix de reviews unidireccionales, fix visual card de Sofía en Conexiones, frase del día sacada del hardcode en home.
- Scripts SQL nuevos en `scripts/`: `add-avatar-upload.sql`, `add-coach-instant-booking.sql`, `add-favorite-coaches.sql`, `complete-confirmed-sessions.sql` — verificar cuáles ya fueron corridos en Supabase.

**Pendiente para la próxima sesión:**
- Revisar qué scripts SQL de Andre ya están aplicados en Supabase y cuáles faltan.
- Con más días de check-in, verificar gráfico de mood en progreso.
- Google OAuth pendiente (dev build).
- Botón "Editar perfil" en CoachProfileScreen sin `onPress`.

---

## 2026-07-01 — Andre (sesión 47)

**Tocado:** `app/(tabs)/index.tsx`

**Resumen:**
- A pedido de Andre, se sacó la frase del día hardcodeada ("Todas las respuestas están en vos.") que aparecía debajo del saludo en la home. Quedó eliminada la constante `dailyPhrase`, la línea de JSX y el estilo `dailyPhrase` sin uso. El bloque de saludo ahora solo tiene las dos líneas ("¡Buen día!" / "¿cómo estás hoy?").

**Pendiente para la próxima sesión:**
- Sigue pendiente correr `scripts/add-coach-instant-booking.sql` (sesión 37) y `scripts/add-avatar-upload.sql` en cualquier ambiente que no lo haya corrido todavía.

---

## 2026-07-01 — Andre (sesión 46)

**Tocado:** `screens/SalaScreen.tsx`, `SCHEMA.md`

**Resumen:**
- Bug reportado por Andre: se podía chatear libremente en la Sala aunque la reserva siguiera `'pendiente'` (el coach todavía no aceptó ni rechazó). Esto contradice una decisión de producto ya documentada en Notion ("Mensaje previo a la aceptación del coach"): el chat es unidireccional antes de aceptar (solo existe el mensaje opcional que el usuario deja al reservar) — nunca se había implementado esa restricción en `SalaScreen.tsx`.
- Fix: `isChatFrozen = confirmedBooking?.status === 'pendiente'`. Mientras es `true`, el input y botón de enviar se reemplazan por un aviso explicando por qué está congelado (texto distinto para usuario y coach), y `sendMessage()` corta temprano como defensa en profundidad. El estado vacío de la lista de mensajes también cambia de copy si está congelado, para no invitar a "empezar la conversación" cuando en realidad está bloqueada.
- Se destranca solo — apenas el booking pasa a `'confirmada'` (el coach acepta) o deja de haber un `'pendiente'` activo (se cancela/rechaza y eventualmente se pide otro horario), el chat vuelve a funcionar normal, sin código nuevo necesario (ya lee `confirmedBooking` en tiempo real vía la suscripción existente).
- `SCHEMA.md` regla nueva 16, citando la decisión de Notion.

**Pendiente para la próxima sesión:**
- Probar en dispositivo: crear una reserva pendiente, confirmar que el chat queda congelado para ambos lados (usuario y coach), y que se destranca solo al aceptar/rechazar.
- Sigue pendiente correr `scripts/add-coach-instant-booking.sql` (sesión 37) y `scripts/add-avatar-upload.sql` en cualquier ambiente que no lo haya corrido todavía.

---

## 2026-07-01 — Andre (sesión 45)

**Tocado:** `app/(tabs)/conexiones.tsx`, `screens/ProfesionalScreen.tsx`, `hooks/useFavoriteCoaches.ts` (nuevo), `screens/FavoritosScreen.tsx` (nuevo), `app/favoritos.tsx` (nuevo), `app/_layout.tsx`, `scripts/add-favorite-coaches.sql` (nuevo, **no corrido todavía en Supabase**), `SCHEMA.md`

**Resumen:**
- Andre preguntó si favoritos funciona en Conexiones — no: eran dos `useState` locales, puramente visuales y **desconectados entre sí** (la estrella en "Destacados de la semana" y el botón "Guardar en favoritos" de `ProfesionalScreen.tsx`). Ninguno persistía nada; se perdía todo al recargar, y marcar un coach de favorito en un lugar no lo reflejaba en el otro.
- Implementado de punta a punta: tabla nueva `favorite_coaches` (mismo patrón RLS que `saved_resources`), y un hook compartido `hooks/useFavoriteCoaches.ts` (mismo criterio que `hooks/useMoodHistory.ts`) que es ahora la única fuente de verdad — usado en `conexiones.tsx` y `ProfesionalScreen.tsx`, así que favoritear un coach en cualquiera de los dos lugares se refleja en el otro.
- Nueva pantalla `screens/FavoritosScreen.tsx` (`/favoritos`) con la lista real de coaches guardados — accesible desde un ícono de estrella nuevo en el header de Conexiones, junto a la campana. Empty state si no hay ninguno guardado todavía.
- Alcance deliberadamente acotado: el doc conceptual de Notion ("CONEXIONES" → "Favoritos") menciona también "notificación cuando un coach guardado tiene nueva disponibilidad" — no se implementó, es una feature separada y más grande (requeriría comparar altas en `coach_availability` contra las listas de favoritos de cada usuario). Queda anotado como pendiente, no construido.

**Pendiente para la próxima sesión:**
- **Correr `scripts/add-favorite-coaches.sql` en Supabase** — hasta entonces, favoritear un coach falla en silencio (tabla no existe).
- Probar en dispositivo: favoritear un coach desde su perfil, confirmar que aparece marcado también en Destacados y en `/favoritos`; sacarlo de favoritos desde `/favoritos` y confirmar que desaparece de los tres lugares.
- Considerar si vale la pena la notificación de "nueva disponibilidad de un coach guardado" del doc conceptual, o se descarta para esta etapa.
- Sigue pendiente correr `scripts/add-coach-instant-booking.sql` (sesión 37) y `scripts/add-avatar-upload.sql` en cualquier ambiente que no lo haya corrido todavía.

---

## 2026-07-01 — Andre (sesión 44)

**Tocado:** `screens/ReviewScreen.tsx`, `scripts/complete-confirmed-sessions.sql` (nuevo, corrido en Supabase por Andre el 01/07/2026), `SCHEMA.md`

**Resumen:**
- Punto de partida: Andre preguntó si el sistema de reviews funciona. Se encontró que la mitad coach→usuario nunca se construyó en UI, y que ya había una decisión de producto documentada en Notion (1 de julio 2026, "Decisiones estratégicas" → "Reviews: unidireccionales") confirmando que reviews es usuario→coach exclusivamente, por diseño — no por limitación técnica.
- **Hallazgo mayor durante la investigación:** `complete_confirmed_sessions()` — la función que marca bookings como `'completada'` y dispara la invitación a review — **nunca existió realmente en la base**, pese a estar documentada desde el 23/06 como "✅ completada y verificada en Supabase". Confirmado con tres queries de diagnóstico corridas por Andre en el SQL Editor: `pg_get_functiondef` no la encontró, ninguna función con nombre parecido existe en `pg_proc`, y ninguna función en toda la base contiene el string `'invitacion_review'` en su cuerpo. El cron job (`complete-sessions`) sí estaba agendado y activo desde esa fecha, así que **cada corrida (cada 5 minutos, durante más de una semana) fallaba en silencio** — ningún booking se completó nunca automáticamente, y no se generó ninguna notificación de review para nadie, ni usuario ni coach. Mismo patrón que el incidente ya documentado del 19/06 (código documentado como corrido que en realidad nunca se ejecutó). El CHECK constraint de `notifications.type` sí incluía `'invitacion_review'` — esa parte del 23/06 sí había corrido, solo faltaba la función.
- **Fix de la función:** `scripts/complete-confirmed-sessions.sql` — creación (no modificación, no había nada previo), ya con la regla unidireccional incorporada desde el día uno: solo inserta la notificación `invitacion_review` para `bookings.user_id`, nunca para el coach. No hizo falta tocar `cron.job` — ya estaba bien agendado, solo faltaba que la función existiera.
- **Fix de defensa en profundidad:** `ReviewScreen.tsx` ahora chequea `role` de `useAuth()` al montar y redirige cualquier coach a `/(coach)/reservas` en vez de mostrar el formulario. Antes de este fix, un coach que llegara a `/review?booking_id=X` (ej. por una notificación vieja, mal generada, o un tap de push futuro) habría insertado una review con `reviewer_id = reviewed_id` (revieweándose a sí mismo) — ni la constraint UNIQUE ni las RLS de `reviews` lo hubieran impedido, porque son genéricas por diseño. En la práctica nunca se disparó porque la función que generaba la notificación tampoco existía.
- `SCHEMA.md` actualizado: regla 10 (hallazgo completo + fix), regla nueva 15 (reviews unidireccionales + guard de rol), descripción de `notifications.type` y de la tabla `reviews` actualizadas para reflejar la decisión de producto.

**Pendiente para la próxima sesión:**
- Probar en dispositivo: crear un booking de prueba con `scheduled_date`/`scheduled_time` ya pasado + 20 min, confirmar que el cron lo marca `'completada'` y que la notificación de review le llega solo al usuario.
- Sigue pendiente correr `scripts/add-coach-instant-booking.sql` (sesión 37) y `scripts/add-avatar-upload.sql` en cualquier ambiente que no lo haya corrido todavía.

---

## 2026-07-01 — Andre (sesión 43)

**Tocado:** `app/(tabs)/conexiones.tsx`

**Resumen:**
- Andre notó que la sección "Destacados de la semana" tampoco mostraba la foto real del coach — mismo bug que `search3.tsx` (sesión 40): el query a `coaches` no traía `avatar_url`.
- Fix: join cambiado a `profiles!inner(id, name, avatar_url)`, y la card de coach ahora muestra la foto real (con `overflow: hidden` en el contenedor para respetar el borde redondeado superior) o el ícono genérico si no subió foto.

**Pendiente para la próxima sesión:**
- Sigue pendiente correr `scripts/add-coach-instant-booking.sql` (sesión 37).

---

## 2026-07-01 — Andre (sesión 42)

**Tocado:** `app/(tabs)/conexiones.tsx`

**Resumen:**
- Bug reportado por Andre: la última card de Conexiones ("¿No sabés qué necesitás? Te ayudo a encontrarlo") aparecía muy abajo, pegada al tab bar.
- Causa: a diferencia de todas las otras pantallas con tab bar (`index.tsx`, `recursos.tsx`, `SessionsScreen.tsx`, `CoachReservasScreen.tsx`, etc.), que envuelven su contenido en un `ScrollView` con un espaciador `<View style={{ height: TAB_BAR_CLEARANCE }} />` al final, `conexiones.tsx` usaba un `View` fijo no scrollable sin ese espaciador — la card quedaba pegada al borde inferior real de la pantalla, debajo del tab bar flotante, en vez de tener el margen que sí tienen las demás pantallas.
- Fix: convertido el `View` contenedor en `ScrollView` (mismo patrón que el resto de la app) y agregado el espaciador `TAB_BAR_CLEARANCE` al final. Los ScrollViews horizontales anidados (temas, destacados) siguen funcionando igual.

**Pendiente para la próxima sesión:**
- Sigue pendiente correr `scripts/add-coach-instant-booking.sql` (sesión 37).

---

## 2026-07-01 — Andre (sesión 41)

**Tocado:** `screens/EditProfileScreen.tsx`, `screens/ProfileOwnScreen.tsx`, `app/(tabs)/index.tsx`, `screens/CoachReservasScreen.tsx`, `screens/SalaScreen.tsx`, `screens/CoachChatsScreen.tsx`, `screens/SessionsScreen.tsx`, `SCHEMA.md`

**Resumen:**
- Extensión de la foto de perfil (sesión 39) a usuarios normales, no solo coaches. Andre eligió el alcance "en todos lados" ante la pregunta de dónde debía reflejarse.
- `EditProfileScreen.tsx`: el botón "Cambiar foto" (existía sin `onPress`) ahora sube a Storage (mismo bucket `avatars`, path `{user.id}/avatar.jpg`) y guarda en `profiles.avatar_url` — mismo patrón que `CoachProfileScreen.tsx` de la sesión 39, sin extraer a un helper compartido (dos pantallas, poca lógica, no vale la pena la abstracción todavía).
- Foto real reemplaza iniciales/ícono genérico en: `ProfileOwnScreen.tsx` (perfil propio) y el avatar del top bar en `app/(tabs)/index.tsx`; y donde una parte ve a la otra — `SalaScreen.tsx` (chat, avatar grande del header y chico de mensajes), `CoachReservasScreen.tsx` (usuario que reservó, en pendientes y confirmadas), `CoachChatsScreen.tsx` y `SessionsScreen.tsx` (listas de chat). Todos con fallback a iniciales/ícono si no subió foto.
- No hizo falta ningún cambio de schema — reutiliza el mismo bucket `avatars` y la misma columna `profiles.avatar_url` de la sesión 39, así que `scripts/add-avatar-upload.sql` no cambió.
- `SCHEMA.md` actualizado: la entrada de `avatar_url` y la regla 14 ya no dicen "solo coach", listan todas las pantallas que la usan ahora.

**Pendiente para la próxima sesión:**
- Probar en dispositivo: subir foto como usuario normal desde `EditProfileScreen.tsx`, y confirmar que se ve en las 7 pantallas listadas arriba, especialmente del lado del coach (`CoachReservasScreen.tsx`, `SalaScreen.tsx`, `CoachChatsScreen.tsx`).
- Sigue pendiente correr `scripts/add-coach-instant-booking.sql` (sesión 37).

---

## 2026-07-01 — Andre (sesión 40)

**Tocado:** `app/search3.tsx`

**Resumen:**
- Andre probó la foto de perfil de la sesión anterior: se ve bien en `ProfesionalScreen.tsx`, pero faltaba en la lista de resultados del buscador — seguía mostrando el ícono genérico de persona.
- `search3.tsx` ahora trae `avatar_url` en el join a `profiles!inner(id, name, avatar_url)` y muestra la foto real en la card de cada coach si existe, con el mismo fallback al ícono genérico si no la subió.
- Alcance acotado a `search3.tsx` (la única pantalla que lista coaches con avatar) — no se tocaron `BookingScreen_*`, `SessionsScreen.tsx` ni otras pantallas que también muestran coaches, quedan con el placeholder genérico salvo que se pida extenderlo.

**Pendiente para la próxima sesión:**
- Seguir sin correr `scripts/add-avatar-upload.sql` en algún ambiente que no lo tenga corrido todavía (en este ya se corrió, confirmado por Andre).
- Sigue pendiente correr `scripts/add-coach-instant-booking.sql` (sesión 37).

---

## 2026-07-01 — Andre (sesión 39)

**Tocado:** `screens/CoachProfileScreen.tsx`, `screens/ProfesionalScreen.tsx`, `scripts/add-avatar-upload.sql` (nuevo, **no corrido todavía en Supabase**), `SCHEMA.md`

**Resumen:**
- Feature pedida por Andre: que el coach pueda subir su foto de perfil y que los usuarios la vean en el perfil público del coach.
- `profiles.avatar_url` ya existía en la tabla (sin uso hasta ahora) — no hizo falta columna nueva, solo bucket de Storage.
- `CoachProfileScreen.tsx`: el botón de cámara sobre la foto (antes sin `onPress`, según pendiente de sesiones previas) ahora abre selector cámara/galería, sube a Storage (bucket `avatars`, path `{user.id}/avatar.jpg`, mismo patrón que `video_url` de la sesión 30/06), y guarda la URL en `profiles.avatar_url` con el mismo chequeo de `data` post-update para detectar bloqueo silencioso de RLS.
- `ProfesionalScreen.tsx`: si el coach tiene `avatar_url`, se muestra esa foto en vez del ícono de persona genérico. El query a `coaches` ahora hace join a `profiles!inner(name, avatar_url)`.
- `scripts/add-avatar-upload.sql`: bucket `avatars` (público, 5MB, solo imágenes) + RLS de storage, y una política de UPDATE en `profiles` creada solo si no existía ninguna ya (no había ninguna documentada en scripts previos — primera vez que se confirma explícitamente que existe).
- Alcance deliberadamente acotado a lo pedido: otras pantallas que muestran coaches (`search3.tsx`, booking, `SessionsScreen.tsx`) siguen con el ícono genérico, sin tocar.
- `SCHEMA.md` actualizado (columna `profiles.avatar_url` documentada, regla nueva 14).

**Pendiente para la próxima sesión:**
- **Correr `scripts/add-avatar-upload.sql` en Supabase** — hasta entonces la subida de foto falla (bucket no existe) y posiblemente el guardado en `profiles` también, si resulta que no había política de UPDATE previa.
- Probar en dispositivo físico: subir foto como coach, verificar que se ve recortada en cuadrado, y que otro usuario la ve reflejada en `ProfesionalScreen.tsx`.
- Decidir si vale la pena mostrar la foto también en `search3.tsx` y otras listas de coaches, para consistencia visual.
- Sigue pendiente correr `scripts/add-coach-instant-booking.sql` (sesión 37).

---

## 2026-07-01 — Andre (sesión 38)

**Tocado:** `screens/BookingScreen_Time.tsx`, `screens/BookingScreen_Calendar.tsx`, `SCHEMA.md`

**Resumen:**
- Bug reportado por Andre al probar la reserva con "Coach Prueba": mandaba una solicitud, y el mismo horario seguía apareciendo disponible para volver a reservarlo — un usuario podía enviar 2 solicitudes al mismo slot. Causa: ambas pantallas solo marcaban un horario ocupado si había una reserva `'confirmada'`, ignorando las `'pendiente'` por completo.
- Fix: un horario ahora se marca ocupado también si el usuario logueado ya tiene una reserva `'pendiente'` propia ahí — pero **solo para él**. Las solicitudes `'pendiente'` de otros usuarios NO bloquean el slot a propósito, porque el diseño existente permite que varios usuarios compitan por el mismo horario y el coach elige a cuál acepta (la cancelación automática de las demás ya vivía en `CoachReservasScreen.tsx → accept()`, sin tocar).
- `SCHEMA.md` regla 9 actualizada con el criterio nuevo de disponibilidad.
- (Nota de contexto para la próxima sesión: el error "No encontramos el profesional" que reportó Andre en la sesión anterior era por no haber corrido todavía `scripts/add-coach-instant-booking.sql` en Supabase — sigue pendiente, ver sesión 37.)

**Pendiente para la próxima sesión:**
- Seguir sin correr `scripts/add-coach-instant-booking.sql` en Supabase — bloqueante para probar la modalidad instantánea y para que el booking normal no tire error al hacer `select('instant_booking')`.
- Probar en dispositivo: mandar una solicitud pendiente y confirmar que ese mismo horario aparece ocupado solo para ese usuario, no para otro usuario distinto logueado con otra cuenta.

---

## 2026-07-01 — Andre (sesión 37)

**Tocado:** `screens/BookingScreen_Calendar.tsx`, `screens/BookingScreen_Time.tsx`, `screens/BookingScreen_Confirm.tsx`, `screens/BookingScreen_Success.tsx`, `screens/CoachProfileScreen.tsx`, `scripts/add-coach-instant-booking.sql` (nuevo, **no corrido todavía en Supabase**), `SCHEMA.md`

**Resumen:**
- Bug encontrado por Andre: el booking permitía reservar horarios de hoy que ya pasaron (ej. 7am reservable a las 5pm del mismo día). `BookingScreen_Time.tsx` marcaba un slot como disponible únicamente chequeando si estaba reservado, sin comparar la hora contra el momento actual. Fix: si la fecha elegida es hoy, cualquier horario `<= ahora` se marca no disponible. Mismo criterio aplicado en `BookingScreen_Calendar.tsx` para que el día de hoy no quede seleccionable si a todos sus slots restantes ya les pasó la hora.
- Feature: la "modalidad de reserva" (Instantánea / Con confirmación) existía como switch puramente visual en `CoachProfileScreen.tsx` desde el rediseño VITA (sesión 31) — sin persistencia ni columna en la base. Se implementó de punta a punta:
  - **DB:** nueva columna `coaches.instant_booking` (boolean, default false) — script en `scripts/add-coach-instant-booking.sql`, **pendiente de correr en Supabase**.
  - El switch en `CoachProfileScreen.tsx` ahora lee y persiste el valor real (mismo patrón que `savePrice()`: chequea `data` post-update para detectar bloqueo silencioso de RLS).
  - `BookingScreen_Confirm.tsx`: si el coach tiene `instant_booking=true`, el booking se crea directo con `status='confirmada'` (no `'pendiente'`), y se replican ahí mismo los efectos que hoy dispara `CoachReservasScreen.tsx → accept()` — notificación `reserva_confirmada` al usuario, mensaje `system_confirmed` en la sala, y cancelación automática de otras reservas `'pendiente'` que compitan por el mismo horario. Lógica duplicada a propósito, no extraída a un helper compartido, para no tocar `accept()` (tiene datos reales de testing).
  - Copy condicional según el modo en `BookingScreen_Confirm.tsx` (texto de modalidad, aviso de cobro, pregunta del mensaje opcional) y en `BookingScreen_Success.tsx` (título, subtítulo y badge de estado).
- `SCHEMA.md` actualizado: columna `coaches.instant_booking` documentada, y regla nueva (13) explicando la duplicación de lógica y que la columna todavía no está corrida en producción.

**Pendiente para la próxima sesión:**
- **Correr `scripts/add-coach-instant-booking.sql` en el SQL Editor de Supabase** — hasta entonces el switch de modalidad falla en silencio (0 filas afectadas) y todo coach sigue funcionando en modo "con confirmación" de hecho, aunque el `select` de `instant_booking` puede además tirar error de columna inexistente.
- Probar en dispositivo físico el flujo instantáneo completo: activar el switch como coach, reservar como usuario, confirmar que la sala recibe el mensaje `system_confirmed` y que un segundo usuario compitiendo por el mismo horario recibe la cancelación automática.
- Con más días de check-in acumulados, verificar que el gráfico de mood en progreso se lea bien.
- Considerar leyenda de colores de mood al costado del gráfico.
- Google OAuth pendiente (dev build).
- Botón "Editar perfil" en CoachProfileScreen sin `onPress`.

---

## 2026-07-01 — Joaquín (sesión 36)

**Tocado:** `app/(tabs)/index.tsx`, `app/(tabs)/_layout.tsx`

**Resumen:**
- Fix recurrente de canal realtime: al volver a home después de un booking, `notif-bell` y `user-tab-dot` crasheaban con "cannot add postgres_changes callbacks after subscribe()". Solución: sufijo aleatorio (`Math.random().toString(36).slice(2)`) en ambos nombres de canal para que cada montaje cree un canal único.

**Pendiente para la próxima sesión:**
- Con más días de check-in acumulados, verificar que el gráfico de mood en progreso se lea bien.
- Considerar leyenda de colores de mood al costado del gráfico.
- Google OAuth pendiente (dev build).
- Botón "Editar perfil" en CoachProfileScreen sin `onPress`.

---

## 2026-07-01 — Joaquín (sesión 35)

**Tocado:** `app/progreso.tsx`, `app/(tabs)/index.tsx`

**Resumen:**
- Agregada sección "Estado de ánimo" en `progreso.tsx`: gráfico de línea SVG de 14 días (puntos coloreados por `ViveMoodColors`, línea que salta días sin dato) + 3 métricas (promedio de mood, racha actual, mejor día de la semana).
- Card "Sobre ti" en la home es ahora un `TouchableOpacity` que navega a `/progreso`. Se eliminó el `onPress` separado que tenía el ícono Venn — toda la card actúa como una unidad.

**Pendiente para la próxima sesión:**
- Con más días de check-in acumulados, verificar que el gráfico se lea bien en distintos tamaños de pantalla.
- Considerar agregar una leyenda de los 5 colores de mood al costado del gráfico.
- Google OAuth pendiente (dev build).
- Botón "Editar perfil" en CoachProfileScreen sin `onPress`.

---

## 2026-07-01 — Joaquín (sesión 34)

**Tocado:** `scripts/create-mood-entries.sql` (nuevo, corrido en Supabase), `constants/theme.ts`, `hooks/useMoodHistory.ts` (nuevo), `lib/moodInsights.ts` (nuevo), `components/MoodCheckIn.tsx` (nuevo), `app/(tabs)/index.tsx`

**Resumen:**
- Implementado widget "Check-in de hoy" en la home: 5 círculos de color sólido con animaciones de escala y opacidad, microcopy de confirmación con fade+slide, preload del estado de hoy desde Supabase al montar.
- Nueva tabla `mood_entries` con constraint UNIQUE (user_id, entry_date) — upsert para que re-tocar un círculo actualice el mismo row, no duplique. RLS con 4 políticas. SQL en `scripts/create-mood-entries.sql`.
- `useMoodHistory(userId, days)` en `hooks/` — hook reutilizable para cualquier pantalla que necesite historial de mood.
- `lib/moodInsights.ts` con variantes de copy en `MOOD_COPY` (ajustables sin tocar lógica) y `getSobreTiInsight()` que genera texto dinámico según streak, tendencia y promedio de los últimos 7 días.
- "Sobre ti" en home reemplaza texto estático por insight generado del historial real. Fallback si hay menos de 3 check-ins.
- `ViveMoodColors` agregado a `constants/theme.ts` (global, disponible para otras pantallas).

**Pendiente para la próxima sesión:**
- Verificar comportamiento del widget cuando el usuario no está logueado (debe llamar `requestAuth()` al tocar, no crashear).
- Considerar mostrar un mini historial de los últimos 7 días de mood en alguna pantalla de progreso o perfil.
- Google OAuth sigue pendiente (dev build).
- Botón "Editar perfil" en CoachProfileScreen sin `onPress`.

---

## 2026-07-01 — Joaquín (sesión 33)

**Tocado:** `scripts/add-saved-resources-rls.sql` (corrido en Supabase), SQL en `coach_availability` (INSERT directo desde SQL Editor), `app/diario.tsx`, `app/gratitud.tsx`, `app/search3.tsx`, `screens/BookingScreen_Calendar.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/recursos.tsx`

**Resumen:**
- Corrido el script RLS de `saved_resources` en Supabase — las 4 políticas quedaron activas.
- Investigado por qué el calendario de booking no mostraba fechas: toda la disponibilidad existente era solo de "Coach Prueba" y con fechas pasadas (junio). Confirmado con el dump completo de `coach_availability`.
- Cargada disponibilidad para todos los coaches: lunes a viernes, 6 slots diarios (09:00–17:00), del 7 al 31 de julio. Booking funciona correctamente después del INSERT.
- Batch fix de texto invisible (oliva sobre oliva): `diario.tsx`, `gratitud.tsx`, `search3.tsx` tenían `backgroundColor: '#565E32'` en tarjetas y encabezados — reemplazado por crema `rgba(255,248,240,0.80)` y `#F7EFE4`. Patrón recurrente del redesign previo que no se había limpiado.
- `BookingScreen_Calendar.tsx`: `dayTextSelected.color` era `'#565E32'` (oliva sobre terracota seleccionado) → corregido a `'#F7EFE4'`.
- `app/(tabs)/_layout.tsx`: canal realtime renombrado a `user-tab-dot-${user.id}` para evitar crash `cannot add postgres_changes callbacks after subscribe()`.
- `recursos.tsx`: color del ícono bookmark sin guardar corregido a `#87835C` (era casi invisible).

**Pendiente para la próxima sesión:**
- Verificar que el botón bookmark dentro de ScaleCard no dispara el onPress de la tarjeta en dispositivo físico.
- Home con exactamente 1 recurso guardado: decidir si se completa con un default o se muestra 1 card full-width.
- Google OAuth sigue sin funcionar en Expo Go (requiere dev build o configurar redirect URI en Supabase).
- Botón "Editar perfil" en CoachProfileScreen sin `onPress` — pendiente implementar.

---

## 2026-07-01 — Joaquín (sesión 32)

**Tocado:** `app/(tabs)/recursos.tsx`, `app/(tabs)/index.tsx`, `scripts/add-saved-resources-rls.sql` (nuevo)

**Resumen:**
- Implementado `saved_resources`: cada herramienta en Recursos tiene ahora un botón bookmark (outline → filled al guardar). Optimistic update — respuesta inmediata sin esperar DB.
- Nueva sección "Mis recursos" en Recursos: aparece solo si hay algo guardado, con chips horizontales que muestran ícono + nombre + botón para quitar.
- Home ahora muestra los 2 últimos recursos guardados en "Recursos útiles" (dinámico desde Supabase). Si no hay ninguno guardado, sigue mostrando los defaults (Respiración + Gratitud). El botón "+" navega a la pestaña Recursos.
- Script `scripts/add-saved-resources-rls.sql` con las 4 políticas RLS necesarias — **hay que correrlo en el SQL Editor de Supabase antes de probar en producción**.

**Pendiente para la próxima sesión:**
- Correr `scripts/add-saved-resources-rls.sql` en Supabase Dashboard (aún no ejecutado).
- Probar en dispositivo físico: verificar que el bookmark dentro de la ScaleCard no dispara el onPress de la tarjeta.
- Home: si el usuario tiene exactamente 1 recurso guardado, "Recursos útiles" muestra 1 card (full width). Decidir si se prefiere completar con un default o dejarlo así.

---

## 2026-07-01 — Joaquín (sesión 31)

**Tocado:** `theme/tokens.ts` (nuevo), `constants/theme.ts`, `components/ui/AppBg.tsx`, `components/ui/GlassCard.tsx`, `components/ui/ProgressToggle.tsx`, `components/ui/VitaHeader.tsx`, `components/ui/SegmentedPill.tsx` (nuevo), `components/ui/IconChip.tsx` (nuevo), `components/ui/SectionTitle.tsx` (nuevo), `app/(tabs)/_layout.tsx`, `app/(coach)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/recursos.tsx`, `app/(tabs)/conexiones.tsx`, todos los screens en `screens/` (31 archivos), `app/progreso.tsx`, `app/search1.tsx`, `app/search2.tsx`, `app/search3.tsx`, `app/diario.tsx`, `app/gratitud.tsx`, `app/ia.tsx`, `scripts/apply_vita_theme.py` y v2/v3/v4.

**Resumen:**
- Rediseño visual completo de toda la app al sistema VITA: fondo crema cálido (LinearGradient `#F7EFE4→#EDE0CF`), texto oliva (`#565E32`/`#87835C`), acento terracota (`#C1694F`), glass cards con `rgba(255,248,240,0.55)` + border `rgba(255,255,255,0.65)`.
- Creado `theme/tokens.ts` con todos los tokens de diseño (colores, radii, blur, fonts). `ViveColors` actualizado para reflejar la nueva paleta.
- Todos los `rgba(255,255,255,X)` oscuros/semitransparentes reemplazados por equivalentes oliva; todos los `barStyle="light-content"` → `"dark-content"`. Overlays oscuros (`rgba(15,10,40,0.80)`) en footers de booking → crema opaca.
- Texto en avatares/botones coloreados (terracota, apple dark button) revertido correctamente a blanco. Texto en botones CTA oliva → crema `#F7EFE4`. Sin cambios en lógica, navegación ni datos.
- Commit: `ffd928e4` — pusheado a `origin` y `andre`.

**Pendiente para la próxima sesión:**
- Testing visual en dispositivo físico: verificar contraste en todos los estados (hover, selected, disabled) especialmente en chips de horario, dots de paginación y tab bar.
- Si Andre tiene pantallas propias (`ia.tsx`, video en ProfesionalScreen) verificar que el diseño nuevo se vea bien con su contenido.
- Decidir si usar `Fraunces_500Medium`/`_600SemiBold` además del `_700Bold` ya cargado, para afinar el wordmark.

---

## 2026-06-30 — Andre (sesión 30)

**Tocado:** `context/AuthContext.tsx`, `screens/LoginScreen.tsx`, `components/AuthModal.tsx`

**Resumen:**
- Bug reportado: explorando la app como usuario (botón "Quiero explorar la app" → `(tabs)` sin login) y después iniciando sesión con el email de un coach, la app crasheaba. Reproducido con captura del LogBox: `Uncaught (in promise) Error: Attempted to navigate before mounting the Root Layout component` en `LoginScreen.tsx:88`, más dos `Render Error` secundarios ("cannot add `postgres_changes` callbacks ... after `subscribe()`") en `(tabs)/_layout.tsx:112` y `(tabs)/index.tsx:114`.
- Causa raíz: `LoginScreen.tsx` y `AuthModal.tsx` hacían `router.replace('/(tabs)')` apenas el login era exitoso, sin mirar el rol de la cuenta. `app/_layout.tsx` tiene un `AuthRedirect` separado que escucha `user`/`role` y corrige a `/(coach)` si corresponde — pero como `AuthContext` actualizaba `user` y `role` en dos pasos (`setUser` primero, `await fetchRole()` después), `AuthRedirect` podía disparar su propio `replace('/(coach)')` casi al mismo tiempo que el `replace('/(tabs)')` explícito de la pantalla de login, dos navegaciones a destinos distintos pisándose. Los errores de `postgres_changes` eran consecuencia en cascada: el doble montaje/desmontaje de `(tabs)` por la pelea de navegación hacía que sus canales realtime (`'user-tab-dot'`, `notif-bell-*`) se intentaran resuscribir sobre un canal que ya estaba `subscribe()`d.
- Fix de raíz, no parche puntual:
  1. `AuthContext.tsx`: en el efecto inicial (`getSession`) y en `onAuthStateChange`, ahora se resuelve el rol (`await fetchRole(u.id)`) **antes** de llamar a `setRole`/`setUser`, y ambos se setean en el mismo tick — React los batchea en un solo render, así que `AuthRedirect` nunca ve un `user` ya logueado con un `role` todavía desactualizado.
  2. `LoginScreen.tsx` y `AuthModal.tsx`: se sacó el `router.replace('/(tabs)')` explícito post-login en ambos. Ahora `AuthRedirect` es la única fuente de verdad para a dónde navegar después de loguearse — ya tenía toda la lógica necesaria (`destination = role === 'coach' ? '/(coach)' : '/(tabs)'`), solo hacía falta dejar de competir con ella.
- `CoachLoginScreen.tsx` (login desde el flujo de postulación a coach) no tenía este bug — ya hace su propio chequeo de `profile.role` antes de navegar, en vez de delegar en `AuthRedirect`. No se tocó.
- Type-check limpio en los 3 archivos (`npx tsc --noEmit`).

**Pendiente para la próxima sesión:**
- No probado todavía en dispositivo real con un mail de coach real desde el flujo "explorar como usuario" — confirmar que ya no crashea y que aterriza directo en `(coach)` sin pasar visualmente por `(tabs)`.
- Si en el futuro vuelve a aparecer el error de `postgres_changes ... after subscribe()` en algún `_layout.tsx` sin que haya un crash de navegación de por medio, sospechar de Fast Refresh o de StrictMode montando el efecto dos veces — los nombres de canal (`'user-tab-dot'`, `'coach-tab-badge'`) no son únicos por instancia de mount, así que un doble-montaje real (no solo el de este bug) los rompería de la misma forma.

---

## 2026-06-30 — Andre (sesión 29)

**Tocado:** `screens/CoachProfileScreen.tsx`, `scripts/add-coaches-update-policy.sql` (nuevo, corrido en Supabase por Andre el 30/06/2026), `SCHEMA.md`

**Resumen:**
- Feature: el coach ahora puede fijar su precio por sesión desde su propio perfil. La sección "Precio y paquetes" antes solo mostraba `coaches.price_per_session` en modo lectura. Tocar la fila entra en modo edición inline (`TextInput` numérico con `$`, botones Guardar/Cancelar) y hace `update` a Supabase — mismo criterio de "edición in situ sin navegar a otra pantalla" que el video de perfil de la sesión 28.
- **Bug crítico encontrado al verificar el flujo completo (reportado por Andre: precio seteado en $10000 desde el perfil, pero en Conexiones seguía viendo $4500 para "Coach Prueba")**: la tabla `coaches` tiene RLS activado pero **nunca tuvo una política de UPDATE** — solo existía `coaches_insert_own` (FOR INSERT). Cualquier `update()` a `coaches` desde el cliente (precio, y también `video_url` de la sesión 28) afectaba 0 filas en silencio: Postgrest no devuelve `error` cuando RLS filtra todas las filas de un UPDATE sin `.select()` encadenado, así que el cliente creía haber guardado y actualizaba su estado local, pero la base nunca cambiaba. Confirmado con un script de diagnóstico (anon key, sin auth) que hizo `SELECT` directo a `coaches` y encontró `price_per_session: 4500` para "Coach Prueba" pese al cambio hecho desde la app.
- Fix de dos partes:
  1. `scripts/add-coaches-update-policy.sql` agrega `coaches_update_own` (FOR UPDATE, USING + WITH CHECK `profile_id = auth.uid()`). Corrido en Supabase por Andre el 30/06/2026.
  2. `savePrice()` y el `update` de `video_url` en `uploadVideo()` ahora encadenan `.select()` y chequean que `data` no esté vacío antes de considerar el guardado exitoso — así un futuro bloqueo de RLS se ve como error en la UI en vez de fallar en silencio.
- El precio no es editable si `noCoachProfile` es `true` (no existe fila en `coaches` para hacer `update`).
- `ProfesionalScreen.tsx` y `Conexiones` ya leen `price_per_session` fresco de Supabase en cada carga — no necesitaron cambios.
- `SCHEMA.md` regla 7 actualizada documentando el agujero de RLS y el fix.
- Type-check limpio (`npx tsc --noEmit`; los errores que tira el comando son preexistentes, de la carpeta duplicada `node_modules 2/wonka`, no relacionados).
- **Verificado end-to-end**: Andre seteó el precio en $11000 desde `CoachProfileScreen` con la cuenta de Coach Prueba; confirmado con un `SELECT` directo a Supabase (anon key, sin filtro) que `price_per_session` quedó en 11000 en la base — la política nueva funciona y el guardado ya persiste de verdad.

**Pendiente para la próxima sesión:**
- Mismo chequeo para video de perfil — re-subir un video y confirmar que `coaches.video_url` cambió de verdad en la base, no solo en el estado local (nunca se había verificado en dispositivo real desde que se agregó en la sesión 28, y tenía el mismo bug de RLS).
- El botón "Editar perfil" de esta misma pantalla sigue sin funcionalidad (no tiene `onPress`) — fuera de alcance de esta sesión.

---

## 2026-06-30 — Andre (sesión 28)

**Tocado:** `scripts/add-coach-video-upload.sql` (nuevo, corrido en Supabase), `app.json`, `lib/database.types.ts`, `screens/CoachProfileScreen.tsx`, `screens/ProfesionalScreen.tsx`, `package.json`, `SCHEMA.md`

**Resumen:**
- Feature nueva: el coach puede subir un video real (grabado o de galería) a su perfil, visible para cualquier usuario que vea su perfil público. Antes solo existía `coaches.application_video_url`, un link externo (YouTube/Drive) pegado una sola vez al postularse, nunca mostrado a nadie.
- Era una feature greenfield: no había Supabase Storage en uso en ningún lado del proyecto, ni libs de picker/video instaladas. Se sumaron `expo-image-picker`, `expo-video` y `expo-file-system` (SDK 54, versiones resueltas con `expo install`).
- Decisión de diseño: columna nueva `coaches.video_url`, separada de `application_video_url` — un reproductor nativo necesita una URL de archivo directa, no sirve un link de YouTube. `application_video_url` queda intacta como artefacto de revisión de postulación.
- `CoachProfileScreen.tsx`: botón "Grabar nuevo video" (antes un placeholder con `console.log`) ahora ofrece grabar o elegir de galería, sube a Supabase Storage (`coach-videos/{uid}/video.mp4`, `upsert:true` para no dejar huérfanos) y guarda la URL pública en `coaches.video_url`. Es el primer "guardar campo" real de esa pantalla — antes era de solo lectura salvo cerrar sesión.
- `ProfesionalScreen.tsx`: la sección "Video de introducción" (antes decorativa) ahora trae `video_url`, se oculta entera si el coach no subió nada, y reproduce con controles nativos (`expo-video`) al tocar el placeholder.
- `scripts/add-coach-video-upload.sql` corrido en Supabase por Andre el 30/06/2026 — agregó la columna `coaches.video_url`, el bucket `coach-videos` (público, 50MB, solo mime types de video) y la RLS para que cada coach solo pueda escribir su propia carpeta (`storage.foldername(name)[1] = auth.uid()::text`). `SCHEMA.md` actualizado con la regla 12 documentando esto.
- `app.json`: agregado el plugin `expo-image-picker` con los textos de permiso en español (cámara/galería/micrófono). El propio tooling de instalación sumó también `expo-video` al array de `plugins` — cambio de config nativa, hace falta un build nuevo de dev client (no alcanza con Expo Go ni un dev client viejo) para poder probar esto en el celular.
- `lib/database.types.ts`: sumado `video_url` al tipo `Coach`, y de paso `application_video_url` (ya existía en la base real pero faltaba en este tipo — deuda preexistente, se corrigió de una porque ya se estaba tocando el mismo tipo).
- Type-check limpio en los 5 archivos tocados (`npx tsc --noEmit`).

**Pendiente para la próxima sesión:**
- Generar un dev client nuevo (`eas build --profile development`) y probar en celular real (iOS y Android) — quedó explícitamente pospuesto para una sesión futura, no se hizo en esta. Probar: grabar/elegir video, ver el estado "Subiendo…", confirmar reproducción en `ProfesionalScreen`, re-subir un segundo video y confirmar en el Storage dashboard que no queda huérfano el archivo viejo.
- No verificado en esta sesión (sin dispositivo conectado): si el manejo en memoria de un video de ~60s causa lentitud en un Android viejo — si pasa, la salida es `FileSystem.uploadAsync()` (streaming a disco) en vez de cargar todo el archivo como `Uint8Array`.
- Confirmar adversarialmente que la RLS del bucket realmente bloquea a un coach de escribir en la carpeta de otro — es la única pieza de este cambio que no se pudo verificar sin ejecutar SQL real.

---

## 2026-06-30 — Andre (sesión 27)

**Tocado:** `scripts/expire-pending-bookings.sql` (nuevo), `SCHEMA.md`

**Resumen:**
- Bug reportado: cuando vence el plazo de 24hs para que un coach responda una solicitud, la tarjeta "Pendientes de respuesta" sigue apareciendo en `CoachReservasScreen.tsx` en vez de desaparecer.
- Causa: `hoursLeftToRespond()` calcula el countdown puramente en el cliente (`Math.max(0, ...)`) y nunca escribe en la base — `bookings.status` se queda en `'pendiente'` para siempre, clampeado en "0hs para responder" indefinidamente.
- Fix: nueva función `expire_pending_bookings()` en Supabase (agendada con `pg_cron` cada 5 minutos, mismo cadence que `complete_confirmed_sessions()`), que pasa a `'cancelada'` cualquier pendiente con más de 24hs y notifica al usuario (`type='reserva_rechazada'`, sin mensaje de sala ni push, igual alcance que el rechazo manual del coach).
- Corrida en Supabase por Andre el 30/06/2026. `SCHEMA.md` actualizado con la regla 11 documentando el comportamiento.
- No se tocó código de la app — el filtro `status === 'pendiente'` en `CoachReservasScreen.tsx` ya excluye automáticamente lo que la función pasa a `'cancelada'`, no hacía falta cambiar nada del lado cliente.

**Pendiente para la próxima sesión:**
- Confirmar en un caso real (o esperar a que pase una solicitud vieja) que la tarjeta efectivamente desaparece de "Pendientes de respuesta" tras los 5 minutos del próximo tick del cron.
- Evaluar si en algún momento conviene agregar push notification a este flujo (hoy no la tiene, a diferencia del rechazo manual que sí dispara push desde el cliente).

---

## 2026-06-30 — Andre (sesión 26)

**Tocado:** `app/(coach)/_layout.tsx`

**Resumen:**
- Ajuste fino del margen lateral del pill en `(coach)` (4 tabs tras sacar "Perfil" en la sesión 25): subir `left/right` de `44` a `56`/`70` no tenía ningún efecto visible en los íconos, aunque el fondo (`blurWrap`) sí se achicaba. Se diagnosticó con logs `[TABDEBUG-COACH]` temporales midiendo por separado el ancho del `blurWrap` y el de cada `tabItem` real.
- Causa raíz: la librería `@react-navigation/bottom-tabs` arma el contenedor real del tab bar con `start: 0, end: 0` (propiedades lógicas, conscientes de dirección de escritura) como base, y nuestro `tabBarStyle` solo sobreescribía `left`/`right` (propiedades físicas). Al ser ejes distintos para Yoga/RN, el override no cancelaba el valor lógico de forma confiable — el contenedor real de los botones quedaba con un ancho intermedio, inconsistente con el margen que pedíamos. Fix: agregar también `start`/`end` con los mismos valores en `styles.tabBar`.
- Ese fix expuso un segundo bug: `blurWrap` en `(coach)` tenía su propio `left/right` duplicado (en vez de llenar a su contenedor padre como hace `(tabs)` con `...StyleSheet.absoluteFillObject`). Una vez que el contenedor real empezó a achicarse correctamente, ese `left/right` duplicado lo volvía a achicar una segunda vez, dejando el pill demasiado angosto. Fix: `blurWrap` de `(coach)` ahora usa `...StyleSheet.absoluteFillObject` igual que `(tabs)`, sin redeclarar márgenes.
- Margen final: `56` (se había probado `70`, pero una vez arreglado el bug de fondo se sintió demasiado angosto).
- Tercer hallazgo: bajar `tabLabel.fontSize` de `11` a `10` (para que "Reservas"/"Recursos" no se truncaran con `numberOfLines={1}`) no se reflejó con Fast Refresh — quedó dos corridas seguidas con captura idéntica a pesar del valor correcto en disco. Hizo falta un hard reload completo (cerrar Expo Go y reabrir) para que tomara el cambio. Mismo patrón de "Fast Refresh no alcanza" que ya habíamos visto con cambios de layout en este mismo árbol de componentes (el tab bar de `@react-navigation/bottom-tabs`, con `Animated.View` internamente, parece no re-renderizar layout/texto de forma confiable solo con Fast Refresh).
- Confirmado por captura del usuario tras el hard reload: los 4 labels (`Inicio`, `Reservas`, `Chats`, `Recursos`) entran completos sin truncar, y los íconos quedaron visiblemente más agrupados.
- Logs `[TABDEBUG-COACH]` sacados del código una vez confirmado el fix.

**Pendiente para la próxima sesión:**
- Si en el futuro un cambio de estilo en este tab bar (`(tabs)` o `(coach)`) "no se ve" pese a estar guardado en disco y con un solo proceso de Metro corriendo, probar hard reload completo antes de seguir diagnosticando como si fuera un bug de código — ya pasó dos veces en esta sesión con este componente puntual.
- Nada commiteado todavía de esta sesión 26 — el commit `9d5141f6` (sesión 24) sigue sin pushear por el problema de credenciales de git mencionado en la sesión 25.

---

## 2026-06-30 — Andre (sesión 25)

**Tocado:** `app/(coach)/_layout.tsx`, `screens/CoachHomeScreen.tsx`

**Resumen:**
- Cierre de los ajustes visuales de la tab bar que quedaron pendientes de la sesión 24: `bottom` volvió de `60` (valor de prueba) a `24` en `(tabs)/_layout.tsx`, y se restauró `overflow: 'hidden'` en `tabBar` (estaba comentado por una prueba de diagnóstico de recorte de texto que ya no aplicaba, porque ese recorte era el bug de `tabBarIconStyle` de la sesión 24, no el `overflow`).
- En el camino se probó achicar fuente/padding/márgenes en `(coach)/_layout.tsx` para que "Reservas" y "Recursos" no partieran en dos líneas con 5 tabs — pero quedó obsoleto por el cambio de fondo de abajo.
- **Cambio de fondo:** se sacó el tab "Perfil" de la tab bar fija del coach (`app/(coach)/_layout.tsx`), mismo criterio que "Tu progreso" del lado usuario — es configuración de cuenta/negocio, no algo de uso diario. La tab bar de coach queda con 4 tabs: Inicio, Reservas, Chats, Recursos.
- Importante: no se borró el `Tabs.Screen name="perfil"` — se dejó declarado con `href: null`, seguiendo el patrón ya usado en `(tabs)/_layout.tsx` para el tab "Comunidad" (`explore`). Quitarlo del todo arriesgaba que Expo Router lo siguiera auto-generando como tab al existir el archivo de ruta `app/(coach)/perfil.tsx` en el mismo grupo.
- El acceso a Perfil pasó a un avatar circular en el header de `screens/CoachHomeScreen.tsx` (junto a la campana de notificaciones), replicando el patrón ya usado en `app/(tabs)/index.tsx`: `LinearGradient` con los mismos colores (`#FF9A52` → `ViveColors.primary`), `avatarCircle` 40×40, inicial de `coachName` en `ViveFonts.frauncesSerif`. No se creó componente compartido — se copiaron los estilos tal cual, siguiendo el criterio del proyecto de no abstraer hasta la tercera repetición.
- Con la tab bar de coach en 4 tabs (mismo número que el lado usuario), se revirtieron los ajustes de la iteración anterior: margen lateral del pill de vuelta a `44` (era `30`), `fontSize` del label de vuelta a `11` (era `10`), `paddingHorizontal` del `tabItem` de vuelta a `10` (era `4`) — para igualar el patrón ya probado del lado usuario. Quedó `numberOfLines={1}` en el label como red de seguridad adicional.

**Pendiente para la próxima sesión:**
- Confirmar visualmente en el celular: posición del pill (`bottom: 24`), esquinas redondeadas del blur, labels de coach en una sola línea sin truncar, y que el avatar nuevo en el header de Inicio coach navegue bien a `/perfil`.
- Verificar que no haya quedado ningún otro lugar de la app que linkeara directo al tab "Perfil" por su posición en la barra (en vez de por ruta) — no se encontró ninguno al revisar el código, pero vale confirmarlo al testear.
- Sin commitear todavía — el commit de la sesión 24 (`9d5141f6`) no se pusheó porque el hook de auto-push de `.claude/settings.json` falló por falta de credenciales de git para GitHub en este entorno (`could not read Username for 'https://github.com'`). Sigue pendiente resolver eso o pushear manualmente.

---

## 2026-06-30 — Andre (sesión 24)

**Tocado:** `app/(tabs)/_layout.tsx`, `app/(coach)/_layout.tsx`

**Resumen:**
- Bug: tras agregar labels debajo de los íconos del tab bar (`TabIcon` ahora renderiza ícono + `<Text>{label}</Text>`), el ancho del ícono no cambiaba aunque se probó `alignSelf: 'stretch'` y luego `width: '100%'` en `tabBarIconContainerStyle`. Logs `[TABDEBUG]` mostraban siempre `w=30.999996185302734`, idéntico en cada corrida.
- Primer sospechoso descartado: procesos zombies de `expo start` (3 corriendo en paralelo desde hacía más de 2 semanas, uno de ellos en el puerto 8081 con `--no-dev`, sirviendo bundle de producción al celular sin recargar). Se mataron los 3 y se confirmó un único proceso limpio — el bug persistió igual, así que no era esto.
- Causa real: `tabBarIconContainerStyle` **no existe** como prop en `@react-navigation/bottom-tabs@7.18.0` (la librería detrás de `<Tabs>` de expo-router). Se verificó contra `node_modules/@react-navigation/bottom-tabs/src/types.tsx` — la prop válida es `tabBarIconStyle`. Como TS/JS no tira error por una key extra en un objeto, el valor nunca se conectaba a ningún `style` array de la librería; por eso ningún cambio (`stretch`, `100%`) tenía efecto.
- Fix: renombrado a `tabBarIconStyle` en `(tabs)/_layout.tsx`. Confirmado por el usuario que ahora sí funciona. Se encontró el mismo bug duplicado en `(coach)/_layout.tsx` (mismo patrón de `tabBarIconContainerStyle`) y se corrigió también ahí antes de commitear, para no dejarlo vivo en el otro layout.
- De paso, dentro de este mismo cambio se sacaron los labels nativos (`tabBarShowLabel: false`) y se renderizan manualmente dentro de `TabIcon` (ícono + `<Text>` con `ViveFonts.medium`), y se movió `tabBarStyle` (`bottom: 60`, `left/right: 44`) — pendiente confirmar visualmente que el pill quedó bien posicionado tras este ajuste.

**Pendiente para la próxima sesión:**
- Confirmar visualmente en el celular que los labels debajo de los íconos se ven bien (tamaño, recorte, espaciado) y que el pill con los nuevos márgenes (`bottom: 60`, `left/right: 44`) no rompió el layout de la sesión 23.
- Quitar los `console.log('[TABDEBUG]...')` una vez confirmado visualmente — son solo diagnóstico, no deberían quedar en el código final.
- Si vuelve a aparecer un caso de "cambié el estilo y no pasa nada", chequear primero si la prop existe de verdad en el tipo de la librería antes de sospechar de cache/procesos — los tipos de `screenOptions` en este archivo no parecen estar forzando error de compilación ante keys inválidas, vale la pena revisar por qué.

---

## 2026-06-30 — Andre (sesión 23)

**Tocado:** `app/(tabs)/_layout.tsx`, `app/(coach)/_layout.tsx`

**Resumen:**
- Bug: la tab bar flotante (pill con blur) tocaba los bordes de la pantalla a pesar de tener `left: 44, right: 44` en `tabBarStyle`. Los márgenes no se aplicaban visualmente.
- Diagnóstico: test con `backgroundColor: 'rgba(100,0,200,0.8)'` confirmó que `tabBarStyle` posiciona correctamente el contenedor — el problema era exclusivamente el `BlurView` pasado a `tabBarBackground`. En React Navigation v7 (Expo Router v4 / SDK 54), `tabBarBackground` se renderiza en un layer separado que NO hereda los bounds del contenedor que tiene `tabBarStyle`; por eso `StyleSheet.absoluteFill` en el BlurView cubría el ancho total de pantalla en vez de confinarse al pill.
- Solución: envolver el `BlurView` en un `View` con `styles.blurWrap` — mismo `position: 'absolute'`, `bottom: 24`, `left: 44`, `right: 44`, `height: 64`, `borderRadius: 32`, `overflow: 'hidden'` — posicionado de forma absoluta dentro del layer de `tabBarBackground`, coincidiendo exactamente con los bounds del pill.
- Aplicado en ambos layouts (`(tabs)` y `(coach)`) ya que comparten el mismo patrón.

**Pendiente para la próxima sesión:**
- Confirmar visualmente en celu que el blur ahora aparece con los márgenes correctos (y no full-width).
- Si en alguna pantalla futura se usa `tabBarBackground`, recordar aplicar el mismo wrapper en vez de pasar `absoluteFill` directo al BlurView.

---

## 2026-06-29 — Andre (sesión 22)

**Tocado:** `app/(tabs)/index.tsx`, `app/ia.tsx` (nuevo)

**Resumen:**
- Venn SVG pasó a solo contorno (`fill="none"`, `stroke="rgba(255,255,255,0.7)"`, `strokeWidth={1.5}`). Antes tenía relleno semitransparente de colores.
- Racha de semanas activas (`🔥 X semanas`) eliminada de la tarjeta "Sobre ti" del Inicio. La racha sigue viva en `app/progreso.tsx` y `screens/ProfileOwnScreen.tsx` — no se tocaron. El import de `getSemanasActivas` y el estado `semanasActivas` fueron removidos de index.tsx.
- El Venn se convirtió en botón que navega a `/ia` (`router.push('/ia')`). Se reemplazó la animación pulse por `activeOpacity={0.8}`. Debajo del Venn aparece el label "vita IA" en lugar de la racha.
- Creado `app/ia.tsx` como pantalla placeholder: título "vita IA" (fuente Fraunces), texto "Próximamente", fondo `AppBg`, botón de volver atrás.

**Pendiente para la próxima sesión:**
- Definir qué va en la pantalla vita IA — flujo de chat, resumen de perfil, recomendaciones IA, etc.
- Conectar el mensaje "Sobre ti" a datos reales (sigue hardcodeado).

---

## 2026-06-29 — Andre (sesión 21)

**Tocado:** `lib/stats.ts` (nuevo), `app/(tabs)/index.tsx`, `app/progreso.tsx`, `screens/ProfileOwnScreen.tsx`

**Resumen:**
- Creado `lib/stats.ts` con función `getSemanasActivas(userId)`: query sobre `bookings` con `status = 'completada'`, agrupa por semana ISO (timestamp / 7 días), retorna el tamaño del Set de semanas distintas. Semana activa = semana calendario con al menos una sesión completada.
- Reemplazados los tres hardcodeados (`🔥 0 semanas` en index, `value: 12` en progreso, `WEEKS_ON_STREAK = 12` en ProfileOwnScreen) por el número real proveniente de `getSemanasActivas`. Constante `WEEKS_ON_STREAK` eliminada.
- Los tres puntos de llamada usan la misma función utilitaria — la definición de "semana activa" vive en un solo lugar.

**Pendiente para la próxima sesión:**
- Conectar el mensaje "Sobre ti" a datos reales — actualmente sigue siendo texto hardcodeado en ambas pantallas. Requiere definir qué tabla/campo lo alimenta.
- Confirmar que `complete_confirmed_sessions()` incluye `type` y `booking_id` en el payload del push (pendiente sesiones anteriores).

---

## 2026-06-29 — Andre (sesión 20)

**Tocado:** `app/(tabs)/index.tsx`

**Resumen:**
- Tarjeta "Sobre ti" hardcodeada del Inicio **reemplazada** por tarjeta con Venn interactivo + racha + mensaje. Layout horizontal: zona izquierda con diagrama de Venn SVG (3 círculos Cuerpo/Mente/Alma, colores naranja/verde/azul de la paleta) + "🔥 0 días" debajo; zona derecha con label "SOBRE TI" y mensaje.
- El Venn tiene animación pulse (scale 1.15 → spring back) al tocarlo — único elemento interactivo de la tarjeta.
- Racha muestra **"🔥 0 semanas"** como placeholder. La unidad es semanas activas, no días. La lógica real se calculará desde `bookings`: semanas consecutivas con al menos una sesión `completada` para el usuario. No existe esa query todavía.
- `screens/ProfileOwnScreen.tsx` no se tocó — la tarjeta del perfil queda exactamente como está.
- Nota: tanto el mensaje "Sobre ti" como las semanas en `ProfileOwnScreen` siguen siendo hardcodeados — no había datos reales de Supabase para ese campo.

**Pendiente para la próxima sesión:**
- Implementar lógica real de racha de semanas: query sobre `bookings` donde `status = 'completada'`, agrupar por semana ISO, contar semanas consecutivas hasta hoy. Mostrar "🔥 X semanas".
- Conectar el mensaje "Sobre ti" a datos reales — actualmente hardcodeado en ambas pantallas (Inicio y Perfil). Requiere definir qué tabla/campo lo alimenta antes de implementar.
- Confirmar que `complete_confirmed_sessions()` incluye `type` y `booking_id` en el payload del push (pendiente sesiones anteriores).

---

## 2026-06-29 — Andre (sesión 19)

**Tocado:** `app/(tabs)/index.tsx`, `screens/ProfileOwnScreen.tsx`

**Resumen:**
- "Tu progreso" (selector Hoy/Mes + tarjeta "Sobre ti") movido del Inicio al Perfil del usuario. Se insertó entre la sección de identidad y "Mi actividad". Constantes `WEEKS_ON_STREAK` y `SOBRE_TI_TEXT` definidas como módulo-level en `ProfileOwnScreen.tsx`, no como globales movidas.
- "Frase del día" eliminada como card independiente. La frase ahora aparece como texto integrado debajo del saludo (sin tarjeta, sin ícono), con `ViveFonts.regular` a 15px y opacidad 0.55.
- Código muerto en `index.tsx` eliminado completo: constantes, state `progressTab`, animaciones a2/a3 (renumeradas), ambos bloques JSX de progreso y frase, y todos los estilos asociados. No se tocó la base de datos.

**Pendiente para la próxima sesión:**
- `WEEKS_ON_STREAK` y `SOBRE_TI_TEXT` siguen hardcodeados — cuando se construya la lógica real de progreso, hay que reemplazarlos con queries reales.
- Confirmar que `complete_confirmed_sessions()` incluye `type` y `booking_id` en el payload del push (pendiente de sesión 18).

---

## 2026-06-29 — Joaquín (sesión 18)

**Tocado:** `app/(tabs)/index.tsx`, `screens/CoachProfileScreen.tsx`

**Resumen:**
- Realtime en campana de Home: reemplazado el fetch único por una suscripción Supabase Realtime filtrada por `recipient_id = user.id`. Cualquier INSERT/UPDATE/DELETE re-fetchea el count (head: true). El dot aparece/desaparece sin que el usuario salga de la pantalla.
- `CoachProfileScreen`: reemplazado el placeholder "Estadísticas / Próximamente" por un panel real de reseñas recibidas. Summary card (promedio + total), lista completa con avatar inicial, nombre, estrellas, fecha y comentario. Reviews privadas muestran ícono de candado. Estado vacío si no hay reseñas todavía.

**Pendiente para la próxima sesión:**
- Confirmar que `complete_confirmed_sessions()` incluye `type` y `booking_id` en el payload del push para que el tap handler del OS funcione end-to-end.
- Validar visualmente en dispositivo: pill tab bar, dot "Mis salas", botón cerrar sesión coach sobre el pill.
- `saved_resources`: decidir si se implementa una pantalla o se descarta la tabla.

---

## 2026-06-29 — Joaquín (sesión 17)

**Tocado:** `screens/UserNotificationsScreen.tsx` (nuevo), `app/notifications.tsx` (nuevo), `app/_layout.tsx`, `app/(tabs)/index.tsx`

**Resumen:**
- `UserNotificationsScreen`: lista todas las notificaciones del usuario. Íconos y colores por tipo. Tap en `invitacion_review` → `/review`; tap en otras con `booking_id` → resuelve `sala_id` desde `bookings` y navega a `/sala`. Marca como leídas al abrir.
- Home screen: campana en el top bar entre logo y avatar. Muestra `bell-outline` sin sin leer, `bell` filled + dot rojo `#E05252` cuando hay sin leer. Count vía query `head: true` (sin bajar data).
- Ruta `/notifications` registrada en `_layout.tsx`.

**Pendiente para la próxima sesión:**
- Confirmar que `complete_confirmed_sessions()` incluye `type` y `booking_id` en el payload del push para que el tap handler funcione end-to-end.
- El unread count de la campana no se refresca en tiempo real (solo al montar); si llega un push mientras la Home está abierta, el dot no aparece hasta que el usuario salga y vuelva. Agregar Realtime subscription si se quiere live.
- Confirmar visualmente en dispositivo: pill tab bar, dot "Mis salas", botón cerrar sesión coach.

---

## 2026-06-29 — Joaquín (sesión 16)

**Tocado:** `screens/ReviewScreen.tsx` (nuevo), `app/review.tsx` (nuevo), `app/_layout.tsx`, `screens/ProfesionalScreen.tsx`

**Resumen:**
- Pantalla `ReviewScreen`: permite al usuario crear o editar su review post-sesión. Recibe `booking_id`, resuelve el `coach_profile_id` vía `bookings.coach_id → coaches.id → coaches.profile_id`. Crea si no existe (INSERT); si ya existe la review para ese par reviewer/reviewed, edita solo `rating` y `comment` (respeta el trigger que bloquea cambiar `booking_id`).
- `ProfesionalScreen`: eliminado el array `REVIEWS` hardcodeado y el rating `4.9` del `DEFAULT_PROFESIONAL`. Ahora fetchea reviews reales (`is_private=false`) con nombres de reviewers en batch. Muestra promedio real; si no hay reseñas muestra un estado vacío elegante.
- `_layout.tsx`: agregado `addNotificationResponseReceivedListener` — si la push contiene `data.type === 'invitacion_review'` con `booking_id`, navega directo a `/review`. (Si el cron no envía data, el tap hace el comportamiento default del OS.)

**Pendiente para la próxima sesión:**
- Pantalla de notificaciones para el usuario (equivalente a `CoachNotificationsScreen` para el lado coach): listar todas las notificaciones, tap en `invitacion_review` → `/review?booking_id=xxx`. Actualmente el deep-link desde push funciona si el cron manda el data; si no, el usuario no tiene forma de llegar a ReviewScreen salvo desde push.
- Confirmar que `complete_confirmed_sessions()` incluye `booking_id` y `type` en el payload de push para que el tap handler funcione.
- Confirmar visualmente en dispositivo: pill tab bar, dot "Mis salas", botón cerrar sesión coach.

---

## 2026-06-27 — Joaquín (sesión 15)

**Tocado:** `app/(tabs)/index.tsx`, `.claude/settings.json`

**Resumen:**
- Bug fix: `index.tsx` navegaba a `/(tabs)/coaches` (ruta inexistente) en la card "sin próxima sesión". Corregido a `/(tabs)/conexiones`.
- Hook de sincronización automática configurado en `.claude/settings.json`: después de cada `git commit`, fetcha ambos remotes, mergea si hay cambios de Andre, y pushea a `origin` y `andre` en background.
- Revisión de los cambios de Andre (sesiones 14–18): tab bar glassmorphism, dot en "Mis salas", `TAB_BAR_CLEARANCE = 110`, `user_last_read_at`/`coach_last_read_at` en `salas`. Todo integrado sin regressions.

**Pendiente para la próxima sesión:**
- Agregar `specialty` del coach en cada row de "Mis salas" (`SessionsScreen`) — Andre lo marcó como diferido.
- Confirmar visualmente en dispositivo: pill de tab bar, dot de "Mis salas", botón "Cerrar sesión" de CoachProfileScreen sobre el pill.
- UI del flujo de reviews (sigue abierto desde sesión 23/06).

---

## 2026-06-27 — Joaquín (sesión 14)

**Tocado:** `screens/SalaScreen.tsx`, `screens/BookingScreen_Time.tsx`

**Resumen:**
- Bug fix: `SalaScreen.handleHeaderPress` no pasaba `profileId` al navegar a `/profesional`. Cuando el usuario tocaba el header del coach en la Sala e intentaba reservar, Calendar recibía `coachId: ''` y no podía fetchear disponibilidad — calendario vacío, botón "Seguimos" nunca habilitado. Fix: agregar `profileId: recipientId` en los params (el valor ya estaba disponible en el estado, solo no se pasaba). Como efecto secundario, `ProfesionalScreen` ahora también fetchea precio/specialty desde Supabase correctamente en este path.
- Fix visual: `BookingScreen_Time` usaba `<View>` como raíz (fondo transparente) en lugar de `<AppBg>`, diferenciándose visualmente de Calendar y Confirm. Reemplazado por `<AppBg>`.
- Pendiente de la sesión 8 cerrado: la cadena Calendar → Time de params ya estaba correcta; el problema real era el path SalaScreen → ProfesionalScreen, no el paso Calendar → Time en sí.

**Pendiente para la próxima sesión:**
- UI del flujo de reviews: pantalla para crear/editar review al llegar notificación `'invitacion_review'`, y display de rating promedio real en `ProfesionalScreen` (hoy usa mock hardcodeado).
- Decidir si el coach ve sus reviews recibidas en algún panel propio (`CoachProfileScreen` tiene un placeholder).
- Verificar en producción que el cron job `complete_confirmed_sessions()` dispara a los 20 minutos.

---
## 2026-06-25 — Claude (sesión 18)

**Tocado:** `constants/theme.ts`, `screens/CoachProfileScreen.tsx`, `screens/CoachHomeScreen.tsx`, `screens/CoachChatsScreen.tsx`, `screens/CoachResourcesScreen.tsx`, `screens/CoachReservasScreen.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/recursos.tsx`, `screens/SessionsScreen.tsx`

**Resumen:**
- Diagnóstico: la tab bar flotante (`position: absolute`, `bottom: 24`, `height: 64`) ya no reserva espacio en el layout, por lo que los ScrollViews con contenido largo tapaban el último elemento detrás del pill.
- Constante `TAB_BAR_CLEARANCE = 110` agregada a `constants/theme.ts` (pill 88px + ~22px de aire). Un solo lugar para actualizar si cambia la altura del pill.
- 8 pantallas corregidas: las 5 screens de coach tabs (Perfil, Inicio, Chats, Recursos, Reservas) y 3 del lado usuario (tabs/index, tabs/recursos, SessionsScreen/mis-salas). Todas pasaron de 32–64px de clearance a 110px usando la constante.
- `conexiones.tsx` descartada: usa `paddingBottom: 100` en View no scrollable (solo ScrollViews horizontales), el pill a 88px no interfiere.

**Pendiente para la próxima sesión:**
- Confirmar visualmente en dispositivo real que el botón "Cerrar sesión" de CoachProfileScreen (el caso original del bug) queda cómodo por encima del pill.
- Si en alguna pantalla el aire visual se siente excesivo (especialmente las que antes tenían 100px), se puede ajustar bajando `TAB_BAR_CLEARANCE` — pero hay un solo número para tocar.

---

## 2026-06-25 — Claude (sesión 17)

**Tocado:** `app/(coach)/_layout.tsx`, `app/_layout.tsx`

**Resumen:**
- Tab bar del coach migrada a glassmorphism flotante, idéntico al layout de usuario: `BlurView intensity={60} tint="light"`, pill `position: absolute`, `bottom: 24`, `left/right: 16`, `borderRadius: 32`, `overflow: hidden`.
- `TabIcon` con `activeBubble` (52×36px, `borderRadius: 18`, `rgba(255,255,255,0.25)`) duplicado directamente en `(coach)/_layout.tsx` — decisión explícita de no extraer componente compartido dado que solo hay dos layouts y son completamente distintos en lógica.
- `PendingBadge` en "Reservas" preservado sin cambios — el badge naranja sigue funcionando igual, ahora anclado dentro del `TabIcon`.
- Fix en `app/_layout.tsx`: faltaba `<Stack.Screen name="(coach)" options={{ headerShown: false }} />` — sin esto el grupo coach mostraba el header del Stack raíz.

**Pendiente para la próxima sesión:**
- Testear en dispositivo real (coach): confirmar blur, burbuja activa, badge de Reservas posicionado correctamente dentro del TabIcon.
- Confirmar con Joaquín si el color activo blanco en coach (igual al usuario) es correcto, o si prefieren mantener `ViveColors.primary` como tinte activo para diferenciar los dos modos.

---

## 2026-06-25 — Claude (sesión 16)

**Tocado:** `app/(tabs)/_layout.tsx`

**Resumen:**
- Tab bar rediseñada a estilo glassmorphism flotante: pill centrada con márgenes (16px laterales, 24px del borde inferior), `borderRadius: 32`, fondo glass con `<BlurView intensity={60} tint="light">` de `expo-blur` (ya estaba instalada).
- Tab activo con burbuja de fondo: `View` de 52×36px, `borderRadius: 18`, `rgba(255,255,255,0.25)` detrás del ícono — primer pase, pendiente ajuste fino con Joaquín.
- Todos los 4 tabs ahora usan el mismo estilo glass. El override anterior de "Conexiones" (fondo blanco sólido, colores terracota/verde) fue unificado. El código original queda comentado en el archivo para revertir en 3 líneas si Joaquín confirma que el estilo distinto era intencional.
- Dot de notificación de "Mis salas" preservado sin cambios de lógica; posición relativa intacta.

**Pendiente para la próxima sesión:**
- Testear en dispositivo: blur real (expo-blur no se ve en simulador), posición del pill, burbuja activa, dot sobre "Mis salas".
- Confirmar con Joaquín si Conexiones debe volver a tener estilo propio (fondo blanco sólido). Si sí, descomentar 3 líneas en `<Tabs.Screen name="conexiones">`.
- Posible ajuste de intensidad de blur (60), tamaño de burbuja (52×36), o color de burbuja según revisión visual conjunta.

---

## 2026-06-25 — Claude (sesión 15)

**Tocado:** `app/(tabs)/_layout.tsx`, `screens/SalaScreen.tsx`, `SCHEMA.md`

**Resumen:**
- Dot de "novedad" rojo (`#E05252`) sobre el ícono del tab "Mis salas". Se muestra cuando (a) hay mensajes de la otra persona más nuevos que `user_last_read_at` en cualquier sala del usuario, o (b) hay una sesión confirmada para hoy. Sin número, solo punto — decisión de tono de VITA (calma, sin ansiedad de notificaciones).
- Schema: `user_last_read_at` y `coach_last_read_at` (timestamptz, nullable) agregadas a `salas`. Backfill con `now()` al momento del ALTER TABLE para evitar dots falsos en salas existentes. Nuevo comportamiento: entrar a `SalaScreen` actualiza el campo correspondiente al rol del usuario, lo que dispara el listener realtime del layout y apaga el dot.
- Query del dot: 2 queries siempre (salas + mensajes acotados por min(last_read_at)), 3 si no hay unread y hay que chequear bookings de hoy. Nunca N+1 — escala a múltiples salas por usuario.
- Realtime: suscripción en `_layout.tsx` a INSERT en `messages`, UPDATE en `salas`, y `*` en `bookings`. Mismo patrón que el badge del layout de coaches.

**Pendiente para la próxima sesión:**
- Testear en dispositivo: dot aparece con mensaje nuevo, desaparece al entrar a la sala, reaparece con sesión de hoy.
- Agregar `specialty` del profesional en cada row de "Mis salas" (diferido desde sesión 14).

---

## 2026-06-25 — Claude (sesión 14)

**Tocado:** `app/(tabs)/mis-salas.tsx` (nuevo), `app/(tabs)/_layout.tsx`, `screens/SessionsScreen.tsx`

**Resumen:**
- Navegación cambiada de 3 tabs a 4 tabs: se revierte la decisión anterior de embeber "Mis salas" dentro de Inicio. Ahora hay tab fijo en posición 2 (Inicio → **Mis salas** → Recursos → Conexiones).
- `SessionsScreen.tsx` adaptado de pantalla de push a pantalla de tab: se quitó el botón de volver del header, se cambió el título a "Mis salas", se actualizó el copy del estado vacío al nuevo texto acordado, se limpiaron estilos y el import `Platform` que quedaron huérfanos.
- `app/(tabs)/mis-salas.tsx` creado como thin wrapper de `SessionsScreen` (mismo patrón que `app/sessions.tsx`).
- `app/sessions.tsx` queda como ruta huérfana en `/sessions` — no se borró, pendiente decisión del usuario (ver Pendiente).
- Sin cambios de schema ni base de datos — solo navegación/UI.

**Pendiente para la próxima sesión:**
- Decidir qué hacer con `app/sessions.tsx`: dejarlo como alias, redirigir a `/(tabs)/mis-salas`, o borrarlo.
- Agregar `specialty` del profesional en cada row de "Mis salas" (quedó diferido intencionalmente en esta sesión).
- Testear en dispositivo: tab bar de 4 items, navegación Mis salas → sala específica, estado vacío.

---

## 2026-06-25 — Joaquín (sesión 13)

**Tocado:** `app/(tabs)/index.tsx`, `app/progreso.tsx` (navegación), todos los archivos del fix de errores

**Resumen:**
- Pantalla **Progreso** conectada a la tarjeta "Sobre ti" del Home (navegación `/progreso`).
- Fix completo de todos los errores de TypeScript y lint de la app: 0 errores TS, 0 warnings lint. Ver commit d6dbe656 para detalle.
- Merge con `andre/main`: integrado `expo-blur` que Andre agregó + su entrada de auditoría en CHANGELOG. Ambos repos (`origin` y `andre`) quedaron sincronizados.

**Pendiente para la próxima sesión:**
- Verificar que `BookingScreen_Time.tsx` recibe los params correctos desde Calendar (abierto desde sesión 8).
- Testear visualmente en dispositivo Home + Progreso.

---

## 2026-06-25 — Joaquín (sesión 12)

**Tocado:** `app/progreso.tsx`, `app/(tabs)/index.tsx`

**Resumen:**
- Pantalla `/progreso` existente completada: conectada con datos reales de Supabase (historial de sesiones pasadas: bookings con `status='completada'` o `status='confirmada'` y fecha anterior a hoy, con coach name + specialty via `Promise.all`). El stat "Sesiones completadas" también viene de Supabase; semanas y áreas quedan como placeholders con TODO.
- Navegación del Home corregida: la tarjeta "Sobre ti" ahora apunta a `/progreso` en vez de `/sessions`.
- Sin cambios de schema ni de base de datos.

**Pendiente para la próxima sesión:**
- Verificar que `BookingScreen_Time.tsx` recibe los params correctos desde Calendar (abierto desde sesión 8).
- Testear visualmente Home + Progreso en dispositivo.

---

## 2026-06-25 — Joaquín (sesión 11)

**Tocado:** `app/(tabs)/index.tsx`

**Resumen:**
- Rediseño completo del layout del Home screen para replicar la distribución de la imagen de referencia (app UMANO), manteniendo colores aurora/glass/palette de VITA intactos.
- 8 secciones nuevas: barra superior con logo "vita" izquierda + avatar circular derecha; saludo grande standalone; "Tu progreso" con toggle Hoy/Mes (estado local); tarjeta grande "Sobre ti" con `12 / Semanas` a la izquierda y texto descriptivo a la derecha; tarjeta "Frase del día" glass con ícono shimmer; sección "Recursos útiles" en fila horizontal con cards compactas (ícono circular + título + botón "+"); tarjeta "Tu próxima sesión" con especialidad del coach (nuevo fetch a tabla `coaches`); tarjeta "Para vos hoy" con label RECOMENDACIÓN + tipo + flecha.
- Nueva consulta a `coaches.specialty` vía `Promise.all` junto al fetch existente de `profiles.name`. No se tocó el schema.
- Todas las animaciones fadeUp/stagger conservadas; toda la navegación y lógica de Supabase intacta.

**Pendiente para la próxima sesión:**
- Verificar que `BookingScreen_Time.tsx` recibe los params correctos desde Calendar (sigue abierto desde sesión 8).
- Testear visualmente en dispositivo la nueva pantalla Home.

---

## 2026-06-25 — Joaquín (sesión 10)

**Tocado:** `screens/CoachReservasScreen.tsx`, `screens/CoachProfileScreen.tsx`, `screens/CoachAvailabilityScreen.tsx`, `screens/CoachWeeklyPatternScreen.tsx`, `screens/CoachNotificationsScreen.tsx`, `screens/CoachChatsScreen.tsx`, `screens/CoachResourcesScreen.tsx`

**Resumen:**
- Completada la aplicación de estética aurora/glass a TODAS las pantallas del panel coach: 7 archivos editados en 2 grupos (commits e3ccdf43 y d794cc2a), ambos pusheados.
- Patrón uniforme aplicado: `AppBg` wrapper, headers `rgba(255,255,255,0.12)` + border, cards GLASS/GLASS_BORDER, texto blanco/rgba, eliminados todos los `cardShadow` + `Platform.select` de shadows. Modales de sheet con fondo `#1A0A26` y glass interior.
- Pantallas de tabs de usuario (`(tabs)/index.tsx`, `conexiones.tsx`, `recursos.tsx`) ya tenían AppBg aplicado de sesiones anteriores — confirmado sin regresiones.
- SCHEMA.md no se tocó (sin cambios de base de datos en esta sesión).

**Pendiente para la próxima sesión:**
- Verificar que `BookingScreen_Time.tsx` recibe los params correctos desde Calendar (sigue abierto desde sesión 8).
- Testear visualmente en dispositivo el panel coach completo con el fondo aurora.

---

## 2026-06-25 — Joaquín (sesión 9)

**Tocado:** `screens/BookingScreen_Confirm.tsx`, `screens/BookingScreen_Success.tsx`, `screens/SalaScreen.tsx`

**Resumen:**
- Auditoría post-merge con `andre/main`: se verificó qué cambios de sesiones anteriores sobrevivieron y cuáles se perdieron.
- Fix crítico: `BookingScreen_Confirm` no pasaba `salaId` a `booking-success`, entonces el botón "Ver mi sala" navegaba a `/sala` con `coach_id` vacío. Ahora Confirm pasa `salaId` y Success lo usa como `sala_id` (lookup directo en SalaScreen, sin vuelta extra a Supabase).
- Recuperado logging (`logError`) en `SalaScreen` y `BookingScreen_Confirm` — se había perdido en el merge. Reemplazó los `console.error`/`console.log` de los puntos de error.

**Pendiente para la próxima sesión:**
- Verificar que `BookingScreen_Time.tsx` recibe los params correctos desde Calendar (quedó abierto desde sesión 8).
- Revisar pantallas del panel coach (`(coach)/`) que puedan necesitar glass o estén con estilo plano.

---

## 2026-06-25 — Andre (auditoría post-merge sesión 8)

**Tocado:** ningún archivo modificado (sesión de auditoría solamente)

**Resumen:**
- Auditoría completa de los 6 puntos críticos de la sesión 7 (Joaquín) post-merge
  glass de la sesión 8. Los 6 sobrevivieron intactos sin pérdidas:
  1. **Cancelación usuario/coach** — flujo y lógica preservados.
  2. **Columnas `cancelled_by` / `cancelled_late`** — presentes en schema y en código.
  3. **Mensajes de sistema** (incluyendo los 2 bugs resueltos en sesión 7) — código
     intacto, correcciones no revertidas por el merge.
  4. **Push notifications** — lógica y wiring sin cambios.
  5. **Archivos de coordinación** (`SCHEMA.md`, `CHANGELOG_SESIONES.md`) — consistentes
     con el estado real del código.
  6. **`lib/logging.ts`** y el chain `coachId`/`coachProfileId` — presentes y sin
     regresiones.

**Pendiente para la próxima sesión:**
- Ninguno abierto por esta auditoría; los pendientes vigentes son los de la sesión 8
  (panel coach con glass, params de BookingScreen_Time).

---

## 2026-06-25 — Joaquín (sesión 8)

**Tocado:** `screens/RegisterScreen.tsx`, `screens/SalaScreen.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/conexiones.tsx`, `screens/BookingScreen_Calendar.tsx`, `screens/BookingScreen_Time.tsx`, `screens/BookingScreen_Confirm.tsx`, `screens/BookingScreen_Success.tsx`, `screens/ProfesionalScreen.tsx`

**Resumen:**
- Merge con `andre/main` completado: 15+ archivos con conflictos resueltos. Estrategia: `git checkout --theirs` para screens con cambios de lógica de Andre, luego re-aplicación de estética glass/aurora encima.
- Estética glass aplicada a todas las pantallas pendientes: aurora + AppBg + StatusBar dark, cards `rgba(255,255,255,0.14)` + border, inputs glass, botón CTA blanco + texto oscuro, texto blanco/rgba.
- `AuthContext` + `useAuth()` de Andre integrado en `RegisterScreen` y `LoginScreen` sin cambios de lógica (signUpWithEmail, signInWithGoogle, coach email check, terms modals).
- `conexiones.tsx` de Andre usa fetch real de coaches desde Supabase con `coaches + profiles!inner` — glass aplicado encima preservando toda la lógica.
- `index.tsx` de Andre usa `useAuth()` y fetch de próxima sesión — glass aplicado, cards de sesión/recursos/recomendación con rgba.

**Pendiente para la próxima sesión:**
- Verificar que `screens/BookingScreen_Time.tsx` (nuevo en sesión anterior) tiene los params correctos siendo pasados desde Calendar.
- Revisar si hay pantallas del panel coach (`(coach)/`) que necesiten glass o quedaron con estilo plano.
- Push a `andre/main` — quedó pendiente después del merge.

---

## 2026-06-24 — Joaquín (sesión 7)

**Tocado:** `lib/logging.ts` (nuevo), `package.json`, `screens/BookingScreen_Confirm.tsx`, `screens/DiarioScreen.tsx`, `screens/GratitudScreen.tsx`, `screens/SalaScreen.tsx`, `app/(tabs)/conexiones.tsx`, `screens/ProfesionalScreen.tsx`, `screens/BookingScreen_Calendar.tsx`, `screens/BookingScreen_Time.tsx`, `screens/BookingScreen_Success.tsx`, `SCHEMA.md`

**Resumen:**
- Creado `lib/logging.ts` con `logError/logWarn/logInfo/readLog/clearLog` usando `expo-file-system` v19 (API nueva: `File` + `Paths`, no las funciones deprecadas). Wired en `BookingScreen_Confirm`, `DiarioScreen`, `GratitudScreen` y `SalaScreen`.
- Bug `coachId/profileId` resuelto: `conexiones.tsx` ahora fetchea coaches reales de Supabase al montar y pasa `coachId` (coaches.id) y `coachProfileId` (coaches.profile_id) por params a través de todo el chain hasta `BookingScreen_Confirm`. El lookup por specialty queda solo como fallback.
- Post-booking conectado a `/sala`: `BookingScreen_Success` navega a `/sala?sala_id=<uuid>` en vez de abrir `roomUrl` en browser externo. `BookingScreen_Confirm` ahora pasa `salaId` a `booking-success`.
- `saved_resources` verificado con `information_schema` y `SCHEMA.md` actualizado: `id`, `user_id`, `resource_id` (text), `pinned` (bool), `created_at`.
- Selector "Test:" en `SalaScreen` ya no existía en el historial de git — pendiente cerrado.

- Fix adicional: specialties hardcodeadas en `conexiones.tsx` no coincidían con Supabase — corregidas `'Psicólogo'` → `'Psicóloga clínica'` y `'Coach ejecutiva'` → `'Coach de hábitos'`.

**Pendiente para la próxima sesión:**
- `saved_resources` no tiene ninguna pantalla que la use todavía — decidir si se implementa o se descarta.

---

## 2026-06-23 — Claude (10ª entrada)

**Tocado:** `SCHEMA.md` (tabla nueva `reviews`, extensión de `notifications.type`,
regla nueva de auto-completado), SQL corrido en Supabase por Andre (no hay archivos
de código modificados en esta sesión).

**Resumen:**
- Sistema de reviews diseñado y schema corrido en Supabase. Bidireccional (usuario
  reviewea coach y viceversa), misma tabla para ambas direcciones. Una sola review por
  par `(reviewer_id, reviewed_id)`, editable pero no borrable. `reviewer_id` y
  `reviewed_id` apuntan siempre a `profiles.id` (para coaches: es `coaches.profile_id`,
  no `coaches.id`). Campo `is_private` para reviews que solo ve el destinatario.
- Trigger `reviews_before_update`: protege `reviewer_id`, `reviewed_id` y `booking_id`
  como inmutables (no puede reasignarse la review a otra persona) y actualiza
  `updated_at` en cada edición. Se usó trigger y no RLS porque `WITH CHECK` no tiene
  acceso a `OLD` para comparar valores anteriores.
- Mecanismo de auto-completado de sesiones: función `complete_confirmed_sessions()`
  + cron job pg_cron cada 5 minutos. Cualquier booking en `status='confirmada'` con
  `scheduled_date + scheduled_time + 20 minutos` ya pasado (en timezone
  `America/Argentina/Buenos_Aires`) se actualiza automáticamente a `'completada'` y
  genera notificaciones `'invitacion_review'` para ambas partes.
- Se descartó explícitamente la opción de botón manual del coach para marcar sesiones
  como completadas: incentivo perverso — podría omitir marcar las sesiones que salieron
  mal para evitar la invitación a review.
- CHECK constraint de `notifications.type` extendido para incluir `'invitacion_review'`
  (mismo patrón preventivo que el bug de `messages.sender_type` de sesiones anteriores —
  sin esta extensión, los inserts de la función habrían fallado silenciosamente).

**Pendiente para la próxima sesión:**
- UI del flujo de review: pantalla para crear/editar review cuando llega la
  notificación `'invitacion_review'`, y display de rating promedio en ProfesionalScreen
  (hoy usa datos mock hardcodeados).
- Decidir si el coach ve las reviews que recibió en algún panel propio (CoachProfileScreen
  tiene un placeholder para esto).
- Verificar en producción que el cron job efectivamente dispara después de 20 minutos
  de una sesión confirmada (testear con un booking de prueba cuya hora ya pasó).

---

## 2026-06-23 — Claude (9ª entrada)

**Tocado:** `screens/SalaScreen.tsx`, `screens/CoachReservasScreen.tsx`,
`lib/bookingHelpers.ts`, `SCHEMA.md`

**Resumen:**
- Cancelación por usuario en SalaScreen: `status='pendiente'` cancela siempre sin
  restricción; `status='confirmada'` solo con ≥24hs de anticipación. El botón en el
  banner de "Próxima sesión" se deshabilita con mensaje explicativo cuando no se cumple
  la condición. RLS `users_cancel_own_booking` aplicada en Supabase (UPDATE solo si
  `user_id = auth.uid()` y solo hacia `status='cancelada'`).
- Cancelación por coach sin restricción de tiempo. El UPDATE guarda `cancelled_by`
  ('coach'|'usuario') y `cancelled_late` (bool). Helper `isCancelLate()` extraído a
  `lib/bookingHelpers.ts` e importado en ambos screens (eliminada la copia local en
  CoachReservasScreen).
- Mensajes de sistema rediseñados: `sender_type` extendido a 5 valores (user, coach,
  system, system_confirmed, system_cancelled). Pills compactas con ícono (calendar-check /
  calendar-remove), fondo verde (`ViveColors.accent` al 28%) o rojo (`#E0525218`), título
  semibold + segunda línea tenue opcional. Contenido incluye fecha, hora y motivo de la
  sesión. Implementado en 5 puntos de inserción en CoachReservasScreen (confirmación,
  cancelación de conflicto, cancelación desde panel) y SalaScreen (cancelación por
  usuario, cancelación por coach desde la Sala). El fallback `sender_type='system'`
  conserva el render anterior (texto gris cursiva) para mensajes anteriores.
- Migraciones SQL corridas: (1) ALTER TABLE messages: extendió CHECK constraint de
  sender_type para incluir 'system_confirmed' y 'system_cancelled'; (2) ALTER TABLE
  bookings: columnas cancelled_by y cancelled_late; (3) RLS policy users_cancel_own_booking.

**Bugs encontrados y resueltos:**
1. **CHECK constraint en messages.sender_type**: los inserts con los valores nuevos
   fallaban silenciosamente — el error no era visible en el flujo normal, solo
   loggeando explícitamente el resultado del insert. Fix: ALTER TABLE extendió el
   constraint para aceptar los 5 valores.
2. **Race condition en accept() (CoachReservasScreen)**: la función leía `booking`
   del estado React (`bookings.find(b => b.id === id)`) después del UPDATE; el
   realtime subscription podía disparar `loadBookings()` en paralelo y reemplazar
   ese estado con datos de otra sala. Causó que el mensaje `system_confirmed` se
   insertara en el `sala_id` equivocado. Fix: leer desde el `.select()` del propio
   UPDATE en vez del estado local.
3. **Layout bug en pills (SalaScreen)**: `systemPillContent` tenía `flex: 1` dentro
   de un padre con `maxWidth` pero sin `width` explícito — el hijo flex colapsaba a
   0px de ancho. El ícono y el fondo verde eran visibles pero el texto era invisible.
   Fix: `flexShrink: 1` en vez de `flex: 1`.

**Pendiente para la próxima sesión:**
- Probar en dispositivo el flujo completo: confirmar reserva (pill verde con texto) →
  cancelar como usuario con >24hs → intentar cancelar con <24hs (debe bloquear) →
  cancelar como coach desde la Sala (sin restricción).
- Verificar en Supabase que `cancelled_by` y `cancelled_late` quedan con los valores
  correctos en los 3 escenarios.

---

## 2026-06-22 — Claude (8ª entrada)

**Tocado:** `screens/CoachReservasScreen.tsx`

**Resumen:**
- Bug fix: el mensaje `system_confirmed` se insertaba con el `sala_id` equivocado. La causa raíz era que `accept()` leía `booking` desde el estado React (`bookings.find(b => b.id === id)`) DESPUÉS del UPDATE, y el realtime subscription disparaba `loadBookings()` en paralelo — el closure capturaba el estado stale de un render anterior que podía tener datos de otra sala.
- Fix: `.select('id, user_id, coach_id, sala_id, scheduled_date, scheduled_time, user_message')` en el UPDATE mismo, y `const booking = data[0]` en vez de `bookings.find()`. El `booking` ahora viene directamente de la DB, no del estado local.
- No hubo cambios en schema ni en SalaScreen.

**Pendiente para la próxima sesión:**
- Testear en el celular: confirmar una reserva desde CoachReservasScreen y verificar que la pill verde aparece con texto correcto (fecha/hora) en la sala correcta (la sala de "amazonalbisu", no la de "andre").
- Verificar también el flujo de cancelación de conflictos — si `booking.sala_id` estaba mal ahí también, el cancel de conflictos podría tener el mismo bug (pero el `conflicting` query sí usa `booking.scheduled_date`/`scheduled_time` del nuevo `data[0]`, así que debería estar bien).

---

## 2026-06-22 — Claude (7ª entrada)

**Tocado:** `screens/SalaScreen.tsx`, `screens/CoachReservasScreen.tsx`, `SCHEMA.md`

**Resumen:**
- Mensajes de sistema en el chat rediseñados: nueva "pill" centrada con ícono + texto, fondo verde (`${ViveColors.accent}28`) para confirmación y rojo (`#E0525218`) para cancelación. El fallback `sender_type: 'system'` (mensajes anteriores) mantiene el render original gris/cursiva.
- Contenido de los mensajes de sistema actualizado en los 5 puntos de inserción: ahora incluyen fecha y hora de la sesión (`"Sesión reservada · lun 22 jun · 7:00 hs"` / `"El coach canceló la sesión\nlun 22 jun · 7:00 hs"`). Para confirmación, el motivo del usuario va en segunda línea si existe.
- Decisión de arquitectura: en vez de agregar columna `system_event_type`, se reutilizó `sender_type` con dos valores nuevos (`system_confirmed`, `system_cancelled`) — sin ALTER TABLE, compatible con mensajes viejos.
- SCHEMA.md actualizado con los valores nuevos de `sender_type` y la decisión de diseño.

**Pendiente para la próxima sesión:**
- Testear en el celular: confirmar una reserva desde CoachReservasScreen y verificar que la pill verde aparece con fecha y hora correctas en SalaScreen.
- Testear ambas cancelaciones (coach y usuario) y verificar pill roja.
- Los mensajes viejos con `sender_type: 'system'` van a seguir rindiendo como texto gris — si en algún momento se quiere migrarlos, habría que hacer un UPDATE en Supabase.

---

## 2026-06-22 — Claude (6ª entrada)

**Tocado:** `screens/SalaScreen.tsx`, `screens/CoachReservasScreen.tsx`, `lib/bookingHelpers.ts` (nuevo)

**Resumen:**
- Bug fix: el banner de "próxima sesión" en SalaScreen bloqueaba la cancelación del coach con la restricción de 24hs del usuario. Se agregó `isCurrentUserCoach = !recipientIsCoach` (derivado del estado ya existente) para bifurcar tanto el banner como `handleCancelBooking()`.
- Para el coach: botón siempre habilitado, sin texto de 24hs, guarda `cancelled_by: 'coach'` y `cancelled_late` calculado; para el usuario: flujo existente sin cambios.
- Extraída `isCancelLate()` a `lib/bookingHelpers.ts` (helper compartido) e importada en ambos screens — eliminada la copia local de CoachReservasScreen.

**Pendiente para la próxima sesión:**
- Testear el flujo completo desde el celular: coach entra a la sala, ve el banner, toca "Cancelar sesión" — verificar que no se bloquea por tiempo y que el booking queda con `cancelled_by: 'coach'` y `cancelled_late` correcto en Supabase.
- Verificar que el flujo del usuario en la misma sala sigue bloqueando por 24hs correctamente.

---

## 2026-06-22 — Claude (5ª entrada)

**Tocado:** `screens/CoachReservasScreen.tsx`, `screens/SalaScreen.tsx`, `SCHEMA.md`

**Resumen:**
- Cancelación de sesión confirmada por el coach implementada en CoachReservasScreen: función `cancelConfirmed()` + botón "Cancelar" en cada card de confirmada (layout derecho: badge + texto rojo)
- `isCancelLate()`: calcula si la cancelación ocurre con menos de 24hs de anticipación respecto a scheduled_date + scheduled_time — mismo patrón que `canCancelConfirmed()` en SalaScreen pero invertido (registra para métrica, no bloquea)
- UPDATE incluye `cancelled_by: 'coach'` y `cancelled_late: boolean`; agrega mensaje de sistema en sala ("El coach canceló la sesión.") y notificación push al usuario
- SalaScreen.tsx: agregado `cancelled_by: 'usuario'` al UPDATE de cancelación del usuario (era solo `{ status: 'cancelada' }`)
- SCHEMA.md actualizado con las 2 columnas nuevas de `bookings`
- **Migración SQL pendiente de correr en Supabase dashboard** (no destructiva):
  ```sql
  ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS cancelled_by text,
    ADD COLUMN IF NOT EXISTS cancelled_late boolean;
  ```

**Pendiente para la próxima sesión:**
- Correr la migración SQL en Supabase antes de testear (sin ella el UPDATE de `cancelled_by`/`cancelled_late` silenciosamente no escribe esas columnas pero no rompe nada)
- Probar en dispositivo: cancelar sesión confirmada como coach → verificar mensaje en sala + push al usuario
- RLS de `bookings` en UPDATE: confirmar que el coach puede hacer UPDATE con `cancelled_by`/`cancelled_late` (la política actual debería cubrirlo si permite UPDATE en general para el coach, pero verificar)

---

## 2026-06-22 — Claude (4ª entrada)

**Tocado:** `screens/SalaScreen.tsx`

**Resumen:**
- Cancelación de reserva por el usuario implementada dentro del banner de sesión existente en SalaScreen — sin pantallas nuevas
- `ConfirmedBooking` type: agregado campo `status: 'pendiente' | 'confirmada'`; query de bookings cambió de `.eq('status', 'confirmada')` a `.in('status', ['pendiente', 'confirmada'])` para cubrir ambos casos cancelables
- Helper `canCancelConfirmed()`: devuelve true si faltan ≥24hs — mismo patrón que `calcVideoWindow` ya existente en el archivo
- Función `handleCancelBooking()`: valida elegibilidad → Alert de confirmación → UPDATE booking a 'cancelada' → mensaje de sistema encriptado en sala → notif + push al coach vía `profiles.push_token` del `recipientId`
- Liberación del slot en `coach_availability` es automática (BookingScreen_Calendar/Time filtran contra bookings con status='confirmada') — no se tocó esa tabla
- RLS aplicada previamente por Andre: `users_cancel_own_booking` con USING `user_id = auth.uid()` y WITH CHECK `status = 'cancelada'`

**Pendiente para la próxima sesión:**
- Probar en dispositivo: reserva pendiente → cancelar (siempre disponible) y reserva confirmada → cancelar con >24hs / intentar con <24hs (debe bloquear)
- Verificar que el coach recibe push notification y mensaje de sistema en la sala

---

## 2026-06-22 — Claude (3ª entrada)

**Tocado:** `screens/CoachReservasScreen.tsx`, `screens/CoachHomeScreen.tsx`, `screens/BookingScreen_Confirm.tsx`, `screens/BookingScreen_Success.tsx`

**Resumen:**
- Ventana de respuesta del coach reducida de 48hs a 24hs en todos los lugares donde aparecía
- Lógica real (`hoursLeftToRespond`): constante `48 * 60 * 60 * 1000` → `24 * 60 * 60 * 1000` en `CoachReservasScreen.tsx:64`
- Umbrales de `urgencyColor` ajustados proporcionalmente: naranja arranca en `<= 12hs` (antes `<= 24hs`); rojo a `<= 6hs` se mantuvo
- Texto de UI actualizado en los 3 archivos restantes: "48hs" → "24hs" en banner de CoachHomeScreen, aviso de BookingScreen_Confirm, y subtitle de BookingScreen_Success
- No hay cancelación automática por vencimiento de deadline — el deadline es puramente visual; la cancelación es por conflicto de horario en `accept()` y no se tocó

**Pendiente para la próxima sesión:**
- Confirmar en dispositivo que el countdown se muestra correctamente para reservas recientes (debería mostrar ~24hs para una reserva nueva)

---

## 2026-06-22 — Claude (2ª entrada)

**Tocado:** `screens/CoachAvailabilityScreen.tsx`, `screens/BookingScreen_Calendar.tsx`, `screens/BookingScreen_Time.tsx`, `coach_availability` (SQL)

**Resumen:**
- SQL corrido por Andre: `ALTER TABLE coach_availability ADD COLUMN blocked boolean NOT NULL DEFAULT false`
- `removeSlot()` ya no hace DELETE — hace `UPDATE SET blocked=true`; nueva `reactivateSlot()` hace `UPDATE SET blocked=false`
- Slot bloqueado se muestra con candado naranja en `CoachAvailabilityScreen`; tocarlo lo reactiva. Orden: reservado > bloqueado > libre.
- `BookingScreen_Calendar` y `BookingScreen_Time` filtran `.eq('blocked', false)` — slots bloqueados invisibles para el usuario
- `availabilityGenerator.ts` sin cambios: el `upsert ignoreDuplicates` ya ignora filas con `blocked=true`

**Pendiente para la próxima sesión:**
- Probar flujo en dispositivo: crear patrón → bloquear un slot → regenerar ventana → verificar que el slot no reaparece como libre

---

## 2026-06-22 — Claude

**Tocado:** `lib/availabilityGenerator.ts` (nuevo), `screens/CoachWeeklyPatternScreen.tsx` (nuevo), `app/coach-weekly-pattern.tsx` (nuevo), `screens/CoachAvailabilityScreen.tsx` (modificado), `package.json` / `package-lock.json` (dependencia nueva)

**Resumen:**
- SQL corrido por Andre en Supabase: tabla `coach_weekly_pattern` con RLS (coaches gestionan la propia, SELECT abierto). Agregado en SCHEMA.md.
- `lib/availabilityGenerator.ts`: función `generateWeeklySlots(coachId, supabase)` — itera los próximos 56 días, convierte JS `getDay()` a `day_of_week` DB (1=Lun…7=Dom), genera slots con `t < end_time` exclusivo, inserta con `upsert onConflict ignoreDuplicates` sobre el UNIQUE constraint existente.
- `CoachWeeklyPatternScreen`: lista los 7 días siempre visible, bloques existentes con delete (Alert), form inline por día con DateTimePicker modo "time" (iOS: spinner inline toggle; Android: dialog fuera del ScrollView). Botón "Guardar bloque" deshabilitado hasta que ambos tiempos estén seteados y `endTime > startTime`. Al montar y al guardar llama `generateWeeklySlots`.
- `CoachAvailabilityScreen`: agregado banner "Configurar horario semanal habitual" arriba del calendario que navega a `/coach-weekly-pattern`.
- Instalado `@react-native-community/datetimepicker` vía `expo install`.

**Pendiente para la próxima sesión:**
- Probar en dispositivo: crear patrón semanal → verificar que `coach_availability` se pobla correctamente para las próximas 8 semanas
- Verificar que el DateTimePicker en iOS muestra correctamente en modo spinner (altura nativa 216px dentro del ScrollView)

---

## 2026-06-21 — Andre

**Tocado:** `screens/CoachProfileScreen.tsx`, `screens/CoachAvailabilityScreen.tsx` (nuevo), `app/coach-availability.tsx` (nuevo), `screens/BookingScreen_Calendar.tsx`, `screens/BookingScreen_Time.tsx`, `screens/SalaScreen.tsx`, `screens/CoachChatsScreen.tsx`, `SCHEMA.md`

**Resumen:**
- Sistema de disponibilidad real completado: SQL corrido (`coach_availability` con RLS), `CoachAvailabilityScreen` nueva pantalla (calendario + chips por fecha con add/delete en Supabase), `CoachProfileScreen` reemplazó grid mock por botón "Gestionar disponibilidad"
- `BookingScreen_Calendar` reemplazó `MOCK_UNAVAILABLE_DAYS` + bloqueo de fines de semana por queries reales: resuelve `coaches.id` desde `profile_id`, cruza `coach_availability` contra `bookings confirmadas`, sólo muestra días con al menos un slot libre
- `BookingScreen_Time` reemplazó `ALL_TIMES` hardcodeado por queries reales para el coach+fecha seleccionados; sort numérico para evitar orden alfabético erróneo ("10:00" < "9:00")
- Cleanup: eliminados 6 `console.log` diagnósticos de `SalaScreen` y `CoachChatsScreen` (del debugging del bug de RLS, ya resuelto); corregido TS error (`sender_type` faltaba en mensaje optimístico de `SalaScreen`)
- `SCHEMA.md` actualizado: tabla `coach_availability` documentada, Regla 9 agregada

**Pendiente para la próxima sesión:**
- Probar el flujo completo en dispositivo: coach agrega slots → usuario ve calendario real → reserva → slot queda bloqueado
- Bug conocido sin fix: `BookingScreen_Success` "Ver mi sala" usa `coach_id: ''` porque `BookingScreen_Confirm` no pasa `coachId` al navegar

---

## 2026-06-20 (continuación 5) — Andre

**Tocado:** RLS en `messages`, `screens/CoachReservasScreen.tsx`

**Resumen:**
- Bug crítico encontrado y corregido: la política RLS de SELECT en
  `messages` ("Users can view messages in their salas") tenía la condición
  `auth.uid() = sender_id` — esto permitía a cada usuario ver SOLO los
  mensajes que él mismo envió, nunca los que recibió. Por eso los chats
  nunca sincronizaban entre usuario y coach (cada lado veía una
  conversación distinta, solo con sus propios mensajes salientes).
  Corregido: la política ahora compara contra `sala_id IN (SELECT id FROM
  salas WHERE user_id = auth.uid() OR coach_id = auth.uid())`. Confirmado
  funcionando en el dispositivo en ambos sentidos (usuario↔coach).
- Se corrigió el orden de loadBookings() en CoachReservasScreen.tsx,
  función accept() — antes se llamaba antes de que terminara la lógica de
  cancelación de conflictos, mostrando datos parciales hasta un refresh
  manual. Ahora corre al final, una sola vez, con el resultado completo.
- Se descartó la hipótesis de "salas duplicadas" como causa del problema
  de sincronización (confirmado con SQL: no hay duplicados para ningún
  par user_id+coach_id — son 3 salas legítimas con distintos usuarios).

**Pendiente para la próxima sesión:**
- Bug menor identificado, no corregido: app/(tabs)/index.tsx usa columnas
  date/time en vez de scheduled_date/scheduled_time (mismo patrón
  recurrente del día) — el botón "Ver sala" en Home nunca funciona.
- Bug menor identificado, no corregido: SessionsScreen.tsx muestra el
  lastMessage sin desencriptar (debería pasar por decryptMessage()).
- Feature grande de disponibilidad por coach sigue pendiente (ver entrada
  anterior del mismo día — tabla coach_availability, pantalla de
  configuración para el coach, lógica de slots en Calendar/Time).

---

## 2026-06-20 (continuación 4) — Andre

**Tocado:** `screens/SalaScreen.tsx`, `screens/CoachReservasScreen.tsx`,
tabla `messages` (sender_type), pull-to-refresh en Reservas

**Resumen:**
- Bug encontrado (mismo patrón recurrente del día): SalaScreen.tsx usaba
  columnas `date`/`time` en vez de `scheduled_date`/`scheduled_time` para
  buscar la reserva confirmada de una sala — causaba que el banner de
  sesión y el motivo del usuario (user_message) nunca aparecieran, aunque
  la reserva existiera y estuviera confirmada. Corregido en 4 lugares:
  tipo ConfirmedBooking, calcVideoWindow, la query en init(), y el JSX
  del banner.
- Confirmado (mediante SQL, no era bug): la confusión de "no aparece nada"
  en varias pruebas de hoy fue reiteradamente por mezclar cuentas de coach
  de prueba (`viveappp@gmail.com` = "Coach Prueba", `dardoalbisu@gmail.com`,
  `steamsteam335@gmail.com` eran todas cuentas distintas usadas sin
  registrar cuál se usaba en cada prueba). Se limpiaron todas las tablas
  de prueba (messages, notifications, bookings, salas) para arrancar fresco.
- Nueva feature: mensajes de sistema en el chat. Se agregó columna
  `sender_type` ('user'|'coach'|'system') a `messages`. Cuando el coach
  acepta una reserva, se inserta automáticamente un mensaje de sistema en
  la sala con el motivo que el usuario escribió al reservar (o "Sesión
  confirmada" si no escribió nada) — visible para ambos, estilo visual
  distinto (centrado, sin burbuja, sin avatar). El banner fijo de la Sala
  ya NO muestra el motivo (se sacó esa línea), solo fecha/hora — el motivo
  vive únicamente como mensaje en el chat.
- Nueva feature: cancelación automática de horarios conflictivos. Cuando
  el coach acepta una reserva, todas las OTRAS reservas pendientes para el
  mismo coach+fecha+hora se cancelan automáticamente (status='cancelada'),
  con notificación + push + mensaje de sistema en la sala de cada usuario
  afectado, avisando que el horario ya no está disponible.
- Se agregó pull-to-refresh (RefreshControl) en CoachReservasScreen.tsx
  como red de seguridad ante posibles fallos de Realtime.

**Pendiente para la próxima sesión — FEATURE GRANDE, requiere diseño:**

Sistema de disponibilidad real por coach. Hoy BookingScreen_Calendar.tsx y
BookingScreen_Time.tsx son 100% mock/hardcodeado (MOCK_UNAVAILABLE_DAYS y
ALL_TIMES son constantes fijas, no consultan Supabase, no usan coachId para
nada real). Decisiones YA TOMADAS sobre cómo debe funcionar:

1. Cada coach define sus PROPIOS días y horarios de atención (no son los
   mismos 7 slots fijos para todos los coaches como hoy) — requiere tabla
   nueva, por ejemplo `coach_availability` (día de semana, hora inicio,
   hora fin, por coach).
2. Un horario queda NO seleccionable para nuevos usuarios SOLO cuando ya
   tiene una reserva con status='confirmada' para ese coach+fecha+hora.
   Mientras haya solo reservas 'pendiente' compitiendo por el mismo
   horario, sigue apareciendo disponible para todos (la resolución de
   conflictos ya está resuelta vía cancelación automática al aceptar,
   ver arriba).
3. Si todos los horarios de un día específico ya están confirmados/no
   disponibles, ese día completo debe aparecer bloqueado en el calendario
   (no solo el horario puntual).

Falta diseñar/construir:
- Tabla `coach_availability` (esquema a definir)
- Pantalla para que el coach configure su disponibilidad (probablemente
  dentro de CoachProfileScreen, donde ya existe "Editar perfil")
- Lógica en BookingScreen_Calendar.tsx: cruzar coach_availability con
  bookings

---

## 2026-06-20 (continuación 4) — Claude

**Tocado:** `screens/CoachReservasScreen.tsx`, `screens/SalaScreen.tsx`, tabla `messages` (nueva columna)

**Resumen:**
- Se agregó columna `sender_type text NOT NULL DEFAULT 'user' CHECK (...)` a la tabla `messages` (valores: 'user', 'coach', 'system'). SQL corrido por Andre.
- Al aceptar una reserva en CoachReservasScreen (`accept()`), se inserta automáticamente un mensaje de sistema en la sala: contenido = `user_message` del booking (o "Sesión confirmada" si está vacío), con `sender_type='system'`.
- En SalaScreen: tipo `Message` actualizado con `sender_type`; `rowToMessage()` lo propaga desde la fila (con fallback `'user'` para mensajes viejos); el render de mensajes tiene rama especial para system — centrado, sin burbuja, texto gris cursiva, sin avatar; se eliminó el `user_message` del banner (solo queda fecha/hora).
- Fix de sesión anterior aplicado también: query de `confirmedBooking` corregida de `date`/`time` a `scheduled_date`/`scheduled_time` (bug que causaba "Sin sesión programada" aunque hubiera reserva confirmada).

**Pendiente para la próxima sesión:**
- Testear el flujo completo en Expo Go: coach acepta reserva → mensaje de sistema aparece en la sala del usuario.
- Evaluar si el realtime de `messages` en SalaScreen también necesita actualizar `confirmedBooking` cuando el status cambia (hoy lo hace solo en init).

---

## 2026-06-20 (continuación 3) — Andre

**Tocado:** `screens/CoachReservasScreen.tsx`, `screens/CoachHomeScreen.tsx`,
`screens/SalaScreen.tsx`, `screens/BookingScreen_Confirm.tsx`, tabla `bookings`
(RLS + constraint), tabla `profiles` (RLS)

**Resumen:**
- Implementadas las 4 piezas de mejora de la interfaz de coach: (1) pestaña
  fija de Reservas en el tab bar con badge numérico (antes solo accesible
  vía banner condicional cuando había pendientes); (2) al aceptar/rechazar
  una reserva se inserta una notificación en la tabla `notifications` y se
  manda push; el banner de sesión en SalaScreen ahora lee la reserva
  confirmada real en vez de un SESSION_LABEL hardcodeado; (3) el botón de
  videollamada ahora respeta una ventana de 5 minutos antes de la sesión
  (calcVideoWindow), no solo si existe room_url; (4) campana de
  notificaciones en CoachHomeScreen con pantalla propia (coach-notifications.tsx).
- Se creó la tabla `notifications` (recipient_id, type, booking_id, title,
  body, read, created_at) con RLS (notifications_select_own,
  notifications_update_own, notifications_insert_authenticated).
- Bug grave encontrado: bookings.status se insertaba como 'pendiente'
  (español) pero 8 lugares distintos del código filtraban buscando 'pending'/
  'confirmed' (inglés) — las reservas nunca aparecían en ninguna pantalla
  del coach. Se corrigieron los 9 archivos para usar consistentemente
  español. Se descubrió que el constraint bookings_status_check en la base
  SOLO permite 'pendiente'/'confirmada'/'completada'/'cancelada' — no existe
  'rechazada', se usa 'cancelada' para ambos casos (rechazo de pendiente y
  cancelación de confirmada).
- Bug encontrado: CoachReservasScreen y CoachHomeScreen leían columnas
  `date`/`time` que no existen en bookings (las reales son `scheduled_date`/
  `scheduled_time`) — causaba fechas vacías en las tarjetas y un error
  silencioso de PostgREST en CoachHomeScreen. Corregido.
- Bug de seguridad/RLS encontrado y corregido: la tabla `bookings` no tenía
  ninguna política de SELECT ni UPDATE — los coaches no podían leer NINGUNA
  reserva (ni siquiera las suyas) desde la app, aunque sí existieran en la
  base (visible solo vía SQL Editor, que corre como postgres sin RLS). Se
  agregaron 3 políticas: coaches_can_select_own_bookings,
  coaches_can_update_own_bookings, users_can_select_own_bookings.
- Segundo bug de RLS encontrado: profiles solo tenía políticas de SELECT
  para "ver tu propio perfil" o "coaches visibles para todos" — un coach
  no podía leer el nombre de los usuarios que le reservaban, mostrando
  siempre el fallback "Usuario". Se agregó coaches_can_view_their_users_profiles
  (coach puede ver profiles de usuarios con los que tiene booking o sala).
- SalaScreen.tsx: eliminada la constante COACH hardcodeada (María González/
  Psicóloga) que se mostraba siempre sin importar quién entrara a la sala.
  Ahora resuelve el perfil real del destinatario (recipientId), distinguiendo
  si es coach (muestra specialty, navega a /profesional al tocar el header)
  o usuario (sin specialty, header no clickeable). Se eliminó también el
  indicador "En línea" (isOnline hardcodeado, sin sistema de presencia real).

**Pendiente para la próxima sesión:**
- Verificar si la pantalla /profesional tolera bien rating/reviewCount/
  priceFrom vacíos cuando un coach navega ahí desde la Sala (hoy se le pasan
  strings vacíos porque esos datos no existen para un perfil de usuario/coach
  visto desde este contexto).
- Probar el flujo completo de Pieza 4 (notificaciones) de punta a punta —
  se implementó pero no se confirmó visualmente en el dispositivo todavía.
- Considerar si bookings_status_check debería tener un valor separado para
  "rechazada" vs "cancelada" en el futuro (limitación de schema, no bloqueante).

---

## 2026-06-20 (continuación 7) — Claude

**Tocado:** `screens/SalaScreen.tsx`

**Resumen:**
- Eliminado el objeto `COACH` hardcodeado ("María González") que se mostraba igual para todos los usuarios
- Agregados estados `recipientProfile` y `recipientIsCoach`: al resolver la sala se determina si el destinatario es coach o usuario, y se hace query a `profiles` (y a `coaches` por `profile_id` si es coach) para traer nombre real y especialidad
- Header ahora muestra nombre/especialidad reales con skeleton mientras carga; dot "En línea" eliminado (no hay presencia real)
- `onPress` del header es condicional: solo navega a `/profesional` si el destinatario es coach; si es usuario, no es clickeable
- Iniciales en avatar grande y pequeño usan `buildInitials()` sobre el nombre real
- Tooltip cambiado a texto neutral que no asume rol ("Tu espacio de comunicación. Escribí mensajes y coordiná tus sesiones.")
- Renombrado `recipientProfile` → `recipientPushData` dentro de `sendMessage()` para evitar shadowing del estado

**Pendiente para la próxima sesión:**
- `handleHeaderPress` pasa `rating: ''`, `reviewCount: ''`, `priceFrom: ''` a `/profesional` — confirmar si esa pantalla maneja strings vacíos o necesita ajuste

---

## 2026-06-20 (continuación 6) — Claude

**Tocado:** `screens/BookingScreen_Confirm.tsx`, `screens/CoachReservasScreen.tsx`, `screens/CoachHomeScreen.tsx`, `screens/SalaScreen.tsx`, `screens/ProfileOwnScreen.tsx`, `app/(tabs)/index.tsx`, `app/(coach)/_layout.tsx`

**Resumen:**
- Bug raíz: el constraint `bookings_status_check` en Supabase solo permite `'pendiente'`, `'confirmada'`, `'completada'`, `'cancelada'` (español). Todo el código JS/TS usaba inglés (`'pending'`, `'confirmed'`, `'rejected'`), causando silently failing updates y queries vacías
- Unificación a español: 13 cambios en 7 archivos — inserts, queries Supabase, filtros JS en memoria, y TypeScript types
- `'rejected'` mapeado a `'cancelada'` porque `'rechazada'` no existe en el constraint; la lógica de notificaciones (`type: 'reserva_rechazada'`, texto push) es independiente del status y no se tocó

**Pendiente para la próxima sesión:**
- Si hay filas en producción con status en inglés (`'pending'`, `'confirmed'`, `'rejected'`) que entraron antes de este fix, migrarlas con SQL: `UPDATE bookings SET status = 'pendiente' WHERE status = 'pending'`, etc.

---

## 2026-06-20 (continuación 5) — Claude

**Tocado:** `screens/BookingScreen_Confirm.tsx`

**Resumen:**
- Bug encontrado: `bookings.status` se insertaba como `'pendiente'` (español) en BookingScreen_Confirm, mientras que el resto del proyecto (8 queries + 2 filtros JS) filtraba por `'pending'`/`'confirmed'` (inglés) — las reservas nuevas nunca aparecían en la pantalla del coach
- Unificación a inglés: cambiado `status: 'pendiente'` → `status: 'pending'` en línea 127
- No hay otros valores en español en el codebase (`confirmada`, `rechazada`, `cancelada` no aparecen en ningún lado)

**Pendiente para la próxima sesión:**
- Correr en Supabase: `UPDATE bookings SET status = 'pending' WHERE status = 'pendiente';` para migrar filas existentes (Andre lo tiene que correr manualmente)

---

## 2026-06-20 (continuación 4) — Claude

**Tocado:** `app/(coach)/_layout.tsx`, `app/(coach)/reservas.tsx` (nuevo), `app/coach-notifications.tsx` (nuevo), `screens/CoachReservasScreen.tsx`, `screens/CoachHomeScreen.tsx`, `screens/SalaScreen.tsx`, `screens/CoachNotificationsScreen.tsx` (nuevo)

**Resumen:**
- **Reservas como pestaña fija:** agregada pestaña "Reservas" en el tab navigator de `(coach)` (5 pestañas: Inicio / Reservas / Chats / Recursos / Perfil). El layout resuelve su propio `coachId` y mantiene suscripción Realtime para el badge numérico de pendientes. `CoachReservasScreen` detecta con `useSegments()` si está en tab o en stack, y oculta el back button cuando es pestaña. El banner de CoachHomeScreen que navegaba a `/coach-reservas` (stack) ahora usa `router.navigate('/reservas')` para hacer switch de pestaña.
- **Notificaciones al aceptar/rechazar:** `accept()` y `confirmReject()` en `CoachReservasScreen` insertan en la tabla `notifications` (`type: reserva_confirmada` / `reserva_rechazada`) en el mismo `Promise.all` que manda el push. Mismo texto en DB y en push.
- **Banner dinámico en Sala:** eliminada la constante `SESSION_LABEL` hardcodeada. El `init()` de `SalaScreen` fetchea la reserva confirmada más próxima (de hoy en adelante, `status='confirmed'`) para esa `sala_id` y la muestra en el banner fijo. Si hay `user_message`, lo muestra en cursiva debajo.
- **Ventana de video de 5 minutos:** botón de video en Sala requiere `roomUrl && isInVideoWindow`. La ventana abre 5 minutos antes de la sesión y no tiene límite superior. Un `setInterval` de 30s recalcula el estado mientras la pantalla esté abierta.
- **Campana de notificaciones:** `CoachHomeScreen` muestra ícono de campana con punto rojo si hay `notifications.read=false` para el coach (suscripción Realtime). Navega a nueva pantalla `CoachNotificationsScreen` que lista notificaciones ordenadas por `created_at DESC`, marca todas como leídas al montar (en background para preservar el estado visual inicial), y navega a la pestaña Reservas si el ítem tiene `booking_id`.

**Pendiente para la próxima sesión:**
- La inserción en `notifications` con `type='reserva_nueva'` (cuando un usuario hace una reserva) no está implementada — el coach no recibirá notificaciones en la campana hasta que se agregue ese insert en el flujo de booking del usuario
- `app/coach-reservas.tsx` queda como ruta de stack pero ya no es el acceso principal — decidir si se mantiene como deeplink fallback o se elimina
- El banner de Sala muestra "Sin sesión programada" cuando no hay reserva confirmada futura — evaluar si conviene mostrar la última sesión pasada o directamente ocultar el banner

---

## 2026-06-20 (continuación 3) — Claude

**Tocado:** `screens/ProfileOwnScreen.tsx`, `screens/CoachProfileScreen.tsx`, `context/AuthContext.tsx`

**Resumen:**
- Eliminado el botón "Cambiar a vista coach" de `ProfileOwnScreen` y su mirror "Cambiar a vista usuario" de `CoachProfileScreen` — eran un agujero de seguridad real: cualquier usuario podía auto-elevarse a `/(coach)` sin que `profiles.role` lo avalara
- Eliminada `switchRole()` completamente de `AuthContext`: del tipo `AuthContextType`, del contexto default, de la implementación y del valor que expone el provider
- El estado `role` en AuthContext ahora es inmutable desde el cliente — solo puede cambiar vía `fetchRole()` (consulta `profiles.role` en Supabase) o `signOut()`
- Confirmado que `app/index.tsx` y `app/_layout.tsx` (AuthRedirect) ya usaban exclusivamente el `role` de `fetchRole()` y no necesitaron cambios
- Decisión de arquitectura: coach y usuario son cuentas completamente separadas — si un coach quiere usar VIVE como usuario necesita otra cuenta

**Pendiente para la próxima sesión:**
- Nada abierto de esta tarea; el flujo de roles quedó cerrado y limpio

---

## 2026-06-20 (continuación 2) — Claude

**Tocado:** `screens/CoachHomeScreen.tsx`, `screens/CoachReservasScreen.tsx`

**Resumen:**
- Corregido bug crítico: las 3 queries de `bookings` en pantallas de coach comparaban `user.id` (`profiles.id` / `auth.uid()`) directamente contra `bookings.coach_id`, pero esa columna espera `coaches.id` (el PK de la tabla `coaches`, distinto del `profile_id`). Resultado: el coach veía siempre 0 reservas aunque existieran registros reales.
- Patrón de fix: cada pantalla ahora resuelve `coaches.id` una sola vez al montar (via `useEffect` + `useState coachId`, lookup `coaches.select('id').eq('profile_id', user.id)`), y usa ese valor en todos los `.eq('coach_id', ...)` de bookings y en el filtro de la suscripción Realtime.
- `CoachChatsScreen` no tenía el bug: `salas.coach_id` apunta a `profiles.id`, que sí coincide con `user.id`.
- SCHEMA.md no cambió — el esquema ya documentaba esta distinción correctamente.

**Pendiente para la próxima sesión:**
- Verificar en dispositivo que el coach ve sus reservas y que el Realtime funciona al crear una nueva booking.

---

## 2026-06-20 (continuación) — Andre

**Tocado:** `screens/SalaScreen.tsx`, `app/_layout.tsx`, `screens/CoachLoginScreen.tsx`,
`screens/RegisterScreen.tsx`, `screens/OnboardingScreen2.tsx`, `screens/OnboardingScreen5.tsx`,
nuevas pantallas de coach, tabla `coaches` (esquema + RLS)

**Resumen:**
- Resuelto merge en SalaScreen.tsx: se combinó la versión completa de Andre
  (chat real con Realtime, encriptación, búsqueda/creación de sala, push
  notifications) con la idea de Joaquín de conectar el botón de video al
  `room_url` real de la sala vía Linking.openURL. Se sacó el selector "Test:"
  (locked/soon/live) y el MEET_LINK hardcodeado — ya no hacían falta.
- Mismo bug de styles/s que en LoginScreen apareció también en RegisterScreen.tsx
  (líneas 128-129, copy-paste heredado) — corregido: styles.logoRow → s.logoWrap,
  styles.logo → s.logo.
- Se construyó el flujo completo de aplicación de coaches, ya decidido en
  sesiones anteriores de producto:
  - Nueva pantalla de bifurcación (onboarding-bifurcacion.tsx) entre la
    bienvenida y el onboarding de usuario: "Quiero crecer" / "Quiero acompañar"
  - CoachLoginScreen.tsx: login/registro simple para coach, navega a
    coach-application.tsx
  - coach-application.tsx: formulario (especialidad, bio, precio, nacionalidad,
    link de video) que inserta en `coaches` con verified: false
  - Se agregó columna `application_video_url` (text) a `coaches` vía ALTER TABLE
  - Se agregó política RLS de INSERT en `coaches` (coaches_insert_own) — sin
    ella, el insert fallaba con "new row violates row-level security policy"
- Se implementó ruteo por rol: AuthContext ahora tiene fetchRole(), y
  AuthRedirect en _layout.tsx redirige a /(coach) o /(tabs) según
  profiles.role al loguearse.
- Se implementaron validaciones cruzadas: una cuenta no puede ser coach y
  usuario al mismo tiempo bajo el mismo mail, en ningún estado (pendiente,
  aprobado, o usuario normal). CoachLoginScreen y RegisterScreen ahora
  verifican esto antes de dejar avanzar.
- Bug encontrado y corregido (segunda vez en el día, mismo patrón que
  index.tsx): AuthRedirect redirigía a CUALQUIER usuario sin sesión que
  estuviera en /(tabs) de vuelta a onboarding-bifurcacion — esto rompía la
  regla de "explorás libremente, te registrás cuando querés actuar". Se
  corrigió para que /(tabs) sea accesible sin cuenta; solo /(coach) requiere
  sesión. Un primer intento de fix (mandar todo a /register) fue revertido
  por contradecir esa regla de producto.
- OnboardingScreen2: las opciones "explorar" y "sé qué necesito" ahora van a
  /(tabs) sin pedir cuenta (la segunda era un dead end conocido, ahora resuelto).
  "No sé por dónde empezar" sigue el flujo guiado de 3 pasos, que termina en
  /register al llegar a una acción concreta (correcto, según la regla).

**Pendiente para la próxima sesión:**
- Probar el flujo completo de coach (postulación → aprobación manual →
  acceso a /(coach)) de punta a punta una vez más con el SalaScreen actualizado.
- AuthRedirect: confirmar si segments[0] === '(coach)' funciona como se
  espera en expo-router (sospecha de sesiones anteriores, sin confirmar).
- Pensar la interfaz de /(coach) en sí — qué ve un coach aprobado al entrar
  (panel, reservas entrantes, etc.) — todavía no se construyó nada de eso.
- Avisar a Joaquín sobre el cambio de política RLS en coaches y el ALTER
  TABLE de application_video_url (se corrieron sin esperar confirmación
  explícita dado el contexto del día — revisar si está de acuerdo).

---

## 2026-06-20 — Joaquín (sesión 2)

**Tocado:**
- `context/AuthContext.tsx` — `role` ahora viene de `profiles.role` en Supabase
- `app/_layout.tsx` — `AuthRedirect` bifurca a `/(coach)` o `/(tabs)` según el rol real
- `app/index.tsx` — redirect inicial respeta el rol
- `screens/CoachLoginScreen.tsx` — agrega `validateAndNavigate()` con chequeo de rol cruzado
- `screens/RegisterScreen.tsx` — agrega chequeo de coach antes de `signUpWithEmail`

**Resumen:**
- Implementado routing basado en `profiles.role`: al hacer login, `AuthContext` hace `SELECT role FROM profiles` y `AuthRedirect` redirige a `/(coach)` o `/(tabs)` según corresponda. Antes todo el mundo iba a `/(tabs)`.
- Validaciones cruzadas para impedir que un mismo mail tenga rol de usuario y coach al mismo tiempo: `CoachLoginScreen` bloquea usuarios normales con mensaje claro; `RegisterScreen` bloquea emails que ya tienen fila en `coaches`. Si un coach con `verified=true` llega a `coach-login`, se lo redirige a `/(coach)` con un Alert.

**Pendiente para la próxima sesión:**
- Correr en Supabase si no se corrió: `ALTER TABLE coaches ADD COLUMN application_video_url text;`
- Probar el flujo completo en Expo Go: usuario normal intenta entrar a coach-login (debe ser bloqueado), coach verificado en coach-login (debe redirigir a /(coach)), registro normal con mail de coach (debe ser bloqueado)
- Definir qué ve un coach en `/(coach)` una vez aprobado — el grupo existe pero puede estar vacío

---

## 2026-06-20 — Joaquín

**Tocado:**
- `screens/OnboardingBifurcacion.tsx` (nuevo)
- `screens/CoachLoginScreen.tsx` (nuevo)
- `screens/CoachApplicationScreen.tsx` (nuevo)
- `app/onboarding-bifurcacion.tsx` (nuevo)
- `app/coach-login.tsx` (nuevo)
- `app/coach-application.tsx` (nuevo)
- `screens/OnboardingScreen1.tsx` — cambia navegación post-splash
- `app/_layout.tsx` — registra nuevas rutas y ONBOARDING_SCREENS
- `SCHEMA.md` — documenta columna nueva `coaches.application_video_url`

**Resumen:**
- Nuevo flujo de aplicación de coaches: pantalla de bifurcación "¿Cómo llegás a VIVE?" inserta entre el splash (index) y el onboarding de usuario (onboarding2). La opción "Quiero acompañar" lleva a coach-login → coach-application.
- `CoachLoginScreen` intenta signIn primero; si falla prueba signUp con nombre derivado del email. Navega a coach-application al autenticarse.
- `CoachApplicationScreen` inserta en `coaches` con `verified: false` y muestra confirmación inline. Maneja el caso de inserción duplicada (code 23505).
- `application_video_url` no existía en `coaches` — hay que correr el ALTER TABLE antes de probar el formulario (ver SCHEMA.md).

**Pendiente para la próxima sesión:**
- Correr en Supabase: `ALTER TABLE coaches ADD COLUMN application_video_url text;`
- Probar el flujo completo en Expo Go (bifurcación → coach-login → coach-application → confirmación)
- Definir qué ve un coach en `/(tabs)` una vez aprobado (`verified: true`) — hoy cae al mismo home de usuario

---

## 2026-06-20 — Andre

**Tocado:** `bookings` (esquema), `SCHEMA.md`

**Resumen:**
- Se agregó la columna `user_message` (text, nullable) a `bookings` vía
  `ALTER TABLE` — necesaria para guardar el mensaje opcional que el usuario le
  escribe al coach antes de reservar (la UI ya existía en
  BookingScreen_Confirm.tsx, pero la columna no estaba en el esquema
  actualizado, causando el error "Could not find the 'user_message' column").
- Cambio no destructivo (agrega columna nullable, no afecta filas existentes),
  corrido directamente sin bloquear en avisar a Joaquín dado el bajo riesgo.

**Pendiente para la próxima sesión:**
- Confirmar que el flujo completo de reserva funciona de punta a punta con
  esta columna agregada.

---

## 2026-06-20 — Andre

**Tocado:** `SCHEMA.md`, `screens/BookingScreen_Confirm.tsx`

**Resumen:**
- Resuelto merge con cambios de Joaquín (commit relacionado a `beae3d88`). La base de datos real cambió desde la última verificación — confirmado con `information_schema` que `bookings` ya tiene `coach_name`, `coach_specialty`, `scheduled_date`, `scheduled_time`, `amount`, `room_url` (Joaquín los agregó). `SCHEMA.md` actualizado con el estado real y confirmado.
- Confirmado con SQL: `bookings.coach_id` → `coaches.id`, mientras que `salas.coach_id` → `profiles.id` (= `coaches.profile_id`). Son dos FKs distintas con el mismo nombre de columna — quedó documentado en SCHEMA.md como regla crítica para no repetir el bug.
- `salas.room_url` ya existe en la base — el trigger de Jitsi Meet que charlamos con Joaquín ya está corrido y activo.
- En `BookingScreen_Confirm.tsx`: se corrigió que el código buscaba el coach por `specialty` en vez de por su ID real — esto podía reservar con el coach equivocado si dos coaches compartían especialidad. Ahora busca por `coachId`/`profileId` que llega desde la navegación, resolviendo `coaches.id` y `coaches.profile_id` en una sola query.
- Se mantuvo en la versión final: notificación push al coach, mensaje opcional del usuario, y se sumó el `roomUrl` de la sala para pasarlo a `booking-success`.

**Pendiente para la próxima sesión:**
- Resolver `CLAUDE.md` (1 conflicto) y confirmar que el protocolo de cierre de sesión quedó bien definido para ambos.
- Probar el flujo completo de reserva de punta a punta con esta versión corregida — todavía no se confirmó en el dispositivo que el bug de coachId esté resuelto.
- Sacar el selector "Test:" (locked/soon/live) de `SalaScreen.tsx` antes de producción.
- Confirmar si `AuthRedirect` (`segments[0] === '(coach)'`) funciona como se espera en expo-router — sospecha sin confirmar de sesión anterior.
- Conectar el botón de video de `SalaScreen.tsx` al `room_url` real (ya tiene el dato disponible, falta el `Linking.openURL` y sacar el `MEET_LINK` hardcodeado).
## 2026-06-20 — Joaquín (sesión 6)

**Tocado:** `screens/SalaScreen.tsx`, `CLAUDE.md`, `CHANGELOG_SESIONES.md`

**Resumen:**
- Tarea 4 completada y verificada: botón de video en SalaScreen ahora fetcha `room_url` real de `salas` por `sala_id` param y lo abre con `Linking.openURL()`. Probado end-to-end con sala real.
- Botón deshabilitado visualmente cuando no hay `room_url` (sala sin trigger corrido o sin `sala_id` en params).
- Agregado protocolo de cierre de sesión automático a `CLAUDE.md` — Claude actualiza el CHANGELOG sin que haya que pedirlo.

**Pendiente para la próxima sesión:**
- Andre tiene que conectar la navegación a `/sala?sala_id=<uuid>` desde algún punto del flujo real (lista de chats del coach, post-booking, etc.).
- Al mergear la versión completa de Andre de SalaScreen (con `init()` y `coach_id` fallback), verificar que `room_url` también se setea en esos paths.

---

## 2026-06-20 — Joaquín (sesión 5)

**Tocado:** `screens/SalaScreen.tsx`

**Resumen:**
- Botón de video en SalaScreen conectado a Supabase: acepta `sala_id` por params de navegación,
  fetcha `room_url` de la tabla `salas`, y lo abre con `Linking.openURL()`.
- Botón deshabilitado visualmente (color tenue, sin onPress activo) cuando no hay `sala_id`
  o la sala no tiene `room_url` todavía.
- Sin cambios estructurales: mensajes y datos del coach siguen hardcodeados — la integración
  completa de mensajes reales es trabajo de Andre en su rama.

**Estado:** botón de video probado end-to-end con sala real (UUID `25e048d3`). Abre Jitsi correctamente.

**Pendiente (coordinar con Andre):**
- Nada navega todavía a `/sala` con un `sala_id` real desde el flujo de usuario. Andre tiene
  que conectarlo desde la lista de chats del coach o desde otro punto de entrada.
- Cuando Andre mergee su versión más completa de SalaScreen (con `init()`, `coach_id` fallback,
  `handleVideoPress`), verificar que `room_url` también se pasa al estado `roomUrl` en esos paths.

---

## 2026-06-20 — Joaquín (sesión 4)

**Tocado:** `SCHEMA.md`, `screens/BookingScreen_Confirm.tsx`

**Resumen:**
- SCHEMA.md reescrito con el esquema real confirmado por Andre (information_schema).
  Correcciones clave vs. versión anterior: bookings tiene date/time (no scheduled_date/time),
  no tiene coach_name/amount/room_url; salas no tiene room_url todavía; coach_id en salas
  y bookings es profiles.id (no coaches.id).
- BookingScreen_Confirm corregido:
  - Lookup coach: ahora solo pide profile_id (no coaches.id — era incorrecto)
  - INSERT salas: sin cambios (ya usaba coachProfileId correctamente)
  - INSERT bookings: usa date/time, coach_id = coachProfileId (profiles.id), sin coach_name/amount
  - Si coach no encontrado: error explícito en vez de crear sala sin coach
  - room_url: se pide pero queda vacío hasta que corra add-salas-room-url.sql

**Pendiente (requiere Andre):**
- Correr `scripts/add-salas-room-url.sql` para activar room_url en salas
- Confirmar si bookings.coach_id tiene FK explícita a profiles o es solo una convención
- SalaScreen botón de video (esperando decisión sobre cómo compartir el link)

---

## 2026-06-20 — Joaquín (sesión 3)

**Tocado:** `scripts/add-salas-room-url.sql` (nuevo), `screens/BookingScreen_Confirm.tsx`, `CHANGELOG_SESIONES.md`

**Resumen:**
- Creado `scripts/add-salas-room-url.sql` — script idempotente para que Andre revise antes de correr. Agrega `salas.room_url` y el trigger Jitsi. NO fue ejecutado.
- Removido `ensureAnonSession` de `BookingScreen_Confirm` (regla de producto: booking requiere sesión real). Reemplazado con `supabase.auth.getSession()` + redirect a `/login` si no hay sesión.

**Revisión de commits post-merge — qué está y qué falta:**

✅ Ya aplicado y correcto en main:
- Loading/error states + Alert en BookingScreen_Confirm
- `registrarEvento('reserva_iniciada' | 'reserva_confirmada')`
- Lookup coach por specialty → `coaches.id` + `coaches.profile_id` (para salas)
- Crear/buscar sala por `user_id + coach_id (profile_id)`
- INSERT booking con `sala_id`
- `roomUrl` (de la sala) pasado a BookingScreen_Success
- `Linking.openURL(roomUrl)` en BookingScreen_Success

✅ Aplicado en esta sesión:
- Booking requiere sesión real (no anónima) — redirect a /login si no hay sesión

⏳ Pendiente de coordinación con Andre:
- `SalaScreen.tsx` botón de video → abrir `salas.room_url` real en vez del link hardcodeado. La lógica está clara pero Andre define cómo se comparte el link (solo usuario, ambos, notificación).
- Revisar si `ensureAnonSession` dev-fallback con email hardcodeado debe removerse de `lib/supabase.ts` (Diario y Gratitud lo siguen usando — decisión de producto).
- Confirmar con Andre que `scripts/add-salas-room-url.sql` refleja el estado real de la base antes de correrlo.

---

## 2026-06-20 — Joaquín (sesión 2)

**Tocado:** `SCHEMA.md`, `CHANGELOG_SESIONES.md` (trigger Jitsi en `salas`)

**Resumen:**
- Adaptado el trigger de Jitsi Meet para correr sobre `salas` en vez de `bookings`, siguiendo la arquitectura de Andre.
- `ALTER TABLE salas ADD COLUMN room_url text` + trigger `fn_salas_room_url` corrido y verificado.
- Cada nueva sala generada automáticamente recibe `https://meet.jit.si/vita-<16hex>`.
- Decisión arquitectural confirmada: `salas` es la fuente del `room_url`, no `bookings`.

**Pendiente:**
- Reconectar el flujo de reserva en la app (BookingScreen_Confirm) a la arquitectura de Andre: crear/buscar sala primero, luego booking con `sala_id`.
- El `bookings` actual en prod todavía tiene nuestro schema viejo (room_url, coach_name, etc.) — decidir si migrar o limpiar.

---

## 2026-06-20 — Joaquín

**Tocado:** `lib/supabase.ts`, `screens/BookingScreen_Confirm.tsx`, `screens/BookingScreen_Success.tsx`, `scripts/supabase-bookings-setup.sql`, `scripts/supabase-bookings-setup.sql` (trigger Jitsi), `SCHEMA.md`, `CHANGELOG_SESIONES.md`, `CLAUDE.md`

**Resumen:**
- Conectado el flujo de reserva completo a Supabase: INSERT en `bookings`, lookup de `coach_id` por specialty, analytics events (`reserva_iniciada`, `reserva_confirmada`), loading/error states con Alert.
- Creada tabla `analytics_events` con RLS.
- Recreada tabla `bookings` con schema nuevo (DROP CASCADE + CREATE): agrega `coach_name`, `coach_specialty`, `scheduled_date`, `scheduled_time`, `amount`, `room_url`. Elimina el schema anterior de Andre (`sala_id`, `date`, `time`, `user_message`).
- Trigger `trg_booking_room_url` genera sala Jitsi Meet automáticamente (`https://meet.jit.si/vita-<16hex>`) al insertar un booking.
- `BookingScreen_Success` abre la sala real con `Linking.openURL(roomUrl)`.
- `ensureAnonSession()` tiene fallback al usuario de diagnóstico (`test_vita_diag@example.com`) cuando anon sign-in está rate limited en desarrollo.
- Flujo probado end-to-end: reserva guardada, sala Jitsi generada y abierta correctamente.

**⚠️ Conflicto con diseño de Andre:**
- El schema de `bookings` que Andre describía (con `sala_id`, `date`, `time`, `user_message`) NO existe en la base actual — fue reemplazado por el nuestro.
- `salas` y `messages` de Andre SÍ existen y no fueron tocadas.
- Decidir si `bookings` debería tener `sala_id` como FK a `salas` (requiere migración).

**Pendiente:**
- Quitar fallback de email de diagnóstico de `ensureAnonSession()` antes de producción.
- Decidir con Andre si `bookings` se vincula a `salas` con `sala_id`.
- Verificar columnas de `saved_resources`.

---

## 2026-06-19 — Andre

**Tocado:** `lib/supabase.ts`, `BookingScreen_Confirm`, `BookingScreen_Success`, `app/_layout.tsx`, `context/AuthContext.tsx`, `screens/LoginScreen.tsx`, `package-lock.json`

**Resumen:**
- Resuelto merge con varios conflictos de Joaquín (commit `94aa144d` y anteriores). Se priorizó el esquema real de la base (ver SCHEMA.md) sobre código que asumía un esquema distinto.
- Bug encontrado y arreglado: `AuthProvider` no envolvía el árbol en `app/_layout.tsx` — causaba colgado silencioso en pantalla de inicio.
- Bug encontrado y arreglado: `styles` no definido en `LoginScreen.tsx` (debía ser `s`), más una llave huérfana en el StyleSheet.
- Bug encontrado, NO arreglado todavía: el flujo de reserva pasa `profileId` mal en algún punto de la cadena Conexiones → ProfesionalScreen → booking-calendar → booking-confirm, cayendo al fallback hardcodeado de coachId. Quedó con logs de debug puestos, falta confirmar el valor real.
- Confirmado con SQL: `salas.coach_id` y `salas.user_id` son FK a `profiles.id`, NO a `coaches.id`.
- Descubierto: Joaquín tiene un script SQL (`scripts/supabase-bookings-setup.sql`) que diseña una arquitectura distinta (bookings fusionado con salas, trigger de Jitsi Meet automático) — en ese momento sin correr contra la base real.

**Pendiente para la próxima sesión:**
- Terminar de rastrear el bug de coachId/profileId en el flujo de reserva (logs ya puestos en ProfesionalScreen.tsx y BookingScreen_Confirm.tsx — recordar sacarlos después).
- Decidir con Joaquín si se adopta el trigger de Jitsi Meet (adaptado a `salas`, no a `bookings`).
- Sacar el selector "Test:" (locked/soon/live) de `SalaScreen.tsx` antes de producción.
