import { useState, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Platform, View, StyleSheet } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const TAB_ACTIVE   = '#FFFFFF';
const TAB_INACTIVE = 'rgba(255,255,255,0.45)';
const DOT_RED      = '#E05252';

// Estilo de tab bar para pantallas con fondo claro (no aurora)
const LIGHT_TAB_STYLE = {
  position: 'absolute' as const,
  backgroundColor: '#FFFFFF',
  borderTopWidth: 1,
  borderTopColor: 'rgba(0,0,0,0.08)',
  ...Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8 },
    android: { elevation: 8 },
  }),
  height: 64,
  paddingBottom: 10,
  paddingTop: 6,
};

// Queries: (1) salas con user_last_read_at, (2) mensajes de otros acotados por fecha,
// (3) sesión confirmada hoy — 2-3 total, nunca N+1
async function checkDot(userId: string, setHasDot: (v: boolean) => void) {
  const { data: salas } = await supabase
    .from('salas')
    .select('id, user_last_read_at')
    .eq('user_id', userId);

  if (!salas?.length) { setHasDot(false); return; }

  const salaIds = salas.map(s => s.id as string);

  // Calcular el mínimo last_read_at para acotar la query de mensajes
  let minLastRead: string | null = null;
  let anyNull = false;
  for (const s of salas) {
    if (!s.user_last_read_at) { anyNull = true; break; }
    const t = s.user_last_read_at as string;
    if (!minLastRead || t < minLastRead) minLastRead = t;
  }

  const msgsBase = supabase
    .from('messages')
    .select('sala_id, created_at')
    .in('sala_id', salaIds)
    .neq('sender_id', userId)
    .order('created_at', { ascending: false });

  const { data: foreignMsgs } = await (
    !anyNull && minLastRead ? msgsBase.gt('created_at', minLastRead) : msgsBase
  );

  // Primer mensaje de otros por sala (ya están en orden DESC → el primero es el más nuevo)
  const latestBySala: Record<string, string> = {};
  foreignMsgs?.forEach(msg => {
    const sid = msg.sala_id as string;
    if (!latestBySala[sid]) latestBySala[sid] = msg.created_at as string;
  });

  const hasUnread = salas.some(sala => {
    const latest = latestBySala[sala.id as string];
    if (!latest) return false;
    if (!sala.user_last_read_at) return true;
    return latest > (sala.user_last_read_at as string);
  });

  if (hasUnread) { setHasDot(true); return; }

  // Solo si no hay mensajes sin leer: chequear sesión confirmada hoy
  const today = new Date().toISOString().split('T')[0];
  const { count } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'confirmada')
    .eq('scheduled_date', today);

  setHasDot((count ?? 0) > 0);
}

export default function TabLayout() {
  const { user } = useAuth();
  const [hasDot, setHasDot] = useState(false);

  useEffect(() => {
    if (!user) { setHasDot(false); return; }

    checkDot(user.id, setHasDot);

    const channel = supabase
      .channel('user-tab-dot')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        () => checkDot(user.id, setHasDot))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'salas' },
        () => checkDot(user.id, setHasDot))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' },
        () => checkDot(user.id, setHasDot))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: TAB_ACTIVE,
        tabBarInactiveTintColor: TAB_INACTIVE,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'rgba(255,255,255,0.18)',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.35)',
          ...Platform.select({
            ios: { shadowColor: 'transparent' },
            android: { elevation: 0 },
          }),
          height: 64,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: ViveFonts.medium,
          fontSize: 11,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="mis-salas"
        options={{
          title: 'Mis salas',
          tabBarIcon: ({ color }) => (
            <View>
              <Feather name="message-square" size={22} color={color} />
              {hasDot && <View style={styles.notifDot} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="recursos"
        options={{
          title: 'Recursos',
          tabBarIcon: ({ color }) => <Feather name="book-open" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="conexiones"
        options={{
          title: 'Conexiones',
          tabBarIcon: ({ color }) => <Feather name="users" size={22} color={color} />,
          tabBarStyle: LIGHT_TAB_STYLE,
          tabBarActiveTintColor: ViveColors.primary,
          tabBarInactiveTintColor: `${ViveColors.text}66`,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Comunidad',
          tabBarIcon: ({ color }) => <Feather name="globe" size={22} color={color} />,
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  notifDot: {
    position: 'absolute',
    top: -3,
    right: -5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DOT_RED,
  },
});
