import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';

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
  date?: string;
  time?: string;
  coachId?: string;
};

export default function BookingScreen_Success() {
  const router = useRouter();
  const params = useLocalSearchParams<Params>();

  const coachName = params.name ?? 'Laura Méndez';
  const specialty = params.specialty ?? 'Coach de vida';
  const dateStr = params.date ?? '';
  const time = params.time ?? '';
  const coachId = params.coachId ?? '';

  const firstName = coachName.split(' ')[0];
  const formattedDate = formatDate(dateStr);

  // Animations
  const checkScale = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(checkScale, {
        toValue: 1,
        tension: 60,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <AppBg>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>

        {/* Centro — ícono + texto */}
        <View style={s.center}>

          <Animated.View style={[s.checkCircle, { transform: [{ scale: checkScale }] }]}>
            <MaterialIcons name="check" size={48} color="#FFFFFF" />
          </Animated.View>

          <Animated.View style={[s.textBlock, { opacity: contentOpacity }]}>
            <Text style={s.title}>¡Reserva enviada!</Text>
            <Text style={s.subtitle}>
              Le avisamos a {firstName}. Tiene 24hs para confirmar tu sesión.
            </Text>
            <View style={s.statusBadge}>
              <Text style={s.statusBadgeText}>Pendiente de confirmación</Text>
            </View>
          </Animated.View>

          {/* Tarjeta resumen */}
          <Animated.View style={[s.card, { opacity: contentOpacity }]}>
            <View style={s.coachRow}>
              <View style={s.avatar}>
                <MaterialIcons name="person" size={28} color="rgba(255,255,255,0.55)" />
              </View>
              <View style={s.coachInfo}>
                <Text style={s.coachName}>{coachName}</Text>
                <Text style={s.coachSpecialty}>{specialty}</Text>
              </View>
              <MaterialIcons name="verified" size={16} color={ViveColors.accent} />
            </View>

            <View style={s.divider} />

            <View style={s.detailRow}>
              <MaterialIcons name="calendar-today" size={15} color={ViveColors.primary} />
              <Text style={s.detailText}>{formattedDate || '—'}</Text>
            </View>
            <View style={[s.detailRow, { marginBottom: 0 }]}>
              <MaterialIcons name="access-time" size={15} color={ViveColors.primary} />
              <Text style={s.detailText}>{time ? `${time} hs` : '—'}</Text>
            </View>
          </Animated.View>

        </View>

        {/* Botones */}
        <Animated.View style={[s.footer, { opacity: contentOpacity }]}>
          <TouchableOpacity
            style={s.btnPrimary}
            onPress={() => router.push({ pathname: '/sala', params: { coach_id: coachId } })}
            activeOpacity={0.85}>
            <Text style={s.btnPrimaryText}>Ver mi sala</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.btnSecondary}
            onPress={() => router.navigate('/(tabs)')}
            activeOpacity={0.75}>
            <Text style={s.btnSecondaryText}>Volver a Inicio</Text>
          </TouchableOpacity>
        </Animated.View>

      </SafeAreaView>
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
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  safe: {
    flex: 1,
    paddingHorizontal: 24,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 24,
  },

  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: ViveColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    ...Platform.select({
      ios: {
        shadowColor: ViveColors.accent,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
    }),
  },

  textBlock: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontFamily: ViveFonts.semibold,
    fontSize: 26,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  statusBadge: {
    backgroundColor: 'rgba(232,197,71,0.18)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  statusBadgeText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.primary,
    textAlign: 'center',
  },

  card: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    padding: 18,
    width: '100%',
    ...cardShadow,
  },
  coachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  coachInfo: { flex: 1 },
  coachName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  coachSpecialty: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: ViveColors.primary,
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: 14,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  detailText: {
    fontFamily: ViveFonts.medium,
    fontSize: 14,
    color: '#FFFFFF',
  },

  footer: {
    gap: 12,
    paddingBottom: 8,
  },
  btnPrimary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnPrimaryText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: '#1A1A2E',
    letterSpacing: 0.2,
  },
  btnSecondary: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.50)',
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});