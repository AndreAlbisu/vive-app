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

export default function LoginScreen() {
  const router = useRouter();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);

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
      setEmail('');
      setPassword('');
      setEmailError(false);
      setPasswordError(false);
    }
  }

  function handleEmailLogin() {
    const eErr = !email.trim();
    const pErr = !password.trim();
    setEmailError(eErr);
    setPasswordError(pErr);
    if (eErr || pErr) return;
    console.log('[Auth] email login:', email);
    router.replace('/(tabs)');
  }

  function handleGoogle() {
    console.log('[Auth] Google login');
    router.replace('/(tabs)');
  }

  function handleApple() {
    console.log('[Auth] Apple login');
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
            <Text style={s.heading}>Bienvenido de vuelta</Text>
            <Text style={s.subheading}>Entrá a tu espacio</Text>
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
                <TextInput
                  style={[
                    s.input,
                    emailError && s.inputError,
                    focused === 'email' && s.inputFocused,
                  ]}
                  value={email}
                  onChangeText={v => { setEmail(v); setEmailError(false); }}
                  placeholder="tu@email.com"
                  placeholderTextColor={`${ViveColors.text}55`}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                />

                <View style={[
                  s.inputRow,
                  passwordError && s.inputError,
                  focused === 'pass' && s.inputFocused,
                ]}>
                  <TextInput
                    style={s.inputInner}
                    value={password}
                    onChangeText={v => { setPassword(v); setPasswordError(false); }}
                    placeholder="Contraseña"
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

                <TouchableOpacity style={s.enterBtn} onPress={handleEmailLogin} activeOpacity={0.85}>
                  <Text style={s.enterBtnText}>Entrar</Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.forgotWrap} activeOpacity={0.7}>
                  <Text style={s.forgotText}>¿Olvidaste tu contraseña?</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>

          {/* ── Footer ───────────────────────────────────────────── */}
          <Animated.View style={[s.footer, fadeUp(footerAnim)]}>
            <Text style={s.footerText}>¿No tenés cuenta? </Text>
            <TouchableOpacity onPress={() => router.replace('/register')} activeOpacity={0.7}>
              <Text style={s.footerLink}>Registrate</Text>
            </TouchableOpacity>
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
  enterBtn: {
    backgroundColor: ViveColors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
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
  forgotWrap: {
    alignSelf: 'center',
  },
  forgotText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.primary,
  },

  // Footer
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
});
