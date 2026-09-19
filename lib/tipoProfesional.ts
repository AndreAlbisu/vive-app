// Qué tipo de profesional mostrar para un perfil del catálogo.
//
// Vivía adentro de `app/search3.tsx`. Se mudó acá (17/09/2026, M1) porque el
// quiz de Profesionales tenía su propia versión, que decidía "Psicólogo/a" con
// `specialty.includes('psic')` sobre el texto libre que escribe el propio
// profesional: exactamente el defecto que se había cerrado en el buscador el
// 03/09. Un solo lugar evita que vuelvan a divergir.
//
// La Ley 23.277 reserva el diagnóstico y el tratamiento a quien tiene
// matrícula, así que la palabra clave es necesaria pero NO alcanza: hace falta
// además una matrícula verificada por Vita (`coaches.has_matricula`).
//
// ⚠️ Sigue sin ser perfecto: `has_matricula` dice que hay UNA matrícula
// chequeada, no de qué profesión (el título es texto libre). Un nutricionista
// matriculado que mencione "psicología" en su presentación todavía podría caer
// como Psicólogo. Cerrarlo del todo pide un campo estructurado de profesión en
// `coaches`, que es una decisión de producto. Ver `docs/encuadre-salud-y-responsabilidad.md` §2.

export type TipoProfesional = 'Coach' | 'Psicólogo' | 'Nutricionista';

/** Minúsculas y sin tildes, para comparar texto libre. */
export function normalizarTexto(text: string): string {
  return (text ?? '')
    .toLowerCase()
    .replace(/[áàäâã]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöôõ]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/ñ/g, 'n');
}

export function tipoProfesional(c: { specialty: string; hasMatricula?: boolean }): TipoProfesional {
  const s = normalizarTexto(c.specialty);
  if (!c.hasMatricula) return 'Coach';
  if (s.includes('psicolog')) return 'Psicólogo';
  if (s.includes('nutricion')) return 'Nutricionista';
  return 'Coach';
}
