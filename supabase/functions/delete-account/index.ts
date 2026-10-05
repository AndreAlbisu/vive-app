// delete-account — baja de cuenta iniciada por el propio usuario.
//
// Existe porque Apple lo EXIGE (App Store Review Guideline 5.1.1(v)): toda app
// que permita crear una cuenta tiene que permitir borrarla desde adentro. Sin
// esto, la app se rechaza en iOS.
//
// Por qué una edge function y no una query del cliente: borrar de `auth.users`
// requiere service role, que nunca puede tocar el cliente.
//
// ── Modelo: borrado + anonimización, NO cascade ──────────────────────────────
// Un `deleteUser` a secas haría daño: se llevaría puesto el registro de las
// reservas (respaldo fiscal + historial del coach) y dejaría reseñas y chats
// rotos. Decisión de producto (Andre, 06/08/2026):
//   · SE BORRA de verdad el contenido personal (diario, ánimo, gratitud,
//     hábitos, recordatorios, guardados, quiz, notificaciones, avatar).
//   · SE ANONIMIZA lo que pertenece también a un tercero o hay que conservar:
//     reservas (fiscal), reseñas (reputación del coach) y mensajes (la
//     conversación también es del otro). Pasan a mostrar "Usuario eliminado".
//     De la reserva queda solo lo de la transacción: lo que la persona le
//     escribió al profesional al reservar y el tema por el que llegó se vacían.
//   · LAS NOTAS DE SESIÓN sobre la persona SE BORRAN (Andre, 03/10/2026; antes
//     se conservaban). La política promete suprimir el contenido de bienestar y
//     una nota sobre alguien que pidió la baja es exactamente eso.
//   · La fila de `profiles` NO se borra: queda como LÁPIDA vaciada de datos
//     personales. Además hoy no podría borrarse — reviews/messages/salas/
//     journal_entries/saved_resources la referencian con NO ACTION.
//   · Las sesiones futuras se CANCELAN, disparando el reembolso por el trigger
//     `trg_mark_refund_on_cancel` que ya existe.
//   · Al final se borra la cuenta de `auth.users`: es lo que hace que la cuenta
//     deje de existir y libera el email para un futuro registro.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { WEB_ORIGIN } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': WEB_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * La fecha de HOY en Argentina, no en UTC.
 *
 * 🔴 Acá decía `new Date().toISOString().slice(0, 10)`, que da la fecha en UTC.
 * Entre las **21:00 argentinas y la medianoche** eso ya es el día siguiente, así
 * que una sesión de esa misma noche **no contaba como futura**: un profesional
 * podía darse de baja con un cliente esperándolo en dos horas, y el cliente se
 * quedaba sin sesión y sin aviso. Argentina no tiene horario de verano, así que
 * alcanza con restar tres horas.
 */
