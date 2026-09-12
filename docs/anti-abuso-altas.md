# Runbook — Anti-abuso del alta de cuentas (CAPTCHA + rate limits)

> ✅ **CAPTCHA PRENDIDO el 11/09/2026** (Secret Key cargada por Andre en el
> dashboard), con el build 20 ya en TestFlight (desde `6dc135e8`, con todos los
> arreglos del 10/09). Verificado sin token contra `/auth/v1/token` (login) y
> `/auth/v1/otp` (lo que usa la web): **`400 captcha_failed — no captcha_token
> found`**. Se probó con llamadas sin efectos, no con el `curl` de alta de A.4:
> si el CAPTCHA no hubiera quedado prendido, ese creaba una cuenta basura y
> mandaba un mail a un dominio inexistente.
>
> ✅ **Proveedor confirmado: `turnstile`** (11/09/2026). Lo probó el checkout
> web con el CAPTCHA prendido: `/c/coach-prueba?probar=1` → "Enviarme el código"
> → **llegó el código y la reserva se creó**. Ese pedido lleva un token de
> Turnstile; si el proveedor hubiera quedado en `hcaptcha` (como estaba el
> 10/09), Supabase lo habría rechazado. Queda probado de paso que
> `web/captcha.js` funciona en un navegador real.
>
> 🔴 **Si algo se rompe, se apaga en el dashboard y vuelve todo al instante.**
>
> ✅ **Rate limits (paso B) APLICADOS el 10/09/2026** vía Management API:
> `rate_limit_verify=10`, `rate_limit_otp=6`, y anónimos **deshabilitados**
> (`external_anonymous_users_enabled=false`). Ver la nota en B: la API no acepta
> `rate_limit_anonymous_users=0` (mínimo 1), así que se apagó la feature entera,
> que es más fuerte y coincide con la intención.
>
> ✅ **El cliente sí está terminado y PROBADO EN DISPOSITIVO** (09/09/2026, iOS,
> con la site key real): el widget se monta y devuelve un token de 709 chars sin
> mostrarle nada a la persona. Eso confirma de paso que el hostname del widget
> está bien configurado — un dominio mal puesto daría `110200`, y las claves de
> prueba no lo ejercitan.
> `<PROJECT>` en las URLs es `ggygiihhnkjrerpinhha`.

## Qué problema resuelve, y cuál no

Cualquiera puede hoy crear cientos de cuentas con direcciones inventadas
pegándole directo a `POST /auth/v1/signup`. La verificación de mail
(`lib/emailVerificado.ts`, `screens/VerificarMailScreen.tsx`) **no lo frena**, y
no fue construida para eso: cuando la pantalla del código aparece, `signUp` ya
creó la fila en `auth.users` y la de `profiles` que cuelga del trigger. Además,
un script no abre la app — ninguna pantalla nuestra corre en su camino.

El portero es el CAPTCHA que valida **Supabase**, del lado del servidor, antes
de crear nada. Los rate limits son la segunda línea: acotan el daño de un
atacante que igual consiga tokens, y cubren los endpoints que el CAPTCHA no.

Fuera de alcance acá: obligar a verificar el mail a todo el mundo (prender
"Confirm email" del proyecto). Eso es otra decisión, la de la sesión 147, y
sigue en pie sin cambios.

## 🔴 El orden importa: cliente PRIMERO, dashboard DESPUÉS

Prender el CAPTCHA en el dashboard **rompe todas las builds que no mandan
token**, incluidas las que ya están instaladas en TestFlight. No podrían ni
registrarse ni **entrar**. La secuencia obligatoria es:

1. Crear el widget en Turnstile (abajo).
2. Cargar `EXPO_PUBLIC_TURNSTILE_SITE_KEY` en `.env` y en EAS.
3. Buildear y distribuir. Confirmar que la gente está en esa build.
4. Recién ahí prender el CAPTCHA en el dashboard.

Los rate limits (paso B) no tienen este problema: se pueden tocar cuando sea.

## A. CAPTCHA

### A.0 Por qué Turnstile y no hCaptcha

Supabase acepta los dos. Se evaluaron ambos el 09/09/2026:

- **hCaptcha** cobra el modo de baja fricción ("99.9% Passive") dentro de Pro,
  **US$139/mes o US$99/año**. En el tier gratis el desafío visible aparece
  seguido — que es exactamente la fricción en el alta que la sesión 147 decidió
  no poner. El tier gratis protege igual; lo que compra Pro es fricción baja,
  no seguridad.
