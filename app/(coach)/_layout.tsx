import { useState, useEffect, useCallback } from 'react';
import { withLayoutContext } from 'expo-router';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';

import { IslandTabBar, type IslandTab } from '@/components/ui/IslandTabBar';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useUnreadSalas } from '@/hooks/useUnreadSalas';
import { esperaConfirmacionDelCoach } from '@/lib/bookingHelpers';
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

  // 🔴 El punto NO se cuenta con `status = 'pendiente'` a secas. Una reserva con
  // un cobro iniciado y sin acreditar también está pendiente, pero ahí no espera
  // al coach: espera a la plata, y él no la puede confirmar. Contándolas juntas,
  // el coach aceptaba la única que sí lo esperaba y el punto seguía encendido —
  // que es como se reportó el bug (28/08/2026).
  //
  // 📝 `esperaConfirmacionDelCoach` existe justamente para que no haya dos copias
  // de esta regla; su comentario lo dice. `CoachReservasScreen` ya la usaba y
  // este badge era la segunda copia, que se separó igual.
  //
  // ⚠️ Por eso no se puede usar `count` + `head: true`: hay que traer las
  // columnas del cobro para poder aplicar la regla. Son las pendientes de un
  // coach, no un volumen que preocupe.
  const contarPendientes = useCallback(() => {
    if (!coachId) return;
    supabase
      .from('bookings')
      .select('status, payment_status, preference_id, usdt_amount')
      .eq('coach_id', coachId)
      .eq('status', 'pendiente')
      .then(({ data }) => {
        setPendingCount((data ?? []).filter(esperaConfirmacionDelCoach).length);
      });
  }, [coachId]);

  useEffect(() => { contarPendientes(); }, [contarPendientes]);

  useEffect(() => {
    if (!coachId) return;
    const channel = supabase
      .channel(`coach-tab-badge-${coachId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `coach_id=eq.${coachId}` },
        () => contarPendientes(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [coachId, contarPendientes]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`coach-chats-badge-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        () => refreshUnread())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'salas' },
        () => refreshUnread())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, refreshUnread]);

  // Orden sin cambios: Inicio → Reservas → Personas → Recursos.
  // 🔴 "Chats" pasó a "Personas" (26/08/2026). No es solo el rótulo: la pantalla
  // dejó de listar conversaciones y pasa a listar gente, con las sesiones que
  // llevan juntos y cuándo fue la última. El coach no busca "una conversación",
  // busca a alguien — y esa lista no existía en ningún lado de la app.
  const tabs: IslandTab[] = [
    { name: 'index',    icon: 'calendar',        label: 'Inicio' },
    { name: 'reservas', icon: 'clipboard',       label: 'Reservas', dot: pendingCount > 0 },
    { name: 'chats',    icon: 'users',           label: 'Personas', dot: hasUnreadChats },
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
