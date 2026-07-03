import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ViveColors, ViveFonts, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { decryptMessage } from '@/lib/encryption';
import { AppBg } from '@/components/ui/AppBg';

// ─── Types ────────────────────────────────────────────────────────────────────
type ChatRoom = {
  salaId: string;
  userId: string;
  userName: string;
  initials: string;
  avatarUrl: string | null;
  lastMessage: string;
  lastMessageAt: string | null;
  hasUnread: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '??';
}

function formatMessageDate(isoString: string | null): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) {
    return ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()];
  }
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function CoachChatsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRooms = useCallback(async () => {
    if (!user) return;

    const { data: salas, error } = await supabase
      .from('salas')
      .select('id, user_id, coach_last_read_at')
      .eq('coach_id', user.id);

    if (error || !salas || salas.length === 0) {
      setRooms([]);
      setLoading(false);
      return;
    }

    const userIds = [...new Set(salas.map(s => s.user_id as string))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .in('id', userIds);

    const profileMap: Record<string, { name: string; avatarUrl: string | null }> = {};
    profiles?.forEach(p => { profileMap[p.id] = { name: p.name ?? 'Usuario', avatarUrl: p.avatar_url ?? null }; });

    const results = await Promise.all(
      salas.map(async (sala) => {
        const [{ data: lastMsg }, { data: lastForeign }] = await Promise.all([
          supabase
            .from('messages')
            .select('content, created_at')
            .eq('sala_id', sala.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          // último mensaje humano (no de sistema) que NO mandó el propio coach —
          // mismo criterio validado en CoachHomeScreen / checkDot de app/(tabs)/_layout.tsx
          supabase
            .from('messages')
            .select('created_at')
            .eq('sala_id', sala.id)
            .in('sender_type', ['user', 'coach'])
            .neq('sender_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        const readAt = sala.coach_last_read_at as string | null;
        const lastForeignAt = lastForeign?.created_at as string | undefined;
        const hasUnread = !!lastForeignAt && (!readAt || lastForeignAt > readAt);

        const name = profileMap[sala.user_id as string]?.name ?? 'Usuario';
        return {
          salaId: sala.id as string,
          userId: sala.user_id as string,
          userName: name,
          initials: getInitials(name),
          avatarUrl: profileMap[sala.user_id as string]?.avatarUrl ?? null,
          lastMessage: lastMsg ? decryptMessage(lastMsg.content as string) : '',
          lastMessageAt: lastMsg ? (lastMsg.created_at as string) : null,
          hasUnread,
        } satisfies ChatRoom;
      })
    );

    // Ordenar por último mensaje más reciente
    results.sort((a, b) => {
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    setRooms(results);
    setLoading(false);
  }, [user]);

  // Refresca cada vez que se vuelve a esta pestaña — sin esto, volver de un
  // chat recién leído dejaba el estado de "no leído" viejo hasta un remount
  // completo (mismo bug que ya arreglamos en CoachHomeScreen con pendingCount).
  useFocusEffect(
    useCallback(() => {
      loadRooms();
    }, [loadRooms])
  );

  return (
    <AppBg>
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Chats</Text>
      </View>

      {loading ? (
        <View style={s.loadingState}>
          <ActivityIndicator size="large" color={ViveColors.primary} />
        </View>
      ) : rooms.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyText}>Todavía no tenés conversaciones activas.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.container}
          showsVerticalScrollIndicator={false}>

          {rooms.map((room, idx) => (
            <TouchableOpacity
              key={room.salaId}
              style={[s.chatRow, idx < rooms.length - 1 && s.chatRowBorder]}
              onPress={() => router.push({
                pathname: '/sala',
                params: { sala_id: room.salaId },
              })}
              activeOpacity={0.75}>

              {room.avatarUrl ? (
                <Image source={{ uri: room.avatarUrl }} style={s.avatarImage} />
              ) : (
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{room.initials}</Text>
                </View>
              )}

              <View style={s.chatInfo}>
                <View style={s.chatTopRow}>
                  <Text style={[s.chatName, room.hasUnread && s.chatNameUnread]} numberOfLines={1}>
                    {room.userName}
                  </Text>
                  <View style={s.chatMetaRight}>
                    <Text style={s.chatDate}>{formatMessageDate(room.lastMessageAt)}</Text>
                    {room.hasUnread && <View style={s.unreadDot} />}
                  </View>
                </View>
                <Text style={[s.lastMessage, room.hasUnread && s.lastMessageUnread]} numberOfLines={1}>
                  {room.lastMessage || 'Sin mensajes aún'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          <View style={{ height: TAB_BAR_CLEARANCE }} />
        </ScrollView>
      )}
    </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 14,
  },
  title: {
    fontFamily: ViveFonts.semibold,
    fontSize: 26,
    color: '#565E32',
  },
  container: {
    paddingHorizontal: 0,
  },

  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: 'rgba(135,131,92,0.80)',
    textAlign: 'center',
    lineHeight: 24,
  },

  // Chat list
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: 'rgba(86,94,50,0.08)',
    gap: 14,
  },
  chatRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(86,94,50,0.10)',
  },

  // Avatar
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: `${ViveColors.accent}30`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: ViveFonts.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    flexShrink: 0,
  },

  // Info
  chatInfo: { flex: 1 },
  chatTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  chatName: {
    fontFamily: ViveFonts.medium,
    fontSize: 15,
    color: '#565E32',
    flexShrink: 1,
  },
  chatNameUnread: { fontFamily: ViveFonts.bold },
  chatMetaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  chatDate: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: 'rgba(135,131,92,0.72)',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E05252',
  },
  lastMessage: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#87835C',
  },
  lastMessageUnread: {
    fontFamily: ViveFonts.medium,
    color: '#565E32',
  },
});