- **Turnstile** es gratis, sin límite de requests, y no interactivo **por
  diseño** en vez de por upgrade.

Del lado de Supabase el campo es el mismo `captchaToken` para los dos, y del
lado del cliente todo lo específico del proveedor vive en `lib/captcha.ts`.
Volver a hCaptcha sería cambiar ese archivo y la rama de web de
`components/CaptchaHost.tsx`; los cuatro call sites no se enteran.

### A.1 El widget en Cloudflare

Panel de Cloudflare → **Turnstile** → **Add widget**.

- **Hostnames:** `vitaapp.com.ar`.
  🔴 Un WebView de app nativa no tiene dominio propio:
  `components/CaptchaHost.tsx` le declara `baseUrl: CAPTCHA_ORIGEN`
  (`lib/captcha.ts`), y ese es el hostname que Cloudflare va a ver. Si cambia
  el dominio, se cambia esa constante **y** esta lista.
- **Widget mode: Managed.** Es el que deja que Cloudflare decida, y el que
  aprovecha `appearance: 'interaction-only'`. *Invisible* no hace falta: el
  código ya pide que no se vea salvo que haga falta interactuar. *Non-Interactive*
  nunca desafía, o sea que quien pase el score entra sin segunda barrera.
- De ahí salen dos claves: la **Site Key** (pública, va en la app) y la
  **Secret Key** (va en Supabase, **NO** en la app). Las dos están en la misma
  pantalla del widget, a diferencia de hCaptcha.

### A.1.bis Probar el circuito ANTES de tener claves reales

Cloudflare publica claves de prueba. Las tres que sirven acá:

| Site key | Qué hace |
| --- | --- |
| `1x00000000000000000000BB` | pasa siempre, invisible — **el camino normal** |
| `3x00000000000000000000FF` | fuerza el desafío interactivo — **el camino del Modal** |
| `2x00000000000000000000AB` | falla siempre — el camino de error |

Secret de prueba (si se quiere probar la punta del server):
`1x0000000000000000000000000000000AA`.

Con la site key de prueba en `.env` y la app en Expo Go se comprueba que el
widget se monta y que el alta sigue funcionando — que es lo único que no se
pudo ejercitar cuando se escribió el código, porque sin clave el host no se
monta. **`3x...FF` es la única forma de ejercitar el `Modal`**, que en
producción casi nunca se va a abrir y es por eso el camino más frágil.

⚠️ **Solo en `.env` local.** No dan ninguna protección: si llegan a un build de
EAS, el portero es de utilería.

⚠️ **Lo que las claves de prueba NO prueban: el hostname.** Andan en cualquier
dominio a propósito, así que el `baseUrl` del WebView contra la lista de
Cloudflare recién se ejercita con la clave real. Es el punto más probable de
falla en la primera prueba de verdad.

### A.2 La app

```bash
# local
echo 'EXPO_PUBLIC_TURNSTILE_SITE_KEY=<site key>' >> .env

# EAS — .env no viaja al servidor de build (mismo motivo que las de Supabase).
# Los TRES entornos: cuando el CAPTCHA esté prendido en el server, cualquier
# build sin la clave queda sin poder registrarse NI entrar, dev builds incluidos.
eas env:set --name EXPO_PUBLIC_TURNSTILE_SITE_KEY --value <site key> \
  --visibility plaintext \
  --environment production --environment preview --environment development
```

Sin esa variable el widget no se monta y las llamadas de auth salen sin token,
igual que hoy. Es a propósito: ver el comentario de cabecera de
`lib/captcha.ts`.

### A.3 Supabase

Dashboard → **Settings → Authentication → Bot and Abuse Protection** →
*Enable CAPTCHA protection*, proveedor **Turnstile**, pegar la **Secret Key**.

> ✅ **Prendido el 11/09/2026** (ver arriba). ⚠️ Nota original de Joaquín, que
> sigue valiendo para confirmar el proveedor: **al 10/09/2026 el provider en la
> config había quedado en `hcaptcha` (viejo) y `security_captcha_enabled=false`.** Prenderlo hay que cambiar las tres cosas:
> `security_captcha_enabled=true`, `security_captcha_provider=turnstile`,
> `security_captcha_secret=<SECRET KEY>`.
>
> Alternativa sin dashboard, por Management API (una sola llamada), cuando tengas
> la Secret Key **y** confirmes que la build distribuida lleva la site key:
> ```bash
> curl -X PATCH 'https://api.supabase.com/v1/projects/ggygiihhnkjrerpinhha/config/auth' \
>   -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H 'Content-Type: application/json' \
>   -d '{"security_captcha_enabled":true,"security_captcha_provider":"turnstile","security_captcha_secret":"<SECRET KEY>"}'
> ```
> Después correr el `curl` de A.4 — tiene que dar **400**.

