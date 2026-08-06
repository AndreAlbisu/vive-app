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

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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

for (const { key, file } of DOCS) {
  const raw = readFileSync(join(root, file), 'utf8');
  const clean = flattenRelativeLinks(stripLeadingBlockquote(raw));
  placeholders.push(...findPlaceholders(clean));
  parts.push(`export const ${key}_MD = ${toTemplateLiteral(clean)};`);
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
