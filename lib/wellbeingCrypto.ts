// Cifrado del diario y de la gratitud (05/10/2026).
//
// El texto se cifra EN EL TELÉFONO antes de subir y se descifra al leer. En la
// base queda ilegible: un volcado de la tabla, un backup filtrado o un error en
// una policy no exponen lo que la persona escribió.
//
// 🔴 A diferencia de `lib/encryption.ts` (XOR, que no es cifrado), esto SÍ lo es:
// AES-256-GCM-SIV. Pero NO es de extremo a extremo, y no hay que decirlo así en
// ningún texto visible: la clave la entrega el servidor (`wellbeing-key`), que
// puede recalcularla. Qué protege, qué no y por qué se eligió así está en la
// cabecera de `supabase/functions/wellbeing-key/index.ts`.
//
// Tres decisiones que no son obvias:
//
//  1. 🎲 **GCM-SIV y no GCM a secas.** GCM se rompe entero si alguna vez se
//     repite el número de un solo uso; GCM-SIV, si se repite, solo deja ver que
//     dos textos son iguales. Importa porque el generador aleatorio bueno
//     (`expo-crypto`) es código NATIVO, y un cliente de desarrollo compilado
//     antes de tenerlo no lo trae (mismo problema que `secureSessionStorage`).
//     En ese caso el número sale del reloj y de `Math.random`, que con GCM-SIV
//     alcanza y con GCM no.
//
//  2. 🔗 **El texto queda atado a su dueño.** El id de la persona entra como
//     dato autenticado: una entrada copiada a la fila de otro no abre.
//
//  3. 🚪 **Guardar falla cerrado, leer es tolerante.** Sin clave no se guarda
//     (quien llama muestra "no se pudo guardar"), nunca se sube texto en claro
//     a una columna que el resto del sistema trata como cifrada. Al leer, lo
//     que no tiene el prefijo se devuelve tal cual: son las entradas de antes
//     de este cambio, y esconderlas sería perder lo que alguien escribió.

import { gcmsiv } from '@noble/ciphers/aes';
import type * as SecureStoreTipos from 'expo-secure-store';
import { supabase } from '@/lib/supabase';
import { sinSustitutosSueltos } from '@/lib/encryption';

/** Marca de "esto está cifrado", con versión. `scripts/decodificar-export.mjs` usa la misma. */
const PREFIJO = 'vd1.';

const NONCE_BYTES = 12;

/** Lo que se muestra en lugar de una entrada cifrada que no se pudo abrir. */
export const NO_SE_PUDO_ABRIR = 'No se pudo abrir esta entrada. Revisá la conexión y volvé a entrar.';

// ─── Bytes ↔ texto ────────────────────────────────────────────────────────────
// A mano y no con TextEncoder/TextDecoder: en Hermes el decoder no estuvo
// siempre, y esto anda igual en el teléfono, en Jest y en Node.

