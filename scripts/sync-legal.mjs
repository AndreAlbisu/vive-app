// sync-legal.mjs — genera constants/legal.ts a partir de los .md de docs/.
//
// Los documentos legales viven en docs/ (fuente de verdad, la que edita el/la
// abogado/a). La app no puede importar .md directo (Metro no los bundlea), así
// que se copian a un .ts generado. Correr `npm run sync:legal` después de tocar
// cualquiera de los dos documentos — si no, la app muestra una versión vieja.
//
// Qué hace además de copiar:
//   - Saca el blockquote de advertencia inicial (es una nota interna para el
//     equipo, no para el usuario).
//   - Convierte los links relativos entre documentos (./otro.md) en texto plano,
//     porque dentro de la app no resuelven a ningún lado.
//   - Detecta placeholders sin completar ([RAZÓN SOCIAL], [fecha], [•]) y expone
//     la bandera hasPlaceholders, que la pantalla usa para mostrar el aviso de
//     borrador. Cuando se completen todos, el aviso desaparece solo.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const webDir = join(root, 'web/legal');
mkdirSync(webDir, { recursive: true });

const DOCS = [
  { key: 'TERMS',   file: 'docs/terminos-y-condiciones.md' },
  { key: 'PRIVACY', file: 'docs/politica-de-privacidad.md' },
  // El botón de arrepentimiento es página propia y no una sección de los T&C
  // por exigencia de la Res. 424/2020: tiene que ser un enlace de acceso fácil
  // y directo desde la portada, sin registro ni trámite previo. Enterrado
  // adentro de los Términos no cumpliría.
  { key: 'REGRET',  file: 'docs/boton-de-arrepentimiento.md' },
  // Google Play exige una URL pública de solicitud de eliminación de cuenta,
  // accesible sin instalar la app y sin iniciar sesión. Tiene que declarar qué
  // se borra y qué se conserva con su plazo — o sea, seguir a Política §10.
  //
  // `app: false` = no se exporta a constants/legal.ts. Adentro de la app la
  // baja es un botón real (Perfil → Eliminar mi cuenta), no un instructivo, así
  // que el texto viajaría en el bundle sin que ninguna pantalla lo lea. Los
  // placeholders del documento se siguen contando igual.
  { key: 'DELETE',  file: 'docs/eliminar-cuenta.md', app: false },
  // No es un documento legal, pero usa exactamente el mismo camino: markdown en
  // docs/ → constants/legal.ts → la pantalla que ya sabe renderizarlo. Hacer un
  // segundo visor de markdown para una sola página sería duplicar la plomería.
  //
  // 🔴 Existe por el hallazgo del consejo del 07/09 (`docs/consejo-sofia.md`):
  // que alguien se entere de que Sofía es una persona real DESPUÉS de haberle
  // confiado sus peores días es la peor forma de que se entere.
  { key: 'ABOUT',   file: 'docs/sobre-nosotros.md', web: false },
];

/** Saca el bloque de citas inicial (aviso interno de borrador).
 *  Devuelve también cuántas líneas se comieron, para poder reportar los
 *  placeholders con el número de línea del .md real y no el del texto ya
 *  recortado — que es el archivo que se edita a mano. */
function stripLeadingBlockquote(md) {
  const lines = md.split('\n');
  let i = 0;
  while (i < lines.length && (lines[i].startsWith('>') || lines[i].trim() === '')) i++;
  return { md: lines.slice(i).join('\n'), offset: i };
}

/** [texto](./archivo.md) → texto (los links relativos no resuelven en la app). */
function flattenRelativeLinks(md) {
  return md.replace(/\[([^\]]+)\]\(\.\/[^)]+\)/g, '$1');
}

/** Placeholders sin completar: [algo] que no sea un link markdown.
 *
 *  ⚠️ Sin tope de longitud a propósito. La versión anterior limitaba el match a
 *  60 caracteres (`{1,60}`) y por eso solo veía `[fecha]`: las 10 notas largas
 *  dirigidas al abogado —`[Validar con abogado…]`, `[Si se mantiene esta
 *  política…]`— quedaban afuera del conteo y se publicaban tal cual en la app y
 *  en las páginas web, mientras `LEGAL_IS_DRAFT` daba a entender que faltaba un
 *  solo campo. Cualquier corchete que sobreviva al strip de links es algo sin
 *  resolver; no hay razón para filtrarlo por tamaño. */
function findPlaceholders(md) {
  const withoutLinks = md.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  const found = [];
  withoutLinks.split('\n').forEach((line, i) => {
    for (const match of line.match(/\[[^\]\n]+\]/g) ?? []) {
      found.push({ text: match, line: i + 1 });
    }
  });
  return found;
}

