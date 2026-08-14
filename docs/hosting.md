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

**`vitaapp.com.ar`**, comprado el 13/08/2026 **a través de DonWeb**, no en NIC.ar
directo. ⚠️ **Eso importa y es fácil de olvidar:** la delegación (los nameservers)
se administra desde el panel de DonWeb, no desde el de NIC.ar. DonWeb después
empuja el cambio al registro de `.com.ar`, en lote — puede tardar de horas a un
día, y mientras tanto `dig` contra el padre sigue mostrando los NS viejos aunque
el panel ya muestre los nuevos. La renovación anual también sale por DonWeb.

⚠️ Los `.com.ar` **se renuevan cada año** y NIC.ar no cobra automáticamente: si
vence, el sitio se cae y con él la URL que los T&C §9.4 declaran como vía para
ejercer el derecho de revocación, y la URL de privacidad que sostiene la ficha de
las dos tiendas. Poner un recordatorio de renovación.

> **Estado al 13/08/2026:** deployado y verificado en `https://vive-app.vercel.app`.
> Falta solo el dominio propio: `vitaapp.com.ar` está **en trámite en NIC.ar**
> (sin nameservers delegados todavía). Los registros a cargar están en el paso 3.

### 2. Vercel

1. Entrar a [vercel.com](https://vercel.com) con la cuenta de GitHub.
2. **Add New → Project** → importar `AndreAlbisu/vive-app`.
3. Vercel va a autodetectar el repo como proyecto de Expo. **No dejarlo**: el
   `vercel.json` del repo ya fuerza `framework: null`, `buildCommand:
   npm run sync:legal` y `outputDirectory: web`. Verificar que la pantalla de
   configuración muestre eso antes de deployar.
4. Deploy. Queda en `<algo>.vercel.app`.

### 3. Apuntar `vitaapp.com.ar` a Vercel

Los dos dominios ya están agregados en **Project → Settings → Domains**. Cuando
NIC.ar acredite el dominio, cargar estos dos registros en su panel:

| Tipo | Nombre | Valor |
|---|---|---|
| `A` | `@` | `216.198.79.1` |
| `CNAME` | `www` | `c841fb5e89b37a72.vercel-dns-017.com.` |

- ⚠️ **El CNAME es único de este proyecto**, no el genérico `cname.vercel-dns.com`.
  Escribir de memoria uno que "suena bien" deja el dominio muerto sin decir por qué.
- Si el panel no acepta `@` para el raíz, dejar el campo vacío o poner el dominio completo.
- El punto final del CNAME es parte del valor; si el panel lo rechaza, cargarlo sin él.
- **No usar el `76.76.21.21` legacy** que Vercel menciona al pie: sigue funcionando,
  pero si se carga hoy que sea la IP recomendada.
- Si NIC.ar solo permite **delegar nameservers** y no cargar registros sueltos, el
  camino es la pestaña **"Vercel DNS"** de esa misma pantalla.

La propagación tarda hasta 24hs; el certificado TLS lo emite Vercel solo. Verificar
con `dig +short A vitaapp.com.ar` y `dig +short NS vitaapp.com.ar`.

**Decisión pendiente:** Vercel dejó `www` como Production y el raíz redirigiendo
con 308. Los T&C §9.4 declaran la URL **sin** `www`. Conviene darlo vuelta desde
**Edit** — funciona igual por el redirect, pero un documento legal no debería
apuntar a una URL que rebota. Los registros DNS no cambian con el swap.

### 4. Completar lo que depende de que el dominio resuelva

- [x] ~~**T&C §9.4**~~ — la URL ya está escrita (`https://vitaapp.com.ar` y `https://vitaapp.com.ar/legal/arrepentimiento`). ⚠️ **El documento la declara como vía para ejercer un derecho, así que no puede entrar en vigencia antes de que el sitio esté arriba.** Con `cleanUrls` activo la URL canónica va **sin** `.html`; los enlaces internos sí llevan `.html` a propósito, para poder abrir el sitio desde el disco antes de deployar, y Vercel los redirige.
- [ ] **App Store Connect** — `https://vitaapp.com.ar/legal/privacidad`
- [ ] **Google Play Console** — `https://vitaapp.com.ar/legal/privacidad` **y**, como URL de solicitud de eliminación de cuenta, `https://vitaapp.com.ar/legal/eliminar-cuenta`
- [ ] Confirmar en **incógnito** que `https://vitaapp.com.ar` abre y que el botón de arrepentimiento se alcanza **sin sesión ni registro**.
- [ ] Confirmar que las 4 páginas de `legal/` cargan y que el link "Inicio" vuelve a la portada.

## Después de cada cambio en `docs/*.md`

Correr `npm run sync:legal`, commitear el `.md` **y** el HTML generado, y pushear.
Vercel republica solo.
