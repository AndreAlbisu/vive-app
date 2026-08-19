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

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const REPORT_STATUSES = ['revisado', 'accionado', 'descartado']

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
    targetType: 'coach' | 'report' | 'booking'
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
async function notifyCoach(
  admin: SupabaseClient,
  profileId: string,
  type: 'postulacion_aprobada' | 'postulacion_rechazada',
  title: string,
  body: string,
): Promise<void> {
  const { error } = await admin.from('notifications').insert({
    recipient_id: profileId,
    type,
    title,
    body,
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
        await notifyCoach(
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

      await notifyCoach(
        admin,
        coach.profile_id,
        'postulacion_rechazada',
        'Sobre tu postulación',
        `${reason} Podés corregirlo y volver a enviarla desde la app.`,
      )

      return json({ result: 'ok', coach, ...(auditErr ? { warning: `acción hecha, auditoría fallida: ${auditErr}` } : {}) })
    }

    // ── Moderar un reporte ───────────────────────────────────────────────────
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
        details: { monto: data[0].usdt_amount, tx },
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
        .select('id, coach_id, amount, platform_fee_pct')

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

    default:
      return json({ error: `acción desconocida: ${body.action}` }, 400)
  }
})
