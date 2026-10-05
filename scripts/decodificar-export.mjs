// decodificar-export.mjs — vuelve legible un export de datos.
//
// `scripts/exportar-datos-de-usuario.sql` devuelve los datos como están en la
// base: los mensajes ofuscados (ver lib/encryption.ts) y, desde el 05/10/2026,
// el diario y la gratitud CIFRADOS (ver lib/wellbeingCrypto.ts). Este script lee
// ese JSON por la entrada estándar y lo devuelve todo en texto. Ver
// docs/pedido-de-datos.md.
//
// Para el diario y la gratitud hace falta el secreto maestro: se toma de la
// variable `WELLBEING_MASTER_KEY` o, si no está, de la copia local que deja
// `scripts/crear-secreto-bienestar.sh` en ~/.config/vita/. 🔴 Si el export trae
// entradas cifradas y no hay secreto, el script CORTA: nunca entrega un diario
// ilegible como si fuera la respuesta a un pedido de acceso.
//
// Uso:
//   supabase db query --linked -f /ruta/al/export.sql | node scripts/decodificar-export.mjs > datos.json
import { readFileSync, existsSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { homedir } from 'node:os';
import { gcmsiv } from '@noble/ciphers/aes';

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

// ── Diario y gratitud ────────────────────────────────────────────────────────
// ⚠️ Prefijo, etiqueta y proyecto tienen que coincidir con `lib/wellbeingCrypto.ts`
// y `supabase/functions/wellbeing-key/index.ts`.
const PREFIJO = 'vd1.';
const ETIQUETA = 'vita:bienestar:v1:';
const PROYECTO = 'ggygiihhnkjrerpinhha';

function secretoMaestro() {
  if (process.env.WELLBEING_MASTER_KEY) return process.env.WELLBEING_MASTER_KEY;
  const archivo = `${homedir()}/.config/vita/wellbeing-master-key.${PROYECTO}.env`;
  if (!existsSync(archivo)) return '';
  return (readFileSync(archivo, 'utf8').match(/^WELLBEING_MASTER_KEY=(.*)$/m)?.[1] ?? '').trim();
}

const userId = datos.perfil?.id;
let claveBienestar = null;

function abrir(valor) {
  if (typeof valor !== 'string' || !valor.startsWith(PREFIJO)) return valor; // vacío o de antes del cifrado
  if (!claveBienestar) {
    const maestro = secretoMaestro();
    if (!maestro || !userId) {
      console.error('El export trae diario o gratitud cifrados y falta WELLBEING_MASTER_KEY (o el id del perfil). No se entrega nada.');
      process.exit(1);
    }
    claveBienestar = createHmac('sha256', maestro).update(ETIQUETA + userId).digest();
  }
  const junto = Buffer.from(valor.slice(PREFIJO.length), 'base64');
  try {
    const claro = gcmsiv(claveBienestar, junto.subarray(0, 12), Buffer.from(userId, 'utf8')).decrypt(junto.subarray(12));
    return Buffer.from(claro).toString('utf8');
  } catch {
    console.error('Una entrada cifrada no abrió: el secreto no es el de este proyecto, o la fila está dañada. No se entrega nada.');
    process.exit(1);
  }
}

for (const e of datos.diario ?? []) e.content = abrir(e.content);
for (const e of datos.gratitud ?? []) {
  for (const c of ['item_1', 'item_2', 'item_3', 'content']) e[c] = abrir(e[c]);
}
process.stdout.write(JSON.stringify({ generado: fila.generado ?? null, datos }, null, 2) + '\n');
