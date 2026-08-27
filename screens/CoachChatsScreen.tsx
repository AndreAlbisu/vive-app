import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { ViveFonts, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { haceCuanto } from '@/lib/coachContinuity';
import { daysFromTodayAr, todayInAr } from '@/lib/time';
import { useAuth } from '@/context/AuthContext';
import { decryptMessage } from '@/lib/encryption';
import { AppBg } from '@/components/ui/AppBg';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
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
  /** 🔴 El estado de la RELACIÓN, no de la conversación. Esta pantalla listaba
   *  a las personas correctas —las salas nacen de una reserva— pero las
   *  mostraba solo como hilos de mensajes. El coach no piensa en conversaciones
   *  ni en reservas: piensa en personas, y de cada una quiere saber cuándo la
   *  vio por última vez y si tiene próxima. Eso no estaba en ningún lado de la
   *  app. */
  sesiones: number;
  ultimaIso: string | null;
  proximaIso: string | null;
};

type ResourceMeta = { type?: string; resource_title?: string; recommendation_id?: string };

/** Una línea con el estado de la relación. Vacía cuando no hay nada que decir
 *  —alguien que reservó y todavía no tuvo su primera sesión— porque inventar
 *  texto para llenar el renglón es exactamente lo que vuelve ilegible una lista. */
