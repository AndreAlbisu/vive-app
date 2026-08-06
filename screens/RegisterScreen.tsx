import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  LayoutAnimation,
  UIManager,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { AppBg } from '@/components/ui/AppBg';
import { VitaWordmark } from '@/components/VitaWordmark';
import LegalSheet from '@/components/LegalSheet';
import { supabase } from '@/lib/supabase';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const fadeUp = (anim: Animated.Value) => ({
  opacity: anim,
  transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
});

export default function RegisterScreen() {
  const router = useRouter();
  const { signUpWithEmail, signInWithGoogle, signInWithApple } = useAuth();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const logoAnim    = useRef(new Animated.Value(0)).current;
  const headingAnim = useRef(new Animated.Value(0)).current;
  const btnsAnim    = useRef(new Animated.Value(0)).current;
  const footerAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.timing(logoAnim,    { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(headingAnim, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.timing(btnsAnim,    { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.timing(footerAnim,  { toValue: 1, duration: 320, useNativeDriver: true }),
    ]).start();
  }, []);

  function toggleEmailForm() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowEmailForm(prev => !prev);
    if (showEmailForm) {
      setName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setErrors({});
    }
  }

  function clearError(field: string) {
    setErrors(prev => ({ ...prev, [field]: false }));
  }

  async function handleRegister() {
    const newErrors: Record<string, boolean> = {
      name: !name.trim(),
      email: !email.trim(),
      password: !password.trim() || password.length < 6,
      confirm: !confirmPassword.trim() || confirmPassword !== password,
    };
    setErrors(newErrors);
    setServerError(null);
    if (Object.values(newErrors).some(Boolean)) return;

    setLoading(true);

    const { data: existingProfile } = await supabase
      .from('profiles').select('id').eq('email', email.trim().toLowerCase()).maybeSingle();
    if (existingProfile) {
      const { data: coachRow } = await supabase
        .from('coaches').select('id').eq('profile_id', existingProfile.id).maybeSingle();
      if (coachRow) {
        setLoading(false);
        setServerError('Esta cuenta ya está registrada como profesional. No podés crear una cuenta de usuario con el mismo mail.');
        return;
      }
    }

    const error = await signUpWithEmail(email.trim(), password, name.trim(), acceptedTerms);
    setLoading(false);

    if (error) {
      setServerError(error);
      return;
    }
    router.replace('/(tabs)');
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    setServerError(null);
    const error = await signInWithGoogle();
    setGoogleLoading(false);
    if (error) setServerError(error);
  }

  async function handleApple() {
    setAppleLoading(true);
    setServerError(null);
    const error = await signInWithApple();
    setAppleLoading(false);
    if (error) setServerError(error);
  }

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <Animated.View style={[s.logoWrap, fadeUp(logoAnim)]}>
            <VitaWordmark />
          </Animated.View>

          {/* ── Heading ──────────────────────────────────────────── */}
          <Animated.View style={[s.headingArea, fadeUp(headingAnim)]}>
            <Text style={s.heading}>Creá tu cuenta</Text>
            <Text style={s.subheading}>Es rápido y gratuito.</Text>
          </Animated.View>

          {/* ── Botones ──────────────────────────────────────────── */}
          <Animated.View style={[s.btnsArea, fadeUp(btnsAnim)]}>

            {/* Google */}
            <TouchableOpacity
              style={[s.googleBtn, googleLoading && { opacity: 0.6 }]}
              onPress={handleGoogle}
              activeOpacity={0.85}
              disabled={googleLoading || loading}
            >
              {googleLoading
                ? <ActivityIndicator size="small" color="#4285F4" />
                : <MaterialCommunityIcons name="google" size={20} color="#4285F4" />
              }
              <Text style={s.googleBtnText}>Continuar con Google</Text>
            </TouchableOpacity>

            {/* Apple — Sign in with Apple no existe en Android, ocultar */}
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[s.appleBtn, appleLoading && { opacity: 0.6 }]}
                onPress={handleApple}
                activeOpacity={0.85}
                disabled={appleLoading || loading}
              >
                {appleLoading
                  ? <ActivityIndicator size="small" color="#565E32" />
                  : <MaterialCommunityIcons name="apple" size={20} color="#565E32" />
                }
                <Text style={s.appleBtnText}>Continuar con Apple</Text>
              </TouchableOpacity>
            )}

            {serverError && !showEmailForm && (
              <Text style={s.serverError}>{serverError}</Text>
            )}

            {/* Separator */}
            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>o</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Usar email */}
            <TouchableOpacity style={s.emailBtn} onPress={toggleEmailForm} activeOpacity={0.85}>
              <MaterialCommunityIcons name="email-outline" size={20} color="#565E32" />
              <Text style={s.emailBtnText}>Usar email</Text>
            </TouchableOpacity>

            {/* Email form expandible */}
            {showEmailForm && (
              <View style={s.emailForm}>
                {/* Nombre */}
                <TextInput
                  style={[
                    s.input,
                    errors.name && s.inputError,
                    focused === 'name' && s.inputFocused,
                  ]}
                  value={name}
                  onChangeText={v => { setName(v); clearError('name'); }}
                  placeholder="Tu nombre"
                  placeholderTextColor="rgba(135,131,92,0.45)"
                  autoCapitalize="words"
                  onFocus={() => setFocused('name')}
                  onBlur={() => setFocused(null)}
                />

                {/* Email */}
                <TextInput
                  style={[
                    s.input,
                    errors.email && s.inputError,
                    focused === 'email' && s.inputFocused,
                  ]}
                  value={email}
                  onChangeText={v => { setEmail(v); clearError('email'); }}
                  placeholder="tu@email.com"
                  placeholderTextColor="rgba(135,131,92,0.45)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                />

                {/* Contraseña */}
                <View style={[
                  s.inputRow,
                  errors.password && s.inputError,
                  focused === 'pass' && s.inputFocused,
                ]}>
                  <TextInput
                    style={s.inputInner}
                    value={password}
                    onChangeText={v => { setPassword(v); clearError('password'); clearError('confirm'); }}
                    placeholder="Contraseña (mín. 6 caracteres)"
                    placeholderTextColor="rgba(135,131,92,0.45)"
                    secureTextEntry={!showPassword}
                    onFocus={() => setFocused('pass')}
                    onBlur={() => setFocused(null)}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                    <MaterialCommunityIcons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="rgba(135,131,92,0.65)"
                    />
                  </TouchableOpacity>
                </View>

                {/* Confirmar contraseña */}
                <View style={[
                  s.inputRow,
                  errors.confirm && s.inputError,
                  focused === 'confirm' && s.inputFocused,
                ]}>
                  <TextInput
                    style={s.inputInner}
                    value={confirmPassword}
                    onChangeText={v => { setConfirmPassword(v); clearError('confirm'); }}
                    placeholder="Confirmá tu contraseña"
                    placeholderTextColor="rgba(135,131,92,0.45)"
                    secureTextEntry={!showConfirm}
                    onFocus={() => setFocused('confirm')}
                    onBlur={() => setFocused(null)}
                  />
                  <TouchableOpacity onPress={() => setShowConfirm(v => !v)} hitSlop={8}>
                    <MaterialCommunityIcons
                      name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="rgba(135,131,92,0.65)"
                    />
                  </TouchableOpacity>
                </View>
                {errors.confirm && confirmPassword.length > 0 && (
                  <Text style={s.errorHint}>Las contraseñas no coinciden.</Text>
                )}

                {serverError && (
                  <Text style={s.serverError}>{serverError}</Text>
                )}

                {/* Checkbox de términos */}
                <TouchableOpacity
                  style={s.termsRow}
                  onPress={() => setAcceptedTerms(v => !v)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={acceptedTerms ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={22}
                    color={acceptedTerms ? ViveColors.primary : "rgba(135,131,92,0.55)"}
                  />
                  <Text style={s.termsText}>
                    {'Leí y acepto los '}
                    <Text
                      style={s.termsLink}
                      onPress={() => setShowTermsModal(true)}
                    >
                      Términos y condiciones
                    </Text>
                    {' y la '}
                    <Text
                      style={s.termsLink}
                      onPress={() => setShowPrivacyModal(true)}
                    >
                      Política de privacidad
                    </Text>
                    {' de Vita'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.enterBtn, (!acceptedTerms || loading) && s.enterBtnDisabled]}
                  onPress={handleRegister}
                  activeOpacity={0.85}
                  disabled={!acceptedTerms || loading}
                >
                  {loading
                    ? <ActivityIndicator size="small" color="#565E32" />
                    : <Text style={s.enterBtnText}>Crear cuenta</Text>
                  }
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>

          {/* ── Footer ───────────────────────────────────────────── */}
          <Animated.View style={[s.footerArea, fadeUp(footerAnim)]}>
            <View style={s.footer}>
              <Text style={s.footerText}>¿Ya tenés cuenta? </Text>
              <TouchableOpacity onPress={() => router.replace('/login')} activeOpacity={0.7}>
                <Text style={s.footerLink}>Iniciá sesión</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Documentos legales completos — mismo texto que /legal (constants/legal.ts).
          Antes acá había un resumen escrito a mano que no coincidía con el
          documento real; se reemplazó por la fuente única. */}
      <LegalSheet
        visible={showTermsModal}
        doc="terminos"
        onClose={() => setShowTermsModal(false)}
        acceptLabel="Entendido"
        onAccept={() => setAcceptedTerms(true)}
      />

      <LegalSheet
        visible={showPrivacyModal}
        doc="privacidad"
        onClose={() => setShowPrivacyModal(false)}
        acceptLabel="Entendido"
        onAccept={() => setAcceptedTerms(true)}
      />

    </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 52,
    paddingBottom: 36,
    justifyContent: 'center',
    gap: 32,
  },

  // Logo
  logoWrap: {
    alignItems: 'center',
  },

  // Heading
  headingArea: {
    alignItems: 'center',
    gap: 8,
  },
  heading: {
    fontFamily: ViveFonts.semibold,
    fontSize: 24,
    color: '#565E32',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subheading: {
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: '#565E32',
    opacity: 0.6,
    textAlign: 'center',
  },

  // Buttons area
  btnsArea: {
    gap: 12,
  },

  // Google button
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(86,94,50,0.12)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.60)',
    paddingVertical: 15,
    ...Platform.select({
      ios: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: { elevation: 1 },
    }),
  },
  googleBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#565E32',
  },

  // Apple button
  appleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 16,
    paddingVertical: 15,
  },
  appleBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#FFFFFF',
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,248,240,0.48)',
  },
  dividerText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: 'rgba(135,131,92,0.52)',
  },

  // Email button
  emailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(86,94,50,0.12)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: ViveColors.primary,
    paddingVertical: 15,
  },
  emailBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#565E32',
  },

  // Email form
  emailForm: {
    gap: 12,
    marginTop: 4,
  },
  input: {
    backgroundColor: 'rgba(86,94,50,0.12)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.60)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: '#565E32',
  },
  inputError: {
    borderColor: '#E05C5C',
  },
  inputFocused: {
    borderColor: ViveColors.primary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(86,94,50,0.12)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.60)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  inputInner: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: '#565E32',
    padding: 0,
  },
  errorHint: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: '#E05C5C',
    marginTop: -4,
  },
  serverError: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#E05C5C',
    textAlign: 'center',
    marginTop: -2,
  },
  enterBtn: {
    backgroundColor: '#565E32',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    minHeight: 52,
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: ViveColors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  enterBtnLoading: {
    opacity: 0.75,
  },
  enterBtnDisabled: {
    opacity: 0.45,
  },
  enterBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: '#F7EFE4',
    letterSpacing: 0.2,
  },

  // Terms checkbox
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 2,
  },
  termsText: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#87835C',
    lineHeight: 19,
  },
  termsLink: {
    fontFamily: ViveFonts.medium,
    color: ViveColors.primary,
  },

  // Footer
  footerArea: {
    gap: 16,
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: 'rgba(135,131,92,0.80)',
  },
  footerLink: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: ViveColors.primary,
  },
});