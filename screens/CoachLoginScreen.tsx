import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, Animated, KeyboardAvoidingView, Platform, ScrollView, Alert,
  LayoutAnimation, UIManager, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { User } from '@supabase/supabase-js';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { EntradaDesdeColor } from '@/components/EntradaDesdeColor';
import { useAuth, ERR_YA_REGISTRADO, ERR_CREDENCIALES } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { VitaWordmark } from '@/components/VitaWordmark';
import { ReglaConPunto, DivisorConPunto, LineasEsquina } from '@/components/ui/AuthOrnamentos';
import LegalSheet from '@/components/LegalSheet';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// Mismo sistema que login/registro/bifurcación (rediseño de Andre, sesión 147):
// crema plano en vez del gradiente de <AppBg>, verde oscuro para títulos,
// terracota reservado a los links.
const CREMA       = '#F7F2EA';
const BOTON_BG    = '#FCFAF5';
const BOTON_BORDE = 'rgba(86,94,50,0.16)';
const TEXTO       = '#26402F';
const TEXTO_SUAVE = '#5C6B58';
const TERRACOTA   = '#C4743A';

const fadeUp = (anim: Animated.Value) => ({
  opacity: anim,
  transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
});

export default function CoachLoginScreen() {
  const router = useRouter();
  // Con qué color se llegó desde la bifurcación, si se llegó por ahí.
  const { tono } = useLocalSearchParams<{ tono?: string }>();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple, signOut } = useAuth();

  const [showEmailForm, setShowEmailForm] = useState(false);
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

  const logoAnim    = useRef(new Animated.Value(0)).current;
  const headingAnim = useRef(new Animated.Value(0)).current;
  const btnsAnim    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.timing(logoAnim,    { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(headingAnim, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.timing(btnsAnim,    { toValue: 1, duration: 360, useNativeDriver: true }),
    ]).start();
  }, []);

  function toggleEmailForm() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowEmailForm(prev => !prev);
    if (showEmailForm) {
      setEmail('');
      setPassword('');
      setName('');
      setNeedsName(false);
      setError(null);
    }
  }

  // ── Lógica del coach — SIN CAMBIOS respecto del diseño viejo ────────────────

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

    // 🔴 Alta nueva → primero se confirma el mail. Es la única forma de saber
    // que la casilla es de quien se postula, y de que la cuenta va a poder
    // recuperarse: `resetPassword` manda un mail, así que una dirección mal
    // tipeada deja una cuenta irrecuperable y sin aviso.
    //
    // Quien ENTRA (no se registra ahora) ya pasó por acá alguna vez o tiene
    // fila en `coaches`, así que no se le vuelve a pedir.
    if (isNewSignup) {
      router.replace({ pathname: '/verificar-mail', params: { email: user.email ?? '', modo: 'alta' } } as any);
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
      // La cuenta en realidad SÍ existía: typeamos mal la contraseña del login
      // de arriba, pero el mail es de una cuenta real.
      //
      // 🔴 Se compara contra la CONSTANTE, no contra el texto en inglés de
      // Supabase. `signUpWithEmail` devuelve el mensaje ya traducido, así que
      // el `includes('already registered')` que había acá no daba verdadero
      // nunca — y todo, incluido el límite de intentos y la contraseña corta,
      // terminaba en un "probá de nuevo" que no decía nada.
      if (signUpError === ERR_YA_REGISTRADO) {
        setError('Ya existe una cuenta con ese mail y esa contraseña no es la suya. Si la creaste con Google o Apple, entrá con ese botón');
      } else {
        // El motivo real, no un genérico: es lo único que le dice a la persona
        // si tiene que esperar, cambiar la contraseña o revisar el mail.
        setError(signUpError);
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
    //
    // 🔴 Pero SOLO si el login falló por credenciales. Antes se pasaba a pedir
    // el nombre ante CUALQUIER error, sin mirar cuál — así que un mail sin
    // confirmar, un límite de intentos o una caída de red se leían como "esta
    // cuenta no existe" y empujaban a crear una que ya estaba. El resultado
    // era el par de mensajes contradictorios que reportó Andre: el login dice
    // que no entra y el alta dice que ya existe.
    //
    // ⚠️ Credenciales inválidas es el ÚNICO caso ambiguo: Supabase devuelve lo
    // mismo si la cuenta no existe y si la contraseña está mal, para que no se
    // pueda averiguar qué mails están registrados. Ahí sí vale ofrecer crearla.
    if (signInError !== ERR_CREDENCIALES) {
      setLoading(false);
      setError(signInError);
      return;
    }

    setLoading(false);
    setNeedsName(true);
  }

  // Un solo flag para deshabilitar: si no, se puede tocar Google mientras
  // corre el submit por email y quedan dos flujos de auth pisándose.
  const anyLoading = loading || googleLoading || appleLoading;

  return (
    <View style={s.root}>
      <EntradaDesdeColor tono={tono} />
      <StatusBar barStyle="dark-content" />
      <LineasEsquina />
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
              <ReglaConPunto />
            </Animated.View>

            {/* Heading */}
            <Animated.View style={[s.headingArea, fadeUp(headingAnim)]}>
              <Text style={s.heading}>Tu espacio profesional</Text>
              <Text style={s.subheading}>Entrá o creá tu cuenta de coach</Text>
            </Animated.View>

            {/* Botones */}
            <Animated.View style={[s.btnsArea, fadeUp(btnsAnim)]}>

              {/* Google */}
              <TouchableOpacity
                style={[s.socialBtn, anyLoading && { opacity: 0.6 }]}
                onPress={() => handleOAuth('google')}
                activeOpacity={0.85}
                disabled={anyLoading}>
                <View style={s.btnIcon}>
                  {googleLoading
                    ? <ActivityIndicator size="small" color="#4285F4" />
                    : <MaterialCommunityIcons name="google" size={21} color="#4285F4" />}
                </View>
                <Text style={s.btnText}>Continuar con Google</Text>
                <View style={s.btnIcon} />
              </TouchableOpacity>

              {/* Apple — no existe en Android */}
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={[s.socialBtn, anyLoading && { opacity: 0.6 }]}
                  onPress={() => handleOAuth('apple')}
                  activeOpacity={0.85}
                  disabled={anyLoading}>
                  <View style={s.btnIcon}>
                    {appleLoading
                      ? <ActivityIndicator size="small" color="#1A1A1A" />
                      : <MaterialCommunityIcons name="apple" size={22} color="#1A1A1A" />}
                  </View>
                  <Text style={s.btnText}>Continuar con Apple</Text>
                  <View style={s.btnIcon} />
                </TouchableOpacity>
              )}

              {/* El rol de profesional se activa al aprobar la postulación —
                  esta pantalla es login Y alta a la vez. */}
              <Text style={s.roleNote}>
                Tu cuenta de profesional se activa cuando Vita aprueba tu solicitud.
              </Text>

              {/* Aceptación implícita: la cláusula anti-solicitación de los T&C
                  (§10) sostiene la medida anti-fuga, así que importa que el
                  profesional pase por acá. */}
              <Text style={s.legalNote}>
                {'Al continuar declarás tener 18 años o más y aceptás los '}
                <Text style={s.legalLink} onPress={() => setLegalDoc('terminos')}>
                  Términos y condiciones
                </Text>
                {' y la '}
                <Text style={s.legalLink} onPress={() => setLegalDoc('privacidad')}>
                  Política de privacidad
                </Text>
                {' de Vita.'}
              </Text>

              {error && !showEmailForm && <Text style={s.serverError}>{error}</Text>}

              <DivisorConPunto />

              {/* Usar email — camino secundario, contorneado */}
              <TouchableOpacity style={s.emailBtn} onPress={toggleEmailForm} activeOpacity={0.85}>
                <View style={s.btnIcon}>
                  <MaterialCommunityIcons name="email-outline" size={21} color={TEXTO} />
                </View>
                <Text style={s.btnText}>Usar email</Text>
                <View style={s.btnIcon} />
              </TouchableOpacity>

              {showEmailForm && (
                <View style={s.emailForm}>
                  <TextInput
                    style={s.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="tu@email.com"
                    placeholderTextColor="rgba(135,131,92,0.45)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <View style={s.inputRow}>
                    <TextInput
                      style={s.inputInner}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Contraseña (mín. 6)"
                      placeholderTextColor="rgba(135,131,92,0.45)"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                      <MaterialCommunityIcons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="rgba(135,131,92,0.80)"
                      />
                    </TouchableOpacity>
                  </View>

                  {needsName && (
                    <>
                      <Text style={s.nameHint}>Es la primera vez que entrás con este mail — ¿cómo te llamamos?</Text>
                      <TextInput
                        style={s.input}
                        value={name}
                        onChangeText={setName}
                        placeholder="Nombre y apellido"
                        placeholderTextColor="rgba(135,131,92,0.45)"
                        autoFocus
                      />
                    </>
                  )}

                  {error && <Text style={s.serverError}>{error}</Text>}

                  <TouchableOpacity
                    style={[s.enterBtn, anyLoading && s.enterBtnLoading]}
                    onPress={handleSubmit}
                    activeOpacity={0.85}
                    disabled={anyLoading}>
                    {loading
                      ? <ActivityIndicator size="small" color="#F7EFE4" />
                      : <Text style={s.enterBtnText}>{needsName ? 'Crear cuenta' : 'Continuar'}</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>

            {/* Footer — volver a la pantalla anterior (la bifurcación) */}
            <View style={s.footer}>
              <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                <Text style={s.footerLink}>Volver</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <LegalSheet
          visible={legalDoc !== null}
          doc={legalDoc ?? 'terminos'}
          onClose={() => setLegalDoc(null)}
        />
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREMA },
  safe: { flex: 1 },
  flex: { flex: 1 },

  container: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 52,
    paddingBottom: 36,
    justifyContent: 'center',
    gap: 30,
  },

  logoWrap: { alignItems: 'center', gap: 20 },

  headingArea: { alignItems: 'center', gap: 10 },
  heading: {
    fontFamily: ViveFonts.title,
    fontSize: 32,
    color: TEXTO,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subheading: {
    fontFamily: ViveFonts.regular,
    fontSize: 15.5,
    color: TEXTO_SUAVE,
    textAlign: 'center',
  },

  btnsArea: { gap: 14 },

  btnIcon: { width: 26, alignItems: 'center' },
  btnText: {
    flex: 1,
    textAlign: 'center',
    fontFamily: ViveFonts.semibold,
    fontSize: 15.5,
    color: TEXTO,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BOTON_BG,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: BOTON_BORDE,
    paddingVertical: 17,
    paddingHorizontal: 18,
  },

  roleNote: {
    fontFamily: ViveFonts.regular,
    fontSize: 12.5,
    color: TEXTO_SUAVE,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 2,
  },
  legalNote: {
    fontFamily: ViveFonts.regular,
    fontSize: 11.5,
    color: 'rgba(135,131,92,0.62)',
    lineHeight: 17,
    textAlign: 'center',
  },
  legalLink: {
    fontFamily: ViveFonts.semibold,
    color: ViveColors.primary,
  },
  serverError: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#C0392B',
    textAlign: 'center',
    lineHeight: 18,
  },

  // "Usar email" contorneado y sin relleno: es el camino secundario.
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
  nameHint: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: TEXTO_SUAVE,
    marginTop: -2,
    marginBottom: -4,
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

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLink: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: TERRACOTA,
  },
});