Cubre `signup`, `token` (login con contraseña), `recover` y `otp`. Los cuatro
call sites del cliente ya mandan token:

| Llamada | Archivo |
| --- | --- |
| `signUp` | `context/AuthContext.tsx` |
| `signInWithPassword` | `context/AuthContext.tsx` |
| `resetPasswordForEmail` | `context/AuthContext.tsx` |
| `signInWithOtp` (reenvío del código) | `screens/VerificarMailScreen.tsx` |
| `POST /auth/v1/otp` (checkout del link) | `web/c/index.html` |
| `POST /auth/v1/otp` (sala desde la compu) | `web/sala/index.html` |

🔴 **Las dos de la web se agregaron el 10/09/2026, antes de prender nada.** Le
pegan a `/auth/v1/otp` con un `fetch` directo, sin `supabase-js`, y el CAPTCHA
cubre el endpoint para todo el mundo, no solo para la app: sin token, **nadie
habría podido entrar por la web**. Mandan `gotrue_meta_security.captcha_token`,
que es el campo que `supabase-js` arma por dentro, y el token sale de
`web/captcha.js` — la contraparte web de `CaptchaHost`, con las mismas reglas
(invisible, un token por envío, falla abierto).

⚠️ **Por eso el orden de encendido tiene un paso más**: la web tiene que estar
DEPLOYADA en Vercel con `web/captcha.js` antes de prender el CAPTCHA, igual que
la app tiene que estar en el build nuevo. Comprobarlo: abrir
`https://vitaapp.com.ar/captcha.js` — tiene que devolver el script, no un 404.

⚠️ En una **preview de Vercel** (`*.vercel.app`) el widget falla porque ese
hostname no está en la lista de Cloudflare, y el pedido sale sin token. Con el
CAPTCHA prendido, el pedido de código no se puede probar en previews.

📌 **Toda llamada nueva que pida código, cree cuenta o inicie sesión con mail
tiene que mandar token.** En la app, con `pedirCaptchaToken()` de
`lib/captcha.ts`; en la web, con `window.pedirCaptchaToken()` de
`web/captcha.js`. Si no, anda en desarrollo (CAPTCHA apagado) y se rompe en
producción. `grep -rn "auth/v1/otp\|signInWithOtp\|signUp\|signInWithPassword\|resetPasswordForEmail"` es el chequeo.

📌 `scripts/test-supabase.mjs` hace `signInWithPassword` sin token: con el
CAPTCHA prendido ese script de prueba deja de andar. Es esperable.

Google y Apple **no** pasan por acá: `signInWithOAuth` y `signInWithIdToken` no
llevan `captchaToken` y Supabase no se los pide. Quien entra con un botón no ve
nada nuevo.

### A.4 Probar

En el orden en que se rompen las cosas:

1. Con la app en la build nueva: registrarse con mail. Tiene que funcionar sin
   que aparezca nada.
2. Entrar con Google y con Apple. Tienen que seguir igual.
3. Recuperar contraseña, y reenviar el código en `verificar-mail`.
4. Desde una terminal, sin token — **esto tiene que fallar**:

```bash
source .env && curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST 'https://ggygiihhnkjrerpinhha.supabase.co/auth/v1/signup' \
  -H "apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY" -H 'Content-Type: application/json' \
  -d '{"email":"prueba-abuso@example.com","password":"unaClaveLarga123"}'
```

Esperado: **400** con `captcha protection: request disallowed`. Si devuelve
200, el CAPTCHA no quedó prendido y no hay portero.

### A.5 La trampa del WebView, para que no muerda de nuevo

Turnstile dibuja su desafío en un **iframe con `srcdoc`**. El `originWhitelist`
por defecto de `react-native-webview` es solo `http://*` y `https://*`, así que
`about:srcdoc` queda afuera y RN se lo pasa al sistema para abrirlo como link
externo. El iframe nunca carga.

El síntoma **no dice nada de esto**: Turnstile contesta `300031`, su error
genérico de "desafío fallado / bot detectado". Los dos indicios reales son la
línea `Unable to open URL: about:srcdoc` en la consola, y que el alta tarde ~20
segundos antes de seguir sin token.

