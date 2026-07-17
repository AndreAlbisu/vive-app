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
import { Feather } from '@expo/vector-icons';
import { ViveFonts, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { decryptMessage } from '@/lib/encryption';
import { AppBg } from '@/components/ui/AppBg';
import { useUnreadSalas } from '@/hooks/useUnreadSalas';

// ── Paleta del mockup (docs/coach-app-interactivo.html) ──────────────────────
const CARD = '#F7F2E7';
const FOREST = '#3F512F';
const FOREST_SOFT = '#6B7A56';
const TERRA = '#C06B4A';
const LINE = 'rgba(63,81,47,0.14)';
const OK_BG = '#DCE5CB';
const OK_INK = '#42542F';
const RES_BG = '#EAD3C6';
const RES_INK = '#8F4A2E';

type Tag = 'accepted' | 'resource' | null;

type ChatRoom = {
  salaId: string;
  userName: string;
  initials: string;
  avatarUrl: string | null;
  tag: Tag;
  preview: string;
  lastMessageAt: string | null;
  hasUnread: boolean;
  archived: boolean;
};

type ResourceMeta = { type?: string; resource_title?: string; recommendation_id?: string };

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '??';
}

function formatMessageDate(isoString: string | null): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()];
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export default function CoachChatsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const { unreadSalaIds } = useUnreadSalas({ userId: user?.id ?? null, role: 'coach' });

  const loadRooms = useCallback(async () => {
    if (!user) return;

    const { data: salas, error } = await supabase
      .from('salas')
      .select('id, user_id, coach_last_read_at')
      .eq('coach_id', user.id);

    if (error || !salas || salas.length === 0) { setRooms([]); setLoading(false); return; }

    const userIds = [...new Set(salas.map(s => s.user_id as string))];
    const { data: profiles } = await supabase.from('profiles').select('id, name, avatar_url').in('id', userIds);
    const profileMap: Record<string, { name: string; avatarUrl: string | null }> = {};
    profiles?.forEach(p => { profileMap[p.id] = { name: p.name ?? 'Usuario', avatarUrl: p.avatar_url ?? null }; });

    // Último mensaje de cada sala (content + tipo + metadata para los tags).
    const lasts = await Promise.all(
      salas.map(async (sala) => {
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('content, created_at, sender_type, metadata')
          .eq('sala_id', sala.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        return { salaId: sala.id as string, userId: sala.user_id as string, lastMsg };
      })
    );

    // Estado abierto/sin abrir de los recursos recomendados (batch por recommendation_id).
    const recIds = lasts
      .map(l => (l.lastMsg?.metadata as ResourceMeta | null)?.recommendation_id)
      .filter((x): x is string => !!x);
    const openedMap: Record<string, boolean> = {};
    if (recIds.length > 0) {
      const { data: recs } = await supabase.from('resource_recommendations').select('id, opened_at').in('id', recIds);
      (recs ?? []).forEach(r => { openedMap[r.id as string] = !!r.opened_at; });
    }

    const thirtyDaysAgo = Date.now() - 30 * 86400000;

    const results: ChatRoom[] = lasts.map(l => {
      const name = profileMap[l.userId]?.name ?? 'Usuario';
      const m = l.lastMsg;
      const meta = (m?.metadata as ResourceMeta | null) ?? null;
      const senderType = (m?.sender_type as string) ?? '';
      const at = m ? (m.created_at as string) : null;

      let tag: Tag = null;
      let preview = '';
      if (meta?.type === 'resource') {
        tag = 'resource';
        const opened = meta.recommendation_id ? openedMap[meta.recommendation_id] : false;
        preview = `Vos: ${meta.resource_title ?? 'recurso'} · ${opened ? 'abierto ✓' : 'sin abrir'}`;
      } else if (senderType === 'system_confirmed') {
        tag = 'accepted';
        // El content es "Sesión reservada · fecha · hora\n{motivo}". Mostramos el motivo si hay.
        const decoded = m ? decryptMessage(m.content as string) : '';
        const motivo = decoded.split('\n')[1]?.trim();
        preview = motivo ? `«${motivo}»` : 'Sesión aceptada';
      } else {
        preview = m ? decryptMessage(m.content as string) : 'Sin mensajes aún';
      }

      // Archivado: última actividad de solo sistema (cancelación/aviso) y vieja (>30d).
      const archived = (senderType === 'system' || senderType === 'system_cancelled')
        && !!at && new Date(at).getTime() < thirtyDaysAgo;

      return {
        salaId: l.salaId,
        userName: name,
        initials: getInitials(name),
        avatarUrl: profileMap[l.userId]?.avatarUrl ?? null,
        tag,
        preview,
        lastMessageAt: at,
        hasUnread: unreadSalaIds.has(l.salaId),
        archived,
      };
    });

    results.sort((a, b) => {
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    setRooms(results);
    setLoading(false);
  }, [user, unreadSalaIds]);

  useFocusEffect(useCallback(() => { loadRooms(); }, [loadRooms]));

  const active = rooms.filter(r => !r.archived);
  const archived = rooms.filter(r => r.archived);

  function renderRoom(room: ChatRoom, dimmed?: boolean) {
    return (
      <TouchableOpacity
        key={room.salaId}
        style={[s.chat, dimmed && s.chatDimmed]}
        onPress={() => router.push({ pathname: '/sala', params: { sala_id: room.salaId } })}
        activeOpacity={0.8}>
        {room.avatarUrl ? (
          <Image source={{ uri: room.avatarUrl }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.avatarFallback]}><Text style={s.avatarTxt}>{room.initials}</Text></View>
        )}
        <View style={s.chatInfo}>
          <Text style={[s.chatName, room.hasUnread && s.chatNameUnread]} numberOfLines={1}>{room.userName}</Text>
          <View style={s.prev}>
            {room.tag === 'accepted' && <Text style={s.tagOk}>✓ SESIÓN ACEPTADA</Text>}
            {room.tag === 'resource' && <Text style={s.tagRes}>RECURSO</Text>}
            <Text style={[s.prevTxt, room.hasUnread && s.prevTxtUnread]} numberOfLines={1}>{room.preview}</Text>
          </View>
        </View>
        <View style={s.meta}>
          <Text style={s.metaTime}>{formatMessageDate(room.lastMessageAt)}</Text>
          {room.hasUnread && <View style={s.unread} />}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <AppBg>
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}><Text style={s.title}>Chats</Text></View>

        {loading ? (
          <View style={s.loadingState}><ActivityIndicator size="large" color={FOREST} /></View>
        ) : rooms.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyText}>
              Todavía no tenés conversaciones.{'\n\n'}Los chats se habilitan cuando aceptás una solicitud — el motivo del usuario queda como primer mensaje.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
            {active.map(r => renderRoom(r))}

            {archived.length > 0 && (
              <>
                <TouchableOpacity style={s.archLink} activeOpacity={0.7} onPress={() => setShowArchived(v => !v)}>
                  <Feather name={showArchived ? 'chevron-down' : 'chevron-right'} size={16} color={FOREST_SOFT} />
                  <Text style={s.archLinkTxt}>Archivados ({archived.length})</Text>
                </TouchableOpacity>
                {showArchived && archived.map(r => renderRoom(r, true))}
              </>
            )}

            <View style={{ height: TAB_BAR_CLEARANCE }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  title: { fontFamily: ViveFonts.frauncesSerif, fontSize: 28, color: FOREST },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyText: { fontFamily: ViveFonts.regular, fontSize: 14, color: FOREST_SOFT, textAlign: 'center', lineHeight: 21 },
  container: { paddingHorizontal: 20, paddingTop: 4 },

  chat: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 20,
    paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8,
  },
  chatDimmed: { opacity: 0.62 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(63,81,47,0.1)' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontFamily: ViveFonts.frauncesSerif, fontSize: 15, color: FOREST },
  chatInfo: { flex: 1, minWidth: 0 },
  chatName: { fontSize: 13.5, fontFamily: ViveFonts.semibold, color: FOREST },
  chatNameUnread: { fontFamily: ViveFonts.bold },
  prev: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  prevTxt: { flex: 1, fontSize: 11.5, color: FOREST_SOFT, fontFamily: ViveFonts.regular },
  prevTxtUnread: { color: FOREST, fontFamily: ViveFonts.medium },
  tagOk: { fontSize: 9, fontFamily: ViveFonts.bold, letterSpacing: 0.4, color: OK_INK, backgroundColor: OK_BG, borderRadius: 9, paddingVertical: 2, paddingHorizontal: 7, overflow: 'hidden' },
  tagRes: { fontSize: 9, fontFamily: ViveFonts.bold, letterSpacing: 0.4, color: RES_INK, backgroundColor: RES_BG, borderRadius: 9, paddingVertical: 2, paddingHorizontal: 7, overflow: 'hidden' },
  meta: { alignItems: 'flex-end', gap: 5, flexShrink: 0 },
  metaTime: { fontSize: 10, color: FOREST_SOFT, fontFamily: ViveFonts.regular },
  unread: { width: 10, height: 10, borderRadius: 5, backgroundColor: TERRA },

  archLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 4, marginTop: 4 },
  archLinkTxt: { fontSize: 12.5, fontFamily: ViveFonts.medium, color: FOREST_SOFT },
});
