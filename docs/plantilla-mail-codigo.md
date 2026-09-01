# La plantilla de mail del código de verificación

> 31/08/2026. **Configuración que vive FUERA del repo**, en el panel de
> Supabase. Sin este cambio la verificación de mail no funciona: la pantalla
> pide un código de 6 dígitos que nunca llega.
>
> ✅ **APLICADO por Andre el 31/08/2026** — asunto y cuerpo cargados en la
> plantilla Magic Link. Falta probar que el mail llegue de verdad.

---

## El problema

`supabase.auth.signInWithOtp()` dispara la plantilla **Magic Link**, y la de
fábrica dice solamente:

```html
<h2>Magic Link</h2>
<p>Follow this link to login:</p>
<p><a href="{{ .ConfirmationURL }}">Log In</a></p>
```

O sea **un link y ningún código**. La persona recibe un enlace que abre el
navegador y no le sirve para nada, mientras la app espera seis dígitos.

La variable que hace falta es **`{{ .Token }}`**.

## Dónde se cambia

Panel de Supabase → **Authentication** → **Emails** (según la versión, *Email
Templates*) → pestaña **Magic Link**.

Se editan las dos cosas:

**Asunto:**

```
Tu código de Vita: {{ .Token }}
```

📝 El código va en el asunto a propósito: se ve en la notificación del teléfono
sin abrir el mail, que es la diferencia entre tipearlo de memoria y tener que
salir de la app, abrir el correo y volver.

**Cuerpo:** el HTML está en `docs/plantilla-mail-codigo.html`.

## Dos ajustes más, en la misma sección

- **Cuánto dura el código** — Authentication → Providers → Email → *Email OTP
  Expiration*. Por defecto **3600s (1 hora)**. La pantalla dice "el código no
  coincide o ya venció", así que el número tiene que ser razonable: una hora
  está bien, menos de diez minutos es hostil.
- ⚠️ **Intervalo mínimo entre mails al mismo usuario** — *Minimum interval per
  user*, 60s por defecto. **La cuenta regresiva de "Reenviar código" en la app
  está atada a este número** (`ESPERA_REENVIO` en `screens/VerificarMailScreen.tsx`).
  Si se cambia acá, hay que cambiarlo allá: con la cuenta regresiva más corta
  que el intervalo, el botón se habilita antes de que el servidor acepte y el
  reenvío falla sin que la persona entienda por qué.
- ⚠️ **Cuántos mails por hora** — Authentication → Rate Limits. El SMTP interno
  de Supabase viene con un límite **muy bajo** (del orden de unos pocos mails
  por hora en todo el proyecto). **Alcanza para probar de a poco y NO alcanza
  para producción**: con dos coaches registrándose el mismo día, el segundo no
  recibe nada y no hay forma de que se entere. Antes de abrir el registro de
  verdad hay que conectar un SMTP propio. Ver abajo.

## SMTP propio (para producción, no para probar)

⚠️ **No hace falta para probar la verificación**: el SMTP interno manda el
código igual. Esto es para cuando se abra el registro de verdad.

El remitente **tiene que ser un dominio propio y verificado por DNS** — no se
puede poner un Gmail. Vita ya tiene **`vitaapp.com.ar`** (ver `docs/hosting.md`),
así que el remitente sería algo como `no-responder@vitaapp.com.ar`.

Con **Resend**, que es el más simple de los tres:

| Campo | Valor |
|---|---|
| Sender email address | `no-responder@vitaapp.com.ar` |
| Sender name | `Vita` |
| Host | `smtp.resend.com` |
| Port number | `465` |
| Minimum interval per user | `60` (dejarlo como está, ver arriba) |
| Username | `resend` — literalmente esa palabra, no un mail |
| Password | la API key de Resend (empieza con `re_`) |

Los pasos, en orden: crear la cuenta en Resend → agregar `vitaapp.com.ar` como
dominio → cargar en DonWeb los registros DNS que Resend indique (SPF y DKIM) →
esperar a que Resend lo marque verificado → recién ahí generar la API key y
completar esta pantalla.

🔴 **Sin los registros DNS el dominio no verifica y los mails no salen** (o
salen y caen en spam, que es peor porque parece que funcionó). Y ojo con el
plazo: la delegación de `vitaapp.com.ar` a Vercel ya está hecha, pero cualquier
cambio de DNS en un `.com.ar` puede tardar.

## Cómo probar que quedó bien

1. Crear una cuenta de coach con un mail al que tengas acceso.
2. Que llegue un mail **con seis dígitos visibles**, no un botón de login.
3. Tipear el código en la app → tiene que pasar a la postulación.
4. Tipear un código cualquiera → tiene que decir que no coincide.
5. Esperar los 45 segundos y probar "Reenviar código".

Si llega un mail con un botón y sin números, la plantilla no se guardó.
