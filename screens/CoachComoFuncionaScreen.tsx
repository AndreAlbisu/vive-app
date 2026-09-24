import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ViveFonts } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';

/**
 * Las reglas del trabajo del coach, en un solo lugar.
 *
 * ── Por qué existe esta pantalla ─────────────────────────────────────────────
 *
 * 🔴 La razón concreta: la regla de ausencias vivía en una línea suelta debajo
 * de la tarjeta de la próxima sesión, en el Inicio. Ahí tenía el defecto de
 * repetirse para siempre —se lee una vez y después es ruido en la pantalla que
 * más se mira— y, peor, el defecto de **estar mal dicha**: "esperá hasta 20
 * minutos" omite que la obligación se termina antes si la persona llega, y
 * omite que con 10 minutos juntos la sesión ya ocurrió y se cobra sin importar
 * quién llegó tarde. Una regla a medias sobre plata es peor que ninguna.
 *
 * 📌 Lo que se dice acá NO es lo que el coach necesita en el momento de actuar
 * —eso sigue viviendo en la pantalla donde actúa— sino lo que necesita saber
 * UNA vez y poder volver a consultar: cómo lo encuentran, cuánto se le
 * descuenta, qué pasa si el otro no aparece, qué pasa si alguien cancela, y
 * qué cosa le puede costar la cuenta.
 *
 * ⚠️ Cada número de acá tiene una fuente y ninguno se inventó para redactar
 * mejor:
 *   - ausencias → docs/no-show.md (los tres umbrales: 20, 20, 10)
 *   - comisiones → supabase/functions/_shared/commission.ts
 *   - cancelaciones → T&C §9.1 y §9.2
 *   - no elusión → T&C §10
 *   - lugares de cada tema → lib/coachDeckRanking.ts (DECK_SLOTS y sus barras)
 *   - reservas → T&C §7 y `expire_pending_bookings` (24 horas)
 *   - garantía → T&C §8.8 y §9.3 · reseñas → §12 · urgencias → §5.3
 *   - comisión del exterior y comprobantes → T&C §8.3 y §8.5
 * Si alguno de esos cambia, esta pantalla cambia en el mismo commit.
 */

const CARD = '#F7F2E7';
const FOREST = '#3F512F';
const FOREST_SOFT = '#566245';
const LINE = 'rgba(63,81,47,0.14)';
const GREEN_BG = '#3E4E2C';
const GREEN_TXT = '#F3EEDF';
const GREEN_EYEBROW = '#C9CFAF';

type Bloque = {
  id: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  titulo: string;
  /** Lo que se lee con el bloque cerrado: la regla en una línea. */
  resumen: string;
  parrafos: string[];
  /** Puntero a la pantalla donde esto efectivamente se hace o se mira. */
  ir?: { label: string; ruta: string };
};

