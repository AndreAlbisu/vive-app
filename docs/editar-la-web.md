# Editar la web (para Joaquín)

> **22/09/2026.** Qué se puede tocar de `vitaapp.com.ar`, qué no, y cómo probar
> un cambio sin romper nada que esté vivo.
>
> No hace falta cuenta de Vercel. **Con el acceso al repo alcanza.**

---

## Cómo se publica

El sitio está conectado a GitHub, rama `main`. **Cada push a `main` republica el
sitio solo**, en menos de un minuto. No hay botón que apretar ni panel al que
entrar.

Todo lo que se publica sale de la carpeta **`web/`**. Nada de `app/`, `screens/`
ni `lib/` llega al sitio: eso es la aplicación del teléfono.

---

## Qué se puede editar tranquilo

| archivo | qué es |
|---|---|
| `web/index.html` | **La landing**, la portada de vitaapp.com.ar. Escrita a mano, HTML y CSS, sin build. Es el archivo para mejorar. |
| `web/img/` | Las fotos de la landing. |
| `web/profesionales.html` | **La página para profesionales** (`vitaapp.com.ar/profesionales`): qué tienen en Vita, cuánto cuesta, cómo sumarse y la lista de espera. Lo que dice sale de `screens/CoachComoFuncionaScreen.tsx`: si cambia una regla allá, se cambia acá. |
| `web/tiendas.js` | Los botones de App Store / Google Play y el formulario de lista de espera, compartidos por las dos páginas. **Los links de las tiendas se pegan acá** (`TIENDAS`), una sola vez. |

📌 La landing usa la paleta de la app y la fuente Plus Jakarta Sans. La aurora del
fondo está hecha en CSS a partir de `assets/bg-aurora.jpg`. Es la única animación
que no dispara la persona, y **se apaga sola** si el sistema tiene activado
"reducir movimiento": si agregás animaciones, respetá lo mismo.

---

## Qué NO hay que editar a mano

🔴 **`web/legal/*.html` son GENERADOS.** Los escribe `npm run sync:legal` a partir
de los textos en `docs/`, y ese script **corre en cada publicación** (es el
`buildCommand` de Vercel). Cualquier cambio hecho directo sobre esos HTML **se
pisa solo** en el siguiente deploy.

Para cambiar un texto legal se edita el `.md` de `docs/` y se corre
`npm run sync:legal`. Los archivos generados son:

- `web/legal/terminos.html` ← `docs/terminos-y-condiciones.md`
- `web/legal/privacidad.html` ← `docs/politica-de-privacidad.md`
- `web/legal/arrepentimiento.html` ← `docs/boton-de-arrepentimiento.md`
- `web/legal/eliminar-cuenta.html` ← `docs/eliminar-cuenta.md`
- `web/legal/index.html` y `web/legal-version.js` ← los arma el mismo script

⚠️ Y hay dos cosas en la landing que **no son decorativas y no se pueden sacar**:
el enlace **"BOTÓN DE ARREPENTIMIENTO"** (lo exige la Resolución 424/2020, tiene
que estar en la primera pantalla y en un lugar destacado) y el **contacto
publicado** en el pie (lo exige la guideline 1.2 de Apple).

---

## 🔴 Lo que hay que tocar con cuidado

`web/c/index.html` **es el checkout público y está vivo desde el 21/09/2026.** Es
la página que se abre con el link de un profesional (`vitaapp.com.ar/c/su-nombre`)
y por ahí **alguien puede identificarse y pagar de verdad**. Un error ahí no
rompe un estilo: rompe un cobro.

Lo mismo con `web/sala/index.html`, que es por donde un profesional entra a dar la
sesión desde la computadora.

Si hay que tocar alguna de esas dos, conviene hacerlo en una rama (abajo) y
avisar.

---

## Cómo probar sin publicar

Dos formas, de menor a mayor esfuerzo:

**1. Abrirlo desde el disco.** `web/index.html` se puede abrir en el navegador
haciendo doble clic. Alcanza para maquetado, textos, colores y fotos. Los enlaces
internos llevan `.html` a propósito **justamente para que esto funcione**; Vercel
los redirige a la URL sin extensión.

**2. Una rama, y Vercel publica una copia aparte.** En vez de pushear a `main`:

```
git checkout -b landing-mejoras
# ...cambios...
git push -u origin landing-mejoras
```

Vercel arma una **URL de vista previa** para esa rama, con el sitio entero
funcionando y sin tocar el que está en el aire. Cuando está aprobado, se mergea a
`main` y recién ahí se publica.

⚠️ **Sin verificar todavía**: la cuenta de Vercel está en plan hobby, y no está
comprobado si construye las previews de ramas pusheadas por un colaborador que no
es el dueño de la cuenta. La primera vez conviene mirarlo. Si no las construye, la
opción 1 alcanza para casi todo.

---

## Lo que conviene acordar entre los dos

📌 **Hoy cualquier push a `main` publica al instante, sin revisión.** Mientras la
landing era una lista de enlaces daba igual. Ahora que el checkout está vivo, vale
la pena que los cambios de `web/` pasen por una rama, aunque el resto del repo se
siga commiteando directo en `main` como viene siendo la costumbre.
