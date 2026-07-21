import { useState, useEffect } from 'react';
import { withLayoutContext } from 'expo-router';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';

import { IslandTabBar, type IslandTab } from '@/components/ui/IslandTabBar';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useUnreadSalas } from '@/hooks/useUnreadSalas';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// Ver comentario en app/(tabs)/_layout.tsx — mismo cambio bottom-tabs→material-top-tabs
// para swipe. `perfil` se movió a app/perfil.tsx (ruta raíz, misma URL) porque un
// pager no puede tener una página "oculta pero navegable" sin que quede swipeable
// entre las demás; acá solo quedan las 4 pestañas reales.
const MaterialTopTabs = createMaterialTopTabNavigator();
const Tabs = withLayoutContext(MaterialTopTabs.Navigator, undefined, true);

export default function CoachTabLayout() {
  const { user } = useAuth();
  const [coachId, setCoachId] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const { hasAnyUnread: hasUnreadChats, refresh: refreshUnread } = useUnreadSalas({ userId: user?.id ?? null, role: 'coach' });
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!user) return;
    supabase
      .from('coaches')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setCoachId(data.id); });
  }, [user]);

  useEffect(() => {
    if (!coachId) return;
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('coach_id', coachId)
      .eq('status', 'pendiente')
      .then(({ count }) => setPendingCount(count ?? 0));
  }, [coachId]);

  useEffect(() => {
    if (!coachId) return;
    const channel = supabase
      .channel('coach-tab-badge')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `coach_id=eq.${coachId}` },
        () => {
          supabase
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .eq('coach_id', coachId)
            .eq('status', 'pendiente')
            .then(({ count }) => setPendingCount(count ?? 0));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [coachId]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`coach-chats-badge-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        () => refreshUnread())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'salas' },
        () => refreshUnread())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, refreshUnread]);

  // Orden sin cambios: Inicio → Reservas → Chats → Recursos.
  const tabs: IslandTab[] = [
    { name: 'index',    icon: 'calendar',        label: 'Inicio' },
    { name: 'reservas', icon: 'clipboard',       label: 'Reservas', dot: pendingCount > 0 },
    { name: 'chats',    icon: 'message-circle',  label: 'Chats', dot: hasUnreadChats },
    { name: 'recursos', icon: 'book-open',       label: 'Recursos' },
  ];

  return (
    <Tabs
      tabBarPosition="bottom"
      screenOptions={{ lazy: true, animationEnabled: !reducedMotion }}
      tabBar={(props) => <IslandTabBar {...props} tabs={tabs} />}>
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="reservas" options={{ title: 'Reservas' }} />
      <Tabs.Screen name="chats" options={{ title: 'Chats' }} />
      <Tabs.Screen name="recursos" options={{ title: 'Recursos' }} />
    </Tabs>
  );
}
