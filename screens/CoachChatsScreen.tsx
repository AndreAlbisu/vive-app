import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
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
import { todayInAr } from '@/lib/time';
import { agruparRoster, chipProxima, filtrarRoster, textoHistoria, type FiltroRoster } from '@/lib/coachRoster';
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
// 📝 `RES_BG` salió con las pastillas: el fondo de la etiqueta "RECURSO" ya no
// se usa en ningún lado. `RES_INK` sobrevive como color del punto.
const RES_INK = '#8F4A2E';

type Tag = 'accepted' | 'resource' | null;

/** El orden es de más amplio a más acotado. "No leídas" va segunda —y solo
 *  aparece si hay alguna— porque es la única que responde a algo que pasó
 *  recién; las otras dos describen el estado de la relación. */
const FILTROS: { id: FiltroRoster; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'noleidas', label: 'No leídas' },
  { id: 'agendadas', label: 'Agendadas' },
  { id: 'sinproxima', label: 'Sin próxima' },
];

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
  /** Lo que el coach decidió a mano (null = nunca opinó, manda la regla). Viaja
   *  en la fila porque el parche en vivo tiene que poder recalcular `archived`
   *  cuando entra un mensaje nuevo, y para eso necesita saber si lo de hoy
   *  salió de la regla o de una decisión suya — que gana siempre. */
  decidido: boolean | null;
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

/** Lo mínimo del último mensaje para pintar una fila. Coincide con lo que
 *  devuelve `get_last_messages_per_sala` Y con lo que llega por realtime. */
type UltimoMsg = { content: string; sender_type: string; metadata: unknown; created_at: string };

/**
 * Etiqueta y preview de una fila a partir de su último mensaje.
 *
 * 🔴 Vive acá afuera porque la usan DOS caminos: la carga inicial y el parche en
 * vivo cuando entra un mensaje con la pantalla abierta. Duplicada, los dos
 * podrían pintar la misma conversación distinto según cómo te enteraste.
 */
function armarPreview(m: UltimoMsg | null, abierto: boolean): { tag: Tag; preview: string } {
  if (!m) return { tag: null, preview: 'Sin mensajes aún' };

  const meta = (m.metadata as ResourceMeta | null) ?? null;
  if (meta?.type === 'resource') {
    return { tag: 'resource', preview: `Vos: ${meta.resource_title ?? 'recurso'} · ${abierto ? 'abierto ✓' : 'sin abrir'}` };
  }

  if (m.sender_type === 'system_confirmed') {
    // El content es "Sesión reservada · fecha · hora\n{motivo}". Mostramos el motivo si hay.
    const motivo = decryptMessage(m.content).split('\n')[1]?.trim();
    return { tag: 'accepted', preview: motivo ? `«${motivo}»` : 'Sesión aceptada' };
  }

  // 🔴 "Vos:" cuando el último mensaje es del coach. Sin esto, "dale, nos vemos
  // el jueves" se ve igual lo haya dicho él o la otra persona — y son dos
  // situaciones opuestas: una está cerrada y la otra lo está esperando. Hoy hay
  // que abrir la sala para saber cuál es. El caso del recurso ya lo hacía.
  const texto = decryptMessage(m.content);
  return { tag: null, preview: m.sender_type === 'coach' ? `Vos: ${texto}` : texto };
}

/** Regla automática de archivado: murió en un mensaje del sistema y ya pasó un
 *  mes. Acá afuera por lo mismo que `armarPreview` — la evalúan los dos caminos. */
function archivadoPorRegla(m: UltimoMsg | null, corteMs: number): boolean {
  if (!m) return false;
  return (m.sender_type === 'system' || m.sender_type === 'system_cancelled')
    && new Date(m.created_at).getTime() < corteMs;
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '??';
}

/** El nombre propio va con mayúscula. Los perfiles guardan lo que la persona
 *  escribió al registrarse y ahí entra "andre" en minúscula; en una pantalla
 *  que es un directorio de gente, eso se lee como descuido. */
function capitalizar(name: string): string {
  return name.replace(/(^|\s)(\p{Ll})/gu, (_, sep: string, c: string) => sep + c.toUpperCase());
}

