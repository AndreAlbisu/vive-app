import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { ViveColors, ViveFonts } from '@/constants/theme';

// ─── Mock data ────────────────────────────────────────────────────────────────
const COACH = {
  name: 'María González',
  initials: 'MG',
  specialty: 'Psicóloga',
  age: 34,
  nationality: 'Argentina',
  topics: ['Ansiedad', 'Tristeza', 'Pareja', 'Familia', 'Culpa', 'Crecimiento'],
  priceSession: 5500,
  packages: [
    { label: '4 sesiones', price: 20000, note: 'Ahorrás $2.000' },
    { label: '8 sesiones', price: 38000, note: 'Ahorrás $6.000' },
  ],
};

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const SLOTS = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];

type AvailKey = `${string}-${string}`;

const INITIAL_AVAIL: Set<AvailKey> = new Set([
  'Lun-09:00', 'Lun-10:00', 'Lun-11:00',
  'Mié-10:00', 'Mié-11:00', 'Mié-14:00',
  'Jue-15:00', 'Jue-16:00',
  'Vie-09:00', 'Vie-10:00',
]);

const cardShadow = Platform.select({
  ios: { shadowColor: ViveColors.text, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
  android: { elevation: 2 },
});

export default function CoachProfileScreen() {
  const router = useRouter();
  const { switchRole } = useAuth();
  const [instantMode, setInstantMode] = useState(false);
  const [availability, setAvailability] = useState<Set<AvailKey>>(new Set(INITIAL_AVAIL));

  function toggleSlot(day: string, slot: string) {
    const key: AvailKey = `${day}-${slot}`;
    setAvailability(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function handleSwitchToUser() {
    switchRole();
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        {/* ── Photo + Info ───────────────────────────────────── */}
        <View style={s.identitySection}>
          <View style={s.photoWrap}>
            <View style={s.photoPlaceholder}>
              <Text style={s.photoInitials}>{COACH.initials}</Text>
            </View>
            <TouchableOpacity style={s.editPhotoBtn} activeOpacity={0.8}>
              <MaterialCommunityIcons name="camera-outline" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <Text style={s.coachName}>{COACH.name}</Text>
          <Text style={s.coachSpecialty}>{COACH.specialty}</Text>
          <Text style={s.coachMeta}>{COACH.age} años · {COACH.nationality}</Text>

          <TouchableOpacity style={s.editProfileBtn} activeOpacity={0.75}>
            <Text style={s.editProfileBtnText}>Editar perfil</Text>
          </TouchableOpacity>
        </View>

        {/* ── Temas ─────────────────────────────────────────── */}
        <Text style={s.sectionTitle}>Temas que trabajo</Text>
        <View style={s.chipsWrap}>
          {COACH.topics.map(topic => (
            <View key={topic} style={s.topicChip}>
              <Text style={s.topicChipText}>{topic}</Text>
            </View>
          ))}
          <TouchableOpacity style={s.addChip} activeOpacity={0.7}>
            <MaterialCommunityIcons name="plus" size={14} color={ViveColors.primary} />
            <Text style={s.addChipText}>Agregar</Text>
          </TouchableOpacity>
        </View>

        {/* ── Precios ───────────────────────────────────────── */}
        <Text style={[s.sectionTitle, s.sectionSpaced]}>Precio y paquetes</Text>
        <View style={s.priceCard}>
          <View style={s.priceRow}>
            <Text style={s.priceLabel}>Sesión individual</Text>
            <Text style={s.priceValue}>${COACH.priceSession.toLocaleString('es-AR')}</Text>
          </View>
          <View style={s.priceDivider} />
          {COACH.packages.map((pkg, i) => (
            <View key={i} style={[s.priceRow, i > 0 && { borderTopWidth: 1, borderTopColor: `${ViveColors.text}08`, paddingTop: 12, marginTop: 12 }]}>
              <View>
                <Text style={s.priceLabel}>{pkg.label}</Text>
                <Text style={s.priceSaving}>{pkg.note}</Text>
              </View>
              <Text style={s.priceValue}>${pkg.price.toLocaleString('es-AR')}</Text>
            </View>
          ))}
        </View>

        {/* ── Modo de reserva ───────────────────────────────── */}
        <Text style={[s.sectionTitle, s.sectionSpaced]}>Modalidad de reserva</Text>
        <View style={s.toggleCard}>
          <View style={s.toggleInfo}>
            <Text style={s.toggleTitle}>{instantMode ? 'Instantánea' : 'Con confirmación'}</Text>
            <Text style={s.toggleDesc}>
              {instantMode
                ? 'Los usuarios reservan directamente sin esperar tu aprobación.'
                : 'Cada reserva requiere tu confirmación antes de quedar fijada.'}
            </Text>
          </View>
          <Switch
            value={instantMode}
            onValueChange={setInstantMode}
            trackColor={{ false: `${ViveColors.text}25`, true: ViveColors.accent }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={`${ViveColors.text}25`}
          />
        </View>

        {/* ── Disponibilidad ────────────────────────────────── */}
        <Text style={[s.sectionTitle, s.sectionSpaced]}>Disponibilidad</Text>
        <View style={s.availCard}>
          {/* Column headers */}
          <View style={s.availHeaderRow}>
            <View style={s.slotLabelCol} />
            {DAYS.map(d => (
              <Text key={d} style={s.availDayHeader}>{d}</Text>
            ))}
          </View>
          {/* Grid */}
          {SLOTS.map(slot => (
            <View key={slot} style={s.availRow}>
              <Text style={s.slotLabel}>{slot}</Text>
              {DAYS.map(day => {
                const key: AvailKey = `${day}-${slot}`;
                const active = availability.has(key);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[s.availCell, active && s.availCellActive]}
                    onPress={() => toggleSlot(day, slot)}
                    activeOpacity={0.7}
                  />
                );
              })}
            </View>
          ))}
          <Text style={s.availHint}>Tocá para activar / desactivar horarios</Text>
        </View>

        {/* ── Video perfil ──────────────────────────────────── */}
        <Text style={[s.sectionTitle, s.sectionSpaced]}>Video de perfil</Text>
        <View style={s.videoCard}>
          <View style={s.videoPlaceholder}>
            <MaterialCommunityIcons name="video-outline" size={36} color={`${ViveColors.text}40`} />
            <Text style={s.videoPlaceholderText}>Sin video grabado</Text>
          </View>
          <TouchableOpacity style={s.recordBtn} onPress={() => console.log('[Coach] grabar video')} activeOpacity={0.85}>
            <MaterialCommunityIcons name="record-circle-outline" size={16} color={ViveColors.primary} />
            <Text style={s.recordBtnText}>Grabar nuevo video</Text>
          </TouchableOpacity>
        </View>

        {/* ── Estadísticas (post-MVP) ───────────────────────── */}
        <Text style={[s.sectionTitle, s.sectionSpaced]}>Estadísticas</Text>
        <View style={s.comingSoonCard}>
          <MaterialCommunityIcons name="chart-bar" size={30} color={`${ViveColors.text}30`} />
          <Text style={s.comingSoonText}>Próximamente</Text>
          <Text style={s.comingSoonDesc}>
            Aquí vas a ver sesiones completadas, rating promedio, retención de usuarios y más.
          </Text>
        </View>

        {/* ── Dev: switch to user ───────────────────────────── */}
        <TouchableOpacity style={s.devSwitchBtn} onPress={handleSwitchToUser} activeOpacity={0.75}>
          <MaterialCommunityIcons name="swap-horizontal" size={16} color={`${ViveColors.text}70`} />
          <Text style={s.devSwitchText}>Cambiar a vista usuario</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ViveColors.background },
  container: { paddingTop: 0, paddingHorizontal: 0 },

  // Identity section
  identitySection: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    marginBottom: 24,
  },
  photoWrap: { position: 'relative', marginBottom: 16 },
  photoPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: `${ViveColors.primary}25`,
    borderWidth: 2.5,
    borderColor: ViveColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: ViveColors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10 },
      android: { elevation: 4 },
    }),
  },
  photoInitials: {
    fontFamily: ViveFonts.bold,
    fontSize: 30,
    color: ViveColors.primary,
  },
  editPhotoBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ViveColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  coachName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 22,
    color: ViveColors.text,
    marginBottom: 4,
  },
  coachSpecialty: {
    fontFamily: ViveFonts.medium,
    fontSize: 14,
    color: ViveColors.primary,
    marginBottom: 4,
  },
  coachMeta: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: `${ViveColors.text}70`,
    marginBottom: 18,
  },
  editProfileBtn: {
    borderWidth: 1.5,
    borderColor: ViveColors.primary,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 22,
  },
  editProfileBtnText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.primary,
  },

  // Sections
  sectionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: ViveColors.text,
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  sectionSpaced: { marginTop: 28 },

  // Topics
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 8,
  },
  topicChip: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 20,
    backgroundColor: `${ViveColors.text}10`,
  },
  topicChipText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.text,
  },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: `${ViveColors.primary}60`,
    gap: 3,
  },
  addChipText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.primary,
  },

  // Price
  priceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    ...cardShadow,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceDivider: {
    height: 1,
    backgroundColor: `${ViveColors.text}0D`,
    marginVertical: 12,
  },
  priceLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 14,
    color: ViveColors.text,
  },
  priceSaving: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: ViveColors.accent,
    marginTop: 2,
  },
  priceValue: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: ViveColors.text,
  },

  // Toggle
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    gap: 16,
    ...cardShadow,
  },
  toggleInfo: { flex: 1 },
  toggleTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: ViveColors.text,
    marginBottom: 3,
  },
  toggleDesc: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: `${ViveColors.text}70`,
    lineHeight: 18,
  },

  // Availability grid
  availCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    ...cardShadow,
  },
  availHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  slotLabelCol: { width: 44 },
  availDayHeader: {
    flex: 1,
    fontFamily: ViveFonts.semibold,
    fontSize: 10,
    color: `${ViveColors.text}80`,
    textAlign: 'center',
  },
  availRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  slotLabel: {
    width: 44,
    fontFamily: ViveFonts.regular,
    fontSize: 10,
    color: `${ViveColors.text}70`,
  },
  availCell: {
    flex: 1,
    height: 28,
    borderRadius: 6,
    backgroundColor: `${ViveColors.text}0A`,
    marginHorizontal: 2,
  },
  availCellActive: {
    backgroundColor: ViveColors.primary,
    ...Platform.select({
      ios: { shadowColor: ViveColors.primary, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 3 },
      android: { elevation: 1 },
    }),
  },
  availHint: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: `${ViveColors.text}50`,
    textAlign: 'center',
    marginTop: 10,
  },

  // Video
  videoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    alignItems: 'center',
    gap: 16,
    ...cardShadow,
  },
  videoPlaceholder: {
    width: '100%',
    height: 130,
    borderRadius: 12,
    backgroundColor: ViveColors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: `${ViveColors.text}10`,
    borderStyle: 'dashed',
  },
  videoPlaceholderText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: `${ViveColors.text}50`,
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: ViveColors.primary,
  },
  recordBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: ViveColors.primary,
  },

  // Coming soon
  comingSoonCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    alignItems: 'center',
    gap: 8,
    ...cardShadow,
  },
  comingSoonText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: `${ViveColors.text}50`,
  },
  comingSoonDesc: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: `${ViveColors.text}55`,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 2,
  },

  // Dev switch
  devSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 20,
    marginTop: 28,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${ViveColors.text}20`,
    borderStyle: 'dashed',
  },
  devSwitchText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: `${ViveColors.text}70`,
  },
});
