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
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { AppBg } from '@/components/ui/AppBg';
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
  const { signUpWithEmail, signInWithGoogle } = useAuth();
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
        setServerError('Esta cuenta ya está registrada como coach. No podés crear una cuenta de usuario con el mismo mail.');
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

  function handleApple() {
    console.log('[Auth] Apple register — próximamente');
  }

  return (
    <AppBg>
      <StatusBar barStyle="light-content" />
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
            <Text style={s.logo}>VITA</Text>
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

            {/* Apple */}
            <TouchableOpacity style={s.appleBtn} onPress={handleApple} activeOpacity={0.85}>
              <MaterialCommunityIcons name="apple" size={20} color="#FFFFFF" />
              <Text style={s.appleBtnText}>Continuar con Apple</Text>
            </TouchableOpacity>

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
              <MaterialCommunityIcons name="email-outline" size={20} color="#FFFFFF" />
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
                  placeholderTextColor="rgba(255,255,255,0.38)"
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
                  placeholderTextColor="rgba(255,255,255,0.38)"
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
                    placeholderTextColor="rgba(255,255,255,0.38)"
                    secureTextEntry={!showPassword}
                    onFocus={() => setFocused('pass')}
                    onBlur={() => setFocused(null)}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                    <MaterialCommunityIcons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="rgba(255,255,255,0.45)"
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
                    placeholderTextColor="rgba(255,255,255,0.38)"
                    secureTextEntry={!showConfirm}
                    onFocus={() => setFocused('confirm')}
                    onBlur={() => setFocused(null)}
                  />
                  <TouchableOpacity onPress={() => setShowConfirm(v => !v)} hitSlop={8}>
                    <MaterialCommunityIcons
                      name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="rgba(255,255,255,0.45)"
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
                    color={acceptedTerms ? ViveColors.primary : "rgba(255,255,255,0.45)"}
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
                    {' de VIVE'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.enterBtn, (!acceptedTerms || loading) && s.enterBtnDisabled]}
                  onPress={handleRegister}
                  activeOpacity={0.85}
                  disabled={!acceptedTerms || loading}
                >
                  {loading
                    ? <ActivityIndicator size="small" color="#FFFFFF" />
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

      {/* ── Modal Términos y condiciones ─────────────────────── */}
      <Modal visible={showTermsModal} animationType="slide" transparent onRequestClose={() => setShowTermsModal(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setShowTermsModal(false)}>
          <Pressable style={s.modalSheet} onPress={() => {}}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Términos y condiciones</Text>
              <TouchableOpacity onPress={() => setShowTermsModal(false)} hitSlop={10}>
                <MaterialCommunityIcons name="close" size={22} color="rgba(255,255,255,0.55)" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={s.modalBody}>
              <Text style={s.modalSection}>Bienvenida/o a VIVE</Text>
              <Text style={s.modalText}>
                VIVE es una plataforma que conecta personas con profesionales independientes del bienestar (coaches, terapeutas, nutricionistas y otros). Al crear tu cuenta aceptás estos términos.
              </Text>

              <Text style={s.modalSection}>Qué hacemos y qué no hacemos</Text>
              <Text style={s.modalText}>
                VIVE actúa como canal de conexión entre vos y los profesionales. No diagnosticamos ni tratamos ninguna condición de salud. Las recomendaciones que recibís de los profesionales son orientativas y no reemplazan la consulta médica.
              </Text>

              <Text style={s.modalSection}>Profesionales independientes</Text>
              <Text style={s.modalText}>
                Los profesionales que usan VIVE son independientes y son responsables de su propia práctica, habilitaciones y del contenido que comparten. VIVE no avala ni garantiza los resultados de ninguna sesión o consulta.
              </Text>

              <Text style={s.modalSection}>Tus conversaciones</Text>
              <Text style={s.modalText}>
                Los chats que tenés con los profesionales se guardan de forma segura en nuestros servidores para permitir la continuidad de las conversaciones. No compartimos tus conversaciones ni tus datos personales con terceros.
              </Text>

              <Text style={s.modalSection}>Uso responsable</Text>
              <Text style={s.modalText}>
                Al usar VIVE te comprometés a brindar información verdadera y a usar la plataforma de forma respetuosa. VIVE puede suspender cuentas que violen estos términos.
              </Text>

              <Text style={s.modalFooterNote}>Última actualización: junio 2026</Text>
            </ScrollView>
            <TouchableOpacity style={s.modalBtn} onPress={() => { setAcceptedTerms(true); setShowTermsModal(false); }} activeOpacity={0.85}>
              <Text style={s.modalBtnText}>Entendido</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Modal Política de privacidad ─────────────────────── */}
      <Modal visible={showPrivacyModal} animationType="slide" transparent onRequestClose={() => setShowPrivacyModal(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setShowPrivacyModal(false)}>
          <Pressable style={s.modalSheet} onPress={() => {}}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Política de privacidad</Text>
              <TouchableOpacity onPress={() => setShowPrivacyModal(false)} hitSlop={10}>
                <MaterialCommunityIcons name="close" size={22} color="rgba(255,255,255,0.55)" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={s.modalBody}>
              <Text style={s.modalSection}>Qué información recopilamos</Text>
              <Text style={s.modalText}>
                Al registrarte guardamos tu nombre, tu dirección de email y las conversaciones que tenés con los profesionales dentro de la app.
              </Text>

              <Text style={s.modalSection}>Cómo protegemos tus datos</Text>
              <Text style={s.modalText}>
                Tus conversaciones se almacenan encriptadas en nuestros servidores. Solo vos y el profesional con quien chateás pueden ver el contenido de esas conversaciones. El equipo de VIVE no accede al contenido de tus chats salvo ante requerimiento legal.
              </Text>

              <Text style={s.modalSection}>Lo que nunca hacemos</Text>
              <Text style={s.modalText}>
                Nunca usamos tus datos para mostrarte publicidad personalizada ni los vendemos o cedemos a terceros con fines comerciales.
              </Text>

              <Text style={s.modalSection}>Tus derechos</Text>
              <Text style={s.modalText}>
                Podés solicitar la eliminación de tu cuenta y de todos tus datos en cualquier momento escribiéndonos a privacidad@vivewellness.app. Procesamos las solicitudes en un plazo máximo de 30 días.
              </Text>

              <Text style={s.modalSection}>Marco legal</Text>
              <Text style={s.modalText}>
                Cumplimos con la Ley 25.326 de Protección de Datos Personales de la República Argentina (Habeas Data).
              </Text>

              <Text style={s.modalFooterNote}>Última actualización: junio 2026</Text>
            </ScrollView>
            <TouchableOpacity style={s.modalBtn} onPress={() => { setAcceptedTerms(true); setShowPrivacyModal(false); }} activeOpacity={0.85}>
              <Text style={s.modalBtnText}>Entendido</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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
  logo: {
    fontFamily: ViveFonts.bold,
    fontSize: 42,
    color: '#FFFFFF',
    letterSpacing: 6,
  },

  // Heading
  headingArea: {
    alignItems: 'center',
    gap: 8,
  },
  heading: {
    fontFamily: ViveFonts.semibold,
    fontSize: 24,
    color: '#FFFFFF',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subheading: {
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
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
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  dividerText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.38)',
  },

  // Email button
  emailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: ViveColors.primary,
    paddingVertical: 15,
  },
  emailBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#FFFFFF',
  },

  // Email form
  emailForm: {
    gap: 12,
    marginTop: 4,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  inputInner: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
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
    color: '#1A1A2E',
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
    color: 'rgba(255,255,255,0.75)',
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
    color: 'rgba(255,255,255,0.55)',
  },
  footerLink: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: ViveColors.primary,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: 'transparent',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 36,
    maxHeight: '82%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 18,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  modalBody: {
    marginBottom: 20,
  },
  modalSection: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 4,
  },
  modalText: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.80)',
    lineHeight: 22,
  },
  modalFooterNote: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.38)',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#1A1A2E',
  },
});