// Helpers compartidos de las edge functions de MercadoPago.
// Deno + Web Crypto (SubtleCrypto), sin dependencias externas.

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000 // 10 min (igual que la validez del code de MP)
const MP_TOKEN_URL = 'https://api.mercadopago.com/oauth/token'
// El access_token del coach dura ~180 días. Refrescamos si vence en <24h para no
// cortar un cobro/reembolso justo en el borde.
const TOKEN_REFRESH_BUFFER_MS = 24 * 60 * 60 * 1000

async function hmacBytes(secret: string, msg: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg)))
}

export async function hmacHex(secret: string, msg: string): Promise<string> {
  return [...await hmacBytes(secret, msg)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function base64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Comparación en tiempo constante (evita timing attacks al comparar firmas).
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

// ── OAuth state firmado ──────────────────────────────────────────────────────
// El callback (mp-oauth-callback) es un endpoint PÚBLICO: MP redirige ahí sin
// auth. Sin firma, un atacante podría llamarlo con state=<coach_víctima> y su
// propio `code` de MP → guardaría SU token bajo la cuenta de la víctima (los
// pagos de la víctima irían a su MP). Firmar el state cierra eso.
//   state = `${coachId}.${exp}.${sig}` · sig = HMAC(secret, `${coachId}.${exp}`)
// Secret compartido en OAUTH_STATE_SECRET (Supabase secrets).
export async function signOauthState(coachId: string, secret: string): Promise<string> {
  const exp = Date.now() + OAUTH_STATE_TTL_MS
  const body = `${coachId}.${exp}`
  return `${body}.${await hmacHex(secret, body)}`
}

// Devuelve el coachId si el state es válido y no expiró; null si no.
export async function verifyOauthState(state: string, secret: string): Promise<string | null> {
  const parts = state.split('.')
  if (parts.length !== 3) return null
  const [coachId, expStr, sig] = parts
  if (!timingSafeEqual(sig, await hmacHex(secret, `${coachId}.${expStr}`))) return null
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || Date.now() > exp) return null
  return coachId
}

// ── PKCE (sin storage) ───────────────────────────────────────────────────────
// El code_verifier se DERIVA determinísticamente del state firmado + un secret
// de servidor, así mp-oauth-start (firma+challenge) y mp-oauth-callback (verifier)
// lo recomputan idéntico sin persistir nada entre las dos funciones stateless.
// El verifier NUNCA viaja en la URL (solo el challenge, que es público); un
// atacante no puede computarlo sin el secret. El `exp` dentro del state lo hace
// único por flujo. Verifier base64url de 32 bytes = 43 chars (rango válido PKCE).
export async function deriveCodeVerifier(state: string, secret: string): Promise<string> {
  return base64url(await hmacBytes(secret, `pkce:${state}`))
}

export async function codeChallengeS256(verifier: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(new Uint8Array(hash))
}

// ── Firma del webhook (x-signature) ──────────────────────────────────────────
// Header: "ts=<ts>,v1=<hmac>". Manifest para el HMAC-SHA256 (hex), key = secret
// de Webhooks (Your integrations → Webhooks → Configure notification):
//   `id:<data.id>;` + (si viene x-request-id) `request-id:<x-request-id>;` + `ts:<ts>;`
// data.id en minúsculas si es alfanumérico. Los campos ausentes NO se incluyen.
// ⚠️ Confirmar el template exacto contra el SDK oficial de MP al probar en sandbox.
export async function verifyWebhookSignature(opts: {
  xSignature: string | null
  xRequestId: string | null
  dataId: string | null
  secret: string
}): Promise<boolean> {
  const { xSignature, xRequestId, dataId, secret } = opts
  if (!xSignature || !dataId) return false

  let ts = '', v1 = ''
  for (const part of xSignature.split(',')) {
    const [k, v] = part.split('=').map((s) => s.trim())
    if (k === 'ts') ts = v
    else if (k === 'v1') v1 = v
  }
  if (!ts || !v1) return false

  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId
  let manifest = `id:${id};`
  if (xRequestId) manifest += `request-id:${xRequestId};`
  manifest += `ts:${ts};`

  return timingSafeEqual(v1, await hmacHex(secret, manifest))
}

// ── Token del coach con refresh automático ───────────────────────────────────
// El access_token de OAuth dura ~180 días; MP entrega un refresh_token (de un
// solo uso: cada refresh devuelve uno nuevo, hay que reguardarlo). Sin esto, a
// los ~6 meses de conectar MP el token del coach vence y TODO cobro/reembolso de
// ese coach falla con 401 sin recuperación. Este helper es el único punto por el
// que mp-create-payment y mp-process-refunds obtienen el token: si está por
// vencer, lo refresca y persiste antes de devolverlo.
//
// Devuelve null solo si el coach no tiene cuenta conectada (sin fila o sin
// access_token). Si el refresh falla, cae al token viejo y deja que la llamada
// posterior falle con su propio 401 (mejor intentar que romper acá).
export async function getFreshCoachToken(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  coachId: string,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  const { data: acct } = await supabase
    .from('coach_mp_accounts')
    .select('access_token, refresh_token, expires_at')
    .eq('coach_id', coachId)
    .single()
  if (!acct?.access_token) return null

  const expMs = acct.expires_at ? Date.parse(acct.expires_at) : NaN
  // Vigente (o sin expiry conocido → no arriesgar un refresh innecesario): tal cual.
  if (!Number.isFinite(expMs) || Date.now() < expMs - TOKEN_REFRESH_BUFFER_MS) {
    return acct.access_token
  }
  // Vencido o por vencer, pero sin refresh_token no hay nada que hacer: devolver
  // el viejo y que falle aguas abajo (queda logueado ahí).
  if (!acct.refresh_token) return acct.access_token

  const res = await fetch(MP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: acct.refresh_token,
    }),
  })
  const tok = await res.json().catch(() => ({}))
  if (!res.ok || !tok.access_token) {
    console.error('[mp] refresh token error', coachId, tok)
    return acct.access_token // fallback: intentar con el viejo
  }

  await supabase
    .from('coach_mp_accounts')
    .update({
      access_token: tok.access_token,
      // refresh_token de un solo uso: guardar el nuevo o el viejo si MP no mandó.
      refresh_token: tok.refresh_token ?? acct.refresh_token,
      expires_at: tok.expires_in
        ? new Date(Date.now() + tok.expires_in * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq('coach_id', coachId)

  return tok.access_token
}
