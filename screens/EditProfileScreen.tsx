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
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { AppBg } from '@/components/ui/AppBg';

const GENDER_OPTIONS = ['Prefiero no decir', 'Masculino', 'Femenino', 'No binario'] as const;
type Gender = (typeof GENDER_OPTIONS)[number];

export default function EditProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<Gender>('Prefiero no decir');
  const [nationality, setNationality] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
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
      .select('name, birth_date, gender, nationality, avatar_url')
      .eq('id', user!.id)
      .single();

    if (data) {
      setName(data.name ?? user?.user_metadata?.name ?? '');
      setBirthDate(data.birth_date ? isoToDisplay(data.birth_date) : '');
      setGender((GENDER_OPTIONS as readonly string[]).includes(data.gender ?? '') ? data.gender : 'Prefiero no decir');
      setNationality(data.nationality ?? '');
      setAvatarUrl(data.avatar_url ?? null);
    } else {
      setName(user?.user_metadata?.name ?? '');
    }
    setLoading(false);
  }

  async function uploadAvatar(uri: string, mimeType: string | null | undefined) {
    if (!user) return;
    setUploadingAvatar(true);
    try {
      const file = new File(uri);
      const bytes = await file.bytes();
      const path = `${user.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, bytes, { contentType: mimeType ?? 'image/jpeg', upsert: true });

      if (uploadError) {
        Alert.alert('No se pudo subir la foto', 'Probá de nuevo en unos minutos.');
        return;
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      // cache-bust: el path es siempre el mismo (upsert), así que sin esto
      // el celular podría seguir mostrando la foto vieja desde caché.
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

      const { data: updateData, error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)
        .select('avatar_url');

      if (updateError || !updateData || updateData.length === 0) {
        Alert.alert('Foto subida', 'Pero no se pudo guardar en tu perfil. Probá de nuevo.');
        return;
      }

      setAvatarUrl(publicUrl);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function launchAvatarPicker(source: 'camera' | 'library') {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permiso necesario', 'Activá el permiso desde los ajustes del celular para continuar.');
      return;
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    };
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    await uploadAvatar(asset.uri, asset.mimeType);
  }

  function pickAvatar() {
    Alert.alert('Foto de perfil', 'Elegí una opción', [
      { text: 'Tomar foto', onPress: () => launchAvatarPicker('camera') },
      { text: 'Elegir de la galería', onPress: () => launchAvatarPicker('library') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
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
    <AppBg>
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#565E32" />
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
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.changePhotoBtn}
              onPress={pickAvatar}
              disabled={uploadingAvatar}
              activeOpacity={0.72}
            >
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#565E32" />
              ) : (
                <Text style={styles.changePhotoText}>Cambiar foto</Text>
              )}
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
                placeholderTextColor="rgba(135,131,92,0.45)"
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
                placeholderTextColor="rgba(135,131,92,0.45)"
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
                placeholderTextColor="rgba(135,131,92,0.45)"
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
              <ActivityIndicator size="small" color="#565E32" />
            ) : (
              <Text style={styles.saveBtnText}>Guardar cambios</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
    </AppBg>
  );
}

const GLASS = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';
const INPUT_BG = 'rgba(255,248,240,0.48)';

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,248,240,0.48)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(86,94,50,0.14)',
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: '#565E32',
    textAlign: 'center',
    marginRight: 30,
  },
  headerSpacer: { width: 30 },
  headerDivider: { height: 1, backgroundColor: 'rgba(86,94,50,0.08)' },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },

  avatarSection: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 28,
    backgroundColor: GLASS,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
    marginBottom: 16,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,248,240,0.65)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    fontFamily: ViveFonts.bold,
    fontSize: 30,
    color: '#FFFFFF',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.72)',
    marginBottom: 14,
  },
  changePhotoBtn: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.72)',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 20,
  },
  changePhotoText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: '#565E32',
  },

  formCard: {
    backgroundColor: GLASS,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginHorizontal: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  fieldGroup: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  fieldDivider: {
    height: 1,
    backgroundColor: 'rgba(86,94,50,0.08)',
    marginHorizontal: 16,
  },
  fieldLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: '#87835C',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: '#565E32',
    paddingVertical: 0,
  },
  inputDisabled: {
    color: 'rgba(135,131,92,0.58)',
  },
  fieldNote: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: 'rgba(135,131,92,0.65)',
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
    borderColor: 'rgba(255,255,255,0.60)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: INPUT_BG,
  },
  genderChipSelected: {
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255,248,240,0.68)',
  },
  genderChipText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#87835C',
  },
  genderChipTextSelected: {
    fontFamily: ViveFonts.medium,
    color: '#565E32',
  },

  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: 'rgba(107,191,138,0.2)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(107,191,138,0.45)',
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
    backgroundColor: 'rgba(224,82,82,0.15)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(224,82,82,0.35)',
  },
  errorText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: '#FF7070',
  },

  saveBtn: {
    marginHorizontal: 20,
    backgroundColor: ViveColors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.65 },
  saveBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: '#565E32',
  },
});