/** Corta al medio para que la consola siga siendo legible con notas largas. */
function ellipsis(text, max = 72) {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…]`;
}

/** Envuelve las tablas en un div con overflow: en pantalla angosta, una tabla
 *  sin contenedor propio desborda el body entero y rompe el scroll de la página. */
function wrapTables(html) {
  return html.replace(/<table>[\s\S]*?<\/table>/g, (t) => `<div class="table-wrap">${t}</div>`);
}

/** Escapa para meter el texto en un template literal de TS. */
function toTemplateLiteral(text) {
  return '`' + text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`';
}

const parts = [];
const placeholders = [];
const forWeb = [];

// `web = false` es la contraparte de `app = false`: el documento entra al bundle
// pero NO genera página pública. Las de `web/legal/` existen para cumplir
// requisitos de las tiendas y de la Res. 424/2020 —son un set legal— y meter ahí
// una página institucional le agrega ruido a un nav que la norma quiere limpio.
for (const { key, file, app = true, web = true } of DOCS) {
  const raw = readFileSync(join(root, file), 'utf8');
  const { md, offset } = stripLeadingBlockquote(raw);
  const clean = flattenRelativeLinks(md);
  placeholders.push(
    ...findPlaceholders(clean).map((p) => ({ ...p, file, line: p.line + offset }))
  );
  if (app) parts.push(`export const ${key}_MD = ${toTemplateLiteral(clean)};`);
  if (web) forWeb.push({ key, md: clean });
}

const unique = [...new Set(placeholders.map((p) => p.text))].sort();

// ── Versión de los documentos ────────────────────────────────────────────────
// Se DERIVA del contenido en vez de mantenerse a mano. Un número de versión
// manual se olvida justo cuando importa —al editar el texto— y entonces habría
// aceptaciones registradas contra una versión que ya no es la que la persona
// leyó; que es exactamente lo que la columna existe para evitar.
//
// Entran solo TERMS y PRIVACY: son los dos documentos que el Usuario acepta al
// registrarse. El botón de arrepentimiento y la baja de cuenta son
// informativos, no se aceptan, y hacer que muevan la versión invalidaría
// aceptaciones por un cambio que no toca lo aceptado.
const ACCEPTED_DOCS = ['TERMS', 'PRIVACY'];
const legalVersion = createHash('sha256')
  .update(forWeb.filter(({ key }) => ACCEPTED_DOCS.includes(key)).map(({ md }) => md).join('\n---\n'))
  .digest('hex')
  .slice(0, 12);

const out = `// GENERADO POR scripts/sync-legal.mjs — NO EDITAR A MANO.
// Fuente: docs/terminos-y-condiciones.md · docs/politica-de-privacidad.md
// Para actualizar: editá el .md y corré \`npm run sync:legal\`.

${parts.join('\n\n')}

/** Placeholders sin completar detectados al generar este archivo. */
export const LEGAL_PLACEHOLDERS: string[] = ${JSON.stringify(unique)};

/** Identifica la versión EXACTA de los T&C + Política que el Usuario acepta.
 *  Es el sha256 (12 hex) del contenido de esos dos documentos, así que cambia
 *  solo cuando cambia el texto aceptado, y no se puede olvidar de actualizar.
 *  Se guarda en \`profiles.accepted_terms_version\` al registrarse: sin esto no
 *  hay forma de probar qué texto leyó cada persona, que es lo que se discute al
 *  invocar §20 (modificaciones) o §10 (no elusión). */
export const LEGAL_VERSION = '${legalVersion}';

/** true mientras los documentos sigan siendo un borrador sin completar.
 *  La pantalla legal muestra un aviso mientras esto sea true; cuando el/la
 *  abogado/a complete todos los campos entre corchetes, desaparece solo. */
export const LEGAL_IS_DRAFT = ${unique.length > 0};
`;

writeFileSync(join(root, 'constants/legal.ts'), out, 'utf8');
console.log(
  `constants/legal.ts generado. Versión de los legales: ${legalVersion}. ` +
    `Placeholders sin completar: ${placeholders.length} (${unique.length} distintos)`
);
for (const { file, line, text } of placeholders) {
  console.log(`  ${file}:${line}  ${ellipsis(text)}`);
}

