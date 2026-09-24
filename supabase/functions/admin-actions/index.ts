// admin-actions — las escrituras privilegiadas del panel de administración.
//
// El panel corre dentro de la app, con la anon key, así que NO puede escribir
// `coaches.verified` ni `reports.status`: `lock-privileged-columns.sql` y
// `add-application-status-and-audit.sql` cerraron esas columnas justo para que
// nadie se auto-apruebe. Esta función es la única vía. Valida el JWT de quien
// llama, confirma que sea admin, y recién ahí escribe con service role.
//
// El orden importa y es el punto entero de esta función: primero se resuelve
// QUIÉN es a partir de su token —lo que el cliente no puede falsificar— y solo
// después se usa el service role. Un `is_admin` que viniera en el body sería
// exactamente el agujero que estamos cerrando.
//
// Uso desde la app:
//   POST /admin-actions
//   Authorization: Bearer <access_token del usuario logueado>
//   { "action": "...", ... }
//
// Acciones:
//   { action: 'set_coach_verified', coach_id, verified: boolean, notes? }
//   { action: 'reject_coach_application', coach_id, reason }
//   { action: 'resolve_report', report_id, status: 'revisado'|'accionado'|'descartado' }
//   { action: 'mark_usdt_refunded', booking_id, refund_tx_id }
//   { action: 'mark_coach_paid', booking_ids: string[], payout_reference }
//   { action: 'list_pending_credentials' }
//   { action: 'credential_file_url', credential_id }
//   { action: 'review_credential', credential_id, verified: boolean, notes? }
//   { action: 'list_coach_applications', status? }   // lee el mail del coach (A4)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
// 🔴 Se importa en vez de recalcular: el redondeo de la comisión tiene que dar el
// MISMO número que en el cobro, o el registro de lo que se pagó no cuadra contra
// lo que se retuvo. Duplicar la fórmula es exactamente cómo se desincronizan.
import { marketplaceFeeFor } from '../_shared/commission.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const REPORT_STATUSES = ['revisado', 'accionado', 'descartado']
// De qué profesión es una matrícula (`coach_credentials.profesion`).
const PROFESIONES = ['psicologia', 'nutricion', 'otra']

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Deja constancia de una acción del panel en `admin_audit_log`.
 *
 *  Se llama DESPUÉS de que la acción ya ocurrió, no antes: loguear primero
 *  dejaría registro de cosas que después fallaron. La contra es que un fallo
 *  del log no deshace la acción — por eso devuelve el error en vez de tragarlo,
 *  y quien llama lo expone como `warning`. Una auditoría que falla en silencio
 *  es peor que no tenerla: promete un rastro que no existe. */
async function audit(
  admin: SupabaseClient,
  entry: {
    adminId: string
    adminEmail: string | null
    action: string
    targetType: 'coach' | 'report' | 'booking' | 'session_issue'
    targetId: string
    details?: Record<string, unknown>
  },
): Promise<string | null> {
  const { error } = await admin.from('admin_audit_log').insert({
    admin_id: entry.adminId,
    admin_email: entry.adminEmail,
    action: entry.action,
    target_type: entry.targetType,
    target_id: entry.targetId,
    details: entry.details ?? null,
  })
  if (error) {
    console.error(`[admin-actions] NO SE PUDO AUDITAR ${entry.action} sobre ${entry.targetId}: ${error.message}`)
    return error.message
  }
  return null
}

/** Avisa al coach el resultado de su postulación: fila en `notifications`
 *  (la que lee CoachNotificationsScreen) y push si tiene token.
 *
 *  Es best-effort a propósito: que falle el aviso no puede desarmar una
 *  aprobación ya escrita. Queda en el log. */
// La casilla para reclamos. Misma que `lib/contacto.ts` y que los Términos: si
// cambia, cambian las tres juntas. La notificación de una sanción ofrece
// reclamar, y hasta el 17/09/2026 decía "escribinos" sin decir a dónde.
const EMAIL_CONTACTO = 'vitaappar@gmail.com'

// Los tipos de archivo que acepta la evidencia de una sanción, y la extensión
// con la que se guardan. Tiene que coincidir con `allowed_mime_types` del bucket
// `sanction-evidence`: si acá se acepta algo que el bucket no, la subida firmada
// falla recién en storage, con un error mucho menos claro.
const EVIDENCE_MIMES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
}

async function notifyProfile(
  admin: SupabaseClient,
  profileId: string,
  type: 'postulacion_aprobada' | 'postulacion_rechazada' | 'credencial_verificada' | 'credencial_rechazada'
    | 'sancion_aplicada' | 'sancion_levantada' | 'profesional_no_disponible'
    | 'problema_sesion_respondido',
  title: string,
  body: string,
  // ⚠️ Último y opcional a propósito: todas las llamadas viejas pasan cinco
  // argumentos. En el medio corría todo un lugar y el título terminaba guardado
  // como id de reserva (pasó en el primer borrador, lo marcó el chequeo de tipos).
  bookingId: string | null = null,
): Promise<void> {
  const { error } = await admin.from('notifications').insert({
    recipient_id: profileId,
    type,
    title,
    body,
    // Con reserva, tocar la notificación abre ese chat (UserNotificationsScreen).
    ...(bookingId ? { booking_id: bookingId } : {}),
  })
  if (error) {
    console.error(`[admin-actions] no se pudo notificar a ${profileId}: ${error.message}`)
    return
  }

  const { data: profile } = await admin
    .from('profiles').select('push_token').eq('id', profileId).maybeSingle()

  if (!profile?.push_token) return

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: profile.push_token, sound: 'default', title, body }),
    })
  } catch (e) {
    console.error(`[admin-actions] push a ${profileId} falló: ${e}`)
  }
}

serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'falta el token' }, 401)
  }

  // 1) Quién es. Se resuelve con la anon key + el token del usuario, que es lo
  //    que hace que el propio Supabase valide la firma del JWT. No se confía en
  //    ningún dato del body para identificar a quien llama.
  const asCaller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: userErr } = await asCaller.auth.getUser()
  if (userErr || !user) return json({ error: 'token inválido' }, 401)

  // 2) ¿Es admin? Se consulta con service role a propósito: con el cliente del
  //    invocador, una política mal puesta podría devolver null y hacer que esto
  //    fallara abierto. Acá el default es cerrado.
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_admin) {
    console.warn(`[admin-actions] intento no autorizado de ${user.id}`)
    return json({ error: 'no autorizado' }, 403)
  }

  const actor = { adminId: user.id, adminEmail: user.email ?? null }

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'body inválido' }, 400)
  }

  switch (body.action) {
    // ── Aprobar / revocar una postulación ────────────────────────────────────
    // `verified` es el flag por el que `coachesCache` filtra el catálogo, así
    // que esto es literalmente lo que publica o despublica a un profesional.
    // Se soporta ponerlo en false además de en true: sirve para revocar una
    // aprobación por error o tras un reporte, sin borrarle la cuenta a nadie.
    //
    // ⚠️ Revocar NO es rechazar. Al despublicar se deja `application_status`
    // como está: la postulación fue efectivamente aprobada en su momento y
    // reescribirla a 'rechazada' borraría por qué el coach está afuera del
    // catálogo. Rechazar es la acción de abajo y solo aplica a lo que nunca
    // se aprobó.
    case 'set_coach_verified': {
      if (!body.coach_id) return json({ error: 'falta coach_id' }, 400)
      if (typeof body.verified !== 'boolean') return json({ error: 'verified tiene que ser booleano' }, 400)

      const patch: Record<string, unknown> = { verified: body.verified }
      if (body.verified) {
        patch.application_status = 'aprobada'
        patch.application_reviewed_at = new Date().toISOString()
        patch.application_notes = body.notes ?? null
      }

      const { data, error } = await admin
        .from('coaches')
        .update(patch)
        .eq('id', body.coach_id)
        .select('id, verified, profile_id, application_status')

      if (error) return json({ error: error.message }, 500)
      if (!data || data.length === 0) return json({ error: 'no existe ese coach' }, 404)

      const coach = data[0]

      const auditErr = await audit(admin, {
        ...actor,
        action: 'set_coach_verified',
        targetType: 'coach',
        targetId: coach.id,
        details: { verified: body.verified, notes: body.notes ?? null },
      })

      if (body.verified) {
        // 🔴 Hasta acá esto solo escribía `coaches.verified` — y `role` es lo
        // que `AuthRedirect`/`app/index.tsx` usa para mandar a `(coach)` vs
        // `(tabs)`. Sin esta línea, un coach aprobado por este mismo camino
        // se logueaba y volvía a caer en la app de USUARIO para siempre, sin
        // ningún error visible (encontrado 27/08/2026 con un alta real de
        // punta a punta — nadie lo había pisado porque los coaches de prueba
        // existentes se sembraron por SQL con el rol ya puesto a mano).
        // Ningún coach real había pasado por acá todavía, así que no hay
        // cuentas viejas para migrar — el fix alcanza desde ahora.
        //
        // ⚠️ No se toca al REVOCAR (`verified=false`, más abajo no hay rama
        // simétrica): revocar es "sacar del catálogo", no "convertir de nuevo
        // en usuario final" — mismo criterio que ya usa este archivo para no
        // reescribir `application_status` al revocar.
        await admin.from('profiles').update({ role: 'coach' }).eq('id', coach.profile_id)

        await notifyProfile(
          admin,
          coach.profile_id,
          'postulacion_aprobada',
          'Tu perfil ya está publicado',
          'Aprobamos tu postulación. Ya aparecés en Vita y podés recibir reservas.',
        )
      }

      return json({ result: 'ok', coach, ...(auditErr ? { warning: `acción hecha, auditoría fallida: ${auditErr}` } : {}) })
    }

    // ── Rechazar una postulación ─────────────────────────────────────────────
    // Antes no existía: `verified = false` significaba a la vez "nadie la miró"
    // y "la miramos y no", así que rechazar dejaba la fila igual que antes y la
    // postulación volvía a la cola para siempre. `application_status` separa
    // esas dos cosas.
    //
    // El motivo es OBLIGATORIO y le llega al coach. Un rechazo sin motivo lo
    // deja sin saber qué corregir, y como puede volver a postularse (el trigger
    // `trg_reset_application_on_edit` lo devuelve a la cola al editar), sin
    // motivo la segunda vuelta sería idéntica a la primera.
    case 'reject_coach_application': {
      if (!body.coach_id) return json({ error: 'falta coach_id' }, 400)
      const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
      if (!reason) return json({ error: 'hace falta un motivo para rechazar' }, 400)

      // El guard sobre `verified` evita el caso raro pero destructivo de
      // rechazar a alguien que ya está publicado: eso es revocar, y tiene su
      // propia acción. Sin el guard, un tap en la pantalla equivocada sacaría
      // del catálogo a un coach activo.
      const { data, error } = await admin
        .from('coaches')
        .update({
          application_status: 'rechazada',
          application_notes: reason,
          application_reviewed_at: new Date().toISOString(),
        })
        .eq('id', body.coach_id)
        .eq('verified', false)
        .select('id, profile_id, application_status')

      if (error) return json({ error: error.message }, 500)
      // Sin `.select()` PostgREST devuelve error null aunque no matchee ninguna
      // fila — hay que mirar las filas afectadas, no el error.
      if (!data || data.length === 0) {
        return json({ error: 'no existe ese coach, o ya está publicado (revocalo en vez de rechazarlo)' }, 404)
      }

      const coach = data[0]

      const auditErr = await audit(admin, {
        ...actor,
        action: 'reject_coach_application',
        targetType: 'coach',
        targetId: coach.id,
        details: { reason },
      })

      await notifyProfile(
        admin,
        coach.profile_id,
        'postulacion_rechazada',
        'Sobre tu postulación',
        `${reason} Podés corregirlo y volver a enviarla desde la app.`,
      )

      return json({ result: 'ok', coach, ...(auditErr ? { warning: `acción hecha, auditoría fallida: ${auditErr}` } : {}) })
    }

    // ── La escalera de sanciones ─────────────────────────────────────────────
    //
    // Advertencia → suspensión → baja. La aplica un HUMANO mirando un caso: no
    // hay ni va a haber un algoritmo que sancione solo (ver
    // `scripts/diagnostico-fuga.sql` — con la muestra de hoy, sancionar por
    // métrica le pegaría a tres inocentes por cada culpable).
    //
    // 🔴 El motivo es obligatorio y **se le muestra al coach tal cual se escribe
    // acá**. No es una nota interna: es lo que va a leer la persona sancionada.
    // Sin eso la sanción es un castigo secreto, que es lo que hace que una
    // plataforma se vuelva odiada — el coach ve que dejó de entrar gente, no
    // sabe por qué, y no puede corregir nada.
    case 'apply_sanction': {
      if (!body.coach_id) return json({ error: 'falta coach_id' }, 400)

      const nivel = String(body.nivel ?? '')
      if (!['advertencia', 'suspension', 'baja'].includes(nivel)) {
        return json({ error: 'nivel tiene que ser advertencia, suspension o baja' }, 400)
      }

      const motivo = String(body.motivo ?? '').trim()
      // El mismo piso que el CHECK de la tabla. Se valida acá también para
      // devolver un error legible en vez de un 500 de Postgres.
      if (motivo.length < 10) {
        return json({ error: 'el motivo es obligatorio y tiene que explicar algo (10 caracteres o más)' }, 400)
      }

      // `dias` solo aplica a la suspensión. La baja no vence y la advertencia no
      // restringe nada, así que en los dos casos mandar días sería mentir sobre
      // lo que va a pasar.
      let hasta: string | null = null
      if (nivel === 'suspension') {
        const dias = Number(body.dias)
        if (!Number.isFinite(dias) || dias < 1 || dias > 365) {
          return json({ error: 'una suspensión necesita dias entre 1 y 365' }, 400)
        }
        hasta = new Date(Date.now() + dias * 86_400_000).toISOString()
      } else if (nivel === 'baja') {
        hasta = 'infinity'
      }

      const { data: coachRow } = await admin
        .from('coaches').select('id, profile_id').eq('id', body.coach_id).maybeSingle()
      if (!coachRow) return json({ error: 'no existe ese coach' }, 404)

      const { data, error } = await admin
        .from('coach_sanctions')
        .insert({
          coach_id: body.coach_id,
          nivel,
          motivo,
          evidencia: typeof body.evidencia === 'string' ? body.evidencia.trim() || null : null,
          hasta,
          created_by: actor.adminId,
        })
        .select('id, nivel, motivo, hasta, created_at')
        .single()

      if (error) return json({ error: error.message }, 500)

      const auditErr = await audit(admin, {
        ...actor,
        action: 'apply_sanction',
        targetType: 'coach',
        targetId: body.coach_id,
        details: { nivel, motivo, hasta, sancion_id: data.id },
      })

      // El aviso. Dice el escalón, el motivo y qué implica — las tres cosas, o
      // el coach queda adivinando cuál de las tres le pasó.
      const queImplica =
        nivel === 'advertencia'
          ? 'No cambia nada en tu perfil: seguís apareciendo y recibiendo reservas. Queda registrada.'
          : nivel === 'suspension'
            ? 'Mientras dure no aparecés en la app y no podés recibir reservas nuevas. Las sesiones que ya tenés agendadas siguen en pie y las atendés normalmente.'
            : 'Tu perfil deja de estar publicado. Las sesiones que ya tenés agendadas siguen en pie y las atendés normalmente.'

      await notifyProfile(
        admin,
        coachRow.profile_id,
        'sancion_aplicada',
        nivel === 'advertencia' ? 'Una advertencia sobre tu cuenta' : 'Tu cuenta quedó suspendida',
        `${motivo} ${queImplica} Si creés que es un error, escribinos a ${EMAIL_CONTACTO}.`,
      )

      // ── La gente que lo tenía ──────────────────────────────────────────────
      // Una advertencia no cambia nada para nadie, así que no se avisa. Con una
      // suspensión o una baja, la persona que atendía con este profesional se
      // iba a enterar porque deja de encontrarlo.
      //
      // 🔴 El aviso NO dice que hubo una sanción. Dice que no está tomando
      // reservas nuevas y que lo ya agendado sigue en pie. Contarle a un cliente
      // que su profesional fue sancionado lo expone por algo que el cliente no
      // necesita saber para decidir, y que además puede levantarse.
      //
      // A quién: quien tuvo o tiene una reserva viva con él en los últimos 90
      // días. Más atrás ya no es "su profesional", y avisarle sería raro.
      let avisados = 0
      if (nivel !== 'advertencia') {
        const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())
        const desde = new Date(Date.now() - 90 * 86_400_000)
        const desdeStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(desde)

        const [{ data: reservas }, { data: perfilCoach }] = await Promise.all([
          admin.from('bookings')
            .select('id, user_id, scheduled_date, status')
            .eq('coach_id', body.coach_id)
            .in('status', ['pendiente', 'confirmada', 'completada'])
            .gte('scheduled_date', desdeStr)
            .order('scheduled_date', { ascending: true }),
          admin.from('profiles').select('name').eq('id', coachRow.profile_id).maybeSingle(),
        ])

        const nombre = (perfilCoach?.name as string | undefined)?.split(' ')[0] || 'Tu profesional'
        const porPersona = new Map<string, { proxima: { id: string; fecha: string } | null }>()
        for (const r of reservas ?? []) {
          const uid = r.user_id as string
          if (!porPersona.has(uid)) porPersona.set(uid, { proxima: null })
          const esFutura = (r.status === 'pendiente' || r.status === 'confirmada') && (r.scheduled_date as string) >= hoy
          const p = porPersona.get(uid)!
          if (esFutura && !p.proxima) p.proxima = { id: r.id as string, fecha: r.scheduled_date as string }
        }

        const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
        for (const [uid, { proxima }] of porPersona) {
          const que = nivel === 'baja'
            ? `${nombre} dejó de atender en Vita.`
            : `${nombre} no está tomando reservas nuevas por un tiempo.`
          const siguiente = proxima
            ? ` Tu sesión del ${ddmm(proxima.fecha)} sigue en pie.`
            : ' Si querés seguir mientras tanto, en Conexiones hay otros profesionales.'
          await notifyProfile(admin, uid, 'profesional_no_disponible', `Sobre ${nombre}`, que + siguiente, proxima?.id ?? null)
          avisados += 1
        }

        // A quién se avisó y por qué sanción: es lo que usa `sanction-returns`
        // para decirles, cuando termine, que volvió. Sin esta fila, a esa persona
        // nunca le llega el "volvió". No frena la sanción si falla: la sanción
        // y el aviso ya salieron, y perder el "volvió" es el mal menor.
        if (porPersona.size > 0) {
          const { error: notErr } = await admin.from('sanction_client_notices').upsert(
            [...porPersona.keys()].map(uid => ({ sancion_id: data.id, user_id: uid })),
            { onConflict: 'sancion_id,user_id', ignoreDuplicates: true },
          )
          if (notErr) console.error(`[admin-actions] no se anotaron los avisos de la sanción ${data.id}: ${notErr.message}`)
        }
      }

      return json({ result: 'ok', sancion: data, avisados, ...(auditErr ? { warning: `acción hecha, auditoría fallida: ${auditErr}` } : {}) })
    }

    // Levantar una sanción NO borra la fila: deja constancia de que se levantó y
    // por qué. El historial tiene que poder contar también los errores nuestros.
    case 'revoke_sanction': {
      if (!body.sancion_id) return json({ error: 'falta sancion_id' }, 400)
      const motivo = String(body.motivo ?? '').trim()
      if (!motivo) return json({ error: 'hace falta decir por qué se levanta' }, 400)

      const { data, error } = await admin
        .from('coach_sanctions')
        .update({
          revocada_at: new Date().toISOString(),
          revocada_por: actor.adminId,
          revocada_motivo: motivo,
        })
        .eq('id', body.sancion_id)
        .is('revocada_at', null)
        .select('id, coach_id, nivel')

      if (error) return json({ error: error.message }, 500)
      if (!data || data.length === 0) return json({ error: 'no existe esa sanción, o ya estaba levantada' }, 404)

      const auditErr = await audit(admin, {
        ...actor,
        action: 'revoke_sanction',
        targetType: 'coach',
        targetId: data[0].coach_id,
        details: { sancion_id: data[0].id, nivel: data[0].nivel, motivo },
      })

      const { data: coachRow } = await admin
        .from('coaches').select('profile_id').eq('id', data[0].coach_id).maybeSingle()

      if (coachRow?.profile_id && data[0].nivel !== 'advertencia') {
        await notifyProfile(
          admin,
          coachRow.profile_id,
          'sancion_levantada',
          'Tu cuenta vuelve a estar activa',
          `${motivo} Ya volvés a aparecer en la app y a recibir reservas.`,
        )
      }

      return json({ result: 'ok', sancion: data[0], ...(auditErr ? { warning: `acción hecha, auditoría fallida: ${auditErr}` } : {}) })
    }

    // El historial completo, vigentes y levantadas. Va por acá y no con la anon
    // key porque el RLS de `coach_sanctions` solo le deja a cada coach ver las
    // suyas — el panel necesita verlas todas.
    case 'list_sanctions': {
      const { data, error } = await admin
        .from('coach_sanctions')
        .select('id, coach_id, nivel, motivo, evidencia, hasta, created_at, revocada_at, revocada_motivo, coaches!inner(profile_id, profiles!inner(name)), coach_sanction_evidence(id, mime, created_at)')
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) return json({ error: error.message }, 500)

      return json({
        result: 'ok',
        sanciones: (data ?? []).map((r: any) => {
          const c = Array.isArray(r.coaches) ? r.coaches[0] : r.coaches
          const p = c && (Array.isArray(c.profiles) ? c.profiles[0] : c.profiles)
          return {
            id: r.id,
            coachId: r.coach_id,
            coachName: p?.name ?? 'Sin nombre',
            nivel: r.nivel,
            motivo: r.motivo,
            evidencia: r.evidencia ?? null,
            hasta: r.hasta ?? null,
            createdAt: r.created_at,
            revocadaAt: r.revocada_at ?? null,
            revocadaMotivo: r.revocada_motivo ?? null,
            adjuntos: (r.coach_sanction_evidence ?? [])
              .map((e: any) => ({ id: e.id, mime: e.mime, createdAt: e.created_at }))
              .sort((x: any, y: any) => String(x.createdAt).localeCompare(String(y.createdAt))),
          }
        }),
      })
    }

    // ── Avisos de contacto, para revisar ─────────────────────────────────────
    //
    // Hasta el 16/09/2026 cada aviso quedaba en `analytics_events` y nadie lo
    // miraba: la detección y la escalera de sanciones estaban desconectadas.
    //
    // 🔴 No se confía en el evento a ciegas. Las propiedades las arma el teléfono;
    // lo único que garantiza la base es QUIÉN lo escribió (`user_id`, desde que se
    // borró `analytics_insert_auth` — ver `add-contact-signals-panel.sql`). Así
    // que un aviso "del coach" solo cuenta si lo escribió ese coach, y uno "de la
    // persona" solo si lo escribió esa persona. Lo que no cierra se descarta y se
    // informa cuántos: si ese número crece, alguien está intentando fabricarlos.
    //
    // Y ninguno es una prueba. Es una lista de casos para mirar; la prueba es la
    // conversación, y la decisión es de una persona.
    case 'list_contact_signals': {
      const desde = new Date(Date.now() - 90 * 86_400_000).toISOString()
      const { data: eventos, error } = await admin
        .from('analytics_events')
        .select('user_id, properties, created_at')
        .eq('event_name', 'mensaje_contacto_detectado')
        .gte('created_at', desde)
        .order('created_at', { ascending: true })
        .limit(5000)
      if (error) return json({ error: error.message }, 500)

      type Par = { userId: string; avisos: number; primero: string }
      type Grupo = {
        coachProfileId: string
        delCoach: number; bloqueados: number; enviadosIgual: number; deLaPersona: number
        canales: Record<string, number>; senales: Record<string, number>
        pares: Map<string, Par>; ultimo: string
      }
      const grupos = new Map<string, Grupo>()
      let descartados = 0

      for (const ev of eventos ?? []) {
        const p = (ev.properties ?? {}) as Record<string, any>
        const coach = typeof p.coach_id === 'string' ? p.coach_id : null
        const autorEsperado = p.role === 'coach' ? coach : (typeof p.user_id === 'string' ? p.user_id : null)
        if (!coach || !ev.user_id || ev.user_id !== autorEsperado) { descartados += 1; continue }

        if (!grupos.has(coach)) {
          grupos.set(coach, { coachProfileId: coach, delCoach: 0, bloqueados: 0, enviadosIgual: 0, deLaPersona: 0, canales: {}, senales: {}, pares: new Map(), ultimo: ev.created_at })
        }
        const g = grupos.get(coach)!
        if (p.role === 'coach') g.delCoach += 1; else g.deLaPersona += 1
        if (p.bloqueado === true) g.bloqueados += 1
        if (p.sent_anyway === true) g.enviadosIgual += 1
        const canal = String(p.canal ?? 'chat'); g.canales[canal] = (g.canales[canal] ?? 0) + 1
        const senal = String(p.senal ?? 'sin_dato'); g.senales[senal] = (g.senales[senal] ?? 0) + 1
        g.ultimo = ev.created_at
        if (typeof p.user_id === 'string') {
          const par = g.pares.get(p.user_id) ?? { userId: p.user_id, avisos: 0, primero: ev.created_at }
          par.avisos += 1
          g.pares.set(p.user_id, par)
        }
      }

      const coachProfileIds = [...grupos.keys()]
      const userIds = [...new Set([...grupos.values()].flatMap(g => [...g.pares.keys()]))]
      const [{ data: perfiles }, { data: coachRows }] = await Promise.all([
        admin.from('profiles').select('id, name').in('id', [...coachProfileIds, ...userIds].length ? [...coachProfileIds, ...userIds] : ['00000000-0000-0000-0000-000000000000']),
        admin.from('coaches').select('id, profile_id').in('profile_id', coachProfileIds.length ? coachProfileIds : ['00000000-0000-0000-0000-000000000000']),
      ])
      const nombre = new Map((perfiles ?? []).map((x: any) => [x.id as string, (x.name as string) ?? 'Sin nombre']))
      const coachIdDe = new Map((coachRows ?? []).map((x: any) => [x.profile_id as string, x.id as string]))

      // ¿Siguió reservando después del primer aviso? Es la otra mitad de la firma
      // de la fuga: intercambio de contacto + dejó de reservar.
      const coachIds = [...coachIdDe.values()]
      const { data: reservas } = coachIds.length && userIds.length
        ? await admin.from('bookings').select('coach_id, user_id, created_at, status')
            .in('coach_id', coachIds).in('user_id', userIds).neq('status', 'cancelada')
        : { data: [] as any[] }

      const coaches = [...grupos.values()].map(g => {
        const coachId = coachIdDe.get(g.coachProfileId) ?? null
        const personas = [...g.pares.values()].map(par => ({
          userId: par.userId,
          nombre: nombre.get(par.userId) ?? 'Sin nombre',
          avisos: par.avisos,
          siguioReservando: (reservas ?? []).some((r: any) =>
            r.coach_id === coachId && r.user_id === par.userId && r.created_at > par.primero),
        }))
        return {
          coachProfileId: g.coachProfileId, coachId, nombre: nombre.get(g.coachProfileId) ?? 'Sin nombre',
          delCoach: g.delCoach, bloqueados: g.bloqueados, enviadosIgual: g.enviadosIgual, deLaPersona: g.deLaPersona,
          canales: g.canales, senales: g.senales, ultimo: g.ultimo, personas,
        }
      })
      // Primero lo que escribió el coach — es lo que no puede fabricar nadie más.
      coaches.sort((a, b) => (b.bloqueados - a.bloqueados) || (b.delCoach - a.delCoach) || (b.deLaPersona - a.deLaPersona))

      return json({ result: 'ok', coaches, descartados })
    }

    // ── Adjuntos de evidencia ────────────────────────────────────────────────
    //
    // Tres pasos y no uno, para que el archivo NUNCA pase por esta función (una
    // captura de 5MB en base64 dentro de un JSON es lenta y frágil):
    //   1. `sanction_evidence_upload` — valida al admin y la sanción, elige el
    //      path, y devuelve una URL de subida firmada a ESE path.
    //   2. el cliente sube el archivo directo a storage con esa URL.
    //   3. `sanction_evidence_register` — confirma que el objeto existe y lo
    //      anota. Si el paso 2 falló, no queda una fila apuntando a la nada.
    //
    // El bucket no tiene ninguna policy: esta función es la única puerta, igual
    // que con `coach-credentials`.
    case 'sanction_evidence_upload': {
      if (!body.sancion_id) return json({ error: 'falta sancion_id' }, 400)
      const mime = String(body.mime ?? '')
      if (!EVIDENCE_MIMES[mime]) {
        return json({ error: 'solo imágenes (jpg, png, webp, heic) o PDF' }, 400)
      }

      const { data: sancion } = await admin
        .from('coach_sanctions').select('id').eq('id', body.sancion_id).maybeSingle()
      if (!sancion) return json({ error: 'no existe esa sanción' }, 404)

      // El path lo decide el servidor, nunca el cliente: así un admin no puede
      // pisar la evidencia de otra sanción eligiendo a mano el nombre.
      const path = `${sancion.id}/${crypto.randomUUID()}.${EVIDENCE_MIMES[mime]}`
      const { data: signed, error: signErr } = await admin
        .storage.from('sanction-evidence')
        .createSignedUploadUrl(path)

      if (signErr || !signed) return json({ error: signErr?.message ?? 'no se pudo firmar la subida' }, 500)
      return json({ result: 'ok', path: signed.path, token: signed.token })
    }

    case 'sanction_evidence_register': {
      if (!body.sancion_id || !body.path) return json({ error: 'falta sancion_id o path' }, 400)
      const path = String(body.path)
      const mime = String(body.mime ?? '')
      if (!EVIDENCE_MIMES[mime]) return json({ error: 'tipo de archivo no permitido' }, 400)

      // El path tiene que ser de ESTA sanción. Sin este chequeo se podría colgar
      // de una sanción un archivo subido para otra.
      const [carpeta, archivo] = path.split('/')
      if (carpeta !== String(body.sancion_id) || !archivo) {
        return json({ error: 'ese archivo no pertenece a esta sanción' }, 400)
      }

      // Que el objeto exista de verdad: si la subida falló a mitad de camino, no
      // se registra nada.
      const { data: listado } = await admin
        .storage.from('sanction-evidence')
        .list(carpeta, { search: archivo, limit: 1 })
      if (!listado || listado.length === 0) {
        return json({ error: 'el archivo no llegó a subirse' }, 409)
      }

      const { data: sancion } = await admin
        .from('coach_sanctions').select('id, coach_id').eq('id', carpeta).maybeSingle()
      if (!sancion) return json({ error: 'no existe esa sanción' }, 404)

      const { data, error } = await admin
        .from('coach_sanction_evidence')
        .insert({ sancion_id: sancion.id, file_path: path, mime, created_by: actor.adminId })
        .select('id, mime, created_at')
        .single()
      if (error) return json({ error: error.message }, 500)

      const auditErr = await audit(admin, {
        ...actor,
        action: 'sanction_evidence_register',
        targetType: 'coach',
        targetId: sancion.coach_id,
        details: { sancion_id: sancion.id, evidencia_id: data.id, mime },
      })

      return json({ result: 'ok', adjunto: data, ...(auditErr ? { warning: `acción hecha, auditoría fallida: ${auditErr}` } : {}) })
    }

    // Mirar un adjunto. 5 minutos y auditado, igual que un documento de
    // identidad: es muy probable que la captura tenga mensajes privados de un
    // cliente, y tiene que constar quién la abrió.
    case 'sanction_evidence_url': {
      if (!body.evidencia_id) return json({ error: 'falta evidencia_id' }, 400)

      const { data: ev } = await admin
        .from('coach_sanction_evidence')
        .select('id, file_path, sancion_id, coach_sanctions!inner(coach_id)')
        .eq('id', body.evidencia_id)
        .maybeSingle()
      if (!ev) return json({ error: 'no existe ese adjunto' }, 404)

      const { data: signed, error: signErr } = await admin
        .storage.from('sanction-evidence')
        .createSignedUrl(ev.file_path, 300)
      if (signErr || !signed) return json({ error: signErr?.message ?? 'no se pudo firmar' }, 500)

      const s2: any = Array.isArray((ev as any).coach_sanctions) ? (ev as any).coach_sanctions[0] : (ev as any).coach_sanctions
      await audit(admin, {
        ...actor,
        action: 'sanction_evidence_url',
        targetType: 'coach',
        targetId: s2?.coach_id ?? ev.sancion_id,
        details: { sancion_id: ev.sancion_id, evidencia_id: ev.id },
      })

      return json({ result: 'ok', url: signed.signedUrl, expires_in: 300 })
    }

    // ── Moderar un reporte ───────────────────────────────────────────────────
    // ── Responder un problema con una sesión (`session_issues`) ───────────────
    // La respuesta se guarda en el caso y la persona la lee en la Sala. El
    // aviso (campana, push y mail) NO lleva el texto: el push se ve con el
    // teléfono bloqueado, y la respuesta puede hablar de su sesión o su pago.
    case 'respond_session_issue': {
      if (!body.issue_id) return json({ error: 'falta issue_id' }, 400)
      if (!['en_revision', 'resuelto'].includes(body.estado)) {
        return json({ error: 'estado tiene que ser en_revision o resuelto' }, 400)
      }
      const respuesta = typeof body.respuesta === 'string' ? body.respuesta.trim() : ''
      if (!respuesta) return json({ error: 'falta la respuesta' }, 400)
      if (respuesta.length > 2000) return json({ error: 'la respuesta es muy larga (máx. 2000)' }, 400)

      const { data, error } = await admin
        .from('session_issues')
        .update({
          estado: body.estado,
          respuesta,
          respondido_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', body.issue_id)
        .select('id, booking_id, reporter_id, estado')

      if (error) return json({ error: error.message }, 500)
      if (!data || data.length === 0) return json({ error: 'no existe ese caso' }, 404)
      const caso = data[0]

      await notifyProfile(
        admin,
        caso.reporter_id,
        'problema_sesion_respondido',
        'Te respondimos sobre tu sesión',
        'Entrá al chat de esa sesión y tocá "Ver tu reporte" para leer la respuesta.',
        caso.booking_id,
      )

      const auditErr = await audit(admin, {
        ...actor,
        action: 'respond_session_issue',
        targetType: 'session_issue',
        targetId: caso.id,
        details: { estado: caso.estado },
      })

      return json({ result: 'ok', issue: caso, ...(auditErr ? { warning: `acción hecha, auditoría fallida: ${auditErr}` } : {}) })
    }

    case 'resolve_report': {
      if (!body.report_id) return json({ error: 'falta report_id' }, 400)
      if (!REPORT_STATUSES.includes(body.status)) {
        return json({ error: `status tiene que ser uno de: ${REPORT_STATUSES.join(', ')}` }, 400)
      }

      const { data, error } = await admin
        .from('reports')
        .update({ status: body.status })
        .eq('id', body.report_id)
        .select('id, status')

      if (error) return json({ error: error.message }, 500)
      if (!data || data.length === 0) return json({ error: 'no existe ese reporte' }, 404)

      const auditErr = await audit(admin, {
        ...actor,
        action: 'resolve_report',
        targetType: 'report',
        targetId: data[0].id,
        details: { status: body.status },
      })

      return json({ result: 'ok', report: data[0], ...(auditErr ? { warning: `acción hecha, auditoría fallida: ${auditErr}` } : {}) })
    }

    // Marca un reembolso de USDT como pagado. El envío se hace A MANO desde la
    // billetera de VIVE — automatizarlo exigiría la clave privada en un secret
    // del backend, y quien accediera a ese secret vaciaría la wallet entera, no
    // solo el monto de un reembolso. Con el volumen actual no se justifica.
    //
    // Por eso esta acción **registra**, no transfiere: el hash es la prueba de
    // que la plata salió, y sin él no se puede marcar nada.
    case 'mark_usdt_refunded': {
      if (!body.booking_id) return json({ error: 'falta booking_id' }, 400)
      const tx = String(body.refund_tx_id ?? '').trim()
      // 64 hexadecimales: el formato de un hash de transacción en Tron. Sin esta
      // validación se podría marcar como reembolsado escribiendo cualquier cosa,
      // y el registro dejaría de ser una prueba.
      if (!/^[0-9a-fA-F]{64}$/.test(tx)) {
        return json({ error: 'refund_tx_id tiene que ser el hash de la transacción (64 hexadecimales)' }, 400)
      }

      const { data, error } = await admin
        .from('bookings')
        .update({
          payment_status: 'reembolsado',
          refunded_at: new Date().toISOString(),
          refund_tx_id: tx,
        })
        .eq('id', body.booking_id)
        .eq('payment_provider', 'usdt')
        .eq('payment_status', 'reembolso_pendiente')   // idempotente: no repisa uno ya hecho
        .select('id, usdt_amount, refund_tx_id')

      if (error) return json({ error: error.message }, 500)
      if (!data || data.length === 0) {
        return json({ error: 'no hay un reembolso de USDT pendiente con ese id' }, 404)
      }

      const auditErr = await audit(admin, {
        ...actor,
        action: 'mark_usdt_refunded',
        targetType: 'booking',
        targetId: data[0].id,
        // Misma forma que arriba (D8). `monto` ya estaba; se le suman los otros
        // campos para que la vista no tenga que adivinar por acción.
        details: { monto: data[0].usdt_amount, tx, moneda: 'USD', riel: 'usdt', referencia: tx },
      })

      return json({ result: 'ok', booking: data[0], ...(auditErr ? { warning: `acción hecha, auditoría fallida: ${auditErr}` } : {}) })
    }

    // Pago al coach de sus sesiones del riel internacional.
    //
    // Igual que el reembolso de USDT: la transferencia se hace a mano (banco o
    // billetera) y esto solo deja constancia. Automatizarla exigiría la clave
    // privada de la wallet en un secret del backend, y con este volumen el
    // riesgo no se justifica.
    //
    // En LOTE porque una transferencia semanal cubre varias sesiones: marcarlas
    // de a una dejaría la mitad pagada si la app se cierra en el medio, y ahí no
    // hay forma de saber cuáles entraron en la transferencia que ya salió.
    case 'mark_coach_paid': {
      const ids = Array.isArray(body.booking_ids) ? body.booking_ids.map(String) : []
      if (ids.length === 0) return json({ error: 'falta booking_ids' }, 400)

      // Texto libre, a diferencia del hash de 64 hex de `mark_usdt_refunded`:
      // acá el pago puede haber sido una transferencia bancaria, que no tiene
      // hash. Se exige que haya ALGO — sin comprobante el registro no prueba
      // nada— pero no un formato, porque conviven dos.
      const ref = String(body.payout_reference ?? '').trim()
      if (ref.length < 6) {
        return json({ error: 'payout_reference: poné el hash de la tx o el número de operación' }, 400)
      }

      const { data, error } = await admin
        .from('bookings')
        .update({ paid_out_at: new Date().toISOString(), payout_reference: ref })
        .in('id', ids)
        .neq('payment_provider', 'mp')          // con MP el split ya le pagó
        .eq('status', 'completada')             // solo sesiones ya realizadas
        .eq('payment_status', 'aprobado')
        .is('paid_out_at', null)                // idempotente: no repisa un pago ya hecho
        .select('id, coach_id, amount, platform_fee_pct, payment_provider')

      if (error) return json({ error: error.message }, 500)
      if (!data || data.length === 0) {
        return json({ error: 'ninguna de esas reservas está pendiente de pago' }, 404)
      }

      // Que se hayan marcado MENOS de las pedidas no es un error, pero tiene que
      // verse: significa que alguna ya estaba paga o cambió de estado mientras
      // el panel mostraba la lista vieja. Callarlo dejaría creer que la
      // transferencia cubrió sesiones que siguen impagas.
      const parcial = data.length !== ids.length

      const auditErr = await audit(admin, {
        ...actor,
        action: 'mark_coach_paid',
        targetType: 'booking',
        targetId: data[0].id,
        details: {
          coach_id: data[0].coach_id,
          bookings: data.map(b => b.id),
          pedidas: ids.length,
          marcadas: data.length,
          reference: ref,
          // ── Forma acordada para las operaciones de dinero (D8) ──────────────
          // Hasta el 25/08/2026 esta acción NO guardaba cuánto se transfirió, así
          // que se podía saber quién pagó y a quién, pero no cuánto. La vista
          // `operaciones_de_dinero` saca estos campos tipados.
          monto: Math.round(
            data.reduce((acc, b) => {
              const amount = Number(b.amount ?? 0)
              const pct = Number(b.platform_fee_pct ?? 20)
              return acc + (amount - marketplaceFeeFor(amount, pct))
            }, 0) * 100,
          ) / 100,
          // Estos pagos son siempre del riel internacional (`neq('payment_provider','mp')`
          // en el update de arriba), y ahí el precio del coach está en dólares.
          moneda: 'USD',
          // Con la regla espejo (D4) un pago cubre un solo riel: el panel agrupa
          // por `(coach, riel)` justamente porque son dos envíos por vías que no
          // se cruzan. Si alguna vez llegaran mezcladas, queda constancia.
          riel: [...new Set(data.map(b => b.payment_provider))].join('+'),
          referencia: ref,
        },
      })

      // Los dos avisos se concatenan en vez de ir en claves separadas: como
      // `warning` es una sola, ponerla dos veces con un spread condicional haría
      // que la segunda pisara a la primera en silencio.
      const avisos = [
        parcial ? `se marcaron ${data.length} de ${ids.length}: el resto ya no estaba pendiente` : null,
        auditErr ? `acción hecha, auditoría fallida: ${auditErr}` : null,
      ].filter(Boolean)

      return json({
        result: 'ok',
        marcadas: data.length,
        pedidas: ids.length,
        ...(avisos.length ? { warning: avisos.join(' · ') } : {}),
      })
    }

    // ── Credenciales: la cola de revisión ────────────────────────────────────
    // 🔴 Todo esto pasa por acá y no por el cliente porque el bucket
    // `coach-credentials` es PRIVADO —el primero del proyecto— y la tabla no
    // tiene policy de lectura para admins a propósito: la única puerta al
    // documento es esta función, con service role. Una policy de admin en
    // storage sería una segunda puerta que mantener sincronizada con
    // `profiles.is_admin`.
    case 'list_pending_credentials': {
      const { data, error } = await admin
        .from('coach_credentials')
        .select('id, coach_id, kind, title, institution, year, registration_number, file_path, created_at, review_notes, coaches(profile_id, specialty, profiles(name))')
        .eq('status', 'pendiente')
        .order('created_at', { ascending: true })
        .limit(100)

      if (error) return json({ error: error.message }, 500)

      // 📌 Para cada coach de la lista, si YA tiene una matrícula verificada.
      // Sirve para lo que el panel muestra al revisar: aprobar un título de una
      // profesión de salud a alguien que no tiene matrícula cargada NO le
      // habilita la marca de profesional en su perfil — y el 03/09/2026 eso
      // desconcertó de verdad. El admin tiene que poder verlo antes de aprobar.
      const coachIds = [...new Set((data ?? []).map((c: any) => c.coach_id))]
      const conMatricula = new Set<string>()
      if (coachIds.length > 0) {
        const { data: mats } = await admin
          .from('coach_credentials')
          .select('coach_id')
          .in('coach_id', coachIds)
          .eq('kind', 'matricula')
          .eq('status', 'verificada')
        for (const m of mats ?? []) conMatricula.add((m as any).coach_id)
      }

      // `file_path` se devuelve solo para saber SI hay documento; la URL firmada
      // se pide aparte y queda registrada en el log de la función.
      return json({
        result: 'ok',
        credentials: (data ?? []).map((c: any) => ({
          coach_has_matricula: conMatricula.has(c.coach_id),
          id: c.id,
          coach_id: c.coach_id,
          coach_name: c.coaches?.profiles?.name ?? null,
          specialty: c.coaches?.specialty ?? null,
          kind: c.kind,
          title: c.title,
          institution: c.institution,
          year: c.year,
          registration_number: c.registration_number,
          has_file: !!c.file_path,
          review_notes: c.review_notes,
          created_at: c.created_at,
        })),
      })
    }

    // Una URL firmada y corta para mirar el documento. No se devuelve nunca al
    // usuario final: esta acción exige `is_admin`, igual que todas las de acá.
    case 'credential_file_url': {
      if (!body.credential_id) return json({ error: 'falta credential_id' }, 400)

      const { data: cred, error } = await admin
        .from('coach_credentials')
        .select('id, file_path')
        .eq('id', body.credential_id)
        .maybeSingle()

      if (error) return json({ error: error.message }, 500)
      if (!cred) return json({ error: 'no existe esa credencial' }, 404)
      if (!cred.file_path) return json({ error: 'esa credencial no tiene documento' }, 404)

      // 5 minutos: lo justo para mirarlo. Un link largo que se filtre por
      // pantalla compartida o historial es el documento entero regalado.
      const { data: signed, error: signErr } = await admin
        .storage.from('coach-credentials')
        .createSignedUrl(cred.file_path, 300)

      if (signErr || !signed) return json({ error: signErr?.message ?? 'no se pudo firmar' }, 500)

      // Se audita MIRAR, no solo decidir: es un documento de identidad y tiene
      // que quedar quién lo abrió.
      await audit(admin, {
        ...actor,
        action: 'credential_file_url',
        targetType: 'coach_credential',
        targetId: cred.id,
        details: {},
      })

      return json({ result: 'ok', url: signed.signedUrl, expires_in: 300 })
    }

    case 'review_credential': {
      if (!body.credential_id) return json({ error: 'falta credential_id' }, 400)
      if (typeof body.verified !== 'boolean') return json({ error: 'verified tiene que ser booleano' }, 400)
      // Rechazar sin decir por qué deja al coach sin nada que corregir, así que
      // el motivo es obligatorio en ese lado y opcional en el otro.
      if (!body.verified && !String(body.notes ?? '').trim()) {
        return json({ error: 'para rechazar hace falta un motivo' }, 400)
      }

      // 🔴 23/09/2026. Una matrícula verificada dice DE QUÉ profesión es, y lo
      // decide quien mira el documento, no el texto que escribió el profesional.
      // De esto sale `coaches.profesion` (trigger), que es lo único que la app
      // usa para mostrar "Psicólogo" o "Nutricionista".
      const { data: actual, error: leerErr } = await admin
        .from('coach_credentials').select('kind').eq('id', body.credential_id).maybeSingle()
      if (leerErr) return json({ error: leerErr.message }, 500)
      if (!actual) return json({ error: 'no existe esa credencial' }, 404)
      const esMatricula = actual.kind === 'matricula'
      if (body.verified && esMatricula && !PROFESIONES.includes(body.profesion)) {
        return json({ error: `para verificar una matrícula hace falta la profesión: ${PROFESIONES.join(', ')}` }, 400)
      }

      const { data, error } = await admin
        .from('coach_credentials')
        .update({
          status: body.verified ? 'verificada' : 'rechazada',
          review_notes: body.notes ?? null,
          reviewed_at: new Date().toISOString(),
          profesion: body.verified && esMatricula ? body.profesion : null,
        })
        .eq('id', body.credential_id)
        .select('id, title, coach_id, coaches(profile_id)')

      if (error) return json({ error: error.message }, 500)
      if (!data || data.length === 0) return json({ error: 'no existe esa credencial' }, 404)

      const cred: any = data[0]

      const auditErr = await audit(admin, {
        ...actor,
        action: 'review_credential',
        targetType: 'coach_credential',
        targetId: cred.id,
        details: { verified: body.verified, notes: body.notes ?? null, profesion: body.verified && esMatricula ? body.profesion : null },
      })

      const profileId = cred.coaches?.profile_id
      if (profileId) {
        if (body.verified) {
          await notifyProfile(
            admin, profileId, 'credencial_verificada',
            'Credencial verificada ✓',
            `«${cred.title}» ya se muestra en tu perfil con la marca de verificada.`,
          )
        } else {
          await notifyProfile(
            admin, profileId, 'credencial_rechazada',
            'Revisá tu credencial',
            `No pudimos verificar «${cred.title}». ${body.notes}`,
          )
        }
      }

      return json({
        result: 'ok',
        status: body.verified ? 'verificada' : 'rechazada',
        ...(auditErr ? { warning: `acción hecha, auditoría fallida: ${auditErr}` } : {}),
      })
    }

    // ── Postulaciones de coaches: la cola de revisión ────────────────────────
    // 🔴 Lee el MAIL del coach, y por eso pasa por acá y no por el cliente
    // (A4 fase 2, docs/problemas-abiertos.md). Con la lectura client-side
    // —`profiles!inner(name, email)` desde `lib/admin.ts`— cualquier usuario
    // logueado podía leer el mail de todos los coaches: el mismo agujero de A4,
    // una puerta más adentro. Acá se lee con service role, DESPUÉS de confirmar
    // `is_admin` arriba. Es una lectura, así que no se audita (mismo criterio
    // que `list_pending_credentials`).
    case 'list_coach_applications': {
      const status = body.status ?? 'pendiente'
      if (!['pendiente', 'aprobada', 'rechazada'].includes(status)) {
        return json({ error: `status inválido: ${status}` }, 400)
      }

      const { data, error } = await admin
        .from('coaches')
        .select('id, profile_id, specialty, bio, price_per_session, nationality, application_video_url, created_at, verified, application_status, application_notes, application_reviewed_at, profiles!inner(name, email)')
        .eq('application_status', status)
        .order('created_at', { ascending: true })

      if (error) return json({ error: error.message }, 500)

      return json({
        result: 'ok',
        // Se devuelve ya mapeado a la forma que consume el panel (`PendingCoach`),
        // para que el mapeo viva en un solo lado.
        applications: (data ?? []).map((c: any) => {
          const p = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles
          return {
            coachId: c.id,
            profileId: c.profile_id,
            name: p?.name ?? 'Sin nombre',
            email: p?.email ?? null,
            specialty: c.specialty ?? '',
            bio: c.bio ?? null,
            price: c.price_per_session ?? null,
            nationality: c.nationality ?? null,
            applicationVideoUrl: c.application_video_url ?? null,
            createdAt: c.created_at ?? null,
            verified: !!c.verified,
            status: c.application_status ?? 'pendiente',
            notes: c.application_notes ?? null,
            reviewedAt: c.application_reviewed_at ?? null,
          }
        }),
      })
    }

    default:
      return json({ error: `acción desconocida: ${body.action}` }, 400)
  }
})
