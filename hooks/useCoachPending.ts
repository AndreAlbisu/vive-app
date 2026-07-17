// useCoachPending — fuente única de "lo pendiente" del coach para el hub Inicio.
//
// Devuelve las solicitudes por confirmar (bookings 'pendiente') y los recursos
// recomendados sin abrir cuya sesión con ese usuario es en <48hs. Inicio lo usa
// para la sección "Pendientes" y para los puntitos de nav. Reservas comparte la
// misma data de solicitudes (se unifica en F2). Todo degrada a vacío si falta el
// dato — nunca rompe ni inventa.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export type PendingRequest = {
  id: string;
  userId: string;
  userName: string;
  initials: string;
  avatarUrl: string | null;
  scheduledDate: string;
  scheduledTime: string;
  createdAt: string;
  userMessage: string | null;
};

export type UnopenedResource = {
  id: string;          // resource_recommendations.id
  resourceId: string;
  title: string;
  userId: string;
  userName: string;
  roomId: string | null;
};

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '??';
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function useCoachPending(coachId: string | null) {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [unopened, setUnopened] = useState<UnopenedResource[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!coachId) { setRequests([]); setUnopened([]); setLoading(false); return; }

    // ── Solicitudes por confirmar ────────────────────────────────────────────
    const { data: pend } = await supabase
      .from('bookings')
      .select('id, user_id, scheduled_date, scheduled_time, created_at, user_message')
      .eq('coach_id', coachId)
      .eq('status', 'pendiente')
      .order('created_at', { ascending: false });

    const pendRows = pend ?? [];

    // ── Recursos sin abrir con sesión próxima (<48hs) ────────────────────────
    // Recursos v2: resource_recommendations con opened_at null. Se cruza contra
    // las sesiones confirmadas de las próximas 48hs para mostrar solo las urgentes.
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const todayStr = toDateStr(now);
    const in48Str = toDateStr(in48h);

    const [{ data: recs }, { data: upcoming }] = await Promise.all([
      supabase
        .from('resource_recommendations')
        .select('id, resource_id, user_id, room_id, coach_resources!inner(title)')
        .eq('coach_id', coachId)
        .is('opened_at', null),
      supabase
        .from('bookings')
        .select('user_id')
        .eq('coach_id', coachId)
        .eq('status', 'confirmada')
        .gte('scheduled_date', todayStr)
        .lte('scheduled_date', in48Str),
    ]);

    const usersWithUpcoming = new Set((upcoming ?? []).map(b => b.user_id as string));
    const recRows = (recs ?? []).filter(r => usersWithUpcoming.has(r.user_id as string));

    // ── Nombres/avatars de todos los usuarios involucrados (una query) ───────
    const allUserIds = [
      ...new Set([
        ...pendRows.map(b => b.user_id as string),
        ...recRows.map(r => r.user_id as string),
      ]),
    ];
    let profileMap: Record<string, { name: string; avatarUrl: string | null }> = {};
    if (allUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', allUserIds);
      profileMap = Object.fromEntries(
        (profiles ?? []).map(p => [p.id, { name: (p.name as string) ?? 'Usuario', avatarUrl: (p.avatar_url as string) ?? null }])
      );
    }

    setRequests(
      pendRows.map(b => {
        const prof = profileMap[b.user_id as string];
        const name = prof?.name ?? 'Usuario';
        return {
          id: b.id as string,
          userId: b.user_id as string,
          userName: name,
          initials: getInitials(name),
          avatarUrl: prof?.avatarUrl ?? null,
          scheduledDate: b.scheduled_date as string,
          scheduledTime: b.scheduled_time as string,
          createdAt: b.created_at as string,
          userMessage: (b.user_message as string) ?? null,
        };
      })
    );

    setUnopened(
      recRows.map(r => {
        const name = profileMap[r.user_id as string]?.name ?? 'Usuario';
        // El join embebido llega como objeto o array según la relación.
        const cr = r.coach_resources as { title?: string } | { title?: string }[] | null;
        const title = Array.isArray(cr) ? (cr[0]?.title ?? 'Recurso') : (cr?.title ?? 'Recurso');
        return {
          id: r.id as string,
          resourceId: r.resource_id as string,
          title,
          userId: r.user_id as string,
          userName: name,
          roomId: (r.room_id as string) ?? null,
        };
      })
    );

    setLoading(false);
  }, [coachId]);

  useEffect(() => { load(); }, [load]);

  const counts = {
    requests: requests.length,
    unopened: unopened.length,
    total: requests.length + unopened.length,
  };

  return { requests, unopened, counts, loading, refresh: load };
}
