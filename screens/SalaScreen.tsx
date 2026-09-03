import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Alert,
  AccessibilityInfo,
  ActivityIndicator,
  StatusBar,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Calendar from 'expo-calendar';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { FirstTimeTooltip } from '@/components/FirstTimeTooltip';
import { confirmBooking } from '@/lib/coachBookingActions';
import { encryptMessage, decryptMessage } from '@/lib/encryption';
import { supabase, registrarEvento } from '@/lib/supabase';
import { hasContactInfo } from '@/lib/contactInfoGuard';
import { useAuth } from '@/context/AuthContext';
import ReportSheet from '@/components/ReportSheet';
import UserActionsSheet from '@/components/UserActionsSheet';
import { areBlocked, loadBlockedIds } from '@/lib/blocking';
import SessionNotesSheet from '@/components/SessionNotesSheet';
import { getRelationshipNotes, type SessionNote } from '@/lib/sessionNotes';
import { AppBg } from '@/components/ui/AppBg';
import { sendPushNotification } from '@/lib/notifications';
import { canCancelConfirmed } from '@/lib/bookingHelpers';
import { scheduledAtMs, daysFromTodayAr, localEquivalentLabel } from '@/lib/time';
import { cancelBookingFlow, refundMessage } from '@/lib/bookingCancel';
import { logError } from '@/lib/logging';
import { ensureMeetingRoom, getJoinUrl } from '@/lib/meetingRoom';

type ResourceMeta = {
  type: 'resource';
  resource_id: string;
  resource_title: string;
  resource_format: string;
  recommendation_id?: string;
  note?: string;
};

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'coach';
  sender_type: 'user' | 'coach' | 'system' | 'system_confirmed' | 'system_cancelled';
  time: string;
  /** ISO crudo. `time` ya viene formateado y no sirve para ordenar: hace falta
   *  esto para intercalar las notas de sesión en el hilo. */
  createdAt: string;
  metadata?: ResourceMeta | null;
};

/** Un ítem del hilo: o un mensaje, o una nota de sesión. */
type TimelineItem =
  | { kind: 'msg'; at: string; msg: Message }
  | { kind: 'note'; at: string; note: SessionNote };

type CoachResource = {
  id: string;
  title: string;
  format: string;
  duration_seconds: number | null;
  topic_id: string;
};

type ActiveBooking = {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  status: 'pendiente' | 'confirmada' | 'completada';
  user_message: string | null;
  duration_minutes: number | null;
  meeting_url: string | null;
} | null;

type RecipientProfile = {
  name: string;
  specialty?: string;
  initials: string;
  avatarUrl: string | null;
};

type SessionState = 'none' | 'pendiente' | 'confirmada' | 'live' | 'finalizada';

function getSessionState(booking: ActiveBooking): SessionState {
  if (!booking) return 'none';
  if (booking.status === 'pendiente') return 'pendiente';
  if (booking.status === 'completada') {
    const endMs = scheduledAtMs(booking.scheduled_date, booking.scheduled_time)
      + ((booking.duration_minutes ?? 60) * 60_000);
    return Date.now() < endMs + 24 * 60 * 60_000 ? 'finalizada' : 'none';
  }
  if (booking.status === 'confirmada') {
    // 🔴 Con `new Date(y, mo-1, d, h, mi)` esto se calculaba en la zona del
    // dispositivo: desde afuera de Argentina la sala se "abría" corrida por la
    // diferencia de offset, y el countdown mentía por lo mismo.
    const startMs = scheduledAtMs(booking.scheduled_date, booking.scheduled_time);
    const endMs = startMs + ((booking.duration_minutes ?? 60) * 60_000);
    const now = Date.now();
    if (now < startMs - 10 * 60_000) return 'confirmada';   // sesión futura
    if (now <= endMs) return 'live';                        // por comenzar / en curso
    // La llamada ya terminó pero el cron (complete_confirmed_sessions) todavía no
    // marcó 'completada' — mostramos la tarjeta de reprogramar de una, sin esperar.
    return now < endMs + 24 * 60 * 60_000 ? 'finalizada' : 'none';
  }
  return 'none';
}

function formatSalaDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const DAY = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const MON = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${DAY[d.getDay()]} ${day} ${MON[month - 1]}`;
}

/** Sufijo con la hora local del usuario, o cadena vacía si está en la misma
 *  hora que Argentina. La hora que muestran las tarjetas es SIEMPRE la
 *  argentina, que es la que acordaron las dos partes; esto la traduce sin
 *  reemplazarla, para que las dos personas sigan hablando del mismo número. */
function tzSuffix(dateStr: string, timeStr: string): string {
  const label = localEquivalentLabel(dateStr, timeStr);
  return label ? ` · ${label}` : '';
}

function countdownText(dateStr: string, timeStr: string, durationMins: number | null): string {
  // "Hoy" y "Mañana" se cuentan en días ARGENTINOS, que es como está guardada la
  // fecha. Con el día del dispositivo, a la 01:00 en Madrid en Argentina todavía
  // es el día anterior y la tarjeta decía "Mañana" para una sesión de hoy.
  const days = daysFromTodayAr(dateStr);
  let dayText = days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `En ${days} días`;
  const dur = durationMins ? `${durationMins} min` : '60 min';
  return `${dayText} · ${dur} · videollamada`;
}

function nowTime() {
  return new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function rowToMessage(row: Record<string, unknown>, userId: string): Message {
  const senderType = (row.sender_type as string) ?? 'user';
  return {
    id: row.id as string,
    text: row.content as string,
    sender: (row.sender_id as string) === userId ? 'user' : 'coach',
    sender_type: senderType as Message['sender_type'],
    time: hhmm(row.created_at as string),
    createdAt: row.created_at as string,
    metadata: (row.metadata as ResourceMeta | null) ?? null,
  };
}

function buildInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export default function SalaScreen() {
  const router = useRouter();
  const { sala_id: salaIdParam, coach_id, abrir_notas, notas_booking, draft } = useLocalSearchParams<{
    sala_id?: string; coach_id?: string; abrir_notas?: string; notas_booking?: string; draft?: string;
  }>();
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  // La tarjeta "Pedile una recomendación" (formato.tsx) abre la sala con un
  // borrador ya escrito (sin enviar); se siembra el input una vez al montar.
  const draftText = Array.isArray(draft) ? draft[0] : (draft ?? '');
  const [inputText, setInputText] = useState(draftText);
  const [salaId, setSalaId] = useState<string | null>(null);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [recipientIsCoach, setRecipientIsCoach] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  // Hay bloqueo entre los dos, en cualquier dirección (RPC `are_blocked`).
  const [pairBlocked, setPairBlocked] = useState(false);
  // De esos, el que puse yo (lo único que puedo deshacer desde acá).
  const [iBlockedThem, setIBlockedThem] = useState(false);
  // 🔴 Puede nacer abierta. El aviso de la Home ("cerrá la sesión de ayer")
  // tiene que caer EN la nota, no en el chat con la nota escondida detrás de
  // una pill del header: si el atajo deja al coach a un tap más de distancia,
  // el aviso pide algo que no facilita.
  const [notesOpen, setNotesOpen] = useState(abrir_notas === '1');
  const [notes, setNotes] = useState<SessionNote[]>([]);
  const [recipientProfile, setRecipientProfile] = useState<RecipientProfile | null>(null);
  const [activeBooking, setActiveBooking] = useState<ActiveBooking>(null);
  /**
   * Con qué sesión trabaja el sheet de notas.
   *
   * 🔴 `notas_booking` lo manda el inicio del coach, que sabe exactamente qué
   * reserva le falta cerrar. Sin ese parámetro la sala caía en `activeBooking`,
   * que se arma como `upcoming ?? endedActive ?? …` sobre reservas FUTURAS: con
   * la próxima sesión ya agendada, la nota se guardaba contra esa y la sesión
   * pasada quedaba sin cerrar, así que la card del inicio no se iba nunca.
   */
  const notesBookingId = (Array.isArray(notas_booking) ? notas_booking[0] : notas_booking)
    ?? activeBooking?.id
    ?? null;

  const [hasSessionHistory, setHasSessionHistory] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>('none');
  const [isCancelling, setIsCancelling] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isAddingCalendar, setIsAddingCalendar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // ── Recomendación de recursos (solo coach) ──────────────────────────────────
  const [coachInternalId, setCoachInternalId] = useState<string | null>(null);
  const [recoSheetOpen, setRecoSheetOpen] = useState(false);
  const [coachResources, setCoachResources] = useState<CoachResource[]>([]);
  const [selectedReco, setSelectedReco] = useState<CoachResource | null>(null);
  const [recoNote, setRecoNote] = useState('');
  const [sendingReco, setSendingReco] = useState(false);

  const messageAnims = useRef<Record<string, Animated.Value>>({});
  function getAnim(id: string, initialValue = 0): Animated.Value {
    if (!messageAnims.current[id]) {
      messageAnims.current[id] = new Animated.Value(initialValue);
    }
    return messageAnims.current[id];
  }

  const headerAnim = useRef(new Animated.Value(0)).current;
  const inputAnim  = useRef(new Animated.Value(0)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.timing(headerAnim, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.timing(inputAnim,  { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  // Pulse animation for live state
  useEffect(() => {
    if (sessionState !== 'live' || reduceMotion) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sessionState, reduceMotion]);

  // Load sala data
  // 🔴 Releer al VOLVER a la pantalla, no solo al montarla.
  //
  // Sin esto, la tarjeta de sesión se queda con lo que había cuando se abrió la
  // sala. Si mientras tanto se creó o se canceló una reserva, la tarjeta muestra
  // otra — y como cancelar se hace DESDE la tarjeta, se cancela la que ella diga.
  //
  // Pasó dos veces el 25/08/2026, la segunda con plata: canceló y reembolsó una
  // reserva paga que nadie quería tocar, y no se notó hasta horas después.
  const primerFoco = useRef(true);
  const [refreshKey, setRefreshKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      // El primer foco coincide con el montaje: dejarlo pasar duplicaría la carga.
      if (primerFoco.current) { primerFoco.current = false; return; }
      setRefreshKey(k => k + 1);
    }, []),
  );

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    if (!salaIdParam && !coach_id) { setLoading(false); return; }

    let mounted = true;

    async function init() {
      let id: string | null = null;
      let salaUserId: string | null = null;
      let salaCoachId: string | null = null;

      if (salaIdParam) {
        const { data: sala } = await supabase
          .from('salas')
          .select('id, user_id, coach_id')
          .eq('id', salaIdParam)
          .single();
        if (sala) {
          id = sala.id as string;
          salaUserId = sala.user_id as string;
          salaCoachId = sala.coach_id as string;
        }
      } else {
        const { data: existing } = await supabase
          .from('salas')
          .select('id, user_id, coach_id')
          .eq('user_id', user!.id)
          .eq('coach_id', coach_id!)
          .maybeSingle();

        if (existing) {
          id = existing.id as string;
          salaUserId = existing.user_id as string;
          salaCoachId = existing.coach_id as string;
        } else {
          const { data: created, error } = await supabase
            .from('salas')
            .insert({ user_id: user!.id, coach_id: coach_id! })
            .select('id, user_id, coach_id')
            .single();
          if (error) await logError('SalaScreen: crear sala failed', error);
          if (created) {
            id = (created as any).id;
            salaUserId = (created as any).user_id;
            salaCoachId = (created as any).coach_id;
          }
        }
      }

      if (!mounted || !id || !salaUserId || !salaCoachId) {
        if (mounted) setLoading(false);
        return;
      }

      const resolvedRecipientId = user!.id === salaUserId ? salaCoachId : salaUserId;
      const isRecipientCoach = user!.id === salaUserId;

      setSalaId(id);
      setRecipientId(resolvedRecipientId);
      setRecipientIsCoach(isRecipientCoach);

      // El bloqueo se consulta por RPC y no contra el cache propio porque acá
      // importan las dos direcciones: el lado bloqueado no tiene forma de verlo
      // en su propia lista (el RLS solo expone los bloqueos que uno hizo), y si
      // no lo supiéramos le dejaríamos escribir un mensaje que el trigger rebota.
      void areBlocked(user!.id, resolvedRecipientId).then(v => {
        if (mounted) setPairBlocked(v);
      });
      // Y por separado, si el bloqueo lo puse yo — es lo único que me habilita a
      // deshacerlo, y lo que decide si el aviso dice "bloqueaste a X" o el
      // texto neutro (a la persona bloqueada no se le informa que la bloquearon).
      void loadBlockedIds(user!.id).then(set => {
        if (mounted) setIBlockedThem(set.has(resolvedRecipientId));
      });

      const readField = isRecipientCoach ? 'user_last_read_at' : 'coach_last_read_at';
      supabase
        .from('salas')
        .update({ [readField]: new Date().toISOString() })
        .eq('id', id)
        .then(({ error }) => {
          if (error) {
            console.error('[SalaScreen] Error actualizando', readField, ':', error);
          }
        });

      const todayStr = new Date().toISOString().split('T')[0];
      const yesterdayStr = (() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0];
      })();

      const [profileResult, activeBookingRes, recentCompletedRes, sessionHistoryRes, msgsResult] = await Promise.all([
        supabase.from('profiles').select('name, avatar_url').eq('id', resolvedRecipientId).single(),
        supabase
          .from('bookings')
          .select('id, scheduled_date, scheduled_time, status, user_message, duration_minutes, meeting_url')
          .eq('sala_id', id)
          .in('status', ['pendiente', 'confirmada'])
          .gte('scheduled_date', todayStr)
          .order('scheduled_date', { ascending: true })
          .order('scheduled_time', { ascending: true })
          .limit(10),
        supabase
          .from('bookings')
          .select('id, scheduled_date, scheduled_time, status, user_message, duration_minutes, meeting_url')
          .eq('sala_id', id)
          .eq('status', 'completada')
          .gte('scheduled_date', yesterdayStr)
          .order('scheduled_date', { ascending: false })
          .order('scheduled_time', { ascending: false })
          .limit(1),
        // ¿ya hubo alguna sesión completada en esta sala? El chat solo se congela
        // antes de la primera sesión, no en cada solicitud nueva de un cliente recurrente.
        supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('sala_id', id)
          .eq('status', 'completada'),
        supabase
          .from('messages')
          .select('*')
          .eq('sala_id', id)
          .order('created_at', { ascending: true }),
      ]);

      if (!mounted) return;

      setHasSessionHistory((sessionHistoryRes.count ?? 0) > 0);

      const recipientName = (profileResult.data as any)?.name ?? '';
      const recipientAvatarUrl = (profileResult.data as any)?.avatar_url ?? null;
      let specialty: string | undefined;
      if (isRecipientCoach) {
        const { data: coachRow } = await supabase
          .from('coaches')
          .select('specialty')
          .eq('profile_id', resolvedRecipientId)
          .single();
        specialty = (coachRow as any)?.specialty;
      }

      if (mounted) {
        setRecipientProfile({
          name: recipientName,
          specialty,
          initials: recipientName ? buildInitials(recipientName) : '?',
          avatarUrl: recipientAvatarUrl,
        });

        // Entre las reservas pendiente/confirmada priorizamos la próxima sesión real
        // (pendiente / por comenzar / en curso). Solo si no hay ninguna vigente
        // mostramos la última que ya terminó hoy como tarjeta de reprogramar —
        // así una sesión pasada no tapa una futura ya reservada.
        const activeList = (activeBookingRes.data ?? []) as NonNullable<ActiveBooking>[];
        const upcoming = activeList.find(b => getSessionState(b) !== 'finalizada');
        const endedActive = [...activeList].reverse().find(b => getSessionState(b) === 'finalizada');
        const booking: ActiveBooking = upcoming ?? endedActive ?? (recentCompletedRes.data?.[0] as ActiveBooking) ?? null;
        const state = getSessionState(booking);
        setActiveBooking(booking);
        setSessionState(state);

        // Si la sesión está confirmada pero no tiene meeting_url, crear la sala en segundo plano.
        // No la creamos para una sesión que ya terminó (finalizada) — no tiene sentido.
        if (booking?.status === 'confirmada' && !booking.meeting_url && state !== 'finalizada') {
          setIsCreatingRoom(true);
          ensureMeetingRoom(booking.id).then(url => {
            if (url && mounted) {
              setActiveBooking(prev => prev ? { ...prev, meeting_url: url } : null);
            }
            if (mounted) setIsCreatingRoom(false);
          });
        }
      }

      if (msgsResult.error) await logError('SalaScreen: cargar mensajes failed', msgsResult.error);

      if (!mounted) return;
      const msgs = msgsResult.data;
      if (msgs && msgs.length > 0) {
        const mapped = (msgs as Record<string, unknown>[]).map(row => rowToMessage(row, user!.id));
        mapped.forEach(m => getAnim(m.id, 0));
        setMessages(mapped);
        requestAnimationFrame(() => {
          const anims = mapped.map(m =>
            Animated.timing(getAnim(m.id), { toValue: 1, duration: 350, useNativeDriver: true })
          );
          Animated.stagger(60, anims).start();
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 80);
        });
      }

      setLoading(false);
    }

    init();
    return () => { mounted = false; };
  }, [user?.id, salaIdParam, coach_id, refreshKey]);

  useEffect(() => {
    if (!user || recipientIsCoach) return;
    supabase.from('coaches').select('id').eq('profile_id', user.id).single()
      .then(({ data }) => { if (data) setCoachInternalId((data as any).id); });
  }, [user, recipientIsCoach]);

  // Realtime: mensajes nuevos
  useEffect(() => {
    if (!salaId || !user) return;

    // supabase.channel() devuelve el canal existente si ya hay uno con el mismo
    // topic (p.ej. si el cleanup de un montaje previo todavía no terminó de
    // sacarlo: removeChannel es async). Si ese canal ya está subscripto, .on()
    // tira "cannot add postgres_changes callbacks... after subscribe()".
    // Sufijo random => topic nuevo en cada montaje, nunca colisiona.
    const channel = supabase
      .channel(`sala:${salaId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `sala_id=eq.${salaId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const senderType = (row.sender_type as string) ?? 'user';
          const isSystem = senderType === 'system_confirmed' || senderType === 'system_cancelled' || senderType === 'system';
          if (!isSystem && (row.sender_id as string) === user.id) return;

          const msg = rowToMessage(row, user.id);
          getAnim(msg.id, 0);
          setMessages(prev => [...prev, msg]);
          Animated.timing(getAnim(msg.id), { toValue: 1, duration: 280, useNativeDriver: true }).start();
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [salaId, user?.id]);

  // Todas las notas de la relación, para los DOS roles. Se piden por par
  // (usuario, coach) y NO por `activeBooking`: atadas a la reserva activa, la
  // nota de la sesión pasada se iba del chat apenas se reservaba la siguiente.
  //
  // `asCoach` decide si vienen también las privadas. Del lado del usuario el RLS
  // ya las filtra; el flag está para que la consulta diga qué trae.
  const fetchNotes = useCallback(async () => {
    if (!user || !recipientId) { setNotes([]); return; }
    const rows = await getRelationshipNotes({
      userId:  recipientIsCoach ? user.id : recipientId,
      coachId: recipientIsCoach ? recipientId : user.id,
      asCoach: !recipientIsCoach,
    });
    setNotes(rows);
  }, [user, recipientId, recipientIsCoach]);

  useEffect(() => { void fetchNotes(); }, [fetchNotes]);

  // Mensajes y notas viven en tablas distintas y se muestran en un solo hilo.
  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [
      ...messages.map(m => ({ kind: 'msg' as const, at: m.createdAt, msg: m })),
      ...notes.map(n => ({ kind: 'note' as const, at: n.createdAt, note: n })),
    ];
    // ISO en UTC ordena bien como string y no construye un Date por comparación.
    items.sort((a, b) => a.at.localeCompare(b.at));
    return items;
  }, [messages, notes]);

  // Timer: recomputar sessionState cada 30s
  useEffect(() => {
    setSessionState(getSessionState(activeBooking));
    if (!activeBooking) return;
    const interval = setInterval(() => {
      setSessionState(getSessionState(activeBooking));
    }, 30_000);
    return () => clearInterval(interval);
  }, [activeBooking]);

  // — Handlers —

  async function handleJoin() {
    if (!activeBooking) return;

    // 🔴 `activeBooking.meeting_url` NO sirve para entrar, aunque esté cargada.
    // La sala es privada: hace falta un token, que es de una sola persona y
    // vence con la sesión. Por eso se pide siempre acá, en el momento, y lo que
    // vuelve se abre y se descarta — nunca se guarda en el estado.
    setIsCreatingRoom(true);
    const url = await getJoinUrl(activeBooking.id);
    setIsCreatingRoom(false);

    if (url) {
      await WebBrowser.openBrowserAsync(url);
    } else {
      Alert.alert('Error', 'No se pudo preparar la sala. Intentalo de nuevo en unos segundos');
    }
  }

  function handleReschedule() {
    // Solo el usuario reserva. El nombre de la función no lo dice, así que el
    // guard va acá y no solo en el render: con `recipientIsCoach` en false,
    // `recipientId` es el del usuario y esto armaría una reserva al revés.
    if (!recipientIsCoach || !recipientId || !recipientProfile) return;
    router.push({
      pathname: '/booking-calendar',
      params: {
        name: recipientProfile.name,
        specialty: recipientProfile.specialty ?? '',
        priceFrom: '',
        coachId: recipientId,
      },
    });
  }

  async function handleAddToCalendar() {
    if (!activeBooking || isAddingCalendar) return;  // corta el doble-tap
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
      // El evento va al calendario del sistema, que trabaja en instantes: si se
      // arma con componentes locales, alguien fuera de Argentina se agenda la
      // sesión a la hora equivocada.
      const startDate = new Date(scheduledAtMs(activeBooking.scheduled_date, activeBooking.scheduled_time));
      const dur = activeBooking.duration_minutes ?? 60;
      const endDate = new Date(startDate.getTime() + dur * 60_000);
      const title = `Sesión con ${recipientProfile?.name ?? 'profesional'} — Vita`;

      // Evitar duplicados: si ya existe un evento igual (mismo título y arranque)
      // en ese rango, no lo agregamos de nuevo (bug de tap repetido).
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
        // 🔴 Acá iba la URL de la sala, y desde que la sala es privada ese link
        // no deja entrar a nadie: sin token muestra permiso denegado. Un link
        // que falla al tocarlo es peor que no ponerlo, y el token no se puede
        // pegar acá — vence con la sesión y es de una sola persona.
        notes: 'Entrá a la videollamada desde la app Vita, en tu sala con el profesional.',
        location: 'App Vita',
      });
      Alert.alert('Listo ✓', 'La sesión fue agregada a tu calendario');
    } finally {
      setIsAddingCalendar(false);
    }
  }

  /**
   * Confirmar desde la sala, solo el coach.
   *
   * 🔴 Antes la tarjeta de "pendiente" le mostraba la solicitud y le daba una
   * sola acción: cancelar. Le enseñaba el problema y solo la salida mala —
   * confirmar vivía únicamente en Reservas. Reusa `confirmBooking`, que es la
   * misma función que usa `CoachReservasScreen`: además de cambiar el estado
   * avisa al usuario y limpia las reservas que competían por ese horario.
   */
  async function handleConfirmBooking() {
    if (!activeBooking || !user || recipientIsCoach || isConfirming) return;
    setIsConfirming(true);
    const ok = await confirmBooking(activeBooking.id, user.id);
    setIsConfirming(false);

    if (!ok) { Alert.alert('No se pudo confirmar', 'Probá de nuevo en un momento'); return; }

    // Local y no recarga: la pantalla ya actualiza así en otros lados, y el
    // estado se recalcula solo desde el booking.
    const confirmada = { ...activeBooking, status: 'confirmada' as const };
    setActiveBooking(confirmada);
    setSessionState(getSessionState(confirmada));
  }

  async function handleCancelBooking() {
    if (!activeBooking || !user) return;

    const soyCoach = !recipientIsCoach;

    if (!soyCoach && activeBooking.status === 'confirmada'
        && !canCancelConfirmed(activeBooking.scheduled_date, activeBooking.scheduled_time)) {
      Alert.alert('No se puede cancelar', 'Las sesiones confirmadas solo se pueden cancelar con al menos 24hs de anticipación');
      return;
    }

    const esSolicitud = activeBooking.status === 'pendiente';
    // 🔴 El cartel NOMBRA la sesión, con fecha y hora. Es la última barrera antes
    // de una acción irreversible que además dispara un reembolso: si la tarjeta
    // quedó vieja, acá se ve que no es la que se quería cancelar.
    const cual = `${formatSalaDate(activeBooking.scheduled_date)} · ${activeBooking.scheduled_time.slice(0, 5)} hs`;
    Alert.alert(
      esSolicitud ? '¿Cancelar solicitud?' : '¿Cancelar sesión?',
      esSolicitud
        ? `Vas a cancelar tu solicitud del ${cual}.`
        : `Vas a cancelar la sesión del ${cual}. No se puede deshacer.`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            setIsCancelling(true);
            // Todo el cuerpo —cancelar, dejar el mensaje de sistema, notificar—
            // vive en lib/bookingCancel.ts. Acá vivía duplicado en dos ramas
            // casi iguales, y al necesitarlo también en el carrusel de sesiones
            // se habría vuelto una tercera copia de la misma regla.
            const res = await cancelBookingFlow({
              bookingId: activeBooking.id,
              salaId,
              actorId: user.id,
              actorRole: soyCoach ? 'coach' : 'usuario',
              recipientId,
              scheduledDate: activeBooking.scheduled_date,
              scheduledTime: activeBooking.scheduled_time,
              fechaLegible: formatSalaDate(activeBooking.scheduled_date),
            });
            setIsCancelling(false);

            if (!res.ok) { Alert.alert('No se pudo cancelar', res.error); return; }

            // Al coach no se le habla de reembolso: no es su plata, y el texto
            // ("te devolvemos el total") sería directamente falso para él.
            if (!soyCoach) {
              const msg = refundMessage(res.refund);
              Alert.alert(msg.title, msg.body);
            }
            setActiveBooking(null);
            setSessionState('none');
          },
        },
      ],
    );
  }
  function handleHeaderPress() {
    if (!recipientProfile) return;
    router.push({
      pathname: '/profesional',
      params: {
        profileId: recipientId ?? '',
        name: recipientProfile.name,
        specialty: recipientProfile.specialty ?? '',
        rating: '',
        reviewCount: '',
        priceFrom: '',
      },
    });
  }

  async function openRecoSheet() {
    if (!coachInternalId) return;
    const { data } = await supabase
      .from('coach_resources')
      .select('id, title, format, duration_seconds, topic_id')
      .eq('coach_id', coachInternalId)
      .eq('status', 'published')
      .order('created_at', { ascending: false });
    setCoachResources((data as CoachResource[]) ?? []);
    setSelectedReco(null);
    setRecoNote('');
    setRecoSheetOpen(true);
  }

  async function sendRecommendation() {
    if (!selectedReco || !salaId || !user || !coachInternalId || !recipientId) return;
    setSendingReco(true);
    try {
      const { data: recoData, error: recoErr } = await supabase
        .from('resource_recommendations')
        .insert({
          resource_id: selectedReco.id,
          coach_id: coachInternalId,
          user_id: recipientId,
          room_id: salaId,
          note: recoNote.trim() || null,
        })
        .select('id')
        .single();

      if (recoErr || !recoData) throw recoErr;

      const meta: ResourceMeta = {
        type: 'resource',
        resource_id: selectedReco.id,
        resource_title: selectedReco.title,
        resource_format: selectedReco.format,
        recommendation_id: (recoData as any).id,
        note: recoNote.trim() || undefined,
      };

      const { data: msgData, error: msgErr } = await supabase
        .from('messages')
        .insert({
          sala_id: salaId,
          sender_id: user.id,
          content: encryptMessage('[Recurso recomendado]'),
          sender_type: 'coach',
          metadata: meta,
        })
        .select('id, content, sender_id, sender_type, created_at, metadata')
        .single();

      if (msgErr || !msgData) throw msgErr;

      const optimisticId = (msgData as any).id;
      getAnim(optimisticId, 0);
      setMessages(prev => [...prev, rowToMessage(msgData as any, user.id)]);
      Animated.timing(getAnim(optimisticId), { toValue: 1, duration: 280, useNativeDriver: true }).start();
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);

      setRecoSheetOpen(false);

      if (recipientId) {
        const { data: pushData } = await supabase.from('profiles').select('push_token').eq('id', recipientId).maybeSingle();
        if (pushData?.push_token) {
          await sendPushNotification(pushData.push_token, 'Recurso recomendado', selectedReco.title.slice(0, 60));
        }
      }
    } catch {
      Alert.alert('Error', 'No se pudo enviar la recomendación');
    } finally {
      setSendingReco(false);
    }
  }

  async function markRecoOpened(recommendationId: string) {
    await supabase
      .from('resource_recommendations')
      .update({ opened_at: new Date().toISOString() })
      .eq('id', recommendationId)
      .is('opened_at', null);
  }

  async function sendMessage() {
    const text = inputText.trim();
    if (!text || !salaId || !user) return;
    if (activeBooking?.status === 'pendiente') return;
    // Defensa en profundidad, igual que el chequeo de 'pendiente': el trigger
    // `trg_block_messages_between_blocked` es el que manda, esto solo evita el
    // viaje de ida y el mensaje optimista que después habría que sacar.
    if (pairBlocked) return;

    // Anti-fuga #5: si el mensaje parece traer datos de contacto o pago externo,
    // advertir antes de enviar (no se bloquea duro: en una charla hay más falsos
    // positivos que en la bio, y a veces es legítimo). Se registra el evento con el
    // desenlace para medir cuánto pasa y si la advertencia disuade.
    if (hasContactInfo(text)) {
      const role = isCurrentUserCoach ? 'coach' : 'user';
      Alert.alert(
        '¿Compartir datos de contacto?',
        'Por tu seguridad, mantené la conversación y los pagos dentro de VIVE. Si arreglás por fuera, perdés las protecciones de la app.',
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => registrarEvento('mensaje_contacto_detectado', { role, sent_anyway: false }) },
          {
            text: 'Enviar igual',
            style: 'destructive',
            onPress: () => { registrarEvento('mensaje_contacto_detectado', { role, sent_anyway: true }); doSendMessage(text); },
          },
        ],
      );
      return;
    }
    doSendMessage(text);
  }

  async function doSendMessage(text: string) {
    if (!salaId || !user) return;

    // ⚠️ `encryptMessage` ahora FALLA CERRADO (antes devolvía el texto plano
    // ante cualquier error y lo guardaba en claro sin avisar). Acá se atrapa
    // para que el mensaje no se pierda en silencio: si no se puede preparar, se
    // dice, con el mismo aviso que ya usa el error del insert.
    let encrypted: string;
    try {
      encrypted = encryptMessage(text);
    } catch {
      Alert.alert('Error', 'No se pudo enviar el mensaje');
      return;
    }
    const optimisticId = `opt_${Date.now()}`;
    const nowIso = new Date().toISOString();
    const optimistic: Message = {
      id: optimisticId, text: encrypted, sender: 'user', sender_type: 'user',
      time: nowTime(), createdAt: nowIso,
    };

    getAnim(optimisticId, 0);
    setMessages(prev => [...prev, optimistic]);
    setInputText('');
    Animated.timing(getAnim(optimisticId), { toValue: 1, duration: 280, useNativeDriver: true }).start();
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);

    const { error } = await supabase
      .from('messages')
      .insert({
        sala_id: salaId,
        sender_id: user.id,
        content: encrypted,
        sender_type: isCurrentUserCoach ? 'coach' : 'user',
      });

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      Alert.alert('Error', 'No se pudo enviar el mensaje');
      return;
    }

    if (recipientId) {
      const { data: recipientPushData } = await supabase
        .from('profiles').select('push_token').eq('id', recipientId).maybeSingle();
      if (recipientPushData?.push_token) {
        await sendPushNotification(recipientPushData.push_token, 'Nuevo mensaje', text.slice(0, 50));
      }
    }
  }

  const isCurrentUserCoach = !recipientIsCoach;
  const isChatFrozen = (activeBooking?.status === 'pendiente' && !hasSessionHistory) || pairBlocked;
  const canSend = inputText.trim().length > 0 && !!salaId && !!user && !isChatFrozen;
  const displayInitials = recipientProfile?.initials ?? '···';

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FirstTimeTooltip
        storageKey="vive_tooltip_sala"
        icon="message-outline"
        iconColor="#87835C"
        title="La Sala"
        description="Tu espacio de comunicación. Escribí mensajes y coordiná tus sesiones"
        delay={1000}
      />

      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: headerAnim,
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#565E32" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.coachInfo}
          activeOpacity={recipientIsCoach ? 0.7 : 1}
          onPress={recipientIsCoach ? handleHeaderPress : undefined}
        >
          <View style={styles.avatarWrap}>
            {recipientProfile?.avatarUrl ? (
              <Image source={{ uri: recipientProfile.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{displayInitials}</Text>
              </View>
            )}
          </View>
          <View>
            {recipientProfile ? (
              <>
                <Text style={styles.coachName}>{recipientProfile.name}</Text>
                {!!recipientProfile.specialty && (
                  <Text style={styles.coachSpecialty}>{recipientProfile.specialty}</Text>
                )}
              </>
            ) : (
              <>
                <View style={styles.skeletonName} />
                <View style={styles.skeletonSpecialty} />
              </>
            )}
          </View>
        </TouchableOpacity>

        {/* Re-reserva persistente: acceso fijo a reservar de nuevo con este coach,
            no solo en la ventana de 24hs de la card post-sesión. Solo del lado del
            usuario (recipientIsCoach = la otra parte es coach → puedo reservarle). */}
        {recipientIsCoach && recipientProfile && !pairBlocked && (
          <TouchableOpacity
            style={styles.rebookPill}
            onPress={handleReschedule}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
            <MaterialCommunityIcons name="calendar-plus" size={15} color="#3A4F2A" />
            <Text style={styles.rebookPillText}>Reservar</Text>
          </TouchableOpacity>
        )}

        {/* Notas de la sesión: solo el coach (recipientIsCoach false = la otra parte
            es el usuario), y si hay una sesión sobre la cual anotar. */}
        {!recipientIsCoach && notesBookingId && recipientProfile && (
          <TouchableOpacity
            style={styles.rebookPill}
            onPress={() => setNotesOpen(true)}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
            <MaterialCommunityIcons name="note-edit-outline" size={15} color="#3A4F2A" />
            <Text style={styles.rebookPillText}>Notas</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => setActionsOpen(true)}
          disabled={!recipientId}
          hitSlop={8}>
          <MaterialCommunityIcons name="dots-vertical" size={22} color="#565E32" />
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.headerDivider} />

      {/* Session card */}
      {sessionState === 'live' ? (
        <LinearGradient colors={['#42542F', '#354526']} style={styles.sessionCardLive}>
          <Text style={styles.liveTitle}>
            {(() => {
              const startMs = scheduledAtMs(activeBooking!.scheduled_date, activeBooking!.scheduled_time);
              return Date.now() < startMs ? 'Tu sesión está por comenzar' : 'Tu sesión está en curso';
            })()}
          </Text>
          <Text style={styles.liveSub}>
            {formatSalaDate(activeBooking!.scheduled_date)} · {activeBooking!.scheduled_time.slice(0, 5)} hs{tzSuffix(activeBooking!.scheduled_date, activeBooking!.scheduled_time)}
          </Text>
          <Animated.View style={{ transform: [{ scale: pulseAnim }], marginTop: 12 }}>
            <TouchableOpacity
              style={styles.liveJoinBtn}
              onPress={handleJoin}
              disabled={isCreatingRoom}
              activeOpacity={0.85}
            >
              {isCreatingRoom
                ? <ActivityIndicator size="small" color="#F3EEDF" />
                : <MaterialCommunityIcons name="video" size={17} color="#F3EEDF" />
              }
              <Text style={styles.liveJoinText}>
                {isCreatingRoom ? 'Preparando sala…' : 'Unirse ahora'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </LinearGradient>
      ) : sessionState === 'pendiente' ? (
        /* 🔴 Esta tarjeta estaba escrita entera desde el punto de vista del
           usuario y se le mostraba igual al coach: le decía "Solicitud enviada"
           y "Esperando confirmación de [su propio cliente]". Al revés — él la
           recibió, y es él quien tiene que confirmarla. */
        <View style={styles.sessionCard}>
          <View style={styles.sessionCardTop}>
            <MaterialCommunityIcons name="calendar-clock" size={14} color="#87835C" />
            <Text style={styles.sessionCardLabel}>
              {recipientIsCoach ? 'Solicitud enviada' : 'Te pidió una sesión'}
            </Text>
          </View>
          <Text style={styles.sessionCardDate}>
            {formatSalaDate(activeBooking!.scheduled_date)} · {activeBooking!.scheduled_time.slice(0, 5)} hs{tzSuffix(activeBooking!.scheduled_date, activeBooking!.scheduled_time)}
          </Text>
          <Text style={styles.sessionCardSub}>
            {recipientIsCoach
              ? `Esperando confirmación de ${recipientProfile?.name ?? 'tu profesional'}`
              : 'Esperando que la confirmes'}
          </Text>

          {/* El coach primero puede decir que sí. Rechazar queda como acción
              secundaria, igual que en Reservas. */}
          {!recipientIsCoach && (
            <TouchableOpacity
              style={[styles.confirmBtn, isConfirming && styles.confirmBtnDisabled]}
              onPress={handleConfirmBooking}
              disabled={isConfirming}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="check" size={16} color="#FFF6EC" />
              <Text style={styles.confirmBtnText}>
                {isConfirming ? 'Confirmando…' : 'Confirmar sesión'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancelBooking}
            disabled={isCancelling}
            activeOpacity={0.7}
          >
            <Text style={[styles.cancelBtnText, isCancelling && styles.cancelBtnTextDisabled]}>
              {isCancelling
                ? (recipientIsCoach ? 'Cancelando…' : 'Rechazando…')
                : (recipientIsCoach ? 'Cancelar solicitud' : 'Rechazar')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : sessionState === 'confirmada' ? (
        <View style={styles.sessionCard}>
          <View style={styles.sessionCardTop}>
            <MaterialCommunityIcons name="calendar-check" size={14} color="#2D4A3E" />
            <Text style={styles.sessionCardLabel}>Próxima sesión</Text>
            <View style={styles.confirmedBadge}>
              <Text style={styles.confirmedBadgeText}>Confirmada</Text>
            </View>
          </View>
          <Text style={styles.sessionCardDate}>
            {formatSalaDate(activeBooking!.scheduled_date)} · {activeBooking!.scheduled_time.slice(0, 5)} hs{tzSuffix(activeBooking!.scheduled_date, activeBooking!.scheduled_time)}
          </Text>
          <Text style={styles.sessionCardSub}>
            {countdownText(activeBooking!.scheduled_date, activeBooking!.scheduled_time, activeBooking!.duration_minutes)}
          </Text>
          <View style={styles.sessionCardActions}>
            <TouchableOpacity
              style={[styles.joinBtn, styles.joinBtnDisabled]}
              disabled
              activeOpacity={0.5}
            >
              {isCreatingRoom
                ? <ActivityIndicator size="small" color="rgba(86,94,50,0.5)" />
                : <MaterialCommunityIcons name="video-outline" size={14} color="rgba(86,94,50,0.5)" />
              }
              <Text style={styles.joinBtnTextDisabled}>
                {isCreatingRoom ? 'Preparando sala…' : 'Unirse a la llamada'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.subBtn}
              onPress={handleAddToCalendar}
              disabled={isAddingCalendar}
              activeOpacity={0.75}
            >
              <Text style={styles.subBtnText}>{isAddingCalendar ? 'Agendando…' : 'Agendar'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sessionCardHint}>Disponible 10 min antes de la sesión</Text>
          {/* 🔴 Faltaba. `handleCancelBooking` ya manejaba el caso confirmado
              —chequea las 24hs y escribe `cancelled_late`— pero ningún botón lo
              llamaba en este estado: la función estaba escrita y era inalcanzable.
              Y en el checkout se promete "podés cancelar hasta 24hs antes y te
              devolvemos todo", así que sin este botón esa promesa era falsa.
              Sin condicionar por rol, igual que la tarjeta de solicitud:
              `handleCancelBooking` ya distingue —al coach no le aplica la regla
              de las 24hs— y duplicar esa decisión acá sería otro lugar donde
              se puede desincronizar. */}
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancelBooking}
            disabled={isCancelling}
            activeOpacity={0.7}
          >
            <Text style={[styles.cancelBtnText, isCancelling && styles.cancelBtnTextDisabled]}>
              {isCancelling ? 'Cancelando…' : 'Cancelar sesión'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {loading && (
            <ActivityIndicator color={ViveColors.primary} style={{ marginTop: 40 }} />
          )}
          {!loading && messages.length === 0 && !isChatFrozen && (
            <Text style={styles.emptyText}>¡Empezá la conversación!</Text>
          )}
          {timeline.map((item) => {
            if (item.kind === 'note') {
              const n = item.note;
              // Privada = solo el coach. Llega únicamente si `asCoach`, así que
              // acá no hay decisión de permisos, solo de presentación.
              return (
                <View
                  key={n.id}
                  style={[styles.noteCard, !n.shared && styles.notePrivateCard]}>
                  <View style={styles.noteHeader}>
                    <MaterialCommunityIcons
                      name={n.shared ? 'note-text-outline' : 'lock-outline'}
                      size={16}
                      color={n.shared ? '#3A4F2A' : '#87835C'}
                    />
                    <Text style={styles.noteLabel}>
                      {n.shared
                        ? (recipientIsCoach
                            ? `Nota de ${recipientProfile?.name ?? 'tu profesional'}`
                            : 'Nota compartida')
                        : 'Tu nota privada'}
                    </Text>
                    <Text style={styles.noteTime}>{hhmm(n.createdAt)}</Text>
                  </View>
                  <Text style={styles.noteText}>{n.content}</Text>
                  {!n.shared && (
                    <Text style={styles.notePrivateHint}>Solo la ves vos</Text>
                  )}
                </View>
              );
            }

            const msg = item.msg;
            const isUser = msg.sender === 'user';
            const anim = getAnim(msg.id, 1);

            if (msg.sender_type === 'system_confirmed' || msg.sender_type === 'system_cancelled' || msg.sender_type === 'system') {
              const isConfirmed = msg.sender_type === 'system_confirmed';
              const isCancelled = msg.sender_type === 'system_cancelled';
              const decrypted = decryptMessage(msg.text);
              const [sysLine1, sysLine2] = decrypted.split('\n');
              return (
                <Animated.View
                  key={msg.id}
                  style={[
                    styles.systemRow,
                    {
                      opacity: anim,
                      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
                    },
                  ]}
                >
                  {(isConfirmed || isCancelled) ? (
                    <View style={[styles.systemPill, isConfirmed ? styles.systemPillConfirmed : styles.systemPillCancelled]}>
                      <View style={styles.systemPillRow}>
                        <MaterialCommunityIcons
                          name={isConfirmed ? 'calendar-check' : 'calendar-remove'}
                          size={16}
                          color={isConfirmed ? ViveColors.accent : '#E05252'}
                          style={{ marginTop: 1 }}
                        />
                        <View style={styles.systemPillContent}>
                          <Text style={styles.systemPillLine1}>{sysLine1}</Text>
                          {!!sysLine2 && <Text style={styles.systemPillLine2}>{sysLine2}</Text>}
                        </View>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.systemText}>{decrypted}</Text>
                  )}
                </Animated.View>
              );
            }

            // Tarjeta de recurso recomendado
            if (msg.metadata?.type === 'resource') {
              const meta = msg.metadata;
              const fmtColor: Record<string,string> = { audio:'#C1694F', podcast:'#3B7FC4', video:'#7B5EA7', lectura:'#4A7C59' };
              const fmtLabel: Record<string,string> = { audio:'Audio', podcast:'Podcast', video:'Video', lectura:'Lectura' };
              const cardColor = fmtColor[meta.resource_format] ?? '#C1694F';
              return (
                <Animated.View
                  key={msg.id}
                  style={[
                    styles.messageRow,
                    styles.messageRowCoach,
                    { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange:[0,1], outputRange:[10,0] }) }] },
                  ]}>
                  {recipientProfile?.avatarUrl ? (
                    <Image source={{ uri: recipientProfile.avatarUrl }} style={styles.avatarSmallImage} />
                  ) : (
                    <View style={styles.avatarSmall}><Text style={styles.avatarSmallText}>{displayInitials}</Text></View>
                  )}
                  <View style={styles.recoCard}>
                    <View style={[styles.recoCardStrip, { backgroundColor: cardColor }]}>
                      <Text style={styles.recoCardFormatLabel}>{fmtLabel[meta.resource_format] ?? meta.resource_format}</Text>
                    </View>
                    <View style={styles.recoCardBody}>
                      <Text style={styles.recoCardTitle} numberOfLines={2}>{meta.resource_title}</Text>
                      {meta.note ? <Text style={styles.recoCardNote} numberOfLines={2}>“{meta.note}”</Text> : null}
                      <TouchableOpacity
                        style={[styles.recoCardBtn, { backgroundColor: cardColor }]}
                        onPress={() => {
                          if (meta.recommendation_id) markRecoOpened(meta.recommendation_id);
                          router.push({ pathname: '/coach-recurso', params: { id: meta.resource_id } } as any);
                        }}
                        activeOpacity={0.85}>
                        <Text style={styles.recoCardBtnText}>Abrir</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Animated.View>
              );
            }

            return (
              <Animated.View
                key={msg.id}
                style={[
                  styles.messageRow,
                  isUser ? styles.messageRowUser : styles.messageRowCoach,
                  {
                    opacity: anim,
                    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
                  },
                ]}
              >
                {!isUser && (
                  recipientProfile?.avatarUrl ? (
                    <Image source={{ uri: recipientProfile.avatarUrl }} style={styles.avatarSmallImage} />
                  ) : (
                    <View style={styles.avatarSmall}>
                      <Text style={styles.avatarSmallText}>{displayInitials}</Text>
                    </View>
                  )
                )}
                <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleCoach]}>
                  <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextCoach]}>
                    {decryptMessage(msg.text)}
                  </Text>
                  <Text style={[styles.bubbleTime, isUser ? styles.bubbleTimeUser : styles.bubbleTimeCoach]}>
                    {msg.time}
                  </Text>
                </View>
              </Animated.View>
            );
          })}


          {/* Cierre de sesión + re-reserva: último mensaje del chat, cerca del input
              (antes era un banner fijo arriba; se movió acá para quedar al alcance del dedo)

              🔴 `recipientIsCoach` = la otra parte es coach = **yo soy el
              usuario**, y es la única mitad a la que esto le corresponde. Sin
              ese guard el COACH veía "¿Querés reservar tu próxima sesión con
              [nombre del usuario]?", y no era solo copy mal dirigido: el botón
              llama a `handleReschedule`, que empuja a `/booking-calendar` con
              `coachId: recipientId` — del lado del coach ese id es el del
              USUARIO, así que iba a pedir la agenda de alguien que no es coach.
              Mismo guard que ya usan la nota compartida (más arriba) y el botón
              de reservar del header; acá se había quedado sin poner. */}
          {!loading && recipientIsCoach && sessionState === 'finalizada' && activeBooking && (
            <View style={styles.endedCard}>
              <View style={styles.endedHeader}>
                <MaterialCommunityIcons name="check-circle-outline" size={16} color="#87835C" />
                <Text style={styles.endedLabel}>
                  Sesión del {formatSalaDate(activeBooking.scheduled_date)} finalizada
                </Text>
              </View>
              <Text style={styles.endedText}>
                ¿Querés reservar tu próxima sesión con {recipientProfile?.name ?? 'tu profesional'}?
              </Text>
              <TouchableOpacity style={styles.endedBtn} onPress={handleReschedule} activeOpacity={0.85}>
                <MaterialCommunityIcons name="calendar-plus" size={16} color="#FFF6EC" />
                <Text style={styles.endedBtnText}>Reservar próxima sesión</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Input bar */}
        <Animated.View
          style={[
            styles.inputArea,
            {
              opacity: inputAnim,
              transform: [{ translateY: inputAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            },
          ]}
        >
          {isChatFrozen ? (
            <View style={styles.frozenNotice}>
              <MaterialCommunityIcons
                name={pairBlocked ? 'account-cancel-outline' : 'lock-outline'}
                size={16}
                color="rgba(135,131,92,0.70)"
              />
              <Text style={styles.frozenNoticeText}>
                {/* El bloqueo gana sobre "pendiente": si están bloqueados, el
                    chat no se destraba aceptando la solicitud. El texto de
                    quien NO bloqueó es neutro a propósito — enterarse de que te
                    bloquearon es justo lo que la función tiene que evitar. */}
                {pairBlocked
                  ? (iBlockedThem
                      ? `Bloqueaste a ${recipientProfile?.name?.split(' ')[0] ?? 'esta persona'}. Desbloqueá desde el menú “⋯” para volver a escribirle.`
                      : 'No podés escribir en esta conversación.')
                  : isCurrentUserCoach
                    ? 'Aceptá o rechazá la solicitud desde Reservas para habilitar el chat'
                    : `El chat se habilita cuando ${recipientProfile?.name ?? 'el profesional'} acepte tu solicitud`}
              </Text>
            </View>
          ) : (
            <>
              {isCurrentUserCoach && coachInternalId && (
                <TouchableOpacity
                  style={styles.recoBtn}
                  onPress={openRecoSheet}
                  activeOpacity={0.75}
                  hitSlop={8}>
                  <MaterialCommunityIcons name="plus" size={20} color="#87835C" />
                </TouchableOpacity>
              )}
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Escribí un mensaje..."
                placeholderTextColor="rgba(135,131,92,0.55)"
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
                onPress={sendMessage}
                disabled={!canSend}
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons name="send" size={19} color="#565E32" style={{ marginLeft: 2 }} />
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Bottom sheet: recomendar recurso */}
      <Modal
        visible={recoSheetOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setRecoSheetOpen(false)}>
        <TouchableOpacity style={styles.recoOverlay} activeOpacity={1} onPress={() => setRecoSheetOpen(false)} />
        <View style={styles.recoSheet}>
          <View style={styles.recoSheetHandle} />
          <Text style={styles.recoSheetTitle}>Recomendar recurso</Text>

          {coachResources.length === 0 ? (
            <Text style={styles.recoSheetEmpty}>No tenés recursos publicados aún</Text>
          ) : (
            <ScrollView style={styles.recoSheetList} showsVerticalScrollIndicator={false}>
              {coachResources.map(r => {
                const fmtColor: Record<string,string> = { audio:'#C1694F', podcast:'#3B7FC4', video:'#7B5EA7', lectura:'#4A7C59' };
                const fmtLabel: Record<string,string> = { audio:'Audio', podcast:'Podcast', video:'Video', lectura:'Lectura' };
                const isSelected = selectedReco?.id === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.recoSheetItem, isSelected && styles.recoSheetItemSelected]}
                    onPress={() => setSelectedReco(isSelected ? null : r)}
                    activeOpacity={0.75}>
                    <View style={[styles.recoSheetFmtDot, { backgroundColor: fmtColor[r.format] ?? '#C1694F' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recoSheetItemTitle} numberOfLines={2}>{r.title}</Text>
                      <Text style={styles.recoSheetItemMeta}>
                        {fmtLabel[r.format] ?? r.format}{r.duration_seconds ? ` · ${Math.ceil(r.duration_seconds/60)} min` : ''}
                      </Text>
                    </View>
                    {isSelected && <MaterialCommunityIcons name="check-circle" size={20} color="#2D4A3E" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {selectedReco && (
            <>
              <TextInput
                style={styles.recoNoteInput}
                value={recoNote}
                onChangeText={t => setRecoNote(t.slice(0, 200))}
                placeholder="Nota opcional para el usuario (máx. 200 chars)"
                placeholderTextColor="rgba(135,131,92,0.55)"
                multiline
                maxLength={200}
              />
              <Text style={styles.recoNoteCount}>{recoNote.length}/200</Text>
            </>
          )}

          <TouchableOpacity
            style={[styles.recoSendBtn, (!selectedReco || sendingReco) && styles.recoSendBtnDisabled]}
            onPress={sendRecommendation}
            disabled={!selectedReco || sendingReco}
            activeOpacity={0.85}>
            {sendingReco
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.recoSendBtnText}>Enviar recomendación</Text>}
          </TouchableOpacity>
        </View>
      </Modal>

      <UserActionsSheet
        visible={actionsOpen}
        onClose={() => setActionsOpen(false)}
        targetId={recipientId ?? ''}
        targetName={recipientProfile?.name ?? 'esta persona'}
        blocked={iBlockedThem}
        onReport={() => setReportOpen(true)}
        onBlockChange={next => {
          setIBlockedThem(next);
          // Al desbloquear no se asume que el par quedó libre: el otro puede
          // haberme bloqueado a mí también, y eso no lo veo en mi lista.
          if (next) setPairBlocked(true);
          else if (user && recipientId) void areBlocked(user.id, recipientId).then(setPairBlocked);
        }}
      />

      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        reportedName={recipientProfile?.name ?? 'esta persona'}
        reportedId={recipientId ?? ''}
        salaId={salaId}
      />

      {!recipientIsCoach && notesBookingId && recipientId && (
        <SessionNotesSheet
          visible={notesOpen}
          onClose={() => setNotesOpen(false)}
          bookingId={notesBookingId}
          userId={recipientId}
          clientName={recipientProfile?.name ?? 'tu cliente'}
          onSaved={fetchNotes}
        />
      )}

    </SafeAreaView>
    </AppBg>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(247,239,228,0.92)',
    gap: 12,
  },
  backBtn: { padding: 4 },
  menuBtn: { padding: 4 },
  rebookPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(58,79,42,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(58,79,42,0.22)',
  },
  rebookPillText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 12.5,
    color: '#3A4F2A',
  },
  coachInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ViveColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: ViveFonts.bold,
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  avatarImage: { width: 44, height: 44, borderRadius: 22 },
  skeletonName: {
    width: 110, height: 13, borderRadius: 6,
    backgroundColor: 'rgba(86,94,50,0.12)', marginBottom: 5,
  },
  skeletonSpecialty: {
    width: 70, height: 10, borderRadius: 5,
    backgroundColor: 'rgba(255,248,240,0.32)',
  },
  coachName: { fontFamily: ViveFonts.semibold, fontSize: 15, color: '#565E32', lineHeight: 20 },
  coachSpecialty: { fontFamily: ViveFonts.regular, fontSize: 12, color: 'rgba(135,131,92,0.80)', marginTop: 1 },
  headerDivider: { height: 1, backgroundColor: 'rgba(255,248,240,0.48)' },

  // Session card — confirmada / pendiente / finalizada
  sessionCard: {
    backgroundColor: 'rgba(255,248,240,0.60)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(86,94,50,0.10)',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 4,
  },
  sessionCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sessionCardLabel: {
    fontFamily: ViveFonts.semibold,
    fontSize: 11,
    letterSpacing: 0.5,
    color: '#87835C',
    textTransform: 'uppercase',
    flex: 1,
  },
  sessionCardDate: {
    fontFamily: ViveFonts.bold,
    fontSize: 18,
    color: '#565E32',
    lineHeight: 24,
  },
  sessionCardSub: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: '#87835C',
    marginBottom: 2,
  },
  sessionCardHint: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: 'rgba(135,131,92,0.65)',
    marginTop: 2,
    textAlign: 'center',
  },
  sessionCardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },

  confirmedBadge: {
    backgroundColor: 'rgba(220,229,203,0.60)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  confirmedBadgeText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 10,
    color: '#42542F',
  },

  joinBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2D4A3E',
    borderRadius: 13,
    paddingVertical: 10,
  },
  joinBtnDisabled: { backgroundColor: 'rgba(86,94,50,0.12)' },
  joinBtnText: { fontFamily: ViveFonts.semibold, fontSize: 13, color: '#F3EEDF' },
  joinBtnTextDisabled: { fontFamily: ViveFonts.semibold, fontSize: 13, color: 'rgba(86,94,50,0.50)' },

  subBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,248,240,0.80)',
    borderWidth: 1,
    borderColor: 'rgba(86,94,50,0.18)',
    borderRadius: 13,
    paddingVertical: 10,
  },
  subBtnText: { fontFamily: ViveFonts.medium, fontSize: 12, color: '#565E32' },

  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ViveColors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 12,
  },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { fontFamily: ViveFonts.semibold, fontSize: 14.5, color: '#FFF6EC' },

  cancelBtn: { alignSelf: 'flex-start', marginTop: 8 },
  cancelBtnText: { fontFamily: ViveFonts.medium, fontSize: 13, color: '#E05252' },
  cancelBtnTextDisabled: { color: 'rgba(135,131,92,0.45)' },

  // Live card
  sessionCardLive: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  liveTitle: { fontFamily: ViveFonts.semibold, fontSize: 15, color: '#F3EEDF', lineHeight: 20 },
  liveSub: { fontFamily: ViveFonts.regular, fontSize: 12, color: '#C9CFAF', marginTop: 2 },
  liveJoinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ViveColors.primary,
    borderRadius: 14,
    paddingVertical: 13,
  },
  liveJoinText: { fontFamily: ViveFonts.semibold, fontSize: 15, color: '#F3EEDF' },

  // Messages
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12, gap: 12 },
  emptyText: {
    fontFamily: ViveFonts.regular, fontSize: 14, color: 'rgba(135,131,92,0.80)',
    textAlign: 'center', marginTop: 60, lineHeight: 22,
  },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  messageRowUser: { justifyContent: 'flex-end' },
  messageRowCoach: { justifyContent: 'flex-start' },
  avatarSmall: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: ViveColors.primaryInk, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginBottom: 2,
  },
  avatarSmallText: { fontFamily: ViveFonts.bold, fontSize: 9, color: '#F7EFE4', letterSpacing: 0.3 },
  avatarSmallImage: { width: 28, height: 28, borderRadius: 14, flexShrink: 0, marginBottom: 2 },
  bubble: { maxWidth: '74%', paddingVertical: 10, paddingHorizontal: 14, gap: 4 },
  bubbleUser: {
    backgroundColor: ViveColors.primary, borderRadius: 18, borderBottomRightRadius: 4,
    ...Platform.select({
      ios: { shadowColor: ViveColors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.22, shadowRadius: 6 },
      android: { elevation: 3 },
    }),
  },
  bubbleCoach: {
    backgroundColor: 'rgba(255,248,240,0.62)', borderRadius: 18, borderBottomLeftRadius: 4,
    ...Platform.select({
      ios: { shadowColor: '#FFFFFF', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  bubbleText: { fontFamily: ViveFonts.regular, fontSize: 15, lineHeight: 22 },
  bubbleTextUser: { color: '#565E32' },
  bubbleTextCoach: { color: '#565E32' },
  bubbleTime: { fontFamily: ViveFonts.regular, fontSize: 10, alignSelf: 'flex-end' },
  bubbleTimeUser: { color: '#87835C' },
  bubbleTimeCoach: { color: 'rgba(135,131,92,0.80)' },

  // Nota compartida de la sesión (lado usuario)
  noteCard: {
    backgroundColor: 'rgba(86,94,50,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(86,94,50,0.14)',
    borderRadius: 18,
    padding: 16,
    marginTop: 4,
    marginBottom: 8,
    gap: 8,
  },
  // La privada se distingue del resto del hilo: es un apunte de trabajo, no
  // parte de la conversación. Fondo neutro y punteada, para que el coach no la
  // confunda de un vistazo con algo que el usuario está leyendo.
  notePrivateCard: {
    backgroundColor: 'rgba(135,131,92,0.07)',
    borderColor: 'rgba(135,131,92,0.28)',
    borderStyle: 'dashed',
  },
  notePrivateHint: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: 'rgba(135,131,92,0.85)',
  },
  noteTime: {
    marginLeft: 'auto',
    fontFamily: ViveFonts.regular,
    fontSize: 10.5,
    color: 'rgba(135,131,92,0.70)',
  },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noteLabel: {
    fontFamily: ViveFonts.semibold,
    fontSize: 11,
    letterSpacing: 0.5,
    color: '#3A4F2A',
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  noteText: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: '#565E32',
    lineHeight: 21,
  },

  // Tarjeta de cierre + re-reserva, inline al final del chat
  endedCard: {
    backgroundColor: 'rgba(255,248,240,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(86,94,50,0.14)',
    borderRadius: 18,
    padding: 16,
    marginTop: 4,
    gap: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  endedHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  endedLabel: {
    fontFamily: ViveFonts.semibold,
    fontSize: 11,
    letterSpacing: 0.5,
    color: '#87835C',
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  endedText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: '#565E32',
    lineHeight: 23,
  },
  endedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ViveColors.primary,
    borderRadius: 13,
    paddingVertical: 12,
  },
  endedBtnText: { fontFamily: ViveFonts.semibold, fontSize: 14, color: '#FFF6EC' },

  systemRow: { alignItems: 'center', paddingVertical: 4 },
  systemText: { fontFamily: ViveFonts.regular, fontSize: 12, color: 'rgba(135,131,92,0.80)', fontStyle: 'italic', textAlign: 'center' },
  systemPill: { maxWidth: '88%', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  systemPillConfirmed: { backgroundColor: 'rgba(100,200,150,0.22)' },
  systemPillCancelled: { backgroundColor: '#E0525218' },
  systemPillRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  systemPillContent: { flexShrink: 1, gap: 2 },
  systemPillLine1: { fontFamily: ViveFonts.semibold, fontSize: 13, color: '#565E32', lineHeight: 18 },
  systemPillLine2: { fontFamily: ViveFonts.regular, fontSize: 12, color: '#87835C', lineHeight: 17 },

  // Composer
  inputArea: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 14, paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 14,
    backgroundColor: 'rgba(247,239,228,0.97)',
    borderTopWidth: 1, borderTopColor: 'rgba(86,94,50,0.12)',
    gap: 10,
  },
  input: {
    flex: 1, fontFamily: ViveFonts.regular, fontSize: 15, color: '#565E32',
    backgroundColor: 'rgba(255,248,240,0.48)', borderRadius: 22,
    paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, maxHeight: 120, lineHeight: 21,
  },
  frozenNotice: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,248,240,0.48)', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  frozenNoticeText: { flex: 1, fontFamily: ViveFonts.regular, fontSize: 13, color: 'rgba(135,131,92,0.80)', lineHeight: 18 },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: ViveColors.primary,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    ...Platform.select({
      ios: { shadowColor: ViveColors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.30, shadowRadius: 6 },
      android: { elevation: 4 },
    }),
  },
  sendBtnDisabled: { backgroundColor: 'rgba(255,248,240,0.62)', shadowOpacity: 0, elevation: 0 },

  // ── Botón "+" del coach ───────────────────────────────────────────────────
  recoBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,248,240,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // ── Resource card en el chat ──────────────────────────────────────────────
  recoCard: {
    maxWidth: 260,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,248,240,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  recoCardStrip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  recoCardFormatLabel: {
    fontFamily: ViveFonts.semibold,
    fontSize: 10,
    color: '#fff',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  recoCardBody: {
    padding: 12,
    gap: 6,
  },
  recoCardTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13.5,
    color: '#3A4F2A',
    lineHeight: 18,
  },
  recoCardNote: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: '#6B7A56',
    lineHeight: 17,
    fontStyle: 'italic',
  },
  recoCardBtn: {
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  recoCardBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: '#fff',
  },

  // ── Bottom sheet ──────────────────────────────────────────────────────────
  recoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  recoSheet: {
    backgroundColor: '#F7EFE4',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '75%',
  },
  recoSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(86,94,50,0.20)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  recoSheetTitle: {
    fontFamily: ViveFonts.title,
    fontSize: 20,
    color: '#3A4F2A',
    marginBottom: 14,
  },
  recoSheetEmpty: {
    fontFamily: ViveFonts.regular,
    fontSize: 13.5,
    color: '#87835C',
    textAlign: 'center',
    marginVertical: 20,
  },
  recoSheetList: { maxHeight: 260 },
  recoSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.60)',
  },
  recoSheetItemSelected: {
    backgroundColor: 'rgba(45,74,62,0.08)',
    borderColor: '#2D4A3E',
  },
  recoSheetFmtDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  recoSheetItemTitle: {
    fontFamily: ViveFonts.medium,
    fontSize: 13.5,
    color: '#3A4F2A',
  },
  recoSheetItemMeta: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: '#87835C',
    marginTop: 2,
  },
  recoNoteInput: {
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.60)',
    borderRadius: 14,
    padding: 12,
    fontFamily: ViveFonts.regular,
    fontSize: 13.5,
    color: '#3A4F2A',
    minHeight: 72,
    textAlignVertical: 'top',
    marginTop: 12,
  },
  recoNoteCount: {
    fontFamily: ViveFonts.regular,
    fontSize: 10.5,
    color: '#87835C',
    textAlign: 'right',
    marginTop: 4,
  },
  recoSendBtn: {
    backgroundColor: '#3A4F2A',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 14,
  },
  recoSendBtnDisabled: {
    backgroundColor: 'rgba(58,79,42,0.35)',
  },
  recoSendBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#F3EEDF',
  },
});
