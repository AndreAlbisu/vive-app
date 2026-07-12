// Helpers compartidos de las edge functions de MercadoPago.
// Deno + Web Crypto (SubtleCrypto), sin dependencias externas.

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000 // 10 min (igual que la validez del code de MP)

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
