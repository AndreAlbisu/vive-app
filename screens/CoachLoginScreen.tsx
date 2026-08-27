import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, Animated, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { User } from '@supabase/supabase-js';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { AppBg } from '@/components/ui/AppBg';
import LegalSheet from '@/components/LegalSheet';

const fadeUp = (anim: Animated.Value) => ({
  opacity: anim,
  transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
});

export default function CoachLoginScreen() {
  const router = useRouter();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple, signOut } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  // Se prende cuando ya sabemos que hace falta crear la cuenta (el intento de
  // login de abajo falló) y todavía no tenemos un nombre real para ella. Ver
  // el porqué en `handleSubmit`.
  const [needsName, setNeedsName] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legalDoc, setLegalDoc] = useState<'terminos' | 'privacidad' | null>(null);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(formAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();
  }, []);

  async function validateAndNavigate(isNewSignup: boolean) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [{ data: profile }, { data: coachRow }] = await Promise.all([
      supabase.from('profiles').select('role').eq('id', user.id).single(),
      supabase.from('coaches').select('id, verified').eq('profile_id', user.id).maybeSingle(),
    ]);

    setLoading(false);

    if (coachRow?.verified) {
      Alert.alert(
        '¡Bienvenido de nuevo!',
        'Tu cuenta de profesional ya está aprobada. Te llevamos a tu panel',
        [{ text: 'OK', onPress: () => router.replace('/(coach)' as any) }],
      );
      return;
    }

    if (coachRow && !coachRow.verified) {
      await signOut();
      Alert.alert(
        'Solicitud en revisión',
        'Ya enviaste tu solicitud para ser profesional. Te avisaremos cuando Vita la apruebe',
        [{ text: 'OK', onPress: () => router.back() }],
      );
      return;
    }

    // A esta altura no hay fila en `coaches`. Si la cuenta ya existía antes de
    // este submit (login, no signup) y es de un usuario final, bloqueamos — para
    // postularte necesitás un mail distinto. Si la cuenta la acabamos de crear
    // nosotros mismos (isNewSignup), el role='user' es solo el default del
    // trigger y todavía no hay postulación — dejamos que siga a coach-application.
    if (!isNewSignup && profile?.role === 'user') {
      // Cerrar la sesión, igual que en la rama de "solicitud en revisión". Sin
      // esto quedaba abierta una sesión de usuario final sobre una pantalla que
      // dice que no sirve para entrar: por email era raro, con Google/Apple es
      // peor — se toca un botón, se entra de verdad, y el cartel de error deja
      // a la persona logueada como usuario sin haberlo pedido.
      await signOut();
      setError('Esta cuenta ya está registrada como usuario. Para postularte como profesional necesitás usar un mail distinto');
      return;
    }

    router.replace('/coach-application');
  }

  /** ¿La cuenta la creó este mismo login social, o ya existía?
   *
   *  OAuth no separa "registrarse" de "iniciar sesión": el mismo botón da de
   *  alta la cuenta si el mail no existía. Pero `validateAndNavigate` necesita
   *  distinguir las dos cosas, porque `profiles.role` arranca en 'user' por el
   *  default del trigger de alta — sin esta distinción una cuenta recién creada
   *  se vería idéntica a la de un usuario final de siempre y quedaría bloqueada
   *  por la regla de mail distinto, que es justo lo contrario de lo que se
   *  quiere.
   *
   *  No hay un flag exacto en la sesión, así que se mira la antigüedad de la
   *  cuenta: si `created_at` es de recién, la creó este flujo. La ventana es
   *  holgada a propósito (el ida y vuelta al navegador puede demorar) y el
   *  costo del margen es acotado: como mucho deja postularse a alguien que se
   *  registró como usuario final hace menos de dos minutos.
   *
   *  Si ya había sesión antes de tocar el botón, no hay nada nuevo: la cuenta
   *  existía sí o sí. Ese chequeo va primero porque es el exacto. */
  function esCuentaRecienCreada(user: User, habiaSesionPrevia: boolean) {
    if (habiaSesionPrevia) return false;
    return Date.now() - new Date(user.created_at).getTime() < 2 * 60_000;
  }

  // Con Google/Apple el alta y el login son el mismo botón, así que esta es
  // también la vía de alta de un profesional nuevo. La regla de mail distinto
  // no cambia: la sigue aplicando `validateAndNavigate`, y una cuenta que ya
  // existe como usuario final rebota igual que por email.
  async function handleOAuth(provider: 'google' | 'apple') {
    const setProviderLoading = provider === 'google' ? setGoogleLoading : setAppleLoading;
    setProviderLoading(true);
    setError(null);

    // Foto de la sesión previa para poder distinguir "canceló" de "entró": los
    // dos casos vuelven con `null`, porque `signInWithGoogle` trata el cierre
    // del navegador como un no-evento y no como un error. Sin esto, cancelar
    // caía igual en la validación y —si ya había una sesión abierta— le tiraba
    // el cartel de "usá otro mail" a alguien que solo cerró la ventana.
    const { data: { session: sesionPrevia } } = await supabase.auth.getSession();

    const oauthError = provider === 'google'
      ? await signInWithGoogle(true, true)
      : await signInWithApple(true, true);

    if (oauthError) {
      setProviderLoading(false);
      setError(oauthError);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();

    // `last_sign_in_at` es lo que separa "volvió a entrar con la misma cuenta"
    // de "cerró el navegador y la sesión quedó como estaba": comparar solo el
    // id no alcanza cuando ya había sesión de esa misma persona.
    const cancelado = !session || (
      sesionPrevia?.user.id === session.user.id &&
      sesionPrevia?.user.last_sign_in_at === session.user.last_sign_in_at
    );

    if (cancelado) {
      setProviderLoading(false);
      return;
    }

    // El spinner pasa del botón del proveedor al genérico: `validateAndNavigate`
    // apaga `loading`, que es el que cubre las consultas a profiles/coaches.
    setProviderLoading(false);
    setLoading(true);
    await validateAndNavigate(esCuentaRecienCreada(session.user, !!sesionPrevia));
  }

  async function handleSubmit() {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError('Completá el email y la contraseña');
      return;
    }
    if (trimmedPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    // 🔴 Segunda vuelta: ya sabemos (por el intento de login de más abajo, en
    // el submit anterior) que hace falta CREAR la cuenta, y ahora ya tenemos
    // el nombre que se acaba de pedir. No se reintenta el login — ya sabemos
    // que falla — se va directo a crear la cuenta.
    if (needsName) {
      const trimmedName = name.trim();
      if (!trimmedName) { setError('Ingresá tu nombre'); return; }

      setLoading(true);
      setError(null);

      // acceptedTerms / ageConfirmed = true: al tocar el botón el profesional ya
      // aceptó y declaró la edad, según la nota de abajo. La edad se vuelve a
      // chequear de forma dura contra `birth_date` en CoachApplicationScreen,
      // que es donde hay un dato real.
      const signUpError = await signUpWithEmail(trimmedEmail, trimmedPassword, trimmedName, true, true);

      if (!signUpError) {
        await validateAndNavigate(true);
        return;
      }

      setLoading(false);
      // La única forma de llegar hasta acá y que falle es que la cuenta en
      // realidad SÍ existía (typeamos mal la contraseña del login de arriba,
      // pero el mail es de una cuenta real) — el mismo caso que antes se
      // detectaba en el primer intento.
      if (signUpError.includes('already registered') || signUpError.includes('already been registered')) {
        setError('No pudimos entrar con esa contraseña. Si creaste la cuenta con Google o Apple, entrá con ese botón');
      } else {
        setError('No pudimos crear la cuenta. Probá de nuevo');
      }
      return;
    }

    setLoading(true);
    setError(null);

    const signInError = await signInWithEmail(trimmedEmail, trimmedPassword);

    if (!signInError) {
      await validateAndNavigate(false);
      return;
    }

    // 🔴 Antes de acá se creaba la cuenta directo, con el nombre puesto a
    // ciegas como `trimmedEmail.split('@')[0]` — la parte de antes de la
    // arroba. Con un mail normal daba un nombre feo pero corto; con un alias
    // tipo `+coachtest` quedaba larguísimo, y ESE valor terminaba siendo
    // `profiles.name` PARA SIEMPRE, porque nada en el alta ni en la
    // postulación vuelve a pedir el nombre — desbordaba la tarjeta de saludo
    // de la Home (`Hola, {coachName}`, hallazgo 27/08/2026) y quedaba mal en
    // cualquier lado que mostrara el nombre del coach.
    //
    // En vez de inventar un nombre, se pausa acá y se pide el real. El
    // próximo submit (`needsName` ya prendido) va a crear la cuenta con lo
    // que la persona escriba.
    setLoading(false);
    setNeedsName(true);
  }

  // Un solo flag para deshabilitar: si no, se puede tocar Google mientras
  // corre el submit por email y quedan dos flujos de auth pisándose.
  const anyLoading = loading || googleLoading || appleLoading;

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

            <View style={styles.social}>
              <TouchableOpacity
                style={[styles.googleBtn, anyLoading && styles.buttonDisabled]}
                onPress={() => handleOAuth('google')}
                activeOpacity={0.85}
                disabled={anyLoading}
              >
                {googleLoading
                  ? <ActivityIndicator size="small" color="#4285F4" />
                  : <MaterialCommunityIcons name="google" size={20} color="#4285F4" />}
                <Text style={styles.googleBtnText}>Continuar con Google</Text>
              </TouchableOpacity>

              {/* Sign in with Apple no existe en Android, ocultar */}
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={[styles.appleBtn, anyLoading && styles.buttonDisabled]}
                  onPress={() => handleOAuth('apple')}
                  activeOpacity={0.85}
                  disabled={anyLoading}
                >
                  {appleLoading
                    ? <ActivityIndicator size="small" color="#FFFFFF" />
                    : <MaterialCommunityIcons name="apple" size={20} color="#FFFFFF" />}
                  <Text style={styles.appleBtnText}>Continuar con Apple</Text>
                </TouchableOpacity>
              )}

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>o con tu email</Text>
                <View style={styles.dividerLine} />
              </View>
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

              {needsName && (
                <View style={styles.field}>
                  <Text style={styles.hint}>Es la primera vez que entrás con este mail — ¿cómo te llamamos?</Text>
                  <Text style={styles.label}>Tu nombre</Text>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="Nombre y apellido"
                    placeholderTextColor="rgba(135,131,92,0.45)"
                    autoFocus
                  />
                </View>
              )}

              {error && (
                <View style={styles.errorBox}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#C0392B" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[styles.button, anyLoading && styles.buttonDisabled]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={anyLoading}
            >
              {loading ? (
                <Text style={styles.buttonText}>{needsName ? 'Creando cuenta...' : 'Ingresando...'}</Text>
              ) : (
                <Text style={styles.buttonText}>{needsName ? 'Crear cuenta' : 'Continuar'}</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.note}>
              Podés entrar con Google, con Apple o con tu email. El rol de profesional se activa cuando Vita aprueba tu solicitud.
            </Text>

            {/* Aceptación implícita: esta pantalla es login Y alta de cuenta a la vez,
                así que un checkbox obligatorio le sumaría fricción a quien solo entra.
                Importa que el profesional pase por acá: la cláusula anti-solicitación
                de los T&C (§10) es la que sostiene la medida anti-fuga. */}
            <Text style={styles.legalNote}>
              {'Al continuar declarás tener 18 años o más y aceptás los '}
              <Text style={styles.legalLink} onPress={() => setLegalDoc('terminos')}>
                Términos y condiciones
              </Text>
              {' y la '}
              <Text style={styles.legalLink} onPress={() => setLegalDoc('privacidad')}>
                Política de privacidad
              </Text>
              {' de Vita.'}
            </Text>
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
  social: { gap: 12 },
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
    // Centrar el separador entre los botones sociales y el formulario: el
    // contenedor ya mete 28 por debajo (su `gap`) y acá arriba solo hay 12.
    marginTop: 8,
    marginBottom: -8,
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

  form: { gap: 16 },
  field: { gap: 6 },
  label: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: '#87835C',
  },
  hint: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: '#87835C',
    marginBottom: 2,
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
  legalNote: {
    fontFamily: ViveFonts.regular,
    fontSize: 11.5,
    color: 'rgba(135,131,92,0.62)',
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 14,
  },
  legalLink: {
    fontFamily: ViveFonts.semibold,
    color: ViveColors.primary,
  },
});
