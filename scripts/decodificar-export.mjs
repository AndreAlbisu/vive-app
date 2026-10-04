// decodificar-export.mjs — vuelve legibles los mensajes de un export de datos.
//
// `scripts/exportar-datos-de-usuario.sql` devuelve los mensajes como están en la
// base (ofuscados, ver lib/encryption.ts). Este script lee ese JSON por la
// entrada estándar y lo devuelve con `contenido` en texto. Ver docs/pedido-de-datos.md.
//
// Uso:
//   supabase db query --linked -f /ruta/al/export.sql | node scripts/decodificar-export.mjs > datos.json
import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const KEY = (env.match(/^EXPO_PUBLIC_ENCRYPTION_KEY=(.*)$/m)?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
if (!KEY) { console.error('Falta EXPO_PUBLIC_ENCRYPTION_KEY en .env'); process.exit(1); }

function decodificar(texto) {
  try {
    const bin = Buffer.from(texto, 'base64').toString('binary');
    let out = '';
    for (let i = 0; i < bin.length; i++) out += String.fromCharCode(bin.charCodeAt(i) ^ KEY.charCodeAt(i % KEY.length));
    return decodeURIComponent(out);
  } catch {
    return texto; // filas viejas en texto plano, igual que hace la app
  }
}

const crudo = readFileSync(0, 'utf8');
const json = JSON.parse(crudo.slice(crudo.indexOf('{')));
const fila = json.rows?.[0] ?? json;
const datos = fila.datos ?? fila;
for (const m of datos.mensajes_enviados ?? []) {
  m.contenido = decodificar(m.contenido_ofuscado);
  delete m.contenido_ofuscado;
}
process.stdout.write(JSON.stringify({ generado: fila.generado ?? null, datos }, null, 2) + '\n');
