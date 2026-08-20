import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  BackHandler,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';
import { supabase, registrarEvento } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { sendPushNotification } from '@/lib/notifications';
import { logError } from '@/lib/logging';
import { encryptMessage } from '@/lib/encryption';
import { createOrGetMeetingUrl } from '@/lib/meetingRoom';

const DAY_NAMES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const MONTH_NAMES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
];

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return `${DAY_NAMES[date.getDay()]}, ${day} de ${MONTH_NAMES[month - 1]}`;
}

type Params = {
  name?: string;
  specialty?: string;
  priceFrom?: string;
  date?: string;
  time?: string;
  coachId?: string;
};

export default function BookingScreen_Confirm() {
  const router = useRouter();
  const { user, isLoggedIn, requestAuth } = useAuth();
  const params = useLocalSearchParams<Params>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userMessage, setUserMessage] = useState('');
  const [instantBooking, setInstantBooking] = useState(false);
  const [internacionalDisponible, setInternacionalDisponible] = useState(false);
  const [priceUsd, setPriceUsd] = useState<number | null>(null);
  const [metodoPago, setMetodoPago] = useState<'mp' | 'usdt' | 'paypal'>('mp');
  // Checkout de MP embebido (no WebBrowser/Safari) — ver el comentario largo
  // más abajo, junto a onShouldStartLoadWithRequest, sobre por qué.
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const checkoutUrlRef = useRef<string | null>(null);
  checkoutUrlRef.current = checkoutUrl;

  const coachName = params.name ?? 'Laura Méndez';
  const specialty = params.specialty ?? 'Coach de vida';
  const priceFrom = params.priceFrom ? parseInt(params.priceFrom, 10) : 4500;
  const dateStr = params.date ?? '';
  const time = params.time ?? '';
  // coachId que llega por params es profiles.id (= coaches.profile_id), NO coaches.id
  const coachProfileIdParam = Array.isArray(params.coachId) ? params.coachId[0] : params.coachId;

  // Solo para mostrar el copy correcto antes de confirmar — onConfirm vuelve
  // a leer el flag al momento de reservar, por si cambió mientras tanto.
  useEffect(() => {
    if (!coachProfileIdParam) return;
    (async () => {
      const { data } = await supabase
        .from('coaches')
        .select('instant_booking, accepts_international, price_usd')
        .eq('profile_id', coachProfileIdParam)
        .maybeSingle();
      setInstantBooking(!!data?.instant_booking);
      // Los medios internacionales (USDT y PayPal) solo existen si el coach
      // puede cobrarlos: acepta internacional y fijó su precio en dólares. Sin
      // eso, las dos `*-create-payment` devuelven 409 y la persona vería un
      // error después de reservar. Es la misma condición que usan el filtro de
      // búsqueda y el perfil público — si acá fuera otra, el catálogo prometería
      // algo que esta pantalla no ofrece.
      setInternacionalDisponible(!!data?.accepts_international && !!data?.price_usd);
      setPriceUsd(data?.price_usd ?? null);
    })();
  }, [coachProfileIdParam]);

  // Botón físico de "atrás" en Android mientras el checkout está abierto: lo
  // cierra en vez de sacar a la persona de la pantalla de confirmación por
  // completo (antes esto venía gratis con WebBrowser/Modal).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (checkoutUrlRef.current) {
        setCheckoutUrl(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  async function onConfirm() {
    if (!isLoggedIn || !user) { requestAuth(); return; }
    if (!coachProfileIdParam) {
      setError('No encontramos el profesional. Volvé y elegí de nuevo');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Buscar el coach por su profile_id real (no por specialty — evita reservar con el coach equivocado)
      //    salas.coach_id    → coaches.profile_id (FK a profiles.id)
      //    bookings.coach_id → coaches.id          (FK a coaches.id)
      const { data: coachRow, error: coachErr } = await supabase
        .from('coaches')
        .select('id, profile_id, instant_booking')
        .eq('profile_id', coachProfileIdParam)
        .maybeSingle();

      // Leer duración del patrón semanal para guardarla en el booking
      let durationMinutes: number | null = null;
      if (coachRow?.id) {
        const { data: patternRow } = await supabase
          .from('coach_weekly_pattern')
          .select('slot_duration_minutes')
          .eq('coach_id', coachRow.id)
          .limit(1)
          .maybeSingle();
        durationMinutes = (patternRow as any)?.slot_duration_minutes ?? null;
      }

      if (coachErr || !coachRow) {
        throw new Error('No encontramos el profesional. Volvé y elegí de nuevo');
      }

      const coachId = coachRow.id;              // coaches.id — para bookings.coach_id
      const coachProfileId = coachRow.profile_id; // profiles.id — para salas.coach_id
      const isInstant = !!coachRow.instant_booking;

      await registrarEvento('reserva_iniciada', {
        professional_id: coachId,
        user_id: user.id,
      });

      // 2. Buscar sala existente o crear una nueva
      let salaId: string;
      let roomUrl = '';

      const { data: existingSala } = await supabase
        .from('salas')
        .select('id, room_url')
        .eq('user_id', user.id)
        .eq('coach_id', coachProfileId)
        .maybeSingle();

      if (existingSala) {
        salaId = existingSala.id;
        roomUrl = existingSala.room_url ?? '';
      } else {
        const { data: newSala, error: salaErr } = await supabase
          .from('salas')
          .insert({ user_id: user.id, coach_id: coachProfileId })
          .select('id, room_url')
          .single();
        if (salaErr || !newSala) throw new Error('No se pudo crear la sala de comunicación');
        salaId = newSala.id;
        roomUrl = newSala.room_url ?? ''; // null hasta que corra el trigger / si la columna recién se agregó
      }

      // 2.5 Limpiar el intento anterior del MISMO turno, si lo hubo.
      //
      // La pantalla de horarios deja reintentar un turno que abandonaste sin
      // pagar (ver BookingScreen_Time). Sin esto, cada reintento suma una
      // solicitud más: el coach termina viendo dos o tres pedidos idénticos,
      // del mismo usuario y a la misma hora, sin forma de saber cuál mirar.
      //
      // Se cancela solo lo propio, pendiente y con un cobro iniciado que nunca
      // se acreditó — nunca algo pagado. Sin notificar a nadie: no es una
      // cancelación real, es el reintento de la misma persona.
      await supabase
        .from('bookings')
        .update({ status: 'cancelada' })
        .eq('user_id', user.id)
        .eq('coach_id', coachId)
        .eq('scheduled_date', dateStr)
        .eq('scheduled_time', time)
        .eq('status', 'pendiente')
        .eq('payment_status', 'pendiente')
        // Un cobro iniciado por cualquiera de los dos rieles. Sin esta
        // condición se cancelarían también las reservas legítimas sin cobro
        // (coach sin Mercado Pago conectado), que no son reintentos de nada.
        .or('preference_id.not.is.null,usdt_amount.not.is.null');

      // 3. Insertar booking — columnas reales verificadas en la base (SCHEMA.md)
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          user_id: user.id,
          coach_id: coachId,
          sala_id: salaId,
          coach_name: coachName,
          coach_specialty: specialty,
          scheduled_date: dateStr,
          scheduled_time: time,
          amount: priceFrom,
          // SIEMPRE nace 'pendiente', incluso en instantánea. Antes nacía
          // 'confirmada' y los efectos de confirmación corrían acá mismo, ANTES
          // del checkout: cerrar la pestaña de MP sin pagar dejaba una sesión
          // confirmada, al coach notificado y a los competidores del horario
          // cancelados, sin que entrara un peso (27 casos medidos el 09/08/2026,
          // 16 de ellos auto-completados por complete_confirmed_sessions()).
          // Ahora se confirma abajo, recién cuando el pago está aprobado — o de
          // entrada si el coach no tiene MP y no hay nada que cobrar.
          status: 'pendiente',
          ...(durationMinutes ? { duration_minutes: durationMinutes } : {}),
          ...(userMessage.trim() ? { user_message: userMessage.trim() } : {}),
        })
        .select('id')
        .single();

      if (bookingError || !booking) {
        // `trg_block_bookings_between_blocked` rebota la reserva si hay un
        // bloqueo entre los dos. Se llega acá solo por un camino viejo (link
        // guardado, back a esta pantalla con el bloqueo puesto en el medio) —
        // el perfil y el catálogo ya no ofrecen reservar. Sin este caso, el
        // usuario veía "intentalo de nuevo" para algo que no se arregla
        // reintentando.
        if (bookingError?.message?.includes('blocked')) {
          throw new Error('No podés reservar con esta persona.');
        }
        await logError('BookingConfirm: insert booking failed', bookingError);
        throw new Error('No se pudo guardar la reserva. Intentalo de nuevo');
      }

      await registrarEvento('reserva_confirmada', {
        professional_id: coachId,
        booking_id: booking.id,
        sala_id: salaId,
        user_id: user.id,
      });

      // Todo lo que sigue —avisarle al coach y, si es instantánea, confirmar—
      // corre DESPUÉS de saber que el pago entró. Va en una función para no
      // ejecutarse por el solo hecho de haber creado la reserva.
      // `confirmedNow` = la reserva queda confirmada ya mismo: es instantánea Y
      // no quedó nada por cobrar (coach sin MP, o pago aprobado).
      const applyBookingEffects = async (confirmedNow: boolean) => {
        // Notificar al coach (push token vive en profiles, vía coachProfileId)
        const { data: coachProfile } = await supabase
          .from('profiles')
          .select('push_token, name')
          .eq('id', coachProfileId)
          .maybeSingle();

        const userName = user.user_metadata?.name ?? 'Un usuario';

        if (coachProfile?.push_token) {
          await sendPushNotification(
            coachProfile.push_token,
            confirmedNow ? 'Nueva reserva confirmada 📅' : 'Nueva solicitud de sesión 📅',
            confirmedNow
              ? `${userName} reservó una sesión el ${formatDate(dateStr)} a las ${time} hs. Ya está confirmada.`
              : `${userName} quiere reservar una sesión el ${formatDate(dateStr)} a las ${time} hs`,
          );
        }

        if (!confirmedNow) return;

        // Pasa a 'confirmada' acá y no en el insert: hasta este punto la reserva
        // era una solicitud sin pagar.
        await supabase.from('bookings').update({ status: 'confirmada' }).eq('id', booking.id);

        // Crear sala de videollamada en Daily.co en segundo plano (no bloquea al usuario)
        createOrGetMeetingUrl(booking.id).catch(() => {});

        // Reserva instantánea: mismos efectos que cuando el coach acepta
        // manualmente en CoachReservasScreen — notificación al usuario,
        // mensaje de sistema en la sala, y cancelación de otras solicitudes
        // 'pendiente' que hayan quedado compitiendo por el mismo horario.
        const notifTitle = '¡Tu sesión fue confirmada! ✅';
        const notifBody = `Tu sesión con ${coachName} el ${formatDate(dateStr)} está confirmada`;

        await supabase.from('notifications').insert({
          recipient_id: user.id,
          type: 'reserva_confirmada',
          booking_id: booking.id,
          title: notifTitle,
          body: notifBody,
        });

        const confirmLine1 = `Sesión reservada · ${formatDate(dateStr)} · ${time} hs`;
        const confirmMsg = userMessage.trim()
          ? `${confirmLine1}\n${userMessage.trim()}`
          : confirmLine1;
        await supabase.from('messages').insert({
          sala_id: salaId,
          sender_id: user.id,
          sender_type: 'system_confirmed',
          content: encryptMessage(confirmMsg),
        });

        const { data: conflicting } = await supabase
          .from('bookings')
          .select('id, user_id, sala_id')
          .eq('coach_id', coachId)
          .eq('scheduled_date', dateStr)
          .eq('scheduled_time', time)
          .eq('status', 'pendiente')
          .neq('id', booking.id);

        if (conflicting && conflicting.length > 0) {
          const conflictUserIds = conflicting.map(b => b.user_id);
          const { data: conflictProfiles } = await supabase
            .from('profiles')
            .select('id, push_token')
            .in('id', conflictUserIds);

          const tokenMap: Record<string, string | null> = {};
          conflictProfiles?.forEach(p => { tokenMap[p.id] = p.push_token ?? null; });

          const cancelTitle = 'Horario no disponible';
          const cancelBody = 'Ese horario ya no está disponible. Podés elegir otro horario con tu profesional';
          const cancelSystemMsg = `Solicitud cancelada automáticamente\n${formatDate(dateStr)} · ${time} hs`;

          await Promise.all(
            conflicting.map((cb) => {
              const ops: PromiseLike<unknown>[] = [
                supabase.from('bookings').update({ status: 'cancelada' }).eq('id', cb.id),
                supabase.from('notifications').insert({
                  recipient_id: cb.user_id,
                  type: 'reserva_cancelada',
                  booking_id: cb.id,
                  title: cancelTitle,
                  body: cancelBody,
                }),
              ];
              if (cb.sala_id) {
                ops.push(
                  supabase.from('messages').insert({
                    sala_id: cb.sala_id,
                    sender_id: user.id,
                    sender_type: 'system_cancelled',
                    content: encryptMessage(cancelSystemMsg),
                  })
                );
              }
              const token = tokenMap[cb.user_id];
              if (token) ops.push(sendPushNotification(token, cancelTitle, cancelBody));
              return Promise.all(ops);
            })
          );
        }
      };

      // 🔴 Rama USDT: sale ACÁ, antes de MP y antes de `applyBookingEffects`.
      //
      // El motivo es concreto: más abajo, `confirmedNow = isInstant && (!initPoint
      // || paid)` confirma la reserva instantánea cuando NO hay initPoint, porque
      // ese caso significa "coach sin MP, no hay nada que cobrar". Con USDT
      // tampoco hay initPoint pero SÍ hay algo que cobrar, así que caer en esa
      // rama confirmaría la sesión, avisaría al coach y cancelaría a los
      // competidores del horario sin que entrara un dólar — exactamente el bug
      // que se arregló el 09/08 por el lado de Mercado Pago.
      //
      // La reserva queda 'pendiente' y la confirma `usdt-check-payments` cuando
      // ve la transferencia.
      if (metodoPago === 'usdt') {
        router.replace({ pathname: '/pago-usdt', params: { booking_id: booking.id } });
        return;
      }

      // Intentar iniciar el flujo de pago (si el coach tiene MP conectado)
      //
      // PayPal entra por acá y NO por una rama propia: su `approve_url` es una
      // URL https común, así que funciona dentro del mismo checkout embebido y
      // hereda todo lo que costó llegar a él — el WebView en vez del browser
      // del sistema, el bloqueo de saltos a apps nativas, los 3 minutos de
      // margen y el no cancelar la reserva al vencer el sondeo. Duplicar esa
      // lógica en una rama aparte sería tener dos versiones de las mismas
      // decisiones, y una de las dos envejecería.
      //
      // (USDT sí sale antes, más arriba: no tiene checkout que abrir.)
      let initPoint: string | null = null;
      try {
        const fn = metodoPago === 'paypal' ? 'paypal-create-payment' : 'mp-create-payment';
        const { data: mpData, error: mpError } = await supabase.functions.invoke(fn, {
          body: { booking_id: booking.id },
        });
        // El caso esperado hoy es 409 "coach sin MP conectado" (pagos opcionales) →
        // no es un error real, seguimos sin pago online. Pero ya no lo tragamos en
        // silencio: dejamos rastro para distinguir eso de una falla real de MP.
        // (cuando el pago sea OBLIGATORIO, esto debería frenar la reserva, no seguir.)
        if (mpError) console.warn('[BookingConfirm] create-payment sin URL de checkout:', mpError);
        // MP devuelve `init_point`; PayPal, `approve_url`. Lo único que le
        // importa a lo que sigue es que haya una URL https que abrir.
        initPoint = mpData?.init_point ?? mpData?.approve_url ?? null;
      } catch (e) {
        console.warn('[BookingConfirm] create-payment threw:', e);
      }

      // 🔴 Con PayPal, quedarse sin URL NO es el caso benigno de Mercado Pago.
      // Ahí `initPoint` null significa "coach sin MP conectado, no hay nada que
      // cobrar" y la reserva sigue sin pago, por diseño. Acá significa que el
      // cobro falló, y seguir dejaría una reserva internacional confirmada sin
      // que entrara un dólar — el mismo bug de las 27 fantasma de agosto, por
      // la tercera puerta.
      if (metodoPago === 'paypal' && !initPoint) {
        setError('No pudimos iniciar el pago con PayPal. Probá de nuevo en unos minutos');
        setLoading(false);
        return;
      }

      // 20/08/2026 (sesión 110→111→113): tres intentos de cerrar el browser del
      // sistema solo, y los tres fallaron por el mismo motivo de fondo — no es
      // nuestro browser el que decide cuándo cerrarse.
      //   107: back_urls https + openAuthSessionAsync → la pantalla de "pago
      //        aprobado" de MP rompe esa sesión (se ve el cartel "¿Abrir en
      //        Vita?", que es justo la señal de que NO se interceptó en
      //        silencio como debería) y Safari termina mostrando una checkout
      //        nueva desde cero.
      //   111: dismissBrowser() disparado por el sondeo → funciona solo SI el
      //        browser sigue siendo nuestro. Con la app de Mercado Pago
      //        instalada, MP le pasa el control a SU app nativa para mostrar
      //        "pago aprobado" — un salto real entre apps que nuestro código
      //        no puede ver ni cerrar. `dismissBrowser()` cierra una pestaña
      //        que ya no es la que está en pantalla.
      // La única forma de no perder el control es no usar el browser del
      // sistema para nada: el checkout se abre EMBEBIDO (`<WebView>` más abajo
      // en el JSX, no `expo-web-browser`), y `onShouldStartLoadWithRequest`
      // bloquea cualquier intento de navegar a algo que no sea http(s) — ahí
      // es donde MP intentaría saltar a su app nativa, y ahora no puede.
      // `incognito={__DEV__}` reemplaza a la sesión efímera de antes: en
      // testing arranca sin cookies para poder cambiar de cuenta de MP entre
      // pruebas; en producción las guarda (aisladas de Safari, propias de la
      // app) para que la persona no vuelva a loguearse en MP en cada reserva.
      if (initPoint) setCheckoutUrl(initPoint);

      // ¿Entró el pago? En los pagos reales del 09/08 el webhook tardó ~2 s
      // desde que MP aprueba — el sondeo lo agarra casi al toque apenas la
      // persona termina de pagar. El límite de 3 min de acá abajo NO es "el
      // tiempo que tarda el pago": es el margen para que la PERSONA termine de
      // tipear la tarjeta o el 2FA sin que la echemos a mitad de camino (ver
      // sesión 115). Esto es lo único que decide cuándo se cierra el checkout
      // embebido — `setCheckoutUrl(null)` más abajo — nunca un redirect ni el
      // propio MP.
      //
      // Si se agota el tiempo NO se cancela la reserva desde acá: el pago podría
      // acreditarse un segundo después y quedaríamos con una reserva cancelada y
      // plata cobrada. Se deja 'pendiente' y decide el servidor —
      // expire_unpaid_checkouts() la libera a los 30 min si nunca se pagó, y si
      // sí se pagó el coach la ve como solicitud normal y puede aceptarla.
      let paid = false;
      if (initPoint) {
        // 20/08/2026 (sesión 115): ESTO cerraba el checkout a los 12s fijos
        // pasara lo que pasara — con el browser del sistema no se notaba (la
        // pestaña seguía abierta tapando todo mientras la app navegaba atrás),
        // pero con el checkout embebido cerrarlo a los 12s significa cerrarlo
        // en la cara de alguien que todavía está tipeando la tarjeta o
        // esperando el 2FA del banco, y mandarla derecho a la pantalla
        // siguiente como si ya hubiera terminado. Ahora el límite es de tiempo
        // real de pago (3 min, 90 intentos) y lo único que corta antes es
        // pagar (`paid`) o cerrar el checkout a mano (botón X / back).
        for (let i = 0; i < 90; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          // La persona cerró el checkout a mano — no tiene sentido seguir
          // sondeando ni forzar el cierre de algo que ya no está.
          if (!checkoutUrlRef.current) break;
          const { data: paymentRow } = await supabase
            .from('bookings')
            .select('payment_status')
            .eq('id', booking.id)
            .maybeSingle();
          if (paymentRow?.payment_status === 'aprobado') { paid = true; break; }
        }
        setCheckoutUrl(null);
      }

      // Sin pago pendiente no hay nada que esperar: si el coach no tiene MP
      // (initPoint null) la instantánea se confirma como siempre.
      const confirmedNow = isInstant && (!initPoint || paid);
      const awaitingPayment = !!initPoint && !paid;

      // Con el pago sin confirmar no se avisa a nadie ni se cancelan horarios de
      // otros: eso era exactamente el bug.
      if (!awaitingPayment) await applyBookingEffects(confirmedNow);

      router.replace({
        pathname: '/booking-success',
        params: {
          name: coachName,
          specialty,
          date: dateStr,
          time,
          bookingId: booking.id,
          roomUrl,
          salaId,
          // Lo que se le muestra tiene que ser lo que de verdad pasó: 'Confirmada'
          // solo si quedó confirmada, y el estado de pago pendiente solo si el
          // pago no llegó a acreditarse (antes se mandaba con cualquier initPoint,
          // incluso después de un pago aprobado).
          instant: confirmedNow ? '1' : '0',
          ...(awaitingPayment ? { paymentPending: '1' } : {}),
        },
      });
    } catch (e: any) {
      await logError('BookingConfirm: onConfirm failed', e);
      setError(e.message ?? 'Algo salió mal. Intentalo de nuevo');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safeTop} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="arrow-back-ios" size={18} color="#565E32" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Confirmá tu reserva</Text>
          <View style={s.headerSpacer} />
        </View>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: '100%' }]} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Tarjeta resumen */}
        <View style={s.card}>

          {/* Coach */}
          <View style={s.coachRow}>
            <View style={s.coachAvatar}>
              <MaterialIcons name="person" size={34} color="rgba(135,131,92,0.80)" />
            </View>
            <View style={s.coachInfo}>
              <Text style={s.coachName}>{coachName}</Text>
              <Text style={s.coachSpecialty}>{specialty}</Text>
            </View>
            <MaterialIcons name="verified" size={18} color={ViveColors.accent} />
          </View>

          <View style={s.divider} />

          {/* Fecha */}
          <View style={s.detailRow}>
            <View style={s.detailIcon}>
              <MaterialIcons name="calendar-today" size={17} color={ViveColors.primary} />
            </View>
            <View style={s.detailText}>
              <Text style={s.detailLabel}>FECHA</Text>
              <Text style={s.detailValue}>{formatDate(dateStr)}</Text>
            </View>
          </View>

          {/* Hora */}
          <View style={s.detailRow}>
            <View style={s.detailIcon}>
              <MaterialIcons name="access-time" size={17} color={ViveColors.primary} />
            </View>
            <View style={s.detailText}>
              <Text style={s.detailLabel}>HORA</Text>
              <Text style={s.detailValue}>{time} hs (horario Argentina)</Text>
            </View>
          </View>

          {/* Precio */}
          <View style={s.detailRow}>
            <View style={s.detailIcon}>
              <MaterialIcons name="payments" size={17} color={ViveColors.primary} />
            </View>
            <View style={s.detailText}>
              <Text style={s.detailLabel}>PRECIO</Text>
              {/* El precio TIENE que seguir al método elegido. Antes mostraba
                  siempre `priceFrom` formateado en pesos, así que quien elegía
                  USDT leía "$4.500" acá y en la pantalla siguiente le aparecía
                  un número en dólares sin ninguna relación con ese — y el monto
                  real de USDT trae encima los centavos que identifican el pago,
                  con lo cual ni siquiera coincide con el precio redondo. Son dos
                  precios distintos que fija el coach por separado (`price_usd`
                  NO se deriva de una cotización), no el mismo convertido. */}
              {/* Con cualquiera de los dos medios internacionales el cliente
                  paga el MISMO número: el precio que fijó el profesional. El
                  costo de procesamiento sale de la comisión del 25%, no del
                  precio — antes PayPal mostraba un monto más alto por el
                  recargo, y eso desapareció con la tarifa plana. */}
              <Text style={s.detailValue}>
                {metodoPago !== 'mp' && priceUsd != null
                  ? `USD ${priceUsd} por sesión`
                  : `$${priceFrom.toLocaleString('es-AR')} por sesión`}
              </Text>
            </View>
          </View>

          <View style={s.divider} />

          {/* Modalidad */}
          <View style={s.modalityBox}>
            <MaterialIcons name="info-outline" size={15} color="rgba(135,131,92,0.80)" />
            <Text style={s.modalityText}>
              {instantBooking
                ? 'Reserva instantánea — tu sesión queda confirmada al instante'
                : 'Reserva con confirmación — el profesional tiene 24hs para aceptar'}
            </Text>
          </View>
        </View>

        {/* Aviso de cobro.
            Decía "No se te cobra hasta que el profesional acepte", y era falso:
            `mp-create-payment` se invoca más abajo para TODA reserva, sin mirar la
            modalidad, y el checkout se abre en el acto. El cobro es al reservar y
            lo que existe es el reembolso automático si la reserva no prospera —
            que es lo que los T&C §8.2 ya describían bien. Si el coach no tiene MP
            conectado no hay checkout y no se cobra nada; el texto sigue siendo
            válido ahí (no promete un cobro, describe cuándo ocurre). */}
        <View style={s.noticeRow}>
          <MaterialIcons name="shield" size={15} color={ViveColors.accent} />
          <Text style={s.noticeText}>
            {/* Con USDT NO es "al instante": la transferencia la confirma el cron
                cuando la ve en la red. Prometer inmediatez acá sería el mismo
                tipo de texto falso que ya se corrigió en esta pantalla una vez. */}
            {metodoPago === 'usdt'
              ? (instantBooking
                  ? 'Tu sesión queda confirmada cuando recibimos la transferencia, en un minuto o menos'
                  : 'El pago se hace al reservar. Si el profesional no acepta, te devolvemos el total')
              : instantBooking
                ? 'El pago se hace al reservar y tu sesión queda confirmada al instante'
                : 'El pago se hace al reservar. Si el profesional no acepta, te devolvemos el total'}
          </Text>
        </View>

        {/* Política de cancelación. Va acá y no escondida en los T&C porque §9.1
            dice que se informa ANTES de confirmar la reserva — si no está en esta
            pantalla, esa cláusula es falsa. El número tiene que seguir a
            `isCancelLate` / `canCancelConfirmed` (24hs, lib/bookingHelpers.ts). */}
        <View style={s.noticeRow}>
          <MaterialIcons name="event-busy" size={15} color={ViveColors.accent} />
          <Text style={s.noticeText}>
            Podés cancelar hasta 24hs antes y te devolvemos todo. Después de esa hora
            la sesión no se puede cancelar desde la app
          </Text>
        </View>

        {/* Mensaje opcional */}
        <View style={s.messageSection}>
          <Text style={s.messageTitle}>
            {instantBooking ? '¿Querés contarle algo al profesional?' : '¿Querés contarle algo antes de que acepte?'}
          </Text>
          <Text style={s.messageSubtitle}>Es opcional. Le ayuda al profesional a entender mejor tu situación</Text>
          <View style={s.messageInputWrap}>
            <TextInput
              style={s.messageInput}
              value={userMessage}
              onChangeText={t => t.length <= 300 && setUserMessage(t)}
              placeholder="Contame brevemente qué te trajo acá..."
              placeholderTextColor="rgba(135,131,92,0.45)"
              multiline
              textAlignVertical="top"
            />
            <Text style={s.messageCounter}>{userMessage.length}/300</Text>
          </View>
        </View>

        {/* Error */}
        {error && (
          <View style={s.errorRow}>
            <MaterialIcons name="error-outline" size={15} color="#E05252" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {/* Pago */}
        <View style={s.paymentSection}>
          <View style={s.paymentInfoRow}>
            <MaterialIcons name="account-balance-wallet" size={18} color="#009EE3" />
            {/* Decía "a través de Mercado Pago" fijo, sin mirar el método. Con
                tres rieles eso es directamente falso para dos de ellos. */}
            <Text style={s.paymentInfoText}>
              {metodoPago === 'usdt'
                ? 'El pago se hace por transferencia de USDT al confirmar'
                : metodoPago === 'paypal'
                  ? 'El pago se procesa a través de PayPal al confirmar'
                  : 'El pago se procesa a través de Mercado Pago al confirmar'}
            </Text>
          </View>
        </View>

      </ScrollView>

      <SafeAreaView style={s.footerSafe} edges={['bottom']}>
        <View style={s.footer}>
          {error ? (
            <View style={s.errorBox}>
              <MaterialIcons name="error-outline" size={15} color="#D94F4F" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Selector de medio de pago. Solo aparece si hay más de una opción:
              para la enorme mayoría —usuarios en Argentina con un coach que no
              atiende afuera— no hay nada que elegir y mostrar un selector de un
              solo ítem es fricción sin beneficio.

              Está armado como lista para que sumar un tercer medio (PayPal) sea
              agregar una entrada, no reescribir la pantalla. */}
          {internacionalDisponible && (
            <View style={s.pagoRow}>
              {([
                { id: 'mp' as const,     label: 'Mercado Pago', desc: 'Pesos · tarjeta o dinero en cuenta' },
                { id: 'paypal' as const, label: 'PayPal',        desc: 'Dólares · tarjeta desde el exterior' },
                { id: 'usdt' as const,   label: 'Crypto · USDT', desc: 'Dólares · transferencia de cripto' },
              ]).map(m => (
                <TouchableOpacity
                  key={m.id}
                  style={[s.pagoCard, metodoPago === m.id && s.pagoCardOn]}
                  onPress={() => setMetodoPago(m.id)}
                  disabled={loading}
                  activeOpacity={0.85}>
                  <Text style={[s.pagoLabel, metodoPago === m.id && s.pagoLabelOn]}>{m.label}</Text>
                  <Text style={s.pagoDesc}>{m.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[s.btn, loading && s.btnLoading]}
            onPress={onConfirm}
            disabled={loading}
            activeOpacity={0.85}>
            {loading ? (
              <ActivityIndicator color="#565E32" size="small" />
            ) : (
              <Text style={s.btnText}>Confirmar reserva</Text>
            )}
          </TouchableOpacity>

          {/* Acá iba "Garantía de primera sesión — si no quedás conforme, te
              devolvemos el dinero". Se sacó el 10/08/2026: es una promesa
              incondicional en el punto de venta (art. 8 Ley 24.240: las
              precisiones publicitarias obligan e integran el contrato) contra la
              que no hay NI política escrita —T&C §9.3 es un placeholder— NI
              implementación: no existe ningún flujo de reembolso por
              insatisfacción, solo por cancelación y por vencimiento sin
              confirmar. Para reponerla hacen falta las dos cosas, no el texto.
              Los estilos `guaranteeRow`/`guaranteeText` quedan a propósito. */}
        </View>
      </SafeAreaView>

      {/* Checkout de MP embebido — no expo-web-browser/Safari. Ver el
          comentario largo en onConfirm (sesión 113) sobre por qué: es la
          única forma de bloquear el salto a la app nativa de MP y quedarnos
          con el control de cuándo se cierra. */}
      {checkoutUrl && (
        <View style={s.checkoutOverlay}>
          <SafeAreaView style={s.checkoutSafe} edges={['top', 'bottom']}>
            <View style={s.checkoutHeader}>
              <TouchableOpacity
                style={s.checkoutClose}
                onPress={() => setCheckoutUrl(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="close" size={22} color="#2E3624" />
              </TouchableOpacity>
              <Text style={s.checkoutTitle}>Mercado Pago</Text>
              <View style={s.checkoutHeaderSpacer} />
            </View>
            <WebView
              source={{ uri: checkoutUrl }}
              // NO incognito — con `incognito` MP no reconoce ninguna sesión
              // logueada y no ofrece "Ingresar con mi cuenta" (solo Tarjeta/
              // Efectivo), justo el caso de alguien sin tarjeta.
              //
              // 20/08/2026 (sesión 116): sacar `incognito` NO ALCANZÓ —
              // probado en dispositivo, "Ingresar con mi cuenta" seguía sin
              // aparecer. El motivo real: el `WebView` tiene su PROPIO storage
              // de cookies, separado del de Safari — nunca vio la sesión de MP
              // aunque ya no sea incógnito, porque nunca estuvo ahí para
              // empezar. `sharedCookiesEnabled` (solo iOS) hace que use el
              // mismo `NSHTTPCookieStorage` que Safari — ahí SÍ está la sesión
              // de MP de la persona, que es justo lo que hacía que el browser
              // del sistema (antes de la sesión 113) mostrara la opción de
              // cuenta sin problema. No afecta el bloqueo de
              // `onShouldStartLoadWithRequest` de más abajo — son mecanismos
              // distintos (cookies vs. navegación), así que el salto a la app
              // nativa de MP sigue bloqueado igual.
              sharedCookiesEnabled
              startInLoadingState
              renderLoading={() => (
                <View style={s.checkoutLoading}>
                  <ActivityIndicator color={ViveColors.primary} size="large" />
                </View>
              )}
              onShouldStartLoadWithRequest={(req) =>
                // Bloquea cualquier salto a algo que no sea la web de MP —
                // ahí es donde intentaría abrir su app nativa. `false` no
                // cancela el pago, solo esa navegación puntual: el checkout
                // sigue andando igual dentro de http(s).
                req.url.startsWith('http://') || req.url.startsWith('https://')
              }
            />
          </SafeAreaView>
        </View>
      )}
    </AppBg>
  );
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: 'rgba(0,0,0,0.5)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  android: { elevation: 4 },
});

const s = StyleSheet.create({
  pagoRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  pagoCard: {
    flex: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 12,
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderWidth: 1.5, borderColor: 'transparent', gap: 3,
  },
  pagoCardOn: { borderColor: ViveColors.primary, backgroundColor: 'rgba(255,248,240,0.88)' },
  pagoLabel: { fontFamily: ViveFonts.semibold, fontSize: 13.5, color: 'rgba(135,131,92,0.85)' },
  pagoLabelOn: { color: '#565E32' },
  pagoDesc: { fontFamily: ViveFonts.regular, fontSize: 11, lineHeight: 15, color: 'rgba(135,131,92,0.70)' },

  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  safeTop: {
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,248,240,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: 'rgba(0,0,0,0.5)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  headerTitle: {
    flex: 1,
    fontFamily: ViveFonts.semibold,
    fontSize: 18,
    color: '#565E32',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  headerSpacer: { width: 36 },

  progressTrack: {
    height: 4,
    backgroundColor: `${ViveColors.primary}22`,
    marginHorizontal: 20,
    borderRadius: 2,
    marginBottom: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ViveColors.primary,
    borderRadius: 2,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },

  card: {
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    padding: 20,
    marginBottom: 14,
    ...cardShadow,
  },
  coachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  coachAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,248,240,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  coachInfo: { flex: 1 },
  coachName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: '#565E32',
    marginBottom: 3,
  },
  coachSpecialty: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.primary,
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,248,240,0.48)',
    marginVertical: 16,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  detailIcon: {
    width: 28,
    paddingTop: 2,
  },
  detailText: { flex: 1 },
  detailLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 10,
    color: 'rgba(135,131,92,0.80)',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  detailValue: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#565E32',
    lineHeight: 21,
  },

  modalityBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255,248,240,0.32)',
    borderRadius: 10,
    padding: 12,
  },
  modalityText: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#87835C',
    lineHeight: 19,
  },

  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 14,
  },
  noticeText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.accent,
  },

  messageSection: {
    marginBottom: 20,
  },
  messageTitle: {
    fontFamily: ViveFonts.medium,
    fontSize: 14,
    color: '#565E32',
    marginBottom: 4,
    lineHeight: 20,
  },
  messageSubtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: '#87835C',
    marginBottom: 10,
    lineHeight: 17,
  },
  messageInputWrap: {
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.60)',
    padding: 14,
    ...Platform.select({
      ios: { shadowColor: 'rgba(0,0,0,0.5)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.10, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  messageInput: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: '#565E32',
    minHeight: 90,
    lineHeight: 20,
  },
  messageCounter: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: 'rgba(135,131,92,0.52)',
    textAlign: 'right',
    marginTop: 6,
  },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255,80,80,0.18)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: '#E05252',
    lineHeight: 19,
  },

  paymentSection: {
    marginBottom: 4,
  },
  paymentInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,158,227,0.07)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,158,227,0.18)',
    padding: 12,
  },
  paymentInfoText: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#565E32',
    lineHeight: 19,
  },

  footerSafe: {
    backgroundColor: 'rgba(247,239,228,0.97)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(86,94,50,0.12)',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  btn: {
    backgroundColor: '#565E32',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  btnLoading: {
    opacity: 0.7,
  },
  btnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: '#F7EFE4',
    letterSpacing: 0.2,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255,80,80,0.18)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 4,
  },
  guaranteeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
  },
  guaranteeText: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: '#87835C',
    lineHeight: 18,
  },
  checkoutOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    zIndex: 10,
  },
  checkoutSafe: {
    flex: 1,
  },
  checkoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE7D8',
  },
  checkoutClose: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#2E3624',
  },
  checkoutHeaderSpacer: {
    width: 32,
  },
  checkoutLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});