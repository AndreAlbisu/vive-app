// mp-oauth-start — devuelve la URL de autorización OAuth de MercadoPago
// para que el coach la abra en un WebBrowser y autorice el marketplace.
//
// El client_id vive en secrets del servidor; el cliente nunca lo ve.
// `state` = state firmado (HMAC) del coach — lo verifica mp-oauth-callback.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { signOauthState } from '../_shared/mp.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MP_CLIENT_ID = Deno.env.get('MP_CLIENT_ID')!
const MP_REDIRECT_URI = Deno.env.get('MP_REDIRECT_URI')!
const OAUTH_STATE_SECRET = Deno.env.get('OAUTH_STATE_SECRET')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  )
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  const { data: coachRow } = await supabase
    .from('coaches')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!coachRow) return json({ error: 'No sos coach' }, 404)

  const state = await signOauthState(coachRow.id, OAUTH_STATE_SECRET)
  const url =
    `https://auth.mercadopago.com.ar/authorization` +
    `?client_id=${MP_CLIENT_ID}` +
    `&response_type=code` +
    `&platform_id=mp` +
    `&redirect_uri=${encodeURIComponent(MP_REDIRECT_URI)}` +
    `&state=${encodeURIComponent(state)}`

  return json({ url }, 200)
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
