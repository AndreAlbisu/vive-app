// La bienvenida del profesional (24/09/2026). Andre: "el coach apenas abre la
// app no tiene idea de nada".
//
// 📌 Una sola pantalla, una sola vez, y no un tour: lo esencial para entender
// de qué se trata en un minuto, y de ahí a la tarjeta de pasos del Inicio, que
// es lo que tiene que hacer. El detalle vive en "Cómo funciona"
// (`CoachComoFuncionaScreen`) y lo que depende de un momento (la primera
// solicitud, la primera sesión) se explica cuando pasa, en el Inicio.
//
// ⚠️ Los números salen de las mismas fuentes que "Cómo funciona": comisión
// 20/15 (`_shared/commission.ts`), 24 horas para aceptar
// (`expire_pending_bookings`), sesiones de una hora (`CoachWeeklyPatternScreen`),
// los cuatro lugares (`DECK_SLOTS`) y la garantía (T&C §9.3).
// Si cambia alguno, cambia acá en el mismo commit.

import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { sheetStyles } from '@/components/ui/sheetStyles';

export const BIENVENIDA_COACH_KEY = 'vita_coach_bienvenida';

const PUNTOS: { icon: keyof typeof MaterialCommunityIcons.glyphMap; titulo: string; texto: string }[] = [
  {
    icon: 'account-search-outline',
    titulo: 'Cómo te encuentran',
    texto: 'En la app, por los temas que elijas: cada tema muestra cuatro profesionales, uno por lugar (recomendado, en tendencia, nuevo y económico), y al principio entrás como nuevo. Y por tu link, que le podés mandar a quien ya atendés.',
  },
  {
    icon: 'calendar-check-outline',
    titulo: 'Cómo te llegan las sesiones',
    texto: 'La persona reserva y paga. Te llega la solicitud y tenés 24 horas para aceptarla; si no contestás, se cancela y se le devuelve todo.',
  },
  {
    icon: 'cash-multiple',
    titulo: 'Cómo cobrás',
    texto: 'En Argentina, directo a tu Mercado Pago cuando la persona reserva. La comisión es 20% en la primera sesión con cada persona y 15% después.',
  },
  {
    icon: 'shield-check-outline',
    titulo: 'La garantía',
    texto: 'Si la persona no queda conforme con su primera sesión con vos, puede pedir la plata de vuelta dentro de las 48 horas. Cada persona la usa una sola vez en toda la app.',
  },
  {
    icon: 'video-outline',
    titulo: 'La sesión',
    texto: 'Es por videollamada, de una hora, desde la app o desde la computadora.',
  },
];

export default function CoachBienvenida({
  visible,
  onCerrar,
}: {
  visible: boolean;
  /** `verMas`: tocó "Cómo funciona todo". */
  onCerrar: (verMas: boolean) => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => onCerrar(false)}>
      <View style={sheetStyles.flex}>
        <View style={sheetStyles.overlay} />
        <View style={[sheetStyles.sheet, s.sheet]}>
          <View style={sheetStyles.handle} />
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            <Text style={s.titulo}>Te damos la bienvenida a Vita</Text>
            <Text style={s.bajada}>Lo que tenés que saber, en un minuto.</Text>

            {PUNTOS.map(p => (
              <View key={p.titulo} style={s.punto}>
                <View style={s.icono}>
                  <MaterialCommunityIcons name={p.icon} size={20} color={ViveColors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.puntoTitulo}>{p.titulo}</Text>
                  <Text style={s.puntoTexto}>{p.texto}</Text>
                </View>
              </View>
            ))}

            <Text style={s.cierre}>
              En el Inicio te dejamos los pasos para empezar a recibir reservas.
            </Text>

            <TouchableOpacity style={s.btn} onPress={() => onCerrar(false)} activeOpacity={0.85} accessibilityRole="button">
              <Text style={s.btnTxt}>Empezar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onCerrar(true)} activeOpacity={0.7} hitSlop={8} accessibilityRole="button">
              <Text style={s.link}>Leer cómo funciona todo</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  sheet: { maxHeight: '88%' },
  titulo: { fontFamily: ViveFonts.bold, fontSize: 21, color: '#565E32', lineHeight: 27 },
  bajada: { fontFamily: ViveFonts.regular, fontSize: 14, color: '#87835C', marginTop: 4, marginBottom: 18 },
  punto: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  icono: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: `${ViveColors.primary}14`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  puntoTitulo: { fontFamily: ViveFonts.semibold, fontSize: 14.5, color: '#565E32' },
  puntoTexto: { fontFamily: ViveFonts.regular, fontSize: 13.5, lineHeight: 19, color: '#6F6B4C', marginTop: 2 },
  cierre: { fontFamily: ViveFonts.medium, fontSize: 13.5, color: '#565E32', marginTop: 4, marginBottom: 16 },
  btn: {
    backgroundColor: '#565E32',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnTxt: { fontFamily: ViveFonts.semibold, fontSize: 16, color: '#F7EFE4' },
  link: {
    fontFamily: ViveFonts.medium,
    fontSize: 14,
    color: '#87835C',
    textAlign: 'center',
    textDecorationLine: 'underline',
    marginTop: 14,
  },
});
