# Instrucciones — Documentos legales de Vita

Guía operativa (no legal) para llevar los borradores de **Términos y Condiciones**
y **Política de Privacidad** de "borrador" a "publicado". Leé esto antes de tocar
los otros dos archivos.

## Archivos
- [`terminos-y-condiciones.md`](./terminos-y-condiciones.md) — T&C (24 secciones).
- [`politica-de-privacidad.md`](./politica-de-privacidad.md) — Política de Privacidad (14 secciones).
- Ambos son **BORRADORES**. No se publican ni entran en vigencia sin revisión de un/a abogado/a matriculado/a en Argentina.

> **Estos `.md` son la fuente de verdad y la app los muestra.** Después de editar
> cualquiera de los dos hay que correr **`npm run sync:legal`**, que regenera
> `constants/legal.ts` (Metro no puede importar `.md` directo). Si no se corre,
> la app sigue mostrando la versión anterior. La pantalla legal muestra un aviso de
> "borrador pendiente de revisión" mientras queden placeholders `[ ]` sin completar;
> cuando se completen todos, el aviso desaparece solo (bandera `LEGAL_IS_DRAFT`).

## Los 4 pasos, en orden

### Paso 1 — Completar los placeholders `[ ]`
Datos de la empresa y de contacto que solo tenés vos. Checklist consolidado (ambos documentos):

> **Decidido el 06/08/2026 (Andre): Vita la opera una PERSONA HUMANA inscripta en Monotributo**, no una sociedad. Por eso los documentos ya no dicen "razón social" sino `[NOMBRE Y APELLIDO]`. Revisar la decisión cuando entre inversión, se formalice un socio, la facturación se acerque al tope del monotributo, o el volumen haga que el riesgo patrimonial personal deje de ser teórico.

- [x] ~~**Nombre y apellido**~~ — Andre Albisu Lambertini
- [x] ~~**CUIT**~~ — 20-46034087-0 (confirmado por Andre)
- [x] ~~**Domicilio**~~ — De los Extremeños 5069, Córdoba, Provincia de Córdoba
- [x] ~~**Correo de contacto legal**~~ — vitaappar@gmail.com
- [x] ~~**Correo de privacidad**~~ — vitaappar@gmail.com (el mismo)
- [ ] **Fecha de última actualización** y **fecha de vigencia** (en ambos) — poner la fecha real de publicación, no la de hoy
- [ ] Referente/responsable de datos, si se designa (Política §1)

### Paso 2 — Resolver las decisiones de producto/fiscales pendientes
No son legales puras, son tuyas (con tu contador/abogado):

- [x] ~~**IVA / figura fiscal** (T&C §8.4)~~ — **RESUELTO 06/08/2026: Monotributo**, factura C sin IVA discriminado. §8.4 ya redactada, y el código no necesita cambio (la comisión retenida es la comisión final). Se agregaron §8.5 (situación fiscal del Profesional) y §8.6 (cambio de condición fiscal).
- [x] ~~**Comisión** (T&C §8.3)~~ — **20%** la primera sesión con cada persona / **15%** desde la 2da, ya escrito sin corchetes. Falta solo decidir si mencionás la promo fundador.
- [x] ~~**Lista de proveedores** (Política §6)~~ — verificada contra el código: Supabase, Mercado Pago, **Daily.co** (el video real; lo de Jitsi en `salas.room_url` es vestigial, nada lo abre) y Expo push. **Analítica: ninguna de terceros**, es tabla propia. Falta el acuerdo de tratamiento de datos con cada uno.
- [ ] **Garantía de primera sesión** (T&C §9.3) — confirmar si se mantiene y su alcance exacto (reintegro vs. nueva sesión, plazos, condiciones).
- [ ] **Antelación mínima de cancelación** (T&C §9.1) — el número de horas exacto.
- [ ] **Jurisdicción** (T&C §22) — normalmente CABA, confirmar con abogado.
- [ ] **Líneas de ayuda en crisis** (T&C §5.3) — decidir si incluís líneas locales.
- [ ] **Plazos de conservación** de datos por categoría (Política §10).

### Paso 3 — Revisión legal (obligatoria)
Llevá los dos borradores ya completados (pasos 1 y 2) a un/a abogado/a. Puntos donde su revisión vale más (están marcados `[Validar con abogado]` en los textos):

- [ ] **Cláusula de jurisdicción frente a consumidores** (T&C §22) — tiene límites estrictos en Argentina; no se puede perjudicar al consumidor.
- [ ] **Mecanismo de consentimiento de datos sensibles** (Política §3) — cómo se obtiene y registra el consentimiento explícito para mood/diario/mensajes.
- [ ] **Transferencia internacional de datos** (Política §7) — encuadre bajo Ley 25.326 / AAIP (servidores fuera de AR).
- [ ] **Limitación de responsabilidad e indemnidad** (T&C §18–19) — qué se sostiene ante un juez argentino.
- [ ] **Aviso de salud y emergencias** (T&C §5) — redacción fina, sobre todo por tener psicólogos/as en la plataforma.
- [ ] **Cláusula anti-solicitación / no elusión** (T&C §10) — que sea ejecutable.

> Tip: aprovechá la misma consulta legal/contable que vas a necesitar por lo fiscal (IVA/figura) para que te revisen estos textos. Es la misma persona/estudio.

### Paso 4 — Publicar y conectar en la app
Una vez revisados y aprobados:

- [x] ~~**Enlaces dentro de la app.**~~ Hecho el 06/08/2026: pantalla `/legal?doc=terminos|privacidad` desde el menú de perfil, y `LegalSheet` en el registro de usuario y en el de profesional. Muestran el texto real de estos `.md` (vía `npm run sync:legal`), no un resumen aparte.
- [x] ~~**Aceptación en el registro (email).**~~ El checkbox ya persiste en `profiles.accepted_terms` (antes se descartaba). El registro del profesional usa aceptación implícita, porque su pantalla es login y alta a la vez.
- [ ] **Aceptación en el registro con Google y Apple.** Esos botones **no exigen el checkbox** y no pasan por `signUpWithEmail`, así que hoy se crea cuenta sin aceptar ni registrar nada. Decidir entre bloquearlos hasta tildar o pasar a aceptación implícita.
- [ ] **Guardar cuándo y qué versión** aceptó cada usuario (`accepted_terms_at`, `accepted_terms_version`) — hoy solo hay un booleano. Refuerza la ejecutabilidad de §10.
- [ ] **URL pública de la Política de Privacidad.** App Store Connect y Google Play Console **exigen una URL pública** de la política para poder publicar la app. Hay que subir la Política (y preferentemente los T&C) como página web accesible (sitio de marketing, o una página simple hosteada). El markdown de `docs/` no sirve como URL pública por sí solo — hay que convertirlo en página.
- [ ] **Etiquetas de las tiendas.** Completar las *App Privacy labels* (Apple) y el *formulario de seguridad de los datos* (Google) de forma **consistente** con lo que declara la Política (datos sensibles incluidos).

## Mantenimiento
- Actualizar la **fecha** de cada documento cada vez que cambie.
- Re-revisar con el abogado ante cambios relevantes del producto (nuevos datos que se recolecten, nuevos proveedores, cambio de modelo de pago, etc.).
- Mantener la sección de mensajería (T&C §15 / Política §8.2) **siempre consistente con la realidad técnica**: mientras no haya cifrado de extremo a extremo real, no afirmarlo.

---
Este archivo es una guía operativa, no asesoramiento legal.