const BLOQUES: Bloque[] = [
  {
    id: 'encuentran',
    icon: 'compass-outline',
    titulo: 'Cómo te encuentran: los temas',
    resumen: 'Aparecés en los temas que trabajás, y en cada tema hay cuatro lugares.',
    parrafos: [
      'En Profesionales, la persona elige un área de bienestar y adentro un tema, como Ansiedad y estrés o Relaciones. Vos aparecés en los temas que tienen que ver con lo que marcaste que trabajás. Para aparecer hace falta tener el perfil aprobado y activo, temas, precio y un medio de cobro.',
      'Cada tema muestra hasta cuatro profesionales, uno por lugar: Recomendado por Vita, En tendencia, Nuevo en Vita y Opción económica. No competís contra todos: entrás a un lugar cumpliendo lo que pide, y si varios lo cumplen, se turnan cada día.',
      'Nuevo en Vita: tus primeras 4 semanas, mientras tengas menos de 5 reseñas. Opción económica: tu precio está en la mitad más accesible del tema. En tendencia: te reservaron al menos 3 personas distintas en los últimos 30 días. Recomendado por Vita: 4,5 estrellas o más y al menos 3 reseñas; desde las 5 sesiones cumplidas, en vez de las 3 reseñas se pide que al menos 3 de cada 10 personas vuelvan a reservarte.',
      'Si la persona hizo el quiz, en cada lugar se muestra primero a quien encaja con lo que contestó. Y por fuera de los temas está tu link: quien entra por ahí llega directo a tu perfil.',
    ],
    ir: { label: 'Ver en qué lugar estás hoy', ruta: '/coach-visibilidad' },
  },
  {
    id: 'reservas',
    icon: 'calendar-check-outline',
    titulo: 'Las reservas',
    resumen: 'Te llegan ya pagadas y tenés 24 horas para aceptarlas.',
    parrafos: [
      'La persona elige uno de tus horarios y paga al reservar. Te llega como solicitud y la aceptás o la rechazás. Si en 24 horas no contestás, se cancela sola y se le devuelve todo.',
      'Si activás la reserva instantánea en tu perfil, las reservas se confirman solas, sin pasar por vos.',
      'Si dos personas piden el mismo horario, al aceptar una la otra se cancela y se le devuelve la plata. Si alguien necesita cambiar el horario, te lo pide desde la app y vos aceptás o le proponés otro.',
      'Las sesiones son de una hora, por videollamada. Entrás con "Unirse", que se habilita 10 minutos antes, o desde la computadora.',
    ],
    ir: { label: 'Ver tus reservas', ruta: '/reservas' },
  },
  {
    id: 'cobras',
    icon: 'cash-multiple',
    titulo: 'Cuándo y cuánto cobrás',
    resumen: '20% de comisión en la primera sesión con cada persona, 15% después.',
    parrafos: [
      'La comisión es 20% en la primera sesión con cada persona y 15% de la segunda en adelante, para siempre. Si la persona llegó por tu link, la primera no paga comisión.',
      'En las sesiones de Argentina la plata va directo a tu cuenta de Mercado Pago cuando la persona reserva; Vita nunca la toca. Las del exterior, por PayPal o USDT, las cobra Vita y te las transferimos cada semana, por las sesiones que ya ocurrieron. Ahí la comisión es 25% y 20%, porque cobrar desde afuera cuesta más.',
      'Los comprobantes de la sesión se los emitís vos a la persona: Vita solo factura su comisión.',
      'No hay costo de alta, ni mensualidad, ni cargo por cancelar.',
    ],
    ir: { label: 'Ver tus datos de cobro', ruta: '/coach-datos-cobro' },
  },
  {
    id: 'garantia',
    icon: 'shield-check-outline',
    titulo: 'La garantía de la primera sesión',
    resumen: 'Si no quedó conforme con la primera sesión, la persona puede pedir la plata de vuelta.',
    parrafos: [
      'Dentro de las 48 horas después de su primera sesión con vos, la persona puede pedir el reintegro sin dar motivos. Cada persona la puede usar una sola vez en toda la app, con un solo profesional.',
      'Si se aprueba, el reintegro sale de lo que cobraste por esa sesión, y Vita tampoco se queda con comisión. Revisamos cada pedido antes de aprobarlo, para frenar abusos.',
      'Es lo que le da confianza a alguien para probar con un profesional que todavía no conoce.',
    ],
  },
  {
    id: 'ausencias',
    icon: 'clock-alert-outline',
    titulo: 'Si la persona no aparece',
    resumen: 'Esperá hasta el minuto 20. Si no entrás en los primeros 10, se le devuelve la plata.',
    parrafos: [
      'Entrá a la sala a horario y quedate hasta que llegue o hasta el minuto 20, lo que pase primero. Si llega en el minuto 12, ya está: no hay que esperar los 20.',
      'Si estuvieron los dos en la sala al menos 10 minutos, la sesión ocurrió y la cobrás, sin importar quién llegó tarde.',
      'Si no llegaron a esos 10 minutos juntos, se mira quién faltó. Vos esperaste y la persona no vino antes del minuto 20: cobrás igual. Vos no estuviste y la persona sí: se le devuelve el dinero y queda como ausencia tuya. No estuvo ninguno de los dos: se devuelve el dinero y no hay sanción para nadie.',
      'Irse en el minuto 5 no cuenta como haber estado, aunque la persona nunca haya aparecido.',
      'Se decide con los registros de conexión de la videollamada: quién entró, cuándo y por cuánto tiempo. Nunca vemos ni escuchamos la sesión.',
    ],
  },
  {
    id: 'cancelaciones',
    icon: 'calendar-remove-outline',
    titulo: 'Cancelaciones',
    resumen: 'Con 24 horas o más de aviso, se le devuelve todo a la persona.',
    parrafos: [
      'La persona puede cancelar cuando quiera. Lo que cambia es el dinero: cancelando con 24 horas o más de antelación se le devuelve todo; dentro de las 24 horas previas la sesión se cancela igual pero no hay reembolso, porque es tiempo que vos ya habías reservado y no podés reasignar.',
      'En ese caso, la persona te puede pedir por el chat que la canceles vos, y así se le devuelve la plata. Es tu decisión.',
      'Si el que cancela o rechaza sos vos, se le devuelve todo a la persona. Lo mismo si dejás vencer una reserva pendiente sin confirmarla.',
    ],
  },
  {
    id: 'resenas',
    icon: 'star-outline',
    titulo: 'Reseñas',
    resumen: 'Solo las deja la persona, y solo después de una sesión que ocurrió.',
    parrafos: [
      'Las reseñas van de la persona hacia vos, nunca al revés, y solo después de una sesión cumplida. Son las que cuentan para el lugar de Recomendado por Vita.',
      'No se pueden pedir a cambio de nada ni coordinar: las reseñas falsas o incentivadas se borran.',
    ],
  },
  {
    id: 'urgencias',
    icon: 'lifebuoy',
    titulo: 'Si alguien está en riesgo',
    resumen: 'Vita no es un servicio de emergencias, y vos tampoco tenés que serlo.',
    parrafos: [
      'Ni la app ni los profesionales están para atender urgencias. Si alguien te cuenta que piensa en hacerse daño o está en peligro, indicale que llame al 911, a la Línea de Salud Mental 0800-999-0091 (las 24 horas) o al 135 del Centro de Asistencia al Suicida.',
      'Si sos coach o nutricionista, lo que es clínico no te corresponde: derivalo a un profesional de salud mental, como te comprometiste al postularte.',
    ],
  },
  {
    id: 'privacidad',
    icon: 'lock-outline',
    titulo: 'Privacidad y notas',
    resumen: 'La sesión no se graba, y tus notas privadas son solo tuyas.',
    parrafos: [
      'Vita no graba ni escucha las sesiones. De la videollamada solo guardamos quién entró y cuánto tiempo estuvo.',
      'Las notas privadas las ves solo vos; las compartidas también las ve la persona. Lo que te cuenta está alcanzado por tu deber de confidencialidad.',
      'Podés bloquear a alguien desde el chat. No se le avisa, y las sesiones ya agendadas siguen en pie.',
    ],
  },
  {
    id: 'limites',
    icon: 'shield-alert-outline',
    titulo: 'Qué no se puede hacer',
    resumen: 'Llevarte por fuera de la app a alguien que conociste acá.',
    parrafos: [
      'Llevarte fuera de la app a alguien que conociste acá para evitar la comisión, o pedirle que te pague por fuera de Vita. Por eso la app no deja mandar CBU, alias ni links de cobro, y avisa antes de enviar un teléfono o un mail.',
      'La gente que ya era tuya antes de Vita es tuya: traerla por tu link no es eludir nada, y justamente por eso esa primera sesión no paga comisión.',
      'Incumplir puede terminar en advertencia, suspensión o baja de la cuenta. Nada de eso es automático: cada caso lo revisa una persona de Vita, te avisamos el motivo y podés pedir que se revise escribiendo a vitaappar@gmail.com.',
    ],
    ir: { label: 'Leer los términos completos', ruta: '/legal?doc=terminos' },
  },
];

