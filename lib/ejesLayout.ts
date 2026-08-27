// Alto de las columnas de ejes en Conexiones (fase 1).
//
// 🔴 Era un número fijo (354) y por eso solo se veía bien en la pantalla con la
// que se diseñó. El ancho de cada columna SÍ es proporcional —son `flex: 1`, se
// reparten lo que haya— así que con el alto clavado la proporción se deformaba
// en los dos sentidos: 4,08:1 en un iPhone SE (flacas y estiradas) contra
// 2,87:1 en un 15 Pro Max (anchas y chatas). El diseño se aprobó en 3,22:1.

/** Proporción alto/ancho aprobada: 354 sobre una columna de 110 en un 390. */
export const EJE_RATIO = 3.22;

/** Margen lateral de la grilla (20 por lado) más los dos huecos de 10. */
const EJE_GUTTERS = 20 * 2 + 10 * 2;

/**
 * Piso. No lo alcanza ningún teléfono —el más angosto en circulación (320) da
 * 280— pero por debajo de esto el contenido (ícono, dos líneas de título, hasta
 * tres de bajada y la flecha) mide más que la caja y la proporción se rompe
 * igual, así que conviene que exista.
 */
export const EJE_ALTO_MIN = 260;

/**
 * Techo. Sin él una tablet daría más de 700pt: tres bloques altísimos ocupando
 * la pantalla entera. Un 15 Pro Max, el teléfono más ancho, pide 396 — así que
 * el techo no le pega a ningún teléfono, solo frena el disparate.
 */
export const EJE_ALTO_MAX = 420;

export function anchoDeColumna(anchoPantalla: number): number {
  return (anchoPantalla - EJE_GUTTERS) / 3;
}

export function altoDeEje(anchoPantalla: number): number {
  const ideal = anchoDeColumna(anchoPantalla) * EJE_RATIO;
  return Math.round(Math.max(EJE_ALTO_MIN, Math.min(EJE_ALTO_MAX, ideal)));
}
