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
];

/** Saca el bloque de citas inicial (aviso interno de borrador). */
function stripLeadingBlockquote(md) {
  const lines = md.split('\n');
  let i = 0;
  while (i < lines.length && (lines[i].startsWith('>') || lines[i].trim() === '')) i++;
  return lines.slice(i).join('\n').trimStart();
}

/** [texto](./archivo.md) → texto (los links relativos no resuelven en la app). */
function flattenRelativeLinks(md) {
  return md.replace(/\[([^\]]+)\]\(\.\/[^)]+\)/g, '$1');
}

/** Placeholders sin completar: [algo] que no sea un link markdown. */
function findPlaceholders(md) {
  const withoutLinks = md.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  return [...new Set(withoutLinks.match(/\[[^\]\n]{1,60}\]/g) ?? [])];
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
  const clean = flattenRelativeLinks(stripLeadingBlockquote(raw));
  placeholders.push(...findPlaceholders(clean));
  parts.push(`export const ${key}_MD = ${toTemplateLiteral(clean)};`);
  forWeb.push({ key, md: clean });
}

const unique = [...new Set(placeholders)].sort();

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
console.log(`constants/legal.ts generado. Placeholders sin completar: ${unique.length}`);
if (unique.length) console.log(unique.join(' · '));

// ── Páginas web públicas ─────────────────────────────────────────────────────
// App Store Connect y Google Play Console EXIGEN una URL pública de la Política
// de Privacidad para poder publicar la app; el .md del repo no sirve como tal.
// Se generan del mismo texto que muestra la app, así no pueden divergir.
const WEB_META = {
  TERMS:   { file: 'terminos.html',   title: 'Términos y Condiciones — Vita' },
  PRIVACY: { file: 'privacidad.html', title: 'Política de Privacidad — Vita' },
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
  const other = key === 'TERMS' ? WEB_META.PRIVACY : WEB_META.TERMS;
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${CSS}</style>
</head>
<body>
<nav class="nav"><a href="./${other.file}">${other.title.replace(' — Vita', '')}</a></nav>
${draftNotice}
<main>
${marked.parse(md)}
</main>
</body>
</html>
`;
  writeFileSync(join(webDir, file), html, 'utf8');
}

console.log(`web/legal/: ${forWeb.length} páginas generadas (terminos.html, privacidad.html).`);
