import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

interface AuthModalProps {
  visible: boolean;
  onDismiss: () => void;
  onLogin: () => void;
  signInWithEmail: (email: string, password: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
}

export function AuthModal({ visible, onDismiss, onLogin, signInWithEmail, signInWithGoogle }: AuthModalProps) {
  const router = useRouter();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  function toggleEmailForm() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowEmailForm(prev => !prev);
    if (showEmailForm) {
      setEmail('');
      setPassword('');
      setEmailError(false);
      setPasswordError(false);
      setServerError(null);
    }
  }

  async function handleEmailLogin() {
    const eErr = !email.trim();
    const pErr = !password.trim();
    setEmailError(eErr);
    setPasswordError(pErr);
    if (eErr || pErr) return;

    setLoading(true);
    setServerError(null);
    const error = await signInWithEmail(email, password);
    setLoading(false);

    if (error) {
      setServerError(error);
      return;
    }
    reset();
    onLogin();
    router.replace('/(tabs)');
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    setServerError(null);
    const error = await signInWithGoogle();
    setGoogleLoading(false);
    if (error) {
      setServerError(error);
      return;
    }
    reset();
    onLogin();
  }

  function handleApple() {
    console.log('[Auth] modal Apple login — próximamente');
  }

  function reset() {
    setShowEmailForm(false);
    setEmail('');
    setPassword('');
    setEmailError(false);
    setPasswordError(false);
    setServerError(null);
    setLoading(false);
    setFocused(null);
  }

  function handleDismiss() {
    reset();
    onDismiss();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <Pressable style={s.backdrop} onPress={handleDismiss}>
        <KeyboardAvoidingView
          style={s.center}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
        >
          <Pressable style={s.card} onPress={() => {}}>

            <Text style={s.logo}>vive</Text>
            <Text style={s.title}>Para continuar, ingresá a tu cuenta</Text>
            <Text style={s.subtitle}>Es gratis y solo tarda un segundo.</Text>

            <TouchableOpacity
              style={[s.googleBtn, googleLoading && s.btnDisabled]}
              onPress={handleGoogle}
              activeOpacity={0.85}
              disabled={googleLoading || loading}
            >
              {googleLoading
                ? <ActivityIndicator size="small" color="#4285F4" />
                : <MaterialCommunityIcons name="google" size={18} color="#4285F4" />
              }
              <Text style={s.googleBtnText}>Continuar con Google</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.appleBtn} onPress={handleApple} activeOpacity={0.85}>
              <MaterialCommunityIcons name="apple" size={18} color="#FFFFFF" />
              <Text style={s.appleBtnText}>Continuar con Apple</Text>
            </TouchableOpacity>

            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>o</Text>
              <View style={s.dividerLine} />
            </View>

            <TouchableOpacity style={s.emailBtn} onPress={toggleEmailForm} activeOpacity={0.85}>
              <MaterialCommunityIcons name="email-outline" size={18} color={ViveColors.primary} />
              <Text style={s.emailBtnText}>Usar email</Text>
            </TouchableOpacity>

            {showEmailForm && (
              <View style={s.emailForm}>
                <TextInput
                  style={[
                    s.input,
                    emailError && s.inputError,
                    focused === 'email' && s.inputFocused,
                  ]}
                  value={email}
                  onChangeText={v => { setEmail(v); setEmailError(false); setServerError(null); }}
                  placeholder="tu@email.com"
                  placeholderTextColor={`${ViveColors.text}55`}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                  editable={!loading}
                />
                <View style={[
                  s.inputRow,
                  passwordError && s.inputError,
                  focused === 'pass' && s.inputFocused,
                ]}>
                  <TextInput
                    style={s.inputInner}
                    value={password}
                    onChangeText={v => { setPassword(v); setPasswordError(false); setServerError(null); }}
                    placeholder="Contraseña"
                    placeholderTextColor={`${ViveColors.text}55`}
                    secureTextEntry={!showPassword}
                    onFocus={() => setFocused('pass')}
                    onBlur={() => setFocused(null)}
                    editable={!loading}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                    <MaterialCommunityIcons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={`${ViveColors.text}66`}
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
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator size="small" color="#FFFFFF" />
                    : <Text style={s.enterBtnText}>Entrar</Text>
                  }
                </TouchableOpacity>
              </View>
            )}

            <View style={s.registerRow}>
              <Text style={s.registerPrompt}>¿No tenés cuenta?</Text>
              <TouchableOpacity
                onPress={() => { handleDismiss(); router.push('/register'); }}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Text style={s.registerLink}>Registrate</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handleDismiss} style={s.dismissBtn} activeOpacity={0.7}>
              <Text style={s.dismissText}>Ahora no</Text>
            </TouchableOpacity>

          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.52)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
      },
      android: { elevation: 16 },
    }),
  },

  logo: {
    fontFamily: ViveFonts.bold,
    fontSize: 28,
    color: ViveColors.primary,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  title: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: ViveColors.text,
    textAlign: 'center',
    lineHeight: 23,
  },
  subtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: ViveColors.text,
    opacity: 0.55,
    textAlign: 'center',
    marginBottom: 4,
  },

  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: `${ViveColors.text}1A`,
    paddingVertical: 13,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  googleBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: ViveColors.text,
  },
  appleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#000000',
    borderRadius: 14,
    paddingVertical: 13,
  },
  appleBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#FFFFFF',
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: `${ViveColors.text}18`,
  },
  dividerText: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: `${ViveColors.text}55`,
  },

  emailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: ViveColors.primary,
    paddingVertical: 13,
  },
  emailBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: ViveColors.primary,
  },

  emailForm: {
    gap: 10,
  },
  input: {
    backgroundColor: ViveColors.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: `${ViveColors.text}18`,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: ViveFonts.regular,
    fontSize: 14,
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
    backgroundColor: ViveColors.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: `${ViveColors.text}18`,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  inputInner: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: ViveColors.text,
    padding: 0,
  },
  serverError: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#E05C5C',
    textAlign: 'center',
    marginTop: -2,
  },
  enterBtn: {
    backgroundColor: ViveColors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    minHeight: 46,
    justifyContent: 'center',
  },
  enterBtnLoading: {
    opacity: 0.75,
  },
  enterBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#FFFFFF',
  },

  registerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 4,
  },
  registerPrompt: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: ViveColors.text,
    opacity: 0.6,
  },
  registerLink: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: ViveColors.primary,
  },

  dismissBtn: {
    alignItems: 'center',
    paddingVertical: 4,
    marginTop: 2,
  },
  dismissText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.text,
    opacity: 0.6,
  },
});