export default function CoachComoFuncionaScreen() {
  const router = useRouter();
  // 📌 Desplegables (24/09/2026): con diez reglas, abiertas todas era un muro.
  // Cerradas se lee la regla en una línea, que ya alcanza para ubicarse; el
  // detalle, al tocar.
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const alternar = (id: string) => setAbiertos(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  return (
    <AppBg>
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(coach)'); }}
            style={s.backBtn}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color="#565E32" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Cómo funciona</Text>
          <View style={s.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
          <View style={s.hero}>
            <View style={s.heroGlow} />
            <Text style={s.heroEyebrow}>Para leer una vez</Text>
            <Text style={s.heroTitle}>Las reglas del trabajo, dichas derecho</Text>
            <Text style={s.heroSub}>
              Cómo te encuentran, cuánto te queda, y qué pasa cuando algo sale distinto de
              lo planeado. Tocá cada una para leerla entera; están acá para que vuelvas cuando
              te haga falta.
            </Text>
          </View>

          {BLOQUES.map((b) => {
            const abierto = abiertos.has(b.id);
            return (
              <View key={b.id} style={s.card}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => alternar(b.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: abierto }}>
                  <View style={s.cardHead}>
                    <View style={s.cardIcon}>
                      <MaterialCommunityIcons name={b.icon} size={17} color={FOREST} />
                    </View>
                    <Text style={s.cardTitle}>{b.titulo}</Text>
                    <MaterialCommunityIcons name={abierto ? 'chevron-up' : 'chevron-down'} size={20} color={FOREST_SOFT} />
                  </View>
                  <Text style={s.resumen}>{b.resumen}</Text>
                </TouchableOpacity>
                {abierto && (
                  <View style={s.detalle}>
                    {b.parrafos.map((p, i) => (
                      <Text key={i} style={[s.parrafo, i > 0 && s.parrafoSpaced]}>{p}</Text>
                    ))}
                    {b.ir && (
                      <TouchableOpacity
                        style={s.link}
                        activeOpacity={0.75}
                        onPress={() => router.push(b.ir!.ruta as any)}
                      >
                        <Text style={s.linkTxt}>{b.ir.label}</Text>
                        <MaterialCommunityIcons name="chevron-right" size={17} color={FOREST} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          <Text style={s.pie}>
            Si algo de esto no coincide con lo que ves en la app, escribinos a vitaappar@gmail.com: el error es
            nuestro y queremos saberlo.
          </Text>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  container: { paddingHorizontal: 20, paddingBottom: 20 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,248,240,0.62)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontFamily: ViveFonts.semibold, fontSize: 18, color: FOREST, textAlign: 'center' },
  headerSpacer: { width: 36 },

  hero: { backgroundColor: GREEN_BG, borderRadius: 24, padding: 18, overflow: 'hidden' },
  heroGlow: {
    position: 'absolute', right: -40, top: -46, width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(234,211,198,0.10)',
  },
  heroEyebrow: {
    fontSize: 10.5, letterSpacing: 0.8, textTransform: 'uppercase',
    color: GREEN_EYEBROW, fontFamily: ViveFonts.medium,
  },
  heroTitle: { fontFamily: ViveFonts.title, fontSize: 21, color: GREEN_TXT, marginTop: 8, lineHeight: 28 },
  heroSub: { fontSize: 12, color: GREEN_EYEBROW, fontFamily: ViveFonts.regular, marginTop: 8, lineHeight: 19 },

  card: {
    backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 20,
    padding: 16, marginTop: 12,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resumen: { fontFamily: ViveFonts.medium, fontSize: 12.5, color: FOREST_SOFT, lineHeight: 19, marginTop: 8, marginLeft: 40 },
  detalle: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: LINE },
  cardIcon: {
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(63,81,47,0.09)',
  },
  cardTitle: { flex: 1, fontFamily: ViveFonts.semibold, fontSize: 14.5, color: FOREST },

  parrafo: { fontFamily: ViveFonts.regular, fontSize: 12.5, color: FOREST_SOFT, lineHeight: 20 },
  parrafoSpaced: { marginTop: 9 },

  link: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: LINE,
  },
  linkTxt: { flex: 1, fontFamily: ViveFonts.semibold, fontSize: 12.5, color: FOREST },

  pie: {
    fontFamily: ViveFonts.regular, fontSize: 11.5, color: FOREST_SOFT,
    lineHeight: 17, marginTop: 18, paddingHorizontal: 4, textAlign: 'center',
  },
});
