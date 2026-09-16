import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { getLatestSharedNotesByCoach } from '@/lib/sessionNotes';

interface Options {
  userId: string | null;
  role: 'user' | 'coach';
}

export function useUnreadSalas({ userId, role }: Options) {
  const [unreadSalaIds, setUnreadSalaIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!userId) { setUnreadSalaIds(new Set()); return; }

    const roleCol = role === 'user' ? 'user_id' : 'coach_id';

    const { data: salas } = await supabase
      .from('salas')
      .select('id, coach_id, user_last_read_at, coach_last_read_at')
      .eq(roleCol, userId);

    if (!salas?.length) { setUnreadSalaIds(new Set()); return; }

    const salaIds = salas.map(s => s.id as string);

    const { data: msgs } = await supabase
      .from('messages')
      .select('sala_id, created_at')
      .in('sala_id', salaIds)
      .in('sender_type', ['user', 'coach'])
      .neq('sender_id', userId)
      .order('created_at', { ascending: false });

    const latestAt: Record<string, string> = {};
    (msgs ?? []).forEach(m => {
      const sid = m.sala_id as string;
      if (!latestAt[sid]) latestAt[sid] = m.created_at as string;
    });

    // 🔴 Una nota compartida también es algo que llegó y no se leyó. Esto se
    // calculaba solo contra `messages`, así que el coach compartía una nota y
    // del otro lado no se encendía nada: había que entrar a la Sala por otro
    // motivo para encontrarla. Se compara contra el MISMO `user_last_read_at`
    // que los mensajes, así que abrir el chat apaga las dos cosas a la vez.
    //
    // Solo del lado del usuario: las notas las escribe el coach, y marcarle no
    // leído su propio texto no tendría sentido.
    if (role === 'user') {
      const notas = await getLatestSharedNotesByCoach(userId);
      salas.forEach(sala => {
        const nota = notas[sala.coach_id as string];
        if (!nota) return;
        const sid = sala.id as string;
        if (!latestAt[sid] || nota.createdAt > latestAt[sid]) latestAt[sid] = nota.createdAt;
      });
    }

    const unread = new Set<string>();
    salas.forEach(sala => {
      const latest = latestAt[sala.id as string];
      if (!latest) return;
      const readAt = role === 'user'
        ? (sala.user_last_read_at as string | null)
        : (sala.coach_last_read_at as string | null);
      if (!readAt || latest > readAt) unread.add(sala.id as string);
    });

    setUnreadSalaIds(unread);
  }, [userId, role]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  return { hasAnyUnread: unreadSalaIds.size > 0, unreadSalaIds, refresh };
}
