// ensayo-payload-rico.mjs — ¿mandarle MÁS señal al modelo mejora la frase?
//
// ── Por qué existe ───────────────────────────────────────────────────────────
// `docs/la-voz-de-sofia.md` §5 bis afirma que la card suena básica porque al
// modelo le llegan tres números, y propone mandar "señales estructuradas más
// ricas". Eso es una **inferencia sin probar**: suena obvio y puede ser falso —
// la tarea sigue siendo escribir una línea cálida, y más contexto no garantiza
// mejor resultado.
//
// Y decidirlo tiene costo: enriquecer el payload obliga a rehacer el análisis
// legal (ver `transferencias-internacionales.md` §5 bis — una secuencia larga
// empieza a singularizar, y ahí el encuadre actual se cae).
//
// 🔴 Así que primero se prueba y después se decide. Este script manda las dos
// versiones al mismo modelo, con el mismo system y en la misma corrida, y las
// imprime lado a lado.
//
// ⚠️ **Los datos son INVENTADOS.** No sale una sola fila de la base, así que
// esto no toca ninguna cuestión legal: no hay dato de nadie.
//
// ── Cómo se corre ────────────────────────────────────────────────────────────
//   ANTHROPIC_API_KEY=sk-ant-... node scripts/ensayo-payload-rico.mjs
//
// La clave sale de la variable de entorno y no se imprime nunca.

// ⚠️ Se limpia antes de usarla. La causa más común de un 401 no es que la clave
// esté mal sino cómo se pegó: un salto de línea al final, comillas alrededor, o
// el prefijo "Bearer " arrastrado de otro lado. Se corrige en silencio y se
// avisa qué se sacó, para no mandar a nadie a buscar un problema que no existe.
const CRUDA = process.env.ANTHROPIC_API_KEY ?? '';
const API_KEY = CRUDA.trim().replace(/^["']|["']$/g, '').replace(/^Bearer\s+/i, '');

if (!API_KEY) {
  console.error('Falta ANTHROPIC_API_KEY. Corré:\n  ANTHROPIC_API_KEY=sk-ant-... node scripts/ensayo-payload-rico.mjs');
  process.exit(1);
}
if (API_KEY !== CRUDA) {
  console.log('📌 A la clave se le sacaron espacios, comillas o el prefijo Bearer.');
}

// Preflight: una llamada mínima para separar "la clave está mal" de "el ensayo
// falló". Sin esto, un 401 se repite doce veces y no queda claro qué pasó.
{
  // La forma se chequea sin imprimir la clave: prefijo y largo alcanzan para
  // detectar que se pegó otra cosa.
  const forma = `${API_KEY.slice(0, 7)}… (${API_KEY.length} caracteres)`;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.REFLECTION_MODEL ?? 'claude-haiku-4-5', max_tokens: 8, messages: [{ role: 'user', content: 'hola' }] }),
  });
  if (!r.ok) {
    const cuerpo = await r.text();
    console.error(`\n🔴 La clave no funciona. HTTP ${r.status}`);
    console.error(`   forma de lo que se mandó: ${forma}`);
    console.error(`   respuesta: ${cuerpo.slice(0, 200)}\n`);
    if (r.status === 401) {
      console.error('   Una clave de Anthropic arranca con "sk-ant-api03-" y tiene ~108 caracteres.');
      console.error('   Si la forma de arriba no se parece, se pegó otra cosa.');
      console.error('   Si se parece, la clave puede estar revocada o ser de otra organización:');
      console.error('   console.anthropic.com → API Keys.\n');
      console.error('   ⚠️ Y si es la MISMA que está en los secrets de Supabase, la card en');
      console.error('   producción tampoco está usando el modelo: la función devuelve 502 y');
      console.error('   el cliente cae al texto escrito a mano, sin avisar.\n');
    }
    process.exit(1);
  }
  console.log('✓ la clave responde\n');
}

const MODEL = process.env.REFLECTION_MODEL ?? 'claude-haiku-4-5';

// El MISMO system que usa la función en producción. Se copia y no se importa
// porque la función es Deno y esto es Node — si el de allá cambia, hay que
// traerlo. Está anotado en el encabezado de `weekly-reflection/index.ts`.
const SYSTEM = `Escribís UNA línea para la pantalla de inicio de Vita, una app argentina de bienestar y desarrollo personal. Se muestra abajo del check-in diario de ánimo.

# La voz
Hablás como un amigo sabio, no como un sistema. Español rioplatense real, de "vos". Frases cortas y humanas. Lenguaje cotidiano.

La línea tiene DOS TIEMPOS:
1. lo que se nota — la señal que te paso, dicha en palabras
2. qué te parece eso — una observación breve, humana

# 🔴 Lo primero: de qué hablás
Te paso UNA señal. **Escribís sobre esa señal y sobre nada más.** Si además te paso un número, es porque la frase de ESA señal lo usa — no es una invitación a hablar de otra cosa.

Y **nunca inventes un hecho.** Si no te lo pasé, no pasó. No hay sesiones si no te pasé sesiones, no hay racha si no te pasé una racha, no hay nadie acompañando a quien lee salvo que yo lo diga.

# Reglas que no se rompen
- NUNCA le asignes género a quien lee.
- NUNCA diagnostiques ni uses vocabulario clínico.
- NUNCA prometas resultados ni suenes a gurú.
- NUNCA pidas una reserva ni una sesión.
- NUNCA finjas sentir algo.
- NUNCA uses signos de exclamación, markdown, comillas ni emoji.
- No empieces con "Parece que", "Se nota que", "Veo que" — entrá directo.
- Entre 10 y 30 palabras. Dos oraciones.

# El tono te lo paso yo
- gentle → la persona la está pasando mal. NO la animes, NO le pidas nada, NO celebres.
- neutral → no pasó nada destacable. Que no suene a relleno.
- warm → hay algo para reconocer. Reconocelo sin exagerarlo.

Devolvés la línea y nada más.`;

