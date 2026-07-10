// Puertas de Conexiones — capa de PRESENTACIÓN (no es AXES ni coach_topics).
//
// Cada puerta mapea a ≥1 subtema canónico. Un coach entra en una puerta si su
// `topics` incluye CUALQUIERA de los subtemas de la puerta. Los 32 subtemas
// están particionados: cada uno aparece en exactamente una puerta (sin
// duplicados, sin huérfanos → 3+7+4+5+2+3+1+2+3+2 = 32).
//
// La taxonomía canónica (AXES en searchData.ts) NO se toca: la siguen usando
// search1/search2/CoachTopicsScreen. Las puertas admiten cruces de eje cuando
// responden a un estado real del usuario (ej. "Ansiedad y estrés").
//
// ⚑ Labels/naming pendientes de confirmación final de Joaquín (UI). El color de
//   la puerta híbrida "Ansiedad y estrés" también es decisión visual suya.

export type Door = {
  id: string;
  label: string;
  subtemas: string[];
};

export const DOORS: Door[] = [
  { id: 'ansiedad',       label: 'Ansiedad y estrés',        subtemas: ['Ansiedad', 'Ansiedad social', 'Estrés físico'] },
  { id: 'animo',          label: 'Estado de ánimo',          subtemas: ['Tristeza', 'Enojo', 'Culpa', 'Vergüenza', 'Alegría', 'Autoestima', 'Duelo'] },
  { id: 'relaciones',     label: 'Relaciones',               subtemas: ['Pareja', 'Familia', 'Amistades', 'Vínculos laborales'] },
  { id: 'foco',           label: 'Foco, hábitos y trabajo',  subtemas: ['Concentración', 'Procrastinación', 'Productividad', 'Hábitos mentales', 'Burnout (estrés laboral)'] },
  { id: 'descanso',       label: 'Descanso y energía',       subtemas: ['Sueño', 'Energía'] },
  { id: 'nutricion',      label: 'Nutrición y movimiento',   subtemas: ['Nutrición', 'Actividad física', 'Hábitos'] },
  { id: 'sexualidad',     label: 'Sexualidad e intimidad',   subtemas: ['Sexualidad'] },
  { id: 'proposito',      label: 'Propósito y dirección',    subtemas: ['Propósito', 'Momentos de cambio'] },
  { id: 'identidad',      label: 'Identidad y motivación',   subtemas: ['Identidad', 'Motivación', 'Crecimiento'] },
  { id: 'espiritualidad', label: 'Espiritualidad y soledad', subtemas: ['Espiritualidad', 'Soledad'] },
];

export const DOOR_MAP: Record<string, Door> =
  Object.fromEntries(DOORS.map(d => [d.id, d]));

/** Coaches cuyo `topics` incluye algún subtema de la puerta. */
export function coachesForDoor<T extends { topics: string[] }>(door: Door, coaches: T[]): T[] {
  return coaches.filter(c => door.subtemas.some(t => c.topics.includes(t)));
}