export default function CoachChatsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const { unreadSalaIds } = useUnreadSalas({ userId: user?.id ?? null, role: 'coach' });

  // 🔴 Buscador y filtros están acá y NO en "Mensajes" del lado usuario, y la
  // razón es la escala, que es opuesta en las dos apps: un profesional puede
  // tener 10 o 20 pacientes activos a la vez, mientras que una persona
  // difícilmente pase de 4 profesionales. Los mismos controles sobre cuatro
  // filas serían adorno; sobre veinte son la diferencia entre encontrar a
  // alguien y scrollear. Del lado usuario, ese espacio se resuelve con aire
  // (ver `LISTA_AIRE` en SessionsScreen).
  //
  // 📝 De paso empujan la primera fila fuera del borde superior, que es donde
  // el pulgar no llega — pero eso es la CONSECUENCIA, no el motivo: rellenar
  // por rellenar habría sido padding con otro nombre.
  //
  // ⚠️ Se tomó el orden de WhatsApp menos una cosa: allá Archivados va arriba,
  // acá va al pie. Ver el comentario en el render.
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<FiltroRoster>('todas');

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
      const m = (l.lastMsg as UltimoMsg | null) ?? null;
      const meta = (m?.metadata as ResourceMeta | null) ?? null;
      const at = m ? m.created_at : null;

      const abierto = meta?.recommendation_id ? openedMap[meta.recommendation_id] : false;
      const { tag, preview } = armarPreview(m, abierto);
      const porRegla = archivadoPorRegla(m, thirtyDaysAgo);
      // 🔴 Lo que el coach decidió GANA, en las dos direcciones: archivar algo
      // vivo y rescatar algo que la regla se llevó. Por eso `decidido` es de
      // tres estados y no un booleano — con dos, "todavía no opinó" y "quiere
      // verlo activo" serían lo mismo y la regla no correría nunca.
      const archived = l.decidido ?? porRegla;

      return {
        salaId: l.salaId,
        userName: capitalizar(name),
        initials: getInitials(name),
        avatarUrl: profileMap[l.userId]?.avatarUrl ?? null,
        tag,
        preview,
        lastMessageAt: at,
        hasUnread: unreadSalaIds.has(l.salaId),
        archived,
        decidido: l.decidido ?? null,
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

  // ── Mensajes en vivo ──────────────────────────────────────────────────────
  // 🔴 Antes la lista solo se recargaba al ENFOCAR la pantalla: si llegaba un
  // mensaje con la pantalla abierta no pasaba nada — ni subía la fila, ni
  // cambiaba el preview, ni aparecía el punto. Y el layout del coach sí escucha
  // en vivo, así que se prendía el puntito de la pestaña donde ya estabas
  // parado, con la lista de abajo sin enterarse.
  //
  // Parchea la fila en el lugar en vez de recargar: recargar son cuatro
  // consultas y un parpadeo, y acá ya tenemos todo lo que hace falta en el
  // propio evento.
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`coach-chats-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const nuevo = payload.new as { sala_id?: string } & UltimoMsg;
        if (!nuevo?.sala_id) return;

        setRooms(prev => {
          // ⚠️ El filtro es del lado del cliente porque `postgres_changes` no
          // filtra por "está en esta lista de salas". Si la sala no es de esta
          // pantalla, se sale sin tocar el estado — y de paso, una conversación
          // NUEVA aparece recién al volver a enfocar, que es aceptable: nace de
          // una reserva, no de un mensaje suelto.
          if (!prev.some(r => r.salaId === nuevo.sala_id)) return prev;

          const corte = Date.now() - 30 * 24 * 60 * 60 * 1000;
          const parcheadas = prev.map(r => {
            if (r.salaId !== nuevo.sala_id) return r;
            const { tag, preview } = armarPreview(nuevo, false);
            return {
              ...r,
              tag,
              preview,
              lastMessageAt: nuevo.created_at,
              // 📝 Se marca acá y no vía `useUnreadSalas`, que solo refresca al
              // enfocar. Un mensaje propio (mandado desde otro lado) no lo
              // prende, que es lo correcto.
              hasUnread: nuevo.sender_type === 'user' ? true : r.hasUnread,
              // Lo que el coach decidió gana; si nunca opinó, un mensaje nuevo
              // saca la conversación de archivados sola.
              archived: r.decidido ?? archivadoPorRegla(nuevo, corte),
            };
          });

          return parcheadas.sort((a, b) => {
            if (!a.lastMessageAt) return 1;
            if (!b.lastMessageAt) return -1;
            return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
          });
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const active = rooms.filter(r => !r.archived);
  const archived = rooms.filter(r => r.archived);

  const hoy = todayInAr();
  const visibles = filtrarRoster(active, filtro, busqueda);
  const { agendadas, sinProxima } = agruparRoster(visibles);
  // Los encabezados solo aparecen si los dos grupos tienen gente. Con una sola
  // persona serían decoración: un rótulo sobre una lista de uno no clasifica
  // nada, solo agrega ruido arriba de la fila.
  const conRotulos = agendadas.length > 0 && sinProxima.length > 0;

  /**
   * Una persona.
   *
   * 🔴 La jerarquía la lleva la SUPERFICIE y no un color más: quien tiene
   * sesión agendada va en tarjeta con sombra, quien no, en tarjeta plana con
   * borde. Antes las dos eran la misma caja y el estado de la relación solo se
   * podía leer en la línea más chica de todas.
   */
  function renderRoom(room: ChatRoom, opts?: { plana?: boolean; dimmed?: boolean }) {
    const historia = textoHistoria(room, haceCuanto, hoy);
    const chip = room.proximaIso ? chipProxima(room.proximaIso, hoy) : null;

    return (
      <TouchableOpacity
        key={room.salaId}
        style={[s.chat, opts?.plana && s.chatPlana, opts?.dimmed && s.chatDimmed]}
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
          <View style={s.nameRow}>
            <Text style={s.chatName} numberOfLines={1}>{room.userName}</Text>
            {/* El punto de no leído se mudó al lado del nombre: la columna
                derecha ahora es de la próxima sesión. */}
            {room.hasUnread && <View style={s.unread} />}
          </View>

          {!!historia && <Text style={s.relTxt} numberOfLines={1}>{historia}</Text>}

          <View style={s.prev}>
            {/* 🔴 Antes acá iban las pastillas "✓ SESIÓN ACEPTADA" y "RECURSO".
                Las dos repetían lo que el preview ya decía —y la primera dejaba
                el texto cortado a mitad de palabra, "Sesión acepta…"— a cambio
                de media fila. Queda un punto de 6px: mismo aviso, sin robar
                ancho ni decir dos veces lo mismo. */}
            {room.tag && <View style={[s.seed, room.tag === 'resource' && s.seedRes]} />}
            <Text style={[s.prevTxt, room.hasUnread && s.prevTxtUnread]} numberOfLines={1}>{room.preview}</Text>
          </View>
        </View>

        {/* Que la pastilla EXISTA ya es el dato: si está, esa persona está
            agendada. El riel derecho se escanea sin leer una palabra. */}
        {chip && (
          <View style={[s.chip, chip.tipo === 'pronto' && s.chipPronto]}>
            {chip.tipo === 'pronto' ? (
              <Text style={s.chipPromptTxt}>{chip.texto}</Text>
            ) : (
              <>
                <Text style={s.chipDia}>{chip.dia}</Text>
                <Text style={s.chipMes}>{chip.mes}</Text>
              </>
            )}
          </View>
        )}
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
          <ScrollView
            contentContainerStyle={s.container}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">

            <View style={s.buscador}>
              <Feather name="search" size={16} color={FOREST_SOFT} />
              <TextInput
                style={s.buscadorInput}
                value={busqueda}
                onChangeText={setBusqueda}
                placeholder="Buscar una persona"
                placeholderTextColor={FOREST_SOFT}
                returnKeyType="search"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
            </View>

            {/* Los filtros scrollean en horizontal porque son cuatro y el
                ancho de un teléfono angosto no los banca sin achicar la letra
                — misma solución que WhatsApp y Messenger. */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.filtros}>
              {FILTROS.map(f => {
                const activo = filtro === f.id;
                // El conteo solo se muestra donde suma: "No leídas 3" es una
                // razón para tocar, "Todas 7" es un número sin decisión atrás.
                const n = f.id === 'noleidas' ? active.filter(r => r.hasUnread).length : 0;
                if (f.id === 'noleidas' && n === 0) return null;
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[s.pill, activo && s.pillActiva]}
                    onPress={() => setFiltro(f.id)}
                    activeOpacity={0.75}>
                    <Text style={[s.pillTxt, activo && s.pillTxtActiva]}>
                      {f.label}{n > 0 ? ` ${n}` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {conRotulos && <Text style={s.grupo}>Con sesión agendada</Text>}
            {agendadas.map(r => renderRoom(r))}

            {conRotulos && <Text style={[s.grupo, s.grupoSegundo]}>Sin próxima</Text>}
            {sinProxima.map(r => renderRoom(r, { plana: true }))}

            {/* El filtro o la búsqueda pueden dejar la lista en cero teniendo
                gente. Decir qué pasó y cómo salir es lo mínimo — una lista que
                se vacía sin explicación se lee como que se rompió algo. */}
            {visibles.length === 0 && (
              <Text style={s.sinResultados}>
                {busqueda
                  ? `Ninguna persona coincide con «${busqueda.trim()}»`
                  : 'Nadie en este filtro por ahora'}
              </Text>
            )}

            {/* 🔴 Archivados va AL PIE, y acá se separa de WhatsApp a propósito.
                Allá el archivo es un balde chico y estable; acá **crece para
                siempre**: cada paciente que deja de venir termina adentro, así
                que a los dos años es el grupo más grande y el menos relevante
                de la pantalla. Un montón que solo engorda no puede ocupar el
                lugar que se escanea primero. */}
            {archived.length > 0 && (
              <>
                <TouchableOpacity style={s.archLink} activeOpacity={0.7} onPress={() => setShowArchived(v => !v)}>
                  <Feather name="archive" size={16} color={FOREST_SOFT} />
                  <Text style={s.archLinkTxt}>Archivados</Text>
                  {/* Archivar NO silencia. Si alguien archivado escribe, el
                      punto aparece acá: la conversación deja de estar arriba,
                      pero el coach no se pierde a un cliente que lo buscó. Se
                      eligió esto antes que desarchivar solo —como hace el mail—
                      porque deshacer una decisión del coach sin avisarle es
                      peor que un punto de más. */}
                  {archived.some(r => r.hasUnread) && <View style={s.archDot} />}
                  <View style={s.archSpacer} />
                  <Text style={s.archCount}>{archived.length}</Text>
                  <Feather name={showArchived ? 'chevron-up' : 'chevron-down'} size={16} color={FOREST_SOFT} />
                </TouchableOpacity>
                {showArchived && archived.map(r => renderRoom(r, { plana: true, dimmed: true }))}
              </>
            )}

            {/* El gesto no se adivina, pero es una nota al pie — y va al pie.
                Antes salía justo debajo de la lista activa: con dos personas eso
                la dejaba flotando en el centro geométrico de la pantalla, donde
                el ojo la lee como si fuera contenido. */}
            {active.length > 0 && (
              <Text style={s.hintArch}>Mantené presionada una persona para archivarla</Text>
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

  // Rótulo de grupo. Chico y espaciado: clasifica, no compite con los nombres.
  grupo: {
    fontFamily: ViveFonts.titleSemiBold, fontSize: 10.5,
    letterSpacing: 1.1, textTransform: 'uppercase',
    color: FOREST_SOFT, marginLeft: 6, marginBottom: 9,
  },
  grupoSegundo: { marginTop: 22 },

  chat: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    backgroundColor: CARD, borderRadius: 20,
    paddingVertical: 14, paddingHorizontal: 15, marginBottom: 9,
    // Sombra de una capa, con los valores de `shadow.subtle.light` de
    // theme/tokens.ts. El borde al 14% que había antes era invisible sobre el
    // fondo crema: la tarjeta no se leía como objeto, y con dos filas en media
    // pantalla vacía eso es justo lo que se sentía insulso.
    shadowColor: '#2E261A',
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 3,
  },
  // Sin próxima sesión: plana y con borde. La jerarquía la lleva la superficie,
  // así no hace falta un segundo color ni una segunda tipografía.
  chatPlana: {
    backgroundColor: 'rgba(247,242,231,0.55)',
    borderWidth: 1, borderColor: LINE,
    shadowOpacity: 0, elevation: 0,
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

  // 🔴 La escala. Antes eran cinco tamaños entre 9 y 13.5 — cinco roles
  // repartidos en 4,5 puntos, donde el ojo no distingue ninguno y no hay dónde
  // aterrizar. Ahora hay un salto real arriba (16.5, el nombre, que es el ancla
  // de un directorio de gente) y dos niveles abajo que sí conviven en 12.
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  chatName: {
    fontFamily: ViveFonts.titleSemiBold, fontSize: 16.5, color: FOREST,
    letterSpacing: -0.2, flexShrink: 1,
  },
  relTxt: { fontFamily: ViveFonts.medium, fontSize: 12, color: FOREST_SOFT, marginTop: 3 },
  prev: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  prevTxt: { flex: 1, fontSize: 12, color: FOREST_SOFT, fontFamily: ViveFonts.regular },
  prevTxtUnread: { color: FOREST, fontFamily: ViveFonts.medium },
  // Lo que queda de las pastillas: un punto que dice de qué es el último
  // mensaje sin gastar ancho ni repetir el texto que tiene al lado.
  seed: { width: 6, height: 6, borderRadius: 3, backgroundColor: OK_INK, flexShrink: 0 },
  seedRes: { backgroundColor: RES_INK },
  unread: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: TERRA, flexShrink: 0 },

  // La pastilla de la próxima sesión, en la columna que antes gastaba el
  // horario del último mensaje — el dato menos accionable de la fila.
  chip: {
    flexShrink: 0, alignItems: 'center', justifyContent: 'center',
    backgroundColor: OK_BG, borderRadius: 13,
    paddingVertical: 7, paddingHorizontal: 10, minWidth: 46,
  },
  chipPronto: { backgroundColor: FOREST, paddingHorizontal: 12 },
  chipDia: { fontFamily: ViveFonts.title, fontSize: 15, lineHeight: 17, color: OK_INK },
  chipMes: {
    fontFamily: ViveFonts.titleSemiBold, fontSize: 8.5, letterSpacing: 0.9,
    textTransform: 'uppercase', color: OK_INK, opacity: 0.78, marginTop: 2,
  },
  chipPromptTxt: {
    fontFamily: ViveFonts.titleSemiBold, fontSize: 11, letterSpacing: 0.5,
    textTransform: 'uppercase', color: CARD,
  },

  // ── El bloque de arriba de la lista ──────────────────────────────────────
  // Empuja la primera fila a ~215pt del área segura (la zona del pulgar) y cada
  // pieza se gana el lugar a 10-20 pacientes. Orden calcado de WhatsApp.
  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: 'rgba(63,81,47,0.06)', borderRadius: 14,
    paddingHorizontal: 13, height: 44, marginBottom: 12,
  },
  buscadorInput: {
    flex: 1, fontFamily: ViveFonts.regular, fontSize: 14, color: FOREST,
    // Sin esto, en Android el input trae su propio padding vertical y la
    // altura de 44 deja el texto pegado arriba.
    paddingVertical: 0,
  },

  filtros: { flexDirection: 'row', gap: 8, paddingRight: 20, paddingBottom: 14 },
  pill: {
    paddingHorizontal: 14, height: 34, justifyContent: 'center',
    borderRadius: 17, borderWidth: 1, borderColor: LINE,
    backgroundColor: 'rgba(247,242,231,0.5)',
  },
  pillActiva: { backgroundColor: FOREST, borderColor: FOREST },
  pillTxt: { fontFamily: ViveFonts.medium, fontSize: 13, color: FOREST_SOFT },
  pillTxtActiva: { color: CARD, fontFamily: ViveFonts.semibold },

  archLink: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingVertical: 13, paddingHorizontal: 4, marginTop: 10,
    // El separador va ARRIBA: cierra la lista de gente activa en vez de
    // encabezar una sección. Archivados es el pie, no un capítulo.
    borderTopWidth: 1, borderTopColor: LINE,
  },
  archLinkTxt: { fontSize: 13.5, fontFamily: ViveFonts.medium, color: FOREST_SOFT },
  archSpacer: { flex: 1 },
  archCount: { fontSize: 13, fontFamily: ViveFonts.medium, color: FOREST_SOFT },

  sinResultados: {
    fontFamily: ViveFonts.regular, fontSize: 13, color: FOREST_SOFT,
    textAlign: 'center', marginTop: 34, paddingHorizontal: 20, lineHeight: 20,
  },
});
