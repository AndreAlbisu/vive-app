import { ViveColors } from './theme';

// Puertas de Conexiones — capa de PRESENTACIÓN (no es AXES ni coach_topics).
//
// Cada puerta mapea a ≥1 subtema canónico. Un coach entra en una puerta si su
// `topics` incluye CUALQUIERA de los subtemas de la puerta. Los 38 subtemas
// están particionados: cada uno aparece en exactamente una puerta (sin
// duplicados, sin huérfanos → 3+6+1+5+2+8 + 2+1+1+1 + 2+1+1+2+2 = 38).
// `__tests__/conexionesDoors.test.ts` verifica la partición contra AXES.
//
// La taxonomía canónica (AXES en searchData.ts) NO se toca: la sigue usando
// CoachTopicsScreen. Las puertas admiten cruces de eje cuando
// responden a un estado real del usuario (ej. "Ansiedad y estrés" cruza
// emocional + físico; "Hábitos" —físico en AXES— vive en "Foco, hábitos y
// trabajo" porque es donde el usuario lo busca).
//
// `color`: color del eje DOMINANTE de la puerta. La híbrida "Ansiedad y estrés"
// usa el color de emocional (decisión de Joaquín, 10/07). Ejes → color:
//   físico = accent · emocional = calm · crecimiento = primary.

// `icon`  : nombre de Feather icon (línea) que se pinta dentro del círculo del menú.
// `tagline`: subtítulo corto de la card (qué se trabaja, en lenguaje del usuario).
export type Door = {
  id: string;
  label: string;
  tagline: string;
  icon: string;
  subtemas: string[];
  color: string;
};

export const DOORS: Door[] = [
  { id: 'ansiedad',       label: 'Ansiedad y estrés',        tagline: 'Calmar la mente',        icon: 'wind',        color: ViveColors.calm,    subtemas: ['Ansiedad', 'Ansiedad social', 'Estrés físico'] },
  { id: 'animo',          label: 'Estado de ánimo',          tagline: 'Sentirte mejor',         icon: 'smile',       color: ViveColors.calm,    subtemas: ['Tristeza', 'Enojo', 'Culpa', 'Vergüenza', 'Alegría', 'Duelo'] },
  // `Autoestima` salió de "Estado de ánimo" y tiene puerta propia: es el motivo
  // #3 de coaching (35%) y el #10 de psicología, o sea de los más compartidos
  // entre las dos listas — y estaba enterrado entre Tristeza, Culpa y Duelo,
  // donde no entra nadie que quiera trabajar su confianza.
  { id: 'autoestima',     label: 'Autoestima y confianza',   tagline: 'Cómo te tratás',         icon: 'award',       color: ViveColors.calm,    subtemas: ['Autoestima'] },
  { id: 'relaciones',     label: 'Relaciones',               tagline: 'Vínculos y pareja',      icon: 'users',       color: ViveColors.calm,    subtemas: ['Pareja', 'Familia', 'Amistades', 'Vínculos laborales', 'Ruptura y separación'] },
  // Puerta nueva. `Comunicación` es el motivo #1 de coaching (37%) y no existía
  // como subtema; `Asertividad` cubre el "no puedo poner límites" que `Enojo`
  // deja afuera — la irritabilidad estaba, la dificultad para decir que no, no.
  { id: 'comunicacion',   label: 'Comunicación',             tagline: 'Decir lo que necesitás', icon: 'message-circle', color: ViveColors.calm, subtemas: ['Comunicación', 'Asertividad'] },
  { id: 'foco',           label: 'Foco, hábitos y trabajo',  tagline: 'Enfoque y rutinas',      icon: 'target',      color: ViveColors.calm,    subtemas: ['Concentración', 'Procrastinación', 'Productividad', 'Hábitos mentales', 'Burnout (estrés laboral)', 'Hábitos', 'Equilibrio vida-trabajo', 'Liderazgo'] },
  // 🔴 Físico se abrió de 3 puertas a 4 y espiritual de 3 a 5 el 27/08/2026. El
  // catálogo está cargado hacia lo mental —25 de los 38 subtemas— así que esos
  // dos ejes mostraban una lista de tres renglones que se leía incompleta.
  //
  // 📝 Dividir NO le pide nada a ningún profesional: las puertas son capa de
  // presentación y siguen matcheando por los mismos subtemas, que no se tocaron.
  // La contra es que cada puerta queda más angosta — "Sueño" va a tener menos
  // gente que "Descanso y energía" — a cambio de ser más precisa al buscar.
  // 📝 `Sueño` y `Energía` van JUNTOS. Se probaron separados el 27/08/2026 y se
  // volvió atrás el mismo día: andar sin pilas no es un tema, es un SÍNTOMA —
  // de dormir mal, de estar quemado, de cómo comés. Nadie busca un profesional
  // "de energía", mientras que "no descanso bien y ando sin pilas" sí es una
  // queja que alguien reconoce como propia. Separarlos alargaba la lista, que
  // es la razón equivocada para dividir una puerta.
  { id: 'descanso',       label: 'Descanso y energía',       tagline: 'Dormir y recargar',      icon: 'moon',        color: ViveColors.accent,  subtemas: ['Sueño', 'Energía'] },
  { id: 'nutricion',      label: 'Nutrición',                tagline: 'Comer mejor',            icon: 'coffee',      color: ViveColors.accent,  subtemas: ['Nutrición'] },
  // El nombre queda inclusivo a propósito —"Entrenamiento" deja afuera al que
  // solo quiere empezar a caminar, que es el que más lo necesita— y la bajada
  // nombra las dos cosas, para el que sí busca entrenar en serio.
  { id: 'movimiento',     label: 'Movimiento',               tagline: 'Mover y entrenar el cuerpo', icon: 'activity', color: ViveColors.accent,  subtemas: ['Actividad física'] },
  { id: 'sexualidad',     label: 'Sexualidad e intimidad',   tagline: 'Intimidad y deseo',      icon: 'heart',       color: ViveColors.accent,  subtemas: ['Sexualidad'] },
  // `Orientación vocacional` viaja con `Propósito` y no sola: es de los siete
  // subtemas que hoy no trabaja nadie, y una puerta construida solo sobre él
  // nacería vacía.
  { id: 'proposito',      label: 'Propósito y sentido',      tagline: 'Rumbo y sentido',        icon: 'compass',     color: ViveColors.primary, subtemas: ['Propósito', 'Orientación vocacional'] },
  { id: 'cambio',         label: 'Momentos de cambio',       tagline: 'Transiciones y decisiones', icon: 'shuffle',  color: ViveColors.primary, subtemas: ['Momentos de cambio'] },
  { id: 'identidad',      label: 'Identidad',                tagline: 'Quién sos hoy',          icon: 'user',        color: ViveColors.primary, subtemas: ['Identidad'] },
  { id: 'motivacion',     label: 'Motivación y crecimiento', tagline: 'Avanzar y sostenerlo',   icon: 'trending-up', color: ViveColors.primary, subtemas: ['Motivación', 'Crecimiento'] },
  { id: 'espiritualidad', label: 'Espiritualidad y soledad', tagline: 'Conexión interior',      icon: 'sunrise',     color: ViveColors.primary, subtemas: ['Espiritualidad', 'Soledad'] },
];

