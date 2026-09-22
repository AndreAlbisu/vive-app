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
import {
  evaluarEstiloConEscuela,
  evaluarGuia,
  evaluarFoco,
  evaluarGenero,
  ESTILO_OPCIONES_PERSONA,
  type EstiloPedido,
  type GuiaPedida,
  type FocoPedido,
  type GeneroPedido,
} from '@/lib/enfoque';

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

// Barra deslizable (21/09/2026): reemplaza a los cuatro rangos de arriba, que
// quedan solo para leer respuestas guardadas antes. El extremo derecho de la
// barra es "sin límite".
export const PRESUPUESTO_MIN = 2000;
export const PRESUPUESTO_TOPE = 15000;
export const PRESUPUESTO_PASO = 500;

/** Tope en pesos de una respuesta vieja por rango. null = sin límite. */
export function topeDeRango(id: string | null | undefined): number | null {
  return PRESUPUESTO_OPCIONES.find(o => o.id === id)?.max ?? null;
}

// ─── Resultado ──────────────────────────────────────────────────────────────

export type RespuestasQuiz = {
  /** Una sola área. Se mantiene por compatibilidad: si viene `areas`, manda. */
  tema: string | null;
  /** Hasta 2 áreas (21/09/2026). */
  areas?: string[];
  /** Hasta 3 temas concretos dentro de esas áreas, con los mismos nombres que
   *  `coach_topics`. Vacío = "cualquiera de estos". */
  subtemas?: string[];
  tipo: string | null;
  presupuesto: string | null;
  /** Tope de la barra, en pesos. Si viene (aunque sea null = sin límite),
   *  manda sobre `presupuesto`. */
  presupuestoMax?: number | null;
  /** M14: cómo quiere que la acompañen. Opcional de verdad: `null` o `'any'`
   *  no cambian nada, y nunca saca a nadie de la lista. */
  estilo?: EstiloPedido | null;
  /** M14 ampliado (21/09): si quiere que la guíen o elegir ella el camino. */
  guia?: GuiaPedida | null;
  /** M14 ampliado: hacia dónde quiere que mire el trabajo. */
  foco?: FocoPedido | null;
  /** Preferencia sobre el género del profesional. Ordena, no filtra. */
  genero?: GeneroPedido | null;
};

