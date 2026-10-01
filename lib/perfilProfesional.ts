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

// [masculino, femenino]. Los de la región y los más probables; el resto cae en
// "De <país>", que se lee natural sin tener que mantener los 195.
export const GENTILICIOS: Record<string, [string, string]> = {
  'Argentina': ['Argentino', 'Argentina'],
  'Uruguay': ['Uruguayo', 'Uruguaya'],
  'Chile': ['Chileno', 'Chilena'],
  'Paraguay': ['Paraguayo', 'Paraguaya'],
  'Bolivia': ['Boliviano', 'Boliviana'],
  'Perú': ['Peruano', 'Peruana'],
  'Colombia': ['Colombiano', 'Colombiana'],
  'México': ['Mexicano', 'Mexicana'],
  'España': ['Español', 'Española'],
  'Brasil': ['Brasileño', 'Brasileña'],
  'Venezuela': ['Venezolano', 'Venezolana'],
  'Ecuador': ['Ecuatoriano', 'Ecuatoriana'],
  'Cuba': ['Cubano', 'Cubana'],
  'Guatemala': ['Guatemalteco', 'Guatemalteca'],
  'Honduras': ['Hondureño', 'Hondureña'],
  'El Salvador': ['Salvadoreño', 'Salvadoreña'],
  'Panamá': ['Panameño', 'Panameña'],
  'República Dominicana': ['Dominicano', 'Dominicana'],
  'Italia': ['Italiano', 'Italiana'],
  'Francia': ['Francés', 'Francesa'],
  'Alemania': ['Alemán', 'Alemana'],
  'Portugal': ['Portugués', 'Portuguesa'],
  'Costa Rica': ['Costarricense', 'Costarricense'],
  'Nicaragua': ['Nicaragüense', 'Nicaragüense'],
  'Estados Unidos': ['Estadounidense', 'Estadounidense'],
  'Canadá': ['Canadiense', 'Canadiense'],
};

/**
 * La nacionalidad como se dice de una persona: "Argentina", "Uruguayo".
 *
 * Con `genero` (de `profiles.gender`) va el gentilicio que corresponde, como
 * en "Psicóloga". Sin género, con "No binario" o "Prefiero no decir", o con un
 * país sin gentilicio cargado, va "De Argentina": dice lo mismo sin el "/a".
 * Hay valores viejos de texto libre ("Argentino"): si ya es un gentilicio, se
 * respeta.
 */
export function lineaNacionalidad(pais: string | null | undefined, genero?: string | null): string | null {
  const p = (pais ?? '').trim();
  if (!p) return null;
  const g = GENTILICIOS[p];
  if (g && genero === 'Masculino') return g[0];
  if (g && genero === 'Femenino') return g[1];
  const yaEsGentilicio = !g && Object.values(GENTILICIOS).some(([m, f]) => m === p || f === p);
  if (yaEsGentilicio) return p;
  return `De ${p}`;
}
