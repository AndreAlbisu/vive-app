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

export type SessionNote = {
  id: string;
  bookingId: string;
  content: string;
  shared: boolean;
  createdAt: string;
};

/**
 * Todas las notas de una RELACIÓN (este usuario con este coach), no las de una
 * sesión suelta.
 *
 * 🔴 Existe porque el chat mostraba una sola nota, la de `activeBooking`, y
 * `activeBooking` prioriza la sesión próxima sobre la que terminó: apenas se
 * reservaba la siguiente, la nota de la anterior **desaparecía del chat** aunque
 * siguiera en la base. Justo el momento en que el usuario la va a releer.
 *
 * ⚠️ Devuelve las privadas SOLO si `asCoach`. El RLS ya lo garantiza —la policy
 * del usuario es `user_id = auth.uid() AND shared = true`— pero el filtro va
 * igual y explícito: que la privacidad de la nota se pueda leer acá, sin tener
 * que ir a buscar la policy para saber qué trae esta consulta.
 */
export async function getRelationshipNotes(
  { userId, coachId, asCoach }: { userId: string; coachId: string; asCoach: boolean },
): Promise<SessionNote[]> {
  let q = supabase
    .from('session_notes')
    .select('id, booking_id, content, shared, created_at')
    .eq('user_id', userId)
    .eq('coach_id', coachId)
    .order('created_at', { ascending: true });

  if (!asCoach) q = q.eq('shared', true);

  const { data } = await q;
  return (data ?? []).map(r => ({
    id: r.id as string,
    bookingId: r.booking_id as string,
    content: r.content as string,
    shared: r.shared as boolean,
    createdAt: r.created_at as string,
  }));
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
