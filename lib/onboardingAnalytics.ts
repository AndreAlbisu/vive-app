// La analítica del onboarding.
//
// 🔴 POR QUÉ EXISTE Y NO SE LLAMA A `registrarEvento` DERECHO: `registrarEvento`
// escribe `user_id: session?.user?.id ?? null`, y en TODO el onboarding no hay
// sesión. O sea que sin esto los eventos caen todos con `user_id` en null y son
// indistinguibles entre sí: se podría contar cuánta gente tocó cada opción,
// pero no se podría saber si las tres respuestas de una pantalla y la siguiente
// son de la misma persona. Sin eso no hay embudo — que es justamente lo único
// que queremos saber.
//
// La solución es un id anónimo propio, guardado en el dispositivo, que viaja en
// `properties.sesion` de cada evento. No identifica a nadie: es un número al
// azar que solo sirve para pegar los eventos de un mismo recorrido.
//
// ⚠️ Se emite `onboarding_registro` cuando por fin aparece la cuenta
// (`AuthContext`), y ESE evento sí lleva `user_id`. Es el único punto donde el
// recorrido anónimo se puede unir con la persona — sin él, el embudo termina
// justo antes de lo que más importa medir.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { registrarEvento } from '@/lib/supabase';

const SESION_KEY = 'vita_onboarding_sesion';
// Marca de que este recorrido ya se unió con una cuenta (ver `enlazarConCuenta`).
const ENLAZADA_KEY = 'vita_onboarding_sesion_enlazada';

// Cache en memoria: el id se pide en cada evento y no queremos un round-trip a
// AsyncStorage por tap.
let sesionEnMemoria: string | null = null;

// 🔴 Se cachea la PROMESA, no solo el valor, y esa es toda la diferencia.
// Cachear el valor deja una ventana: varios eventos disparados en el mismo tick
// —el de "pantalla vista" y un toque rápido, por ejemplo— encuentran los tres
// el cache vacío, salen los tres a leer el storage, y como la lectura es
// asíncrona los tres terminan CREANDO UN ID DISTINTO. El recorrido de una
// persona quedaría partido en tres, que es justamente lo que esto viene a
// evitar. Con la promesa compartida, el primero que llega crea y los demás
// esperan al mismo resultado. Lo destapó un test.
let sesionPendiente: Promise<string> | null = null;

function nuevoId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function leerOCrear(): Promise<string> {
  try {
    const guardado = await AsyncStorage.getItem(SESION_KEY);
    if (guardado) { sesionEnMemoria = guardado; return guardado; }
  } catch {
    // Storage roto no puede impedir que la app arranque. Seguimos con uno
    // nuevo: se pierde el hilo, no la pantalla.
  }
  const id = nuevoId();
  sesionEnMemoria = id;
  try { await AsyncStorage.setItem(SESION_KEY, id); } catch { /* ídem */ }
  return id;
}

/** El id del recorrido actual. Lo crea la primera vez que se lo pide. */
export function idDeSesion(): Promise<string> {
  if (sesionEnMemoria) return Promise.resolve(sesionEnMemoria);
  if (!sesionPendiente) sesionPendiente = leerOCrear();
  return sesionPendiente;
}

/**
 * Anota un evento del onboarding.
 *
 * ⚠️ No devuelve nada y NUNCA tira. La analítica no puede romper ni frenar un
 * flujo: si falla la red o el storage, la persona tiene que poder seguir igual
 * y el error queda en el `console.warn` de `registrarEvento`.
 */
export function anotar(evento: string, props: Record<string, unknown> = {}): void {
  void (async () => {
    try {
      const sesion = await idDeSesion();
      await registrarEvento(evento, { ...props, sesion });
    } catch {
      // Ver arriba: silencio a propósito.
    }
  })();
}

/**
 * Mide cuánto tarda la persona en contestar una pantalla.
 *
 * 📝 Es señal de duda, que es lo que no se puede leer del resultado: dos
 * personas que eligen lo mismo, una en dos segundos y otra en veinte, no están
 * diciendo lo mismo sobre la pregunta.
 */
export function cronometro(): () => number {
  const t0 = Date.now();
  return () => Math.round((Date.now() - t0) / 100) / 10;  // segundos con un decimal
}

/**
 * Une el recorrido anónimo con la cuenta recién aparecida.
 *
 * 🔴 Lo llama `AuthContext` en el `onAuthStateChange`, que es el primer momento
 * en que hay sesión. Como `registrarEvento` lee la sesión sola, este evento
 * queda con `user_id` Y con `sesion`: es la única fila que tiene las dos
 * mitades, y sin ella el embudo se corta justo antes de la conversión.
 *
 * ⚠️ Solo emite si el dispositivo YA tenía un id — o sea, si esta persona pasó
 * por el onboarding. Crear uno acá inventaría un recorrido que no existió, y
 * ensuciaría la métrica con todos los que ya venían instalados de antes.
 */
export async function enlazarConCuenta(): Promise<void> {
  try {
    const guardado = sesionEnMemoria ?? (await AsyncStorage.getItem(SESION_KEY));
    // Sin recorrido previo no hay nada que enlazar (ver el ⚠️ de arriba).
    if (!guardado) return;
    sesionEnMemoria = guardado;
    // 📝 Una sola vez por dispositivo: `onAuthStateChange` dispara en cada
    // arranque de la app, y sin esto habría una fila de "registro" por cada
    // apertura, que arruinaría el conteo de conversión.
    if (await AsyncStorage.getItem(ENLAZADA_KEY)) return;
    await AsyncStorage.setItem(ENLAZADA_KEY, '1');
    await registrarEvento('onboarding_registro', { sesion: guardado });
  } catch {
    // Ver `anotar`: la analítica nunca frena un flujo.
  }
}
