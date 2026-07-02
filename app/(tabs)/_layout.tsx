import { useState, useEffect, useCallback } from 'react';
import { Tabs } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

import { HapticTab } from '@/components/haptic-tab';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const TAB_ACTIVE   = '#565E32';
const TAB_INACTIVE = '#87835C';
const DOT_RED      = '#E05252';

// Guardado para revertir Conexiones si hace falta (3 líneas en <Tabs.Screen name="conexiones">):
//   tabBarStyle: LIGHT_TAB_STYLE,
//   tabBarActiveTintColor: ViveColors.primary,
//   tabBarInactiveTintColor: `${ViveColors.text}66`,
// const LIGHT_TAB_STYLE: StyleProp<ViewStyle> = {
//   position: 'absolute',
//   backgroundColor: '#FFFFFF',
//   borderTopWidth: 1,
//   borderTopColor: 'rgba(0,0,0,0.08)',
//   ...Platform.select({
//     ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8 },
//     android: { elevation: 8 },
//   }),
//   height: 64,
//   paddingBottom: 10,
//   paddingTop: 6,
// };

// Queries: (1) salas con user_last_read_at, (2) mensajes de otros acotados por fecha,
// (3) sesión confirmada hoy — 2-3 total, nunca N+1
async function checkDot(userId: string, setHasDot: (v: boolean) => void) {
  const { data: salas } = await supabase
    .from('salas')
    .select('id, user_last_read_at')
    .eq('user_id', userId);

  if (!salas?.length) { setHasDot(false); return; }

  const salaIds = salas.map(s => s.id as string);

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

  const today = new Date().toISOString().split('T')[0];
  const { count } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'confirmada')
    .eq('scheduled_date', today);

  setHasDot((count ?? 0) > 0);
}

function TabIcon({ focused, color, label, children }: { focused: boolean; color: string; label: string; children: React.ReactNode }) {
  return (
    <View style={styles.tabItem}>
      {focused && <View style={styles.activeBubble} />}
      {children}
      <Text style={[styles.tabLabel, { color }]}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  const { user } = useAuth();
  const [hasDot, setHasDot] = useState(false);

  useEffect(() => {
    if (!user) { setHasDot(false); return; }

    checkDot(user.id, setHasDot);

    const channel = supabase
      .channel(`user-tab-dot-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        () => checkDot(user.id, setHasDot))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'salas' },
        () => checkDot(user.id, setHasDot))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' },
        () => checkDot(user.id, setHasDot))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Recalcula al volver a la sección de tabs (ej: salir de una sala recién
  // leída) — no depender solo de que el evento realtime de "salas" llegue,
  // que puede no dispararse si la tabla no tiene replicación habilitada.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      checkDot(user.id, setHasDot);
    }, [user?.id])
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: TAB_ACTIVE,
        tabBarInactiveTintColor: TAB_INACTIVE,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          <View style={styles.blurWrap}>
            <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
          </View>
        ),
        tabBarShowLabel: false,
        tabBarIconStyle: { width: '100%', height: 52, justifyContent: 'center', alignItems: 'center' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} label="Inicio">
              <Feather name="home" size={22} color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="mis-salas"
        options={{
          title: 'Mis salas',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} label="Mis salas">
              <View>
                <Feather name="message-square" size={22} color={color} />
                {hasDot && <View style={styles.notifDot} />}
              </View>
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="recursos"
        options={{
          title: 'Recursos',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} label="Recursos">
              <Feather name="book-open" size={22} color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="conexiones"
        options={{
          title: 'Conexiones',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} label="Conexiones">
              <Feather name="users" size={22} color={color} />
            </TabIcon>
          ),
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
  tabBar: {
    position: 'absolute',
    bottom: 24,
    left: 44,
    right: 44,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    overflow: 'hidden',
  },
  blurWrap: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    overflow: 'hidden',
  },
  tabItem: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  activeBubble: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    backgroundColor: 'rgba(86,94,50,0.12)',
  },
  tabLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    marginTop: 3,
  },
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