// ── Páginas web públicas ─────────────────────────────────────────────────────
// App Store Connect y Google Play Console EXIGEN una URL pública de la Política
// de Privacidad para poder publicar la app; el .md del repo no sirve como tal.
// Se generan del mismo texto que muestra la app, así no pueden divergir.
const WEB_META = {
  TERMS:   { file: 'terminos.html',       title: 'Términos y Condiciones — Vita', nav: 'Términos y Condiciones' },
  PRIVACY: { file: 'privacidad.html',     title: 'Política de Privacidad — Vita', nav: 'Política de Privacidad' },
  // El nav lo escribe en mayúsculas y destacado porque la Res. 424/2020 pide
  // que el enlace diga literalmente "BOTÓN DE ARREPENTIMIENTO" y esté en lugar
  // destacado. Va en las tres páginas, no solo en la suya.
  REGRET:  { file: 'arrepentimiento.html', title: 'Botón de Arrepentimiento — Vita', nav: 'BOTÓN DE ARREPENTIMIENTO' },
  DELETE:  { file: 'eliminar-cuenta.html', title: 'Eliminar tu cuenta — Vita', nav: 'Eliminar tu cuenta' },
};

// 01/10/2026: la identidad de la portada (letra Plus Jakarta Sans, colores,
// isotipo). Antes era letra del sistema y sin logo: parecía otro sitio, justo
// en las páginas que la ley pide que se encuentren fácil. Solo claro, igual
// que el resto de la web.
const MARCA = `<a class="wordmark" href="/" aria-label="Vita, ir al inicio"><svg class="vmark" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="34" r="26"/><circle cx="29.5" cy="66" r="26"/><circle cx="70.5" cy="66" r="26"/></svg>vita</a>`;

const HEAD = `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#F7EFE4">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">`;

const CSS = `
  :root {
    color-scheme: light;
    --cream: #F7EFE4; --paper: #FBF8F1; --olive: #565E32; --soft: #566245;
    --terra-ink: #A25842; --line: rgba(86, 94, 50, .16);
  }
  * { box-sizing: border-box; }
  html { -webkit-tap-highlight-color: transparent; -webkit-text-size-adjust: 100%; }
  body {
    margin: 0; padding: 0 20px 80px;
    background: var(--cream); color: var(--olive);
    font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 16px; line-height: 1.7; -webkit-font-smoothing: antialiased;
  }
  main { max-width: 720px; margin: 0 auto; }
  /* Los links largos (como la URL de Defensa del Consumidor) se cortan: sin
     esto la página de arrepentimiento se corría de costado en el celular. */
  main a { overflow-wrap: anywhere; }
  h1 { font-size: clamp(1.8rem, 5vw, 2.4rem); line-height: 1.1; letter-spacing: -0.035em; font-weight: 800; margin: 0 0 1.25rem; text-wrap: balance; }
  h2 { font-size: 1.25rem; line-height: 1.25; letter-spacing: -0.02em; font-weight: 800; margin: 2.75rem 0 .75rem; }
  h3 { font-size: 1.02rem; font-weight: 700; margin: 1.6rem 0 .5rem; }
  p, li { font-size: 1rem; }
  strong { font-weight: 700; }
  ul, ol { padding-left: 1.35rem; }
  li { margin-bottom: .4rem; }
  hr { border: 0; border-top: 1px solid var(--line); margin: 2.5rem 0; }
  /* La página de eliminación de cuenta declara los plazos de conservación en
     una tabla; sin overflow se rompe en pantallas angostas. */
  .table-wrap { overflow-x: auto; margin: 1.25rem 0; }
  table { border-collapse: collapse; width: 100%; font-size: .925rem; }
  th, td { text-align: left; padding: .6rem .7rem; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { font-weight: 700; }
  /* ⚠️ #C1694F daba 3.41:1 sobre el crema — por debajo del 4.5 de AA, y acá el
     link ES el contenido (son páginas de puros enlaces). Esta es la misma
     terracota oscurecida: 4.59:1. Es el valor que en la app se llama
     ViveColors.primaryInk. */
  a { color: var(--terra-ink); }

  /* Foco de teclado. No había ninguno: quien navega con Tab —o con un lector de
     pantalla, o sin poder usar un mouse— no tenía forma de saber dónde estaba
     parado. focus-visible y no focus a secas para que el anillo no aparezca al
     hacer click con el mouse, que es lo que lleva a la gente a matarlo con
     outline:none. */
  :focus-visible { outline: 3px solid var(--terra-ink); outline-offset: 2px; border-radius: 6px; }
  code { background: rgba(86,94,50,.08); padding: .1em .35em; border-radius: 4px; font-size: .9em; }

  .top { max-width: 720px; margin: 0 auto; padding: 22px 0 8px; }
  .wordmark { display: inline-flex; align-items: center; gap: .28em; font-weight: 800; font-size: 26px; letter-spacing: -0.03em; color: var(--olive); text-decoration: none; line-height: 1; }
  .vmark { width: .95em; height: .95em; fill: none; stroke: currentColor; stroke-width: 7; }
  .nav { max-width: 720px; margin: 0 auto 2.25rem; padding: 14px 0 12px; border-bottom: 1px solid var(--line); font-size: .9rem; font-weight: 600; }
  .nav-links { display: flex; flex-wrap: wrap; gap: 0 20px; }
  .nav a { color: var(--soft); text-decoration: none; padding: 10px 0; touch-action: manipulation; }
  @media (hover: hover) and (pointer: fine) { .nav a:hover { color: var(--olive); text-decoration: underline; } }
  .nav a[aria-current="page"] { color: var(--olive); text-decoration: underline; text-decoration-color: var(--terra-ink); text-underline-offset: 5px; }
  /* "Lugar destacado" de la Res. 424/2020: el enlace no puede ser un link más
     perdido en el pie. Va primero y como botón, en su propia pastilla. */
  .nav a.regret {
    display: inline-flex; align-items: center; min-height: 44px; margin-bottom: 6px;
    padding: 0 16px; background: var(--terra-ink); color: #FFF6EC; border-radius: 999px;
    font-weight: 700; letter-spacing: .02em;
  }
  .nav a.regret[aria-current="page"] { text-decoration: none; }
  .fechas { color: var(--soft); }
  .draft {
    max-width: 720px; margin: 0 auto 2rem; padding: 12px 16px;
    background: rgba(193,105,79,.10); border: 1px solid rgba(193,105,79,.28);
    border-radius: 12px; color: #8A5A2B; font-size: .875rem; line-height: 1.5;
  }
`;

