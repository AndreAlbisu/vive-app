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

/** Escapa para meter el texto en un template literal de TS. */
function toTemplateLiteral(text) {
  return '`' + text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`';
}

const parts = [];
const placeholders = [];
const forWeb = [];

for (const { key, file } of DOCS) {
  const raw = readFileSync(join(root, file), 'utf8');
  const { md, offset } = stripLeadingBlockquote(raw);
  const clean = flattenRelativeLinks(md);
  placeholders.push(
    ...findPlaceholders(clean).map((p) => ({ ...p, file, line: p.line + offset }))
  );
  parts.push(`export const ${key}_MD = ${toTemplateLiteral(clean)};`);
  forWeb.push({ key, md: clean });
}

const unique = [...new Set(placeholders.map((p) => p.text))].sort();

const out = `// GENERADO POR scripts/sync-legal.mjs — NO EDITAR A MANO.
// Fuente: docs/terminos-y-condiciones.md · docs/politica-de-privacidad.md
// Para actualizar: editá el .md y corré \`npm run sync:legal\`.

${parts.join('\n\n')}

/** Placeholders sin completar detectados al generar este archivo. */
export const LEGAL_PLACEHOLDERS: string[] = ${JSON.stringify(unique)};

/** true mientras los documentos sigan siendo un borrador sin completar.
 *  La pantalla legal muestra un aviso mientras esto sea true; cuando el/la
 *  abogado/a complete todos los campos entre corchetes, desaparece solo. */
export const LEGAL_IS_DRAFT = ${unique.length > 0};
`;

writeFileSync(join(root, 'constants/legal.ts'), out, 'utf8');
console.log(
  `constants/legal.ts generado. Placeholders sin completar: ${placeholders.length}` +
    ` (${unique.length} distintos)`
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
    .draft { background: rgba(193,105,79,.16); color: #E8B48F; border-color: rgba(193,105,79,.35); }
  }
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
<nav class="nav">${others}</nav>
${draftNotice}
<main>
${marked.parse(md)}
</main>
</body>
</html>
`;
  writeFileSync(join(webDir, file), html, 'utf8');
}

console.log(
  `web/legal/: ${forWeb.length} páginas generadas ` +
    `(${forWeb.map(({ key }) => WEB_META[key].file).join(', ')}).`
);
