// user-consent — otorgar o revocar el consentimiento de datos sensibles.
//
// ⚠️ POR QUÉ UNA EDGE FUNCTION Y NO UN INSERT DEL CLIENTE. Es toda la razón de
// ser de este archivo, así que va primero.
//
// El Decreto 1558/2001 admite que el consentimiento se preste por un medio
// distinto al escrito, pero exige que ese medio **asegure la autoría y la
// integridad de la declaración**. Una fila que el propio titular puede escribir
// —o fechar como quiera— no asegura ninguna de las dos cosas.
//
// Y no es hipotético: `SCHEMA.md` ya documenta que las cuatro columnas de
// aceptación de `profiles` las escribe el cliente, "o sea que son falsificables
// por su propio titular, lo que debilita su valor probatorio". Repetir eso en la
// tabla que existe justamente para probar algo sería construir la prueba con el
// defecto ya identificado.
//
// Acá el servidor:
//   · verifica la identidad contra el JWT real, no contra lo que diga el body;
//   · pone la fecha con SU reloj (`now()` de la base), no con el del teléfono;
//   · escribe con service role sobre una tabla donde `authenticated` tiene
//     revocado el insert.
//
// Lo único que se le cree al cliente es `policy_version`, que es una afirmación
// sobre qué texto se mostró y que solo el cliente puede saber. Se valida la
// FORMA (12 hex, el shape de LEGAL_VERSION) para que no entre texto arbitrario.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Lista cerrada. Un `consent_type` nuevo se agrega acá Y en el CHECK de la
// tabla — si solo se agrega en un lado, el insert falla ruidosamente, que es lo
// que queremos.
const TIPOS = ['datos_sensibles_bienestar']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'falta el token' }, 401)

  // Identidad real. NUNCA se toma el user_id del body: sería dejar que
  // cualquiera registre un consentimiento a nombre de otro.
  const asCaller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user } } = await asCaller.auth.getUser()
  if (!user) return json({ error: 'token inválido' }, 401)

  let body: { consentType?: string; granted?: boolean; policyVersion?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'body inválido' }, 400)
  }

  if (!body.consentType || !TIPOS.includes(body.consentType)) {
    return json({ error: 'tipo de consentimiento desconocido' }, 400)
  }
  if (typeof body.granted !== 'boolean') {
    return json({ error: 'falta granted' }, 400)
  }
  // Forma de LEGAL_VERSION: sha256 truncado a 12 hex. Si no matchea se guarda
  // null en vez de rechazar — perder la versión del texto es malo, pero perder
  // el consentimiento entero por un formato raro es peor.
  const policyVersion = typeof body.policyVersion === 'string' && /^[0-9a-f]{12}$/.test(body.policyVersion)
    ? body.policyVersion
    : null

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // Se INSERTA una fila por cada acto, nunca se actualiza la anterior: la
  // historia (otorgado → revocado → otorgado) es lo que se prueba, y un update
  // la borraría. `granted_at` y `created_at` los pone la base con su reloj.
  const { error } = await admin.from('user_consents').insert({
    user_id: user.id,
    consent_type: body.consentType,
    granted: body.granted,
    revoked_at: body.granted ? null : new Date().toISOString(),
    policy_version: policyVersion,
  })

  if (error) {
    console.error('[user-consent]', error.message)
    return json({ error: 'no se pudo registrar el consentimiento' }, 500)
  }

  return json({ ok: true, granted: body.granted })
})
