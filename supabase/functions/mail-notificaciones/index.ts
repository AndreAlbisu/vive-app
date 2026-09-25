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
//  2. Las reservas solo se mandan dentro de `VENTANA_MINUTOS`; las decisiones
//     de postulación no vencen, porque son el canal principal de respuesta.
//     Su backfill previo a este cambio evita un envío masivo histórico.
//  3. Una lista blanca de tipos. `notifications` tiene tipos que no son para
//     mandar por mail (feedback de recursos, propuestas), y la tabla va a ganar
//     más con el tiempo. Se manda lo que está en la lista, no lo que no está en
//     una lista negra — al revés, un tipo nuevo se mandaría solo.
//
// ⚠️ El backfill de `add-notifications-emailed-at.sql` es el cuarto cinturón, y
// es el que evita el desastre de la primera corrida.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { esServiceRole } from '../_shared/service-role.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { enviarMail, nombreSeguro } from '../_shared/email.ts'

const VENTANA_MINUTOS = 180
const TOPE_POR_CORRIDA = 50
const DECISIONES = ['postulacion_aprobada', 'postulacion_rechazada']

const SITIO = Deno.env.get('WEB_BASE_URL') ?? 'https://vitaapp.com.ar'

/**
 * Qué se manda y con qué título. La `body` de la notificación ya está escrita
 * para la campana y sirve tal cual; lo que agrega el mail es el encabezado y,
 * cuando corresponde, la explicación de qué pasa con la plata — que en la app
 * se ve en pantalla y en el mail hay que decir.
 */
const PLANTILLAS: Record<string, { titulo: string; pie?: string; conLinkSala?: boolean }> = {
  // 🔴 Las dos de la postulación entraron el 23/09/2026, y son el caso donde el
  // mail no es un refuerzo sino el ÚNICO canal: al enviar la solicitud se cierra
  // la sesión (`CoachApplicationScreen`), así que la persona **no puede entrar a
  // la app a mirar la campana**. Sin esto, la pantalla que le promete "te
  // avisamos" mentía: la notificación quedaba esperando adentro de una cuenta a
  // la que no podía entrar hasta que la aprobaran.
  postulacion_aprobada: {
    titulo: 'Aprobamos tu postulación a Vita',
    pie: 'Entrá a la app con el mismo mail para cargar tus horarios, tu precio y cómo querés cobrar.',
  },
  postulacion_rechazada: {
    titulo: 'Sobre tu postulación a Vita',
    pie: 'Podés corregir lo que falte y volver a enviarla desde la app: vuelve a la cola de revisión.',
  },
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
  // 🔴 Tipos propios, y no reutilizar los de arriba, porque **el pie lo pone el
  // tipo**: con `reserva_nueva` este mail habría dicho "si no la respondés en 24
  // horas se cancela sola" (falso), y con `reserva_cancelada` habría prometido
  // una devolución que no existe. Ver `scripts/add-tipos-cambio-horario.sql`.
  cambio_pedido: {
    titulo: 'Quieren cambiar el horario de una sesión',
    pie: 'La sesión sigue en su horario hasta que se resuelva. Entrá a la app para contestar.',
  },
  cambio_resuelto: {
    titulo: 'Novedades con el horario de tu sesión',
    pie: 'Podés ver el horario actualizado en la app.',
  },
  // "Tengo un problema con esta sesión" (`session_issues`). El primero es para
  // el equipo (sin datos de la persona: se leen en el panel); el segundo avisa
  // que hay respuesta, sin copiarla, porque puede hablar de su sesión o su pago.
  problema_sesion_nuevo: {
    titulo: 'Reportaron un problema con una sesión',
    pie: 'Prometimos responder en 24 horas hábiles.',
  },
  problema_sesion_respondido: {
    titulo: 'Te respondimos sobre tu sesión',
    pie: 'La respuesta está en la app, en el chat de esa sesión.',
  },
}

