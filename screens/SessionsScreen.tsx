import { useRef, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useUnreadSalas } from '@/hooks/useUnreadSalas';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView as RNScrollView,
  Animated,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Calendar from 'expo-calendar';
import * as WebBrowser from 'expo-web-browser';
import { getJoinUrl } from '@/lib/meetingRoom';
import { ViveColors, ViveFonts, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { decryptMessage } from '@/lib/encryption';
import { canCancelConfirmed } from '@/lib/bookingHelpers';
import { scheduledAtMs, daysFromTodayAr, localEquivalentLabel } from '@/lib/time';
import { cancelBookingFlow, refundMessage } from '@/lib/bookingCancel';
import { AppBg } from '@/components/ui/AppBg';
import { SurfaceCard } from '@/components/ui/SurfaceCard';

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

// La tarjeta ocupa el 86% del ancho DISPONIBLE (el de la pantalla menos el
// padding del scroll), no el de la pantalla. El 14% restante es lo que deja
// asomar la siguiente: sin ese asomo, un carrusel se lee como una tarjeta sola
// y nadie descubre que hay más — el gesto de deslizar no se le ocurre a quien
// no ve que haya algo del otro lado.
//
// El porcentaje va contra el ancho disponible y no contra el de la pantalla
// porque si no, el "86%" no significa nada: el padding se descuenta después y
// el asomo real termina siendo otro número, distinto en cada dispositivo.
const CARD_GAP = 12;
const H_PADDING = 16;   // tiene que seguir a `scrollContent.paddingHorizontal`
const CARD_FULL = Dimensions.get('window').width - H_PADDING * 2;
const CARD_W = Math.round(CARD_FULL * 0.86);

/**
 * Aire arriba de la lista de chats, y **solo cuando la lista es lo primero de la
 * pantalla** — sin banner de reembolso ni carrusel de sesiones arriba.
 *
 * 🔴 Sin esto la primera fila arrancaba a 76pt del borde del área segura (20 de
 * `header.paddingTop` + 40 de la línea del título + 16 de `marginBottom`), o sea
 * arriba del todo. Y la fila no es decoración: es el destino más tocado de la
 * pantalla, justo en la zona a la que el pulgar no llega sin recolocar la mano.
 *
 * Es condicional a propósito. Un `paddingTop` fijo también empujaría la lista
 * los días que hay una sesión próxima arriba —una tarjeta de ~200pt— y ahí el
 * problema no existe: solo se perderían filas visibles.
 *
 * Sale del alto de la pantalla y no de un número clavado, por lo mismo que
 * `lib/ejesLayout.ts`: 100pt son el 12% de un iPhone 14 y el 15% de un SE, que
 * no es el mismo gesto. El piso y el techo no los toca ningún teléfono real
 * (un SE pide 80, un 15 Pro Max 111); están para que una tablet no abra un
 * hueco absurdo.
 *
 * ⚠️ Se lee una sola vez al cargar el módulo: no se recalcula al rotar. Misma
 * limitación que `CARD_FULL` acá al lado y que `SCREEN_W` en `conexiones.tsx`.
 */
const AIRE_RATIO = 0.12;
const AIRE_MIN = 64;
const AIRE_MAX = 132;
const LISTA_AIRE = Math.round(
  Math.max(AIRE_MIN, Math.min(AIRE_MAX, Dimensions.get('window').height * AIRE_RATIO)),
);

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

/** Sufijo con la hora local del usuario, vacío si coincide con Argentina.
 *  Ver la nota de `tzSuffix` en SalaScreen: la hora argentina es la que manda,
 *  esto la traduce al costado. */
function tzSuffix(dateStr: string, timeStr: string): string {
  const label = localEquivalentLabel(dateStr, timeStr);
  return label ? ` · ${label}` : '';
}

// Días ARGENTINOS: la fecha está guardada en esa zona, así que contar con el
// día del dispositivo corre el resultado para quien no está en Argentina.
function daysUntil(dateStr: string): number {
  return daysFromTodayAr(dateStr);
}

function isJoinable(dateStr: string, timeStr: string): boolean {
  const startMs = scheduledAtMs(dateStr, timeStr);
  if (!Number.isFinite(startMs)) return false;
  return Date.now() >= startMs - 10 * 60_000;
}

export default function SessionsScreen() {
  const router = useRouter();
  const { user, isLoggedIn, requestAuth } = useAuth();
  const [salas, setSalas] = useState<SalaItem[]>([]);
  /** TODAS las sesiones próximas, en orden. Antes había una destacada y una
   *  lista aparte, y eso obligaba a cancelar en dos lugares distintos según
   *  cuál fuera. Ahora son todas iguales y se recorren de a una. */
  const [proximas, setProximas] = useState<(NextSession & { coachProfileId: string })[]>([]);
  const [indiceVisible, setIndiceVisible] = useState(0);
  const [refundPendiente, setRefundPendiente] = useState<{ id: string; monto: number | null } | null>(null);
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  /** Se re-renderiza cada 30s para que `isJoinable` se recalcule en cada
   *  tarjeta. Antes era un booleano único, atado a la sesión del hero. */
  const [, setTick] = useState(0);
  const [isAddingCalendar, setIsAddingCalendar] = useState(false);
  const { unreadSalaIds } = useUnreadSalas({ userId: user?.id ?? null, role: 'user' });

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

  // Un tick cada 30s: hace que cada tarjeta recalcule si su sesión ya se puede
  // unir, sin mantener un estado por sesión.
  useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  const loadSalas = useCallback(async () => {
    if (!user) return;

    const todayStr = new Date().toISOString().split('T')[0];

    const [salasRes, nextBookingRes, refundRes] = await Promise.all([
      supabase
        .from('salas')
        .select('id, user_id, coach_id, user_last_read_at, coach_last_read_at')
        .or(`user_id.eq.${user.id},coach_id.eq.${user.id}`),
      // 🔴 Antes: `.limit(1).maybeSingle()`. La app mostraba UNA sola sesión
      // próxima —la más cercana— en todas sus pantallas, así que la segunda
      // existía en la base, iba a ocurrir, y era invisible: no se podía ver, ni
      // agendar, ni cancelar hasta que pasara la primera.
      supabase
        .from('bookings')
        .select('id, sala_id, status, scheduled_date, scheduled_time, duration_minutes, meeting_url, coach_id, coach_name')
        .eq('user_id', user.id)
        .in('status', ['pendiente', 'confirmada'])
        .gte('scheduled_date', todayStr)
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true })
        .limit(20),
      // Reembolsos que esperan que la persona diga a dónde mandárselos. Sin
      // esto no se enteraría nunca: las canceladas no aparecen en ningún lado
      // de esta pantalla, y la plata quedaría esperando indefinidamente.
      supabase
        .from('bookings')
        .select('id, usdt_amount')
        .eq('user_id', user.id)
        .eq('payment_provider', 'usdt')
        .eq('payment_status', 'reembolso_pendiente')
        .is('refund_address', null)
        .limit(1)
        .maybeSingle(),
    ]);

    setRefundPendiente(

      refundRes?.data

        ? { id: refundRes.data.id, monto: refundRes.data.usdt_amount != null ? Number(refundRes.data.usdt_amount) : null }

        : null,

    );


    if (salasRes.error) console.error('[Sessions] Error cargando salas:', salasRes.error.message);

    const salasData = salasRes.data;
    if (!salasData || salasData.length === 0) {
      setSalas([]);
      setProximas([]);
      setLoading(false);
      return;
    }

    const otherIds = salasData.map(s => s.user_id === user.id ? s.coach_id : s.user_id);
    const uniqueOtherIds = [...new Set(otherIds)];
    const uniqueCoachIds = [...new Set(salasData.map(s => s.coach_id))];

    // Ninguna de estas tres depende del resultado de las otras — antes iban
    // en serie (profiles → coaches → último mensaje), cada round-trip suma
    // de lleno en una red móvil real. En paralelo.
    const [{ data: profiles }, { data: coachRows }, { data: lastMsgs }] = await Promise.all([
      supabase.from('profiles').select('id, name, avatar_url').in('id', uniqueOtherIds),
      supabase.from('coaches').select('profile_id, specialty').in('profile_id', uniqueCoachIds),
      supabase.rpc('get_last_messages_per_sala', { sala_ids: salasData.map(s => s.id) }),
    ]);

    const profileMap: Record<string, { name: string; avatarUrl: string | null }> = {};
    profiles?.forEach(p => { profileMap[p.id] = { name: p.name ?? 'Usuario', avatarUrl: p.avatar_url ?? null }; });

    const specialtyMap: Record<string, string> = {};
    coachRows?.forEach(c => { if (c.specialty) specialtyMap[c.profile_id] = c.specialty; });

    const lastMsgMap: Record<string, { content: string | null; created_at: string }> = {};
    (lastMsgs ?? []).forEach((m: any) => { lastMsgMap[m.sala_id] = m; });

    const results: SalaItem[] = salasData.map((sala) => {
      const isUserSide = sala.user_id === user.id;
      const otherId = isUserSide ? sala.coach_id : sala.user_id;
      const otherName = profileMap[otherId]?.name ?? 'Usuario';
      const lastMsg = lastMsgMap[sala.id as string];

      const hasUnread = unreadSalaIds.has(sala.id as string);

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
    });

    setSalas(results);

    // La primera va al hero; las demás a la lista de abajo. La misma consulta
    // alimenta las dos: antes se traía una sola y el resto no existía para nadie.
    const proximas = (nextBookingRes.data ?? [])
      .map(nb => {
        const nbSala = salasData.find(s => s.id === nb.sala_id);
        if (!nbSala) return null;
        const coachProfile = profileMap[nbSala.coach_id];
        return {
          bookingId: nb.id,
          salaId: nb.sala_id,
          status: nb.status as 'pendiente' | 'confirmada',
          scheduled_date: nb.scheduled_date,
          scheduled_time: nb.scheduled_time,
          duration_minutes: nb.duration_minutes ?? null,
          meeting_url: nb.meeting_url ?? null,
          coachName: coachProfile?.name ?? nb.coach_name ?? 'Tu profesional',
          coachInitials: getInitials(coachProfile?.name ?? nb.coach_name ?? '?'),
          coachAvatarUrl: coachProfile?.avatarUrl ?? null,
          coachProfileId: nbSala.coach_id as string,
        };
      })
      .filter(Boolean) as (NextSession & { coachProfileId: string })[];

    setProximas(proximas);

    setLoading(false);
  }, [user, unreadSalaIds]);

  async function cancelarProxima(ses: NextSession & { coachProfileId: string }) {
    if (!user || cancelandoId) return;

    // Misma regla que en la sala: confirmada solo con 24hs. No se duplica el
    // criterio — sale de `canCancelConfirmed`, que es la única fuente.
    if (ses.status === 'confirmada' && !canCancelConfirmed(ses.scheduled_date, ses.scheduled_time)) {
      Alert.alert('No se puede cancelar', 'Las sesiones confirmadas solo se pueden cancelar con al menos 24hs de anticipación');
      return;
    }

    const esSolicitud = ses.status === 'pendiente';
    Alert.alert(
      esSolicitud ? '¿Cancelar solicitud?' : '¿Cancelar sesión?',
      `${formatSalaDate(ses.scheduled_date)} · ${ses.scheduled_time.slice(0, 5)} hs con ${ses.coachName}`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            setCancelandoId(ses.bookingId);
            const res = await cancelBookingFlow({
              bookingId: ses.bookingId,
              salaId: ses.salaId,
              actorId: user.id,
              actorRole: 'usuario',
              recipientId: ses.coachProfileId,
              scheduledDate: ses.scheduled_date,
              scheduledTime: ses.scheduled_time,
              fechaLegible: formatSalaDate(ses.scheduled_date),
            });
            setCancelandoId(null);
            if (!res.ok) { Alert.alert('No se pudo cancelar', res.error); return; }
            const msg = refundMessage(res.refund);
            Alert.alert(msg.title, msg.body);
            void loadSalas();
          },
        },
      ],
    );
  }

  // Refresca cada vez que se vuelve a esta pestaña — mismo bug que
  // encontramos en CoachHomeScreen/CoachChatsScreen: sin esto, volver de un
  // chat recién leído dejaba el estado de "no leído" viejo hasta un remount completo.
  useFocusEffect(
    useCallback(() => {
      loadSalas();
    }, [loadSalas])
  );

  async function handleJoin(ses: NextSession) {
    // 🔴 `ses.meeting_url` dice que la sala EXISTE, no abre la puerta: es
    // privada y hace falta un token por participante que vence con la sesión.
    // Hasta el 28/08/2026 esta pantalla abría la URL pelada — el mismo bug que
    // tenía `SalaScreen`, en un segundo lugar.
    if (!ses.meeting_url) return;
    const url = await getJoinUrl(ses.bookingId);
    if (url) {
      await WebBrowser.openBrowserAsync(url);
    } else {
      Alert.alert('Error', 'No se pudo preparar la sala. Intentalo de nuevo en unos segundos');
    }
  }

  async function handleAddToCalendar(ses: NextSession) {
    if (isAddingCalendar) return;  // corta el doble-tap
    setIsAddingCalendar(true);
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Sin permiso', 'Necesitamos acceso al calendario para agregar la sesión');
        return;
      }
      const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const writable = cals.find(c => c.allowsModifications);
      if (!writable) return;
      // Instante absoluto: el calendario del sistema no sabe de la convención
      // "esto está en hora argentina".
      const startDate = new Date(scheduledAtMs(ses.scheduled_date, ses.scheduled_time));
      const dur = ses.duration_minutes ?? 60;
      const endDate = new Date(startDate.getTime() + dur * 60_000);
      const title = `Sesión con ${ses.coachName} — Vita`;

      // Evitar duplicados: si ya existe un evento igual en ese rango, no re-agregar.
      const existing = await Calendar.getEventsAsync([writable.id], startDate, endDate);
      const alreadyThere = existing.some(
        e => e.title === title && new Date(e.startDate).getTime() === startDate.getTime(),
      );
      if (alreadyThere) {
        Alert.alert('Ya agendada', 'Esta sesión ya está en tu calendario');
        return;
      }

      await Calendar.createEventAsync(writable.id, {
        title,
        startDate,
        endDate,
        // Ver la nota en `SalaScreen`: la URL de una sala privada no deja
        // entrar sin token, y un link que falla es peor que no ponerlo.
        notes: 'Entrá a la videollamada desde la app Vita, en tu sala con el profesional.',
      });
      Alert.alert('Listo', 'La sesión fue agregada a tu calendario');
    } finally {
      setIsAddingCalendar(false);
    }
  }

  // Si arriba de la lista ya hay algo (el banner de reembolso o el carrusel de
  // sesiones próximas), la primera fila no queda alta y no hace falta el aire.
  const hayContenidoArriba = !!refundPendiente || proximas.length > 0;

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
        <Text style={styles.headerTitle}>Mensajes</Text>
      </Animated.View>

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

            {/* Reembolso esperando dirección. Va ARRIBA de todo y no al final:
                es plata de la persona que no le podemos devolver hasta que nos
                diga adónde, y las reservas canceladas no aparecen en ninguna
                otra parte de la app. Si no lo ve acá, no se entera nunca. */}
            {refundPendiente && (
              <TouchableOpacity
                style={styles.refundBanner}
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: '/reembolso', params: { booking_id: refundPendiente.id } })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.refundTitle}>
                    {refundPendiente.monto != null
                      ? `Tenés ${refundPendiente.monto.toFixed(2)} USDT para recibir`
                      : 'Tenés una devolución pendiente'}
                  </Text>
                  <Text style={styles.refundDesc}>
                    Decinos a qué dirección mandártelos
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color="#8C4A31" />
              </TouchableOpacity>
            )}

            {/* Carrusel de sesiones próximas.
                Antes: una destacada arriba y una lista aparte abajo, lo que
                obligaba a cancelar en dos lugares distintos según cuál sesión
                fuera. Ahora todas son la misma tarjeta y se recorren.

                ⚠️ La tarjeta NO ocupa el ancho completo a propósito: la
                siguiente tiene que asomar. Un carrusel donde el segundo ítem
                cae justo afuera del borde se lee como una sola tarjeta, y nadie
                descubre que hay más. El contador de abajo refuerza lo mismo. */}
            {proximas.length > 0 && (
              <View style={styles.carruselWrap}>
                <RNScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  // Con una sola sesión no hay carrusel: la tarjeta ocupa todo
                  // el ancho. El asomo del 14% existe para anunciar que hay otra
                  // tarjeta — si no la hay, es un hueco a la derecha que se lee
                  // como un error de layout.
                  scrollEnabled={proximas.length > 1}
                  snapToInterval={CARD_W + CARD_GAP}
                  decelerationRate="fast"
                  contentContainerStyle={[
                    styles.carrusel,
                    proximas.length === 1 && { paddingRight: 0 },
                  ]}
                  onMomentumScrollEnd={e => {
                    setIndiceVisible(Math.round(e.nativeEvent.contentOffset.x / (CARD_W + CARD_GAP)));
                  }}
                >
                  {proximas.map(ses => {
                    const puedeUnirse = ses.status === 'confirmada'
                      && isJoinable(ses.scheduled_date, ses.scheduled_time)
                      && !!ses.meeting_url;
                    const dias = daysUntil(ses.scheduled_date);
                    return (
                      <SurfaceCard
                        key={ses.bookingId}
                        variant="elevated" tone="dark" backgroundColor="#3A4A28" borderRadius={22}
                        style={[styles.heroCardWrap, { width: proximas.length > 1 ? CARD_W : CARD_FULL }]}
                      >
                        <LinearGradient
                          colors={['#42542F', '#354526']}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                          style={styles.heroCard}
                        >
                          <View style={styles.heroTop}>
                            <Text style={styles.heroEyebrow}>
                              {dias === 0 ? 'HOY' : dias === 1 ? 'MAÑANA' : `EN ${dias} DÍAS`}
                            </Text>
                            <View style={[
                              styles.heroStatusPill,
                              ses.status === 'confirmada' ? styles.heroStatusConfirmed : styles.heroStatusPending,
                            ]}>
                              <Text style={[
                                styles.heroStatusText,
                                ses.status === 'confirmada' ? styles.heroStatusTextConfirmed : null,
                              ]}>
                                {ses.status === 'confirmada' ? 'Confirmada' : 'Pendiente'}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.heroBody}>
                            {ses.coachAvatarUrl ? (
                              <Image source={{ uri: ses.coachAvatarUrl }} style={styles.heroAvatar} />
                            ) : (
                              <View style={styles.heroAvatarPlaceholder}>
                                <Text style={styles.heroAvatarText}>{ses.coachInitials}</Text>
                              </View>
                            )}
                            <View style={styles.heroBodyText}>
                              <Text style={styles.heroDate}>
                                {formatSalaDate(ses.scheduled_date)} · {ses.scheduled_time.slice(0, 5)} hs{tzSuffix(ses.scheduled_date, ses.scheduled_time)}
                              </Text>
                              <Text style={styles.heroSub}>Con {ses.coachName}</Text>
                            </View>
                          </View>

                          <View style={styles.heroActions}>
                            {ses.status === 'confirmada' ? (
                              <>
                                <TouchableOpacity
                                  style={[styles.heroBtnPrimary, !puedeUnirse && styles.heroBtnPrimaryDisabled]}
                                  onPress={() => handleJoin(ses)}
                                  disabled={!puedeUnirse}
                                  activeOpacity={0.8}
                                >
                                  <MaterialCommunityIcons name="video" size={14} color="#F3EEDF" />
                                  <Text style={styles.heroBtnPrimaryText}>Unirse</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.heroBtnGhost}
                                  onPress={() => handleAddToCalendar(ses)}
                                  disabled={isAddingCalendar}
                                  activeOpacity={0.75}
                                >
                                  <MaterialCommunityIcons name="calendar-plus" size={14} color="#F3EEDF" />
                                  <Text style={styles.heroBtnGhostText}>{isAddingCalendar ? '…' : 'Agendar'}</Text>
                                </TouchableOpacity>
                              </>
                            ) : (
                              <TouchableOpacity
                                style={styles.heroBtnGhost}
                                onPress={() => router.push({ pathname: '/sala', params: { sala_id: ses.salaId } })}
                                activeOpacity={0.75}
                              >
                                <Text style={styles.heroBtnGhostText}>Ver sala</Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity
                              style={styles.heroBtnGhost}
                              onPress={() => cancelarProxima(ses)}
                              disabled={cancelandoId === ses.bookingId}
                              activeOpacity={0.75}
                            >
                              <Text style={styles.heroBtnGhostText}>
                                {cancelandoId === ses.bookingId ? 'Cancelando…' : 'Cancelar'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </LinearGradient>
                      </SurfaceCard>
                    );
                  })}
                </RNScrollView>

                {proximas.length > 1 && (
                  <View style={styles.puntos}>
                    {proximas.map((ses, i) => (
                      <View
                        key={ses.bookingId}
                        style={[styles.punto, i === indiceVisible && styles.puntoActivo]}
                      />
                    ))}
                    <Text style={styles.contador}>
                      {indiceVisible + 1} de {proximas.length}
                    </Text>
                  </View>
                )}
              </View>
            )}


{/* Lista de salas.
                El aire de arriba solo aplica cuando no hay nada por encima —
                ver `LISTA_AIRE`: es para que la primera fila, que es lo más
                tocado de la pantalla, no quede fuera del alcance del pulgar. */}
            {salas.length > 0 ? (
              <View style={!hayContenidoArriba && styles.listaConAire}>
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
                    <Text style={styles.ctaSub}>Explorá coaches y psicólogos</Text>
                  </View>
                </TouchableOpacity>
              </View>
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
  carruselWrap: { marginBottom: 20 },
  carrusel: { gap: CARD_GAP, paddingRight: H_PADDING },
  puntos: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingHorizontal: 4 },
  punto: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(135,131,92,0.28)' },
  puntoActivo: { backgroundColor: ViveColors.primary, width: 16 },
  contador: { marginLeft: 6, fontFamily: ViveFonts.regular, fontSize: 11.5, color: 'rgba(135,131,92,0.75)' },

  proximasWrap: { marginBottom: 20, gap: 8 },
  proximasTitle: {
    fontFamily: ViveFonts.semibold, fontSize: 13, color: 'rgba(135,131,92,0.85)', marginBottom: 2,
  },
  proximaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,248,240,0.55)', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  proximaFecha: { fontFamily: ViveFonts.semibold, fontSize: 14, color: '#565E32' },
  proximaSub: { fontFamily: ViveFonts.regular, fontSize: 12, color: 'rgba(135,131,92,0.78)', marginTop: 2 },
  proximaCancel: { fontFamily: ViveFonts.medium, fontSize: 13, color: '#B5533A' },

  refundBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(214,150,120,0.18)', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16,
  },
  refundTitle: { fontFamily: ViveFonts.semibold, fontSize: 14.5, color: '#8C4A31' },
  refundDesc: { fontFamily: ViveFonts.regular, fontSize: 12.5, color: '#8C4A31', opacity: 0.85, marginTop: 2 },

  safeArea: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    marginBottom: 16,
  },
  headerTitle: {
    fontFamily: ViveFonts.title,
    fontSize: 34,
    color: '#3F512F',
    lineHeight: 40,
  },

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

  listaConAire: { paddingTop: LISTA_AIRE },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: 0, paddingBottom: TAB_BAR_CLEARANCE, paddingHorizontal: 16, gap: 0 },

  // Hero
  heroCardWrap: {
    marginBottom: 16,
  },
  heroCard: {
    padding: 18,
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
    fontFamily: ViveFonts.bold,
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
