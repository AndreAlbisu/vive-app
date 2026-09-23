// Dónde vive la sesión (el token que te mantiene logueado) en el teléfono.
//
// 🔴 L58, auditoría del 23/09/2026. Hasta hoy la guardaba `AsyncStorage`, que
// es el default de Supabase y de casi cualquier app Expo: un archivo común
// dentro del sandbox de la app, en texto plano. Lo protege el sistema operativo
// mientras el teléfono no esté rooteado y nadie extraiga un backup. El llavero
// del sistema (Keychain en iOS, Keystore en Android) lo protege además con
// hardware.
//
// Se hizo AHORA porque el cambio desloguea a todo el mundo al actualizar, y hoy
// **no hay un solo usuario real**: es gratis. Con gente adentro, cuesta.
//
// Tres decisiones que no son obvias:
//
//  1. 📦 **Se parte en pedazos.** `expo-secure-store` rechaza valores grandes
//     (históricamente iOS cortaba cerca de los 2048 bytes) y una sesión de
//     Supabase con sus dos JWT pasa ese tamaño. Se guarda un contador y N
//     pedazos, y al escribir se borran los sobrantes de una sesión anterior más
//     larga — si no, quedarían colgados y una lectura futura los volvería a unir.
//
//  2. 🔓 **`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`** y no el default
//     (`WHEN_UNLOCKED`). Con el default, el llavero **no se puede leer con el
//     teléfono bloqueado**, y Supabase renueva el token en segundo plano: la
//     sesión se rompería sola durante la noche. `THIS_DEVICE_ONLY` además evita
//     que viaje al llavero de iCloud y aparezca en otro equipo.
//
//  3. 🚪 **Si el llavero falla, se usa AsyncStorage.** Dejar a alguien sin poder
//     entrar a la app es peor que guardar su sesión como se guardaba hasta ayer.
//     Queda anotado en consola, no en silencio.
//
// ⚠️ En iOS el llavero **sobrevive a desinstalar la app**: quien reinstale va a
// seguir logueado. Es el comportamiento de Keychain, no un error.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/** Bien por debajo del límite histórico de 2048 bytes de iOS. */
const TAMANO_PEDAZO = 1500;

/** Hasta acá se buscan pedazos colgados de una sesión anterior más larga. */
const MAX_PEDAZOS = 40;

const OPCIONES: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

/** `expo-secure-store` solo acepta [A-Za-z0-9._-] en las claves. La de Supabase
 *  (`sb-<ref>-auth-token`) ya cumple, pero esto lo vuelve cierto para cualquiera
 *  que se agregue después. */
function normalizar(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

const claveContador = (key: string) => `${normalizar(key)}.n`;
const clavePedazo = (key: string, i: number) => `${normalizar(key)}.${i}`;

async function borrarPedazos(key: string, desde: number, hasta: number): Promise<void> {
  for (let i = desde; i < hasta; i++) {
    await SecureStore.deleteItemAsync(clavePedazo(key, i), OPCIONES);
  }
}

async function guardar(key: string, value: string): Promise<void> {
  const pedazos: string[] = [];
  for (let i = 0; i < value.length; i += TAMANO_PEDAZO) {
    pedazos.push(value.slice(i, i + TAMANO_PEDAZO));
  }
  for (let i = 0; i < pedazos.length; i++) {
    await SecureStore.setItemAsync(clavePedazo(key, i), pedazos[i], OPCIONES);
  }
  await SecureStore.setItemAsync(claveContador(key), String(pedazos.length), OPCIONES);
  // Los de una sesión anterior más larga.
  await borrarPedazos(key, pedazos.length, MAX_PEDAZOS);
}

async function leer(key: string): Promise<string | null> {
  const n = await SecureStore.getItemAsync(claveContador(key), OPCIONES);
  if (!n) return null;
  const total = Number(n);
  if (!Number.isFinite(total) || total <= 0) return null;

  let out = '';
  for (let i = 0; i < total; i++) {
    const pedazo = await SecureStore.getItemAsync(clavePedazo(key, i), OPCIONES);
    // Un pedazo faltante hace que el JSON no parsee y Supabase lo trate como
    // "sin sesión". Se devuelve null derecho, que es lo mismo pero explícito.
    if (pedazo == null) return null;
    out += pedazo;
  }
  return out;
}

async function borrar(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(claveContador(key), OPCIONES);
  await borrarPedazos(key, 0, MAX_PEDAZOS);
}

/**
 * La sesión que ya estaba en AsyncStorage se muda al llavero la primera vez que
 * se la pide, y recién ahí se borra del lugar viejo. Sin esto, actualizar la app
 * desloguearía a quien la tuviera abierta — hoy son las cuentas de prueba, pero
 * el costo de hacerlo bien es este bloque.
 */
async function migrarSiHaceFalta(key: string): Promise<string | null> {
  const viejo = await AsyncStorage.getItem(key);
  if (viejo == null) return null;
  try {
    await guardar(key, viejo);
    await AsyncStorage.removeItem(key);
    console.log('[sesión] mudada de AsyncStorage al llavero del sistema');
  } catch (e) {
    // Si el llavero no la aceptó, se devuelve igual lo que había: la persona
    // sigue logueada y la próxima lectura vuelve a intentar.
    console.warn('[sesión] no se pudo mudar al llavero:', (e as Error)?.message ?? e);
  }
  return viejo;
}

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const enLlavero = await leer(key);
      if (enLlavero != null) return enLlavero;
      return await migrarSiHaceFalta(key);
    } catch (e) {
      console.warn('[sesión] el llavero falló al leer, se usa AsyncStorage:', (e as Error)?.message ?? e);
      return AsyncStorage.getItem(key);
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      await guardar(key, value);
    } catch (e) {
      console.warn('[sesión] el llavero falló al guardar, se usa AsyncStorage:', (e as Error)?.message ?? e);
      await AsyncStorage.setItem(key, value);
    }
  },

  async removeItem(key: string): Promise<void> {
    // Las dos, siempre: cerrar sesión no puede dejar una copia viva en el lugar
    // viejo si la migración quedó a medias.
    try {
      await borrar(key);
    } catch (e) {
      console.warn('[sesión] el llavero falló al borrar:', (e as Error)?.message ?? e);
    }
    await AsyncStorage.removeItem(key);
  },
};

/** Solo para los tests: las piezas puras, sin `expo-secure-store` de por medio. */
export const _internals = { TAMANO_PEDAZO, MAX_PEDAZOS, normalizar, claveContador, clavePedazo };
