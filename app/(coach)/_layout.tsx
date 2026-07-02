import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

import { HapticTab } from '@/components/haptic-tab';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const TAB_ACTIVE   = '#565E32';
const TAB_INACTIVE = '#87835C';
// mismo rojo que DOT_RED en app/(tabs)/_layout.tsx — color reservado en la app para "no leído"
const UNREAD_RED   = '#E05252';

function TabIcon({ focused, color, label, children }: { focused: boolean; color: string; label: string; children: React.ReactNode }) {
  return (
    <View style={styles.tabItem}>
      {focused && <View style={styles.activeBubble} />}
      {children}
      <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function PendingBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <View style={badge.dot}>
      <Text style={badge.text}>{count > 9 ? '9+' : String(count)}</Text>
    </View>
  );
}

function UnreadDot() {
  return <View style={badge.unreadDot} />;
}

// Mismo criterio validado en CoachHomeScreen: un mensaje cuenta como no leído
// solo si es humano (user/coach, no system/system_confirmed/system_cancelled)
// y no lo mandó el propio coach. sender_type no siempre distingue bien coach
// de user (ver SalaScreen.tsx sendMessage) así que sender_id !== userId es lo
// que de verdad filtra "no es mío".
async function checkChatsUnread(userId: string, setHasUnread: (v: boolean) => void) {
  const { data: salas } = await supabase
    .from('salas')
    .select('id, coach_last_read_at')
    .eq('coach_id', userId);

  if (!salas?.length) { setHasUnread(false); return; }

  const salaIds = salas.map(s => s.id as string);

  const { data: messages } = await supabase
    .from('messages')
    .select('sala_id, sender_id, sender_type, created_at')
    .in('sala_id', salaIds)
    .order('created_at', { ascending: false });

  const isHuman = (t: string) => t === 'user' || t === 'coach';
  const latestForeignAtBySala: Record<string, string> = {};
  (messages ?? []).forEach(m => {
    if (!isHuman(m.sender_type as string)) return;
    if (m.sender_id === userId) return;
    const sid = m.sala_id as string;
    if (!latestForeignAtBySala[sid]) latestForeignAtBySala[sid] = m.created_at as string;
  });

  const hasUnread = salas.some(sala => {
    const latest = latestForeignAtBySala[sala.id as string];
    if (!latest) return false;
    if (!sala.coach_last_read_at) return true;
    return latest > (sala.coach_last_read_at as string);
  });

  setHasUnread(hasUnread);
}

export default function CoachTabLayout() {
  const { user } = useAuth();
  const [coachId, setCoachId] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [hasUnreadChats, setHasUnreadChats] = useState(false);

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
    if (!user) { setHasUnreadChats(false); return; }

    checkChatsUnread(user.id, setHasUnreadChats);

    const channel = supabase
      .channel(`coach-chats-badge-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        () => checkChatsUnread(user.id, setHasUnreadChats))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'salas' },
        () => checkChatsUnread(user.id, setHasUnreadChats))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Recalcula al volver a la sección de tabs (ej: salir de un chat recién
  // leído) — no depender solo de que el evento realtime de "salas" llegue,
  // mismo fix que en app/(tabs)/_layout.tsx del lado usuario.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      checkChatsUnread(user.id, setHasUnreadChats);
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
              <Feather name="calendar" size={22} color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="reservas"
        options={{
          title: 'Reservas',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} label="Reservas">
              <View>
                <Feather name="clipboard" size={22} color={color} />
                <PendingBadge count={pendingCount} />
              </View>
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} label="Chats">
              <View>
                <Feather name="message-circle" size={22} color={color} />
                {hasUnreadChats && <UnreadDot />}
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
        name="perfil"
        options={{
          title: 'Perfil',
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
    left: 56,
    right: 56,
    start: 56,
    end: 56,
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
    paddingHorizontal: 6,
  },
  activeBubble: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 26,
    backgroundColor: 'rgba(86,94,50,0.12)',
  },
  tabLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 10,
    marginTop: 3,
  },
});

const badge = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: -4,
    right: -7,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: ViveColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  text: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 9,
    color: '#FFFFFF',
    lineHeight: 12,
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: UNREAD_RED,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.75)',
  },
});
