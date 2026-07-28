import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { AppBg } from '@/components/ui/AppBg';

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

const GLASS = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';

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
    <AppBg>
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color="#565E32" />
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
          <Feather name="bell-off" size={36} color="rgba(135,131,92,0.38)" />
          <Text style={s.emptyText}>No tenés notificaciones todavía</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {notifs.map(n => {
            const isProposal = n.type === 'propuesta_publicada' || n.type === 'propuesta_ajustes';
            const tappable = !!n.booking_id || isProposal;
            return (
              <TouchableOpacity
                key={n.id}
                style={[s.item, !n.read && s.itemUnread]}
                activeOpacity={tappable ? 0.7 : 1}
                onPress={() => {
                  if (isProposal) router.navigate('/resource-proposals');
                  else if (n.booking_id) router.navigate('/reservas');
                }}
              >
                {!n.read && <View style={s.unreadBar} />}
                <View style={s.itemContent}>
                  <Text style={s.itemTitle}>{n.title}</Text>
                  <Text style={s.itemBody}>{n.body}</Text>
                  <Text style={s.itemTime}>{formatTimeAgo(n.created_at)}</Text>
                </View>
                {tappable && (
                  <Feather name="chevron-right" size={16} color="rgba(135,131,92,0.52)" style={s.chevron} />
                )}
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,248,240,0.48)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(86,94,50,0.14)',
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: '#565E32',
    textAlign: 'center',
    marginRight: 30,
  },
  headerSpacer: { width: 30 },
  divider: { height: 1, backgroundColor: 'rgba(86,94,50,0.08)' },

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
    color: 'rgba(135,131,92,0.80)',
  },

  list: {
    paddingTop: 16,
    paddingHorizontal: 16,
    gap: 10,
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    overflow: 'hidden',
  },
  itemUnread: {
    backgroundColor: 'rgba(232,116,59,0.1)',
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
    color: '#565E32',
  },
  itemBody: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#87835C',
    lineHeight: 18,
  },
  itemTime: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: 'rgba(135,131,92,0.65)',
    marginTop: 2,
  },
  chevron: {
    marginRight: 14,
    flexShrink: 0,
  },
});
