// sessionNotes — notas de sesión del coach (privada + compartida por booking).
// Tabla session_notes (scripts/add-session-notes.sql). RLS: el coach gestiona las
// suyas, el usuario solo lee las compartidas. Ver project_vive_anti_disintermediation.

import { supabase } from '@/lib/supabase';

export type NotasDeSesion = { privateNote: string; sharedNote: string };

/** Coach: lee ambas notas (privada y compartida) de una sesión.
 *
 *  🔴 null = NO SE PUDO LEER, que no es lo mismo que "no hay notas". Antes un
 *  error devolvía dos vacíos, el formulario los mostraba como si no hubiera
 *  nada, y "Guardar" mandaba esos vacíos, que `saveSessionNote` interpreta
 *  como borrar: un corte de red al abrir terminaba borrando notas reales
 *  (auditoría del 26/09/2026, C3). */
export async function getSessionNotes(bookingId: string): Promise<NotasDeSesion | null> {
  const { data, error } = await supabase
    .from('session_notes')
    .select('content, shared')
    .eq('booking_id', bookingId);
  if (error) {
    console.error('[sessionNotes] get:', error.message);
    return null;
  }
  const rows = data ?? [];
  return {
    privateNote: rows.find(r => !r.shared)?.content ?? '',
    sharedNote: rows.find(r => r.shared)?.content ?? '',
  };
}

/** Qué notas hay que escribir: solo las que el coach cambió respecto de lo que
 *  se cargó. Así guardar una no reescribe (ni borra) la otra, y vaciar una
 *  nota sigue siendo la forma deliberada de borrarla. */
export function notasCambiadas(original: NotasDeSesion, actual: NotasDeSesion): { shared: boolean; content: string }[] {
  const cambios: { shared: boolean; content: string }[] = [];
  if (actual.privateNote.trim() !== original.privateNote.trim()) cambios.push({ shared: false, content: actual.privateNote });
  if (actual.sharedNote.trim() !== original.sharedNote.trim()) cambios.push({ shared: true, content: actual.sharedNote });
  return cambios;
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

/**
 * Usuario: la ÚLTIMA nota compartida de cada uno de sus coaches.
 *
 * 🔴 Existe porque una nota compartida no existía fuera de la Sala. El puntito
 * de no leídos (`hooks/useUnreadSalas`) y el preview de cada chat en Sesiones se
 * calculaban **solo contra `messages`**, así que el coach compartía una nota y
 * del otro lado no pasaba nada: ni punto, ni cambio en la lista, ni orden
 * distinto. La única forma de enterarse era entrar a la Sala por otro motivo y
 * encontrarla intercalada entre mensajes viejos.
 *
 * 📌 Va por `coach_id` y no por sala: `session_notes` no conoce la sala —cuelga
 * de (booking, coach, usuario)—. Quien llama mapea coach → sala, que es dato que
 * ya tiene.
 *
 * ⚠️ Solo tiene sentido del lado del USUARIO. Las notas las escribe siempre el
 * coach, así que para él nunca son "algo que llegó": serían su propio texto
 * marcándole no leído.
 */
export async function getLatestSharedNotesByCoach(
  userId: string,
): Promise<Record<string, { content: string; createdAt: string }>> {
  const { data } = await supabase
    .from('session_notes')
    .select('coach_id, content, created_at')
    .eq('user_id', userId)
    .eq('shared', true)
    .order('created_at', { ascending: false });

  const ultima: Record<string, { content: string; createdAt: string }> = {};
  for (const r of data ?? []) {
    const cid = r.coach_id as string;
    // Vienen ordenadas desc: la primera de cada coach es la última.
    if (!ultima[cid]) ultima[cid] = { content: r.content as string, createdAt: r.created_at as string };
  }
  return ultima;
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
