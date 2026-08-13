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

### 1. Dominio — ✅ hecho

**`vitaapp.com.ar`**, comprado en NIC.ar el 13/08/2026.

⚠️ Los `.com.ar` **se renuevan cada año** y NIC.ar no cobra automáticamente: si
vence, el sitio se cae y con él la URL que los T&C §9.4 declaran como vía para
ejercer el derecho de revocación, y la URL de privacidad que sostiene la ficha de
las dos tiendas. Poner un recordatorio de renovación.

### 2. Vercel

1. Entrar a [vercel.com](https://vercel.com) con la cuenta de GitHub.
2. **Add New → Project** → importar `AndreAlbisu/vive-app`.
3. Vercel va a autodetectar el repo como proyecto de Expo. **No dejarlo**: el
   `vercel.json` del repo ya fuerza `framework: null`, `buildCommand:
   npm run sync:legal` y `outputDirectory: web`. Verificar que la pantalla de
   configuración muestre eso antes de deployar.
4. Deploy. Queda en `<algo>.vercel.app`.

### 3. Apuntar `vitaapp.com.ar` a Vercel

**Project → Settings → Domains** → agregar `vitaapp.com.ar` y `www.vitaapp.com.ar`.
Vercel indica qué registros cargar en el panel de NIC.ar (normalmente un `A` a su
IP para el dominio raíz y un `CNAME` a `cname.vercel-dns.com` para `www`). La
propagación tarda hasta 24hs; el certificado TLS lo emite Vercel solo.

### 4. Completar lo que depende de que el dominio resuelva

- [x] ~~**T&C §9.4**~~ — la URL ya está escrita (`https://vitaapp.com.ar` y `https://vitaapp.com.ar/legal/arrepentimiento`). ⚠️ **El documento la declara como vía para ejercer un derecho, así que no puede entrar en vigencia antes de que el sitio esté arriba.** Con `cleanUrls` activo la URL canónica va **sin** `.html`; los enlaces internos sí llevan `.html` a propósito, para poder abrir el sitio desde el disco antes de deployar, y Vercel los redirige.
- [ ] **App Store Connect** — `https://vitaapp.com.ar/legal/privacidad`
- [ ] **Google Play Console** — `https://vitaapp.com.ar/legal/privacidad` **y**, como URL de solicitud de eliminación de cuenta, `https://vitaapp.com.ar/legal/eliminar-cuenta`
- [ ] Confirmar en **incógnito** que `https://vitaapp.com.ar` abre y que el botón de arrepentimiento se alcanza **sin sesión ni registro**.
- [ ] Confirmar que las 4 páginas de `legal/` cargan y que el link "Inicio" vuelve a la portada.

## Después de cada cambio en `docs/*.md`

Correr `npm run sync:legal`, commitear el `.md` **y** el HTML generado, y pushear.
Vercel republica solo.
