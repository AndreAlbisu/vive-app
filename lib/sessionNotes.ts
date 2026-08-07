// sessionNotes — notas de sesión del coach (privada + compartida por booking).
// Tabla session_notes (scripts/add-session-notes.sql). RLS: el coach gestiona las
// suyas, el usuario solo lee las compartidas. Ver project_vive_anti_disintermediation.

import { supabase } from '@/lib/supabase';

/** Coach: lee ambas notas (privada y compartida) de una sesión. */
export async function getSessionNotes(bookingId: string): Promise<{ privateNote: string; sharedNote: string }> {
  const { data } = await supabase
    .from('session_notes')
    .select('content, shared')
    .eq('booking_id', bookingId);
  const rows = data ?? [];
  return {
    privateNote: rows.find(r => !r.shared)?.content ?? '',
    sharedNote: rows.find(r => r.shared)?.content ?? '',
  };
}

/** Usuario: lee la nota compartida de una sesión (null si no hay). */
export async function getSharedNote(bookingId: string): Promise<string | null> {
  const { data } = await supabase
    .from('session_notes')
    .select('content')
    .eq('booking_id', bookingId)
    .eq('shared', true)
    .maybeSingle();
  return data?.content ?? null;
}

interface SaveNoteInput {
  bookingId: string;
  coachId: string;
  userId: string;
  shared: boolean;
  content: string;
}

/** Coach: guarda (upsert) una nota; si el contenido queda vacío, la borra.
 *  Devuelve false si algo falló. */
export async function saveSessionNote(input: SaveNoteInput): Promise<boolean> {
  const content = input.content.trim();
  if (!content) {
    // Vaciar = borrar esa nota (privada o compartida) de la sesión.
    const { error } = await supabase
      .from('session_notes')
      .delete()
      .eq('booking_id', input.bookingId)
      .eq('shared', input.shared);
    return !error;
  }
  const { error } = await supabase
    .from('session_notes')
    .upsert(
      {
        booking_id: input.bookingId,
        coach_id: input.coachId,
        user_id: input.userId,
        shared: input.shared,
        content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'booking_id,shared' },
    );
  return !error;
}
