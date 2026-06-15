import { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

const mockProfesionales = [
  { id: '1', name: 'María González', specialty: 'Psicóloga', initials: 'MG' },
  { id: '2', name: 'Carlos Méndez', specialty: 'Coach de vida', initials: 'CM' },
];

type ConfigItem = {
  id: string;
  icon: string;
  label: string;
  danger?: boolean;
  onPress: () => void;
};

export default function ProfileOwnScreen() {
  const router = useRouter();
  const { user, switchRole, signOut } = useAuth();

  const displayName = user?.user_metadata?.name ?? user?.email?.split('@')[0] ?? 'Usuario';
  const displayEmail = user?.email ?? '';
  const displayInitial = displayName[0]?.toUpperCase() ?? 'U';

  async function handleSignOut() {
    await signOut();
    router.replace('/');
  }

  function handleSwitchToCoach() {
    switchRole();
    router.replace('/(coach)');
  }
  const headerAnim = useRef(new Animated.Value(0)).current;
  const identityAnim = useRef(new Animated.Value(0)).current;
  const activityAnim = useRef(new Animated.Value(0)).current;
  const profAnim = useRef(new Animated.Value(0)).current;
  const configAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.timing(headerAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(identityAnim, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.timing(activityAnim, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.timing(profAnim, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.timing(configAnim, { toValue: 1, duration: 360, useNativeDriver: true }),
    ]).start();
  }, []);

  const fadeUp = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  });

  const configItems: ConfigItem[] = [
    { id: 'notif', icon: 'bell-outline', label: 'Notificaciones', onPress: () => {} },
    { id: 'lang', icon: 'web', label: 'Idioma', onPress: () => {} },
    { id: 'terms', icon: 'file-document-outline', label: 'Términos y condiciones', onPress: () => {} },
    { id: 'privacy', icon: 'lock-outline', label: 'Política de privacidad', onPress: () => {} },
    { id: 'logout', icon: 'logout', label: 'Cerrar sesión', danger: true, onPress: handleSignOut },
  ];

  const guestConfigItems: ConfigItem[] = [
    { id: 'terms', icon: 'file-document-outline', label: 'Términos y condiciones', onPress: () => {} },
    { id: 'privacy', icon: 'lock-outline', label: 'Política de privacidad', onPress: () => {} },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <Animated.View style={[styles.header, fadeUp(headerAnim)]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={ViveColors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mi perfil</Text>
        <View style={styles.headerSpacer} />
      </Animated.View>
      <View style={styles.headerDivider} />

      {!user ? (
        /* ── Guest state ── */
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.guestSection, fadeUp(identityAnim)]}>
            <View style={styles.guestAvatar}>
              <MaterialCommunityIcons name="account" size={44} color={`${ViveColors.text}35`} />
            </View>
            <Text style={styles.guestTitle}>¿Sos nuevo por acá?</Text>
            <Text style={styles.guestSubtitle}>
              Creá tu cuenta para guardar tu progreso y conectar con profesionales.
            </Text>
            <TouchableOpacity
              style={styles.guestBtnPrimary}
              onPress={() => router.push('/register')}
              activeOpacity={0.8}
            >
              <Text style={styles.guestBtnPrimaryText}>Crear cuenta</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.guestBtnSecondary}
              onPress={() => router.push('/login')}
              activeOpacity={0.8}
            >
              <Text style={styles.guestBtnSecondaryText}>Ya tengo cuenta</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={fadeUp(configAnim)}>
            <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Legal</Text>
            <View style={styles.configList}>
              {guestConfigItems.map((item, i) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.configRow, i < guestConfigItems.length - 1 && styles.configRowDivider]}
                  onPress={item.onPress}
                  activeOpacity={0.72}
                >
                  <MaterialCommunityIcons
                    name={item.icon as any}
                    size={20}
                    color={ViveColors.text}
                    style={styles.configIcon}
                  />
                  <Text style={styles.configLabel}>{item.label}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={`${ViveColors.text}40`} />
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        /* ── Logged-in state ── */
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Identidad */}
          <Animated.View style={[styles.identitySection, fadeUp(identityAnim)]}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>{displayInitial}</Text>
            </View>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userEmail}>{displayEmail}</Text>
            <TouchableOpacity style={styles.editBtn} activeOpacity={0.75}>
              <Text style={styles.editBtnText}>Editar perfil</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Mi actividad */}
          <Animated.View style={fadeUp(activityAnim)}>
            <Text style={styles.sectionTitle}>Mi actividad</Text>
            <View style={styles.metricsRow}>
              <MetricCard emoji="🗓️" value="3 sesiones" label="Completadas" />
              <MetricCard emoji="📚" value="5 recursos" label="Guardados" />
              <MetricCard emoji="🔥" value="7 días" label="Racha activa" />
            </View>
          </Animated.View>

          {/* Mis profesionales */}
          <Animated.View style={fadeUp(profAnim)}>
            <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Mis profesionales</Text>
            <View style={styles.profList}>
              {mockProfesionales.map((p, i) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.profRow, i < mockProfesionales.length - 1 && styles.profRowDivider]}
                  onPress={() => router.push({ pathname: '/sala', params: { coach_id: p.id } })}
                  activeOpacity={0.72}
                >
                  <View style={styles.profAvatar}>
                    <Text style={styles.profAvatarText}>{p.initials}</Text>
                  </View>
                  <View style={styles.profInfo}>
                    <Text style={styles.profName}>{p.name}</Text>
                    <Text style={styles.profSpecialty}>{p.specialty}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={`${ViveColors.text}40`} />
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          {/* Configuración */}
          <Animated.View style={fadeUp(configAnim)}>
            <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Configuración</Text>
            <View style={styles.configList}>
              {configItems.map((item, i) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.configRow, i < configItems.length - 1 && styles.configRowDivider]}
                  onPress={item.onPress}
                  activeOpacity={0.72}
                >
                  <MaterialCommunityIcons
                    name={item.icon as any}
                    size={20}
                    color={item.danger ? '#E05252' : ViveColors.text}
                    style={styles.configIcon}
                  />
                  <Text style={[styles.configLabel, item.danger && styles.configLabelDanger]}>
                    {item.label}
                  </Text>
                  {!item.danger && (
                    <MaterialCommunityIcons name="chevron-right" size={20} color={`${ViveColors.text}40`} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          {/* Dev: switch to coach view */}
          <TouchableOpacity
            style={styles.devCoachBtn}
            onPress={handleSwitchToCoach}
            activeOpacity={0.75}>
            <MaterialCommunityIcons name="swap-horizontal" size={16} color={`${ViveColors.text}70`} />
            <Text style={styles.devCoachBtnText}>Cambiar a vista coach</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function MetricCard({ emoji, value, label }: { emoji: string; value: string; label: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricEmoji}>{emoji}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#1F4A43',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: ViveColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: ViveColors.text,
    textAlign: 'center',
    marginRight: 30,
  },
  headerSpacer: { width: 30 },
  headerDivider: {
    height: 1,
    backgroundColor: `${ViveColors.text}0D`,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },

  // Guest state
  guestSection: {
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 40,
    paddingHorizontal: 32,
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
  },
  guestAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${ViveColors.text}0C`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  guestTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 22,
    color: ViveColors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  guestSubtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: ViveColors.text,
    opacity: 0.6,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
  },
  guestBtnPrimary: {
    width: '100%',
    backgroundColor: ViveColors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  guestBtnPrimaryText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  guestBtnSecondary: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: ViveColors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  guestBtnSecondaryText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: ViveColors.primary,
  },

  // Identidad
  identitySection: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
  },
  avatarLarge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: `${ViveColors.primary}20`,
    borderWidth: 2,
    borderColor: ViveColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: ViveColors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  avatarLargeText: {
    fontFamily: ViveFonts.bold,
    fontSize: 28,
    color: ViveColors.primary,
  },
  userName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 20,
    color: ViveColors.text,
    marginBottom: 4,
  },
  userEmail: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: ViveColors.text,
    opacity: 0.6,
    marginBottom: 16,
  },
  editBtn: {
    borderWidth: 1.5,
    borderColor: ViveColors.primary,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 20,
  },
  editBtnText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.primary,
  },

  // Sections
  sectionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: ViveColors.text,
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  sectionTitleSpaced: { marginTop: 4 },

  // Actividad
  metricsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
    ...cardShadow,
  },
  metricEmoji: { fontSize: 20 },
  metricValue: {
    fontFamily: ViveFonts.semibold,
    fontSize: 12,
    color: ViveColors.text,
    textAlign: 'center',
  },
  metricLabel: {
    fontFamily: ViveFonts.regular,
    fontSize: 10,
    color: `${ViveColors.text}70`,
    textAlign: 'center',
  },

  // Profesionales
  profList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    overflow: 'hidden',
    ...cardShadow,
  },
  profRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  profRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: `${ViveColors.text}08`,
  },
  profAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${ViveColors.primary}20`,
    borderWidth: 1.5,
    borderColor: ViveColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  profAvatarText: {
    fontFamily: ViveFonts.bold,
    fontSize: 13,
    color: ViveColors.primary,
  },
  profInfo: { flex: 1 },
  profName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: ViveColors.text,
    marginBottom: 2,
  },
  profSpecialty: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: ViveColors.primary,
  },

  // Configuración
  configList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 20,
    overflow: 'hidden',
    ...cardShadow,
  },
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 14,
  },
  configRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: `${ViveColors.text}08`,
  },
  configIcon: { flexShrink: 0 },
  configLabel: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: ViveColors.text,
  },
  configLabelDanger: { color: '#E05252' },

  // Dev switch
  devCoachBtn: {
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
  devCoachBtnText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: `${ViveColors.text}70`,
  },
});
