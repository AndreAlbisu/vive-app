import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

type Notif = {
  id: string;
  type: string;
  booking_id: string | null;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
};

function formatTimeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffM = Math.floor(diffMs / (1000 * 60));
  if (diffM < 1) return 'hace unos segundos';
  if (diffM < 60) return `hace ${diffM} min`;
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return `hace ${diffH} ${diffH === 1 ? 'hora' : 'horas'}`;
  const diffD = Math.floor(diffH / 24);
  return `hace ${diffD} ${diffD === 1 ? 'día' : 'días'}`;
}

const cardShadow = Platform.select({
  ios: { shadowColor: ViveColors.text, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6 },
  android: { elevation: 1 },
});

export default function CoachNotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function load() {
      const { data } = await supabase
        .from('notifications')
        .select('id, type, booking_id, title, body, read, created_at')
        .eq('recipient_id', user!.id)
        .order('created_at', { ascending: false });

      setNotifs(data ?? []);
      setLoading(false);

      // Mark all unread as read in background — don't await, UI already captured read state
      supabase
        .from('notifications')
        .update({ read: true })
        .eq('recipient_id', user!.id)
        .eq('read', false)
        .then(() => {});
    }

    load();
  }, [user]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={ViveColors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Notificaciones</Text>
        <View style={s.headerSpacer} />
      </View>
      <View style={s.divider} />

      {loading ? (
        <View style={s.loadingState}>
          <ActivityIndicator size="large" color={ViveColors.primary} />
        </View>
      ) : notifs.length === 0 ? (
        <View style={s.emptyState}>
          <Feather name="bell-off" size={36} color={`${ViveColors.text}30`} />
          <Text style={s.emptyText}>No tenés notificaciones todavía.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {notifs.map(n => (
            <TouchableOpacity
              key={n.id}
              style={[s.item, !n.read && s.itemUnread]}
              activeOpacity={n.booking_id ? 0.7 : 1}
              onPress={() => { if (n.booking_id) router.navigate('/reservas'); }}
            >
              {!n.read && <View style={s.unreadBar} />}
              <View style={s.itemContent}>
                <Text style={s.itemTitle}>{n.title}</Text>
                <Text style={s.itemBody}>{n.body}</Text>
                <Text style={s.itemTime}>{formatTimeAgo(n.created_at)}</Text>
              </View>
              {n.booking_id && (
                <Feather name="chevron-right" size={16} color={`${ViveColors.text}40`} style={s.chevron} />
              )}
            </TouchableOpacity>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ViveColors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: ViveColors.text,
    textAlign: 'center',
    marginRight: 30,
  },
  headerSpacer: { width: 30 },
  divider: { height: 1, backgroundColor: `${ViveColors.text}0D` },

  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  emptyText: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: `${ViveColors.text}60`,
  },

  list: {
    paddingTop: 16,
    paddingHorizontal: 16,
    gap: 10,
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    ...cardShadow,
  },
  itemUnread: {
    backgroundColor: `${ViveColors.primary}08`,
  },
  unreadBar: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: ViveColors.primary,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  itemContent: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 4,
  },
  itemTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: ViveColors.text,
  },
  itemBody: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: `${ViveColors.text}80`,
    lineHeight: 18,
  },
  itemTime: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: `${ViveColors.text}50`,
    marginTop: 2,
  },
  chevron: {
    marginRight: 14,
    flexShrink: 0,
  },
});
