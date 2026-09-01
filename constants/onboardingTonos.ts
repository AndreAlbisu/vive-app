import AsyncStorage from '@react-native-async-storage/async-storage';

// Los dos colores de la bifurcación del onboarding, en un solo lugar.
//
// Existen acá y no dentro de `OnboardingBifurcacion` porque los usan las DOS
// puntas de la transición: el ala que se expande al tocarla, y la pantalla que
// recibe. Si cada una tuviera su copia, el color se despegaría en la primera
// edición y el derrame terminaría en un tono que no es el que se fue.
// 🔴 Son los rellenos de las ALAS, no los acentos de los íconos. El que se
// expande al elegir es el área de color de fondo —la forma curva— así que la
// pantalla que recibe tiene que llegar en ese mismo tono y no en el saturado.
export const TONOS = {
  crecer:    '#E8E7DB',  // SALVIA  — el ala izquierda
  acompanar: '#F8E7DA',  // DURAZNO — el ala derecha
} as const;

export type Tono = keyof typeof TONOS;

/**
 * El camino elegido en la bifurcación, para que las pantallas que siguen tomen
 * su color.
 *
 * 🔴 Persistido y no pasado por parámetro: el tono tiene que sobrevivir CINCO
 * pantallas (bifurcación → 2 → 3 → 4 → 5 → registro). Reenviarlo en cada
 * navegación significa que la primera que se olvide corta la cadena y de ahí en
 * adelante todo vuelve al crema, sin que nada falle de forma visible.
 */
const CAMINO_KEY = 'vita_onboarding_tono';

export async function guardarTono(t: Tono): Promise<void> {
  await AsyncStorage.setItem(CAMINO_KEY, t);
}

export async function leerTono(): Promise<Tono | null> {
  const v = await AsyncStorage.getItem(CAMINO_KEY);
  return v && v in TONOS ? (v as Tono) : null;
}

/**
 * El onboarding terminó: el tono deja de aplicar.
 *
 * ⚠️ Sin esto queda guardado para siempre, y alguien que eligió "acompañar"
 * hace meses vería la pantalla de registro en durazno al volver por cualquier
 * otro camino — un color que ya no significa nada.
 */
export async function limpiarTono(): Promise<void> {
  await AsyncStorage.removeItem(CAMINO_KEY);
}

/** El parámetro llega por la ruta, o sea que puede ser cualquier cosa. */
export function colorDeTono(v: string | string[] | undefined): string | null {
  const t = Array.isArray(v) ? v[0] : v;
  return t && t in TONOS ? TONOS[t as Tono] : null;
}
