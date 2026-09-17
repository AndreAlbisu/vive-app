// availability-notices — "Avisame cuando tenga horarios" (M3).
//
// La corre un cron cada hora (`scripts/add-availability-waitlist.sql`). Mira los
// pedidos pendientes de `availability_waitlist` y, si el profesional ya tiene al
// menos un horario libre a futuro, le avisa a quien lo pidió (campana + push).
//
// Un aviso sale solo si:
//   · el pedido sigue pendiente y tiene menos de MAX_DIAS_PEDIDO días;
//   · el profesional sigue publicado (`verified`) y no está suspendido;
//   · tiene un horario libre: `coach_availability` a futuro, sin bloquear, y sin
//     una reserva `confirmada` encima (una `pendiente` de otro no lo ocupa: es el
//     mismo criterio del calendario).
//
// 🔴 Una sola vez por pedido. Se RECLAMA la fila con un update condicionado a que
// siga pendiente, y solo se avisa lo que se reclamó. Mismo patrón que
// `sanction-returns`: si dos corridas se pisan, la segunda no duplica.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { esServiceRole } from '../_shared/service-role.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

/** Un "ya hay horarios" dos meses después del pedido llega descolgado. */
const MAX_DIAS_PEDIDO = 60

const AR_TZ = 'America/Argentina/Buenos_Aires'

/** Fecha y minutos del día en Argentina, ahora. */
function ahoraEnAr(): { hoy: string; minutos: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date())
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '0'
  return {
    hoy: `${get('year')}-${get('month')}-${get('day')}`,
    minutos: (parseInt(get('hour'), 10) % 24) * 60 + parseInt(get('minute'), 10),
  }
}

/** "9:00" y "09:00" son el mismo horario: los slots y las reservas no siempre
 *  guardan el mismo padding. */
function minutosDe(hora: string): number {
  const [h, m = '0'] = String(hora).split(':')
  return parseInt(h, 10) * 60 + parseInt(m, 10)
}

async function push(token: string | null, title: string, body: string, data: Record<string, string>) {
  if (!token) return
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: token, sound: 'default', title, body, data }),
    })
  } catch (e) {
    console.error(`[availability-notices] push falló: ${e}`)
  }
}

serve(async (req) => {
  if (!esServiceRole(req.headers.get('Authorization'), SUPABASE_SERVICE_ROLE_KEY)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { hoy, minutos } = ahoraEnAr()

  const { data: pendientes, error } = await admin
    .from('availability_waitlist')
    .select('id, user_id, coach_id, created_at')
    .is('resuelta_at', null)
    .limit(1000)

  if (error) {
    console.error('[availability-notices] no se pudieron leer los pedidos:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  // 1) Vencidos: se cierran sin avisar.
  const limite = Date.now() - MAX_DIAS_PEDIDO * 86_400_000
  const vencidos = (pendientes ?? []).filter(p => new Date(p.created_at as string).getTime() < limite)
  let vencidas = 0
  if (vencidos.length > 0) {
    const { data } = await admin
      .from('availability_waitlist')
      .update({ resuelta_at: new Date().toISOString(), resultado: 'vencida' })
      .in('id', vencidos.map(v => v.id))
      .is('resuelta_at', null)
      .select('id')
    vencidas = data?.length ?? 0
  }
  const vigentes = (pendientes ?? []).filter(p => new Date(p.created_at as string).getTime() >= limite)
  const coachIds = [...new Set(vigentes.map(p => p.coach_id as string))]
  if (coachIds.length === 0) {
    return new Response(JSON.stringify({ revisados: pendientes?.length ?? 0, avisados: 0, vencidas }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 2) ¿Qué profesionales tienen hoy un horario libre?
  const [{ data: coaches }, { data: slots }, { data: ocupadas }] = await Promise.all([
    admin.from('coaches')
      .select('id, verified, suspendido_hasta, profile_id, profiles!inner(name)')
      .in('id', coachIds),
    admin.from('coach_availability')
      .select('coach_id, date, time')
      .in('coach_id', coachIds)
      .eq('blocked', false)
      .gte('date', hoy),
    admin.from('bookings')
      .select('coach_id, scheduled_date, scheduled_time')
      .in('coach_id', coachIds)
      .eq('status', 'confirmada')
      .gte('scheduled_date', hoy),
  ])

  const ocupado = new Set(
    (ocupadas ?? []).map(b => `${b.coach_id}|${b.scheduled_date}|${minutosDe(b.scheduled_time as string)}`),
  )
  const conHorarioLibre = new Set<string>()
  for (const s of slots ?? []) {
    const m = minutosDe(s.time as string)
    if (s.date === hoy && m <= minutos) continue
    if (ocupado.has(`${s.coach_id}|${s.date}|${m}`)) continue
    conHorarioLibre.add(s.coach_id as string)
  }

  const ahora = Date.now()
  const info = new Map<string, { nombre: string; profileId: string }>()
  for (const c of coaches ?? []) {
    const suspendido = c.suspendido_hasta === 'infinity' ||
      (!!c.suspendido_hasta && new Date(c.suspendido_hasta as string).getTime() > ahora)
    if (!c.verified || suspendido || !conHorarioLibre.has(c.id as string)) continue
    const p: any = Array.isArray((c as any).profiles) ? (c as any).profiles[0] : (c as any).profiles
    info.set(c.id as string, {
      nombre: ((p?.name as string) ?? '').trim().split(' ')[0] || 'Tu profesional',
      profileId: c.profile_id as string,
    })
  }

  // 3) Reclamar y avisar.
  let avisados = 0
  for (const pedido of vigentes) {
    const c = info.get(pedido.coach_id as string)
    if (!c) continue

    const { data: reclamada } = await admin
      .from('availability_waitlist')
      .update({ resuelta_at: new Date().toISOString(), resultado: 'avisada' })
      .eq('id', pedido.id)
      .is('resuelta_at', null)
      .select('id')
    if (!reclamada || reclamada.length === 0) continue

    const title = `${c.nombre} tiene horarios`
    const body = `${c.nombre} abrió horarios nuevos. Si todavía querés, ya podés reservar.`
    const { data: notif, error: insErr } = await admin
      .from('notifications')
      .insert({ recipient_id: pedido.user_id, type: 'profesional_con_horarios', title, body })
      .select('id')
      .single()
    if (insErr) {
      // La fila ya quedó reclamada: preferible perder este aviso a duplicarlo.
      console.error(`[availability-notices] no se pudo guardar el aviso para ${pedido.user_id}: ${insErr.message}`)
      continue
    }
    await admin.from('availability_waitlist').update({ notification_id: notif.id }).eq('id', pedido.id)

    const { data: perfil } = await admin.from('profiles').select('push_token').eq('id', pedido.user_id).maybeSingle()
    await push((perfil?.push_token as string | null) ?? null, title, body, {
      type: 'profesional_con_horarios',
      coach_profile_id: c.profileId,
    })
    avisados += 1
  }

  return new Response(JSON.stringify({ revisados: pendientes?.length ?? 0, avisados, vencidas }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
