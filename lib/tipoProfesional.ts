// Qué tipo de profesional mostrar para un perfil del catálogo.
//
// Vivía adentro de `app/search3.tsx`. Se mudó acá (17/09/2026, M1) porque el
// quiz de Profesionales tenía su propia versión, que decidía "Psicólogo/a" con
// `specialty.includes('psic')` sobre el texto libre que escribe el propio
// profesional: exactamente el defecto que se había cerrado en el buscador el
// 03/09. Un solo lugar evita que vuelvan a divergir.
//
// La Ley 23.277 reserva el diagnóstico y el tratamiento a quien tiene
// matrícula. Ver `docs/encuadre-salud-y-responsabilidad.md` §2.
//
// ✅ 23/09/2026: sale de `coaches.profesion`, que deriva la base de las
// matrículas VERIFICADAS, con la profesión que eligió quien miró el documento
// (`scripts/add-profesion-estructurada.sql`). Antes se buscaba "psicolog" en
// `specialty`, texto libre del propio profesional, y un nutricionista
// matriculado que escribiera "psicología" caía como Psicólogo. El texto ya no
// decide nada.

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

export function tipoProfesional(c: { profesion?: string | null }): TipoProfesional {
  if (c.profesion === 'psicologia') return 'Psicólogo';
  if (c.profesion === 'nutricion') return 'Nutricionista';
  return 'Coach';
}
