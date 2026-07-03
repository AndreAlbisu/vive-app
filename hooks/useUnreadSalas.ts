import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';

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
      .select('id, user_last_read_at, coach_last_read_at')
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
