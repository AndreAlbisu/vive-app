// Recomendaciones del quiz de Profesionales (`screens/QuizScreen.tsx`).
//
// Sale de la comparación con Selia (docs/problemas-abiertos.md M1 y M2): Selia
// explica por qué recomienda a cada especialista y, si ninguno convence, deja
// ver otros o rehacer el matching. Vita ya tenía una frase de "por qué", pero
// con dos defectos que esta versión cierra:
//
// 1. 🔴 **Decía cosas que podían no ser ciertas.** Si nadie cumplía las tres
//    respuestas, el quiz aflojaba presupuesto, tipo y tema **en silencio** y la
//    tarjeta seguía diciendo "encaja con tus respuestas". Ahora cada perfil trae
//    lo que cumple (`razones`) y lo que no (`diferencias`), y la pantalla dice
//    cuando no hubo nadie con todo.
// 2. 🔴 **Decidía "Psicólogo/a" con el texto libre del profesional** (`'psic'`),
//    el mismo defecto que se cerró en el buscador el 03/09. Ahora usa
//    `tipoProfesional`, que exige matrícula verificada.
//
// Puro y sin React: lo cubre `__tests__/quizMatch.test.ts`.

import type { CachedCoach } from '@/lib/coachesCache';
import { QUIZ_AREAS } from '@/constants/searchData';
import { tipoProfesional, type TipoProfesional } from '@/lib/tipoProfesional';

// ─── Opciones de las preguntas 2 y 3 ────────────────────────────────────────

export type OpcionTipo = { id: 'coach' | 'psicologo' | 'nutricionista' | 'any'; label: string; desc: string };
export const TIPO_OPCIONES: OpcionTipo[] = [
  { id: 'coach',         label: 'Coach de vida',   desc: 'Metas, hábitos y propósito' },
  { id: 'psicologo',     label: 'Psicólogo/a',     desc: 'Salud mental y terapia' },
  { id: 'nutricionista', label: 'Nutricionista',   desc: 'Alimentación y hábitos físicos' },
  { id: 'any',           label: 'Sin preferencia', desc: 'Quiero ver todas las opciones' },
];

const TIPO_POR_OPCION: Record<string, TipoProfesional | null> = {
  coach: 'Coach',
  psicologo: 'Psicólogo',
  nutricionista: 'Nutricionista',
  any: null,
};

// ⚠️ Los montos son de cuando se armó el quiz. El 17/09/2026 los 34 perfiles de
// la base (todos de prueba) iban de $3.800 a $11.800, así que no hay con qué
// recalibrarlos todavía. Revisarlos con los precios de los profesionales reales.
export type OpcionPresupuesto = { id: 'low' | 'mid' | 'high' | 'flex'; label: string; max: number | null };
export const PRESUPUESTO_OPCIONES: OpcionPresupuesto[] = [
  { id: 'low',  label: 'Hasta $5.000',    max: 5000 },
  { id: 'mid',  label: '$5.000–$10.000',  max: 10000 },
  { id: 'high', label: 'Más de $10.000',  max: null },
  { id: 'flex', label: 'Es flexible',     max: null },
];

// ─── Resultado ──────────────────────────────────────────────────────────────

export type RespuestasQuiz = { tema: string | null; tipo: string | null; presupuesto: string | null };

export type Recomendacion = {
  coach: CachedCoach;
  /** Lo que el perfil SÍ cumple, en frases cortas. Nunca vacío: si no cumple
   *  nada de lo pedido no entra en la lista. */
  razones: string[];
  /** Lo que pidió la persona y este perfil NO cumple. Vacío si cumple todo. */
  diferencias: string[];
};

export type ResultadoQuiz = {
  recomendaciones: Recomendacion[];
  /** Si al menos un perfil cumple las tres respuestas. Cuando es `false` la
   *  pantalla lo dice, en vez de presentar coincidencias parciales como si
   *  fueran exactas. */
  hayCoincidenciaExacta: boolean;
};

/** Cuántos perfiles se muestran por tanda (Selia muestra tres). */
export const TAMANO_TANDA = 3;

