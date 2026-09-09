// email — los mails transaccionales de una reserva.
//
// ── Por qué existe ───────────────────────────────────────────────────────────
//
// 🔴 **Quien reserva desde la web (`/c/<slug>`) no tiene la app.** No hay push
// que le llegue, ni pantalla donde mirar el estado. Si el coach no confirma y
// `expire_pending_bookings()` cancela y devuelve la plata, **sin mail no se
// entera por ningún lado**: pagó, esperó, y la plata volvió sin explicación.
//
// Por eso el checkout web no se puede abrir sin esto. La pantalla de
// `/reserva` promete "te avisamos por mail" tres veces.
//
// ── Cómo manda ───────────────────────────────────────────────────────────────
//
// Por la API de Resend, no por el SMTP de Supabase Auth: ese está configurado
// para los mails de autenticación (el código de 6 dígitos) y no se puede usar
// para mandar cualquier cosa. Es el mismo proveedor y el mismo dominio ya
// verificado (`vitaapp.com.ar`), así que no hay que configurar nada nuevo salvo
// la API key.
//
// ⚠️ **Nunca hace fallar lo que lo llamó.** Todas las funciones devuelven en vez
// de tirar: esto se llama desde el camino que acredita un pago y desde el que
// confirma una sesión. Un mail que no sale es un problema; una acreditación
// perdida por un mail que no salió es un problema mucho peor.

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const REMITENTE = Deno.env.get('MAIL_REMITENTE') ?? 'Vita <no-responder@vitaapp.com.ar>'
const SITIO = Deno.env.get('WEB_BASE_URL') ?? 'https://vitaapp.com.ar'

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
               'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "viernes 18 de septiembre, 11:00 hs" — la fecha guardada es de Argentina y se
 *  lee tal cual, sin convertir: convertirla acá sería inventarle una zona. */
export function fechaLarga(date: string, time: string): string {
  const [y, m, d] = String(date).split('-').map(Number)
  if (!y || !m || !d) return `${date} ${time}`
  // `Date.UTC` + `getUTCDay` para que el día de la semana no dependa de la zona
  // del servidor, que no es la de nadie.
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${DIAS[dow]} ${d} de ${MESES[m - 1]}, ${String(time).slice(0, 5)} hs`
}

/** Escapado mínimo: los nombres los escriben las personas y terminan adentro de
 *  HTML. Sin esto, un nombre con `<` rompe el mail — o peor. */
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * La plantilla. Tablas y estilos en línea porque los clientes de mail no
 * soportan nada más — mismo criterio que `docs/plantilla-mail-codigo.html`, de
 * donde salen los colores.
 */
function armarHtml(titulo: string, lineas: string[], pie?: string): string {
  const cuerpo = lineas.map(l => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#2D4A3E">${l}</p>`).join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F7EFE4;padding:32px 16px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background-color:#FDF8F0;border-radius:14px;padding:28px">
      <tr><td>
        <p style="margin:0 0 22px;font-size:12px;letter-spacing:.12em;color:#87835C;text-transform:uppercase">Vita</p>
        <h1 style="margin:0 0 18px;font-size:20px;line-height:1.3;color:#2D4A3E">${titulo}</h1>
        ${cuerpo}
        ${pie ? `<p style="margin:22px 0 0;font-size:12px;line-height:1.5;color:#87835C">${pie}</p>` : ''}
      </td></tr>
    </table>
    <p style="margin:18px 0 0;font-size:11px;color:#87835C">
      <a href="${SITIO}/legal/terminos" style="color:#C1694F">Términos</a> ·
      <a href="${SITIO}/legal/privacidad" style="color:#C1694F">Privacidad</a> ·
      <a href="${SITIO}/legal/arrepentimiento" style="color:#C1694F">Botón de arrepentimiento</a>
    </p>
  </td></tr>
</table>`
}

/** Versión de texto plano: hay clientes que no muestran HTML, y un mail sin
 *  `text` puntúa peor en los filtros de spam. */
function armarTexto(titulo: string, lineas: string[], pie?: string): string {
  const limpio = (s: string) => s.replace(/<[^>]+>/g, '')
  return [titulo, '', ...lineas.map(limpio), pie ? `\n${limpio(pie)}` : ''].join('\n')
}

export type Mail = { para: string; asunto: string; titulo: string; lineas: string[]; pie?: string }

/**
 * Manda uno. Devuelve `true` si Resend lo aceptó.
 *
 * ⚠️ Un `true` es "Resend lo aceptó para entregar", NO "llegó a la bandeja".
 * Es la misma distinción que quedó anotada en `docs/plantilla-mail-codigo.md`.
 */
export async function enviarMail(m: Mail): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[email] sin RESEND_API_KEY: no se manda nada —', m.asunto)
    return false
  }
  if (!m.para || !m.para.includes('@')) {
    console.warn('[email] destinatario inválido, no se manda:', m.asunto)
    return false
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: REMITENTE,
        to: [m.para],
        subject: m.asunto,
        html: armarHtml(esc(m.titulo), m.lineas, m.pie),
        text: armarTexto(m.titulo, m.lineas, m.pie),
      }),
    })
    if (!r.ok) {
      const cuerpo = await r.text().catch(() => '')
      console.error('[email] Resend rechazó', r.status, cuerpo.slice(0, 300))
      return false
    }
    return true
  } catch (e) {
    console.error('[email] no se pudo mandar:', e)
    return false
  }
}

/** El mail de quien reservó, con el nombre escapado. Atajo para no repetir el
 *  `esc()` en cada llamador y olvidárselo justo en el que importa. */
export const nombreSeguro = esc
