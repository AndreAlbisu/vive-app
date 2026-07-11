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

export type Door = {
  id: string;
  label: string;
  subtemas: string[];
  color: string;
};

export const DOORS: Door[] = [
  { id: 'ansiedad',       label: 'Ansiedad y estrés',        color: ViveColors.calm,    subtemas: ['Ansiedad', 'Ansiedad social', 'Estrés físico'] },
  { id: 'animo',          label: 'Estado de ánimo',          color: ViveColors.calm,    subtemas: ['Tristeza', 'Enojo', 'Culpa', 'Vergüenza', 'Alegría', 'Autoestima', 'Duelo'] },
  { id: 'relaciones',     label: 'Relaciones',               color: ViveColors.calm,    subtemas: ['Pareja', 'Familia', 'Amistades', 'Vínculos laborales'] },
  { id: 'foco',           label: 'Foco, hábitos y trabajo',  color: ViveColors.calm,    subtemas: ['Concentración', 'Procrastinación', 'Productividad', 'Hábitos mentales', 'Burnout (estrés laboral)', 'Hábitos'] },
  { id: 'descanso',       label: 'Descanso y energía',       color: ViveColors.accent,  subtemas: ['Sueño', 'Energía'] },
  { id: 'nutricion',      label: 'Nutrición y movimiento',   color: ViveColors.accent,  subtemas: ['Nutrición', 'Actividad física'] },
  { id: 'sexualidad',     label: 'Sexualidad e intimidad',   color: ViveColors.accent,  subtemas: ['Sexualidad'] },
  { id: 'proposito',      label: 'Propósito y dirección',    color: ViveColors.primary, subtemas: ['Propósito', 'Momentos de cambio'] },
  { id: 'identidad',      label: 'Identidad y motivación',   color: ViveColors.primary, subtemas: ['Identidad', 'Motivación', 'Crecimiento'] },
  { id: 'espiritualidad', label: 'Espiritualidad y soledad', color: ViveColors.primary, subtemas: ['Espiritualidad', 'Soledad'] },
];

export const DOOR_MAP: Record<string, Door> =
  Object.fromEntries(DOORS.map(d => [d.id, d]));

/** Coaches cuyo `topics` incluye algún subtema de la puerta. */
export function coachesForDoor<T extends { topics: string[] }>(door: Door, coaches: T[]): T[] {
  return coaches.filter(c => door.subtemas.some(t => c.topics.includes(t)));
}
