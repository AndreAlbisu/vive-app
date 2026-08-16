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

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const fadeUp = (anim: Animated.Value) => ({
  opacity: anim,
  transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
});

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithEmail, signInWithGoogle, signInWithApple } = useAuth();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [legalDoc, setLegalDoc] = useState<'terminos' | 'privacidad' | null>(null);

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

  async function handleEmailLogin() {
    const eErr = !email.trim();
    const pErr = !password.trim();
    setEmailError(eErr);
    setPasswordError(pErr);
    setServerError(null);
    if (eErr || pErr) return;

    setLoading(true);
    const error = await signInWithEmail(email.trim(), password);
    setLoading(false);

    if (error) {
      setServerError(error);
    }
    // Sin navegar acá: AuthRedirect (app/_layout.tsx) ya escucha el cambio
    // de `user`/`role` y manda a (tabs) o (coach) según corresponda. Navegar
    // acá también generaba una carrera de dos `router.replace()` casi
    // simultáneos (este y el de AuthRedirect corrigiendo a coach) que
    // crasheaba con "Attempted to navigate before mounting the Root Layout".
  }

  // ⚠️ `(true, true)` también acá, aunque esta sea la pantalla de login: en
  // OAuth no hay "registrarse" separado de "iniciar sesión" — es el mismo flujo,
  // y si el mail no existe crea la cuenta. Sin esto, quien entraba por acá con
  // Google o Apple se creaba una cuenta sin constancia de T&C ni de edad, que es
  // lo que sostiene la cláusula anti-solicitación (§10) y T&C §3.1.
  // La aceptación es implícita por el texto legal debajo de los botones, mismo
  // criterio que CoachLoginScreen; `markAccepted` no pisa una aceptación previa.
  async function handleGoogle() {
    setGoogleLoading(true);
    setServerError(null);
    const error = await signInWithGoogle(true, true);
    setGoogleLoading(false);
    if (error) setServerError(error);
  }

  async function handleApple() {
    setAppleLoading(true);
    setServerError(null);
    const error = await signInWithApple(true, true);
    setAppleLoading(false);
    if (error) setServerError(error);
  }

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={s.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>

            {/* Logo */}
            <Animated.View style={[s.logoWrap, fadeUp(logoAnim)]}>
              <VitaWordmark />
            </Animated.View>

            {/* Heading */}
            <Animated.View style={[s.headingArea, fadeUp(headingAnim)]}>
              <Text style={s.heading}>Bienvenido de vuelta</Text>
              <Text style={s.subheading}>Entrá a tu espacio</Text>
            </Animated.View>

            {/* Botones */}
            <Animated.View style={[s.btnsArea, fadeUp(btnsAnim)]}>

              {/* Google */}
              <TouchableOpacity
                style={[s.googleBtn, googleLoading && { opacity: 0.6 }]}
                onPress={handleGoogle}
                activeOpacity={0.85}
                disabled={googleLoading || loading}>
                {googleLoading
                  ? <ActivityIndicator size="small" color="#4285F4" />
                  : <MaterialCommunityIcons name="google" size={20} color="#4285F4" />}
                <Text style={s.googleBtnText}>Continuar con Google</Text>
              </TouchableOpacity>

              {/* Apple — Sign in with Apple no existe en Android, ocultar */}
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={[s.appleBtn, appleLoading && { opacity: 0.6 }]}
                  onPress={handleApple}
                  activeOpacity={0.85}
                  disabled={appleLoading || loading}>
                  {appleLoading
                    ? <ActivityIndicator size="small" color="#565E32" />
                    : <MaterialCommunityIcons name="apple" size={20} color="#565E32" />}
                  <Text style={s.appleBtnText}>Continuar con Apple</Text>
                </TouchableOpacity>
              )}

              {/* Aceptación implícita de los botones sociales: con Google/Apple
                  esta pantalla también da de alta cuentas nuevas (OAuth no
                  distingue login de registro), así que la constancia tiene que
                  poder tomarse acá. Va pegado a los botones y no al pie para que
                  quede claro a qué se refiere "Al continuar". El login por email
                  no lo necesita: no puede crear una cuenta. */}
              <Text style={s.legalNote}>
                {'Al continuar con Google o Apple declarás tener 18 años o más y aceptás los '}
                <Text style={s.legalLink} onPress={() => setLegalDoc('terminos')}>
                  Términos y condiciones
                </Text>
                {' y la '}
                <Text style={s.legalLink} onPress={() => setLegalDoc('privacidad')}>
                  Política de privacidad
                </Text>
                {' de Vita.'}
              </Text>

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
                  <TextInput
                    style={[
                      s.input,
                      emailError && s.inputError,
                      focused === 'email' && s.inputFocused,
                    ]}
                    value={email}
                    onChangeText={v => { setEmail(v); setEmailError(false); }}
                    placeholder="tu@email.com"
                    placeholderTextColor="rgba(135,131,92,0.45)"
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
                      placeholderTextColor="rgba(135,131,92,0.45)"
                      secureTextEntry={!showPassword}
                      onFocus={() => setFocused('pass')}
                      onBlur={() => setFocused(null)}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                      <MaterialCommunityIcons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="rgba(135,131,92,0.80)"
                      />
                    </TouchableOpacity>
                  </View>

                  {serverError && (
                    <Text style={s.serverError}>{serverError}</Text>
                  )}

                  <TouchableOpacity
                    style={[s.enterBtn, loading && s.enterBtnLoading]}
                    onPress={handleEmailLogin}
                    activeOpacity={0.85}
                    disabled={loading}>
                    {loading
                      ? <ActivityIndicator size="small" color="#1A1A2E" />
                      : <Text style={s.enterBtnText}>Entrar</Text>}
                  </TouchableOpacity>

                  <TouchableOpacity style={s.forgotWrap} activeOpacity={0.7}>
                    <Text style={s.forgotText}>¿Olvidaste tu contraseña?</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>

            {/* Footer */}
            <Animated.View style={[s.footer, fadeUp(footerAnim)]}>
              <Text style={s.footerText}>¿No tenés cuenta? </Text>
              <TouchableOpacity onPress={() => router.replace('/register')} activeOpacity={0.7}>
                <Text style={s.footerLink}>Registrate</Text>
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>

        <LegalSheet
          visible={legalDoc !== null}
          doc={legalDoc ?? 'terminos'}
          onClose={() => setLegalDoc(null)}
        />
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },

  legalNote: {
    fontFamily: ViveFonts.regular,
    fontSize: 11.5,
    color: 'rgba(135,131,92,0.62)',
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 4,
  },
  legalLink: {
    fontFamily: ViveFonts.semibold,
    color: ViveColors.primary,
  },

  container: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 52,
    paddingBottom: 36,
    justifyContent: 'center',
    gap: 32,
  },

  logoWrap: { alignItems: 'center' },

  headingArea: { alignItems: 'center', gap: 8 },
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
    color: '#87835C',
    textAlign: 'center',
  },

  btnsArea: { gap: 12 },

  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,248,240,0.62)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.60)',
    paddingVertical: 15,
  },
  googleBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#565E32',
  },

  appleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    paddingVertical: 15,
  },
  appleBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#FFFFFF',
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,248,240,0.65)',
  },
  dividerText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: 'rgba(135,131,92,0.72)',
  },

  emailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.70)',
    paddingVertical: 15,
  },
  emailBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#565E32',
  },

  emailForm: { gap: 12, marginTop: 4 },
  input: {
    backgroundColor: 'rgba(86,94,50,0.12)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.65)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: '#565E32',
  },
  inputError: { borderColor: '#FFB4B4' },
  inputFocused: { borderColor: ViveColors.primary },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(86,94,50,0.12)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.65)',
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
  serverError: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#FFB4B4',
    textAlign: 'center',
    marginTop: -4,
  },
  enterBtn: {
    backgroundColor: '#565E32',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  enterBtnLoading: { opacity: 0.75 },
  enterBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: '#F7EFE4',
    letterSpacing: 0.2,
  },
  forgotWrap: { alignSelf: 'center' },
  forgotText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: '#87835C',
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: '#87835C',
  },
  footerLink: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#565E32',
  },
});
