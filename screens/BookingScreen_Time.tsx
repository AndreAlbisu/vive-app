import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ViveColors, ViveFonts } from '@/constants/theme';

const ALL_TIMES = [
  { label: '9:00',  available: true  },
  { label: '10:00', available: true  },
  { label: '11:00', available: false },
  { label: '14:00', available: true  },
  { label: '15:00', available: true  },
  { label: '16:00', available: false },
  { label: '17:00', available: true  },
];

const MONTHS_SHORT = [
  'ene','feb','mar','abr','may','jun',
  'jul','ago','sep','oct','nov','dic',
];

function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  return `${day} de ${MONTHS_SHORT[month - 1]} ${year}`;
}

type Params = {
  name?: string;
  specialty?: string;
  priceFrom?: string;
  date?: string;
};

export default function BookingScreen_Time() {
  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const coachName = params.name ?? 'Laura Méndez';
  const specialty = params.specialty ?? 'Coach de vida';
  const dateStr = params.date ?? '';

  function onSeguimos() {
    if (!selectedTime) return;
    router.push({
      pathname: '/booking-confirm',
      params: {
        ...(params.name && { name: params.name }),
        ...(params.specialty && { specialty: params.specialty }),
        ...(params.priceFrom && { priceFrom: params.priceFrom }),
        date: dateStr,
        time: selectedTime,
      },
    });
  }

  return (
    <View style={s.root}>

      <SafeAreaView style={s.safeTop} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="arrow-back-ios" size={18} color={ViveColors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Elegí un horario</Text>
          <View style={s.headerSpacer} />
        </View>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: '66%' }]} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Recordatorio del coach */}
        <View style={s.coachReminder}>
          <View style={s.coachAvatar}>
            <MaterialIcons name="person" size={30} color="#C0BAB4" />
          </View>
          <View style={s.coachInfo}>
            <Text style={s.coachName}>{coachName}</Text>
            <Text style={s.coachSpecialty}>{specialty}</Text>
            {dateStr ? (
              <Text style={s.coachDate}>{formatDateShort(dateStr)}</Text>
            ) : null}
          </View>
        </View>

        {/* Chips de horario */}
        <Text style={s.sectionLabel}>Horarios disponibles</Text>

        <View style={s.chipsGrid}>
          {ALL_TIMES.map(({ label, available }) => {
            const isSelected = selectedTime === label;
            return (
              <TouchableOpacity
                key={label}
                style={[
                  s.chip,
                  available && !isSelected && s.chipAvailable,
                  isSelected && s.chipSelected,
                  !available && s.chipUnavailable,
                ]}
                onPress={() => available && setSelectedTime(label)}
                activeOpacity={available ? 0.75 : 1}
                disabled={!available}>
                <Text style={[
                  s.chipText,
                  available && !isSelected && s.chipTextAvailable,
                  isSelected && s.chipTextSelected,
                  !available && s.chipTextUnavailable,
                ]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={s.timezoneNote}>
          <MaterialIcons name="access-time" size={13} color={`${ViveColors.text}55`} />
          <Text style={s.timezoneText}>Horarios en zona horaria Argentina (ART)</Text>
        </View>

      </ScrollView>

      <SafeAreaView style={s.footerSafe} edges={['bottom']}>
        <View style={s.footer}>
          <TouchableOpacity
            style={[s.btn, !selectedTime && s.btnDisabled]}
            onPress={onSeguimos}
            disabled={!selectedTime}
            activeOpacity={0.85}>
            <Text style={s.btnText}>Seguimos</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

    </View>
  );
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: ViveColors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  android: { elevation: 3 },
});

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ViveColors.background,
  },
  safeTop: {
    backgroundColor: ViveColors.background,
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
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: ViveColors.text, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  headerTitle: {
    flex: 1,
    fontFamily: ViveFonts.semibold,
    fontSize: 18,
    color: ViveColors.text,
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

  coachReminder: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 28,
    ...cardShadow,
  },
  coachAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EDE7E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  coachInfo: { flex: 1 },
  coachName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: ViveColors.text,
    marginBottom: 2,
  },
  coachSpecialty: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: ViveColors.primary,
    marginBottom: 4,
  },
  coachDate: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: `${ViveColors.text}88`,
  },

  sectionLabel: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: ViveColors.text,
    marginBottom: 16,
  },

  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  chip: {
    paddingVertical: 13,
    paddingHorizontal: 22,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipAvailable: {
    backgroundColor: '#FFFFFF',
    borderColor: `${ViveColors.text}35`,
    ...Platform.select({
      ios: { shadowColor: ViveColors.text, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  chipSelected: {
    backgroundColor: ViveColors.primary,
    borderColor: ViveColors.primary,
  },
  chipUnavailable: {
    backgroundColor: `${ViveColors.text}08`,
    borderColor: 'transparent',
  },
  chipText: {
    fontFamily: ViveFonts.medium,
    fontSize: 15,
    color: ViveColors.text,
  },
  chipTextAvailable: {
    color: ViveColors.text,
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontFamily: ViveFonts.semibold,
  },
  chipTextUnavailable: {
    color: '#CBCBCB',
  },

  timezoneNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timezoneText: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: `${ViveColors.text}55`,
  },

  footerSafe: {
    backgroundColor: ViveColors.background,
    borderTopWidth: 1,
    borderTopColor: `${ViveColors.text}10`,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  btn: {
    backgroundColor: ViveColors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.45,
  },
  btnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