function textoRelacion(r: { sesiones: number; ultimaIso: string | null; proximaIso: string | null }): string {
  const partes: string[] = [];
  if (r.sesiones > 0) partes.push(r.sesiones === 1 ? '1 sesión' : `${r.sesiones} sesiones`);
  if (r.proximaIso) {
    const d = new Date(`${r.proximaIso}T12:00:00-03:00`);
    partes.push(`próxima ${d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`);
  } else if (r.ultimaIso) {
    partes.push(haceCuanto(-daysFromTodayAr(r.ultimaIso)).toLowerCase());
  }
  return partes.join(' · ');
}

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

  /** Archivar / desarchivar. Se escribe el valor EXPLÍCITO (true o false), no
   *  se vuelve a null: una vez que el coach opinó, su decisión manda sobre la
   *  regla automática para siempre. Volver a null sería "olvidate de lo que
   *  dije", que no es lo que pide ninguno de los dos botones. */
  const cambiarArchivado = useCallback(async (room: ChatRoom) => {
    const nuevo = !room.archived;
    // Optimista: la lista es la respuesta al toque, y esperar el round trip
    // para mover una fila se siente roto.
    setRooms(prev => prev.map(r => (r.salaId === room.salaId ? { ...r, archived: nuevo } : r)));

    const { error } = await supabase
      .from('salas')
      .update({ coach_archived: nuevo })
      .eq('id', room.salaId);

    if (error) {
      setRooms(prev => prev.map(r => (r.salaId === room.salaId ? { ...r, archived: !nuevo } : r)));
      Alert.alert('No se pudo archivar', 'Probá de nuevo en unos minutos');
    }
  }, []);

  function preguntarArchivar(room: ChatRoom) {
    Alert.alert(
      room.userName,
      room.archived
        ? 'Vuelve a tu lista de personas.'
        : 'Se guarda en Archivados. Si te escribe, te va a llegar igual — solo deja de aparecer arriba.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: room.archived ? 'Sacar de archivados' : 'Archivar',
          onPress: () => cambiarArchivado(room),
        },
      ],
    );
  }

  const loadRooms = useCallback(async () => {
    if (!user) return;

    const { data: salas, error } = await supabase
      .from('salas')
      .select('id, user_id, coach_last_read_at, coach_archived')
      .eq('coach_id', user.id);

    if (error || !salas || salas.length === 0) { setRooms([]); setLoading(false); return; }

    const userIds = [...new Set(salas.map(s => s.user_id as string))];

    // Ninguna de las dos depende de la otra — en paralelo (antes iban en
    // serie, y el último mensaje ya venía de un Promise.all con una query
    // por sala, N+1 que se sentía fuerte apenas la pantalla hacía lazy-mount).
    const [{ data: profiles }, { data: lastMsgsData }] = await Promise.all([
      supabase.from('profiles').select('id, name, avatar_url').in('id', userIds),
      supabase.rpc('get_last_messages_per_sala', { sala_ids: salas.map(s => s.id) }),
    ]);
    const profileMap: Record<string, { name: string; avatarUrl: string | null }> = {};
    profiles?.forEach(p => { profileMap[p.id] = { name: p.name ?? 'Usuario', avatarUrl: p.avatar_url ?? null }; });

    const lastMsgMap: Record<string, any> = {};
    (lastMsgsData ?? []).forEach((m: any) => { lastMsgMap[m.sala_id] = m; });
    const lasts = salas.map((sala) => ({
      salaId: sala.id as string,
      userId: sala.user_id as string,
      lastMsg: lastMsgMap[sala.id as string] ?? null,
      // `null` = el coach nunca opinó y manda la regla automática.
      decidido: (sala as { coach_archived?: boolean | null }).coach_archived ?? null,
    }));

    // Estado abierto/sin abrir de los recursos recomendados (batch por recommendation_id).
    const recIds = lasts
      .map(l => (l.lastMsg?.metadata as ResourceMeta | null)?.recommendation_id)
      .filter((x): x is string => !!x);
    const openedMap: Record<string, boolean> = {};
    if (recIds.length > 0) {
      const { data: recs } = await supabase.from('resource_recommendations').select('id, opened_at').in('id', recIds);
      (recs ?? []).forEach(r => { openedMap[r.id as string] = !!r.opened_at; });
    }

    // Estado de la relación con cada persona. Una sola consulta para todas:
    // ⚠️ `bookings.coach_id` es `coaches.id`, mientras que `salas.coach_id` es
    // `profiles.id` — dos ids con nombres parecidos, la trampa recurrente de
    // este proyecto. Hay que traducir antes de preguntar.
    const { data: coachRow } = await supabase
      .from('coaches').select('id').eq('profile_id', user.id).maybeSingle();

    const rel = new Map<string, { sesiones: number; ultimaIso: string | null; proximaIso: string | null }>();
    if (coachRow?.id) {
      const hoy = todayInAr();
      const { data: bks } = await supabase
        .from('bookings')
        .select('user_id, scheduled_date, status')
        .eq('coach_id', coachRow.id)
        .in('user_id', userIds);

      for (const b of bks ?? []) {
        const uid = b.user_id as string;
        const fecha = b.scheduled_date as string;
        const cur = rel.get(uid) ?? { sesiones: 0, ultimaIso: null, proximaIso: null };
        if (b.status === 'completada') {
          cur.sesiones += 1;
          if (!cur.ultimaIso || fecha > cur.ultimaIso) cur.ultimaIso = fecha;
        } else if ((b.status === 'confirmada' || b.status === 'pendiente') && fecha >= hoy) {
          // La más CERCANA de las futuras, no la última que llegó.
          if (!cur.proximaIso || fecha < cur.proximaIso) cur.proximaIso = fecha;
        }
        rel.set(uid, cur);
      }
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
      // Regla automática: la conversación terminó en un mensaje del sistema y
      // ya pasó un mes. Sirve para lo que murió solo.
      const porRegla = (senderType === 'system' || senderType === 'system_cancelled')
        && !!at && new Date(at).getTime() < thirtyDaysAgo;
      // 🔴 Lo que el coach decidió GANA, en las dos direcciones: archivar algo
      // vivo y rescatar algo que la regla se llevó. Por eso `decidido` es de
      // tres estados y no un booleano — con dos, "todavía no opinó" y "quiere
      // verlo activo" serían lo mismo y la regla no correría nunca.
      const archived = l.decidido ?? porRegla;

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
        sesiones: rel.get(l.userId)?.sesiones ?? 0,
        ultimaIso: rel.get(l.userId)?.ultimaIso ?? null,
        proximaIso: rel.get(l.userId)?.proximaIso ?? null,
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
        onLongPress={() => preguntarArchivar(room)}
        delayLongPress={350}
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
          {/* La relación en una línea. Se prioriza la PRÓXIMA sobre la última:
              lo primero que quiere saber un profesional al mirar un nombre es
              si ya lo tiene agendado. Recién si no, cuánto hace que no lo ve. */}
          <Text style={s.relTxt} numberOfLines={1}>{textoRelacion(room)}</Text>
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
        <View style={s.header}><Text style={s.title}>Tus personas</Text></View>

        {loading ? (
          <View style={s.loadingState}><ActivityIndicator size="large" color={FOREST} /></View>
        ) : rooms.length === 0 ? (
          // Estado vacío — spec `coach-estados-vacios.html`. A propósito NO
          // lleva checklist ni progreso: esta pantalla es un directorio de
          // gente atendida, y sin nadie atendido no hay contenido propio que
          // exista todavía. Esa preparación vive en Inicio (`CoachHomeScreen`)
          // — la línea de abajo apunta ahí, no la duplica.
          <View style={s.emptyWrap}>
            <SurfaceCard variant="elevated" tone="light" style={s.emptyCard}>
              <View style={s.emptyCardInner}>
                <View style={s.emptyIcon}>
                  <Feather name="users" size={21} color={FOREST} />
                </View>
                <Text style={s.emptyTitle}>Todavía no atendiste a nadie</Text>
                <Text style={s.emptyTxt}>
                  Cuando aceptes tu primera solicitud, esa persona aparece acá con sus sesiones, cuándo la viste por última vez y la conversación adentro.
                </Text>
              </View>
            </SurfaceCard>
            <View style={s.quietRow}>
              <View style={s.quietDot} />
              <Text style={s.quietTxt}>Tu preparación para recibir está en Inicio</Text>
            </View>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
            {active.map(r => renderRoom(r))}

            {/* El gesto no se adivina. Se dice una sola vez, al pie de la lista
                activa, y solo cuando hay algo que archivar. */}
            {active.length > 0 && (
              <Text style={s.hintArch}>Mantené presionada una persona para archivarla</Text>
            )}

            {archived.length > 0 && (
              <>
                <TouchableOpacity style={s.archLink} activeOpacity={0.7} onPress={() => setShowArchived(v => !v)}>
                  <Feather name={showArchived ? 'chevron-down' : 'chevron-right'} size={16} color={FOREST_SOFT} />
                  <Text style={s.archLinkTxt}>Archivados ({archived.length})</Text>
                  {/* 🔴 Archivar NO silencia. Si alguien archivado escribe, el
                      punto aparece acá: la conversación deja de estar arriba,
                      pero el coach no se pierde a un cliente que lo buscó. Se
                      eligió esto antes que desarchivar solo —como hace el mail—
                      porque deshacer una decisión del coach sin avisarle es
                      peor que un punto de más. */}
                  {archived.some(r => r.hasUnread) && <View style={s.archDot} />}
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
  // paddingTop: 20 — mismo ajuste y mismo motivo que CoachReservasScreen: sin
  // el paddingTop:12 del `container` que tienen Home/CoachResourcesScreen,
  // quedaba ~12pt más arriba que los otros títulos (hallazgo 27/08/2026).
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  title: { fontFamily: ViveFonts.title, fontSize: 28, color: FOREST },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { paddingHorizontal: 20, paddingTop: 4 },

  // Estado vacío (spec `coach-estados-vacios.html`) — mismo lenguaje que el
  // de Reservas (`CoachReservasScreen`): card elevada con ícono + línea
  // tranquila, sin importar contenido de otra pantalla.
  emptyWrap: { paddingHorizontal: 20, paddingTop: 18 },
  emptyCard: {},
  emptyCardInner: { padding: 20 },
  emptyIcon: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: '#DCE5CB',
    alignItems: 'center', justifyContent: 'center', marginBottom: 13,
  },
  emptyTitle: { fontFamily: ViveFonts.titleSemiBold, fontSize: 18, color: FOREST, lineHeight: 23 },
  emptyTxt: { fontSize: 12.5, color: FOREST_SOFT, lineHeight: 19, marginTop: 7, fontFamily: ViveFonts.regular },
  quietRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  quietDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#DCE5CB' },
  quietTxt: { fontSize: 12, color: FOREST_SOFT, fontFamily: ViveFonts.regular },

  chat: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 20,
    paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8,
  },
  chatDimmed: { opacity: 0.62 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(63,81,47,0.1)' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontFamily: ViveFonts.bold, fontSize: 15, color: FOREST },
  chatInfo: { flex: 1, minWidth: 0 },
  hintArch: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: FOREST_SOFT,
    opacity: 0.75,
    textAlign: 'center',
    marginTop: 14,
  },
  archDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: TERRA, marginLeft: 6 },

  relTxt: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: FOREST_SOFT,
    marginTop: 3,
  },
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
