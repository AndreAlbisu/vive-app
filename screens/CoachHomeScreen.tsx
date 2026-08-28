import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ViveFonts, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { supabase, registrarEvento } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { personasQueSeCaen, haceCuanto, type PersonaEnRiesgo } from '@/lib/coachContinuity';
import { COMMISSION_LOCAL_FIRST, COMMISSION_LOCAL_RECURRING } from '@/lib/pricing';
import { AppBg } from '@/components/ui/AppBg';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { visibilityTeaser, analyzeDoors, homeStanding, tituloVisibilidad, bajadaVisibilidad, type VisibilityTeaser, type HomeStanding } from '@/lib/coachVisibility';
import { loadVisibilitySelf } from '@/lib/coachVisibilityData';
import { DOORS } from '@/constants/conexionesDoors';
import { scheduledAtMs, daysFromTodayAr, todayInAr } from '@/lib/time';

/** Una persona que se está cayendo, ya resuelta con lo que hace falta para
 *  mostrarla y para escribirle. */
type PersonaCayendo = PersonaEnRiesgo & {
  name: string;
  avatarUrl: string | null;
  salaId: string | null;
};

/**
 * 🔴 EL INTERRUPTOR de "el coach ve la tendencia de ánimo de su cliente" (D).
 *
 * A la espera de la respuesta del abogado — pregunta **A.10** de
 * `docs/paquete-abogado.md`. Decisión de Andre el 26/08/2026: construirlo ahora
 * y apagarlo si la respuesta es que no, para no perder tiempo.
 *
 * Poner esto en `false` lo apaga entero del lado de la app. La otra llave es no
 * correr `scripts/add-mood-para-coach.sql`, o borrar su función: sin ella la
 * consulta falla y esto ya trata el error como "no hay datos".
 *
 * ⚠️ Lo que se muestra es SOLO la tendencia agregada. Nunca las entradas una por
 * una, y nunca el diario ni la gratitud — eso es texto libre donde la persona
 * escribe lo que no le dice a nadie, y queda afuera por completo.
 */
// ⏸️ APAGADO el 26/08/2026 mientras se piensa la propuesta completa. La función
// de la base sigue existiendo (no molesta: sin este flag nadie la llama), así
// que volver a prenderlo es cambiar este `false` por `true`.
//
// El motivo de apagarlo: está construido con la puerta en el lado equivocado
// —la valida el VÍNCULO (existe una reserva), no la PERSONA— así que hoy un
// coach ve el ánimo de alguien que nunca aceptó compartirlo. Ver
// `docs/animo-compartido.md`.
const MOSTRAR_ANIMO_AL_COACH = false;


// ── Paleta del mockup (docs/coach-app-interactivo.html) ──────────────────────
const CARD = '#F7F2E7';
const CREAM_DEEP = '#EAE2D0';
const FOREST = '#3F512F';
const FOREST_SOFT = '#6B7A56';
const TERRA = '#C06B4A';
const TERRA_SOFT = '#EAD3C6';
const OK_BG = '#DCE5CB';
const OK_INK = '#42542F';
const LINE = 'rgba(63,81,47,0.14)';
const GREEN_TXT = '#F3EEDF';
const GREEN_EYEBROW = '#C9CFAF';

const WEEK_ABBRS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

type Session = { userId: string; time: string; date: string };
type DayEntry = { abbr: string; count: number; isToday: boolean };

type NextSession = {
  bookingId: string;
  userId: string;
  userName: string;
  initials: string;
  avatarUrl: string | null;
  dateLabel: string;
  timeStr: string;
  ordinal: string;
  salaId: string | null;
  startMs: number;
};

type AnimoCliente = {
  diasConRegistro: number;
  promedio: number;
  ultimo: number;
  direccion: 'sube' | 'baja' | 'igual';
};

type PrepResource = { id: string; title: string; opened: boolean; roomId: string | null };
type Prep = { lastDaysAgo: number | null; resources: PrepResource[]; animo: AnimoCliente | null };

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '??';
}
function ordinalLabel(n: number): string {
  return `${n}.ª sesión`;
}
// Todo lo de acá se calcula en hora/día de ARGENTINA, que es como está guardado.
// Vale también del lado del coach: un coach de viaje veía su propia agenda
// corrida, con el "Hoy" y el "Mañana" cambiados de lugar.
function bookingStartMs(date: string, time: string): number {
  return scheduledAtMs(date, time);
}
function nextDateLabel(date: string): string {
  const diffDays = daysFromTodayAr(date);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Mañana';
  const [y, m, d] = date.split('-').map(Number);
  // Solo para el día de la semana: una fecha de calendario tiene el mismo día
  // en cualquier zona, así que acá `new Date` con componentes locales es seguro.
  const dayName = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][new Date(y, m - 1, d).getDay()];
  return `${dayName} ${d} ${MONTHS[m - 1]}`;
}

