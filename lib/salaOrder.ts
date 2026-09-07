// Cómo se ordena la lista de Mensajes del USUARIO.
//
// 🔴 POSICIÓN FIJA, NO RECENCIA. Es la decisión de fondo de la pantalla y no
// una preferencia de orden: cada profesional tiene SU fila, siempre la misma,
// y no se mueve nunca.
//
// Antes se ordenaba por último mensaje (más reciente arriba), copiando a
// WhatsApp. Ahí ese orden se gana el lugar: con 300 hilos, poner arriba lo que
// se movió te ahorra buscar. Acá el usuario tiene DOS A CUATRO salas y las ve
// TODAS AL MISMO TIEMPO, sin scrollear — así que no hay nada que buscar, y el
// orden por recencia cobraba sin dar nada a cambio: la fila que ayer estaba
// primera hoy estaba segunda, y entonces había que LEER antes de tocar.
//
// De ahí venía el problema que se intentó arreglar cuatro veces desde otro
// lado (aire calculado del 12% → tarjeta genérica → tarjeta con nombre →
// carrusel): la primera fila parecía quedar lejos del pulgar porque no se
// podía apuntar de memoria. Una fila que está SIEMPRE en el mismo lugar se
// acierta bien aunque esté alta.
//
// 🔴 ASCENDENTE, y es lo contraintuitivo. Con la sala más VIEJA arriba, un
// profesional nuevo se agrega AL FINAL y no mueve a nadie. Descendente (el
// nuevo arriba) empujaría a todos una fila para abajo cada vez que reservás
// con alguien más — que es justo la inestabilidad que este orden viene a
// eliminar.
//
// 📝 Las salas sin ningún mensaje siguen cayendo al final, pero ya no por una
// regla propia: una sala recién creada es la más nueva, así que va última
// sola. Se borró la rama que las separaba a mano.
//
// 📝 El NO LEÍDO no toca el orden a propósito. Ya se dice con el punto y el
// nombre en negrita de la fila (`SalaRow`), que con 2-4 filas visibles a la
// vez alcanza y sobra; moverla además sería decir dos veces lo mismo y
// devolvería el movimiento por la ventana.
//
// ⚠️ La contra, dicha de frente: un profesional con el que hablaste una vez y
// nunca más queda arriba para siempre. Es el precio de la estabilidad y se
// acepta — con 2-4 filas "arriba" no es un lugar privilegiado, las ves todas
// igual. Si algún día molesta, la salida es archivar del lado usuario (como ya
// existe del lado coach), NO un corte por inactividad, que reintroduce
// movimiento.
//
// ⚠️ NO es `agruparRoster` de `lib/coachRoster.ts`, y la divergencia es más
// fuerte que antes. El coach tiene 20 personas, NO las ve todas juntas y entra
// a preparar a quién ve mañana: ahí el orden sí es la herramienta para
// encontrar, y por eso ordena por próxima sesión. Un criterio único para las
// dos pantallas rompería una de las dos.
//
// Afuera de la pantalla por el mismo motivo que `lib/ejesLayout.ts` y
// `lib/coachRoster.ts`: es la regla del orden, se puede probar sin montar nada,
// y adentro del componente nadie la iba a mirar de nuevo.

export type FilaSala = {
  createdAt: string | null;
};

/**
 * Por antigüedad del vínculo, de la sala más vieja a la más nueva.
 *
 * Es pura: `slice` copia antes de ordenar, así que `filas` no se toca.
 */
export function ordenarSalas<T extends FilaSala>(filas: T[]): T[] {
  // `createdAt` es NOT NULL en la base; el guard es por si la consulta deja de
  // pedir la columna, para que el orden degrade en vez de dar NaN.
  return filas.slice().sort((a, b) => {
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return Date.parse(a.createdAt) - Date.parse(b.createdAt);
  });
}
