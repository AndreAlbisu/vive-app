import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Animated, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { AppBg } from '@/components/ui/AppBg';

const fadeUp = (anim: Animated.Value) => ({
  opacity: anim,
  transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
});

export default function CoachLoginScreen() {
  const router = useRouter();
  const { signInWithEmail, signUpWithEmail, signOut } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(formAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();
  }, []);

  async function validateAndNavigate() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [{ data: profile }, { data: coachRow }] = await Promise.all([
      supabase.from('profiles').select('role').eq('id', user.id).single(),
      supabase.from('coaches').select('id, verified').eq('profile_id', user.id).maybeSingle(),
    ]);

    if (profile?.role === 'user') {
      setLoading(false);
      setError('Esta cuenta ya está registrada como usuario. Para postularte como coach necesitás usar un mail distinto.');
      return;
    }

    setLoading(false);

    if (coachRow?.verified) {
      Alert.alert(
        '¡Bienvenido de nuevo!',
        'Tu cuenta de coach ya está aprobada. Te llevamos a tu panel.',
        [{ text: 'OK', onPress: () => router.replace('/(coach)' as any) }],
      );
      return;
    }

    if (coachRow && !coachRow.verified) {
      await signOut();
      Alert.alert(
        'Solicitud en revisión',
        'Ya enviaste tu solicitud para ser coach. Te avisaremos cuando VIVE la apruebe.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
      return;
    }

    router.replace('/coach-application');
  }

  async function handleSubmit() {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError('Completá el email y la contraseña.');
      return;
    }
    if (trimmedPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    setError(null);

    const signInError = await signInWithEmail(trimmedEmail, trimmedPassword);

    if (!signInError) {
      await validateAndNavigate();
      return;
    }

    // Intentar crear la cuenta si las credenciales no existen
    const nameFromEmail = trimmedEmail.split('@')[0];
    const signUpError = await signUpWithEmail(trimmedEmail, trimmedPassword, nameFromEmail);

    if (!signUpError) {
      await validateAndNavigate();
      return;
    }

    setLoading(false);

    // Si signUp también falla, la cuenta existe pero la contraseña es incorrecta
    if (signUpError.includes('already registered') || signUpError.includes('already been registered')) {
      setError('Contraseña incorrecta. Revisá tus datos.');
    } else {
      setError('No pudimos acceder. Revisá el email y la contraseña.');
    }
  }

  return (
    <AppBg>
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.header, fadeUp(headerAnim)]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
              <MaterialCommunityIcons name="arrow-left" size={20} color="#565E32" />
              <Text style={styles.backText}>Atrás</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={[styles.content, fadeUp(formAnim)]}>
            <View style={styles.titleArea}>
              <Text style={styles.title}>Accedé a tu cuenta</Text>
              <Text style={styles.subtitle}>
                Si todavía no tenés una, la creamos al instante.
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="tu@email.com"
                  placeholderTextColor="rgba(135,131,92,0.45)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Contraseña</Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Mínimo 6 caracteres"
                    placeholderTextColor="rgba(135,131,92,0.45)"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword(v => !v)}
                    hitSlop={8}
                  >
                    <MaterialCommunityIcons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="rgba(135,131,92,0.72)"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {error && (
                <View style={styles.errorBox}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#C0392B" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <Text style={styles.buttonText}>Ingresando...</Text>
              ) : (
                <Text style={styles.buttonText}>Continuar</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.note}>
              Podés usar una cuenta existente de VIVE o crear una nueva. El rol de coach se activa cuando VIVE aprueba tu solicitud.
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </AppBg>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: '#87835C',
  },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 28, gap: 28 },
  titleArea: { gap: 8 },
  title: {
    fontFamily: ViveFonts.semibold,
    fontSize: 30,
    color: '#565E32',
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  subtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: '#87835C',
    lineHeight: 22,
  },
  form: { gap: 16 },
  field: { gap: 6 },
  label: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: '#87835C',
  },
  input: {
    backgroundColor: 'rgba(255,248,240,0.48)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: '#565E32',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  passwordWrap: { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(224,82,82,0.15)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#FF7070',
    flex: 1,
    lineHeight: 18,
  },
  button: {
    backgroundColor: ViveColors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: '#565E32',
    letterSpacing: 0.3,
  },
  note: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: 'rgba(135,131,92,0.72)',
    lineHeight: 18,
    textAlign: 'center',
  },
});