// Estilos que solo usa la portada. Van aparte para no engordar cada página
// legal con reglas que no aplican.
const HOME_CSS = `
  .lead { font-size: 1.05rem; color: var(--soft); margin-bottom: 2.5rem; }
  .card {
    display: block; padding: 18px 20px; margin-bottom: 12px;
    background: var(--paper); border: 1px solid var(--line);
    border-radius: 18px; text-decoration: none; color: inherit;
  }
  @media (hover: hover) and (pointer: fine) { .card:hover { border-color: rgba(86,94,50,.32); } }
  .card strong { display: block; margin-bottom: 3px; font-weight: 800; letter-spacing: -0.01em; }
  .card span { font-size: .92rem; color: var(--soft); }
  /* "Lugar destacado" de la Res. 424/2020: el botón de arrepentimiento tiene
     que verse como tal en la portada, no ser un link más de una lista. */
  .card.regret { background: rgba(193,105,79,.10); border-color: rgba(193,105,79,.40); }
  .card.regret strong { color: var(--terra-ink); letter-spacing: .02em; }   /* #C1694F daba 3.41:1 */
  .contact { margin-top: 3rem; font-size: .95rem; line-height: 1.7; }
  .contact .datos { color: var(--soft); font-size: .88rem; }
`;

const draftNotice = unique.length
  ? `<div class="draft"><strong>Borrador.</strong> Este documento todavía tiene campos sin completar y no fue revisado por un/a profesional del derecho. No debe considerarse vigente.</div>`
  : '';

