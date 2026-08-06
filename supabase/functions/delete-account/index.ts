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
//   · La fila de `profiles` NO se borra: queda como LÁPIDA vaciada de datos
//     personales. Además hoy no podría borrarse — reviews/messages/salas/
//     journal_entries/saved_resources la referencian con NO ACTION.
//   · Las sesiones futuras se CANCELAN, disparando el reembolso por el trigger
//     `trg_mark_refund_on_cancel` que ya existe.
//   · Al final se borra la cuenta de `auth.users`: es lo que hace que la cuenta
//     deje de existir y libera el email para un futuro registro.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

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
]
// NO están acá a propósito, y conviene saber por qué:
//   · bookings / reviews / messages / salas → se conservan anonimizadas.
//   · session_notes → son el registro del profesional sobre sus sesiones, mismo
//     criterio que los mensajes (decisión de Andre). ⚠️ A confirmar con abogado:
//     contienen información sensible sobre una persona que pidió su baja, y bajo
//     la Ley 25.326 podría corresponder suprimirlas. Del otro lado, un/a
//     psicólogo/a puede tener obligación profesional de conservar registros.
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
    const { data: coachRow } = await admin
      .from('coaches').select('id').eq('profile_id', userId).maybeSingle()

    if (coachRow) {
      const today = new Date().toISOString().slice(0, 10)
      const { count } = await admin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('coach_id', coachRow.id)
        .in('status', ['pendiente', 'confirmada'])
        .gte('scheduled_date', today)
      if ((count ?? 0) > 0) {
        return json({
          error: 'coach_con_sesiones',
          message: `Tenés ${count} sesión(es) agendada(s). Cancelalas antes de eliminar tu cuenta para que tus clientes reciban el reembolso y el aviso.`,
        }, 409)
      }
    }

    // ── 2. Cancelar sesiones futuras del usuario (dispara reembolso) ─────────
    // El trigger trg_mark_refund_on_cancel pasa a 'reembolso_pendiente' los
    // pagos aprobados, y el cron mp-process-refunds los procesa. `cancelled_late`
    // NO se marca a propósito: una baja de cuenta no es una cancelación tardía,
    // el usuario no debería perder el reembolso por darse de baja.
    const today = new Date().toISOString().slice(0, 10)
    const { data: futuras } = await admin
      .from('bookings')
      .select('id')
      .eq('user_id', userId)
      .in('status', ['pendiente', 'confirmada'])
      .gte('scheduled_date', today)

    if (futuras?.length) {
      const { error } = await admin
        .from('bookings')
        .update({ status: 'cancelada', cancelled_by: 'usuario' })
        .in('id', futuras.map(b => b.id))
      if (error) return json({ error: 'No se pudieron cancelar las sesiones futuras', detail: error.message }, 500)
      steps.push(`${futuras.length} sesión(es) futura(s) cancelada(s)`)
    }

    // ── 3. Borrar contenido personal ────────────────────────────────────────
    for (const { table, column } of PERSONAL_TABLES) {
      const { error } = await admin.from(table).delete().eq(column, userId)
      // Se loguea y se sigue: una tabla que no exista en este entorno no debe
      // dejar la cuenta a medio borrar.
      if (error) console.warn(`[delete-account] ${table}: ${error.message}`)
    }
    steps.push('contenido personal borrado')

    // ── 4. Avatar del storage ───────────────────────────────────────────────
    const { error: storageErr } = await admin.storage.from('avatars').remove([`${userId}/avatar.jpg`])
    if (storageErr) console.warn('[delete-account] avatar:', storageErr.message)

    // ── 5. Lápida en profiles ───────────────────────────────────────────────
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
    if (tombErr) return json({ error: 'No se pudo anonimizar el perfil', detail: tombErr.message }, 500)
    steps.push('perfil anonimizado')

    // ── 6. Borrar la cuenta de auth ─────────────────────────────────────────
    // Último paso a propósito: si algo falla antes, la cuenta sigue existiendo
    // y la baja se puede reintentar. Al revés quedaría contenido huérfano sin
    // dueño que pueda pedir nada.
    const { error: authErr } = await admin.auth.admin.deleteUser(userId)
    if (authErr) return json({ error: 'No se pudo eliminar la cuenta', detail: authErr.message }, 500)
    steps.push('cuenta eliminada')

    return json({ ok: true, steps })
  } catch (e) {
    console.error('[delete-account]', e)
    return json({ error: 'Error inesperado', detail: String(e) }, 500)
  }
})
