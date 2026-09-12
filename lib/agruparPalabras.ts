// Parte una frase con tramos en negrita en PALABRAS reales, para que
// `TextoQueSeEscribe` las haga entrar de a una. Puro, sin React: se testea.

export type Tramo = { texto: string; fuerte?: boolean };
export type Pieza = { t: string; fuerte: boolean };

/**
 * Agrupa por PALABRAS (lo que queda entre espacios), no por tramos: la negrita
 * puede terminar pegada a un signo —"**Días difíciles**, y…"— y separar por
 * tramos dejaría la coma como una palabra suelta. Una palabra puede tener un
 * pedazo en negrita y otro no.
 *
 * Cada palabra lleva su espacio al final (menos la última), porque en la fila
 * que envuelve cada una es un elemento aparte: sin el espacio quedarían pegadas.
 * Los espacios repetidos se colapsan en uno, como hace `<Text>`.
 */
export function agruparPalabras(tramos: Tramo[]): Pieza[][] {
  const grupos: Pieza[][] = [];
  let actual: Pieza[] = [];
  for (const tramo of tramos) {
    for (const parte of tramo.texto.split(/(\s+)/)) {
      if (!parte) continue;
      if (/^\s+$/.test(parte)) {
        if (actual.length) {
          actual.push({ t: ' ', fuerte: false });
          grupos.push(actual);
          actual = [];
        }
      } else {
        actual.push({ t: parte, fuerte: !!tramo.fuerte });
      }
    }
  }
  if (actual.length) grupos.push(actual);
  return grupos;
}