export const ESTILO_OPCIONES = ESTILO_OPCIONES_PERSONA;

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
  const idsAreas = r.areas && r.areas.length > 0 ? r.areas : r.tema ? [r.tema] : [];
  const areas = QUIZ_AREAS.filter(a => idsAreas.includes(a.id));
  const subtemas = [...new Set(areas.flatMap(a => a.subtemas))];
  const temasEnComun = subtemas.filter(s => coach.topics.includes(s));
  // Sin tema elegido (o un id desconocido) no se filtra por tema.
  const cumpleTema = subtemas.length === 0 || temasEnComun.length > 0;

  // El segundo nivel ordena y explica, pero NO filtra: con pocos perfiles,
  // exigir "duelo" exacto vaciaría la lista. Quien trabaja el área sin marcar
  // ese tema sigue, con la diferencia a la vista.
  const elegidos = (r.subtemas ?? []).filter(s => subtemas.includes(s));
  const elegidosEnComun = elegidos.filter(s => coach.topics.includes(s));
  const cumpleSubtema = elegidos.length === 0 || elegidosEnComun.length > 0;

  const tipoPedido = r.tipo ? TIPO_POR_OPCION[r.tipo] ?? null : null;
  const tipo = tipoProfesional(coach);
  const cumpleTipo = !tipoPedido || tipo === tipoPedido;

  const max = r.presupuestoMax !== undefined
    ? (r.presupuestoMax != null && r.presupuestoMax < PRESUPUESTO_TOPE ? r.presupuestoMax : null)
    : topeDeRango(r.presupuesto);
  const cumplePrecio = max == null || (coach.priceFrom ?? 0) <= max;

  const razones: string[] = [];
  const diferencias: string[] = [];

  if (elegidosEnComun.length > 0) {
    razones.push(`Trabaja ${listar(elegidosEnComun.slice(0, 2))}, que es lo que querés trabajar`);
  } else if (temasEnComun.length > 0) {
    // Si eligió temas concretos y este perfil no marca ninguno, "que es lo que
    // querés trabajar" sería falso: trabaja el área, no lo que pidió.
    razones.push(elegidos.length > 0
      ? `Trabaja ${listar(temasEnComun.slice(0, 2))}, dentro de lo que elegiste`
      : `Trabaja ${listar(temasEnComun.slice(0, 2))}, que es lo que querés trabajar`);
    if (elegidos.length > 0) diferencias.push(`No marca ${listar(elegidos)} entre sus temas`);
  } else if (subtemas.length > 0) {
    diferencias.push(`No figura trabajando ${listar(areas.map(a => a.label))}`);
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

  // El género va antes que la forma de trabajar: quien lo pide suele pedirlo
  // con fuerza, y la tarjeta tiene que decirlo primero.
  const genero = evaluarGenero(coach.gender, r.genero ?? null);

  // M14: cómo trabaja. Ordena y explica, nunca filtra. Si la persona no lo
  // pidió, o ni el profesional ni su escuela dicen nada, no se dice nada.
  //
  // Con nutricionista no se preguntan (el quiz las saltea): se ignoran aunque
  // vengan guardadas de una corrida anterior con otro tipo.
  const sinEjes = r.tipo === 'nutricionista';
  const ejes = [
    evaluarEstiloConEscuela(coach.estilo, coach.enfoques, sinEjes ? null : r.estilo ?? null),
    evaluarGuia(coach.guia, coach.enfoques, sinEjes ? null : r.guia ?? null),
    evaluarFoco(coach.focos, coach.enfoques, sinEjes ? null : r.foco ?? null),
  ];

  for (const e of [genero, ...ejes]) {
    if (e.razon) razones.push(e.razon);
    if (e.diferencia) diferencias.push(e.diferencia);
  }

  if (coach.hasSlotThisWeek) razones.push('Tiene horarios libres esta semana');

  // Cuánto de lo respondido cumple. El tema pesa más: es lo que la persona vino
  // a trabajar, y un perfil que no lo trabaja no es una opción. Los pesos son
  // potencias de dos a propósito: cumplir algo de arriba siempre le gana a
  // cumplir TODO lo de abajo.
  //
  // Género y ejes tienen tres puntos y no dos: coincide > no sabemos > no
  // coincide. Sin el del medio, un perfil que no contestó empataba con uno que
  // contestó y coincide, o quedaba igual de abajo que uno que dice otra cosa.
  const puntosGenero = genero.coincide ? 8 : genero.desconocido ? 4 : 0;
  const puntosEjes = ejes.reduce((n, e) => n + (e.razon ? 2 : e.coincide ? 1 : 0), 0); // máx. 6 < 8
  //
  // El tema concreto va debajo del tipo: quien pidió psicólogo y duelo prefiere
  // un psicólogo del área antes que un coach que marcó duelo.
  const nivel =
    (cumpleTema ? 128 : 0) + (cumpleTipo ? 64 : 0) + (cumpleSubtema ? 32 : 0) +
    (cumplePrecio ? 16 : 0) + puntosGenero + puntosEjes;
  // `exacto` es lo que habilita el título "coinciden con lo que respondiste".
  // Género y ejes entran solo cuando hay una diferencia que mostrar: si no, el
  // título volvería a prometer una coincidencia total con una resta a la vista,
  // que es exactamente la mentira que cerró M1.
  return {
    razones,
    diferencias,
    cumpleTema,
    nivel,
    exacto: cumpleTema && cumpleSubtema && cumpleTipo && cumplePrecio && genero.coincide && ejes.every(e => e.coincide),
  };
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
