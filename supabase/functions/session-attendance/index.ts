// session-attendance — trae de Daily la prueba de que la sesión ocurrió.
//
// 🔴 POR QUÉ EXISTE: sobre una videollamada, la disputa que llega es "el servicio
// no se prestó". Hasta el 25/08/2026 no había NADA que presentar — la sala se
// creaba, la sesión pasaba, y no quedaba registro de que alguien hubiera entrado.
// No era un caso débil: era no tener evidencia.
//
// ── Por qué se CONSULTA y no se recibe por webhook ──────────────────────────
// Daily ofrece las dos formas. Se eligió consultar:
//   · La sala ya identifica la reserva (`vive-<booking_id>`), así que el cruce es
//     directo y no hay que inventar ningún mapeo.
//   · Un webhook sería otro endpoint público que asegurar, con su propia
//     verificación de firma. Más superficie, y este proyecto ya sabe lo que
//     cuesta una que queda mal configurada.
//   · 🔴 Es REINTENTABLE. Si una corrida falla, la siguiente la levanta. Un
//     webhook perdido se perdió — y esto es justo lo que se va a necesitar dentro
//     de seis meses, cuando llegue la disputa.
//
// ── La postura sobre la forma de la respuesta ───────────────────────────────
// 🔴 Se guarda el CRUDO siempre y el resumen se deriva como mejor esfuerzo. Si un
// nombre de campo no es el que se esperaba, el resumen queda en null pero **la
// evidencia igual quedó guardada**, y se recalcula después sin volver a pedirle
// nada a Daily. Al revés —derivar y descartar el crudo— un error de nombre haría
// perder la prueba en silencio.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const DAILY_API_KEY = Deno.env.get('DAILY_API_KEY') ?? ''

/** El mismo nombre que arma `create-meeting-room`. Si cambia allá, cambia acá. */
function roomNameFor(bookingId: string): string {
  return `vive-${bookingId.replace(/-/g, '').slice(0, 16)}`
}

/**
 * Cuánto hay que esperar antes de dar por concluyente que **nadie entró**.
 *
 * 🔴 Un `participants_count = 0` no es un dato faltante: es la constancia de que
 * la sesión no ocurrió, y eso hace falta para el caso inverso — alguien que
 * reclama una sesión que no dio. Pero escribirlo temprano lo convertiría en una
 * mentira: la sesión podía no haber empezado todavía.
 */
const HORAS_PARA_CONCLUIR_VACIO = 24

/** Hasta cuándo mirar para atrás. Más viejo que esto, o ya se trajo, o se perdió. */
const DIAS_HACIA_ATRAS = 5

type Resumen = {
  meetings_count: number | null
  participants_count: number | null
  max_simultaneous: number | null
  first_join_at: string | null
  total_seconds: number | null
}

/**
 * Deriva el resumen. **Nunca tira**: ante cualquier forma inesperada devuelve
 * nulls y deja que `raw` sea la fuente.
 */
function resumir(data: unknown): Resumen {
  const vacio: Resumen = {
    meetings_count: null,
    participants_count: null,
    max_simultaneous: null,
    first_join_at: null,
    total_seconds: null,
  }
  try {
    // deno-lint-ignore no-explicit-any
    const meetings: any[] = (data as any)?.data ?? []
    if (!Array.isArray(meetings)) return vacio

    // Daily abre una "meeting session" nueva si la sala se vacía y alguien vuelve
    // a entrar. Por eso puede haber varias para una misma reserva, y hay que
    // sumarlas en vez de quedarse con la primera.
    const participantes = new Set<string>()
    let primerJoin: number | null = null
    let segundos = 0
    let maxSimultaneos = 0

    for (const m of meetings) {
      maxSimultaneos = Math.max(maxSimultaneos, Number(m?.max_participants ?? 0) || 0)
      // deno-lint-ignore no-explicit-any
      for (const p of (m?.participants ?? []) as any[]) {
        const id = String(p?.participant_id ?? p?.user_id ?? '')
        if (id) participantes.add(id)
        const join = Number(p?.join_time ?? NaN)
        if (Number.isFinite(join)) primerJoin = primerJoin === null ? join : Math.min(primerJoin, join)
        const dur = Number(p?.duration ?? NaN)
        if (Number.isFinite(dur)) segundos += dur
      }
    }

    return {
      meetings_count: meetings.length,
      participants_count: participantes.size,
      max_simultaneous: maxSimultaneos || null,
      // Daily devuelve segundos desde epoch.
      first_join_at: primerJoin === null ? null : new Date(primerJoin * 1000).toISOString(),
      total_seconds: segundos || null,
    }
  } catch (e) {
    console.error('[attendance] no se pudo derivar el resumen, queda el crudo:', e)
    return vacio
  }
}

serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.includes(SUPABASE_SERVICE_ROLE_KEY)) {
    return new Response('Unauthorized', { status: 401 })
  }
  if (!DAILY_API_KEY) {
    console.error('[attendance] falta DAILY_API_KEY')
    return new Response('not configured', { status: 503 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const desde = new Date(Date.now() - DIAS_HACIA_ATRAS * 24 * 3600 * 1000)
    .toISOString()
    .split('T')[0]

  // 🔴 NO se filtra por `meeting_url is not null`, y es deliberado: esa columna
  // se llena recién cuando alguien abre la sala. Filtrando por ella, el caso
  // **"no vino nadie"** —donde la sala nunca llegó a crearse— no quedaría nunca
  // registrado, y es justo la evidencia que hace falta para el reclamo inverso:
  // alguien que cobra una sesión que no dio.
  //
  // El nombre de la sala se deriva del `booking_id`, así que no hace falta que
  // exista para preguntar. Si nunca existió, Daily devuelve vacío y a las 24hs
  // eso se guarda como la conclusión que es.
  const { data: candidatas, error } = await supabase
    .from('bookings')
    .select('id, scheduled_date, scheduled_time, duration_minutes, meeting_url')
    .gte('scheduled_date', desde)
    .in('status', ['confirmada', 'completada'])
    .limit(200)

  if (error) {
    console.error('[attendance] no se pudieron leer las reservas:', error.message)
    return new Response('db error', { status: 502 })
  }

  // Las que ya tienen fila no se vuelven a mirar: la evidencia no cambia una vez
  // que la sesión terminó, y re-pedirla sería gastar llamadas por nada.
  //
  // 🔴 Se pregunta SOLO por las candidatas de esta corrida, y no por la tabla
  // entera. `session_attendance` crece una fila por sesión y para siempre: un
  // `select` sin filtro ni límite lo corta en el tope de filas de PostgREST y
  // ahí la lista deja de ser "las ya traídas" para pasar a ser "las primeras N",
  // en silencio. El efecto es doble y sin error visible: se vuelve a consultar a
  // Daily por sesiones ya resueltas —cada hora, para siempre— y el insert
  // posterior falla contra la PK de `booking_id`. Acotado a las candidatas, el
  // conjunto no puede pasar del `.limit(200)` de arriba.
  const idsCandidatas = (candidatas ?? []).map(b => b.id)
  const { data: yaTraidas, error: errTraidas } = idsCandidatas.length
    ? await supabase
        .from('session_attendance')
        .select('booking_id')
        .in('booking_id', idsCandidatas)
    : { data: [], error: null }

  if (errTraidas) {
    // Sin esta lista NO se puede seguir: se re-consultaría a Daily por todo y
    // cada insert chocaría contra la PK. Mejor frenar y que reintente el cron.
    console.error('[attendance] no se pudo leer lo ya traído:', errTraidas.message)
    return new Response('db error', { status: 502 })
  }

  const traidas = new Set((yaTraidas ?? []).map((r: { booking_id: string }) => r.booking_id))

  let revisadas = 0
  let guardadas = 0
  let vacias = 0
  let sinDatosTodavia = 0

  for (const b of candidatas ?? []) {
    if (traidas.has(b.id)) continue
    revisadas++

    const room = roomNameFor(b.id)
    const res = await fetch(`https://api.daily.co/v1/meetings?room=${encodeURIComponent(room)}`, {
      headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
    })

    if (!res.ok) {
      // No se escribe nada: la próxima corrida reintenta. Es la propiedad que
      // hizo elegir consultar en vez de recibir por webhook.
      console.error('[attendance] Daily respondió', res.status, 'para', room, await res.text())
      continue
    }

    const raw = await res.json()
    const resumen = resumir(raw)
    const hubo = (resumen.participants_count ?? 0) > 0

    // Sin participantes todavía: puede ser que la sesión no haya ocurrido aún.
    // Solo se escribe el cero cuando ya pasó tiempo suficiente como para que sea
    // una conclusión y no una foto sacada temprano.
    if (!hubo) {
      const finAprox = Date.parse(`${b.scheduled_date}T${String(b.scheduled_time).slice(0, 5)}:00-03:00`)
      const horas = (Date.now() - finAprox) / 3600000
      if (!Number.isFinite(horas) || horas < HORAS_PARA_CONCLUIR_VACIO) {
        sinDatosTodavia++
        continue
      }
      vacias++
    }

    const { error: errIns } = await supabase.from('session_attendance').insert({
      booking_id: b.id,
      room_name: room,
      ...resumen,
      raw,
    })
    if (errIns) {
      console.error('[attendance] no se pudo guardar', b.id, errIns.message)
      continue
    }
    guardadas++
  }

  return new Response(
    JSON.stringify({ revisadas, guardadas, vacias, sin_datos_todavia: sinDatosTodavia }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
