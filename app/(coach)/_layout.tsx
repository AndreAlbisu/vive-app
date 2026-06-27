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

function TabIcon({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.iconWrap}>
      {focused && <View style={styles.activeBubble} />}
      {children}
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
          <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
        ),
        tabBarLabelStyle: {
          fontFamily: ViveFonts.medium,
          fontSize: 11,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
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
            <TabIcon focused={focused}>
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
            <TabIcon focused={focused}>
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
            <TabIcon focused={focused}>
              <Feather name="book-open" size={22} color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <Feather name="user" size={22} color={color} />
            </TabIcon>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    overflow: 'hidden',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 36,
  },
  activeBubble: {
    position: 'absolute',
    width: 52,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
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
