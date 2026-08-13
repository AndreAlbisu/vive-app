# Hosting del sitio público (`web/`)

El sitio son 5 archivos HTML estáticos, sin JavaScript ni dependencias en tiempo
de ejecución. Existe por tres obligaciones concretas, no por marketing:

| Página | Por qué existe |
|---|---|
| `index.html` | **Res. 424/2020**: el "BOTÓN DE ARREPENTIMIENTO" tiene que estar en la **portada**, destacado y sin registro previo. Además publica el **contacto**, que es la cuarta pata de la **guideline 1.2 de Apple** (junto con filtrado, reporte y bloqueo) |
| `legal/arrepentimiento.html` | El botón en sí (art. 34 Ley 24.240, arts. 1110-1116 CCyC) |
| `legal/terminos.html` | Exigida por App Store Connect y Google Play |
| `legal/privacidad.html` | Ídem — sin URL pública de privacidad no se puede publicar la app |
| `legal/eliminar-cuenta.html` | **Google Play** exige una URL de solicitud de eliminación de cuenta, accesible sin instalar la app ni iniciar sesión |

## Nada se edita a mano

Las 5 páginas las genera `npm run sync:legal` desde `docs/*.md`. **Editar el HTML
directamente no sirve**: la próxima corrida lo pisa. La fuente de verdad es el
`.md`, siempre — es lo que garantiza que el texto publicado y el que muestra la
app no puedan divergir.

Por eso el `buildCommand` de Vercel es `npm run sync:legal` y no un deploy del
directorio ya commiteado: si alguien edita un `.md` y se olvida de correr el
script, Vercel lo corre igual y publica la versión correcta. El costo es que la
instalación baja todo el árbol de dependencias de Expo para usar solo `marked`
—un par de minutos por deploy— y para texto legal que no puede quedar viejo vale
la pena.

## Puesta en marcha (una sola vez)

### 1. Dominio

Comprar en [NIC.ar](https://nic.ar) (`.com.ar` requiere CUIT/CUIL argentino, que
ya está: 20-46034087-0). Alternativa internacional: Namecheap, Cloudflare.

### 2. Vercel

1. Entrar a [vercel.com](https://vercel.com) con la cuenta de GitHub.
2. **Add New → Project** → importar `AndreAlbisu/vive-app`.
3. Vercel va a autodetectar el repo como proyecto de Expo. **No dejarlo**: el
   `vercel.json` del repo ya fuerza `framework: null`, `buildCommand:
   npm run sync:legal` y `outputDirectory: web`. Verificar que la pantalla de
   configuración muestre eso antes de deployar.
4. Deploy. Queda en `<algo>.vercel.app`.

### 3. Dominio en Vercel

**Project → Settings → Domains** → agregar el dominio. Vercel indica qué
registros cargar en el panel de NIC.ar (normalmente un `A` a su IP y un `CNAME`
para `www`). La propagación tarda hasta 24hs; el certificado TLS lo emite Vercel
solo.

### 4. Completar lo que depende de la URL

Recién cuando el dominio resuelva:

- [ ] **T&C §9.4** — reemplazar `[URL del botón de arrepentimiento — completar al publicar el sitio]` por la URL real y correr `npm run sync:legal`. Con `cleanUrls` activo la URL canónica va **sin** `.html` (`…/legal/arrepentimiento`); los enlaces internos sí llevan `.html` a propósito, para que el sitio se pueda abrir desde el disco antes de deployar, y Vercel los redirige.
- [ ] **App Store Connect** — URL de la política de privacidad.
- [ ] **Google Play Console** — URL de la política de privacidad **y** URL de solicitud de eliminación de cuenta (`/legal/eliminar-cuenta`).
- [ ] Confirmar que la portada abre el botón de arrepentimiento **sin sesión ni registro**, desde un navegador en incógnito.

## Después de cada cambio en `docs/*.md`

Correr `npm run sync:legal`, commitear el `.md` **y** el HTML generado, y pushear.
Vercel republica solo.
