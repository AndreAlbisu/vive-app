// revocacion — recibe el formulario del botón de arrepentimiento y emite el código.
//
// ── Por qué existe ───────────────────────────────────────────────────────────
//
// La Res. 424/2020 pide que, recibida la solicitud, el proveedor le mande al
// consumidor **dentro de las 24 horas y por el mismo medio** un código de
// identificación de la revocación. Hasta el 13/10/2026 el botón abría un correo
// y ese código dependía de que alguien lo contestara a mano. Acá el código nace
// en el momento: se muestra en la pantalla y se manda por correo.
//
// ── Lo que NO hace ───────────────────────────────────────────────────────────
//
// No cancela la reserva ni reintegra nada. La página no tiene sesión (la norma
// prohíbe pedir registro), así que no hay forma de saber con certeza de quién es
// el pedido: darle a un formulario público el poder de cancelar y devolver plata
// sería dejar que cualquiera cancele la sesión de otro sabiendo su correo. La
// solicitud queda registrada, Vita recibe un aviso, y la baja y el reintegro los
// hace una persona después de ubicar la reserva.
//
// ── Abuso ────────────────────────────────────────────────────────────────────
//
// Es una puerta pública que manda un correo a la dirección que le digan. Tres
// frenos: 5 por hora por IP (`consume_rate_limit`, bucket `revocacion`), un
// campo trampa que los programas completan y las personas no ven, y que el
// correo al consumidor lleva solo texto fijo y el código — nada de lo que
// escribió, para que no sirva de vehículo de un mensaje ajeno.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { WEB_ORIGIN } from '../_shared/cors.ts'
import { enviarMail, nombreSeguro } from '../_shared/email.ts'

const CORS = {
  'Access-Control-Allow-Origin': WEB_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

// Adónde llega el aviso para que una persona procese la baja y el reintegro.
const CASILLA_VITA = 'vitaappar@gmail.com'

// Sin 0/O ni 1/I: el código se dicta por teléfono y se copia a mano.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function nuevoCodigo(ahora: Date): string {
  // La fecha es la de Argentina, que es la que la persona tiene en la cabeza.
  const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
    .format(ahora).replace(/-/g, '')
  const azar = crypto.getRandomValues(new Uint8Array(6))
  const cola = Array.from(azar, (b) => ALFABETO[b % ALFABETO.length]).join('')
  return `REV-${fecha}-${cola}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let body: { nombre?: unknown; email?: unknown; detalle?: unknown; sitio?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'cuerpo inválido' }, 400)
  }

  // Campo trampa: está escondido en la página. Si llega con algo, lo completó un
  // programa. Se contesta como si hubiera salido bien para no enseñarle nada.
  if (typeof body.sitio === 'string' && body.sitio.trim() !== '') {
    return json({ codigo: nuevoCodigo(new Date()) })
  }

  const nombre = String(body.nombre ?? '').trim().replace(/\s+/g, ' ')
  const email = String(body.email ?? '').trim().toLowerCase()
  const detalle = String(body.detalle ?? '').trim()

  if (nombre.length < 2 || nombre.length > 120) return json({ error: 'Escribí tu nombre y apellido.' }, 400)
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
    return json({ error: 'Revisá el correo electrónico.' }, 400)
  }
  if (detalle.length > 600) return json({ error: 'El detalle es demasiado largo (máximo 600 caracteres).' }, 400)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Sin IP no se deja pasar sin tope: todos los pedidos sin IP comparten uno.
  const ip = (req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-forwarded-for')?.split(',')[0]
    ?? '').trim() || 'desconocida'
  const { data: dentroDelTope, error: errTope } = await admin.rpc('consume_rate_limit', {
    p_bucket: 'revocacion', p_subject: `ip:${ip}`, p_max: 5, p_window: '1 hour',
  })
  if (errTope) {
    console.error('[revocacion] no se pudo consultar el tope:', errTope.message)
    return json({ error: `No pudimos registrar tu solicitud. Escribinos a ${CASILLA_VITA}.` }, 503)
  }
  if (!dentroDelTope) {
    return json({ error: `Demasiados intentos seguidos. Esperá un rato o escribinos a ${CASILLA_VITA}.` }, 429)
  }

  // El código es al azar; si justo choca con uno existente (23505) se prueba otro.
  let codigo = ''
  for (let intento = 0; intento < 3 && !codigo; intento++) {
    const candidato = nuevoCodigo(new Date())
    const { error } = await admin.from('revocaciones')
      .insert({ codigo: candidato, nombre, email, detalle: detalle || null })
    if (!error) codigo = candidato
    else if (error.code !== '23505') {
      console.error('[revocacion] no se pudo guardar:', error.message)
      break
    }
  }
  if (!codigo) return json({ error: `No pudimos registrar tu solicitud. Escribinos a ${CASILLA_VITA}.` }, 503)

  // Los correos no frenan la respuesta: la solicitud ya quedó registrada y el
  // código va en la pantalla. Si alguno falla queda en los registros.
  const alConsumidor = await enviarMail({
    para: email,
    asunto: `Tu código de arrepentimiento: ${codigo}`,
    titulo: 'Recibimos tu arrepentimiento',
    lineas: [
      `Tu código de identificación de la revocación es <strong>${codigo}</strong>. Guardalo: es tu constancia.`,
      'Vamos a dar de baja la Sesión y a reintegrarte el total de lo que pagaste, sin cargo. Si necesitamos algún dato más para ubicar la reserva, te escribimos a este correo.',
    ],
    pie: `Si no hiciste esta solicitud, escribinos a ${CASILLA_VITA}.`,
    idempotencyKey: `revocacion-${codigo}`,
  })
  if (alConsumidor) {
    await admin.from('revocaciones').update({ mail_enviado_at: new Date().toISOString() }).eq('codigo', codigo)
  }

  await enviarMail({
    para: CASILLA_VITA,
    asunto: `ARREPENTIMIENTO ${codigo}`,
    titulo: 'Solicitud de arrepentimiento',
    lineas: [
      `Código: <strong>${codigo}</strong>`,
      `Nombre: ${nombreSeguro(nombre)}`,
      `Correo: ${nombreSeguro(email)}`,
      `Detalle: ${detalle ? nombreSeguro(detalle) : '(sin detalle)'}`,
      alConsumidor
        ? 'El código ya se le mandó por correo.'
        : '⚠️ El correo con el código NO salió. Hay que mandárselo a mano dentro de las 24 horas.',
      'Falta: ubicar la reserva, darla de baja y reintegrar.',
    ],
    idempotencyKey: `revocacion-aviso-${codigo}`,
  })

  return json({ codigo, mail: alConsumidor })
})
