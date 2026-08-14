// admin-actions — las escrituras privilegiadas del panel de administración.
//
// El panel corre dentro de la app, con la anon key, así que NO puede escribir
// `coaches.verified` ni `reports.status`: `lock-privileged-columns.sql` cerró
// esas columnas justo para que nadie se auto-apruebe. Esta función es la única
// vía. Valida el JWT de quien llama, confirma que sea admin, y recién ahí
// escribe con service role.
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
//   { action: 'resolve_report', report_id, status: 'revisado'|'accionado'|'descartado' }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    case 'set_coach_verified': {
      if (!body.coach_id) return json({ error: 'falta coach_id' }, 400)
      if (typeof body.verified !== 'boolean') return json({ error: 'verified tiene que ser booleano' }, 400)

      const { data, error } = await admin
        .from('coaches')
        .update({ verified: body.verified })
        .eq('id', body.coach_id)
        .select('id, verified, profile_id')

      if (error) return json({ error: error.message }, 500)
      if (!data || data.length === 0) return json({ error: 'no existe ese coach' }, 404)

      // Sin tabla de auditoría todavía: el log de la función es el único rastro
      // de quién aprobó a quién. Anotado como pendiente.
      console.log(`[admin-actions] ${user.email ?? user.id} puso verified=${body.verified} en coach ${body.coach_id}${body.notes ? ` — ${body.notes}` : ''}`)

      return json({ result: 'ok', coach: data[0] })
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

      console.log(`[admin-actions] ${user.email ?? user.id} marcó el reporte ${body.report_id} como ${body.status}`)

      return json({ result: 'ok', report: data[0] })
    }

    default:
      return json({ error: `acción desconocida: ${body.action}` }, 400)
  }
})