export const DOOR_MAP: Record<string, Door> =
  Object.fromEntries(DOORS.map(d => [d.id, d]));

// ─── Ejes ────────────────────────────────────────────────────────────────────
// Primera fase del menú de Conexiones: 3 áreas de bienestar. Cada eje agrupa sus
// puertas por color (el color de la puerta YA es el de su eje dominante):
//   físico = accent · emocional = calm · espiritual/crecimiento = primary.
export type Eje = {
  id: string;
  label: string;
  /** La palabra que distingue al eje, sin el "Bienestar" que comparten los tres.
   *  La tarjeta del menú la usa grande, con "Bienestar" arriba en chico: entera
   *  en una sola línea no entra en una columna de ~110pt sin perder el cuerpo
   *  que le da carácter. */
  corto: string;
  tagline: string;
  icon: string;
  color: string;
};

// 📝 El `id` del segundo sigue siendo `emocional` aunque se llame "mental"
// (27/08/2026): es la clave que usan el estado de la pantalla, los eventos y el
// mapeo con las puertas. Renombrarlo solo cambiaría texto de cara al usuario en
// un lugar y rompería el resto.
export const EJES: Eje[] = [
  { id: 'fisico',     label: 'Bienestar físico',     corto: 'Físico',     tagline: 'Cuerpo, descanso y energía',      icon: 'activity', color: ViveColors.accent },
  { id: 'emocional',  label: 'Bienestar mental',     corto: 'Mental',     tagline: 'Emociones, vínculos y foco',      icon: 'heart',    color: ViveColors.calm },
  { id: 'espiritual', label: 'Bienestar espiritual', corto: 'Espiritual', tagline: 'Propósito, identidad y sentido',  icon: 'sun',      color: ViveColors.primary },
];

export const EJE_MAP: Record<string, Eje> =
  Object.fromEntries(EJES.map(e => [e.id, e]));

/** Puertas de un eje (match por color = eje dominante de la puerta). */
export function doorsForEje(eje: Eje): Door[] {
  return DOORS.filter(d => d.color === eje.color);
}

/** Coaches cuyo `topics` incluye algún subtema de la puerta. */
export function coachesForDoor<T extends { topics: string[] }>(door: Door, coaches: T[]): T[] {
  return coaches.filter(c => door.subtemas.some(t => c.topics.includes(t)));
}

export type TopicOptionGroup = { id: string; label: string; color: string; subtemas: string[] };

/**
 * Opciones del filtro por tema, derivadas de los coaches que EXISTEN.
 *
 * ⚠️ Deliberadamente NO devuelve los 38 subtemas de la taxonomía. Al 16/08/2026
 * hay siete que no trabaja nadie —los seis agregados ese día más `Duelo`— y
 * ofrecerlos daría filtros que devuelven cero resultados, que se leen como una
 * pantalla rota y no como "no hay nadie de eso". Derivándolo del dato, no puede
 * existir una opción muerta; y cuando un coach marque `Comunicación`, la opción
 * aparece sola sin tocar código.
 *
 * Se llama con el universo COMPLETO de coaches visibles, nunca con el resultado
 * ya filtrado: si dependiera del resultado, las opciones desaparecerían a medida
 * que se filtra y no habría forma de volver a ampliar.
 *
 * Las puertas sin ningún subtema en uso se omiten enteras — un grupo vacío es
 * un encabezado sin nada debajo.
 */
export function topicOptionsFrom<T extends { topics: string[] }>(coaches: T[]): TopicOptionGroup[] {
  const enUso = new Set(coaches.flatMap(c => c.topics));
  return DOORS
    .map(d => ({ id: d.id, label: d.label, color: d.color, subtemas: d.subtemas.filter(t => enUso.has(t)) }))
    .filter(g => g.subtemas.length > 0);
}