serve(async (req) => {
  // 🔴 Faltaba el candado. Las otras seis functions que solo llama el cron
  // chequean `esServiceRole`; esta no, así que **cualquiera con una cuenta
  // (incluso una sesión anónima) podía dispararla**. El daño es acotado porque
  // marca `emailed_at` y los reenvíos quedan en no-op, pero era la única de la
  // familia sin el control, y el helper ya existía.
  if (!esServiceRole(req.headers.get('Authorization'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const desde = new Date(Date.now() - VENTANA_MINUTOS * 60_000).toISOString()
  const ahora = new Date().toISOString()

  // Si la ejecución anterior murió después de reservar una decisión, se
  // libera tras 15 minutos. El reenvío lleva una clave de idempotencia estable
  // al proveedor para evitar duplicados cuando el primer intento sí salió.
  const claimVencido = new Date(Date.now() - 15 * 60_000).toISOString()
  const { error: recoveryError } = await admin.from('notifications')
    .update({ emailed_at: null })
    .in('type', DECISIONES)
    .is('mail_completed_at', null)
    .not('emailed_at', 'is', null)
    .lt('emailed_at', claimVencido)
  if (recoveryError) {
    console.error('[mail-notificaciones] no se pudieron recuperar reservas vencidas:', recoveryError.message)
    return new Response('error', { status: 500 })
  }

  const { data: pendientes, error } = await admin
    .from('notifications')
    .select('id, recipient_id, type, title, body, booking_id, created_at, mail_attempts')
    .is('emailed_at', null)
    .or(`created_at.gte.${desde},type.in.(${DECISIONES.join(',')})`)
    .or(`mail_retry_after.is.null,mail_retry_after.lte.${ahora}`)
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

  // 🔴 RESERVAR ANTES DE MANDAR. Antes se mandaba y después se marcaba, y eso
  // duplica mails por dos caminos: (1) si el `update` falla, la fila queda
  // pendiente y la próxima corrida la manda de nuevo; (2) si una corrida tarda
  // más de los 5 minutos del cron, **la siguiente arranca y toma las mismas
  // filas sin marcar**.
  //
  // El `.is('emailed_at', null)` hace la reserva ATÓMICA: solo la corrida que
  // gana la carrera recibe la fila de vuelta. Las que llegan tarde reciben cero
  // filas y no mandan nada.
  const { data: tomadas } = await admin
    .from('notifications')
    .update({ emailed_at: ahora })
    .in('id', pendientes.map((n) => n.id))
    .is('emailed_at', null)
    .select('id')

  const mias = new Set((tomadas ?? []).map((t) => t.id as string))
  if (mias.size === 0) return new Response('otra corrida las tomó', { status: 200 })

  for (const n of pendientes) {
    if (!mias.has(n.id as string)) continue
    const para = mailDe.get(n.recipient_id as string)
    const plantilla = PLANTILLAS[n.type as string]

    // ⚠️ Sin dirección queda marcada y no se libera. Si se liberara, esa fila
    // volvería a la cola en cada corrida y no saldría nunca: una cola que no se
    // vacía deja de ser una cola.
    if (!para || !plantilla) {
      if (!para) sinMail++
      if (DECISIONES.includes(n.type as string)) {
        const { error: noAddressError } = await admin.from('notifications')
          .update({ mail_completed_at: new Date().toISOString() })
          .eq('id', n.id).eq('emailed_at', ahora)
        if (noAddressError) console.error('[mail-notificaciones] no se pudo cerrar aviso sin destinatario:', n.id, noAddressError.message)
      }
      continue
    }

    const lineas = [nombreSeguro((n.body as string) || '')]
    if (plantilla.conLinkSala && n.booking_id) {
      lineas.push(
        `<a href="${SITIO}/sala?booking=${n.booking_id}" style="color:#C1694F;font-weight:bold">Entrar a la sesión</a>`,
      )
    }

    const ok = await enviarMail({
      para,
      asunto: plantilla.titulo,
      titulo: plantilla.titulo,
      lineas,
      pie: plantilla.pie,
      ...(DECISIONES.includes(n.type as string) ? { idempotencyKey: `postulacion/${n.id}` } : {}),
    })

    // Una decisión vuelve a la cola sin fecha de caducidad; su próxima prueba
    // espera 5, 10, 20... minutos (máximo un día). Los avisos de reservas
    // conservan la ventana de tres horas.
    //
    // ⚠️ El caso que queda sin cubrir: que el mail salga y esta liberación no
    // haga falta pero el proceso muera justo acá. Ahí el mail salió y la fila
    // quedó marcada — o sea, se pierde un reintento que no hacía falta. Es el
    // lado bueno de la moneda: **se prefiere un mail perdido a un mail
    // duplicado**, porque el duplicado es el que erosiona la confianza en los
    // avisos de plata.
    if (ok) {
      mandados++
      if (DECISIONES.includes(n.type as string)) {
        const { error: completeError } = await admin.from('notifications')
          .update({ mail_completed_at: new Date().toISOString() })
          .eq('id', n.id).eq('emailed_at', ahora)
        if (completeError) console.error('[mail-notificaciones] falta confirmar envío aceptado:', n.id, completeError.message)
      }
    } else {
      const intentos = Number(n.mail_attempts ?? 0) + 1
      const demoraMinutos = DECISIONES.includes(n.type as string)
        ? Math.min(5 * 2 ** Math.min(intentos - 1, 9), 24 * 60)
        : 0
      const { error: releaseError } = await admin.from('notifications').update({
        emailed_at: null,
        mail_attempts: intentos,
        mail_retry_after: demoraMinutos
          ? new Date(Date.now() + demoraMinutos * 60_000).toISOString()
          : null,
      }).eq('id', n.id).eq('emailed_at', ahora)
      if (releaseError) console.error('[mail-notificaciones] no se pudo liberar la notificación:', n.id, releaseError.message)
    }
  }

  console.log(`[mail-notificaciones] ${mandados}/${pendientes.length} mandados, ${sinMail} sin dirección`)
  return new Response(JSON.stringify({ revisados: pendientes.length, mandados, sinMail }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
