// mp-oauth-callback — el coach conecta su cuenta de MercadoPago (OAuth marketplace).
//
// Flujo:
//   1. La app abre (WebBrowser) la URL de authorize de MP con:
//        redirect_uri = URL de esta función · state = identificador del coach
//   2. MP redirige acá con ?code=...&state=...
//   3. Cambiamos el `code` por tokens (POST /oauth/token) y los guardamos en
//      coach_mp_accounts (tabla bloqueada, solo service role). Marcamos
//      coaches.mp_connected = true.
//
// `state` viene FIRMADO desde mp-oauth-start (HMAC) — se verifica antes de
// intercambiar el code, para que este endpoint público no pueda ser forjado
// (ver signOauthState/verifyOauthState en _shared/mp.ts).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyOauthState, deriveCodeVerifier } from '../_shared/mp.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MP_CLIENT_ID = Deno.env.get('MP_CLIENT_ID')!
const MP_CLIENT_SECRET = Deno.env.get('MP_CLIENT_SECRET')!
const MP_REDIRECT_URI = Deno.env.get('MP_REDIRECT_URI')!
const OAUTH_STATE_SECRET = Deno.env.get('OAUTH_STATE_SECRET')!
const APP_DEEP_LINK = Deno.env.get('APP_DEEP_LINK') ?? 'viveapp://coach/mp-connected'
// Sandbox: si MP_TEST_MODE=true, el exchange pide un token de PRUEBA (test_token).
// Default off → en producción NO se manda, comportamiento real intacto.
const MP_TEST_MODE = Deno.env.get('MP_TEST_MODE') === 'true'

serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!code || !state) {
    return new Response('Faltan parámetros de OAuth', { status: 400 })
  }

  // Verificar la firma del state ANTES de tocar MP → resuelve el coach_id real.
  const coachId = await verifyOauthState(state, OAUTH_STATE_SECRET)
  if (!coachId) {
    return new Response('State inválido o vencido', { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    // VERIFICADO (docs MP, 07/2026): POST /oauth/token, grant_type=authorization_code,
    // body con client_id/client_secret/code/redirect_uri. El `code` vive 10 min; el
    // access_token dura ~180 días (refrescar con refresh_token antes de expires_at).
    // PKCE: code_verifier derivado del mismo state firmado (ver deriveCodeVerifier).
    const codeVerifier = await deriveCodeVerifier(state, OAUTH_STATE_SECRET)
    const tokenBody: Record<string, unknown> = {
      client_id: MP_CLIENT_ID,
      client_secret: MP_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: MP_REDIRECT_URI,
      code_verifier: codeVerifier,
    }
    // Sandbox: fuerza credenciales de prueba aunque el client_id/secret sean de prod.
    if (MP_TEST_MODE) tokenBody.test_token = true
    const tokenRes = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokenBody),
    })
    const token = await tokenRes.json()
    if (!tokenRes.ok) {
      console.error('[mp-oauth] token error:', token)
      return new Response('No se pudo conectar Mercado Pago', { status: 502 })
    }

    // coachId ya viene verificado del state firmado (arriba).
    await supabase.from('coach_mp_accounts').upsert({
      coach_id: coachId,
      mp_user_id: String(token.user_id),
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? null,
      public_key: token.public_key ?? null,
      expires_at: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    await supabase.from('coaches').update({ mp_connected: true }).eq('id', coachId)

    // Volver a la app
    return Response.redirect(APP_DEEP_LINK, 302)
  } catch (e) {
    console.error('[mp-oauth] error:', e)
    return new Response('Error interno', { status: 500 })
  }
})
