// ensayo-gentle.mjs — ¿el prompt nuevo hace que Sofía motive, o se va a "sos capaz"?
//
// ── Por qué existe ───────────────────────────────────────────────────────────
// El 07/09/2026 se reescribió la instrucción de tono `gentle` en el `SYSTEM` de
// `weekly-reflection` (`docs/la-voz-de-sofia.md` §2 ter, hueco #1). Antes decía
// "NO la animes, NO le pidas nada, NO celebres"; ahora habilita **nombrar un
// hecho que la persona hizo y devolvérselo**, sin aliento genérico.
//
// El prompt se deployó (v20) pero NUNCA se lo vio escribir con esa instrucción.
// El precedente del 04/09 es claro: cuatro corridas del otro ensayo encontraron
// cosas que ninguna lectura del prompt había anticipado — la pareja sentimental,
// el modelo hablando del futuro, `parejo` generándose solo como sinónimo.
//
// ⚠️ **Los datos son INVENTADOS.** No sale una sola fila de la base: acá no hay
// dato de nadie, así que esto no toca ninguna cuestión legal.
//
// ── 🔴 La diferencia con `ensayo-payload-rico.mjs`, y por qué importa ────────
// Ese script tiene el `SYSTEM` **copiado a mano, y quedó desactualizado**: le
// falta la sección entera de señales, la mitad de las reglas y el detalle del
// tono. O sea que las conclusiones del 04/09 se sacaron contra un prompt que NO
// es el de producción.
//
// Este lo **LEE del archivo de la función**. No se puede desincronizar: si el
// prompt cambia, el ensayo cambia con él. Si algún día el `SYSTEM` deja de ser
// un template literal, esto falla ruidosamente en vez de mentir en silencio.
//
// ── Cómo se corre ────────────────────────────────────────────────────────────
//   ANTHROPIC_API_KEY=sk-ant-... node scripts/ensayo-gentle.mjs
//   ANTHROPIC_API_KEY=sk-ant-... CORRIDAS=5 node scripts/ensayo-gentle.mjs
//
// La clave sale del entorno y no se imprime nunca.

import { readFileSync } from 'node:fs';