function aBytes(texto: string): Uint8Array {
  const esc = encodeURIComponent(sinSustitutosSueltos(texto));
  const out: number[] = [];
  for (let i = 0; i < esc.length; i++) {
    if (esc[i] === '%') {
      out.push(parseInt(esc.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      out.push(esc.charCodeAt(i));
    }
  }
  return Uint8Array.from(out);
}

function aTexto(bytes: Uint8Array): string {
  let esc = '';
  for (let i = 0; i < bytes.length; i++) esc += '%' + bytes[i].toString(16).padStart(2, '0');
  return decodeURIComponent(esc);
}

function aBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function deBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ─── Número de un solo uso ────────────────────────────────────────────────────

let avisoSinAleatorio = false;

function nonce(): Uint8Array {
  try {
    // Carga tardía: es un módulo nativo (ver decisión 1 arriba).
    const { getRandomBytes } = require('expo-crypto');
    return getRandomBytes(NONCE_BYTES);
  } catch (e) {
    if (!avisoSinAleatorio) {
      avisoSinAleatorio = true;
      console.warn(
        '[bienestar] sin generador aleatorio nativo en este build; se usa el reloj. ' +
        'Se arregla solo al compilar un cliente nuevo.',
        (e as Error)?.message ?? e,
      );
    }
    const out = new Uint8Array(NONCE_BYTES);
    let t = Date.now();
    for (let i = 0; i < 6; i++) { out[i] = t % 256; t = Math.floor(t / 256); }
    for (let i = 6; i < NONCE_BYTES; i++) out[i] = Math.floor(Math.random() * 256);
    return out;
  }
}

// ─── Cifrar y descifrar (puras) ───────────────────────────────────────────────

export function estaCifrado(valor: string | null | undefined): boolean {
  return typeof valor === 'string' && valor.startsWith(PREFIJO);
}

/**
 * ⚠️ FALLA CERRADO: tira si no puede cifrar. El texto vacío se devuelve vacío
 * (Gratitud guarda como '' los campos que la persona dejó sin llenar, y la
 * pantalla los reconoce por eso).
 */
export function cifrar(texto: string, clave: Uint8Array, userId: string): string {
  if (texto === '') return '';
  if (clave.length !== 32) throw new Error('Clave de bienestar inválida.');
  const n = nonce();
  const cifrado = gcmsiv(clave, n, aBytes(userId)).encrypt(aBytes(texto));
  const junto = new Uint8Array(n.length + cifrado.length);
  junto.set(n, 0);
  junto.set(cifrado, n.length);
  return PREFIJO + aBase64(junto);
}

/**
 * Tolerante: lo que no está cifrado (entradas viejas) vuelve tal cual. Lo que
 * está cifrado y no se puede abrir —sin clave, o alterado— vuelve como
 * `NO_SE_PUDO_ABRIR`, nunca como el texto cifrado crudo.
 */
export function descifrar(valor: string | null | undefined, clave: Uint8Array | null, userId: string): string {
  if (valor == null) return '';
  if (!estaCifrado(valor)) return valor;
  if (!clave) return NO_SE_PUDO_ABRIR;
  try {
    const junto = deBase64(valor.slice(PREFIJO.length));
    const n = junto.slice(0, NONCE_BYTES);
    const cifrado = junto.slice(NONCE_BYTES);
    return aTexto(gcmsiv(clave, n, aBytes(userId)).decrypt(cifrado));
  } catch {
    return NO_SE_PUDO_ABRIR;
  }
}

// ─── La clave ─────────────────────────────────────────────────────────────────
// Se pide una vez al servidor y queda en el llavero del sistema, para no hacer
// esperar a cada apertura del diario. Si el llavero no está en este build (o
// falla), queda solo en memoria y se vuelve a pedir en el próximo arranque:
// NUNCA se escribe en AsyncStorage, que es un archivo en texto plano.

const enMemoria = new Map<string, Uint8Array>();
const pidiendo = new Map<string, Promise<Uint8Array>>();

let llaveroModulo: typeof SecureStoreTipos | null = null;
let yaSeIntento = false;

function llavero(): typeof SecureStoreTipos | null {
  if (!yaSeIntento) {
    yaSeIntento = true;
    try {
      llaveroModulo = require('expo-secure-store');
    } catch {
      llaveroModulo = null;
    }
  }
  return llaveroModulo;
}

// El id es un uuid: ya cumple con [A-Za-z0-9._-], lo único que acepta el llavero.
const claveLlavero = (userId: string) => `vita.bienestar.v1.${userId}`;

// El diario solo se usa con la app abierta, así que alcanza con que el llavero
// se pueda leer con el teléfono desbloqueado. `THIS_DEVICE_ONLY`: no viaja al
// llavero de iCloud.
function opciones(): SecureStoreTipos.SecureStoreOptions {
  return { keychainAccessible: llavero()?.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
}

function claveValida(b64: unknown): Uint8Array | null {
  if (typeof b64 !== 'string') return null;
  try {
    const bytes = deBase64(b64);
    return bytes.length === 32 ? bytes : null;
  } catch {
    return null;
  }
}

async function pedirAlServidor(userId: string): Promise<Uint8Array> {
  const { data, error } = await supabase.functions.invoke('wellbeing-key');
  const clave = error ? null : claveValida(data?.key);
  if (!clave) throw new Error('No se pudo obtener la clave de bienestar.');
  try {
    await llavero()?.setItemAsync(claveLlavero(userId), aBase64(clave), opciones());
  } catch (e) {
    console.warn('[bienestar] no se pudo guardar la clave en el llavero:', (e as Error)?.message ?? e);
  }
  return clave;
}

/** Tira si no hay forma de conseguirla (sin conexión y sin copia en el llavero). */
export async function obtenerClave(userId: string): Promise<Uint8Array> {
  const yaEsta = enMemoria.get(userId);
  if (yaEsta) return yaEsta;

  // Diario y Gratitud piden la clave al abrir y otra vez al guardar: que dos
  // pedidos seguidos compartan el mismo viaje.
  const enCurso = pidiendo.get(userId);
  if (enCurso) return enCurso;

  const promesa = (async () => {
    let clave: Uint8Array | null = null;
    try {
      clave = claveValida(await llavero()?.getItemAsync(claveLlavero(userId), opciones()));
    } catch {
      clave = null;
    }
    if (!clave) clave = await pedirAlServidor(userId);
    enMemoria.set(userId, clave);
    return clave;
  })();

  pidiendo.set(userId, promesa);
  try {
    return await promesa;
  } finally {
    pidiendo.delete(userId);
  }
}

/** Como `obtenerClave`, pero devuelve null en vez de tirar. Para leer. */
export async function obtenerClaveSiSePuede(userId: string): Promise<Uint8Array | null> {
  try {
    return await obtenerClave(userId);
  } catch (e) {
    console.warn('[bienestar]', (e as Error)?.message ?? e);
    return null;
  }
}

/** Al cerrar sesión: la clave del que se va no queda en el teléfono. */
export async function olvidarClave(userId: string): Promise<void> {
  enMemoria.delete(userId);
  try {
    await llavero()?.deleteItemAsync(claveLlavero(userId), opciones());
  } catch {
    // Sin llavero no había nada guardado.
  }
}

/** Solo para los tests. */
export const _internals = { PREFIJO, aBytes, aTexto, olvidarTodoEnMemoria: () => enMemoria.clear() };
