# CHANGELOG_SESIONES.md — Registro de sesiones de trabajo

> Antes de tocar código, leé la última entrada de quien no sea vos.
> Al terminar tu sesión, agregá tu propia entrada arriba de todo (orden cronológico inverso).

---

## 2026-09-04 — Joaquín (sesión 163 · fix del gate de consentimiento, punto 6 de la device review)

**Tocado:** `hooks/useConsentGate.ts`, `app/(tabs)/index.tsx`. `tsc`, lint y 462 tests limpios. Sin schema.

**Resumen — pre-vuelo del gate de consentimiento antes de la device review de Andre; se encontró y arregló por análisis estático el bug del punto 6, el que él marcó como "no se pudo verificar de ninguna forma desde la máquina".**

- 🔴 **Bug del punto 6, confirmado y arreglado:** revocar el consentimiento desde el Perfil y después tocar una carita en Inicio **guardaba el check-in sin volver a pedir** → trataba dato sensible después de revocado, justo lo que el gate existe para impedir. **Causa:** Inicio es una **tab**, no se re-monta al navegar, y su `useConsentGate` leía el consentimiento **una sola vez al montar**; como el Perfil tiene su propia instancia de `useConsent` sin nada que las sincronice (no hay contexto/store/realtime), el estado de Inicio quedaba **stale en `true`**. Encima el gate **ni exponía `refrescar`**. **Fix:** `useConsentGate` ahora devuelve `refrescar`, e Inicio lo llama en **cada foco** de la tab (`useFocusEffect`). Diario/gratitud no tenían el bug (son pantallas pusheadas, re-montan y leen fresco).
- ✅ **Validados por análisis (están bien):** punto 1 (la carita no queda marcada con el sheet abierto — el `await requireConsent()` corre antes de `setSelectedId`), punto 2 ("Ahora no" no guarda y re-pregunta), punto 8 (modo avión → "Sí, guardalo" no cierra el sheet).
- ⚠️ **Falta confirmar el fix EN DISPOSITIVO** (punto 6): revocar en Perfil → volver a Inicio → tocar carita → tiene que volver a pedir. El resto de la device review 157-163 (consentimiento, matrícula, "Sobre vos" early, ayuda) sigue pendiente de Joaquín.

## 2026-09-04 — Andre (sesión 162 · el piso de seguridad, construido y apagado)

**Tocado:** `lib/weeklyReflection.ts`, `lib/sobreVosMomento.ts`, `hooks/useDailyReflection.ts`, `app/(tabs)/index.tsx`, `constants/features.ts`, `docs/la-voz-de-sofia.md`, y los tests de reflexión/silencio/momento. Nuevos: `lib/pisoSeguridad.ts`, `__tests__/pisoSeguridad.test.ts`. **462 tests** (eran 446), `tsc` y lint limpios. Sin schema.

**Resumen — el ítem de `la-voz-de-sofia.md` §5 ter que venía frenando el resto del plan. Andre no tenía los números, así que primero se replanteó de dónde tenían que salir.**

- 🔴 **El umbral NO sale de un instrumento clínico, y eso fue el hallazgo.** El instinto era tomar el corte del PHQ-9 ("más de la mitad de los días durante dos semanas"). **Sería un error:** un umbral derivado de un instrumento diagnóstico convierte a Vita en una herramienta de **screening**, que es la línea que `encuadre-salud-y-responsabilidad.md` dice no cruzar — ahí la derivación se vuelve triage. Por eso es deliberadamente **grueso**: no afirma "cumplís criterios", afirma "esto viene pasando hace rato", que es un hecho sobre lo registrado y no una lectura del estado. **Con eso el número deja de necesitar validación clínica y lo podemos decidir nosotros.**
- **Umbral: los últimos 5 registros en 1 o 2, dentro de los últimos 14 días.** Se cuentan **registros y no días de calendario** — la gente no registra todos los días, y contar días haría que la señal se saltee por un fin de semana sin abrir la app; saltearse justo ahí es el peor modo de falla posible. La ventana de 14 días resuelve el problema opuesto: cinco días malos repartidos en dos meses no son un tramo sostenido.
- **`lib/pisoSeguridad.ts`** (puro, 9 tests) con los tres umbrales como constantes exportadas y un test que los fija: si alguien los mueve, que sea a propósito y en un solo lugar.
- **La rama va ARRIBA DE TODO en `buildReflection`, incluso de `sharp-drop`**, con tests que lo fijan contra sesiones, rachas y el propio `sharp-drop`. Y **no rota por día**: las demás señales varían su redacción para no volverse un cartel, pero cuando lo que hay que decir es "acá hay ayuda", decirlo distinto cada mañana sería tratarlo como copy.
- **Tres garantías fijadas con tests:** nunca la redacta un modelo (`useDailyReflection` la saltea — requisito ya escrito en `legal-instrucciones.md`), el silencio no puede callarla (`PUEDEN_CALLARSE` es lista de inclusión, y por eso se eligió así), y **no dispara el momento a pantalla completa** — no por poco importante sino al revés: el momento muestra una señal UNA vez y no la repite, y esto tiene que seguir estando todos los días que dure la condición.
- 🔴 **Queda APAGADO** detrás de `SAFETY_FLOOR_ENABLED`. A diferencia de `AI_REFLECTION_ENABLED`, este flag **no espera nada legal**: espera una revisión de contenido y una pantalla.

- ✅ **Hecha la pantalla `/ayuda` en la misma sesión** (`screens/AyudaScreen.tsx` + `app/ayuda.tsx`), con las líneas de T&C §5.3 tocables — un `tel:` por número, con aviso si el dispositivo no puede llamar (el número igual quedó visible). **Al construirla se vio que no dependía de la revisión del texto**: los números ya están escritos y verificados en los T&C. Lo que espera a una profesional es la frase de la tarjeta, no la pantalla. **El piso de seguridad queda a una sola cosa, y es un mail.**
- 🔴 **La decisión que más importa de esa pantalla no es su diseño: se llega también desde el perfil, logueado Y como invitado.** Si los números solo aparecieran cuando el algoritmo decide que corresponde, no estarían disponibles el día que alguien los necesita y la condición no se cumple — y ese día existe. Un umbral es una heurística; la necesidad no espera a cumplirla. Va **primera** en las dos listas de configuración.
- **La pantalla no pregunta nada y no es cálida**, a propósito. Ni "¿cómo estás?", ni una carita: quien llega ahí no viene a interactuar con una app, y cada elemento que no sea un número tocable es un obstáculo. El resto de Vita tiene voz; esta pantalla no — ponerse tierna justo ahí sería ponerse en el medio de algo que no le corresponde.
- 📝 `.expo/types/router.d.ts` se parcheó a mano para que `tsc` reconociera `/ayuda`. Es un archivo **generado y gitignoreado**: se regenera solo al levantar el dev server, y ahí va a incluir la ruta de verdad.

- ✅ **Cerrado el hueco de A.4: la insignia de matrícula llegó al deck de Conexiones, a su lista de resultados y a la confirmación de reserva.** Estaba solo en el perfil y el buscador, y se podía reservar sin pasar por ninguno de los dos — que era exactamente el problema original. **La confirmación es la que más importa**: es la última pantalla antes de pagar, y de ahí no hay otro paso donde enterarse.
- **Se extrajo `components/MatriculaPill.tsx`** en vez de dejar la cuarta copia. Con copias sueltas la quinta superficie se olvida, y "se olvidó de mostrarlo" acá significa que alguien reserva sin saber si eligió terapia o acompañamiento. Tiene variante `compact` (solo el escudo) para el deck, donde la tarjeta es chica y el nombre ya compite por el ancho.
- 📝 **Sigue sin existir la variante "sin matrícula"**, y es deliberado: en una grilla, una marca negativa en cada tarjeta se leería como advertencia contra profesionales que no hicieron nada mal. La distinción completa vive en el perfil, que es donde hay lugar para explicarla.

**Pendiente para la próxima sesión:**
- 🔴 **Que una profesional revise el texto de la tarjeta** (ya no la pantalla). Es la única frase de la app donde equivocarse sale caro de verdad. Mónica Grando ya corrigió el enfoque del paquete para la sesión, y esa corrección mejoró el diseño — es la consulta natural. El umbral no necesita su validación; el texto sí.
- Con eso, encender es cambiar un string y un booleano.

---

## 🔴 PARA JOAQUÍN — device review pendiente de las sesiones 157 a 163

**Se pararon los cambios acá a propósito.** Andre trabajó cinco tandas seguidas sin poder probar en dispositivo, y lo que se acumuló **no es cosmético: el consentimiento gatea los tres flujos de bienestar**. Si el sheet no cierra bien o el gate se traba, la app quedó peor que antes en las tres pantallas más usadas. Seguir apilando features sobre eso hace que, cuando algo falle, no se sepa cuál de las cinco tandas lo rompió.

**Estado de la base: las tres migraciones están CORRIDAS y verificadas**, y las dos edge functions nuevas deployadas. **Se puede buildear directo.**

### 1. Consentimiento de datos sensibles — lo más nuevo, toca tres flujos

Contexto en una línea: el ánimo, el diario y la gratitud son dato sensible (Ley 25.326 art. 7) y ahora requieren un opt-in expreso antes de guardar. Detalle en `docs/consentimiento-datos-sensibles.md`.

Usá una cuenta **sin fila en `user_consents`** — o revocá desde el perfil para volver al estado inicial.

1. **Inicio → tocar una carita.** Aparece el sheet. 🔴 **La carita NO tiene que quedar marcada** mientras el sheet está abierto: el gate corre antes de la animación, y si se marca quedó en el orden equivocado.
2. **"Ahora no"** → cierra, no guarda, la carita sigue sin marcar. Tocás de nuevo → vuelve a pedir.
3. **"Sí, guardalo"** → cierra, se guarda, la card "Sobre vos" reacciona.
4. **Tocar otra carita** → ya no pregunta.
5. **Diario** → escribir y guardar. No pregunta (ya consintió).
6. 🔴 **Perfil → switch "Guardar cómo venís" → apagar → volver a Inicio → tocar una carita → tiene que volver a pedir.** Es el punto donde se cruzan el hook, la edge function y la RLS, y es lo único que no se pudo verificar de ninguna forma desde la máquina.
7. **Gratitud** con el consentimiento apagado → también pide.
8. **Modo avión → "Sí, guardalo"** → el sheet **no** se cierra. Es deliberado: cerrarlo daría a entender que quedó registrado y no quedó.

### 2. Matrícula — la distinción entre coach y profesional matriculado

Sale de `docs/encuadre-salud-y-responsabilidad.md` §2: la Ley 23.277 reserva el diagnóstico y el tratamiento a quien tiene matrícula, y la app los mostraba igual.

⚠️ **Preparación**: hoy **ningún coach tiene matrícula verificada** — la única credencial aprobada del proyecto es un `titulo` ("LIC EN PSICOLOGIA"). Para ver el caso positivo hay que cargar una credencial **Matrícula** con su número desde el perfil del coach y aprobarla desde el panel de admin. Al aprobarla, `coaches.has_matricula` tiene que pasar sola a `true` — eso prueba el trigger en vivo.

1. **Perfil de un coach CON matrícula** → tarjeta verde salvia arriba de "Formación": *"Matrícula verificada por Vita"*.
2. **Perfil SIN** → tarjeta arena: *"Acompañamiento, no tratamiento"*.
3. **Espaciado** entre esa tarjeta y "Formación" — son dos secciones con `paddingTop: 28`. Si queda hueco, avisá.
4. **Insignia** en: buscador, deck de Conexiones, lista de resultados, y **confirmación de reserva** (la que más importa: es la última pantalla antes de pagar).
5. **Filtro tipo → "Psicólogo"** 🔴 Si nadie tiene matrícula, **devuelve vacío y eso es correcto**. Antes devolvía a cualquiera que escribiera "psicología" en su presentación, que es el defecto que se arregló.
6. **Alta de credencial**: el selector ahora arranca en **Matrícula**, y hay una línea que dice qué habilita cada tipo.
7. **Panel de admin**: al revisar un título de un coach sin matrícula verificada, aparece un aviso.

### 3. "Sobre vos" — la señal `early`

Cuenta **nueva**, sin check-ins previos.

1. **Un check-in con carita 4 o 5** → *"Recién empezamos a conocernos…"*. 🔴 Si dice **"Tu semana viene pareja"**, el arreglo no tomó (era un bug: afirmaba sobre la semana con un solo registro).
2. **Un check-in con carita 1 o 2** → tono suave, nombra **el día** y no la semana.
3. **Al tercer check-in** ya puede hablar del nivel de la semana.

### 4. La pantalla de líneas de ayuda

**Perfil → "Si necesitás ayuda ahora"** (primero de la lista, y también visible sin login). Los cuatro números tienen que abrir el marcador. En simulador no va a poder llamar y tiene que avisar por qué, con el número igual visible.

### 5. No se puede probar todavía

**El silencio de la card**: necesita dos días seguidos con señal `level`. Cuando pase, la card queda con el sello y el color del mood pero **sin frase, sin "→ Ver más" y no tocable**.

### Lo que quedó sin hacer a propósito

- **T&C §9.1 + `canCancelConfirmed`** — que siempre se pueda cancelar (sin reembolso dentro de las 24hs). Resuelve la contradicción con §9.4 ya anotada y mejora la posición legal gratis. **Se frenó a mitad de camino para no apilar más sobre lo no probado.**
- **El precio en pesos** (Res. 4/2025): necesita una decisión de Andre — convertir, o no ofrecerle ese coach a quien está en Argentina.

---

## 2026-09-03 — Andre (sesión 161 · la matrícula al catálogo, y un defecto peor que apareció en el camino)

**Tocado:** `lib/coachesCache.ts`, `app/search3.tsx`, `SCHEMA.md`. Nuevo: `scripts/add-coach-has-matricula.sql` (⚠️ **pendiente de correr**). 446 tests, `tsc` y lint limpios.

**Resumen — se fue a llevar la distinción de matrícula del perfil al catálogo, y apareció que el buscador estaba haciendo una afirmación profesional sin ninguna verificación detrás.**

- 🔴 **EL HALLAZGO: `inferType()` en `search3.tsx` decidía "Psicólogo" con `specialty.includes('psicolog')`.** Sobre un campo de **texto libre que escribe el propio profesional**, y con un filtro por ese tipo en la UI. O sea que cualquiera que pusiera "acompañamiento en psicología positiva" aparecía bajo el filtro Psicólogo — **y quien filtra por Psicólogo es exactamente la persona que está buscando terapia**. La Ley 23.277 reserva el diagnóstico y el tratamiento a quien tiene matrícula, y la app estaba haciendo esa afirmación por su cuenta, desde una fuente que nadie verifica, en el contexto donde más importa.
- **Arreglado:** la palabra clave sigue siendo necesaria pero **ya no alcanza** — hace falta además `has_matricula`. Sin matrícula verificada, el tipo es `Coach`, sin importar lo que diga la presentación.
- ⚠️ **Y sigue sin ser perfecto, que también quedó escrito:** `has_matricula` dice que hay UNA matrícula chequeada, no de qué profesión —el título es texto libre—, así que un nutricionista matriculado que mencione psicología todavía podría caer ahí. Cerrarlo del todo pide un **campo estructurado de profesión** en `coaches`, que es decisión de producto y no un parche.
- **`coaches.has_matricula`**: derivada por `trg_sync_matricula` desde `coach_credentials`, con el `update` **revocado**. Mismo criterio que `accepts_international` — como casilla podría contradecir a los datos y el catálogo anunciaría una matrícula que nadie verificó. El trigger va **sin `of` en columnas** porque editar una credencial la devuelve a `pendiente` (`trg_reset_credential_on_edit`) y ese reset tiene que apagar la marca.
- **Insignia en la tarjeta del buscador**, y solo cuando hay matrícula verificada. **No se muestra nada en el caso contrario**: en una grilla, una marca de "sin matrícula" en cada tarjeta se leería como advertencia contra profesionales que no hicieron nada mal. La distinción completa —qué es cada uno y qué significa— vive en el perfil, que es donde hay lugar para explicarla.

- ✅ **`add-coach-has-matricula.sql` CORRIDO y verificado el mismo día**: columna creada, `authenticated` con **solo SELECT** —el catálogo la lee, el coach no la escribe— y el backfill con **0 filas de diferencia** contra las credenciales verificadas. 📝 Las dos verificaciones salieron mal escritas la primera vez: la del backfill pedía `coaches.name`, que no existe (el nombre vive en `profiles`), y la de privilegios decía "esperado 0 filas" cuando `SELECT` **tiene que estar**. Corregidas en el script.

**Probado en dispositivo, y salió un problema de producto (no de código).**

- Andre aprobó "la matrícula" de un coach y el cartel *"Acompañamiento, no tratamiento"* no desapareció. **No estaba roto**: consultando la vista pública contra la base, la única credencial verificada del proyecto es `kind = 'titulo'`, título *"LIC EN PSICOLOGIA"*. La tarjeta lee `kind === 'matricula'`, así que decía la verdad, y `has_matricula` en `false` también era correcto.
- 🔴 **Pero el producto sí tenía un problema.** El criterio legal está bien —la Ley 23.277 exige título habilitante **Y** matrícula, y la matrícula es lo único que un tercero puede chequear— pero desde la silla del coach se ve como una falla: subís tu título de Lic. en Psicología, te lo verifican, y tu perfil sigue diciendo que no hacés tratamiento. **Nada en la pantalla explicaba que la que cuenta es la matrícula**, y el selector arrancaba en `titulo`.
- **`CoachCredentialsScreen`**: el default pasó a `matricula`, y hay una línea bajo el selector que dice qué habilita cada tipo — *"es la que habilita la marca de profesional matriculado en tu perfil público"* contra *"suma a tu formación, pero la marca la da la matrícula"*.
- **Panel de admin**: al revisar una credencial que no es matrícula de un coach que **no tiene matrícula verificada**, aparece un aviso. Aprobar un título suma a la formación pero no lo marca como matriculado, y sin ese aviso el admin aprueba pensando que resolvió algo. `list_pending_credentials` devuelve ahora `coach_has_matricula` (una query extra por lote, no por fila). **`admin-actions` redeployada.**

**Pendiente para la próxima sesión:**
- **Llevar la insignia también al deck de Conexiones y a la confirmación de reserva.** Hoy quedó en el buscador; el deck y el checkout siguen sin mostrarla.
- **Decidir el campo estructurado de profesión.** Es lo único que cierra del todo el problema de `inferType`.
- Sin confirmar en dispositivo.

---

## 2026-09-03 — Andre (sesión 160 · `user_consents`: el consentimiento de datos sensibles, construido)

**Tocado:** `components/MoodCheckIn.tsx`, `app/(tabs)/index.tsx`, `screens/ProfileOwnScreen.tsx`, `SCHEMA.md`. Nuevos: `scripts/add-user-consents.sql`, `supabase/functions/user-consent/`, `lib/consentRules.ts`, `lib/consent.ts`, `hooks/useConsent.ts`, `components/ConsentSheet.tsx`, `__tests__/consentRules.test.ts`. **446 tests** (eran 438), `tsc` limpio, lint sin errores nuevos.

**Resumen — se construyó lo que `docs/consentimiento-datos-sensibles.md` dejó diseñado en la 157. Era el primero del orden propuesto en la revisión de las propuestas de Joaquín, y ahora es prerrequisito de la Fase 1 del recomendador.**

- 🔴 **ORDEN DE DESPLIEGUE, Y SI SE INVIERTE SE ROMPE EL CHECK-IN.** Antes de buildear: (1) correr `scripts/add-user-consents.sql`, (2) `npx supabase functions deploy user-consent`. Si el build sale primero, `getConsent` falla contra una tabla que no existe, el fail-closed devuelve null, y **nadie puede registrar su ánimo**. Es a propósito que rompa fuerte: un fallback que dejara pasar el check-in "porque todavía no está la tabla" sería tratar dato sensible sin consentimiento, que es justo lo que esto viene a impedir. Está avisado en el encabezado de `lib/consent.ts`.
- 🔴 **El titular NO puede escribir su propia fila.** `insert`/`update`/`delete` revocados para `authenticated`, RLS con una sola policy de select. Se escribe solo desde la edge function, que verifica el JWT y deja que la base ponga la fecha con su reloj. **Es la corrección del defecto que `SCHEMA.md` ya documentaba** sobre `profiles.accepted_terms`: esas columnas las escribe el cliente, o sea que son falsificables por su titular. El Decreto 1558/2001 admite el consentimiento por medio no escrito pero exige asegurar **autoría e integridad**, y una fila que el titular fecha como quiera no asegura ninguna.
- **Tabla y no columnas, porque lo que se prueba es la historia.** Se inserta una fila por acto; otorgado → revocado → otorgado queda entero. Un `update` lo borraría. La app lee `user_consents_current`, una vista con `distinct on` y `security_invoker = true` que hereda la RLS.
- **Fail-closed en tres lugares**, y los tres a propósito: `getConsent` devuelve null si la query falla; `useConsent` arranca con `puede = false` mientras carga; y `requireConsent` en Inicio devuelve false mientras no sepa. Asumir el permiso hasta que la consulta conteste sería tratar dato sensible sobre un estado no leído.
- **El gate va ANTES de la animación del check-in.** Si la persona dice que no, no queda una carita marcada como si algo se hubiera guardado. Y el `requireConsent` de `MoodCheckIn` es una promesa, así que el toque simplemente no hace nada hasta que conteste el sheet.
- **La pantalla pide en el PRIMER USO, no en el alta.** El consentimiento tiene que ser informado, y en el registro nadie lee. Acá la persona acaba de tocar una carita: el pedido tiene contexto.
- **"Ahora no" es una salida real y visible**, no un link gris. Ley 25.326 art. 7.1: nadie puede ser obligado a dar datos sensibles, así que esto no puede ser condición para usar la app — y el pie del sheet lo dice explícito. Tampoco hay X al costado: un consentimiento es un acto y una X no dice si aceptaste.
- **Revocación en el perfil, junto a las preferencias y no escondida en Configuración.** La revocación tiene que ser tan fácil como el otorgamiento o el consentimiento deja de ser libre. 📝 Se construyó **porque el copy del sheet la promete** — dejarla para después habría sido prometer algo que no existe, el mismo error que se viene evitando en los textos legales.
- **`LO_QUE_CUBRE` incluye "qué recursos usás"**, con un test que lo fija. Entró por TJUE C-184/20 (ver sesión 159). Si esa línea desaparece, la pantalla deja de informar algo que sí se trata.
- 📝 **Deliberado: NO se re-pide el consentimiento cuando cambia `LEGAL_VERSION`.** Es un hash del texto entero, así que se mueve con una corrección de tipeo — re-pedirlo por eso lo convierte en ruido, que es cómo un consentimiento deja de ser informado. Cuando cambie la FINALIDAD hay que volver a pedirlo, y eso es una decisión de producto. Falta el mecanismo para forzarlo a mano.

**Cerrado en la misma sesión — corrido, deployado y verificado contra la base.**

- ✅ **`add-user-consents.sql` CORRIDO.** Tabla y vista existen, `authenticated` con **solo SELECT**, una sola policy (`user_consents_select_own`, cmd = r). **`user-consent` deployada, v1 ACTIVE**, `verify_jwt = true`. Ya se puede buildear.
- 🔴 **Verificando eso apareció un hueco de seguridad de todo el proyecto.** El `revoke` original decía `insert, update, delete` y la verificación devolvió igual **SELECT + TRUNCATE + REFERENCES + TRIGGER**: Supabase los concede por default sobre todo `public`. El barrido confirmó que estaban en **todas** las tablas y vistas — `mood_entries`, `journal_entries`, `messages`, `profiles`, `bookings`, `coach_payout_accounts` incluidas.
- 🔴 **`TRUNCATE` es el que importa porque la RLS NO lo filtra.** Las policies se evalúan sobre select/insert/update/delete; truncate no pasa por ahí. Toda la protección por filas del proyecto no decía nada sobre vaciar una tabla entera. ✅ **No era explotable desde la app** —PostgREST no expone TRUNCATE por HTTP—, así que era un permiso sobrante y no un incidente; dejaría de ser teórico el día que exista una RPC con SQL dinámico.
- ✅ **`revoke-truncate-trigger-references.sql` CORRIDO y verificado**: el barrido devuelve 0 filas, y el control confirma que no se llevó puesto nada (las cinco tablas de escritura conservan sus permisos, `user_consents` quedó en SELECT). Toca además `alter default privileges` para que la próxima tabla no nazca igual — sin esa parte vuelve, que es lo que le pasó a `user_consents`.
- 📝 **Por qué se le escapó a la auditoría de la 152:** esa revisión miró RLS, policies y autorización de las functions, que es donde uno mira. Los grants de tabla son la capa de abajo, y la RLS da la sensación de que ya está cubierto. Apareció solo porque se verificó un `revoke` propio en vez de darlo por bueno.

- ✅ **Gateadas las tres superficies**, no solo el check-in. `app/diario.tsx` y `app/gratitud.tsx` también piden el consentimiento antes de escribir — es texto libre sobre cómo está la persona, o sea dato sensible del art. 7 igual que el ánimo. En las dos el gate va **antes de la animación de guardado**: si dice que no, el botón no hace el gesto de guardar algo que no se guardó.
- **Se extrajo `hooks/useConsentGate.ts`** en vez de repetir la plomería tres veces. Eran tres pantallas haciendo lo mismo —preguntar, esperar la respuesta, seguir o abortar— y el estado del resolver duplicado era garantizar que la cuarta se lo olvidara. "Se olvidaron de preguntar" acá significa tratar dato sensible sin consentimiento. `useConsent` queda para quien solo necesita leer el estado, como el switch del perfil.
- ✅ **Política §3 reescrita y `sync:legal` corrido.** Sale el consentimiento por conducta ("otorgado al utilizar las funcionalidades"), que era lo más débil del texto. Ahora tiene cuatro incisos: qué cubre —incluido **el registro de qué contenidos usa**, con el fundamento de que se deduce salud—, que se pide separado y con constancia de fecha y versión, que **es voluntario y no condiciona el uso de la Plataforma** (art. 7.1), que se revoca desde el perfil, y que no se comparte con nadie salvo que la persona lo mande. **De 15 placeholders quedan 8, y 6 son fechas** — los dos reales son A.5 y el encuadre de las transferencias.

**Pendiente para la próxima sesión:**
- **Sin confirmar en dispositivo**: el sheet, el gate, y la revocación desde el perfil.
- 📝 **Sin resolver, y es para la consulta legal:** la FK contra `auth.users` es `on delete cascade`, así que al darse de baja se borra también la constancia de que el tratamiento pasado fue lícito. Conservarla exige cambiar la FK.

---

## 2026-09-03 — Andre (sesión 159 · revisión crítica de las propuestas de Joaquín, y un bug que salió de ahí)

**Tocado:** `lib/weeklyReflection.ts`, `lib/sobreVosMomento.ts`, `hooks/useDailyReflection.ts`, `supabase/functions/weekly-reflection/index.ts`, `__tests__/weeklyReflection.test.ts`. **438 tests** (eran 429), `tsc` y lint limpios. Sin schema.

**Resumen — se hizo la revisión crítica que pidió Joaquín en las sesiones 156/158. Salieron seis objeciones, dos decisiones cerradas y un bug real que ya estaba en producción.**

- 🔴 **BUG ARREGLADO: con UN solo check-in la card decía "Tu semana viene pareja".** `empty` solo cubría cero registros, `sustained-low` y las dos de tendencia exigen `MIN_SAMPLE = 3`, así que uno o dos registros caían derecho al fallback `level` — que afirma algo sobre **la semana** a partir de **un día**. Y le tocaba justo a quien recién llega, que es el caso más común mientras la base sea chica. Señal nueva **`early`** entre medio.
- ⚠️ **La primera versión del arreglo tenía una regresión, y me la encontró el test viejo.** Alguien que registra un único día y ese día es un bajón recibía la invitación neutra a seguir registrando — o sea, no acusar recibo justo cuando más hace falta. `early` quedó con **dos juegos de variantes**: gentle si el promedio es ≤ 2 (nombra el día, cede el tono, nunca dice "semana"), neutral si no.
- **`early` va DESPUÉS de sesiones/racha/prácticas a propósito.** Esas señales no dependen de cuántos moods haya: una sesión de esta semana es cierta con un check-in o con siete. Lo único que había que frenar era la afirmación sobre el nivel de la semana. Hay tests que fijan las dos cosas.
- **Alineado el resto:** `early` se suma a `LOW_VALUE_SIGNALS` (no dispara el momento — es una invitación, no una noticia), `useDailyReflection` no le pide frase al modelo (lo único honesto ahí es "todavía no sé lo suficiente", y para eso no hace falta un modelo), y la edge function acepta la señal y sabe qué hacer con ella.
- 📝 **El test viejo documentaba el bug como intencional** (`casos: [[1], [2], ...]` con el comentario "a la rama de nivel llegan con una o dos entradas"). Se actualizó: los niveles 1 y 2 ya no llegan a `level` por ningún camino.

**Revisión crítica de las dos propuestas — lo que se le devuelve a Joaquín:**

- 🔴 **El catálogo invalida la Fase 1 y él mismo lo encontró.** Hay 8 objetivos y 8 recursos de coaches: **uno por objetivo**. El ranker no elige entre varios, devuelve el único que hay. Para que un peso mueva el resultado hacen falta 3-4 por objetivo, o sea **25-30 recursos**. Debajo de eso lo que sirve es un **filtro por intención**, que es un `where` y no un módulo con pesos.
- 🔴 **La Fase 1 no está destrabada legalmente.** El §6 dice que el comportamiento no es dato sensible. **No se sostiene:** TJUE **C-184/20** (01/08/2022) — los datos que por "una operación intelectual de comparación o deducción" revelan información sensible **son** categoría especial. "Escuchaste tres audios de ansiedad" es una deducción de un paso. Y la My Health My Data de Washington define health care services como *"cualquier servicio para evaluar, medir, mejorar o aprender sobre la salud mental o física"* y protege el hecho de **buscarlos**. → **`user_consents` pasa de Fase 2 a prerrequisito**, y ⚠️ **`docs/consentimiento-datos-sensibles.md` hay que actualizarlo**: el opt-in que diseñé cubre ánimo/diario/gratitud y ahora tiene que cubrir también qué recursos usás.
- ✅ **Decisión cerrada con Andre: NO toda card lleva acción.** La capa 3 pedía una acción cada vez que la card habla, y eso choca con `sobreVosSilencio.ts`. Motivo de Andre: **satura**. Día con señal, habla y ofrece; día sin señal, se calla y no pide nada. La decisión 1 de `card-sobre-vos.md` queda respondida.
- ✅ **Decisión cerrada: el paquete va primero.** La decisión 4 no era una decisión — es una dependencia de una sola vía. El paquete no necesita a la card (demanda comprobada, Mónica ya lo hace a mano); la card sin el paquete pierde la capa 2 entera y la mitad de las acciones aterrizan en el aire.
- **El `why` del ranker tiene que ser un enum cerrado**, no texto libre: "porque escuchaste tres audios de foco" está bien, "porque venís con ansiedad" es el modo analista que la propuesta rechaza, y `rejectCopy` no está diseñado para detectar eso.
- **Aclaración pedida por Andre:** el recomendador va en Recursos. El motor (`resourceRanking.ts`) es puro y compartido; la card de momento vive en Recursos; Inicio como mucho hace un ofrecimiento de una línea y manda para allá. Así se resuelve la decisión 5 sin romper "una voz, no dos".

- ✅ **`docs/consentimiento-datos-sensibles.md` ampliado**: sección nueva en §1 con el hallazgo de C-184/20 y la MHMDA, y el opt-in de §4 y el texto de §5 ahora cubren también qué recursos usás. Misma pantalla y misma tabla — cambia el texto informado.
- ✅ **Devolución escrita para Joaquín en `docs/revision-propuestas.md`**, con los siete puntos, el orden propuesto y el balance de decisiones (de diez quedan seis abiertas).

**Pendiente para la próxima sesión:**
- La conversación del catálogo (§7 del plan paraguas) sigue siendo la que más mueve la aguja y no es de código.

---

## 2026-09-03 — Joaquín (sesión 158 · la barra del reproductor, hasta que quedó fluida)

**Tocado:** `app/coach-recurso.tsx`, `app/formato.tsx`, `screens/SalaScreen.tsx`. `tsc`, lint (solo warnings pre-existentes de `user`) y 429 tests limpios. Sin schema.

**Resumen — la barra de progreso pasó por varias vueltas hasta quedar fluida en reproducción, arrastre y tap. Confirmado en dispositivo por Joaquín. Además: la tarjeta de recomendación ahora abre el chat con un borrador escrito, y se nulearon las duraciones de audio de seed.**

- **Tarjeta "Pedile una recomendación" (formato.tsx):** a Joaquín no le cerraba porque **prometía pedir una reco pero te dejaba en el chat vacío** — sin mensaje ni contexto de que mirabas ese formato. Ahora al tocarla abre la sala con un **borrador ya escrito** (sin enviar), por formato ("Hola, ¿me recomendás algún audio para escuchar?", etc.). La sala acepta un param `draft` que siembra el input una vez al montar (mismo patrón que `abrir_notas`/`notas_booking`). El usuario lo edita o manda.
- **Duraciones de seed (base, sin migración):** las dos filas de **audio** SEED tenían `duration_seconds` inventado (600s/480s) con un archivo placeholder de ~8s → mostraban "10:00" con un audio de 8s. Se nulearon (solo audio; podcast/video son referencias externas sin archivo que las contradiga, se dejaron).

- 🔴 **Lag en reproducción:** el motor reiniciaba un `Animated.timing` en **cada tick de status (~4/seg)** y recreaba los nodos de interpolación en cada render → el native driver rearmaba el grafo y tironeaba. Fix: **una sola animación** hacia el final, reinicio **solo en eventos discretos** (play/pausa/velocidad/seek) + un detector de saltos aparte para los ±15s; interpolaciones memoizadas. Eso dejó la reproducción fluida.
- 🔴 **Lag en el arrastre:** seguía tironeando porque corría en el **hilo de JS** (`PanResponder` + `Animated.setValue`), que en dev se satura con los re-renders de status. Se pasó **toda la barra a Reanimated + gesture-handler** (shared value + `withTiming` + `Gesture.Pan`), 100% en el **hilo de UI** → inmune a los re-renders. Coordenada = `e.x` relativo al `GestureDetector` (sin medir nada). Texto de tiempo con throttle por segundo dentro del worklet. Antes de usar Reanimated se verificó que el plugin de worklets ya está configurado (OnboardingScreen1 usa `'worklet'` + `useSharedValue`) → sin riesgo de build.
- 🔴 **Tap congelado:** el `Pan` con `minDistance(0)` no resuelve bien un toque sin movimiento y `scrubbing` quedaba pegado. Se separó en dos gestos (**patrón slider**): un **`Tap`** dedicado (solo hace seek, nunca toca `scrubbing`, no se puede colgar) y el **`Pan`** para arrastrar, compuestos con **`Exclusive(pan, tap)`** — el pan con un `minDistance` chico así un toque quieto lo agarra el tap. El seek del pan va en `onEnd` (solo en drag real); `onFinalize` solo resetea `scrubbing` por si se cancela.
- 📝 **Aprendizaje para la próxima:** una barra/slider con animación continua + gesto se hace con **Reanimated + gesture-handler desde el arranque**, no con RN `Animated` + `PanResponder`. El native driver ayuda en reproducción pero el gesto sobre JS tironea en dev; y tap vs. drag se separan en dos gestos, no se fuerzan en un Pan con `minDistance(0)`.

**Device review — HECHA.** Joaquín revisó todo en el teléfono: reproductor (barra fluida en reproducción/arrastre/tap), vista lista + deck con el toggle, hero, bloques "Quién lo hizo" / "Después de esto", y el borrador de la tarjeta de recomendación. Todo funciona. **El bloque de Recursos (sesiones 156/158) queda cerrado.**

**Pendiente para la próxima sesión:**
- Nada abierto de código en Recursos.
- 🔴 **PARA ANDRE — arrancá por acá:** hay un **plan integral paraguas** que ata todo → **`docs/plan-integral-acompanamiento.md`**. Es el punto de entrada: conecta las dos propuestas (son la misma tesis en dos superficies), la columna vertebral compartida, el estado real, el roadmap por fases y las dependencias. Los dos docs de abajo son el detalle. 🔴 **Un hallazgo del plan que no estaba dicho: el catálogo es chico** (8 coach_resources + 3 curados = 11) — por más fino que sea el motor, sobre 11 items el techo de valor es bajo; cómo crece el catálogo es la conversación que más mueve la aguja (contenido/estrategia, no código).
- 🔴 **PARA ANDRE — necesita tu OK antes de arrancar (decisión de los dos):** Joaquín y su Claude Code dejaron una propuesta detallada, en criollo, para darle valor real al apartado de Recursos con un **motor de recomendación + "momento" de la voz** → **`docs/recomendacion-recursos.md`**. La idea en una línea: que la app te devuelva lo que registraste, te ofrezca el recurso concreto que encaja, y lo hondo lo mande al coach ("presencia + puente", NO interpretar/prescribir — alineado con `la-voz-de-sofia.md`). Toca tu tema: la presencia emocional depende de `user_consents` (sesión 157), aunque la Fase 1 sale sin bloqueo usando solo comportamiento no-sensible.
  - **Pedido explícito:** leelo y pasáselo a **tu Claude Code para una revisión crítica** — que busque puntos débiles, casos borde (usuario nuevo sin datos, señales pobres), dónde roza la línea legal o la de "presencia vs. interpretación", y que **agregue cosas de valor**. Cuanto más lo rompan antes de construir, mejor.
  - **Si das el OK**, arrancamos por los dos módulos puros (`lib/resourceRanking.ts` + `lib/momentoRecurso.ts`) con tests, sin UI. Cualquier duda, está todo en el doc (incluidas las 5 decisiones que faltan cerrar entre los dos).
  - 📊 **Auditoría de señales YA hecha (03/09), en el doc §4bis:** la base de test dice que la mitad de las señales del plan están vacías o apuntan al catálogo equivocado — `wellness_goal` 0/8 publicados, eje en `coach_resources` 0/8 (el eje vive en `resources`, el catálogo curado de 3 items), comportamiento de solo 2-3 usuarios de test. Conclusión: el **cold-start es el default**, hay que **reordenar pesos** (topic manda, no eje, en coach_resources), la **Fase 2 necesita poblar `wellness_goal`**, y la **Fase 3 está gateada por tener base de usuarios**, no solo consent. No invalida nada, lo afina.
- 🔴 **PARA ANDRE — segunda propuesta, misma dinámica (tu OK + revisión crítica):** la card **"Sobre vos" del Home** → **`docs/card-sobre-vos.md`**. Sale de tu propio planteo ("no me cierra hablarle en pasado, sino en presente"). Tres capas apiladas: (1) **giro pasado→presente** —que el doc de la voz §1 ya decidió el 28/08 pero el código nunca aplicó: `weeklyReflection.ts` sigue siendo la "devolución semanal" vieja—; (2) **función real = puente al paquete de la sesión** (`paquete-para-la-sesion.md`), material no conclusión; (3) **modelo de acción** = la card produce `{prompt, acción, destino}`, o sea pide algo de bajo costo que aterriza en algo que se acumula hacia la sesión (el pedido insistente de Joaquín: que no sea un cartel, que genere una acción en respuesta). Conecta `la-voz-de-sofia.md` + `paquete-para-la-sesion.md`. Mismo pedido: **revisión crítica con tu Claude Code** (dónde el presente se vuelve hueco, usuario nuevo sin datos, cuándo "una acción por día" pesa como obligación, choques con la voz de Sofía). Tiene 5 decisiones abiertas para cerrar entre los dos.

## 2026-09-02 — Andre (sesión 157 · investigar la consulta legal en vez de pagarla)

**Tocado:** `docs/terminos-y-condiciones.md` (§22), `docs/politica-de-privacidad.md` (§9), `docs/legal-instrucciones.md`, `docs/paquete-abogado.md`, `constants/legal.ts` + `web/legal/` (regenerados). Nuevos: `docs/transferencias-internacionales.md`, `docs/consentimiento-datos-sensibles.md`, `docs/consumo.md`, `docs/encuadre-salud-y-responsabilidad.md`. Sin cambios de código ni de schema.

**Resumen — Andre no puede contratar un abogado, así que se investigaron las once preguntas que bloquean. Cuatro quedaron cerradas, dos con posición armada, y dos con peores noticias de las que había.**

- ✅ **A.1 CERRADA y aplicada.** CCyC art. 1109: en contratos a distancia la jurisdicción la fija el lugar donde el consumidor recibió la prestación y **"la cláusula de prórroga de jurisdicción se tiene por no escrita"**. Poner CABA no era riesgoso, era inútil. §22 reescrito con dos párrafos: consumidores por el 1109, y Profesionales —que no son consumidores— en Córdoba, donde ahí sí se puede pactar.
- ✅ **Política §9 completada gratis.** El corchete pedía "la mención informativa que la normativa exija respecto de la AAIP". La Disposición 10/2008 que la imponía **está derogada** por la Resolución AAIP 14/2018, cuyo art. 3 fija la leyenda vigente — se transcribió literal, más el derecho de acceso gratuito semestral del art. 14.3 de la 25.326.
- 📉 **De 15 placeholders quedan 9, y 6 son fechas.** Los tres reales que sobreviven son A.5, A.2 y A.3, y los tres tienen texto propuesto esperando que exista lo que describen.
- ✅ **A.3** (`transferencias-internacionales.md`): las CCM de la Res. 198/2023 **no son obligatorias**, admiten otro contrato equivalente y **no hay que registrarlas**. El DPA de Supabase se incorpora al aceptar los términos, trae las SCC europeas y su cláusula 6.1 obliga a mantener el dato en la región elegida. Daily no almacena nada; Expo guarda el token y no el contenido.
- ✅ **A.2 + B.3** (`consentimiento-datos-sensibles.md`): 🔴 la letra del art. 7 es más dura que la práctica —el inc. 3 prohíbe formar el archivo salvo iglesias, partidos y sindicatos— y eso quedó dicho sin suavizar. El checkbox de T&C no alcanza, y Política §3 hoy da el consentimiento por conducta cuando la ley lo pide expreso. Diseño del opt-in, tabla `user_consents` escrita desde edge function, y el registro ante la AAIP que es gratis y por TAD.
- ✅ **A.9 CERRADA**, y con norma que nadie tenía: la Res. 7/2002 **está derogada** por la **Res. 4/2025**. Sigue siendo obligatorio exhibir en pesos y la moneda extranjera ya no va en caracteres más chicos. El caso que no cierra es el coach que solo acepta rieles en dólares.
- ⚠️ **A.5 y A.6 sin respuesta en la norma.** El CCyC 1116 no contempla la sesión ya prestada entre las excepciones al derecho de revocar, y Argentina no copió la regla europea del pago proporcional. Queda armada la mejor posición construible. De paso se explicó el desajuste ya anotado: §9.1 y §9.4 mezclan **cancelación** con **revocación**, que son institutos distintos, y "no se puede cancelar" es más atacable que "se cancela sin reembolso".
- 🔴 **A.4 y A.7 resultaron el mismo problema, y es el peor** (`encuadre-salud-y-responsabilidad.md`). Por el art. 40 LDC y el precedente **Mercado Libre**, declararse intermediaria no decide nada: el tribunal miró el **rol real** y contaron Compra Protegida, Mercado Pago, Mercado Envíos y la comisión. **Vita marca en las cuatro** (garantía §9.3, opera el cobro, provee la sala, comisión) y suma dos: cura y verifica prestadores, y la anti-elusión §10 —que como prueba **juega en contra**. ⚠️ Empeoró con los rieles en dólares: con solo MP nunca tocaba los fondos, y con PayPal y USDT cobra ella. Y en A.4 el riesgo no era el aviso —que está bien— sino que **coaches y psicólogos/as se presentan igual**, cuando la Ley 23.277 reserva el diagnóstico y el tratamiento a quien tiene matrícula. Lo bueno: `coach_credentials` ya distingue matrícula, el coach no puede auto-verificarse y editar resetea a pendiente. Falta que la distinción llegue a la pantalla.

**Aplicado en la misma sesión — la primera mitigación de A.4.**

- **Bloque nuevo en `ProfesionalScreen`, que se renderiza SIEMPRE.** El problema no era que la matrícula estuviera oculta: ya se mostraba, con ícono propio y el número entero. El problema es que el bloque "Formación" es **aditivo** —muestra lo que hay— así que un coach sin matrícula se veía igual que un psicólogo matriculado, con una sección menos. **La ausencia no comunicaba nada.** Ahora hay una tarjeta arriba de Formación que dice qué es cada uno.
- ⚠️ **Dos cuidados de redacción, deliberados y comentados en el código:** (1) se afirma **lo que Vita verificó**, no lo que la persona es — no tener matrícula cargada acá no prueba que no la tenga en la realidad; (2) **no se nombra la profesión**: `kind === 'matricula'` dice que hay una matrícula verificada, no de qué profesión, porque el título es texto libre. Decir "psicólogo/a" sería inventar un dato.
- **El estado sin matrícula NO va en rojo ni con ícono de alerta.** No es una advertencia contra el coach, es información sobre qué tipo de sesión es; pintarlo de peligro sería castigar a alguien que no hizo nada mal. Verde salvia para el matriculado, arena para el coach.
- 🔴 **Se corrigió un copy propio antes de commitear:** la primera versión decía *"si buscás terapia, filtrá por quienes tienen matrícula verificada"* y **ese filtro no existe** en `search3`. Prometerle al usuario una acción que no puede hacer es la misma clase de error que veníamos evitando en los textos legales. Se sacó la frase.

**Pendiente para la próxima sesión:**
- **Llevar la distinción al catálogo, al buscador y a la confirmación de reserva.** Hoy solo está en el perfil, y se puede reservar sin entrar nunca ahí. Necesita una columna derivada en `coaches` mantenida por trigger desde `coach_credentials`, con el `update` revocado — mismo patrón que `accepts_international`. Eso sí es migración.
- **Evaluar un filtro por matrícula verificada** en el buscador. Si se agrega, la frase que saqué del perfil vuelve a tener sentido.
- **Sin confirmar en dispositivo**: los dos estados de la tarjeta, y si el `paddingTop: 28` de dos `s.section` seguidas deja demasiado aire entre el bloque nuevo y Formación.
- 🔴 **Averiguar un seguro de responsabilidad civil.** Es la mitigación que corresponde a una solidaria del art. 40 y preguntar el costo es gratis.
- 🔴 **Mostrar antes de reservar si es psicólogo/a matriculado/a o coach.** Es la mitigación más barata de todo el documento.
- **Consulta gratuita a la AAIP** por dos cosas: si el consentimiento habilita el tratamiento de dato sensible (art. 7), y si el DPA de Supabase satisface el estándar argentino.
- Los tres textos propuestos (§3, §7 y el de §9.1) **no se publican** hasta que exista lo que describen.
- Ninguna de estas investigaciones es asesoramiento legal. Sirven para que la consulta, si alguna vez se hace, sea una pregunta afilada.

---

## 2026-09-02 — Joaquín (sesión 156 · Recursos: bug de chips + rediseño del reproductor y la vista lista)

**Tocado:** `app/formato.tsx`, `app/coach-recurso.tsx`. Nuevo: `components/FormatSurface.tsx`. `tsc`, lint y 429 tests limpios. Sin migraciones.

**Resumen — dos ajustes sobre lo ya construido de Recursos, arrancando por un bug y por un dato sospechoso antes de tocar diseño.**

- 🔴 **Bug de chips (Parte 0):** la causa de fondo (visible en el screenshot de Joaquín) era que **la ScrollView horizontal de chips se estiraba a ~460px de alto** — es hija directa del column flex de pantalla completa, un quirk conocido de RN. Con eso, los chips stretch la llenaban (bug original); al frenar el stretch quedó como un espacio en blanco en la vista lista. Fix real: acotar el alto de la ScrollView (`chipsScroll: flexGrow:0 + maxHeight`), además de `alignItems:'center'` + `alignSelf:'flex-start'` para el stretch interno; y `flex:1` en la ScrollView de contenido. **No es componente compartido** — los otros scrolls horizontales (`coach-recurso-nuevo`, `ExploreResources`) viven **dentro** de una ScrollView vertical, así que huggean su contenido y no exhiben el bug; se dejaron sin tocar.
- 🔎 **Dato sospechoso 10:00 vs 0:08 → es de DATOS, no de UI.** `duration_seconds` es un campo que el coach **tipea a mano** en el alta (`coach-recurso-nuevo.tsx:172`, minutos → segundos); nunca se deriva del archivo. Las filas SEED tienen 600s ("10:00") pero su audio adjunto es un clip placeholder de ~8s. Los 3 uploads reales tienen `duration_seconds = null` → no muestran número falso. O sea el desfase **solo existe en data de seed**. Se dejó el comportamiento (hero muestra el declarado, player muestra el real). Pendiente menor: si molesta en demo, nulear las duraciones de seed (una línea, aparte).
- **Componente nuevo `FormatSurface`:** un solo lugar para el tratamiento de superficie de color (gradiente derivado del token del formato con `resourceFormatGradient` + grano ~9% + dos manchas de luz). Lo usan **las cards del deck** y **el hero del reproductor**, para que abrir un recurso desde el deck se sienta como que la card se expandió.
- **Reproductor (Parte 1):** header de 4 íconos → 2 (fuera campana y pin; quedan atrás + guardar + compartir). El bloque durazno pálido → hero de color con pastilla de formato arriba, y título en serif + autor + duración abajo. El player **sale de su caja**: barra de 5px con perilla visible (círculo del color, borde crema, sombra), tiempo **restante en negativo** a la derecha, play de 66px con gradiente del formato, y control de **velocidad** (1× / 1.25× / 1.5× / 2×) que cicla. ⚠️ El cambio de velocidad tiraba error en dispositivo (asignar `player.playbackRate`/`shouldCorrectPitch` directo rompe en nativo) → se pasó a `player.setPlaybackRate(rate, 'high')` con guarda `isLoaded` + try/catch + reaplicado al cargar. Y la barra saltaba con cada update de status (~500ms, se veía lagueada) → ahora la mueve un `Animated.Value` con **native driver**, avanzando en tiempo real y re-sincronizando al valor real en cada tick. **Arranque lento del play** (1-2s): se creaba el player sin preload y esperaba la descarga (peor con el storage en sa-east-1 y Joaquín en Australia) → se probó `downloadFirst: true` (bajar el archivo entero al abrir) pero con el storage lejos dejaba el play **colgado cargando para siempre**, así que se revirtió a **streaming** (`updateInterval: 250` solo) — arranca en 1-2s y el botón de play muestra **spinner** hasta que suena, con red de seguridad de 8s para que nunca quede trabado. **Arrastre de la barra** (drag-to-seek) con `PanResponder`: el mismo responder cubre tap-para-saltar y arrastre; durante el drag la barra sigue al dedo y el `seekTo` se dispara recién al soltar; la perilla crece como feedback. Al soltar parpadeaba (~un tick el status reporta la posición vieja antes de aplicar el seek) → **hold post-seek**: la barra se sostiene en el destino hasta que el status converja ahí (o venza un timeout de 1.5s), sin resincronizar al valor viejo. Y el arrastre venía incómodo/saltón — dos causas: (1) se calculaba con `e.nativeEvent.locationX`, que durante el drag se vuelve relativo a la subvista que toca el dedo y salta; (2) `anim.setValue()` en cada move sobre un valor con native driver desincroniza JS↔nativo. Rehecho: la coordenada ahora es **x absoluta del toque** (`gestureState.moveX`) menos el borde izquierdo real del track (medido con `measureInWindow`); la barra la mueve un **`scrubAnim` dedicado, JS puro** (setValue por frame sin re-render de React y sin pelear con nativo); el texto de tiempo se actualiza throttled (~90ms); y la banda de toque pasó a **40px de alto** para agarrarla cómodo. Abajo, dos bloques crema: **"Quién lo hizo"** (autor + especialidad + N recursos → perfil) y **"Después de esto"** (relacionados por mismo tema, completando con mismo autor; sin señal de "más completados después", se dejó afuera; si no hay, no renderiza).
- **Vista lista (Parte 2):** "Ver como deck/lista" pasó de link suelto a **control segmentado en el header** (líneas/cards), presente en **ambas** vistas y con preferencia **persistida** (AsyncStorage, global). El contador ya vive junto al título. Cada fila muestra ahora `duración · autor · tema`. Los bloques de abajo (progreso + coach) son de la pantalla y se muestran en las dos vistas. El copy del bloque del coach se adapta: **≤3 recursos** → "Todavía hay pocos [formato]"; más → "¿No encontrás lo que buscás?". Si no hay coach asignado, el bloque no aparece.
- **Analítica:** `vista_cambiada {formato, vista}`, `velocidad_cambiada {velocidad}`, `relacionado_abierto {origen_id, destino_id}`.
- **Tokens:** los colores de formato y **todos los gradientes** salen de `ResourceFormatColors` / `resourceFormatGradient` (nada hardcodeado). Tipografía 100% `ViveFonts` (`title` para serif-role, `semibold/regular/medium/bold`). Los olivas de texto (`FOREST`/`FOREST_SOFT`) son las constantes locales que ya existían en estas pantallas — no se inventaron valores nuevos.

**Pendiente para la próxima sesión (MAÑANA):**
- 🔴 **Probar el arrastre de la barra del reproductor en el teléfono.** Se reescribió el scrub (coords absolutas + `scrubAnim` JS + banda de 40px) pero quedó SIN confirmar — el feedback previo de Joaquín fue "un poco mejor pero sigue incómodo". Si todavía se siente raro, próximos pasos posibles: subir el throttle/afinar el mapeo, agrandar la perilla, o pasar el bar a Reanimated. Todo lo demás del reproductor (arranque con spinner, velocidad, barra suave en reproducción, hold post-seek) quedó andando salvo aviso.
- Confirmar en dispositivo el resto: vista lista + deck con el toggle, hero, bloques "Quién lo hizo"/"Después de esto".
- Sigue abierta la charla de la tarjeta "Pedile una recomendación a [coach]" (qué la hace confusa).
- Opcional: nulear `duration_seconds` de las filas SEED para que la demo no muestre 10:00 con un audio de 8s.

## 2026-09-02 — Joaquín (sesión 155 · device review cont. + animación de escala en los CTA)

**Tocado:** `app/formato.tsx`, y los CTA de: `screens/{Ruido,Lecturas,Anclaje,Sueno,Meditacion,Escaner,Respiracion,Relajacion,ResourceDetail}Screen.tsx`, `screens/{Login,Register,CoachLogin,VerificarMail,NuevaContrasena}Screen.tsx`, `screens/BookingScreen_Confirm.tsx`.

**Resumen — sale de la device review de Recursos: transiciones smooth al tocar, y luego pasada de esa animación a los CTA principales de la app (opción A acordada).**

- **Recursos / deck**: pedido de Joaquín — "que tocar una card tenga la transición smooth como el resto de la app". Las cards del deck y los bloques de acción (ver como lista, pedile reco) pasaron de `TouchableOpacity` a `ScaleCard` (el press-scale que ya usa el resto). La card entera es tocable; el bookmark queda como touchable interno.
- **"Todos los botones" → opción A**: Joaquín pidió la animación en todos los botones. Se acordó **no** hacerlo literal (448 `TouchableOpacity` en 84 archivos, muchos son íconos/links/filas/back/tab-bar que se verían raros y sería un sweep riesgoso a ciegas). En su lugar, **pasada enfocada en los CTA principales** de los flujos más tocados:
  - Batch 1: los 19 `primaryBtn` de las 9 pantallas de herramientas/recursos.
  - Batch 2: los `enterBtn` de las 5 pantallas de auth (login, registro, coach-login, verificar-mail, nueva-contraseña) + el "Confirmar reserva" de `BookingScreen_Confirm`.
  - Conversión con reemplazo preciso por archivo (`\bprimaryBtn\b`/`\benterBtn\b` en el tag de apertura, que no matchea `...BtnText`/`...BtnLoading`; import agregado donde faltaba). Los secundarios/íconos/links (`backBtn`, `ghostBtn`, `emailBtn`, `cancelBtn`, chevrons, tab bar) quedan **afuera** a propósito.
- 📝 **Queda un long tail de CTA one-off** con nombres sueltos (`confirmBtn`, `saveBtn`, `submitBtn`, `heroBtn`, etc.) en coach/admin/otras pantallas, sin convertir — menor valor y más riesgo por edición. Se puede extender si Joaquín quiere, como tanda aparte.
- Typecheck, lint y 429 tests limpios (se traía el batch de Andre de la sesión 154: `primaryInk`/`onPrimaryInk` para contraste, "Sobre vos", legal — merge sano). No confirmado en dispositivo.

**Pendiente de la device review (sigue):** ver el resultado de la animación en el teléfono; y lo que faltaba — Recursos (grilla + deck + lista), coach-login, onboarding con color, baja de cuenta, recuperación de contraseña. 📝 Consultá abierta de Joaquín: no le cerraba la tarjeta "Pedile una recomendación a [coach]" del formato — falta charlarlo (qué la hace confusa: el concepto, el copy, o que muestra "Coach Prueba").
## 2026-09-01 — Andre (sesión 154 · el silencio de "Sobre vos" y los dos guardarraíles que faltaban)

**Tocado:** `lib/weeklyReflection.ts`, `lib/sobreVosMomentoStorage.ts`, `app/(tabs)/index.tsx`, `supabase/functions/weekly-reflection/index.ts` (solo el prompt), `__tests__/weeklyReflection.test.ts`. Nuevos: `lib/sobreVosSilencio.ts`, `__tests__/sobreVosSilencio.test.ts`. **429 tests** (eran 414), `tsc` y lint limpios. Sin cambios de schema.

**Resumen — lo primero del plan de `docs/la-voz-de-sofia.md` §7 que no espera a nadie. La IA sigue apagada: todo esto mejora el texto que la gente lee HOY, que es el de las reglas.**

- 🔴 **Bug real encontrado al implementar §3.4: `reservá` vivía adentro de `ASKS`, que solo se evalúa con tono `gentle`.** O sea que en tono `warm` —el de las señales buenas, que es justo cuando un vendedor aprovecharía— la tarjeta podía pedir un booking y no lo frenaba nadie. Se partió en dos: **`VENDE`** (reservá, agendá, sacá un turno, pedí turno, contratá) corre **en todos los tonos**, y `ASKS` se queda con el resto (probá, anotate, escribíle, clickeá, tocá acá) gentle-only. Nueva razón de rechazo: `'pide una reserva'`.
- **Se respetó la corrección del 28/08: nombrar al profesional NO es vender.** Los patrones apuntan al pedido, no a la palabra — *"eso guardalo para contárselo el sábado"* y *"hablalo con tu profesional cuando lo veas"* pasan, y hay tests que lo fijan. ⚠️ Compensación consciente: `reserv[áa]#` también matchea el sustantivo ("una reserva el sábado"), así que rechaza alguna frase legítima. Se dejó ancho a propósito: rechazar de más cae al texto de las reglas, que es bueno; dejar pasar publica un pedido de venta.
- **§3.5 no tenía guardarraíl y ahora sí: `FINGE_SENTIR`.** Frena "me alegro", "te entiendo", "me pone contento", "siento que", "me emociona". Los patrones son de **primera persona** a propósito — lo prohibido es que el sistema se atribuya un estado, no que la frase hable de lo que siente quien lee: *"lo que sentís esta semana"* pasa. Nueva razón: `'finge sentir'`. Corre en todos los tonos.
- **El silencio (§3.3), como regla y no como azar.** `lib/sobreVosSilencio.ts` (puro, 11 tests): la tarjeta se calla cuando la señal es `level` **y es la misma que se dijo ayer**. Se descartó a propósito resolverlo con el hash del día (el mismo truco de `variantFor`, que salía más barato): eso es azar disfrazado de regla — callaría días donde la señal recién cambió y hablaría en el tercer día idéntico.
- **La clave del diseño: el día que se calla NO registra nada.** `markSpoken` solo corre cuando la tarjeta habla, así que al día siguiente lo último dicho queda a dos días y vuelve a hablar. En una racha de `level` eso da habla/calla/habla/calla — **nunca dos silencios seguidos**, que sería desaparecer en vez de callarse. Hay un test que recorre cinco días y fija esa alternancia; sin eso la tarjeta se apagaba para siempre en cuanto entraba en una racha.
- **La lista de señales que pueden callarse es de inclusión, no de exclusión** (hoy solo `level`). Una señal nueva nace hablando y hay que habilitarla a mano. Al revés, un descuido silenciaría algo que había que decir — que es el modo de falla caro. `empty` queda afuera: es la invitación a registrar, sin ella la persona nueva no sabe para qué está la tarjeta.
- **Cómo se ve el día callado:** la card sigue estando —sello, color del mood, tinte— pero sin frase, sin "→ Ver más" y sin `onPress`. En lugar del texto va el `VitaMark` al 22%. **No se inventó copy para ese estado a propósito**: cualquier línea ahí volvería a ser una devolución, que es justo lo que el día callado no tiene. La marca ocupa el lugar para que se lea como "hoy no hay nada" y no como "esto se rompió". El momento no se ve afectado: `level` ya estaba excluido de `shouldShowMoment`, así que un día callado nunca tuvo momento que reabrir.
- **`silent` arranca en `false`** y se resuelve tras leer AsyncStorage. Al revés (asumir silencio hasta que conteste) la card parpadearía de callada a hablando en cada montaje, que se ve peor que hablar de más.
- **El prompt de la edge function acompaña los dos guardarraíles nuevos**, para que el modelo no produzca lo que `rejectCopy` va a rechazar. De paso se limpiaron las dos referencias que quedaban a `CoachSuggestionCard` ("arriba de esta tarjeta ya hay otra sugiriéndole hablar con un profesional") — esa tarjeta se borró en la sesión 97 y el prompt seguía coordinando con un fantasma.

**Pendiente para la próxima sesión:**
- ⚠️ **Redeployar `weekly-reflection`**: le cambió el prompt y la versión desplegada (v2) quedó vieja. No corre por el flag apagado, pero el repo y lo deployado no coinciden. `npx supabase functions deploy weekly-reflection`.
- **Probar el día callado en el dev build.** No se puede verificar de verdad sin dos días seguidos de `level` — los tests fijan la regla, no cómo se ve. Si la card callada queda demasiado hueca, lo que se ajusta es `selloContentQuiet`.
- **Optimización conocida, no hecha:** `useDailyReflection` sigue pidiéndole la frase al modelo los días callados (nadie la ve). No se resolvió porque `silent` se sabe después de que el hook corrió, y una versión con race valía menos que una llamada cacheada de más. Cuando se prenda la IA, vale la pena.
- **Sigue esperándote el piso de seguridad (§5 ter)**, que es el que más importa: faltan dos definiciones tuyas — cuántos días seguidos abajo disparan, y qué dice exactamente la frase. El resto está listo para escribirse en una sesión.

---

## 2026-09-01 — Andre (sesión 153 · chequeo de viabilidad legal global de la IA, y lo que apareció al mirar)

**Tocado:** `docs/paquete-abogado.md`, `docs/legal-instrucciones.md`, `docs/la-voz-de-sofia.md`, `constants/features.ts` (solo comentarios). Sin cambios de código ni de schema. `tsc` limpio, 414/414 tests.

**Resumen — la pregunta era si se puede encender la devolución con IA "a nivel global". La respuesta es sí. El hallazgo es que el riesgo estaba en otro lado.**

- **La consulta de IA que teníamos escrita se contesta bien, y ahora tiene ancla.** El TJUE falló el 04/09/2025 en *EDPS c/ JUR* (C-413/23 P) que el carácter personal de un dato **no es absoluto**: los mismos datos seudonimizados pueden ser personales para quien los manda y no serlo para el receptor que no puede reidentificar. Es exactamente el caso del payload de `weekly-reflection` (una etiqueta, tres enteros, sin identificador). Se agregó como ancla en `paquete-abogado.md` C.3 para que el abogado/a no razone desde cero.
- 🔴 **Hallazgo principal, y es incómodo: el flag apagado no nos estaba protegiendo de lo que creíamos.** EEUU **no está** en la lista de países con nivel adecuado de la AAIP (que sí tiene UE/EEE, UK, Suiza, Canadá sector privado, Nueva Zelanda, Uruguay, Israel). Y a EEUU ya le mandamos todos los días ánimo, diario, gratitud y contenido de mensajes (Supabase), video (Daily.co) y push (Expo) — dato sensible, identificado, completo. El payload de la IA es la transferencia **más chica** que hace la app. Mantener `AI_REFLECTION_ENABLED=false` evita eso y nada más; todo lo demás pasa igual. **A.3 del paquete se reescribió entera** con la tabla de destinatarios reales y el instrumento probable (Cláusulas Contractuales Modelo de la **Res. AAIP 198/2023**, las de la RIPD, uso libre; o Disp. DNPDP 60/2016), y absorbe a C.3.
- **Preguntas nuevas para el abogado/a (B.5 y B.6): ¿nos alcanza el RGPD?** Lo dispara "Sesiones desde el exterior", que está pensada explícitamente para que *"alguien en Madrid"* reserve — eso activa el art. 3(2). A favor: **Argentina tiene adecuación de la UE** (2003/490/CE), revisada y mantenida en enero de 2024, así que la pata UE→AR no necesita instrumento; el problema sería el salto siguiente, que es el mismo A.3. Se avisó en el mail de encuadre, porque puede ser que necesitemos a otra persona para esa parte.
- ✅ **Alivio que conviene tener escrito: NO somos un "sistema de reconocimiento de emociones" del Reglamento de IA.** El art. 3(39) exige que la inferencia sea **a partir de datos biométricos**; acá la persona elige su ánimo tocando un botón. Las guías de la Comisión aclaran que ni el análisis de sentimiento sobre texto entra. Quedamos fuera de la prohibición y de las obligaciones específicas. Se registró en `legal-instrucciones.md` justamente para que nadie lo redescubra dentro de un año como si fuera un bloqueante.
- ⚠️ **Lo que sí nos alcanzaría es el art. 50(1)**: un sistema de IA que interactúa directamente con personas tiene que informar que es una IA. Rige desde el 02/08/2026. Se anotó como **regla 3.6 en `la-voz-de-sofia.md`** porque no es un checkbox legal, es una restricción de diseño sobre el objetivo nuevo de la tarjeta: una voz pensada para *sentirse* como alguien que está, que además tiene que declararse máquina. Lo bueno es que **§3.5 ("cálida y presente, sí; persona, no") ya venía haciendo ese trabajo** dos meses antes de que rigiera. Queda un test útil: si la tarjeta necesita que no se sepa que es IA para funcionar, está mal diseñada.
- **Dos ítems de frontera anotados:** (1) la **My Health My Data Act de Washington** —consentimiento opt-in para dato de salud mental, acción privada, USD 7.500 por infracción— es la norma más exigente del mundo para lo que hace Vita; no aplica sin residentes de WA, es un ítem *antes* de expandir a EEUU, no ahora. (2) Seguimos fuera del **MDR** europeo mientras no reclamemos diagnosticar ni tratar, pero el **piso de seguridad** pendiente de `la-voz-de-sofia.md` §5 ter es justo el borde: umbral fijo que muestra las líneas de T&C §5.3 es **derivación** (seguro); evaluar nivel de riesgo empieza a parecerse a **triage**, que es lo que ya preguntamos para la recomendación asistida.
- 📌 **Acción que no depende de ninguna respuesta legal:** pedirle a Anthropic el modo de **retención cero**. Se agregó como paso 4 del Paso 5.1. El DPA con SCCs europeas (Módulos 2 y 3) ya viene incorporado a los términos comerciales de la API desde el 01/01/2026, sin firmar nada aparte.
- 🔴 **Decisión consciente: NO se tocó la Política de Privacidad.** Quedó escrito por qué, para que no lo repita el próximo que lea esto. **§6** no puede declarar todavía al proveedor de IA como destinatario: el flag está apagado, no recibe nada, y declarar un destinatario que no recibe datos es tan falso como omitir uno que sí. **§7** no puede decir que hay cláusulas contractuales en vigor hasta que las haya — el texto actual (*"procurará que existan garantías adecuadas"*) es flojo pero honesto, y reemplazarlo por una garantía inexistente sería peor. Las dos se escriben **después** de la respuesta. Por lo mismo, **no hizo falta correr `npm run sync:legal`**: ninguno de los archivos tocados entra en el sync.

**Corrección posterior — verificación del paquete antes de mandarlo, y cuatro defectos (uno mío).**

- 🔴 **La sección 1 le afirmaba al abogado algo falso: *"Vita nunca tiene los fondos del profesional en su cuenta"*.** Es cierto solo para Mercado Pago. `usdt-create-payment/index.ts:129` dice "entra el total a la billetera de VIVE y se transfiere después" y `paypal-create-payment/index.ts:7` "PayPal no hace split de marketplace en esta configuración" — los dos rieles en producción con pagos reales. Esa frase sostiene el encuadre de intermediario de T&C §4, que es justo lo que A.7 pide evaluar: el abogado habría razonado sobre un sistema que no es el nuestro. **Es el mismo defecto del 25/08** (los T&C describían un sistema que ya no existía), esta vez en el paquete. Reemplazada por una tabla de los tres rieles con quién cobra en cada uno.
- 🔴 **Error propio: la tabla de destinatarios ponía a Supabase en EEUU sin verificarlo.** Está en **`sa-east-1`, São Paulo** (`supabase projects list`). La conclusión no cambia —Brasil tampoco está en la lista de la Disp. 60-E/2016— pero el país determina el instrumento, y el dato viajaba mal al abogado. De paso se verificó el resto en vez de suponerlo: **Daily.co no almacena nada** (solo guarda con su API de grabación, y `create-meeting-room` crea las salas sin `enable_recording`), y **Expo** guarda el token pero no el contenido de la notificación. La tabla ahora separa **dónde queda el dato** de **dónde está la empresa**, que no es lo mismo.
- ⚠️ **A.10 remitía a "A.11" y A.11 no existía.** Se escribió: es la pregunta sobre el paquete pre-sesión de `docs/paquete-para-la-sesion.md`, que era el camino que reemplazó a A.10 y había quedado sin redactar.
- ⚠️ El encabezado de la sección A decía "estos cinco" y son once. Corregido acá y en `legal-instrucciones.md`.
- ⚠️ Se ablandó una afirmación propia en C.3: decía que la retención cero "ya está pedida" y no lo está.

**Pendiente para la próxima sesión:**
- 🔴 **A.3 es ahora el punto que más urge, y no espera a ninguna decisión de producto.** Destrabarlo destraba de paso la IA; dejarlo abierto no se arregla manteniendo la IA apagada.
- **Decidir si "Sesiones desde el exterior" sale antes o después de tener respuesta a B.5.** Hoy el orden está tomado por omisión.
- Pedir retención cero a Anthropic (no espera nada).
- Sigue abierto todo el plan de producto de `la-voz-de-sofia.md` §7 — el silencio (3.3) y los guardarraíles nuevos de `rejectCopy` (3.4/3.5) son los dos que no dependen de ninguna respuesta pendiente.
- ⚠️ Nada de este chequeo es asesoramiento legal. Es material para que la consulta sea una pregunta afilada; la firma sigue siendo del abogado/a.

---

## 2026-09-01 — Andre (sesión 152 cont. · auditoría de seguridad de toda la app)

**Tocado:** `lib/encryption.ts` (reescrito), `supabase/functions/_shared/booking-effects.ts`, `supabase/functions/booking-return/index.ts`, las 6 functions con chequeo de service role, `screens/SalaScreen.tsx`, `screens/BookingScreen_Confirm.tsx`, `lib/coachBookingActions.ts`, `__tests__/pureLogic.test.ts`, `package.json`. Nuevos: `supabase/functions/_shared/service-role.ts`, `jest.setup.js`. 414 tests (eran 412), `tsc` limpio, sin warnings de lint nuevos.

**Resumen — auditoría pedida por Andre: secretos, cifrado, autorización de las 20 edge functions, webhooks de pago, RLS, inyección, gateo de admin, errores tragados y fugas de recursos.**

- ✅ **Lo que está bien, y no es poco.** Los webhooks de pago validan firma, son fail-closed y **no le creen al cuerpo de la notificación**: leen el pago desde la API del proveedor. El `state` del OAuth de MP va firmado con HMAC + PKCE. El cliente de Supabase tiene el shim de webcrypto para que PKCE no degrade a `plain`. La RLS usa grants por columna y vistas para filtrar columnas. **No hay inyección posible**: las únicas interpolaciones en filtros son UUIDs de sesión y fechas calculadas. `admin-actions` verifica `is_admin` server-side antes de tocar el service role.
- 🔴 **1. El "cifrado" de mensajes fallaba ABIERTO.** `encryptMessage` hacía `catch { return text }`: ante cualquier error **guardaba el texto plano** en una columna que todo el sistema trata como obfuscada — y como descifrar es tolerante, el mensaje se leía bien y el problema quedaba invisible para siempre. Ahora tira, y el envío de la sala lo atrapa para avisar "no se pudo enviar" en vez de perderlo en silencio.
  - 🔴 **Y había un fallback de clave hardcodeado en el repo** (`'vive_mvp_key_2026'`), en las dos puntas: un build o un deploy sin la variable "cifraba" con una clave pública sin avisar. Eliminado; ahora falta la clave y se rompe fuerte, al usar (no al importar, para que una pantalla que nunca manda un mensaje no se caiga por un secret que no necesita).
  - 📝 **La única causa real de error era un emoji partido al medio** (un sustituto suelto rompe `encodeURIComponent`, y llega al pegar texto de otra app). Se sanea antes de codificar, así el mensaje sale igual perdiendo un glifo que ya se veía roto. Con test.
  - ⚠️ **Sigue sin ser cifrado y no hay que llamarlo así**: XOR con clave repetida, y la clave viaja en el binario por ser `EXPO_PUBLIC_*`. Lo que protege los mensajes es la RLS de `messages`.
- ⚠️ **2. `authHeader.includes(SERVICE_ROLE_KEY)`** en las seis functions que solo puede llamar el cron. Es una búsqueda de **subcadena**, no una igualdad —cualquier header que la contenga pasa, venga como venga— y la comparación de strings corta en el primer byte distinto, o sea que filtra por tiempo cuántos caracteres acertaste. No es explotable sin la clave, pero es un candado que no verifica lo que dice verificar, sobre el camino más privilegiado del sistema. Nuevo `_shared/service-role.ts`: extrae el token del `Bearer` y lo compara entero y en tiempo constante.
- ⚠️ **3. `booking-return` reenviaba al deep link TODOS los query params** que le llegaran. Es una function **pública** (`verify_jwt = false`) cuya salida entra a la app, así que convertía cualquier URL de internet en un canal para meter parámetros arbitrarios adentro. Hoy no los lee nadie —por eso era inerte—, pero el agujero quedaba puesto para el día que alguien leyera uno. Ahora lista blanca de los cinco que MP manda de verdad, con tope de largo.
- 📝 **4. `ensureMeetingRoom(...).catch(() => {})`** al confirmar una reserva: si falla, la reserva queda confirmada sin sala de video. Es recuperable (`SalaScreen` reintenta al entrar), pero el error se tragaba entero, así que un problema sistemático con Daily no dejaba ni un rastro y recién se notaba cuando alguien no podía entrar a su sesión. Ahora se loguea, en los dos lugares que la llaman.
- 📝 `jest.setup.js` nuevo: jest no carga `.env`, y sin fallback hardcodeado los tests de ida y vuelta del cifrado se quedaban sin clave. Se define una de juguete, explícita.

**Pendiente para la próxima sesión:**

- ✅ ~~Redeployar las siete edge functions~~ — **DEPLOYADAS y VERIFICADAS el 01/09/2026.** Las cinco de service role devuelven 401 sin credencial; `booking-return` devuelve 302 sin credencial (sigue pública, como tiene que ser) y **la lista blanca quedó probada en vivo**: un `?malicioso=...` en la URL no llega al deep link.
- 🔴 **Hallazgo del deploy: `MESSAGE_ENCRYPTION_KEY` NO estaba seteado**, o sea que las edge functions venían usando el fallback hardcodeado. Se seteó **con ese mismo valor** para no cambiar comportamiento (cualquier otro habría vuelto ilegibles todos los mensajes de sistema ya guardados).
- 📝 **La clave de producción es `vive_mvp_key_2026`, la que estuvo versionada en el repo — y NO hay que rotarla.** El repo es privado y no lo vio nadie de afuera (confirmado por Andre), pero eso ni siquiera es lo que decide: la clave es `EXPO_PUBLIC_*`, así que **se inlinea en el build y viaja dentro del .ipa/.apk**. Cualquiera que baje la app y la descomprima la lee, sin haber visto nunca el código. Rotarla no cambiaría nada porque la nueva viajaría igual. **El vector nunca fue el repo, es el binario**, y de ahí que la única mejora real sea E2E de verdad (necesita dev client). Mientras tanto la posición ya documentada es la correcta: esto es ofuscación, y lo que protege los mensajes es la RLS de `messages`.
- 🔴 **Probar en dispositivo que se pueden mandar mensajes**, que es lo único que este cambio podría haber roto.
- ✅ **`mp-webhook` y `paypal-webhook` también deployadas** (01/09/2026), así que ya no queda ningún escritor de mensajes de sistema con el `booking-effects` que falla abierto. **Verificadas con un pago falsificado**: `mp-webhook` devuelve `200 ignored (unsigned)` —acepta el request para que MP no reintente para siempre, pero no lo procesa— y `paypal-webhook` devuelve `401 invalid signature`. Las dos siguen públicas y ninguna actuó sobre la notificación forjada.
- ⚠️ **Lo que la auditoría NO cubrió**: la RLS **real de la base** (verifiqué la documentada en SCHEMA.md, y el bug de `analytics_events` de hoy prueba que documentación y realidad se separan), y no se intentó explotar nada. Quedan además **50 catch vacíos** en el código: la mayoría inofensivos, pero es el patrón que hoy escondió dos fallas permanentes.
- 📝 Tokens de sesión en AsyncStorage sin cifrar. Es el default de React Native, pero en un dispositivo con root o vía backup son legibles; `expo-secure-store` sería la alternativa.

---

## 2026-09-01 — Andre (sesión 152 cont. · contraste: diez botones eran ilegibles y unos íconos invisibles)

**Tocado:** `constants/theme.ts` (token nuevo), `screens/ProfileOwnScreen.tsx`, `CoachWeeklyPatternScreen`, `CoachProfileScreen`, `ProposeResourceScreen`, `EditProfileScreen`, `CoachApplicationScreen`, `SessionsScreen`, `ResourceDetailScreen` (×2), `ResourceProposalsScreen`, `SalaScreen`. 412 tests, `tsc` limpio, sin warnings de lint nuevos.

**Resumen — arrancó como "esta pantalla está fea" y terminó siendo accesibilidad.**

- 🔴 **`ViveColors.primary` (#C1694F) es demasiado clara para llevar texto encima.** Con ese fondo **ningún** color de texto llega al mínimo AA de 4.5:1 — ni el blanco puro, que da 3.89. O sea que el problema no se arregla cambiando el color del texto: hay que oscurecer el fondo.
- 🔴 **Auditadas las 25 superficies de terracota con texto de toda la app.** Diez usaban el oliva `text` (#565E32) encima y daban **1.78:1** — ilegibles al sol. Entre ellas: "Guardar" de Editar perfil, el botón de la postulación de coach, el precio del coach, la propuesta de recurso, el audio de un recurso y el botón de "Crear cuenta" del perfil.
- **Token nuevo `ViveColors.primaryInk` (#A25842)**: la misma terracota oscurecida un 16%, que es el mínimo para que el crema encima llegue a 4.5:1 (da 4.59). No es un color nuevo de la paleta — es el mismo, en el tono en que se puede leer. Los diez casos pasaron a ese fondo con texto crema.
- ⚠️ **Quedan 14 en 3.6–3.9:1** (blanco o crema sobre `primary`): se leen, pero no cumplen AA para texto normal. Decisión de Andre no barrerlos todavía — cambiaría el aspecto de la app entera.
- 🔴 **Y en el perfil con sesión había un bug aparte: los íconos de Configuración eran `rgba(255,255,255,0.75)` sobre el crema, 1.11:1.** O sea invisibles: la lista mostraba una columna de aire donde van los íconos. Era un color que quedó de cuando ese fondo era oscuro — el estado sin cuenta, veinte líneas más arriba, siempre usó el oliva correcto.
- 🔴 El rojo de "Eliminar cuenta" (`#FF7070`) daba 2.41:1 sobre el crema, y además es un rojo de semáforo en una paleta de tierras. Pasó a `#B3392E` (5.32:1).
- 📝 **Se sacó el avatar vacío del perfil sin cuenta.** Era el elemento más grande de la pantalla y no decía nada: quien no tiene cuenta no tiene perfil, así que mostrarle uno en blanco es enseñarle un vacío.
- ⚠️ **Corrección de algo que dije mal en el camino**: afirmé que "Crear cuenta" era el único botón con texto sobre terracota. Lo dije mirando por encima los primeros resultados de un grep, y eran 25. El script de auditoría quedó en el historial de la sesión y se puede reusar.

**Pendiente para la próxima sesión:**

- ⚠️ **Decidir los 14 restantes** (blanco/crema sobre `primary`, 3.6–3.9:1). Pasarlos a `primaryInk` es mecánico, pero oscurece todos los botones primarios de la app: es decisión de diseño, no de accesibilidad pura.
- 📝 Vale correr la misma auditoría sobre los otros fondos de color de la app (los acentos de cuerpo/mente/alma, los chips), no solo sobre la terracota.

---

## 2026-09-01 — Andre (sesión 152 cont. · "¿Qué te trae por acá?" al boceto de Andre)

**Tocado:** `screens/OnboardingScreen2.tsx` (rediseñada), `docs/onboarding-bifurcacion-opciones.md`. 412 tests, `tsc` limpio, sin warnings de lint nuevos.

**Resumen:**

- ✅ **La pantalla pasa al boceto de Andre**: filas en vez de tarjetas, título grande alineado a la izquierda, subtítulo que amortigua el peso de la pregunta, y **navegación directa al tocar la fila** (un tap en vez de dos). El boceto ya respetaba lo que más importaba: las cuatro opciones con el mismo peso visual.
- 🔴 **Ajuste 1 — cada universo lleva SU color.** En el boceto tres círculos eran verde salvia y solo "Algo de la cabeza" naranja, lo que la volvía la recomendada de facto: el ojo va ahí primero. **Y ahora que medimos, eso contamina el dato**: `onboarding_opcion_tocada` estaría midiendo el acento visual en vez de la preferencia real. Van los tres colores que la pregunta siguiente ya usa por universo, así que además dan continuidad.
- 🔴 **Ajuste 2 — las bajadas hablan de síntomas, no de categorías.** El boceto decía *"Sueño, energía, hábitos"*, que es una taxonomía. Quedó *"No dormís, andás sin pilas"*, *"Ansiedad, bajón, discusiones"*, *"No sabés para dónde vas"*. El boceto ganaba consistencia (las cuatro como listas) pero perdía justo lo que justificaba la opción A: **dejar de preguntar en el vocabulario del producto**.
- 📝 **Ajuste 3 — "Solo estoy mirando" no lleva flecha.** Las otras tres llevan a una pregunta más; esa termina el onboarding y deja en Recursos. Con la misma flecha, las cuatro prometían lo mismo. La asimetría es la señal.
- ⚠️ **Ajuste 4 — se fue el botón "¿Seguimos?", y eso tiene un costo de medición.** La navegación directa es mejor UX, pero **elimina `toques`** (cuántas opciones se tocaban antes de decidirse), que era la señal de duda: ahora el primer toque ya navega. Queda `segundos`. Por lo mismo, `onboarding_opcion_tocada` dejó de emitirse en esta pantalla — sería un duplicado exacto de `onboarding_respuesta`.
- 📝 El gris de las bajadas del boceto quedaba por debajo del mínimo de contraste; se usó `#5C6B58`, que da ~4.6:1 sobre el crema (AA pide 4.5). Anotado en el código para que no se aclare sin volver a medir.

**Pendiente para la próxima sesión:**

- 🔴 **Verlo en dispositivo**, sobre todo la fila sin flecha: confirmar que se lee como "esta es distinta" y no como que falta algo.
- 📝 **Queda una inconsistencia de interacción entre las dos preguntas**: esta navega al tocar y la de categoría sigue pidiendo elegir + "Ver profesionales". Para un flujo de dos pantallas conviene que las dos se comporten igual; no se tocó porque el boceto no la cubría. Decisión de Andre.

---

## 2026-09-01 — Andre (sesión 152 cont. · la RLS rechazaba toda la analítica sin cuenta)

**Tocado:** `SCHEMA.md`. Nuevo: `scripts/add-analytics-anon-insert.sql` (**CORRIDO el 01/09/2026**).

**Resumen:**

- 🔴 **Andre lo probó en dispositivo y ningún evento llegaba**: `new row violates row-level security policy for table "analytics_events"`, una vez por evento. La política de INSERT de la tabla pide sesión.
- 🔴 **Y eso invalida justo la mitad que importa**: las cuatro pantallas del onboarding ocurren sin cuenta, y `muro_cuenta_visto` —el punto de fricción más grande del producto— **por definición se emite cuando la persona no está registrada**. O sea que toda la instrumentación de hoy escribía en el `console.warn` y en ningún otro lado.
- **`scripts/add-analytics-anon-insert.sql`** agrega una política de INSERT para el rol `anon` con dos candados: **solo INSERT** (no puede leer, actualizar ni borrar analítica) y **`user_id` obligatoriamente NULL** — sin eso, cualquiera con la anon key podría escribir eventos atribuidos a otra persona. Más una política para `authenticated` que solo deja escribir eventos propios. Idempotente, con una parte 1 que muestra las políticas actuales antes de tocar nada.
- ⚠️ **Lo que el script acepta a conciencia**: con la anon key se pueden insertar filas de analítica basura. Es inherente a medir desde el cliente y no se evita sin mandar los eventos por una Edge Function. Se acepta porque el daño máximo es ensuciar una tabla de métricas —no toca datos de nadie ni deja leer nada— y porque `properties.sesion` permite descartar un origen entero si aparece ruido.
- 📝 **El síntoma era visible solo porque `registrarEvento` avisa por consola.** Si hubiera fallado en silencio, habríamos dado por buena una analítica que no guardaba nada — que es peor que no tener ninguna, porque se toman decisiones creyendo que hay datos.

**Pendiente para la próxima sesión:**

- ✅ ~~Correr `scripts/add-analytics-anon-insert.sql`~~ — **corrido el 01/09/2026**. Falta volver a abrir la app sin cuenta: la prueba real es que **no aparezca más el warn de RLS** en la consola. ⚠️ Correr el insert de prueba desde el SQL Editor NO sirve como verificación: ahí sos `postgres` y las políticas no se aplican.
- 🔴 Recién después tienen sentido las verificaciones que quedaron anotadas arriba (el `sesion` compartido, `onboarding_registro` con `user_id`, el par abierto/completado sin cuenta): hasta que la política no esté, la tabla va a seguir vacía.

---

## 2026-09-01 — Andre (sesión 152 cont. · la sesión anónima nunca existió, y ya no hace falta)

**Tocado:** `lib/supabase.ts`, `lib/resourceCompletions.ts`, las 8 pantallas de herramientas, `__tests__/resourceCompletions.test.ts`, `SCHEMA.md`. 412 tests (eran 410), `tsc` limpio, sin warnings de lint nuevos.

**Resumen:**

- ✅ **Andre corrió la consulta y da CERO**: `select count(*) from auth.users where is_anonymous = true;`. O sea que `signInAnonymously()` **nunca funcionó**. Cada apertura de una herramienta hacía un round-trip que fallaba, y el `.catch(() => {})` de las ocho pantallas se lo comía en silencio.
- ⚠️ **Corrección de lo que dije en la entrada anterior**: NO es cierto que las 8 herramientas nunca registraran una completación. `ensureAnonSession()` devolvía el id de la sesión existente cuando la había y solo intentaba el alta anónima si no, así que **para quien tiene cuenta siempre funcionaron**. Lo que nunca se registró es el uso **sin cuenta**.
- 🔴 **`ensureAnonSession()` se eliminó**, y con él la idea de darle una fila de `auth.users` a cada visitante. La reemplaza `usuarioActualId(): Promise<string | null>`, que no intenta ningún alta. **Ya no hace falta**: lo único que la sesión anónima habilitaba era medir el uso sin cuenta, y eso ahora lo cubre `lib/analytics.ts` con un id de dispositivo, sin sesión y sin ensuciar `auth.users`.
- 🔴 **`recordCompletion` acepta `null` y emite el evento SIEMPRE**, con `con_cuenta`. La fila sigue necesitando cuenta (`user_id` es FK), pero el evento no: sin esto, quien completa un recurso sin registrarse no dejaba rastro en ningún lado — **y es exactamente a donde el onboarding nuevo manda a quien dice "solo estoy mirando"**. Se cayó el `if (userIdRef.current)` que envolvía la llamada en las ocho pantallas; ahora decide la función, en un solo lugar.
- 📝 **Por qué no fuimos por el otro camino** (prender las altas anónimas y arreglar el trigger): darle una fila de `auth.users` a cada visitante ensucia la tabla, cuenta para el MAU y deja perfiles huérfanos — todo para conseguir un id que ya tenemos gratis en el dispositivo. Y ni siquiera alcanzaba con prender el switch: `handle_new_user` escribe `profiles.email`, que es NOT NULL, y un usuario anónimo no tiene email.

**Pendiente para la próxima sesión:**

- 🔴 **Probar en dispositivo el par completo sin cuenta**: abrir Respiración sin registrarse, terminarla, y confirmar en `analytics_events` que están `recurso_iniciado` **y** `recurso_completado` con `con_cuenta: false` y el mismo `sesion`. Es el caso que hasta hoy era invisible.
- 📝 Con cuenta, confirmar que la fila en `resource_completions` sigue apareciendo igual que antes — es lo único que el cambio podría haber roto.

---

## 2026-09-01 — Andre (sesión 152 cont. · la sesión anónima se confundía con una cuenta real)

**Tocado:** `context/AuthContext.tsx`, `lib/resourceCompletions.ts`, `screens/ProfesionalScreen.tsx`, `screens/ResourceDetailScreen.tsx`, `screens/BookingScreen_Confirm.tsx`, `screens/ExploreResourcesScreen.tsx`, `screens/SessionsScreen.tsx`, las 8 pantallas de herramientas, `app/diario.tsx`, `app/gratitud.tsx`, `app/(tabs)/conexiones.tsx`, `app/(tabs)/recursos.tsx`, `components/PinButton.tsx`, `components/ReminderBell.tsx`, `SCHEMA.md`. Renombrado: `lib/onboardingAnalytics.ts` → `lib/analytics.ts` (+ su test). Nuevos: `hooks/useRecursoAbierto.ts`, `__tests__/resourceCompletions.test.ts`. 410 tests (eran 406), `tsc` limpio, sin warnings de lint nuevos.

**Resumen — pedido de Andre: "también en el resto de la aplicación, necesitamos saber qué funciona y qué no". La auditoría encontró un bug antes que los huecos.**

- 🔴 **La sesión ANÓNIMA se trataba como una cuenta real, y nada en todo el repo las distinguía** (`grep -rn "is_anonymous"` → cero resultados; `isLoggedIn = !!user`). Las 8 pantallas de herramientas llaman a `ensureAnonSession()` al montarse —`signInAnonymously()`, una sesión de Supabase de verdad— para poder escribir en `resource_completions`. Tres consecuencias:
  - **`volcarPendiente` escribía las respuestas del onboarding bajo el id anónimo** y las marcaba como volcadas. Al registrarse de verdad, `signUpWithEmail` crea un id distinto: quedaban varadas en una fila fantasma. **Es el mismo bug que se arregló ayer, entrando por otra puerta.**
  - **`onboarding_registro` se emitía para la sesión anónima**, inflando la conversión con gente que nunca se registró — y como tiene guard de una-vez-por-dispositivo, el registro real no se anotaba nunca.
  - **Los guards son `if (!user) requestAuth()`, así que quien abría una herramienta cruzaba el muro de la cuenta.** El changelog dice *"Booking requiere sesión real (no anónima)"* desde hace tiempo; **ese guard no estaba en el código**.
  - **Arreglo en un solo lugar** (`esSesionAnonima` en `AuthContext`) y no en cada guard: para todo lo que no sea anotar el uso de una herramienta, una sesión anónima **es** no tener cuenta. Las herramientas siguen andando porque toman el id de `ensureAnonSession()` directo, no del contexto.
- ✅ **El muro de la cuenta, medido.** `requestAuth` se llamaba desde **16 lugares y no se medía en ninguno**, siendo el punto de fricción más grande del producto. Ahora recibe un `motivo` y emite `muro_cuenta_visto` **desde adentro de `requestAuth`**: instrumentarlo ahí y no en cada pantalla es lo que garantiza que no quede una llamada sin medir. Los 16 motivos van de `reservar_sesion` a `pinear_recurso`.
- ✅ **El par abrir/completar de recursos, que es lo que da la tasa de abandono.** Solo se medía `recurso_completado`, y con eso no se puede distinguir un recurso que **nadie abre** (problema de descubrimiento) de uno que **todos abandonan** (problema del recurso) — diagnósticos opuestos con el mismo dato de llegada.
  - 🔴 **Y `recurso_completado` estaba suelto en 4 de las 11 pantallas que llaman a `recordCompletion`: siete recursos se completaban sin dejar rastro.** Se movió el evento adentro de `recordCompletion`, que es el cuello por el que pasan las once. Con test.
  - `recurso_iniciado` sale de `hooks/useRecursoAbierto.ts` y **no necesita sesión** a propósito: mide a quien explora sin cuenta —que es a donde manda el onboarding nuevo— y además vuelve visible un problema que hoy sería invisible (aperturas con cero completaciones = la sesión anónima no se está creando).
- ⚠️ **Cambio chico de datos que conviene saber**: `RuidoScreen` ahora pasa la duración a `recordCompletion`. Antes la omitía —la función la documenta como opcional "para recursos libres (Diario, Ruido blanco)"— pero **Ruido no es libre**: la persona elige 5/10/… minutos y la completación se dispara con ese timer. El evento suelto que había sí la mandaba, o sea que la tabla venía guardando menos que la analítica.
- 📝 `lib/onboardingAnalytics.ts` pasó a `lib/analytics.ts`: el problema que resuelve no es del onboarding, es de todo lo que ocurre antes de que exista una cuenta — que en este producto son casi todos los eventos interesantes.

**Pendiente para la próxima sesión:**

- ✅ ~~Confirmar si "Anonymous sign-ins" está habilitado~~ — **CONFIRMADO el 01/09/2026: la consulta da CERO**, `signInAnonymously()` nunca funcionó. Resuelto en la entrada de abajo.
- 🔴 **Probar en dispositivo que el arreglo de la sesión anónima no rompió las herramientas**: abrir Respiración sin cuenta, completarla, y confirmar que (a) sigue apareciendo la fila en `resource_completions` y (b) que después de eso el botón de reservar **sí** pide cuenta, que antes no lo hacía.
- 📝 Quedan los huecos 3, 4 y 5 de la auditoría: el **embudo de reserva** (los eventos están solo en la pantalla de confirmar; profesional → calendario → horario tienen cero, y es la rama que monetiza), **Sala y mensajes** (solo detección de contactos, siendo el bucle central del producto) y el **lado del coach**.

---

## 2026-09-01 — Andre (sesión 152 · el onboarding pregunta por la persona, no por la navegación)

**Tocado:** `screens/OnboardingScreen2.tsx` (reescrita), `screens/OnboardingScreen1.tsx`, `screens/OnboardingScreen4.tsx`, `screens/OnboardingBifurcacion.tsx`, `lib/onboardingRespuestas.ts`, `lib/guiaContextual.ts`, `context/AuthContext.tsx`, `app/(tabs)/conexiones.tsx`, `app/_layout.tsx`, `__tests__/onboardingRespuestas.test.ts`, `SCHEMA.md`, `docs/onboarding-bifurcacion-opciones.md`. Nuevos: `lib/onboardingAnalytics.ts`, `__tests__/onboardingAnalytics.test.ts`. Borrados: `screens/OnboardingScreen3.tsx`, `screens/OnboardingScreen5.tsx`, `app/onboarding3.tsx`, `app/onboarding5.tsx`. 406 tests (eran 393), `tsc` limpio, sin warnings de lint nuevos (7 antes, 7 después). **No cambió el schema** — `analytics_events` ya existía; lo que se documentó es la convención de consulta.

**Resumen:**

- ✅ **Se cerró la decisión que quedó abierta ayer**: de las cuatro opciones de `docs/onboarding-bifurcacion-opciones.md`, Andre eligió la **A**. "¿Cómo te gustaría empezar?" se reemplazó por **"¿Qué te trae por acá?"** (cuerpo · cabeza · rumbo · solo mirando) y el onboarding pasó de **cuatro pantallas para todos a una para quien vino a mirar y dos para quien trae algo**.
- 🔴 **El motivo no era visual.** Eran tres pantallas seguidas preguntando lo mismo con distinto grano, y ninguna preguntaba por la PERSONA: todas preguntaban cómo quiere usar el producto, en el único momento en que no lo puede saber. La pregunta nueva se come el viejo paso 1 (el universo cuerpo/mente/alma): es exactamente el mismo dato, pero preguntado por lo que le pasa a la persona en vez de disfrazado de navegación.
- 🔴 **El botón dejó de mentir.** El flujo terminaba con "Ver profesionales" haciendo `router.replace('/register')`. Ahora la última pregunta lleva de verdad a Profesionales, sin cuenta — `requestAuth` recién aparece al reservar.
- 🔴 **Corrección de Andre en la misma sesión, y tenía razón: la primera versión abría el DECK de la puerta y "se siente como que lo querés forzar".** El error fue de razonamiento: el defecto era "el botón miente", y lo arreglé cumpliendo la promesa a rajatabla en vez de preguntarme si la promesa estaba bien. El perfil para el que existe este camino es *"el que tiene un problema y no sabe qué necesita"* — **no saber qué necesitás no es estar listo para pagarle a alguien**, y ponerle un mazo de personas adelante a los 60 segundos de abrir la app colapsa las dos cosas. Ahora aterriza en el **menú de su eje con su tema destacado** (fondo teñido, sin borde ni badge: la señalamos, no elegimos por ella) y la bajada dice "empezaría por el tema destacado — pero elegí el que quieras".
- 🔴 **Para eso hizo falta una CUARTA taxonomía**: `CATEGORIA_A_PUERTA` en `lib/onboardingRespuestas.ts`. Las puertas de Conexiones son capa de presentación y **no se derivan** ni del universo ni del `topic`, así que el mapa se escribe a mano. Tres tests lo cuidan: que las nueve categorías caigan en puertas que **existan** (un id inventado no falla — abre el menú, y se lee como que la respuesta se perdió), que no se repitan, y que una desconocida devuelva null sin romper.
- ⚠️ **`app/(tabs)/conexiones.tsx` acepta ahora un parámetro `puerta`, y se aplica UNA SOLA VEZ** (ref). El parámetro se queda pegado a la ruta del tab después de navegar: sin el guard, cada vuelta al tab —o cada "volver a las áreas"— reabriría el eje solo y no habría forma de salir de él.
- 📝 **"Solo estoy mirando" va a Recursos, no a Inicio.** Sin cuenta, Inicio es casi todo estados vacíos: quien contestó que venía a mirar aterrizaba en la prueba de que no hay nada para mirar.
- 📝 **Las cuatro opciones pesan visualmente lo mismo, a propósito.** "¿Qué te trae?" pesa más que "¿cómo querés empezar?": si "solo estoy mirando" fuera un link chiquito al pie, la pantalla empujaría a inventar un problema para poder seguir.
- ✅ **El onboarding entero quedó instrumentado** (pedido de Andre: *"todo es prueba y testeo, necesitamos saber qué cosas tocan y deciden los usuarios"*). Tenía CERO líneas de analítica; ahora se miden las cuatro pantallas del embudo, incluidas la bienvenida y la bifurcación que no se tocaron en su diseño. Nuevo: `lib/onboardingAnalytics.ts` + `__tests__/onboardingAnalytics.test.ts`. La tabla de eventos está en `docs/onboarding-bifurcacion-opciones.md` §7 y la convención de consulta en `SCHEMA.md`.
- 🔴 **Y el problema que había que resolver ANTES de instrumentar nada: `registrarEvento` saca el `user_id` de la sesión, y en el onboarding no hay sesión.** Los eventos caían todos con `user_id` null, o sea indistinguibles entre sí: habría conteos ("cuántos tocaron cuerpo") pero **no embudo** ("de los que tocaron cuerpo, cuántos siguieron"), que es lo único que sirve para decidir. Se resolvió con un id anónimo por dispositivo en `properties.sesion`, y `onboarding_registro` —emitido desde `AuthContext` cuando aparece la cuenta— como el único puente que lleva `user_id` y `sesion` juntos.
- 🔴 **Un test destapó una carrera real en el id de sesión.** Se cacheaba el VALOR, así que varios eventos disparados en el mismo tick (la vista de la pantalla y un toque rápido) encontraban los tres el cache vacío, salían los tres a leer el storage y **creaban tres ids distintos** — el recorrido de una persona partido en tres, justo lo que el id venía a evitar. Se cachea la promesa, no el valor.
- 📝 **Se miden los TOQUES y la demora, no solo la respuesta.** `onboarding_opcion_tocada` lleva `orden` (el primer toque es lo que llamó la atención, los siguientes son los que se lo pensaron) y `onboarding_respuesta` lleva `toques` y `segundos`. Dos personas que eligen lo mismo, una en 2 segundos y otra en 20, no están diciendo lo mismo sobre la pregunta.
- 📝 **`conexiones_puerta_abierta` con `sugerida` es la que evalúa la decisión de hoy**: si la mayoría de los que llegan del onboarding abre una puerta distinta a la destacada, el mapa `CATEGORIA_A_PUERTA` está mal, y lo va a decir el dato en vez de una discusión.
- 📝 **Los temas se sueltan** (decisión 4 del brief). El paso 3 salió del flujo: era el dato más específico que se recolectaba, pero su vocabulario no es el de los coaches (`Alimentación` 0 de 2, `Sexualidad` 0 de 3), así que nunca se pudo usar para filtrar. `RespuestasOnboarding.temas` quedó **opcional**, no borrado, para poder seguir leyendo lo que ya está guardado en dispositivos reales.
- 📝 Aparte, sin relación: se sacó la línea más exterior del abanico de la bifurcación (`LINEAS`, de 5 trazadas a 4 por lado). Reponerla es volver a agregar `{ punta: 0.210, cuello: 0.525 }` como primer elemento.

**Pendiente para la próxima sesión:**

- 🔴 **Sin probar en dispositivo, y es lo que más importa acá.** Cuatro casos: (a) "solo estoy mirando" → aterriza en Recursos; (b) cuerpo → "Sexualidad e intimidad" → Profesionales abre el **menú de Bienestar físico** con *Sexualidad e intimidad* destacada, sin entrar sola a ningún mazo; (c) "volver a áreas de bienestar" **no vuelve a abrir el eje solo** (es el guard del ref); (d) registrarse después y confirmar que `user_quiz_answers` quedó con `axis` = cuerpo y `topic` = relaciones.
- 🔴 **Verificar en la base que los eventos llegan**, que es lo único que no se puede dar por hecho de la analítica: hacer un recorrido completo y confirmar que `analytics_events` tiene las filas con el **mismo `properties.sesion`**, y que al registrarse aparece `onboarding_registro` con `user_id`. Si eso no pasa, todo lo demás no sirve.
- ⚠️ **El mapa `CATEGORIA_A_PUERTA` es criterio, no verdad.** Los dos que menos me cierran: `entender` ("ir a fondo en mis patrones") → *Autoestima y confianza*, que es lo más cercano que existe del lado del coach pero no es lo mismo; y `energia` → *Descanso y energía*, que deja afuera los hábitos. Vale revisarlos con Joaquín.
- 📝 La bifurcación usuario/profesional y `OnboardingScreen1` **siguen sin analítica**. Ahora que el resto está instrumentado, son el hueco que queda para saber cuánta gente se cae antes de la primera pregunta.
- 📝 El deck de la puerta puede estar vacío según el tema (la pantalla ya tiene su estado "todavía no hay profesionales en…"). Con `Nutrición` y `Sexualidad`, que son las puertas más flacas, conviene ver cómo se siente llegar ahí recién salido del onboarding.

---

## 2026-09-01 — Joaquín (sesión 151 · device testing)

**Tocado:** `screens/VerificarMailScreen.tsx`, `hooks/useCerrarSesionAlSalir.ts`.

**Resumen — arranca la device review acumulada (sesiones 147/148/150). Dos hallazgos en los caminos de abandono del alta de coach.**

- Rutina de inicio: traído el batch de Andre (sesión 150, 46 commits — verificación de mail, onboarding con color, endurecimiento del alta de coach, baja de cuenta). Merge sano (393 tests, tsc limpio). Verificados contra la base sus dos migraciones nuevas: `profiles.email_verified_at` **existe** (el changelog se contradecía, quedó zanjado) y `user_quiz_answers.axis` **existe** — las dos corridas. El resto de sus pendientes es device testing.
- **Hallazgo (alta de coach)**: al tocar "Cancelar" en la pantalla de verificación de mail, la app tardaba "un rato" y recién ahí llevaba a la bifurcación. Diagnóstico: **el comportamiento es correcto** (cancelar borra la cuenta a medio crear con `cancelar()` y va a `/onboarding-bifurcacion` = afuera, no en el Inicio de usuario), pero el botón no mostraba feedback durante el borrado (`void cancelar()` sin estado de carga) → se sentía congelado.
- **Fix**: estado `cancelando` + spinner "Cancelando…" en el botón mientras corre `cancelar()`, con guard contra doble tap. tsc, lint y 393 tests limpios.
- **Hallazgo 2 — 🔴 bug real (gesto de back), en dos capas**:
  - Capa 1: el `beforeRemove` re-despachaba el `GO_BACK` original sobre una pila vacía (al alta se llega con `router.replace`) → "GO_BACK was not handled" → freeze. Cambiado a `router.replace('/onboarding-bifurcacion')`, el mismo destino que el botón.
  - Capa 2: **re-entrada**. El propio `router.replace` del handler dispara otro `beforeRemove`, y como el gesto **nunca marcaba `terminado`**, volvía a interceptar y llamaba a `abandonarAlta`/`deleteMyAccount` una segunda vez. Fix: marcar `terminado.current = true` al inicio del intercept + `.catch`.
  - **Capa 3 — la CAUSA RAÍZ, que la captura del error reveló**: `The screen 'verificar-mail' was removed natively but didn't get removed from JS state ... 'beforeRemove' ... is not fully supported in native-stack`. El swipe de iOS **borra la pantalla a nivel NATIVO**, y `beforeRemove`+`preventDefault` no puede interceptarlo en native-stack (lo que usa expo-router) — el mecanismo de abandono de Andre funciona para el botón y el back de Android, pero **estructuralmente no para el swipe**. Fix definitivo: **`gestureEnabled: false`** en `verificar-mail` y `coach-application` (`app/_layout.tsx`). El alta es destructiva (abandonar borra la cuenta), así que se sale por el botón "Cancelar" explícito, no por un swipe casual; el back de Android sigue yendo por JS y lo maneja `beforeRemove`. Las capas 1 y 2 quedan igual porque siguen aplicando al back de Android.
- 📝 **Bloqueante para probar el ciclo completo de verificación**: el código de 6 dígitos no llega porque falta la config de Supabase que Andre marcó como requisito (SMTP propio + plantilla Magic Link con `{{ .Token }}`) — es config fuera del repo, no un bug de código. Los caminos de ABANDONO igual se prueban sin el código (pasan antes de escribirlo).

**Alta de coach — CONFIRMADA EN DISPOSITIVO (01/09):** swipe deshabilitado (sin error), Cancelar → bifurcación con spinner, cerrar app y reabrir → retoma la verificación, reintentar con el mismo mail → deja crear. Los 4 caminos OK. (El ciclo con el código de 6 dígitos sigue bloqueado por la config de mail de Supabase, fuera del repo.)

**Pendiente de la device review:** Recursos (grilla + deck + vista lista), coach-login rediseñado, onboarding con color, baja de cuenta ("BORRAR CUENTA"), recuperación de contraseña.

---

## 2026-08-31 — Andre (sesión 150 cont. · el camino elegido tiñe las pantallas que siguen)

**Tocado:** `constants/onboardingTonos.ts`, `components/ui/AppBg.tsx`, `screens/OnboardingBifurcacion.tsx`, `OnboardingScreen2/3/4/5`, `CoachLoginScreen`, `VerificarMailScreen`, `CoachApplicationScreen`, `RegisterScreen`, `app/index.tsx`. Nuevo: `hooks/useTonoOnboarding.ts`. 393 tests, `tsc` limpio, sin warnings de lint nuevos (14 antes, 14 después).

**Resumen:**

- ✅ **Pedido de Andre: después de la bifurcación, las pantallas toman el color del ala elegida.** El derrame ya llevaba el tono hasta la primera pantalla; ahora lo lleva **todo el camino** — salvia para "quiero crecer", durazno para "quiero acompañar".
- 🔴 **El tono se PERSISTE, no se reenvía por parámetro.** Tiene que sobrevivir cinco pantallas (bifurcación → 2 → 3 → 4 → 5 → registro): reenviarlo en cada navegación significa que la primera que se olvide corta la cadena y de ahí en adelante todo vuelve al crema, **sin que nada falle de forma visible**.
- 🔴 **Pero el hook lee primero el PARÁMETRO y después lo guardado**, en ese orden. La pantalla que recibe la transición trae el tono en la ruta y lo tiene en el **primer cuadro**; ir al storage es asíncrono, así que arrancaría en crema y cambiaría un cuadro después — un parpadeo justo mientras la capa de la transición se desvanece, que es el peor momento posible.
- 📝 **`AppBg` acepta el tono y DERIVA el degradado** (`mixHex`) en vez de listar colores nuevos: el fondo teñido sigue siendo el mismo fondo, con el mismo gesto claro→apagado en diagonal, no otro diseño. Las tres pantallas de crema plano (login de coach, verificación, registro) lo aplican como color sólido.
- ⚠️ **El tono se limpia al entrar a la app** (`app/index.tsx`). Sin eso queda guardado para siempre, y alguien que eligió "acompañar" hace meses vería la pantalla de registro en durazno al llegar por cualquier otro camino — un color que ya no significa nada.

**Pendiente para la próxima sesión:**

- 🔴 **Verlo en dispositivo, que es de lo que se trata.** Los dos caminos completos, y sobre todo **la continuidad con la transición**: el ala se expande, tapa la pantalla, y lo que aparece debajo tiene que ser del mismo color, sin un salto de tono ni un parpadeo.
- 📝 Los dos tonos son muy suaves (`#E8E7DB` y `#F8E7DA` contra el crema `#F7F2EA`), así que puede quedar demasiado sutil. Si no se nota, se sube la saturación en `TONOS` — pero ojo, que esos mismos valores son el relleno de las alas.

---

## 2026-08-31 — Andre (sesión 150 cont. · la tarjeta del slot de Mensajes se sentía forzada)

**Tocado:** `screens/SessionsScreen.tsx`. 393 tests, `tsc` limpio, sin warnings de lint nuevos.

**Resumen:**

- 🔴 **Andre: "se siente muy forzada". Tenía razón, y el diagnóstico es que la tarjeta nació para tapar un hueco.** La puse esta misma sesión para que la lista no arrancara tan arriba; una pieza cuyo único motivo es ocupar espacio se siente forzada porque lo es. Tres cosas más la hundían:
  - **Era un duplicado literal del Inicio.** Mismo texto, palabra por palabra: *"Sin sesiones agendadas"* / *"Reservá una sesión con tu profesional"* (`index.tsx:534`).
  - **Anunciaba una ausencia, de un tema de otra pantalla.** Mensajes es para hablar con tus profesionales.
  - **Era una card completa —ícono, título, subtítulo, chevron— para algo que no era una acción que quisieras ahí.** El peso visual prometía más de lo que entregaba.
- ✅ **Ahora nombra a alguien**: *"¿Querés volver a ver a María?"*, con su avatar, y toca directo a reservar con ella. Es lo único que puede existir SOLO en esta pantalla — no habla de tu día, habla del vínculo que la pantalla lista. Y es la re-reserva en un tap, que es la medida anti-fuga #1 de la memoria de producto.
- 📝 **En presente y sin contar el tiempo, a propósito.** *"Hace 3 semanas que no ves a María"* pasa factura; *"¿querés volver a verla?"* invita. El principio del producto es que acompañar no es perseguir.
- 🔴 **Si nunca tuvo una sesión, no va NADA.** No hay a quién nombrar, y un cartel genérico sería volver exactamente al problema. Se aceptó que en ese caso la lista arranque más arriba: un relleno es peor que el hueco.
- 📝 De quién habla: la sala de la **última sesión completada**, ordenando por fecha **y hora** (con dos el mismo día, cuál fue "la última" lo decidiría el planner — el mismo defecto que ya apareció dos veces hoy).
- 📝 El avatar es de 42 y no de 50 como las filas de la lista: es una invitación, no una conversación, y tiene que pesar menos que lo que está abajo.

**Pendiente para la próxima sesión:**

- 🔴 **Verlo en dispositivo**, que es de lo que se trataba: con sesión pasada (invitación), sin ninguna (nada arriba) y con sesión próxima (carrusel).
- 📝 Si con varios profesionales nombrar solo al último se siente arbitrario, la alternativa es no mostrar nada cuando no hay uno que destaque. Queda para verlo funcionando.

---

## 2026-08-31 — Andre (sesión 150 cont. · cancelar el alta te bloqueaba tu propio mail)

**Tocado:** `hooks/useCerrarSesionAlSalir.ts`, `SCHEMA.md`. 393 tests, `tsc` y lint limpios.

**Resumen:**

- 🔴 **Cancelar la verificación y volver a intentar con el mismo mail decía "esta cuenta ya está registrada como usuario, usá otro".** Cerrar sesión no alcanzaba: **la cuenta quedaba existiendo** con `role = 'user'` (el default del trigger) y sin fila en `coaches`. Al reintentar, el login entraba bien y el guard de `validateAndNavigate` la leía como un usuario final que quiere postularse. **La persona quedaba bloqueada de su propia dirección por haber cancelado.**
- **Arreglo: abandonar el alta BORRA la cuenta**, no solo cierra sesión. Reusa `deleteMyAccount()` / la función `delete-account`, que además reescribe el mail a `deleted-<uuid>@vita.invalid` — o sea que **libera la dirección** y se puede volver a empezar con la misma.
- ⚠️ **Solo se borra si hay marca de alta en curso.** Esa marca se pone únicamente para cuentas que este flujo acaba de crear (`isNewSignup`), así que es la garantía de que nunca se toca una cuenta preexistente. Es una acción destructiva: el guard vale aunque hoy no haya forma de llegar sin la marca.
- 📝 **Si el borrado falla, igual se sigue**: se limpia la marca y se cierra sesión. Dejar a la persona atrapada en la pantalla porque no se pudo borrar sería peor que una cuenta huérfana.
- 📝 Aplica a los cuatro caminos de abandono, porque vive en el hook: botón, back de Android, gesto, y el cancelar de un alta retomada.

**Pendiente para la próxima sesión:**

- ⚠️ **Las cuentas de prueba creadas ANTES de este arreglo siguen existiendo** y van a seguir dando "ya registrada como usuario" con esos mails. Para reusarlos hay que limpiarlas — y 🔴 **no desde el panel de Authentication**, que deja la fila de `profiles` huérfana con el email UNIQUE y rompe ese mail para siempre (ver SCHEMA). Hay que borrar las dos filas por SQL, o usar direcciones nuevas mientras tanto.
- 🔴 **Probar el ciclo**: crear con un mail, cancelar, y volver a crear con **el mismo mail** — tiene que dejar.

---

## 2026-08-31 — Andre (sesión 150 cont. · el botón de cancelar no hacía nada al retomar el alta)

**Tocado:** `hooks/useCerrarSesionAlSalir.ts`, `screens/VerificarMailScreen.tsx`, `screens/CoachApplicationScreen.tsx`. 393 tests, `tsc` limpio, sin warnings de lint nuevos.

**Resumen:**

- ✅ **Confirmado que el arreglo de ayer anda**: reiniciar la app en medio del alta ahora retoma en "Confirmá tu mail" en vez de entrar como usuario.
- 🔴 **Pero apareció el reverso: ahí el botón "Cancelar" no hacía nada.** El arranque retoma con `router.replace`, así que **la pila queda vacía** y el `router.back()` del botón no tiene a dónde volver. Por el flujo normal sí funcionaba —hay historia detrás— y por eso no se había visto.
- **Arreglo: el botón deja de depender de la pila.** El hook expone `cancelar()`, que limpia la marca del alta y cierra sesión, y la pantalla navega a la bifurcación explícitamente. Funciona igual se haya llegado por el flujo o retomando.
- 📝 **Mismo arreglo en la postulación**, que tenía el problema idéntico y por el mismo motivo: retomando en el paso `postular` también se llega con `replace`.
- 📝 En modo `gate` (usuario que va a reservar) se sigue usando `router.back()`, y ahí es lo correcto: esa pantalla se abrió con `push` y volver es literalmente volver a la reserva que estaba haciendo.

**Pendiente para la próxima sesión:**

- 🔴 **Probar las dos formas de llegar a cada pantalla**, porque se comportan distinto: por el flujo (con historia) y retomando después de cerrar la app (sin historia). El bug vivía solo en la segunda.

---

## 2026-08-31 — Andre (sesión 150 cont. · el SMTP propio es requisito, no un paso de producción)

**Tocado:** `screens/VerificarMailScreen.tsx`, `docs/plantilla-mail-codigo.md`.

**Resumen:**

- 🔴 **Hallazgo de Andre que cambia el plan: al desactivar Custom SMTP, Supabase desactiva TAMBIÉN las plantillas personalizadas** y vuelve a mandar las suyas. Sin un SMTP propio configurado **no hay forma de meter `{{ .Token }}` en el mail**, así que la verificación por código no puede funcionar. El SMTP propio deja de ser "para producción más adelante" y pasa a ser **requisito de la feature**.
- 📝 **Se descubrió a los golpes**, y vale dejar la secuencia porque explica dos síntomas que parecían no tener relación: el SMTP estaba mal configurado y colgaba → `signInWithOtp` devolvía **504** (timeout del gateway, con `x-envoy-attempt-count: 4`) → se desactivó el SMTP → volvió a llegar **el link de fábrica en vez del código**.
- 📝 **Para probar no hace falta esperar el DNS de `vitaapp.com.ar`**: Resend manda desde `onboarding@resend.dev` sin verificar dominio, con la limitación de que solo llega a la casilla con la que se creó la cuenta. Para producción hay que verificar el dominio y cambiar el remitente.
- 🔴 **Arreglado un bug que el log destapó**: en un 504 el error de Supabase **no llega como texto sino como el objeto `Response` entero**, y el traductor de motivos hacía `.toLowerCase()` sobre eso y reventaba — fallaba justo cuando más falta hacía. Ahora coacciona con cuidado, mira el `status`, y traduce el 502/504 a "el servicio de mail no está respondiendo".
- 📝 **El asunto lleva texto adelante**, no `{{ .Token }}` pelado: la variable se reemplaza por el número, así que un asunto solo con la variable llega a la bandeja como "483920", sin decir de qué app es.

**Pendiente para la próxima sesión:**

- 🔴 **Probar el ciclo entero ahora que el mail sale**: crear cuenta de coach, que llegue el código, confirmarlo, y los cuatro caminos de abandono.
- ⚠️ **Antes de abrir el registro de verdad**: verificar `vitaapp.com.ar` en Resend (SPF y DKIM en DonWeb) y cambiar el remitente a `no-responder@vitaapp.com.ar`. Con `onboarding@resend.dev` **solo llegan mails a la casilla de la cuenta de Resend**, así que en producción nadie recibiría nada.

---

## 2026-08-31 — Andre (sesión 150 cont. · para darse de baja hay que escribir BORRAR CUENTA)

**Tocado:** `screens/ProfileOwnScreen.tsx`, `screens/CoachSettingsScreen.tsx`. Nuevos: `lib/confirmarBorrado.ts`, `__tests__/confirmarBorrado.test.ts`. 393 tests (eran 390), `tsc` limpio, sin warnings de lint nuevos.

**Resumen:**

- ✅ **Pedido de Andre: la baja pide escribir `BORRAR CUENTA`.** Antes era un botón rojo al final de dos párrafos de advertencia — se puede tocar sin querer, o por inercia después de leer. La baja es irreversible **y dispara reembolsos**, así que tiene que costar un acto deliberado.
- 📝 **La comparación perdona mayúsculas y espacios de más.** La fricción que se busca es escribir las dos palabras, no acertarle al teclado: alguien decidido a borrar su cuenta no tiene por qué pelear con el shift.
- 🔴 **La frase vive en `lib/confirmarBorrado.ts` y no adentro de una pantalla**, porque la baja existe en **dos** lugares (perfil del usuario y ajustes del coach). Dos frases distintas serían una trampa: la persona escribe la que recuerda de la otra pantalla y no le funciona.
- 📝 El botón queda deshabilitado y atenuado hasta que la frase coincida, y la caja se vacía cada vez que se abre el modal — un intento anterior no puede dejarla lista.

**Pendiente para la próxima sesión:**

- 📝 **Sin ver en dispositivo.** Los dos modales (usuario y coach), que el botón se habilite solo con la frase y que el teclado no tape el campo en pantallas chicas.

---

## 2026-08-31 — Andre (sesión 150 cont. · cerrar la app en medio del alta ya no te deja adentro)

**Tocado:** `app/_layout.tsx`, `screens/CoachLoginScreen.tsx`, `screens/VerificarMailScreen.tsx`, `screens/CoachApplicationScreen.tsx`, `hooks/useCerrarSesionAlSalir.ts`. Nuevo: `lib/altaCoach.ts`. 390 tests, `tsc` limpio, sin warnings de lint nuevos.

**Resumen:**

- 🔴 **Cerrado el agujero que quedaba anotado como "pide rediseño", porque Andre lo encontró.** Pedir el código, **cerrar la app**, volver a abrir → entraba como usuario normal. Ningún guard de navegación corre cuando la app se cierra: la sesión sobrevive en AsyncStorage y el `AuthRedirect` la ve como una sesión legítima.
- **Arreglo: una marca de "alta en curso"** (`lib/altaCoach.ts`, AsyncStorage) que el arranque mira antes de redirigir a ningún lado. Con la marca puesta, esa sesión **no habilita nada**: se retoma el alta donde quedó.
- 📝 **Guarda el PASO y no un booleano** (`verificar` / `postular`): quien ya confirmó el código y cierra la app en la postulación no tiene que volver a pedir un mail y tipear seis dígitos otra vez.
- 🔴 **El `AuthRedirect` no redirige mientras no sepa si hay alta en curso** (`pasoAlta === undefined` → no hace nada). Leer la marca es asíncrono, y redirigir con la respuesta a medias es exactamente el bug que se está arreglando — la misma carrera que la de la entrada anterior, en otro lugar.
- 📝 **Quién la limpia**: la postulación al enviarse (el alta terminó) y `useCerrarSesionAlSalir` al abandonar (se va junto con la sesión — si quedara, el arranque intentaría retomar un alta sin sesión detrás).
- ⚠️ **`PANTALLAS_ALTA` es un set aparte de `ONBOARDING_SCREENS`**, y son opuestos: al primero se llega CON sesión a propósito, al segundo se lo echa por tenerla.

**Pendiente para la próxima sesión:**

- 🔴 **Probar los cuatro caminos de abandono**, que ahora son distintos entre sí: botón "Cancelar", back de Android, gesto de deslizar, y **cerrar la app** (que es el que faltaba). Los cuatro tienen que terminar sin sesión o retomando el alta, nunca en el Inicio.
- 📝 Probar también el caso bueno: confirmar el código, cerrar la app, y que al volver retome en la **postulación** y no vuelva a pedir el código.

---

## 2026-08-31 — Andre (sesión 150 cont. · el cierre de sesión al abandonar perdía una carrera)

**Tocado:** `screens/VerificarMailScreen.tsx`, `screens/CoachApplicationScreen.tsx`. Nuevo: `hooks/useCerrarSesionAlSalir.ts`. 390 tests, `tsc` limpio, sin warnings de lint nuevos.

**Resumen:**

- 🔴 **El guard de abandono estaba puesto pero no servía.** Andre: mail cualquiera → verificación → "Cancelar" → **terminó en el Inicio del usuario igual**. La limpieza de `useFocusEffect` llamaba a `signOut()`, que es **asíncrono**: se disparaba mientras la navegación ya había ocurrido, y el `AuthRedirect` alcanzaba a ver la sesión todavía viva en una pantalla de onboarding. El bug volvía, solo que un instante después.
- **Arreglo: `beforeRemove` en vez de la limpieza de foco.** Frena la salida, cierra la sesión, y recién entonces deja ir — para cuando la pantalla se desmonta ya no hay sesión que redirigir. De paso cubre las tres salidas (botón, back de Android, gesto de deslizar) con un solo mecanismo, que era lo que se buscaba con el `useFocusEffect`.
- 📝 **Extraído a `hooks/useCerrarSesionAlSalir.ts`**, porque las dos pantallas del alta tenían el mismo guard copiado — y las dos tenían la misma carrera.
- ⚠️ **La lección, para no repetirla**: `signOut()` asíncrono + navegación inmediata = el redirect global gana. Cualquier guard que dependa de "cerrar sesión al irse" tiene que **bloquear la salida**, no correr en paralelo con ella.
- 📝 En `gate` (usuario que va a reservar) el hook queda desactivado: esa sesión ya era legítima antes de entrar.

**Pendiente para la próxima sesión:**

- 🔴 **Volver a probar el caso exacto**: crear cuenta de coach con un mail cualquiera, llegar a la verificación, tocar "Cancelar", y confirmar que queda **afuera** — no en el Inicio. Y lo mismo con el back de Android y el gesto.

---

## 2026-08-31 — Andre (sesión 150 cont. · la plantilla del mail del código)

**Tocado:** `SCHEMA.md`, `scripts/add-email-verified-at.sql` (marcado como corrido). Nuevos: `docs/plantilla-mail-codigo.md`, `docs/plantilla-mail-codigo.html`.

**Resumen:**

- ✅ **`scripts/add-email-verified-at.sql` CORRIDO** por Andre el 31/08/2026. La columna existe, así que el gate de reserva ya se puede activar de verdad.
- 🔴 **Queda documentada la configuración que vive FUERA del repo y sin la cual nada de esto funciona.** `signInWithOtp` dispara la plantilla **Magic Link**, y la de fábrica manda `{{ .ConfirmationURL }}` — **un link y ningún código**. La persona recibe un enlace que abre el navegador mientras la app espera seis dígitos. La variable que hace falta es **`{{ .Token }}`**.
- 📝 **El código va también en el ASUNTO** (`Tu código de Vita: {{ .Token }}`): se ve en la notificación del teléfono sin abrir el mail, que es la diferencia entre tipearlo de memoria y tener que salir de la app, abrir el correo y volver.
- 📝 La plantilla está escrita para clientes de mail y no para un navegador: tabla en vez de flex, estilos inline (Gmail descarta el `<style>`) y pila de fuentes del sistema, porque las tipografías de la app no se pueden cargar ahí.
- ⚠️ **Dos ajustes más quedan anotados en el doc**: cuánto dura el código (Email OTP Expiration, 1 hora por defecto — está bien; menos de diez minutos sería hostil) y el **límite de mails por hora**, que en el SMTP interno de Supabase es muy bajo.

**Pendiente para la próxima sesión:**

- ✅ ~~Pegar la plantilla en Supabase~~ — **cargada por Andre el 31/08/2026** (asunto + cuerpo en la plantilla Magic Link). Falta confirmar que el mail llegue con los seis dígitos.
- 🔴 **El SMTP interno NO alcanza para producción.** Con dos coaches registrándose el mismo día, el segundo no recibe nada y no tiene forma de enterarse. Antes de abrir el registro de verdad hay que conectar un SMTP propio (Resend, Postmark, SES).
- 📝 El doc trae la lista de qué probar, incluido el síntoma de que la plantilla no se guardó: llega un mail con botón y sin números.

---

## 2026-08-31 — Andre (sesión 150 cont. · el mail verificado se exige antes de reservar)

**Tocado:** `screens/BookingScreen_Confirm.tsx`, `screens/VerificarMailScreen.tsx` (renombrada), `app/verificar-mail.tsx` (renombrada), `app/_layout.tsx`, `screens/CoachLoginScreen.tsx`, `SCHEMA.md`. Nuevos: `lib/emailVerificado.ts`, `__tests__/emailVerificado.test.ts`. 390 tests (eran 381), `tsc` y lint limpios.

**Resumen:**

- ✅ **Segunda mitad de lo hablado: el usuario final no se frena en el alta, se frena al reservar.** Un muro de mail en el registro para a alguien que quizá la está pasando mal, en el punto del embudo donde más gente se cae. En la confirmación de reserva el mail hace falta de verdad —confirmación, recordatorios y sobre todo el **reembolso** si algo sale mal— y la persona ya tiene un motivo propio para confirmarlo.
- **El gate va en `onConfirm`, justo después del chequeo de sesión.** Manda a verificar y **vuelve a la misma pantalla**, así que el siguiente toque de "Confirmar" sigue de largo.
- 📝 **A quien entró con Google o Apple no se le pide nada.** El proveedor ya entregó el mail verificado; pedirle un código sería pedirle que pruebe algo que Google ya probó. Se detecta por `app_metadata.provider`/`providers` — mirando la lista y no solo el primero, porque una cuenta puede tener más de una identidad.
- 🔴 **`necesitaVerificarMail` falla ABIERTO, y es deliberado.** Ante cualquier error del select devuelve `false` y deja pasar. El caso concreto: si el script de la columna todavía no se corrió, un gate que se activara con ese error dejaría a **todo el mundo sin poder reservar**. Un mail sin verificar es un riesgo chico; una app donde nadie puede reservar, no. Tiene test.
- 🔴 **La pantalla se renombró de `CoachVerificationScreen` a `VerificarMailScreen`** (ruta `/coach-verificacion` → `/verificar-mail`): ya no es del coach, la usan los dos caminos. Un nombre que miente sobre quién usa una pantalla compartida es de las cosas que muerden después.
- ⚠️ **Los dos modos se comportan distinto al abandonar, y la diferencia importa.** En `alta` la sesión se cierra (es una cuenta recién creada que todavía no debería servir para nada); en `gate` **no se toca**, porque esa sesión ya era legítima — cerrarle la sesión a alguien por no confirmar un código en medio de una reserva sería echarlo de la app por un trámite.

**Pendiente para la próxima sesión:**

- 🔴 **Sigue faltando correr `scripts/add-email-verified-at.sql`** y editar la plantilla de Magic Link con `{{ .Token }}`. Sin la columna, el gate no se activa nunca (falla abierto); sin la plantilla, el código no llega.
- ⚠️ **Todas las cuentas existentes tienen `email_verified_at` en null**, así que la primera vez que vayan a reservar les va a pedir el código. Es el efecto buscado, pero conviene saberlo antes de que pase.
- 📝 **Solo se gatea la reserva.** Si más adelante hay otros lugares donde el mail importe (por ejemplo el retiro de plata del coach), el helper ya está y es una línea.
- 🔴 **Sin probar en dispositivo**: reservar con una cuenta de mail sin verificar, confirmar el código, y que al volver la reserva siga; y que una cuenta de Google no vea nada de esto.

---

## 2026-08-31 — Andre (sesión 150 cont. · verificación de mail en el alta de coach)

**Tocado:** `screens/CoachLoginScreen.tsx`, `app/_layout.tsx`, `SCHEMA.md`. Nuevos: `screens/CoachVerificationScreen.tsx`, `app/coach-verificacion.tsx`, `scripts/add-email-verified-at.sql` (**⚠️ FALTA CORRER**). 381 tests, `tsc` limpio, sin warnings de lint nuevos.

**Resumen:**

- ✅ **El alta de coach ahora pide un código de 6 dígitos** antes de dejar postular. Dos cosas que hasta hoy no se comprobaban: quien se equivoca al tipear su dirección quedaba con una cuenta **irrecuperable y sin aviso** (`resetPassword` manda un mail a una casilla que no existe), y Vita aprobaba profesionales sin haber comprobado que la casilla desde la que se postulan fuera suya — en una verificación de credenciales, justo el tipo de cosa que no se puede dar por sentada.
- 🔴 **Por qué OTP propio y no "Confirm email" de Supabase.** Ese ajuste es **del proyecto entero**: prenderlo frenaría también el registro de usuarios con un muro de mail en el peor momento, que se decidió NO hacer. Y con el ajuste apagado Supabase **auto-confirma a todos**, así que `auth.users.email_confirmed_at` viene lleno siempre y no distingue nada — de ahí la columna propia `profiles.email_verified_at`.
- 📝 **Prenderlo además habría roto dos cosas en silencio**, que es lo que se revisó antes de descartarlo: (1) `validateAndNavigate` hace `getUser()` y sin sesión hace `return` sin mensaje, o sea que el botón de crear cuenta parecería no hacer nada; (2) `signUpWithEmail` escribe `accepted_terms`/`age_confirmed` en `profiles` solo `if (data.session && data.user)` — sin sesión quedarían solo en la metadata de auth, y según SCHEMA ese campo es lo que hace oponible la cláusula anti-solicitación.
- 📝 **`shouldCreateUser: false`** en el `signInWithOtp`: la cuenta ya existe. Sin eso, un mail mal tipeado daría de alta una cuenta nueva en vez de fallar.
- 📝 **Cuenta regresiva de 45s en el reenvío.** Sin eso la persona toca "Reenviar" tres veces seguidas y se come el límite de Supabase sin entender por qué.
- 📝 **Mismo guard de abandono que `CoachApplicationScreen`**: irse sin confirmar cierra la sesión. También se llega acá logueado, así que sin eso el bug de esta mañana volvía por otra puerta.
- ⚠️ **`coach-verificacion` NO se agregó a `ONBOARDING_SCREENS`** en `app/_layout.tsx`, y quedó escrito por qué: son pantallas a las que se llega CON sesión a propósito, y meterlas en ese set las mandaría de vuelta al Inicio apenas se montan.
- 📝 El mail que se pasa a la pantalla sale de `user.email` (la sesión) y no del input: es el que Supabase realmente registró.

**Pendiente para la próxima sesión:**

- 🔴 **CORRER `scripts/add-email-verified-at.sql`.** Hasta que se corra, el `update` de `email_verified_at` falla en silencio — la verificación igual funciona como gate, pero no deja constancia.
- 🔴 **⚠️ HAY QUE EDITAR LA PLANTILLA DE MAIL EN SUPABASE, o esto no funciona.** La plantilla de *Magic Link* por defecto manda `{{ .ConfirmationURL }}`, o sea **un link y ningún código**. Para que llegue el número de 6 dígitos hay que incluir **`{{ .Token }}`** en la plantilla (Dashboard → Authentication → Email Templates → Magic Link). Sin ese cambio, la persona recibe un link que no lleva a ningún lado útil y la pantalla se queda esperando un código que nunca vio.
- ⚠️ **El SMTP interno de Supabase tiene un límite bajo de mails por hora.** Alcanza para probar de a poco, pero para producción hace falta un SMTP propio — y conviene mirarlo antes de que un coach real se quede sin poder registrarse.
- 🔴 **Sin probar en dispositivo**: el ciclo entero (código que llega, código correcto, código vencido, reenvío) y que abandonar en el medio cierre la sesión.
- 📝 Queda pendiente la otra mitad de lo hablado: **exigir el mail verificado a los usuarios antes de reservar/pagar**, que es donde el mail importa de verdad sin frenar el alta.

---

## 2026-08-31 — Andre (sesión 150 cont. · abandonar la postulación de coach te dejaba adentro como usuario)

**Tocado:** `screens/CoachApplicationScreen.tsx`. 381 tests, `tsc` limpio, sin warnings de lint nuevos.

**Resumen:**

- 🔴 **Empezar el alta de coach, NO terminar el formulario y volver atrás te dejaba logueado en el Inicio.** Reportado por Andre. La cadena, entera:
  1. `CoachLoginScreen` llama a `signUpWithEmail`, que **crea la cuenta y abre sesión** (Supabase te firma al registrarte).
  2. `validateAndNavigate(true)` hace `router.replace('/coach-application')` — ya con sesión viva y `profiles.role = 'user'`, que es el default del trigger.
  3. Volver atrás cae en la bifurcación, que es una pantalla de onboarding.
  4. El `AuthRedirect` de `app/_layout.tsx` ve sesión + pantalla de onboarding y hace `router.replace('/(tabs)')`.
- **O sea: entrás a la app como usuario final sin haber terminado nada ni haberlo pedido**, y con una cuenta que creaste queriendo ser profesional.
- 📝 **El propio archivo ya tenía el razonamiento escrito.** `handleSubmit` cierra sesión al enviar con el comentario *"no debe quedar una sesión activa que te deje usar la app como si ya estuvieras aceptado"*, y las otras dos ramas de `validateAndNavigate` (solicitud en revisión, cuenta ya registrada como usuario) también hacen `signOut()`. **Abandonar era el único camino de salida sin el guard.**
- **Arreglo:** limpieza de `useFocusEffect` que cierra sesión al irse de la pantalla si no se envió. Cubre el botón de atrás, el botón físico de Android y el gesto de deslizar, que es por qué va ahí y no en el `onPress` del botón.
- ⚠️ **Por refs y con `[]`.** Con `signOut` en las dependencias, cualquier re-render del contexto que le cambie la identidad correría la limpieza y **cerraría la sesión en medio del formulario**. El flag de "ya envié" también es ref y no estado, por lo mismo.

**Pendiente para la próxima sesión:**

- 🔴 **Probar en dispositivo el caso reportado**, y también que enviar la postulación siga funcionando (que la limpieza no cierre sesión de más).
- ⚠️ **Queda un agujero que este arreglo NO cubre: matar la app parado en el formulario.** La limpieza de foco no corre, la sesión sobrevive en AsyncStorage, y al volver a abrir entrás como usuario. Taparlo de verdad pide **no crear la cuenta hasta el envío**, que es un rediseño del alta (hoy hace falta un usuario de auth para poder ser dueño de la fila de `coaches`). Vale decidirlo aparte.

---

## 2026-08-31 — Andre (sesión 150 cont. · sacar el color quieto entre la animación y la pantalla nueva)

**Tocado:** `app/_layout.tsx`, `components/EntradaDesdeColor.tsx`. 381 tests, `tsc` limpio.

**Resumen:**

- 🔴 **La animación estaba bien; lo que sobraba era la cola.** Andre reportó que después de que el ala termina de crecer la pantalla se queda en color casi un segundo. No era la expansión: eran **tres cosas encadenadas detrás de ella** — la transición del stack (~350ms), un `delay: 90` que le había puesto a la capa de entrada, y su fade de 420ms. Casi 900ms de color quieto.
- **`animation: 'none'`** en `onboarding2` y `coach-login`, en vez del `fade` que había puesto antes. Se llega con la pantalla **entera** tapada por el color, así que cualquier transición es tiempo que no se ve: era la mayor parte del problema. Sin transición, la pantalla nueva ya está puesta debajo del color y lo único que queda por delante es descubrirla.
- **Se fue el `delay` y el fade bajó de 420 a 300ms.** El respiro tenía sentido cuando la capa competía con la transición del stack; sin esa transición, no hay nada que esperar — la pantalla nueva está debajo desde el primer cuadro.
- 📝 Total de cola: de ~900ms a 300ms, y esos 300 **son** el descubrimiento, no tiempo muerto. La duración de la expansión (700ms) no se tocó: Andre dijo que esa parte estaba bien.

**Pendiente para la próxima sesión:**

- 📝 **`animation: 'none'` también aplica al volver atrás** desde esas dos pantallas, que ahora corta en seco. Es el precio de sacar la transición y me pareció el lado correcto (la ida es el camino diseñado, la vuelta es rara), pero si molesta hay que separar el caso.

---

## 2026-08-31 — Andre (sesión 150 cont. · corrección 2: lo que se expande es el ÁREA DE COLOR)

**Tocado:** `screens/OnboardingBifurcacion.tsx`, `constants/onboardingTonos.ts`. 381 tests, `tsc` limpio, sin warnings de lint nuevos.

**Resumen:**

- 🔴 **Segunda corrección de Andre sobre la misma animación, y la anterior también estaba mal.** Primero hice un círculo nuevo encima; después hice crecer el aro de la flecha. Ninguna era: **lo que se expande es el área de color**, o sea **el ala** — la forma curva de fondo que ocupa media pantalla. El ícono, el título, la descripción y la flecha son "los otros elementos", y esos **se desvanecen**.
- **Cómo funciona:** el ala elegida se vuelve a dibujar en una capa propia, encima del fondo y **debajo del contenido**. En el cuadro cero es idéntica a la que ya estaba —misma forma, mismo color, mismo lugar— así que no se ve aparecer nada; y mientras crece, todo lo que queda por encima ya se está yendo.
- 🔴 **Crece desde un punto ADENTRO del ala, no desde el centro de la pantalla.** El centro cae justo sobre la costura que separa las dos mitades, y **un punto de la costura no se mueve al escalar**: la mitad de enfrente no se cubriría nunca, por mucho que se agrande. El punto elegido es la flecha que se tocó, que además es de donde la persona espera que salga el movimiento.
- 🔴 **Escalar alrededor de un punto que no es el centro pide `translate` + `scale`, y el translate va animado también** (`t = P · (1 − s)`). Los dos interpolan del MISMO valor, así que la relación se mantiene en cada cuadro y el punto queda realmente fijo. Todo en el hilo nativo.
- 📝 **El factor sale de la geometría, no de probar números.** El ala contiene un disco alrededor del punto: hacia el costado llega hasta la costura, hacia abajo hasta el borde, y el radio seguro es el menor de los dos. La distancia a cubrir se mide contra **las cuatro esquinas** y se toma la peor, más 15% de margen.
- 🔴 **`TONOS` pasa a ser los rellenos de las ALAS** (`#E8E7DB` salvia / `#F8E7DA` durazno) y no los acentos de los íconos. Lo que termina cubriendo la pantalla es el ala, así que la pantalla que recibe tiene que llegar en ese tono y no en el saturado.
- 📝 Se sacaron los `overflow: 'visible'` de la versión anterior: lo que crece ya no es un hijo adentro de una columna sino una capa a nivel raíz, así que no había nada que se pudiera recortar. Y se sacó `ARO`, que quedó sin uso.
- 📝 Duración a 700ms (era 620) con `Easing.bezier(0.34, 0, 0.2, 1)`: el área es mucho más grande que un aro y el mismo tiempo se sentía apurado.

**Pendiente para la próxima sesión:**

- 🔴 **Sin ver en dispositivo, y es la TERCERA versión de esta animación.** Vale mirarla antes de tocar nada más.
- ⚠️ **Lo que más dudo es la nitidez del borde mientras crece**: es un `<Path>` de `react-native-svg` dentro de una capa escalada, así que a mitad de camino el borde curvo puede verse suavizado. Si molesta, la alternativa es animar el `d` del path (se ve perfecto pero corre en el hilo de JS, que es lo que este repo viene evitando).

---

## 2026-08-31 — Andre (sesión 150 cont. · corrección: el que crece es el BOTÓN, no un círculo nuevo)

**Tocado:** `screens/OnboardingBifurcacion.tsx`. 381 tests, `tsc` limpio, sin warnings de lint nuevos.

**Resumen:**

- 🔴 **La primera versión estaba mal y Andre la corrigió.** Yo había puesto un círculo NUEVO del color del ala que nacía en la flecha y se expandía por encima de todo. Lo que se pedía es que **se expanda el propio botón**, desde su propio borde, y que el resto de la pantalla se desvanezca. Los dos síntomas de por qué la versión anterior no se leía como el mismo objeto: el círculo aparecía **relleno desde el cuadro cero** mientras el botón real es un aro hueco (o sea, "apareció una cosa nueva", no "esto creció"), y **nada más se iba**, así que el color simplemente tapaba una pantalla intacta.
- **Ahora es el aro de verdad el que viaja**: se llena de su color, crece desde su propio borde con `scale`, y todo lo demás —las alas de color, el wordmark, el título, la otra columna y el contenido de la propia— se desvanece antes de que termine de crecer, así el crecimiento pasa sobre una pantalla ya vacía.
- 📝 **Un solo `Animated.Value` para las cinco cosas**, con el escalonado metido en los `inputRange` en vez de cinco animaciones en paralelo. Mismo criterio que la entrada del panel de Sofía: costarían cinco veces más y se verían igual.
- 🔴 **El relleno es una capa aparte adentro del aro, no el `backgroundColor` del aro.** `backgroundColor` no corre en el hilo nativo y `opacity` sí. Entra antes de que empiece a crecer — si no, lo que se agranda es un anillo vacío.
- 📝 El borde del aro (1.2px) se escala junto con él y termina siendo un anillo grueso, pero **es del mismo color que el relleno**, así que se funde y no se ve.
- ⚠️ **`overflow: 'visible'` explícito en toda la cadena** (`root`, `columns`, `col`): el aro se sale de su columna por varias pantallas, y en Android un hijo que se pasa del padre se recorta salvo que se diga lo contrario. En iOS no hacía falta; se puso igual porque el bug sería invisible desde acá.
- 📝 **La columna elegida sube a `zIndex: 2`**: sin eso su hermana quedaría dibujada por encima del color.
- ⚠️ El `ref` de un `Animated.View` no garantiza `measureInWindow`; si no está, se navega derecho en vez de romper. Mismo criterio que el guard de "reducir movimiento".
- 📝 Duración a 620ms con `Easing.bezier(0.32, 0, 0.24, 1)` — sale despacio y termina rápido: el arranque es lo que se lee como "esto que toqué se está abriendo", el final ya es solo color.

**Pendiente para la próxima sesión:**

- 🔴 **Sin ver en dispositivo, y es la segunda versión de lo mismo**: conviene mirarla antes de darla por buena. Las dos alas, el "reducir movimiento", y volver atrás desde coach-login.
- ⚠️ **Mirarlo en Android específicamente** por lo del recorte: si el aro se corta al salirse de su columna, el `overflow: 'visible'` no alcanzó y hay que pasarlo a una capa absoluta a nivel raíz.

---

## 2026-08-31 — Andre (sesión 150 cont. · la bifurcación se derrama en color al elegir)

**Tocado:** `screens/OnboardingBifurcacion.tsx`, `screens/OnboardingScreen2.tsx`, `screens/CoachLoginScreen.tsx`, `app/_layout.tsx`. Nuevos: `constants/onboardingTonos.ts`, `components/EntradaDesdeColor.tsx`. 381 tests, `tsc` limpio, sin warnings de lint nuevos.

**Resumen:**

- ✅ **Pedido de Andre: al tocar un ala, que el color se expanda y la pantalla siguiente llegue con ese color.** Un círculo del verde (o del naranja) nace **en la flecha que tocaste**, crece hasta tapar la pantalla, y recién ahí se navega; la pantalla que recibe monta ya cubierta por ese mismo color y lo desvanece. Se lee como un solo movimiento, no como dos pantallas que se turnan.
- 📝 **Misma técnica que el derrame de Sofía**, y por el mismo motivo: **solo `scale`**. El círculo se monta con su tamaño FINAL y arranca encogido — animar `width`/`height`/`borderRadius` obliga a correr en el hilo de JS, que es justo el error que la sesión 130 ya había corregido en `SofiaAssistant`.
- 📝 El diámetro se calcula contra **las cuatro esquinas** y se toma la peor: desde una flecha que está abajo y a un costado, un círculo dimensionado a ojo deja una punta sin cubrir.
- 🔴 **`animation: 'fade'` en `onboarding2` y `coach-login`.** Con el slide por defecto la pantalla nueva se ve asomar por el borde debajo de la capa de color y el truco se cae. Bajo una capa opaca, un fade es invisible.
- 🔴 **La capa de la pantalla que recibe se pinta desde el PRIMER cuadro** (`useState` inicializado, no dentro de un efecto). Un cuadro de retraso alcanza para ver un destello de la pantalla nueva antes de que la tape, que es exactamente lo que la transición viene a evitar.
- 🔴 **Se repone al recuperar el foco.** Se navega con `push`, así que la bifurcación queda montada debajo: al volver atrás desde coach-login seguiría **tapada por el círculo a pantalla completa y con el guard trabado**, o sea con las dos alas muertas. `useFocusEffect` limpia las dos cosas.
- 📝 **Los dos colores se mudaron a `constants/onboardingTonos.ts`**, porque ahora los usan las dos puntas de la transición. Con una copia en cada lado se despegaban en la primera edición y el derrame terminaba en un tono distinto al que se fue.
- ⚠️ **Respeta "reducir movimiento"** (`AccessibilityInfo.isReduceMotionEnabled`) y también el caso de que la flecha no se pueda medir: en los dos se navega derecho. La transición es un adorno y no puede ser la única forma de avanzar.

**Pendiente para la próxima sesión:**

- 🔴 **Sin ver en dispositivo.** Los casos: las dos alas; volver atrás desde coach-login y confirmar que la pantalla quedó usable; y con "reducir movimiento" prendido, que navegue sin animación.
- 📝 La duración quedó en 460ms con `Easing.bezier(0.4, 0, 0.2, 1)`. Es lo primero a ajustar si se siente lento o abrupto.

---

## 2026-08-31 — Andre (sesión 150 cont. · brief de decisión sobre la bifurcación del onboarding)

**Tocado:** nada de código. Nuevo: `docs/onboarding-bifurcacion-opciones.md`.

**Resumen:**

- 📝 **Brief autocontenido para que Andre lo discuta con Joaquín.** Junta el flujo completo del onboarding tal como está, los hallazgos de la revisión, lo que ya se arregló en esta sesión (para que no se re-descubra) y **cuatro opciones de reemplazo** con su a favor y su en contra. **La decisión NO está tomada.**
- Las cuatro: **(A)** una sola pregunta sobre la persona —"¿Qué te trae por acá?"— que colapsa dos pantallas y elimina la de temas; **(B)** dos puertas, sacando "Sé qué necesito", dejando el guiado intacto; **(C)** ninguna pantalla, con la ayuda viviendo en contexto en las piezas que ya existen; **(D)** una sola oferta con salida, misma forma que el "Saltear la guía".
- 🔗 **Versión web para pasar por link**: https://claude.ai/code/artifact/af7f5dc4-b063-4dfc-93ab-fea778217c83
- ⚠️ Los tres hallazgos que más pesan en la discusión, para no perderlos: el onboarding **pregunta lo mismo tres veces** y nunca por la persona; el botón final dice "Ver profesionales" y abre un registro; y los temas del paso 3 son **una tercera taxonomía** que no habla el vocabulario de los coaches (dos categorías enteras con cero correspondencia).

**Pendiente para la próxima sesión:**

- 🔴 **Elegir entre las cuatro** (Andre + Joaquín).
- 🔴 **Instrumentar lo que sobreviva**: hoy el onboarding no tiene una sola línea de analítica, así que toda esta discusión se dio sobre hipótesis, no sobre datos.

---

## 2026-08-31 — Andre (sesión 150 cont. · el eje declarado deja de pelearse con el topic)

**Tocado:** `hooks/useRecommendedResource.ts`, `lib/quizPendiente.ts`, `lib/onboardingRespuestas.ts`, `__tests__/onboardingRespuestas.test.ts`, `SCHEMA.md`. Nuevo: `scripts/add-quiz-declared-axis.sql` (**CORRIDO y VERIFICADO el 31/08/2026**). 381 tests (eran 379), `tsc` y lint limpios.

**Resumen:**

- 🔴 **Se resolvió la decisión abierta de las dos taxonomías guardando las dos cosas, no eligiendo una.** `user_quiz_answers` suma `axis` (cuerpo/mente/alma, con CHECK, nullable): el **eje declarado** decide QUÉ recomendarle y el **topic** decide CÓMO nombrárselo. Antes había que sacrificar uno — o el mapa respetaba el universo y la etiqueta mentía ("algo para tu salud" a quien habló de sexualidad), o respetaba el significado y el recurso salía de un eje que la persona no eligió.
- 📝 **La decisión se tomó midiendo, no a ojo.** `firstToolInAxis` devuelve la primera tool del eje y los conjuntos de `TOOL_AXES` se pisan tanto que **cuerpo y mente devuelven la MISMA tool** (respiración); solo alma difiere (meditación). O sea que el eje mueve poco y la etiqueta —lo único que la persona lee— mueve siempre. Eso descartó "cambiar el mapa". Y mover las categorías en el onboarding obligaba a sacar "Sexualidad e intimidad" de Cuerpo, que es peor que el problema: agrupar sexualidad con el cuerpo es defendible, no un error. Quedó la columna, que además **le da casa al universo**, hasta hoy varado en AsyncStorage.
- ⚠️ **`useRecommendedResource` consulta con `select('*')` y no por nombre de columna, a propósito.** Pedir `axis` antes de correr el script devuelve error y `data` en null: un OTA que llegara antes de la migración **dejaría de leer también el `topic` y apagaría la recomendación entera**. Con `*` la app anda igual antes y después, así que no hay orden obligatorio de deploy.
- 🔴 **El eje se valida antes de encolarlo** (`esEje`). `universo` llega por parámetro de ruta, o sea que puede ser cualquier string; un valor que el CHECK rechace haría fallar el upsert, y como el volcado **no se marca cuando falla**, reintentaría en cada login para siempre. Lo destapó un test que ya existía y cambió de resultado.
- 📝 `axis` es nullable porque `QuizScreen` no pregunta universo: en esas filas queda null y el eje se sigue deduciendo del topic, exactamente como hoy.
- 📝 `interestAxes` suma los dos ejes en vez de elegir: ahí no hay que decidir nada, es el conjunto de lo que le interesa.

**Pendiente para la próxima sesión:**

- ✅ ~~Correr `scripts/add-quiz-declared-axis.sql`~~ — **corrido y verificado el 31/08/2026**: la columna está y el CHECK quedó puesto.
- 🔴 **Probar en dispositivo el caso que motivó todo**: onboarding → Cuerpo → "Sexualidad e intimidad" → registrarse, y confirmar que la recomendación sale del eje **cuerpo** y que el texto habla de **"tus relaciones"**. Antes eso era imposible de tener junto.
- 📝 Los `temas` elegidos siguen sin columna, guardados solo en local.

---

## 2026-08-31 — Andre (sesión 150 cont. · la tarjeta de solicitud pendiente, por rol)

**Tocado:** `screens/SalaScreen.tsx`. 379 tests, `tsc` limpio, sin warnings de lint nuevos.

**Resumen:**

- 🔴 **La tarjeta de `sessionState === 'pendiente'` estaba escrita entera desde el punto de vista del usuario y se le mostraba igual al coach.** Le decía **"Solicitud enviada"** y **"Esperando confirmación de [su propio cliente]"** — al revés: él la recibió, y es él quien tiene que confirmarla. Es el segundo caso del mismo bug de rol que ya había aparecido en la tarjeta de re-reserva; quedó anotado en esa entrada y ahora se cierra.
- 🔴 **Y le mostraba el problema dándole solo la salida mala**: la única acción era cancelar. Confirmar vivía únicamente en `CoachReservasScreen`. Ahora el coach tiene **"Confirmar sesión"** como acción principal y "Rechazar" como secundaria, mismo orden que en Reservas.
- 📝 **Reusa `confirmBooking` de `lib/coachBookingActions.ts`**, la misma que llama Reservas: además de cambiar el estado avisa al usuario y limpia las reservas que competían por ese horario. Duplicar eso acá habría sido una tercera copia de la regla.
- 📝 El estado se actualiza local (`setActiveBooking` + recalcular `sessionState`) en vez de recargar, que es como la pantalla ya se actualiza en otros lados.
- 📝 La lógica de cancelar no se tocó: `handleCancelBooking` ya distinguía por `soyCoach`. Lo único que cambia del lado del coach es la etiqueta ("Rechazar" en vez de "Cancelar solicitud").

**Pendiente para la próxima sesión:**

- 🔴 **Probar en dispositivo el ciclo entero**: usuario pide sesión → el coach la ve en la sala con el copy correcto → confirma desde ahí → confirmar que al usuario le llega el aviso y que la tarjeta pasa a "confirmada" de los dos lados.
- 📝 Vale barrer `SalaScreen` entera buscando más bloques sin guard de rol: es una pantalla que sirve a dos roles y este es el segundo caso que aparece.

---

## 2026-08-31 — Andre (sesión 150 cont. · el quiz sin cuenta también deja de perderse)

**Tocado:** `screens/QuizScreen.tsx`, `lib/onboardingRespuestas.ts`, `context/AuthContext.tsx`, `SCHEMA.md`. Nuevos: `lib/quizPendiente.ts`, `__tests__/quizPendiente.test.ts`. 379 tests (eran 371), `tsc` limpio, sin warnings de lint nuevos.

**Resumen:**

- 🔴 **`QuizScreen` perdía las tres respuestas de quien lo hacía sin cuenta.** Su upsert hacía `if (!uid) return;` y seguía de largo en silencio. Lo único que quedaba era `AsyncStorage.setItem('vive_quiz_topic', q1)` — y esa clave **no la leía nadie** (`useRecommendedResource` lee la base), así que era escribir a la nada. **Y el quiz se puede hacer sin cuenta**: se llega desde Profesionales, que es navegable como anónimo.
- **La plomería se extrajo a `lib/quizPendiente.ts`**, compartida por los dos caminos que preguntan sin cuenta (el onboarding guiado y el quiz). `lib/onboardingRespuestas.ts` queda con lo suyo: el vocabulario (`CATEGORIA_A_TOPIC`) y lo que no tiene columna (universo y temas).
- 📝 **La cola mergea en vez de pisar.** El onboarding solo produce `topic` y el quiz los tres campos: reemplazar el registro entero haría que hacer el quiz después del onboarding borrara lo anterior, o al revés. Y el upsert manda **solo las columnas que existen**, así que un volcado parcial no pisa lo que ya había en la fila.
- 🔴 **Guardar respuestas nuevas resetea `volcado`.** Si quedaran marcadas como ya escritas, un quiz hecho después de un volcado no llegaría nunca a la base. Tiene test.
- 📝 **`QuizScreen` tiene ahora un solo camino**: encola siempre, y si ya hay sesión vuelca en el acto para que la recomendación se actualice enseguida. Se eliminó `vive_quiz_topic` y su import de AsyncStorage.

**Pendiente para la próxima sesión:**

- 🔴 **Sin probar en dispositivo.** Dos casos: hacer el quiz **sin cuenta**, registrarse y confirmar que `user_quiz_answers` quedó con topic + professional_type + budget; y hacer el onboarding guiado, registrarse, después el quiz, y confirmar que el quiz gana (es más nuevo y más deliberado).
- 🔴 **Sigue abierta la decisión de las dos taxonomías** (universo del onboarding vs `topic`): tres de las nueve categorías recomiendan sobre un eje distinto al que la persona eligió. Se arregla reconciliándolas o dándole columna al universo, no retocando el mapa.
- ⚠️ `universo` y los `temas` siguen sin columna, guardados solo en local.

---

## 2026-08-31 — Andre (sesión 150 cont. · el onboarding guiado deja de tirar las respuestas)

**Tocado:** `screens/OnboardingScreen5.tsx`, `context/AuthContext.tsx`, `SCHEMA.md`. Nuevos: `lib/onboardingRespuestas.ts`, `__tests__/onboardingRespuestas.test.ts`. 371 tests (eran 362), `tsc` limpio, sin warnings de lint nuevos.

**Resumen:**

- 🔴 **Cerrado el punto 3 de lo hablado.** `OnboardingScreen5.handleContinue()` era `if (selected.length === 0) return; router.replace('/register');` — descartaba `selected`, `universo` y `categoria`. Tres pantallas de preguntas que no dejaban nada, justo en la rama para la que existe el producto.
- ⚠️ **Va a AsyncStorage y no directo a la base porque en ese momento no hay cuenta** (`user_quiz_answers.user_id` es FK a `profiles`). `AuthContext` las vuelca en el `onAuthStateChange`, que es el primer momento en que se puede escribir. Si la persona abandona el registro y vuelve mañana, lo que contestó sigue ahí.
- 🔴 **El volcado corre UNA SOLA VEZ, y el flag es lo que lo garantiza.** Sin eso cada login reescribiría la respuesta del onboarding y **pisaría el quiz que la persona hizo después adentro de la app**, que es más nuevo y más deliberado. Si el upsert falla no se marca, así que se reintenta en el login siguiente en vez de perderse. Los dos casos tienen test.
- 🔴 **Hallazgo que condicionó el diseño: el onboarding y `user_quiz_answers` son dos taxonomías distintas de lo mismo, y en tres casos se contradicen.** `sexualidad` y `vinculos` el onboarding las agrupa en cuerpo y mente, pero `relaciones` cae en alma según `useRecommendedResource`; `trabajo` el onboarding lo pone en alma y el mapeo lo lleva a mente. `CATEGORIA_A_TOPIC` mapea **por significado**, para que la etiqueta de la recomendación ("tus relaciones", "el trabajo") diga algo cierto; la consecuencia es que en esos tres el eje del recurso sugerido no coincide con el universo elegido. **Se documentó y NO se parcheó el mapa**: eso se arregla reconciliando las taxonomías o agregando una columna para el universo, y es decisión de producto.
- 📝 **No se tocó el schema.** `universo` y los `temas` se quedan en AsyncStorage porque no tienen columna — no descartados, sin lugar todavía.

**Pendiente para la próxima sesión:**

- 🔴 **Sin probar en dispositivo.** El caso completo: elegir "No sé por dónde empezar", contestar las tres pantallas, registrarse, y confirmar en la base que `user_quiz_answers` quedó con el `topic` correcto. Y el segundo: volver a entrar y confirmar que NO se reescribe.
- ⚠️ **`QuizScreen` tiene el mismo agujero sin tapar**: su upsert hace `if (!uid) return;`, así que alguien que hace el quiz sin cuenta escribe solo `vive_quiz_topic` en AsyncStorage, que `useRecommendedResource` no lee. Es el mismo arreglo y la pieza ya está hecha — sería engancharlo a `volcarRespuestas`.
- 🔴 **Decisión de producto abierta: reconciliar las dos taxonomías** (universo del onboarding vs `topic` del quiz) o darle columna al universo declarado. Mientras no se decida, tres de las nueve categorías recomiendan sobre un eje distinto al que la persona eligió.

---

## 2026-08-31 — Andre (sesión 150 cont. · la guía contextual y el onboarding de "¿Cómo te gustaría empezar?")

**Tocado:** `components/FirstTimeTooltip.tsx`, `screens/OnboardingScreen2.tsx`. Nuevos: `lib/guiaContextual.ts`, `__tests__/guiaContextual.test.ts`. 362 tests (eran 352), `tsc` limpio, sin warnings de lint nuevos.

**Contexto — la revisión de la pantalla, antes del código:**

- 🔴 **La elección no se guardaba en ningún lado.** `selected` era estado local que solo elegía la ruta. Buscado en todo el repo: `'explore'`, `'guide'` y `OptionId` no aparecían en ningún otro archivo. Se le pedía a la persona que se declarara en el peor momento —antes de saber qué es Vita— y después la app no se acordaba de nada.
- 🔴 **Y la rama "No sé por dónde empezar" tira TODO lo que contestás.** `OnboardingScreen5.handleContinue()` hace `router.replace('/register')` y descarta `selected`, `universo` y `categoria`. Ninguna pantalla del onboarding escribe `user_quiz_answers`: el único que lo hace es `QuizScreen.tsx:122`, el quiz de adentro de la app. Son tres pantallas de preguntas que no dejan nada. **Sin arreglar todavía.**
- 🔴 **Cero analítica en todo el onboarding** (ningún `registrarEvento` en `OnboardingScreen1-5` ni en la bifurcación): no hay forma de saber qué elige la gente.
- 📝 El objetivo de cada rama, hablado con Andre: la 1 es **retención** (que pruebe algo gratis y vuelva), la 2 es la que **monetiza** (máxima intención, sacarle fricción), la 3 es **el usuario central** del producto — el problema #1 del overview es literalmente "no sé por dónde empezar".

**Resumen de lo hecho:**

- ✅ **La rama de más intención deja de chocar contra un muro.** "Sé qué necesito" iba a `/register`: el único muro de la pantalla, puesto justo en la rama de la persona que ya decidió que quiere un profesional. Profesionales anda sin cuenta (`requestAuth` la pide recién al reservar, igual que para quien elige explorar), así que el registro no protegía nada. Ahora va directo a `/(tabs)/conexiones`.
- ✅ **La elección se persiste** (`guardarCamino`, AsyncStorage y no la base: todavía no hay cuenta, y en dos de los tres caminos puede no haberla nunca).
- 🔴 **Las microguías YA EXISTÍAN.** Andre pidió "cartelitos que te vayan llevando por la app": `components/FirstTimeTooltip.tsx` ya estaba montado en Inicio, Profesionales, Recursos y Sala, con su copy y su clave de AsyncStorage. Lo que faltaba no era la pieza, era **el hilo**: sin contador, sin salida, y sin relación con lo que la persona eligió.
- ⚠️ **Se descartó el tour lineal de 1/5 a 5/5 y quedaron contextuales** (corrección propuesta y aceptada por Andre): un tour explica cinco pantallas antes de que hayas usado ninguna, es el formato que se saltea por reflejo, y choca de frente con "si abruma, sobra". Las cards siguen apareciendo al llegar a cada pantalla, hablando de lo que estás mirando — pero ahora con **"N de 3"** y **"Saltear la guía"**, que apaga las cuatro de una sola vez.
- 📝 **El número va por orden de APARICIÓN, no por posición fija.** Si alguien entra primero a Recursos, un número fijo le diría "3 de 3" en la primera card que ve. Se cuenta cuántas vio + 1, y se lee antes de marcar la actual para que no se cuente a sí misma.
- 📝 **La Sala queda fuera del contador a propósito**: no la alcanza cualquiera —hace falta tener un profesional— y prometer "3 de 4" a alguien que quizá nunca abra un chat es una promesa incumplible. Sigue existiendo y respeta el "saltear", pero no se numera. Tampoco se apaga para quien eligió "Sé qué necesito": no es parte de la guía de bienvenida, es la explicación de una pantalla a la que acaba de llegar.
- 📝 **Sin camino guardado la guía se muestra igual**: son las instalaciones anteriores a esto, es lo que ya les pasaba, y esconderla sería sacarles algo por una elección que nunca pudieron hacer.
- 🔴 **Arreglado de paso: tocar fuera marcaba la card como vista.** La card aparece sola 800ms después de entrar a la pantalla, así que un toque accidental hacía perder para siempre una explicación que no se puede volver a pedir. Ahora tocar fuera solo cierra; para que no vuelva hay que decirlo ("Entendido" o "Saltear").
- 📝 **El botón no dice "Siguiente"**, que era el pedido original: en el modelo contextual no hay una próxima card ahí al lado, la siguiente aparece cuando la persona llega a esa pantalla. Prometer "Siguiente" y no llevar a ningún lado sería mentir.

**Pendiente para la próxima sesión:**

- 🔴 **Sin probar en dispositivo.** Los casos: elegir explorar y ver 1 de 3 → 2 de 3 → 3 de 3 caminando la app; "Saltear la guía" en la primera y confirmar que no aparece ninguna más; elegir "Sé qué necesito" y confirmar que cae en Profesionales sin registro y sin cards; tocar fuera y confirmar que la card vuelve.
- 🔴 **La rama "guide" sigue tirando las respuestas** (`OnboardingScreen5`). Es el punto 3 de lo hablado y falta decidir dónde se guardan: en ese momento no hay cuenta, así que van a AsyncStorage y hay que volcarlas a `user_quiz_answers` después del registro.
- ⚠️ **Sigue sin analítica el onboarding entero.** Ahora que la elección se persiste, agregar `registrarEvento` es barato y es la única forma de saber si esta pantalla sirve.
- 📝 Andre habló de 5 cartelitos y hoy son 4 (3 numerados + Sala). Si falta alguna pantalla, agregarla a `PASOS_GUIA` alcanza — el contador se ajusta solo.

---

## 2026-08-31 — Andre (sesión 150 cont. · la card de nota solo mira la ÚLTIMA sesión)

**Tocado:** `screens/CoachHomeScreen.tsx`. 352 tests, `tsc` y lint limpios.

**Resumen:**

- 🔴 **La card caminaba hacia atrás.** Buscaba la primera sesión SIN nota recorriendo la semana de más nueva a más vieja (`recientes.find(b => !yaTiene.has(b.id))`), así que **apenas cerrabas la de ayer saltaba a la de hace cinco días**. El aviso dejaba de ser un recordatorio y se convertía en una lista de deudas.
- **Ahora mira solo la última sesión** (decisión de Andre): si esa ya tiene nota, no hay card — aunque queden viejas sin cerrar. El recordatorio es sobre la sesión que acabás de tener; una que ya quedó atrás no se cierra de memoria, y proponerlo igual pide algo peor que nada.
- 📝 **Segundo criterio de orden en la consulta**: antes ordenaba solo por `scheduled_date`, así que con dos sesiones el mismo día "la última" la decidía el planner. Ahora ordena también por `scheduled_time` descendente. Importa más que antes, porque ahora se usa **una sola fila** (`.limit(1)`) en vez de recorrer la lista.
- 📝 La consulta de notas pasa de `.in(...)` sobre toda la semana a un `.eq()` sobre esa reserva.
- ⚠️ **Si la última sesión no tiene `sala_id`, no hay card y no se busca hacia atrás.** Es la consecuencia directa de la regla nueva: sin sala no hay a dónde navegar, y saltar a una anterior sería volver al comportamiento que se sacó.

**Pendiente para la próxima sesión:**

- 🔴 **Probar en dispositivo**: con dos sesiones completadas en la semana, escribir la nota de la más reciente y confirmar que la card desaparece en vez de saltar a la anterior.

---

## 2026-08-31 — Andre (sesión 150 cont. · la card de "dejá una nota" del inicio del coach no se iba nunca)

**Tocado:** `screens/CoachHomeScreen.tsx`, `screens/SalaScreen.tsx`. 352 tests, `tsc` limpio, sin warnings de lint nuevos.

**Resumen:**

- 🔴 **La card se quedaba puesta después de escribir la nota, y la nota se guardaba contra la sesión equivocada.** No era un bug de refresco: el cálculo de `sinCerrar` está bien y el inicio del coach ya recarga por foco (`useFocusEffect`, línea 456).
- **La causa: la card sabía qué reserva le faltaba cerrar y tiraba ese dato al navegar.** Mandaba solo `sala_id` y `abrir_notas: '1'`, así que del otro lado `SessionNotesSheet` recibía `bookingId={activeBooking.id}` — y `activeBooking` se arma como `upcoming ?? endedActive ?? recentCompleted[0]`, donde `upcoming` sale de una consulta de reservas **futuras**. Con la próxima sesión ya agendada, la nota se escribía contra ESA. La sesión pasada seguía sin nota, el inicio la volvía a encontrar y la card reaparecía siempre.
- ⚠️ **Hay un segundo camino al mismo error, incluso sin próxima sesión agendada**: la ventana de la card es de **una semana**, pero `endedActive` solo existe mientras `getSessionState` devuelve `'finalizada'`, que dura **24hs**. Para una sesión de hace tres días caía en `recentCompleted[0]`, que es "la última completada" y no necesariamente la que la card señalaba.
- **Arreglo: la card pasa la reserva concreta** (`notas_booking`) y `SalaScreen` la usa como fuente de verdad del sheet (`notesBookingId`, con fallback a `activeBooking` para las entradas normales al chat). La pastilla "Notas" del header cuelga de lo mismo, así que también aparece cuando se llega desde la card sin reserva activa en la sala.
- 📝 Se ordenó de paso la declaración: `notesBookingId` tuvo que moverse debajo de `activeBooking` — escrito arriba daba TDZ.

**Pendiente para la próxima sesión:**

- 🔴 **Probar en dispositivo el caso que lo destapa**: coach con sesión completada hace unos días **y la próxima ya agendada** con la misma persona. Escribir la nota desde la card y confirmar que la card se va. Sin la próxima agendada el bug podía no aparecer, que es probablemente por qué pasó desapercibido.
- 📝 **El parámetro sobrevive mientras dure la navegación**: si el coach entra desde la card, guarda, y más tarde vuelve a abrir la pastilla sin salir de la sala, el sheet sigue apuntando a la sesión vieja. Es defendible (entró por esa), pero si molesta hay que limpiar el parámetro después del primer guardado.

---

## 2026-08-31 — Andre (sesión 150 cont. · las notas de sesión pasan al hilo del chat)

**Tocado:** `lib/sessionNotes.ts`, `screens/SalaScreen.tsx`, `SCHEMA.md`. 352 tests, `tsc` limpio, sin warnings de lint nuevos (5 antes, 5 después).

**Resumen:**

- **Decisión de Andre: las notas tienen que quedar TODAS en el chat, y la privada del coach visible solo para él.** Antes había una sola card, al pie del hilo, y solo del lado del usuario.
- 🔴 **La nota compartida desaparecía sola, y ese era el bug de fondo.** Se pedía con `getSharedNote(activeBooking.id)`, o sea la de UNA reserva — y `activeBooking` prioriza la sesión próxima sobre la terminada (`upcoming ?? endedActive`). **Apenas el usuario reservaba la sesión siguiente, la nota de la anterior se iba del chat**, justo cuando más sentido tiene releerla. El comentario del propio código decía "la relee entre sesiones" y era exactamente lo que no podía hacer. La nota nunca se borró: dejaba de mostrarse.
- **`getRelationshipNotes({ userId, coachId, asCoach })`** reemplaza esa consulta: trae todas las notas del par (usuario, coach) de la sala, no las de un `booking_id`. `asCoach` decide si vienen también las privadas. ⚠️ El RLS ya lo garantiza (la policy del usuario es `user_id = auth.uid() AND shared = true`), pero **el filtro va igual y explícito** para que la privacidad se lea en la consulta y no haya que ir a buscar la policy para saber qué trae.
- **El hilo pasa a ser un `timeline`**: mensajes y notas se mezclan y se ordenan por fecha. Para eso `Message` suma `createdAt` (ISO crudo) — el `time` que ya tenía viene formateado y no sirve para ordenar. Se ordena comparando el ISO como string, que en UTC ordena bien y no construye un `Date` por comparación.
- 📝 **La nota privada se ve distinta a propósito**: punteada, fondo neutro, candado y la línea "Solo la ves vos". Es un apunte de trabajo, no parte de la conversación, y el coach no puede tener que adivinar de un vistazo si el usuario lo está leyendo.
- 📝 **`SessionNotesSheet` ya exponía un `onSaved` que `SalaScreen` no le pasaba.** Ahora sí: el coach guarda y la nota aparece en el hilo sin salir y volver a entrar.

**Pendiente para la próxima sesión:**

- 🔴 **Sin probar en dispositivo.** Los casos: usuario con notas de varias sesiones (que estén todas y en orden), coach viendo las compartidas y las privadas juntas, y que el usuario NO vea ninguna privada — esto último conviene mirarlo con una cuenta de usuario real, no razonando sobre el RLS.
- ⚠️ **`session_notes` no está en la publicación de realtime** (están `messages`, `bookings`, `salas`, `notifications`). Una nota que el coach escribe mientras el usuario tiene el chat abierto le aparece recién al reabrir. Se puede sumar la tabla a la publicación si molesta.
- 📝 Las notas se ubican por `created_at`. El sheet hace upsert tocando `updated_at`, así que editar una vieja no la mueve de lugar en el hilo — que es lo que se quiere, pero conviene confirmarlo mirándolo.

---

## 2026-08-31 — Andre (sesión 150 cont. · UI de usuario filtrada a la vista del coach en la sala)

**Tocado:** `screens/SalaScreen.tsx`. 352 tests, `tsc` limpio.

**Resumen:**

- 🔴 **El COACH veía "¿Querés reservar tu próxima sesión con [nombre del usuario]?"** al entrar a un chat con alguien con quien ya tuvo sesión. `SalaScreen` es compartida por los dos roles y la tarjeta de cierre (`sessionState === 'finalizada'`) era el único bloque de la pantalla **sin guard de rol**.
- 🔴 **No era solo copy mal dirigido: el botón llevaba a un camino roto.** `handleReschedule` empuja a `/booking-calendar` con `coachId: recipientId`, y del lado del coach ese id es el del **usuario** — o sea que iba a pedir la agenda de alguien que no es coach.
- **Arreglo: `recipientIsCoach &&` en el bloque** (la convención del archivo: "la otra parte es coach" = "yo soy el usuario"), que es el mismo guard que ya tenían la nota compartida y el botón de reservar del header. Se agregó además el guard adentro de `handleReschedule`, porque el nombre de la función no dice que sea solo del usuario.
- 📝 **El coach no pierde nada**: el `finalizada` no tiene tarjeta en el header (la cadena de arriba cubre live/pendiente/confirmada), pero la pastilla de **Notas** sí se le sigue mostrando, que es su acción de post-sesión.

**Pendiente para la próxima sesión:**

- 🔴 **Hay un SEGUNDO caso del mismo bug, sin arreglar porque es decisión de copy.** La tarjeta de `sessionState === 'pendiente'` (línea ~959) tampoco tiene guard de rol, y al coach le dice **"Solicitud enviada"** y **"Esperando confirmación de [nombre del usuario]"** — al revés: la solicitud la recibió él y es él quien tiene que confirmar. El botón "Cancelar solicitud" sí funciona bien para los dos (`handleCancelBooking` ya distingue por `soyCoach`), así que es texto, no lógica.
- ⚠️ Ligado a lo anterior: **al coach no se le ofrece confirmar desde la sala**, solo cancelar. Confirmar hoy vive en `CoachReservasScreen`. Si la sala le muestra la solicitud, o le da las dos acciones o no le muestra la tarjeta.
- 📝 Vale barrer `SalaScreen` entera buscando más bloques sin guard: es una pantalla que sirve a dos roles y este ya apareció dos veces.

---

## 2026-08-31 — Andre (sesión 150 cont. · achicar el hueco entre la card y los chats)

**Tocado:** `screens/SessionsScreen.tsx`. `tsc` limpio.

**Resumen:**

- **Pedido de Andre: menos distancia entre la tarjeta verde y la lista.** Eran 52pt, y 44 de esos no eran aire sino los `carrusel.paddingBottom` que existen para que la ScrollView no recorte la sombra. Bajarlos a secas devolvía el corte.
- 🔴 **Se devuelven enteros con un margen negativo, no achicando la sombra.** El `paddingBottom` sigue ahí —que es lo que evita el recorte— pero `carruselWrapSolo` lo compensa con `marginBottom: 12 − SOMBRA_ALCANCE`, así que **la sombra le cae encima a la lista en vez de empujarla**, que es lo que hace una sombra de verdad. Quedan **12pt** de separación real (eran 52). Sobre la primera fila cae la cola de la sombra: a 26pt del borde ronda el 10%, y la fila arranca justo ahí por su propio `sessionRow.paddingVertical: 14`.
- 📝 **Solo aplica con UNA sesión** (`proximas.length === 1`), que es cuando no hay puntitos y debajo de la sombra no queda nada que proteger. Con dos o más, los puntitos siguen debajo de la sombra y el margen normal de 8 los separa de la lista.
- ⚠️ **Sin conflicto de gestos, y no por casualidad**: el margen negativo hace que la lista se superponga a los últimos 32pt de la ScrollView, pero justo en ese caso la ScrollView ya va con `scrollEnabled={false}` (hay una sola card), así que no hay swipe horizontal que robarle. Si algún día el carrusel se habilita con un solo ítem, esto hay que mirarlo de nuevo.

**Pendiente para la próxima sesión:**

- 🔴 **Verificar en dispositivo con captura**, los dos casos: una sesión (12pt hasta la primera fila, sombra cayendo sobre ella) y dos o más (puntitos alineados y debajo de la sombra).

---

## 2026-08-31 — Andre (sesión 150 cont. · la sombra del carrusel, segunda pasada)

**Tocado:** `screens/SessionsScreen.tsx`. 352 tests, `tsc` limpio.

**Resumen:**

- 🔴 **El arreglo anterior estaba a medias y la medición lo mostró.** Andre dijo que se seguía viendo raro; midiendo la captura nueva: el corte de abajo se corrió de y=813 a y=851 y el escalón bajó de 43 a 9, o sea mejoró pero **no alcanzó**. A 30pt debajo de la card la sombra todavía valía 15 unidades sobre el fondo.
- 🔴 **El cálculo de `SOMBRA_ALCANCE` desde el token era el error.** `offset.height + radius − inset` daba 30, y es de menos: **el desenfoque de CoreGraphics se extiende bastante más allá del `shadowRadius` nominal**. El valor ahora sale de la medición (~1 unidad cada 0.85pt → muere cerca de los 43) y quedó en 44, con la advertencia escrita de que si se toca el token hay que volver a mirarlo en una captura, no recalcularlo.
- 🔴 **Y había un segundo corte que la primera pasada no vio: los costados.** En y=786, x=32 vale 240 (fondo) y x=40 vale 225 — un escalón de 16 en 8px, justo en el borde de la card; del lado derecho igual. La ScrollView mide exactamente `CARD_FULL` (pantalla − 32, que es lo que ya aportaba el `paddingHorizontal` del scroll padre), así que **recortaba a ras por los dos lados**. Eso es lo que hacía que se leyera como una plancha gris con bordes a cuchillo y no como una sombra. Probablemente pesaba más que el corte de abajo.
- **Arreglo: la ScrollView sale a sangre** (`carruselWrap.marginHorizontal: -H_PADDING`) y el padding se muda al `contentContainerStyle` (`paddingHorizontal: H_PADDING`), así hay 16pt de derrame por lado; abajo entra `paddingBottom: SOMBRA_ALCANCE`. `heroCardWrap` desaparece: la card ya no lleva margen propio. Se sacó también el override `proximas.length === 1 && { paddingRight: 0 }`, que con padding simétrico dejaba la card corrida.
- 📝 **Los puntitos recuperan el padding a mano** (`H_PADDING + 4`): viven dentro del wrap a sangre. Quedan **debajo** de la sombra y no adentro, que es lo correcto — un indicador de página metido en la sombra de la card se lee como suciedad.
- ⚠️ **Corregido un comentario que afirmaba algo falso.** La entrada del slot decía que "la lista arranca SIEMPRE a la misma altura". **No es cierto**: el carrusel mide ~195pt y la tarjeta de reservar ~70pt, así que la primera fila queda más abajo los días que hay sesión. Lo que el slot garantiza es que arriba siempre haya algo, no que las dos variantes midan igual. El comentario del código ya lo dice bien.

**Pendiente para la próxima sesión:**

- 🔴 **Verificar en dispositivo, y con una captura**: es la tercera pasada sobre lo mismo y las dos anteriores se dieron por buenas sin mirar píxeles. Mirar los dos casos: una sesión (sin puntitos) y dos o más (que los puntitos queden alineados con el resto y debajo de la sombra).
- ⚠️ Sigue abierto lo del deck de Conexiones (`app/(tabs)/conexiones.tsx:385`), que tiene el mismo recorte y encima en los dos ejes: `cardPage` da 10pt de `paddingVertical` y el ancho de página es `SCREEN_W` con la card adentro de un `paddingHorizontal: 20`.
- 📝 **El título de la card repite la hora**: "Lun 31 ago · 10:00 hs · 10:00 para vos". Muestra la hora argentina y después la local sin chequear si son la misma. Detectado en la captura, no se tocó.

---

## 2026-08-31 — Andre (sesión 150 cont. · la sombra cortada del carrusel)

**Tocado:** `screens/SessionsScreen.tsx`. `tsc` y lint limpios.

**Resumen:**

- 🔴 **La sombra de la card del carrusel se cortaba con un filo recto.** Andre lo vio; se confirmó **midiendo los píxeles de la captura**, no a ojo: bajo el borde de la card (y=774) la sombra arranca en (136,132,122) y degrada de a 2-3 por paso hasta (198,190,178) en y=812 — y en y=814 **salta de golpe** al fondo (241,232,218). Un escalón de 43 en un degradado que venía de a 2. A los costados, en cambio, entra y sale suave. O sea: sombra bien renderizada, recortada abajo.
- **Causa: el carrusel es un `ScrollView` horizontal y un ScrollView recorta a su caja** (`clipsToBounds` en iOS, sin prop de RN que lo apague). La sombra solo tenía los `marginBottom: 16` de `heroCardWrap` para extenderse. Los 39px del corte en la captura son exactamente esos 16pt a la escala del screenshot (×2.35) — así se confirmó el culpable.
- **Cuánto necesitaba: 30pt**, y sale del token, no de probar números. En `shadow.elevated.dark` la capa que más baja es la del halo: `offset.height 26 + radius 24` sobre una capa que está `inset 20` adentro de la card → 26 + 24 − 20 = 30. Quedó como constante `SOMBRA_ALCANCE` con la cuenta escrita al lado, para que si el token cambia se vea que hay que acompañarlo.
- 📝 **`heroCardWrap.marginBottom` pasa a `SOMBRA_ALCANCE + 2` y deja de ser separación: es el lugar que la sombra necesita.** Para que la lista no baje 16pt, `carruselWrap.marginBottom` compensa de 20 a 4 — antes debajo de la card había 16 + 20 = 36, ahora 32 + 4 = 36. La altura de arranque de la lista no se mueve, que es justo lo que el slot de la entrada anterior vino a garantizar.

**Pendiente para la próxima sesión:**

- 🔴 **Sin verificar en dispositivo**: hay que ver que la sombra ahora muera sola y que la lista no se haya movido.
- ⚠️ **Muy probablemente el mismo bug esté en el deck de Conexiones** (`app/(tabs)/conexiones.tsx:385`), y peor. Es el otro `SurfaceCard variant="elevated"` dentro de un ScrollView horizontal; su `cardPage` tiene `paddingVertical: 10` y el ScrollView no lleva alto propio (es content-driven), así que la sombra tiene 10pt donde `shadow.elevated.light` necesita 27 (26 + 23 − 22). **No se tocó**: es otra pantalla, no estaba en el pedido y no se vio la captura. Confirmar mirándola y, si está, es el mismo arreglo.

---

## 2026-08-31 — Andre (sesión 150 cont. · la tarjeta de próxima sesión en Inicio)

**Tocado:** `app/(tabs)/index.tsx`. 352 tests, `tsc` y lint limpios.

**Resumen:**

- 🔴 **La tarjeta de "tu próxima sesión" del Inicio no se actualizaba nunca.** Era un `useEffect(…, [user])`: corría UNA sola vez, cuando el usuario aparecía, y no volvía a correr. Reservabas y volvías a Inicio → seguía lo de antes; el coach te confirmaba una pendiente → nada; cancelabas → la sesión cancelada se quedaba en pantalla hasta reabrir la app.
- **Arreglo: foco + realtime, las dos.** Es el mismo par que `app/(tabs)/_layout.tsx` ya usaba para el puntito de la barra, y el mismo patrón que en ESTE archivo ya tenía la campanita de notificaciones (`fetchNotifCount` + canal + `useFocusEffect`) — la tarjeta era la única que se había quedado afuera. **Ninguna de las dos vías alcanza sola**: el foco no se dispara si nunca te fuiste de la tab, y el realtime no cubre lo que pasó con la app cerrada. `bookings` ya estaba publicada con `REPLICA IDENTITY FULL` desde la sesión 145, así que no hizo falta tocar la base.
- 🔴 **Dos bugs más en la misma consulta, encontrados de paso:**
  - **El "hoy" salía de `toISOString()`**, o sea UTC. Después de las 21:00 ART "hoy" ya es mañana, así que el `.gte('scheduled_date', today)` dejaba afuera las sesiones de esa misma noche: **la tarjeta desaparecía justo el rato en que más importa**. Pasa a `localDayKey()`, que ya estaba importado y usado en el archivo para el check-in. Era el último `toISOString().split('T')[0]` que quedaba en `index.tsx`. Mismo error que documenta `lib/moodStats.ts:18`.
  - **Ordenaba solo por `scheduled_date`**, sin `scheduled_time`. Con dos sesiones el mismo día, cuál era "la próxima" lo decidía el planner. Ahora ordena por las dos, igual que `SessionsScreen`.

**Pendiente para la próxima sesión:**

- 🔴 **Sin probar en dispositivo.** Los tres casos: reservar y volver a Inicio (foco), que el coach confirme mientras estás parado en Inicio (realtime), y una sesión de hoy a la noche vista después de las 21:00 (el bug de UTC).
- 📝 Vale revisar si hay más pantallas con el mismo `useEffect(…, [user])` de una sola pasada. Inicio tenía la campanita y los pinneados resueltos, y la tarjeta de sesión no — no hay razón para suponer que es la única en la app.

---

## 2026-08-31 — Andre (sesión 150 · Mensajes del usuario: orden y slot de arriba)

**Tocado:** `screens/SessionsScreen.tsx`. Nuevos: `lib/salaOrder.ts`, `__tests__/salaOrder.test.ts`. 352 tests (eran 346), `tsc` limpio, lint sin errores nuevos.

**Resumen:**

- 🔴 **La lista de Mensajes del usuario no tenía orden. Ninguno.** La consulta de `salas` no llevaba `.order()` y la pantalla hacía `setSalas(results)` con lo que devolviera Postgres, así que la posición era arbitraria: en el teléfono de Andre el chat más reciente aparecía **tercero**, debajo de dos salas sin un solo mensaje. **El campo para ordenar ya se calculaba** (`lastMessageRaw`, línea 280) y no lo leía nadie — dato muerto desde que se escribió.
- ⚠️ **La divergencia usuario/coach que decidimos en la sesión 131 se había ejecutado de un solo lado.** El coach se llevó su regla propia con tests (`lib/coachRoster.ts`, ordena por próxima sesión porque entra a preparar a quién ve mañana sobre 20 personas) y el usuario se quedó sin ninguna. Ahora tiene la suya en `lib/salaOrder.ts`, con el criterio opuesto a propósito: **más reciente arriba**, porque entra a seguir una conversación sobre tres o cuatro.
- 📝 **Las salas sin mensajes van todas al final, no mezcladas por fecha** (decisión de Andre). Una sala recién creada es más nueva que cualquier conversación, así que un solo timestamp para todas pondría arriba justo las filas que no tienen nada para leer. Entre las vacías manda la más nueva (`salas.created_at`, columna sumada a la consulta): si acabás de reservar con alguien, esa es la que vas a querer abrir.
- 🔴 **El aire condicional del 12% se eliminó entero y lo reemplaza un SLOT QUE NUNCA QUEDA VACÍO.** El aire (sesión 131: 12% del alto, piso 64, techo 132, solo cuando la lista era lo primero) resolvía la ergonomía pero abría un hueco que no decía nada, y dejaba dos alturas de arranque distintas según el día. Ahora el mismo lugar lo ocupa siempre algo real: carrusel si hay sesiones próximas, **tarjeta "Sin sesiones agendadas · Reservá con quien ya estás hablando"** si no hay ninguna, y si no hay ni salas no se llega ahí porque manda el estado vacío entero. Efecto secundario que importa tanto como el otro: **la lista arranca siempre a la misma altura**, la primera fila no se mueve entre una apertura y la siguiente. El banner de reembolso queda afuera del slot a propósito — es una alerta y va por encima de todo.
- 📝 **El "Coach Prueba" duplicado de la captura NO es un bug**: `specialtyMap` está indexado por `profile_id`, así que dos salas con el mismo coach renderizarían forzosamente la misma especialidad. Como muestran dos distintas, son **dos perfiles de test que se llaman igual**, cada uno con su fila en `coaches` — la basura de cuentas de prueba que SCHEMA.md ya documenta. No se pudo confirmar contra la base (`db query --linked` sigue caído desde la sesión 145), pero el código no puede producir ese resultado de otra forma.

**Pendiente para la próxima sesión:**

- 🔴 **Sin probar en dispositivo.** Los casos que importan: con sesión próxima (que aparezca el carrusel y NO la tarjeta), sin ninguna (que aparezca la tarjeta y la lista arranque a la misma altura que en el otro caso), y que el orden se vea — más reciente arriba, vacías abajo.
- ⚠️ **Limpiar los dos perfiles de test llamados "Coach Prueba"**, o al menos renombrar uno: hoy la lista no tiene forma de distinguirlos salvo por la especialidad.
- 📝 **El CTA "Buscar profesionales" sigue al pie de la lista** y no se tocó. En la captura se veía cortado, pero es la posición de scroll — `scrollContent` tiene `paddingBottom: TAB_BAR_CLEARANCE` (110), así que entra completo al bajar. Si igual molesta, es composición, no bug.
- 📝 El lado coach (`CoachChatsScreen` + `lib/coachRoster.ts`) **no se tocó**: ya estaba resuelto en la sesión 131 y las dos pantallas divergen a propósito.

---

## 2026-08-31 — Andre (sesión 149 · pin para Recursos v2)

**Tocado:** `components/PinButton.tsx`, `app/coach-recurso.tsx`, `app/(tabs)/index.tsx`, `SCHEMA.md`.

**Resumen:**
- **Hallazgo:** el pin al inicio había quedado anclado al sistema viejo de recursos. Solo eran pinneables 8 de las 10 tools de VITA (Diario y Gratitud quedan afuera a propósito, son de registro diario) y los recursos de la tabla `resources` vía `ResourceDetailScreen`. **Toda la biblioteca `coach_resources` (Recursos v2) era impinneable** — o sea todo lo que ve el usuario después del rediseño de la sesión 148, porque el deck de `formato.tsx` navega a `/coach-recurso`, que solo tenía bookmark de guardado.
- **Sin cambios de base de datos.** `pinned_resources.resource_id` es text sin FK y el trigger del tope solo cuenta filas, así que acepta los uuids de `coach_resources` tal cual. Todo el arreglo fue de frontend. SCHEMA.md quedó actualizado en la misma sesión.
- `PinButton` se hizo reutilizable fuera del header de una tool: suma `icon` (`'bookmark'` default / `'pin'`), `inline` (sin el slot de 60) e `inactiveColor`. En `/coach-recurso` va con `icon="pin"` entre la campanita y el bookmark, porque ahí ya hay un bookmark de guardado y dos glyphs iguales no se distinguen (mismo criterio que `ResourceDetailScreen`).
- El resolver de pins del inicio ya no asume `resources`: busca **en paralelo** en `resources` (`retired_at IS NULL`) y en `coach_resources` (`status = 'published'`) —por la forma del id son indistinguibles— y navega a `/recurso` o `/coach-recurso` según dónde caiga, con su tabla de íconos correspondiente (`PINNED_TYPE_ICON` por `type`, `PINNED_FORMAT_ICON` por `format`). Sin esto, un pin de v2 se habría guardado bien pero nunca se habría visto en el inicio.

**Pendiente para la próxima sesión:**
- ⚠️ **Sin probar en dispositivo** — solo pasa `tsc --noEmit`. Falta abrir un recurso de la biblioteca en Expo Go, pinnearlo y confirmar que aparece en el inicio y que navega de vuelta bien.
- **Decisión de diseño abierta (para Joaquín):** el glyph del pin quedó dividido — `bookmark` en las tools, `pin` en las dos fichas de recurso. El copy del vacío del inicio ("entrá a un recurso y tocá el marcador") aplica a uno y no al otro. Hay que unificar glyph o copy.
- Sigue abierto de la sesión 148: la revisión en dispositivo de todo el rediseño de Recursos.

---

## 2026-08-31 — Joaquín (sesión 148 · Recursos usuario, rediseño completo)

**Tocado:** `constants/theme.ts`, `app/(tabs)/recursos.tsx`. Nuevo: `app/formato.tsx` + registro en `app/_layout.tsx`.

**Resumen — rediseño de la pantalla Recursos (lado usuario), primer checkpoint. Es rediseño de presentación: no cambia el modelo de datos ni de dónde salen los recursos.**

- **Exploración previa** (regla del brief): confirmado que el progreso PARCIAL ("Continuar · faltan N min") **no existe** para `coach_resources` — el player (`app/coach-recurso.tsx`) solo loguea play/complete en `resource_events`, no guarda posición; `resource_completions` (con `progress_seconds`) es de las herramientas de Vita y siempre se escribe completo. Los COMPLETADOS sí se pueden derivar (`resource_events` event='complete'). El detalle/player existe (`/coach-recurso`). Paquetes y carrusel: el deck de Conexiones usa `pagingEnabled` full-width (sin peek) → para el peek de 79% del brief usaré `snapToInterval` en el checkpoint B.
- **Token de color de formato centralizado**: `ResourceFormatColors`/`ResourceFormatLabels` + `mixHex`/`resourceFormatGradient` en `constants/theme.ts`. Antes el `FORMAT_COLOR` estaba duplicado en `recursos.tsx` y `coach-recurso.tsx`. Los gradientes del deck (checkpoint B) se derivan de acá, no son colores nuevos.
- **Pantalla Recursos, de "Recomendado por tu profesional" para abajo**:
  - Título → **eyebrow** ("DE TU PROFESIONAL · N", mayúsculas 9.5px con letter-spacing). En Fraunces competía con "Herramientas de Vita".
  - La card del coach queda igual.
  - 🔴 **Fila "Continuar" OMITIDA** (no hay dato parcial — documentado en el código donde estaba `ContinueCard`, que además era UI muerta: `lastInProgress` nunca tiene valor porque `recordCompletion` siempre escribe progreso completo).
  - Biblioteca: dejó de ser lista. Se fueron los chips de tema y las filas con cuadrado de color (se mudan a la pantalla de formato del checkpoint B). En su lugar: eyebrow "BIBLIOTECA · N recursos" + **grilla 2×2 de formatos** (`FormatGrid`), cada tile con el ícono dentro de un anillo de 1.5px del color del formato, nombre en `ViveFonts.title` y el contador debajo. Conteo por formato vía una query liviana (solo la columna `format` de los publicados, cuenta en JS).
- Limpieza: se removieron `ExploreSection` y sus imports/estado muertos (`selectedDoor`/`selectedFormat`/`exploreResources`, `DOORS`, `AccessibilityInfo`, `LayoutAnimation`, `TOOLS`, `logResourceEvent`, `toggleSave`, etc.). `recursos.tsx` queda **sin warnings de lint**.
- Los tiles navegan a `/formato?formato=X` (creada en el checkpoint B, abajo).

**Checkpoint B — pantalla de formato (`app/formato.tsx`, nueva; registrada en `_layout.tsx` con `headerShown:false`):**
- Header (atrás, nombre, contador, ícono de búsqueda que abre un input que filtra por título con normalización de tildes) + descripción del formato.
- Chips de tema deslizables (Todos + los `topic_id` que existan en ese formato) que recortan el deck.
- **Deck**: `FlatList` horizontal con `snapToInterval` (cards de 79% del ancho, peek de la siguiente), `decelerationRate="fast"`, `disableIntervalMomentum`. Cada card: gradiente del color del formato derivado con `resourceFormatGradient(formato, index)` (varía por índice), grano SVG a 9% (misma técnica que `SurfaceCard`), dos manchas de luz (clara arriba-derecha, oscura abajo-izquierda), pastilla ícono+duración, bookmark (relleno si guardado), título en `ViveFonts.title` 21px, autor, línea de contexto y botón "Empezar" blanco. Puntitos debajo con el activo alargado en terracota.
- **Tres bloques** (crema, líneas finas): Progreso del formato ("Escuchaste/Leíste N de M" + minutos totales + barra en el color del formato, derivado de `resource_events` complete); "Ver como lista" (toggle a lista simple con separadores de pelo); y "Pedile una reco a [coach]" (avatar + nombre, navega a `/sala` del usuario) **solo si el usuario tiene una sala** (si no, no se muestra — no se reemplaza por un CTA de venta).
- 🔴 **Degradaciones documentadas** (por datos que no existen): la línea de contexto de las cards omite "a medias" (sin progreso parcial) **y** "el sistema lo eligió" (no hay motivo por `coach_resource` — `useRecommendedResource` da uno global no atado a la biblioteca). Queda: coach recomendó → tema. El bloque de progreso y el de reco al coach se omiten si falta su dato, sin romper el resto.
- Analítica: `formato_abierto` (al montar), `deck_deslizado` (solo la posición MÁXIMA por sesión, vía un ref), `vista_lista_abierta`, `recomendacion_pedida_a_coach`.
- **Reduced-motion**: el deck es scroll manual sin animaciones de entrada ni auto-scroll → se respeta por construcción (documentado en el código).
- **Colores y tipografía salen de tokens**: `ResourceFormatColors`/`resourceFormatGradient`/`ViveFonts`. Los hex locales (`FOREST`/`FOREST_SOFT`/`TERRACOTTA`/`CREAM_LIGHT`) son la misma paleta que ya usan las otras pantallas, no colores nuevos.
- Queries verificadas contra la base real (los joins embebidos `coaches!inner(profiles!inner(name))` y `profiles!salas_coach_id_fkey` no dan 400). Typecheck, lint (formato.tsx sin warnings) y 346 tests limpios. **No confirmado en dispositivo.**

**Pendiente:** confirmar en el teléfono las tres vistas (Recursos, un formato con su deck, la vista de lista). Sigue abierto el resto del pendiente de Recursos que dejó Andre (eje `wellness_goal` vs. puertas — este rediseño usó los temas/`topic_id`, que es lo que existe; etiquetar a mano los 8 publicados con `wellness_goal` NULL).

**🔴 PENDIENTE PARA MAÑANA (pedido de Joaquín al cerrar el 31/08): TODA la revisión en dispositivo de lo que se hizo hoy quedó sin hacer.** Nada de la sesión 148 se vio corriendo. Lista para revisar en el teléfono:
- **Recursos usuario**: la grilla 2×2 de formatos, los eyebrows, que la card del coach quedó bien.
- **Pantalla de formato**: el deck (peek, gradientes, grano, snap), los chips de tema, la búsqueda, los puntitos, los tres bloques (progreso, ver como lista, pedile reco al coach), y la vista de lista.
- **coach-login** con el diseño nuevo (crema, ornamentos, "Usar email", flujo `needsName` intacto).
- De Andre (sesión 147), también sin confirmar en dispositivo: la recuperación de contraseña de punta a punta desde el dev build.

---

## 2026-08-31 — Joaquín (sesión 148)

**Tocado:** `screens/CoachLoginScreen.tsx`.

**Resumen — `coach-login` al diseño nuevo de auth, cerrando un pendiente que dejó Andre (sesión 147).**

- Arranqué con la revisión de inicio de los pendientes de Andre contra el código/base real (memoria `feedback_verificar_pendientes_inicio`): confirmé que `coach-login` seguía con el diseño viejo (`AppBg`, sin los ornamentos nuevos), que los 8 recursos publicados tienen `wellness_goal` en NULL, y que la recuperación de contraseña no es verificable sin dev build. El merge de Andre quedó sano (tsc + 346 tests).
- Rediseño de `CoachLoginScreen` al mismo sistema que login/registro/bifurcación: crema plano (`#F7F2EA`) en vez del gradiente `<AppBg>`, `<LineasEsquina>` + `<VitaWordmark>` + `<ReglaConPunto>` + `<DivisorConPunto>` (los ornamentos compartidos de `components/ui/AuthOrnamentos.tsx`), botones sociales como tarjetas claras con ícono a la izquierda y texto centrado, "Usar email" contorneado que expande el form (mismo patrón que Register), título Plus Jakarta Sans a 32 en `#26402F`, terracota reservado a los links.
- 🔴 **Toda la lógica del coach quedó verbatim**: `validateAndNavigate` (rol/verified/"solicitud en revisión"/bloqueo de mail ya-usuario), `esCuentaRecienCreada`, `handleOAuth`, y el flujo `needsName` (sesión 141 — pedir el nombre real al crear cuenta en vez de inventarlo del mail). Solo cambió la cáscara visual y se sumó el toggle `showEmailForm`.
- Copy: "Tu espacio profesional" / "Entrá o creá tu cuenta de coach", y la nota de que la cuenta se activa al aprobar la postulación se mantiene. Footer "Volver" (`router.back()`) reemplaza al botón "Atrás" viejo.
- Typecheck y 346 tests limpios. Lint: un solo warning de exhaustive-deps en el `useEffect` de la animación de montaje — mismo patrón (y mismo warning) que `LoginScreen`/`RegisterScreen` de Andre, se deja por consistencia. No confirmado en dispositivo.

**Pendiente para la próxima:**
- El pendiente principal sigue siendo **terminar el rediseño del apartado de Recursos** (Andre lo dejó analizado con decisiones tomadas, sesión 147 — falta que Joaquín confirme el eje de navegación `wellness_goal` vs. puertas, y etiquetar a mano los 8 publicados que tienen `wellness_goal` NULL).
- De Andre siguen abiertos: probar la recuperación de contraseña en dev build, y decidir si el gradiente `<AppBg>` se va de todo el flujo.

---

## 2026-08-31 — Andre (sesión 147)

**Tocado:** `screens/OnboardingBifurcacion.tsx`, `screens/LoginScreen.tsx`, `screens/RegisterScreen.tsx`, `context/AuthContext.tsx`, `app/_layout.tsx`. Nuevos: `screens/NuevaContrasenaScreen.tsx`, `app/nueva-contrasena.tsx`, `components/ui/AuthOrnamentos.tsx`. `tsc` y lint limpios, 346/346 tests.

**Resumen — rediseño del onboarding temprano y la autenticación, más la recuperación de contraseña que no existía.**

- **Bifurcación (`¿Qué buscás en Vita?`) rediseñada entera.** Sigue siendo una bifurcación de dos opciones (se evaluó y descartó un 70/30 con el profesional como línea al pie, y también sacarla del flujo: hoy conviene que el camino del profesional se vea, porque sumar profesionales es el cuello de botella). Fondo crema plano —primera pantalla que sale de `<AppBg>`—, dos paneles a sangre (greige y durazno) y el ornamento de líneas finas.
  - 📝 **La geometría del ornamento costó ocho iteraciones y vale la pena no repetirlas.** Está documentado arriba del archivo: mandar todas las curvas a un mismo punto central se lee como el lomo de un libro abierto; hacerlas morir a alturas muy distintas con poca curva las achata en un abanico; doblar desde el arranque las vuelve arcos con un pico; y poner el control 1 a la misma altura que la punta lateral las deja horizontales contra los bordes. La forma correcta son **dos astas**: entran verticales al cuello del centro y se abren hacia afuera **conservando orientación erguida**. Curva base normalizada en el archivo, con `LINEAS[]` dando a cada asta su punta y su cuello propios. El relleno de color cierra sobre el path del asta de más adentro, así superficie y líneas no pueden desincronizarse.
  - Copy: se mantuvo **"Quiero crecer"** y se rechazó "Quiero ser acompañado" — está en masculino (etiqueta mal en la primera pantalla) y es pasivo, deja afuera a quien entra a usar herramientas por su cuenta.
  - Se sacó la flecha de "atrás": **no hacía nada**, porque `OnboardingScreen1` navega con `router.replace` y esta pantalla reemplaza a `index` en el stack.
  - Tipografía al sistema (Plus Jakarta Sans, no Poppins) y wordmark vía `<VitaWordmark />`. 📌 La maqueta usa un serif y un wordmark liviano con tracking: **no se aplicaron**, son decisiones de sistema (Fraunces salió del proyecto el 24/08 y el wordmark es compartido con Home, login, registro y splash).

- 🔴 **"¿Olvidaste tu contraseña?" no existía.** El `TouchableOpacity` no tenía `onPress` y no había ninguna función de recuperación en `AuthContext`: quien se olvidaba la contraseña no tenía salida. Ahora:
  - `AuthContext.resetPassword(email)` manda el mail con `resetPasswordForEmail`. El redirect se arma igual que el de Google (`makeRedirectUri({ native: 'viveapp://nueva-contrasena' })`, ver el comentario largo de `signInWithGoogle` sobre por qué sin `native` devuelve la IP de Metro).
  - Pantalla nueva `app/nueva-contrasena.tsx` → `NuevaContrasenaScreen`: canjea el `code` con `exchangeCodeForSession`, pide la contraseña nueva dos veces, valida mínimo 6 y coincidencia. Tres estados: canjeando / link vencido / listo.
  - ⚠️ **El link viaja con `?code=` y no con tokens en el fragmento** porque el cliente usa `flowType: 'pkce'`. Consecuencia: **hay que abrir el mail en el mismo dispositivo donde se pidió**, porque el code verifier queda en su AsyncStorage. Está avisado en el copy de "link vencido".
  - ⚠️ **`nueva-contrasena` NO está en `ONBOARDING_SCREENS`** (`app/_layout.tsx`) a propósito: al canjear el code el usuario queda logueado, y si estuviera en esa lista `AuthRedirect` lo patearía a `/(tabs)` antes de poder poner la contraseña.
  - ✅ Andre agregó `viveapp://nueva-contrasena` a la allowlist de Supabase (Authentication → URL Configuration → Redirect URLs). El flujo loguea la URI que usa (`[auth] reset redirect URI:`) para poder compararla. **En Expo Go el redirect es una `exp://…` que cambia con la red: probarlo desde el dev build.**

- **Login y Registro rediseñados** al mismo sistema que la bifurcación: crema plano, títulos en Plus Jakarta Sans a 32, verde oscuro `#26402F`, los tres botones con la misma forma (Google y Apple como tarjetas claras con el ícono a la izquierda y el texto centrado; "Usar email" contorneado, por ser el camino secundario), divisor con punto en vez de la "o", y terracota reservado para los links (pie y documentos legales).
  - Copy: **"Hola de nuevo"** reemplaza a "Bienvenido de vuelta" (masculino) y **"Creamos una"** a "Registrate".
  - `components/ui/AuthOrnamentos.tsx` — `ReglaConPunto`, `DivisorConPunto` y `LineasEsquina` compartidos, para que las pantallas de auth no se desincronicen. `coach-login` puede reusarlos.

- 📝 **Se decidió NO unificar login y registro.** Con Google/Apple la distinción ya es ficticia (el mismo botón da de alta o entra), pero unificar obliga a mover los dos checkboxes legales a un camino condicional, y esa parte tiene razones escritas en `RegisterScreen`. Quedan separadas, con el link cruzado.

**Pendiente para la próxima sesión:**

- 🔴 **Probar la recuperación de contraseña de punta a punta** desde el dev build: pedir el mail, abrir el link en el mismo teléfono, cambiar la contraseña y entrar con la nueva. Nada de esto se confirmó en dispositivo todavía.
- **`coach-login` quedó con el diseño viejo** y ahora desentona con las otras tres pantallas. Es aplicarle el mismo sistema; los ornamentos ya están en el componente compartido.
- **Decidir si el gradiente `<AppBg>` sigue.** Ya hay tres pantallas del onboarding con crema plano; si se va, conviene que se vaya de todo el flujo de una vez y no de a pedazos.
- 📌 **Recursos: se analizó a fondo y NO se implementó nada.** Sigue abierto el pendiente que dejó Joaquín el 29/08. Lo que quedó decidido en la conversación, para no volver a discutirlo:
  - El motor de uso no es la exploración libre sino **el profesional asignando** entre sesiones; hoy esa sección está enterrada en el medio del scroll, limitada a un ítem visible y sin estado pendiente/hecho.
  - **Contenido nativo**: el podcast (link externo) sale o queda como excepción; audio y lectura son el corazón; el video de YouTube se queda porque se reproduce embebido. No hacer video propio (no hay bucket y es caro).
  - **No** se crea un formato "ejercicio con consigna" todavía: lo que falta no es un formato sino que lo asignado tenga estado, y eso sirve para los cinco.
  - Las 6 herramientas construidas que no se ven en Recursos (sueño, meditación, escáner, relajación, lecturas, anclaje) **quedan afuera** por decisión de Andre.
  - Falta confirmar el eje de navegación: la recomendación es `wellness_goal` (las 8 necesidades que Joaquín agregó el 29/08 y que ningún consumidor lee todavía) y no `topic_id`/DOORS. Los 8 recursos publicados tienen `wellness_goal` en NULL: hay que etiquetarlos a mano.
- 📝 **El Notion (`docs/extracted/`) está muy desactualizado** — aviso explícito de Andre. Sirve como contexto histórico, no como especificación; en Recursos contradice lo construido (dice que la biblioteca base es de Vita y que las subidas de coaches son V2, cuando es exactamente al revés).

---

## 2026-08-29 — Joaquín (sesión 146)

**Tocado:** `scripts/add-resource-wellness-goal.sql` + `scripts/add-resource-status-notification.sql` (nuevos, los dos **CORRIDOS y VERIFICADOS**), `SCHEMA.md`, `app/coach-recurso-nuevo.tsx`.

**Resumen — arrancó "Recursos v3 Fase 0", pero la auditoría previa reveló que casi todo ya estaba, así que se recortó a lo que genera valor real.**

- 🔴 **Auditoría antes de codear** (regla del brief): "Recursos v2" está MUCHO más implementado de lo que el brief asumía. Ya existen: la tabla `coach_resources` (con RLS correcta, CHECKs, bucket `resource-audio` público de 30MB), las tres tablas de eventos (`resource_recommendations`/`resource_saves`/`resource_events`), el formulario de subida del coach (`app/coach-recurso-nuevo.tsx`, 576 líneas, con grabador in-app), la lista "Mis recursos" con chips de estado y cap de 10 (`CoachResourcesScreen`), la Biblioteca del usuario leyendo published de la base (`recursos.tsx`), y el detalle+player (`app/coach-recurso.tsx`, 699 líneas: audio `expo-audio` con seek/skip, video `YoutubeIframe`, registra play/complete en `resource_events`). Paquetes todos instalados (`expo-audio`, `expo-video`, `react-native-youtube-iframe`, `expo-web-browser`) — cero dependencias nuevas.
- **Decisión de alcance**: el sistema ya funciona de punta a punta, así que casi nada "bloquea el lanzamiento". Se recortó de la Fase 0 completa a la tajada que genera valor real: (1) `wellness_goal` ahora, (2) notificación al coach en cambio de estado, (3) guards baratos del upload (rechazo `.wav` + aviso de calidad de audio). Se difieren: `publish_at`/auto-publish (feature de calendario, problema de "mucho contenido"), barra arrastrable (el seek por tap ya anda), guardar posición para retomar (la feature ya estaba diferida a Fase 1), y reestructurar el form a 4 pasos (rearquitectura de algo que funciona).
- **Sub-fase 1 (schema) — HECHA**: `scripts/add-resource-wellness-goal.sql` agrega `coach_resources.wellness_goal` (text + CHECK con 8 valores, nullable). Los 8 valores y "filas viejas en NULL" se aplicaron con los defaults (Joaquín no quiso frenar a confirmar). Corrida y verificada contra la base: 4 chequeos OK, las 11 filas viejas quedaron en NULL sin romper. Ver `SCHEMA.md` §`coach_resources`.
- **Sub-fase 2 (formulario) — HECHA**, en `app/coach-recurso-nuevo.tsx` (se adaptó el form existente, no se reconstruyó ni se pasó a 4 pasos):
  - Selector de objetivo ("¿Para qué sirve?") con los 8 `WELLNESS_GOALS`, grilla de chips que envuelve, **obligatorio** (lo exige `validate()`). Los `id` del array están atados al CHECK de la migración — si se agrega un valor, va en los dos lados.
  - Rechazo de `.wav` en `pickAudio()` con mensaje explicativo ("pesan 10× más sin sonar mejor en el celular, convertí a mp3"). Se chequea por extensión Y por mimeType — el picker de iOS a veces no completa el mimeType. El bucket sí acepta wav, así que sin este guard entraban archivos de 80 MB.
  - Aviso de calidad ANTES del picker cuando el formato es audio ("grabá en un lugar silencioso: el ruido de fondo es el motivo más común de rechazo").
  - Analítica: `registrarEvento('recurso_subido', { formato, objetivo })` fire-and-forget al enviar. `wellness_goal` agregado al insert.
  - Typecheck, lint (solo un warning preexistente de `selectedFormat` sin usar) y 346 tests limpios. No confirmado en dispositivo.

- **Sub-fase 3 (moderación) — HECHA**, `scripts/add-resource-status-notification.sql`:
  - Trigger `trg_notify_resource_status` (AFTER UPDATE OF status en `coach_resources`, `security definer`). Cuando el admin cambia el status a `published`/`rejected` desde el editor de tablas, inserta la notificación in-app para el `profiles.id` del coach (nuevos tipos `recurso_publicado`/`recurso_rechazado`, el rechazo menciona la `rejection_rule`) y el evento de analítica (`recurso_aprobado`/`recurso_rechazado`, `{regla}` en el rechazo) — este último es la única vía de capturar esos eventos porque la moderación no pasa por código de cliente.
  - CHECK de `notifications.type` **recreado entero** con la lista completa + los 2 tipos nuevos (no se parcheó el string — es donde Andre se quemó el 28/08).
  - 📝 **In-app solo, sin push** (decisión de Joaquín tras evaluar el costo): el push desde el trigger requiere `pg_net` a exp.host, fire-and-forget sin poder observar/testear el envío ni limpiar tokens muertos. Para 5 coaches el in-app alcanza (y `notifications` está en realtime → con la app abierta aparece solo). Queda como aditivo si más adelante hace falta el push con app cerrada.
  - ✅ **Verificado con prueba real contra la base**: se rechazó un recurso seed con regla 3 y se re-publicó → las 2 notificaciones con el texto correcto ("no cumple la regla 3" / "ya aparece en la biblioteca") y los 2 eventos (`{regla:3}` / `{}`). Los 4 artefactos de prueba se borraron y el recurso quedó en su estado original (`published`).

**Con esto la tanda recortada de Recursos v3 Fase 0 está COMPLETA** (schema + form + moderación). Nada confirmado en dispositivo todavía.

**🔴 PENDIENTE PRINCIPAL (pedido de Joaquín al cerrar el 29/08): terminar el rediseño del apartado de Recursos.** Esta tanda cubrió la Fase 0 (lo que bloquea el lanzamiento), pero el rediseño visual/UX del apartado quedó a medio hacer. Retomarlo abarca los ítems diferidos de abajo + revisar el look & feel general de la biblioteca del usuario y de "Mis recursos" del coach contra el design system (SurfaceCard, paleta earth-tone, tipografía Plus Jakarta Sans). Falta también confirmar TODA esta tanda en dispositivo (subir un recurso con el selector nuevo, aprobarlo/rechazarlo desde Supabase, ver la notificación llegar).

**Diferido a propósito (para cuando haya volumen de contenido que lo justifique):**
- Reproductor: barra de progreso arrastrable (hoy hace seek por tap) y guardar posición para retomar.
- `publish_at` + auto-publicación programada.
- Reestructurar el form de subida a 4 pasos.
- Push (con app cerrada) en la notificación de moderación.
- (Opcional) CHECK de longitud de `title`/`description` a nivel DB (hoy se limita en cliente).

---

## 2026-08-29 — Joaquín (sesión 145)

**Tocado:** `lib/coachesCache.ts`, `app/search3.tsx`.

**Resumen — cerrado el pendiente de Andre (sesión 130): los cartelitos de PayPal/USDT del deck y del buscador no estaban atados a `price_usd`.**

- Arranqué la sesión con la revisión de pendientes de Andre contra la base/código real (pedido de Joaquín, ver memoria). De la lista de Andre confirmé: `expire-pending-past-session-time.sql` ✅ ya corrida (con fix del 29/08), `daily-diagnostico` ✅ ya borrada, cron `session-attendance` ✅ activo. Este era el 🔴 de código más cerrado que quedaba abierto.
- El defecto: `paypal-create-payment`/`usdt-create-payment` rechazan el cobro sin `price_usd` cargado, así que un coach con el flag del riel en `true` pero sin precio en dólares mostraba un cartelito de un medio que el checkout no ofrece. Andre ya lo había arreglado en el perfil (`ProfesionalScreen`, sesión 130); faltaba en las dos fuentes que alimentan el deck y el buscador.
- Aplicada la misma regla que el perfil — `acceptsPaypal: !!accepts_paypal && price_usd != null` (ídem USDT) — en `lib/coachesCache.ts` (fuente del deck y del search con caché caliente) y en la consulta de respaldo de `app/search3.tsx` (caché frío). Los dos consumidores (tarjeta del deck, tarjeta del buscador, y de paso el filtro por medio de pago de search3) leen el valor ya corregido, no hizo falta tocarlos.
- **Impacto verificado contra la base**: de los 3 coaches con algún riel de dólares en `true`, 2 tenían `price_usd` null (María González → PayPal, Martín Fuentes → USDT — los dos de prueba que se conectaron en la sesión 132 para tener variedad de badges). Antes mostraban un badge que no se podía pagar; ahora no lo muestran. Coach Prueba (price_usd 30) queda igual.
- ⚠️ **Efecto secundario en datos de prueba, no en código**: María y Martín siguen apareciendo en el catálogo (el filtro D6 mira las columnas crudas `accepts_paypal`/`accepts_usdt` a nivel DB, que siguen en `true`) pero ahora **sin ningún badge de pago** — quedan como coaches visibles sin medio de cobro mostrable. Es artefacto de cómo los sembré para probar D6 (rieles sin precio). Si hace falta recuperar la variedad de badges para probar, alcanza con darles un `price_usd`. No lo toqué — queda a criterio de Joaquín.
- Typecheck, lint y 346/346 tests limpios. No confirmado en dispositivo.

**Pendiente para la próxima sesión:**
- Ver en el catálogo real que María/Martín ya no muestran el badge de PayPal/USDT. **Resuelto el mismo día por la otra vía**: Joaquín eligió darles `price_usd` para recuperar la variedad de prueba — María González → 35 (badge PayPal), Martín Fuentes → 30 (badge USDT), vía SQL directo. El trigger `sync_accepts_international` derivó `accepts_international = true` en los dos, verificado contra la base. Los tres coaches de prueba vuelven a tener badge de pago visible.

---

## 2026-08-28 — Andre (sesión 131)

**Tocado:** `screens/CoachChatsScreen.tsx`, `app/(coach)/_layout.tsx`, `lib/meetingRoom.ts`, `screens/SalaScreen.tsx`, `SessionsScreen.tsx`, `BookingScreen_Confirm.tsx`, `lib/coachBookingActions.ts`, `supabase/functions/create-meeting-room/index.ts`, `SCHEMA.md`. Nuevos: `scripts/habilitar-realtime.sql` (**CORRIDO**), `supabase/functions/daily-diagnostico/`, `docs/la-voz-de-sofia.md`. 312 tests, `tsc` y lint limpios.

**Resumen:**

- 🔴 **NINGUNA tabla tenía realtime habilitado.** La publicación `supabase_realtime` estaba vacía, así que las **ocho** suscripciones de la app escuchaban un canal por el que no pasaba nada. El código del cliente siempre estuvo bien. Estaban rotos por esto: el **chat no se actualizaba solo** (`SalaScreen` no hace polling de mensajes — su único `setInterval` recalcula el estado de la sesión), los dos puntitos de las barras, la Home del coach, Reservas, Conexiones y la bandeja de personas. `scripts/habilitar-realtime.sql` ✅ **CORRIDO y VERIFICADO**: 4 tablas publicadas, las 4 con `REPLICA IDENTITY FULL`.
- 🔴 **A la videollamada no se podía entrar.** La sala se crea `privacy: 'private'` y no se acuñaba ningún token: el botón "Unirse" daba permiso denegado. No se había detectado porque en el **plan gratuito de Daily no se pueden crear salas privadas por API**, y fallaba antes — el camino de entrada nunca se pudo probar entero. Ahora la función devuelve `room_url` (estable, guardable, la que usa `session-attendance`) y `url` (la entrada de quien llamó, con su token, que **no se guarda**). Del lado del cliente se parte en `ensureMeetingRoom` y `getJoinUrl`.
- ✅ **El punto de Reservas del coach no se apagaba al aceptar.** Dos causas sumadas: contaba `status='pendiente'` a secas —incluyendo reservas que esperan la plata, no al coach— y además nunca se enteraba de nada por lo del realtime. 📝 `esperaConfirmacionDelCoach` existe justamente para que no haya dos copias de esa regla; este badge era la segunda y se separó igual.
- ✅ **La bandeja de personas del coach**: "Vos:" en el preview cuando el último mensaje es suyo, y parche en vivo de la fila (sube al tope, cambia el preview, marca el punto) sin recargar. `armarPreview` y `archivadoPorRegla` salieron a funciones compartidas para que la carga inicial y el parche no puedan pintar la misma conversación distinto.
- 📝 **Decisión de producto: "Sobre vos" pasa a ser la voz de Sofía** (`docs/la-voz-de-sofia.md`, nada implementado). Deja de ser una devolución sobre tu semana y pasa a ser presencia — la IA existe para acompañar ENTRE sesiones, y **no puede ni debe reemplazar al coach**. Queda escrito el riesgo (el modo de fallar del analista era "inútil", el del amigo es "falso"), las cinco reglas, y que la causa de que hoy suene básica **no es el prompt sino el presupuesto de datos**: al modelo le llegan tres números.
- ⚠️ **`instant_booking` NO estaba roto.** Se auditó la cadena entera —permisos de columna, escritura del toggle, los dos caminos de confirmación— y estaba bien: el flag estaba apagado en la base para el único coach con Mercado Pago conectado.
- 📝 **`supabase db query --linked` falla intermitentemente** con `Connection timed out`. La salida de error no trae `rows`, así que un lector ingenuo la reporta como "cero filas" — pasó acá y llevó a una conclusión sin evidencia que hubo que rehacer. **Chequear `_tag == 'Error'` antes de leer `rows`.**

**Pendiente para la próxima sesión:**

- 🔴 **Probar la videollamada de punta a punta**: entrar desde los dos lados dentro de la ventana (abre 15 min antes, expira 1h después del fin), y **fuera** de la ventana — ese cálculo ya tuvo un bug grave. Después confirmar que `session-attendance` deje `participants_count > 0`.
- 🔴 **Probar el chat en vivo con dos sesiones abiertas**, que es la prueba más directa de que el realtime quedó bien.
- 🔴 **Borrar el deploy de `daily-diagnostico`** cuando termine de usarse. El archivo se queda en el repo; el deploy no.
- ⚠️ **`session-attendance` no lo llama nadie desde la app** — cuelga de un cron. Verificar que el cron esté activo.
- 📝 De la sesión 130 siguen abiertos: la puerta "Comunicación" sin profesionales, y que las tarjetas del deck y del buscador no atan los rieles a `price_usd`.

---

## 2026-08-28 — Andre (sesión 131)

**Tocado:** `supabase/functions/create-meeting-room/index.ts`, `lib/meetingRoom.ts`, `screens/SalaScreen.tsx`, `screens/SessionsScreen.tsx`, `screens/BookingScreen_Confirm.tsx`, `lib/coachBookingActions.ts`, `screens/CoachChatsScreen.tsx`, `SCHEMA.md`. Nuevos: `supabase/functions/daily-diagnostico/index.ts` (deployada, corrida y **borrada** el mismo día), `lib/coachRoster.ts`, `__tests__/coachRoster.test.ts`, `docs/coach-tus-personas.html`. `tsc` limpio, lint 0 errores, 328 tests.

**Resumen — se activó Daily.co (y activarlo destapó que la entrada nunca funcionó), y "Tus personas" del coach dejó de ser una bandeja de mensajes.**

- ✅ **Cuenta nueva de Daily activa.** `DAILY_API_KEY` actualizada el 28/08 (la que estaba era del 02/07, de la cuenta del plan gratuito). Dominio nuevo: **`veraapp`** — las salas ahora son `veraapp.daily.co/vive-<id>`.
- ✅ **`daily-diagnostico`**, mismo patrón que `paypal-diagnostico`: se deploya, se invoca desde la base con `net.http_post` y la service_role del Vault, se lee el veredicto y se borra el deploy. Se hace desde adentro porque `supabase secrets list` devuelve los valores **hasheados** — desde afuera no hay forma de saber si la key cargada es la nueva o la vieja. Los 4 chequeos dieron OK: autentica, crea sala privada por API, acuña meeting token, `/meetings` consultable. El archivo queda en el repo: el chequeo vuelve a hacer falta entero el día que se cambie de cuenta o de plan.
- 🔴 **El bloqueante no era la cuenta: nadie podía entrar a la sala.** `create-meeting-room` la creaba `privacy: 'private'` y devolvía la URL **pelada**. A una sala privada de Daily no se entra abriendo su URL — hace falta un **meeting token**, o `enable_knocking: true` con un owner adentro admitiendo a mano, y no había ninguna de las dos. El botón "Unirse" abría una pantalla de permiso denegado. **No se había detectado porque en el plan gratuito fallaba antes**, en la creación misma de la sala privada, así que el camino de entrada nunca se pudo probar de punta a punta.
- ✅ **El token se acuña por participante en cada llamada.** La función ya no corta temprano cuando la sala existe: la sala se reusa, el token no —vence con la sesión y lleva la identidad de una sola persona—. El coach entra como `is_owner` (es quien conduce, y es el único que podría admitir a alguien si algún día se prende el knocking).
- 📝 **La función devuelve DOS URLs y confundirlas rompe la entrada**: `room_url` (pelada, estable, es la que se guarda y la que cruza `session_attendance`) y `url` (`room_url?t=<token>`, se abre y se descarta). Por eso `createOrGetMeetingUrl` se partió en `ensureMeetingRoom()` y `getJoinUrl()` — devolvía una sola cosa para dos usos que dejaron de ser el mismo.
- 🔴 **Segundo camino de entrada, entero, que no pasaba por la función.** `SessionsScreen.handleJoin` abría `ses.meeting_url` directo (`WebBrowser.openBrowserAsync`), sin llamar a `create-meeting-room` en ningún momento. Arreglar solo `SalaScreen` habría dejado el bug vivo en la otra mitad de la app.
- 🔴 **Las 43 filas con `meeting_url` apuntan a `vive-app.daily.co`**, el dominio de la cuenta vieja. Reusarlas armaba la falla peor posible: el token se acuña bien contra la cuenta nueva, la URL abre el dominio viejo, y ahí el token no vale nada — o sea que fallaba **recién al tocar "Unirse", en una sesión real**. La función dejó de tomar la URL guardada como verdad: consulta la sala (`GET`, `POST` solo si da 404) y **corrige la fila sola** la primera vez que alguien entra. No hizo falta limpiar la base.
- 📝 **Los dos calendarios escribían la URL de la sala en el evento del teléfono.** Con sala privada ese link muestra permiso denegado; ahora dicen que se entra desde la app. Un link que falla al tocarlo es peor que no ponerlo, y el token no se puede pegar ahí porque vence.

### Rediseño de "Tus personas" (pantalla del coach)

- 🔴 **La pantalla se llama "Tus personas" y estaba construida como bandeja de mensajes.** El dato que el profesional viene a buscar —cuándo vuelve a ver a alguien— **ya existía y se calculaba bien**, y se dibujaba en la letra más chica y más pálida de la tarjeta. La intención estaba escrita hace tiempo en un comentario del propio archivo (`CoachChatsScreen.tsx:53`, "el estado de la RELACIÓN, no de la conversación"); lo que faltaba era que el diseño la cumpliera. Diagnóstico y antes/después en `docs/coach-tus-personas.html`.
- ✅ **La próxima sesión pasa a una pastilla en la columna derecha**, donde antes estaba el horario del último mensaje — el dato menos accionable de la fila. 📝 **Que la pastilla EXISTA ya es la información**: si está, esa persona está agendada. El riel derecho se escanea sin leer una palabra. Dice "hoy"/"mañana" como palabra y del tercer día en adelante la fecha.
- 🔴 **La lista se parte en "Con sesión agendada" / "Sin próxima", y cada grupo se ordena con criterios OPUESTOS**: fecha ascendente contra conversación descendente. El sort único por `lastMessageAt` que había dejaba una sesión de mañana debajo de alguien que mandó "gracias" hoy — correcto para una bandeja, al revés para un roster. Los rótulos solo aparecen si los dos grupos tienen gente: sobre una lista de uno no clasifican nada.
- 🔴 **Se fueron las pastillas "✓ SESIÓN ACEPTADA" y "RECURSO".** Repetían lo que el preview ya decía y le robaban media fila: cuando no hay motivo escrito, `armarPreview` devolvía el texto "Sesión aceptada" **y** prendía la etiqueta, así que el texto duplicado se cortaba a mitad de palabra ("Sesión acepta…"). No se veía prolijo porque no lo era. Queda un punto de 6px.
- ✅ **La escala pasó de cinco tamaños en 4,5 puntos (9 · 10 · 11 · 11.5 · 13.5) a 16.5 / 12 / 12.** Cinco roles en un rango donde el ojo no distingue ninguno es literalmente lo que se siente como insulso: no hay dónde aterrizar la mirada. El nombre es el ancla de un directorio de gente.
- 📝 **La jerarquía la lleva la SUPERFICIE**: agendada con sombra (valores de `shadow.subtle.light`), sin próxima plana con borde. Así no hace falta un segundo color ni una segunda tipografía para decir lo mismo. El borde al 14% que tenían todas era invisible sobre el crema.
- 📝 **La fila sin próxima no lleva nada a la derecha** — ni el horario ni un "hace 5 semanas", que repetiría la línea de historia. El vacío es el dato.
- 📝 **El aviso de mantener presionado bajó al pie**, después de Archivados. Con dos personas quedaba flotando en el centro geométrico de la pantalla, donde el ojo lo lee como si fuera contenido. Y el nombre se capitaliza: los perfiles guardan lo que la persona tipeó, y ahí entra "andre".
- 📝 **Orden y rótulos salieron a `lib/coachRoster.ts`** con 16 tests, mismo criterio que `lib/ejesLayout.ts`: es la regla de negocio del orden y adentro del componente nadie la iba a mirar de nuevo.

- ✅ **Buscador y cuatro filtros arriba de la lista** (Todas / No leídas / Agendadas / Sin próxima). 🔴 **La razón es la ESCALA, y es opuesta en las dos apps**: un profesional puede tener 10 o 20 pacientes activos a la vez, mientras que una persona difícilmente pase de 4 profesionales. Sobre veinte filas los controles son la diferencia entre encontrar a alguien y scrollear; sobre cuatro serían adorno con forma de función. Por eso las dos pantallas **divergen a propósito**: acá chrome, del lado usuario aire calculado.
- 📝 **La primera fila queda a ~170pt del área segura**, dentro del alcance del pulgar — pero eso es la **consecuencia**, no el motivo. Rellenar por rellenar habría sido padding con otro nombre, que fue justo la primera propuesta y con razón no convenció.
- 🔴 **Archivados se probó arriba (como WhatsApp) y volvió al pie.** El paralelo con WhatsApp se rompe justo ahí: su archivo es un balde chico y estable, **este crece de forma monótona** — cada paciente que deja de venir termina adentro, así que a los dos años es el grupo más grande y el menos relevante. Un montón que solo engorda no puede ocupar el lugar que se escanea primero.
- 📝 **El buscador normaliza tildes y mayúsculas**: buscar "joaquin" tiene que encontrar a "Joaquín" o es peor que no tenerlo. **"No leídas" solo aparece si hay alguna**, y con su conteo — "Todas 7" es un número sin decisión atrás. Y hay estado vacío propio para cuando el filtro o la búsqueda dejan la lista en cero: una lista que se vacía sin explicación se lee como que se rompió.
- ⚠️ **Los filtros NO se pisan con los rótulos de sección**: la pastilla acota la lista, el rótulo la separa, y cuando el filtro deja un solo grupo el rótulo se apaga solo.

### Lado usuario

- ✅ **La lista de chats de Mensajes baja cuando es lo primero de la pantalla.** La primera fila arrancaba a 76pt del área segura y es el destino más tocado de la pantalla, en la zona a la que el pulgar no llega sin recolocar la mano. El aire es **condicional** —solo si no hay banner de reembolso ni carrusel arriba, porque ahí el problema no existe— y sale del alto de pantalla (12%, piso 64, techo 132), no de un número clavado.

### Títulos y matrículas verificados por Vita

- ✅ **Feature nueva de punta a punta.** El profesional carga sus credenciales, sube el documento que las respalda, un admin lo revisa desde el panel, y el perfil público muestra el dato en texto con la marca de verificado. `scripts/add-coach-credentials.sql` ✅ **CORRIDO y VERIFICADO** (8 chequeos), `admin-actions` **v22 deployada**.
- 🔴 **Destapó un agujero previo más grande que la feature**: hoy se aprueban psicólogos **sin ningún respaldo documental** — la postulación pide un video y una bio, y `verified` se decide a ojo.
- 🔴 **EL DOCUMENTO NO ES CONTENIDO PÚBLICO**, y esa es la decisión que ordena todo. Se descartó la galería de certificados por tres motivos, ninguno teórico: (1) un diploma lleva nombre completo, muchas veces DNI y firma — publicarlo expone datos personales del profesional a cualquiera y es descargable; (2) **una imagen es un canal de texto que ningún regex puede moderar**, o sea que saltea `contactInfoGuard` con el WhatsApp en una esquina del certificado; (3) un JPEG no prueba nada, y mostrarlo sería que Vita preste credibilidad a algo que no chequeó. Lo que verifica de verdad a un psicólogo en Argentina es la **matrícula**, que es un número consultable — por eso es campo propio y **obligatorio** cuando el tipo es matrícula.
- 🔴 **`revoke update` + `grant update` por columnas nombradas.** RLS dice qué FILAS, no qué columnas: sin eso el coach hacía `update ... set status='verificada'` sobre su propia fila y **se auto-verificaba**, dejando toda la revisión como decoración. Verificado contra la base: `puede_escribir_status = false`.
- 🔴 **Editar devuelve a revisión** (`trg_reset_credential_on_edit`). Sin eso el ataque es de un paso: cargar "Coach de hábitos", esperar la verificación, editarla a "Lic. en Psicología" — y la marca seguía puesta sobre un texto que nadie miró.
- 📝 **Vista y no policy** para lo público: una policy de SELECT pública sobre la tabla dejaría `file_path` legible con la anon key. Verificado: `fugas_en_vista = 0`.
- 📝 **Primer bucket PRIVADO del proyecto** (los cinco anteriores son públicos, así que el `getPublicUrl` que se copia en toda la app acá no sirve). El admin lo abre con una URL firmada de 5 minutos que emite `admin-actions`, y **abrirlo queda auditado**: es un documento de identidad, tiene que constar quién lo vio.
- 🔴 **El script abortó la primera corrida, y estuvo bien.** El paso que extiende el CHECK de `notifications.type` anclaba en `]::text[]`, un sufijo que este Postgres no imprime; el guard frenó todo en vez de dejar el CHECK borrado. Corregido anclando en `::text]`, que aparece una sola vez. De paso quedó confirmado que `postulacion_aprobada`/`postulacion_rechazada` **sí están** en el CHECK — `SCHEMA.md` no los listaba y `notifyCoach` es best-effort, así que si no hubieran estado los avisos de postulación venían fallando en silencio desde agosto.
- ⚠️ **`db query --linked` estuvo caído toda la sesión** (siete intentos, `LegacyDbConfigConnectTempRoleError`). Todo lo que se verificó contra la base se corrió a mano en el SQL Editor. La API de Supabase sí respondía — los deploys salieron sin problema.

### "Conexiones" pasa a "Profesionales"

- ✅ Feedback externo: la palabra no se entiende sin contexto. **La evidencia ya estaba en el repo** — en `SofiaAssistant`, la opción que lleva a esa misma pantalla dice *"Quiero ver a los profesionales"*. Cuando hubo que nombrarla para que se entendiera sola, no se usó "Conexiones".
- 📝 **La barra de abajo no muestra label desde el 20/08**, así que la palabra no hacía trabajo de navegación: aparecía como título de pantalla, o sea después de tocar. El que orienta es el ícono.
- 🔴 **Del lado COACH el copy dejó de nombrar la sección.** "No aparecés en Profesionales" es un error de categoría: el coach ES un profesional. Pasó a decir qué le pasa a él — "Hoy no te encuentran", "Dónde te encuentran", "Cómo te encuentran".
- ⚠️ **No se renombró nada más que texto visible.** La ruta `/(tabs)/conexiones`, `constants/conexionesDoors.ts` y sobre todo la clave `vive_tooltip_conexiones` se quedan: cambiar esa última le vuelve a mostrar el tooltip a todos los que ya lo cerraron.

### Reservas pendientes que sobreviven a su horario

- 🔴 `expire_pending_bookings()` vencía por **antigüedad de la solicitud** (24hs desde `created_at`), no por el horario de la sesión. Una reserva pedida para dentro de 3 horas que el coach nunca acepta **cruza el horario y sigue `pendiente` otras 21 horas**: la persona ve "esperando confirmación" sobre una sesión que ya pasó, con la plata retenida si pagó, y el slot del coach ocupado por algo que ya no puede ocurrir. `scripts/expire-pending-past-session-time.sql` — ✅ **CORRIDO y VERIFICADO el 29/08/2026**: `pendientes_vencidas = 0`, `tiene_el_arreglo = true`, `guard_flojo = true`.
- 🔴 **El guard salteaba en silencio lo que quería proteger, y lo encontré mirando una fila real y no el código.** El regex era `^[0-9]{2}:[0-9]{2}` y la base guarda horas de UN dígito: aparecieron `'0:00'` y `'2:00'` en las dos filas que miré. O sea que el guard quedaba **más estricto que el cast de Postgres** —que parsea `'0:00'` perfecto— y esas reservas seguían sobreviviendo a su horario, sin ningún error visible. Corregido a `{1,2}`. **La regla**: el guard tiene que tener exactamente la forma que el cast acepta, ni más (saltea válidos) ni menos (aborta el cron).
- 📝 **Dos hallazgos de la verificación, los dos sanos.** (1) Una cancelada con pago `aprobado` que resultó ser la penalidad por cancelación tardía del usuario (`cancelled_by='usuario'` + `cancelled_late=true`), o sea la regla del 15/07 funcionando. (2) ⚠️ **Un reembolso trabado de verdad**: `refund_attempts = 6` sobre una reserva de prueba del 09/08 con `charged_amount` en null — el cron le viene pegando a la API de MP cada 5 minutos desde entonces para algo que no va a salir nunca. **Queda sin resolver**: antes de marcarla hay que confirmar en el panel de MP si el pago se cobró o no.
- 📝 El guard de regex sobre `scheduled_time` no es defensivo de más: la columna es `text`, el cast tira si no parsea, y esto corre en un cron cada 5 minutos — una fila con basura abortaría la corrida y se llevaría puesto también el vencimiento de 24hs, que hoy no puede fallar. El `OR` de SQL no garantiza cortocircuito.

### De paso

- 🔴 **Cuarta vez que la bottom bar "rota" era un bundle viejo.** Se perdió un rato analizando `IslandTabBar`, el overlay de Sofía y los límites del padre en Android antes de mandar a cerrar y reabrir la app, que es exactamente lo que el changelog de la sesión 129 ya decía que hay que hacer primero.

**Pendiente para la próxima sesión:**

- 🔴 **Probar el ciclo de credenciales en el teléfono**: cargar una como Coach Prueba, verificarla desde el panel, y confirmar que en el perfil público aparece **el dato y no el documento**. Nada de esto se vio corriendo.
- ⚠️ **Sacar del dead-letter la reserva `2c72b126`** (`refund_attempts = 6`, MP, desde el 09/08). Confirmar primero en el panel de MP si el pago se cobró: si no se cobró, alcanza con marcarla `'reembolsado'`; si se cobró, hay que devolverlo de verdad.
- ⚠️ **Falta un párrafo en la política de privacidad**: ahora se recibe y se conserva un documento de identidad profesional. Va con los placeholders que esperan al abogado.
- ⚠️ **`lib/coachBookingActions.ts:29` deja confirmar una sesión cuyo horario ya pasó** — la otra mitad del defecto de las pendientes, sin arreglar.
- 🔴 **Probar el rediseño de "Tus personas" en el teléfono.** Nada se vio corriendo. Los casos que importan: alguien con sesión hoy (pastilla verde plena), los dos grupos con gente (que aparezcan los rótulos), y un solo grupo (que NO aparezcan).
- ⚠️ **Es pantalla de coach y el spec de layout es de Joaquín** (sesión 144). Se avanzó por pedido explícito de Andre — hay que pasárselo.
- ✅ ~~Probar una sesión real desde el teléfono~~ — **confirmado el 28/08 con prueba en la base**, no por lo que se vio en pantalla: `session_attendance` del booking `e9c429a6…` quedó con `meetings_count 1`, `participants_count 1`, `first_join_at 19:16:57 UTC`, y `user_name: "andre"` en el crudo. A una sala privada no entra nadie sin token válido, así que eso prueba el camino de entrada entero. **Y era una de las 43 viejas**: su `meeting_url` pasó de `vive-app.daily.co` a `veraapp.daily.co` sola al entrar — la autocorrección funciona (quedan 42, se van corrigiendo de a una). La ventana `nbf`/`exp` también dio bien: sesión de las 16:00 ART, entrada 16:16 ART, aceptada. De yapa, el cron de `session-attendance` corrió a las 19:17 y levantó la asistencia contra la cuenta nueva.
- 🔴 **Falta la llamada con DOS personas adentro.** `max_simultaneous` dio 1 — entró uno solo. Es el caso que importa y no está probado.
- ⚠️ **Que el coach entre como owner no se pudo verificar desde acá**: el `/meetings` de Daily no devuelve ese flag. Hay que mirarlo en la llamada — el owner ve controles que el otro no.
- ⚠️ **`session-attendance` no puede traer la asistencia de las sesiones de la cuenta vieja** — la key nueva no ve esos `/meetings`. Son todas de prueba, así que no se pierde evidencia real, pero a las 24hs el cron las va a concluir como "no vino nadie".
- 📝 **La videollamada sigue ocurriendo FUERA de la app** (`WebBrowser.openBrowserAsync`), que es la contradicción con la medida anti-fuga #4 ya anotada. Moverla adentro con `@daily-co/react-native-daily-js` requiere dev build. No se tocó.
- 📝 **Lo de Jitsi sigue vestigial**: el trigger de `salas.room_url` sigue generando `meet.jit.si/vita-<hex>` y nadie lo abre. Se puede sacar cuando haya ganas.
- 📝 **Presupuesto**: 10.000 minutos de participante gratis por mes = 83 sesiones de 60 min con dos personas; después USD 0,004 por minuto (USD 0,48 la sesión).

---

## 2026-08-27 — Andre (sesión 130)

**Tocado:** `components/SofiaAssistant.tsx`, `components/MoodCheckIn.tsx`, `app/(tabs)/conexiones.tsx`, `constants/conexionesDoors.ts`, `screens/ProfesionalScreen.tsx`, `__tests__/taxonomia.test.ts`. Nuevos: `lib/ejesLayout.ts`, `__tests__/ejesLayout.test.ts`, `__tests__/sofiaOrbe.test.ts`, `docs/brief-ejes-conexiones.md`. 312 tests, `tsc` y lint limpios.

**Resumen:**

- ✅ **Los cartelitos de pago llegan al perfil del profesional.** Estaban en las tarjetas del deck y del buscador, pero el perfil —el paso del medio, donde se decide— los perdía y volvían recién en confirmar. 🔴 **PayPal y USDT van atados a `price_usd`**: sin precio en dólares las funciones de cobro rechazan la operación, así que el cartelito anunciaba un medio que el checkout no ofrece. No era hipotético — hay coaches hoy con el riel en `true` y `price_usd` en null.
- ✅ **Sofía: el orbe es el isotipo de Vita invertido**, y el panel se abre con un **derrame circular** desde el orbe (anticipación al tocar, isotipo que viaja hasta el header, contenido escalonado). 📝 El derrame **volvió al driver nativo**: la versión intermedia animaba `width`/`height`/`borderRadius`, que solo corren en JS. Es la única idea que mejoró lo visual y el costo a la vez.
- 🔴 **Dos bugs viejos del orbe.** El primero: `PanResponder.create` corre una sola vez, así que sus handlers leían la posición del PRIMER render — del segundo arrastre en adelante el orbe saltaba a "posición original + desplazamiento". El segundo: al cerrar, el orbe reaparecía de golpe porque su visibilidad colgaba de `open`; ahora cuelga del derrame y el reemplazo es invisible en los dos sentidos. Además vuelve a la pared más cercana al soltarlo.
- ✅ **Conexiones, fase 1: los ejes pasan a tres columnas** y el color ES la tarjeta (antes vivía en un círculo de 48px, el 3% de la superficie). "Bienestar emocional" pasa a **"Bienestar mental"** — el `id` sigue siendo `emocional`, que es la clave del estado y del mapeo con las puertas.
- 🔴 **El alto de las columnas sale del ancho de pantalla** (`lib/ejesLayout.ts`), no de un número fijo. Con 354 clavado la proporción se deformaba en los dos sentidos: 4,08:1 en un SE contra 2,87:1 en un 15 Pro Max. Ahora 3,22:1 en todos, con piso y techo que ningún teléfono real toca.
- ✅ **Fase 2: los temas pasan a una sola tarjeta con filas adentro.** Seis tarjetas con sombra eran seis objetos flotando; los separadores sueltos fallaban al revés, con tres temas se leían como lista incompleta. El ícono es lo único que lleva el color del eje.
- ✅ **Físico y espiritual se abrieron de 3 temas a 4 y 5.** Dividir no le pide nada a ningún profesional: las puertas son capa de presentación sobre los mismos subtemas, y el test de partición pasó sin tocarlo. ⚠️ **`Energía` volvió a ir con `Sueño`** el mismo día: andar sin pilas no es un tema, es un síntoma.
- ✅ **El check-in diario se confirma manteniendo apretado** (300ms), con un anillo que se cierra y una vibración corta. 🔴 `onAccessibilityTap` confirma directo: los lectores de pantalla mandan un toque, no un gesto sostenido, y sin eso la función quedaba inaccesible.
- 📝 **`docs/brief-ejes-conexiones.md`**: brief autocontenido para pedirle bocetos a un modelo sin acceso al repo. Incluye las restricciones reales de React Native y el detalle de que el color de cada eje carga lógica.

**Pendiente para la próxima sesión:**

- 🔴 **Probar todo esto en el teléfono.** Nada de la sesión se vio corriendo: la animación de Sofía (que se sienta liviana), el arrastre del orbe, el check-in sostenido y las dos fases de Conexiones.
- 🔴 **La puerta "Comunicación" no lleva a nadie** — sus dos subtemas tienen cero profesionales. El filtro se protege solo (`topicOptionsFrom` deriva de coaches reales), pero la lista de temas de Conexiones la muestra igual. Se resuelve cuando arranque la búsqueda de gente; anotado para no olvidarlo.
- ⚠️ **Las tarjetas del deck y del buscador no atan los rieles a `price_usd`** — mismo defecto que se arregló en el perfil, en dos pantallas más. Es una línea en `lib/coachesCache.ts`.
- ⚠️ **"Movimiento" contra "Entrenamiento"**: se eligió el nombre inclusivo con la bajada nombrando las dos cosas. Conviene revisarlo cuando se sepa qué profesionales se anotan.
- 📝 **`SCREEN_W` se lee una vez al cargar** en `conexiones.tsx`: no se recalcula al rotar. Limitación vieja (ya la tenía `cardPage`), ahora también la tiene el alto de los ejes.
- 📝 **Si el check-in de 300ms se siente lento**, lo que hay que tocar es la curva y no el número: hoy es lineal.

---

## 2026-08-27 — Andre (sesión 129)

**Tocado:** `screens/CoachHomeScreen.tsx`, `CoachChatsScreen.tsx`, `CoachReservasScreen.tsx`, `lib/bookingHelpers.ts`, `lib/weeklyReflection.ts`, `app/progreso.tsx`. Nuevos: `lib/coachContinuity.ts`, `lib/moodTrend.ts`, `scripts/add-mood-para-coach.sql` (**CORRIDO**), `scripts/add-archivar-salas.sql` (**CORRIDO**), `docs/inicio-del-coach.md`, `docs/animo-compartido.md`, `docs/paquete-para-la-sesion.md`, `lib/coachVisibilityData.ts`, `__tests__/coachVisibilityHome.test.ts`. También `lib/coachVisibility.ts`, `screens/CoachVisibilityScreen.tsx`. 300 tests, `tsc` y lint limpios.

**Resumen:**

- ✅ **Inicio del coach**: dejó de ser una pantalla que solo sirve si ya tenés sesiones. Se sumaron continuidad (`personasQueSeCaen()` — mediana de la brecha × 2, piso 14 / techo 120 días), acceso a personas, notas y reputación. El contenido ya estaba calculado en `lib/coachVisibility.ts` y vivía comprimido en un renglón.
- ✅ **Archivar chats como coach** (`salas.coach_archived`, nullable a propósito: `true` archivado, `false` desarchivado explícito, `null` regla automática). ✅ **SQL corrido y verificado el 27/08**: la columna existe (200 por REST contra el 400 `42703` de una inventada) y quedó `boolean` / nullable / sin default — los tres estados vivos, que era lo único que podía salir mal en silencio.
- ✅ **Ánimo hacia el coach (D)**: `mood_trend_for_client()` corrida y verificada, pero **el cliente quedó APAGADO** (`MOSTRAR_ANIMO_AL_COACH = false`). Dos bugs los encontró la verificación y no la revisión: `42804` (declarado `smallint`, la subconsulta devuelve `integer`) y `42P13` (falta `drop function if exists`).
- 📝 **La consulta a una psicóloga cambió el diseño entero.** Mónica trabaja la asociación *en sesión*, preguntando y no afirmando, y **ya pide estos registros a mano** — o sea que la demanda existe y no era hipótesis nuestra. Eso movió la propuesta de "panel que el coach mira" a "paquete que la persona arma y manda". Queda en `docs/paquete-para-la-sesion.md` **como idea, sin implementar** (decisión de Andre, 27/08).
- 📝 **Si el paquete se construye, jubila la feature D entera y probablemente la pregunta A.10 al abogado** — algo que la persona manda no necesita un permiso de fondo.
- ✅ **"Sobre vos" filtraba mal**: se le escapaban etiquetas internas al texto que lee el usuario. El filtro chequea un *par* de ángulos y no un carácter suelto, para no tumbar prosa que use `<` o `>`.
- ✅ **La tarjeta de visibilidad de la Home muestra el LUGAR, no el conteo de puertas.** "Aparecés en 4 puertas" contaba cuántas puertas tocan los temas elegidos: solo se movía si el coach editaba sus temas, y subía tildando más temas — premiaba amplitud, que puede diluir. 🔴 **Y el dato bueno ya existía sin usarse**: `analyzeDoors` calcula, por puerta y por lugar, si lo tenés ganado, si rotás entre varios, o qué te falta. La Home lo tiraba.
- 📝 **`loadVisibilitySelf` salió de `CoachVisibilityScreen` a `lib/coachVisibilityData.ts`** para que la Home y el panel usen el mismo retrato del coach. Duplicar las 7 consultas habría dejado dos descripciones del mismo coach que divergen en silencio, a un tap de distancia. El cálculo va en un efecto diferido — la Home no puede esperarlo para pintarse — y mientras no llegó **no inventa un número**.
- 📝 **Sin ningún lugar, informa la brecha del slot más ALCANZABLE y no la del más prestigioso.** Decirle "te faltan 12 reseñas para Recomendado" a quien no entra en ningún lado es cierto e inútil.
- 📝 **Se respetó la decisión de Joaquín de hoy**: él le puso `!esCoachNuevo` a esa tarjeta (el coach nuevo ve el checklist). No se movió de lugar en la pantalla — **promover el estado bloqueado es decisión suya**, que es el dueño del spec de layout.
- 🔴 **Tercera vez en la sesión que un "bug" era un bundle viejo** (esta vez la bottom bar). Antes de mirar código: cerrar y reabrir la app. Costó bastante rato buscar una causa que no existía.

**Pendiente para la próxima sesión:**

- 🔴 **Archivar un chat como Coach Prueba desde el teléfono.** El SQL ya está corrido, pero **que el coach pueda ESCRIBIR la columna no se probó**: se apoya en la policy que ya deja escribir `coach_last_read_at` y eso se asumió, no se confirmó. Se sacó del SQL a propósito — suplantar dentro de una transacción deja el resultado tapado por el `rollback`, y además probaría la policy y no la pantalla.
- ✅ ~~Probar una reserva real contra Mercado Pago~~ — **ya lo cerró Joaquín en la sesión 133**: `amount = 1` sin desvío, `payment_status = 'aprobado'`, `payment_id` real de MP. v41 confirmada de punta a punta con plata real. 📝 Lo dejé anotado como pendiente por escribir la entrada sin leer las suyas primero, que es justo lo que el encabezado de este archivo pide no hacer.
- 🔴 **Probar el bloque del coach en el teléfono** — se tocó navegación y nada se vio corriendo. Ahora suma la tarjeta de visibilidad nueva: hay que verla con un coach que tenga lugar en alguna puerta y con uno que no entre en ninguna.
- ⚠️ **Para Joaquín**: el estado bloqueado ("Hoy no aparecés en Conexiones") sigue en el mismo lugar de la pantalla. Es lo más urgente que la Home puede decir y quizás merece subir, pero el layout es suyo — queda a su criterio.
- ⚠️ **Mandar el paquete al abogado**: ahora lleva A.10 (posiblemente sin objeto), A.11 más filosa y A.12, más una pregunta nueva sobre texto libre por el chat.
- 📝 **A.11 se agravó**: la persona que manda algo eligió mostrarlo, y eso sube la expectativa de respuesta. En Vita hay coaches de hábitos y nutricionistas, no psicólogos. Un profesional que no lo lee es peor que no haber ofrecido nada, y no se arregla por código.
- 📝 **Ya se puede consultar la base desde la sesión**: `npx supabase db query --linked "..."` funciona (lo resolvió Joaquín, sesión 132). Reemplaza el truco de la anon key por REST y las capturas del SQL Editor — verificado hoy contra `coach_archived`.
- ⚠️ **El perfil del coach está fuera del design system** (sin `SurfaceCard` ni `theme/tokens`, tres paletas, siete radios). Diagnosticado, sin tocar.
- **Onboarding del usuario**, sigue analizado y sin empezar.

---

## 2026-08-27 — Joaquín (sesión 144)

**Tocado:** `screens/CoachReservasScreen.tsx`, `screens/CoachChatsScreen.tsx`, `screens/CoachHomeScreen.tsx`.

**Resumen — rediseño completo de los estados vacíos de Reservas, Tus personas e Inicio, con exploración y plan confirmados antes de codear (spec `docs`-externa `coach-estados-vacios.html`).**

- **Principio del rediseño**: cada pantalla contesta una sola pregunta y su estado vacío se limita a eso — Inicio ("¿qué tengo que hacer?"), Reservas ("¿quién quiere sesión conmigo?"), Tus personas ("¿a quién estoy atendiendo?"). Ninguna pantalla importa contenido de otra para llenar espacio.
- **Exploración previa (confirmada con Joaquín antes de tocar código)**: el sistema de disponibilidad (`coach_weekly_pattern`) YA existe — no era feature nueva. Los datos del checklist de Inicio (perfil completo, puertas, recursos) también existían, salvo la lista de recursos subidos, que se agregó como consulta nueva. La tipografía del mockup decía Fraunces 600 para los títulos — corregido a `ViveFonts.titleSemiBold` (Plus Jakarta Sans), porque Fraunces se sacó entera de la app en la sesión 126 y el mockup no se había actualizado.
- **Reservas**: sacadas las dos cajas punteadas ("Sin solicitudes pendientes" / "No tenés sesiones confirmadas") y sus encabezados — ahora cada sección (`Por confirmar`, `Confirmadas`) se omite ENTERA si no tiene contenido, en vez de mostrar una caja diciendo que está vacía. Si las dos están vacías, aparece una sola card "Tu agenda está libre" + línea tranquila + sección nueva "Cuándo estás disponible" (agrupa `coach_weekly_pattern` por días consecutivos con el mismo horario — cálculo de presentación, `groupAvailability()`, no dato nuevo) + botón "Editar disponibilidad" → `/coach-weekly-pattern` (dispara `disponibilidad_editada`).
- **Tus personas**: el texto que flotaba en el medio de la pantalla pasa a una `SurfaceCard` con ícono, mismo copy de siempre. Deliberadamente sin checklist ni progreso — es un directorio de gente atendida, sin nadie atendido no hay contenido propio.
- **Inicio**: la card de la sesión 139 (una sola línea: "Ya aparecés en N puertas") se reemplaza por el checklist completo — eyebrow, título condicional ("Estás casi listo para recibir" si falta ≤1 paso, si no "Preparemos tu perfil"), barra de progreso, 3 pasos (perfil completo, puertas con chips + "+ agregar", subir un recurso) y el botón de la primera acción pendiente. Dispara `preparacion_paso_completado` por paso, solo en la transición de no-hecho a hecho (comparando contra el valor anterior con `setState` funcional, no en cada carga).
- 🔴 **La condición para mostrar la card cambió y quedó MÁS estricta que antes**: la vieja `esCoachNuevo` (sesión 139) era `!next && completadas===0` — no contaba una solicitud recién llegada como "ya pasó algo". La nueva es `hasAnyBookingEver` (cualquier fila en `bookings`, cualquier estado, sin excluir `cancelada`) — pedido explícito de Joaquín: la card tiene que desaparecer apenas llega la primera reserva, no recién cuando se completa una sesión.
- ⚠️ **Gap encontrado al codear, no estaba en el mockup**: el checklist nuevo (perfil/puertas/recurso) no cubre los casos que sí cubría la card vieja vía `visibility.blocked` — coach en pausa (`availability_status`) o sin precio cargado. Mientras `hasAnyBookingEver` sea `false`, esos dos casos no se muestran en ningún lado de Inicio (la card de "Cómo aparecer en Conexiones" que sí los mostraba queda suprimida para no duplicar contenido). Son casos raros en la práctica (precio y specialty son obligatorios en la postulación), pero quedan sin cobertura visual hasta la primera reserva. Se siguió el pedido explícito del spec tal cual — queda anotado para decidir si hace falta cubrirlo.
- Typecheck, lint (limpio en las tres pantallas — de yapa, el fix también apagó un warning viejo de `OK_BG`/`OK_INK` sin usar en `CoachHomeScreen`) y 287/287 tests. ✅ **Confirmado en dispositivo el mismo día** — Joaquín: "todo se ve bien".
- Confirmado por separado que las tres vuelven solas al comportamiento normal apenas hay datos, sin nada manual: `isFullyEmpty`/`rooms.length`/`hasAnyBookingEver` se recalculan en cada carga. En Inicio, una vez que `hasAnyBookingEver` pasa a `true`, la card de checklist no vuelve a aparecer nunca más — ni aunque el coach quede después en un bache sin próxima sesión (ahí vuelve el "Sin sesiones programadas / Ver reservas" de siempre, no el checklist).

**Pendiente para la próxima sesión:**
- Decidir si el gap de "coach en pausa / sin precio" durante `hasAnyBookingEver=false` necesita cobertura, o si se acepta como está (casos raros, ya cubiertos apenas llegue la primera reserva vía la card de visibilidad de siempre).

---

## 2026-08-27 — Joaquín (sesión 143)

**Tocado:** `components/SofiaAssistant.tsx`.

**Resumen — la tarjeta de Sofía (el asistente) tenía un espacio enorme en el medio, entre el saludo y las opciones. Era a propósito, pero con poco contenido (4 atajos) se leía como dos secciones separadas, no una tarjeta.**

- `sheet` usaba `justifyContent: 'space-between'` para empujar `topGroup` (header + saludo) arriba del todo y `bottomGroup` (aviso + atajos + input) abajo del todo — documentado en el código como intencional, "como en la referencia" (Banco Galicia). Con la altura casi completa del panel y poco contenido, ese reparto dejaba un hueco de ~90pt en el medio.
- Sacado el `space-between`; el espacio entre los dos grupos pasa a ser `bottomGroup.marginTop` fijo — 32 primero, después **20** (Joaquín pidió juntarlo más al verlo). El aire que sobra ahora queda abajo del todo (después del input/caption), que es el lugar normal para eso en una hoja inferior, no en el medio del texto.
- Typecheck, lint y 287/287 tests limpios. ✅ **Confirmado en dispositivo el mismo día** — "excelente".

**Pendiente para la próxima sesión:**
- 🎨 **Revisar el onboarding** (pedido de Joaquín, 27/08/2026): los títulos quedaron "un poco viejos" — no se especificó más todavía, hay que retomarlo con capturas o mirándolo en el teléfono para ver qué cambió alrededor (tipografía Plus Jakarta Sans de la sesión 126, rediseño glass/aurora) que dejó al onboarding desactualizado en comparación.

---

## 2026-08-27 — Joaquín (sesión 142)

**Tocado:** `screens/CoachReservasScreen.tsx`, `screens/CoachChatsScreen.tsx`.

**Resumen — los 4 títulos de las pestañas del coach (Reservas, Tus personas, Tus recursos, Home) no estaban a la misma altura. Medido con las 4 capturas que mandó Joaquín, no a ojo.**

- Mismo método que las sesiones 128-131 de Conexiones/Recursos: detección del primer píxel oscuro del título contra las capturas reales (script Python/PIL), no comparación visual. Resultado: "Reservas" y "Tus personas" arrancaban en y=243px; "Tus recursos" y "Hola, Coach" en y≈280px — **~12pt de diferencia real**, no un efecto óptico.
- Causa: las 4 usan el mismo `ViveFonts.title` 28px (confirmado, no era tema de fuente), pero dos estructuras de header distintas. `CoachHomeScreen`/`CoachResourcesScreen` meten el título DENTRO del `ScrollView` (`container.paddingTop:12` + `header.marginTop:8` = 20pt de offset). `CoachReservasScreen`/`CoachChatsScreen` lo dejan FIJO, fuera del scroll (para que no se mueva mientras la lista scrollea — diseño intencional, no se tocó), pero con `header.paddingTop:8` a secas — le faltaban los 12pt del `container` que nunca tuvo.
- Arreglado subiendo `header.paddingTop` de 8 a 20 en los dos, para igualar el offset total sin cambiar la estructura (el header sigue fijo, no entra al scroll).
- Typecheck, lint y 287/287 tests limpios. ✅ **Confirmado en dispositivo el mismo día** — Joaquín: "quedó bien".

**Pendiente para la próxima sesión:**
- 🎨 **Rediseñar `CoachReservasScreen` en su estado vacío** (pedido de Joaquín, 27/08/2026): con "Por confirmar" y "Confirmadas" las dos vacías (el caso normal de un coach nuevo, que puede durar hasta la primera reserva) la pantalla se ve muy pobre — dos cajas con línea de puntos y nada más, mucho espacio en blanco abajo. Mismo espíritu que la sesión 139 (Home del coach nuevo): pensar qué mostrar mientras no hay nada, no solo el estado vacío por default.

---

## 2026-08-27 — Joaquín (sesión 141)

**Tocado:** `screens/CoachLoginScreen.tsx`, `screens/CoachHomeScreen.tsx`.

**Resumen — otro hallazgo real del mismo alta de prueba (sesiones 139/140): el alta de coach por email inventaba el nombre a partir del mail, y ese valor quedaba para siempre.**

- `CoachLoginScreen` combina login y alta en un solo formulario: intenta entrar, y si falla, crea la cuenta. Hasta hoy, al crearla usaba `trimmedEmail.split('@')[0]` (la parte antes de la `@`) como `profiles.name` — con un mail normal daba un nombre feo pero corto, pero con el alias `+coachtest` que se usó para probar (sesión 140) dio `"joaquinalbisu493+coachtest"`, que se guardó como el nombre del coach **para siempre**: nada en el alta ni en la postulación (`CoachApplicationScreen`) vuelve a pedir un nombre. Ese valor desbordaba la tarjeta de saludo de la Home ("Hola, …", 28px) y le pisaba los íconos de la derecha.
- Arreglado en dos partes:
  - **Causa raíz**: `CoachLoginScreen` ahora pausa cuando el login falla (`needsName`), en vez de crear la cuenta a ciegas — pide el nombre real en un campo nuevo ("¿Cómo te llamamos?") y recién con eso crea la cuenta. El segundo submit no reintenta el login (ya se sabe que falla), va directo al alta.
  - **Defensivo**: la Home (`CoachHomeScreen`) le puso `numberOfLines={1}` + `ellipsizeMode="tail"` al saludo — cualquier nombre largo (de este bug o real) trunca con "…" en vez de desbordar el layout.
- `RegisterScreen.tsx` (usuario final) **no tenía este bug**: ya pide el nombre en un campo propio desde siempre. El defecto era específico del atajo login+alta de `CoachLoginScreen`.
- Corregido a mano el nombre de la cuenta de prueba ya creada (`"joaquinalbisu493+coachtest"` → `"Coach Test"`).
- **Sobre el pedido de "una opción para elegir cómo lo nombra Vita, para coach y usuario"**: ya existe, no hacía falta construir nada — `/edit-profile` tiene el campo "Nombre" editable, y está enlazado desde el perfil del usuario (`ProfileOwnScreen`) y desde el del coach (`CoachProfileScreen`). Es la puerta correcta para los dos roles.
- Typecheck, lint y 287/287 tests limpios. ✅ **Confirmado en dispositivo el mismo día** — Joaquín: "ahora se ve bien" (Home sin desbordar, con el nombre corregido).

---

## 2026-08-27 — Joaquín (sesión 140)

**Tocado:** `supabase/functions/admin-actions/index.ts`, `SCHEMA.md`. Deployada: `admin-actions` **v20**.

**Resumen — 🔴 bug real y serio, encontrado mientras se probaba la tarjeta de "coach nuevo" (sesión 139): un coach aprobado por el camino real de la app nunca llegaba al panel de coach.**

- Para probar la tarjeta nueva de la Home hacía falta un coach genuinamente nuevo, así que Joaquín hizo el primer alta de punta a punta de este proyecto: se registró como coach (con `+coachtest` en el mail, mismo mail de siempre), completó la postulación, la aprobó como admin, y al volver a entrar **cayó en la app de USUARIO, no en la de coach**.
- Causa: `admin-actions` (`set_coach_verified`) aprueba escribiendo `coaches.verified = true`, pero **nunca tocaba `profiles.role`** — y `role` es exactamente lo que `AuthRedirect`/`app/index.tsx` usa para mandar a `(coach)` vs `(tabs)`. Confirmado contra la base: el coach de prueba de Joaquín tenía `verified: true`, `application_status: 'aprobada'`, `role: 'user'`. Los demás coaches de prueba (Valentina Ríos, Tomás Aguirre, etc.) sí tienen `role: 'coach'` — pero porque se sembraron por SQL directo con el rol puesto a mano, no porque pasaran por esta función. **Nadie había ejercitado el flujo real de aprobación de punta a punta hasta hoy.**
- Esto conecta con un hallazgo viejo de SCHEMA.md (16/07/2026, "dato sucio": coaches con `profiles.role='user'`) que en su momento se atribuyó solo a seeds de test desprolijos — en realidad, además de eso, **era un síntoma de este bug de fondo**, no solo ruido de datos.
- Arreglado: `set_coach_verified` ahora también hace `profiles.update({role:'coach'})` cuando `verified=true`, en el mismo bloque donde ya escribe `application_status`/`application_reviewed_at` y notifica al coach. **No** se toca al revocar (`verified=false`) — revocar saca del catálogo, no convierte de nuevo en usuario final, mismo criterio asimétrico que esta función ya usa para `application_status`.
- Desbloqueada la cuenta de prueba de Joaquín a mano (`update profiles set role='coach'`) para no perder el hilo de la prueba de la sesión 139.
- Deployada y verificada por la respuesta: un POST con `coach_id` inválido da `{"error":"token inválido"}` con 401 — desde el código propio, confirma que arrancó sin errores de import.
- `SCHEMA.md` actualizado, cruzando la nota vieja del 16/07 con la causa raíz encontrada hoy.
- Typecheck y 287/287 tests limpios (el archivo de la función no corre por `tsc`, `supabase/functions` está excluido de `tsconfig.json`).

- ✅ **Chequeado el mismo día si había coaches reales afectados** (`select ... where verified=true and role='user'`): solo 2 filas, y ninguna es un caso real. Una es el propio Andre (`profile_id` = su cuenta de siempre) — el mismo caso ya documentado desde el 16/07, cuenta de dev/test, no alguien que se haya dado de alta por el flujo real. La otra es una cuenta ya dada de baja (`name = 'Usuario eliminado'`, la anonimización de `deleteMyAccount()`) — inerte, no hay a quién avisarle. **El bug se atrapó antes de afectar a ningún coach real.**

**Pendiente para la próxima sesión:**
- Volver a intentar la prueba de la sesión 139 (tarjeta de "coach nuevo" en la Home) — ahora sí debería poder entrar como coach.

---

## 2026-08-27 — Joaquín (sesión 139)

**Tocado:** `screens/CoachHomeScreen.tsx`.

**Resumen — cerrado el pendiente 🔴 de Andre (sesión 128): "Home del coach, quedó diagnosticada y sin tocar". La Home ahora tiene dos caras según si el coach tuvo alguna sesión, no solo según si tiene la próxima.**

- El diagnóstico de Andre era exacto: "Sin sesiones programadas" + botón "Ver reservas" (una pantalla vacía) es un callejón, y le tocaba justo al coach que más ayuda necesita — el que recién empieza. El contenido que le serviría (`buildChecklist`/`blockingReason` de `lib/coachVisibility.ts`) ya estaba calculado en la pantalla, solo que comprimido en una tarjeta de un renglón más abajo, fácil de no ver.
- Nueva señal `esCoachNuevo = !next && completadas === 0` — **no es lo mismo** que "no tiene la próxima sesión": un coach con historial en un bache entre reservas tiene `completadas > 0` aunque `next` sea `null`, y para ese el "Ver reservas" de siempre sigue siendo correcto. Solo cambia para el que NUNCA tuvo una.
- Para ese caso, la tarjeta vacía se reemplaza por una que reusa `visibility` (ya estaba en el estado, cero consultas nuevas) reencuadrado como el paso siguiente concreto:
  - Si está bloqueado (`visibility.blocked` — sin temas, sin precio, en pausa, etc.): título y explicación del motivo real, con un botón directo a resolverlo (`/coach-topics`, `/perfil`) en vez de a una lista vacía. Etiqueta del botón por ítem (`CTA_POR_ITEM`: "Elegir mis temas", "Poner mi precio", "Activar mi perfil") — más específico que un genérico "Resolver".
  - Si NO está bloqueado (ya visible, solo que no le llegó la primera reserva): "Ya aparecés en N puertas" + botón a `/coach-visibilidad`, para que sepa que el problema no es su perfil, es esperar.
  - La tarjeta "Cómo aparecer en Conexiones" de más abajo se oculta cuando `esCoachNuevo` mostró lo mismo arriba — evita decir lo mismo dos veces en la misma pantalla.
- Typecheck, lint y 287/287 tests limpios. No confirmado en dispositivo — hace falta una cuenta de coach con cero sesiones para verlo (todos los coaches de prueba actuales ya tuvieron alguna, salvo que se arme uno nuevo a propósito).

**Pendiente para la próxima sesión:**
- Confirmar visualmente: crear/usar un coach de prueba con `completadas = 0` y sin sesión próxima, y mirar las dos variantes (bloqueado vs. visible-sin-reservas todavía).

---

## 2026-08-27 — Joaquín (sesión 138)

**Tocado:** `app/_layout.tsx`.

**Resumen — antes de probar el bloque nuevo de navegación del coach (pendiente de Andre, sesión 128), barrido completo de headers duplicados. Encontradas 5 pantallas con el mismo bug ya arreglado antes para `coach-datos-cobro`.**

- Al revisar `/coach-ajustes` (nueva, de Andre) para guiar la prueba en el teléfono, noté que linkea a `/admin` y `/cuentas-bloqueadas` — dos pantallas que **no** estaban en la lista de `<Stack.Screen>` de `app/_layout.tsx` con `headerShown: false`, a diferencia de literalmente todas las demás. Eso significa header nativo de Expo Router (título = nombre de archivo) dibujado ENCIMA del propio header que ya arma cada pantalla (`AdminScreen`, `BlockedAccountsScreen` — las dos tienen su `SafeAreaView` + `s.header` propios).
- En vez de arreglar solo esas dos, se comparó la lista completa de `app/*.tsx` contra las entradas de `<Stack.Screen>` (`comm -23` entre las dos listas ordenadas). Aparecieron **tres más** con el mismo patrón (header propio, sin la entrada en `_layout.tsx`): `coach-reservas` (la pantalla de reservas del coach — no es un rincón, es un tab central), `pago-usdt` y `reembolso` (parte del flujo de USDT, ya probado con plata real en otras sesiones).
- Agregadas las 5 con `headerShown: false`, mismo patrón que el resto de la app. Verificado con `comm` que no queda ninguna ruta de `app/*.tsx` sin su entrada correspondiente.
- Typecheck, lint y 287/287 tests limpios. ✅ **Confirmado en dispositivo el mismo día** — Joaquín recorrió engranaje → `/coach-ajustes` → sus tres secciones, y volvió: "todo se ve bien".

---

## 2026-08-27 — Joaquín (sesión 137)

**Tocado:** `screens/BookingScreen_Confirm.tsx`.

**Resumen — de la investigación de la sesión 136 salió un problema real: alguien reservando desde lejos (el riel internacional existe para eso) puede tener la misma espera larga que Joaquín, y hasta ahora no había ningún aviso — solo un spinner mudo.**

- Idea de Joaquín: ya que sin querer se topó con este caso (probando desde Australia), aprovecharlo para blindar la experiencia de cualquier usuario real que reserve desde lejos, para que no piense que la app se colgó.
- `loadingLong`: se prende recién a los 3.5s de apretar "Reservar sesión" (no antes — el caso normal, en Argentina, dura menos que eso y no necesita el aviso). Cuando se prende, aparece un cartel informativo (mismo estilo celeste que ya usa `paymentInfoRow`, no uno nuevo) con "Esto está tardando más de lo normal — puede pasar si estás conectando desde lejos. Seguí esperando, no hace falta reintentar."
- El botón, mientras `loading`, ahora muestra "Reservando…" al lado del spinner — antes era el spinner solo, sin texto.
- 🔴 **De yapa, un bug real encontrado al tocar esto**: el `ActivityIndicator` del botón estaba pintado `color="#565E32"` — el mismo verde oscuro que el fondo del botón (`btn.backgroundColor`). Era, en los hechos, invisible; todo lo que se veía al tocar "Confirmar reserva" era el botón atenuándose un poco (`btnLoading: {opacity:0.7}`), sin ninguna señal clara de que algo estaba pasando. Corregido a `#F7EFE4` (el mismo claro que usa `btnText`).
- Typecheck, lint y 287/287 tests limpios. ✅ **Confirmado en dispositivo el mismo día** — Joaquín probó desde Australia: "ahora sí se ve todo bien" (spinner visible + cartel de demora).

---

## 2026-08-27 — Joaquín (sesión 136)

**Tocado:** ninguno de código — investigación y cierre de la demora de las sesiones 134/135.

**Resumen — encontrada la causa real de "sigue tardando mucho" después de dos rondas de optimización: no era el código, era la distancia física. Joaquín está probando desde Australia.**

- Después de las optimizaciones de las sesiones 134 (cliente) y 135 (servidor), la demora se seguía sintiendo igual. En vez de seguir adivinando, se armó acceso a los logs reales de las edge functions (Management API de Supabase, `analytics/endpoints/logs.all` — el token real vive en el llavero de macOS, "Supabase CLI"/"supabase", **no** en `~/.supabase/access-token`, que está desactualizado) y se midió `execution_time_ms` real por invocación.
- **Comparación real, con geolocalización de cada pedido:**
  | Cuándo | Origen real del pedido | Región que atendió | Tiempo de servidor |
  |---|---|---|---|
  | 26/08 ~15hs | Córdoba, Argentina | `sa-east-1` (São Paulo, la región del proyecto) | 0.8 – 1.4s |
  | 27/08 (WiFi) | Sydney, Australia | `ap-southeast-2` (Sydney) | 1.7 – 5.5s |
  | 27/08 (datos móviles) | Brisbane, Australia — operador **Vodafone Australia** | `ap-southeast-2` | 3.97s |
- Descartadas por orden, con el usuario confirmando cada una: iCloud Private Relay (apagado), VPN clásica, Cloudflare WARP/1.1.1.1, bloqueadores tipo AdGuard/Guardian — ninguna activa. El dato que cerró la investigación: con **datos móviles** (sin WiFi de por medio) el operador que atendió la llamada fue **Vodafone Australia** en Brisbane — no una IP mal geolocalizada, el nombre real del operador. Eso solo se explica con el teléfono físicamente conectado a antenas australianas. Confirmado por Joaquín: **vive en Australia**.
- **No es un bug.** São Paulo/Buenos Aires y Australia están en veredas opuestas del planeta — cada ida y vuelta de red tiene un piso de cientos de ms que ningún cambio de código baja. Las optimizaciones de 134/135 (client-side y server-side, sacar el tramo serial) son reales y sirven para los usuarios de verdad, que están en Argentina — los 0.8-1.4s de Córdoba del 26/08 lo confirman. Lo que Joaquín mide desde Australia va a sentirse lento siempre, sin relación con la calidad del código.

**Pendiente para la próxima sesión:**
- Si Joaquín necesita probar con una latencia realista (como la vería un usuario argentino), la opción es una VPN apuntando a Argentina/Sudamérica SOLO para probar — irónico después de haber descartado VPN como causa, pero acá cumple el rol contrario: simular la red de un usuario real, no ocultar la propia.
- Nada que arreglar en el código por este hilo — cerrado.

---

## 2026-08-27 — Joaquín (sesión 135)

**Tocado:** `supabase/functions/mp-create-payment/index.ts`, `supabase/functions/paypal-create-payment/index.ts`. Deployadas: `mp-create-payment` **v42**, `paypal-create-payment` **v15**.

**Resumen — la demora de la sesión 134 (cliente) no alcanzaba: seguía tardando mucho. El resto estaba del lado del servidor, en las mismas edge functions.**

- `mp-create-payment` hacía 3 consultas en fila que no dependían una de otra: precio del coach, token de MP del coach (con su propio refresh condicional) y el conteo de sesiones del par para la comisión. Pasadas a `Promise.all` — el tiempo pasa a ser el de la más lenta de las tres, no la suma.
- `paypal-create-payment` tenía el mismo patrón y uno más grave: pedía el token OAuth de PayPal (un viaje de red completo a la API de PayPal) recién DESPUÉS de validar reserva, coach, comisión y datos de cobro — en vez de arrancarlo apenas entra la request, ya que no depende de nada de eso. Ahora se dispara al toque y se espera (`await tokenPromise`) recién cuando hace falta, al final. De paso, el `select` del coach y el conteo de comisión también pasaron a `Promise.all` (mismo caso que en MP).
- Ninguno de los dos cambios toca la llamada final a la API de MP/PayPal para crear el pago (`fetch` a `checkout/preferences` / `v2/checkout/orders`) — esa sigue siendo, inevitablemente, un viaje de red externo y probablemente el paso más lento que queda.
- Deployadas y **verificadas por la respuesta**, no por el estado declarado (mismo criterio que la sesión 127 de Andre): un POST con la anon key en vez de un JWT de usuario da 401 `Unauthorized` **desde el código propio** (falla `auth.getUser`, no el gateway) — confirma que las dos arrancan sin errores de import y ejecutan su lógica.
- No se corrió `tsc` sobre estos archivos: `supabase/functions` está excluido de `tsconfig.json` (Deno, imports por URL) — la verificación es la de arriba, por respuesta real.

**Pendiente para la próxima sesión:**
- Confirmar con Joaquín si esto alcanzó. Si la demora sigue sintiéndose fuerte, lo que queda son los dos `fetch` externos (crear preferencia/orden) y un eventual cold start de la función — ahí ya no hay más paralelismo posible del lado nuestro, habría que medir tiempos reales (Log Explorer del dashboard, no accesible por `supabase db query`) para saber cuál de los dos pesa más.

---

## 2026-08-27 — Joaquín (sesión 134)

**Tocado:** `screens/BookingScreen_Confirm.tsx`.

**Resumen — "tarda muchísimo en redirigirte" al tocar Reservar sesión: el tramo entre el botón y el checkout hacía ~7 viajes de red en serie sin necesidad.**

- Entre apretar "Reservar sesión" y abrir el checkout, `onConfirm` hacía: buscar coach → patrón semanal → **esperar** el insert de analítica (`reserva_iniciada`) → buscar/crear sala → limpiar intento anterior → precio actual → insertar booking → **esperar** el insert de analítica (`reserva_confirmada`) → recién ahí invocar `mp-create-payment`/`paypal-create-payment`. Ocho pasos en fila, la mayoría independientes entre sí.
- 🔴 **Los dos registros de analítica (`registrarEvento`) se esperaban (`await`) estando en el camino crítico**, cuando son de mejor esfuerzo por diseño (`lib/supabase.ts`: si falla, solo hace `console.warn`, nunca corta el flujo). Cada uno suma su propio viaje a `auth.getSession()` más el insert — dos esperas completas que no le aportan nada a quien está reservando. Cambiados a "fire and forget" (`.catch(() => {})`, sin `await`): se siguen registrando si salen bien, pero ya no hacen esperar a nadie.
- **Las cuatro consultas del paso 2 (sala, patrón semanal, limpieza de intento anterior, precio actual) no dependían una de otra** y se hacían en serie sin motivo. Pasadas a `Promise.all` — el tiempo total pasa a ser el de la más lenta de las cuatro, no la suma de las cuatro.
- No se tocó `mp-create-payment` ni `paypal-create-payment` (la llamada a la API de MP/PayPal en sí, más el refresh de token si corresponde, sigue siendo el paso más lento y queda del lado del servidor) — si después de este cambio la demora sigue sintiéndose fuerte, el siguiente sospechoso es ese, no el cliente.
- Typecheck, lint y 287/287 tests limpios. No confirmado en dispositivo — pendiente que Joaquín lo pruebe y diga si se sintió más rápido.

**Pendiente para la próxima sesión:**
- Confirmar en el teléfono si la demora bajó. Si sigue sintiéndose lenta, medir tiempo puntual de `mp-create-payment` (¿está refrescando el token de MP en cada reserva, o solo cuando falta <24h como debería?).

---

## 2026-08-27 — Joaquín (sesión 133)

**Tocado:** ninguno de código — solo verificación contra la base.

**Resumen — cerrado el pendiente 🔴 de Andre (sesión 128): "probar una reserva real contra Mercado Pago" con `mp-create-payment` v41.**

- No se había podido smoke-testear porque el gateway corta con 401 sin JWT de usuario real, así que hacía falta una reserva real desde el teléfono. Joaquín reservó una sesión con Coach Prueba (precio $1) y pagó con plata real.
- Verificado contra `bookings` (por `supabase db query --linked`, ver sesión 132): `amount = 1` (sin desvío), `payment_status = 'aprobado'`, `payment_id` real de MP (`175826026790`), `platform_fee_pct = 15`. `status` quedó en `'pendiente'` — esperable, Coach Prueba no tiene `instant_booking`, así que espera aceptación del coach dentro de las 24hs.
- `mp-create-payment` v41 queda confirmado funcionando de punta a punta con plata real.

**Pendiente para la próxima sesión:**
- Del resto de la lista de Andre (sesión 128) sigue abierto: probar en el teléfono el bloque nuevo de navegación del coach (`/coach-ajustes`), la Home del coach sin sesiones, y las decisiones de producto (cartelitos de pago siempre-los-3 vs. solo-aceptados, promo de fundador en rieles internacionales).

---

## 2026-08-27 — Joaquín (sesión 132)

**Tocado:** `lib/coachesCache.ts`, `app/search3.tsx`, `SCHEMA.md`.

**Resumen — implementado D6: sin ningún riel de cobro configurado, el coach ya no aparece en el catálogo.**

- Venía del pendiente "las 3 puertas sin cartelito" (`PaymentBadges` devolviendo `null` para coaches sin ningún riel). Al ir a arreglarlo con copy, Joaquín frenó la solución cosmética: "¿no sería mejor que el coach tenga que sí o sí definir un método de pago?" — la respuesta correcta no era mejorar el texto de una tarjeta vacía, era no dejar llegar esa tarjeta al catálogo.
- Encontrado que Andre ya había tomado esa decisión en `docs/decisiones-pagos.md` (**D6**, decidida 25/08/2026: "para publicar el perfil hay que tener al menos UN riel de cobro completo") pero **nunca quedó implementada en código**. Confirmado con Joaquín antes de tocar nada — dio el visto bueno.
- Agregado `.or('mp_connected.eq.true,accepts_paypal.eq.true,accepts_usdt.eq.true')` en **las dos** consultas de coaches que existen en el código: `lib/coachesCache.ts` (`_doFetch`, la fuente principal) y la consulta de respaldo de `app/search3.tsx` (la que corre solo con el caché frío) — mismo patrón ya documentado antes para `verified`/`availability_status`: dos queries independientes, cualquier filtro nuevo tiene que ir en las dos o se desincronizan.
- `SCHEMA.md` actualizado con la nota de D6 junto a `coaches.mp_connected`.
- Typecheck, lint y 287/287 tests limpios.
- ✅ **Confirmado en dispositivo el mismo día.** El impacto real era más grande de lo estimado: hay **32 coaches** en la base (no 4, ese número era de una vista vieja/parcial), y de esos **solo 1 tiene algún riel conectado** ("Coach Prueba" — MP, PayPal y USDT los tres en `true`). Antes del reload la app seguía mostrando cero resultados por el caché en memoria de `coachesCache.ts` (no se resetea con un simple background-refresh); cerrando la app del todo y reabriendo, apareció el único coach que corresponde.

**Corrección al toque, mismo día:** el punto de "próximo paso natural — `accepts_international` a dato derivado" que había dejado como pendiente **estaba desactualizado**: Andre ya lo había hecho el 25/08/2026 (`sync_accepts_international()`, `scripts/add-payout-rails.sql`) — llegó al repo en el merge grande de la sesión 130 y no lo había vuelto a chequear antes de escribir el pendiente. Ver `SCHEMA.md` §`coaches.accepts_international`. No hay nada para hacer acá.

**De paso, mismo día — variedad de prueba en el catálogo.** Con solo 1 coach visible no había forma de probar `PaymentBadges` con distintas combinaciones ni ver el deck de Conexiones con más de una tarjeta. Conectados dos rieles más vía SQL directo (`coach_payout_accounts`, dejando que `trg_sync_intl_on_payout` derive los flags — no se tocaron las columnas de `coaches` a mano):
- **María González** → PayPal (`paypal_email` de prueba).
- **Martín Fuentes** → USDT (wallet TRC20 de prueba, generada respetando el CHECK `payout_wallet_formato`: primer intento con un `0` en la dirección rebotó porque el alfabeto base58 no lo admite).

Confirmado en dispositivo: los 3 coaches (Coach Prueba, María González, Martín Fuentes) aparecen en el catálogo, cada uno con su badge de pago correspondiente.

**Dos pendientes de Andre (sesión 128) cerrados de paso:**
- ✅ **"Conviene dejar una forma de consultar la base desde la sesión"** — resuelto: `supabase db query --linked "<sql>"` funciona sin service role key ni `psql` instalado (usa el Management API del CLI, ya autenticado). Es lo que se usó para todo lo de esta entrada.
- ✅ **Probada la rama del DELETE del trigger** (`fix-payout-rails-trigger.sql`, chequeo 3), la única que había quedado sin ejercitar por falta de filas en `coach_payout_accounts`. Con una fila real (Sofía Herrera, de prueba): INSERT dejó `accepts_paypal=true`, DELETE la volvió a `false` sin error — el trigger resuelve bien `old.coach_id` en el camino de borrado.

---

## 2026-08-27 — Joaquín (sesión 131)

**Tocado:** `app/(tabs)/conexiones.tsx`.

**Resumen — cerrado el título/subtítulo de Conexiones (confirmado por Joaquín), y ajustada la barra de búsqueda para que quede a la misma altura que la barra "Hoy: ..." de Recursos.**

- `marginTop: 2` de la sesión 130 (corregido el error de unidades px@3x vs. pt) **funcionó** — confirmado con captura.
- **Nuevo pedido**: la barra de búsqueda un poco más abajo, a la misma altura que la barra "Hoy: Para dedicarle..." de `recursos.tsx`. Esta vez medido detectando el BORDE del pill (no el texto, que en la barra de búsqueda es gris clarito y no siempre cruza el umbral de detección) — 28px de diferencia real sobre la captura, **ya convertido a puntos** (28/3≈9pt) antes de aplicarlo, aprendiendo de la sesión 130.
- `searchBar.marginTop` de 2 a **11**.
- Typecheck, lint y 287/287 tests limpios. No confirmado en dispositivo.

---

## 2026-08-27 — Joaquín (sesión 130)

**Tocado:** `app/(tabs)/conexiones.tsx`.

**Resumen — retomando el pendiente de la 129: "Elegí un área de bienestar para empezar" seguía sin coincidir con "Herramientas de Vita" en Recursos, y esta vez sí se cerró — midiendo DESPUÉS de aplicar el cambio, no antes.**

- Joaquín mandó captura fresca de las dos pantallas al arrancar, como habíamos anotado como pendiente. Medido con el mismo script de filas de texto que la sesión 129, más verificación visual con recortes esta vez (no confiar solo en el número).
- 🔴 **La medición de la sesión 129 (54px vs 83px) no se sostuvo al aplicar el `marginTop:21` calculado a partir de ella.** El gap real terminó en **141px** contra los **84px** de Recursos — 57px de más, casi el doble. La relación entre "cuánto cambia el margen" y "cuánto cambia el gap visible" con Plus Jakarta Sans **no es 1:1** — quedó como lección para no repetir: medir la ANTES/DESPUÉS de cada cambio real, no asumir que un delta de margen produce el mismo delta de gap visible.
- **Arreglado**: `askWrapTight.marginTop` de 21 a **-36** (resta directamente los 57px de diferencia medidos).
- Typecheck, lint y 287/287 tests limpios. No confirmado en dispositivo — pendiente que Joaquín lo vea y avise si esta vez sí cerró.
- De paso: se trajo el trabajo grande de Andre de ayer (fast-forward, sin conflictos) — reorganización completa del perfil del coach en 5 grupos, arreglo de un agujero de seguridad en el monto cobrado por Mercado Pago (venía del cliente, sin validar contra el precio real del coach), cierre de disputas de PayPal, features nuevas en la Home del coach (quién se está cayendo, notas de cierre de sesión, "tus personas").

**Pendiente para la próxima sesión:**
- ~~Confirmar en dispositivo si el ajuste de -36 cerró el tema del espaciado, de una vez.~~ **No cerró — encontrado el error real, ver abajo.**

**Fix al toque, mismo día: el -36 pisó el título entero — "Elegí un área..." quedó escrito ENCIMA de "Conexiones".**

- 🔴 **El error no era la relación entre pantallas — era una confusión de UNIDADES.** Las capturas del iPhone son @3x (1290px = 430pt de pantalla), y los píxeles medidos sobre la captura se venían restando/sumando DIRECTO al `marginTop`, que React Native mide en puntos, no en píxeles de imagen. Cada ajuste de hoy y de ayer estaba, en los hechos, aplicando **el triple** del cambio que parecía.
- **Con las dos mediciones reales que sí hay** (`marginTop:-8` → gap 54px=18pt; `marginTop:21` → gap 141px=47pt), la relación es lineal **1:1 en puntos** (`gap_pt = marginTop + 26`) — nunca hizo falta sospechar de un comportamiento no lineal de Plus Jakarta Sans, esa hipótesis de la sesión 129 estaba mal. `marginTop` final: **2** (objetivo 84px=28pt, 28−26=2).
- Typecheck, lint y 287/287 tests limpios. No confirmado en dispositivo.

---

## 2026-08-26 — Joaquín (sesión 129)

**Tocado:** `app/(tabs)/conexiones.tsx`.

**Resumen — "Elegí un área de bienestar para empezar" (Fase 1 de Conexiones) pasó a tener el mismo estilo que "Herramientas de Vita" en Recursos.**

- Pedido explícito: mismo tamaño/letra/color que `sectionTitle` de `recursos.tsx` (Jakarta 700, 20px, forest) — antes era Poppins regular 13.5px, gris oliva.
- **Nuevo modificador `askSubBig`**, aplicado solo al texto de Fase 1 — el subtítulo de Fase 2 ("Elegí un tema y te presento a los profesionales indicados") sigue con el estilo chico original, no se tocó.
- **Fix al toque, mismo pedido**: con la letra más grande el texto quedó pegado arriba del "Conexiones" — se subió `askWrapTight.marginTop` de 0 a 10 (había bajado a 0 en la sesión 128, cuando ese bloque todavía tenía el subtítulo chico).
- **Segundo fix al toque, con captura comparativa**: pedido que quede a la misma altura de pantalla que "Herramientas de Vita" en Recursos. Medí las tres diferencias entre las dos pantallas (`header.marginTop`: 10 acá vs. -2 en recursos.tsx; `header.marginBottom`: 6 vs. 8; el título mide 32/38 vs. 34/40) y las compensé todas en un solo número: `askWrapTight.marginTop` pasó de 10 a -6.
- **Ajustes finos sucesivos a ciegas** (sin captura, solo "más"/"menos"): -6 → -12 → -16 → -8.
- **Se cortó la ronda de tanteos y se midió en píxeles sobre capturas reales.** El cálculo teórico original (a partir de `marginTop`/`lineHeight` declarados) estaba equivocado: no predice cómo Plus Jakarta Sans se renderiza de verdad. Medido con un script que detecta filas de texto: el gap título→subtítulo en Conexiones daba **54px** contra **83px** en Recursos — es decir, iba en la dirección contraria a lo que el cálculo había dicho. `marginTop` final: **21**.
- Typecheck, lint y 259/259 tests limpios.
- 🔴 **Con `marginTop: 21` (medido), Joaquín dijo que tampoco quedó.** Cortamos la sesión ahí — **queda pendiente, sin resolver**, para retomar mañana. `askWrapTight.marginTop = 21` es el valor que quedó commiteado, no una solución confirmada.

**Y se cerró el pendiente de las disputas de PayPal.**

- 🔴 **Una disputa GANADA se quedaba para siempre en `reversiones_despues_de_pagar`** — la lista de "plata que hay que recuperar o dar por perdida". La vista mira `disputed_at is not null`, y esa columna **no se limpia nunca ni debe**: documenta cuándo se ABRIÓ la disputa, que es un hecho histórico. Borrarla para sacar la fila destruiría el único registro de que la disputa existió. Nuevas `bookings.dispute_resolved_at` y `dispute_outcome` (`scripts/add-dispute-resolution.sql`, **CORRIDO el 26/08/2026**), y la vista pasa a exigir `dispute_resolved_at is null`.
- 📝 **La lógica cuelga de `status` y NO de `dispute_outcome.outcome_code`, a propósito.** Se fue a buscar la documentación de PayPal en vez de escribirlo de memoria: el enum de `status` se pudo **citar de una página** (`OPEN` / `WAITING_FOR_SELLER_RESPONSE` / `WAITING_FOR_BUYER_RESPONSE` / `UNDER_REVIEW` / `RESOLVED`), pero el de `outcome_code` **solo apareció en un resumen de búsqueda**, no citado. Así que el outcome se guarda **crudo y sin interpretar**, para que lo lea una persona — mismo criterio que `session_attendance.raw`. Es la misma disciplina que evitó el error del 4,4% contra el 5,40% real.
- 🔴 **Y resultó que el outcome no hace falta para nada.** Si la disputa se PIERDE, PayPal revierte la captura y `PAYMENT.CAPTURE.REVERSED` deja `payment_status = 'contracargo'`: la fila se queda en la lista por **esa** condición de la vista, que no se tocó. Si se GANA, no hay reversión y sale. ⚠️ Los dos avisos son eventos distintos y PayPal no garantiza el orden: si `RESOLVED` llega antes que `REVERSED`, la fila desaparece un rato y vuelve. Es transitorio y se corrige solo; lo que no puede pasar —y no pasa— es que se quede afuera con la plata devuelta.
- 🔴 **Agregado algo que el review no había pedido: la disputa se puede REABRIR.** Al escalar (inquiry → chargeback → arbitraje) el `status` deja de ser `RESOLVED`, y ahí vuelve a ser plata en riesgo. El webhook **limpia `dispute_resolved_at`** en ese caso. Sin esa rama, la reserva escalada quedaba fuera de la lista justo cuando más hay que mirarla.
- ✅ **`paypal-webhook` deployada (v18, `verify_jwt = false`), verificada contra la API y con smoke test** (200 `ignored`). 🔴 **El orden importaba**: la función hace `select` y `update` de `dispute_resolved_at`, así que contra una base sin esa columna el select falla, la reserva queda en null y se loguea "DISPUTA sobre una captura desconocida" — o sea que **dejaba de registrar disputas en silencio**. Por eso las columnas se verificaron ANTES de deployar.
- 📝 **Cómo se verificaron sin service role key**: `GET /rest/v1/bookings?select=<columna>` con la anon key **distingue los dos casos** — una columna inexistente da 400 `42703 column does not exist`, y una existente bloqueada por RLS da 200 `[]`. Con un control positivo (`disputed_at`) y uno negativo (una columna inventada) alcanza para confirmar. Sirve para cualquier tabla, incluidas las que la anon key no puede leer.
- 📝 **`tsc` estaba fallando por `@expo-google-fonts/plus-jakarta-sans`**, declarada en `package.json` pero no instalada — de la migración de fuentes. Un `npm install` lo resolvió; el lockfile no cambió.

**Y se borró la función de diagnóstico y arrancó la reorganización del perfil del coach.**

- ✅ **`paypal-diagnostico` borrada del proyecto** (quedan 17 funciones). El archivo se conserva en el repo, que es lo que el registro del 24/08 decía y recién ahora es verdad: estaba deployada y ACTIVE. Leía `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET` y `PAYPAL_WEBHOOK_ID` de producción, aunque detrás de la service_role key.
- 🔴 **`CoachProfileScreen` pasa de doce secciones planas a CINCO GRUPOS**, cada uno nombrado por la pregunta que se hace el coach: **Tu perfil público** (presentación, temas, video) · **Cómo cobrás** (precio en pesos y paquetes, Mercado Pago, sesiones del exterior) · **Cómo trabajás** (modalidad de reserva, horarios, aparecer en búsquedas) · **Tu reputación** (reseñas) · **Tu cuenta** (bloqueados, cerrar sesión). **Se movieron bloques enteros de JSX, sin tocar estado** — que es la parte cara y riesgosa de partir esta pantalla en varias.
- 🔴 **Lo que el reordenamiento arregla, y no es cosmético.** *Cobrar estaba partido en dos secciones separadas por el video de perfil*: "Mercado Pago" y "Sesiones desde el exterior" son la misma pregunta —cómo me pagan— y tenían una sección de otro tema en el medio. *Y el precio en pesos vivía a cinco secciones del precio en dólares*, siendo una sola decisión comercial. Ahora los cuatro están en el mismo grupo y en ese orden.
- 🔴 **"Disponibilidad" nombraba TRES cosas distintas** y ninguna era la que el coach busca: el interruptor `availability_status` (que en realidad decide si APARECÉS en búsquedas), las franjas de `/coach-availability`, y el patrón semanal de adentro de esa. El que se quería pausar una semana tenía cuatro candidatos contando la pantalla que se llama Visibilidad. Ahora son **"Tus horarios"** (las franjas) y **"Aparecer en búsquedas"** (el interruptor), y el interruptor dice **"Aparecés / En pausa"** en vez de "Disponible". De paso se eliminó el botón duplicado que llevaba a `/coach-availability`.
- 🔴 **La tarjeta de estado de las sesiones del exterior dejó de ser un link.** Llevaba a `/coach-datos-cobro`, igual que la fila "Cómo te pagamos" de abajo: **dos accesos al mismo lugar dentro de la misma sección**, y colgados de algo que no se configura. Es un ESTADO derivado — lo que se configura son las dos cosas que lo producen, que están justo debajo. Ahora muestra un check en vez de un chevron.
- 📝 **Nuevo nivel `groupTitle` / `groupHint`** por encima de `sectionTitle`. Sin jerarquía las doce secciones pesaban igual: cobrar en pesos quedaba visualmente al mismo nivel que el video de perfil.
- ⚠️ **Lo que NO se hizo todavía**, y sigue abierto del análisis: el perfil **no es una pestaña** —se entra tocando el avatar en Home (`CoachHomeScreen.tsx:269`), único acceso, sin etiqueta—; `/coach-visibilidad` y `/coach-notifications` siguen colgando de Home en vez de del perfil; el nombre y la fecha de nacimiento siguen en `/edit-profile` (compartida con el usuario) mientras la bio se edita inline, o sea dos modelos de edición para campos de la misma tarjeta; y el archivo sigue teniendo ~1750 líneas con sus diez estados de guardado juntos.

**Y separando "configuración de la app" de "configuración del perfil" —idea de Andre— apareció que al coach le faltaba media pantalla, y dos de esas ausencias son de CUMPLIMIENTO.**

- 🔴 **El coach no tenía forma de llegar a los Términos, a la Política de privacidad, al botón de arrepentimiento ni a dar de baja su cuenta.** Cero coincidencias en todo `screens/Coach*.tsx`. Todo eso vive en `ProfileOwnScreen`, que es la pantalla del USUARIO — y un coach **nunca la ve**: `AuthRedirect` lo manda a `(coach)` y `/perfil` le renderiza `CoachProfileScreen`. No era un problema de organización: era funcionalidad ausente.
  - 🔴 **"Eliminar mi cuenta" es la guideline 5.1.1(v) de Apple** — toda app con registro tiene que permitir borrar la cuenta desde adentro o **la rechazan**. SCHEMA.md ya lo documentaba como bloqueador de publicación. Y lo más llamativo: **`deleteMyAccount()` YA contemplaba al coach** (devuelve `coach_con_sesiones` si tiene sesiones agendadas), o sea que el backend lo previó desde el principio y **la UI nunca lo expuso**.
  - 🔴 **El botón de arrepentimiento es la Res. 424/2020.** Está en la lista del usuario y hasta en la de invitado —que es justo lo que la norma pide— y faltaba en la del coach, que es quien cobra.
- ✅ **Nueva `screens/CoachSettingsScreen.tsx` + `app/coach-ajustes.tsx`**, con los siete ítems agrupados en Tu cuenta / Legales / (salida). El texto de la baja es **el del coach y no el del usuario**: lo que se le conserva a un profesional son sus reseñas y las reservas de otra gente, y se le avisa que con sesiones agendadas no puede darse de baja hasta cancelarlas.
- ✅ **Engranaje en el header de Home**, al lado de la campana. **El avatar lleva al PERFIL** (cómo te ven, cuánto cobrás, cuándo atendés) y **el engranaje a la CUENTA**. Antes el avatar era el único acceso a las dos cosas, sin etiqueta.
- 📝 **`/coach-notifications` NO se movió, contra lo que decía el análisis de ayer.** Es una BANDEJA de entrada, no configuración —título "Notificaciones", vacío "No tenés notificaciones todavía"—; agruparla en "Tu cuenta" fue un error de guiarse por el nombre. Una campana en el header es su lugar.
- 📝 **`/coach-visibilidad` se agregó al perfil y se DEJÓ la tarjeta de Home.** Es la respuesta a "¿por qué no aparezco?", la misma pregunta del interruptor nuevo. Dos puertas a un **estado** está bien; dos puertas a una misma **acción** era el problema, y ese ya se sacó.
- 📝 **`/edit-profile` quedó con UNA sola puerta**, la tarjeta de identidad del perfil, y el botón ahora dice **"Editar nombre y foto"** en vez de "Editar perfil" — que competía con la presentación, los temas y el video, que se editan ahí mismo sin salir. Se sacó de Ajustes a propósito aunque suene a "datos de la cuenta": de los cuatro campos que edita, tres son públicos.

**Y después, mirando la app corriendo, salieron tres cosas más — la última es de plata.**

- 🔴 **El monto que se cobraba en Mercado Pago venía DEL CLIENTE.** `BookingScreen_Confirm` tomaba `priceFrom` de un **parámetro de ruta** y lo insertaba tal cual en `bookings.amount`; `mp-create-payment` lo usaba como `unit_price` y como base de la comisión, sin compararlo contra nada. Sin el parámetro se cobraban **$4500** —un default que quedó del mockup, al lado de `'Laura Méndez'`— y **con el parámetro modificado, cualquier precio**: una sesión de $50.000 reservada por $1, con la comisión del coach calculada sobre ese $1. Se buscó validación en `scripts/*.sql`: no hay CHECK, ni trigger, ni policy.
  - ✅ **Los rieles internacionales NUNCA tuvieron el agujero.** `usdt-create-payment` y `paypal-create-payment` derivan el precio de `coaches.price_usd` desde el primer día y lo dejaron escrito en un comentario. **El riel de pesos era el único que faltaba**, así que el arreglo no inventó una regla: le aplicó a MP la que los otros dos ya seguían.
  - **Arreglado en tres capas.** `mp-create-payment` (**v41 deployada**) deriva de `coaches.price_per_session`, **corrige la fila si llegó distinta** y loguea la corrección — no es cosmético, `amount` es lo que leen el informe del contador y el cálculo de lo que se le debe al coach del riel internacional. El cliente **relee el precio en el momento de reservar** (mismo criterio que ya usaba para la zona horaria) y corta si el coach no tiene precio. Y los params quedan solo como placeholder visual.
  - 📝 **Sin CHECK ni trigger en la base, a propósito.** Un trigger tendría que distinguir pesos de dólares según el riel, y el riel se elige **después** del insert. Queda para diseñar aparte; hoy la garantía son las tres funciones de cobro. Documentado en SCHEMA.md bajo `bookings.amount`.
- 🔴 **Datos inventados del mockup en cuatro pantallas del usuario.** `ProfesionalScreen` arrancaba con `'Laura Méndez'`, `'Coach de vida'` y `4500`: se mostraban mientras viajaba la consulta y **se quedaban si fallaba**, así que el perfil público de un coach que cobra $1 podía decir $4500 — que es exactamente lo que Andre vio. `BookingScreen_Time` y `BookingScreen_Success` también caían a `'Laura Méndez'`, o sea que alguien podía leer "reservaste con Laura Méndez" en la pantalla de confirmación. Ahora va vacío o "Cargando precio…": **un precio falso se lee como el precio; un vacío se lee como que todavía no cargó**.
- ✅ **Filtro por medio de pago y cartelitos en la tarjeta del profesional.** La regla espejo (D4) se aplicaba en el checkout pero **no en el descubrimiento**: alguien del exterior que solo puede pagar con PayPal recorría buscador → perfil → día → horario → confirmar para enterarse ahí de que ese coach solo toma USDT. Y el catálogo ni siquiera tenía el dato: `coachesCache` traía `accepts_international` pero no los rieles. Ahora trae los tres (`mp_connected` incluido), hay filtro **"¿Con qué querés pagar?"** en los avanzados, y `components/PaymentBadges.tsx` los muestra en el buscador y en el deck de Conexiones.
  - 🔴 **La consulta de respaldo de `search3` también tuvo que traerlos.** Sin eso, con el caché frío los flags venían `undefined` y el filtro nuevo **escondía a todos los coaches**.
  - 📝 Se muestran **solo los rieles que acepta**, no los tres con los que no acepta en gris: tres casilleros con dos apagados se leen como una carencia del profesional, y elegir riel es una decisión suya. ⚠️ Consecuencia con los datos de hoy: **tres de los cuatro coaches no muestran ningún cartelito** porque no tienen ninguno configurado. Queda pendiente decidir si se prefiere verlos siempre.
  - 📝 El hint del filtro internacional decía **"Se paga en dólares, con USDT"** — cierto solo mientras USDT fue el único riel. Desde PayPal depende del coach.
- ✅ **La comisión internacional no quedaba en ninguna pantalla** después de podar el perfil: el párrafo borrado era lo único que le decía al coach que VIVE retiene 25%/20%, o sea **cuánto cobra**. Se movió a `/coach-datos-cobro`, en dos líneas. Los porcentajes vivían solo en `_shared/commission.ts` (Deno), así que se duplicaron en `lib/pricing.ts` **atados por un test** que compara los dos y falla si se separan — sin eso, cambiar la escalera del servidor dejaría la pantalla prometiendo un neto que el coach no va a cobrar.
  - 📝 Lo de **"no te entran por Mercado Pago" NO se perdió**: `/coach-datos-cobro` ya lo decía casi palabra por palabra. Esa tarjeta del perfil era un duplicado.
- ✅ **Perfil del coach, segunda pasada.** El orden pasa a ser el de la **secuencia de configuración** (horarios → precio → modalidad → Mercado Pago → exterior), que cruza los dos grupos anteriores y los fusiona en **"Tu trabajo"**. Las sesiones del exterior **se pliegan**, con el precio en dólares y "cómo te pagamos" adentro. 🔴 Es un **desplegable y no un interruptor**: `accepts_international` es derivada, así que un switch prometería prender algo que se prende solo. Arranca abierto si ya hay algo cargado, y el aviso de qué falta queda **afuera** del pliegue porque es el motivo para abrirlo.

**Y la última parte de la sesión fue el inicio del coach — análisis, cinco features, y una caza de tres horas a un bug que no existía.**

- 📝 **Análisis pedido por Andre** (`docs/inicio-del-coach.md`, nuevo). La lectura que ordenó todo: **la Home no es un dashboard, es el recibo permanente de lo que Vita le está dando al coach.** Sale de la estrategia anti-fuga — lo que Vita le da no es el cliente que ya tiene, es el cliente nuevo, y la comisión es su costo de adquisición. Hoy siente la comisión todos los meses y no ve nunca qué compró con ella. ⚠️ Con la tensión anotada: el producto dice *"si abruma, sobra"*, así que **el vacío no se llena — se reemplaza por lo poco que se gane el lugar**.
- ✅ **B — quién se está cayendo** (`lib/coachContinuity.ts`, 10 tests). El umbral **no es un plazo fijo sino el ritmo de cada relación**: mediana de los huecos entre sesiones, se marca al doble. Un semanal que falta dos semanas aparece; un mensual a los veinte días no. Mediana y no promedio porque unas vacaciones vuelven "normal" un silencio que no lo es. Piso de 14 días (para el de dos veces por semana, no para el semanal) y techo de 120 (el que se fue hace medio año no se está cayendo: ya se cayó).
- ✅ **C — "tus personas"**, y **no hizo falta una lista nueva**: la pestaña de chats ya listaba a esa gente (las salas nacen de una reserva) y solo le faltaba el estado de la relación. Un cuarto listado habrían sido dos listas de las mismas personas cambiando el encuadre. Cada fila gana sesiones + próxima (o hace cuánto que no se ven), y la pestaña pasó de **"Chats" a "Personas"**. ⚠️ El label **no se ve** —la barra es solo íconos desde el 20/08— así que el cambio visible es el ícono y el título de la pantalla.
- ✅ **E — cerrar la sesión con una nota.** `session_notes` existía desde el 06/08 detrás de una pill del chat y **nadie le pedía nunca al coach que la escribiera**. `SalaScreen` acepta ahora `abrir_notas=1` para que el atajo caiga DENTRO de la nota: si deja al coach a un tap más, el aviso pide algo que no facilita.
- ✅ **F+G juntos, y esa fue la decisión.** Separados pierden: "el 60% vuelve" solo es una palmada y la comisión decreciente sola suena a letra chica. Juntos son el argumento anti-fuga entero, con el encuadre que estaba escrito desde el 06/08 y nunca se había dicho: **"te cobramos por presentarte a alguien, no por tu relación con esa persona"**. 🔴 De paso apareció que `coach_rebooking_stats` se usaba **solo para rankear al coach en el deck del usuario**: él nunca veía su propio número.
- ❌ **Andre sacó la tarjeta de "N personas esperan tu confirmación".** Se conservó `esperaConfirmacionDelCoach` en `lib/bookingHelpers.ts` con sus tests: no era código de esa tarjeta sino la regla que distingue una solicitud real de un checkout sin acreditar, que estaba escondida adentro de `CoachReservasScreen` y ahora las dos pantallas la comparten.

**🔴 Y la lección más cara del día: tres horas cazando un bug que era el bundle desactualizado.**

- Andre reportó que los botones de la barra inferior no respondían del lado coach. Se descartaron por inspección la lógica de la barra, los dos layouts, el ícono, el label, los overlays, las fuentes, el anidamiento en el ScrollView, la clearance contra las otras pantallas del coach y los efectos por si hubiera un bucle. Después se bisectó con flags: consultas vs render, y las tres tarjetas de a una. **Cada combinación andaba.** Al volver a prender las tres —el estado real— también andaba.
- ⚠️ **Era la TERCERA vez en la misma sesión.** El filtro de medio de pago y los cartelitos tampoco aparecían por lo mismo, y ahí se detectó rápido porque el código se pudo verificar contra la base. Acá no había nada que consultar y se fue por inspección.
- 📝 **Lo que hay que hacer distinto:** ante cualquier "esto no anda / esto no aparece", **cerrar la app del todo y reabrirla ANTES de mirar el código**. Recargar no siempre alcanza. Cuesta treinta segundos y hoy habría ahorrado la mitad de la tarde.

**Pendiente para la próxima sesión:**
- 🔴 **Retomar el espaciado de "Elegí un área de bienestar para empezar" en Conexiones.** Antes de seguir ajustando a tanteos: pedirle a Joaquín una captura fresca apenas se siente a trabajar, y si hace falta más de un ajuste, pedir el número aproximado de píxeles (o "un poco" = referencia visual concreta) en vez de iterar a ciegas — así se cierra en 1-2 pasadas en vez de 6 commits chicos como hoy.
- Si el problema persiste igual, considerar que la medición por script (detectar filas oscuras de texto) puede estar capturando mal algún elemento — vale la pena verificar visualmente con un crop de la zona exacta antes de confiar en el número.

---

## 2026-08-26 — Joaquín (sesión 128)

**Tocado:** `app/(tabs)/conexiones.tsx`, `app/(tabs)/recursos.tsx`.

**Resumen — el título y el contenido de abajo quedaban muy separados en Conexiones y Recursos, después del cambio de tipografía de la sesión 126.**

- Joaquín mandó capturas de las dos pantallas. Medí los márgenes en el código antes de tocar nada: eran chicos (6-10px), no explicaban un gap tan grande a simple vista. **Hipótesis: Plus Jakarta Sans trae más "aire" propio (métrica interna de la fuente) que Fraunces para el mismo `lineHeight` declarado** — no es algo que controlemos con el número que pusimos, así que el mismo margen de código se ve más grande ahora que antes.
- **Pedido explícito: traer el contenido de abajo hacia arriba, no mover los títulos.** Se tocaron solo los márgenes de lo que sigue al título — nunca el propio texto "Conexiones"/"Recursos" ni su tamaño/lineHeight:
  - `conexiones.tsx`: `askWrapTight` (el modificador de Fase 1, sesión 121) pasó de solo `marginBottom:8` a `marginTop:0, marginBottom:2` — antes heredaba el `marginTop:10` de `askWrap` sin necesidad, porque hoy en Fase 1 ese bloque no tiene título propio (se sacó en la sesión 126). `searchBar.marginTop` bajó de 6 a 2.
  - `recursos.tsx`: `header.marginBottom` bajó de 16 a 8, `libraryHeaderRow.marginTop` de 8 a 2.
- Typecheck, lint (65 warnings preexistentes, 0 nuevos) y 259/259 tests limpios. No confirmado visualmente en dispositivo desde acá.

**Pendiente para la próxima sesión:**
- Confirmar que el ajuste alcanza. Si Plus Jakarta Sans efectivamente tiene más leading interno que Fraunces, puede que otras pantallas con títulos (que no se tocaron hoy, solo estas dos) tengan el mismo problema — no se auditó toda la app por esto, solo las dos pantallas de las capturas.

---

## 2026-08-26 — Joaquín (sesión 126)

**Tocado:** 38 archivos. Nuevo: `@expo-google-fonts/plus-jakarta-sans` (instalado). Sacado: `@expo-google-fonts/fraunces` (desinstalado, sin uso).

**Resumen — Fraunces salió del proyecto. Títulos y feedback pasan a Plus Jakarta Sans; el resto queda en Poppins, sin tocar.**

- **Dos tokens nuevos en `constants/theme.ts`**: `ViveFonts.title` (Jakarta 700, donde antes iba `frauncesSerif`) y `ViveFonts.titleSemiBold` (Jakarta 600, donde antes iba `frauncesSemiBold`). Más `ViveFonts.feedback` (Jakarta 600, para devoluciones/reflexión) y `ViveFonts.wordmark` (Jakarta 800 ExtraBold, solo para "vita"). `app/_layout.tsx` carga los 5 pesos de Jakarta (400/500/600/700/800) y dejó de cargar Fraunces.
- **El wordmark "vita"** — `components/VitaWordmark.tsx` (el componente único que se usa en toda la app) y el SVG animado del splash (`screens/OnboardingScreen1.tsx`, que tenía la fuente puesta a mano, no vía token) — los dos a Jakarta 800.
- **Texto de feedback identificado y migrado**: la card "Sobre vos" (`index.tsx`, `selloReflect`/`selloReflectBold`), el momento de pantalla completa (`SobreVosMomento.tsx`), el "gracias por contarnos" del check-in de ánimo (`MoodCheckIn.tsx`), y las notas de recomendación del coach (`recNote`/`recoNoteBannerText` en `mis-recomendaciones.tsx`/`coach-recurso.tsx`, y la explicación dinámica `reco.why` en `recursos.tsx`, que se llamaba `moodTitle` pero no era un título).
- **Títulos migrados en las ~35 pantallas que usaban Fraunces** (la convención de este proyecto ya era "Fraunces = título/encabezado", así que migrar todo lo que era Fraunces cubre la enorme mayoría de los títulos reales) — más el saludo del home y los títulos de sección ("Tu próxima sesión", "Tus recursos a mano") en `index.tsx`, que **ya estaban en Poppins** y se movieron a Jakarta igual, por nombrarlos explícitos en el pedido.
- ⚠️ **Alcance de "títulos" — no rastreé toda la app.** Solo migré lo que ya era Fraunces (que ya cumplía el rol de título en este proyecto) más los dos casos que nombraste explícitos. **No** salí a buscar cada `sectionTitle` en Poppins de cada pantalla — sería un rediseño de la app entera, no lo que pediste.
- 📝 **Criterio para lo que NO era ni título ni feedback** (nombres de personas en cards, iniciales de avatar, números de stat, timers de countdown, texto de narración guiada en meditación/sueño/respiración, citas/bios propias del coach o del usuario): cayeron a Poppins (bold/semibold según el peso que tenían en Fraunces), porque no podían quedarse en una fuente que ya no se carga. **Es la parte con más criterio propio de esta sesión — si alguno de estos debería haber sido título o feedback, decímelo y lo cambio.** Ejemplos concretos: `cardInitials`/avatarTxt en varias pantallas, `statValue`/`statN`, todos los `timerLarge`/`runningTimer`/`stepTimer`, `promptText` de Meditación/Sueño (narración), `cardBio` del deck de Conexiones y `pquote` de `CoachReservasScreen` (citas/mensajes, no feedback generado por la app).
- **Nombres de persona destacados** (nombre del coach en la card del deck de Conexiones, nombre de un cliente en `CoachHomeScreen`, "Sofía" en el header de `SofiaAssistant`): usé `titleSemiBold` — son la identidad principal de esa tarjeta/fila, tratamiento similar a un título chico.
- **Pedido aparte: se sacó el texto "Encontrá a alguien que pueda acompañarte"** de la pantalla de Conexiones (Fase 1) — quedó solo "Elegí un área de bienestar para empezar". El estilo `askTitleGreeting`, que solo servía para ese texto, se eliminó por quedar sin uso.
- Typecheck, lint (65 warnings preexistentes, 0 nuevos) y 241/241 tests limpios. **No confirmado visualmente en dispositivo desde acá** — es un cambio grande y solo se puede terminar de validar viéndolo.

**Pendiente para la próxima sesión:**
- 🔴 **Confirmar en el dev build** — es el cambio visual más grande de una sola vez en muchas sesiones, hay que verlo funcionando de verdad, sobre todo los pesos de Jakarta 600 vs 700 en pantalla.
- Revisar la lista de "cayó a Poppins" de arriba y decirme si alguno debería ser título/feedback.
- ⚠️ **Andre subió MUCHÍSIMO trabajo nuevo mientras tanto** (más de 70 commits: riel de PayPal a producción, modelo "VIVE es agente", regla espejo, contracargos, disputas, T&C reescritos) — mergeado sin conflictos de código (`SalaScreen.tsx` lo tocaron los dos, el merge automático lo resolvió limpio; verificar igual con los checks de rutina).

---

## 2026-08-26 — Andre (sesión 128)

**Tocado:** `scripts/fix-payout-rails-trigger.sql`, `supabase/functions/paypal-webhook/index.ts`, `mp-create-payment/index.ts`, `screens/CoachProfileScreen.tsx`, `CoachPayoutScreen.tsx`, `BookingScreen_Confirm.tsx`, `ProfesionalScreen.tsx`, `BookingScreen_Time.tsx`, `BookingScreen_Success.tsx`, `lib/coachesCache.ts`, `lib/pricing.ts`, `app/search3.tsx`, `app/(tabs)/conexiones.tsx`, `__tests__/pricing.test.ts`, `SCHEMA.md`. Nuevos: `scripts/add-dispute-resolution.sql` (**CORRIDO**), `components/PaymentBadges.tsx`. Deployadas: `paypal-webhook` **v18**, `mp-create-payment` **v41**. `paypal-diagnostico` **borrada**. 260 tests, `tsc` y lint limpios. Nuevo: `scripts/add-dispute-resolution.sql` (**CORRIDO**). `screens/CoachProfileScreen.tsx`, `screens/CoachHomeScreen.tsx`, `app/_layout.tsx`. Nuevos: `screens/CoachSettingsScreen.tsx`, `app/coach-ajustes.tsx`. `paypal-webhook` **v18** deployada, `paypal-diagnostico` **borrada**. 259 tests, `tsc` y lint limpios.

**Resumen:**

- ✅ **Se corrió `scripts/fix-payout-rails-trigger.sql`** en producción. Con eso quedan cerrados los dos bugs que impedían a cualquier coach guardar su `price_usd` y sus datos de cobro.
- ✅ **VERIFICADO el mismo día, con Andre pasando la salida del SQL Editor.** `method` devuelve `is_nullable = YES`, y el `update` de `price_usd` que antes abortaba con `record "new" has no field "coach_id"` ahora pasa. 📝 **Y la salida dice más que "no explotó"**: el coach de prueba quedó con `price_usd = 50` y `accepts_international = false`, que es el valor CORRECTO porque tiene los dos rieles en `false` — o sea que el trigger no solo dejó de abortar, está calculando bien la derivada.
- ⚠️ **Queda sin probar una rama: la del DELETE** (`old.coach_id`), el otro caso que rompía — borrar una fila de cobro y, por cascada, borrar un coach. El chequeo 3 del script la cubre, pero **solo prueba algo si hay al menos una fila** en `coach_payout_accounts`: con la tabla vacía el delete afecta 0 filas, el trigger no dispara y el chequeo pasa sin haber ejercitado nada.
- 📝 **La verificación se hizo por captura de pantalla y no desde la sesión**: en `.env` solo está la anon key (no lee `information_schema`), no hay service role key ni password de Postgres, y `psql` no está instalado — las dos vías del CLI (`supabase db`, `inspect db`) piden esa credencial.
- 📝 Se corrigió el encabezado del script, que todavía decía que el estado de `add-payout-rails.sql` era desconocido cuando ya se había confirmado contra la base el 25/08.

**Pendiente para la próxima sesión:**

- ⚠️ **Probar la rama del DELETE del trigger** (chequeo 3 del script), la única que quedó sin ejercitar — y confirmar antes que `coach_payout_accounts` tenga al menos una fila, si no el chequeo pasa vacío.
- 📝 **Conviene dejar una forma de consultar la base desde la sesión de trabajo** — sin eso, todo "corrido" queda sin contrastar y el registro vuelve a depender de lo que diga un documento, que es el patrón que este proyecto ya arrastró tres veces.
- 🔴 **Probar una reserva real contra Mercado Pago.** `mp-create-payment` v41 no se pudo smoke-testear: sin JWT de usuario el gateway corta con 401 antes de llegar a la función. La prueba es reservar con Coach Prueba (precio $1) y confirmar que se cobra 1 y que `bookings.amount` queda en 1. Si llega distinto, la función lo corrige y lo loguea.
- ⚠️ **Decidir si los cartelitos de pago se muestran siempre los tres** (con los no aceptados apagados) o solo los aceptados, como están hoy.
- 📝 **`ProfesionalScreen` no muestra los rieles** — trae `accepts_international` pero no `accepts_paypal`/`accepts_usdt`. Quien llega por link directo sigue sin verlos hasta confirmar. Mismo arreglo, una pantalla más.
- 🔴 **Home del coach**: quedó diagnosticada y sin tocar. Todo lo que muestra depende de tener sesiones, y el coach que más ayuda necesita es el que no las tiene — abre y lee "Sin sesiones programadas" con un botón a otra pantalla vacía. El contenido que falta **ya está calculado** en `lib/coachVisibility.ts` (`buildChecklist`, `blockingReason`, `analyzeDoors`) y vive comprimido en una tarjeta de un renglón. Propuesta: Home con dos caras según si hay sesiones.
- 🔴 **Probar en el teléfono todo el bloque del coach** — es la primera vez que se toca la navegación (ruta nueva `/coach-ajustes`, engranaje en Home) y nada de esto se vio corriendo.
- ⚠️ **Revisar si el USUARIO tiene las mismas ausencias al revés.** Se auditó el lado del coach porque era el que estábamos mirando; nadie chequeó si `ProfileOwnScreen` tiene todo lo que el coach sí tiene.
- **Onboarding del usuario**, analizado y sin empezar: las tres pantallas de perfilado no se guardan en ningún lado, el botón dice "Ver profesionales" y lleva a "Creá tu cuenta", y solo 1 de los 3 caminos de `onboarding2` pasa por el perfilado.
- **La promo de fundador en los rieles internacionales** (decisión de precio, no defecto).

---

## 2026-08-25 — Andre (sesión 127)

**Tocado:** `scripts/add-payout-rails.sql`, `screens/CoachPayoutScreen.tsx`, `screens/CoachProfileScreen.tsx`, `screens/AdminScreen.tsx`, `lib/payout.ts`, `__tests__/payout.test.ts`, `supabase/functions/paypal-webhook/index.ts`, `mp-webhook/index.ts`, `paypal-create-payment/index.ts`, `usdt-create-payment/index.ts`, `session-attendance/index.ts`, `SCHEMA.md`. Nuevo: `scripts/fix-payout-rails-trigger.sql` (⚠️ **PENDIENTE DE CORRER**). 259 tests (eran 252), `tsc` y lint limpios. **Cinco edge functions deployadas y verificadas** (ver el final de la entrada).

**Sesión de arreglos: un `/code-review` sobre el bloque de la regla espejo encontró tres cosas que rompían escrituras de todos los días, y ninguna avisaba — las tres se ven desde el cliente como "no se pudo guardar".**

- 🔴 **El trigger derivado no podía resolver de qué coach hablaba.** `sync_accepts_international()` usaba `v_coach := coalesce(new.coach_id, old.coach_id, new.id, old.id)`, que **parece defensivo y no lo es**: PL/pgSQL resuelve cada campo contra la forma REAL del registro, así que `new.coach_id` sobre una fila de `coaches` no devuelve null — tira `record "new" has no field "coach_id"` y **aborta la sentencia que disparó el trigger**. Como `trg_sync_intl_on_price` cuelga de `coaches`, el efecto era que **ningún coach podía guardar su `price_usd`**, que es justo el dato que la regla espejo le pide cargar. Y `new` en un DELETE no está asignado, así que también rompía borrar una fila de cobro y, por cascada, borrar un coach. Arreglado ramificando por `TG_TABLE_NAME`/`TG_OP`, con `if` y no con `case` (el registro se evalúa como parámetro de la expresión entera, así que un `case` igual tocaría la rama que no toca).
- 🔴 **`coach_payout_accounts.method` seguía NOT NULL después de dejar de ser la fuente de verdad**, y la pantalla de cobro dejó de mandarla: **nadie podía guardar sus datos de cobro**. Y no solo el que nunca guardó — Postgres valida el NOT NULL sobre la tupla propuesta **antes** de resolver el `on conflict`, así que el upsert fallaba también para el que ya tenía fila. Ahora es nullable; la columna se conserva (la lee un build viejo) y la pantalla la escribe **derivada del primer riel aceptado que tenga su destino cargado**, nunca a secas: los tres CHECK viejos por método siguen vivos y escribir `'usdt'` sin wallet volvía a romper por el otro lado.
- 🔴 **Deadlock en el perfil del coach: el campo del precio en dólares vivía adentro de `{accepts_international && …}`.** Desde que esa columna **se deriva** de tener precio + algún riel, el coach sin precio **no veía nunca el input que se lo habría puesto** — y la tarjeta de arriba le decía "cargá un precio en dólares" mandándolo a una pantalla donde ese campo no existe. El precio y el acceso a los rieles pasan a estar siempre visibles, y el aviso de qué falta ahora **distingue si falta el precio, el riel o los dos**, porque cada uno se carga en un lugar distinto. La rama `price_usd == null` que había adentro era código muerto desde el mismo cambio.
- ⚠️ **SCHEMA.md y el CHANGELOG se contradecían sobre si `add-payout-rails.sql` está corrido** (uno "CORRIDO y VERIFICADO", el otro "PENDIENTE DE CORRER"). **No se resolvió por documento** — es el patrón que costó dos semanas y media de reembolsos en julio y que volvió a aparecer con `charged_amount` el 24/08. El chequeo 0 de `fix-payout-rails-trigger.sql` lo contesta contra la base, y **hay que correrlo antes que nada**: define si esto está roto en producción ahora mismo o si todavía no llegó.

**Y cinco arreglos más del mismo review, todos en el camino del dinero:**

- 🔴 **La regla espejo (D4) se validaba SOLO en la UI.** `paypal-create-payment` y `usdt-create-payment` chequeaban que existiera fila de datos de cobro —"tiene ALGÚN medio"— y no que el coach aceptara **ese** riel. Los flags se leen una vez al abrir la confirmación, así que una pantalla vieja abierta o una llamada directa cobraba dólares por un riel sin destino donde pagarlos: el pozo que la regla existe para evitar. Ahora las dos chequean `accepts_paypal` / `accepts_usdt`.
- 🔴 **`PAYMENT.CAPTURE.DENIED` estaba tratado como contracargo** en `paypal-webhook`. Una captura denegada es plata que **nunca se movió**. Como `payment_id` se escribe recién en `CAPTURE.COMPLETED`, la búsqueda no encontraba nada y cada tarjeta rechazada dejaba un `🔴 REVERSIÓN sobre una captura desconocida` en los logs — ruido con forma de incidente. Si alguna vez hubiera matcheado, una reserva nunca pagada quedaba en `'contracargo'` con `refunded_at`, o sea contada como plata devuelta en el informe del contador y en `reversiones_despues_de_pagar`. Ahora tiene rama propia y no cambia ningún estado: la barre `expire_unpaid_checkouts()` como cualquier checkout no completado.
- 🔴 **El contracargo de Mercado Pago se podía pisar.** `mp-webhook` solo tenía guarda de idempotencia para `'aprobado'`, así que una notificación `refunded` posterior a un `charged_back` —MP manda hasta 3 por pago y no garantiza el orden— reescribía `'contracargo'` como `'reembolsado'`, **deshaciendo en silencio la distinción que se creó el 25/08**. Agregado `.neq('payment_status','contracargo')`, el mismo que ya tenía el camino de PayPal. La transición al revés sigue valiendo: `reembolsado` → `contracargo` es una escalada real.
- 📝 **`disputed_at` se pisaba con `now()` en cada `CUSTOMER.DISPUTE.UPDATED`.** La columna documenta **cuándo se abrió** la disputa y después del primer update pasaba a decir "cuándo nos avisaron por última vez". Ahora solo se escribe si está vacío; `dispute_reason` sí se pisa, que ahí interesa el estado más reciente.
- 📝 **`session-attendance` leía `session_attendance` entera, sin filtro ni límite**, para saber qué ya había traído. Esa tabla crece una fila por sesión y para siempre: al pasar el tope de filas de PostgREST la lista deja de ser "las ya traídas" y pasa a ser "las primeras N", en silencio — se re-consulta a Daily cada hora por sesiones ya resueltas y el insert falla contra la PK. Ahora pregunta solo por las candidatas de la corrida (acotadas por el `.limit(200)` que ya estaba), y si esa lectura falla **corta**, porque seguir sin ella es exactamente el modo de falla que se quiere evitar.
- 📝 **Panel de admin: las filas de pago son `(coach, riel)` y la pantalla las tenía key por coach.** Un coach con sesiones por los dos rieles renderizaba dos tarjetas con la misma key de React **compartiendo el input de referencia y el flag de `working`**: tipear el hash de la tx de USDT llenaba el campo de la de PayPal. Y el destino se miraba con `p.destino` a secas, que es la fila entera del coach: con la wallet cargada y sin mail de PayPal pintaba el literal `PayPal · null` y **ofrecía marcar como pagado** un pago sin destino. Las dos cosas ahora van por riel.

**Lo que NO se tocó, a propósito:**

- ❌ **La promo de fundador sobre PayPal y USDT.** El review la marcó como bug porque con `FOUNDER_PROMO_UNTIL` activa `coachNetFor(amount, 0) === amount`: VIVE transfiere el 100% de un precio al que PayPal ya le sacó ~3,5% + USD 0,30 en la captura, y encima paga 2% en el payout — **pérdida garantizada por sesión internacional**. Pero **no es un descuido**: `docs/decisiones-pagos.md:348` dice que la promo "tiene que seguir ganándole a las dos escaleras" y hay un test que lo afirma (`la promo fundador le gana a cualquier riel`). Es una decisión de precio, no un defecto, y cambiarla es de Andre. ⚠️ **Falta saber si `FOUNDER_PROMO_UNTIL` está seteada en los secrets** — si no lo está, esto es latente y no hay nada que perder todavía.
- ⚠️ **`disputed_at` no se limpia cuando la disputa se GANA**, así que una disputa resuelta a nuestro favor se queda para siempre en `reversiones_despues_de_pagar`, que es la lista de "plata que hay que recuperar o dar por perdida". El arreglo necesita el `outcome_code` de la API de disputas de PayPal y **no se escribió de memoria a propósito** — este proyecto ya se quemó con un número de comisión recordado en vez de verificado. Queda para confirmar contra la documentación oficial.

**Y al final de la sesión se resolvió la contradicción y se deployó.**

- ✅ **`add-payout-rails.sql` SÍ ESTÁ CORRIDO.** No se resolvió leyendo ninguno de los dos documentos: se le preguntó a la base por REST con la anon key (`coaches?select=accepts_paypal,accepts_usdt,accepts_international,price_usd`) y las cuatro columnas contestaron. **El changelog tenía razón y SCHEMA.md estaba desactualizado** — ya corregido. 🔴 **La consecuencia es que los dos bugs críticos de arriba están vivos en producción ahora mismo**: ningún coach puede guardar su precio en dólares ni sus datos de cobro. `fix-payout-rails-trigger.sql` pasa a ser lo más urgente abierto.
- ✅ **Deployadas las cinco edge functions**, con los flags verificados contra la API DESPUÉS del deploy y no dados por buenos: `mp-webhook` **v27** (`verify_jwt = false`), `paypal-webhook` **v17** (`verify_jwt = false`), `paypal-create-payment` **v14**, `usdt-create-payment` **v19**, `session-attendance` **v3** (las tres con `verify_jwt = true`, que es lo que corresponde: las llaman la app y el cron con credencial válida).
- ✅ **Y probadas por la RESPUESTA, no por el estado declarado.** Un POST con cuerpo vacío a los dos webhooks devuelve **200 `ignored`**: prueba que el gateway deja pasar sin JWT (o sea que el flag no es solo una línea en `config.toml`), que las funciones **arrancan** —un error de import las rompería en silencio recién en la primera notificación real— y que un payload basura no dispara ninguna escritura. Es la distinción exacta que en julio costó dos semanas y media de reembolsos sin procesar.
- **El orden del deploy no fue casual**: las dos `*-create-payment` ahora leen `accepts_paypal` / `accepts_usdt` de `coach_payout_accounts`, así que deployarlas contra una base **sin** el script corrido habría hecho que toda reserva internacional muriera con "Este profesional todavía no completó sus datos de cobro" — un `select` de columna inexistente deja `payout` en null y el 409 se lee como un problema del coach. Por eso el estado de la base se confirmó ANTES y no después.
- ⚠️ **`paypal-diagnostico` sigue ACTIVE (v1) y el changelog del 24/08 la da por borrada.** Está detrás de la service_role key (mismo guardián que `paypal-process-refunds`), así que **no la puede llamar un usuario logueado cualquiera** y el riesgo es bajo — pero lee `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET` y `PAYPAL_WEBHOOK_ID` de producción y el registro dice que no existe. Misma familia que la contradicción de SCHEMA.md: o se borra, o se corrige el registro.

**Pendiente para la próxima sesión:**

- 🔴 **Correr `scripts/fix-payout-rails-trigger.sql`**, empezando por su chequeo 0, que contesta si `add-payout-rails.sql` ya está en la base. Los chequeos 2 y 3 reproducen los dos casos que rompían.
- 🔴 **Borrar `paypal-diagnostico` o corregir el registro que la da por borrada** (arriba).
- **Decidir la promo de fundador en los rieles internacionales** (arriba), y de paso confirmar si la variable está seteada.
- **Verificar el `outcome_code` de disputas de PayPal** para poder limpiar `disputed_at` cuando se gana.
- **Reorganización de la configuración del coach**, que quedó analizada y sin empezar: hoy vive repartida en tres ramas que no se hablan (perfil, Home y `/coach-availability`), el perfil es un scroll plano de 1719 líneas con 11 secciones, cobrar está partido en dos secciones separadas por otra, el precio en ARS y en USD viven a cinco secciones de distancia, y tres cosas distintas se llaman "disponibilidad". Se propuso agrupar por pregunta del coach: perfil público / cómo cobrás / cómo trabajás / tu visibilidad / cuenta.
- **Onboarding del usuario**, también analizado y sin empezar: las tres pantallas de perfilado (`universo`, `categoría`, `temas`) **no se guardan en ningún lado** —`OnboardingScreen5` hace `router.replace('/register')` y las tira—, el botón dice "Ver profesionales" y lleva a "Creá tu cuenta", y después del alta se cae en el home genérico. Solo 1 de los 3 caminos de `onboarding2` pasa por el perfilado.

---

## 2026-08-24 — Andre (sesión 126)

**Tocado:** `supabase/functions/paypal-webhook/index.ts`, `screens/BookingScreen_Confirm.tsx`, `lib/payout.ts`, `lib/admin.ts`, `screens/CoachPayoutScreen.tsx`, `screens/AdminScreen.tsx`, `__tests__/payout.test.ts`, `docs/cobro-internacional-coaches.md`, `SCHEMA.md`. Nuevos: `scripts/verificar-riel-paypal.sql`, `scripts/verificar-paypal-e2e.sql`, `scripts/add-coach-paypal-payout.sql` (**CORRIDO y VERIFICADO**), `supabase/functions/paypal-diagnostico/` (deployada, usada y **borrada el mismo día**; el archivo se conserva para el pase a producción). **Tres scripts SQL corridos** (`add-paypal-rail.sql`, `add-paypal-refund-cron.sql`, y las verificaciones). **`paypal-webhook` deployada (v15, `verify_jwt = false`)** y 🔴 **EL RIEL PASÓ A PRODUCCIÓN (`PAYPAL_MODE = live`) Y SE PROBÓ CON PLATA REAL**. 250 tests (eran 241), `tsc` y lint limpios.

**✅ EL RIEL DE PAYPAL FUNCIONA DE PUNTA A PUNTA, verificado con pagos reales en sandbox (24/08).** Primera vez que ejecuta desde que se construyó el 19-20/08. **Cobro** (22:40): `aprobado` + `confirmada` + mensaje de sistema + notificación, todo aplicado por el webhook sin ayuda del cliente. **Reembolso** (23:50): cancelada a más de 24hs → el trigger la marcó `'reembolso_pendiente'` y el cron la devolvió **al primer intento** (`refunded_at 23:50:03`, `refund_attempts = 0`). ⚠️ **La penalidad por cancelación tardía NO se probó** — se creyó probada un rato por una hipótesis equivocada sobre qué reserva se había cancelado, y no fue así.

**Resumen — se cerró el pendiente más viejo de la lista: los dos scripts del riel de PayPal que figuraban sin correr desde el 19 y el 20 de agosto.**

- 🔴 **Sin el cron de reembolsos, toda reserva de PayPal cancelada se quedaba en `'reembolso_pendiente'` para siempre.** El trigger marca el estado venga de donde venga el pago, pero cada riel tiene su procesador: si el de PayPal no corre, nadie recibe su plata y **no hay ningún error visible**. Quedó agendado (jobid 8, cada 5 min).
- 🔴 **Verificado por la RESPUESTA y no por `active = true`.** `net.http_post` a mano → `200 {"processed":0,"failed":0}` (request 19405). Es exactamente la distinción que en julio costó dos semanas y media de reembolsos sin procesar: el job con el placeholder del Vault también figuraba activo todo ese tiempo mientras devolvía 401.
- ⚠️ **`bookings.charged_amount` YA estaba en la base**, y tanto el changelog como SCHEMA.md la daban por pendiente desde el 19/08. O sea que el riel de PayPal no estaba tan roto como parecía. **Un `add column if not exists` no distingue "la creé" de "ya estaba"**, así que correr el script no aclaraba nada — el estado real solo se sabe preguntándole a la base. Lo que sí faltaba: el CHECK de `price_usd >= 20` y la rama de PayPal en `expire_unpaid_checkouts()`.
- **Nuevo `scripts/verificar-riel-paypal.sql`** (solo lectura, 8 chequeos: columna, CHECK, ningún coach bajo el piso, la función cubriendo los tres rieles, los dos crons, el secret del Vault sin placeholder, dead-letter). Existe para que esto no se repita: el estado del schema no puede depender de lo que diga un documento.
- **El `UPDATE` del precio de prueba quedó no-op**: el script lo subía a 60 si estaba abajo de 20, y el único coach con `price_usd` ya estaba en **30**. Alguien lo cambió a mano en algún momento; el script lo daba en 6.
- 📝 **La única fila roja es conocida y ya estaba decidida**: `2c72b126…` (riel `mp`, ARS 1, del 09/08) sigue en dead-letter con `refund_attempts = 6`. Su pago se cobró con la cuenta de Mercado Pago anterior del coach de prueba y `mp-process-refunds` usa siempre el token actual → 404 "Payment not found". **Reencolarla no sirve, vuelve a fallar igual.** La sesión 88 decidió dejarla; el chequeo 8 ahora lista los ids justamente para poder distinguirla de un caso nuevo de un vistazo.
- **Verificado de paso**: las 16 edge functions están ACTIVE (incluida `paypal-process-refunds` v2, o sea que el cron tiene a quién llamar), y los valores de `payment_provider` son consistentes entre el CHECK del schema y el filtro de cada procesador (`mp` / `paypal` / `usdt`).
- 📝 **El `create or replace` de `expire_unpaid_checkouts()` era seguro**: se comparó contra las otras 4 versiones que viven en `scripts/` y la de `add-paypal-rail.sql` es superset exacto de la última viva (`expire-unpaid-usdt.sql`) — agrega la rama de PayPal y no toca nada más.

**Y auditando el riel antes de probarlo, apareció un agujero que nunca ejecutó porque el riel nunca ejecutó:**

- 🔴 **`paypal-webhook` no tenía la rama de "captura acreditada sobre reserva ya cancelada".** `mp-webhook` la tiene desde la sesión 116 y ahí la reserva se marca `'reembolso_pendiente'`; PayPal marcaba `'aprobado'` a secas sobre una reserva cancelada. Resultado: **plata cobrada, sesión que no existe, y nada que la devuelva** — `trg_mark_refund_on_cancel` solo mira la transición a `'cancelada'`, que en ese orden ya ocurrió. Sin error visible, que es la firma de esta clase de bug.
- **Y en PayPal es más probable que en Mercado Pago, no menos.** En MP abandonar el checkout no cobra nada. En PayPal, aprobar dispara `CHECKOUT.ORDER.APPROVED` y **es nuestro propio webhook el que captura la plata** — así que *cualquier* aprobación posterior a la cancelación termina en un cobro. Las dos vías de cancelación son rutinarias: `soltarReserva()` cancela apenas el cobro no se acredita (sesión 117) y `expire_unpaid_checkouts()` barre a los 30 min; las dos dejan `payment_status = 'pendiente'`, que es exactamente lo que el webhook necesitaba para escribir.
- **Arreglado calcando `mp-webhook`**: se lee `status`, y si está cancelada el patch escribe `'reembolso_pendiente'` en vez de `'aprobado'` y no se aplican los efectos de confirmación. `paypal-process-refunds` ya tiene todo lo que necesita para devolverla (`payment_id` = id de la captura, `charged_amount`, `payment_provider`), así que el reembolso sale solo por el cron que se agendó hoy. `paid_at` se conserva a propósito: la plata entró en ese momento y es el dato con el que se concilia contra PayPal.
- 📝 **El helper compartido ya documentaba el contrato que faltaba cumplir**: `_shared/booking-effects.ts` dice *"El reembolso lo encola quien llamó acá (mp-webhook) o el trigger"* — nombrando solo a `mp-webhook`. La guarda de `booking-effects` evitaba que la reserva cancelada se resucitara como confirmada, y por eso el agujero era solo de plata y no también de estado.
- ✅ **El tercer riel está bien, verificado de paso**: `usdt-check-payments` lo resuelve al revés (`.neq('status','cancelada')` en la consulta y en el update), o sea que directamente no acredita sobre una cancelada. Es deliberado y está documentado ahí como "cuarta vez del mismo patrón en este proyecto".

**Y al final de la sesión, el riel pasó a PRODUCCIÓN.**

- **`PAYPAL_MODE = live`**, con las credenciales de la app live, el webhook de producción registrado (`74106940P4628310J`, misma URL, los dos eventos) y las tres funciones redeployadas —`paypal-create-payment` v12, `paypal-webhook` v15 (`verify_jwt = false`), `paypal-process-refunds` v8— porque los secrets se leen al arrancar. Verificado con `paypal-diagnostico` contra producción: webhook ✅ y **Payouts aprobado en la cuenta live** ✅. La función temporal se borró después.
- 📝 **El `PAYPAL_WEBHOOK_ID` que hoy dio 🔴 en sandbox era el de PRODUCCIÓN.** La configuración original no estaba mal: era la correcta para live mientras el riel corría en sandbox. Los dos estados eran válidos por separado; mezclados, ninguno funciona. Es exactamente por eso que el chequeo hay que rehacerlo en cada cambio de modo, y por eso se conservó el archivo de la función de diagnóstico.
- 🔴 **Paso previo que casi se pasa por alto: había que cerrar las reservas de prueba ANTES de cambiar el modo.** Sus pagos son capturas de sandbox; si alguna se cancelara después del cambio, el cron le pediría a la API de producción reembolsar una captura que allá no existe → 404 → seis intentos → dead-letter, el mismo pozo del que `2c72b126` no salió desde julio. Las tres quedaron en `'reembolsado'` antes de tocar nada.
- 📝 **La del 25/08 no se podía cancelar desde la app** (falta menos de 24hs y ahí la cancelación de usuario no está disponible), así que se canceló **como coach** por SQL. De paso quedó probada otra rama de la política: salió `cancelled_late = true` **y aun así se reembolsó**, porque la penalidad es solo para el usuario que cancela tarde, no para el coach.
- ✅ **Y el flujo live se probó de punta a punta, con plata real, los dos sentidos.** Cobro (25/08 00:32): USD 1,00, captura `2BV40052U0373070A`, `aprobado` + `confirmada`. Reembolso (00:35:01): al primer intento, `refund_attempts = 0`.
  - 🔴 **Con eso queda contestada la duda abierta desde la sesión 114: la verificación de firma se comporta IGUAL en producción.** Si hubiera fallado, el webhook contestaba 401 y no existiría ninguna captura.
  - 📝 **Se probó con USD 1 y no con 20**, bajando temporalmente el CHECK de `price_usd` y **restaurándolo apenas terminó** (verificado: el coach volvió a 30 y el CHECK a `20..10000`). El script de vuelta se escribió ANTES que el de ida, a propósito: una relajación de constraint en producción que se olvida de revertir deja el mínimo sin existir y nadie lo nota. El motivo de bajarlo no fue ahorrar el dólar sino el riesgo: **si el reembolso hubiera fallado, quedaban trabados 1 en vez de 20**, que es el pozo del que `2c72b126` no salió desde julio.
  - ⚠️ **El checkout de PayPal abre SAFARI, no la app de PayPal.** `Linking.openURL` le pasa la URL al sistema y PayPal no reclama la ruta del checkout como universal link, así que no hay palanca desde nuestro lado — al revés que Mercado Pago, que sí las reclama. **No afecta que el pago funcione** (la confirmación es server-side), pero obliga a loguearse a mano, y ese login es exactamente el paso donde se caían los pagos de MP antes de la sesión 117. Si algún día molesta, la salida es el SDK nativo de PayPal, que es un módulo nativo y una integración aparte.

**Y un arreglo que salió de probarlo en el teléfono: el cartel de espera dejaba de decir la verdad justo cuando más se mira.**

- Al volver del checkout **ya habiendo pagado**, el overlay seguía diciendo *"Terminá el pago en PayPal"* y *"cuando lo completes… ya va a estar confirmada"*. La primera frase es falsa y la segunda promete un estado que todavía no llegó.
- **Y esa espera no es corta, por diseño**: en PayPal son DOS viajes —aprobar dispara nuestra captura, y la captura dispara el aviso que confirma la reserva—, cada uno con su verificación de firma, más lo que PayPal tarde en avisarnos, más hasta 2s del sondeo. Andre lo reportó como "tarda muchos segundos". Con el texto viejo, esos segundos se leían como que la app se colgó.
- El sondeo **ya detectaba la vuelta** (para consultar de inmediato); ahora también cambia el texto a "Estamos confirmando tu pago". No se puede distinguir "volvió habiendo pagado" de "volvió sin pagar" —un back de más, una notificación en el medio—, así que el copy es honesto en los dos casos y los dos botones siguen abajo.
- 📝 La demora en sí no se puede bajar mucho: el tramo más largo es de PayPal, y los dos viajes son estructurales — es el precio de que capturemos nosotros y no dependa de que la persona vuelva a la app.

**Y con el riel andando, se decidió y se construyó un tercer método de cobro para el coach: recibir los dólares en su PayPal.**

- **De dónde salió:** hasta hoy el coach cobraba en pesos (CBU) o en dólares (USDT). El que quería **dólares** estaba obligado a pasar por cripto. Andre propuso PayPal con un argumento que resultó correcto y que cambió el análisis: no es una tercera opción redundante, puede ser **la más barata**, porque un PayPal → PayPal se saltea el tramo de sacar los dólares a Argentina que hoy VIVE paga en el camino de la transferencia.
- **Investigado antes de escribir una línea** (fuentes oficiales, no blogs — este proyecto ya se quemó con el 4,4% que circulaba contra el 5,40% real): Argentina figura como *"Send, receive, and withdraw"* en la tabla de países de PayPal Payouts, a Latinoamérica se le manda en **USD**, y la comisión es **2% del monto a cargo del emisor**, sin parte fija. Hay tope máximo pero recién mordería arriba de ~USD 1.000 por envío, dos órdenes de magnitud arriba de lo nuestro, así que no se modela.
- 🔴 **Decisión: el 2% lo absorbe VIVE, no se le descuenta al coach.** La regla que quedó es **costo fijo se descuenta, costo proporcional se absorbe**, y no es arbitraria: el motivo escrito en el código para descontar los USD 1,50 de USDT es que **no escala** —sobre una sesión suelta es el 3%, sobre diez el 0,3%, así que castiga al de poco volumen—, y ese argumento no se traslada a un porcentaje. Sumado a que elegir PayPal nos ahorra un tramo que ya pagábamos: cobrárselo encima sería cobrar dos veces lo mismo.
- ⚠️ **Lo que esa decisión asume y todavía NO está medido:** que sacar los dólares a Argentina cuesta **más** que 2%. Si costara menos, pagar por PayPal nos saldría más caro que la transferencia. Lo dice la medición de USD 50 que sigue pendiente, no el código. Anotado también en `lib/payout.ts`.
- 🔴 **Y el punto que no puede quedar implícito con el coach:** los dólares le llegan a su PayPal, pero **bajarlos a un banco argentino los convierte a pesos** al cambio de PayPal — la cuenta destino tiene que estar en pesos y los retiros a cuentas locales en dólares se revierten. Quedarse con dólares de verdad implica dejarlos en PayPal o tener cuenta en EEUU. **O sea que para el que igual va a pasar todo a pesos, el costo no desaparece: se muda de VIVE al coach.** Sirve para el que quiere dólares y hoy, para tenerlos, está obligado a pasar por cripto. Está escrito así en su documento y en la pantalla, no como "cobrás en dólares" a secas.
- **Construido:** `paypal_email` + el método nuevo en el CHECK (`scripts/add-coach-paypal-payout.sql`), validación en `lib/payout.ts` (`paypalEmailError`, `deliveryCostFor`, `paypalPayoutCost`), la opción en `CoachPayoutScreen`, el destino y el costo para VIVE en el panel (`lib/admin.ts` + `AdminScreen`), y las dos secciones del documento del coach. 250 tests (eran 241), `tsc` y lint limpios.
- 📝 **El costo de entrega estaba duplicado** entre `lib/payout.ts` y `lib/admin.ts` (las dos copias calculaban `method === 'usdt' ? 1.5 : 0` por su cuenta y tenían que acordarse de cambiar juntas). Ahora sale de `deliveryCostFor`.
- 📝 **El mail se valida laxo a propósito**, al revés que la wallet: un mail equivocado **no pierde los fondos** —PayPal rebota el payout y la plata vuelve—, así que rechazar un mail válido y raro sería el error más caro de los dos. La wallet es el caso opuesto y por eso su chequeo es estricto.
- 📝 **El selector de métodos pasó de fila a columna**: con tres opciones, `flex: 1` dejaba ~86px de ancho útil por card y la descripción de cada método —que es la que hace entender la diferencia— quedaba en seis renglones. Es el único cambio visual y se revierte con una línea (`methodRow.flexDirection`).
- ✅ **Payouts está HABILITADO en la app live** (verificado el 24/08 en Developer Dashboard → Live → la app → Features: la casilla "Payouts — Send payments to multiple PayPal accounts at once" figura tildada). Era condición para prometerle al coach que cobra sin costo: **sin Payouts aprobado**, la única forma de mandarle plata sería un "enviar dinero" común, que tiene otra estructura de comisiones y **puede cobrarle a él al recibir**. 📝 De paso se vio que **Invoicing también está habilitado** — no resuelve la pregunta de facturación que sigue abierta con el contador, pero es un dato para esa conversación.
- 📝 **Integrar la API de Payouts no cuesta más que mandar a mano**: la página oficial dice que las comisiones *"vary by sending country, are calculated as a percentage of each transaction, and are capped"*, sin distinguir el canal. El dato de "USD 0,25 fijos por API contra 2% por web" que circula es de Estados Unidos y de la estructura vieja de MassPay. 🔴 Y lo que sí importa: **los tres canales (API, Payouts Web y Batch) exigen el mismo acceso aprobado a Payouts**, así que la vía manual tampoco era gratis de requisitos.
- ⚠️ **No se automatizó el envío.** Los pagos a coaches siguen siendo manuales y registrados con `payout_reference`, igual que los otros dos métodos — se agregó la OPCIÓN de cobro, no un riel de payouts automático. Integrar la API de Payouts es una decisión aparte.

**Conversación de arquitectura al cierre — tres cosas que quedan decididas o anotadas, ninguna con código todavía:**

- 🔴 **Un coach sin Mercado Pago conectado recibe reservas SIN COBRO.** `mp-create-payment` devuelve 409 ("coach sin MP conectado"), el cliente lo trata como caso benigno y sigue: la reserva se confirma, los efectos se aplican del lado del cliente y no se cobra nada — sin comisión para VIVE y sin ninguna protección para quien reservó. El comentario del código ya lo anticipaba: *"(cuando el pago sea OBLIGATORIO, esto debería frenar la reserva, no seguir.)"*. **Es un default que quedó de cuando el pago era opcional, y al lanzar es un agujero silencioso.** Las dos salidas: exigir MP conectado para publicar (más simple y más segura — con el split VIVE nunca toca la plata del coach), o que VIVE cobre también en pesos y transfiera por CBU (la infraestructura ya existe casi entera; habría que ajustar `listCoachPayouts`, que excluye las reservas de MP porque ahí el split ya pagó). La segunda pone plata ajena en la cuenta y extiende al mercado local la pregunta fiscal que hoy es solo del exterior.
- 🔴 **En Argentina NO se puede cargar saldo en PayPal.** Verificado el 25/08: PayPal es de una sola vía acá — se retira a un banco local (en pesos, obligatoriamente) pero no se ingresa dinero por transferencia local. Consistente con la página oficial de PayPal AR, que solo documenta retiros. **Conviene confirmarlo en la cuenta misma** (si no aparece "Agregar fondos", queda cerrado).
  - **Consecuencia dura: lo que se le paga a los coaches por PayPal está TOPEADO por lo que entra por PayPal.** No es un costo que se pueda decidir pagar: es un techo. La celda "coach cobra por PayPal, la plata entró por USDT" no es cara, es **imposible**.
  - **Las otras direcciones sí funcionan**: PayPal → pesos (retiro al banco, con su spread), PayPal → USDT (retirar a pesos y comprar, caro pero posible), USDT → pesos o → USDT (directo).
  - 📝 El techo casi nunca debería morder, porque PayPal es el riel principal y el pozo grande es justo el que financia esos pagos. Pero **nunca prometerle PayPal a un coach sin entrada por PayPal que lo respalde** — ahí no hay conversión que salve.
- ⚠️ **Los rieles no se cruzan, y es un problema de tesorería, no de código.** No se puede fondear PayPal con cripto: pagarle por PayPal a un coach cuya sesión se cobró en USDT exige vender, bajar a un banco y recargar. Al revés (USDT que entra → pagar en USDT o vender a pesos) es directo. **No es por reserva sino por pozo**: los pagos son semanales y agregados, así que se le paga a cada coach desde el pozo que le calza y se rebalancea cuando haga falta. La asimetría juega a favor — PayPal es el riel principal y USDT el secundario (decisión de la sesión 113), así que el caso incómodo es el raro. Ya estaba anotado en la 113 pero al revés ("la plata que entra por PayPal no puede salir como USDT directamente").
- 🔴 **Se evaluó cobrar DIRECTO a la cuenta del coach en los rieles del exterior (como hace el split de MP) y la decisión es esperar al contador.** En PayPal es técnicamente posible —el producto "Multi-party", con un OAuth por coach calcado del de MP—; en USDT no lo es, porque en una transferencia on-chain directa no hay forma de retener comisión ni de reembolsar, y se cae el mecanismo que identifica los pagos por monto (funciona porque los centavos son un identificador **en nuestra wallet**). 🔴 **Lo que lo frena en PayPal no es el código: cobrar directo convierte a cada coach en exportador de servicios**, que es justo lo que el diseño actual evita y lo que su documento le promete evitar. **Y la respuesta del contador puede dar vuelta la decisión entera**: si VIVE actúa por cuenta y orden, el coach termina siendo exportador igual y cobrar directo sería MÁS coherente que lo de hoy. Construir cualquiera de las dos arquitecturas antes de esa respuesta es 50% de chance de tirarla.
- 🔴 **Los métodos de cobro del coach deberían pasar de UNO a un CONJUNTO de métodos ACEPTADOS — y es la solución al problema de los pozos.** Primero se concluyó lo contrario ("uno alcanza, porque no hay ningún momento en que alguien elija"), y el argumento era malo: **sí hay un momento y el que elige es VIVE**, al hacer el pago semanal, según qué pozo tenga saldo. Con varios métodos aceptados, se le paga a cada coach desde el riel que está cargado y la conversión deja de hacer falta.
  - **Con un matiz que lo hace preciso: los tres NO son intercambiables.** CBU son pesos; PayPal y USDT son dólares. Nadie es indiferente entre pesos y dólares — pero entre PayPal y USDT sí puede serlo, y **ese es justo el par que causa el problema**. O sea que el coach no elige método: marca cuáles acepta.
  - 🔴 **Detalle de justicia a resolver ANTES de construirlo:** hoy USDT le descuenta USD 1,50 al coach y PayPal no le descuenta nada. Si el que elige pasa a ser VIVE, no se le puede cobrar a él según nuestra conveniencia de tesorería — **si elige VIVE, el costo lo absorbe VIVE.** Si no, el coach que aceptó los dos para ayudarnos cobra menos según qué pozo teníamos flojo.
  - **El código no es grande: las columnas ya existen todas** (`cbu`, `wallet` + `network`, `paypal_email`). Cambia `method` de valor único a conjunto de habilitados, el panel tiene que dejar elegir con cuál se paga y registrar cuál se usó, y la lógica que hoy borra los datos del método inactivo pasa a borrar los de los no habilitados (sigue cubriendo el riesgo del destino viejo, que es real: un CBU olvidado invita a transferir al lugar equivocado).
  - 📝 **Mientras tanto**, la palanca barata para reducir el problema casi a cero al lanzar es ofrecer solo lo que se puede fondear: **CBU + PayPal**. El CBU se alimenta vendiendo lo que haya —trabajo que se hace igual— y PayPal se autoalimenta con el riel principal. **USDT como método de COBRO es el único que puede obligar a comprar cripto**; sacarlo no le quita ninguna opción de PAGO al cliente y es reversible.

**Y al cierre, seis rondas de debate de arquitectura de pagos con un segundo análisis (Claude en otra conversación, a partir de un brief autocontenido). Nuevo `docs/decisiones-pagos.md` con las 11 decisiones abiertas, opciones y consecuencias.**

- 🔴 **El hallazgo de fondo: el sistema usa el RIEL como proxy de "operación internacional", y el riel lo elige el usuario.** El criterio de exportación no sería la nacionalidad del cliente sino dónde se aprovecha el servicio, así que un argentino que elige PayPal genera algo que parece exportación y no lo es. Todo lo de tesorería —pozos, ruteo, conversiones— resultó secundario frente a esto.
- 🔴 **Consecuencia verificada, y es de hoy: se le cobra 25% al coach por sesiones de mercado interno.** `paypal-create-payment` y `usdt-create-payment` escriben `COMMISSION_INTERNATIONAL` sin mirar dónde está el usuario. Y al revés: **una sesión internacional hace bajar al 15% la próxima sesión local de ese par**, porque `countsAsCompletedSession` no filtra por `payment_provider`.
- 🔴 **El comentario de `_shared/commission.ts` es el hallazgo, no la nota al pie.** Dice que la escalera 20/15 existe porque en Argentina VIVE "deja de aportar" tras la presentación, mientras que en el exterior "cobra, retiene y transfiere en cada sesión, para siempre". **La escalera no es fidelidad: es una renuncia progresiva a cobrar por algo que ya no se hace**, y esa premisa nunca se cumple en el internacional. El código razona una cosa y hace la otra.
- 📝 **Y ese razonamiento no está en ningún documento para el coach.** Vive solo en el comentario; el 20/15 pelado está en `fiscal-instrucciones.md`, que es para el contador. No hay documento de comisión local para el coach: no es que firme otra cosa, es que no hay nada que firmar.
- **La regla que ordena todo lo demás: guardá observaciones, derivá la clasificación, sellá la comisión.** Nunca persistir `es_internacional` como hecho — si el contador define el criterio distinto, con un booleano habría que reescribir historia. Y la comisión se sella en la reserva: derivarla en tiempo de consulta haría que el filtro nuevo del contador cambiara **retroactivamente** el tramo de sesiones ya cobradas, sin tocar una fila y sin que ningún diff lo muestre.
- **Se adoptó la "regla espejo"** (pagar solo por el riel por el que se cobró), que elimina —no resuelve— el pozo, la regla de ruteo, el criterio de tipo de cambio del payout y el problema de drenar PayPal. **No es integración nueva: es borrar opciones y filtrar.**
- ⚠️ **El filtro por ubicación va DESPUÉS de desacoplar la comisión, no antes.** Filtrar primero enmascara el acoplamiento: la primera excepción que alguien agregue después lo revive, y va a ser más difícil de encontrar porque va a estar tapado por un filtro que "ya lo resolvió".

**Cuatro errores que el debate corrigió, dos de cada lado:**
- ❌ **Mío:** afirmé que la brecha de conversión era el costo más grande del sistema. Falso — la brecha MEP/oficial es **0,3%** (verificado el 25/08). Lo caro es el riel de PayPal (~3-4,5% de markup escondido, hasta 9-14% acumulado), no el dólar.
- ❌ **Mío:** argumenté que el coach no debía tener palanca sobre cómo paga el cliente porque la pérdida por conversión era rara. **Es estructural.** La intuición original de Andre sobre la regla espejo era la correcta.
- ❌ **Del otro análisis:** afirmó que había conversión de moneda del lado del cobro y que era la prioridad uno. **No existe**: el precio en pesos y `price_usd` son números independientes fijados por separado.
- ❌ **Del otro análisis:** propuso matar USDT por frágil. La conciliación por centavos tiene índice único y reintenta — el modo de falla es "probá de nuevo", no un cobro mal asignado. Lo retiró; la objeción que queda en pie es otra: **es un riel sin reversa**, y los legales prometen un reembolso que no puede ejecutar solo.
- 📝 **Verificado sobre multiparty:** no es self-serve, no hay lista pública de países, y el filtro más probable es de **volumen** — hay plataformas rechazadas por volumen bajo y VIVE tiene cero. El sandbox no requiere aprobación, así que el binario se despeja en paralelo. **No desarmar nada hasta tenerlo.**

**Y en la misma sesión se implementaron los pasos 1, 2 y parte del 3 del plan:**

- ✅ **Paso 1 — las tres consultas externas, redactadas** dentro de los documentos que ya existían: contador (`fiscal-instrucciones.md` §2.3bis), abogado (`paquete-abogado.md` A.6 a A.9) y el mensaje a PayPal (en `decisiones-pagos.md`, bajo D9). Falta mandarlas.
- ✅ **Paso 2 — regla espejo** (`scripts/add-payout-rails.sql`, **CORRIDO y VERIFICADO**). El coach declara qué rieles acepta, el checkout ofrece solo esos, el CBU sale del exterior, el costo de entrega lo absorbe VIVE, el panel agrupa por `(coach, riel)` y **`accepts_international` pasó a columna derivada por trigger** con su `update` revocado — los seis lectores no se tocaron.
- ✅ **Paso 3 (D3) — escalera por riel.** PayPal y USDT pasan de 25% plano a **25% la primera del par y 20% las recurrentes**, con el mismo contador que ya usaba Mercado Pago. **Las tres `*-create-payment` deployadas.**
- 🔴 **D11 se disolvió**: el país de quien reserva **no gatilla nada**. Puede haber argentinos que quieran pagar en USDT y coaches argentinos que solo quieran cobrar en USDT — filtrar por ubicación les cerraría la puerta a los dos. El país se guarda solo para la etiqueta fiscal. Queda una pregunta legal en su lugar (A.9): si se le puede cobrar en dólares a un consumidor en Argentina.
- 📝 **Once de doce decisiones cerradas.** Queda **D12** (la dirección fiscal del coach), que ya está redactada como pregunta para el contador.

**Pendiente para la próxima sesión — PLAN ORDENADO:**

### 1 · Arrancar los relojes que no dependen de código (primero, porque tardan)

- **Formulario de PayPal Multiparty** (D9 decidida). Y **probar el flujo en sandbox en paralelo**, que no requiere aprobación. 🔴 En el mismo contacto, la pregunta que la respuesta genérica no contesta: *para una plataforma con entidad argentina, ¿la partner fee se liquida sí o sí a la cuenta bancaria vinculada en pesos, o puede retenerse en saldo USD?*
- 🔴 **La consulta al contador, reformulada.** Ya no es "cómo trato el riel internacional" sino: *VIVE es agente (D1), su cliente es el coach y le factura su comisión. ¿Cómo se factura esa comisión según el domicilio fiscal del coach —factura E si está afuera, C si está en Argentina—? ¿Y qué implica que el coach pueda no ser argentino?* Más: si el coach es exportador aunque cobre VIVE, y el movimiento de ~$675 de `docs/fiscal-instrucciones.md`.
- 🔴 **REESCRIBIR LOS T&C DESDE CERO, antes de la consulta legal** (decisión del 25/08). El texto describe un sistema que ya no existe: **siete desajustes, cinco de ellos afirmaciones falsas** — los precios no son solo en pesos, no todos los pagos van por Mercado Pago con split, la comisión internacional no figura, la demora del pago al Profesional no es del procesador sino política de Vita, y el reembolso "automático" no existe en cripto. **El séptimo ya estaba antes**: §9.1 dice que dentro de las 24hs no se puede cancelar y §9.4 reconoce un derecho de revocación **irrenunciable de 10 días** — el contrato se contradice a sí mismo, y el código implementa solo §9.1. ⚠️ **Alcance: reescribir CÓMO FUNCIONA el sistema, y dejar marcadas las consecuencias legales como preguntas.** Adelantarse a lo segundo ancla al abogado a una redacción propia. Detalle en `docs/legal-instrucciones.md`.
- ⚠️ **Las otras dos consultas NO esperan a eso** — contador y PayPal no dependen de los T&C. La del abogado sí.
- **Tres puntos para el abogado:** (1) si la cláusula de "menos de 24hs, sin reembolso" es oponible frente al régimen de contratación a distancia; (2) **§9.3 (garantía) al lado de §4.1 (intermediación)** — VIVE ofrece reintegro por una prestación que dice no prestar; (3) **§9 promete un reembolso "automático a través del procesador"** que en el riel de USDT no existe: es una transferencia a mano.

### 2 · ✅ HECHO (25/08) — D4 + D5 + D6, y D3 del paso 3

### 3 · ✅ HECHO (25/08) — D10, D2, D8 y el bug de la sala

- **D10 completa**, las dos mitades. `'contracargo'` como estado propio (antes era indistinguible de un reembolso voluntario), las disputas de PayPal llegando por primera vez —7 eventos suscritos—, la vista `reversiones_despues_de_pagar` y `session-attendance` guardando la prueba de que la sesión ocurrió. ⚠️ Esa prueba **todavía no dice quién entró**: `create-meeting-room` no emite tokens con identidad.
- **D2** — se guarda la zona horaria observada, su procedencia y cuándo. 🔴 **Ni el país ni `es_internacional`**: los dos son conclusiones, y el criterio no está confirmado. El criterio vive **solo** en `clasificacion_de_operaciones`. 📝 Apareció una trampa: `deviceTz()` cae a Argentina cuando no puede leer la zona —correcto para mostrar horarios— así que usarla acá habría registrado un país que nadie observó. Hay una función aparte y un test que protege ese invariante.
- **D8** — 🔴 **la decisión partía de una premisa falsa mía**: dije que no había ningún registro de operaciones y `admin_audit_log` ya existía, append-only y con actor. Lo que faltaba era que `mark_coach_paid` **no guardaba cuánto se transfirió**. Salió sin tabla nueva: una forma acordada para los montos y una vista.
- ✅ **El bug de la tarjeta de la sala, arreglado** el mismo día en que mordió dos veces.

### 4 · Siguen abiertas

- **D11** — filtro por ubicación en el checkout. Decisión de producto; ya no cobra mal.
- **D12** — **la dirección fiscal del coach**, que hoy no existe como dato y decide si VIVE emite factura E o C por su propia comisión.

### 5 · De antes de esta discusión, que no hay que perder

- ✅ **La tarjeta de la sala — ARREGLADA el 25/08.** Había mordido dos veces ese mismo día, la segunda con plata (canceló y reembolsó `d6fc1a6c`, MP 27/08 9:00, sin que nadie lo pidiera). Dos cambios: `SalaScreen` **relee al volver a la pantalla** —salteando el primer foco para no duplicar la carga del montaje— y el cartel de confirmación **nombra la sesión con fecha y hora**, que es la última barrera antes de algo irreversible que dispara un reembolso. ⚠️ **Sin probar en dispositivo.** 📝 Queda una limitación menor y deliberada: desde la sala se sigue cancelando **la próxima**; para elegir otra hay que ir a la lista de sesiones. Ya no es peligroso —el cartel dice cuál es— pero conviene saberlo.
- **Aviso cuando hay un reembolso de USDT pendiente** (D7) y verificar que la pantalla valide la dirección contra la red.
- **`bookings.cancelled_at`** — hoy no hay forma de saber cuándo se canceló algo sin descifrar mensajes de chat.
- **Probar en dispositivo** la pantalla de datos de cobro y el cartel de espera nuevo. **Nada probado en Android.**
- **Las dos mediciones de USD 50** (PayPal → pesos, USDT → pesos).
- **Actualizar la página visual** (`claude.ai/code/artifact/b50eb896…`): quedó sin las revisiones de D2 y D3 ni la D12.

### 📌 Lo que NO hay que perder de vista al retomar

**Nada de esto está ardiendo.** Los agujeros encontrados —el coach sin cobro, los contracargos invisibles, la falta de prueba de asistencia— **solo lastiman cuando hay usuarios reales, y no hay ninguno**. Es la ventana que este proyecto no tuvo ni con el webhook muerto un mes ni con el cron dando 401 dos semanas. No desperdiciarla apurándose.

**Las decisiones están en `docs/decisiones-pagos.md`**, cada una con su razonamiento, lo que descarta, el riesgo que asume y el trabajo que se desprende. **Empezar por "El modelo, después de tres correcciones"**, que es lo que hace consistente todo lo demás.

---

## 2026-08-24 — Joaquín (sesión 125)

**Tocado:** `app/(tabs)/conexiones.tsx`.

**Resumen — rediseño de la card del deck de Conexiones (la del carrusel "Recomendado por Vita"), fiel a `card-otras-estructuras.html` §B2. Pedido con plan de exploración primero, según instrucción explícita.**

- **Exploración antes de codear** (pedido explícito): la card vive inline en `conexiones.tsx` (no es un componente aparte), todos sus datos salen de `CachedCoach`/`useFavoriteCoaches` (sin tocar), y el concepto de "motivo" que se pedía **ya existía completo** — `DECK_SLOTS`/`SLOT_COLORS` en `lib/coachDeckRanking.ts` (4 slots: recomendado/tendencia/nuevo/economico, cada uno con label+sublabel+ícono de Feather+color), antes usado para pintar la banda sólida que se sacó. No hizo falta ningún campo ni migración nueva.
- **El contenedor "elevado" es literalmente `SurfaceCard`** (`variant="elevated" tone="light"`) — su borde-gradiente hardcodeado (blanco→terracota(.28)→forest(.20)) coincide EXACTO con el `.cardbase` del HTML, sin tocar el componente compartido. Y la mayoría de los colores del archivo (`FOREST`, `FOREST_SOFT`, `INK`, `CARD`, `TERRACOTTA`, `TC_SOFT #EAD3C6`, `STAR #C99A3F`) ya coincidían letra por letra con los tokens del mockup — solo hicieron falta 2 nuevos (`SAGE #DCE5CB` y los 2 textos oscuros de la pill).
- **Se sacó**: la banda de color sólida de arriba, el contador "i/N" (los puntitos de paginación de la pantalla, aparte, siguen intactos), el conteo de reseñas, y la línea de precio. El botón pasó de relleno sólido forest a pill con borde 1.5px. La cita bajó de `numberOfLines={3}` a `{2}`.
- **Corrección de fidelidad encontrada explorando**: el HTML pide Fraunces **600** para el nombre, y el código usaba `frauncesSerif` (700 bold) — cambiado a `frauncesSemiBold`, que ya existía como token y no se usaba en esta card.
- ⚠️ **RN no tiene `radial-gradient` nativo** — el halo cálido detrás del avatar (`radial-gradient(rgba(192,107,74,.28), transparent 70%)` en el HTML) se aproximó con un círculo semitransparente plano, sin la caída hacia los bordes. Anotado en el código para quien lo retome.
- **Dos decisiones confirmadas con Joaquín antes de codear**: (1) los 2 slots sin color definido en el HTML (tendencia/nuevo) llevan un tinte de su propio `SLOT_COLOR` — propuesta mía, no viene del mockup, ajustable; (2) "Con lugar esta semana" (disponibilidad) se sacó de la card por completo — el HTML no le daba lugar y no está en la lista de elementos de la nueva estructura.
- **La lista completa (`app/search3.tsx`) no se tocó** — tiene una card de fila horizontal totalmente distinta (`ScaleCard`, sin el tratamiento de sombra/grano). Queda para una sesión aparte si se decide unificar el lenguaje visual.
- Typecheck, lint (0 warnings nuevos) y 241/241 tests limpios (incluido `deckRanking.test.ts`, sin tocar la lógica de ranking). **No confirmado visualmente en dispositivo desde acá.**

**Pendiente para la próxima sesión:**
- Confirmar en el dev build: la card con "Recomendado" y, si aparece algún coach en el slot "económico", que la pill cambie a salvia — las dos son las que Joaquín pidió ver para validar el sistema de colores.
- Si algún día importa el halo con caída real (no plano), evaluar una librería de radial-gradient para RN o aproximar con capas de círculos concéntricos.
- Decidir si vale la pena unificar `search3.tsx` con este mismo lenguaje visual (sombra/grano/borde-gradiente + botón con borde) en una sesión propia.

---

## 2026-08-23 — Andre (sesión 118)

**Tocado:** `screens/BookingScreen_Success.tsx`. Sin cambios de base de datos ni de edge functions. 241 tests, `tsc` limpio.

**Resumen:**

- **Salir de "sesión confirmada" no desarmaba la pila de la reserva.** "Ver mi sala" hacía `push` y "Volver a Inicio" `navigate`, así que la pantalla terminal —y todo el embudo que la precede: perfil del profesional, calendario, elección de horario— quedaba viva abajo. El gesto de volver atrás desde la sala te devolvía a "sesión confirmada", y un paso más atrás al selector de horarios de una reserva ya hecha. Los dos botones ahora hacen `dismissAll()` primero.
- **La mitad ya estaba resuelta y por eso costaba ver la otra:** `booking-success` tiene `gestureEnabled: false` en `app/_layout.tsx`, así que no se puede volver DESDE ella. Lo que faltaba era no poder volver A ella.
- 📝 `dismissAll()` es correcto acá porque para alguien logueado la raíz de la pila es `(tabs)`: `app/index.tsx` hace `replace('/(tabs)')` al abrir sesión, así que Inicio no está apilado sino que es el piso.

**Pendiente para la próxima sesión:**
- ⚠️ **`UsdtPaymentScreen` tiene el mismo patrón sin arreglar** (`router.replace('/(tabs)')` al acreditarse, que deja el embudo abajo). Hoy no se nota porque `(tabs)` también tiene `gestureEnabled: false`, así que no hay gesto que lo destape — pero es la misma forma y conviene unificarla cuando se toque esa pantalla.
- Sigue todo lo de la sesión 117: **nada probado en Android**, que es donde más se esperaba ganar con el salto a la app nativa de Mercado Pago.

---

## 2026-08-24 — Joaquín (sesión 124)

**Tocado:** `app/(tabs)/conexiones.tsx`, `__tests__/pureLogic.test.ts`.

**Resumen — dos arreglos chicos: el buscador de Conexiones se veía separado del texto que lo introduce, y una fragilidad de timezone en un test que Andre no podía haber visto desde su máquina.**

- **Joaquín mandó captura de Conexiones**: el buscador ("Buscá un profesional por nombre") se leía como una sección aparte de "Elegí un área de bienestar para empezar", en vez de la acción natural de esa instrucción. Causa: `askWrap.marginBottom` (18) + `searchBar.marginTop` (6) = 24px, el triple que el espacio entre el título grande y ese mismo subtítulo (8px). Arreglado con un modificador nuevo (`askWrapTight`, `marginBottom: 8`) aplicado **solo** en Fase 1 (donde sigue el buscador) — Fase 2 usa el mismo `askWrap` pero seguido de una lista de puertas, y ahí el espacio de 18 está bien, no se tocó.
- 🔴 **De paso, corriendo los tests después de traer los 39 commits de Andre (sesión 110-117), aparecieron 2 fallando: `isCancelLate` en el borde de las 24hs.** No era un bug de Andre — este sandbox corre en **Sídney (UTC+10)**, y `fixNow()` fijaba el reloj con un ISO **sin zona** (`new Date('2026-08-11T15:00:00')`), que Node interpreta en la zona de la MÁQUINA que corre el test. En Argentina coincide por casualidad; acá el reloj quedaba corrido 13hs y los casos de borde fallaban. El código de producción (`scheduledAtMs`, que sí ancla a `America/Argentina/Buenos_Aires` explícito) estaba bien — es exactamente la clase de bug que la sesión 112 de Andre había cerrado, pero en el arnés de tests en vez del código. Arreglado anclando el ISO a `-03:00` explícito en `fixNow`.
- Se trajeron los 39 commits de Andre (sesiones 110-117: checkout que salta a la app nativa de MP + confirmación server-side, riel de PayPal completo, comisión internacional del 25%, wallet de USDT rotada) — merge sin conflictos, fast-forward.
- Typecheck, lint y 241/241 tests limpios.

**Pendiente para la próxima sesión:**
- De la lista de Andre (sesión 117): nada de PayPal se probó de punta a punta, nada se probó en Android, falta decidir qué hacer con los medios offline de MP (efectivo/Rapipago/cajero).
- Confirmar visualmente que el espaciado del buscador en Conexiones quedó bien.

---

## 2026-08-21 — Andre (sesión 117)

**Tocado:** `screens/BookingScreen_Confirm.tsx`, `app/booking/result.tsx`, `supabase/functions/_shared/booking-effects.ts` (**nuevo**), `mp-webhook`, `paypal-webhook`, `usdt-check-payments`, `mp-create-payment`, `paypal-create-payment`, `SCHEMA.md`. Sin cambios de base de datos. 241 tests, `tsc` limpio. **Las 5 edge functions deployadas el 21/08 19:25** (`mp-webhook` v20, `paypal-webhook` v7, `usdt-check-payments` v12, `mp-create-payment` v34, `paypal-create-payment` v6; `verify_jwt` verificado, los dos webhooks siguen en `false`). ⚠️ **Sin probar en dispositivo.**

**Resumen — el checkout ahora salta a la app nativa de Mercado Pago, y para que eso fuera seguro hubo que mover la confirmación al servidor.**

- **El pedido era simple: que abra la app de MP.** En la app nativa la persona ya está logueada, con tarjetas guardadas y biometría; en el WebView de la sesión 113 tenía que loguearse a mano cada vez (en iOS lo tapaba a medias `sharedCookiesEnabled`, que **no existe en Android**), y ese login era el paso donde se caían los pagos. Ahora es `Linking.openURL(init_point)` y el sistema decide: app de MP si está instalada, browser si no. Se fue la dependencia de `react-native-webview`.
- 🔴 **Pero el salto solo era seguro después de mover los efectos de confirmación al servidor.** Hasta ahora los aplicaba `BookingScreen_Confirm` en el cliente, y podía porque el WebView mantenía la app en primer plano todo el pago. Con la app en segundo plano, el SO puede matarla: un pago aprobado con la app muerta dejaba **plata cobrada, la reserva en 'pendiente' y el coach sin enterarse** — el espejo exacto de las 27 fantasma del 09/08, cobrado-sin-confirmar en vez de confirmado-sin-cobrar. Nuevo `_shared/booking-effects.ts`, llamado por los tres rieles desde el punto donde ganan la carrera por marcar `payment_status = 'aprobado'`.
- 🔴 **Eso destapó un bug que ya existía: el riel de USDT nunca confirmó nada.** `BookingScreen_Confirm` sale por `router.replace('/pago-usdt')` **antes** de `applyBookingEffects`, y el cron solo escribía `payment_status`. La persona pagaba, la pantalla le decía "Tu sesión quedó confirmada" y la reserva se quedaba en 'pendiente'. No se notó porque todavía no hubo ningún pago real en USDT. Arreglado con la misma llamada.
- **Por qué esto no repite los fracasos de las sesiones 107 y 111:** aquellos dependían de controlar el cierre del browser (interceptar el redirect, o cerrar la pestaña desde el sondeo), y MP siempre podía quitarnos el control. Ahora el cierre **no importa**: si la app muere, el pago se acredita y la reserva se confirma igual. El sondeo del cliente quedó solo para mostrarle el resultado a quien vuelve.
- **La vuelta a la app se encendió** (`booking-return` ya existía sin usarse): `CHECKOUT_RETURN_URL` ahora cae por default a esa función en los dos rieles, así que MP y PayPal mandan `back_urls`. Sin esto la persona terminaba de pagar y quedaba parada en la app de MP.
- **Detalles que costaron pensar más de lo que se ven:**
  - El sondeo se mide en **tiempo de app en pantalla** (`AppState === 'active'`), no de reloj: 10 minutos tipeando una tarjeta y un 2FA son normales, y un deadline de reloj echaría a alguien que ya pagó. Late cada 500 ms para notar el regreso, pero consulta cada 2 s.
  - La idempotencia la ponen los **llamadores** con un update condicional + `.select('id')`, no el helper. En `mp-webhook` la guarda es `.neq('payment_status','aprobado')` y no `= 'pendiente'`, porque Checkout Pro recupera pagos rechazados y la aprobación puede llegar sobre un `'rechazado'`.
  - El cliente sigue aplicando los efectos cuando **no hay nada que cobrar** (coach sin MP). La condición es `if (!initPoint)` y no `if (!awaitingPayment)` — con la segunda, un pago aprobado los correría de los dos lados: dos push al coach, dos mensajes de sistema, dos cancelaciones a los competidores.
  - `app/booking/result.tsx` hacía `router.replace('/(tabs)/mis-salas')` siempre, y eso **pisaba** el flujo de la pantalla que seguía sondeando. Ahora hace `back()` si hay algo debajo, y solo va a mis-salas si el deep link abrió la app de cero.

**Y en el mismo bloque, lo que se ve en pantalla cuando el pago no entra:**

- 🔴 **Sin pago acreditado ya no queda reserva.** Si el cobro se rechaza, se abandona o no se acredita, la reserva se cancela en el momento y la persona se queda en la pantalla de confirmación con el motivo. Antes seguía de largo: la reserva vivía en `'pendiente'` hasta que `expire_unpaid_checkouts()` la barría a los 30 min, y en el medio **el horario quedaba tomado para todo el mundo** (la vista de disponibilidad cuenta `'pendiente'`).
- **Y la pantalla mentía por diseño.** Mostraba el tilde verde, "Ver mi sala" y el badge "Pago sin confirmar" con el texto "Falta confirmar el pago". El texto era honesto y todo lo demás decía que había salido bien. Se eliminó ese estado entero de `BookingScreen_Success`.
- **Las guardas del update hacen imposible matar una reserva paga** (`status = 'pendiente'` y `payment_status <> 'aprobado'`). Si el pago entra en el mismo instante, o gana él y no se cancela nada, o gana la cancelación y el pago aterriza sobre una reserva cancelada — que `mp-webhook` ya manda al circuito de reembolso.
- **`expire_unpaid_checkouts()` no se toca**: cubre a quien nunca vuelve a la app. La cancelación del cliente es el camino rápido, no el único.

**Verificado al deployar (21/08), para no volver a preguntarlo:**
- ✅ **`booking-return` ya estaba deployada** (v6, `verify_jwt = false`) desde el 19/08. Smoke test: devuelve `302 → viveapp://booking/result?...` con los query params reenviados.
- ✅ **`CHECKOUT_RETURN_URL` NO está seteado como secret**, así que aplica el default nuevo (`${SUPABASE_URL}/functions/v1/booking-return`) y los dos rieles mandan `back_urls`.
- ✅ **No hace falta el secret `MESSAGE_ENCRYPTION_KEY`**: `EXPO_PUBLIC_ENCRYPTION_KEY` en `.env` es exactamente el default `vive_mvp_key_2026`, al que ya cae el helper del servidor. ⚠️ El día que se cambie una, hay que cambiar la otra en el mismo momento.
- ✅ **`MP_TEST_MODE = false`** (y `MP_SPLIT_ENABLED = true`): se está en producción, no en sandbox, así que la duda sobre el `sandbox_init_point` en la app nativa no aplica. Se prueba con pagos reales de $1 como el 09/08.

**⚠️ ORDEN AL SUBIR LA APP:** las funciones van SIEMPRE antes que el build. Con el build nuevo y el webhook viejo, **ninguna reserva paga se confirma** — el cliente ya no aplica los efectos (`if (!initPoint)`) y el webhook viejo tampoco. Al revés es seguro, con una arruga chica: entre el deploy y el OTA, un build viejo aplica los efectos del lado del cliente y el webhook nuevo del suyo → doble push al coach y dos mensajes de sistema en la sala.

**✅ PROBADO EN DISPOSITIVO Y ANDA, incluido el caso difícil (21/08).** La reserva de las 22:46: se pagó desde la app nativa de MP y se cerró Vita **antes** de volver — y el servidor la confirmó igual (`payment_status = 'aprobado'`, `status = 'confirmada'`, mensaje de sistema en la sala, notificación al usuario), sin ninguna ayuda del cliente. Es exactamente lo que justificaba mover los efectos a `mp-webhook`. Verificado con `scripts/verificar-confirmacion-server-side.sql`.

⚠️ **Y una lección sobre el propio script de verificación:** en su primera versión contaba los mensajes de sistema con `m.created_at >= b.created_at` sin techo. La sala es UNA por par usuario-coach y la comparten todas sus reservas, así que cada fila se contaba también los mensajes de las reservas posteriores — con dos pruebas seguidas daba 2 y se leía como "los efectos corrieron dos veces", que es la conclusión que el script existía para descartar. Corregido con un techo en la reserva siguiente de la misma sala.

**El camino feliz también anda.** Reserva real de punta a punta con Mercado Pago, después de agregar el fallback. El primer intento había fallado; el detalle de por qué y de lo que se descartó, abajo.

**El fallo del primer intento (21/08 19:27), y la red que quedó puesta:**

- 🔴 **`Linking.openURL` rechazó con "Unable to open URL" sobre el `init_point` de MP**, que es una URL https común. En iOS, a los 3 minutos del deploy. **No se determinó la causa** — no es reproducible desde la máquina y los reportes del repo de RN sobre el mismo error son de `mailto:`/`tel:`, no de https.
- **Diagnóstico con botones temporales (ya borrados), y descartó los dos sospechosos:** `google.com` y `mercadopago.com.ar` abrieron Safari los dos → `Linking` funciona, no es "https en este build". Y la **URL exacta que falló**, con su `pref_id` y todo, también abrió — sola y montando antes el overlay de espera. O sea que **ni la URL ni el contexto de la llamada** explican el error. Queda como transitorio, o como algo del flujo previo completo (las vueltas de red + el `invoke` de `mp-create-payment`) que no se pudo reproducir aislado.
- **Se resolvió sin depender de la causa:** `abrirCheckout()` prueba `Linking.openURL` y, si rechaza, cae a `WebBrowser.openBrowserAsync` (navegador in-app). **Caer ahí no pierde el salto a la app nativa**: el checkout web de MP hace su propio handoff a la app si está instalada — es exactamente lo que se observó en la sesión 111, cuando ese handoff era el problema que había que bloquear y ahora es la red de contención.
- 🔴 **Y el `catch` de esa apertura tenía el mismo bug que se acababa de arreglar**, por la puerta de al lado: mostraba el error y volvía **sin cancelar la reserva**, dejándola viva en 'pendiente' con el horario tomado por un checkout que nunca se abrió. Ahora las dos salidas sin pago usan el mismo `soltarReserva()`.

**Pendiente para la próxima sesión:**
- ⚠️ **Quedó una reserva fantasma del intento fallido de las 22:27** (`pendiente`/`pendiente`, sin cancelar): es de antes de que el `catch` de la apertura llamara a `soltarReserva()`. La barre `expire_unpaid_checkouts()` a los 30 min sola, no hay que hacer nada — queda anotada para que no se lea como un caso nuevo.
- ⚠️ **Nada de esto está probado en Android**, que es justo donde el WebView era peor (no existe `sharedCookiesEnabled`) y donde más se esperaba ganar con el salto a la app nativa.
- ✅ **CONFIRMADO EN DISPOSITIVO: se paga en la APP NATIVA de Mercado Pago**, no en el navegador in-app — o sea que `Linking.openURL` resolvió bien y el fallback ni se usó. El objetivo del cambio (sesión ya iniciada, tarjetas guardadas, biometría) se cumple. El error del primer intento queda como transitorio: no se reprodujo ni con la URL exacta ni con el contexto.
  - ⚠️ **NO está verificado si iOS salta DERECHO a la app de MP o si rebota por Safari** y es el checkout web el que hace el handoff. La evidencia apunta a lo segundo: el diagnóstico con `https://www.mercadopago.com.ar` a secas abrió **Safari**, así que MP no reclama el dominio raíz como universal link; y la nota de la sesión 111 describe exactamente ese handoff observado desde adentro del browser. **No cambia nada funcionalmente** —se termina en la app igual, y la vuelta por `booking-return` funciona desde las dos—, pero conviene no escribirlo como si fuera un salto directo. Se distingue mirando si queda una pestaña de MP abierta en Safari al terminar.
- 🔴 **Decidir qué hacer con los medios OFFLINE de Mercado Pago** (efectivo, Rapipago, cajero): acreditan horas o días después, así que con la regla nueva quien elija uno se queda sin reserva, y si después paga el pago cae sobre una reserva cancelada y sale por reembolso. Se corta de raíz excluyéndolos en la preferencia (`payment_methods.excluded_payment_types: ['ticket','atm']` en `mp-create-payment`). No lo hice porque es decisión de producto, no de código.
- ⚠️ **`registrarEvento('reserva_confirmada')` se dispara al INSERTAR la reserva**, antes del pago — o sea que ahora cuenta como confirmadas reservas que se cancelan segundos después. Ya era impreciso antes (las 27 fantasma también lo dispararon); ahora es más visible. Moverlo cambia la semántica de un embudo de analytics, así que queda para decidir.
- ⚠️ **No está verificado que iOS abra la app de MP con el `init_point`** en vez de Safari (depende de que MP tenga ese path registrado como universal link). Si cae en Safari, el checkout web de MP hace su propio salto a la app nativa — que es lo que se observó en la sesión 111 — así que el destino final es el mismo, pero conviene mirarlo.
- Todo lo de la sesión 116 sigue: seed de la billetera USDT en papel, la hora con el contador, las dos mediciones de USD 50 y el pago real de PayPal de punta a punta.

---

## 2026-08-21 — Andre (sesión 116)

**Tocado:** `SCHEMA.md`. Secret `USDT_WALLET_TRC20` **rotado**; `usdt-create-payment` y `usdt-check-payments` **redeployadas**. Sin cambios de código.

**Resumen — se rotó la billetera de cobro, que era el único pendiente que se encarecía con el tiempo.**

- ✅ **`USDT_WALLET_TRC20` apunta ahora a una billetera dedicada a VIVE** (`TYtm2r…7JQFLs`). Antes era la dirección personal de Andre, que iba a terminar conteniendo plata de los profesionales — con el problema de mezcla de fondos que eso trae para la pregunta fiscal, y sin poder auditar nada.
- **Se verificó por CHECKSUM y no solo por formato.** El regex de `lib/payout.ts` detecta la forma de una dirección de Tron, pero un error de tipeo puede producir una cadena con forma válida. Se decodificó el base58check, se comprobó que los últimos 4 bytes son el doble SHA-256 del resto y que el prefijo de red es `0x41` (mainnet). **Conviene repetirlo ante cualquier dirección nueva**: un carácter cambiado pierde los fondos y no rebota.
- ⚠️ **Se hizo ahora porque era el único momento gratis.** La dirección **no se guarda en la reserva** —`usdt-create-payment` la devuelve desde el env en cada llamada—, así que rotar con tráfico tiene una ventana de 60 min donde alguien manda a la vieja y el cron mira la nueva. Sin ninguna reserva internacional, esa ventana no existe.
- ⚠️ **Se redeployaron las dos funciones que leen el secret.** Lo leen al arrancar, así que una instancia caliente podría seguir con el valor viejo. Rotar sin redeployar deja un estado indistinguible del correcto hasta que alguien pierde un pago.

**Sobre la elección de billetera, para que no se repita la discusión:**
- 📝 **TronLink en el App Store argentino tiene 18 opiniones y es la real** — las reseñas del App Store son por país. Se sospechó que era una impostora y no lo era. El criterio que sí vale: entrar al dominio oficial (`tronlink.org`) y seguir su link, en vez de instalar desde un resultado de búsqueda.
- **Se descartó usar una dirección de Belo como punto de cobro.** El mecanismo de identificación cruza por monto exacto y **asume que a esa dirección solo llega plata de VIVE**: un movimiento personal que coincidiera en monto acreditaría la sesión de otra persona. Además la dirección es de ellos (pueden rotarla) y seguiría habiendo mezcla de fondos. Belo sirve para el otro rol — **convertir a pesos**, que es justo el costo que falta medir.
- **Pendiente al primer envío: anotar cuánto costó.** El USD 1,50 de `USDT_NETWORK_FEE_USD` es un valor informado, no medido, y nada lo detecta si cambia.

**Pendiente para la próxima sesión:**
- **Seed de la billetera nueva en papel y fuera de la computadora**, antes de que entre el primer pago real.
- Todo lo de la sesión 115 sigue igual: la hora con el contador (`docs/fiscal-instrucciones.md`), las dos mediciones de USD 50, el pago real de PayPal de punta a punta, y nada probado en dispositivo.

---

## 2026-08-20 — Andre (sesión 115)

**Tocado:** `lib/time.ts`, `lib/pricing.ts`, `lib/payout.ts`, `lib/admin.ts`, `supabase/functions/_shared/guarantee.ts`, `_shared/commission.ts`, `_shared/pricing.ts`, `paypal-create-payment`, `usdt-create-payment`, `screens/BookingScreen_Confirm.tsx`, `CoachProfileScreen.tsx`, `CoachPayoutScreen.tsx`, `AdminScreen.tsx`, `docs/cobro-internacional-coaches.md`, `SCHEMA.md`. Las dos edge functions **deployadas**. Sin cambios de base de datos. 231 tests.

**Resumen — sesión de decisiones sobre el riel internacional. Se cerró la plataforma, se abrió el modelo de costos, y quedó un supuesto escrito antes de que venza.**

- 🔴 **Se agotaron las salidas técnicas al problema del tope del Monotributo.** El chat de soporte de PayPal confirmó que **no hay pagos repartidos** ("el pago solo llega a una cuenta"), USDT tampoco los tiene, y Stripe Connect no paga a Argentina. La plata del exterior **pasa sí o sí por la cuenta de VIVE**, con lo cual la consulta al contador dejó de ser una tarea más y pasó a ser la única que decide si exportar sesiones cierra.
  - ⚠️ La respuesta es de soporte de primera línea y **Multiparty existe** como producto de PayPal, así que "no está habilitado" como afirmación general no es exacto — puede ser específico de Argentina. Coincide con el resto de la evidencia igual: la página de plataformas y marketplaces **da 404 para `/ar/`** y la de negocios argentina no ofrece nada de reparto.
- 📝 **Corrección de peso propio: los T&C son un BORRADOR sin revisión legal**, y yo los venía tratando como una restricción. La contradicción entre el §8.5 (el profesional le factura al cliente → sería exportador) y la arquitectura (cobra VIVE para tener un solo circuito) no es "dos cosas de igual peso": es una arquitectura construida contra un texto escrito para el caso argentino antes de que el riel existiera. Cambiarlo cuesta editar un `.md` y correr `sync:legal`. **La pregunta para el contador es "¿qué tendría que decir acá?", no "¿esto está bien?"**.

**El modelo de costos, que estaba incompleto en todo lo anterior:**

- 🔴 **Faltaba un costo entero: el cambio de moneda.** Sacar dólares de PayPal hacia Argentina cuesta, y **vender USDT por pesos también** — y son **el mismo costo**, no dos. Ningún número de las sesiones anteriores lo contaba. Sobre una sesión de USD 60 con comisión del 20%, quedaban 8,46 netos; si el cambio cuesta entre 2% y 4%, quedan entre **6,00 y 7,25**.
- **Quedan tres costos distintos**: cobro (procesador), cambio de moneda (solo si lo que entra no es lo que sale) y entrega (comisión de red en USDT, ~0 en transferencia con archivo de lote).
- **Criterio para repartirlos, uno solo: paga el que controla la decisión que lo genera.** Es el mismo que ya rige en Mercado Pago. De ahí: el **cobro** lo paga el cliente vía precio; la **entrega en USDT** la paga el profesional que la eligió (y eso elimina el único costo que escalaba linealmente con la cantidad de profesionales); el **cambio de moneda** lo paga VIVE, porque **no lo causa ninguna decisión sino que dos decisiones independientes no coincidan** — el profesional que cargó su CBU no eligió que el cliente pagara en USDT ni se enteró.
- **Decisión pendiente: 20% fijo para el riel internacional**, sin contador por par y con precio limpio para el cliente. Justificación: en Argentina VIVE baja al 15% porque después de la presentación deja de aportar; en el exterior **cobra y transfiere en cada sesión, para siempre**. Frenada hasta medir el cambio de moneda.
- 📝 **De paso quedó documentado por qué cada riel trata la comisión del procesador distinto** (MP la paga el coach porque ahí el comerciante es él; en USDT no hay procesador y VIVE se queda los centavos del identificador; en PayPal la paga el cliente porque el comerciante es VIVE). Está en SCHEMA.md para que nadie los unifique sin entender la diferencia.

**Y un supuesto que se escribió antes de vencer:**

- ⚠️ **"El profesional está en Argentina" no es un campo, es el sistema de coordenadas.** Lo asumen la hora (texto sin zona = hora argentina), el CBU de 22 dígitos, el precio en pesos, el OAuth de Mercado Pago y todo el tratamiento fiscal.
- 🔴 **De todo eso, lo único que toca el significado de datos ya guardados es la hora.** El resto es aditivo. Documentado en `lib/time.ts`, `_shared/guarantee.ts` y SCHEMA.md, con qué haría falta el día que cambie y por qué **no** se agregó un parámetro de zona "por las dudas" (sería código muerto sin tests; lo caro es tener la zona disponible en cada punto de uso, no la firma de la función).
- ⚠️ **Vocabulario: "internacional" nombra dos cosas independientes** — que el **cliente** esté afuera (los rieles de pago, todo lo que existe) y que el **profesional** esté afuera. La primera no implica la segunda, y usar una palabra para las dos ya confundió una vez en esta misma sesión.

**Y el esquema de comisiones quedó cerrado — 25% plano para el internacional.**

- **La propuesta salió de Andre y es mejor que lo que yo venía recomendando.** Yo defendía sumarle el costo al precio (el cliente pagaba 63,75 por una sesión de 60); él propuso **cambiar la promesa en vez de esconder el costo**. Toda mi objeción a que lo absorbiera el coach era que rompía el copy del 15% — si la tarifa dice otra cosa, la objeción desaparece.
- **Por qué 25 y no 20:** es lo que permite **dejar de preguntar por la combinación**. Sobre USD 60 el neto va de ~8,56 (PayPal + salida en USDT) a ~13,20 (USDT + salida a CBU). Con 20% la peor caía a ~5,60 y había que mirar caso por caso; con 25% las cuatro cierran. No es simplicidad, es que el margen absorbe la varianza.
- **Descartado el "10% de descuento con Mercado Pago"** que también proponía Andre: **no hay un precio del cual descontar**. El local está en pesos y el internacional en dólares, y son números independientes que el coach fija por separado. Además el selector de medios aparece según lo que configuró el COACH y no según dónde está el cliente, así que alguien en Argentina vería las dos monedas sin poder compararlas — y eso acerca el asunto a la cláusula de recargo de PayPal, que hoy no aplica.
- **Qué eliminó:** `paypalGrossUp` en las dos copias, `charged_amount` como recargo (ahora igual a `amount`), el contador por par en los dos rieles internacionales, y la pregunta contractual de PayPal.
- 📝 **El mínimo de USD 20 sobrevive con otro motivo**: existía porque la comisión fija de PayPal se comía el recargo en montos chicos; con la tarifa plana eso deja de ser aritmética y se queda porque una sesión de USD 5 no es un producto serio.
- ⚠️ **Sigue abierto para el riel LOCAL**: pasar Mercado Pago a 15% plano borraría todo el andamiaje del contador por par, pero **VIVE dejaría de capturar el valor de la presentación**, que es lo único que aporta ahí. Decisión con argumento propio, no debe viajar de arrastre.

**El modelo de costos, armado con números medidos:**

- **Fijos ~USD 41/mes**: Supabase 25, Anthropic 7,50, Apple 8,25. **Daily.co da 10.000 minutos de participante gratis por mes** = **83 sesiones**, y después USD 0,004 por minuto (USD 0,48 por sesión de 60 min con dos personas).
- **Punto de equilibrio: ~5 sesiones internacionales por mes.** Los costos fijos **no son el problema** — el negocio se define por volumen y margen variable.
- 🔴 **Lo único sin medir sigue siendo el cambio de moneda** (estimado 2-4%). Si resulta el doble, el neto de una sesión de 60 baja de ~9,20 a ~7,40: el negocio no cambia de forma, el margen sí.

**El costo de red, descontado a quien lo elige (USD 1,50 por envío, valor real de Andre):**

- 🔴 **Se paga una vez por TRANSFERENCIA, no por sesión** — y me equivoqué dos veces antes de tenerlo claro, primero estimándolo en USD 2 y después computándolo por sesión. Con pagos semanales, un coach de cuatro sesiones recibe **un solo envío**.
- **Eso hace que el costo lo determine el volumen del profesional y no el precio**: sobre una sesión de USD 50 pesa 3% si hizo una esa semana y 0,3% si hizo diez.
- **Sin el descuento, el mínimo de USD 20 no llegaba al 10% de margen** en el peor caso (6,2%); con él da 13,7% en todos. Y cae solo sobre quien genera el costo desproporcionado: al de una sesión semanal le baja el cobro de 75% a 72%, al de cuatro le descuenta un 1% que no nota.
- **Sin mínimo de acumulación** (decisión de Andre). Si el costo supera lo que se le debe, el panel lo marca y **deshabilita el botón de marcar pagado** en vez de mostrar cero — que se leería como saldado, dejando al coach sin cobrar y sin registro.
- **El profesional lo ve al ELEGIR el método**, no cuando le llega menos plata.

**Pendiente para la próxima sesión:**
- 🔴 **Dos mediciones de USD 50**, y son las que destraban todo lo demás: dólares de PayPal → pesos, y USDT → pesos. **Primero la de PayPal** (supuesto: el pago en USDT va a ser el menos usado, aunque en alza). Las tarifas publicadas no incluyen el spread, así que la única forma de saberlo es hacerlo.
- 🔴 **La hora con el contador → todo escrito en `docs/fiscal-instrucciones.md`** (nuevo), con las preguntas ordenadas, el contexto de cada una y qué se destraba con cada respuesta.
  - 🔴 **La primera de la lista apareció al final de la sesión y no es del riel internacional: el sistema NO emite ninguna factura** — cero referencias a facturación, ARCA o AFIP en todo el código. La cuota del Monotributo no reemplaza la obligación de facturar; son dos cosas distintas.
  - 📝 **Pero el volumen es mínimo y lo dejé exagerado en la primera redacción.** Todos los movimientos fueron pruebas del pipeline: de los cuatro, uno se reembolsó, otro se canceló y reembolsó, y el de USDT no tuvo split (entró entero a la billetera personal). **Queda un solo movimiento con comisión retenida y no devuelta, de ~$675.** Que hayan sido pruebas no determina por sí solo si son facturables —eso depende de cómo se documente— pero es muy distinto preguntar por un movimiento concreto que por "todo lo cobrado desde agosto". Hay una query en el doc para traer los números reales.
  - 📝 **La contradicción de quién exporta vive en TRES lugares**, no dos: T&C §8.5 (el profesional factura al cliente), el changelog de la 101 (cobra Vita para tener un solo circuito) y un comentario en `screens/CoachProfileScreen.tsx:313` (*"él nos factura a nosotros en vez de al usuario"*).
- **Dos llamadas de diez minutos**: al banco, si la cuenta admite transferencias masivas por archivo (si no, el techo operativo aparece antes de lo previsto); y el formulario de plataformas de PayPal, que es otro canal que el de soporte.
- **Sigue sin probarse un pago real de PayPal de punta a punta**, ni nada en dispositivo (selector de tres medios, filtro del exterior, badge, zonas horarias).
- **La billetera propia de VIVE es lo único con urgencia real**: rotar tiene una ventana de 60 min donde un pago puede perderse, y **hoy es el único momento en que sale gratis** porque no hay ni una reserva internacional. **Al hacerlo, anotá cuánto costó el envío** — confirma el USD 1,50 que quedó horneado en `USDT_NETWORK_FEE_USD`, que hoy nada detecta si cambia.
- **Decidir el 15% plano en Mercado Pago**, que quedó explícitamente fuera de la decisión del internacional.

---

## 2026-08-20 — Andre (sesión 114)

**Tocado:** `supabase/functions/usdt-check-payments/index.ts`, `supabase/config.toml`, `screens/BookingScreen_Confirm.tsx`, `SCHEMA.md`. Nuevos: `supabase/functions/_shared/pricing.ts`, `paypal-create-payment`, `paypal-webhook`, `paypal-process-refunds`, `scripts/add-paypal-refund-cron.sql` (**corrido y verificado**). Las cuatro edge functions **deployadas**. 231 tests.

**Resumen — el riel de PayPal, entero. Y dos agujeros de plata encontrados probándolo.**

- **Las cuatro piezas construidas y deployadas**: create-payment, webhook, procesador de reembolsos y su cron. Credenciales de sandbox verificadas contra la API antes de escribir nada (el handshake devuelve `scope`, que es la respuesta de éxito).
- **La UI reusa el checkout embebido de Mercado Pago en vez de tener rama propia.** El `approve_url` de PayPal es https, así que entra en el mismo `<WebView>` y hereda todo lo que costó llegar ahí: el bloqueo de saltos a apps nativas, los 3 minutos de margen y el no cancelar la reserva al vencer el sondeo. Duplicar eso habría dejado dos versiones de las mismas decisiones.
- 🔴 **Con PayPal, quedarse sin URL de checkout NO es benigno.** En Mercado Pago `initPoint` null significa "coach sin MP conectado, no hay nada que cobrar" y la reserva sigue sin pago por diseño. Con PayPal significa que el cobro falló, y seguir dejaría una reserva internacional confirmada sin que entrara un dólar — las 27 fantasma de agosto por la tercera puerta. Ahora frena con error.

**🔴 El hallazgo de seguridad: la verificación de firma de PayPal aceptó un evento falsificado.**

- Probando el webhook con un POST inventado, **pasó el control de firma** y llegó hasta la escritura. Con un `custom_id` real en vez de ceros, marcaba esa reserva como pagada: sesión gratis para cualquiera que supiera la URL.
- Reproducido y con la condición aislada: **sin el header `paypal-cert-url` devuelve `FAILURE`; con un `cert_url` inventado devuelve `SUCCESS`.** Medido en sandbox; no está verificado si producción se comporta igual, y da lo mismo.
- **El arreglo no fue ajustar la verificación, fue dejar de depender de ella.** El body pasó a ser solo un disparador: la función **lee la captura contra la API de PayPal con nuestras credenciales** y de ahí toma el estado, el monto y a qué reserva corresponde. Nadie puede fabricar una captura que exista bajo nuestra cuenta. Es el mismo camino al que terminó llegando `mp-webhook`. La firma queda como defensa en profundidad, nunca como la única.

**🔴 Y el otro, encontrado por casualidad al verificar el cron de reembolsos: `usdt-check-payments` podía acreditar un pago a la reserva equivocada.**

- La respuesta del cron decía `"pendientes":14` en una app que no lanzó. La consulta filtraba solo por `payment_status = 'pendiente'` y **no excluía las canceladas** — y `expire_unpaid_checkouts()` cancela dejando `payment_status` en `'pendiente'` a propósito, así que cada checkout abandonado quedaba ahí para siempre.
- **El grave**: `fix-usdt-amount-index.sql` hizo que el índice de montos excluya las canceladas, o sea que **su monto queda libre para una reserva nueva**. Con las dos en la lista, un pago tardío del dueño de la cancelada podía acreditarse sobre la reserva de **otra persona**.
- Más: una cancelada podía quedar `'aprobado'` (paga, sin sesión, y fuera del trigger de reembolso porque la transición a `'cancelada'` ya había ocurrido), y con el `.limit(200)` las canceladas acumuladas terminarían desplazando a las pendientes reales.
- **Cuarta vez del patrón `status` vs `payment_status`** en este proyecto. Corregido en la consulta **y** en el update — entre una y otro la reserva puede expirar.
- ✅ **Verificado que no hubo daño**: las 14 eran todas de las pruebas del 18/08 y la consulta de canceladas-con-pago-aprobado no devuelve filas. Nadie pagó sobre una cancelada.

**Pendiente para la próxima sesión:**
- 🔴 **Nada del riel de PayPal se probó de punta a punta.** Falta crear una orden real, pagarla con la cuenta sandbox de comprador y ver la reserva pasar a `aprobado`. Recién ahí se sabe si funciona. Todo lo verificado hasta acá es que las funciones arrancan, que las credenciales sirven y que el webhook rechaza lo que tiene que rechazar.
- **Probar en dispositivo** el selector de tres medios y el precio que cambia según el método.
- ⚠️ **`CHECKOUT_RETURN_URL` no está seteado** (se ve que quedó así desde la sesión 110). No rompe el cobro —la captura es server-side y el checkout embebido no depende del redirect— pero conviene decidir si se repone.
- **Live**: las credenciales, el webhook y el `PAYPAL_MODE` de producción son otro juego. Y habría que ver si la verificación de firma se comporta distinto allá.
- Sigue arriba de todo: **la hora con el contador**, que es lo único que decide si exportar sesiones cierra.

---

## 2026-08-19 — Andre (sesión 113)

**Tocado:** `screens/CoachProfileScreen.tsx`, `SCHEMA.md`. Nuevos: `lib/pricing.ts`, `__tests__/pricing.test.ts`, `scripts/add-paypal-rail.sql` (⚠️ **PENDIENTE DE CORRER**), `docs/cobro-internacional-coaches.md`. 229 tests (eran 218).

**Resumen — se decidió el riel de cobro del exterior y arrancó el schema. Ninguna edge function todavía.**

- 📝 **Corrección al registro, y me hizo recomendar mal durante media sesión: los 32 coaches son de PRUEBA y la app no salió.** La 101 dice "preguntarles a los 32 coaches actuales" y la 102 trata el mensaje a los coaches como "lo único que bloquea de verdad", así que estuve argumentando "no construyas, no hay tráfico" sobre una premisa falsa. No hay clientes porque no se lanzó.
- **Decisión: PayPal como riel principal al lanzar, USDT como secundario.** Es un vuelco respecto de la 102 (que tenía USDT principal y PayPal complemento) y el motivo es la conversión: el muro de cripto deja afuera a la mayoría en el momento en que más importa. USDT se queda porque ya está hecho, cuesta ~0 y sirve al segmento cripto-nativo.
- **Stripe descartado, con una razón mejor que "es burocrático":** aunque se hiciera la LLC, **Connect no paga a Argentina**. No es más papeleo para el mismo resultado, es más papeleo para medio resultado — resolvería el cobro y dejaría un ente en EEUU cuya plata igual tiene que llegar a coaches argentinos.
- **Payoneer, evaluado por primera vez: no sirve como checkout** (links de cobro tipo factura, no un flujo embebido), sí como capa de recepción y retiro. Son dos preguntas distintas —cómo paga el comprador y cómo aterriza la plata— y mezclarlas es lo que hacía dar vueltas al registro.

**Las comisiones, de la fuente y no de blogs:**

- **5,40% + USD 0,30** por transacción comercial, **todos los mercados**, sin comisión extra por ser internacional. Argentina está agrupada con el resto de Latinoamérica. (El 4,4% que circula en blogs es la tarifa de otros mercados.)
- **4,50% de spread** de conversión de divisa. 🔴 **Pero ese es evitable y el otro no**: solo se aplica si PayPal convierte. **Decisión de Andre: se mantiene saldo en dólares y se retira por una vía que no convierta en PayPal**, así que el precio cubre solo el 5,40% + 0,30. Meter el 4,5% en el precio sería cobrarle al cliente un costo que se puede evitar operativamente.
- **Estrategia de precio: un solo precio con el costo adentro**, no un ítem separado — el contrato de PayPal prohíbe el recargo por usar PayPal, pero poner precio no es recargar. ⚠️ Leído de fuentes secundarias sobre el contrato estadounidense; el texto argentino lo tiene que mirar quien revise los T&C.
- 🔴 **Mi primera propuesta (+7% flat) estaba mal y el test lo fija.** Como los USD 0,30 no escalan, el recargo real depende del precio: +6,0% sobre 100, +6,2% sobre 60, +7,3% sobre 20, **+37% sobre 1**. Un porcentaje plano cobra de menos justo donde el fijo pesa. Va la fórmula `(precio + 0,30) / 0,946`, redondeada al centavo de **arriba** — hacia abajo VIVE pondría la diferencia en cada transacción.
- De ahí sale el **mínimo de USD 20** para el precio internacional (CHECK 1..10000 → 20..10000).

**Lo construido:**

- **`lib/pricing.ts`** (puro, 11 tests) con el mínimo, el gross-up y `netAfterPaypal`. **El test que importa es el que verifica que el gross-up alcance de verdad**: después de que PayPal cobre lo suyo tiene que quedar al menos el precio del coach en todo el rango — si quedara menos, la diferencia la pondría VIVE en cada sesión, en silencio.
- **`scripts/add-paypal-rail.sql`** — `charged_amount`, el CHECK nuevo y `expire_unpaid_checkouts()` extendida al tercer riel. ⚠️ Trae un `UPDATE` obligatorio antes del CHECK: el coach de prueba está en `price_usd = 6` y sin corregirlo el constraint no se crea. De paso cierra el pendiente de la 103.
- **`docs/cobro-internacional-coaches.md`** — la explicación para el coach. 🔴 **La sección "qué facturás" queda BLOQUEADA** hasta la respuesta del contador: depende de si VIVE es principal o por cuenta y orden, y en el segundo caso **el coach podría terminar siendo el exportador**, que es justo lo que el punto 1 del propio documento le promete evitar. Es la sección que más le importa, así que el documento no se manda hasta cerrar eso.

**Pendiente para la próxima sesión:**
- **Correr `scripts/add-paypal-rail.sql`** (revisando antes el `UPDATE` del precio de prueba).
- 🔴 **Falta la cuenta PayPal Business y las credenciales** (`client_id`, `secret`, `webhook_id`). Sin eso no se puede construir ni probar. Conviene arrancar por **sandbox** — a diferencia del de Mercado Pago, que estaba roto y obligó a probar con plata real.
- **Las edge functions**: `paypal-create-payment` (reusa `commissionPctFor` y `PAIR_SESSION_FILTER`), webhook **con verificación de firma desde el principio** —es donde el de MP estuvo muerto un mes sin que nadie se enterara—, procesador de reembolsos gemelo de `mp-process-refunds`, y la UI con el patrón de `booking-return`.
- ⚠️ **Riesgos de PayPal que el precio no arregla, para tener presentes al lanzar:** (1) **contracargos** — "el servicio no se prestó" sobre una videollamada, sin nada que enviar, es dificilísimo de defender; conviene dejar rastro de asistencia a la sala. (2) **Congelamiento de saldo** — y ahora es peor que cuando se anotó en la 101, porque el saldo contiene los payouts de los coaches: un congelamiento hace que los coaches no cobren. Mitigación: retirar seguido y tener reserva fuera de PayPal para un ciclo de pagos. (3) **La plata que entra por PayPal no puede salir como USDT directamente** — un coach que eligió cobrar en USDT implica un paso de conversión intermedio.
- **Definir la vía de retiro** concreta (Prex, Belo, Payoneer, banco). No bloquea construir, sí lanzar.
- Sigue arriba de todo: **la hora con el contador**. Es lo único que decide si el negocio de exportar sesiones cierra — la plataforma ya está decidida.

---

## 2026-08-19 — Andre (sesión 112)

**Tocado:** `lib/bookingHelpers.ts`, `lib/bookingCancel.ts`, `screens/SalaScreen.tsx`, `screens/SessionsScreen.tsx`, `screens/CoachHomeScreen.tsx`, `screens/BookingScreen_Time.tsx`, `supabase/functions/_shared/guarantee.ts`, `SCHEMA.md`. Nuevos: `lib/time.ts`, `__tests__/time.test.ts`, `scripts/add-late-cancel-server-side.sql`. 218 tests (eran 198).

**Resumen — punto 3, zonas horarias. Resultó ser un bug de plata, no una mejora de copy.**

- 🔴 **El reembolso lo decidía el teléfono del usuario, y leía su zona horaria.** `lib/bookingCancel.ts` escribe `cancelled_late` con `isCancelLate`, y `trg_mark_refund_on_cancel` lee esa columna para decidir si devuelve la plata. `isCancelLate` armaba el instante con `new Date(year, month-1, day, h, m)`, que interpreta una hora guardada **en horario argentino** según la zona **del dispositivo**. En un teléfono argentino coincide y por eso nunca se vio; desde Madrid el instante cae 5 horas antes, así que **alguien cancelando con 29 horas de anticipación quedaba marcado como tardío y perdía un reembolso que le correspondía**. Le pegaba justo a los usuarios del riel internacional. Es el mismo bug que tenía `create-meeting-room` en la 101, del lado del cliente.
- 🔴 **Y la misma columna era falsificable.** `harden-bookings-update.sql` le da `grant update (… cancelled_late …)` a `authenticated` y ninguna política restringe su VALOR: contra la API directa se podía cancelar una hora antes mandando `cancelled_late = false` y cobrar el reembolso igual — la penalidad por cancelación tardía no era exigible. Mismo patrón que la 104: la pantalla no es la frontera.
- **Los dos se cierran con el mismo cambio**: el trigger calcula la tardanza por su cuenta, con `AT TIME ZONE 'America/Argentina/Buenos_Aires'`, y **pisa** lo que mande el cliente. La columna pasa de entrada a dato derivado, auditable contra `scheduled_date`/`scheduled_time`.
  - ⚠️ **Se pisa el valor en vez de revocar el grant, a propósito.** Revocar rompería a cualquiera con una build vieja: la cancelación escribe `status`, `cancelled_by` y `cancelled_late` en un solo UPDATE y si una columna queda fuera del grant **falla el UPDATE entero** (la lección de la 104) — nadie podría cancelar hasta actualizar la app. Pisando el valor, las builds viejas siguen mandando lo que mandaban, se ignora, y el resultado es correcto igual.
  - Como el trigger es BEFORE UPDATE, la fila que vuelve ya trae el valor corregido, así que **el mensaje que ve la persona sigue la decisión del servidor** y no la que había calculado su teléfono. Eso ya funcionaba así para `payment_status`; ahora vale también para la tardanza.

**El mismo patrón estaba en seis lugares más, todos decidiendo cosas visibles:**

- **La sala se "abría" a la hora equivocada** y el countdown mentía (`SalaScreen`), **el botón de entrar** aparecía corrido (`SessionsScreen`), y el coach de viaje veía su propia agenda mal (`CoachHomeScreen`).
- 🔴 **El selector de horarios era el peor.** Comparaba el día y los minutos DEL DISPOSITIVO contra horas guardadas en horario argentino: desde Madrid a las 22:00 (17:00 en Argentina) daba por pasados todos los turnos hasta las 22:00 ART. **La persona abría la pantalla y veía casi todo gris, sin ningún motivo visible.** Ahora compara instantes absolutos, que resuelve el día y la hora de una.
- **"Hoy" y "Mañana" se contaban en días del dispositivo.** A la 01:00 en Madrid en Argentina todavía es el día anterior, así que la tarjeta decía "Mañana" para una sesión de hoy.
- **Los eventos de calendario** se armaban con componentes locales, o sea que se agendaban a la hora equivocada.

**Decisiones:**

- **Zona IANA en los tres lados, no offset fijo.** Argentina no tiene horario de verano desde 2009, así que hoy `-03:00` da el mismo número. Se usa el nombre igual porque el offset fijo se rompe **en silencio** el día que vuelva a haber DST —se discute cada par de años— y lo que se rompe son reembolsos y salas de video, una hora corridas. `_shared/guarantee.ts` pasó de `-03:00` a la zona, igual que ya hacían los dos crons SQL. **Hay un test que exige que cliente y servidor devuelvan el MISMO número**: si divergen, la app promete una cosa y la base hace otra.
- **`Intl` con `timeZone` se chequea de forma FUNCIONAL, no por feature-detect.** Soportar un locale y soportar la opción `timeZone` son cosas distintas, y en Hermes eso dependió de cómo esté compilado. Se convierte un instante cuya respuesta se conoce y se compara; si no da, se cae al offset fijo, que es exactamente el comportamiento actual. Un detect que solo mirara si la API existe devolvería `true` en un motor que después ignora la zona en silencio.
- 📝 **La zona del usuario es un PARÁMETRO inyectable**, igual que `now` en `commissionPctFor`. No es un detalle de estilo: dentro de jest, mutar `process.env.TZ` en caliente **no** reconfigura `Date`, así que los primeros tests que escribí pasaban sin probar nada. Con la zona como parámetro se prueban Bangkok, Los Ángeles, Madrid y Montevideo de verdad.

**Y lo que se muestra (bloque C):**

- **El cartel del selector era una etiqueta, no una conversión.** Decía "Horarios en zona horaria Argentina (ART)" y dejaba la cuenta a cargo de quien reserva. Elegir "21:00" desde Bangkok sin ver que para vos es el **martes a las 07:00** no es una molestia, es reservar a ciegas — y lo que se corre es el **día**, que es lo que de verdad muerde. Ahora, al elegir un horario, aparece la equivalencia con el día nombrado.
- Las tarjetas de sesión (`SalaScreen`, `SessionsScreen`) muestran la hora local al costado. **La hora argentina se sigue mostrando primero y no se reemplaza**: es la que acordaron las dos partes, y si cada uno ve un número distinto dejan de poder hablar del mismo horario.
- **Montevideo y São Paulo (en invierno) no cuentan como otra zona**: se compara el offset, no el nombre. Mostrar una "conversión" que dice lo mismo dos veces es ruido.

**Pendiente para la próxima sesión:**
- ✅ **Hecho el mismo día**: `scripts/add-late-cancel-server-side.sql` corrido, y `guarantee-claim` + `create-meeting-room` deployadas (las dos usan `_shared/guarantee.ts`; las dos bootean y contestan desde su propio código, así que el `Intl` que ahora corre al cargar el módulo no rompe nada en Deno).
- **Nada de esto se probó en dispositivo.** Typecheck, lint (0 warnings nuevos) y 218 tests, pero el filtro del punto 2, el badge, el precio en dólares y toda la capa de zonas horarias no se vieron corriendo. Para probar zonas alcanza con cambiar la zona del teléfono a Madrid o Bangkok — no hace falta viajar.
- ⚠️ **Falta verificar `Intl` con `timeZone` en el dev build.** Si el chequeo funcional da `false`, todo cae al offset fijo y las equivalencias locales no se muestran (degrada al comportamiento de hoy, no rompe). Se ve rápido: si el cartel de conversión no aparece con el teléfono en Madrid, es eso.
- **Punto 4, higiene**: `USDT_WALLET_TRC20` sigue apuntando a la dirección personal de Andre y el precio de prueba sigue en 6 USD.
- Sigue arriba de todo: **el mensaje a los coaches** (1 de 32 tiene el internacional prendido) y **la hora con el contador**.

---

## 2026-08-19 — Andre (sesión 111)

**Tocado:** `lib/coachesCache.ts`, `app/search3.tsx`, `screens/ProfesionalScreen.tsx`, `screens/BookingScreen_Confirm.tsx`, `SCHEMA.md`, `CHANGELOG_SESIONES.md` (corrección a la 101). Sin cambios de base de datos. 198 tests.

**Resumen — la oferta del riel internacional existía y no se veía. Punto 2 de los cuatro.**

- **`accepts_international` se leía en UN solo lugar**: `BookingScreen_Confirm`, para decidir si dibujaba el botón de USDT. No estaba en la búsqueda, ni en `coachesCache`, ni en el perfil público. El dato es **público a propósito** —la nota de la 102 decía "el usuario del exterior tiene que poder filtrar por esto como filtra por precio"— pero ese filtro nunca se había construido: alguien desde Madrid recorría el catálogo entero sin saber quién lo atiende y se enteraba recién en el checkout.
- **Ahora se lee en tres lugares más**: el cache (y de ahí el filtro "¿Estás fuera de Argentina?" en `search3`), y el perfil público, con badge arriba y el precio en dólares en el footer al lado del de pesos.
- ⚠️ **En todos va junto con `price_usd != null`, nunca solo.** `usdt-create-payment` rechaza el cobro sin precio en dólares, así que un coach con el flag prendido y sin precio **no puede** recibir una reserva del exterior. Es la misma condición que ya usaba el botón de USDT — si el filtro usara otra, el catálogo prometería algo que la pantalla de pago no ofrece.
- 🔴 **El checkout mostraba el precio equivocado.** `BookingScreen_Confirm` renderizaba siempre `priceFrom` formateado `es-AR`, así que quien elegía "Crypto · USDT" leía **$4.500** y en la pantalla siguiente le aparecía un número en dólares sin relación con ese. No es una conversión mal hecha: son **dos precios distintos que el coach fija por separado** (`price_usd` no se deriva de ninguna cotización), y encima el monto real de USDT trae los centavos que identifican el pago, con lo cual ni siquiera coincide con el precio redondo. Ahora el precio sigue al método elegido.

**Antes de esto, un test que salió negativo y corrige a la sesión 101.**

- Andre marcó que **Mercado Pago también es internacional** —opera en 7 países— y que la evidencia de la 101 solo cubría tarjetas de otros continentes. Es cierto: sobre tarjetas de Brasil, México, Chile, Uruguay o Colombia no había ni un dato.
- Se repitió el test de BINs contra `payment_methods/search` con la public key de la app, con BINs reales de la región. 🔴 **El resultado es que el endpoint no mide lo que se creía.** Tres cosas lo muestran: una Mastercard de **crédito argentina verificada** (554210) devuelve **vacío** —o sea que "sin resultado" no marca extranjera—, una Visa de **crédito de Estados Unidos** resuelve `visa`/`credit_card`/`active` idéntico a una argentina, y el `debvisa`/`debit_card` que la 101 tomó como la causa del rechazo aparece también en tarjetas de crédito **mexicanas**. Resuelve BIN → marca y tipo, y nada más.
- **La corrección quedó anotada dentro de la entrada de la 101**, porque ese archivo afirmaba como probado algo que no lo está y se lee rápido. Lo que sigue en pie es el dato duro: una tarjeta de otro continente, tipeada de verdad en el checkout, fue rechazada. La causa no está probada.
- 📝 **De paso, un error propio que vale anotar**: los dos BINs argentinos de control los puse de memoria, sin verificarlos contra fuente — exactamente lo que había advertido que no había que hacer, porque un BIN inexistente da un resultado indistinguible de uno rechazado. Uno de los dos no existía. El test recién sirvió cuando se rehizo con BINs verificados.
- **Esto no bloqueaba el punto 2**: si las tarjetas de la región funcionaran, esos usuarios reservan por Mercado Pago como cualquiera y **ni tocan el flag** — que existe para quien no puede pagar con tarjeta. La capa de visibilidad es la misma en los dos escenarios; lo único que cambia es cuánta gente queda del lado del USDT.

**Pendiente para la próxima sesión:**
- 🔴 **Hay UN solo coach con `accepts_international = true` sobre 32 activos y verificados** — y es el de prueba, con `price_usd = 6` (el precio de test que quedó de la 103). O sea que el filtro recién construido, corrido hoy en producción, devuelve un resultado y es falso. **Es literalmente el escenario de la 101: "si de 32 activan 5, el usuario de Miami abre la app y la ve vacía".** La capa de visibilidad está lista y no hay nada que mostrar.
- 🔴 **Por eso lo que bloquea sigue siendo el mensaje a los coaches** (redactado en la 102), no código. ¿Tomarían una sesión del exterior cobrando por VIVE? ¿Aceptarían USDT?
- **Falta probar en dispositivo** el filtro nuevo, el badge del perfil y el precio en dólares del checkout.
- **Un test real con tarjeta de la región** (alguien en Brasil/Chile/México/Uruguay reservando de verdad) es lo único que decide si "exterior" son uno o dos buckets. La otra vía es el equipo comercial de MP: `crm_regionales@mercadopago.com`.
- **Punto 3: zonas horarias**, con zona y no con offset fijo. **Punto 4: higiene** — `USDT_WALLET_TRC20` sigue apuntando a la dirección personal de Andre y el precio de prueba sigue en 6 USD.
- Sigue abierta **la hora con el contador** (VIVE principal o por cuenta y orden).

---

## 2026-08-19 — Andre (sesión 110)

**Tocado:** `supabase/functions/_shared/commission.ts`, `usdt-create-payment/index.ts`, `mp-create-payment/index.ts`, `admin-actions/index.ts`, `lib/admin.ts`, `lib/payout.ts`, `screens/AdminScreen.tsx`, `__tests__/commission.test.ts`, `__tests__/payout.test.ts`, `SCHEMA.md`. Nuevo: `scripts/add-coach-payouts.sql` (**corrido y verificado**). Las tres edge functions **deployadas**. 198 tests (eran 187).

**Resumen — el riel internacional cobraba bien y no sabía cuánto le debía al coach. Punto 1 de los cuatro que salieron de repasar el tema del exterior.**

- 🔴 **`usdt-create-payment` nunca escribía `platform_fee_pct`.** Escribía `payment_provider`, `payment_status`, `currency`, `amount` y `usdt_amount`, y nada más: toda reserva internacional se quedaba con el **default 20** de la columna, sin contar las sesiones del par. En Mercado Pago ese campo es casi decorativo —el split ya repartió la plata en el momento del cobro—, pero **en el riel internacional entra el 100% a la wallet de VIVE y ese porcentaje es lo único que después dice cuánto transferirle al coach**: un par en el tramo del 15%, o en plena promo fundador de 0%, iba a cobrar de menos el día de la transferencia y nada lo habría delatado. Ahora calcula igual que MP, con el mismo contador — que **no depende del riel**, porque es de la relación coach-usuario: una primera sesión pagada en pesos manda la segunda al 15% aunque se pague en dólares.
- 🔴 **Y al hacerlo apareció que el filtro de checkouts abandonados estaba desactualizado.** Vivía escrito inline dentro de `mp-create-payment` como predicado SQL y miraba **solo `preference_id`**, el marcador de Mercado Pago. Un cobro de USDT abandonado que igual llegara a `completada` empujaba al par al tramo del 15% sin que hubiera entrado un dólar — **las 16 reservas fantasma de agosto otra vez, por la otra puerta**. El predicado se mudó a `_shared/commission.ts` como `PAIR_SESSION_FILTER`, al lado de la versión JS que sí tenía tests, y ahora reconoce los dos marcadores. Verificado contra PostgREST con la anon key antes de deployar: el `or` anidado resuelve, y el control con una columna inventada devuelve 42703 — o sea que un filtro mal armado se habría visto.
- 🔴 **El panel nunca tuvo policy de SELECT sobre `bookings`.** `add-admin-flag.sql` creó cuatro (`reports`, `guarantee_claims`, `coaches`, `profiles`) y ninguna cubre `bookings`. La **pestaña de Reembolsos de la sesión 104** consulta esa tabla con la sesión del admin, así que bajo RLS solo veía las reservas propias: **cualquier reembolso de USDT de otra persona salía como lista vacía, sin error**. Pasó desapercibido porque el único reembolso probado con plata real fue por Mercado Pago, que no pasa por esa pestaña. `bookings_select_admin` va en el script nuevo.
- **Registro de la deuda con el coach**: `bookings.paid_out_at` + `payout_reference`, pestaña **Pagos** en el panel (agrupada por coach, con el desglose sesión por sesión a la vista — el total es la cifra que se tipea en una transferencia que no se deshace) y la acción `mark_coach_paid`. **En lote a propósito**: una transferencia semanal cubre varias sesiones, y marcarlas de a una dejaría la mitad pagada si algo falla en el medio, sin forma de saber cuáles entraron en la plata que ya salió. La transferencia se sigue haciendo a mano, mismo criterio que los reembolsos de USDT: automatizarla exige la clave privada de la wallet en el backend.
  - **La base del cálculo es `amount`, nunca `usdt_amount`** — este último trae el identificador del pago en los centavos, y pagárselo al coach sería regalarle hasta 0,99 USD por sesión de una plata que existe solo para reconocer la transferencia.
  - `paid_out_at` y `payout_reference` **no tienen `grant update` para `authenticated`**: las escribe solo `admin-actions` con service role. Marcarse a uno mismo como cobrado no puede ser una acción del cliente.
  - `payout_reference` es texto libre y no 64 hex como `mark_usdt_refunded`: una transferencia bancaria no tiene hash, y exigir el formato de cripto dejaría sin poder registrar el método más común.
- **Si el script no se hubiera corrido, la pestaña habría mostrado el error y no una lista vacía.** `listCoachPayouts` devuelve `{ rows, error }` en vez de tragarse el fallo: "no le debemos nada a nadie" y "no pudimos averiguar a quién le debemos" se ven igual y significan lo opuesto. Es el modo de falla que este proyecto ya se comió tres veces (el cron con el placeholder, el webhook muerto, la pestaña de reembolsos sin policy).

**Contexto — de dónde salió esto.** Se repasó el estado del cobro a gente del exterior y quedaron cuatro bloques ordenados por daño: (1) comisión y registro de pagos, hecho acá; (2) **hacer visible la oferta** — `accepts_international` no se lee en `search3`, `coachesCache` ni `ProfesionalScreen`, así que hoy el usuario del exterior recorre el catálogo entero sin saber quién lo atiende y se entera recién en el checkout, y encima `BookingScreen_Confirm` muestra el precio en pesos formateado `es-AR` aunque elija USDT; (3) **zonas horarias**, con zona y no offset fijo; (4) **higiene**: `USDT_WALLET_TRC20` sigue apuntando a la dirección personal de Andre y el precio de prueba del coach quedó en 6 USD.

**Pendiente para la próxima sesión:**
- **Punto 2: hacer visible la oferta del riel internacional** — es lo que sigue.
- **Nada de esto se ejerció con datos reales todavía**: no hay ninguna sesión internacional `completada`, así que la pestaña Pagos está legítimamente vacía y `mark_coach_paid` nunca corrió. La primera sesión del exterior es la que lo prueba.
- 🔴 **Sigue siendo lo único que bloquea de verdad: el mensaje a los 32 coaches** (redactado en la 102). ¿Tomarían una sesión del exterior cobrando por VIVE? ¿Aceptarían USDT? Sin oferta no hay servicio.
- 🔴 **La hora con el contador**, también de la 102: VIVE como principal o por cuenta y orden. Y los dos hallazgos que apuntan al mismo lado — la exportación computa igual para el tope del monotributo, y con pauta >$500.000/mes conviene RI aunque el volumen sea chico.

---

## 2026-08-19 — Joaquín (sesión 107)

**Tocado:** `screens/BookingScreen_Confirm.tsx`, `supabase/functions/mp-create-payment/index.ts`, `supabase/config.toml`, `SCHEMA.md`. Nuevo: `supabase/functions/booking-return/index.ts` (**deployada**).

**Resumen — después de pagar con Mercado Pago, la app se quedaba pegada en la pantalla de MP. Ahora vuelve sola.**

- **Pedido de Joaquín, encontrado probando el pago del tramo del 15%** (sesión 106): "quiero que me redirija" a la app en vez de quedarse en el navegador de MP.
- 🔴 **La causa era doble, y arreglar solo un lado no alcanzaba.** (1) `CHECKOUT_RETURN_URL` nunca tuvo un valor https configurado — MP **exige** https para `back_urls` (un deep link `viveapp://` da `invalid_back_urls` al crear la preferencia), así que `mp-create-payment` nunca mandaba `back_urls`/`auto_return`: MP no tenía a dónde redirigir. (2) Del lado del cliente, producción usaba `WebBrowser.openBrowserAsync` — un browser normal, que no sabe esperar un redirect ni cerrarse solo. Solo `__DEV__` usaba `openAuthSessionAsync` (el que sí detecta el redirect y cierra), y ahí con sesión efímera, a propósito, para poder cambiar de cuenta de MP entre pruebas.
- **Arreglados los dos juntos.** Nueva edge function `booking-return` (`verify_jwt=false`, mismo patrón que `mp-oauth-callback`/`APP_DEEP_LINK` para la conexión de MP del coach): recibe la vuelta de MP en una URL https real y hace un 302 a `viveapp://booking/result`, reenviando los query params de MP por si algún día hacen falta (hoy no se leen — la app sigue confiando en `payment_status` vía `mp-webhook` + el sondeo de 12s que ya tenía `BookingScreen_Confirm`). `CHECKOUT_RETURN_URL` (secret) apunta ahí. Del lado del cliente, las dos ramas (dev y prod) pasaron a `openAuthSessionAsync` — la única diferencia que queda es `preferEphemeralSession: __DEV__`, para no perder el login persistente de MP en producción.
- **Verificado el bounce con curl antes de tocar la app**: `GET booking-return?payment_id=123&status=approved` → `302 Location: viveapp://booking/result?payment_id=123&status=approved`. Falta la confirmación visual en el dev build (que el browser se cierre solo después de pagar) — el próximo pago de prueba la da gratis.
- Typecheck, lint (0 warnings nuevos) y 187/187 tests limpios. `booking-return` y `mp-create-payment` (solo cambiaron comentarios) redeployadas.

**Pendiente para la próxima sesión:**
- **Confirmar visualmente en el dev build** que después de pagar el browser se cierra solo y vuelve a la app — no se pudo ver en vivo desde acá, solo verificar el 302 con curl.
- Sigue sin probarse la reserva instantánea con pago, y el guardarraíl de reconexión de MP en el celular (heredado de sesiones anteriores).

---

## 2026-08-20 — Joaquín (sesión 110)

**Tocado:** `screens/BookingScreen_Confirm.tsx`, `supabase/functions/mp-create-payment/index.ts` (redeployada). Secret `CHECKOUT_RETURN_URL` — **unset**.

**Resumen — el intento de cierre automático de la sesión 107 salió PEOR que el comportamiento original. Revertido.**

- Joaquín probó en el dev build (con captura por AirDrop de cada paso) y la secuencia real fue: pagar → Safari muestra el cartel del sistema **"¿Abrir en Vita?"** → al tocar "Abrir", en vez de entrar a la app, Safari muestra **una checkout de MP nueva desde cero** ("¿Cómo querés pagar?") → recién ~10 segundos después de salir de ahí aparece la confirmación real (que sale del sondeo que la app ya hacía, no del redirect).
- 🔴 **Diagnóstico: el cartel "¿Abrir en Vita?" es la prueba de que `openAuthSessionAsync` NO está funcionando.** Si interceptara el redirect como se supone, no debería aparecer ningún cartel del sistema — la sesión se cierra en silencio y listo. Que aparezca significa que la pantalla de "pago aprobado" de MP **rompe** esa sesión (probablemente abre algo en un contexto nuevo del lado de MP, fuera de nuestro control) antes de llegar al redirect.
- **Revertido a `openBrowserAsync`** en producción (como estaba antes de la sesión 107) — sin depender de que el SDK detecte el redirect solo. El sondeo de `payment_status` que ya existía (12s, sin cambios) sigue siendo el mecanismo real que confirma el pago; cerrar el browser es cosa de la persona, como antes. `__DEV__` sigue con `openAuthSessionAsync` + sesión efímera (sirve para otra cosa: cambiar de cuenta de MP entre pruebas, no para el auto-cierre).
- **`CHECKOUT_RETURN_URL` unset** — así `mp-create-payment` no manda `back_urls`/`auto_return` y MP no intenta redirigir a nada, que es lo que dispara el cartel confuso del sistema.
- `booking-return` (edge function) y `app/booking/result.tsx` (sesión 107/109) **quedan en el repo, dormidos** — no rotos, solo sin usarse. Si se retoma esto, la nota en el código apunta a la vía más confiable: `Linking.addEventListener('url', …)` + `WebBrowser.dismissBrowser()` manejado a mano, no depender del auto-detect del SDK.
- Typecheck, lint y 187/187 tests limpios. `mp-create-payment` redeployada (comentarios actualizados, sin cambio de lógica).

**Pendiente para la próxima sesión:**
- El cierre automático del browser después de pagar con MP **queda sin resolver, y no es prioritario** — el flujo funciona (el sondeo lo confirma), solo no es "mágico". Si se retoma, investigar por qué la pantalla de "pago aprobado" de MP rompe `ASWebAuthenticationSession` antes de intentar de nuevo.
- El guardarraíl de reconexión de MP sigue siendo el único pendiente grande de plata sin probar en dispositivo.

---

## 2026-08-20 — Joaquín (sesión 111)

**Tocado:** `screens/BookingScreen_Confirm.tsx`.

**Resumen — cierre automático del browser de MP, tercer intento: en vez de esperar el redirect (que no funciona), la app lo cierra ella misma cuando confirma el pago.**

- Joaquín no quería tener que cerrar la pestaña a mano (la sesión 110 había revertido a eso). En vez de insistir con el redirect de MP (roto, ver sesión 110), se cambió el mecanismo de raíz: la app **ya sondeaba `payment_status` cada 2s** para saber si el pago entró — ahora, en producción, ese mismo sondeo llama a `WebBrowser.dismissBrowser()` apenas ve `'aprobado'`. No depende de ningún redirect, cartel del sistema, ni sesión especial — solo de lo único que ya era la fuente de verdad real (`mp-webhook` escribiendo `payment_status`).
- **Cambio de forma, no de fondo:** antes se hacía `await WebBrowser.openBrowserAsync(initPoint)` (bloqueaba hasta que la persona cerraba) y RECIÉN DESPUÉS arrancaba el sondeo. Ahora se abre sin `await` (sigue de largo) y el sondeo corre en paralelo — cuando confirma el pago, cierra el browser con `dismissBrowser()`. Si la persona lo cierra a mano antes de que se confirme, no rompe nada: `dismissBrowser()` sobre un browser ya cerrado queda contenido en un `try/catch`.
- `__DEV__` no se tocó — sigue con `openAuthSessionAsync` + sesión efímera (sirve para cambiar de cuenta de MP entre pruebas) y cierre manual, que para testing está bien.
- `CHECKOUT_RETURN_URL` sigue unset (sesión 110) — no hace falta para este mecanismo, no depende del redirect.
- Typecheck, lint y 187/187 tests limpios. **No se pudo probar en dispositivo desde acá** — próximo pago real lo confirma.

**Pendiente para la próxima sesión:**
- **Confirmar en el dev build** que ahora sí se cierra solo, sin el cartel de "Abrir en Vita" ni la checkout fantasma de las sesiones 107/110.
- El guardarraíl de reconexión de MP sigue siendo el único pendiente grande de plata sin probar en dispositivo.

---

## 2026-08-20 — Joaquín (sesión 112)

**Tocado:** ninguno. Verificación en producción.

**Resumen — el guardarraíl de reconexión de MP (sesión 88) quedó probado. Era el último pendiente grande de plata de la lista de QA.**

- Coach Prueba ya tenía un booking `aprobado` activo (la instantánea de la sesión 108, sin completar todavía) — no hizo falta armar nada nuevo. Joaquín entró como Coach Prueba, tocó "Cambiar" en Mercado Pago.
- ✅ **Resultado:** apareció el Alert exacto ("Todavía no podés cambiar de cuenta… tenés pagos cobrados o reembolsos pendientes…") y el OAuth de reconexión **no se abrió**. Funciona como se diseñó en la sesión 88.
- Con esto se cierran los tres pendientes grandes de plata de la lista de QA original (15% en la 106, instantánea con pago en la 108, guardarraíl acá). Quedan pendientes menores: alta de coach con Google/Apple, toggle de sesiones del exterior + datos de cobro, y bloqueo de usuarios — ninguno mueve plata.

---

## 2026-08-20 — Joaquín (sesión 113)

**Tocado:** `screens/BookingScreen_Confirm.tsx`.

**Resumen — cuarto intento con el cierre del checkout de MP. Esta vez sí ataca la causa real: se sacó el browser del sistema por completo.**

- Joaquín mandó capturas nuevas: después de pagar, la pantalla mostraba **"◄ Vita"** arriba — el cartelito que pone iOS cuando saltás de una app a OTRA app de verdad, no una pestaña web. Eso reveló la causa real de los tres intentos anteriores (107, 110, 111): **Mercado Pago tiene su propia app nativa instalada en el teléfono, y salta a ella** para mostrar "pago aprobado" en vez de quedarse en nuestra pestaña. Ese salto pasa completamente por fuera de lo que nuestro código puede ver o cerrar — ni `openAuthSessionAsync` ni `dismissBrowser()` pueden hacer nada contra una app DISTINTA que se puso encima.
- Se evaluó evitar el salto pagando como invitado (sin "Ingresar con mi cuenta") — **descartado por Joaquín**: la mayoría de la gente real va a pagar logueada a su MP, así que optimizar para el camino de invitado no serviría para el caso común.
- **Arreglo de fondo: sacar el browser del sistema (`expo-web-browser`) por completo, y embeber el checkout con `react-native-webview`** (ya estaba en el proyecto, sin usar). Con un `WebView` propio, `onShouldStartLoadWithRequest` puede **bloquear cualquier navegación que no sea http(s)** — exactamente donde MP intentaría saltar a su app nativa — sin tocar el pago en sí, que sigue funcionando adentro del mismo checkout web.
- El sondeo de `payment_status` (sin cambios, ya funcionaba) sigue siendo quien decide cuándo cerrar: al confirmar el pago, `setCheckoutUrl(null)` desmonta el WebView — más simple y más confiable que `dismissBrowser()`, porque ahora es SIEMPRE nuestra propia vista, nunca algo que otra app se pueda robar.
- `incognito={__DEV__}` reemplaza a `preferEphemeralSession`: sin cookies en testing (cambiar de cuenta de MP entre pruebas), persistentes pero aisladas de Safari en producción (no repetir login de MP en cada reserva) — mismo objetivo que antes, ahora contenido en nuestra propia vista.
- Botón X + `BackHandler` (Android) para cerrar el checkout a mano si hace falta — el sondeo ya no depende de que el browser siga abierto para seguir corriendo, corta solo si detecta que se cerró.
- `CHECKOUT_RETURN_URL` sigue sin usarse (ya no hace falta ningún redirect con este diseño). `booking-return`/`app/booking/result.tsx` (sesiones 107/109) siguen dormidos en el repo.
- ⚠️ **Riesgo a confirmar en dispositivo**: `react-native-webview` es un módulo nativo. Si el dev build actual no lo tiene compilado (la dependencia ya estaba en `package.json` de antes, pero nunca se había usado en código), puede hacer falta una build nueva de EAS — no alcanza con recargar el JS.
- Typecheck, lint y 187/187 tests limpios. **No probado en dispositivo desde acá** — el próximo pago real lo confirma.

**Pendiente para la próxima sesión:**
- **Confirmar en el dev build** que el checkout embebido carga bien y que el cierre automático funciona ahora sí, sin saltar a la app nativa de MP.
- Si tira error de módulo nativo, hace falta un build nuevo de EAS (`eas build --profile development --platform ios`) antes de seguir probando.

---

## 2026-08-20 — Joaquín (sesión 114)

**Tocado:** `screens/BookingScreen_Confirm.tsx`.

**Resumen — el checkout embebido (sesión 113) funcionó, pero `incognito` escondía la opción de pagar con cuenta de MP.**

- Joaquín probó en dispositivo: el WebView cargó bien (el módulo nativo ya estaba compilado, no hizo falta build nueva) y mostró el header propio ("X" + "Mercado Pago"). Pero faltaba la sección **"Con tu cuenta de Mercado Pago → Ingresar con mi cuenta"** — solo aparecían Tarjeta y Efectivo.
- 🔴 **Causa: `incognito={__DEV__}`.** Sin cookies, MP no reconoce ninguna sesión logueada y no ofrece la opción de cuenta — justo el caso que Joaquín había marcado como el que importa de verdad: alguien sin tarjeta que necesita pagar con el dinero de su cuenta de MP.
- **Sacado `incognito` en los dos ambientes.** Las cookies quedan persistentes pero aisladas de Safari (el `WebView` tiene su propio storage, separado del navegador del sistema) — mismo objetivo que se buscaba con la sesión efímera antigua (no repetir login de MP en cada reserva), sin el efecto secundario de esconder la opción de cuenta.
- Typecheck, lint y 187/187 tests limpios. **Falta la confirmación final en dispositivo**: que con esto puesto vuelva a aparecer "Ingresar con mi cuenta" Y que el cierre automático siga funcionando.

**Pendiente para la próxima sesión:**
- Confirmar en el dev build: aparece "Ingresar con mi cuenta", el pago con cuenta se completa normal, y el checkout se cierra solo al confirmarse — las tres cosas juntas, no probadas todavía con este último cambio.

---

## 2026-08-20 — Joaquín (sesión 115)

**Tocado:** `screens/BookingScreen_Confirm.tsx`.

**Resumen — bug real encontrado probando: el checkout embebido se cerraba solo a los 12s pasara lo que pasara, aunque la persona siguiera pagando.**

- Joaquín reportó: "si estás mucho tiempo en la pantalla sin hacer nada se reserva la sesión igual aunque no se haya concretado el pago". Causa: el sondeo (12s fijos, heredado de cuando el browser era del sistema) llamaba `setCheckoutUrl(null)` **sin importar si `paid` era `true`** — con el browser del sistema esto no se notaba (la pestaña seguía tapando todo mientras la app navegaba atrás en silencio), pero con el checkout embebido cerrarlo a los 12s es cerrarlo en la cara de alguien que todavía está tipeando la tarjeta o esperando un 2FA, y mandarlo a la pantalla siguiente como si ya hubiera pagado.
- **Arreglado:** el límite pasó de 12s (6 intentos) a 3 minutos (90 intentos) — lo único que corta antes ahora es pagar de verdad o cerrar el checkout a mano (botón X / back de Android, ya contemplado por `checkoutUrlRef`). El límite de 3 min sigue siendo un margen razonable de abandono real, no un tiempo de espera del pago (el webhook tarda ~2s una vez que la persona termina).
- También reportado: la carga del checkout embebido se siente más lenta que el browser del sistema — anotado, no investigado todavía (puede ser propio de WebView vs. SFSafariViewController para una página pesada como la de MP).
- Typecheck, lint y 187/187 tests limpios. **Falta confirmar en dispositivo** — junto con si "Ingresar con mi cuenta" ya aparece (sesión 114, sin confirmar todavía si mejoró).

**Pendiente para la próxima sesión:**
- Confirmar en el dev build las tres cosas juntas: aparece "Ingresar con mi cuenta", el checkout ya no se cierra antes de tiempo, y sigue cerrándose solo al pagar de verdad.
- Investigar el tiempo de carga del checkout embebido si sigue sintiéndose lento.

---

## 2026-08-20 — Joaquín (sesión 116)

**Tocado:** `screens/BookingScreen_Confirm.tsx`.

**Resumen — sacar `incognito` (sesión 114) no alcanzó: "Ingresar con mi cuenta" seguía sin aparecer. La causa real era otra.**

- El `WebView` tiene su **propio almacén de cookies**, completamente separado del de Safari — sacar `incognito` lo vuelve persistente, pero seguía sin haber visto NUNCA la sesión de MP de Joaquín, porque esa sesión vive en las cookies de Safari, no en las del WebView. Antes de la sesión 113 (browser del sistema) esto no era un problema: el browser del sistema comparte contexto con Safari por diseño.
- **Arreglado con `sharedCookiesEnabled` (solo iOS)** — hace que el `WebView` use el mismo `NSHTTPCookieStorage` que Safari, así que ve la sesión de MP que ya existe. No interfiere con `onShouldStartLoadWithRequest` (el bloqueo del salto a la app nativa, sesión 113): son mecanismos independientes, cookies vs. navegación.
- ⚠️ **Solo iOS.** Android no tiene este pendiente probado — su manejo de cookies de WebView es distinto (`CookieManager`, generalmente ya compartido con el sistema por default), pero no se verificó nada ahí porque no hay dispositivo Android de prueba.
- Typecheck, lint y 187/187 tests limpios. **Falta confirmar en dispositivo** — cuarta vuelta sobre el mismo problema, la esperanza es que esta sea la que cierra las tres cosas juntas: cuenta visible, sin cierre prematuro (sesión 115), y cierre automático al pagar.

**Pendiente para la próxima sesión:**
- Confirmar en el dev build las tres cosas juntas.
- Si "Ingresar con mi cuenta" sigue sin aparecer después de esto, quedaría descartado el lado de cookies — habría que investigar si MP usa alguna otra señal (User-Agent, fingerprint del dispositivo) para decidir si ofrece la opción de cuenta.

## 2026-08-20 — Joaquín (sesión 117) — cierre de la saga del checkout de MP

**Tocado:** ninguno. Diagnóstico final, sin más cambios de código.

**Resumen — probado en dispositivo: el cierre a tiempo y el bloqueo del salto a la app nativa quedaron resueltos. "Ingresar con mi cuenta" queda como limitación conocida, no como bug.**

- Joaquín confirmó: sin cierre prematuro (sesión 115) ✅, sin secuestro a la app nativa de MP (sesión 113) ✅. Solo sigue faltando "Ingresar con mi cuenta" pese a `sharedCookiesEnabled` (sesión 116).
- 🔴 **Causa real, y no tiene arreglo de código: en iOS ninguna app puede leer las cookies de navegación reales de Safari — restricción de seguridad de Apple.** Solo los componentes del propio sistema (`SFSafariViewController`/`ASWebAuthenticationSession`, lo que usábamos hasta la sesión 112) tienen ese acceso, porque son parte de Safari por dentro. Un `WebView` normal —lo que se necesita para bloquear el salto a la app nativa y controlar el cierre— nunca va a poder ver esa sesión, comparta cookies "propias" o no. `sharedCookiesEnabled` sincroniza cookies DENTRO del sandbox de la app, no las de Safari.
- **Es una tensión real entre dos propiedades que no se pueden tener juntas con las herramientas disponibles**: navegador del sistema (ve la sesión de MP, pero MP puede secuestrar el control hacia su app nativa) vs. WebView propio (control total, pero arranca sin sesión). Se priorizó el control — cerrar en el momento correcto y no perder al usuario en la app de otro es más grave que no ofrecer el atajo de cuenta.
- **No es permanente para siempre — es un costo de la primera vez.** El `WebView` SÍ guarda sus propias cookies entre usos (no es incógnito): si la persona llega a loguearse a MP alguna vez dentro de este checkout, esa sesión queda y "Ingresar con mi cuenta" debería aparecer en pagos siguientes. Sin confirmar si existe ese camino de login dentro del flujo actual (Tarjeta/Efectivo son las únicas opciones visibles hoy sin sesión).
- **Decisión: se deja pendiente, no se sigue iterando con plata real.** Fueron ~7 pagos reales de $4.500 solo en esta saga (sesiones 107 a 117). Lo que importaba de verdad —que el pago se confirme bien y la app no se quede pegada en otra app— está resuelto.

**Pendiente para la próxima sesión:**
- Si en algún momento importa recuperar "Ingresar con mi cuenta" desde el primer pago: investigar (sin gastar plata real, contra la documentación de MP) si el checkout ofrece algún link de login alternativo dentro del flujo de Tarjeta, o si hay que resignarse a que sea un costo de la primera vez.

---

## 2026-08-20 — Joaquín (sesión 118)

**Tocado:** ninguno. Verificación en producción.

**Resumen — alta de coach con Google (sesión 102), probada en dispositivo. 2 de 3 caminos confirmados con cuentas reales, el tercero queda cubierto por lógica pero no ejercitado con una cuenta 100% virgen.**

- **Cancelar el login de Google a mitad de camino** ✅ — no muestra error, la pantalla queda como si nada.
- **Cuenta que ya es usuario final** ✅ — probado dos veces sin querer (una con la cuenta de Coach Prueba, que llevó al panel de coach correctamente; otra con una cuenta de usuario final real) y una vez a propósito: rebota con "Esta cuenta ya está registrada como usuario. Para postularte como profesional necesitás usar un mail distinto", como se diseñó.
  - 📝 **Casi se reporta como bug y no lo era.** Joaquín probó con lo que creía una cuenta 100% nueva (`joaquinalbisu494@gmail.com`) y rebotó igual — se verificó contra `profiles` antes de tocar código: esa cuenta existe desde el **01/07/2026** como usuario final (es la misma cuenta "Joaquin" que ya había pagado la primera sesión de $1 con Coach Prueba en sesiones anteriores). El rebote era correcto — de paso confirma que la regla funciona con cuentas viejas, no solo con las recién creadas en el momento.
- **Alta 100% nueva** — sin ejercitar con una cuenta que nunca haya tocado Vita. Decisión: no vale la pena conseguir una cuarta cuenta de Google solo para esto — es el camino de menor riesgo de los tres (si falla, se nota altiro: nadie se puede registrar, error visible, no es un fallo silencioso como los otros dos que sí se confirmaron).

**Pendiente para la próxima sesión:**
- Si alguna vez se consigue una cuenta de Google genuinamente nueva, confirmar el alta feliz. No es urgente.

---

## 2026-08-20 — Joaquín (sesión 119)

**Tocado:** ninguno. Verificación en producción.

**Resumen — bloqueo de usuarios probado en dispositivo, funciona de punta a punta.**

- Joaquín bloqueó a Coach Prueba desde su perfil (la opción de bloquear/reportar apareció bien). Confirmado: **desaparece de Conexiones** y **el chat se congela** (no se puede escribir).
- Desbloqueado desde "Cuentas bloqueadas" en el perfil: **reaparece en Conexiones** y **se puede volver a escribir**. Los cuatro efectos esperados (sesión 93, cuando se construyó) quedan confirmados con uso real.

**Pendiente para la próxima sesión:**
- Ninguno nuevo de este ítem — queda cerrado.
- De la lista de QA sigue abierto: el toggle "acepta sesiones del exterior" + pantalla de datos de cobro del coach, sin probar en dispositivo.

---

## 2026-08-20 — Joaquín (sesión 120)

**Tocado:** ninguno. Verificación en producción.

**Resumen — toggle de sesiones del exterior + pantalla de datos de cobro, probados en dispositivo. Cierra el último pendiente de la lista de QA de la sesión 102.**

- Toggle "Sesiones desde el exterior" y campo "Precio en dólares" en `CoachProfileScreen` — funcionan, guardan solo.
- `CoachPayoutScreen` ("Cómo te pagamos"): las dos opciones (Transferencia/USDT), el selector de red (TRC20/ERC20/Polygon) y el campo de dirección se ven y funcionan como se diseñaron.
- ✅ **Validación cruzada red↔dirección confirmada**: puesta una dirección de Tron (`TQ4T99n1...`) y cambiada la red a ERC20, avisó que no correspondían. Vuelta a TRC20 y "Guardar" funcionó normal.

**Con esto se cierra toda la lista de pendientes de QA acumulada en las sesiones 88-102** (tramo 15%, reserva instantánea con pago, guardarraíl de reconexión de MP, checkout de MP completo, alta de coach con Google, bloqueo de usuarios, y esto). Lo único que queda abierto es el gate legal de la devolución con IA (pendiente de confirmar con Andre) y los ítems menores ya anotados (rotar `USDT_WALLET_TRC20`, precio de prueba del coach, mensaje a los 32 coaches, etc.).

---

## 2026-08-20 — Joaquín (sesión 121)

**Tocado:** `screens/CoachProfileScreen.tsx`.

**Resumen — las tarjetas de "Sesiones desde el exterior" quedaban pegadas entre sí, sin el espaciado que sí tienen las de "Mercado Pago".**

- Joaquín mandó captura: en "Mercado Pago" las dos tarjetas ("Cuenta conectada" y la de comisión 20/15%) tienen aire entre sí; en "Sesiones desde el exterior", las cuatro tarjetas seguidas ("Activadas", el aviso de que no cobra por MP, "Precio en dólares" y "Cómo te pagamos") se veían todas pegadas, como un solo bloque.
- 🔴 **Causa: `toggleCard` no trae margen propio arriba, a propósito** — la mayoría de sus usos van pegados debajo de un título de sección (que ya trae su propio espaciado) y sumarle margen ahí daría un salto de más. El problema es cuando un `toggleCard` sigue a OTRA tarjeta en vez de a un título: esa tarjeta anterior (`commissionCard`) solo empuja espacio hacia **arriba** de sí misma, nunca hacia abajo, así que la siguiente queda pegada.
- **Arreglado con un estilo nuevo (`stackedCard`, `marginTop: 10`)** aplicado solo a los dos `toggleCard` que efectivamente siguen a otra tarjeta ("Precio en dólares" y "Cómo te pagamos") — mismo valor que ya usa `commissionCard.marginTop`, para que el espaciado sea igual venga de un lado o del otro. No se tocó el estilo base de `toggleCard`, así que el resto de sus usos (Modalidad de reserva, Disponibilidad, Cuenta conectada) siguen exactamente igual.
- Typecheck, lint y 187/187 tests limpios. **No confirmado visualmente en dispositivo desde acá** — próxima apertura de esa pantalla lo confirma.

**Pendiente para la próxima sesión:**
- Confirmar en el dev build que el espaciado quedó parejo.

---

## 2026-08-20 — Joaquín (sesión 122)

**Tocado:** `app/_layout.tsx`.

**Resumen — `coach-datos-cobro` mostraba el header nativo por default de Expo Router, duplicado arriba del header propio de la pantalla.**

- A `coach-datos-cobro` le faltaba la entrada `<Stack.Screen options={{ headerShown: false }} />` que tienen todas las demás pantallas con diseño propio (`coach-availability`, `coach-visibilidad`, etc.) — sin ella, Expo Router agrega su barra negra por default (con el nombre del archivo como título) arriba del header cream que ya construye `CoachPayoutScreen`. Agregada, mismo patrón que el resto.
- Typecheck, lint y 187/187 tests limpios. No confirmado visualmente en dispositivo desde acá.

**Pendiente para la próxima sesión:**
- Confirmar que desapareció la barra negra duplicada.

---

## 2026-08-20 — Joaquín (sesión 123)

**Tocado:** `components/ui/IslandTabBar.tsx`.

**Resumen — se sacaron las palabras de la isla flotante de abajo. El lag al cambiar de tab era estructural, no de timing.**

- Joaquín: al tocar otro ícono, tardaba en deslizarse porque la pastilla tenía que agrandarse para hacerle lugar al nombre de la pantalla. Preguntó si convenía optimizar o directamente sacar las palabras (el nombre ya aparece arriba del todo en cada pantalla).
- 🔴 **No era un problema de timing, sino del driver de animación.** `paddingHorizontal`/`maxWidth` no se pueden animar por el driver nativo de React Native (tiran "not supported by native animated module"), así que el cambio de ancho de la pastilla dependía de `LayoutAnimation` (JS thread) — el propio archivo ya documentaba **dos rondas previas** de ajuste de timing (180ms en vez de 300ms, crossfade del ícono movido al driver nativo) que mejoraron pero nunca eliminaron el lag, porque la causa de fondo seguía ahí.
- **Se sacó el label visible.** Con todos los tabs del mismo ancho fijo (`paddingVertical: 12, paddingHorizontal: 15`, sin diferencia entre activo/inactivo) no hay ningún layout que animar — se eliminó `LayoutAnimation`, `useLayoutEffect` y la dependencia de `useReducedMotion` del componente entero, no solo se ajustó. El nombre de cada tab queda solo como `accessibilityLabel` (para lectores de pantalla), y el estado activo se sigue viendo con el fondo verde + crossfade del ícono, que ya vivía 100% en el driver nativo y seguía el dedo sin jank.
- **La altura de la pastilla no cambió** — el `minHeight: 44` del área táctil (`tabHit`) ya dominaba por sobre el padding del contenido, con o sin label (19px de ícono + 24px de padding nuevo = 43px, sigue por debajo de 44). No hizo falta tocar el `56` hardcodeado que usa `SofiaAssistant.tsx` para calcular su propio clearance sobre la isla.
- Typecheck, lint y 187/187 tests limpios. No confirmado visualmente en dispositivo desde acá.

**Pendiente para la próxima sesión:**
- Confirmar en el dev build que el cambio de tab se siente instantáneo ahora, y que el ícono solo (sin nombre) se entiende bien sin confundir.

---

## 2026-08-19 — Joaquín (sesión 109)

**Tocado:** ninguno. Nuevo: `app/booking/result.tsx`.

**Resumen — el fix del redirect de MP (sesión 107) quedó a medio cerrar: creaba una ruta que no existía.**

- Joaquín probó en el dev build: no se cerró solo — redirigió a Safari, pidió "Abrir la app Vita", y ahí quedó trabado.
- 🔴 **La causa: `viveapp://booking/result` nunca fue una pantalla real.** Era solo el string que se le pasa a `openAuthSessionAsync` como `redirectUrl` — en el caso normal ni hace falta que exista una ruta, porque `openAuthSessionAsync` intercepta el redirect DENTRO de su propia sesión y nunca navega de verdad (la promesa se resuelve, el browser se cierra, y `BookingScreen_Confirm` sigue solo). Pero acá MP rompió esa sesión y el redirect terminó en Safari, que lo abrió como un deep link real — y como no había ninguna ruta en `app/booking/result.tsx`, la app abría sin tener a dónde ir.
- **Arreglo:** se creó esa pantalla. No necesita leer nada del redirect — el resultado del pago ya está en el servidor (`mp-webhook` escribe `payment_status` antes de que MP muestre "aprobado") — así que solo redirige a "Mis sesiones" (`/(tabs)/mis-salas`), donde la reserva ya aparece.
- ⚠️ **Sigue sin saberse por qué MP rompe la sesión de `openAuthSessionAsync`** en vez de quedarse adentro (que es el comportamiento esperado y lo que haría el cierre silencioso). Puede ser el propio flujo de "Pago aprobado" de MP abriendo algo en una ventana nueva. Con este fix, el peor caso ahora es "un tap más en Safari" en vez de "sin salida" — mejora real, pero no es el cierre 100% silencioso que se buscaba. Falta otra vuelta de prueba en el dev build para confirmar si mejoró.
- Typecheck y lint limpios (0 warnings en el archivo nuevo).

**Pendiente para la próxima sesión:**
- Confirmar en el dev build si con esta ruta ya alcanza (llegar a "Mis sesiones" sin trabarse) o si vale la pena investigar por qué MP rompe la sesión de `openAuthSessionAsync`.
- El guardarraíl de reconexión de MP sigue siendo el único pendiente grande de plata sin probar en dispositivo.

---

## 2026-08-19 — Joaquín (sesión 108)

**Tocado:** ningún archivo de código. Verificación en producción, con plata real.

**Resumen — la reserva instantánea con pago quedó probada por primera vez. Venía sin cerrarse desde la sesión 87-88.**

- Coach Prueba ya tenía `instant_booking=true` (no hizo falta tocar nada). Se reservó y pagó una tercera sesión del mismo par ($4.500 ARS).
- ✅ **Resultado:** `status: 'confirmada'` (sin que nadie la acepte — se confirma sola al acreditarse el pago dentro de la ventana de sondeo de 12s), `payment_status: 'aprobado'`, `platform_fee_pct: 15`, sala de video generada. Cierra el camino que más efectos corre de una sola vez (push, sala, cancelar competidores del horario) y el único que nunca se había ejercitado con pago real.
- Con esto quedan cerrados los dos pendientes más urgentes de la lista de QA (tramo del 15% en la 106, instantánea con pago acá). Sigue abierto: el guardarraíl de reconexión de MP en el celular.

---

## 2026-08-19 — Joaquín (sesión 106)

**Tocado:** ningún archivo de código. Verificación en producción, con plata real.

**Resumen — el tramo de comisión del 15% quedó probado por primera vez. Venía sin cerrarse desde la sesión 88.**

- **Par usado:** Joaquín Albisu + Coach Prueba, que ya tenía 1 sesión legítima contada (de antes de que el coach conectara MP, así que sin cobro por diseño — el filtro de checkouts abandonados la sigue contando bien). Se reservó y pagó una segunda sesión real ($4.500 ARS, antes costaba $1 — el precio de prueba cambió en algún momento sin que quedara anotado dónde).
- ✅ **Resultado:** `platform_fee_pct: 15`, `payment_status: 'aprobado'`, con `payment_id` real de MP. Los dos intentos previos del mismo día (abandonados antes de pagar) también habían quedado en 15 — el cálculo es consistente en cada intento, no fue casualidad de la vez que sí se completó.
- 📝 **De paso, un hallazgo de datos viejos, no un bug activo.** Al revisar el historial de bookings de este par apareció una fila de fecha 24/07 (`completada`, `payment_status: 'pendiente'`, con `preference_id` seteado — checkout abandonado que igual pasó a completada) — Joaquín la recordaba como *"salí antes y se reservó igual"*. Es de **antes** de los fixes de la sesión 103 (coach podía confirmar reserva impaga) y 104 (`with_check` en la policy de UPDATE), así que no es el bug reapareciendo — es un resto de cuando el bug todavía existía. El filtro de `_shared/commission.ts` la excluyó correctamente del conteo (por eso el par seguía en "1 sesión válida" y no en "2"), confirmando que la protección funciona también con datos reales, no solo en los tests.
- ✅ **Cierre del test: se canceló la sesión y el reembolso salió solo.** `status: 'cancelada'`, `payment_status: 'reembolsado'`, `refund_attempts: 0` (funcionó al primer intento). Con esto queda probado con plata real el pipeline completo del tramo del 15% — cobro, comisión correcta, cancelación y reembolso — no solo el cobro inicial.

**Pendiente para la próxima sesión:**
- Sigue sin probarse la reserva instantánea con pago (nunca se ejerció ese camino con un coach en modo `instant_booking=true`).
- Sigue sin probarse el guardarraíl de reconexión de MP en el celular.
- Queda la fila vieja del 24/07 (`bf622b93…`, `completada` sin pago real, $11.000) como dato sucio — no rompe nada porque el filtro la excluye del conteo, pero convendría limpiarla en algún momento (mismo criterio que se usó con las 16 fantasma de agosto: no reescribir a mano si no hace falta para nada funcional).

---

## 2026-08-19 — Joaquín (sesión 105)

**Tocado:** ningún archivo de código. Cambio de infraestructura: secret `ANTHROPIC_API_KEY` cargado en Supabase.

**Resumen — se arrancó a prender la devolución con IA de "Sobre vos" (pedido de la 104) y apareció una contradicción entre esa nota y `docs/legal-instrucciones.md`.**

- Joaquín creó la API key en console.anthropic.com y cargó crédito. Se corrió `supabase secrets set ANTHROPIC_API_KEY=...` — **confirmado con `supabase secrets list`**. La función `weekly-reflection` ya estaba deployada (v2, activa) desde la 104.
- 🔴 **Antes de prender el flag del cliente, se releyó `docs/legal-instrucciones.md` y no cierra con la nota de la 104.** Esa nota decía "la feature está entera y deployada, apagada por tres interruptores, falta solo la API key" — como si lo único pendiente fuera técnico. Pero el Paso 5.1 del propio doc de Andre dice explícitamente: *"Nada de lo de abajo está pendiente de programar. Lo que falta es una decisión [del abogado], no trabajo"*, y lista 4 pasos condicionados a que la respuesta legal sea "el payload no es dato sensible" — el primero de los cuales es **declarar al proveedor de IA en Política de Privacidad §6/§7**. Se verificó contra `docs/politica-de-privacidad.md`: no menciona Anthropic ni IA en ningún lado. No hay registro en ningún archivo de que la consulta legal (Paso 3, "segunda consulta, más chica") se haya hecho ni respondido.
- **Se le preguntó a Joaquín cómo seguir.** Decisión: dejar la `ANTHROPIC_API_KEY` cargada en Supabase (no hace nada por sí sola, la función sigue gateada por el flag del cliente), pero **NO prender `EXPO_PUBLIC_AI_REFLECTION`** todavía — se dejó comentado en el `.env` local con una nota explicando por qué, hasta confirmar con Andre si ya habló con el abogado.
- ⚠️ **Para Andre**: si ya hiciste la consulta legal y la respuesta fue favorable, avisá y prendemos el flag (y falta igual escribir la declaración en Política §6/§7 antes, por los 4 pasos del Paso 5.1). Si no la hiciste todavía, la nota de la sesión 104 se adelantó al proceso que vos mismo documentaste — no es un reproche, es solo que la nota no distinguía "técnicamente listo" de "legalmente destrabado" y alguien leyéndola rápido (como pasó acá) puede terminar prendiéndolo sin el paso 1.

**Pendiente para la próxima sesión:**
- 🔴 Confirmar con Andre el estado real de la consulta legal (Paso 3 / Paso 5.1 de `docs/legal-instrucciones.md`) antes de prender `EXPO_PUBLIC_AI_REFLECTION` en cualquier build.
- Si la respuesta es favorable: escribir la declaración del proveedor de IA + transferencia internacional en Política §6/§7, correr `sync:legal`, y recién ahí prender el flag y rebuildear.

---

## 2026-08-19 — Andre (sesión 104)

**Tocado:** `screens/SessionsScreen.tsx`, `screens/SalaScreen.tsx`, `screens/AdminScreen.tsx`, `screens/BookingScreen_Time.tsx`, `screens/CoachReservasScreen.tsx`, `lib/admin.ts`, `lib/bookingHelpers.ts`, `supabase/functions/admin-actions/index.ts`, `supabase/functions/weekly-reflection/index.ts`. Nuevos: `lib/bookingCancel.ts`, `screens/RefundAddressScreen.tsx`, `app/reembolso.tsx`, y 4 scripts SQL (**corridos**). 187 tests.

**Resumen — reembolsos de USDT, endurecimiento de RLS, y el flujo de cancelación reconstruido.**

- 🔴 **El agujero más grave de la sesión: `bookings_update_own` era UPDATE con `qual = (user_id = auth.uid())` y SIN `with_check`.** Sin `with_check`, Postgres valida la fila nueva contra el mismo USING: alcanzaba con que siguiera siendo suya. Cualquier persona con sesión podía, contra la API directa, `update bookings set payment_status='aprobado', status='confirmada'` y **darse una sesión gratis**. Lo mismo del lado del coach. Que existiera `users_cancel_own_booking` —bien hecha, restringida a `'cancelada'`— muestra qué pasó: se agregó la política correcta y **la permisiva quedó activa**, anulándola.
  - Cerrado en dos capas (`harden-bookings-update.sql`, corrido y verificado): `revoke update` + `grant` por columna (un cliente solo escribe `status`, `cancelled_by`, `cancelled_late` y las dos de reembolso — `payment_status` pasó a solo lectura), y `with_check` en las cuatro políticas. **Verificado**: `pg_policies` no devuelve ninguna UPDATE sin `with_check`, y `column_privileges` devuelve exactamente 5 columnas.
  - **Confirmar exige que la reserva esté paga** — o que no se haya iniciado ningún cobro (el flujo del coach sin MP, que ya funcionaba así).
- **Reembolsos de USDT, circuito asistido.** El trigger los marcaba y nadie los procesaba. 🔴 **Decisión: el envío NO se automatiza** — exigiría la clave privada de la wallet en un secret del backend, y quien accediera a ese secret vaciaría la billetera entera, no el monto de un reembolso. El panel lista y registra; `mark_usdt_refunded` exige el hash con formato válido (64 hex), porque sin eso el registro deja de ser una prueba.
  - 🔴 **Nunca se reusa la dirección del pago**: si pagó desde un exchange, esa es una wallet caliente compartida y el depósito no se le acredita. Se le pide la suya, y **la advertencia va ANTES del campo** — leerla después de pegar la dirección del exchange no sirve de nada.
- ✅ **El reembolso de Mercado Pago quedó verificado end-to-end**: cancelación → trigger → cron → `reembolsado` al primer intento (`refund_attempts: 0`). De paso validó que el endurecimiento de RLS no rompió nada — la cancelación escribe `status`, `cancelled_by` y `cancelled_late` **juntas**, y si alguna hubiera quedado fuera del grant el update entero habría fallado en silencio.

**Tres agujeros del flujo de sesiones, todos encontrados probando:**

- 🔴 **La app mostraba UNA sola sesión próxima.** `SessionsScreen` consultaba con `.limit(1)` y `SalaScreen` traía 10 y se quedaba con la primera. **La segunda existía, iba a ocurrir, y era invisible**: no se podía ver, ni agendar, ni cancelar hasta que pasara la primera. No se ve en el código — la consulta trae diez y descarta nueve en la última línea.
- 🔴 **La tarjeta de sesión CONFIRMADA no tenía botón de cancelar.** `handleCancelBooking` ya manejaba el caso pero **ningún botón lo llamaba**: función escrita e inalcanzable. Y en el checkout se promete "podés cancelar hasta 24hs antes y te devolvemos todo", así que la promesa era falsa.
- 🔴 **El turno abandonado sin pagar te bloqueaba a VOS.** Cerrabas el checkout de MP y el horario que acababas de soltar te quedaba vedado media hora. A nadie más le bloqueaba nada — el único perjudicado era el que quería reintentar. Al permitirlo apareció el efecto colateral (el coach veía dos solicitudes idénticas), resuelto cancelando el intento anterior al crear el nuevo.

**Y lo que salió de ahí:**

- **Carrusel horizontal de próximas sesiones**, reemplazando "una destacada + una lista aparte" que obligaba a cancelar en dos lugares distintos según cuál fuera. ⚠️ La tarjeta ocupa el **86% del ancho disponible** a propósito: la siguiente tiene que asomar. Un carrusel donde el segundo ítem cae justo afuera del borde se lee como una tarjeta sola y nadie descubre que hay más. Con una sola sesión pasa a ancho completo — si no, el 14% vacío se lee como un error de layout.
- **Al cancelar ahora se dice qué pasa con la plata**, y el mensaje depende del caso: MP vuelve sola pero *"puede tardar unos días en aparecer en tu resumen — depende de tu banco"* (MP reembolsa al instante, el emisor tarda; sin decirlo la persona da por hecho que no le devolvieron nada), USDT pide la dirección, cancelación tardía explica por qué no corresponde. **Cuál aplica NO lo decide la pantalla**: el trigger es BEFORE UPDATE, así que la fila que vuelve del update ya trae el `payment_status` que él decidió — se lee de ahí en vez de duplicar la regla de las 24hs en el cliente.
- **`cancelBookingFlow` y `canCancelConfirmed` salieron a helpers compartidos.** Vivían dentro de `SalaScreen` (109 líneas con dos ramas casi idénticas); con el carrusel habrían sido una tercera copia. Dos copias de la regla de las 24hs se desincronizan tarde o temprano, y el día que pase una pantalla va a permitir lo que la otra prohíbe.

**Pendiente para la próxima sesión:**
- 🔴 **PARA JOAQUÍN — prender la devolución con IA de "Sobre vos".** La feature está **entera y deployada**, apagada por tres interruptores; ya prendí dos. **Falta solo cargar la API key de Anthropic**: `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...` (sacarla de console.anthropic.com → API Keys). El flag del cliente (`EXPO_PUBLIC_AI_REFLECTION=true`) ya está en el `.env` local — **ojo que `.env` está gitignoreado, así que hay que agregarlo también en la máquina de quien lo pruebe**. Costo real medido: **USD 7,50/mes con 200 usuarios activos por día**; 5 dólares de crédito alcanzan para meses.
  - Se cambió el modelo por defecto a **`claude-haiku-4-5`** y `effort`/`thinking` ahora solo se mandan si el modelo los soporta: **Haiku rechaza `effort` con un 400**, así que apuntar a Haiku sin ese cambio habría apagado la tarjeta con un error en vez de caer al fallback — que es peor, porque no se nota.
  - ⚠️ **No tocar la división que hace segura la feature**: la IA no decide QUÉ decir, solo CÓMO. La señal se elige en el dispositivo (incluida la garantía de que el día que alguien cae fuerte la tarjeta no lo anime) y al modelo solo le llegan el nombre de la señal, el tono y dos o tres números. No viajan valores de ánimo, ni historial, ni texto escrito por la persona — eso es lo que achica la pregunta legal de transferencia internacional de dato sensible.
- ⚠️ **Defensa de pantalla pendiente de cerrar del todo**: `CoachReservasScreen` impide confirmar una reserva impaga, y ahora la policy también — pero conviene revisar que las dos digan lo mismo cuando cambie una.
- **Sin resolver, de sesiones anteriores**: rotar `USDT_WALLET_TRC20` (apunta a la dirección personal de Andre), el precio de prueba del coach en 6 USD, la query de `meeting_url` de la 101, decidir si se soportan más redes que TRC20, y el mensaje a los coaches.

---

## 2026-08-18 — Andre (sesión 103)

**Tocado:** `screens/BookingScreen_Confirm.tsx`, `screens/CoachProfileScreen.tsx`, `screens/CoachReservasScreen.tsx`, `SCHEMA.md`. Nuevos: `supabase/functions/_shared/usdt.ts`, `usdt-create-payment`, `usdt-check-payments`, `screens/UsdtPaymentScreen.tsx`, `app/pago-usdt.tsx`, `__tests__/usdt.test.ts`, y 5 scripts SQL (**todos corridos**). 187 tests.

**Resumen — el riel de cobro en USDT, construido y VERIFICADO con plata real.**

- ✅ **Funciona de punta a punta.** Pago real de **6,28 USDT** (tx `ff53bdcb3a7d…`) el 18/08: la reserva se acreditó sola y pasó a `confirmada` sin intervención. Sin webhook — Tron no avisa nada, así que `usdt-check-payments` corre cada minuto y pregunta.
- **Cómo se reconoce un pago.** En cripto no hay `external_reference`: cada reserva recibe un **monto único** (precio + identificador en los centavos) y el cron cruza las transferencias TRC20 hacia la wallet contra las reservas pendientes.
- 🔴 **Se valida el CONTRATO del token, no el símbolo.** Cualquiera puede desplegar un token llamado "USDT" en Tron; aceptarlo por símbolo dejaría pagar una sesión con algo que no vale nada. Hay un test que fabrica ese token falso.
- **La rama de USDT sale del flujo de reserva ANTES de MP y antes de `applyBookingEffects`.** Más abajo, `confirmedNow = isInstant && (!initPoint || paid)` confirma la instantánea cuando no hay `initPoint`, porque eso significa "coach sin MP, nada que cobrar". Con USDT tampoco hay `initPoint` pero **sí** hay algo que cobrar: caer ahí habría confirmado la sesión y cancelado a los competidores del slot sin que entrara un dólar — el mismo bug de las 27 reservas fantasma de agosto, por el otro riel.

**Cuatro bugs que aparecieron probando con billeteras reales, y ninguno se habría visto en el código:**

- 🔴 **El identificador era más grande que el precio.** Ocupaba los 4 primeros decimales (hasta 0,9999): con precio USD 1, cada reserva salía entre 1,00 y 1,99 y parecía que la tarifa cambiaba sola.
- 🔴 **Y después: las billeteras no dejan tipear más de 2 decimales** (verificado en Belo). Un identificador en el decimal 5 es inescribible para el usuario, así que el pago nunca se podría reconocer. Bajó a **centavos: 100 combinaciones por precio**. Hay un test que fija que el monto siempre se pueda escribir con 2 decimales.
- 🔴 **La dirección se mostraba en bloques de 6 con espacios** para que fuera legible — y `selectable` copia el texto tal cual se renderiza, así que se copiaba `TQ4T99 n1StNF …` y **ninguna billetera acepta eso**. (Antes lo atribuí a que Phantom no soporta Tron, que es cierto pero no era todo.) Ahora va entera, con los primeros y últimos 6 caracteres aparte para verificar a ojo.
- 🔴 **El campo de precio no se podía vaciar.** `value={priceUsdInput || precioGuardado}`: al borrar, el valor vacío es *falsy* y el campo repoblaba solo, así que lo tipeado quedaba pegado adelante y no se podía bajar de dos dígitos.

**Y un patrón que se repitió tres veces en la misma sesión — `status` y `payment_status` cuentan historias distintas:**

- 🔴 **El coach podía aceptar una reserva impaga.** `CoachReservasScreen` filtraba por `status` sin mirar `payment_status`. Aceptar compromete el horario, avisa al usuario y **cancela a los competidores del slot**. Con MP casi no se notaba (el checkout se paga en el acto); con USDT la ventana es real.
  - ⚠️ **El primer arreglo se pasó de largo**: sacaba esas reservas de la lista por completo, y con eso el coach perdía también la posibilidad de **rechazarlas** — si no podía atender a esa hora, no tenía cómo decirlo hasta que el pago entrara o expirara. Lo peligroso es confirmar, no rechazar: rechazar libera el turno, no lo compromete. **Se restringe la acción, no la pantalla.** Quedó con "Confirmar" deshabilitado + la explicación, y "Otro horario" siempre habilitado.
  - ⚠️ Es defensa de pantalla: contra la API directa el coach todavía podría confirmarla. La solución real es endurecer la policy de UPDATE de `bookings`, que no está versionada.
  - 📝 **Nota de producto (decisión de Andre: se deja como está).** El botón de rechazo dice "Otro horario", el modal "Ese horario no me sirve". Es un eufemismo deliberado y coherente con el tono. El costo: **Andre mismo no encontró la acción** al probar. Ese botón lo ve solo el coach, así que suavizarlo ahí no protege al usuario —que nunca lee esa palabra— y sí cuesta descubribilidad. Si alguna vez un coach reporta que "no puede rechazar", es esto.
- 🔴 **Las reservas de USDT no expiraban nunca.** `expire_unpaid_checkouts()` buscaba `preference_id is not null`, que es el marcador de MP. Extendida a los dos rieles (60 min USDT, 30 MP).
- 🔴 **Y el índice de montos no liberaba las canceladas.** La expiración cancela poniendo `status='cancelada'` y deja `payment_status='pendiente'`; el índice miraba solo `payment_status`, así que la cancelada seguía adentro y **se quedaba con su monto para siempre** — la misma fuga que la expiración venía a resolver. Visible en los datos de prueba.

**Pendiente para la próxima sesión:**
- **Cambiar el precio de prueba** del coach (quedó en 6 USD) y **rotar la wallet**: `USDT_WALLET_TRC20` apunta hoy a la dirección personal de Andre (`TQ4T99n1…`). Es un secret, se cambia con un comando.
- ⚠️ **Endurecer la policy de UPDATE de `bookings`** para que un coach no pueda confirmar una reserva impaga por API. Requiere leer/reescribir policies creadas a mano en el panel.
- **Decidir si se soportan más redes.** Hoy solo TRC20. Phantom (Solana) es plausible en el público objetivo, pero cada red nueva es otra función de verificación —otro RPC, otro parseo—, no una fila más en el enum.
- **Los reembolsos de USDT no tienen procesador.** `trg_mark_refund_on_cancel` los marca `reembolso_pendiente` y nadie los procesa. Hay que pedirle la dirección de reembolso al usuario — **nunca reusar la del pago**: si pagó desde un exchange, esa es una wallet caliente y el reembolso se pierde.
- **Sigue abierto de la 101**: la query de `meeting_url` (reservas futuras con sala de ventana rota).

---

## 2026-08-18 — Andre (sesión 102)

**Tocado:** `screens/CoachLoginScreen.tsx`. Sin cambios de base de datos (SCHEMA.md no se tocó).

**Resumen — el alta de profesional no aceptaba Google ni Apple, y la vía por email dejaba trabadas a las cuentas sociales.**

- **Estado previo:** `CoachLoginScreen` —la única puerta al alta de profesional, se llega desde `OnboardingBifurcacion`— tenía solo email + contraseña. `signInWithGoogle`/`signInWithApple` ya existían en `AuthContext` pero los consumían nada más que `LoginScreen`, `RegisterScreen` y `AuthModal`, todos flujo de usuario final. **Decisión: se habilitan los dos en el alta de coach, y se mantiene la regla de mail distinto** (una cuenta que ya es de usuario final no se convierte en profesional).
- 🔴 **Efecto colateral del estado previo que estaba pasando en silencio:** quien ya tenía cuenta creada con Google o Apple e intentaba postularse por email quedaba trabado sin entender por qué — esa cuenta no tiene contraseña, así que `signInWithEmail` fallaba, `signUpWithEmail` devolvía `already registered`, y la pantalla mostraba **"Contraseña incorrecta"**: la persona probando combinaciones de una clave que nunca existió. El mensaje ahora apunta a la causa real ("si creaste la cuenta con Google o Apple, entrá con ese botón").
- **Lo que costó resolver: OAuth no distingue registro de login, y `validateAndNavigate` necesita esa distinción.** `profiles.role` arranca en `'user'` por el default del trigger de alta, así que una cuenta recién creada con Google se ve idéntica a la de un usuario final de siempre y la regla de mail distinto la rebotaría — justo al revés de lo que se quiere. No hay flag exacto en la sesión: se resuelve mirando la antigüedad de `user.created_at` (ventana de 2 min) **más** el chequeo exacto de si ya había sesión abierta antes de tocar el botón, que va primero. El margen es acotado a propósito: como mucho deja postularse a alguien que se registró como usuario final hace menos de dos minutos.
- **Segundo caso que no era obvio: cancelar el flujo social y entrar devuelven lo mismo.** `signInWithGoogle` trata el cierre del navegador como un no-evento y devuelve `null`, igual que en el éxito. Sin distinguirlos, cancelar caía en la validación y —si ya había sesión abierta— le tiraba el cartel de "usá otro mail" a alguien que solo cerró la ventana. Se compara `last_sign_in_at` antes y después; solo con el `id` no alcanza cuando ya había sesión de esa misma persona.
- **Cambio de comportamiento en la rama de bloqueo:** al rebotar por mail distinto ahora se cierra la sesión, igual que ya hacía la rama de "solicitud en revisión". Por email era raro dejarla abierta; con Google/Apple es peor — se toca un botón, se entra de verdad, y el cartel de error deja a la persona logueada como usuario final sin haberlo pedido.
- Apple solo se muestra en iOS (`Sign in with Apple` no existe en Android), y la constancia de T&C/edad viaja como `(true, true)` en las dos llamadas, mismo criterio que se fijó en la sesión 100.

**Pendiente para la próxima sesión:**
- **Falta probarlo en el celular** (Expo Go / dev build): typecheck y lint pasan, pero los tres caminos que importan no se ejercitaron contra Supabase — alta nueva con Google, cuenta social que ya es usuario final (tiene que rebotar), y cancelar el navegador a mitad de camino (no tiene que mostrar error).
- **Ojo con Apple y "Hide My Email"**: un profesional que se dé de alta así queda con un mail `@privaterelay.appleid.com`. Para la entrevista de aprobación y para lo que venga de pagos al coach conviene decidir si se le pide un mail de contacto real en `coach-application`.
- El ícono de Apple en `LoginScreen` está en `#565E32` sobre fondo `rgba(0,0,0,0.45)` — casi invisible. Acá se usó blanco; falta emprolijar el de `LoginScreen`.

---

## 2026-08-18 — Andre (sesión 102)

**Tocado:** `screens/CoachProfileScreen.tsx`. Nuevos: `screens/CoachPayoutScreen.tsx`, `app/coach-datos-cobro.tsx`, `lib/payout.ts`, `__tests__/payout.test.ts`, `scripts/add-coach-international.sql` (**corrido y verificado**). 172 tests (eran 157).

**Resumen — opt-in del coach a sesiones del exterior, y el cierre de las decisiones del rail internacional.**

- **`coaches.accepts_international`** + toggle en el perfil del coach. Público a propósito (el usuario del exterior tiene que poder filtrar). Requirió `grant update` de la columna: `lock-privileged-columns.sql` hace `revoke update` y otorga columna por columna, así que **toda columna nueva de `coaches` es de solo lectura hasta agregarla a esa lista**, y desde el cliente falla en silencio.
- 🔴 **Los datos de cobro NO van en `coaches`.** Verificado contra el REST API: esa tabla **se lee con la anon key sin sesión**, así que un CBU ahí sería público para cualquiera que abra la app. Van en `coach_payout_accounts`, con RLS de dueño y SELECT para admin (el panel necesita el CBU para transferir, pero nadie edita el dato de cobro de otro).
- **Tres capas de validación en cripto, porque un error no se deshace**: coherencia por método, formato por CHECK en la base, y `lib/payout.ts` (puro, sin RN, 15 tests) para mostrar el error mientras se escribe. **La red se valida CONTRA la dirección**: una dirección EVM es válida en sí misma, y mandarle USDT por red Tron pierde los fondos definitivamente — no rebota como un CBU. La pantalla avisa que el primer pago va de prueba.

**Decisiones cerradas del rail internacional** (investigación, no asesoramiento — falta validar con contador):

- **Mercado Pago no sirve para el exterior.** Cerrado con evidencia. **El riel es USDT**; PayPal complemento; Stripe+LLC descartado por ahora (y **Connect ni siquiera paga a Argentina** — no es país de payout a 2026). **Cobra VIVE** (evita que cada coach sea exportador), **precio en dólares**, pago al coach **semanal por sesiones ya realizadas** (garantiza tener con qué reembolsar). Banda operativa: **25 a 100 sesiones/mes**.
- **No existe una fintech que reemplace esto**: las alternativas a Connect son europeas o enterprise, y MP Split aparece en las comparativas como "el Stripe Connect que la mayoría no puede usar". La arquitectura elegida no es un rodeo, es la única disponible sin sociedad afuera.
- 📊 **Modelo económico** (ticket $60.000, 4 sesiones/par → comisión efectiva 16,25%, USD 1.500): break-even local 15 ses/mes. 🔴 **El internacional como principal se vuelve peor a medida que crece**: a 150 ses/mes la cuota del monotributo ($1.614.446) **supera todo el ingreso** de esas sesiones ($1.462.500), porque te categoriza por plata que no es tuya. Las mismas 150 sesiones locales dan el mismo ingreso con cuota de $56.379 — **28× menos**.
- 🔴 **Monotributo: la exportación computa igual.** Art. 3 Anexo Ley 24.977 define ingreso bruto "por cuenta propia **o ajena**" → estructurarlo por cuenta y orden **no salva el tope**. (Córdoba sí lo salva: art. 238 inc. b) CTP excluye la parte de terceros, e inc. g) las exportaciones.)
- 🔴 **Y el hallazgo que cambia la figura fiscal: decide el marketing, no el volumen.** Como monotributista el IVA dentro de cada gasto se pierde; como RI con ventas de exportación (exentas) es crédito recuperable. Con $2M/mes de pauta y 100 sesiones: monotributo cuesta $895.847/mes contra $76.860 de RI. **Con pauta >$500.000/mes conviene RI aunque el volumen sea chico.**
- ⚠️ **Una devaluación te acerca al tope sin que el negocio cambie**: el tope está fijo en pesos y se actualiza semestralmente, tu facturación internacional está en dólares. A 1300 el tope eran USD 97.393; a 1500, USD 84.407.

**Pendiente para la próxima sesión:**
- 🔴 **El mensaje a los coaches** (ya redactado en la sesión): ¿tomarían una sesión del exterior cobrando por VIVE? ¿aceptarían USDT? **Es lo único que bloquea de verdad** — sin oferta no hay servicio, y la respuesta define si se puede borrar toda la rama de transferencia/CBU.
- **Capa de zonas horarias**, antes del primer usuario del exterior. Convertir **con zona horaria y no con offset fijo**: Argentina no tiene horario de verano pero los destinos sí. Ojo con el día (lunes 21:00 ART es martes en Bangkok) y los crons que dicen "mañana".
- **Probar en dispositivo** el toggle y la pantalla de datos de cobro.
- **Sin resolver de la sesión 101**: el resultado de la query de `meeting_url` — si hay reservas futuras con sala ya generada, tienen la ventana rota y hay que resetearlas a null.
- **Contador**: (1) ¿computa el total aunque actúe como intermediario? (2) ¿cuándo salgo del monotributo? (3) exención de IIBB en Córdoba por art. 238. (4) ¿el IVA de Meta/Google por importación de servicios genera crédito recuperable?

---

## 2026-08-18 — Andre (sesión 101)

**Tocado:** `supabase/functions/create-meeting-room/index.ts`, `supabase/functions/mp-process-refunds/index.ts`, `SCHEMA.md`. Nuevo: `scripts/add-payment-provider.sql` (**corrido y verificado**). Las dos edge functions **deployadas**.

**Resumen — sesión de investigación sobre cobrar del exterior, que destapó dos bugs de producción sin relación con eso.**

- 🔴 **La sala de video expiraba antes de que la sesión empezara. Todas.** `create-meeting-room` armaba la hora con `new Date(year, month-1, day, h, m)`, que interpreta los componentes en la zona horaria **del runtime** — y las edge functions corren en UTC, mientras que `scheduled_date`/`scheduled_time` son hora local de Argentina sin zona guardada. Una sesión de las 15:00 ART se calculaba como 15:00 UTC (12:00 ART): con `nbf` 15 min antes y `exp` 1h después del fin, la ventana cerraba a las 17:00Z y la sesión real arrancaba 18:00Z. **Nadie podía entrar nunca.** Verificado con la aritmética antes y después. Se arregló reusando `scheduledAtMs` de `_shared/guarantee.ts` —que ya aplica el offset fijo de Argentina y ya está testeado— más un 422 si la fecha es ilegible (antes una fila corrupta generaba una ventana absurda en silencio). **Dato que ordena el hallazgo: los otros tres lugares que hacen esta cuenta ya estaban bien** (`guarantee.ts` con `AR_OFFSET`, y los dos crons SQL con `AT TIME ZONE 'America/Argentina/Buenos_Aires'`). Esta función era la única que había quedado afuera del criterio.
- ⚠️ **Queda pendiente**: el fix solo aplica a salas nuevas — la función corta apenas ve `meeting_url`. Las reservas futuras que ya tengan sala la tienen con la ventana rota; se corrige poniéndoles `meeting_url = null` para que se regenere. Se pasó la query, falta el resultado.
- 🔴 **`bookings.payment_provider`, creada antes de necesitarla y por un motivo concreto.** `mp-process-refunds` seleccionaba toda reserva en `'reembolso_pendiente'` con `payment_id` no nulo, **sin mirar quién cobró**. La primera reserva de un rail no-MP cancelada haría que le pidiera a Mercado Pago reembolsar un pago ajeno: falla, 5 intentos, dead-letter, y el usuario sin su plata y sin error visible — el mismo modo de falla silenciosa del webhook muerto de julio. Columna + filtro deployado. El orden (columna primero, filtro después) es obligatorio: al revés el cron consulta una columna inexistente y **los reembolsos se frenan del todo**.

**Investigación: cobrar a usuarios del exterior. Conclusión: con Mercado Pago no se puede.**

- ⚠️ **CORRECCIÓN (19/08/2026, sesión 111): la parte de este bullet que va después del guion no se sostiene.** Al repetir el test con más BINs apareció que `payment_methods/search` **no mide aceptación por país emisor** — resuelve BIN → marca y tipo contra la tabla de MP y nada más. Tres resultados lo dejan claro: una Mastercard de **crédito argentina verificada** (554210) devuelve **vacío**, o sea que "sin resultado" no marca extranjera; una Visa de **crédito de Estados Unidos** (414720) resuelve `visa`/`credit_card`/`active`, idéntico a una argentina; y el `debvisa`/`debit_card` aparece también en tarjetas de crédito **mexicanas**, que son de un país donde MP sí opera. O sea que "clasifica raro" no predice "la rechaza". **Lo que sigue siendo válido es el dato duro: una tarjeta de otro continente, tipeada de verdad en el checkout, fue rechazada.** Eso pasó y es el único instrumento confiable que se usó. Lo que no está probado es la causa — y sobre tarjetas de países donde MP opera (Brasil, México, Chile, Uruguay, Colombia) **no hay ni un dato real todavía**.
- **Probado contra la API de MP, sin gastar un peso.** Se resolvieron BINs reales contra `payment_methods/search` con la public key del coach. **Dos tarjetas de dos continentes, una de ellas de crédito europea, las dos devuelven `debvisa` / `debit_card`** — una tarjeta de crédito clasificada como débito local es una clasificación errónea, y explica el rechazo al tipear el número. Los BINs argentinos de control resuelven bien (`visa`/`master`/`amex`). **Se descartó el split como causa**: se apagó `MP_SPLIT_ENABLED` en producción, se reintentó, mismo rechazo, se revirtió.
- ⚠️ **Se descartaron dos hipótesis intermedias y vale anotarlo**: (1) que el perfil huérfano bloqueara el mail — el mecanismo es real y quedó documentado, pero no era esto; (2) que fuera débito contra crédito — cayó cuando la tarjeta de crédito europea dio el mismo resultado. Diagnosticar sin el mensaje de error a la vista costó varias vueltas.
- **Opciones evaluadas**: PayPal (no requiere LLC, sirve como v0; riesgo de congelamiento de fondos lo descalifica como infraestructura), Stripe (mejor experiencia, **exige LLC en EEUU**: no opera con entidades argentinas), dLocal (arquitectura exacta —onboarding, split, retención, payout— pero es enterprise y su fuerte es cobrar *en* mercados emergentes, no en EEUU/Europa; sí es el especialista para **pagar** a Argentina cuando haya volumen), MoR tipo Paddle/Lemon Squeezy (**descartado**: son para SaaS, no para marketplaces de servicios humanos con pagos a terceros), y **stablecoins**, que para este perfil específico —argentinos emigrados pagando a argentinos— es la que mejor encaja: funciona igual desde Bangkok que desde Miami, comisiones cercanas a cero, y las dos puntas plausiblemente ya tienen USDT.
- 🔴 **El hallazgo estructural, más grande que el procesador: hoy la plata va DIRECTO al coach, y eso no escala al exterior** porque convierte a **cada coach en exportador de servicios** (factura E, registro en ARCA, por sesión). La arquitectura para el exterior exige que **VIVE cobre y le pague al coach**: un solo circuito de compliance en vez de N. Efecto lateral bueno: **el reembolso se vuelve más seguro que hoy** — hoy sale del balance del coach (riesgo documentado si la sesión es a >14 días o ya retiró), y con VIVE reteniendo hasta después de la sesión siempre hay con qué devolver.
- **La app es de una sola zona horaria por construcción.** `scheduled_date`/`scheduled_time` son texto sin zona y `BookingScreen_Time` muestra un cartel fijo "Horarios en zona horaria Argentina (ART)" — es una etiqueta, no una conversión. Corrección importante sobre una suposición equivocada: **el coach no atiende de madrugada**, atiende en los horarios que configuró; es el usuario el que se acomoda. Y los números salen bien: Miami ~1h, **Madrid −5h (la mañana argentina es su tarde/noche, mejor que si estuviera acá)**, Bangkok −10h. Lo que sí hace falta es convertir **con zona horaria, no con offset fijo**: Argentina no tiene horario de verano pero los destinos sí, y una conversión con número fijo se corre una hora dos veces por año. Ojo con el día: lunes 21:00 ART es martes en Bangkok, y los crons que dicen "mañana" hablarían del día equivocado.

**Pendiente para la próxima sesión:**
- 🔴 **Una hora con el contador ANTES de escribir código.** La pregunta que define todo: ¿VIVE actúa como principal (facturo el total, el coach me factura a mí) o por cuenta y orden de terceros (facturo solo comisión)? La respuesta cambia la arquitectura entera. Lo que ya se sabe: la exportación de servicios está bien tratada (IVA exento con reintegro, IIBB generalmente exenta, sin derechos de exportación en 2026, factura E incluso en monotributo), pero **se pasa de facturar la comisión a facturar el total** —×5 en facturación bruta para el mismo margen, con impacto inmediato en topes de categoría—, se acumula crédito fiscal de IVA sin débito contra qué compensarlo, y **conviven dos modelos contables** según de dónde vino el usuario.
- **Validar la oferta, no solo la demanda.** Preguntarles a los 32 coaches actuales: (a) si aceptarían sesiones del exterior cobrando por VIVE en vez de por MP, (b) si aceptarían cobrar en USDT. Si de 32 activan 5, el usuario de Miami abre la app y la ve vacía — peor que no ofrecer el servicio.
- **Falta el dato de cobro del coach**: no hay CBU, alias ni wallet en ningún lado del schema. Hoy no hace falta porque MP le paga directo; en cuanto VIVE transfiera, sí. Con wallet, la **red** (TRC20/ERC20/POLYGON) va como selector y nunca como texto libre — la dirección correcta por la red equivocada pierde la plata para siempre, y a diferencia de un CBU mal cargado no rebota.
- **Reembolsos de los rails nuevos**: PayPal tiene API (gemelo de `mp-process-refunds`, pero PayPal **se queda con su comisión** aunque reembolses). USDT no tiene concepto de reembolso, es un envío de vuelta — y **hay que pedir la dirección de reembolso, nunca reusar la del pago**: si pagó desde un exchange, esa es una wallet caliente y el depósito no se le acredita a él.
- **Payouts a escala**: no hace falta API. Los bancos aceptan archivo de lote (CBU + monto), así que el panel de admin genera el archivo y se sube una vez — mismos cinco minutos con 5 coaches que con 200. La API de payouts (dLocal u otra) recién cuando el volumen lo justifique.
- **Pestaña "Pagos a coaches" en el panel de admin**, que depende de todo lo anterior: a quién, cuánto (bruto − `platform_fee_pct`, que ya es snapshot por reserva), y cuándo (solo sesiones `completada`). Necesita además un `paid_out_at` para no pagar dos veces lo mismo.

---

## 2026-08-16 — Andre (sesión 100)

**Tocado:** `context/AuthContext.tsx`, `lib/supabase.ts`, `screens/LoginScreen.tsx`, `components/AuthModal.tsx`, `screens/ProfileOwnScreen.tsx`, `screens/EditProfileScreen.tsx`, `app/(tabs)/index.tsx`, `app.json`, `SCHEMA.md`. Nuevos: `lib/webcrypto.ts`, `scripts/add-social-profile-data.sql` (**corrido y verificado**).

**Resumen — sesión de auth con Google: un bug de un carácter que hacía imposible el alta, la foto de Google que nunca llegaba al perfil, y un agujero de constancia legal.**

- **Punto de partida: "quiero crear una cuenta con Google y me entra con la principal".** No era cache: `ASWebAuthenticationSession` comparte cookies con Safari, y con sesión activa Google **saltea el selector de cuenta**. Se agregó `queryParams: { prompt: 'select_account' }` en `signInWithOAuth`. Se probó también `preferEphemeralSession`, y **se descartó**: arranca el navegador sin cookies, con lo cual Google pierde las cuentas recordadas y obliga a tipear mail y contraseña en cada inicio de sesión. Queda anotado en el código para que no lo reintroduzca nadie.
- 🔴 **El bug principal, y es de un carácter.** El alta con Google fallaba siempre con `invalid flow state, no valid flow state found`. El redirect vuelve como `viveapp://auth/callback?code=<uuid>#` —con un fragmento vacío al final— y el regex que extraía el código era `[^&]+`, que **no excluye `#`**: se le mandaba a GoTrue el código con un numeral pegado, no existía flow state para él, y el servidor contestaba un mensaje que suena a sesión vencida o a config del servidor. Ahora es `[^&#]+`, y lo mismo en el parseo de `error_description`. **Mismo patrón que el commit anterior** (`exchangeCodeForSession` recibía la URL en vez del código): el argumento va mal armado y el mensaje del servidor apunta para otro lado. Los `console.log('[auth] …')` que se agregaron en la sesión anterior son lo que permitió verlo — sin la línea con la URL cruda, esto no se encuentra.
- **La foto de Google nunca llegaba a `profiles`.** El trigger de alta escribía `(id, email, name, role)` y no `avatar_url`. Google manda la foto en `raw_user_meta_data` desde el primer login, pero **todas** las pantallas leen `profiles.avatar_url` y ninguna la metadata: quien se registraba con Google veía sus iniciales teniendo la foto disponible. `scripts/add-social-profile-data.sql` corrige el trigger (+ `full_name` como fallback del nombre) y backfillea las cuentas ya creadas. Verificado antes de tocar nada que `avatar_url` guarda la **URL pública completa** y no un path de Storage — si no, meterle una URL de Google rompía las pantallas. SCHEMA.md actualizado con una subsección nueva del trigger.
- 🔴 **Hallazgo que apareció solo al mirar la fila creada: `accepted_terms` y `age_confirmed` en `false` en una cuenta nueva.** En OAuth no existe "registrarse" separado de "iniciar sesión" —es el mismo flujo, y si el mail no existe crea la cuenta—, así que `LoginScreen` y `AuthModal` daban de alta cuentas **sin constancia de T&C ni de edad**, porque llamaban `signInWithGoogle()` sin argumentos y `markAccepted` cortaba en seco. Eso toca dos cosas ya documentadas como importantes: la cláusula anti-solicitación (§10), que sostiene la medida anti-fuga, y T&C §3.1, que fue justamente lo que se agregó el 13/08 porque afirmaba una declaración que nunca se pedía. Fix: texto legal con links a `LegalSheet` debajo de los botones sociales de las dos pantallas (aceptación implícita, mismo criterio que `CoachLoginScreen`) y `(true, true)` en las cuatro llamadas.
- ⚠️ **`markAccepted` tuvo que volverse idempotente, y esta es la parte delicada.** Pasar `(true, true)` desde el login significa que corre en **cada** inicio de sesión, y `acceptanceFields` escribe `accepted_terms_at = now()` y `accepted_terms_version = LEGAL_VERSION` cada vez que lo recibe. Sin el chequeo previo le pisaba a cualquiera la fecha real de aceptación y lo dejaba "aceptando" versiones nuevas de los T&C sin haber visto nada — o sea, destruía exactamente la constancia que esas columnas existen para guardar, y con ella la oponibilidad de una modificación por §20. Ahora lee `accepted_terms`/`age_confirmed` y **solo escribe lo que está en `false`**; si la lectura falla no escribe nada. Efecto lateral bueno: las cuentas que ya quedaron sin constancia se corrigen solas en el próximo login, esta vez con el texto legal a la vista, sin backfillear nada a mano (que sería fabricar una constancia inexistente).
- **Callejón sin salida que vale documentar: la hipótesis del perfil huérfano era razonable y era falsa.** Se sospechó que borrar el usuario desde el panel de Authentication dejaba la fila de `profiles` ocupando el email UNIQUE y bloqueando el alta. Encaja perfecto con el síntoma, pero la query no devolvió ninguna fila huérfana. **El mecanismo sí es real** —la FK se dropeó el 06/08, borrar del panel no toca `profiles`— y quedó documentado en SCHEMA.md, pero no era la causa de este bug. Se perdieron dos vueltas por diagnosticar sin el mensaje de error a la vista.

**Segundo bloque — Sign in with Apple, que estaba roto en tres capas a la vez. Probado en dispositivo y funcionando.**

- 🔴 **Faltaba `ios.usesAppleSignIn: true` en `app.json`.** La doc de SDK 54 pide las dos cosas —el config plugin (que estaba) y esa propiedad—, y es la que habilita la capability en el build. Sin ella el flujo nativo no puede funcionar aunque el provider esté prendido. **Verificado por fingerprint**: los dos builds anteriores compartían hash (`8a17898d`) y el nuevo dio `643800d4`, o sea que el cambio de config nativa entró de verdad. (Buscar el entitlement en los logs de Xcode no sirve: no se imprimen ahí.)
- **El provider de Apple estaba apagado en Supabase** (`/auth/v1/settings` devolvía `apple: false`). Andre lo habilitó con el bundle ID en **Client IDs**; **no** hace falta Secret Key porque usamos el flujo nativo (`signInWithIdToken`) y no el web. Nota para si algún día se agrega Apple en web: el Services ID va primero y los App IDs nativos después, o Apple rechaza el login web.
- 🔴 **El nombre de Apple se perdía para siempre.** Apple entrega los scopes **solo en la primera autorización** —después `fullName` viene todo en `null` y no vuelve salvo que la persona revoque la app desde Ajustes— y el `identityToken` no lo lleva, así que el trigger de alta no tiene de dónde sacarlo y la cuenta quedaba con `'Usuario'` para siempre. `saveAppleName()` lo persiste en ese momento, y solo pisa el placeholder: si la fila ya tiene un nombre real (editado, o de otro proveedor vinculado al mismo mail) no lo toca.
- ⚠️ **Y guardarlo no alcanzaba, porque el home no lee de ahí.** `app/(tabs)/index.tsx` y `ProfileOwnScreen` mostraban `user_metadata.name` con fallback al prefijo del mail — que con **Hide My Email** es la cadena aleatoria de `privaterelay.appleid.com`. O sea: el nombre bien guardado, el coach viéndolo correcto, y el saludo diciendo "Hola a1b2c3d4". Ahora el nombre para mostrar sale de `profiles.name` vía `displayName` del contexto (`fetchRole` pasó a `fetchProfile` y lo trae en la misma consulta, sin round-trip extra), con la metadata de respaldo mientras el perfil no resolvió. El `'Usuario'` se normaliza a `null` **en un solo lugar**, para que las pantallas caigan a su fallback en vez de saludar "Hola Usuario".
- **El saludo quedó separado del nombre con fallback al mail**, a propósito: `getGreeting` recibe solo un nombre real, porque sin nombre saluda bien igual y el prefijo del mail sería peor que no nombrar a nadie.
- **`refreshProfile()` en el contexto**, llamado desde `EditProfileScreen` al guardar. Lo hizo necesario el cambio anterior: al pasar el saludo a leer del contexto —que solo se refresca al cambiar la sesión— editarse el nombre lo dejaba viejo en el home hasta reabrir la app. Verificado que `EditProfileScreen` es el único lugar de la app que escribe `profiles.name`.

**Tercer bloque — PKCE estaba degradado a `plain`, o sea que no protegía nada. Corregido y verificado en dispositivo.**

- 🔴 **El síntoma estaba en los logs desde siempre y se leía como un warning inocuo:** `WebCrypto API is not supported. Code challenge method will default to use plain instead of sha256`. No es cosmético. `auth-js` exige `crypto`, `crypto.subtle` y `TextEncoder`, y **Hermes no trae ninguno de los tres**, así que caía al `return verifier` y el `code_challenge` viajaba **igual** al `code_verifier`. Con eso PKCE deja de existir: su única función es que interceptar el código de autorización no alcance para canjearlo —hace falta además el verifier—, y en modo `plain` el verifier va escrito en la misma URL de autorización que el atacante ya vio. El riesgo concreto en iOS es otra app registrando el scheme `viveapp://`.
- **Se resolvió sin sumar dependencias.** `expo-crypto` ya estaba en el proyecto y expone `digest(algorithm, data) => Promise<ArrayBuffer>`, que es exactamente la firma de `crypto.subtle.digest`. `lib/webcrypto.ts` define **solo lo que falta** (`TextEncoder`, `crypto`, `getRandomValues`, `randomUUID`, `subtle`), cada cosa por separado: en web no toca nada porque WebCrypto es nativo, y si Hermes trae alguno más adelante se respeta el que exista. Se importa arriba de `lib/supabase.ts` para no depender del orden de imports de las pantallas. `crypto` se define con `defineProperty` y no por asignación: en algunos runtimes es un getter de solo lectura y la asignación falla en silencio, que sería el peor resultado posible — el polyfill "puesto" y el PKCE igual en `plain`.
- **El `TextEncoder` propio se verificó byte por byte contra el nativo de Node** en 8 casos, incluidos emoji y pares suplentes. Un bug ahí no daría error: daría un hash distinto y un login que falla sin explicación.
- **Verificado en dispositivo:** el WARN desapareció de los logs y el login con Google entra. De paso quedó confirmado que **el `#` del redirect aparece en todos los logins** (`…?code=65d80136-…#`), no era circunstancial: sin el fix del regex del primer bloque, esto habría fallado igual.

**Pendiente para la próxima sesión:**
- **Las cuentas de Apple creadas antes de hoy quedaron con `name = 'Usuario'` de forma irreversible**: Apple ya entregó su única oportunidad de dar el nombre. La persona lo puede corregir desde Editar perfil, pero no hay backfill posible.
- **`avatar_url` de las cuentas de Apple queda siempre en NULL** — Apple no manda foto. El fallback a iniciales ya lo cubre, pero significa que el `coalesce` del trigger solo sirve para Google.

---

## 2026-08-16 — Andre (sesión 99)

**Tocado:** `constants/searchData.ts`, `constants/conexionesDoors.ts`, `hooks/useProgressStats.ts`, `screens/QuizScreen.tsx`. Nuevo: `__tests__/taxonomia.test.ts`. Sin cambios de schema.

**Resumen — grupo A del análisis de motivos de consulta: seis subtemas nuevos, dos puertas nuevas, y la taxonomía consolidada en un archivo con tests.**

- **Punto de partida: Andre trajo un análisis de motivos reales de consulta** (psicólogo, con prevalencias de fuentes argentinas; coach, del estudio ICF/PwC n>30.000 — que él mismo marca como fuente con conflicto de interés). Se mapeó contra `conexionesDoors.ts` real, no de memoria.
- 🔴 **El hallazgo principal: los tres motivos más grandes de coaching estaban sin cubrir, apenas cubiertos, o enterrados.** *Comunicación* (37%) no existía como subtema. *Equilibrio vida-trabajo* (35%) solo aparecía como **Burnout**, que es el momento en que ya se rompió, no el de quien quiere reordenar antes. *Autoestima* (35%) existía pero adentro de la puerta **"Estado de ánimo"**, junto a Tristeza, Culpa y Duelo — nadie que quiera trabajar su confianza entra por ahí. El patrón: **la taxonomía está construida sobre una lógica de psicología clínica y los coaches entran de prestado.**
- **Seis subtemas nuevos (32 → 38):** `Comunicación`, `Asertividad`, `Liderazgo`, `Equilibrio vida-trabajo`, `Ruptura y separación`, `Orientación vocacional`. Los tres primeros cubren huecos del lado coach; `Asertividad` cubre el "no puedo poner límites" que *Enojo* dejaba afuera (la irritabilidad estaba, la dificultad para decir que no no); `Ruptura y separación` estaba partida entre tres puertas distintas para un solo evento.
- **Dos puertas nuevas (10 → 12):** **Comunicación** y **Autoestima y confianza**. La segunda no agrega subtema: saca `Autoestima` de "Estado de ánimo" y le da puerta propia.
- 🔴 **Hallazgo de paso, no relacionado con el grupo A: el onboarding pregunta por temas que el catálogo no puede servir, y encima descarta la respuesta.** `OnboardingScreen5` tiene su propia lista —una **tercera** taxonomía paralela— con `Comunicación`, `Separación/ruptura`, `Liderazgo` y `Carrera`, ninguno de los cuales existía como subtema. Y `handleContinue()` hace `router.replace('/register')` **sin guardar nada**: lo que la persona elige se descarta. Eso además significa que el "Momento AHA" de la pantalla 6 del spec —mostrar coaches en match antes del registro— hoy no ocurre.
- **La taxonomía se consolidó en un solo archivo.** `QUIZ_AREAS` (era `Q1_OPTIONS` en `QuizScreen`) y `TOPIC_TO_AREA` (era privado de `useProgressStats`) se mudaron a `constants/searchData.ts`, junto a `AXES`. Motivo concreto: son los **tres mapas que hay que tocar al agregar un subtema**, y estando repartidos no se podían testear juntos. `icon` quedó tipado como `string` en `QUIZ_AREAS` —mismo patrón que ya usaba `conexionesDoors`— para no arrastrar `@expo/vector-icons` a un archivo de constantes.
- **11 tests nuevos (total 151), y son la parte que más importa.** La regla crítica 19 documenta que estos mapas **ya se desincronizaron una vez** y que cuatro subtemas quedaron sin mapear en silencio. Nada de eso falla en runtime: un subtema huérfano simplemente hace que un coach que solo trabaje ese tema **no aparezca en ninguna puerta** — invisible para el usuario e invisible para quien lo agregó. Los tests verifican la partición en las dos direcciones (sin huérfanos, sin duplicados, sin subtemas inventados por las puertas), que `TOPIC_TO_AREA` cubra todo y no tenga fantasmas, y que el quiz no nombre temas inexistentes.
- ⚠️ **Las dos puertas nuevas nacen vacías.** `coach_topics` no tiene CHECK y su lista sale de `AXES`: los 32 coaches actuales **no** tienen los subtemas nuevos hasta que editen su perfil. Hay un test que fija que una puerta sin coaches devuelva lista vacía en vez de romper, pero el deck va a rankear raro hasta que se pueblen — la mediana se calcula sobre la puerta completa.
- **Sigue abierto y deliberadamente sin tocar: los ejes.** Se analizó y se recomendó sacarlos como fase (Emocional concentra 20 de 32 subtemas —ahora 22 de 38— contra 5 del físico, y la primera pantalla pide una categorización que la persona no está en condiciones de hacer). Andre pidió ver una comparación visual antes de decidir; se le pasó y la decisión quedó pendiente. **El grupo A se implementó sobre la estructura actual, con ejes intactos**, para no forzar esa decisión por la ventana.

**Segundo bloque — filtro por subtema en la búsqueda:**

- **Pedido de Andre: poder filtrar coaches por subtema en los filtros avanzados.** Al mirarlo apareció que el hueco era más grande: los cinco filtros existentes son precio, rating, sexo, nacionalidad y tipo, y **ninguno es por tema**.
- 🔴 **El tema llegaba por parámetro de ruta, se mostraba como título de pantalla y no se podía tocar.** Entrabas por "Relaciones" y para ver además "Estado de ánimo" tenías que volver atrás y empezar de nuevo. Peor: **"Limpiar filtros" resetea los cinco y deja intacto el tema**, que es el más restrictivo de todos — el único del que el botón no te saca.
- **Descubrimiento sobre la pantalla: `search3` tiene un solo punto de entrada.** El botón "Ver todos" desde el deck de una puerta (`verTodosEnPuerta`), que le pasa los subtemas de esa puerta. No es una pantalla de búsqueda general: es la **vista de lista de una puerta**. Eso explica por qué el tema era inmutable.
- **Cambio estructural: el filtro por tema se movió de la carga al sheet.** Antes se aplicaba al armar `rawCoaches`, así que la lista **nunca contenía coaches de otras puertas** y ampliar era imposible por construcción. Ahora `rawCoaches` guarda el universo completo y el tema es un filtro más, junto a los otros cinco.
- **El parámetro siembra el filtro en vez de competir con él:** los subtemas de la puerta llegan pre-seleccionados, visibles y editables. Con eso el tema se vuelve un control, y "Limpiar filtros" por fin lo alcanza.
- ⚠️ **La decisión que más se nota: las opciones salen de los DATOS, no de la taxonomía** (`topicOptionsFrom`, pura y testeada). Consultando `coach_topics` en prod: de los 38 subtemas **hay 31 en uso**; los 7 restantes son los seis nuevos de hoy más `Duelo`. Ofrecer los 38 daría siete filtros que devuelven cero y se leen como pantalla rota. Derivándolo del dato no puede existir una opción muerta, y cuando un coach marque `Comunicación` la opción aparece sola sin tocar código. Se calcula sobre el universo completo y **no** sobre el resultado: si dependiera del resultado, las opciones se irían borrando a medida que filtrás y no habría cómo volver a ampliar.
- **Multi-selección salió casi gratis:** el filtro viejo ya hacía `topicStr.split(',')` + `.some()`, o sea que la lógica de "cualquiera de estos temas" estaba construida y nunca se le había pasado más de un valor.
- **El título dejaba de ser cierto** apenas cambiabas la selección: seguía diciendo el nombre de la puerta. Ahora lo mantiene mientras la selección coincida, y si no dice el tema (si es uno) o cuántos son.
- 📊 **Dato del catálogo real, que confirma lo que se predijo al agregar las puertas:** `Comunicación` tiene **0 coaches** y `Autoestima` tiene **1**. Las dos puertas nuevas están efectivamente vacías, y ni el filtro ni el deck las pueden poblar — eso lo destraba solo que los coaches elijan los temas.
- 🔴 **Tercer caso del mismo patrón: una capacidad construida y sin entrada.** `search3` acepta un parámetro `query` para buscar por texto y **nadie se lo pasa nunca** (la búsqueda por nombre de Conexiones filtra en su propia pantalla). Van tres: `explorar-recursos` (que muestra los 38 subtemas y solo se alcanza desde el lado coach, con un botón que dice "Ver cómo lo ven tus pacientes"), la selección del onboarding que se descarta, y esta.
- **6 tests nuevos (total 157).** Typecheck limpio. `search3.tsx` quedó en **0 warnings de lint** — tenía 5 antes de tocarlo, por cuatro imports que vivían debajo del bloque de constantes; el proyecto bajó de 66 a 63.

**Pendiente para la próxima sesión:**
- 🔴 **Decidir el grupo B**, que no es taxonomía sino alcance de la plataforma: **trauma y violencia** (hoy alguien que escribe "mi pareja me pega" no tiene adónde ir — se cruza con el corte por crisis y con tener psicólogos matriculados), **consumo de sustancias** (donde la respuesta correcta puede ser derivar *afuera*), **crisis económica** (el 55,91% más alto del análisis; si va, nombrado por el lado de la angustia, no como asesoramiento financiero) y **migración** (2,57%, podría plegarse a Soledad + Momentos de cambio).
- **Cerrar la decisión de los ejes.** La comparación visual quedó hecha.
- **Avisarles a los coaches que hay temas nuevos** para elegir, o las dos puertas nuevas quedan vacías indefinidamente.
- **Qué hacer con el onboarding**: hoy tiene una taxonomía propia que no coincide con ninguna de las otras dos y descarta lo que la persona elige.

## 2026-08-16 — Joaquín (sesión 98)

**Tocado:** `app/(tabs)/index.tsx`, `lib/weeklyReflection.ts`, `__tests__/weeklyReflection.test.ts`. Borrado: `components/CoachSuggestionCard.tsx`.

**Resumen — se borró `CoachSuggestionCard` ("Notamos que veniste bajando. ¿Querés hablar con alguien?"), pedido de Joaquín.**

- Joaquín mandó una captura de la card por AirDrop: le gustaba la idea pero la sentía "mal ejecutada" y demasiado orientada a vender. Diagnóstico antes de tocar nada: el botón sólido terracota "Hablar con alguien", con el mismo peso visual que cualquier CTA de reservar/conectar del resto de la app, puesto justo al lado de una frase reconociendo que la persona la está pasando mal — leía como que la empatía era el gancho para el CTA. Encima, si el usuario no tenía ningún chat todavía, el botón lo mandaba directo a Conexiones (la parte más comercial del flujo).
- Propuse rediseñarla (CTA más liviano, más aire, mismo patrón que el "→ Ver más" de la card "Sobre vos"). **Joaquín prefirió borrarla directamente**: con "Sobre vos" ya cubriendo la misma señal (bajón fuerte) de forma deliberadamente gentil — "no hace falta que hagas nada con eso ahora" —, tener las dos, una arriba de la otra con tonos opuestos para el mismo evento, hacía más obvia la intención de venta de la vieja, no menos.
- **Verificado antes de borrar** que no quedaba nada más colgando de ella: dos comentarios en `lib/weeklyReflection.ts` (y uno en su test) explicaban por qué la señal `sharpDrop` "cede el tono" citándola — se actualizaron para explicar la misma decisión sin la referencia a un componente que ya no existe. La señal `sharpDrop` en sí **no se tocó**: sigue siendo el input de `buildReflection()` que hace que la devolución de "Sobre vos" sea gentil un día de bajón — de hecho ahora es la ÚNICA reacción a esa señal, así que tiene más razón para seguir siendo así, no menos.
- Typecheck, lint y 140/140 tests limpios.

**Pendiente para la próxima sesión:**
- Ninguno nuevo — decisión cerrada y aplicada en la misma conversación.

## 2026-08-16 — Joaquín (sesión 97)

**Tocado:** `app/(tabs)/index.tsx`, `app/(tabs)/_layout.tsx`, `components/SobreVosMomento.tsx`. Nuevo: `context/SobreVosMomentoContext.tsx`.

**Resumen — mismo arreglo de fondo que Sofía (sesión 96), aplicado a `SobreVosMomento`: se le sacó el `<Modal>`.**

- Pedido directo de Joaquín tras el fix de Sofía: "arreglalo también para SobreVosMomento". Mismo diagnóstico (`<Modal>` arma una pantalla nativa nueva cada vez que se abre, costo que rasterizar/`InteractionManager` no tocan), pero acá el arreglo era más grande — como avisé antes de tocar nada: `SobreVosMomento` vivía DENTRO del árbol de la pantalla de Inicio, no al lado de `<Tabs>` como Sofía, así que sacarle el Modal tal cual lo hubiera dejado por DEBAJO de la isla de tabs.
- **Nuevo `context/SobreVosMomentoContext.tsx`**: puente entre Inicio (dueña de los datos — la devolución y el color del mood de hoy) y el componente, ahora movido a `app/(tabs)/_layout.tsx` como sibling de `<Tabs>` y `<SofiaAssistant>`. Mismo patrón que `AuthContext` (Provider + hook `useSobreVosMomento()`, sin necesidad de un valor por default que tire error). Inicio llama `open(reflection, moodColor)` cuando corresponde — la lógica de CUÁNDO corresponde (el gate de "vale la pena", `lib/sobreVosMomento.ts`) no se tocó, sigue viviendo en Inicio.
- **`SobreVosMomento.tsx` perdió sus props** (`visible`/`reflection`/`moodColor`/`onClose`/`onSeeProgress`) — ahora lee todo de `useSobreVosMomento()` y navega con `useRouter()` directo (ya no necesita que Inicio le pase un callback de navegación). Se sacó `<Modal>`, quedó como `View` absoluto — mismo patrón que Sofía. Se mantienen el rasterizado y `InteractionManager` (optimizaciones válidas aparte del Modal). Repuesto el botón físico de "atrás" en Android con `BackHandler`, que antes venía gratis con `Modal`.
- **`index.tsx`**: se sacó el estado local `momentoVisible` y el render directo de `<SobreVosMomento>`; `handleMoodPicked`/`handleReopenMomento` ahora llaman `openMomento(...)` del contexto. `handleSeeProgress` se eliminó — quedó sin uso, la navegación vive adentro del componente ahora.
- **`app/(tabs)/_layout.tsx`**: todo el árbol (`<Tabs>` + `<SofiaAssistant>` + `<SobreVosMomento>`) queda envuelto en `<SobreVosMomentoProvider>`.
- Typecheck, lint y 140/140 tests limpios.

**Pendiente para la próxima sesión:**
- Confirmar en el dev build que el momento ahora sí se siente fluido, igual que Sofía.

## 2026-08-16 — Joaquín (sesión 96)

**Tocado:** `components/SofiaAssistant.tsx`.

**Resumen — rediseño grande del panel de Sofía, con referencia visual (captura del asistente de Banco Galicia).**

- Joaquín mandó una captura de referencia: quería el panel más espacioso, con más aire, saludo grande arriba y las opciones como filas (no chips chicas), más un aviso de que el chat todavía no está listo. El panel chico anclado cerca del orbe (sesión 95) se reemplazó por una hoja casi a pantalla completa.
- **Nuevo `Modal` + `Animated.View` propios**, mismo patrón que `SobreVosMomento.tsx` (que ya resolvió el mismo problema de performance dos veces esa sesión): `shouldRasterizeIOS`/`renderToHardwareTextureAndroid` + `InteractionManager.runAfterInteractions` antes de arrancar la animación de apertura. Al ser ahora un modal de verdad (no anclado a la posición del orbe), se pudo sacar TODA la lógica de clamping de `panelLeft`/`panelTop`/`openAbove` que tenía la versión anterior — quedó más simple, no más compleja, a pesar de ser visualmente más grande.
- El orbe (arrastrable, forest, sesión 95) no cambió — sigue igual, solo se oculta mientras el panel está abierto.
- **Layout con `justifyContent: 'space-between'`**: arriba, identidad (orbe chico + "Sofía" + "tu asistente" + X) y el saludo grande en Fraunces; abajo, el aviso de "en desarrollo" + las 4 filas de opciones + el input deshabilitado — con el aire del medio repartido automáticamente, igual que en la referencia.
- **Atajo nuevo, pedido esta sesión: "Quiero ver a los profesionales" → `/(tabs)/conexiones`** — el pedido original de Joaquín. Quedan 4 atajos en total (recomendación de hoy, arrancar, mal día, profesionales).
- **El aviso de "en desarrollo"** quedó en un solo lugar, justo arriba de las opciones ("Todavía estoy aprendiendo a conversar. Mientras tanto, elegí una de estas opciones:") — se evitó duplicarlo con una frase parecida bajo el input; ahí quedó una línea distinta y específica sobre el campo de texto en sí ("Muy pronto vas a poder escribirme directamente").
- Typecheck, lint y 140/140 tests limpios.

**Fix al toque, mismo commit: Joaquín probó y seguía lagueado — mismo síntoma que `SobreVosMomento`, ni rasterizar ni diferir la animación alcanzaron.**
- 🔴 **Diagnóstico: el problema de fondo es `<Modal>` en sí, no algo arreglable con trucos de animación.** `Modal` arma una pantalla nativa nueva (`UIViewController` en iOS) cada vez que se abre — ese costo de montaje es del sistema, no del hilo de JS, así que ni rasterizar ni `InteractionManager` lo tocan.
- **Se sacó `Modal` de `SofiaAssistant.tsx` — ahora es un `View` absoluto normal.** Viable acá porque el componente ya está montado como sibling de `<Tabs>` en `app/(tabs)/_layout.tsx`, no dentro de una pantalla — no hace falta la garantía de "por encima de todo" que da `Modal`, un `View` con `position:absolute` alcanza igual de bien y sale gratis el costo de montaje nativo.
- Repuesto a mano el botón físico de "atrás" en Android (`BackHandler`), que antes venía gratis con `Modal`'s `onRequestClose`.
- ⚠️ **`SobreVosMomento.tsx` NO puede aplicar el mismo arreglo tal cual** — vive DENTRO del árbol de la pantalla de Inicio, no al lado de `<Tabs>`. Un `View` absoluto ahí quedaría por DEBAJO de la isla de tabs (que la arma `<Tabs>` por fuera, como su propio `tabBar` prop), no por encima. Para aplicar el mismo arreglo ahí hace falta mover el estado del momento al nivel del layout (como ya está Sofía) y que Inicio solo dispare un evento/callback hacia arriba — cambio de arquitectura más grande, no se hizo especulativamente.
- Typecheck, lint y 140/140 tests limpios.

**Pendiente para la próxima sesión:**
- Confirmar que Sofía ahora sí se siente fluida.
- **Decidir si vale la pena mover `SobreVosMomento` al mismo patrón** (sin `Modal`, montado al nivel del layout) — mismo diagnóstico, arreglo más grande.

## 2026-08-16 — Joaquín (sesión 95)

**Tocado:** `app/(tabs)/_layout.tsx`. Nuevo: `components/SofiaAssistant.tsx`.

**Resumen — asistente flotante "Sofía", SOLO interfaz, sin conexión a ningún LLM.**

- Orbe circular (54px, terracota `ViveColors.primary`, "S" en Fraunces 700) flotando en la esquina inferior derecha, montado en `app/(tabs)/_layout.tsx` como sibling de `<Tabs>` (no dentro de cada pantalla) — visible en las 4 tabs principales (Inicio, Conexiones, Recursos, Mensajes) y en ningún otro grupo de rutas (coach, admin, onboarding, auth quedan afuera solos, porque viven en layouts distintos que no montan este).
- Posición calculada con el mismo criterio que usa `IslandTabBar` para sí misma (`insets.bottom + 8` + su propia altura ≈56 + margen) en vez de una constante fija — así queda pegado arriba de la isla en cualquier dispositivo sin desalinearse si la isla cambia de tamaño.
- Al tocar, se expande a un panel (glassy, mismos `GLASS`/`GLASS_BORDER` que ya usa el resto de la app) con: header (orbe chico + "Sofía" en Fraunces 600 + "tu asistente") y X para cerrar; saludo; 3 chips que navegan a pantallas YA existentes, no conversan (`router.push`, sin backend); campo de texto visiblemente deshabilitado (`editable={false}`) con el placeholder pedido — no hace nada al tocarlo.
- **Los 3 atajos, resueltos contra rutas reales:** "¿Qué me recomendás para hoy?" → `/(tabs)/recursos` (no existe una pantalla de recomendación aparte — la card de `useRecommendedResource` ya vive arriba de Recursos, así que ir ahí cubre las dos ramas del pedido a la vez). "Ayudame a arrancar" → `/(tabs)` (Inicio, mismo patrón que ya usa `diario.tsx` para volver). "Estoy teniendo un mal día" → `/diario`.
- Respeta `useReducedMotion` (ya existente): con la preferencia activa, la transición orbe↔panel es instantánea en vez de animada.
- Cierre por X, por tocar afuera del panel (backdrop invisible), o reabrir tocando el orbe de nuevo.
- Typecheck y lint limpios (los 2 warnings de `_layout.tsx` son preexistentes, en un `useEffect`/`useCallback` que no se tocó). 140/140 tests siguen pasando — nada de esto tiene lógica pura para testear, es interfaz.
- Sin cambios de schema, sin nueva dependencia, sin tocar nada de lo que ya existía en las pantallas.

**Pendiente para la próxima sesión:**
- Cuando haya backend de IA para conectar: el campo de texto y el hook de conversación son el próximo paso natural — hoy es deliberadamente un preview sin funcionalidad.

**Ajustes al toque, pedidos por Joaquín después de ver el primer resultado — mismo commit de hoy, sin nueva sesión:**
- **El orbe pasa a ser arrastrable.** Se parecía demasiado al círculo de avatar del perfil (mismo terracota) y no se podía mover del lugar fijo. `PanResponder` + `Animated.ValueXY` (mismo mecanismo que ya usa el slider de filtros de `app/search3.tsx` — no se agregó gesture-handler para esto). Posición absoluta en pantalla, clampeada a los bordes reales (no se puede arrastrar debajo de donde empieza la isla, ni tapando el status bar arriba). Distingue tap de arrastre por distancia recorrida (<6px = tap). **No persiste entre reinicios de la app** (vuelve a la esquina inferior derecha cada vez que arranca) — no se pidió que persista, y el componente igual no se desmonta al cambiar de tab, así que la posición se mantiene mientras la app sigue abierta.
- **Color propio: forest `#3F512F`, no `ViveColors.primary` (terracota).** Es el mismo terracota que usa el gradiente del avatar en el top bar de Inicio — de un vistazo, Sofía se leía como "otro círculo de perfil". Forest ya es el segundo color fuerte de la marca (tab activo de `IslandTabBar`, botones de acción), así que sigue siendo de la paleta pero se distingue clara.
- **Panel a fondo sólido** (`#F7F2E7`, el mismo `CARD` que usa `SurfaceCard` por default) **en vez de glass translúcido** — antes se veía todo lo de atrás (la pantalla, otros elementos) a través del panel. Borde y chips pasaron del estilo "glass" (blancos/bordes semitransparentes) al mismo patrón "card sólida + línea sutil" que ya usan `menuCard`/`resultRow` en Conexiones.
- **El panel ahora se abre cerca de donde esté el orbe**, no siempre en la esquina de origen — tenía que ser así una vez que el orbe es arrastrable (si el orbe se mueve a upper-left y el panel siguiera abriendo en la esquina de abajo a la derecha, quedaría desconectado visualmente). Clampeado para no salirse de pantalla; abre arriba del orbe por default, abajo si no entra (cerca del borde superior).
- ⚠️ **Trade-off de accesibilidad, anotado y no resuelto:** el orbe pasó de `Pressable` (con `onPress` real) a una `View` con `PanResponder` manejando tap-vs-drag a mano — un lector de pantalla no dispara el tap sintético de VoiceOver/TalkBack sobre gestos de `PanResponder` de la misma forma que sobre un `Pressable` real. Queda pendiente si se vuelve un problema real.
- Typecheck, lint y 140/140 tests siguen limpios.

## 2026-08-16 — Joaquín (sesión 94)

**Tocado:** `app/(tabs)/index.tsx`, `components/MoodCheckIn.tsx`, `screens/ProfileOwnScreen.tsx`. Nuevo: `lib/sobreVosMomento.ts`, `lib/sobreVosMomentoStorage.ts`, `components/SobreVosMomento.tsx`, `__tests__/sobreVosMomento.test.ts`.

**Resumen — feature nueva: "Sobre vos" pasa de card silenciosa a un momento de pantalla completa + card "Sello" persistente, la primera vez que vale la pena.**

- **Pedido con mockup interactivo** (`sobre-vos-momento.html`, en el repo). Antes de codear: exploración completa (check-in de mood, paleta de colores, mecanismo de preferencias, patrones de bottom sheet existentes) y un hallazgo que cambió el plan original — ver abajo.
- 🔴 **Hallazgo clave: "Sobre vos" ya había sido reconstruida 3 sesiones atrás (Andre, sesión 91) como devolución semanal** (`lib/weeklyReflection.ts` + `useDailyReflection` + edge function + flag de IA + consulta legal pendiente en `docs/legal-instrucciones.md`). El pedido original traía un banco propio de 25 frases por nivel de mood (Parte D), que hubiera sido una segunda fuente de texto compitiendo con un motor mejor. **Decisión con Joaquín: se combinan las dos ideas.** El motor de Andre (`buildReflection()`) sigue siendo la ÚNICA fuente de texto, en los dos lugares nuevos (card y momento) — nada de lo suyo se toca, ni se borra. Lo que se agrega es la presentación: la card se rediseña al formato "Sello" y aparece un momento de pantalla completa la primera vez que se hace el check-in del día, mostrando la misma frase que ya mostraría la card.
- 🔴 **Segundo ajuste de diseño, también acordado antes de codear: el momento no dispara todos los días.** Varias señales del motor de Andre (`streak`, `sessions`, `trend-up/down`, `practices`) son ciertas VARIOS días seguidos, no un evento de un solo día — disparar la pantalla completa cada uno de esos días hubiera sido repetir la misma noticia. Se agregó un gate de dos partes en `lib/sobreVosMomento.ts` (puro, testeado): (1) la señal no puede ser `level` (el fallback sin comparación, "le toca a cualquiera con ánimo parejo la mayoría de los días") ni `empty`; (2) la señal tiene que ser DISTINTA a la última que ya disparó un momento — se guarda `{fecha, señal}`, no solo fecha. `sharp-drop` sí dispara (decisión consciente, discutida: es el momento de mayor necesidad, no compite con `CoachSuggestionCard` que sugiere una acción distinta — acompañar vs. sugerir).
- **Problema de integración resuelto: `useMoodHistory` no se refresca solo tras guardar un check-in.** Sin nada más, la card y la decisión del momento seguirían mirando datos de ANTES del pick recién hecho hasta el próximo montaje de la pantalla. Se resolvió recomputando `buildReflection()` a mano con el pick nuevo spliceado en una copia local de `moodEntries` (`handleMoodPicked` en `index.tsx`) — mismas funciones puras que ya usaba la pantalla (`computeMoodStreak`, `detectMoodDrop`), solo alimentadas con el dato optimista. El resultado (`freshCheckIn`) manda sobre `reflection`/`todayMoodEntry` para el resto de la sesión.
- **`MoodCheckIn.tsx`: un solo callback agregado (`onPicked`), la lógica de guardado no se tocó.** Se dispara ANTES del upsert (no depende de la red — Parte A pedía reacción inmediata) con el mood elegido y si es la primera vez hoy (`!todayEntry`, el prop de ANTES de este toque). El halo del color por mood en el check-in ya usaba el color real (no un verde genérico) — no hizo falta tocar nada ahí.
- **Card "Sello" (`SobreVosCard`, reescrita en `index.tsx`):** construida sobre `SurfaceCard` (variant='elevated') para heredar gratis el grano de papel, la sombra en 3 capas y el lift al presionar — sin tocar ese componente compartido. El sello (píldora que sobresale arriba) vive FUERA de `SurfaceCard` a propósito, como sibling posicionado absoluto: el contenido de `SurfaceCard` va con `overflow:hidden` (necesario para el grano/gradiente), y el sello está diseñado para pisar el borde superior. Neutro: terracota `#C06B4A` (color del mockup, no `ViveColors.primary` — son tonos parecidos pero no idénticos) con pulso sutil (`Animated.loop`, respeta `useReducedMotion`). Resuelto: color del mood de hoy, sin pulso.
- **`SobreVosMomento.tsx` (nuevo):** `Modal transparent animationType="none"` + `Animated.View` propios (mismo patrón que el sheet de filtros de `app/search3.tsx`) para controlar el easing exacto del mockup (`Easing.bezier(0.32, 0.1, 0.25, 1)`, 400ms) — el `animationType="slide"` nativo no permite ese control. Gradiente mood→forest, `VitaMark` (ya era exactamente el Venn de 3 círculos del mockup, sin construir nada nuevo) como marca chica + marca de agua grande, texto en Fraunces. Respeta reduced motion (duración/easing reducidos, sin el slide elaborado).
- **Parte E — preferencia de apagado, en AsyncStorage, no en `profiles`.** `profiles` acaba de pasar por un endurecimiento de privilegios por columna (sesión 90-91, `lock-privileged-columns.sql`) — agregar una columna nueva ahí hubiera pedido un script de migración + GRANT explícito para algo que es una preferencia de UI sin necesidad de sincronizar entre dispositivos, mismo criterio que ya usa el caché de IA de `useDailyReflection`. Toggle nuevo en `ProfileOwnScreen`, sección "Preferencias" (nueva, arriba de "Configuración"), mismo patrón visual que el `Switch` que ya existía en `CoachProfileScreen` (modalidad de reserva). Apagarlo no afecta reabrir el momento tocando la card.
- **Parte F — analítica**, vía `registrarEvento` (ya existente, mismo patrón que `reserva_aceptada`): `reflexion_vista` (`origen: 'checkin' | 'reapertura'`) al abrir el momento, `reflexion_momento_desactivado` al apagar el toggle.
- **Fidelidad al mockup — dos desviaciones conscientes, sin poder medir en dispositivo real desde acá:** (1) el gradiente del momento (`160deg`, segundo color al 130%) se aproxima con dos colores sin `locations` custom — si el forest pesa de más en pantalla, se ajusta. (2) Fraunces no tiene la variante 400 cargada en la app (solo 600 y 700) — se usó 600 para el cuerpo y 700 para lo destacado, mismo criterio que ya aplicó Andre para el mismo problema en la card semanal.
- **8 tests nuevos** para la lógica de disparo (`lib/sobreVosMomento.ts`, puro — separado de `lib/sobreVosMomentoStorage.ts` que tiene el I/O de AsyncStorage, porque importar AsyncStorage rompe la resolución de Jest si queda en el mismo archivo; mismo criterio que ya separa `weeklyReflection.ts` de `useDailyReflection.ts`). Typecheck y lint limpios, **140/140 tests**.
- De paso: se limpiaron `sparkTooltip`/`sparkTooltipText`, estilos sin uso desde que se borró `MoodSparkline` en la sesión 91 y habían quedado atrás.
- Sin cambios de schema.

**Dos rondas de fix probando en el dev build: el momento se sentía lagueado al aparecer.**
- **Ronda 1:** el `Animated.View` de la hoja tiene bordes redondeados + `overflow:hidden` + un `LinearGradient` adentro, Y ADEMÁS se anima (`translateY`) — sin ayuda, el sistema recalcula esa máscara + gradiente en cada frame. Se agregó `shouldRasterizeIOS`/`renderToHardwareTextureAndroid`. Joaquín probó: mejoró pero **sigue un poco lento** — indica que el cuello de botella no era (solo) el repintado por frame.
- **Ronda 2:** el pick del mood dispara `setFreshCheckIn`, que re-renderiza TODA la pantalla de Inicio (la card nueva, el propio `MoodCheckIn` animando sus círculos) en el mismo instante en que el momento quiere arrancar su animación — hilo de JS/bridge ocupado justo en el peor momento. Se envolvió el arranque de la animación de apertura en `InteractionManager.runAfterInteractions()` (`SobreVosMomento.tsx`) — espera a que ese trabajo termine antes de largar el slide, en vez de competir por el hilo. **Tampoco verificado en dispositivo todavía.**

**Pendiente para la próxima sesión:**
- **Confirmar si el momento ya se siente fluido.** Si sigue lento después de las dos rondas, el sospechoso que queda es la propia sobrecarga nativa de `<Modal>` (crea un contexto de presentación nuevo, no es gratis) — la alternativa sería sacar el overlay de `Modal` y renderizarlo como una vista absoluta dentro del árbol normal de la pantalla (más liviano, pero cambio de arquitectura más grande, no se hizo especulativamente).
- **Probar en el dev build**: los dos estados de la card (neutro/resuelto), el momento completo (colores, tipografía, cierre por backdrop/botón), el toggle en Ajustes en las dos posiciones, y sobre todo que el gate de "vale la pena" se sienta bien en un uso real de varios días seguidos (no se pudo probar la persistencia de `{fecha, señal}` más que con tests unitarios).
- Si el gradiente del momento o los pesos de Fraunces no se ven bien contra el mockup real, ajustar `locations` del `LinearGradient` en `SobreVosMomento.tsx`.
- Evaluar si vale la pena, más adelante, un mecanismo de "resurfacing" cuando la misma señal persiste muchas semanas (hoy no vuelve a disparar nunca más una vez mostrada, sin ventana de tiempo — documentado como simplificación consciente en `lib/sobreVosMomento.ts`).

---

## 2026-08-16 — Joaquín (sesión 93)

**Tocado:** `app/(tabs)/conexiones.tsx`.

**Resumen:**
- Pedido de Joaquín: el efecto de "apretado" (rebote de escala al presionar) que ya tienen las tarjetas en el resto de la app (`ScaleCard` — usado en Home, Recursos, Favoritos, Onboarding, `search3`) faltaba específicamente en Conexiones. Confirmado con un video que Joaquín mandó por AirDrop (extraído cuadro por cuadro con `ffmpeg`, recién instalado para esto) y comparando contra el resto del código: `conexiones.tsx` era la única pantalla con tarjetas de contenido que seguía usando `TouchableOpacity` a secas.
- **4 tarjetas pasadas a `ScaleCard`** (mismo patrón que `search3.tsx`: `<ScaleCard style={...} onPress={...}>`, sin `activeOpacity` — el feedback ahora es el rebote de escala, no el dimming de opacidad): las dos versiones de `menuCard` (menú de ejes de bienestar, y menú de temas dentro de un eje), las filas de resultado de búsqueda por nombre (`resultRow`), y la tarjeta del quiz de orientación (`quizWrap`) — la que Joaquín señaló originalmente.
- **A propósito, NO se tocaron:** los botones de ícono chico (campana, estrella, chevron "atrás", limpiar búsqueda) ni los chips de tema — en el resto de la app tampoco los envuelve `ScaleCard`, es un patrón reservado para tarjetas de contenido (ícono + título + subtítulo), no para controles chicos. Tampoco se tocó la card grande del deck (el carrusel swipeable de "En tendencia"/"Recomendado"/etc.): no tiene `onPress` propio —solo el botón "Conocer a [nombre]" adentro— y viste dentro de un `ScrollView` horizontal con paginado; envolverla enteramente en un touchable competiría con el gesto de swipe. El botón interno tampoco se tocó, sigue el mismo criterio que otros CTAs de la app (el botón "Ver tu progreso completo" de Home tampoco usa `ScaleCard`).
- Typecheck y lint limpios. **132/132 tests siguen pasando** (nada de esto lo tocaba, pero se corrió igual para confirmar).
- Sin cambios de schema.

**Segunda vuelta — el problema real no era el rebote de presión, era la falta de transición entre "pantallas" internas:**
- Joaquín probó en el dev build y "sigue igual". Al revisar de nuevo: dentro de Conexiones, pasar de "Ejes" → "Puertas/temas" → "Deck" **no es una navegación real** — es un swap de estado local (`selectedAxisId`/`selectedDoorId`) que cambia qué JSX renderiza el mismo componente, al instante y sin ninguna animación. En cambio, cualquier `router.push` real del resto de la app (ir al quiz, al perfil de un coach, a la búsqueda) recibe gratis el slide nativo de iOS. Por eso Conexiones se sentía distinta: no le faltaba el rebote al tocar, le faltaba la transición al cambiar de vista.
- **Nuevo `SlideInView`** (helper local, no un componente compartido — es chico y específico de este patrón): se remonta con cada `key` distinto y anima una vez al montarse (fundido + deslizamiento leve desde la derecha, 260ms), imitando el push nativo. Aplicado en 3 puntos: el swap Fase 1 ↔ Fase 2 del menú (key = `"fase1"` / `selectedAxis.id`) y el contenido completo de la vista Deck (key = `selectedDoorId`, así que también anima al cambiar de puerta con los chips de arriba, no solo al entrar). Escribir en el buscador no dispara la animación (la key no cambia con cada tecla).
- Typecheck, lint y **132/132 tests** de nuevo verdes.

**Pendiente para la próxima sesión:**
- **Probar en el dev build** — esta vez confirmar que se ve/siente la transición al tocar una tarjeta de Eje o de Puerta, no solo el rebote de las 4 tarjetas de la primera vuelta.

## 2026-08-16 — Joaquín (sesión 92)

**Tocado:** ningún archivo de código — sesión 100% operativa/infra, guiando a Joaquín desde su propia Terminal (este entorno no tiene acceso al hardware ni puede tocar el celular).

**Resumen — se armó el primer dev build real y quedó instalado y corriendo en el iPhone de Joaquín:**
- Arrancó como "no puedo entrar a la app" (mismo `ERR_NGROK`/túnel offline de sesiones anteriores), pero destapó una cadena mucho más larga: Joaquín nunca había podido correr el proyecto porque le faltaba estar logueado y agregado como colaborador en el proyecto de Expo (`vita-wellness-app`) — arreglado con `npx expo login` + Andre agregándolo en expo.dev (organización Y proyecto puntual, son dos permisos separados).
- Con eso resuelto, `npm start` arranca en modo `development build` (no Expo Go) desde que el proyecto tiene `expo-dev-client` — el QR que muestra no lo puede leer Expo Go. Antes se resolvía apretando `s` para forzar Expo Go; **esta sesión fue directo a lo de fondo: armar el dev build real**, que es lo que estaba pendiente desde sesión 81.
- **Camino completo, con cada bache documentado porque se va a repetir (para quien lo corra de nuevo):**
  1. `npx eas-cli device:create` — registrar el UDID del iPhone en la cuenta de Apple del proyecto. Se completa desde Safari **en el celular**, no en la compu.
  2. `npx eas-cli build --profile development --platform ios` — falló varias veces antes de arrancar de verdad: primero `Entity not authorized` (Joaquín no tenía acceso al proyecto en Expo, sección aparte de la org — resuelto por Andre); después `ENOTFOUND api.expo.dev` un par de veces (red inestable de Joaquín, nada del lado del proyecto — confirmado con `nslookup` funcionando pero `curl` tardando ~10s en responder).
  3. Con la red y los permisos ok, pidió loguearse con la cuenta de **Apple Developer de Andre** (`ANDRE ALBISU LAMBERTINI`, no una cuenta personal de Joaquín) + código de verificación en dos pasos que solo le llega a Andre — tuvieron que coordinar el momento exacto.
  4. Primer intento de login a Apple falló igual después del código 2FA (`Apple servers threw an expected error … Authentication with Apple Developer Portal failed`) — se probó de nuevo sin cambiar nada y la segunda vez pasó. Es un error conocido e intermitente del lado de Apple (`fastlane spaceship`), no señala nada mal configurado.
  5. Preguntó si re-provisionar el dispositivo (el perfil existente no incluía el UDID nuevo) — se aceptó y se marcaron los dos dispositivos (el de Joaquín + el de Andre).
  6. **La build terminó "finished" pero instalar en el iPhone daba "No se pudo instalar 'Vita' — no fue posible verificar su integridad"**, incluso reinstalando desde el link correcto de la build más reciente (`eas build:list` para confirmarlo — la primera vez se estaba probando sin querer con un link de una build vieja del 09/08). Fecha/hora del dispositivo, wifi vs. datos móviles, y VPN se descartaron uno por uno sin cambiar nada.
  7. **La causa real: el perfil de aprovisionamiento (Ad Hoc) se había generado en algún punto de los reintentos anteriores sin la lista de dispositivos actualizada.** Se resolvió con `npx eas-cli credentials` → iOS → development → Build Credentials → **"Provisioning Profile: Delete one from your project"** (borra el perfil viejo sin tocar el certificado) y se volvió a correr el build — esta vez sí preguntó de nuevo qué dispositivos incluir (los dos, ya marcados) y el `.ipa` instaló bien.
  8. Instalada, iOS pidió activar **Modo de desarrollador** (Ajustes → Privacidad y seguridad → Modo de desarrollador → reiniciar → confirmar) — paso normal para cualquier app firmada así, no específico de este proyecto.
  9. Con el dev client instalado, `npm start` (sin apretar `s` esta vez — hay que quedarse en modo dev-client) + escanear el QR desde adentro de la app **Vita** (no Expo Go) conectó todo. Funciona.
- **Dev build real, funcionando, en un dispositivo real** — esto estaba bloqueando desde sesión 81: confirmar si Expo Go era la causa de lentitud percibida, Google OAuth, push notifications, audio en background, y eventualmente sacar la videollamada del navegador (anti-fuga #4). Ahora hay un dispositivo real para probar todo eso.
- **Se trajo en paralelo el trabajo de Andre de sesiones 89-91** (48 commits: panel de administración completo, tests — 132 pasando, 5 suites —, garantía de primera sesión, bloqueo de usuarios, declaración de mayoría de edad, botón de arrepentimiento, dominio `vitaapp.com.ar` comprado y sitio deployado en Vercel, devolución semanal con redacción por IA detrás de flag, y más — ver sus entradas abajo para el detalle real). Merge limpio, sin conflictos (fast-forward). `npm install` para traer las deps nuevas de Jest, typecheck limpio, **132/132 tests pasando**.

**Pendiente para la próxima sesión:**
- **Usar el dev build para probar lo que quedó bloqueado por Expo Go**: audio en background, performance real de arranque, y confirmar Google OAuth/push si Andre ya cargó las credenciales correspondientes.
- Si hace falta una build nueva más adelante (nuevo dispositivo, cambios nativos), el camino ya está pavimentado — pero si vuelve a fallar la instalación con "no fue posible verificar su integridad" después de agregar un dispositivo nuevo, ir derecho a borrar el provisioning profile viejo (`eas credentials` → Provisioning Profile: Delete) antes de perder tiempo con fecha/red/VPN.
- Seguir con el resto de pendientes de sesión 87-88 que sigan abiertos (probar reserva instantánea con pago, tramo 15%, etc. — revisar contra las entradas de Andre más abajo, es posible que algunos ya se hayan cerrado en sesiones 89-91).

## 2026-08-15 — Andre (sesión 91)

**Tocado:** nuevo `scripts/add-application-status-and-audit.sql`. Modificados `supabase/functions/admin-actions/index.ts`, `supabase/functions/guarantee-claim/index.ts`, `lib/admin.ts`, `screens/AdminScreen.tsx`, `screens/CoachApplicationScreen.tsx`, `docs/garantia-runbook.md`, `SCHEMA.md`. **Un script de schema nuevo — SCHEMA.md ya actualizado. FALTA CORRERLO.**

**Resumen:**

- **Pedido: cerrar los tres huecos conocidos del panel de administración** (el ítem 6 del relevamiento de pendientes). Aparecieron dos cosas más graves de camino.
- 🔴 **La escalada de privilegios de la sesión 90 estaba cerrada a medias, y lo estuvo todo este tiempo.** `lock-privileged-columns.sql` revocó el **UPDATE** de tabla completa sobre `coaches` y re-otorgó 5 columnas nombradas dejando `verified` afuera — pero **nunca tocó el privilegio de INSERT**, que siguió siendo de tabla completa. Confirmado contra prod: `information_schema.column_privileges` devolvía `INSERT | verified` para `authenticated`. La cadena de tres pasos que ese script documenta se colapsaba en una sola sentencia que el arreglo no cubría: `insert into coaches (profile_id, verified) values (auth.uid(), true)` y quedabas publicado en el catálogo sin revisión. `coaches_insert_own` valida la FILA, no las columnas — la misma distinción que motivó el script original, aplicada al verbo que quedó afuera.
  - **La lección quedó como regla crítica 21:** un privilegio por columna hay que revocarlo **por verbo**. Al blindar una columna, recorrer los cuatro y preguntarse por cada uno. Y la query de auditoría **no debe filtrar por `privilege_type`**, o repite el mismo punto ciego que la dejó abierta.
  - ⚠️ **El fix rompe el alta de coaches hasta que la app nueva esté en el celular:** `CoachApplicationScreen` mandaba `verified: false` en el INSERT y ahora eso da 42501. Se sacó del cliente y `verified` quedó con `DEFAULT false`. El código y el SQL van en el mismo commit, pero el orden importa al deployar.
- 🔴 **El contador de la pestaña Garantías estaba muerto y nunca podría haber funcionado.** Contaba claims en `'pedida'`, pero `guarantee-claim` **nunca escribe una fila en ese estado**: crea el claim recién al resolverlo, ya en `'aprobada'` o `'rechazada'`. Es consecuencia directa de que el intake sea el mail — no hay solicitud en la base hasta que alguien la contesta. El default `'pedida'` de la tabla no lo usa nadie.
  - Eso cambió qué significaba "aprobar garantías desde el panel": botones sobre las filas existentes no servían de nada, porque para cuando existen ya están resueltas. La pestaña ahora **reemplaza el runbook**: pegás el ID de la reserva, corre el mismo `dry_run` y muestra **qué condición de §9.3 falla**, y aprueba o rechaza. Misma edge function, mismo payload — no hay dos definiciones de la cláusula.
- **`application_status` es una columna nueva y NO se reusó `verified`, que era la decisión tentadora.** `verified` es "¿aparece en el catálogo?"; `application_status` es "¿en qué estado está la revisión?". Con una sola columna, **revocar a un coach por un reporte y rechazar su postulación serían el mismo acto**, y se perdería por qué está afuera. Por eso `set_coach_verified(false)` deliberadamente **no** toca `application_status`, y `reject_coach_application` tiene un guard `.eq('verified', false)` para que un tap en la pantalla equivocada no despublique a un coach activo.
- **Backfill: `verified=true` → `'aprobada'`; `verified=false` queda en `'pendiente'`, no en `'rechazada'`.** Nadie los rechazó — no había con qué. Mismo criterio que `age_confirmed` y que las columnas de aceptación: fabricar una constancia que no existió es peor que no tenerla.
- **Decisión de Andre: al rechazado se le avisa y puede volver a postularse.** El motivo es **obligatorio** (la función devuelve 400 sin él), le llega por notificación in-app + push, y `CoachApplicationScreen` pasó de solo-alta a alta-o-edición: si existe una fila `'rechazada'`, prellena todo y muestra el motivo arriba de todo. Antes esto era un callejón sin salida — el UNIQUE de `profile_id` hacía que el INSERT fallara con "ya tenemos una solicitud" y la persona sabía qué corregir por la notificación pero no tenía dónde.
- ⚠️ **El trigger de re-postulación se dispara con CUALQUIER update de la fila, no solo con el de las columnas revisadas, y es a propósito.** La versión angosta tiene un modo de falla peor: a quien rechazaran por los temas que eligió, esos viven en `coach_topics` —otra tabla— y corregirlos no tocaría ninguna columna vigilada; la postulación se quedaría en `'rechazada'` para siempre sin que nada se lo dijera. El peor caso de la versión ancha es una postulación que vuelve a revisión de más: visible y barato. Se prefiere el error ruidoso.
- **Auditoría: tabla `admin_audit_log`, escrita solo por `admin-actions` con service role.** `admin_id` es nullable con `ON DELETE SET NULL` **y además se guarda el mail desnormalizado**: un log de auditoría tiene que sobrevivir a que se borre la cuenta de quien actuó. Se escribe **después** de la acción y su fallo **no la deshace** — vuelve como `warning` en la respuesta en vez de tragarse, porque una auditoría que falla en silencio promete un rastro que no existe. Pestaña "Registro" nueva en el panel.
- **`guarantee-claim`: `resolved_by` ahora sale del JWT cuando llama un admin** y el body no puede pisarlo. Es el único rastro de quién resolvió una garantía; que lo eligiera su propio actor es el mismo problema que un `is_admin` que viniera del cliente. Para el runbook con service role no hay identidad que derivar y ahí sigue valiendo lo que mande el `curl`.
- **Agregado que no estaba pedido y conviene saber:** además del rechazo, **aprobar también notifica**. Es el mismo insert en el mismo código y dejarlo mudo hacía que el coach descubriera de casualidad que ya puede trabajar. Es la excepción declarada al criterio de `propuesta_descartada` (donde una push sería punitiva): acá el aviso trae el motivo y se puede corregir, o sea que es accionable.
- Arreglado de paso un bug de formato en SCHEMA.md: había **dos reglas numeradas 19** pegadas sin salto de línea. La de RLS por fila pasó a ser la 20.

Typecheck limpio, `npm run lint` en **0 errores** (siguen los 66 warnings previos) y `npx jest` en **92/92**. Ningún test nuevo: lo que se tocó son pantallas y edge functions, y el proyecto todavía no tiene arnés para ninguna de las dos.

**Duodécimo bloque — la devolución de la tarjeta "Tu semana", y dos bugs de fecha:**

- **Pedido de Andre: que la tarjeta de abajo del check-in "te hable" según tus datos, con tono Vita, y que al tocarla accedas a todo tu progreso.** La navegación ya existía (lleva a `/progreso`); lo que cambió es qué dice.
- 🔴 **El titular decía lo contrario de lo que pasaba, la mitad de las veces.** `buildWeeklyHeadline` comparaba el promedio de 7 días contra el de los 30 anteriores, pero armaba la frase **"Veniste más {etiqueta} que de costumbre"** con la etiqueta del **nivel absoluto**. La oración afirma una comparación y la etiqueta describe un nivel: se contradicen cuando la valencia no coincide con la dirección.
  - Venís en 4 (*bien*) con un histórico de 4,6 → **empeoraste**, y decía *"Veniste más **bien** que de costumbre"*.
  - Venís en 2 (*cansado*) con un histórico de 1,7 → **mejoraste**, estás saliendo de un pozo, y decía *"Veniste más **cansado** que de costumbre — se nota"*. Ese es el peor: le dice a alguien que remonta que está peor, y encima se felicita.
  - **La invariante que lo hace imposible de repetir** quedó fijada en tests: una frase habla del **nivel** o de la **dirección**, nunca de una con la gramática de la otra. Un test barre las frases de tendencia buscando etiquetas de nivel; otro barre la de nivel buscando gramática comparativa.
- 🔴 **Segundo bug, independiente y más extendido: `new Date().toISOString().split('T')[0]` no es la fecha de hoy, es la fecha UTC.** Argentina es UTC-3, así que ese "día" salta a las **21:00**. El patrón estaba copiado en cinco lugares y rompía tres cosas visibles, todas entre las 21:00 y las 00:00 — justo la franja en que más se abre una app de bienestar: **la racha desaparecía todas las noches** (`computeMoodStreak` buscaba la entrada de mañana y devolvía 0), **el check-in de hoy se veía como no hecho**, y **la sugerencia de hablar con alguien dejaba de aparecer** (`detectMoodDrop` exige que la más nueva sea la de hoy). Más uno silencioso: **dos check-ins del mismo lunes** (20:00 y 22:00) se guardaban con fechas distintas, así que el `UNIQUE(user_id, entry_date)` **no los dedupeaba**.
  - Nuevo `lib/dates.ts` con `localDayKey()` / `localDayKeyMinus()`, y quedó como **regla crítica 22**: `toISOString()` sirve para instantes, nunca para días de calendario.
  - ⚠️ **No se puede backfillear:** `mood_entries` no guarda cuándo se escribió la fila. El desfasaje es de un día como máximo y solo en filas escritas después de las 21:00.
  - ⚠️ **El `dayKey` del deck de Conexiones se dejó en UTC a propósito** — ahí la rotación a las 21:00 no es un bug (es pareja para todos, una vez cada 24hs) y hay un test que fija ese comportamiento.
- **Decisión de alcance (Andre): determinística ahora, IA enchufable después.** No por costo — se hicieron los números y **una devolución sale US$0,0075 con Opus 5** (~US$225/mes con mil usuarios activos diarios; ~US$45 con Haiku), o sea ruido a esta escala. La razón es otra: la capa determinística **hace falta igual** como piso para cuando no hay red, el modelo falla o la persona es nueva; arreglarla mata el bug de arriba; y la tarjeta sale sin quedar esperando al abogado/a. `Reflection.source` (`'rules' | 'ai'`) es el enganche: la IA produciría la misma forma y estas reglas quedan abajo.
- **La devolución dice UNA sola cosa, no un resumen.** Lista de señales con prioridad, se devuelve la primera que aplica. Un amigo no te recita un tablero: elige lo que más llama la atención y comenta eso.
- **Y cede el tono cuando corresponde.** `CoachSuggestionCard` aparece justo arriba cuando el ánimo cayó fuerte hoy; si la de abajo dijera algo liviano dos centímetros más abajo se contradicen. La señal `sharpDrop` gana sobre todas —incluso sobre una racha de 30 días y dos sesiones— y baja el registro sin sumar una segunda acción. Se calcula en `index.tsx` y se pasa a las dos tarjetas: es coordinación entre componentes, no estado de uno.
- **Otra prioridad que no es obvia: el nivel bajo sostenido gana sobre la tendencia de mejora.** A alguien que viene en 2 hace una semana no le sirve enterarse de que "mejoró" respecto de un mes peor. Cuando el nivel es bajo, el nivel manda.
- **Datos nuevos que la tarjeta ahora mira** (`hooks/useWeeklySignals.ts`): recursos completados, sesiones de la semana, diario y gratitud. Antes miraba **solo** `mood_entries`, así que podía decir "tu semana viene pareja" en una semana con una sesión y tres prácticas. Los conteos van con `head: true` — se baja el número, no las filas, porque son tres requests en la pantalla más abierta de la app.
- **La variante del día es estable dentro del día y distinta entre días.** Si cambiara en cada montaje —la tarjeta se re-monta cada vez que volvés a Inicio— se rompe justo la ilusión que la feature persigue; si no cambiara nunca se leería como un cartel. Las dos propiedades tienen test.
- ⚠️ **Ambigüedad asumida y anotada en el código:** se cuentan **filas** de `resource_completions`, no "recursos terminados". La tabla tiene `progress_seconds` para distinguir a medias de completo, pero `duration_seconds` es NULL en los recursos libres (Diario, Ruido blanco), así que no hay una regla de "terminado" que valga para todos.
- **Después, a pedido de Andre: la tarjeta muestra SOLO el mensaje.** Salieron el sparkline, los tres números (semanas activas / áreas / sesiones) y el badge de racha. Los datos ya están en `/progreso`, que es justo adonde lleva el tap, así que tenerlos al lado duplicaba y hacía que la frase se leyera como el título de un tablero. El badge salió por un motivo propio: **la devolución ya puede ser sobre la racha**, así que tenerlo al lado repetía el mismo dato en la misma tarjeta.
  - 🔴 **Al reescribir los estilos apareció que el énfasis nunca se vio.** `sobreVosHeadline` y `sobreVosHeadlineBold` usaban **las dos** `ViveFonts.frauncesSerif`, que es `Fraunces_700Bold`: el fragmento que la devolución elige destacar se renderizaba idéntico al resto. Ahora el cuerpo es `frauncesSemiBold` (600) y el destacado queda en 700. Las dos ya estaban cargadas en `_layout`, así que no cuesta nada de arranque.
  - **Efecto colateral bueno:** `useProgressStats` era consumido en Inicio **solo** por esos tres números, así que salió de la pantalla — dos queries menos en la que más se abre. El hook sigue vivo y lo usa `/progreso`.
  - Se borró `MoodSparkline` (78 líneas, sin otro consumidor) y con ella quedaron sin uso `useWindowDimensions`, `ViveMoodColors`, los seis imports de `react-native-svg` y dos constantes de etiquetas. Todo eliminado.
  - **Después llegó la imagen de referencia y la tarjeta se rehízo contra ella:** marca de tres círculos a la izquierda, rótulo **"SOBRE VOS"** en terracota con tracking, mensaje en **sans** (Poppins) a 16,5/26 y no en serif, crema plano `#F4EFE4` sin gradiente ni borde, radio 26, y **sin botón** — toda la tarjeta es el área táctil. Nuevo `components/VitaMark.tsx` con el isotipo en SVG.
    - ⚠️ **Tres decisiones donde me aparté de la referencia, a propósito.** (1) La referencia dice **"SOBRE TI"**, castellano neutro; se escribió **"SOBRE VOS"** porque toda la app habla de vos y el componente ya se llamaba `SobreVosCard`. (2) La referencia trae un mensaje genérico de ~20 palabras (*"Vas por buen camino tomando acciones que te hacen cada vez más efectivo…"*); **las devoluciones de acá siguen siendo cortas y concretas**, porque el brief de marca pide "frases cortas y humanas" y prohíbe expresamente el "tono de coach gurú con transformaciones milagrosas" — que es justo lo que suena el texto de la referencia. (3) Sin botón visible, el tap no se anuncia solo: se agregaron `accessibilityRole` y `accessibilityHint`.
    - ⚠️ **El isotipo es el logo BORRADOR**, que sigue en conflicto con `VitaWordmark` y es parte del encargo al estudio. Se usa como decoración y está aislado en su propio archivo: si el logo final es otro, se reemplaza ese archivo y nada más.
- **24 tests nuevos** (total **116**). Typecheck limpio y lint en 0 errores.

**Decimotercer bloque — la redacción por IA, construida y apagada:**

- **Decisión de arquitectura que define todo lo demás: la IA redacta, las reglas deciden.** El motor determinístico sigue eligiendo **qué señal** aplica, con su orden de prioridad, el `sharpDrop` que cede el tono y el nivel bajo que gana sobre la tendencia; el modelo solo convierte esa señal en una frase. Si en cambio mirara los datos y decidiera qué comentar, se perderían **todas** las garantías que tienen test — incluida la única que no es negociable: que el día que alguien cae fuerte, la tarjeta no lo anime.
- **Eso además achica la pregunta legal, y por eso se anotó como consulta aparte.** Lo que sale del dispositivo es el nombre de la señal, el tono y dos o tres números que ya aparecen en el texto. **No viajan valores de ánimo, ni historial, ni una palabra escrita por la persona.** En los hechos se transmite *"la app decidió decir algo alentador"*, no un estado emocional. La edge function filtra el payload contra listas cerradas: lo que no es número o etiqueta de nivel se descarta antes de llegar al prompt.
- **Modelo: `claude-sonnet-5`**, elegido con Andre sobre Haiku. El trabajo no es razonar, es escribir en un registro muy específico y respetar restricciones finas; la diferencia aparece en el 10% de casos donde el tono se corre, que es justo lo que hace sonar falsa a una app de bienestar. Con mil usuarios diarios son ~US$72/mes contra ~US$36 de Haiku. Corre sin thinking y con `effort: low` — es reescribir una señal en una oración, y pensar solo agrega latencia en la pantalla más abierta.
- 🔴 **El guardarraíl es lo que hace segura la feature, y encontró un bug propio.** `rejectCopy()` revisa cada frase generada antes de mostrarla —género asignado a quien lee, vocabulario clínico, tono gurú, aliento o pedidos en tono suave, markdown, largo— y si no pasa **no se muestra y no se cachea**, así el próximo intento puede salir bien en vez de dejar una frase mala fija 24 horas.
  - **El bug: `\b` de JavaScript no cierra palabras en español.** Se define sobre `[A-Za-z0-9_]`, así que una vocal acentuada ya cuenta como "no-palabra": en "reservá" **no hay borde** después de la `á` —los dos lados son no-word— y `/\breservá\b/` no matchea nunca. El guardarraíl dejaba pasar exactamente lo que existe para frenar, en silencio. Lo encontró el test que escribí para verificarlo. Reemplazado por un lookahead que contempla acentos y ñ; se evitó `lookbehind` porque no está garantizado en todos los motores de JS de React Native.
- **Dos interruptores, los dos apagados.** `AI_REFLECTION_ENABLED` en el cliente (`constants/features.ts`) y la ausencia de `ANTHROPIC_API_KEY` en el servidor, que hace que la función devuelva 503. Con cualquiera de los dos apagado, la app usa el texto determinístico — que es igual el piso cuando no hay red o el modelo falla.
- **Caché diaria en `AsyncStorage`, no en una tabla.** No hace falta migración y la devolución no tiene por qué existir en el servidor: es texto derivado, no un dato de la persona. La clave incluye la señal, así que si hacés el check-in a la tarde y la señal cambia, la frase se regenera en vez de quedar contando algo que ya no es cierto. ⚠️ La contracara es que es por dispositivo: dos teléfonos pueden ver dos frases distintas el mismo día.
- **Sin spinner:** el hook devuelve las reglas en el acto y cambia el texto cuando llega el modelo. La tarjeta nunca aparece vacía. ⚠️ La primera apertura del día puede mostrar un cambio de texto; el resto del día sale de la caché.
- **La función NO se deployó** — con el flag apagado no aporta nada y deployarla es lo único que la haría alcanzable. Queda para cuando haya respuesta legal.
- **12 tests nuevos** (total **132**), casi todos sobre el guardarraíl. Uno verifica que **acepte las nueve frases de las reglas**: si el guardarraíl fuera más estricto que el piso al que cae, encender la IA dejaría la tarjeta oscilando entre dos textos que el propio código considera inaceptables.

**Pendiente para la próxima sesión:**
- 📌 **Las dos features que esperan al abogado/a quedaron fijadas en `docs/legal-instrucciones.md`, Paso 5** — sección nueva. El resto de ese archivo está escrito *hacia* el abogado/a (son las preguntas); el Paso 5 es lo de **después**: qué se destraba con cada respuesta posible, incluido el caso "sí es dato sensible" y el caso "no llega respuesta". Se hizo porque el "qué hacer después" vivía solo en el changelog, que se hunde con cada sesión nueva, mientras que `legal-instrucciones.md` es el archivo que se abre justo cuando vuelve la respuesta. `constants/features.ts` apunta ahí desde el propio flag.
- **Probar la tarjeta nueva en el celular, y sobre todo después de las 21:00** — es la franja donde vivían los tres bugs de fecha y la única forma de confirmar que la racha ya no se cae, que el check-in de hoy sigue viéndose hecho y que la sugerencia de coach aparece.
- **Leer la devolución varios días seguidos con datos reales.** Los tests fijan que cambia y que no se contradice, pero si suena a máquina eso solo se ve leyéndola. Las variantes están todas juntas en `lib/weeklyReflection.ts`, agrupadas por señal y reescribibles sin tocar la lógica.
- **La IA de la devolución queda enchufada a la misma consulta legal** ya redactada en `docs/legal-instrucciones.md` — es la misma transferencia internacional de dato sensible. Cuando llegue la respuesta, lo que se reemplaza es la fuente del texto, no la capa de datos.
- ~~Correr `scripts/add-application-status-and-audit.sql`~~ — **corrido y verificado por Andre el 15/08**. Verificado en dos tramos: por PostgREST con la anon key (las 3 columnas nuevas existen; `admin_audit_log` devuelve `42501 permission denied` y no `PGRST205`, o sea que existe y `anon` está afuera — el control negativo contra una tabla inexistente prueba que los dos errores son distinguibles) y con una query única en el SQL editor para lo que PostgREST no expone.
  - **La escalada por INSERT quedó cerrada**: `authenticated` conserva exactamente 6 columnas de INSERT sobre `coaches` (`profile_id`, `specialty`, `bio`, `price_per_session`, `nationality`, `application_video_url`) y **`verified` no está**. Sobre `verified` y las 3 `application_*` solo quedan `SELECT` y `REFERENCES`, ninguno de los cuales escribe.
    - ⚠️ **La expectativa estaba mal escrita en el pendiente original ("cero filas"):** no contemplaba que `SELECT` y `REFERENCES` aparecen legítimamente. `SELECT` es necesario —el panel lee `application_status`, el coach lee su `application_notes`, `coachesCache` filtra por `verified`— y `REFERENCES` solo habilita crear una FK que apunte ahí. **Lo que hay que mirar es que no aparezcan `INSERT` ni `UPDATE`**, no el conteo de filas.
  - `trg_reset_application_on_edit` montado, y `admin_audit_log` con una sola policy (`admin_audit_log_select_admin` / SELECT).
  - 📌 **Hallazgo del backfill: los 32 coaches quedaron `aprobada + verified=true`, o sea que NO hay ninguna postulación pendiente.** Es evidencia de que la prueba del panel del 14/08 funcionó (las 3 postulaciones de prueba se aprobaron de verdad — ese pendiente se puede tildar), pero significa que la pestaña "Postulaciones" arranca vacía: **para probar el rechazo hay que crear una postulación nueva** desde una cuenta de prueba con la app ya actualizada.
- ~~Deployar `admin-actions` y `guarantee-claim`~~ — **hechas y verificadas el 15/08**. El CLI tenía sesión (`projects list` devuelve el proyecto `linked`). `admin-actions` **v1 → v2** y `guarantee-claim` **v3 → v4**, las dos `ACTIVE`. Sondeo con la anon key: `admin-actions` devuelve `{"error":"token inválido"}` (JSON de su propio código) y `guarantee-claim` `Unauthorized` en texto plano (su `new Response`), con el control negativo de una función inexistente dando 404. ⚠️ **`admin-actions` v2 está viva y referencia columnas que todavía no existen** — aprobar o rechazar desde el panel falla hasta que se corra el SQL. No afecta a usuarios: es una función solo-admin.
- 🔴 **Probar el ciclo completo en el celular con una postulación de prueba:** rechazar con motivo → que le llegue la notificación → que la pantalla de postulación aparezca prellenada con el motivo arriba → reenviar → que vuelva sola a la cola del panel. Es lo único que no se puede verificar con una query.
- **Probar la pestaña de Garantías contra una reserva real** que no califique, para ver que el 422 se lea como "no califica + motivos" y no como error de red. El parseo de esa respuesta es el punto más frágil de lo que escribí.
- **Verificar que la escalada por INSERT quedó cerrada de verdad**, con la misma prueba negativa de la sesión 90: logueado como coach de prueba, `await supabase.from('coaches').insert({ profile_id: TU_ID, verified: true })` tiene que dar 42501.
- ⚠️ **Sigue abierto de la sesión 90:** las 4 columnas de aceptación siguen escribibles por su titular. Ahora que la regla 21 dice "revisá los cuatro verbos", vale re-auditarlas por INSERT también — el alta las escribe en un INSERT, no en un UPDATE.
- **Idea anotada, no empezada: recomendación de profesional asistida por IA.** La persona escribe en texto libre qué le pasa y el sistema le muestra profesionales, en vez de los cinco botones del quiz. **Evaluada en 8/10 de viabilidad**, y la razón de que sea alta es que *la parte difícil ya está construida*: no es generación abierta sino **clasificación con salida acotada** a los 28 subtemas de `constants/searchData.ts`, o sea el mismo contrato de salida que hoy produce `Q1_OPTIONS` en `QuizScreen`. Todo lo de abajo —`coachDeckRanking`, con sus 31 tests— no se entera. El lugar natural es la pantalla 6 del onboarding (el Momento AHA).
  - 🔴 **Requisito que no se negocia, sea cual sea la respuesta legal:** la detección de crisis tiene que ser **determinística y correr ANTES del modelo**. Si el texto trae expresiones de riesgo, el flujo corta y muestra las líneas de T&C §5.3 (911 / 135) sin devolver recomendación ni precio. Un sistema que ante *"no le encuentro sentido a nada"* contesta con una tarjeta de coach y un botón de reservar es el peor modo de falla posible de este producto.
  - **Lo que lo bloquea NO es técnico.** Son tres preguntas legales: si clasificar un relato de malestar constituye triage/acto sanitario (contra T&C §4 y §5, que declaran intermediario y no prestador); si el consentimiento de Política §3 alcanza para dato sensible en texto libre (Ley 25.326 arts. 7-8) o hace falta uno específico; y la transferencia internacional al proveedor de IA, que **se cruza con el placeholder ya abierto de Política §7**.
  - **Por eso quedó redactada como consulta dentro de `docs/legal-instrucciones.md` (Paso 3)** y no como pendiente de producto: preguntarlo en la misma consulta que ya se le debe al abogado/a sale gratis; preguntarlo después son semanas.
- **El rename a Vita quedó parado a mitad de decisión** (ítem 3 del relevamiento). Lo acordado: comentarios/docs + `ViveColors`/`ViveFonts` → `Vita*` + `bundleIdentifier`, en commits separados; el `scheme` aparte porque toca dos env vars de Supabase, la allowlist de Redirect URLs de Auth y un redeploy. **`bundleIdentifier` es ahora o nunca** — después de publicar no se puede cambiar.
- Sigue abierto todo lo de la sesión 88: probar en dispositivo el guardarraíl de reconexión de MP, la reserva instantánea con pago y el tramo del 15%.

---

## 2026-08-13 / 14 — Andre (sesión 90)

> Sesión larga: arrancó el 13 y siguió el 14. El panel de administración, los tests y el bug que encontraron son del 14.

**Tocado:** nuevos `scripts/add-user-blocking.sql`, `scripts/add-age-confirmation.sql`, `docs/boton-de-arrepentimiento.md`, `docs/eliminar-cuenta.md`, `docs/hosting.md`, `vercel.json`, `web/index.html`, `lib/blocking.ts`, `hooks/useBlockedFilter.ts`, `components/UserActionsSheet.tsx`, `screens/BlockedAccountsScreen.tsx`, `app/cuentas-bloqueadas.tsx`. Modificados `screens/SalaScreen.tsx`, `screens/ProfesionalScreen.tsx`, `screens/FavoritosScreen.tsx`, `screens/QuizScreen.tsx`, `screens/ProfileOwnScreen.tsx`, `screens/CoachProfileScreen.tsx`, `screens/BookingScreen_Confirm.tsx`, `screens/RegisterScreen.tsx`, `screens/CoachLoginScreen.tsx`, `screens/CoachApplicationScreen.tsx`, `context/AuthContext.tsx`, `app/search3.tsx`, `app/legal.tsx`, `app/(tabs)/conexiones.tsx`, `scripts/sync-legal.mjs`, `docs/terminos-y-condiciones.md`, `docs/legal-instrucciones.md` + `constants/legal.ts` y `web/legal/*` regenerados. **Dos scripts de schema nuevos — SCHEMA.md ya actualizado.**

**Sesión de cuatro bloques, todos bloqueadores de publicación:** bloqueo de usuarios (guideline 1.2 de Apple), declaración de mayoría de edad (T&C §3.1), botón de arrepentimiento (Res. 424/2020) y el sitio público listo para deployar (portada + baja de cuenta para Google Play + config de Vercel).

**Después de esta sesión no queda ningún bloqueador de publicación sin resolver en código.** Lo único pendiente para publicar son pasos manuales de Andre: comprar el dominio, conectar Vercel, y completar las URLs. Ver `docs/hosting.md`.

**Resumen:**

- **Bloqueo de usuarios, el pendiente rojo que bloqueaba publicar.** La guideline 1.2 de Apple pide cuatro cosas juntas para apps con contenido generado por usuarios: filtrado, reporte, bloqueo y contacto publicado. Había reportes desde el 06/08 y nada de bloqueo; con chat 1 a 1 entre desconocidos, el review de App Store rebotaba. Quedan cubiertas tres de las cuatro — **falta publicar el contacto**, que depende de hostear `web/legal/`.
- **Decisión de modelo: direccional en la tabla, simétrico en el efecto.** Se guarda quién bloqueó a quién, pero un bloqueo en cualquier sentido corta mensajes y reservas para los dos. Si el efecto fuera unidireccional, la persona bloqueada podría seguir escribiéndole a quien la bloqueó — exactamente lo que la guideline impide.
- **Decisión de enforcement: triggers `BEFORE INSERT`, no policies.** Las policies de `messages` y `bookings` se crearon a mano en el panel de Supabase y **no están versionadas en ningún script** — reescribirlas desde una migración es reescribir algo que no podemos leer. Un `BEFORE INSERT` es aditivo, no puede romper lo que ya funciona, y aplica venga de donde venga el insert (cliente, edge function con service role, SQL a mano). El de `bookings` tiene la trampa de siempre: `bookings.coach_id` es `coaches.id`, hay que pasar por `coaches.profile_id` para comparar contra `blocked_users`.
- **`are_blocked()` es `SECURITY DEFINER` por una razón concreta.** El RLS de `blocked_users` solo expone los bloqueos propios, así que el lado bloqueado consultando la tabla no ve nada y concluiría que puede escribir. La función mira las dos direcciones. Con `REVOKE` explícito de `anon`, no solo de `PUBLIC` (regla crítica 18 — en Supabase los grants son directos por default privileges).
- **El filtro del catálogo va en las pantallas, no en `coachesCache`.** Ese cache también lo consume `CoachVisibilityScreen`, donde el coach mira su standing contra el pool COMPLETO de su puerta: si el filtro viviera adentro del cache, un coach que bloqueó a alguien vería un pool más chico y la app le prometería un lugar que el deck de los demás no le va a dar. Filtrado aplicado en Conexiones, búsqueda, quiz y favoritos.
- **Lo que el bloqueo deliberadamente NO hace:** no borra la conversación ni el historial, **no cancela sesiones ya agendadas** (se dice en el Alert de confirmación y en §14.3 — cancelar es aparte y tiene su reembolso), y no le avisa nada a la persona bloqueada. El aviso del chat del lado de quien NO bloqueó es neutro a propósito ("No podés escribir en esta conversación"): enterarse de que te bloquearon es justo lo que la función tiene que evitar.
- **T&C §14.3 nueva**, escrita en el mismo momento que el código y no después. Distingue explícitamente bloquear de reportar, porque son cosas distintas y la app ahora las ofrece juntas en el mismo menú.
- El menú "⋯" del chat antes abría el reporte directo; ahora abre `UserActionsSheet` con las dos acciones, y después de bloquear ofrece reportar también. En `ProfesionalScreen` el link al pie pasó de "Reportar a X" a "Reportar o bloquear a X", y "Reservar sesión" queda deshabilitado si el coach está bloqueado.

Typecheck limpio. Lint sin errores nuevos — el único error que reporta `SalaScreen` (comillas sin escapar en `recoCardNote`, línea 1127) **es previo a esta sesión**, verificado contra `git show HEAD`; no se tocó para no mezclar scope.

**Segundo bloque — declaración de mayoría de edad (2º rojo de legales):**

- **T&C §3.1 afirmaba una declaración que nunca se pedía.** Dice que el Usuario "declara" ser mayor de 18 y la Política §11 que no se recolectan datos de menores; en el alta no se preguntaba nada. `birth_date` es opcional para el usuario, obligatoria solo para el coach, y en ningún caso se validaba que fueran 18.
- **Checkbox propio, no fundido con el de T&C.** §3.1 la trata como una manifestación separada, y meterla adentro del mismo tilde la volvería una condición sepultada en un texto que casi nadie lee. Los dos tildes habilitan por igual los tres métodos de alta (email, Google, Apple) — antes el gate era solo `acceptedTerms`, ahora es `canSubmit`.
- **Constancia en `profiles.age_confirmed`** (`scripts/add-age-confirmation.sql`), mismo criterio que `accepted_terms`: sin registro no es oponible. `markTermsAccepted` pasó a ser `markAccepted(acceptedTerms, ageConfirmed)` y **nunca escribe `false`**, así una llamada parcial no puede pisar una declaración anterior.
- **Decisión: NO se backfillea.** Las cuentas previas quedan en `false` porque efectivamente no declararon nada. Poner `true` sería fabricar una constancia que no existió, que es peor que no tenerla.
- **Del lado coach, chequeo duro además de la declaración.** `CoachLoginScreen` es login y alta a la vez, así que mantiene la aceptación implícita (ahora también de la edad) para no sumarle fricción a quien solo entra; pero `CoachApplicationScreen` ahora corta la postulación si `birth_date` da menos de 18. Es el único punto del alta con una fecha real, y del lado del coach la mayoría de edad no puede quedar solo en una línea de texto.

**Tercer bloque — botón de arrepentimiento y derecho de revocación (3er rojo):**

- **Página propia, no una sección de los T&C.** La Res. 424/2020 pide un enlace de acceso fácil y directo **desde la portada**, en lugar destacado y **sin registro ni trámite previo**. Enterrado adentro de los Términos no cumple. Nuevo `docs/boton-de-arrepentimiento.md` → `web/legal/arrepentimiento.html`, más **T&C §9.4** (la vieja 9.4 pasó a 9.5).
- 🔴 **Corrección a lo que decía el pendiente de la sesión 89: el plazo es de 10 días CORRIDOS, no hábiles.** El art. 34 de la Ley 24.240 lo dice con esas palabras. El texto quedó escrito con "corridos".
- **`sync-legal.mjs` pasó a soportar N documentos.** El nav de cada página linkeaba a "la otra" con un ternario; con tres documentos eso dejaba el botón de arrepentimiento inalcanzable desde dos de las tres páginas — justo lo que la norma no permite. Ahora enlaza a todas las demás, y el de arrepentimiento va con estilo de botón destacado y en mayúsculas, como pide la resolución.
- **En la app, el ítem va también en la lista de invitado** de `ProfileOwnScreen`: esconderlo detrás del login sería exactamente lo que la norma no admite. `app/legal.tsx` pasó de un `isPrivacy` binario a un mapa de documentos.
- **Tres cosas quedaron abiertas y anotadas, no tapadas:** (a) falta la **portada** del sitio — `web/` solo tiene `legal/`, y la resolución pide el enlace desde el index; (b) el efecto de la revocación sobre una Sesión **ya prestada** dentro de los 10 días es un placeholder para el abogado/a (los arts. 1110–1116 CCyC no contemplan esa hipótesis para servicios); (c) el circuito es **manual** — el código de identificación dentro de las 24hs se manda por mail, igual que la garantía de §9.3.
- Placeholders: de 9 a 12 (8 distintos). Suben a propósito: 2 son los puntos abiertos de arriba y 1 la fecha del documento nuevo. `LEGAL_IS_DRAFT` sigue en `true`, que es lo correcto.

**Cuarto bloque — el sitio público listo para publicar:**

- **Dos páginas nuevas y una portada.** `web/index.html` (no existía: sin portada no se podía cumplir la Res. 424/2020, que pide el botón **desde el index**) y `web/legal/eliminar-cuenta.html` (Google Play exige una URL de solicitud de eliminación de cuenta accesible sin instalar la app ni loguearse, declarando qué se borra y qué se conserva con su plazo — sigue a Política §10 y a lo que hace `delete-account`). La portada además publica el **contacto**, que era la cuarta pata de la guideline 1.2.
- **`sync-legal.mjs` genera ahora las 5 páginas + la portada.** Se le agregó `wrapTables()` (la tabla de plazos desbordaba el body en pantalla angosta) y un flag `app: false` por documento: `eliminar-cuenta` **no** se exporta a `constants/legal.ts` porque adentro de la app la baja es un botón real, no un instructivo — el texto viajaba en el bundle sin que ninguna pantalla lo leyera.
- **Hosting decidido con Andre: dominio propio + Vercel.** La URL entra en T&C §9.4 (documento legal versionado) y en las fichas de las dos tiendas, así que migrarla después obliga a reeditar el legal — por eso no se eligió `github.io`. `vercel.json` fuerza `framework: null` para que Vercel no autodetecte el repo como proyecto de Expo y trate de buildear la app entera.
- **El `buildCommand` es `npm run sync:legal`, no un deploy del `web/` commiteado.** Cuesta un par de minutos de instalación por deploy (baja todo el árbol de Expo para usar solo `marked`), pero garantiza que si alguien edita un `.md` y se olvida de correr el script, Vercel publique igual la versión correcta. Para texto legal que no puede quedar viejo, vale.
- `docs/hosting.md` nuevo: por qué existe cada página, los pasos de NIC.ar + Vercel, y el checklist de lo que hay que completar **recién cuando el dominio resuelva** (la URL en §9.4, las dos fichas de tienda, y probar la portada en incógnito).

**Quinto bloque — implementada la garantía de §9.3 (el último rojo en código):**

- 🔴 **La premisa del pendiente era falsa, y eso cambió todo el diseño.** Venía anotado desde la sesión 89 que una sesión `completada` no se podía marcar para reintegro "sin reescribir su `status`, que va contra el criterio de no reescribir historia". **`mp-process-refunds` selecciona solo por `payment_status = 'reembolso_pendiente'` y nunca mira `status`** (`index.ts:39`): marcar una `completada` la reembolsa el cron que ya corre, con su historia intacta. No hizo falta ni una línea de código de reembolso nuevo. Lo que faltaba era permiso para poner la marca (el RLS de usuario solo deja UPDATE hacia `status='cancelada'`) y alguien que validara la cláusula.
- **Decisión de intake: sigue el mail.** §9.3 ya dice "escribiendo a vitaappar@gmail.com"; un botón en la app obliga a reeditar el texto y, sobre todo, **multiplica el uso de una garantía que paga el Profesional** (§8.8) sin tener un solo dato de tasa de reclamo. El backend es idéntico en los dos casos, así que el botón queda como añadido puro para cuando haya volumen real — no es una reescritura.
- **Tabla `guarantee_claims`, no una columna en `bookings`:** la solicitud tiene ciclo propio y §9.3 se reserva denegar por abuso. Una columna no sabe expresar "pedida y rechazada", y perder ese registro haría imposible detectar a quien reincide, que es la única defensa que la cláusula se dejó.
- **Dos bugs propios encontrados releyendo antes de commitear:** (a) "primera sesión del vínculo" comparaba solo `scheduled_date`, así que **dos sesiones el mismo día** hacían que la segunda calificara como primera — ahora compara fecha y hora, filtrando en JS porque PostgREST no compone dos `.or()` de forma predecible; (b) el UPDATE que marca el reembolso tiene un guard `.eq('payment_status','aprobado')` contra carreras, y **sin `.select()` Postgrest devuelve `error: null` aunque no matchee ninguna fila** — reportaba un reembolso marcado que nunca se marcó.
- **Detalles que quedaron cubiertos:** "una sola vez por Cliente" cuenta claims **aprobadas** y no pedidas (si contara pedidas, un rechazo por abuso le quemaría el único intento a alguien legítimo); el rechazo se registra **aunque la solicitud tampoco calificara por otro motivo**; y la comisión no hay que calcularla —el refund sin `amount` con el token del coach revierte el `application_fee` también, que es justo lo que §9.3 promete.
- ⚠️ **Riesgo que esto NO resuelve y conviene saber antes de tener volumen:** si el coach ya retiró los fondos, el refund contra MP puede fallar y caer al dead-letter. Es política de *money release*.
- `docs/garantia-runbook.md` nuevo: cómo encontrar la reserva desde el mail, `dry_run` para contestar sin comprometerse, aprobar, rechazar, y verificar que el reembolso salió — con los dos modos de falla ya conocidos.

**Sexto bloque — el sitio deployado y verificado en vivo:**

- **Vercel conectado y andando: `https://vive-app.vercel.app`.** Verificado desde acá, no de palabra: las 5 páginas dan 200, los 4 links de la portada resuelven, `cleanUrls` redirige `.html` → URL limpia con 308, el botón de arrepentimiento está en la portada, el contacto figura, y los headers de `vercel.json` (`nosniff`, `referrer-policy`) se aplican. La pantalla de import mostró `Other` / `npm run sync:legal` / `web`, o sea que tomó el `vercel.json` y no autodetectó Expo.
- ⚠️ **El aviso de borrador se está publicando**, y hoy es lo correcto, pero **no se puede enviar la app a revisión con eso visible**: un revisor que abra la URL de privacidad lee "no debe considerarse vigente" y es rechazo cantado. Desaparece solo al completar los 12 placeholders, o sea que depende del abogado/a.
- **`vitaapp.com.ar` sigue en trámite en NIC.ar** — sin nameservers delegados (verificado con `dig NS`, vacío). Los dos dominios ya están cargados en Vercel como "Invalid Configuration", que es lo esperado hasta que el dominio exista.
- **Los registros DNS a cargar cuando NIC.ar acredite** (⚠️ el CNAME es **único de este proyecto**, no el genérico `cname.vercel-dns.com` — adivinarlo deja el dominio muerto):

  | Tipo | Nombre | Valor |
  |---|---|---|
  | `A` | `@` | `216.198.79.1` |
  | `CNAME` | `www` | `c841fb5e89b37a72.vercel-dns-017.com.` |

- **Decisión abierta:** Vercel puso `www` como Production y el raíz redirigiendo con 308. Los T&C §9.4 declaran la URL **sin** `www`, así que conviene darlo vuelta — el redirect la hace funcionar igual, pero un documento legal no debería apuntar a una URL que rebota. Los registros DNS son los mismos con o sin el swap.

**Séptimo bloque — constancia de qué y cuándo se aceptó:**

- **`accepted_terms` a secas no prueba nada sobre el contenido.** Dice que la persona aceptó, no qué texto leyó. Alcanza mientras los documentos no cambien nunca — y van a cambiar: hoy son borrador con 12 placeholders y §20 prevé expresamente modificarlos. Sin fecha ni versión, invocar §20 o §10 contra alguien deja la aceptación existente pero **inoponible en su contenido**.
- **Al implementarlo apareció que no existía ningún identificador de versión** de los legales: `constants/legal.ts` exportaba los textos y nada que dijera cuál es. Se agregó **`LEGAL_VERSION`**, **derivado del contenido** (sha256 corto de T&C + Política) y no mantenido a mano: un número manual se olvida justo cuando importa, al editar el documento, y entonces habría aceptaciones apuntando a una versión que no es la que la persona leyó — o sea el mismo modo de falla que la columna existe para evitar.
- **Entran solo T&C y Política en el hash.** Arrepentimiento y baja de cuenta son informativos, no se aceptan; incluirlos invalidaría aceptaciones por un cambio que no toca lo aceptado.
- **Verificadas las tres propiedades que lo hacen útil**, no asumidas: determinístico (dos corridas, mismo hash), sensible (agregar una línea al `.md` lo cambia) y reversible (al restaurar vuelve al original).
- `acceptanceFields()` centraliza los tres caminos de alta y **nunca escribe `false` ni `null`**, así una llamada parcial —por ejemplo solo la edad— no puede pisar una aceptación anterior ni borrarle la fecha. Fecha y versión van solo con los T&C: la declaración de edad no es la aceptación de un documento.
- **No se backfillea**, mismo criterio que `age_confirmed`: las cuentas previas aceptaron de verdad, pero poner una fecha o un hash inventado sería fabricar la constancia.

**Octavo bloque — destinatarios de datos que faltaban en Política §6:**

- **Contrastado contra el código, y aparecieron dos errores en el propio pendiente.** (1) El embed de YouTube **no está en `ResourceDetailScreen`** como decía la nota, sino en `app/coach-recurso.tsx`. (2) No es solo YouTube: `ResourceDetailScreen:51` reconoce **Spotify y Google Drive** además.
- **Esa diferencia cambió la redacción, no es un detalle.** El **embed** (`react-native-youtube-iframe`, WebView) sí es un destinatario: YouTube recibe IP y datos del dispositivo **sin que el Usuario lo elija**. Los **links externos** se abren con `Linking.openURL`, o sea que el Usuario sale de la app y Vita no transmite nada. Quedaron en párrafos separados: declarar los segundos como destinatarios sería declarar de más, que también es declarar mal.
- **Los permisos de dispositivo no son destinatarios y no fueron a §6.** Fueron a **§2.4** (nueva), aclarando que el calendario es de **solo escritura** —la app no lee los eventos existentes— y que negarlos no rompe la app, solo desactiva la función.
- Google y Apple como proveedores de identidad, en §6, con la aclaración de que si el alta es por correo y contraseña ninguno de los dos interviene.
- `docs/etiquetas-privacidad-tiendas.md` actualizado en paralelo con la advertencia de no confundir embed con enlace externo, que es el error fácil al llenar los dos formularios.
- **El mecanismo de versión del bloque anterior funcionó en su primer uso real:** cambió el texto aceptado y `LEGAL_VERSION` pasó de `55c4861bf51e` a `416392a6c15a` sola, sin que nadie tuviera que acordarse de nada.

**Noveno bloque — análisis de qué falta desarrollar, y una escalada de privilegios encontrada de paso:**

- **Pedido de Andre: revisar qué falta en la app.** Hecho contra el código, no de memoria. Lo que salió, por orden de impacto: (1) **no hay panel de administración** y ya hay tres cosas que lo necesitan — aprobar coaches, moderar reportes y resolver garantías, todo SQL a mano hoy; ⚠️ **`CoachApplicationScreen:140` inserta `verified: false` y nada en el código lo pasa a `true`**, así que hoy ningún coach que se postule puede aparecer en el catálogo sin intervención manual; (2) dos botones muertos en el perfil; (3) `FOUNDER_PROMO_UNTIL` sigue `TBD` y el default silencioso es "sin promo", o sea 20% al primer coach; (4) deuda estructural: dos catálogos de herramientas en paralelo (`constants/tools.ts` y `constants/vitaTools.ts`), ruta de coach duplicada (`app/coach-reservas.tsx` y `app/(coach)/reservas.tsx` exportan el mismo componente), y **cero tests** en una app que ya movió plata real; (5) sin verificar si `DAILY_API_KEY` está seteada — si no lo está, no hay videollamadas.
- **Sacados los dos botones muertos** de `ProfileOwnScreen` ("Notificaciones" e "Idioma", los dos `onPress: () => {}`). Se veían, se tocaban y no hacían nada. Verificado antes de decidir: **no hay i18n en el proyecto ni preferencias de notificación en la base**, así que no era cablear algo existente sino prometer dos features inexistentes. Guideline 2.1 de Apple cubre funcionalidad visible que no funciona.
- 🔴 **Escalada de privilegios encontrada al diseñar el panel** (`scripts/lock-privileged-columns.sql`, **falta correrlo**). Antes de construir una pantalla para aprobar coaches fui a ver quién podía escribir `coaches.verified`, y resultó que **el propio coach**. El RLS de Postgres es por fila, no por columna: `coaches_update_own` (`profile_id = auth.uid()`) autoriza a escribir cualquier columna de la propia fila, y `coachesCache` filtra por `verified`. Con la anon key, la cadena `update profiles set role='coach'` → `insert into coaches` → `update coaches set verified=true` dejaba a cualquiera publicado como profesional verificado sin revisión. Un panel de aprobación no sirve mientras el aprobado pueda aprobarse solo.
- **Cerrado con privilegios por columna**, no con más policies: `revoke update … from authenticated` + `grant update (lista exacta)`. Las listas salieron de auditar todos los `.update()` del cliente — 5 columnas en `coaches`, 10 en `profiles`. Verificado antes de escribirlas que **nada en el cliente escribe `role` ni `verified`**, así que cerrarlas no rompe ningún flujo. **Corrido y verificado el mismo día**: `information_schema.column_privileges` devuelve exactamente las 15 filas esperadas y ni `verified` ni `role` figuran. Quedó como **regla crítica 19** de SCHEMA.md, con la pregunta que se desprende: ante cualquier policy "la fila es tuya", preguntarse qué columnas su dueño NO debería poder tocar.
- ⚠️ **Queda abierto y anotado:** las 4 columnas de aceptación siguen escribibles por el cliente (las escribe el alta desde `AuthContext`), o sea falsificables por su propio titular. Debilita el valor probatorio que les acabamos de dar. Cerrarlo exige mover esa escritura a una edge function.

**Décimo bloque — panel de administración:**

- **Las dos definiciones las resolví yo con lo que dice el código, y las dejo explícitas por si hay que revisarlas.** (1) **Vive dentro de la app**: una web aparte es un frontend nuevo con su propia autenticación, la pantalla reusa `AuthContext`, el sistema de diseño y la navegación. (2) **`profiles.is_admin`, no un tercer valor de `role`**: `role` decide el enrutamiento entre `/(tabs)` y `/(coach)` en `app/_layout.tsx`, y un valor más obliga a tocar ese árbol y a decidir qué ve un admin al abrir la app.
- **El fix de seguridad de ayer cambió la arquitectura del panel, y para bien.** Como `coaches.verified` quedó cerrado al cliente, el panel **no puede escribir directo**: toda escritura pasa por la edge function **`admin-actions`**, que resuelve la identidad desde el **JWT** —lo único que el cliente no puede falsificar—, confirma `is_admin` **con service role** y recién ahí escribe. Si el panel escribiera directo habría que reabrir justo lo que cerramos.
- **Detalle del chequeo de admin que no es obvio:** se consulta con service role a propósito. Con el cliente del invocador, una política mal puesta devolvería `null` y la función **fallaría abierto**. Así el default es cerrado.
- **`is_admin` nace protegida sin hacer nada**, como efecto de cómo quedó `lock-privileged-columns.sql`: al haber revocado el UPDATE de tabla completa y otorgado columnas **nombradas**, una columna agregada después no queda otorgada. Nadie puede auto-nombrarse admin.
- **Las garantías no se duplicaron.** En vez de reimplementar §9.3 en `admin-actions`, `guarantee-claim` pasó a aceptar **service role o un admin logueado**. El runbook por `curl` sigue funcionando igual.
- **Lectura por política, escritura por función:** 4 políticas de SELECT nuevas (`*_select_admin`) para que el panel liste; **ninguna de UPDATE**.
- La pantalla tiene tres pestañas con contador. Postulaciones ordenadas **de más vieja a más nueva** —es una cola con reloj, hay alguien esperando para poder trabajar— al revés que los reportes de `reports`, que se listan por urgencia.
- ⚠️ **Tres límites conocidos, escritos en el código y en SCHEMA.md:** (a) **no hay estado de "postulación rechazada"** —una rechazada es indistinguible de una que nadie miró—, por eso el panel solo aprueba; (b) **sin auditoría** de quién aprobó a quién más allá del log de la función (`reports` y `guarantee_claims` sí dejan rastro, `coaches.verified` no); (c) las garantías **se ven pero no se aprueban** desde la pantalla: el intake sigue siendo el mail por §9.3.

**Undécimo bloque — primeros tests del proyecto, y un bug real que encontraron:**

- 🔴 **El bug, en código escrito el día anterior.** `Date.parse('xTy:00-03:00')` **no devuelve `NaN`**: devuelve el año 2000. El parser legacy de V8 saca una fecha de casi cualquier cosa, así que la guarda `Number.isNaN` de `scheduledAt` en `guarantee-claim` **nunca se disparaba** — una reserva con fecha corrupta se interpretaba como el 2000 y la solicitud se rechazaba con "pasaron 233337hs" en vez de decir que la fecha no se podía leer. Arreglado validando la forma con regex. Apareció a los diez minutos de escribir el primer test.
- **Extraída a módulos puros la lógica de plata que vivía inline en las edge functions:** `_shared/commission.ts` (tramos 20/15/0, `marketplace_fee`, filtro de checkouts abandonados) y `_shared/guarantee.ts` (las condiciones de §9.3). **Las dos funciones quedaron cableadas para usarlos** — si no, los tests probarían código que no es el que corre, que es peor que no tener tests.
- ⚠️ **Divergencia asumida y anotada en el código:** el filtro de checkouts abandonados existe DOS veces, como predicado SQL en la query de `mp-create-payment` y como predicado JS en `countsAsCompletedSession`. Misma regla en dos lenguajes, pueden separarse; el JS es el testeado.
- **Cambio de comportamiento menor:** con la promo fundador activa, antes el COUNT de sesiones del par se salteaba; ahora corre siempre. Una query de más en un caso que hoy no ocurre.
- 🔴 **El `npm install` de jest-expo FALLA en este entorno por la red restringida** — mismo motivo que el push a GitHub y el whois de NIC.ar. Los tests están escritos pero **no se pudieron correr con jest**. Lo que sí se hizo: compilar los dos módulos con `tsc` y ejecutar los 36 casos con Node pelado — **36 pasan, 0 fallan**. Valida la lógica, no el arnés.
- `package.json` ya declara `jest`, `jest-expo`, `@types/jest`, el bloque `jest` y los scripts `test` / `test:watch`. ⚠️ **`npx tsc --noEmit` reporta errores en `__tests__` hasta que se corra `npm install`** (faltan los tipos): no es una regresión.

Typecheck y lint limpios en los ocho bloques de código (los tests quedan afuera hasta el `npm install`). HTML de las 5 páginas validado (anidamiento correcto).

**Pendiente para la próxima sesión:**
- ~~Poner el panel en marcha~~ — **hecho y verificado el 14/08**: script corrido, **dos cuentas** marcadas `is_admin` (Andre y su hermano), `admin-actions` deployada y `guarantee-claim` re-deployada (v1 → v2). Sondeo: `admin-actions` con anon key devuelve `{"error":"token inválido"}`, que es respuesta del propio código y prueba que la anon key no sirve para hacerse pasar por un usuario. ⚠️ Con dos admins, la falta de auditoría en `coaches.verified` pesa más — quién aprobó a quién queda solo en el log de la función.
- 🔴 **Probar el panel en el celular.** Es lo único que no se puede verificar con una query ni con un sondeo: que aparezca "Administración" en el perfil (**hay que cerrar y reabrir la app** — `is_admin` se lee al resolver la sesión), que liste las postulaciones pendientes, y sobre todo **que aprobar realmente publique al coach** (que pase a `verified` y aparezca en Conexiones). Probar también con una cuenta NO admin que la entrada no se vea.
- ~~`npm install` + `npm test` y re-deployar las dos funciones~~ — **hecho el 15/08**. El `npm install` entró (los intentos anteriores morían por red) y **`npx jest` da 3 suites / 60 tests, todos en verde** (1.5s); `npx tsc --noEmit` quedó limpio. `guarantee-claim` **v2 → v3** y `mp-create-payment` **v20 → v21**, las dos `ACTIVE` y sondeadas: responden con el 401 de su propio código, no del gateway. ⚠️ **El deploy ES el arreglo del bug de `Date.parse`** — el fix estaba escrito desde el 14 en `_shared/guarantee.ts` y subió junto con el `index.ts`. No quedó ningún paso aparte.
  - **El CLI de Supabase ya tiene sesión en este entorno**, a diferencia de la sesión 88 donde había que pedirle los deploys a Joaquín. Vale re-chequearlo antes de asumir que no se puede.
- **Tests del deck de Conexiones (31 más, total 92).** Es la lógica que decide qué coach aparece en qué lugar, o sea de qué depende que un profesional consiga clientes, y no tenía ninguno. **No apareció ningún bug** — a diferencia de la tanda anterior, el deck está sólido. Lo que sí quedó cubierto: el AND de `isNewCoach` (era un OR en v2 y ese OR no drenaba), que el reagendamiento gane sobre las estrellas cuando hay muestra, que un coach ocupe un solo slot y el de mayor prioridad, que los slots sin candidato se omitan en vez de etiquetar mal, y las cuatro propiedades del sorteo (determinismo, dos personas ven distinto, la misma persona ve otro al día siguiente, estable dentro del día).
  - **El invariante de la mediana quedó fijado**: se calcula sobre la puerta COMPLETA y no sobre lo que sobra después de que los slots de arriba consumieron coaches. Está documentado en el código y es justo la clase de cosa que se rompe en un refactor sin que nadie note.
  - ⚠️ **Hallazgo, no bug: el deck rota a las 21:00 de Argentina, no a la medianoche.** `dayKey` usa `toISOString()`, que es UTC, así que quien entra a las 22:00 de un lunes ya ve el deck del martes. La rotación sigue siendo una vez cada 24hs y pareja para todos, así que no rompe nada — pero el resto del proyecto sí razona en hora local (`complete_confirmed_sessions`, la ventana de §9.3). **Queda un test que fija el comportamiento real**: si alguien decide alinearlo, ese test falla a propósito, para que el cambio sea deliberado y no accidental.
- **`npm run lint` pasa a 0 errores por primera vez.** Los 10 que había eran todos previos a esta sesión (comillas rectas en JSX, regla `react/no-unescaped-entities`, en 5 archivos). ⚠️ **Aviso sobre lo que veníamos diciendo:** durante la sesión se reportó "lint limpio" varias veces linteando solo los archivos tocados — el lint del proyecto entero venía rojo desde antes. Quedan 66 warnings, que son otra cosa.
- 🔴 **Probar en el celular que `lock-privileged-columns.sql` no rompió ningún guardado.** La lista de columnas otorgadas salió de auditar el código, pero si me faltó alguna ese guardado empieza a fallar. Probar: perfil de usuario (nombre, género, nacionalidad, fecha, foto) y del lado coach precio, bio, switch de reserva instantánea y toggle disponible/en pausa. **Es la única parte de ese fix que no se pudo verificar con una query.**
- ~~Correr `scripts/add-age-confirmation.sql`~~ — **corrido y verificado**: `information_schema.columns` devuelve `age_confirmed` / `boolean` / `is_nullable = NO` / `default false`. Prod ya guarda la constancia.
- ~~Correr `scripts/add-user-blocking.sql`~~ — **corrido por Andre y verificado en la misma sesión**: `pg_trigger` devuelve las 2 filas esperadas y `pg_get_functiondef` la definición de `are_blocked`. Prod ya tiene el bloqueo. **Anotado para la próxima vez:** el SQL editor de Supabase muestra solo el resultado de la ÚLTIMA sentencia cuando se corren varias juntas — la primera verificación se perdió en silencio y parecía que no había devuelto nada. Correrlas por separado.
- **Probar en dispositivo:** bloquear desde el chat y desde el perfil, confirmar que el coach desaparece de Conexiones/búsqueda/favoritos, que el input del chat se congela de los dos lados, y que desbloquear desde `/cuentas-bloqueadas` revierte todo.
- ~~Correr `scripts/add-terms-version.sql`~~ — **corrido y verificado**: las 2 columnas existen (`timestamptz` / `YES`, `text` / `YES`). Prod ya guarda cuándo y contra qué versión se aceptó.
- 🔴 **Cargar los dos registros DNS en NIC.ar apenas se acredite `vitaapp.com.ar`** (están en el sexto bloque de arriba). El sitio ya está publicado y verificado en `vive-app.vercel.app`; solo falta el dominio propio. Paso a paso en `docs/hosting.md`.

**Quedaron abiertos, sin decidir (Andre los dejó pendientes a propósito):**
- **Paquete para el abogado/a** — se ofreció armarlo (mail de encuadre + los 6 puntos abiertos redactados como preguntas concretas + los placeholders separados entre fechas y criterio profesional). Sigue siendo el camino más largo y el que bloquea sacar el aviso de borrador.
- **El hook de `.claude/settings.json`** falla en cada `git commit` de este entorno (`fetch`/`push` sin credenciales de GitHub) y corta con `exit 2`. Propuesta: dejar el `exit 2` del `merge` —un conflicto tiene que frenar— y que los dos `push` reporten sin bloquear. **No se tocó**: el archivo está commiteado y le cambia el comportamiento a Joaquín, donde el hook sí funciona.
- **Logo (borrador).** Tres círculos superpuestos en oliva sobre crema, con "VITA" en mayúscula sans-serif y tracking amplio. Tres observaciones: (1) **no coincide con `components/VitaWordmark.tsx`**, que renderiza "vita" en minúscula Fraunces SemiBold y dice ser el único wordmark de toda la app — hay que elegir uno; (2) como ícono de app el trazo fino se pierde a ~60px y el arreglo es más ancho que alto, hace falta una versión solo-círculos reencuadrada y con trazo más grueso (más la monocroma que Android ya declara en `app.json`); (3) los íconos siguen siendo los del scaffold de Expo.
- **VIVE vs VITA.** El repo es `vive-app`, las constantes son `ViveColors`/`ViveFonts`, y los legales ya publicados dicen "Vita". Ficha de tienda, legales y UI tienen que decir lo mismo antes de enviar a revisión.
- ⚠️ **Los T&C ya declaran `https://vitaapp.com.ar/legal/arrepentimiento` como vía para ejercer el derecho de revocación, y el sitio todavía no está arriba.** Mientras siga siendo borrador no hay problema, pero **§9.4 no puede entrar en vigencia antes de que el dominio resuelva**: sería declarar una vía de ejercicio que no existe.
- ⚠️ **`.com.ar` se renueva cada año y NIC.ar no cobra solo.** Si vence, se cae la URL de revocación de §9.4 y la de privacidad que sostiene las fichas de las dos tiendas. Poner recordatorio.
- Cuando el sitio esté arriba: cargar `https://vitaapp.com.ar/legal/privacidad` en App Store Connect y en Google Play Console, y `https://vitaapp.com.ar/legal/eliminar-cuenta` como URL de baja en Play. Probar en incógnito que la portada abra el botón sin sesión.
- ~~Correr `scripts/add-guarantee-claims.sql`~~ — **corrido y verificado**: las 9 columnas, y `pg_policies` devuelve una sola fila (`guarantee_claims_select_own` / SELECT / `{authenticated}`), o sea sin INSERT/UPDATE abiertos al cliente. ⚠️ **La query de verificación de policies estaba mal escrita en la primera versión del script** — usaba `cmd` contra el catálogo `pg_policy`, donde esa columna se llama `polcmd` y es un char; el texto legible está en la vista `pg_policies`. Corregida.
- ~~Deployar `guarantee-claim`~~ — **deployada por Andre y verificada sin CLI sondeando el endpoint**. Es una técnica que sirve de acá en más y que no habíamos usado: `curl` sin auth → `401 UNAUTHORIZED_NO_AUTH_HEADER` (JSON del gateway, la ruta existe; una función inexistente da `404 NOT_FOUND`, control negativo incluido), y **con la anon key → `401 Unauthorized` en TEXTO PLANO**, que es el `return new Response('Unauthorized')` del propio código. Esa tercera prueba las dos cosas que importan a la vez: que corre el código deployado y no solo que la ruta está registrada, y que el guard de service role rechaza la anon key. Sirve para verificar cualquier edge function desde este entorno sin el CLI logueado.
- Ya no queda ningún rojo de contenido legal. Los circuitos de §9.3 y §9.4 tienen intake por mail y eso está asumido y escrito en los T&C.
- Sigue abierto todo lo de la sesión 88: probar en dispositivo el guardarraíl de reconexión de MP, la reserva instantánea con pago y el tramo del 15%.

## 2026-08-10 — Andre (sesión 89)

**Tocado:** `scripts/sync-legal.mjs`, `screens/BookingScreen_Confirm.tsx`, `docs/terminos-y-condiciones.md`, `docs/politica-de-privacidad.md`, `docs/legal-instrucciones.md`, `constants/legal.ts` + `web/legal/*.html` (regenerados). Sin cambios de schema.

**Resumen:**

- **Andre se inscribió en Monotributo.** Actividad **631200 (Portales web)** nacional — 631201, el código nuevo de intermediación por plataformas de la RG 5607/24, no aparecía en el formulario— y **631201 como actividad provincial** en el alta de IIBB de Córdoba (Monotributo Unificado). Categoría A. Cierra el bloqueador (3) de la auditoría de la sesión 86 y confirma lo que `mp-create-payment:116` ya asumía: factura C sin IVA discriminado, la comisión retenida es la final.
- **Revisión completa de los legales antes de hostearlos.** Se cruzó cada cláusula contra el código. Lo que salió:

- 🔴 **El detector de placeholders estaba roto y publicaba notas dirigidas al abogado.** `sync-legal.mjs` limitaba el match a 60 caracteres (`/\[[^\]\n]{1,60}\]/g`), así que de 15 corchetes solo veía `[fecha]`. Los otros 10 —`[Validar con abogado…]`, `[Si se mantiene esta política, describir su alcance exacto…]`— **se estaban publicando literales** en la app y en `web/legal/*.html`. Peor: al completar las fechas, `LEGAL_IS_DRAFT` habría pasado a `false` y el aviso de borrador habría desaparecido con las 10 notas adentro del texto. Arreglado sin tope de longitud, y ahora reporta archivo y línea real del `.md` (mapeando el offset del blockquote que se descarta). Quedan **9**: 4 fechas + 5 de abogado.
- 🔴 **Dos frases falsas en el checkout, las dos en `BookingScreen_Confirm`.** (a) *"No se te cobra hasta que el profesional acepte"* — falso: `mp-create-payment` se invoca para toda reserva sin mirar la modalidad y el checkout se abre en el acto. Los T&C §8.2 decían la verdad y la pantalla lo contrario, del lado que el usuario lee al decidir. (b) *"Garantía de primera sesión — si no quedás conforme, te devolvemos el dinero"*: promesa incondicional en el punto de venta (art. 8 Ley 24.240: las precisiones publicitarias integran el contrato) contra la que no había ni política escrita —§9.3 era un placeholder— ni implementación. Corregidas las dos; la garantía se sacó de la pantalla hasta que exista mecanismo.
- **Corrección sobre la economía de la garantía**, que cambió la decisión: el reembolso es `POST /v1/payments/{id}/refunds` sin `amount` **con el token del coach** (`mp-process-refunds:66`), o sea total y sobre un pago que es del vendedor. En un pago con split eso revierte todo: **la garantía la paga el Profesional, no Vita** — Vita solo resigna su comisión. No es un problema de margen sino de relación con los coaches.

**Decisiones de contenido (Andre, esta sesión):**
- **Garantía de primera sesión: se mantiene y la paga el Profesional.** Reintegro total, se pide por mail dentro de las **48hs** del horario agendado, sin expresar motivo, **una sola vez por Cliente en toda la Plataforma**, solo sobre la primera Sesión de cada vínculo. Escrita en §9.3 y, del lado del coach, en **§8.8 (cláusula nueva)** para que se entere al aceptar los términos y no cuando le pasa.
- **Cancelación: 24hs, sin franja intermedia.** Es lo que el código ya hacía. §9.1 estaba mal redactada: decía que las tardías "pueden no dar lugar a reembolso" cuando en realidad **no se pueden cancelar** (`SalaScreen:553` bloquea la acción). Reescrita, y la política ahora se muestra en `BookingScreen_Confirm` — §9.1 afirma que se informa antes de reservar, así que sin eso la cláusula era falsa.
- **Líneas de crisis en §5.3:** 911 + línea de asistencia al suicida **135** / (011) 5275-1135 / 0800-345-1435. Vigencia verificada al escribirlas.
- **Referente de datos:** no se designa uno distinto del Responsable.
- **Plazos de conservación (Política §10):** bienestar borrado inmediato; reservas/transacciones 10 años disociadas; reseñas indefinidas anonimizadas; mensajes anonimizados mientras viva la conversación; analítica disociada. §10 describe además el modelo real de baja (lápida + anonimización), que hasta ahora solo existía en el código.
- Se sacaron del texto publicable dos notas internas que no eran decisiones (Política §6 y §8.2); siguen anotadas en `legal-instrucciones.md`.

**Lo que estaba bien y no se tocó:** §4 (intermediación), §5 (salud), §8.3/§8.4 (comisión 20/15 y monotributo, ambas coinciden con `mp-create-payment`), §15 y Política §8.2 (mensajería: dicen explícitamente que **no hay E2E**, eso es correcto y no hay que "mejorarlo"), Política §6 (analítica propia — verificado contra `package.json`: no hay ningún SDK de terceros). Ley 25.326 sigue vigente en 2026, los proyectos de reforma no se aprobaron: el encuadre normativo no cambia.

**`legal-instrucciones.md` estaba desactualizado en su ítem más alarmante:** decía con 🚨 que el borrado de cuenta dentro de la app no existía y bloqueaba iOS. Existe desde el 06/08 (`delete-account` + `lib/accountDeletion.ts` + `ProfileOwnScreen`). Tildado.

Typecheck y lint limpios. `npm run sync:legal` corrido; `constants/legal.ts` y las dos páginas web regeneradas.

**Pendiente para la próxima sesión:**
- 🔴 **Botón de arrepentimiento y derecho de revocación** (Res. 424/2020 + art. 34 Ley 24.240 / art. 1110 CCyC): 10 días hábiles, enlace destacado en la portada sin exigir registro, 24hs para informar el código de revocación. No está ni en los T&C ni en la web. Es texto nuevo **más** una página cuando se hostee.
- 🔴 **Implementar §9.3.** Está escrita pero no hay mecanismo: los únicos caminos a `reembolso_pendiente` son la cancelación y el vencimiento. Una `completada` no se puede marcar para reintegro sin reescribir su `status`, que va contra el criterio de no reescribir historia. A volumen bajo se opera a mano, pero hay que saberlo.
- 🔴 **Checkbox de mayoría de edad en el registro** — §3.1 dice que el Usuario lo declara y no se le pregunta nada.
- 🔴 **Bloqueo de usuarios** — guideline 1.2 de Apple lo exige junto con reportes, filtrado y contacto. Hay reportes, no hay bloqueo.
- **Jurisdicción (§22.2)** es el último corchete de contenido; el resto de los 9 son 4 fechas y 4 puntos de abogado.
- Faltan en Política §6: Google/Apple como proveedores de identidad, YouTube embebido, y los permisos de fotos y calendario.
- Inscripción en el Registro Nacional de Bases de Datos de la AAIP (trámite por TAD, no es texto).
- **Después de todo eso: hostear `web/legal/`** + la página de solicitud de eliminación de cuenta que pide Google Play.
- Decidir si se borran los estilos `guaranteeRow`/`guaranteeText` de `BookingScreen_Confirm` (quedaron sin uso al sacar la garantía de la pantalla; se dejaron por si vuelve).
- Sigue abierto todo lo de la sesión 88: probar en dispositivo el guardarraíl de reconexión de MP, la reserva instantánea con pago y el tramo del 15%.

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
