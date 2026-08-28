// Títulos, matrículas y certificaciones de un profesional.
//
// 🔴 LA REGLA QUE ORDENA TODO ESTE ARCHIVO: el documento NO es contenido
// público. El coach lo sube a un bucket privado, un admin lo mira con una URL
// firmada que emite `admin-actions`, y lo que se publica es el DATO EN TEXTO
// con la marca de verificado. Ninguna función de acá devuelve el archivo a un
// usuario final, y no hay ninguna que pueda hacerlo: el bucket es privado y la
// vista pública no expone `file_path`.
//
// Por qué así y no una galería de certificados, en `scripts/add-coach-credentials.sql`.

import { File } from 'expo-file-system';
import { supabase } from './supabase';
import type {
  CredentialInput, CredentialKind, CredentialStatus, PublicCredential,
} from './credentialRules';

// Re-exportadas para que una pantalla no tenga que importar de dos lados.
export { KIND_LABEL, lineaCredencial, validarCredencial } from './credentialRules';
export type { CredentialInput, CredentialKind, CredentialStatus, PublicCredential };

/** Lo que ve el propio coach de su credencial, con el estado de la revisión. */
export type OwnCredential = {
  id: string;
  kind: CredentialKind;
  title: string;
  institution: string | null;
  year: number | null;
  registrationNumber: string | null;
  filePath: string | null;
  status: CredentialStatus;
  reviewNotes: string | null;
  createdAt: string;
};

function mapOwn(r: Record<string, any>): OwnCredential {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    institution: r.institution ?? null,
    year: r.year ?? null,
    registrationNumber: r.registration_number ?? null,
    filePath: r.file_path ?? null,
    status: r.status,
    reviewNotes: r.review_notes ?? null,
    createdAt: r.created_at,
  };
}

/** Las credenciales del coach logueado, en todos sus estados. */
export async function listOwnCredentials(coachId: string): Promise<OwnCredential[]> {
  const { data, error } = await supabase
    .from('coach_credentials')
    .select('id, kind, title, institution, year, registration_number, file_path, status, review_notes, created_at')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[coachCredentials] listOwn:', error.message);
    return [];
  }
  return (data ?? []).map(mapOwn);
}

/**
 * Las credenciales VERIFICADAS de un profesional, para su perfil público.
 *
 * ⚠️ Lee la vista y no la tabla. La tabla no tiene policy de lectura pública, y
 * si la tuviera expondría `file_path` — RLS filtra filas, no columnas.
 */
export async function listPublicCredentials(coachId: string): Promise<PublicCredential[]> {
  const { data, error } = await supabase
    .from('coach_credentials_public')
    .select('id, kind, title, institution, year, registration_number')
    .eq('coach_id', coachId);

  if (error) {
    console.error('[coachCredentials] listPublic:', error.message);
    return [];
  }
  return (data ?? []).map(r => ({
    id: r.id as string,
    kind: r.kind as CredentialKind,
    title: r.title as string,
    institution: (r.institution as string | null) ?? null,
    year: (r.year as number | null) ?? null,
    registrationNumber: (r.registration_number as string | null) ?? null,
  }));
}

/**
 * Sube el documento al bucket PRIVADO y devuelve su path.
 *
 * ⚠️ Devuelve un path, no una URL: `getPublicUrl` —el patrón que se copia en
 * toda la app— acá no sirve para nada, porque el bucket no es público. Mirarlo
 * requiere una URL firmada y eso solo lo puede emitir `admin-actions`.
 *
 * La carpeta es `auth.uid()` (o sea `profiles.id`), NO `coaches.id`: es lo que
 * exige la policy de storage, y son ids distintos.
 */
export async function uploadCredentialFile(
  userId: string,
  uri: string,
  fileName: string,
  mimeType: string | null | undefined,
): Promise<{ path: string } | { error: string }> {
  try {
    const file = new File(uri);
    const bytes = await file.bytes();
    const ext = (fileName.split('.').pop() ?? 'jpg').toLowerCase();
    // Nombre único: una credencial no reemplaza a otra, y `upsert: false` deja
    // que el bucket rechace una colisión en vez de pisar un documento ajeno.
    const path = `${userId}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('coach-credentials')
      .upload(path, bytes, { contentType: mimeType ?? 'application/octet-stream', upsert: false });

    if (error) return { error: error.message };
    return { path };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function createCredential(coachId: string, input: CredentialInput): Promise<string | null> {
  const { error } = await supabase.from('coach_credentials').insert({
    coach_id: coachId,
    kind: input.kind,
    title: input.title.trim(),
    institution: input.institution?.trim() || null,
    year: input.year,
    registration_number: input.registrationNumber?.trim() || null,
    file_path: input.filePath,
    // `status` NO se manda: el cliente no tiene el privilegio de escribirlo
    // (ver el `grant update (...)` del script) y el default es 'pendiente'.
  });
  return error ? error.message : null;
}

/**
 * ⚠️ Editar una credencial ya verificada la devuelve a 'pendiente' — lo hace el
 * trigger `trg_reset_credential_on_edit` en la base, no este código. La pantalla
 * tiene que avisarlo ANTES de guardar: si no, el coach ve desaparecer su marca
 * de verificado sin entender por qué.
 */
export async function updateCredential(id: string, input: CredentialInput): Promise<string | null> {
  const { error } = await supabase
    .from('coach_credentials')
    .update({
      kind: input.kind,
      title: input.title.trim(),
      institution: input.institution?.trim() || null,
      year: input.year,
      registration_number: input.registrationNumber?.trim() || null,
      file_path: input.filePath,
    })
    .eq('id', id);
  return error ? error.message : null;
}

export async function deleteCredential(id: string, filePath: string | null): Promise<string | null> {
  const { error } = await supabase.from('coach_credentials').delete().eq('id', id);
  if (error) return error.message;

  // El archivo se borra DESPUÉS de la fila y sin cortar si falla: quedarse con
  // un documento de identidad huérfano en el bucket es peor que un error acá,
  // pero perder el borrado de la fila por un fallo de storage sería peor aún.
  if (filePath) {
    const { error: rmErr } = await supabase.storage.from('coach-credentials').remove([filePath]);
    if (rmErr) console.error('[coachCredentials] archivo huérfano en el bucket:', filePath, rmErr.message);
  }
  return null;
}
