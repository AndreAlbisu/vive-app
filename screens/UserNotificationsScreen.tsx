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

export default function UserNotificationsScreen() {
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

      supabase
        .from('notifications')
        .update({ read: true })
        .eq('recipient_id', user!.id)
        .eq('read', false)
        .then(() => {});
    }

    load();
  }, [user]);

  async function handlePress(n: Notif) {
    if (n.type === 'invitacion_review' && n.booking_id) {
      router.push({ pathname: '/review', params: { booking_id: n.booking_id } });
      return;
    }
    if (n.booking_id) {
      const { data } = await supabase
        .from('bookings')
        .select('sala_id')
        .eq('id', n.booking_id)
        .maybeSingle();
      if (data?.sala_id) {
        router.push({ pathname: '/sala', params: { sala_id: data.sala_id } });
      }
    }
  }

  function isTappable(n: Notif): boolean {
    return !!(n.booking_id);
  }

  function iconFor(type: string): keyof typeof Feather.glyphMap {
    switch (type) {
      case 'invitacion_review': return 'star';
      case 'reserva_confirmada': return 'check-circle';
      case 'reserva_rechazada': return 'x-circle';
      case 'reserva_cancelada': return 'x-circle';
      case 'recordatorio_sesion': return 'clock';
      default: return 'bell';
    }
  }

  function iconColorFor(type: string): string {
    switch (type) {
      case 'invitacion_review': return '#E8C547';
      case 'reserva_confirmada': return ViveColors.accent;
      case 'reserva_rechazada':
      case 'reserva_cancelada': return '#E05252';
      case 'recordatorio_sesion': return ViveColors.primary;
      default: return 'rgba(135,131,92,0.55)';
    }
  }

  return (
    <AppBg>
      <SafeAreaView style={s.safe} edges={['top']}>
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
            {notifs.map(n => (
              <TouchableOpacity
                key={n.id}
                style={[s.item, !n.read && s.itemUnread]}
                activeOpacity={isTappable(n) ? 0.7 : 1}
                onPress={() => isTappable(n) && handlePress(n)}
              >
                {!n.read && <View style={s.unreadBar} />}
                <View style={s.iconWrap}>
                  <Feather name={iconFor(n.type)} size={18} color={iconColorFor(n.type)} />
                </View>
                <View style={s.itemContent}>
                  <Text style={s.itemTitle}>{n.title}</Text>
                  <Text style={s.itemBody}>{n.body}</Text>
                  <Text style={s.itemTime}>{formatTimeAgo(n.created_at)}</Text>
                </View>
                {isTappable(n) && (
                  <Feather name="chevron-right" size={16} color="rgba(135,131,92,0.52)" style={s.chevron} />
                )}
              </TouchableOpacity>
            ))}
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
    backgroundColor: 'rgba(232,116,59,0.10)',
  },
  unreadBar: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: ViveColors.primary,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  iconWrap: {
    paddingLeft: 14,
    paddingRight: 4,
    width: 42,
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
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
