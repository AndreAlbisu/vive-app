import { ViveColors } from './theme';

// Puertas de Conexiones — capa de PRESENTACIÓN (no es AXES ni coach_topics).
//
// Cada puerta mapea a ≥1 subtema canónico. Un coach entra en una puerta si su
// `topics` incluye CUALQUIERA de los subtemas de la puerta. Los 32 subtemas
// están particionados: cada uno aparece en exactamente una puerta (sin
// duplicados, sin huérfanos → 3+7+4+6+2+2+1+2+3+2 = 32).
//
// La taxonomía canónica (AXES en searchData.ts) NO se toca: la siguen usando
// search1/search2/CoachTopicsScreen. Las puertas admiten cruces de eje cuando
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
  { id: 'animo',          label: 'Estado de ánimo',          tagline: 'Sentirte mejor',         icon: 'smile',       color: ViveColors.calm,    subtemas: ['Tristeza', 'Enojo', 'Culpa', 'Vergüenza', 'Alegría', 'Autoestima', 'Duelo'] },
  { id: 'relaciones',     label: 'Relaciones',               tagline: 'Vínculos y pareja',      icon: 'users',       color: ViveColors.calm,    subtemas: ['Pareja', 'Familia', 'Amistades', 'Vínculos laborales'] },
  { id: 'foco',           label: 'Foco, hábitos y trabajo',  tagline: 'Enfoque y rutinas',      icon: 'target',      color: ViveColors.calm,    subtemas: ['Concentración', 'Procrastinación', 'Productividad', 'Hábitos mentales', 'Burnout (estrés laboral)', 'Hábitos'] },
  { id: 'descanso',       label: 'Descanso y energía',       tagline: 'Dormir y recargar',      icon: 'moon',        color: ViveColors.accent,  subtemas: ['Sueño', 'Energía'] },
  { id: 'nutricion',      label: 'Nutrición y movimiento',   tagline: 'Cuerpo y alimentación',  icon: 'activity',    color: ViveColors.accent,  subtemas: ['Nutrición', 'Actividad física'] },
  { id: 'sexualidad',     label: 'Sexualidad e intimidad',   tagline: 'Intimidad y deseo',      icon: 'heart',       color: ViveColors.accent,  subtemas: ['Sexualidad'] },
  { id: 'proposito',      label: 'Propósito y dirección',    tagline: 'Rumbo y sentido',        icon: 'compass',     color: ViveColors.primary, subtemas: ['Propósito', 'Momentos de cambio'] },
  { id: 'identidad',      label: 'Identidad y motivación',   tagline: 'Crecer y avanzar',       icon: 'trending-up', color: ViveColors.primary, subtemas: ['Identidad', 'Motivación', 'Crecimiento'] },
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
  tagline: string;
  icon: string;
  color: string;
};

export const EJES: Eje[] = [
  { id: 'fisico',     label: 'Bienestar físico',     tagline: 'Cuerpo, descanso y energía',      icon: 'activity', color: ViveColors.accent },
  { id: 'emocional',  label: 'Bienestar emocional',  tagline: 'Emociones, vínculos y foco',      icon: 'heart',    color: ViveColors.calm },
  { id: 'espiritual', label: 'Bienestar espiritual', tagline: 'Propósito, identidad y sentido',  icon: 'sun',      color: ViveColors.primary },
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
