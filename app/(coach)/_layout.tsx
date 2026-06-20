import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { HapticTab } from '@/components/haptic-tab';
import { ViveColors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const TAB_INACTIVE = '#ABABAB';

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
      .eq('status', 'pending')
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
            .eq('status', 'pending')
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
        tabBarActiveTintColor: ViveColors.primary,
        tabBarInactiveTintColor: TAB_INACTIVE,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          shadowColor: '#1F4A43',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 8,
          height: 64,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: 'Poppins_500Medium',
          fontSize: 11,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color }) => <Feather name="calendar" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reservas"
        options={{
          title: 'Reservas',
          tabBarIcon: ({ color }) => (
            <View>
              <Feather name="clipboard" size={22} color={color} />
              <PendingBadge count={pendingCount} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color }) => <Feather name="message-circle" size={22} color={color} />,
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
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}

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
