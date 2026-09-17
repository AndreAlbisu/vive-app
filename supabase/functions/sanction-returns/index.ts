// sanction-returns — avisarle a la gente que su profesional volvió.
//
// La corre un cron cada hora (`scripts/add-sanction-return-notices.sql`). Cierra
// el círculo del aviso que manda `admin-actions` al suspender o dar de baja: a
// quien se le dijo "no está tomando reservas nuevas", cuando eso deja de ser
// cierto, se le dice que volvió.
//
// Un aviso de vuelta sale solo si se cumplen las tres:
//   · la sanción dejó de pesar — venció por fecha, o se levantó;
//   · el profesional no tiene OTRA sanción vigente (`coaches.suspendido_hasta`
//     en el pasado o null) — si no, "volvió" sería mentira;
//   · sigue publicado (`verified`) — si lo sacaron del catálogo, tampoco volvió.
//
// 🔴 Una sola vez por persona. Antes de mandar nada se RECLAMA la fila con un
// update condicionado a que siga pendiente, y solo se manda lo que se reclamó.
// Si dos corridas se pisan (un cron lento y el siguiente), la segunda no
// encuentra nada que reclamar y no duplica el aviso.
//
// Y como el aviso original, NO menciona ninguna sanción.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { esServiceRole } from '../_shared/service-role.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Si la sanción terminó hace más de esto, el aviso llegaría descolgado — por
// ejemplo, si el cron estuvo caído semanas. Se anota como omitido en vez de
// mandar "volvió" sobre algo que la persona ya olvidó.
const MAX_DIAS_DESDE_QUE_TERMINO = 14

/** 'infinity' (la baja) no es una fecha: se trata aparte en todos los lugares. */
function sigueVigente(hasta: string | null, ahora: number): boolean {
  if (!hasta) return false
  if (hasta === 'infinity') return true
  const t = new Date(hasta).getTime()
  return Number.isFinite(t) && t > ahora
}

async function push(token: string | null, title: string, body: string) {
  if (!token) return
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: token, sound: 'default', title, body }),
    })
  } catch (e) {
    console.error(`[sanction-returns] push falló: ${e}`)
  }
}

serve(async (req) => {
  if (!esServiceRole(req.headers.get('Authorization'), SUPABASE_SERVICE_ROLE_KEY)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const ahora = Date.now()

  const { data: pendientes, error } = await admin
    .from('sanction_client_notices')
    .select('id, user_id, coach_sanctions!inner(id, nivel, hasta, revocada_at, coaches!inner(id, verified, suspendido_hasta, profiles!inner(name)))')
    .is('vuelta_avisada_at', null)
    .limit(500)

  if (error) {
    console.error('[sanction-returns] no se pudieron leer los avisos:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  // Se agrupa por (persona, profesional): si alguien quedó avisado por dos
  // sanciones del mismo profesional que ya terminaron, recibe UN "volvió".
  type Grupo = { userId: string; nombre: string; ids: string[]; resultado: 'avisada' | 'omitida_vieja' | 'omitida_no_publicado' }
  const grupos = new Map<string, Grupo>()

  for (const fila of pendientes ?? []) {
    const s: any = Array.isArray((fila as any).coach_sanctions) ? (fila as any).coach_sanctions[0] : (fila as any).coach_sanctions
    const c: any = Array.isArray(s?.coaches) ? s.coaches[0] : s?.coaches
    const p: any = Array.isArray(c?.profiles) ? c.profiles[0] : c?.profiles
    if (!s || !c) continue

    const termino = !!s.revocada_at || (s.nivel === 'suspension' && !sigueVigente(s.hasta, ahora))
    if (!termino) continue                                  // sigue suspendido por esta misma
    if (sigueVigente(c.suspendido_hasta ?? null, ahora)) continue   // hay OTRA vigente: esperar

    const finIso: string = s.revocada_at ?? s.hasta
    const diasDesdeFin = (ahora - new Date(finIso).getTime()) / 86_400_000
    const resultado: Grupo['resultado'] =
      !c.verified ? 'omitida_no_publicado'
      : diasDesdeFin > MAX_DIAS_DESDE_QUE_TERMINO ? 'omitida_vieja'
      : 'avisada'

    const clave = `${fila.user_id}:${c.id}:${resultado}`
    const g = grupos.get(clave) ?? { userId: fila.user_id as string, nombre: (p?.name as string)?.split(' ')[0] || 'Tu profesional', ids: [], resultado }
    g.ids.push(fila.id as string)
    grupos.set(clave, g)
  }

  let avisados = 0
  let omitidos = 0

  for (const g of grupos.values()) {
    // Reclamar ANTES de mandar: solo sale lo que esta corrida marcó.
    const { data: reclamadas } = await admin
      .from('sanction_client_notices')
      .update({ vuelta_avisada_at: new Date().toISOString(), vuelta_resultado: g.resultado })
      .in('id', g.ids)
      .is('vuelta_avisada_at', null)
      .select('id')

    if (!reclamadas || reclamadas.length === 0) continue
    if (g.resultado !== 'avisada') { omitidos += 1; continue }

    const title = `Sobre ${g.nombre}`
    const body = `${g.nombre} volvió a atender en Vita. Si querés, ya podés reservarle de nuevo.`
    const { error: insErr } = await admin.from('notifications').insert({
      recipient_id: g.userId, type: 'profesional_disponible', title, body,
    })
    if (insErr) {
      // La fila ya quedó marcada: preferible perder este aviso a mandarlo dos
      // veces si el error fue transitorio y el insert en realidad entró.
      console.error(`[sanction-returns] no se pudo guardar el aviso para ${g.userId}: ${insErr.message}`)
      continue
    }
    const { data: perfil } = await admin.from('profiles').select('push_token').eq('id', g.userId).maybeSingle()
    await push((perfil?.push_token as string | null) ?? null, title, body)
    avisados += 1
  }

  return new Response(JSON.stringify({ revisados: pendientes?.length ?? 0, avisados, omitidos }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
