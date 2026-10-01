// Lo que el perfil público del profesional calcula y no es pantalla.
//
// Vive aparte de `ProfesionalScreen` para poder probarlo sin montar nada: son
// decisiones del rediseño del 01/10/2026 que, si se rompen, se rompen en
// silencio (un nombre completo publicado, un "no disponible" que en realidad
// era la red, una frase que no se entiende, un precio que no corresponde).

import { esEstiloCoach, esGuiaCoach, esFoco, FOCO_OPCIONES_COACH } from './enfoque';

/**
 * Cómo se firma una reseña en el perfil: "Martina G.".
 *
 * 🔴 Antes salía `profiles.name` entero. En un servicio de salud mental, que
 * "Martina González" reseñó a una psicóloga cuenta en público que Martina va a
 * terapia. Nombre e inicial alcanzan para que se lea como una persona real y
 * no alcanzan para encontrarla.
 *
 * Sin nombre usable (vacío, o la lápida de una cuenta borrada) firma
 * "Alguien de Vita": la reseña sigue valiendo, quien la escribió no se muestra.
 */
export function firmaDeResena(nombre: string | null | undefined): string {
  const limpio = (nombre ?? '').trim().replace(/\s+/g, ' ');
  if (!limpio || limpio === 'Usuario eliminado' || limpio === 'Usuario') return 'Alguien de Vita';
  const [primero, ...resto] = limpio.split(' ');
  const pila = primero.charAt(0).toUpperCase() + primero.slice(1);
  const apellido = resto.find(p => /\p{L}/u.test(p));
  return apellido ? `${pila} ${apellido.charAt(0).toUpperCase()}.` : pila;
}

/**
 * ¿El perfil no existe, o no se pudo preguntar?
 *
 * `PGRST116` es la respuesta de PostgREST a un `.single()` sin filas: el perfil
 * no está. Cualquier otro error (sin señal, timeout, 5xx) es que no sabemos, y
 * decir "ya no está disponible" ahí le hace creer a la persona que el
 * profesional se fue. Mismo bug que tuvo el catálogo hasta el 26/09.
 */
export function motivoSinPerfil(error: { code?: string } | null): 'no_existe' | 'error_red' {
  return !error || error.code === 'PGRST116' ? 'no_existe' : 'error_red';
}

const FRASE_ESTILO = {
  escucha: 'Escucha y acompaña, al ritmo de la persona',
  herramientas: 'Da herramientas: ejercicios y tareas concretas entre sesiones',
  ambos: 'Escucha y da herramientas, según lo que necesite cada persona',
} as const;

const FRASE_GUIA = {
  guia: 'Propone el camino: marca por dónde empezar y cómo avanzar',
  acompana: 'Sigue el camino de la persona: orienta, y la ruta la decide ella',
  ambos: 'Guía más o menos, según lo que necesite cada persona',
} as const;

/**
 * "Cómo trabaja" en frases que se entienden solas.
 *
 * 🔴 Antes se mostraba la respuesta del profesional sin la pregunta ("Su
 * estilo: Las dos cosas"), que fuera del formulario no dice nada. Cada frase
 * lleva su explicación y va en tercera persona, porque la lee otra persona.
 */
export function frasesDeTrabajo(
  estilo: string | null | undefined,
  guia: string | null | undefined,
  focos: string[] | null | undefined,
): string[] {
  const frases: string[] = [];
  if (esEstiloCoach(estilo)) frases.push(FRASE_ESTILO[estilo]);
  if (esGuiaCoach(guia)) frases.push(FRASE_GUIA[guia]);
  const sobre = (focos ?? []).filter(esFoco)
    .map(id => FOCO_OPCIONES_COACH.find(o => o.id === id)!.label.toLowerCase());
  if (sobre.length) {
    const lista = sobre.length === 1 ? sobre[0] : `${sobre.slice(0, -1).join(', ')} y ${sobre[sobre.length - 1]}`;
    frases.push(`Trabaja sobre ${lista}`);
  }
  return frases;
}

/**
 * El precio que le sirve a quien mira: uno solo.
 *
 * En Argentina, pesos (además es obligatorio exhibirlos: ver `enArgentina` en
 * `lib/time.ts`). Desde afuera, dólares si el profesional los cobra; si no,
 * pesos, que es lo único que va a poder pagar.
 */
export function precioParaMostrar(
  p: { ars: number | null; usd: number | null; cobraExterior: boolean },
  estaEnArgentina: boolean,
): string | null {
  if (!estaEnArgentina && p.cobraExterior && p.usd != null) return `USD ${p.usd}`;
  if (p.ars != null) return `$${p.ars.toLocaleString('es-AR')}`;
  return null;
}