function listar(temas: string[]): string {
  const t = temas.map(x => x.toLowerCase());
  if (t.length <= 1) return t[0] ?? '';
  return `${t.slice(0, -1).join(', ')} y ${t[t.length - 1]}`;
}

function evaluar(coach: CachedCoach, r: RespuestasQuiz) {
  const area = QUIZ_AREAS.find(a => a.id === r.tema);
  const subtemas = area?.subtemas ?? [];
  const temasEnComun = subtemas.filter(s => coach.topics.includes(s));
  // Sin tema elegido (o un id desconocido) no se filtra por tema.
  const cumpleTema = subtemas.length === 0 || temasEnComun.length > 0;

  const tipoPedido = r.tipo ? TIPO_POR_OPCION[r.tipo] ?? null : null;
  const tipo = tipoProfesional(coach);
  const cumpleTipo = !tipoPedido || tipo === tipoPedido;

  const max = PRESUPUESTO_OPCIONES.find(o => o.id === r.presupuesto)?.max ?? null;
  const cumplePrecio = max == null || (coach.priceFrom ?? 0) <= max;

  const razones: string[] = [];
  const diferencias: string[] = [];

  if (temasEnComun.length > 0) {
    razones.push(`Trabaja ${listar(temasEnComun.slice(0, 2))}, que es lo que querés trabajar`);
  } else if (subtemas.length > 0) {
    diferencias.push(`No figura trabajando ${area!.label.toLowerCase()}`);
  }

  if (tipoPedido) {
    if (cumpleTipo) {
      if (tipoPedido === 'Coach') razones.push('Acompaña como coach, como preferiste');
      // "Psicólogo" y "Nutricionista" solo salen con matrícula verificada
      // (`tipoProfesional`), así que decirlo es cierto.
      else razones.push('Tiene matrícula verificada por Vita');
    } else if (tipoPedido === 'Coach') {
      diferencias.push('No es coach: tiene matrícula profesional');
    } else {
      diferencias.push(
        tipoPedido === 'Psicólogo'
          ? 'No figura como psicólogo/a con matrícula verificada'
          : 'No figura como nutricionista con matrícula verificada',
      );
    }
  }

  if (max != null) {
    if (cumplePrecio) razones.push('Su sesión entra en tu presupuesto');
    else diferencias.push('Su sesión cuesta más de lo que marcaste');
  }

  if (coach.hasSlotThisWeek) razones.push('Tiene horarios libres esta semana');

  // Cuántas de las tres respuestas cumple. El tema pesa más: es lo que la
  // persona vino a trabajar, y un perfil que no lo trabaja no es una opción.
  const nivel = (cumpleTema ? 4 : 0) + (cumpleTipo ? 2 : 0) + (cumplePrecio ? 1 : 0);
  return { razones, diferencias, cumpleTema, nivel, exacto: cumpleTema && cumpleTipo && cumplePrecio };
}

/**
 * Todos los perfiles que trabajan el tema elegido, de más a menos coincidentes
 * y, dentro de cada nivel, por calificación. La pantalla los muestra de a
 * `TAMANO_TANDA`, y "Ver otras opciones" avanza sobre esta misma lista.
 *
 * No agrega perfiles que no trabajan el tema: para eso está "Ver todos los
 * profesionales". Mostrar cualquiera como "otra opción" es lo que hacía el
 * fallback viejo (`[...coaches]`).
 */
export function recomendarDesdeQuiz(coaches: CachedCoach[], r: RespuestasQuiz): ResultadoQuiz {
  const evaluados = coaches
    .map(coach => ({ coach, ...evaluar(coach, r) }))
    .filter(e => e.cumpleTema && e.razones.length > 0);

  evaluados.sort((a, b) =>
    (b.nivel - a.nivel) ||
    ((b.coach.avgRating ?? 0) - (a.coach.avgRating ?? 0)) ||
    ((b.coach.reviewCount ?? 0) - (a.coach.reviewCount ?? 0)),
  );

  return {
    recomendaciones: evaluados.map(({ coach, razones, diferencias }) => ({ coach, razones, diferencias })),
    hayCoincidenciaExacta: evaluados.some(e => e.exacto),
  };
}
