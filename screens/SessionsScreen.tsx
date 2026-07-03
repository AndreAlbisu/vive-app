import { useRef, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView as RNScrollView,
  Animated,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Calendar from 'expo-calendar';
import * as WebBrowser from 'expo-web-browser';
import { ViveColors, ViveFonts, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { decryptMessage } from '@/lib/encryption';
import { AppBg } from '@/components/ui/AppBg';

type SalaItem = {
  id: string;
  coach_id: string;
  otherName: string;
  otherInitials: string;
  otherAvatarUrl: string | null;
  otherSpecialty?: string;
  lastMessage: string;
  lastMessageDate: string;
  lastMessageRaw: string | null;
  hasUnread: boolean;
};

type NextSession = {
  bookingId: string;
  salaId: string;
  status: 'pendiente' | 'confirmada';
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number | null;
  meeting_url: string | null;
  coachName: string;
  coachInitials: string;
  coachAvatarUrl: string | null;
};

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '??';
}

function formatMessageDate(isoString: string): string {
  const d = new Date(isoString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d.getDay()];
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

function formatSalaDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const DAY = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const MON = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${DAY[d.getDay()]} ${day} ${MON[month - 1]}`;
}

function daysUntil(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  const target = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function isJoinable(dateStr: string, timeStr: string): boolean {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [h, m] = timeStr.split(':').map(Number);
  return Date.now() >= new Date(year, month - 1, day, h, m).getTime() - 10 * 60_000;
}

export default function SessionsScreen() {
  const router = useRouter();
  const { user, isLoggedIn, requestAuth } = useAuth();
  const [salas, setSalas] = useState<SalaItem[]>([]);
  const [nextSession, setNextSession] = useState<NextSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [joinable, setJoinable] = useState(false);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const listAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isLoggedIn) requestAuth();
  }, []);

  useEffect(() => {
    Animated.stagger(80, [
      Animated.timing(headerAnim, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.timing(listAnim, { toValue: 1, duration: 360, useNativeDriver: true }),
    ]).start();
  }, []);

  // Recompute joinable every 30s
  useEffect(() => {
    if (!nextSession || nextSession.status !== 'confirmada') { setJoinable(false); return; }
    const check = () => setJoinable(isJoinable(nextSession.scheduled_date, nextSession.scheduled_time));
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [nextSession]);

  const loadSalas = useCallback(async () => {
    if (!user) return;

    const todayStr = new Date().toISOString().split('T')[0];

    const [salasRes, nextBookingRes] = await Promise.all([
      supabase
        .from('salas')
        .select('id, user_id, coach_id, user_last_read_at, coach_last_read_at')
        .or(`user_id.eq.${user.id},coach_id.eq.${user.id}`),
      supabase
        .from('bookings')
        .select('id, sala_id, status, scheduled_date, scheduled_time, duration_minutes, meeting_url')
        .eq('user_id', user.id)
        .in('status', ['pendiente', 'confirmada'])
        .gte('scheduled_date', todayStr)
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    if (salasRes.error) console.error('[Sessions] Error cargando salas:', salasRes.error.message);

    const salasData = salasRes.data;
    if (!salasData || salasData.length === 0) {
      setSalas([]);
      setNextSession(null);
      setLoading(false);
      return;
    }

    const otherIds = salasData.map(s => s.user_id === user.id ? s.coach_id : s.user_id);
    const uniqueOtherIds = [...new Set(otherIds)];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .in('id', uniqueOtherIds);

    const profileMap: Record<string, { name: string; avatarUrl: string | null }> = {};
    profiles?.forEach(p => { profileMap[p.id] = { name: p.name ?? 'Usuario', avatarUrl: p.avatar_url ?? null }; });

    const uniqueCoachIds = [...new Set(salasData.map(s => s.coach_id))];
    const { data: coachRows } = await supabase
      .from('coaches')
      .select('profile_id, specialty')
      .in('profile_id', uniqueCoachIds);
    const specialtyMap: Record<string, string> = {};
    coachRows?.forEach(c => { if (c.specialty) specialtyMap[c.profile_id] = c.specialty; });

    const results: SalaItem[] = await Promise.all(
      salasData.map(async (sala) => {
        const isUserSide = sala.user_id === user.id;
        const otherId = isUserSide ? sala.coach_id : sala.user_id;
        const otherName = profileMap[otherId]?.name ?? 'Usuario';
        const userReadAt: string | null = isUserSide ? sala.user_last_read_at : sala.coach_last_read_at;

        const [{ data: lastMsg }, { data: lastForeign }] = await Promise.all([
          supabase
            .from('messages')
            .select('content, created_at')
            .eq('sala_id', sala.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          // último mensaje humano (no de sistema) que NO mandé yo mismo — un
          // mensaje propio no debe marcar la sala como no leída. Mismo criterio
          // validado en checkDot (app/(tabs)/_layout.tsx) y CoachChatsScreen.tsx.
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

        const lastForeignAt = lastForeign?.created_at as string | undefined;
        const hasUnread = !!lastForeignAt && (!userReadAt || lastForeignAt > userReadAt);

        return {
          id: sala.id,
          coach_id: sala.coach_id,
          otherName,
          otherInitials: getInitials(otherName),
          otherAvatarUrl: profileMap[otherId]?.avatarUrl ?? null,
          otherSpecialty: specialtyMap[sala.coach_id],
          lastMessage: lastMsg?.content ? decryptMessage(lastMsg.content) : '',
          lastMessageDate: lastMsg ? formatMessageDate(lastMsg.created_at) : '',
          lastMessageRaw: lastMsg?.created_at ?? null,
          hasUnread,
        };
      })
    );

    setSalas(results);

    // Build next session hero
    const nb = nextBookingRes.data;
    if (nb) {
      const nbSala = salasData.find(s => s.id === nb.sala_id);
      if (nbSala) {
        const coachProfileId = nbSala.coach_id;
        const coachProfile = profileMap[coachProfileId];
        setNextSession({
          bookingId: nb.id,
          salaId: nb.sala_id,
          status: nb.status as 'pendiente' | 'confirmada',
          scheduled_date: nb.scheduled_date,
          scheduled_time: nb.scheduled_time,
          duration_minutes: nb.duration_minutes ?? null,
          meeting_url: nb.meeting_url ?? null,
          coachName: coachProfile?.name ?? 'Tu coach',
          coachInitials: getInitials(coachProfile?.name ?? '?'),
          coachAvatarUrl: coachProfile?.avatarUrl ?? null,
        });
      }
    } else {
      setNextSession(null);
    }

    setLoading(false);
  }, [user]);

  // Refresca cada vez que se vuelve a esta pestaña — mismo bug que
  // encontramos en CoachHomeScreen/CoachChatsScreen: sin esto, volver de un
  // chat recién leído dejaba el estado de "no leído" viejo hasta un remount completo.
  useFocusEffect(
    useCallback(() => {
      loadSalas();
    }, [loadSalas])
  );

  async function handleJoinFromHero() {
    if (!nextSession?.meeting_url) return;
    await WebBrowser.openBrowserAsync(nextSession.meeting_url);
  }

  async function handleAddToCalendar() {
    if (!nextSession) return;
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Sin permiso', 'Necesitamos acceso al calendario para agregar la sesión.');
      return;
    }
    const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const writable = cals.find(c => c.allowsModifications);
    if (!writable) return;
    const [y, mo, d] = nextSession.scheduled_date.split('-').map(Number);
    const [h, mi] = nextSession.scheduled_time.split(':').map(Number);
    const startDate = new Date(y, mo - 1, d, h, mi, 0);
    const dur = nextSession.duration_minutes ?? 60;
    const endDate = new Date(startDate.getTime() + dur * 60_000);
    await Calendar.createEventAsync(writable.id, {
      title: `Sesión con ${nextSession.coachName} — Vive`,
      startDate,
      endDate,
      notes: nextSession.meeting_url ? `Videollamada: ${nextSession.meeting_url}` : undefined,
    });
    Alert.alert('Listo', 'La sesión fue agregada a tu calendario.');
  }

  return (
    <AppBg>
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Animated.View
        style={[
          styles.header,
          {
            opacity: headerAnim,
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
          },
        ]}
      >
        <Text style={styles.headerTitle}>Mis salas</Text>
      </Animated.View>

      <View style={styles.headerDivider} />

      {loading ? (
        <View style={styles.loadingState}>
          {/* skeleton placeholders */}
          <View style={styles.skeletonHero} />
          <View style={[styles.skeletonRow, { marginTop: 20 }]} />
          <View style={styles.skeletonRow} />
        </View>
      ) : (
        <RNScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: listAnim }}>

            {/* Hero — próxima sesión */}
            {nextSession && (
              <LinearGradient
                colors={['#42542F', '#354526']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
              >
                <View style={styles.heroTop}>
                  <Text style={styles.heroEyebrow}>TU PRÓXIMA SESIÓN</Text>
                  <View style={[
                    styles.heroStatusPill,
                    nextSession.status === 'confirmada' ? styles.heroStatusConfirmed : styles.heroStatusPending,
                  ]}>
                    <Text style={[
                      styles.heroStatusText,
                      nextSession.status === 'confirmada' ? styles.heroStatusTextConfirmed : null,
                    ]}>
                      {nextSession.status === 'confirmada' ? 'Confirmada' : 'Pendiente'}
                    </Text>
                  </View>
                </View>

                <View style={styles.heroBody}>
                  {nextSession.coachAvatarUrl ? (
                    <Image source={{ uri: nextSession.coachAvatarUrl }} style={styles.heroAvatar} />
                  ) : (
                    <View style={styles.heroAvatarPlaceholder}>
                      <Text style={styles.heroAvatarText}>{nextSession.coachInitials}</Text>
                    </View>
                  )}
                  <View style={styles.heroBodyText}>
                    <Text style={styles.heroDate}>
                      {formatSalaDate(nextSession.scheduled_date)} · {nextSession.scheduled_time.slice(0, 5)} hs
                    </Text>
                    <Text style={styles.heroSub}>
                      {(() => {
                        const days = daysUntil(nextSession.scheduled_date);
                        if (days === 0) return `Hoy con ${nextSession.coachName}`;
                        if (days === 1) return `Mañana con ${nextSession.coachName}`;
                        return `Con ${nextSession.coachName} · en ${days} días`;
                      })()}
                    </Text>
                  </View>
                </View>

                <View style={styles.heroActions}>
                  {nextSession.status === 'confirmada' ? (
                    <>
                      <TouchableOpacity
                        style={[styles.heroBtnPrimary, (!joinable || !nextSession.meeting_url) && styles.heroBtnPrimaryDisabled]}
                        onPress={handleJoinFromHero}
                        disabled={!joinable || !nextSession.meeting_url}
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons name="video" size={14} color="#F3EEDF" />
                        <Text style={styles.heroBtnPrimaryText}>Unirse a la llamada</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.heroBtnGhost} onPress={handleAddToCalendar} activeOpacity={0.75}>
                        <MaterialCommunityIcons name="calendar-plus" size={14} color="#F3EEDF" />
                        <Text style={styles.heroBtnGhostText}>Agendar</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={styles.heroBtnGhost}
                      onPress={() => router.push({ pathname: '/sala', params: { sala_id: nextSession.salaId } })}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.heroBtnGhostText}>Ver sala</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </LinearGradient>
            )}

            {/* Lista de salas */}
            {salas.length > 0 ? (
              <>
                {salas.map((sala, index) => (
                  <SalaRow
                    key={sala.id}
                    sala={sala}
                    onPress={() => router.push({ pathname: '/sala', params: { sala_id: sala.id } })}
                    delay={index * 60}
                  />
                ))}

                {/* CTA buscar profesionales */}
                <TouchableOpacity
                  style={styles.ctaCard}
                  onPress={() => router.push('/(tabs)/conexiones')}
                  activeOpacity={0.75}
                >
                  <MaterialCommunityIcons name="plus" size={16} color="rgba(86,94,50,0.55)" />
                  <View>
                    <Text style={styles.ctaTitle}>Buscar profesionales</Text>
                    <Text style={styles.ctaSub}>Explorá coaches y psicólogos en Conexiones</Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              <Animated.View style={styles.emptyState}>
                <MaterialCommunityIcons name="message-outline" size={52} color="rgba(135,131,92,0.45)" />
                <Text style={styles.emptyTitle}>Todavía no armaste tu sala</Text>
                <Text style={styles.emptySubtitle}>
                  Dale, animate a buscar la persona que te acompañe y arrancamos.{'\n'}
                  Acá vas a tener todo: chat, sesiones, seguimiento.
                </Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => router.push('/(tabs)/conexiones')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyBtnText}>Empezar a buscar</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

          </Animated.View>
        </RNScrollView>
      )}
    </SafeAreaView>
    </AppBg>
  );
}

function SalaRow({
  sala,
  onPress,
  delay,
}: {
  sala: SalaItem;
  onPress: () => void;
  delay: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 340, delay, useNativeDriver: true }).start();
  }, []);

  const preview = sala.lastMessage || 'Sin mensajes aún';

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      }}
    >
      <TouchableOpacity style={styles.sessionRow} onPress={onPress} activeOpacity={0.75}>
        <View style={styles.avatarWrap}>
          {sala.otherAvatarUrl ? (
            <Image source={{ uri: sala.otherAvatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{sala.otherInitials}</Text>
            </View>
          )}
        </View>

        <View style={styles.sessionInfo}>
          <View style={styles.sessionTopRow}>
            <Text style={[styles.coachName, sala.hasUnread && styles.coachNameUnread]} numberOfLines={1}>
              {sala.otherName}
            </Text>
            <View style={styles.metaRight}>
              {sala.lastMessageDate ? <Text style={styles.dateText}>{sala.lastMessageDate}</Text> : null}
              {sala.hasUnread && <View style={styles.unreadDot} />}
            </View>
          </View>
          {!!sala.otherSpecialty && (
            <Text style={styles.specialtyText} numberOfLines={1}>{sala.otherSpecialty}</Text>
          )}
          <Text style={[styles.lastMessage, sala.hasUnread && styles.lastMessageUnread]} numberOfLines={1}>
            {preview}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={styles.rowDivider} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,248,240,0.48)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(86,94,50,0.14)',
  },
  headerTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: '#565E32',
    textAlign: 'center',
  },
  headerDivider: { height: 1, backgroundColor: 'rgba(86,94,50,0.08)' },

  loadingState: { flex: 1, padding: 20, gap: 12 },
  skeletonHero: {
    height: 160,
    borderRadius: 22,
    backgroundColor: 'rgba(86,94,50,0.10)',
  },
  skeletonRow: {
    height: 72,
    borderRadius: 14,
    backgroundColor: 'rgba(86,94,50,0.07)',
  },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: 16, paddingBottom: TAB_BAR_CLEARANCE, paddingHorizontal: 16, gap: 0 },

  // Hero
  heroCard: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    overflow: 'hidden',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  heroEyebrow: {
    fontFamily: ViveFonts.semibold,
    fontSize: 10,
    letterSpacing: 0.9,
    color: '#C9CFAF',
    flex: 1,
  },
  heroStatusPill: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroStatusConfirmed: { backgroundColor: 'rgba(220,229,203,0.25)' },
  heroStatusPending: { backgroundColor: 'rgba(234,211,198,0.20)' },
  heroStatusText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 10.5,
    color: '#EAD3C6',
    letterSpacing: 0.3,
  },
  heroStatusTextConfirmed: { color: '#DCE5CB' },
  heroBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  heroAvatar: { width: 44, height: 44, borderRadius: 22 },
  heroAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ViveColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarText: { fontFamily: ViveFonts.bold, fontSize: 15, color: '#FFF6EC' },
  heroBodyText: { flex: 1, gap: 3 },
  heroDate: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 18,
    color: '#F3EEDF',
    lineHeight: 24,
  },
  heroSub: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: '#C9CFAF',
  },
  heroActions: { flexDirection: 'row', gap: 8 },
  heroBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: ViveColors.primary,
    borderRadius: 14,
    paddingVertical: 11,
  },
  heroBtnPrimaryDisabled: { opacity: 0.5 },
  heroBtnPrimaryText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: '#FFF6EC',
  },
  heroBtnGhost: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    paddingVertical: 11,
  },
  heroBtnGhostText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: '#F3EEDF',
  },

  // Sala row
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 14,
    gap: 14,
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: ViveColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: ViveFonts.bold,
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  avatarImage: { width: 50, height: 50, borderRadius: 25, flexShrink: 0 },
  sessionInfo: { flex: 1, gap: 2 },
  sessionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  metaRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  coachName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#565E32',
    flex: 1,
    marginRight: 8,
  },
  coachNameUnread: { fontFamily: ViveFonts.bold },
  dateText: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: 'rgba(135,131,92,0.72)',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ViveColors.primary,
  },
  specialtyText: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: ViveColors.primary,
    marginBottom: 1,
  },
  lastMessage: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#87835C',
    lineHeight: 18,
  },
  lastMessageUnread: { fontFamily: ViveFonts.medium, color: '#565E32' },
  rowDivider: {
    height: 1,
    backgroundColor: 'rgba(86,94,50,0.08)',
    marginLeft: 68,
  },

  // CTA
  ctaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(86,94,50,0.20)',
    borderRadius: 18,
    padding: 16,
    marginTop: 12,
  },
  ctaTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: '#565E32',
  },
  ctaSub: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: '#87835C',
    marginTop: 1,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: '#565E32',
    textAlign: 'center',
    marginTop: 16,
  },
  emptySubtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: '#87835C',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyBtn: {
    marginTop: 12,
    backgroundColor: ViveColors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  emptyBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#565E32',
  },
});