export default function CoachHomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [coachId, setCoachId] = useState<string | null>(null);
  const [coachName, setCoachName] = useState('');
  const [weekData, setWeekData] = useState<DayEntry[]>([]);
  const [next, setNext] = useState<NextSession | null>(null);
  const [prep, setPrep] = useState<Prep | null>(null);
  const [prepOpen, setPrepOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [visibility, setVisibility] = useState<VisibilityTeaser | null>(null);
  const [standing, setStanding] = useState<HomeStanding | null>(null);
  const [seCaen, setSeCaen] = useState<PersonaCayendo[]>([]);
  const [repu, setRepu] = useState<{ completadas: number; vuelvenPct: number | null } | null>(null);
  const [sinCerrar, setSinCerrar] = useState<{ name: string; salaId: string; dias: number } | null>(null);

  // ── Card de preparación (estado vacío de Inicio) ────────────────────────
  // Los 3 pasos del checklist. `puertas` no tiene estado propio — se deriva
  // de `doorLabels.length` — acá hace falta la lista completa para los chips.
  const [prepPerfil, setPrepPerfil] = useState(false);
  const [prepRecurso, setPrepRecurso] = useState(false);
  const [doorLabels, setDoorLabels] = useState<string[]>([]);
  // Si el coach tiene AL MENOS una fila en `bookings`, sin importar el
  // estado (ni siquiera se excluye `cancelada`: si alguien reservó una vez,
  // aunque se haya caído, ya no es "antes de tu primera sesión"). Reemplaza
  // a la vieja `esCoachNuevo` (`!next && completadas===0`) como gate de esta
  // card — esa condición no contaba una solicitud recién llegada como "ya
  // pasó algo", y la card de acá tiene que desaparecer justo en ese momento.
  const [hasAnyBookingEver, setHasAnyBookingEver] = useState(true); // true hasta confirmar — no mostrar de más mientras carga

  useEffect(() => {
    if (!user) return;
    supabase.from('coaches').select('id').eq('profile_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setCoachId(data.id); });
  }, [user]);

  // Badge de notificaciones (campana del header).
  useEffect(() => {
    if (!user) return;
    const loadUnread = () => supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('read', false)
      .then(({ count }) => setUnreadCount(count ?? 0));
    loadUnread();
    const channel = supabase
      .channel(`coach-home-notif-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, loadUnread)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadData = useCallback(async () => {
    if (!user || !coachId) { setLoading(false); return; }

    const now = new Date();
    const todayStr = toDateStr(now);

    // Semana Lun-Dom
    const dow = now.getDay();
    const daysFromMonday = dow === 0 ? 6 : dow - 1;
    const monday = new Date(now); monday.setDate(now.getDate() - daysFromMonday); monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);

    const [
      { data: profile },
      { data: confirmed },
      { data: coachRow },
      { data: topicRows },
      { count: recursosCount },
      { count: bookingsEverCount },
    ] = await Promise.all([
      supabase.from('profiles').select('name, avatar_url').eq('id', user.id).maybeSingle(),
      supabase
        .from('bookings')
        .select('id, user_id, scheduled_date, scheduled_time, sala_id, duration_minutes')
        .eq('coach_id', coachId)
        .eq('status', 'confirmada')
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true }),
      supabase.from('coaches').select('verified, availability_status, price_per_session, bio, specialty').eq('id', coachId).maybeSingle(),
      supabase.from('coach_topics').select('topic').eq('coach_id', coachId),
      // "Subiste un recurso" cuenta cualquier fila, sin filtrar por `status`:
      // el checklist dice "Subir tu primer recurso" — es la acción, no que ya
      // esté publicado.
      supabase.from('coach_resources').select('id', { count: 'exact', head: true }).eq('coach_id', coachId),
      // Para `hasAnyBookingEver` — ver más abajo. `head:true` + sin filtro de
      // estado: alcanza con saber si existe una fila, no cuál ni cuántas.
      supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('coach_id', coachId),
    ]);

    if (profile?.name) setCoachName(profile.name.split(' ')[0]);

    setVisibility(visibilityTeaser({
      verified: !!coachRow?.verified,
      availabilityStatus: (coachRow?.availability_status ?? 'activo') as 'activo' | 'en_pausa',
      topics: (topicRows ?? []).map(t => t.topic as string),
      price: (coachRow?.price_per_session ?? null) as number | null,
    }));

    // ── Checklist de preparación ──────────────────────────────────────────
    // Los tres `setXxx` usan la forma funcional para comparar contra el
    // valor ANTERIOR y loguear `preparacion_paso_completado` solo en la
    // transición false→true — no en cada `loadData()` (focus, refresh).
    const topicsNow = (topicRows ?? []).map(t => t.topic as string);
    const doorsNow = DOORS.filter(d => d.subtemas.some(t => topicsNow.includes(t))).map(d => d.label);
    setDoorLabels(prev => {
      if (prev.length === 0 && doorsNow.length > 0) registrarEvento('preparacion_paso_completado', { paso: 'puertas' }).catch(() => {});
      return doorsNow;
    });

    const perfilCompletoNow = !!profile?.avatar_url && !!coachRow?.bio?.trim() && !!coachRow?.specialty?.trim();
    setPrepPerfil(prev => {
      if (!prev && perfilCompletoNow) registrarEvento('preparacion_paso_completado', { paso: 'perfil' }).catch(() => {});
      return perfilCompletoNow;
    });

    const recursoNow = (recursosCount ?? 0) > 0;
    setPrepRecurso(prev => {
      if (!prev && recursoNow) registrarEvento('preparacion_paso_completado', { paso: 'recurso' }).catch(() => {});
      return recursoNow;
    });

    setHasAnyBookingEver((bookingsEverCount ?? 0) > 0);

    const rows = confirmed ?? [];
    const sessions: Session[] = rows.map(b => ({
      userId: b.user_id as string,
      time: (b.scheduled_time as string).slice(0, 5),
      date: b.scheduled_date as string,
    }));

    // Franja semanal (conteo por día + hoy)
    const week: DayEntry[] = WEEK_ABBRS.map((abbr, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const dateStr = toDateStr(d);
      return { abbr, count: sessions.filter(s => s.date === dateStr).length, isToday: dateStr === todayStr };
    });
    setWeekData(week);

    // Próxima sesión = primera confirmada con inicio >= ahora
    const nowMs = now.getTime();
    const upcoming = rows
      .map(b => ({ b, startMs: bookingStartMs(b.scheduled_date as string, b.scheduled_time as string) }))
      .filter(x => x.startMs >= nowMs - 90 * 60 * 1000) // incluye una en curso (hasta 90')
      .sort((a, b) => a.startMs - b.startMs)[0];

    if (upcoming) {
      const b = upcoming.b;
      const [{ data: prof }, { count: completedCount }] = await Promise.all([
        supabase.from('profiles').select('name, avatar_url').eq('id', b.user_id).maybeSingle(),
        supabase.from('bookings').select('id', { count: 'exact', head: true })
          .eq('coach_id', coachId).eq('user_id', b.user_id).eq('status', 'completada'),
      ]);
      const name = (prof?.name as string) ?? 'Usuario';
      setNext({
        bookingId: b.id as string,
        userId: b.user_id as string,
        userName: name,
        initials: getInitials(name),
        avatarUrl: (prof?.avatar_url as string) ?? null,
        dateLabel: nextDateLabel(b.scheduled_date as string),
        timeStr: (b.scheduled_time as string).slice(0, 5),
        ordinal: ordinalLabel((completedCount ?? 0) + 1),
        salaId: (b.sala_id as string) ?? null,
        startMs: upcoming.startMs,
      });

      // Preparar sesión: última completada + recursos recomendados (Recursos v2)
      const [{ data: lastDone }, { data: recs }] = await Promise.all([
        supabase.from('bookings').select('scheduled_date')
          .eq('coach_id', coachId).eq('user_id', b.user_id).eq('status', 'completada')
          .order('scheduled_date', { ascending: false }).limit(1),
        supabase.from('resource_recommendations')
          .select('id, opened_at, room_id, coach_resources!inner(title)')
          .eq('coach_id', coachId).eq('user_id', b.user_id)
          .order('created_at', { ascending: false }).limit(6),
      ]);
      let lastDaysAgo: number | null = null;
      if (lastDone?.[0]?.scheduled_date) {
        lastDaysAgo = Math.max(0, -daysFromTodayAr(lastDone[0].scheduled_date as string));
      }
      const resources: PrepResource[] = (recs ?? []).map(r => {
        const cr = r.coach_resources as { title?: string } | { title?: string }[] | null;
        const title = Array.isArray(cr) ? (cr[0]?.title ?? 'Recurso') : (cr?.title ?? 'Recurso');
        return { id: r.id as string, title, opened: !!r.opened_at, roomId: (r.room_id as string) ?? null };
      });
      // Tendencia de ánimo — solo de la persona de la PRÓXIMA sesión, y solo
      // acá: es información para prepararse, no un panel de vigilancia. Si la
      // función no existe (script sin correr o borrado por el abogado), el
      // error se traga y queda en null.
      let animo: AnimoCliente | null = null;
      if (MOSTRAR_ANIMO_AL_COACH) {
        const { data: tend } = await supabase.rpc('mood_trend_for_client', {
          p_user_id: b.user_id as string,
          p_days: 14,
        });
        const fila = Array.isArray(tend) ? tend[0] : null;
        if (fila) {
          animo = {
            diasConRegistro: Number(fila.dias_con_registro),
            promedio: Number(fila.promedio),
            ultimo: Number(fila.ultimo),
            direccion: (fila.direccion as AnimoCliente['direccion']) ?? 'igual',
          };
        }
      }

      setPrep({ lastDaysAgo, resources, animo });
    } else {
      setNext(null);
      setPrep(null);
    }

    // ── La sesión que pasó y no cerraste ─────────────────────────────────────
    // 🔴 `session_notes` existe desde el 06/08 y vive detrás de una pill en el
    // header del chat: **nadie le pide nunca al coach que la escriba**. Es a la
    // vez buena práctica profesional y la función más pegajosa del producto —
    // ese historial no se lo puede llevar si se va.
    //
    // Ventana corta a propósito: una semana. Pasado eso el aviso deja de ser un
    // recordatorio y pasa a ser un reproche por algo que ya no se acuerda.
    const haceUnaSemana = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const { data: recientes } = await supabase
      .from('bookings')
      .select('id, user_id, sala_id, scheduled_date')
      .eq('coach_id', coachId)
      .eq('status', 'completada')
      .gte('scheduled_date', haceUnaSemana)
      .lte('scheduled_date', todayInAr())
      .order('scheduled_date', { ascending: false });

    let pendienteNota: { name: string; salaId: string; dias: number } | null = null;
    if (recientes && recientes.length > 0) {
      // Una nota (privada o compartida) alcanza para darla por cerrada: la tabla
      // permite hasta dos por reserva y exigir las dos sería inventar un deber.
      const { data: conNota } = await supabase
        .from('session_notes')
        .select('booking_id')
        .in('booking_id', recientes.map(b => b.id as string));
      const yaTiene = new Set((conNota ?? []).map(n => n.booking_id as string));

      const primera = recientes.find(b => !yaTiene.has(b.id as string) && b.sala_id);
      if (primera) {
        const { data: quien } = await supabase
          .from('profiles').select('name').eq('id', primera.user_id as string).maybeSingle();
        pendienteNota = {
          name: (quien?.name as string) ?? 'esa persona',
          salaId: primera.sala_id as string,
          dias: -daysFromTodayAr(primera.scheduled_date as string),
        };
      }
    }
    setSinCerrar(pendienteNota);

    // ── Lo que construiste acá ───────────────────────────────────────────────
    // 🔴 `coach_rebooking_stats` ya calcula la tasa de recompra y hasta hoy se
    // usaba SOLO para rankear al coach en el deck del usuario: él nunca veía su
    // propio número. Es el dato más halagador y más difícil de conseguir que
    // tiene un profesional independiente — y, para lo que importa acá, **es el
    // que no se puede llevar a ningún lado** si se va de la app.
    const { data: stats } = await supabase
      .from('coach_rebooking_stats')
      .select('completadas_count, rebooking_rate')
      .eq('coach_id', coachId)
      .maybeSingle();

    // `rebooking_rate` viene NULL con menos de 5 completadas: es el piso de
    // muestra de la vista, no un cero. Mostrar "0% vuelve" cuando todavía no
    // hay con qué calcularlo sería desmoralizar con un dato inventado.
    setRepu(stats ? {
      completadas: Number(stats.completadas_count ?? 0),
      vuelvenPct: stats.rebooking_rate == null ? null : Math.round(Number(stats.rebooking_rate) * 100),
    } : null);

    // ── Quién se está cayendo ────────────────────────────────────────────────
    // Se pide aparte de las confirmadas de arriba porque son otro conjunto: las
    // COMPLETADAS, que es lo único que prueba que la relación existió.
    const [{ data: cumplidas }, { data: futuras }] = await Promise.all([
      supabase.from('bookings')
        .select('user_id, scheduled_date')
        .eq('coach_id', coachId).eq('status', 'completada'),
      // Con sesión futura no se está cayendo nadie — y ofrecerle al coach que le
      // escriba "hace mucho que no te veo" a quien tiene turno el jueves lo
      // haría quedar mal. Entra `pendiente` además de `confirmada`: una reserva
      // esperando su OK ya es contacto vivo.
      supabase.from('bookings')
        .select('user_id')
        .eq('coach_id', coachId)
        .in('status', ['confirmada', 'pendiente'])
        .gte('scheduled_date', todayInAr()),
    ]);

    const enRiesgo = personasQueSeCaen(
      (cumplidas ?? []).map(b => ({ userId: b.user_id as string, fecha: b.scheduled_date as string })),
      new Set((futuras ?? []).map(b => b.user_id as string)),
    ).slice(0, 3);   // tres es lo que entra sin volverse una lista de tareas

    if (enRiesgo.length === 0) {
      setSeCaen([]);
    } else {
      // Nombre y sala en una sola vuelta por cada cosa, no una por persona.
      const ids = enRiesgo.map(p => p.userId);
      const [{ data: profs }, { data: salas }] = await Promise.all([
        supabase.from('profiles').select('id, name, avatar_url').in('id', ids),
        // `salas.coach_id` es `profiles.id` del coach, NO `coaches.id`.
        supabase.from('salas').select('id, user_id').eq('coach_id', user.id).in('user_id', ids),
      ]);
      const nombre = new Map((profs ?? []).map(p => [p.id as string, p]));
      const sala = new Map((salas ?? []).map(sa => [sa.user_id as string, sa.id as string]));
      setSeCaen(enRiesgo.map(p => ({
        ...p,
        name: (nombre.get(p.userId)?.name as string) ?? 'Alguien',
        avatarUrl: (nombre.get(p.userId)?.avatar_url as string) ?? null,
        salaId: sala.get(p.userId) ?? null,
      })));
    }

    setLoading(false);
  }, [user, coachId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const canJoin = next ? Date.now() >= next.startMs - 10 * 60 * 1000 : false;

  // 🔴 "Sin sesiones programadas" no distingue entre dos coaches muy
  // distintos: uno con historial que está en un bache entre reservas (para
  // ese, "Ver reservas" tiene sentido) y uno que TODAVÍA NUNCA tuvo una
  // sesión — y a ese último enviarlo a una lista vacía es un callejón, justo
  // cuando es el que más ayuda necesita. `hasAnyBookingEver` (ver más arriba)
  // es la señal de "nunca pasó nada todavía" — ya solo se evalúa dentro de la
  // rama `!next` del ternario de abajo, así que no hace falta repetir esa
  // condición acá.
  const esCoachNuevo = !hasAnyBookingEver;

  // ── El lugar que ocupa en cada puerta ───────────────────────────────────
  // 🔴 Reemplaza al conteo "Aparecés en N puertas". Ese número se derivaba de
  // los temas elegidos, así que solo se movía cuando el coach editaba sus temas
  // — y encima subía tildando más temas, premiando amplitud. El lugar, en
  // cambio, se mueve solo: entra un rival, sube una reseña, cambia la mediana
  // de precio de la puerta.
  //
  // Va en un efecto aparte y DESPUÉS del primer pintado a propósito: cuesta
  // siete consultas más el catálogo (`loadVisibilitySelf`), y la Home no puede
  // esperar a eso para dibujarse. Mientras no llegó, la tarjeta no miente:
  // muestra el estado bloqueante —que ya vino barato con `visibilityTeaser`— o
  // una línea sin número.
  //
  // ⚠️ No corre si está bloqueado: ahí el titular es que no aparece, y calcular
  // en qué lugar entraría sería trabajo tirado.
  const visibilityLista = !!visibility;
  const visibilityBloqueada = !!visibility?.blocked;
  useEffect(() => {
    if (!user || esCoachNuevo || !visibilityLista || visibilityBloqueada) { setStanding(null); return; }
    let vivo = true;
    (async () => {
      const cargado = await loadVisibilitySelf(user.id);
      if (!vivo || !cargado) return;
      setStanding(homeStanding(analyzeDoors(cargado.self, cargado.pool)));
    })();
    return () => { vivo = false; };
  }, [user, esCoachNuevo, visibilityLista, visibilityBloqueada]);

  const prepPuertas = doorLabels.length > 0;
  const prepDoneCount = [prepPerfil, prepPuertas, prepRecurso].filter(Boolean).length;
  const prepMissing = 3 - prepDoneCount;
  // La primera acción pendiente, en el mismo orden que se muestra el
  // checklist — es la que ofrece el botón de abajo.
  const prepNextAction: { label: string; route: string } | null =
    !prepPerfil ? { label: 'Completar mi perfil', route: '/perfil' } :
    !prepPuertas ? { label: 'Elegir mis temas', route: '/coach-topics' } :
    !prepRecurso ? { label: 'Subir un recurso', route: '/coach-recurso-nuevo' } :
    null;

  if (loading) {
    return (
      <AppBg>
        <SafeAreaView style={s.safe} edges={['top']}>
          <View style={s.loadingBox}><ActivityIndicator size="small" color={FOREST} /></View>
        </SafeAreaView>
      </AppBg>
    );
  }

  return (
    <AppBg>
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={s.container}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={FOREST} colors={[FOREST]} />}>

          {/* Header */}
          <View style={s.header}>
            {/* numberOfLines+ellipsizeMode de más: un nombre largo y sin
                espacios (el bug del 27/08/2026, `profiles.name` heredando el
                alias del mail) envolvía a varias líneas con la fuente de 28px
                y empujaba los íconos de la derecha fuera de eje. La causa de
                fondo ya se arregló en `CoachLoginScreen`, esto es defensivo
                para cualquier nombre real igual de largo. */}
            <Text style={s.hello} numberOfLines={1} ellipsizeMode="tail">Hola, {coachName || '—'}</Text>
            <View style={s.headerRight}>
              <TouchableOpacity onPress={() => router.push('/coach-notifications')} activeOpacity={0.7} hitSlop={8} style={s.bellBtn}>
                <Feather name="bell" size={22} color={FOREST} />
                {unreadCount > 0 && <View style={s.bellDot} />}
              </TouchableOpacity>
              {/* Ajustes de la APP — separado del avatar a propósito. El avatar
                  lleva al PERFIL (cómo te ven, cuánto cobrás, cuándo atendés) y
                  el engranaje a la CUENTA (datos, legales, cerrar sesión, baja).
                  Antes el avatar era el único acceso a las dos cosas, sin
                  etiqueta, y la mitad de esa configuración directamente no
                  existía: el coach no tenía forma de llegar a los Términos ni de
                  darse de baja. */}
              <TouchableOpacity onPress={() => router.push('/coach-ajustes')} activeOpacity={0.7} hitSlop={8} style={s.bellBtn}>
                <Feather name="settings" size={21} color={FOREST} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/perfil')} activeOpacity={0.85} hitSlop={8}>
                <LinearGradient colors={[TERRA, '#A5583B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatar}>
                  <Text style={s.avatarTxt}>{getInitials(coachName || '?')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tu semana */}
          <TouchableOpacity style={s.week} activeOpacity={0.9} onPress={() => router.push('/coach-agenda')}>
            {weekData.map((d, i) => (
              <View key={i} style={[s.wd, d.isToday && s.wdToday]}>
                <Text style={[s.wdAbbr, d.isToday && s.wdAbbrToday]}>{d.abbr}</Text>
                <View style={[s.wdCircle, d.count > 0 && s.wdCircleHas, d.isToday && s.wdCircleToday]}>
                  {d.count > 0 && <Text style={s.wdCount}>{d.count}</Text>}
                </View>
              </View>
            ))}
          </TouchableOpacity>

          {/* Tu próxima sesión */}
          {next ? (
            <View style={s.next}>
              <View style={s.nextGlow} pointerEvents="none" />
              <Text style={s.eyebrow}>Tu próxima sesión</Text>
              <View style={s.who}>
                {next.avatarUrl ? (
                  <Image source={{ uri: next.avatarUrl }} style={s.whoAv} />
                ) : (
                  <View style={[s.whoAv, s.whoAvFallback]}><Text style={s.whoAvTxt}>{next.initials}</Text></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.whoName}>{next.userName}</Text>
                  <Text style={s.whoSub}>{next.dateLabel} · {next.timeStr} hs · videollamada · {next.ordinal}</Text>
                </View>
              </View>
              <View style={s.acts}>
                <TouchableOpacity
                  style={[s.actBtn, s.actJoin, !canJoin && s.actDisabled]}
                  activeOpacity={0.85}
                  disabled={!canJoin}
                  onPress={() => next.salaId
                    ? router.push({ pathname: '/sala', params: { sala_id: next.salaId } })
                    : router.push('/sala')}>
                  <Text style={s.actJoinTxt}>{canJoin ? 'Unirse' : 'Se habilita 10 min antes'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.actBtn, s.actPrep]} activeOpacity={0.85} onPress={() => setPrepOpen(o => !o)}>
                  <Text style={s.actPrepTxt}>Preparar sesión</Text>
                </TouchableOpacity>
              </View>

              {prepOpen && (
                <View style={s.prep}>
                  <Text style={s.prepLine}>
                    <Text style={s.prepB}>Última sesión: </Text>
                    {prep?.lastDaysAgo == null ? 'primera sesión juntos' : `hace ${prep.lastDaysAgo} ${prep.lastDaysAgo === 1 ? 'día' : 'días'}`}
                  </Text>
                  {/* 🔴 Tendencia de ánimo. Va DENTRO de "Preparar sesión" y no
                      suelto en la Home: es información para llegar mejor a esta
                      sesión, no un panel para mirar a la gente.

                      Se dice en palabras y no con el número crudo: "viene
                      bajoneada" es lo que el coach necesita saber; "promedio
                      2,4" invita a tratarlo como un score. Y se aclara sobre
                      cuántos días, para que no se lea como un diagnóstico. */}
                  {prep?.animo && (
                    <Text style={[s.prepLine, { marginTop: 8 }]}>
                      <Text style={s.prepB}>Cómo viene: </Text>
                      {prep.animo.promedio <= 2.4 ? 'con el ánimo bajo'
                        : prep.animo.promedio >= 3.6 ? 'con buen ánimo'
                        : 'con el ánimo parejo'}
                      {prep.animo.direccion === 'sube' ? ', y mejorando'
                        : prep.animo.direccion === 'baja' ? ', y cayendo' : ''}
                      <Text style={s.prepSoft}>
                        {`  ·  ${prep.animo.diasConRegistro} registros en 14 días`}
                      </Text>
                    </Text>
                  )}

                  {prep && prep.resources.length > 0 && (
                    <>
                      <Text style={[s.prepB, { marginTop: 8 }]}>Recursos que le mandaste:</Text>
                      {prep.resources.map(r => (
                        <View key={r.id} style={s.prepRes}>
                          <Text style={r.opened ? s.prepOk : s.prepWarn} numberOfLines={1}>
                            {r.opened ? '✓' : '✗'} {r.title}{r.opened ? ' — abierto' : ' — sin abrir'}
                          </Text>
                        </View>
                      ))}
                    </>
                  )}
                </View>
              )}
            </View>
          ) : esCoachNuevo ? (
            // Coach que TODAVÍA no recibió ninguna reserva (`hasAnyBookingEver`
            // arriba). Reemplaza a la tarjeta de la sesión 139 (solo mostraba
            // "Ya aparecés en N puertas") por el checklist completo — spec
            // `coach-estados-vacios.html`. Desaparece sola apenas entra la
            // primera reserva, sin importar en qué estado quede.
            <SurfaceCard variant="elevated" tone="light" style={s.prepCard}>
              <View style={s.prepCardInner}>
                <Text style={s.prepEyebrow}>Antes de tu primera sesión</Text>
                <Text style={s.prepTitle}>
                  {prepMissing <= 1 ? 'Estás casi listo para recibir' : 'Preparemos tu perfil'}
                </Text>

                <View style={s.progWrap}>
                  <View style={s.progBar}>
                    <View style={[s.progFill, { width: `${(prepDoneCount / 3) * 100}%` }]} />
                  </View>
                  <View style={s.progLbl}>
                    <Text style={s.progLblTxt}><Text style={s.progLblB}>{prepDoneCount} de 3</Text> pasos completos</Text>
                    <Text style={s.progLblTxt}>{prepMissing === 0 ? 'Completo' : `Falta ${prepMissing}`}</Text>
                  </View>
                </View>

                <View style={s.checkRow}>
                  <View style={[s.checkBox, prepPerfil ? s.checkBoxDone : s.checkBoxTodo]}>
                    {prepPerfil && <Feather name="check" size={11} color="#F3EEDF" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.checkLabel}>Perfil completo</Text>
                    <Text style={s.checkSub}>Foto, bio y especialidades</Text>
                  </View>
                </View>

                <View style={[s.checkRow, { marginTop: 13 }]}>
                  <View style={[s.checkBox, prepPuertas ? s.checkBoxDone : s.checkBoxTodo]}>
                    {prepPuertas && <Feather name="check" size={11} color="#F3EEDF" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.checkLabel}>
                      {prepPuertas
                        ? `Aparecés en ${doorLabels.length} ${doorLabels.length === 1 ? 'puerta' : 'puertas'}`
                        : 'Elegí en qué puertas aparecer'}
                    </Text>
                  </View>
                </View>
                <View style={s.doorChips}>
                  {doorLabels.map(label => (
                    <View key={label} style={s.doorChip}><Text style={s.doorChipTxt}>{label}</Text></View>
                  ))}
                  <TouchableOpacity style={s.doorChipAdd} activeOpacity={0.7} onPress={() => router.push('/coach-topics')}>
                    <Text style={s.doorChipAddTxt}>+ agregar</Text>
                  </TouchableOpacity>
                </View>

                <View style={[s.checkRow, { marginTop: 13 }]}>
                  <View style={[s.checkBox, prepRecurso ? s.checkBoxDone : s.checkBoxTodo]}>
                    {prepRecurso && <Feather name="check" size={11} color="#F3EEDF" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.checkLabel}>Subir tu primer recurso</Text>
                    <Text style={s.checkSub}>Los coaches con recursos reciben más reservas</Text>
                  </View>
                </View>

                {prepNextAction && (
                  <TouchableOpacity
                    style={s.prepBtn}
                    activeOpacity={0.85}
                    onPress={() => router.push({ pathname: prepNextAction.route as any, params: prepNextAction.route === '/coach-recurso-nuevo' ? { coach_id: coachId } : undefined })}>
                    <Text style={s.prepBtnTxt}>{prepNextAction.label}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </SurfaceCard>
          ) : (
            <View style={s.nextEmpty}>
              <Text style={s.nextEmptyTxt}>Sin sesiones programadas</Text>
              <TouchableOpacity style={s.nextEmptyBtn} activeOpacity={0.85} onPress={() => router.navigate('/reservas')}>
                <Text style={s.nextEmptyBtnTxt}>Ver reservas</Text>
              </TouchableOpacity>
            </View>
          )}

          {esCoachNuevo && (
            <View style={s.prepQuietRow}>
              <View style={s.prepQuietDot} />
              <Text style={s.prepQuietTxt}>Cuando llegue tu primera reserva, esta card se va sola</Text>
            </View>
          )}

          {/* ── La sesión que pasó y no cerraste ──────────────────────────
              Va después de la próxima sesión y antes del resto: mira para
              atrás, pero para atrás RECIENTE, así que sigue siendo del día. */}
          {sinCerrar && (
            <TouchableOpacity
              style={s.notaCard}
              activeOpacity={0.9}
              onPress={() => router.push({
                pathname: '/sala',
                params: { sala_id: sinCerrar.salaId, abrir_notas: '1' },
              })}>
              <View style={s.notaIcon}>
                <Feather name="edit-3" size={15} color={FOREST} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.notaTitle}>
                  {sinCerrar.dias === 0
                    ? `Hoy tuviste sesión con ${sinCerrar.name}`
                    : sinCerrar.dias === 1
                      ? `Ayer tuviste sesión con ${sinCerrar.name}`
                      : `Hace ${sinCerrar.dias} días tuviste sesión con ${sinCerrar.name}`}
                </Text>
                <Text style={s.notaTxt}>¿Le dejás algo escrito para esta semana?</Text>
              </View>
              <Feather name="chevron-right" size={16} color={FOREST_SOFT} />
            </TouchableOpacity>
          )}

          {/* ── Quién se está cayendo ─────────────────────────────────────
              🔴 El bloque que contesta la pregunta que la app no contestaba:
              "¿a quién hace mucho que no veo?". Hasta acá había reservas y
              chats —dos vistas de eventos sueltos— y ninguna forma de ver una
              RELACIÓN enfriándose.

              Va ARRIBA de la tarjeta de visibilidad a propósito: recuperar a
              alguien que ya te eligió es más barato y más probable que
              conseguir a alguien nuevo. */}
          {seCaen.length > 0 && (
            <View style={s.caenWrap}>
              <Text style={s.caenTitle}>Hace rato que no los ves</Text>
              {seCaen.map(p => (
                <View key={p.userId} style={s.caenRow}>
                  {p.avatarUrl ? (
                    <Image source={{ uri: p.avatarUrl }} style={s.caenAv} />
                  ) : (
                    <View style={[s.caenAv, s.caenAvFallback]}>
                      <Text style={s.caenInitials}>{getInitials(p.name)}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={s.caenName} numberOfLines={1}>{p.name}</Text>
                    <Text style={s.caenMeta} numberOfLines={1}>
                      {haceCuanto(p.diasSinVerse)}
                      {p.sesiones > 1 && ` · ${p.sesiones} sesiones juntos`}
                      {p.cadenciaDias != null && p.cadenciaDias <= 10 && ' · venía seguido'}
                    </Text>
                  </View>
                  {/* Sin sala no hay a dónde ir: la conversación nace de una
                      reserva, así que si no existe no se ofrece un botón muerto. */}
                  {p.salaId && (
                    <TouchableOpacity
                      style={s.caenBtn}
                      activeOpacity={0.85}
                      onPress={() => router.push({ pathname: '/sala', params: { sala_id: p.salaId } })}>
                      <Text style={s.caenBtnTxt}>Escribirle</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Cómo aparecer en Conexiones — no se repite si `esCoachNuevo` ya
              mostró exactamente esto mismo, reencuadrado, en la tarjeta de
              arriba (`s.newCoachCard`). */}
          {visibility && !esCoachNuevo && (
            <TouchableOpacity style={s.vis} activeOpacity={0.85} onPress={() => router.push('/coach-visibilidad')}>
              <View style={[s.visIcon, visibility.blocked && s.visIconWarn]}>
                <Feather name={visibility.blocked ? 'alert-circle' : 'compass'} size={16} color={visibility.blocked ? TERRA : FOREST} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.visTitle}>
                  {visibility.blocked
                    ? 'Hoy no te encuentran'
                    : tituloVisibilidad(standing)}
                </Text>
                <Text style={s.visTxt} numberOfLines={2}>
                  {visibility.blocked ? visibility.blocked.hint : bajadaVisibilidad(standing)}
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={FOREST_SOFT} />
            </TouchableOpacity>
          )}

          {/* ── Lo que construiste acá ─────────────────────────────────────
              🔴 Va ÚLTIMO a propósito: no es accionable, es el cierre. Y va
              JUNTO con la comisión, no separado, porque separados los dos
              pierden. "El 60% vuelve" solo es una palmada; "el 60% vuelve, y
              cuando vuelve te cobramos menos" es el argumento entero — la
              medida anti-fuga #3, pendiente desde el 06/08/2026.

              El encuadre que funciona NO es "baja por volumen" sino "te
              cobramos por presentarte, no por tu relación". Dicho al lado de su
              propio número de recompra, es donde más se entiende. */}
          {repu && repu.completadas > 0 && (
            <View style={s.repuWrap}>
              <Text style={s.repuEyebrow}>LO QUE CONSTRUISTE ACÁ</Text>
              <View style={s.repuRow}>
                <View style={s.repuItem}>
                  <Text style={s.repuNum}>{repu.completadas}</Text>
                  <Text style={s.repuLbl}>
                    {repu.completadas === 1 ? 'sesión cumplida' : 'sesiones cumplidas'}
                  </Text>
                </View>
                {repu.vuelvenPct != null && (
                  <View style={s.repuItem}>
                    <Text style={s.repuNum}>{repu.vuelvenPct}%</Text>
                    <Text style={s.repuLbl}>de tus personas vuelve</Text>
                  </View>
                )}
              </View>
              <Text style={s.repuNota}>
                Y cuando vuelven te cobramos menos: {COMMISSION_LOCAL_FIRST}% la primera sesión
                con cada persona, {COMMISSION_LOCAL_RECURRING}% de ahí en adelante, y no se
                reinicia nunca.{' '}
                <Text style={s.repuNotaB}>Te cobramos por presentarte a alguien, no por tu
                relación con esa persona.</Text>
              </Text>
            </View>
          )}

          <View style={{ height: TAB_BAR_CLEARANCE + 16 }} />
        </ScrollView>
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 12 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  hello: { fontFamily: ViveFonts.title, fontSize: 28, color: FOREST, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  bellBtn: { padding: 2 },
  bellDot: {
    position: 'absolute', top: 0, right: 0, width: 9, height: 9, borderRadius: 5,
    backgroundColor: TERRA, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)',
  },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontFamily: ViveFonts.bold, fontSize: 13, color: '#FFF3E8' },

  // Semana
  week: {
    marginTop: 14, backgroundColor: CARD, borderWidth: 1, borderColor: LINE,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 13,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  wd: { alignItems: 'center' },
  wdToday: {},
  wdAbbr: { fontSize: 10, color: FOREST_SOFT, fontFamily: ViveFonts.regular },
  wdAbbrToday: { color: FOREST, fontFamily: ViveFonts.semibold },
  wdCircle: {
    width: 26, height: 26, borderRadius: 13, marginTop: 5,
    alignItems: 'center', justifyContent: 'center', backgroundColor: CREAM_DEEP,
  },
  wdCircleHas: { backgroundColor: TERRA },
  wdCircleToday: { borderWidth: 1.5, borderColor: FOREST },
  wdCount: { fontSize: 10.5, fontFamily: ViveFonts.semibold, color: '#FFF6EC' },

  // Próxima sesión (verde)
  next: { marginTop: 14, backgroundColor: '#3E4E2C', borderRadius: 24, padding: 17, overflow: 'hidden' },
  nextGlow: {
    position: 'absolute', right: -40, top: -46, width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(234,211,198,0.10)',
  },
  eyebrow: { fontSize: 10.5, letterSpacing: 0.8, textTransform: 'uppercase', color: GREEN_EYEBROW, fontFamily: ViveFonts.medium },
  who: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 10 },
  whoAv: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#55663F' },
  whoAvFallback: { alignItems: 'center', justifyContent: 'center' },
  whoAvTxt: { fontFamily: ViveFonts.bold, fontSize: 14, color: '#FFF3E8' },
  whoName: { fontFamily: ViveFonts.titleSemiBold, fontSize: 17, color: GREEN_TXT },
  whoSub: { fontSize: 11, color: GREEN_EYEBROW, fontFamily: ViveFonts.regular, marginTop: 2 },
  acts: { flexDirection: 'row', gap: 8, marginTop: 13 },
  actBtn: { flex: 1, borderRadius: 15, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  actJoin: { backgroundColor: TERRA },
  actJoinTxt: { fontSize: 12, fontFamily: ViveFonts.semibold, color: '#FFF6EC' },
  actDisabled: { backgroundColor: 'rgba(192,107,74,0.45)' },
  actPrep: { backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  actPrepTxt: { fontSize: 12, fontFamily: ViveFonts.semibold, color: GREEN_TXT },
  prep: { marginTop: 11, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 13 },
  prepLine: { fontSize: 11.5, color: '#E9E4D2', lineHeight: 18, fontFamily: ViveFonts.regular },
  prepB: { color: GREEN_TXT, fontFamily: ViveFonts.semibold, fontSize: 11.5 },
  prepRes: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  prepOk: { color: '#C9DFA9', fontSize: 11.5, fontFamily: ViveFonts.regular, flexShrink: 1 },
  prepSoft: { fontFamily: ViveFonts.regular, fontSize: 11, color: FOREST_SOFT, opacity: 0.85 },
  prepWarn: { color: TERRA_SOFT, fontSize: 11.5, fontFamily: ViveFonts.regular, flexShrink: 1 },

  nextEmpty: {
    marginTop: 14, backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 20,
    padding: 18, alignItems: 'center', gap: 12,
  },
  nextEmptyTxt: { fontSize: 13.5, color: FOREST_SOFT, fontFamily: ViveFonts.medium },
  nextEmptyBtn: { backgroundColor: FOREST, borderRadius: 15, paddingVertical: 10, paddingHorizontal: 22 },
  nextEmptyBtnTxt: { color: GREEN_TXT, fontSize: 12.5, fontFamily: ViveFonts.semibold },

  // Card de preparación (`esCoachNuevo`) — spec `coach-estados-vacios.html`.
  // Reemplaza a la tarjeta de una línea de la sesión 139 por el checklist
  // completo: barra de progreso + 3 pasos + chips de puertas + botón de la
  // próxima acción.
  prepCard: { marginTop: 14 },
  prepCardInner: { padding: 20 },
  prepEyebrow: {
    fontSize: 10, fontFamily: ViveFonts.bold, letterSpacing: 1.1, textTransform: 'uppercase', color: TERRA,
  },
  prepTitle: { fontFamily: ViveFonts.titleSemiBold, fontSize: 18, color: FOREST, marginTop: 7 },

  progWrap: { marginTop: 14 },
  progBar: { height: 6, borderRadius: 4, backgroundColor: CREAM_DEEP, overflow: 'hidden' },
  progFill: { height: '100%', borderRadius: 4, backgroundColor: FOREST_SOFT },
  progLbl: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  progLblTxt: { fontSize: 11, color: FOREST_SOFT, fontFamily: ViveFonts.regular },
  progLblB: { color: FOREST, fontFamily: ViveFonts.semibold },

  checkRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  checkBox: {
    width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  checkBoxDone: { backgroundColor: FOREST },
  checkBoxTodo: { borderWidth: 1.5, borderColor: LINE },
  checkLabel: { fontSize: 12.5, fontFamily: ViveFonts.semibold, color: FOREST },
  checkSub: { fontSize: 11, color: FOREST_SOFT, fontFamily: ViveFonts.regular, marginTop: 1 },

  doorChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7, marginLeft: 30 },
  doorChip: { backgroundColor: OK_BG, borderRadius: 11, paddingVertical: 5, paddingHorizontal: 10 },
  doorChipTxt: { fontSize: 10.5, fontFamily: ViveFonts.semibold, color: OK_INK },
  doorChipAdd: { borderWidth: 1.5, borderColor: LINE, borderStyle: 'dashed', borderRadius: 11, paddingVertical: 5, paddingHorizontal: 10 },
  doorChipAddTxt: { fontSize: 10.5, fontFamily: ViveFonts.semibold, color: FOREST_SOFT },

  prepBtn: { alignSelf: 'flex-start', marginTop: 15, backgroundColor: FOREST, borderRadius: 16, paddingVertical: 11, paddingHorizontal: 18 },
  prepBtnTxt: { fontSize: 12.5, fontFamily: ViveFonts.semibold, color: GREEN_TXT },

  prepQuietRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  prepQuietDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: OK_BG },
  prepQuietTxt: { fontSize: 12, color: FOREST_SOFT, fontFamily: ViveFonts.regular },

  // Cómo aparecer en Conexiones
  notaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 14,
    marginTop: 14,
  },
  notaIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: CREAM_DEEP,
    alignItems: 'center', justifyContent: 'center',
  },
  notaTitle: { fontFamily: ViveFonts.semibold, fontSize: 14, color: FOREST },
  notaTxt: { fontFamily: ViveFonts.regular, fontSize: 12, color: FOREST_SOFT, marginTop: 2 },

  repuWrap: {
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
    gap: 12,
  },
  repuEyebrow: {
    fontFamily: ViveFonts.bold,
    fontSize: 10,
    letterSpacing: 1.1,
    color: FOREST_SOFT,
  },
  repuRow: { flexDirection: 'row', gap: 24 },
  repuItem: { flexShrink: 1 },
  repuNum: { fontFamily: ViveFonts.title, fontSize: 26, color: FOREST },
  repuLbl: { fontFamily: ViveFonts.regular, fontSize: 12, color: FOREST_SOFT, marginTop: 2 },
  repuNota: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: FOREST_SOFT,
  },
  repuNotaB: { fontFamily: ViveFonts.semibold, color: FOREST },

  caenWrap: {
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
    gap: 12,
  },
  caenTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: FOREST,
  },
  caenRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  caenAv: { width: 38, height: 38, borderRadius: 19 },
  caenAvFallback: { backgroundColor: CREAM_DEEP, alignItems: 'center', justifyContent: 'center' },
  caenInitials: { fontFamily: ViveFonts.semibold, fontSize: 13, color: FOREST },
  caenName: { fontFamily: ViveFonts.semibold, fontSize: 14, color: FOREST },
  caenMeta: { fontFamily: ViveFonts.regular, fontSize: 12, color: FOREST_SOFT, marginTop: 1 },
  caenBtn: {
    backgroundColor: TERRA,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  caenBtnTxt: { fontFamily: ViveFonts.semibold, fontSize: 12, color: '#F7EFE4' },

  vis: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, padding: 15,
    backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 20,
  },
  visIcon: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: CREAM_DEEP,
  },
  visIconWarn: { backgroundColor: TERRA_SOFT },
  visTitle: { fontFamily: ViveFonts.semibold, fontSize: 13, color: FOREST },
  visTxt: { fontFamily: ViveFonts.regular, fontSize: 11.5, color: FOREST_SOFT, lineHeight: 17, marginTop: 3 },
});
