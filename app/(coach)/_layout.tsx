import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

import { HapticTab } from '@/components/haptic-tab';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const TAB_ACTIVE   = '#FFFFFF';
const TAB_INACTIVE = 'rgba(255,255,255,0.45)';

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

export default function CoachTabLayout() {
  const { user } = useAuth();
  const [coachId, setCoachId] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

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
              <Feather name="message-circle" size={22} color={color} />
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
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
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
});
