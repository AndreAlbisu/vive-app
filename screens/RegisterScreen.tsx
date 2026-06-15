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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const fadeUp = (anim: Animated.Value) => ({
  opacity: anim,
  transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
});

export default function RegisterScreen() {
  const router = useRouter();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

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

  function handleRegister() {
    const newErrors: Record<string, boolean> = {
      name: !name.trim(),
      email: !email.trim(),
      password: !password.trim() || password.length < 6,
      confirm: !confirmPassword.trim() || confirmPassword !== password,
    };
    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;
    console.log('[Auth] register:', name, email);
    router.replace('/(tabs)');
  }

  function handleGoogle() {
    console.log('[Auth] Google register');
    router.replace('/(tabs)');
  }

  function handleApple() {
    console.log('[Auth] Apple register');
    router.replace('/(tabs)');
  }

  return (
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
          {/* ── Logo ─────────────────────────────────────────────── */}
          <Animated.View style={[s.logoWrap, fadeUp(logoAnim)]}>
            <Text style={s.logo}>vive</Text>
          </Animated.View>

          {/* ── Heading ──────────────────────────────────────────── */}
          <Animated.View style={[s.headingArea, fadeUp(headingAnim)]}>
            <Text style={s.heading}>Creá tu cuenta</Text>
            <Text style={s.subheading}>Es rápido y gratuito.</Text>
          </Animated.View>

          {/* ── Botones ──────────────────────────────────────────── */}
          <Animated.View style={[s.btnsArea, fadeUp(btnsAnim)]}>

            {/* Google */}
            <TouchableOpacity style={s.googleBtn} onPress={handleGoogle} activeOpacity={0.85}>
              <MaterialCommunityIcons name="google" size={20} color="#4285F4" />
              <Text style={s.googleBtnText}>Continuar con Google</Text>
            </TouchableOpacity>

            {/* Apple */}
            <TouchableOpacity style={s.appleBtn} onPress={handleApple} activeOpacity={0.85}>
              <MaterialCommunityIcons name="apple" size={20} color="#FFFFFF" />
              <Text style={s.appleBtnText}>Continuar con Apple</Text>
            </TouchableOpacity>

            {/* Separator */}
            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>o</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Usar email */}
            <TouchableOpacity style={s.emailBtn} onPress={toggleEmailForm} activeOpacity={0.85}>
              <MaterialCommunityIcons name="email-outline" size={20} color={ViveColors.primary} />
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
                  placeholderTextColor={`${ViveColors.text}55`}
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
                  placeholderTextColor={`${ViveColors.text}55`}
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
                    placeholderTextColor={`${ViveColors.text}55`}
                    secureTextEntry={!showPassword}
                    onFocus={() => setFocused('pass')}
                    onBlur={() => setFocused(null)}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                    <MaterialCommunityIcons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={`${ViveColors.text}66`}
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
                    placeholderTextColor={`${ViveColors.text}55`}
                    secureTextEntry={!showConfirm}
                    onFocus={() => setFocused('confirm')}
                    onBlur={() => setFocused(null)}
                  />
                  <TouchableOpacity onPress={() => setShowConfirm(v => !v)} hitSlop={8}>
                    <MaterialCommunityIcons
                      name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={`${ViveColors.text}66`}
                    />
                  </TouchableOpacity>
                </View>
                {errors.confirm && confirmPassword.length > 0 && (
                  <Text style={s.errorHint}>Las contraseñas no coinciden.</Text>
                )}

                <TouchableOpacity style={s.enterBtn} onPress={handleRegister} activeOpacity={0.85}>
                  <Text style={s.enterBtnText}>Crear cuenta</Text>
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
            <Text style={s.legalText}>
              Al registrarte aceptás nuestros{' '}
              <Text style={s.legalLink}>Términos y condiciones</Text>
              {' '}y{' '}
              <Text style={s.legalLink}>Política de privacidad</Text>
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: ViveColors.background,
  },
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
  logo: {
    fontFamily: ViveFonts.bold,
    fontSize: 42,
    color: ViveColors.primary,
    letterSpacing: -1,
  },

  // Heading
  headingArea: {
    alignItems: 'center',
    gap: 8,
  },
  heading: {
    fontFamily: ViveFonts.semibold,
    fontSize: 24,
    color: ViveColors.text,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subheading: {
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: ViveColors.text,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: `${ViveColors.text}1A`,
    paddingVertical: 15,
    ...Platform.select({
      ios: {
        shadowColor: ViveColors.text,
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
    color: ViveColors.text,
  },

  // Apple button
  appleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#000000',
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
    backgroundColor: `${ViveColors.text}1A`,
  },
  dividerText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: `${ViveColors.text}55`,
  },

  // Email button
  emailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: ViveColors.primary,
    paddingVertical: 15,
  },
  emailBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: ViveColors.primary,
  },

  // Email form
  emailForm: {
    gap: 12,
    marginTop: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: `${ViveColors.text}1A`,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: ViveColors.text,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: `${ViveColors.text}1A`,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  inputInner: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: ViveColors.text,
    padding: 0,
  },
  errorHint: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: '#E05C5C',
    marginTop: -4,
  },
  enterBtn: {
    backgroundColor: ViveColors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
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
  enterBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.2,
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
    color: `${ViveColors.text}88`,
  },
  footerLink: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: ViveColors.primary,
  },
  legalText: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: ViveColors.text,
    opacity: 0.4,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 12,
  },
  legalLink: {
    fontFamily: ViveFonts.medium,
    textDecorationLine: 'underline',
  },
});
