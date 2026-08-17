// Polyfill mínimo de WebCrypto para que el PKCE de Supabase use SHA-256.
//
// EL PROBLEMA: `@supabase/auth-js` arma el `code_challenge` así
// (`lib/helpers.js`, `generatePKCEChallenge`):
//
//     const hasCryptoSupport = typeof crypto !== 'undefined' &&
//         typeof crypto.subtle !== 'undefined' &&
//         typeof TextEncoder !== 'undefined';
//     if (!hasCryptoSupport) {
//       console.warn('WebCrypto API is not supported. Code challenge method
//                     will default to use plain instead of sha256.');
//       return verifier;           // ← el challenge PASA A SER el verifier
//     }
//
// Hermes no trae ninguna de las tres, así que en el dispositivo el challenge
// viajaba **igual** al verifier (método `plain`). Eso anula PKCE: su única
// función es que interceptar el código de autorización no alcance para
// canjearlo, porque hace falta además el verifier — y con `plain` el verifier
// va escrito en la misma URL de autorización que el atacante ya vio. El riesgo
// concreto en iOS es otra app registrando el scheme `viveapp://`.
//
// LA SOLUCIÓN: `expo-crypto` (ya es dependencia, no se suma nada) expone
// `digest(algorithm, data) => Promise<ArrayBuffer>`, que es exactamente la
// firma de `crypto.subtle.digest`. Solo se define lo que falta, así que en web
// —donde WebCrypto es nativo— esto no toca nada.
//
// Importar este módulo por su efecto secundario ANTES de cualquier login. Vive
// arriba de `lib/supabase.ts` para que no dependa del orden de imports de las
// pantallas.

import * as Crypto from 'expo-crypto';

const ALGORITMOS: Record<string, Crypto.CryptoDigestAlgorithm> = {
  'SHA-1': Crypto.CryptoDigestAlgorithm.SHA1,
  'SHA-256': Crypto.CryptoDigestAlgorithm.SHA256,
  'SHA-384': Crypto.CryptoDigestAlgorithm.SHA384,
  'SHA-512': Crypto.CryptoDigestAlgorithm.SHA512,
};

/** `crypto.subtle.digest` acepta el algoritmo como string o como `{ name }`. */
function resolverAlgoritmo(algorithm: AlgorithmIdentifier): Crypto.CryptoDigestAlgorithm {
  const nombre = typeof algorithm === 'string' ? algorithm : algorithm?.name;
  const resuelto = ALGORITMOS[String(nombre).toUpperCase()];
  if (!resuelto) throw new Error(`[webcrypto] algoritmo no soportado: ${String(nombre)}`);
  return resuelto;
}

/** UTF-8, suficiente para lo que hace falta. El verifier de PKCE es base64url
 *  (o sea ASCII), pero se implementa completo igual —incluidos los pares
 *  suplentes— porque un polyfill global lo puede usar cualquier otra cosa.
 *  Los suplentes sueltos no se reemplazan por U+FFFD como manda el estándar:
 *  no vale la pena para el caso de uso, y quedan documentados acá. */
class TextEncoderPolyfill {
  readonly encoding = 'utf-8';

  encode(input = ''): Uint8Array {
    const bytes: number[] = [];
    for (let i = 0; i < input.length; i++) {
      let punto = input.charCodeAt(i);
      if (punto >= 0xd800 && punto <= 0xdbff && i + 1 < input.length) {
        const siguiente = input.charCodeAt(i + 1);
        if (siguiente >= 0xdc00 && siguiente <= 0xdfff) {
          punto = 0x10000 + ((punto - 0xd800) << 10) + (siguiente - 0xdc00);
          i++;
        }
      }
      if (punto < 0x80) {
        bytes.push(punto);
      } else if (punto < 0x800) {
        bytes.push(0xc0 | (punto >> 6), 0x80 | (punto & 0x3f));
      } else if (punto < 0x10000) {
        bytes.push(0xe0 | (punto >> 12), 0x80 | ((punto >> 6) & 0x3f), 0x80 | (punto & 0x3f));
      } else {
        bytes.push(
          0xf0 | (punto >> 18),
          0x80 | ((punto >> 12) & 0x3f),
          0x80 | ((punto >> 6) & 0x3f),
          0x80 | (punto & 0x3f),
        );
      }
    }
    return new Uint8Array(bytes);
  }
}

const g = globalThis as any;

if (typeof g.TextEncoder === 'undefined') {
  g.TextEncoder = TextEncoderPolyfill;
}

if (typeof g.crypto === 'undefined') {
  // `defineProperty` y no asignación directa: en algunos runtimes `crypto` es
  // un getter de solo lectura y `g.crypto = {}` falla en silencio en modo no
  // estricto, dejando el polyfill sin efecto y el PKCE en `plain`.
  Object.defineProperty(g, 'crypto', { value: {}, configurable: true, writable: true });
}

if (typeof g.crypto.getRandomValues === 'undefined') {
  g.crypto.getRandomValues = Crypto.getRandomValues;
}

if (typeof g.crypto.randomUUID === 'undefined') {
  g.crypto.randomUUID = Crypto.randomUUID;
}

if (typeof g.crypto.subtle === 'undefined') {
  g.crypto.subtle = {
    digest: (algorithm: AlgorithmIdentifier, data: BufferSource): Promise<ArrayBuffer> =>
      Crypto.digest(resolverAlgoritmo(algorithm), data),
  };
}
