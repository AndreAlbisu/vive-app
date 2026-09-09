# Runbook — Anti-abuso del alta de cuentas (CAPTCHA + rate limits)

> ⚠️ **Todavía NO está prendido.** El código del cliente está en `main` desde el
> 09/09/2026; los dos ajustes de Supabase de abajo son manuales y quedan
> pendientes. Hasta que se hagan, no hay ningún portero.
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

Cubre `signup`, `token` (login con contraseña), `recover` y `otp`. Los cuatro
call sites del cliente ya mandan token:

| Llamada | Archivo |
| --- | --- |
| `signUp` | `context/AuthContext.tsx` |
| `signInWithPassword` | `context/AuthContext.tsx` |
| `resetPasswordForEmail` | `context/AuthContext.tsx` |
| `signInWithOtp` (reenvío del código) | `screens/VerificarMailScreen.tsx` |

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

Lo mismo por Management API si se prefiere versionarlo. Los tres campos
existen en `PATCH /v1/projects/{ref}/config/auth`, pero el mapeo campo →
grupo de endpoints no está documentado con precisión: **verificar contra el
dashboard después de correrlo**, que es la fuente de verdad.

```bash
curl -X PATCH 'https://api.supabase.com/v1/projects/ggygiihhnkjrerpinhha/config/auth' \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"rate_limit_verify":10,"rate_limit_otp":6,"rate_limit_anonymous_users":0}'
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
