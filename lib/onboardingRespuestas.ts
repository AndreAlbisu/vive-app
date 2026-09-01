// Lo que la persona contesta en el onboarding: el universo (pantalla 2) y la
// categoría (pantalla 4).
//
// 🔴 POR QUÉ EXISTE: hasta ahora se tiraba todo. El final del guiado hacía
// `router.replace('/register')` y descartaba `universo`, `categoria` y los
// temas elegidos. Tres pantallas de preguntas que no dejaban nada, justo en la
// rama para la que existe el producto ("no sé por dónde empezar").
//
// ⚠️ En ese momento no hay cuenta (`user_quiz_answers.user_id` es FK a
// `profiles`), así que el `topic` que sale de acá se encola en
// `lib/quizPendiente.ts` y se vuelca cuando aparece la sesión. Si la persona
// abandona el registro y vuelve mañana, lo que contestó sigue ahí.
//
// 📝 `temas` quedó opcional el 01/09/2026, cuando el paso 3 salió del flujo con
// la opción A: nadie los produce hoy. El campo se deja porque la decisión de
// qué hacer con ellos —soltarlos o renombrarlos al vocabulario de los coaches—
// sigue abierta, y porque lo que ya está guardado en dispositivos reales se
// tiene que poder seguir leyendo.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { guardarPendiente } from '@/lib/quizPendiente';

export type RespuestasOnboarding = {
  universo: string;
  categoria: string;
  temas?: string[];
};

const KEY = 'vita_onboarding_respuestas';

/**
 * Categoría del onboarding → `user_quiz_answers.topic`.
 *
 * 🔴 Son DOS TAXONOMÍAS DISTINTAS de lo mismo y no encajan del todo. El
 * onboarding agrupa por universo (cuerpo / mente / alma); el quiz de la app usa
 * cinco `topic` que `hooks/useRecommendedResource.ts` vuelve a mapear a un eje.
 * En tres casos los dos agrupamientos se contradicen:
 *
 *   · `sexualidad` el onboarding la pone en CUERPO; `relaciones` cae en alma.
 *   · `vinculos`   el onboarding la pone en MENTE;  `relaciones` cae en alma.
 *   · `trabajo`    el onboarding la pone en ALMA;   `trabajo` cae en mente.
 *
 * Acá se mapea **por significado**, que es lo que hace que la etiqueta de la
 * recomendación ("tus relaciones", "el trabajo") diga algo cierto. La
 * consecuencia es que en esos tres el eje del recurso sugerido no va a ser el
 * universo que la persona eligió.
 *
 * ⚠️ La contradicción NO se arregla retocando este mapa — se resolvió guardando
 * las dos cosas: `user_quiz_answers.axis` lleva el universo que la persona
 * eligió y decide QUÉ recomendarle, y este `topic` decide CÓMO nombrárselo.
 * Antes había que sacrificar uno de los dos. Ver `scripts/add-quiz-declared-axis.sql`.
 */
export const CATEGORIA_A_TOPIC: Record<string, string> = {
  energia:      'salud',
  alimentacion: 'salud',
  sexualidad:   'relaciones',
  sentirme:     'emocion',
  entender:     'emocion',
  vinculos:     'relaciones',
  rumbo:        'proposito',
  crecer:       'proposito',
  trabajo:      'trabajo',
};

export function topicDeCategoria(categoria: string): string | null {
  return CATEGORIA_A_TOPIC[categoria] ?? null;
}

/**
 * Categoría del onboarding → puerta de Profesionales (`constants/conexionesDoors.ts`).
 *
 * 🔴 Es lo que hace que el final del onboarding deje de mentir. El botón decía
 * "Ver profesionales" y llevaba a `/register`; ahora lleva de verdad a la
 * puerta de la que la persona acaba de hablar.
 *
 * ⚠️ Es una CUARTA taxonomía, y a diferencia de las otras tres esta no se puede
 * derivar: las puertas son capa de presentación y no salen ni del universo ni
 * del topic. Por eso el mapa se escribe a mano y `onboardingRespuestas.test.ts`
 * verifica que las nueve categorías caigan en puertas que existan — un id
 * inventado no falla, abre Profesionales en el menú y se lee como que la
 * respuesta se perdió.
 *
 * 📝 Se mapea a UNA puerta y no a varias. Una puerta ya agrupa varios subtemas,
 * y abrir el deck con la unión de dos puertas mezclaría gente que la pantalla
 * no sabe explicar por qué está junta.
 */
export const CATEGORIA_A_PUERTA: Record<string, string> = {
  energia:      'descanso',    // Sueño + Energía
  alimentacion: 'nutricion',
  sexualidad:   'sexualidad',
  sentirme:     'animo',       // la puerta se llama "Estado de ánimo" y su bajada es, literal, "Sentirte mejor"
  entender:     'autoestima',  // "ir a fondo en mis patrones": es la puerta más cercana que existe del lado del coach
  vinculos:     'relaciones',
  rumbo:        'proposito',
  crecer:       'motivacion',
  trabajo:      'foco',        // "Foco, hábitos y trabajo"
};

export function puertaDeCategoria(categoria: string): string | null {
  return CATEGORIA_A_PUERTA[categoria] ?? null;
}

/**
 * 🔴 `universo` llega por parámetro de ruta, o sea que puede ser cualquier
 * string. La columna tiene CHECK, así que un valor inválido haría fallar el
 * upsert — y como el volcado NO se marca cuando falla, **reintentaría en cada
 * login para siempre**. Se filtra acá, en la entrada.
 */
const EJES = ['cuerpo', 'mente', 'alma'];
export function esEje(v: string | undefined | null): boolean {
  return !!v && EJES.includes(v);
}

export async function guardarRespuestas(r: RespuestasOnboarding): Promise<void> {
  // Dos destinos, a propósito: el `topic` va a la cola compartida que se vuelca
  // a la base, y el universo y los temas se quedan acá porque no tienen columna
  // donde ir. No es que se descarten — es que todavía no hay dónde ponerlos.
  await AsyncStorage.setItem(KEY, JSON.stringify(r));

  // El universo va tal cual y el topic sale del mapa. Guardar los DOS es lo que
  // deshace el compromiso viejo: el eje declarado decide qué recomendarle y el
  // topic decide cómo nombrárselo, sin que uno tenga que distorsionar al otro.
  const topic = topicDeCategoria(r.categoria);
  await guardarPendiente({ topic, axis: esEje(r.universo) ? r.universo : null });
}

export async function leerRespuestas(): Promise<RespuestasOnboarding | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RespuestasOnboarding;
  } catch {
    // Storage corrupto no puede romper el arranque de la app.
    return null;
  }
}
