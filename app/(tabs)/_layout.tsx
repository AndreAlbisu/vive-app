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
import { useUnreadSalas } from '@/hooks/useUnreadSalas';

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
  const [hasBookingToday, setHasBookingToday] = useState(false);
  const { hasAnyUnread, refresh: refreshUnread } = useUnreadSalas({ userId: user?.id ?? null, role: 'user' });
  const hasDot = hasAnyUnread || hasBookingToday;

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
          title: 'Mensajes',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} label="Mensajes">
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
