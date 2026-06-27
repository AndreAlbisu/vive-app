import React, { useState, useEffect, useCallback } from 'react';
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
  lastMessage: string;
  lastMessageAt: string | null;
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
      .select('id, user_id')
      .eq('coach_id', user.id);

    if (error || !salas || salas.length === 0) {
      setRooms([]);
      setLoading(false);
      return;
    }

    const userIds = [...new Set(salas.map(s => s.user_id as string))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', userIds);

    const profileMap: Record<string, string> = {};
    profiles?.forEach(p => { profileMap[p.id] = p.name ?? 'Usuario'; });

    const results = await Promise.all(
      salas.map(async (sala) => {
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('content, created_at')
          .eq('sala_id', sala.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const name = profileMap[sala.user_id as string] ?? 'Usuario';
        return {
          salaId: sala.id as string,
          userId: sala.user_id as string,
          userName: name,
          initials: getInitials(name),
          lastMessage: lastMsg ? decryptMessage(lastMsg.content as string) : '',
          lastMessageAt: lastMsg ? (lastMsg.created_at as string) : null,
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

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

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

              <View style={s.avatar}>
                <Text style={s.avatarText}>{room.initials}</Text>
              </View>

              <View style={s.chatInfo}>
                <View style={s.chatTopRow}>
                  <Text style={s.chatName}>{room.userName}</Text>
                  <Text style={s.chatDate}>{formatMessageDate(room.lastMessageAt)}</Text>
                </View>
                <Text style={s.lastMessage} numberOfLines={1}>
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
    color: '#FFFFFF',
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
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 24,
  },

  // Chat list
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    gap: 14,
  },
  chatRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
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
    color: '#FFFFFF',
  },
  chatDate: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  lastMessage: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
});
