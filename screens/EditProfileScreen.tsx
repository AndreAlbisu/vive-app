import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

const GENDER_OPTIONS = ['Prefiero no decir', 'Masculino', 'Femenino', 'No binario'] as const;
type Gender = (typeof GENDER_OPTIONS)[number];

export default function EditProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<Gender>('Prefiero no decir');
  const [nationality, setNationality] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!user) return;
    loadProfile();
  }, [user?.id]);

  async function loadProfile() {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('name, birth_date, gender, nationality')
      .eq('id', user!.id)
      .single();

    if (data) {
      setName(data.name ?? user?.user_metadata?.name ?? '');
      setBirthDate(data.birth_date ? isoToDisplay(data.birth_date) : '');
      setGender((GENDER_OPTIONS as readonly string[]).includes(data.gender ?? '') ? data.gender : 'Prefiero no decir');
      setNationality(data.nationality ?? '');
    } else {
      setName(user?.user_metadata?.name ?? '');
    }
    setLoading(false);
  }

  function isoToDisplay(iso: string) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  function displayToIso(display: string): string | null {
    const cleaned = display.replace(/[^0-9]/g, '');
    if (cleaned.length !== 8) return null;
    const d = cleaned.slice(0, 2);
    const m = cleaned.slice(2, 4);
    const y = cleaned.slice(4, 8);
    const date = new Date(`${y}-${m}-${d}`);
    if (isNaN(date.getTime())) return null;
    return `${y}-${m}-${d}`;
  }

  function handleBirthDateChange(text: string) {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 8);
    let formatted = cleaned;
    if (cleaned.length > 4) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4)}`;
    } else if (cleaned.length > 2) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    }
    setBirthDate(formatted);
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    const updateData: Record<string, any> = {
      name: name.trim(),
      gender,
      nationality: nationality.trim(),
    };

    if (birthDate.replace(/[^0-9]/g, '').length > 0) {
      const iso = displayToIso(birthDate);
      if (!iso) {
        setErrorMsg('Fecha inválida. Usá el formato DD/MM/AAAA.');
        setSaving(false);
        return;
      }
      updateData.birth_date = iso;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id);

    setSaving(false);

    if (error) {
      setErrorMsg('Error al guardar. Intentalo de nuevo.');
    } else {
      setSuccessMsg('✓ Perfil actualizado');
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  }

  const initials =
    name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || 'U';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={ViveColors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar perfil</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.headerDivider} />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ViveColors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <TouchableOpacity style={styles.changePhotoBtn} activeOpacity={0.72}>
              <Text style={styles.changePhotoText}>Cambiar foto</Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.formCard}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Nombre completo</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Tu nombre"
                placeholderTextColor={`${ViveColors.text}40`}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>

            <View style={styles.fieldDivider} />

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={user?.email ?? ''}
                editable={false}
                selectTextOnFocus={false}
              />
              <Text style={styles.fieldNote}>El email no se puede cambiar</Text>
            </View>

            <View style={styles.fieldDivider} />

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Fecha de nacimiento</Text>
              <TextInput
                style={styles.input}
                value={birthDate}
                onChangeText={handleBirthDateChange}
                placeholder="DD/MM/AAAA"
                placeholderTextColor={`${ViveColors.text}40`}
                keyboardType="numeric"
                maxLength={10}
                returnKeyType="next"
              />
            </View>

            <View style={styles.fieldDivider} />

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Sexo</Text>
              <View style={styles.genderGrid}>
                {GENDER_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[styles.genderChip, gender === option && styles.genderChipSelected]}
                    onPress={() => setGender(option)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.genderChipText,
                        gender === option && styles.genderChipTextSelected,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.fieldDivider} />

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Nacionalidad</Text>
              <TextInput
                style={styles.input}
                value={nationality}
                onChangeText={setNationality}
                placeholder="Tu nacionalidad"
                placeholderTextColor={`${ViveColors.text}40`}
                autoCapitalize="words"
                returnKeyType="done"
              />
            </View>
          </View>

          {successMsg ? (
            <View style={styles.successBanner}>
              <MaterialCommunityIcons name="check-circle" size={16} color={ViveColors.accent} />
              <Text style={styles.successText}>{successMsg}</Text>
            </View>
          ) : null}

          {errorMsg ? (
            <View style={styles.errorBanner}>
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#E05252" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            activeOpacity={0.82}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>Guardar cambios</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
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

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },

  avatarSection: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 28,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${ViveColors.primary}20`,
    borderWidth: 2,
    borderColor: ViveColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
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
  avatarText: {
    fontFamily: ViveFonts.bold,
    fontSize: 30,
    color: ViveColors.primary,
  },
  changePhotoBtn: {
    borderWidth: 1.5,
    borderColor: ViveColors.primary,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 20,
  },
  changePhotoText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.primary,
  },

  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    overflow: 'hidden',
    ...cardShadow,
  },
  fieldGroup: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  fieldDivider: {
    height: 1,
    backgroundColor: `${ViveColors.text}08`,
    marginHorizontal: 16,
  },
  fieldLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: `${ViveColors.text}70`,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: ViveColors.text,
    paddingVertical: 0,
  },
  inputDisabled: {
    color: `${ViveColors.text}50`,
  },
  fieldNote: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: `${ViveColors.text}50`,
    marginTop: 4,
  },

  genderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  genderChip: {
    borderWidth: 1.5,
    borderColor: `${ViveColors.text}25`,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  genderChipSelected: {
    borderColor: ViveColors.primary,
    backgroundColor: `${ViveColors.primary}12`,
  },
  genderChipText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: `${ViveColors.text}70`,
  },
  genderChipTextSelected: {
    fontFamily: ViveFonts.medium,
    color: ViveColors.primary,
  },

  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: `${ViveColors.accent}15`,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: `${ViveColors.accent}40`,
  },
  successText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.accent,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#FFF0F0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#F5C0C0',
  },
  errorText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: '#E05252',
  },

  saveBtn: {
    marginHorizontal: 20,
    backgroundColor: ViveColors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: ViveColors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  saveBtnDisabled: {
    opacity: 0.65,
  },
  saveBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: '#FFFFFF',
  },
});