const CRUDA = process.env.ANTHROPIC_API_KEY ?? '';
const API_KEY = CRUDA.trim().replace(/^["']|["']$/g, '').replace(/^Bearer\s+/i, '');
if (!API_KEY) {
  console.error('Falta ANTHROPIC_API_KEY. Corré:\n  ANTHROPIC_API_KEY=sk-ant-... node scripts/ensayo-gentle.mjs');
  process.exit(1);
}
if (API_KEY !== CRUDA) console.log('📌 A la clave se le sacaron espacios, comillas o el prefijo Bearer.\n');

const MODEL = process.env.REFLECTION_MODEL ?? 'claude-haiku-4-5';
const CORRIDAS = Number(process.env.CORRIDAS ?? 3);

// ── El SYSTEM real, leído de la función ──────────────────────────────────────
const FUENTE = 'supabase/functions/weekly-reflection/index.ts';
function systemDeProduccion() {
  const src = readFileSync(FUENTE, 'utf8');
  const m = src.match(/const SYSTEM = `([\s\S]*?)`\n/);
  if (!m) {
    console.error(`🔴 No se pudo extraer el SYSTEM de ${FUENTE}.`);
    console.error('   El ensayo NO corre con un prompt inventado: sería peor que no correrlo.');
    process.exit(1);
  }
  return m[1];
}
const SYSTEM = systemDeProduccion();

// Chequeo de que se leyó el prompt NUEVO y no uno viejo. Si alguien revierte la
// instrucción de gentle, este ensayo deja de tener sentido y conviene saberlo.
if (!/se lo devolvés como suyo/.test(SYSTEM)) {
  console.error('⚠️ El SYSTEM leído NO tiene la instrucción nueva de `gentle`.');
  console.error('   ¿Se revirtió el cambio del 07/09? El ensayo se detiene.');
  process.exit(1);
}
console.log(`✓ SYSTEM leído de ${FUENTE} (${SYSTEM.length} caracteres), con la instrucción nueva\n`);

// ── Los casos: las cinco señales con tono gentle ─────────────────────────────
// Son las que cambiaron de instrucción. `facts` respeta el filtro de la función
// (solo números, salvo `level` que puede ser string).
const CASOS = [
  {
    nombre: 'sustained-low · viene abajo hace días, sin sesión a la vista',
    signal: 'sustained-low', tone: 'gentle', facts: {},
  },
  {
    nombre: 'sustained-low · con sesión en 2 días',
    signal: 'sustained-low', tone: 'gentle', facts: { dias_hasta_proxima_sesion: 2 },
  },
  {
    nombre: 'sharp-drop · hoy cayó fuerte',
    signal: 'sharp-drop', tone: 'gentle', facts: {},
  },
  {
    nombre: 'trend-down · viene peor que el mes pasado',
    signal: 'trend-down', tone: 'gentle', facts: {},
  },
  {
    nombre: 'early · uno o dos registros, todavía no hay con qué',
    signal: 'early', tone: 'gentle', facts: {},
  },
];

// ── Qué mirar, además de leerlas ─────────────────────────────────────────────
// No reemplaza la lectura: son los modos de falla que ya conocemos, marcados
// para que salten a la vista. La decisión sigue siendo de ojo humano.
const ALERTAS = [
  [/\bsos (capaz|fuerte|una gran|inteligente)/i, '🔴 concluye sobre QUIÉN ES la persona (§2: la app no la conoce)'],
  [/segu[íi] as[íi]|no bajes los brazos|vas a poder|dale que|\bánimo\b/i, '🔴 aliento genérico — le sirve a cualquiera'],
  [/felicit|buen[íi]simo|excelente|genial|orgullo/i, '🔴 elogio vacío (CHEER)'],
  [/\b(iron|sarcas)/i, '⚠️ ironía'],
  [/[!¡]/, '🔴 signos de exclamación'],
  [/me alegr|me pone|te entiendo|siento que|me emocion/i, '🔴 finge sentir'],
  [/reserv|agend|sac[áa] un turno|contrat/i, '🔴 pide una reserva'],
  [/depresi|ansiedad generalizada|trastorno|s[íi]ntoma|diagn[óo]stic/i, '🔴 lenguaje clínico'],
  [/\bven[íi]s\s+\w+(ada|ado|osa|oso|ida|ido)\b/i, '🔴 le asigna género'],
  [/\b(cansado|parejo|plano|tranquilo|preocupado|perdido)\b|est[áa]s solo/i, '🔴 adjetivo masculino sobre la persona'],
  [/^(parece que|se nota que|veo que)/i, '🔴 arranque prohibido'],
];

// 📌 Lo que el ensayo NO puede detectar solo, y por eso hay que LEER: la
// inferencia causal ("eso que hacés está funcionando") no tiene ninguna palabra
// prohibida. Es el hueco abierto que cuatro corridas del otro ensayo
// confirmaron que no se arregla con el prompt.
const A_MANO = 'Leé buscando: ¿le devuelve un hecho SUYO, o la app se queda de sujeto? ¿Infiere una causa que nadie le pasó?';

async function escribir(caso) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 200,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: `señal: ${caso.signal}\ntono: ${caso.tone}\ndatos: ${JSON.stringify(caso.facts)}`,
      }],
    }),
  });
  if (!r.ok) return `⚠️ HTTP ${r.status} — ${(await r.text()).slice(0, 160)}`;
  const j = await r.json();
  return (j.content ?? []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
}

console.log(`Modelo: ${MODEL} · ${CORRIDAS} corridas por caso\n`);
console.log(`📌 ${A_MANO}\n`);

let total = 0, conAlerta = 0;
for (const caso of CASOS) {
  console.log('─'.repeat(78));
  console.log(`${caso.nombre}`);
  console.log(`  señal: ${caso.signal} · tono: ${caso.tone} · datos: ${JSON.stringify(caso.facts)}`);
  console.log('─'.repeat(78));
  for (let i = 0; i < CORRIDAS; i++) {
    const linea = await escribir(caso);
    total++;
    const marcas = ALERTAS.filter(([re]) => re.test(linea)).map(([, m]) => m);
    if (marcas.length) conAlerta++;
    console.log(`\n  ${i + 1}. ${linea}`);
    for (const m of marcas) console.log(`     ${m}`);
  }
  console.log();
}

console.log('─'.repeat(78));
console.log(`${total} frases · ${conAlerta} con alguna alerta automática.`);
console.log('⚠️ Cero alertas NO es aprobado: las alertas miran vocabulario, y el');
console.log('   problema que buscamos —que la app se quede de sujeto en vez de');
console.log('   devolverle el hecho— no tiene ninguna palabra prohibida.');
