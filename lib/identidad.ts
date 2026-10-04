// Verificación de identidad de profesionales (01/10/2026).
//
// En la postulación se suben tres fotos al bucket PRIVADO `identity-docs`, con
// nombre fijo: `{uid}/dni-frente.jpg`, `{uid}/dni-dorso.jpg`, `{uid}/selfie.jpg`.
// Nombre fijo y upsert: volver a sacar una foto la reemplaza, no la acumula.
// `enviar_identidad()` confirma que estén las tres y deja la constancia en
// `identity_verifications`. Un admin las compara y, al verificar, se borran.

import { File } from 'expo-file-system';
import { supabase } from '@/lib/supabase';

export type FotoIdentidad = 'dni-frente' | 'dni-dorso' | 'selfie';

export const FOTOS_IDENTIDAD: { id: FotoIdentidad; titulo: string; ayuda: string }[] = [
  { id: 'dni-frente', titulo: 'DNI, frente', ayuda: 'Que se lea tu nombre y se vea la foto.' },
  { id: 'dni-dorso', titulo: 'DNI, dorso', ayuda: 'Completo, sin reflejos.' },
  { id: 'selfie', titulo: 'Selfie con tu DNI', ayuda: 'Tu cara y el DNI en la misma foto, al lado de tu cara.' },
];

export type EstadoIdentidad = 'sin_cargar' | 'pendiente' | 'verificada';

export async function subirFotoIdentidad(uid: string, foto: FotoIdentidad, uri: string): Promise<string | null> {
  try {
    const bytes = await new File(uri).bytes();
    const { error } = await supabase.storage
      .from('identity-docs')
      .upload(`${uid}/${foto}.jpg`, bytes, { contentType: 'image/jpeg', upsert: true });
    return error ? error.message : null;
  } catch (e) {
    return e instanceof Error ? e.message : 'No se pudo leer la foto';
  }
}

/** Estado propio. `fotosEnServidor` dice si las fotos siguen ahí (una
 *  pendiente las tiene; una verificada ya no, se borraron al verificar). */
export async function miIdentidad(uid: string): Promise<{ estado: EstadoIdentidad; fotosEnServidor: FotoIdentidad[] }> {
  const [{ data: fila }, { data: archivos }] = await Promise.all([
    supabase.from('identity_verifications').select('status').eq('profile_id', uid).maybeSingle(),
    supabase.storage.from('identity-docs').list(uid, { limit: 10 }),
  ]);
  const fotosEnServidor = FOTOS_IDENTIDAD
    .map(f => f.id)
    .filter(id => (archivos ?? []).some(a => a.name === `${id}.jpg`));
  const estado: EstadoIdentidad = fila?.status === 'verificada' ? 'verificada'
    : fila?.status === 'pendiente' ? 'pendiente'
    : 'sin_cargar';
  return { estado, fotosEnServidor };
}

/** Deja las fotos en revisión. Falla si falta alguna en el servidor. */
export async function enviarIdentidad(): Promise<string | null> {
  const { error } = await supabase.rpc('enviar_identidad');
  if (!error) return null;
  if (error.message.includes('identidad_incompleta')) return 'Faltan fotos de tu identidad. Volvé a subirlas.';
  return error.message;
}

export function identidadCompleta(estado: EstadoIdentidad, subidas: ReadonlySet<FotoIdentidad>): boolean {
  return estado === 'verificada' || FOTOS_IDENTIDAD.every(f => subidas.has(f.id));
}