// Tres casos. En cada uno, la MISMA persona descrita de dos maneras: como se le
// manda hoy, y como se le mandaría con el presupuesto ampliado.
const CASOS = [
  {
    nombre: 'Alguien que viene remontando',
    señal: 'trend-up', tono: 'warm',
    // ⚠️ Actualizado el 04/09 tras la primera corrida: HOY ya no manda los tres
    // números siempre, solo el que esa señal usa. `trend-up` no usa ninguno.
    flaco: {},
    rico: {
      animo_ultimos_7: ['bien', 'bien', 'normal', 'bien', 'cansado', 'normal', 'bien'],
      animo_mes_previo_promedio: 'cansado',
      dias_desde_ultima_sesion: 3,
      dias_hasta_proxima_sesion: 4,
      practicas_esta_semana: ['respiracion', 'respiracion', 'sueño'],
      escribio_diario_veces: 2,
    },
  },
  {
    nombre: 'Una semana pareja, sin nada destacable',
    señal: 'level', tono: 'neutral',
    flaco: { level: 'pareja' },
    rico: {
      animo_ultimos_7: ['normal', 'normal', 'bien', 'normal', 'normal', 'normal', 'normal'],
      animo_mes_previo_promedio: 'normal',
      dias_desde_ultima_sesion: 11,
      dias_hasta_proxima_sesion: 3,
      practicas_esta_semana: ['ruido_blanco'],
      escribio_diario_veces: 0,
    },
  },
  {
    nombre: 'Un tramo malo sostenido',
    señal: 'sustained-low', tono: 'gentle',
    flaco: {},
    rico: {
      animo_ultimos_7: ['bajon', 'cansado', 'bajon', 'bajon', 'cansado', 'bajon', 'cansado'],
      animo_mes_previo_promedio: 'normal',
      dias_desde_ultima_sesion: 19,
      dias_hasta_proxima_sesion: null,
      practicas_esta_semana: [],
      escribio_diario_veces: 4,
    },
  },
];

async function pedir(señal, tono, datos) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 200,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: `señal: ${señal}\ntono: ${tono}\ndatos: ${JSON.stringify(datos)}`,
      }],
    }),
  });
  if (!res.ok) return `⚠️ HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
  const j = await res.json();
  return (j.content?.find(b => b.type === 'text')?.text ?? '(vacío)').trim();
}

console.log(`\nmodelo: ${MODEL}`);
console.log('2ª corrida: el prompt ahora dice de qué habla cada señal y de qué no,');
console.log('y HOY manda solo el dato que su propia frase usa.');
console.log('Los datos son inventados. Ninguna fila sale de la base.\n');

for (const c of CASOS) {
  console.log('─'.repeat(76));
  console.log(`${c.nombre}   ·   señal: ${c.señal} · tono: ${c.tono}\n`);
  // Dos tiradas de cada uno: una sola muestra no distingue "mejor" de "tuvo
  // suerte". Con dos se ve si la mejora es consistente o es ruido.
  for (const intento of [1, 2]) {
    const [a, b] = await Promise.all([
      pedir(c.señal, c.tono, c.flaco),
      pedir(c.señal, c.tono, c.rico),
    ]);
    console.log(`  ${intento}. HOY   → ${a}`);
    console.log(`     RICO  → ${b}\n`);
  }
}

console.log('─'.repeat(76));
console.log(`
Qué mirar, y no es "cuál suena más lindo":

  · ¿La versión RICA dice algo que la de HOY no PODRÍA decir? Si las dos dicen
    lo mismo con otras palabras, más datos no compran nada.
  · ¿Nombra algo específico de esa persona —el domingo, la práctica que repite,
    que la sesión está cerca— o sigue siendo genérica con más adornos?
  · 🔴 ¿Empieza a INTERPRETAR? Con más contexto el modelo se tienta con
    "estás mejor porque volviste a respirar". Eso es el modo analista, y es el
    costo escondido de subir el presupuesto.

Si la columna RICO no gana claramente, la discusión legal no vale la pena.
`);