Está resuelto en `components/CaptchaHost.tsx` con `originWhitelist={['*']}` y un
`onShouldStartLoadWithRequest` que vuelve a cerrar la lista a mano. **Si alguna
vez se toca ese WebView, esas dos props no son decorativas.**

### A.6 El desafío visible, y por qué no hay un `<Modal>`

Encontrado en el build 18 de TestFlight (10/09/2026), la primera vez que
Turnstile decidió mostrar un desafío: la pantalla se oscurecía, no aparecía
nada y **no se podía tocar nada** hasta cerrar la app.

`CaptchaHost` alternaba entre `<Modal>{webview}</Modal>` y `<View>{webview}</View>`.
Cuando cambia el tipo del padre, **React desmonta el hijo y monta uno nuevo**:
el WebView del desafío era otro, cargaba el widget de cero sin `execute()` y no
mostraba nada, mientras el Modal tapaba la pantalla. El timeout de 60s resolvía
el pedido pero no cerraba el Modal.

Ahora es un solo `View` que cambia de estilo (escondido ↔ capa encima de todo),
con un botón "Cancelar", y el timeout cierra el desafío. **Si alguna vez se toca
ese render: el WebView no puede cambiar de padre.** Es el camino que ejercita la
clave de prueba `3x00000000000000000000FF` — usarla antes de mandar un build.

## B. Rate limits

Dashboard → **Authentication → Rate Limits**. Los defaults de Supabase son
30 requests por 5 minutos por IP en `signup` / `token` / `recover` / `otp` /
`magiclink` / `resend` / `user`. Son 360 altas por hora por IP: para lo que
esperamos, holgadísimo.

Propuesta, a bajar y observar (no hay tráfico real todavía; conviene arrancar
apretado y aflojar si molesta, no al revés):

| Endpoint | Default | Propuesto |
| --- | --- | --- |
| Sign ups / sign ins (`/signup`, `/token`) | 30 / 5 min | **10 / 5 min** |
| Password recovery + OTP (`/recover`, `/otp`, `/magiclink`, `/resend`) | 30 / 5 min | **6 / 5 min** |
| Anonymous sign-ins | 30 / hora | **0** — la app no los usa desde la sesión 152 |

Lo mismo por Management API si se prefiere versionarlo. Los campos
existen en `PATCH /v1/projects/{ref}/config/auth`, pero el mapeo campo →
grupo de endpoints no está documentado con precisión: **verificar contra el
dashboard después de correrlo**, que es la fuente de verdad.

✅ **APLICADO el 10/09/2026** (Management API, token del CLI en el keychain —
ver `[[reference_supabase_run_sql_deploy]]`). Quedó `rate_limit_verify=10`,
`rate_limit_otp=6`, `external_anonymous_users_enabled=false`.

🔴 **Corrección al plan original:** la API **rechaza `rate_limit_anonymous_users=0`**
con `Too small: expected number to be >=1`. El "0 anónimos" del cuadro se logra
apagando la feature (`external_anonymous_users_enabled:false`), no bajando su
rate limit — y es más fuerte: no hay ningún alta anónima, no una limitada.

```bash
# verify + otp (esto sí toma los números tal cual)
curl -X PATCH 'https://api.supabase.com/v1/projects/ggygiihhnkjrerpinhha/config/auth' \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"rate_limit_verify":10,"rate_limit_otp":6}'

# anónimos: apagar la feature, NO poner el rate en 0 (la API lo rechaza)
curl -X PATCH 'https://api.supabase.com/v1/projects/ggygiihhnkjrerpinhha/config/auth' \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"external_anonymous_users_enabled":false}'
```

⚠️ **El límite por IP no es por persona.** Una oficina, una facultad o una red
móvil con NAT salen todos por la misma IP. Si aparecen reportes de "no me deja
registrarme" en grupo, es esto y no un bug: subir el número.

📝 El límite de 2 mails/hora del proveedor integrado de Supabase **no aplica**:
el proyecto usa SMTP propio (decidido en la sesión 150). Los envíos los limita
el proveedor de correo, no Supabase.

## Lo que sigue abierto

- El gate de verificación del alta de coach vive en `AsyncStorage`
  (`lib/altaCoach.ts`), o sea en el teléfono: borrar los datos de la app lo
  saltea. Debería colgar de una columna del servidor.
- `necesitaVerificarMail()` falla abierto ante un error de lectura. Estaba bien
  defendido cuando la columna podía no existir; hoy ya existe, así que el
  fallback se puede estrechar.
