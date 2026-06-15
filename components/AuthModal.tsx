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
}

export function AuthModal({ visible, onDismiss, onLogin }: AuthModalProps) {
  const router = useRouter();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

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
    console.log('[Auth] modal email login:', email);
    reset();
    onLogin();
  }

  function handleGoogle() {
    console.log('[Auth] modal Google login');
    reset();
    onLogin();
  }

  function handleApple() {
    console.log('[Auth] modal Apple login');
    reset();
    onLogin();
  }

  function reset() {
    setShowEmailForm(false);
    setEmail('');
    setPassword('');
    setEmailError(false);
    setPasswordError(false);
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
      {/* Outer Pressable = dark backdrop → dismiss on tap */}
      <Pressable style={s.backdrop} onPress={handleDismiss}>
        <KeyboardAvoidingView
          style={s.center}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
        >
          {/* Inner Pressable = card → stops propagation so tapping card doesn't dismiss */}
          <Pressable style={s.card} onPress={() => {}}>

            {/* Logo */}
            <Text style={s.logo}>vive</Text>

            {/* Title + subtitle */}
            <Text style={s.title}>Para continuar, ingresá a tu cuenta</Text>
            <Text style={s.subtitle}>Es gratis y solo tarda un segundo.</Text>

            {/* Google */}
            <TouchableOpacity style={s.googleBtn} onPress={handleGoogle} activeOpacity={0.85}>
              <MaterialCommunityIcons name="google" size={18} color="#4285F4" />
              <Text style={s.googleBtnText}>Continuar con Google</Text>
            </TouchableOpacity>

            {/* Apple */}
            <TouchableOpacity style={s.appleBtn} onPress={handleApple} activeOpacity={0.85}>
              <MaterialCommunityIcons name="apple" size={18} color="#FFFFFF" />
              <Text style={s.appleBtnText}>Continuar con Apple</Text>
            </TouchableOpacity>

            {/* Separator */}
            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>o</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Email button */}
            <TouchableOpacity style={s.emailBtn} onPress={toggleEmailForm} activeOpacity={0.85}>
              <MaterialCommunityIcons name="email-outline" size={18} color={ViveColors.primary} />
              <Text style={s.emailBtnText}>Usar email</Text>
            </TouchableOpacity>

            {/* Expandable email form */}
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
                      size={18}
                      color={`${ViveColors.text}66`}
                    />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={s.enterBtn} onPress={handleEmailLogin} activeOpacity={0.85}>
                  <Text style={s.enterBtnText}>Entrar</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Ahora no */}
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

  // Logo
  logo: {
    fontFamily: ViveFonts.bold,
    fontSize: 28,
    color: ViveColors.primary,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 2,
  },

  // Title + subtitle
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

  // Social buttons
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

  // Divider
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

  // Email button
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

  // Email form
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
  enterBtn: {
    backgroundColor: ViveColors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  enterBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#FFFFFF',
  },

  // Dismiss
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
