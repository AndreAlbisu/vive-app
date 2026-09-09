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

1. Crear la site key en hCaptcha (abajo).
2. Cargar `EXPO_PUBLIC_HCAPTCHA_SITE_KEY` en `.env` y en EAS.
3. Buildear y distribuir. Confirmar que la gente está en esa build.
4. Recién ahí prender el CAPTCHA en el dashboard.

Los rate limits (paso B) no tienen este problema: se pueden tocar cuando sea.

## A. CAPTCHA

### A.1 hCaptcha

Cuenta en https://dashboard.hcaptcha.com → **New site**.

- **Hostnames:** agregar `vitaapp.com.ar`.
- **Verify origin / hostname verification: APAGADO.** Un WebView de app nativa
  no tiene dominio propio; `components/CaptchaHost.tsx` le declara
  `baseUrl: 'https://vitaapp.com.ar'` (la constante `CAPTCHA_ORIGEN` de
  `lib/captcha.ts`), pero con la verificación prendida esto es frágil entre
  iOS y Android. Si se cambia el dominio, se cambia esa constante.
- De ahí salen dos claves: la **sitekey** (pública, va en la app) y el
  **secret** (va en Supabase, NO en la app).

### A.2 La app

```bash
# local
echo 'EXPO_PUBLIC_HCAPTCHA_SITE_KEY=<sitekey>' >> .env

# EAS — .env no viaja al servidor de build (mismo motivo que las de Supabase)
eas env:set EXPO_PUBLIC_HCAPTCHA_SITE_KEY --value <sitekey> --environment production
```

Sin esa variable el widget no se monta y las llamadas de auth salen sin token,
igual que hoy. Es a propósito: ver el comentario de cabecera de
`lib/captcha.ts`.

### A.3 Supabase

Dashboard → **Settings → Authentication → Bot and Abuse Protection** →
*Enable CAPTCHA protection*, proveedor **hCaptcha**, pegar el **secret**.

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
curl -i -X POST 'https://ggygiihhnkjrerpinhha.supabase.co/auth/v1/signup' \
  -H "apikey: $ANON_KEY" -H 'Content-Type: application/json' \
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
