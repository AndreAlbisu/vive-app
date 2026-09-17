// M14 (docs/problemas-abiertos.md): cómo trabaja el profesional.
//
// Sale del quiz de Selia, que además de preguntar si querés un psicólogo
// pregunta qué TIPO DE ACOMPAÑAMIENTO querés. Acá eso se parte en dos, y la
// división es la decisión de fondo:
//
//   ESTILO    Se le pregunta a la PERSONA, en sus palabras. Lo contesta
//             cualquier profesional, tenga matrícula o no, y es lo único que
//             mira el quiz.
//   ENFOQUE   La escuela, con su nombre técnico. La elige el profesional y se
//             muestra en su perfil. A la persona NO se le pregunta: quien busca
//             ayuda por primera vez no sabe qué es "sistémico", y esa pregunta
//             expulsa. Selia la deja opcional por lo mismo.
//
// Los valores tienen que coincidir con los CHECK de `coaches.estilo` y
// `coaches.enfoques` (scripts/add-coach-enfoque.sql).
//
// ⚠️ El estilo NUNCA saca a nadie de la lista: ordena y explica. Con pocos
// profesionales, filtrar por acá vacía la pantalla, y la lección de M1 es que
// el quiz no puede aflojar filtros en silencio. Un perfil que no contestó su
// estilo no gana ni pierde nada: no se dice nada de él.

/** Lo que el PROFESIONAL declara de sí mismo. */
export type EstiloCoach = 'escucha' | 'herramientas' | 'ambos';

/** Lo que la PERSONA pide en el quiz. `any` = no tiene preferencia. */
export type EstiloPedido = 'escucha' | 'herramientas' | 'any';

export const ESTILO_OPCIONES_PERSONA: { id: EstiloPedido; label: string; desc: string }[] = [
  { id: 'escucha',      label: 'Que me escuche',       desc: 'Entender qué me pasa y por qué, a mi ritmo' },
  { id: 'herramientas', label: 'Que me dé herramientas', desc: 'Ejercicios y cosas concretas para practicar' },
  { id: 'any',          label: 'No sabría decir',      desc: 'Prefiero verlo en la primera sesión' },
];

export const ESTILO_OPCIONES_COACH: { id: EstiloCoach; label: string; desc: string }[] = [
  { id: 'escucha',      label: 'Escucho y acompaño',    desc: 'El foco está en entender, al ritmo de la persona' },
  { id: 'herramientas', label: 'Doy herramientas',      desc: 'Ejercicios y tareas concretas entre sesiones' },
  { id: 'ambos',        label: 'Las dos cosas',         desc: 'Según lo que necesite cada persona' },
];

export type Enfoque =
  | 'psicoanalitico' | 'cognitivo_conductual' | 'sistemico'
  | 'gestaltico' | 'humanistico' | 'integrativo';

/** Las escuelas, con una línea en castellano común. La descripción no es para
 *  el profesional (él ya sabe cuál es la suya): es lo que lee la persona en su
 *  perfil, que es donde esto se muestra. */
export const ENFOQUES: { id: Enfoque; label: string; desc: string }[] = [
  { id: 'cognitivo_conductual', label: 'Cognitivo conductual', desc: 'Trabaja sobre pensamientos y conductas del presente, con ejercicios' },
  { id: 'psicoanalitico',       label: 'Psicoanalítico',       desc: 'Busca el origen de lo que pasa hoy en la historia de cada uno' },
  { id: 'sistemico',            label: 'Sistémico',            desc: 'Mira los vínculos y el entorno, no solo a la persona sola' },
  { id: 'gestaltico',           label: 'Gestáltico',           desc: 'Se centra en lo que pasa acá y ahora, y en darse cuenta' },
  { id: 'humanistico',          label: 'Humanístico',          desc: 'Parte de los recursos propios de cada persona para crecer' },
  { id: 'integrativo',          label: 'Integrativo',          desc: 'Combina herramientas de varias escuelas según el caso' },
];

/** Tope del CHECK de la base. Más que esto es marcar todas para aparecer siempre. */
export const MAX_ENFOQUES = 3;

export function esEstiloCoach(v: unknown): v is EstiloCoach {
  return v === 'escucha' || v === 'herramientas' || v === 'ambos';
}

export function esEnfoque(v: unknown): v is Enfoque {
  return ENFOQUES.some(e => e.id === v);
}

/** Qué decir del estilo de un perfil, dado lo que pidió la persona.
 *
 *  - `razon`      va con tilde: el perfil coincide.
 *  - `diferencia` va con guion: el perfil dice otra cosa, y se avisa.
 *  - las dos en null: no hay nada honesto que decir (no pidió nada, o el
 *    profesional no contestó). El silencio es a propósito.
 */
export function evaluarEstilo(
  estiloCoach: string | null | undefined,
  pedido: EstiloPedido | null,
): { razon: string | null; diferencia: string | null; coincide: boolean } {
  const vacio = { razon: null, diferencia: null, coincide: true };
  if (!pedido || pedido === 'any') return vacio;
  if (!esEstiloCoach(estiloCoach)) return vacio;

  if (estiloCoach === 'ambos') {
    return {
      razon: pedido === 'escucha'
        ? 'Acompaña escuchando, que es como lo pediste'
        : 'Trabaja con herramientas y ejercicios, como pediste',
      diferencia: null,
      coincide: true,
    };
  }

  if (estiloCoach === pedido) {
    return {
      razon: pedido === 'escucha'
        ? 'Su forma de trabajar es escuchar y acompañar, como pediste'
        : 'Trabaja con ejercicios concretos entre sesiones, como pediste',
      diferencia: null,
      coincide: true,
    };
  }

  return {
    razon: null,
    diferencia: pedido === 'escucha'
      ? 'Trabaja más con ejercicios que escuchando'
      : 'Trabaja más escuchando que con ejercicios',
    coincide: false,
  };
}

/** Cómo se lee el estilo en el perfil público. Null si no contestó. */
export function etiquetaEstilo(estilo: string | null | undefined): string | null {
  if (!esEstiloCoach(estilo)) return null;
  return ESTILO_OPCIONES_COACH.find(o => o.id === estilo)?.label ?? null;
}

/** Los nombres de las escuelas, listos para mostrar. Descarta lo que no conoce
 *  en vez de imprimir el valor crudo de la base. */
export function etiquetasEnfoques(enfoques: string[] | null | undefined): string[] {
  return (enfoques ?? [])
    .filter(esEnfoque)
    .map(id => ENFOQUES.find(e => e.id === id)!.label);
}