for (const { key, md } of forWeb) {
  const { file, title } = WEB_META[key];
  // Enlaces a TODAS las páginas, no solo a "la otra": con tres documentos el
  // par fijo dejaba el botón de arrepentimiento inalcanzable desde dos de las
  // tres páginas, que es justo lo que la Res. 424/2020 no permite. La actual
  // queda marcada en vez de desaparecer, así el menú no cambia de forma.
  const actual = (k) => (k === key ? ' aria-current="page"' : '');
  const links = Object.entries(WEB_META)
    .filter(([k]) => k !== 'REGRET')
    .map(([k, m]) => `<a href="./${m.file}"${actual(k)}>${m.nav}</a>`)
    .join('\n    ');
  // "Última actualización" y "Vigencia" van en dos líneas. En el .md están en
  // líneas seguidas y Markdown las junta en un párrafo. Se corrige SOLO al
  // dibujar la página: tocar el .md cambiaría LEGAL_VERSION y las aceptaciones.
  const mdWeb = md.replace(/\n(\*\*Vigencia)/g, '  \n$1');
  const cuerpo = wrapTables(marked.parse(mdWeb))
    .replace(/<p>(<strong>Última actualización)/, '<p class="fechas">$1');
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
${HEAD}
<title>${title}</title>
<style>${CSS}</style>
</head>
<body>
<header class="top">${MARCA}</header>
<nav class="nav" aria-label="Legales">
  <a class="regret" href="./${WEB_META.REGRET.file}"${actual('REGRET')}>${WEB_META.REGRET.nav}</a>
  <div class="nav-links">
    <a href="/">Inicio</a>
    ${links}
  </div>
</nav>
${draftNotice}
<main>
${cuerpo}
</main>
</body>
</html>
`;
  writeFileSync(join(webDir, file), html, 'utf8');
}

// ── Índice de legales (web/legal/index.html) ─────────────────────────────────
// Hasta el 18/09/2026 esto se escribía en web/index.html y ERA la portada. La
// portada ahora es la landing, escrita a mano (web/index.html) — este script ya
// no la toca, porque corre en cada deploy de Vercel y la pisaría. Las dos
// exigencias de abajo las sigue cumpliendo la landing (el botón va en su nav y
// el contacto en su pie); este índice queda como hub de los legales.
// Existe por dos exigencias distintas que se resuelven en el mismo lugar:
//   - Res. 424/2020: el enlace "BOTÓN DE ARREPENTIMIENTO" tiene que estar en la
//     PORTADA, en lugar destacado y sin registro previo. Sin index no hay
//     portada, así que las páginas legales sueltas no alcanzaban.
//   - Guideline 1.2 de Apple: junto con filtrado, reporte y bloqueo, exige un
//     medio de contacto PUBLICADO. Es la cuarta pata, y es la de abajo.
const HOME_LINKS = [
  { key: 'REGRET',  hint: 'Arrepentite de una contratación dentro de los 10 días corridos. Sin registro, sin costo.' },
  { key: 'TERMS',   hint: 'Las reglas de uso de la plataforma.' },
  { key: 'PRIVACY', hint: 'Qué datos tratamos, para qué, y cuáles son tus derechos.' },
  { key: 'DELETE',  hint: 'Cómo borrar tu cuenta y qué pasa con tus datos.' },
];

const homeHtml = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
${HEAD}
<title>Legales — Vita</title>
<meta name="description" content="Vita conecta personas con profesionales del bienestar para sesiones online. Términos, privacidad, botón de arrepentimiento y contacto.">
<style>${CSS}${HOME_CSS}</style>
</head>
<body>
<header class="top">${MARCA}</header>
<nav class="nav" aria-label="Legales"><a href="/">Inicio</a></nav>
${draftNotice}
<main>
<h1>Legales</h1>
<p class="lead">Vita conecta a personas con profesionales del bienestar para sesiones online. Acá están los documentos legales, el botón de arrepentimiento y cómo contactarnos.</p>

${HOME_LINKS.map(({ key, hint }) => {
  const m = WEB_META[key];
  return `<a class="card${key === 'REGRET' ? ' regret' : ''}" href="./${m.file}"><strong>${m.nav}</strong><span>${hint}</span></a>`;
}).join('\n')}

<div class="contact">
<h2>Contacto</h2>
<p>
Escribinos a <a href="mailto:vitaappar@gmail.com">vitaappar@gmail.com</a>. Respondemos consultas sobre el servicio, reportes de conducta, privacidad y bajas de cuenta.
</p>
<p class="datos">Andre Albisu Lambertini. CUIT 20-46034087-0.<br>
De los Extremeños 5069, Córdoba, Provincia de Córdoba, Argentina.</p>
</div>
</main>
</body>
</html>
`;

writeFileSync(join(webDir, 'index.html'), homeHtml, 'utf8');

// ── La versión de los legales, para el checkout web ──────────────────────────
// `web/c/index.html` crea cuentas y tiene que guardar la misma constancia que
// la app (`profiles.accepted_terms_version`). No puede importar
// `constants/legal.ts` —es una página suelta, sin bundler— y hardcodearla sería
// justo el olvido que este script existe para evitar: cambiaría el texto y
// quedarían aceptaciones registradas contra una versión vieja.
writeFileSync(
  join(root, 'web/legal-version.js'),
  `// GENERADO POR scripts/sync-legal.mjs — NO EDITAR A MANO.\n` +
    `// Es el mismo valor que LEGAL_VERSION en constants/legal.ts.\n` +
    `window.LEGAL_VERSION = '${legalVersion}';\n`,
  'utf8'
);
console.log(`web/legal-version.js: ${legalVersion}`);

console.log(
  `web/legal/: ${forWeb.length} páginas generadas ` +
    `(${forWeb.map(({ key }) => WEB_META[key].file).join(', ')}).`
);
console.log('web/legal/index.html: índice de legales generado (botón de arrepentimiento + contacto).');
