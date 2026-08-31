// La guía contextual: las cards que explican cada pantalla la primera vez.
//
// 🔴 Contextual y NO un tour de bienvenida, a propósito. Un tour lineal explica
// cinco pantallas antes de que la persona haya usado ninguna, y es el formato
// que se saltea por reflejo — además de chocar de frente con "si abruma, sobra".
// Estas aparecen cuando llegás a la pantalla, hablando de lo que estás mirando.
//
// Lo que les faltaba y ahora tienen es el HILO: un contador que dice cuántas
// quedan y una salida que las apaga todas de una. Antes eran cuatro pop-ups
// sueltos, sin relación entre sí y sin forma de decir "no me muestres esto".

import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Los pasos numerados, en el orden en que se cuentan.
 *
 * ⚠️ Las claves son las que ya venían usando las cards. Renombrarlas les
 * mostraría la guía de nuevo a todo el mundo que ya la vio.
 *
 * 📝 `vive_tooltip_sala` NO está acá: la Sala no la alcanza cualquiera —hace
 * falta tener un profesional— y un contador que promete "3 de 4" a alguien que
 * quizá nunca abra un chat es una promesa que no se puede cumplir. Esa card
 * sigue existiendo suelta y respeta el "saltear", pero no se cuenta.
 */
export const PASOS_GUIA = [
  'vive_tooltip_inicio',
  'vive_tooltip_conexiones',
  'vive_tooltip_recursos',
] as const;

/** Una sola clave apaga todas las cards, incluida la de la Sala. */
const SALTEADA_KEY = 'vita_guia_salteada';

/** Qué eligió la persona en "¿Cómo te gustaría empezar?" */
const CAMINO_KEY = 'vita_onboarding_camino';
export type Camino = 'explore' | 'search' | 'guide';

export async function guardarCamino(camino: Camino): Promise<void> {
  // AsyncStorage y no la base: acá todavía no hay cuenta. La elección se toma
  // antes de registrarse, y en dos de los tres caminos puede no registrarse
  // nunca.
  await AsyncStorage.setItem(CAMINO_KEY, camino);
}

/**
 * Si esta card tiene que mostrarse.
 *
 * Los pasos numerados son para quien eligió explorar: a alguien que entró
 * diciendo "sé qué necesito" no se le explica la app, se lo deja buscar.
 *
 * ⚠️ Sin camino guardado la guía SÍ se muestra. Son las instalaciones que
 * vienen de antes de esto: es lo que ya les pasaba, y esconderla sería sacarles
 * algo por una elección que nunca tuvieron la chance de hacer.
 */
export async function guiaHabilitada(storageKey: string): Promise<boolean> {
  const esPasoNumerado = (PASOS_GUIA as readonly string[]).includes(storageKey);

  const pares = await AsyncStorage.multiGet([SALTEADA_KEY, CAMINO_KEY, storageKey]);
  const valor = (k: string) => pares.find(([key]) => key === k)?.[1] ?? null;

  if (valor(SALTEADA_KEY)) return false;
  if (valor(storageKey)) return false;                 // esta ya se vio
  if (!esPasoNumerado) return true;                    // la Sala solo respeta el saltear

  const camino = valor(CAMINO_KEY);
  return camino === null || camino === 'explore';
}

/**
 * Qué número le toca a esta card: las ya vistas + 1.
 *
 * 🔴 Por orden de APARICIÓN y no por posición fija en la lista. Si alguien entra
 * primero a Recursos, un número fijo le diría "3 de 3" en la primera card que
 * ve. Así siempre lee 1, 2, 3 en el orden en que realmente camina la app.
 *
 * Devuelve null si esta card no es un paso numerado (la Sala).
 */
export async function numeroDePaso(storageKey: string): Promise<{ paso: number; total: number } | null> {
  if (!(PASOS_GUIA as readonly string[]).includes(storageKey)) return null;
  const pares = await AsyncStorage.multiGet([...PASOS_GUIA]);
  const vistas = pares.filter(([, v]) => !!v).length;
  return { paso: Math.min(vistas + 1, PASOS_GUIA.length), total: PASOS_GUIA.length };
}

export async function marcarVista(storageKey: string): Promise<void> {
  await AsyncStorage.setItem(storageKey, '1');
}

/** "Saltear la guía": apaga todo de una, no solo la card que está abierta. */
export async function saltearGuia(): Promise<void> {
  await AsyncStorage.setItem(SALTEADA_KEY, '1');
}
