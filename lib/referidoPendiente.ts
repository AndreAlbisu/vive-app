// El código de invitación, esperando a que exista la cuenta.
//
// 🔴 **POR QUÉ EXISTE, y por qué el canje se mudó al registro (23/09/2026).**
// Hasta esa fecha el código se canjeaba desde el Perfil, en cualquier momento
// mientras la persona no hubiera pagado todavía. Eso tenía dos problemas:
//
//   · El momento natural, que es **crear la cuenta** (el código acaba de llegar
//     por WhatsApp), no lo pedía en ningún lado.
//   · Y al quedar disponible después, dejaba de ser un programa de referidos:
//     quien llegaba solo, miraba la app una semana y justo antes de pagar le
//     pedía un código a un amigo se llevaba el descuento igual. Eso es **un 10%
//     universal en la primera sesión**, que es justo la práctica que se decidió
//     no copiarle a Selia porque acostumbra a no pagar precio lleno.
//
// El canje necesita una sesión (`canjear_codigo` usa `auth.uid()`), y en el
// registro la cuenta todavía no existe. Así que el código se guarda acá y lo
// canjea `AuthContext` en cuanto aparece la sesión, igual que
// `quizPendiente.volcarPendiente`.
//
// 📌 Sirve para los tres caminos de alta (mail, Google y Apple) sin tocar
// ninguno: los tres terminan en una sesión nueva.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { normalizarCodigo, tieneFormaDeCodigo } from '@/lib/referidos';

const CLAVE = 'vita_referido_pendiente';

/** Lo guarda el registro (o un link con `?ref=`) antes de que exista la cuenta. */
export async function guardarCodigoPendiente(codigo: string): Promise<void> {
  const limpio = normalizarCodigo(codigo);
  if (!tieneFormaDeCodigo(limpio)) return;
  try { await AsyncStorage.setItem(CLAVE, limpio); } catch { /* modo privado */ }
}

export async function leerCodigoPendiente(): Promise<string | null> {
  try { return await AsyncStorage.getItem(CLAVE); } catch { return null; }
}

/**
 * Canjea lo que haya guardado. Lo llama `AuthContext` al aparecer una sesión.
 *
 * ⚠️ **Borra el código pase lo que pase, salvo que el error sea de red.** Si el
 * código no existe o la persona no califica, reintentarlo en cada arranque no lo
 * va a arreglar: lo único que lograría es una consulta por sesión para siempre.
 */
export async function canjearReferidoPendiente(): Promise<void> {
  const codigo = await leerCodigoPendiente();
  if (!codigo) return;

  const { error } = await supabase.rpc('canjear_codigo', { p_codigo: codigo });

  // Un fallo de red no gasta el intento: sin `error.code` de Postgres, es que la
  // llamada no llegó.
  const esDeRed = !!error && !error.message;
  if (esDeRed) return;

  try { await AsyncStorage.removeItem(CLAVE); } catch { /* ignorar */ }
}
