import React from 'react';
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
  parrafos: string[];
  /** Puntero a la pantalla donde esto efectivamente se hace o se mira. */
  ir?: { label: string; ruta: string };
};

const BLOQUES: Bloque[] = [
  {
    id: 'encuentran',
    icon: 'compass-outline',
    titulo: 'Cómo te encuentran',
    parrafos: [
      'Hay dos caminos, y conviene no confundirlos. Uno es el catálogo de la app: la gente entra a Conexiones y ve profesionales ordenados por secciones —recomendados, en tendencia, nuevos—. A cada sección se entra cumpliendo algo concreto, no compitiendo contra los demás.',
      'El otro camino es tu link. Se lo mandás a quien quieras, por donde quieras, y esa persona llega directo a tu perfil sin pasar por el catálogo. Los clientes que ya tenías entran por ahí.',
    ],
    ir: { label: 'Ver dónde aparecés hoy', ruta: '/coach-visibilidad' },
  },
  {
    id: 'cobras',
    icon: 'cash-multiple',
    titulo: 'Cuándo y cuánto cobrás',
    parrafos: [
      'La comisión es 20% en la primera sesión con cada persona y 15% de la segunda en adelante. La primera sesión de cada persona nueva que llegue por tu link no paga comisión: es tuya entera.',
      'En las sesiones de Argentina la plata va directo a tu cuenta de Mercado Pago cuando la persona reserva; Vita nunca la toca. Las sesiones del exterior se cobran distinto: las cobra Vita y te las transferimos cada semana, por las sesiones que ya ocurrieron.',
      'No hay costo de alta, ni mensualidad, ni cargo por cancelar.',
    ],
    ir: { label: 'Ver tus datos de cobro', ruta: '/coach-datos-cobro' },
  },
  {
    id: 'ausencias',
    icon: 'clock-alert-outline',
    titulo: 'Si la persona no aparece',
    parrafos: [
      'Entrá a la sala a horario y quedate hasta que llegue o hasta el minuto 20, lo que pase primero. Si llega en el minuto 12, ya está: no hay que esperar los 20.',
      'Si estuvieron los dos en la sala al menos 10 minutos, la sesión ocurrió y la cobrás, sin importar quién llegó tarde.',
      'Si no llegaron a esos 10 minutos juntos, se mira quién faltó. Vos esperaste y la persona no vino antes del minuto 20: cobrás igual. Vos no estuviste y la persona sí: se le devuelve el dinero y queda como ausencia tuya. No estuvo ninguno de los dos: se devuelve el dinero y no hay sanción para nadie.',
      'Irse en el minuto 5 no cuenta como haber estado, aunque la persona nunca haya aparecido.',
    ],
  },
  {
    id: 'cancelaciones',
    icon: 'calendar-remove-outline',
    titulo: 'Cancelaciones',
    parrafos: [
      'La persona puede cancelar cuando quiera. Lo que cambia es el dinero: cancelando con 24 horas o más de antelación se le devuelve todo; dentro de las 24 horas previas la sesión se cancela igual pero no hay reembolso, porque es tiempo que vos ya habías reservado y no podés reasignar.',
      'Si el que cancela o rechaza sos vos, se le devuelve todo a la persona. Lo mismo si dejás vencer una reserva pendiente sin confirmarla.',
    ],
  },
  {
    id: 'limites',
    icon: 'shield-alert-outline',
    titulo: 'Qué no se puede hacer',
    parrafos: [
      'Llevarte fuera de la app a alguien que conociste acá para evitar la comisión, o pedirle que te pague por fuera de Vita. Eso puede terminar en advertencia, suspensión o baja de la cuenta.',
      'La gente que ya era tuya antes de Vita es tuya: traerla por tu link no es eludir nada, y justamente por eso esa primera sesión no paga comisión.',
    ],
    ir: { label: 'Leer los términos completos', ruta: '/legal?doc=terminos' },
  },
];

export default function CoachComoFuncionaScreen() {
  const router = useRouter();

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
              lo planeado. Está acá para que puedas volver cuando te haga falta.
            </Text>
          </View>

          {BLOQUES.map((b) => (
            <View key={b.id} style={s.card}>
              <View style={s.cardHead}>
                <View style={s.cardIcon}>
                  <MaterialCommunityIcons name={b.icon} size={17} color={FOREST} />
                </View>
                <Text style={s.cardTitle}>{b.titulo}</Text>
              </View>
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
          ))}

          <Text style={s.pie}>
            Si algo de esto no coincide con lo que ves en la app, escribinos: el error es
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
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
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
