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
import { ScaleCard } from '@/components/ScaleCard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { useAuth, ERR_CREDENCIALES, ERR_MAIL_SIN_CONFIRMAR, ERR_YA_REGISTRADO } from '@/context/AuthContext';
import { VitaWordmark } from '@/components/VitaWordmark';
import { useTonoOnboarding } from '@/hooks/useTonoOnboarding';
import { EntradaDesdeColor } from '@/components/EntradaDesdeColor';
import { ReglaConPunto, DivisorConPunto, LineasEsquina } from '@/components/ui/AuthOrnamentos';
import LegalSheet from '@/components/LegalSheet';
import { supabase } from '@/lib/supabase';
import { normalizarCodigo } from '@/lib/referidos';
import { guardarCodigoPendiente } from '@/lib/referidoPendiente';
import { AyudaAhoraLink } from '@/components/AyudaAhoraLink';
import { LARGO_MIN_CONTRASENA } from '@/lib/authErrores';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// Misma paleta que login y la bifurcación.
const CREMA        = '#F7F2EA';
const BOTON_BG     = '#FCFAF5';
const BOTON_BORDE  = 'rgba(86,94,50,0.16)';
const TEXTO        = '#26402F';
const TEXTO_SUAVE  = '#5C6B58';
const TERRACOTA    = '#C4743A';

const fadeUp = (anim: Animated.Value) => ({
  opacity: anim,
  transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
});

// 🔴 Entrar y crear cuenta en UNA sola pantalla (07/10/2026, decisión de Andre).
// Antes esta pantalla solo creaba cuentas y quien ya tenía una tenía que
// encontrar el link al pie; del lado del profesional (`CoachLoginScreen`) ya
// era un solo formulario. Ahora los dos lados funcionan igual:
//
//   · `entrar`        mail + contraseña → se intenta ENTRAR.
//   · `no-encontrada` no coincidieron con ninguna cuenta. Supabase contesta lo
//                     mismo si la cuenta no existe y si la contraseña está mal
//                     (para que no se pueda averiguar qué mails hay), así que
//                     acá NO se crea nada en silencio: se dice y se ofrece
//                     crear, reintentar, recuperar la contraseña o un código.
//   · `crear`         el alta de siempre: nombre, repetir contraseña, código de
//                     invitación y los dos tildes (Términos y edad).
//
// Google y Apple no distinguen entrar de crear, así que su constancia va por
// el aviso legal pegado a los botones, igual que en `LoginScreen` y en
// `CoachLoginScreen`. Los tildes explícitos quedan donde SÍ se sabe que se está
// creando una cuenta: el alta por mail.
type Etapa = 'entrar' | 'no-encontrada' | 'crear';

