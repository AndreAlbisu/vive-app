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

for (const { key, file, app = true } of DOCS) {
  const raw = readFileSync(join(root, file), 'utf8');
  const { md, offset } = stripLeadingBlockquote(raw);
  const clean = flattenRelativeLinks(md);
  placeholders.push(
    ...findPlaceholders(clean).map((p) => ({ ...p, file, line: p.line + offset }))
  );
  if (app) parts.push(`export const ${key}_MD = ${toTemplateLiteral(clean)};`);
  forWeb.push({ key, md: clean });
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

const CSS = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 40px 20px 80px;
    background: #F7EFE4; color: #3A4F2A;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 16px; line-height: 1.65;
  }
  main { max-width: 720px; margin: 0 auto; }
  h1 { font-size: 1.75rem; line-height: 1.25; margin: 0 0 1.5rem; }
  h2 { font-size: 1.2rem; margin: 2.5rem 0 .75rem; }
  h3 { font-size: 1rem; margin: 1.5rem 0 .5rem; }
  p, li { font-size: 1rem; }
  ul, ol { padding-left: 1.35rem; }
  li { margin-bottom: .4rem; }
  hr { border: 0; border-top: 1px solid rgba(58,79,42,.15); margin: 2.5rem 0; }
  /* La página de eliminación de cuenta declara los plazos de conservación en
     una tabla; sin overflow se rompe en pantallas angostas. */
  .table-wrap { overflow-x: auto; margin: 1.25rem 0; }
  table { border-collapse: collapse; width: 100%; font-size: .925rem; }
  th, td { text-align: left; padding: .6rem .7rem; border-bottom: 1px solid rgba(58,79,42,.15); vertical-align: top; }
  th { font-weight: 700; }
  a { color: #C1694F; }
  code { background: rgba(58,79,42,.08); padding: .1em .35em; border-radius: 4px; font-size: .9em; }
  .nav { max-width: 720px; margin: 0 auto 2rem; font-size: .9rem; }
  /* "Lugar destacado" de la Res. 424/2020: el enlace no puede ser un link más
     perdido en el pie. Se lo pinta como botón y se lo separa del resto. */
  .nav a.regret {
    display: inline-block; margin-left: .35rem; padding: .35rem .7rem;
    background: #C1694F; color: #FFF6EC; border-radius: 8px;
    font-weight: 700; letter-spacing: .02em; text-decoration: none;
  }
  .draft {
    max-width: 720px; margin: 0 auto 2rem; padding: 12px 16px;
    background: rgba(193,105,79,.10); border: 1px solid rgba(193,105,79,.28);
    border-radius: 12px; color: #8A5A2B; font-size: .875rem; line-height: 1.5;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #1A1C16; color: #E4E0D2; }
    h1, h2, h3 { color: #F2EDE0; }
    hr { border-top-color: rgba(228,224,210,.18); }
    code { background: rgba(228,224,210,.10); }
    th, td { border-bottom-color: rgba(228,224,210,.18); }
    .draft { background: rgba(193,105,79,.16); color: #E8B48F; border-color: rgba(193,105,79,.35); }
    .card { background: rgba(228,224,210,.05); border-color: rgba(228,224,210,.14); }
    .lead { color: rgba(228,224,210,.85); }
  }
`;

// Estilos que solo usa la portada. Van aparte para no engordar cada página
// legal con reglas que no aplican.
const HOME_CSS = `
  .lead { font-size: 1.05rem; color: rgba(58,79,42,.85); margin-bottom: 2.5rem; }
  .card {
    display: block; padding: 16px 18px; margin-bottom: 12px;
    background: rgba(58,79,42,.04); border: 1px solid rgba(58,79,42,.14);
    border-radius: 14px; text-decoration: none; color: inherit;
  }
  .card:hover { border-color: rgba(58,79,42,.30); }
  .card strong { display: block; margin-bottom: 3px; }
  .card span { font-size: .9rem; opacity: .8; }
  /* "Lugar destacado" de la Res. 424/2020: el botón de arrepentimiento tiene
     que verse como tal en la portada, no ser un link más de una lista. */
  .card.regret { background: rgba(193,105,79,.10); border-color: rgba(193,105,79,.40); }
  .card.regret strong { color: #C1694F; letter-spacing: .02em; }
  .contact { margin-top: 3rem; font-size: .925rem; line-height: 1.7; }
`;

const draftNotice = unique.length
  ? `<div class="draft"><strong>Borrador.</strong> Este documento todavía tiene campos sin completar y no fue revisado por un/a profesional del derecho. No debe considerarse vigente.</div>`
  : '';

for (const { key, md } of forWeb) {
  const { file, title } = WEB_META[key];
  // Enlaces a TODAS las otras páginas, no solo a "la otra": con tres documentos
  // el par fijo dejaba el botón de arrepentimiento inalcanzable desde dos de las
  // tres páginas, que es justo lo que la Res. 424/2020 no permite.
  const others = Object.entries(WEB_META)
    .filter(([k]) => k !== key)
    .map(([k, m]) => `<a href="./${m.file}"${k === 'REGRET' ? ' class="regret"' : ''}>${m.nav}</a>`)
    .join(' · ');
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${CSS}</style>
</head>
<body>
<nav class="nav"><a href="../index.html">Inicio</a> · ${others}</nav>
${draftNotice}
<main>
${wrapTables(marked.parse(md))}
</main>
</body>
</html>
`;
  writeFileSync(join(webDir, file), html, 'utf8');
}

// ── Portada ──────────────────────────────────────────────────────────────────
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
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vita — Bienestar acompañado</title>
<meta name="description" content="Vita conecta personas con profesionales del bienestar para sesiones online. Términos, privacidad, botón de arrepentimiento y contacto.">
<style>${CSS}${HOME_CSS}</style>
</head>
<body>
${draftNotice}
<main>
<h1>Vita</h1>
<p class="lead">Vita conecta a personas con profesionales del bienestar para sesiones online. Acá están los documentos legales, el botón de arrepentimiento y cómo contactarnos.</p>

${HOME_LINKS.map(({ key, hint }) => {
  const m = WEB_META[key];
  return `<a class="card${key === 'REGRET' ? ' regret' : ''}" href="./legal/${m.file}"><strong>${m.nav}</strong><span>${hint}</span></a>`;
}).join('\n')}

<div class="contact">
<h2>Contacto</h2>
<p>
Escribinos a <a href="mailto:vitaappar@gmail.com">vitaappar@gmail.com</a>. Respondemos consultas sobre el servicio, reportes de conducta, privacidad y bajas de cuenta.<br>
Andre Albisu Lambertini — CUIT 20-46034087-0<br>
De los Extremeños 5069, Córdoba, Provincia de Córdoba, Argentina.
</p>
</div>
</main>
</body>
</html>
`;

writeFileSync(join(root, 'web/index.html'), homeHtml, 'utf8');

console.log(
  `web/legal/: ${forWeb.length} páginas generadas ` +
    `(${forWeb.map(({ key }) => WEB_META[key].file).join(', ')}).`
);
console.log('web/index.html: portada generada (botón de arrepentimiento + contacto).');
