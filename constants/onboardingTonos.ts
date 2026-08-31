// Los dos colores de la bifurcación del onboarding, en un solo lugar.
//
// Existen acá y no dentro de `OnboardingBifurcacion` porque los usan las DOS
// puntas de la transición: el ala que se expande al tocarla, y la pantalla que
// recibe. Si cada una tuviera su copia, el color se despegaría en la primera
// edición y el derrame terminaría en un tono que no es el que se fue.
export const TONOS = {
  crecer:    '#3F512F',  // VERDE_ICON — "Quiero crecer"
  acompanar: '#C4743A',  // NARANJA    — "Quiero acompañar"
} as const;

export type Tono = keyof typeof TONOS;

/** El parámetro llega por la ruta, o sea que puede ser cualquier cosa. */
export function colorDeTono(v: string | string[] | undefined): string | null {
  const t = Array.isArray(v) ? v[0] : v;
  return t && t in TONOS ? TONOS[t as Tono] : null;
}
