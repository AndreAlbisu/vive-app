// mp-oauth-callback — el coach conecta su cuenta de MercadoPago (OAuth marketplace).
//
// SCAFFOLD v1 — estructura lista; la llamada a MP está marcada TODO y hay que
// verificarla contra la doc vigente de MercadoPago antes de producción.
//
// Flujo:
//   1. La app abre (WebBrowser) la URL de authorize de MP con:
//        redirect_uri = URL de esta función · state = identificador del coach
//   2. MP redirige acá con ?code=...&state=...
//   3. Cambiamos el `code` por tokens (POST /oauth/token) y los guardamos en
//      coach_mp_accounts (tabla bloqueada, solo service role). Marcamos
//      coaches.mp_connected = true.
//
// ⚠️ `state` debe ser un valor firmado/nonce mapeado al coach, NO el coach_id
//    plano (evitar que un tercero conecte su MP a otro coach). TODO.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MP_CLIENT_ID = Deno.env.get('MP_CLIENT_ID')!
const MP_CLIENT_SECRET = Deno.env.get('MP_CLIENT_SECRET')!
const MP_REDIRECT_URI = Deno.env.get('MP_REDIRECT_URI')!
const APP_DEEP_LINK = Deno.env.get('APP_DEEP_LINK') ?? 'vive://coach/mp-connected'

serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state') // TODO: verificar firma/nonce → coach_id

  if (!code || !state) {
    return new Response('Faltan parámetros de OAuth', { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    // VERIFICADO (docs MP, 07/2026): POST /oauth/token, grant_type=authorization_code,
    // body con client_id/client_secret/code/redirect_uri. El `code` vive 10 min; el
    // access_token dura ~180 días (refrescar con refresh_token antes de expires_at).
    // PKCE: si la app MP tiene PKCE activado, agregar `code_verifier` al body.
    const tokenRes = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: MP_CLIENT_ID,
        client_secret: MP_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: MP_REDIRECT_URI,
      }),
    })
    const token = await tokenRes.json()
    if (!tokenRes.ok) {
      console.error('[mp-oauth] token error:', token)
      return new Response('No se pudo conectar Mercado Pago', { status: 502 })
    }

    // TODO: resolver coach_id real desde `state` (nonce firmado). Placeholder:
    const coachId = state

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
