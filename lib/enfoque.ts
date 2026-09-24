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
): Evaluacion {
  const vacio = { razon: null, diferencia: null, coincide: true };
  if (!pedido || pedido === 'any') return vacio;
  if (!esEstiloCoach(estiloCoach)) return vacio;

  // 🔴 "Las dos cosas" coincide, pero PARCIAL (21/09/2026). Si valiera lo mismo
  // que una respuesta exacta, marcar siempre la opción del medio sería la forma
  // de aparecer primero para todo el mundo. Y la frase no dice "como pediste":
  // no es lo que pidió, es algo que también hace.
  if (estiloCoach === 'ambos') {
    return {
      razon: pedido === 'escucha'
        ? 'También acompaña escuchando'
        : 'También trabaja con ejercicios',
      diferencia: null,
      coincide: true,
      parcial: true,
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

/** La escuela solo la declara quien tiene matrícula DE PSICOLOGÍA verificada.
 *
 *  Las seis opciones son escuelas de PSICOLOGÍA: un coach sin matrícula que
 *  marque "psicoanalítico" está insinuando en su perfil que es psicólogo, que
 *  es lo mismo que el buscador (03/09) y el quiz (17/09) dejaron de deducir del
 *  texto libre. Misma regla que `tipoProfesional`, extendida, no una nueva.
 *
 *  ✅ Desde el 23/09/2026 mira `coaches.profesion` y no `has_matricula`, que
 *  decía que había UNA matrícula sin decir de qué: una de nutrición habilitaba
 *  escuelas de psicología.
 *
 *  La regla de verdad vive en la base (`trg_enfoques_requieren_matricula`),
 *  porque una revocación de credencial tiene que poder limpiar un enfoque ya
 *  declarado. Esto es para que la pantalla no ofrezca lo que no se va a guardar. */
export function puedeDeclararEnfoque(profesion: string | null | undefined): boolean {
  return profesion === 'psicologia';
}

/** Qué mandar a guardar. Sin matrícula, vacío: guardar lo elegido sería pedirle
 *  a la base que lo descarte y mostrarle al profesional algo que no quedó. */
export function enfoquesAGuardar(
  profesion: string | null | undefined,
  elegidos: Enfoque[],
): Enfoque[] {
  return puedeDeclararEnfoque(profesion) ? elegidos : [];
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

// ─── M14 ampliado (21/09/2026): dos ejes más y el género ────────────────────
//
// El quiz medía una sola cosa (escucha o herramientas). El test de Selia mide
// cuatro, y dos de las que faltaban son diferencias reales que la persona puede
// contestar sin saber de escuelas:
//
//   GUÍA   Cuánto conduce el profesional: propone el camino, o acompaña el que
//          elige la persona.
//   FOCO   Hacia dónde mira el trabajo: la historia, algo del presente, o el
//          rumbo.
//
// 🔴 Lo que NO se copia de Selia: el rótulo final ("Tu enfoque: Transpersonal").
// Ponerle nombre de escuela a alguien con cuatro respuestas es una autoridad que
// no tenemos, y la persona no sabe qué significa. Acá las respuestas ordenan y
// se explican en cada perfil, con las mismas palabras en que se preguntaron.
//
// Mismas reglas que el estilo: nunca filtran, y un profesional que no contestó
// no gana ni pierde nada.

export type GuiaCoach = 'guia' | 'acompana' | 'ambos';
export type GuiaPedida = 'guia' | 'acompana' | 'any';
export type Foco = 'historia' | 'presente' | 'rumbo';
export type FocoPedido = Foco | 'any';
export type GeneroPedido = 'mujer' | 'varon' | 'any';

export const GUIA_OPCIONES_PERSONA: { id: GuiaPedida; label: string; desc: string }[] = [
  { id: 'guia',     label: 'Que me guíe',                desc: 'Que me diga por dónde empezar y cómo seguir' },
  { id: 'acompana', label: 'Que me acompañe en lo que elijo', desc: 'Que me escuche y oriente, pero la ruta la decido yo' },
  { id: 'any',      label: 'No sabría decir',            desc: 'Prefiero verlo en la primera sesión' },
];

export const GUIA_OPCIONES_COACH: { id: GuiaCoach; label: string; desc: string }[] = [
  { id: 'guia',     label: 'Propongo el camino',      desc: 'Marco por dónde empezar y cómo avanzar' },
  { id: 'acompana', label: 'Sigo el de la persona',   desc: 'Oriento, pero la ruta la decide ella' },
  { id: 'ambos',    label: 'Depende de la persona',   desc: 'Guío más o menos según lo que necesite' },
];

export const FOCO_OPCIONES_PERSONA: { id: FocoPedido; label: string; desc: string }[] = [
  { id: 'historia', label: 'Entender lo que viví',      desc: 'Ver de dónde viene lo que me pasa hoy' },
  { id: 'presente', label: 'Resolver algo de ahora',    desc: 'Hay algo que me afecta y quiero salir de eso' },
  { id: 'rumbo',    label: 'Repensar hacia dónde voy',  desc: 'Tengo preguntas sobre mi camino' },
  { id: 'any',      label: 'No sabría decir',           desc: 'Un poco de todo, o no lo tengo claro' },
];

/** Tope del CHECK de `coaches.focos`: marcar los tres coincide con cualquier
 *  pedido y no dice nada. */
export const MAX_FOCOS = 2;

export const FOCO_OPCIONES_COACH: { id: Foco; label: string; desc: string }[] = [
  { id: 'historia', label: 'La historia de la persona', desc: 'Entender de dónde viene lo que pasa hoy' },
  { id: 'presente', label: 'Lo que pasa ahora',          desc: 'Salir de algo concreto que la afecta' },
  { id: 'rumbo',    label: 'El rumbo',                   desc: 'Metas, decisiones y hacia dónde ir' },
];

export const GENERO_OPCIONES_PERSONA: { id: GeneroPedido; label: string }[] = [
  { id: 'mujer', label: 'Mujer' },
  { id: 'varon', label: 'Varón' },
  { id: 'any',   label: 'Me da igual' },
];

export function esGuiaCoach(v: unknown): v is GuiaCoach {
  return v === 'guia' || v === 'acompana' || v === 'ambos';
}

export function esFoco(v: unknown): v is Foco {
  return v === 'historia' || v === 'presente' || v === 'rumbo';
}

// ─── Lo que suele hacer cada escuela ────────────────────────────────────────
//
// Sirve para ordenar a un profesional con matrícula que declaró su escuela pero
// no contestó las preguntas de estilo. Es una TENDENCIA, no una regla: por eso
// lo que el profesional contesta de sí mismo siempre le gana, y por eso la
// frase que ve la persona dice "su enfoque suele", no "trabaja así".
//
// `null` = esa escuela no tiene una tendencia clara en ese eje.
//
// ⚠️ Esto es simplificación de manual. Revisarlo con un profesional (Mónica)
// antes de que haya perfiles reales que dependan de esto.
const TENDENCIA: Record<Enfoque, { estilo: EstiloCoach | null; guia: GuiaCoach | null; foco: Foco | null }> = {
  cognitivo_conductual: { estilo: 'herramientas', guia: 'guia',     foco: 'presente' },
  psicoanalitico:       { estilo: 'escucha',      guia: 'acompana', foco: 'historia' },
  sistemico:            { estilo: null,           guia: null,       foco: 'presente' },
  gestaltico:           { estilo: null,           guia: 'acompana', foco: 'presente' },
  humanistico:          { estilo: 'escucha',      guia: 'acompana', foco: 'rumbo' },
  integrativo:          { estilo: null,           guia: null,       foco: null },
};

/** La tendencia de un eje según las escuelas declaradas. Solo si TODAS las que
 *  tienen tendencia en ese eje coinciden: si una dice "guía" y otra
 *  "acompaña", no hay nada honesto que deducir. */
function tendencia<K extends 'estilo' | 'guia' | 'foco'>(
  enfoques: string[] | null | undefined,
  eje: K,
): (typeof TENDENCIA)[Enfoque][K] | null {
  const valores = (enfoques ?? [])
    .filter(esEnfoque)
    .map(e => TENDENCIA[e][eje])
    .filter((v): v is NonNullable<typeof v> => v != null);
  if (valores.length === 0) return null;
  return valores.every(v => v === valores[0]) ? valores[0] : null;
}

/** Nombre de la escuela para la frase "su enfoque (…) suele". Si declaró
 *  varias, la primera: la frase es una explicación, no un inventario. */
function nombreEscuela(enfoques: string[] | null | undefined): string {
  const id = (enfoques ?? []).find(esEnfoque);
  return id ? ENFOQUES.find(e => e.id === id)!.label.toLowerCase() : '';
}

export type Evaluacion = {
  razon: string | null;
  diferencia: string | null;
  coincide: boolean;
  /** Pidió algo y no sabemos si el perfil lo cumple (solo género). */
  desconocido?: boolean;
  /** Coincide por la opción del medio ("Las dos cosas", "Depende de la
   *  persona"), no por una respuesta exacta. Ordena por debajo de la exacta. */
  parcial?: boolean;
};
const VACIO: Evaluacion = { razon: null, diferencia: null, coincide: true };

/** El estilo, con la escuela como respaldo cuando el profesional no contestó. */
export function evaluarEstiloConEscuela(
  estiloCoach: string | null | undefined,
  enfoques: string[] | null | undefined,
  pedido: EstiloPedido | null,
): Evaluacion {
  if (esEstiloCoach(estiloCoach)) return evaluarEstilo(estiloCoach, pedido);
  if (!pedido || pedido === 'any') return VACIO;
  const t = tendencia(enfoques, 'estilo');
  if (!t) return VACIO;
  const escuela = nombreEscuela(enfoques);
  if (t === pedido) {
    return {
      razon: pedido === 'escucha'
        ? `Su enfoque (${escuela}) suele trabajar escuchando, como pediste`
        : `Su enfoque (${escuela}) suele trabajar con ejercicios, como pediste`,
      diferencia: null,
      coincide: true,
    };
  }
  return {
    razon: null,
    diferencia: pedido === 'escucha'
      ? `Su enfoque (${escuela}) suele trabajar más con ejercicios`
      : `Su enfoque (${escuela}) suele trabajar más escuchando`,
    coincide: false,
  };
}

export function evaluarGuia(
  guiaCoach: string | null | undefined,
  enfoques: string[] | null | undefined,
  pedido: GuiaPedida | null,
): Evaluacion {
  if (!pedido || pedido === 'any') return VACIO;

  if (esGuiaCoach(guiaCoach)) {
    if (guiaCoach === 'ambos') {
      return { razon: 'Adapta cuánto guía a cada persona', diferencia: null, coincide: true, parcial: true };
    }
    if (guiaCoach === pedido) {
      return {
        razon: pedido === 'guia'
          ? 'Propone el camino y te guía, como pediste'
          : 'Acompaña el camino que elegís vos, como pediste',
        diferencia: null,
        coincide: true,
      };
    }
    return {
      razon: null,
      diferencia: pedido === 'guia'
        ? 'Deja más la ruta en tus manos'
        : 'Suele proponer el camino',
      coincide: false,
    };
  }

  const t = tendencia(enfoques, 'guia');
  if (!t) return VACIO;
  const escuela = nombreEscuela(enfoques);
  if (t === pedido) {
    return {
      razon: pedido === 'guia'
        ? `Su enfoque (${escuela}) suele guiar paso a paso, como pediste`
        : `Su enfoque (${escuela}) suele seguir tu ritmo, como pediste`,
      diferencia: null,
      coincide: true,
    };
  }
  return {
    razon: null,
    diferencia: pedido === 'guia'
      ? `Su enfoque (${escuela}) suele dejar más la ruta en tus manos`
      : `Su enfoque (${escuela}) suele proponer más el camino`,
    coincide: false,
  };
}

const FOCO_RAZON: Record<Foco, string> = {
  historia: 'Trabaja sobre la historia de cada uno, que es lo que buscás',
  presente: 'Trabaja sobre lo que pasa ahora, que es lo que buscás',
  rumbo:    'Trabaja sobre el rumbo y las decisiones, que es lo que buscás',
};
const FOCO_DIFERENCIA: Record<Foco, string> = {
  historia: 'No marca la historia personal entre lo que trabaja',
  presente: 'No marca lo del presente entre lo que trabaja',
  rumbo:    'No marca el rumbo entre lo que trabaja',
};
const FOCO_ESCUELA: Record<Foco, string> = {
  historia: 'mirar la historia de cada uno',
  presente: 'trabajar sobre lo de ahora',
  rumbo:    'trabajar sobre el rumbo',
};

export function evaluarFoco(
  focosCoach: string[] | null | undefined,
  enfoques: string[] | null | undefined,
  pedido: FocoPedido | null,
): Evaluacion {
  if (!pedido || pedido === 'any') return VACIO;

  const declarados = (focosCoach ?? []).filter(esFoco);
  if (declarados.length > 0) {
    return declarados.includes(pedido)
      ? { razon: FOCO_RAZON[pedido], diferencia: null, coincide: true }
      : { razon: null, diferencia: FOCO_DIFERENCIA[pedido], coincide: false };
  }

  const t = tendencia(enfoques, 'foco');
  if (!t) return VACIO;
  const escuela = nombreEscuela(enfoques);
  return t === pedido
    ? { razon: `Su enfoque (${escuela}) suele ${FOCO_ESCUELA[pedido]}, como buscás`, diferencia: null, coincide: true }
    : { razon: null, diferencia: `Su enfoque (${escuela}) suele ${FOCO_ESCUELA[t]}`, coincide: false };
}

/** `profiles.gender` guarda lo que el profesional eligió al postularse:
 *  'Femenino' | 'Masculino' | 'No binario' | 'Prefiero no decir'. */
const GENERO_PERFIL: Record<'mujer' | 'varon', string> = { mujer: 'Femenino', varon: 'Masculino' };

/**
 * 🔴 Tampoco filtra, aunque es la preferencia más fuerte que se pregunta. Con
 * pocos profesionales, filtrar deja la pantalla vacía; ordenar pone primero a
 * quien coincide y marca la diferencia en el resto, que es lo honesto.
 *
 * Si el profesional no indicó su género, NO se lo cuenta como coincidencia: se
 * dice que no lo indicó, porque no sabemos.
 */
export function evaluarGenero(generoPerfil: string | null | undefined, pedido: GeneroPedido | null): Evaluacion {
  if (!pedido || pedido === 'any') return VACIO;
  const buscado = GENERO_PERFIL[pedido];
  if (generoPerfil === buscado) {
    return { razon: pedido === 'mujer' ? 'Es mujer, como preferiste' : 'Es varón, como preferiste', diferencia: null, coincide: true };
  }
  if (generoPerfil === 'Femenino' || generoPerfil === 'Masculino' || generoPerfil === 'No binario') {
    return { razon: null, diferencia: 'No coincide con el género que preferiste', coincide: false };
  }
  return { razon: null, diferencia: 'No indicó su género', coincide: false, desconocido: true };
}

/** Cómo se lee la guía en el perfil público. Null si no contestó. */
export function etiquetaGuia(guia: string | null | undefined): string | null {
  if (!esGuiaCoach(guia)) return null;
  return GUIA_OPCIONES_COACH.find(o => o.id === guia)?.label ?? null;
}

/** Los focos, listos para mostrar en el perfil. */
export function etiquetasFocos(focos: string[] | null | undefined): string[] {
  return (focos ?? []).filter(esFoco).map(id => FOCO_OPCIONES_COACH.find(o => o.id === id)!.label);
}
