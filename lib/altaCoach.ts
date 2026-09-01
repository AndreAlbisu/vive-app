// ¿Hay un alta de coach a medio hacer?
//
// 🔴 POR QUÉ EXISTE. El alta crea la cuenta y abre sesión ANTES de que la
// persona termine: primero verifica el mail, después llena la postulación. Si
// abandona por navegación, `useCerrarSesionAlSalir` cierra la sesión. Pero si
// **cierra la app** no corre nada, la sesión sobrevive en AsyncStorage, y al
// volver a abrir el `AuthRedirect` la ve como una sesión normal y la deposita
// en el Inicio **como usuario final** — con una cuenta que creó queriendo ser
// profesional y un alta que nunca terminó.
//
// Esta marca es lo que le permite al arranque distinguir esa sesión a medias de
// una legítima, y retomar el alta donde quedó en vez de dejarla entrar.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'vita_alta_coach';

/** En qué paso quedó. Se guarda el paso y no un booleano para no hacerle
 *  repetir la verificación a quien ya la pasó. */
export type PasoAlta = 'verificar' | 'postular';

export async function marcarAlta(paso: PasoAlta): Promise<void> {
  await AsyncStorage.setItem(KEY, paso);
}

export async function pasoDelAlta(): Promise<PasoAlta | null> {
  const v = await AsyncStorage.getItem(KEY);
  return v === 'verificar' || v === 'postular' ? v : null;
}

/** El alta terminó (se envió la postulación) o se abandonó (se cerró sesión). */
export async function limpiarAlta(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
