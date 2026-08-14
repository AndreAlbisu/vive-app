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

> **Estado al 14/08/2026:** deployado y verificado en `https://vive-app.vercel.app`.
> El dominio propio ya está acreditado y su delegación **ya apunta a Vercel en el
> panel de DonWeb**; falta que DonWeb publique el cambio en el registro de
> `.com.ar`. Hasta entonces `vitaapp.com.ar` no resuelve.

### 2. Vercel

1. Entrar a [vercel.com](https://vercel.com) con la cuenta de GitHub.
2. **Add New → Project** → importar `AndreAlbisu/vive-app`.
3. Vercel va a autodetectar el repo como proyecto de Expo. **No dejarlo**: el
   `vercel.json` del repo ya fuerza `framework: null`, `buildCommand:
   npm run sync:legal` y `outputDirectory: web`. Verificar que la pantalla de
   configuración muestre eso antes de deployar.
4. Deploy. Queda en `<algo>.vercel.app`.

### 3. Apuntar `vitaapp.com.ar` a Vercel — ✅ hecho el 14/08/2026

Se hizo por **delegación de nameservers**, no cargando registros sueltos: así
Vercel maneja la zona entera, emite el certificado solo, y funciona sea cual sea
el editor de DNS que ofrezca el registrador.

En **DonWeb → Dominio → NS y Registros DNS → Editar nameservers**:

```
ns1.vercel-dns.com
ns2.vercel-dns.com
```

(los dos dominios ya estaban agregados en Vercel → Settings → Domains)

- ⚠️ **No cargar además el `A` ni el `CNAME`.** Con la delegación, la zona vive
  en Vercel y esos registros ya están de ese lado. Los valores que Vercel muestra
  en la pestaña "DNS Records" (`A @ 216.198.79.1` y un `CNAME` de `www` **único
  de este proyecto**) son para el OTRO camino, el de no delegar. Quedan acá solo
  por si alguna vez hay que volver atrás.
- **Verificar la delegación contra el padre, no contra un resolver:** los
  recursivos cachean también las respuestas negativas.

  ```
  dig +short @a.lactld.org NS vitaapp.com.ar
  ```

  Mientras devuelva `ns1.donweb.com` / `ns2.donweb.com`, el cambio todavía no se
  publicó. Cuando devuelva los de Vercel, resuelve en minutos.

**Decisión pendiente:** Vercel dejó `www` como Production y el raíz redirigiendo
con 308. Los T&C §9.4 declaran la URL **sin** `www`. Conviene darlo vuelta desde
**Edit** — funciona igual por el redirect, pero un documento legal no debería
apuntar a una URL que rebota.

### 4. Completar lo que depende de que el dominio resuelva

- [x] ~~**T&C §9.4**~~ — la URL ya está escrita (`https://vitaapp.com.ar` y `https://vitaapp.com.ar/legal/arrepentimiento`). ⚠️ **El documento la declara como vía para ejercer un derecho, así que no puede entrar en vigencia antes de que el sitio esté arriba.** Con `cleanUrls` activo la URL canónica va **sin** `.html`; los enlaces internos sí llevan `.html` a propósito, para poder abrir el sitio desde el disco antes de deployar, y Vercel los redirige.
- [ ] **App Store Connect** — `https://vitaapp.com.ar/legal/privacidad`
- [ ] **Google Play Console** — `https://vitaapp.com.ar/legal/privacidad` **y**, como URL de solicitud de eliminación de cuenta, `https://vitaapp.com.ar/legal/eliminar-cuenta`
- [ ] Confirmar en **incógnito** que `https://vitaapp.com.ar` abre y que el botón de arrepentimiento se alcanza **sin sesión ni registro**.
- [ ] Confirmar que las 4 páginas de `legal/` cargan y que el link "Inicio" vuelve a la portada.

## Después de cada cambio en `docs/*.md`

Correr `npm run sync:legal`, commitear el `.md` **y** el HTML generado, y pushear.
Vercel republica solo.