function hoyEnArgentina(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/**
 * ¿La sesión todavía no empezó? `scheduled_date` y `scheduled_time` están en
 * horario argentino, sin zona ("9:00" y "09:00" son la misma hora). Si la hora
 * no se puede leer se trata como futura: se cancela, que es lo que hacía antes.
 */
function todaviaNoEmpezo(fecha: string, hora: string, ahora = Date.now()): boolean {
  const [h, m] = String(hora ?? '').split(':')
  const inicio = Date.parse(`${fecha}T${(h ?? '').padStart(2, '0')}:${(m ?? '00').padStart(2, '0')}:00-03:00`)
  return !Number.isFinite(inicio) || inicio > ahora
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/** Error del servidor: el detalle técnico queda en el log, no viaja a la
 *  persona (un mensaje de la base puede nombrar tablas y columnas). */
const fallo = (mensaje: string, detalle: unknown) => {
  console.error('[delete-account]', mensaje, '·', detalle)
  return json({ error: mensaje }, 500)
}

/** Tablas de contenido puramente personal: se borran enteras. Ninguna pertenece
 *  a un tercero ni hace falta conservarla por obligación legal. */
const PERSONAL_TABLES: { table: string; column: string }[] = [
  { table: 'journal_entries',    column: 'user_id' },
  { table: 'gratitude_entries',  column: 'user_id' },
  { table: 'mood_entries',       column: 'user_id' },
  { table: 'mood_suggestions',   column: 'user_id' },
  { table: 'user_habits',        column: 'user_id' },
  { table: 'user_quiz_answers',  column: 'user_id' },
  { table: 'resource_reminders', column: 'user_id' },
  { table: 'resource_completions', column: 'user_id' },
  { table: 'saved_resources',    column: 'user_id' },
  { table: 'pinned_resources',   column: 'user_id' },
  { table: 'resource_saves',     column: 'user_id' },
  { table: 'resource_feedback',  column: 'user_id' },
  { table: 'favorite_coaches',   column: 'user_id' },
  { table: 'notifications',      column: 'recipient_id' },
  // La constancia de identidad lleva el nombre verificado (01/10/2026).
  { table: 'identity_verifications', column: 'profile_id' },
  // Qué recursos abrió: dato de bienestar según nuestro propio consentimiento
  // (Política §3). Cuelga de `profiles`, que sobrevive como lápida, así que el
  // CASCADE nunca se dispara.
  { table: 'resource_events',    column: 'user_id' },
  // Lo que un profesional anotó sobre esta persona, privado o compartido.
  { table: 'session_notes',      column: 'user_id' },
]
// NO están acá a propósito, y conviene saber por qué:
//   · bookings / reviews / messages / salas → se conservan anonimizadas.
//   · reports / session_issues → quedan para moderación, atados a la lápida.
//   · analytics_events / user_events → quedan sin identidad (SET NULL / cascade).

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    // El usuario se identifica por su propio JWT: nadie puede pedir la baja de
    // otro. El service role se usa DESPUÉS, solo para ejecutar.
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '')
    if (!jwt) return json({ error: 'No autenticado' }, 401)

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
    if (userErr || !userData?.user) return json({ error: 'No autenticado' }, 401)

    const userId = userData.user.id
    const steps: string[] = []

    // ── 1. Coach: no puede darse de baja con sesiones futuras vivas ──────────
    // Del lado del usuario cancelamos y reembolsamos, pero del lado del coach
    // hay clientes esperando y plata cobrada: que desaparezca sin avisar deja
    // al cliente sin sesión y sin explicación. Se bloquea y se le pide que
    // cancele primero (así cada cancelación dispara su reembolso y su aviso).
    const { data: coachRow, error: coachLookupErr } = await admin
      .from('coaches').select('id').eq('profile_id', userId).maybeSingle()
    if (coachLookupErr) return fallo('No se pudo consultar el perfil profesional', coachLookupErr.message)

    if (coachRow) {
      const today = hoyEnArgentina()
      const { count, error: bookingsErr } = await admin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('coach_id', coachRow.id)
        .in('status', ['pendiente', 'confirmada'])
        .gte('scheduled_date', today)
      if (bookingsErr) return fallo('No se pudieron comprobar las sesiones futuras', bookingsErr.message)
      if ((count ?? 0) > 0) {
        return json({
          error: 'coach_con_sesiones',
          message: `Tenés ${count} sesión(es) agendada(s). Cancelalas antes de eliminar tu cuenta para que tus clientes reciban el reembolso y el aviso.`,
        }, 409)
      }

      // La fila se conserva por reservas y pagos históricos, pero sale del
      // catálogo ANTES de borrar datos o la cuenta de auth. Si luego falla un
      // paso, la baja se puede reintentar sin volver a exponer el perfil.
      const { error: unpublishErr } = await admin.from('coaches')
        .update({ verified: false, availability_status: 'en_pausa' })
        .eq('id', coachRow.id)
      if (unpublishErr) return fallo('No se pudo despublicar el perfil profesional', unpublishErr.message)
      steps.push('perfil profesional despublicado')
    }

    // ── 2. Cancelar sesiones futuras del usuario (dispara reembolso) ─────────
    // El trigger trg_mark_refund_on_cancel pasa a 'reembolso_pendiente' los
    // pagos aprobados, y el cron mp-process-refunds los procesa. La tardanza la
    // calcula ese trigger, no esta función: con menos de 24 h para la sesión,
    // la baja NO reembolsa, igual que cualquier cancelación del cliente.
    //
    // 🔴 Solo las que TODAVÍA NO EMPEZARON (03/10/2026). Antes entraban todas
    // las de hoy: quien hacía su sesión y se daba de baja antes de que el cron
    // la marcara completada la dejaba 'cancelada', y el profesional desaparecía
    // de la lista de pagos (PayPal/USDT) por una sesión que sí dio. Una sesión
    // ya empezada queda como está y la cierra `complete_confirmed_sessions`.
    const today = hoyEnArgentina()
    const { data: deHoyEnAdelante, error: futurasErr } = await admin
      .from('bookings')
      .select('id, scheduled_date, scheduled_time')
      .eq('user_id', userId)
      .in('status', ['pendiente', 'confirmada'])
      .gte('scheduled_date', today)
    if (futurasErr) return fallo('No se pudieron consultar las sesiones futuras', futurasErr.message)
    const futuras = (deHoyEnAdelante ?? []).filter(b => todaviaNoEmpezo(b.scheduled_date, b.scheduled_time))

    if (futuras.length) {
      const { error } = await admin
        .from('bookings')
        .update({ status: 'cancelada', cancelled_by: 'usuario' })
        .in('id', futuras.map(b => b.id))
      if (error) return fallo('No se pudieron cancelar las sesiones futuras', error.message)
      steps.push(`${futuras.length} sesión(es) futura(s) cancelada(s)`)
    }

    // De la reserva se conserva la transacción (Política §10), no lo que la
    // persona contó: el mensaje al profesional y el tema por el que llegó
    // ("Ansiedad y estrés") no son datos fiscales.
    const { error: scrubBookingsErr } = await admin
      .from('bookings')
      .update({ user_message: null, tema_origen: null })
      .eq('user_id', userId)
    if (scrubBookingsErr) return fallo('No se pudo vaciar el texto de las reservas', scrubBookingsErr.message)

    // ── 3. Expediente profesional y archivos ────────────────────────────────
    // El documento es privado, pero su vista textual verificada es pública;
    // borrar solamente el archivo dejaría título y matrícula expuestos. Se
    // recorre la carpeta completa para incluir archivos subidos que nunca
    // llegaron a guardarse como credencial.
    if (coachRow) {
      for (let batch = 0; batch <= 100; batch++) {
        const { data: files, error: listErr } = await admin.storage.from('coach-credentials')
          .list(userId, { limit: 100 })
        if (listErr) return fallo('No se pudieron listar los documentos profesionales', listErr.message)
        if (!files?.length) break
        if (batch === 100) return json({ error: 'Demasiados documentos para completar la baja automáticamente' }, 500)
        const paths = files.map(file => `${userId}/${file.name}`)
        const { error: removeErr } = await admin.storage.from('coach-credentials').remove(paths)
        if (removeErr) return fallo('No se pudieron borrar los documentos profesionales', removeErr.message)
      }

      const { error: videoErr } = await admin.storage.from('coach-videos')
        .remove([`${userId}/video.mp4`])
      if (videoErr) return fallo('No se pudo borrar el video público', videoErr.message)

      const { error: credentialsErr } = await admin.from('coach_credentials')
        .delete().eq('coach_id', coachRow.id)
      if (credentialsErr) return fallo('No se pudieron borrar las credenciales', credentialsErr.message)

      const { error: topicsErr } = await admin.from('coach_topics')
        .delete().eq('coach_id', coachRow.id)
      if (topicsErr) return fallo('No se pudieron borrar los temas profesionales', topicsErr.message)

      const { error: interviewErr } = await admin.from('coach_application_interviews')
        .delete().eq('coach_id', coachRow.id)
      if (interviewErr) return fallo('No se pudo borrar la nota de entrevista', interviewErr.message)

      const { error: scrubErr } = await admin.from('coaches').update({
        specialty: null,
        bio: null,
        nationality: null,
        application_video_url: null,
        application_notes: null,
        video_url: null,
        estilo: null,
        guia: null,
        focos: [],
        enfoques: [],
        profesion: null,
        has_matricula: false,
        price_per_session: null,
        price_usd: null,
        pais_atencion: null,
        provincia_atencion: null,
        respuesta_riesgo: null,
        slug: `deleted-${coachRow.id}`,
      }).eq('id', coachRow.id)
      if (scrubErr) return fallo('No se pudo anonimizar el perfil profesional', scrubErr.message)

      // Agenda y enlace de calendario: la fila de `coaches` sobrevive, así que
      // su CASCADE no corre. El token del calendario seguiría respondiendo.
      for (const table of ['coach_calendar_feeds', 'coach_availability', 'coach_weekly_pattern']) {
        const { error } = await admin.from(table).delete().eq('coach_id', coachRow.id)
        if (error) return fallo(`No se pudo borrar ${table}`, error.message)
      }

      // Notas privadas que escribió: nadie más las puede leer. Las compartidas
      // se quedan, porque también son de la persona que las recibió.
      const { error: notesErr } = await admin.from('session_notes')
        .delete().eq('coach_id', userId).eq('shared', false)
      if (notesErr) return fallo('No se pudieron borrar las notas privadas', notesErr.message)
      steps.push('expediente profesional y archivos borrados')

      // ── 3b. Datos de cobro ────────────────────────────────────────────────
      // CBU, alias, PayPal, billetera y la conexión con Mercado Pago. Se borran
      // SOLO si no queda plata en movimiento: `mp-process-refunds` reembolsa con
      // el token del profesional y el panel le paga lo adeudado con sus datos
      // de cobro. Borrarlos antes dejaría un reintegro o un pago sin camino.
      //
      // 📌 Y solo si no cobró nada en los últimos 180 días (04/10/2026): un
      // contracargo de Mercado Pago puede llegar meses después, y sin la conexión
      // del profesional ese pago no se puede leer. Lo que se conserva acá lo
      // borra después la tarea diaria `limpiar_cobro_de_bajas()`.
      const hace180Dias = new Date(Date.now() - (180 * 24 + 3) * 60 * 60 * 1000).toISOString().slice(0, 10)
      const abiertos = await Promise.all([
        // cobros o reintegros en curso
        admin.from('bookings').select('id', { count: 'exact', head: true })
          .eq('coach_id', coachRow.id).in('payment_status', ['pendiente', 'reembolso_pendiente']),
        // cobros de los últimos 180 días (cubre la garantía de 48 h y los contracargos)
        admin.from('bookings').select('id', { count: 'exact', head: true })
          .eq('coach_id', coachRow.id).in('payment_status', ['aprobado', 'reembolsado', 'contracargo']).gte('scheduled_date', hace180Dias),
        // sesiones cobradas por PayPal o USDT que Vita todavía no le transfirió
        admin.from('bookings').select('id', { count: 'exact', head: true })
          .eq('coach_id', coachRow.id).eq('status', 'completada').eq('payment_status', 'aprobado')
          .in('payment_provider', ['paypal', 'usdt']).is('paid_out_at', null),
        // reclamos de garantía sin resolver
        admin.from('guarantee_claims').select('id', { count: 'exact', head: true })
          .eq('coach_id', coachRow.id).is('resolved_at', null),
      ])
      const consultaRota = abiertos.find(r => r.error)
      if (consultaRota?.error) return fallo('No se pudo comprobar si quedan pagos abiertos', consultaRota.error.message)

      if (abiertos.every(r => (r.count ?? 0) === 0)) {
        for (const table of ['coach_payout_accounts', 'coach_mp_accounts']) {
          const { error } = await admin.from(table).delete().eq('coach_id', coachRow.id)
          if (error) return fallo(`No se pudo borrar ${table}`, error.message)
        }
        const { error: mpFlagErr } = await admin.from('coaches').update({ mp_connected: false }).eq('id', coachRow.id)
        if (mpFlagErr) return fallo('No se pudo desconectar Mercado Pago', mpFlagErr.message)
        steps.push('datos de cobro borrados')
      } else {
        // Los borra después `limpiar_cobro_de_bajas()` (tarea diaria).
        steps.push('datos de cobro conservados: hay pagos abiertos o cobros de los últimos 180 días')
      }
    }

    // ── 4. Borrar contenido personal ────────────────────────────────────────
    for (const { table, column } of PERSONAL_TABLES) {
      const { error } = await admin.from(table).delete().eq(column, userId)
      // No eliminar auth ni informar éxito con datos personales todavía en
      // una tabla: la cuenta queda accesible para reintentar la baja.
      if (error) return fallo(`No se pudo borrar ${table}`, error.message)
    }
    steps.push('contenido personal borrado')

    // ── 5. Avatar del storage ───────────────────────────────────────────────
    const { error: storageErr } = await admin.storage.from('avatars').remove([`${userId}/avatar.jpg`])
    if (storageErr) return fallo('No se pudo borrar el avatar', storageErr.message)

    // Fotos de la verificación de identidad (DNI y selfie). Para cualquier
    // cuenta y no solo coaches: una postulación abandonada antes de enviarse
    // también se borra por acá (`useCerrarSesionAlSalir`) y pudo haberlas subido.
    const { error: identityErr } = await admin.storage.from('identity-docs')
      .remove(['dni-frente', 'dni-dorso', 'selfie'].map(f => `${userId}/${f}.jpg`))
    if (identityErr) return fallo('No se pudieron borrar las fotos de identidad', identityErr.message)

    // ── 6. Lápida en profiles ───────────────────────────────────────────────
    // Reservas, reseñas, mensajes y salas siguen apuntando acá; por eso la fila
    // sobrevive, pero sin un solo dato que identifique a la persona.
    // El email va a un placeholder opaco y no a NULL: `profiles.email` puede ser
    // NOT NULL (poner NULL fallaba), y un literal fijo chocaría contra el UNIQUE
    // en la segunda baja. `.invalid` es un TLD reservado, nunca resoluble. No
    // agrega información: el uuid ya es la PK de la fila.
    const tombstone: Record<string, unknown> = {
      name: 'Usuario eliminado',
      email: `deleted-${userId}@vita.invalid`,
      avatar_url: null,
      push_token: null,
      birth_date: null,
      gender: null,
      nationality: null,
      deleted_at: new Date().toISOString(),
    }

    let { error: tombErr } = await admin.from('profiles').update(tombstone).eq('id', userId)

    // Reintento acotado: si alguna de las columnas opcionales es NOT NULL en este
    // entorno, se cae toda la anonimización por una columna secundaria. Se vuelve
    // a intentar con lo mínimo indispensable antes de dar la baja por fallida.
    if (tombErr) {
      console.warn('[delete-account] tombstone completo falló:', tombErr.message)
      const minimal = {
        name: 'Usuario eliminado',
        email: `deleted-${userId}@vita.invalid`,
        deleted_at: new Date().toISOString(),
      }
      const retry = await admin.from('profiles').update(minimal).eq('id', userId)
      tombErr = retry.error
    }
    if (tombErr) return fallo('No se pudo anonimizar el perfil', tombErr.message)
    steps.push('perfil anonimizado')

    // ── 7. Borrar la cuenta de auth ─────────────────────────────────────────
    // Último paso a propósito: si algo falla antes, la cuenta sigue existiendo
    // y la baja se puede reintentar. Al revés quedaría contenido huérfano sin
    // dueño que pueda pedir nada.
    const { error: authErr } = await admin.auth.admin.deleteUser(userId)
    if (authErr) return fallo('No se pudo eliminar la cuenta', authErr.message)
    steps.push('cuenta eliminada')

    return json({ ok: true, steps })
  } catch (e) {
    console.error('[delete-account]', e)
    return fallo('Error inesperado', String(e))
  }
})
