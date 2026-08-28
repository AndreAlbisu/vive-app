import { useState, useEffect, useCallback } from 'react';
import { withLayoutContext } from 'expo-router';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useFocusEffect } from '@react-navigation/native';

import { IslandTabBar, type IslandTab } from '@/components/ui/IslandTabBar';
import { SofiaAssistant } from '@/components/SofiaAssistant';
import { SobreVosMomento } from '@/components/SobreVosMomento';
import { SobreVosMomentoProvider } from '@/context/SobreVosMomentoContext';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useUnreadSalas } from '@/hooks/useUnreadSalas';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// Material top tabs (en vez de bottom-tabs) para poder swipear entre pantallas
// — la isla sigue siendo el mismo tabBar custom, tabBarPosition la manda abajo.
// `useOnlyUserDefinedScreens=true` evita que rutas del grupo no declaradas acá
// (como `explore`, sin uso) se cuelen como páginas extra del pager.
const MaterialTopTabs = createMaterialTopTabNavigator();
const Tabs = withLayoutContext(MaterialTopTabs.Navigator, undefined, true);

async function checkBookingToday(userId: string, setHas: (v: boolean) => void) {
  const today = new Date().toISOString().split('T')[0];
  const { count } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'confirmada')
    .eq('scheduled_date', today);
  setHas((count ?? 0) > 0);
}

export default function TabLayout() {
  const { user } = useAuth();
  const [hasBookingToday, setHasBookingToday] = useState(false);
  const { hasAnyUnread, refresh: refreshUnread } = useUnreadSalas({ userId: user?.id ?? null, role: 'user' });
  const hasDot = hasAnyUnread || hasBookingToday;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!user) { setHasBookingToday(false); return; }

    checkBookingToday(user.id, setHasBookingToday);

    const channel = supabase
      .channel(`user-tab-dot-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        () => refreshUnread())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'salas' },
        () => refreshUnread())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' },
        () => checkBookingToday(user.id, setHasBookingToday))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, refreshUnread]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      checkBookingToday(user.id, setHasBookingToday);
    }, [user?.id])
  );

  // Orden nuevo (nav-isla-compacta v.C): Inicio → Profesionales → Recursos → Mensajes.
  // 📝 La ruta sigue siendo `conexiones` a propósito: renombrarla rompería los
  // deep links, el menú de Sofía y la clave del tooltip (`vive_tooltip_conexiones`),
  // que si cambia le vuelve a mostrar el tooltip a todo el que ya lo cerró.
  // Solo cambió el texto que se ve.
  const tabs: IslandTab[] = [
    { name: 'index',      icon: 'home',            label: 'Inicio' },
    { name: 'conexiones', icon: 'users',           label: 'Profesionales' },
    { name: 'recursos',   icon: 'book-open',       label: 'Recursos' },
    { name: 'mis-salas',  icon: 'message-square',  label: 'Mensajes', dot: hasDot },
  ];

  return (
    // El momento de "Sobre vos" (Parte C) se movió acá desde adentro de
    // index.tsx para poder sacarle el <Modal> propio (mismo motivo que
    // SofiaAssistant, ver context/SobreVosMomentoContext.tsx) — Inicio sigue
    // siendo dueño de CUÁNDO corresponde mostrarlo, solo que ahora lo pide
    // por contexto en vez de tenerlo montado en su propio árbol.
    <SobreVosMomentoProvider>
      <Tabs
        tabBarPosition="bottom"
        screenOptions={{ lazy: true, animationEnabled: !reducedMotion }}
        tabBar={(props) => <IslandTabBar {...props} tabs={tabs} />}>
        <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
        <Tabs.Screen name="conexiones" options={{ title: 'Profesionales' }} />
        <Tabs.Screen name="recursos" options={{ title: 'Recursos' }} />
        <Tabs.Screen name="mis-salas" options={{ title: 'Mensajes' }} />
      </Tabs>

      {/* Global a las 4 tabs principales, montado acá (no por pantalla) para
          que sea un solo elemento — no aparece en coach/admin/onboarding/auth,
          que viven en otros grupos de rutas. */}
      <SofiaAssistant />
      <SobreVosMomento />
    </SobreVosMomentoProvider>
  );
}
