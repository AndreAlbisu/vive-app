// Obfuscación de los mensajes de la sala: XOR + base64.
//
// 🔴 ESTO NO ES CIFRADO Y NO HAY QUE LLAMARLO ASÍ EN NINGÚN TEXTO DE CARA AL
// USUARIO. Es XOR con clave repetida, que se rompe sin siquiera tener la clave
// (análisis de frecuencias, o texto conocido: los mensajes de sistema son
// siempre los mismos). Y encima la clave viaja DENTRO DEL BINARIO: es una
// `EXPO_PUBLIC_*`, o sea que se inlinea en tiempo de build y la lee cualquiera
// que descomprima el .ipa/.apk.
//
// Para qué sirve entonces: para que un volcado accidental de la tabla
// `messages` no se lea de un vistazo. Nada más. Lo que de verdad protege los
// mensajes es la RLS de `messages`.
//
// El E2E de verdad sigue pendiente para post-MVP (necesita un dev client con
// `react-native-quick-crypto`; en Expo Go no hay crypto nativo).

// 🔴 Sin fallback hardcodeado, a propósito. Antes había uno (`vive_mvp_key_2026`,
// versionado en este mismo repo), así que un build sin la variable "cifraba"
// con una clave pública sin avisar. Mismo criterio que `lib/supabase.ts`: si
// falta la configuración, se rompe fuerte y temprano en vez de andar mal en
// silencio.
//
// 📝 Se resuelve al USAR y no al importar: importar este módulo no puede tirar,
// porque lo arrastran pantallas que quizá nunca manden un mensaje (y los tests,
// que no cargan `.env`). Mismo criterio que en `_shared/booking-effects.ts`.
const KEY = process.env.EXPO_PUBLIC_ENCRYPTION_KEY;

const FALTA_CLAVE =
  'Falta EXPO_PUBLIC_ENCRYPTION_KEY. En local revisá .env; en un build de EAS ' +
  'cargala con `eas env:set` — .env no viaja al servidor de build. ⚠️ Tiene que ' +
  'ser LA MISMA que `MESSAGE_ENCRYPTION_KEY` en las edge functions, o los ' +
  'mensajes de sistema se leen como basura.';

/**
 * Saca los sustitutos sueltos (mitades de un par de emoji que llegaron cortadas).
 *
 * 🔴 Es lo ÚNICO que hacía fallar a `encodeURIComponent`, y por lo tanto la
 * única causa real del camino de error de abajo. Pasa con texto pegado desde
 * otra app o con un emoji partido al truncar. Reemplazarlos por el carácter de
 * reemplazo deja pasar el mensaje —perdiendo un glifo roto que ya no se veía
 * bien— en vez de tirar la conversación entera.
 */
function sinSustitutosSueltos(s: string): string {
  return s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '�');
}

function xor(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    out += String.fromCharCode(text.charCodeAt(i) ^ KEY!.charCodeAt(i % KEY!.length));
  }
  return out;
}

/**
 * ⚠️ FALLA CERRADO: tira si no puede obfuscar.
 *
 * 🔴 Antes hacía `catch { return text }`, o sea que ante cualquier error
 * **guardaba el texto plano** en una columna que todo el resto del sistema
 * trata como obfuscada, y nadie se enteraba: `decryptMessage` es tolerante, así
 * que el mensaje se leía bien y el problema quedaba invisible para siempre.
 * Guardar en claro sin decirlo es peor que no guardar: quien llama tiene que
 * poder mostrar "no se pudo enviar".
 */
export function encryptMessage(text: string): string {
  if (!KEY) throw new Error(FALTA_CLAVE);
  try {
    return btoa(xor(encodeURIComponent(sinSustitutosSueltos(text))));
  } catch (e) {
    throw new Error(`No se pudo preparar el mensaje para enviarlo: ${(e as Error)?.message ?? e}`);
  }
}

/**
 * 📝 Este SÍ es tolerante, y es correcto que lo sea: devuelve la entrada tal
 * cual si no la puede decodificar. Hay mensajes viejos guardados en claro (de
 * antes de que esto existiera, y de la época en que `encryptMessage` fallaba
 * abierto), y esconderlos sería perder historial de conversaciones reales.
 */
export function decryptMessage(encrypted: string): string {
  if (!KEY) return encrypted;
  try {
    return decodeURIComponent(xor(atob(encrypted)));
  } catch {
    return encrypted;
  }
}
