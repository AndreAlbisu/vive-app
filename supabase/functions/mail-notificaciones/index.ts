// mail-notificaciones — manda por mail lo que ya está anotado en `notifications`.
//
// ── Por qué existe ───────────────────────────────────────────────────────────
//
// 🔴 Quien reserva desde la web no tiene la app: no hay push que le llegue ni
// pantalla donde mirar. Si el coach confirma, si la reserva vence a las 24hs, o
// si se cancela y se le devuelve la plata, **sin mail no se entera por ningún
// lado**.
//
// 📌 Y no hace falta inventar eventos nuevos: los cuatro casos **ya insertan una
// fila en `notifications`** —incluido el vencimiento, que lo hace el cron SQL
// `expire_pending_bookings()`—. El mail es otro transporte del mismo evento, no
// un evento distinto. Por eso hay una sola función y no cuatro.
//
// ── Cómo no manda de más ─────────────────────────────────────────────────────
//
// Tres cinturones, porque un mail de más no se puede deshacer:
//
//  1. `emailed_at` se marca al mandar. Una notificación se manda una sola vez.
//  2. **Solo notificaciones RECIENTES** (`VENTANA_MINUTOS`). Si el cron estuvo
//     caído dos días, al volver NO vomita dos días de mails: lo viejo se da por
//     perdido, que es mucho mejor que llegar tarde y en manada.
//  3. Una lista blanca de tipos. `notifications` tiene tipos que no son para
//     mandar por mail (feedback de recursos, propuestas), y la tabla va a ganar
//     más con el tiempo. Se manda lo que está en la lista, no lo que no está en
//     una lista negra — al revés, un tipo nuevo se mandaría solo.
//
// ⚠️ El backfill de `add-notifications-emailed-at.sql` es el cuarto cinturón, y
// es el que evita el desastre de la primera corrida.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { enviarMail } from '../_shared/email.ts'

const VENTANA_MINUTOS = 180
const TOPE_POR_CORRIDA = 50

const SITIO = Deno.env.get('WEB_BASE_URL') ?? 'https://vitaapp.com.ar'

/**
 * Qué se manda y con qué título. La `body` de la notificación ya está escrita
 * para la campana y sirve tal cual; lo que agrega el mail es el encabezado y,
 * cuando corresponde, la explicación de qué pasa con la plata — que en la app
 * se ve en pantalla y en el mail hay que decir.
 */
const PLANTILLAS: Record<string, { titulo: string; pie?: string; conLinkSala?: boolean }> = {
  reserva_confirmada: {
    titulo: '¡Listo! Tu sesión está confirmada',
    // 🔴 El link a la sala va ACÁ y no "antes de la sesión" como decía antes:
    // este mail es el único lugar donde queda guardado. Y dice explícitamente
    // que es desde el navegador porque **las apps no están publicadas** — sin
    // eso, la persona busca dónde bajarla y no hay dónde.
    conLinkSala: true,
    pie: 'La sesión es por videollamada, desde el navegador: no hace falta instalar nada. La sala se abre 15 minutos antes.',
  },
  reserva_rechazada: {
    titulo: 'Tu reserva no se pudo confirmar',
    // 🔴 Esta es la línea que justifica la función entera. Quien reservó desde
    // la web no tiene dónde ver que la plata volvió: si no se lo decimos acá,
    // pagó, esperó, y le apareció un reintegro sin explicación.
    pie: 'Si habías pagado, te devolvemos todo automáticamente. Puede tardar unos días en aparecer en tu resumen, según tu banco.',
  },
  reserva_cancelada: {
    titulo: 'Se canceló tu sesión',
    pie: 'Si habías pagado, te devolvemos todo automáticamente. Puede tardar unos días en aparecer en tu resumen, según tu banco.',
  },
  // El coach sí tiene la app, pero una solicitud que no se ve a tiempo se cae
  // sola a las 24hs y se devuelve la plata: es el aviso más caro de perder.
  reserva_nueva: {
    titulo: 'Tenés una solicitud de sesión',
    pie: 'Entrá a la app para aceptarla. Si no la respondés en 24 horas, se cancela sola.',
  },
}

serve(async () => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const desde = new Date(Date.now() - VENTANA_MINUTOS * 60_000).toISOString()

  const { data: pendientes, error } = await admin
    .from('notifications')
    .select('id, recipient_id, type, title, body, booking_id, created_at')
    .is('emailed_at', null)
    .gte('created_at', desde)
    .in('type', Object.keys(PLANTILLAS))
    .order('created_at', { ascending: true })
    .limit(TOPE_POR_CORRIDA)

  if (error) {
    console.error('[mail-notificaciones] no se pudo leer la cola:', error.message)
    return new Response('error', { status: 500 })
  }
  if (!pendientes?.length) return new Response('sin pendientes', { status: 200 })

  // Los mails de los destinatarios, de una sola vez.
  const ids = [...new Set(pendientes.map((n) => n.recipient_id as string))]
  const { data: perfiles } = await admin.from('profiles').select('id, email').in('id', ids)
  const mailDe = new Map((perfiles ?? []).map((p) => [p.id as string, p.email as string | null]))

  let mandados = 0
  let sinMail = 0

  for (const n of pendientes) {
    const para = mailDe.get(n.recipient_id as string)
    const plantilla = PLANTILLAS[n.type as string]

    // ⚠️ Sin dirección se marca IGUAL como enviada. Si no, esa fila queda para
    // siempre en la cola, se reintenta en cada corrida y no va a salir nunca:
    // una cola que no se vacía deja de ser una cola.
    if (!para || !plantilla) {
      if (!para) sinMail++
      await admin.from('notifications').update({ emailed_at: new Date().toISOString() }).eq('id', n.id)
      continue
    }

    const lineas = [(n.body as string) || '']
    if (plantilla.conLinkSala && n.booking_id) {
      lineas.push(
        `<a href="${SITIO}/sala?booking=${n.booking_id}" style="color:#C1694F;font-weight:bold">Entrar a la sesión</a>`,
      )
    }

    const ok = await enviarMail({
      para,
      asunto: (n.title as string) || plantilla.titulo,
      titulo: plantilla.titulo,
      lineas,
      pie: plantilla.pie,
    })

    // 📌 Se marca solo si salió. Si Resend rechazó, la fila queda pendiente y la
    // próxima corrida lo reintenta —mientras esté dentro de la ventana—. Pasada
    // la ventana deja de intentarse, que es lo correcto: un aviso de algo que
    // pasó hace tres horas ya no le sirve a nadie.
    if (ok) {
      await admin.from('notifications').update({ emailed_at: new Date().toISOString() }).eq('id', n.id)
      mandados++
    }
  }

  console.log(`[mail-notificaciones] ${mandados}/${pendientes.length} mandados, ${sinMail} sin dirección`)
  return new Response(JSON.stringify({ revisados: pendientes.length, mandados, sinMail }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