export default function RegisterScreen() {
  const router = useRouter();
  // El color del camino elegido en la bifurcación.
  const tonoOnboarding = useTonoOnboarding();
  // Llega desde la bifurcación con la pantalla tapada por el color del ala.
  // `modo=crear`: se llega desde "crear cuenta" del inicio de sesión, ya
  // sabiendo que no hay cuenta. Se abre directo en el alta.
  const { tono, modo } = useLocalSearchParams<{ tono?: string; modo?: string }>();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple, resetPassword } = useAuth();
  const [etapa, setEtapa] = useState<Etapa>(modo === 'crear' ? 'crear' : 'entrar');
  const [showEmailForm, setShowEmailForm] = useState(modo === 'crear');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
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
  // M7: el código de invitación, que se guarda y se canjea recién cuando existe
  // la cuenta (ver `lib/referidoPendiente.ts`).
  const [codigo, setCodigo] = useState('');
  const [mostrarCodigo, setMostrarCodigo] = useState(false);
  // Declaración separada de la de T&C a propósito: §3.1 la trata como una
  // manifestación propia del Usuario, y meterla adentro del mismo tilde la
  // volvería una condición sepultada en un texto que casi nadie lee.
  const [ageConfirmed, setAgeConfirmed] = useState(false);
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
      setServerError(null);
      setResetMsg(null);
      setEtapa('entrar');
    }
  }

  function irA(e: Etapa) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setServerError(null);
    setResetMsg(null);
    setErrors({});
    setEtapa(e);
  }

  /** Primer paso: intentar ENTRAR con lo que escribió. */
  async function handleContinuar() {
    const mail = email.trim().toLowerCase();
    const newErrors = { email: !mail, password: !password.trim() };
    setErrors(newErrors);
    setServerError(null);
    setResetMsg(null);
    if (newErrors.email || newErrors.password) return;

    setLoading(true);
    const error = await signInWithEmail(mail, password);
    setLoading(false);

    // Entró: no se navega desde acá, `AuthRedirect` decide a dónde (igual que
    // en `LoginScreen`; navegar también acá generaba dos `replace` a la vez).
    if (!error) return;

    // La cuenta existe pero nunca confirmó el mail: a la pantalla del código.
    if (error === ERR_MAIL_SIN_CONFIRMAR) {
      router.push({ pathname: '/verificar-mail', params: { email: mail, modo: 'confirmar' } } as any);
      return;
    }
    // 🔴 SOLO credenciales inválidas es el caso ambiguo (cuenta nueva o
    // contraseña mal escrita). Un límite de intentos o una caída de red NO
    // significan "esta cuenta no existe": se muestran tal cual.
    if (error === ERR_CREDENCIALES) { irA('no-encontrada'); return; }
    setServerError(error);
  }

  /** Recuperar la contraseña con el mail ya escrito. El mensaje NO confirma si
   *  la cuenta existe (mismo criterio que `LoginScreen`). */
  async function handleForgot() {
    setServerError(null);
    setResetMsg(null);
    const mail = email.trim();
    if (!mail) {
      setErrors(prev => ({ ...prev, email: true }));
      setResetMsg('Escribí tu email arriba y volvé a tocar acá.');
      return;
    }
    setResetLoading(true);
    const err = await resetPassword(mail);
    setResetLoading(false);
    setResetMsg(err ?? `Si hay una cuenta con ${mail}, te llega un mail con el link. Abrilo en este mismo teléfono.`);
  }

  /** Entrar con un código por mail, sin contraseña: la puerta de quien reservó
   *  desde el link de un profesional (esa cuenta nace sin contraseña). */
  function entrarConCodigo() {
    setServerError(null);
    setResetMsg(null);
    const mail = email.trim();
    if (!mail) {
      setErrors(prev => ({ ...prev, email: true }));
      setResetMsg('Escribí tu email arriba y volvé a tocar acá.');
      return;
    }
    router.push({ pathname: '/verificar-mail', params: { email: mail, modo: 'entrar' } } as any);
  }

  function clearError(field: string) {
    setErrors(prev => ({ ...prev, [field]: false }));
  }

  async function handleRegister() {
    const newErrors: Record<string, boolean> = {
      name: !name.trim(),
      email: !email.trim(),
      password: !password.trim() || password.length < LARGO_MIN_CONTRASENA,
      confirm: !confirmPassword.trim() || confirmPassword !== password,
    };
    setErrors(newErrors);
    setServerError(null);
    if (Object.values(newErrors).some(Boolean)) return;

    setLoading(true);

    // 🔴 Antes esto eran dos consultas: buscar el perfil por mail y después ver
    // si tenía fila en `coaches`. La primera **filtraba por `profiles.email`**, y
    // filtrar por una columna exige privilegio de SELECT sobre ella — así que
    // cuando `restrict-anon-profiles-columns.sql` se lo sacó a `anon`
    // (08/09/2026), empezó a devolver 42501.
    //
    // 📌 Y falló ABIERTO: el `const { data } = await …` descartaba el error, así
    // que con `data` en null el chequeo se salteaba y el alta seguía. No se
    // rompió el registro, se rompió el AVISO — la persona terminaba viendo el
    // error genérico de auth en vez de que su mail ya es de un profesional.
    //
    // La pregunta que esta pantalla necesita no es "dame los mails" sino "¿este
    // mail ya es de un profesional?", que es un booleano. Por eso ahora es una
    // función `security definer` (`scripts/add-email-es-de-coach.sql`): contesta
    // sin exponer la columna, y de paso son dos consultas menos.
    const { data: yaEsCoach } = await supabase
      .rpc('email_es_de_coach', { p_email: email.trim().toLowerCase() });
    if (yaEsCoach) {
      setLoading(false);
      setServerError('Esta cuenta ya está registrada como profesional. No podés crear una cuenta de usuario con el mismo mail.');
      return;
    }

    // Se guarda ANTES de crear la cuenta: `AuthContext` lo canjea en cuanto
    // aparece la sesión, sin importar por cuál de los tres caminos se dio de
    // alta. Si el código está mal escrito, `guardarCodigoPendiente` lo descarta
    // en silencio y el alta sigue igual.
    if (codigo) await guardarCodigoPendiente(codigo);

    const error = await signUpWithEmail(email.trim(), password, name.trim(), acceptedTerms, ageConfirmed);
    setLoading(false);

    if (error) {
      // La cuenta SÍ existía: lo de antes fue una contraseña mal escrita.
      setServerError(error === ERR_YA_REGISTRADO
        ? 'Ya hay una cuenta con ese mail y esa contraseña no es la suya. Probá de nuevo, recuperá tu contraseña o, si la creaste con Google o Apple, entrá con ese botón.'
        : error);
      return;
    }
    // No se navega desde acá (17/09/2026). Con la cuenta creada, `AuthRedirect`
    // decide: primero el muro del mail, y después "¿Cómo te gustaría empezar?"
    // si la persona viene del recorrido de entrada (`lib/entrada.ts`). Mandar a
    // `/(tabs)` desde acá se adelantaba a las dos cosas.
    //
    // 🔴 Desde el 24/09/2026 "Confirm email" está prendido: el alta NO devuelve
    // sesión y Supabase ya mandó el código. Se sigue a la pantalla del código;
    // al confirmarlo se abre la sesión y `AuthRedirect` sigue como siempre.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push({ pathname: '/verificar-mail', params: { email: email.trim(), modo: 'confirmar', enviado: '1' } } as any);
    }
  }

  // Las dos declaraciones habilitan el alta por mail.
  const canSubmit = acceptedTerms && ageConfirmed;

  // 🔴 Google y Apple ya no esperan los tildes (07/10/2026): con ellos entrar y
  // crear son el mismo botón, y pedirle dos tildes a quien solo vuelve a entrar
  // es fricción sin sentido. La constancia NO se pierde: va por el aviso legal
  // pegado a los botones ("Al continuar con Google o Apple declarás…"), el
  // mismo criterio que ya usan `LoginScreen` y `CoachLoginScreen`. El `true`
  // que se les pasa persiste `profiles.accepted_terms` y `age_confirmed` (el
  // servidor nunca pisa una aceptación anterior).
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
    <View style={[s.root, tonoOnboarding ? { backgroundColor: tonoOnboarding } : null]}>
      <EntradaDesdeColor tono={tono} />
      <StatusBar barStyle="dark-content" />
      <LineasEsquina />
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
            <ReglaConPunto />
          </Animated.View>

          {/* ── Heading ──────────────────────────────────────────── */}
          <Animated.View style={[s.headingArea, fadeUp(headingAnim)]}>
            <Text style={s.heading}>{etapa === 'crear' ? 'Creá tu cuenta' : 'Entrá o creá tu cuenta'}</Text>
            <Text style={s.subheading}>
              {etapa === 'crear' ? 'Es rápido y gratuito.' : 'Si ya tenés cuenta, entrás.\nSi no, la creamos.'}
            </Text>
          </Animated.View>

          {/* ── Botones ──────────────────────────────────────────── */}
          <Animated.View style={[s.btnsArea, fadeUp(btnsAnim)]}>

            {/* Google */}
            <TouchableOpacity
              style={[s.googleBtn, googleLoading && { opacity: 0.5 }]}
              onPress={handleGoogle}
              activeOpacity={0.85}
              disabled={googleLoading || loading}
            >
              <View style={s.btnIcon}>
                {googleLoading
                  ? <ActivityIndicator size="small" color="#4285F4" />
                  : <MaterialCommunityIcons name="google" size={21} color="#4285F4" />}
              </View>
              <Text style={s.btnText}>Continuar con Google</Text>
              <View style={s.btnIcon} />
            </TouchableOpacity>

            {/* Apple — Sign in with Apple no existe en Android, ocultar */}
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[s.appleBtn, appleLoading && { opacity: 0.5 }]}
                onPress={handleApple}
                activeOpacity={0.85}
                disabled={appleLoading || loading}
              >
                <View style={s.btnIcon}>
                  {appleLoading
                    ? <ActivityIndicator size="small" color="#1A1A1A" />
                    : <MaterialCommunityIcons name="apple" size={22} color="#1A1A1A" />}
                </View>
                <Text style={s.btnText}>Continuar con Apple</Text>
                <View style={s.btnIcon} />
              </TouchableOpacity>
            )}

            {serverError && !showEmailForm && (
              <Text style={s.serverError}>{serverError}</Text>
            )}

            {/* Separator */}
            <DivisorConPunto />

            {/* Usar email */}
            <TouchableOpacity style={s.emailBtn} onPress={toggleEmailForm} activeOpacity={0.85}>
              <View style={s.btnIcon}>
                <MaterialCommunityIcons name="email-outline" size={21} color={TEXTO} />
              </View>
              <Text style={s.btnText}>Usar email</Text>
              <View style={s.btnIcon} />
            </TouchableOpacity>

            {/* Email form expandible */}
            {showEmailForm && (
              <View style={s.emailForm}>
                {/* Nombre — solo al crear */}
                {etapa === 'crear' && <TextInput
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
                />}

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
                    placeholder={etapa === 'crear' ? `Contraseña (mín. ${LARGO_MIN_CONTRASENA} caracteres)` : 'Contraseña'}
                    placeholderTextColor="rgba(135,131,92,0.45)"
                    secureTextEntry={!showPassword}
                    onFocus={() => setFocused('pass')}
                    onBlur={() => setFocused(null)}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(v => !v)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}>
                    <MaterialCommunityIcons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="rgba(135,131,92,0.65)"
                    />
                  </TouchableOpacity>
                </View>

                {etapa === 'crear' ? (
                  <>
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
                  <TouchableOpacity
                    onPress={() => setShowConfirm(v => !v)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={showConfirm ? 'Ocultar la contraseña repetida' : 'Mostrar la contraseña repetida'}>
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

                {/* M7: el código de invitación.
                    🔴 **Va acá y no en el Perfil (23/09/2026).** Es el momento en
                    que el referido de verdad ocurre: el código acaba de llegar
                    por WhatsApp. Dejándolo canjeable después, cualquiera que
                    llegara solo podía pedirle un código a un amigo justo antes
                    de pagar, y el programa dejaba de medir referidos para pasar
                    a ser un 10% universal en la primera sesión.

                    📌 Opcional y sin validar contra el servidor mientras se
                    escribe: si el código no existe, se avisa DESPUÉS de crear la
                    cuenta y la cuenta igual queda. Frenar un alta por un código
                    mal tipeado sería cambiar un descuento por un usuario. */}
                <TouchableOpacity
                  onPress={() => setMostrarCodigo(v => !v)}
                  activeOpacity={0.7}
                  style={s.codigoToggle}>
                  <Text style={s.codigoToggleTxt}>
                    {mostrarCodigo ? 'No tengo código' : '¿Te invitó alguien? Tengo un código'}
                  </Text>
                </TouchableOpacity>

                {mostrarCodigo && (
                  <View style={s.inputRow}>
                    <TextInput
                      style={s.inputInner}
                      value={codigo}
                      onChangeText={v => setCodigo(normalizarCodigo(v))}
                      placeholder="ABC123"
                      placeholderTextColor="rgba(135,131,92,0.45)"
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={6}
                    />
                  </View>
                )}

            {/* Los dos tildes del alta por mail. Hasta el 07/10/2026 iban
                arriba de los tres métodos; Google y Apple ahora dejan constancia
                por el aviso legal de sus botones (ver `handleGoogle`). */}
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
                <Text style={s.termsLink} onPress={() => setShowTermsModal(true)}>
                  Términos y condiciones
                </Text>
                {' y la '}
                <Text style={s.termsLink} onPress={() => setShowPrivacyModal(true)}>
                  Política de privacidad
                </Text>
                {' de Vita'}
              </Text>
            </TouchableOpacity>

            {/* Mayoría de edad — tilde propio, no fundido con el de T&C.
                §3.1 dice que el Usuario "declara" ser mayor de 18 y hasta ahora
                no se le preguntaba nada: la cláusula afirmaba una declaración
                que nunca existía. Queda como constancia en `age_confirmed`. */}
            <TouchableOpacity
              style={s.termsRow}
              onPress={() => setAgeConfirmed(v => !v)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name={ageConfirmed ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={22}
                color={ageConfirmed ? ViveColors.primary : "rgba(135,131,92,0.55)"}
              />
              <Text style={s.termsText}>
                Declaro que tengo 18 años o más
              </Text>
            </TouchableOpacity>

                {serverError && (
                  <Text style={s.serverError}>{serverError}</Text>
                )}

                <ScaleCard
                  style={[s.enterBtn, (!canSubmit || loading) && s.enterBtnDisabled]}
                  onPress={handleRegister}
                  activeOpacity={0.85}
                  disabled={!canSubmit || loading}
                >
                  {loading
                    ? <ActivityIndicator size="small" color="#565E32" />
                    : <Text style={s.enterBtnText}>Crear cuenta</Text>
                  }
                </ScaleCard>

                    <TouchableOpacity style={s.forgotWrap} activeOpacity={0.7} onPress={() => irA('entrar')}>
                      <Text style={s.forgotText}>Ya tengo cuenta: volver</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    {serverError && (
                      <Text style={s.serverError}>{serverError}</Text>
                    )}

                    {/* No se crea nada en silencio: puede ser alguien nuevo o
                        una contraseña mal escrita, y la respuesta es la misma. */}
                    {etapa === 'no-encontrada' && (
                      <Text style={s.aviso}>
                        No encontramos una cuenta con ese mail y esa contraseña. Podés probar de nuevo o crear una cuenta nueva.
                      </Text>
                    )}

                    <ScaleCard
                      style={[s.enterBtn, loading && s.enterBtnLoading]}
                      onPress={handleContinuar}
                      activeOpacity={0.85}
                      disabled={loading}
                    >
                      {loading
                        ? <ActivityIndicator size="small" color="#565E32" />
                        : <Text style={s.enterBtnText}>{etapa === 'no-encontrada' ? 'Probar de nuevo' : 'Continuar'}</Text>
                      }
                    </ScaleCard>

                    {etapa === 'no-encontrada' && (
                      <TouchableOpacity
                        style={s.emailBtn}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        onPress={() => irA('crear')}>
                        <Text style={s.btnText}>Crear una cuenta nueva</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={s.forgotWrap}
                      activeOpacity={0.7}
                      onPress={handleForgot}
                      disabled={resetLoading}>
                      {resetLoading
                        ? <ActivityIndicator size="small" color="#87835C" />
                        : <Text style={s.forgotText}>¿Olvidaste tu contraseña?</Text>}
                    </TouchableOpacity>

                    {resetMsg && <Text style={s.resetMsg}>{resetMsg}</Text>}

                    <TouchableOpacity style={s.forgotWrap} activeOpacity={0.7} onPress={entrarConCodigo}>
                      <Text style={s.forgotText}>¿No tenés contraseña? Entrá con un código</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
            {/* 07/10/2026 (Andre): el aviso va al final, debajo de "Usar email"
                (y del formulario cuando está abierto), no entre los botones. */}
            {/* Aceptación implícita de los botones sociales. El texto nombra a
                Google y Apple, así que se entiende a qué se refiere aunque no
                esté pegado a ellos. Mismo texto que en `LoginScreen`. */}
            <Text style={s.legalNote}>
              {'Al continuar con Google o Apple declarás tener 18 años o más y aceptás los '}
              <Text style={s.termsLink} onPress={() => setShowTermsModal(true)}>
                Términos y condiciones
              </Text>
              {' y la '}
              <Text style={s.termsLink} onPress={() => setShowPrivacyModal(true)}>
                Política de privacidad
              </Text>
              {' de Vita.'}
            </Text>
          </Animated.View>

          {/* ── Footer ───────────────────────────────────────────── */}
          <Animated.View style={[s.footerArea, fadeUp(footerAnim)]}>
            {/* Las líneas de crisis, antes de tener cuenta. Ver `AyudaAhoraLink`. */}
            <AyudaAhoraLink />
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
    </View>
  );
}

const s = StyleSheet.create({
  legalNote: {
    fontFamily: ViveFonts.regular,
    fontSize: 11.5,
    color: 'rgba(135,131,92,0.62)',
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 4,
  },
  aviso: {
    fontFamily: ViveFonts.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: TEXTO,
    textAlign: 'center',
  },
  forgotWrap: { alignSelf: 'center', minHeight: 20, justifyContent: 'center' },
  forgotText: { fontFamily: ViveFonts.medium, fontSize: 13, color: '#87835C' },
  resetMsg: {
    fontFamily: ViveFonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#87835C',
    textAlign: 'center',
  },
  // M7. Un link discreto: la gran mayoría no tiene código, y un campo siempre
  // visible le agrega un renglón al formulario a todo el mundo para servirle a
  // pocos.
  codigoToggle: { alignSelf: 'flex-start', paddingVertical: 8 },
  codigoToggleTxt: { fontFamily: ViveFonts.medium, fontSize: 13, color: '#566245' },
  root: { flex: 1, backgroundColor: CREMA },
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
    gap: 20,
  },

  // Heading
  headingArea: {
    alignItems: 'center',
    gap: 8,
  },
  heading: {
    fontFamily: ViveFonts.title,
    fontSize: 32,
    color: TEXTO,
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  subheading: {
    fontFamily: ViveFonts.regular,
    fontSize: 15.5,
    color: TEXTO_SUAVE,
    textAlign: 'center',
  },

  // Buttons area
  btnsArea: {
    gap: 14,
  },
  btnIcon: { width: 26, alignItems: 'center' },
  btnText: {
    flex: 1,
    textAlign: 'center',
    fontFamily: ViveFonts.semibold,
    fontSize: 15.5,
    color: TEXTO,
  },

  // Google button
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BOTON_BG,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: BOTON_BORDE,
    paddingVertical: 17,
    paddingHorizontal: 18,
  },
  appleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BOTON_BG,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: BOTON_BORDE,
    paddingVertical: 17,
    paddingHorizontal: 18,
  },
  // "Usar email" contorneado y sin relleno: es el camino secundario.
  // 🔴 CONTORNEADO A PROPÓSITO, y es lo que lo diferencia del login de usuario
  // (14/09/2026, decisión de Andre). Esta pantalla **crea cuentas**, o sea que
  // es el momento en que se decide con qué se registra la persona — y conviene
  // que elija Google o Apple: esas cuentas traen el mail ya verificado por el
  // proveedor, así que **no pasan por el muro del mail, no dependen del SMTP,
  // no tienen código que puede no llegar ni contraseña que se olvide**. Toda la
  // fragilidad del alta está del lado del mail.
  //
  // ⚠️ NO copiar este estilo a `LoginScreen`: ahí no se decide nada (la cuenta
  // ya existe) y apagarlo solo le pone fricción a quien no tiene otra opción —
  // el cliente que llegó por el link de un coach, que nace con cuenta de mail y
  // sin contraseña. Ver el comentario de allá.
  emailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(38,64,47,0.32)',
    paddingVertical: 17,
    paddingHorizontal: 18,
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
    fontSize: 13.5,
    color: TEXTO_SUAVE,
    lineHeight: 20,
  },
  termsLink: {
    fontFamily: ViveFonts.medium,
    color: TERRACOTA,
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
    color: TEXTO_SUAVE,
  },
  footerLink: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: TERRACOTA,
  },
});