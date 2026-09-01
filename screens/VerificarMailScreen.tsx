import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, StatusBar, Animated, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ViveFonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { VitaWordmark } from '@/components/VitaWordmark';

// Mismo sistema que login/registro/bifurcación (rediseño de Andre, sesión 147).
const CREMA       = '#F7F2EA';
const TEXTO       = '#26402F';
const TEXTO_SUAVE = '#5C6B58';
const TERRACOTA   = '#C4743A';

const LARGO = 6;
// 🔴 60 y no menos: Supabase tiene su propio "Minimum interval per user" (60s
// por defecto). Con una cuenta regresiva más corta el botón se habilitaba antes
// de que el servidor aceptara, así que "Reenviar" fallaba y la persona no tenía
// forma de saber que el problema era esperar un rato más.
const ESPERA_REENVIO = 60;   // segundos

const fadeUp = (anim: Animated.Value) => ({
  opacity: anim,
  transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
});

/**
 * Verificación del mail. La usan DOS caminos, y se comportan distinto:
 *
 *   · `modo='alta'` — el alta de coach. Se llega con una sesión recién creada
 *     que todavía no debería servir para nada: **abandonar cierra la sesión**,
 *     y confirmar sigue a la postulación.
 *   · `modo='gate'` — alguien que ya usa la app y va a reservar. Su sesión es
 *     legítima: **abandonar NO la cierra**, solo vuelve. Confirmar vuelve
 *     también, a terminar lo que estaba haciendo.
 *
 * 🔴 La diferencia importa: cerrarle la sesión a alguien por no confirmar un
 * código en medio de una reserva sería sacarlo de la app por un trámite.
 *
 * 🔴 POR QUÉ EXISTE. Dos cosas que hasta ahora no se comprobaban:
 *   · quien se equivoca al tipear su dirección queda con una cuenta que **no
 *     puede recuperar nunca** —`resetPassword` manda el mail a una casilla que
 *     no existe— y sin forma de enterarse;
 *   · Vita aprueba profesionales sin haber comprobado que la casilla desde la
 *     que se postulan sea suya.
 *
 * ⚠️ POR QUÉ UN OTP Y NO "Confirm email" DE SUPABASE. Ese ajuste es del
 * proyecto entero, así que prenderlo frenaría también el registro de usuarios
 * con un muro de mail en el peor momento — y eso se decidió NO hacer. Además,
 * con el ajuste apagado Supabase auto-confirma a todos: `email_confirmed_at`
 * viene lleno siempre y no sirve para distinguir nada. Por eso el código se
 * pide acá y el resultado se anota en `profiles.email_verified_at`.
 *
 * 📝 A esta pantalla se llega con sesión abierta (el alta ya la creó), así que
 * el `verifyOtp` no es para entrar: es para probar que la casilla es suya.
 */
export default function VerificarMailScreen() {
  const router = useRouter();
  const { email, modo } = useLocalSearchParams<{ email?: string; modo?: string }>();
  const esAlta = (Array.isArray(modo) ? modo[0] : modo) !== 'gate';
  const { user, signOut } = useAuth();

  const mail = (Array.isArray(email) ? email[0] : email) ?? user?.email ?? '';

  const [codigo, setCodigo] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [espera, setEspera] = useState(0);

  const anim = useRef(new Animated.Value(0)).current;

  /**
   * 🔴 Solo en el alta: irse sin terminar cierra la sesión. Es el mismo guard
   * que `CoachApplicationScreen` — se llega logueado, y sin esto quedaría viva
   * una sesión de usuario final que el `AuthRedirect` usa para mandar a la
   * persona al Inicio sin que lo haya pedido.
   *
   * En `gate` NO se cierra nada: esa sesión ya era legítima antes de entrar acá.
   *
   * Por refs y con `[]` — con `signOut` o `esAlta` en las dependencias, un
   * re-render correría la limpieza en medio del formulario.
   */
  const listo = useRef(false);
  const signOutRef = useRef(signOut);
  signOutRef.current = signOut;
  const cierraAlSalir = useRef(esAlta);
  cierraAlSalir.current = esAlta;

  useFocusEffect(
    useCallback(() => () => {
      if (!listo.current && cierraAlSalir.current) void signOutRef.current();
    }, []),
  );

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 420, useNativeDriver: true }).start();
    void enviarCodigo(true);
    // Solo al montar: el código se manda una vez y después a pedido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cuenta regresiva del reenvío. Sin esto la persona toca "Reenviar" tres veces
  // seguidas y se come el límite de Supabase sin saber por qué.
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  async function enviarCodigo(inicial = false) {
    if (!mail) return;
    setReenviando(!inicial);
    setError(null);

    // `shouldCreateUser: false`: la cuenta ya existe. Sin esto, un mail mal
    // tipeado daría de alta una cuenta nueva en vez de fallar.
    const { error: e } = await supabase.auth.signInWithOtp({
      email: mail,
      options: { shouldCreateUser: false },
    });

    setReenviando(false);
    if (e) {
      setError('No pudimos enviar el código. Revisá el mail y probá de nuevo');
      return;
    }
    setEspera(ESPERA_REENVIO);
    if (!inicial) setAviso('Te mandamos un código nuevo');
  }

  async function verificar() {
    const limpio = codigo.replace(/\D/g, '');
    if (limpio.length !== LARGO) { setError(`El código tiene ${LARGO} dígitos`); return; }

    setVerificando(true);
    setError(null);
    setAviso(null);

    const { error: e } = await supabase.auth.verifyOtp({ email: mail, token: limpio, type: 'email' });

    if (e) {
      setVerificando(false);
      setError('El código no coincide o ya venció. Pedí uno nuevo');
      return;
    }

    // Queda constancia: es lo que le permite a la moderación saber que esta
    // dirección se comprobó y no se dio por buena.
    if (user) {
      await supabase.from('profiles')
        .update({ email_verified_at: new Date().toISOString() })
        .eq('id', user.id);
    }

    listo.current = true;   // que la limpieza de foco no cierre la sesión
    setVerificando(false);

    // El alta sigue a la postulación; el gate vuelve a lo que la persona
    // estaba haciendo (reservar), que es donde quedó el hilo.
    if (esAlta) router.replace('/coach-application');
    else router.back();
  }

  const puedeReenviar = espera === 0 && !reenviando && !verificando;

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">

            <Animated.View style={[s.logoWrap, fadeUp(anim)]}>
              <VitaWordmark />
            </Animated.View>

            <Animated.View style={[s.headingArea, fadeUp(anim)]}>
              <Text style={s.heading}>Confirmá tu mail</Text>
              <Text style={s.subheading}>
                {esAlta
                  ? `Te mandamos un código de ${LARGO} dígitos a`
                  : 'Antes de reservar necesitamos confirmar tu mail. Te mandamos un código a'}{'\n'}
                <Text style={s.mail}>{mail}</Text>
              </Text>
            </Animated.View>

            <Animated.View style={[s.form, fadeUp(anim)]}>
              <TextInput
                style={s.input}
                value={codigo}
                onChangeText={t => { setCodigo(t.replace(/\D/g, '').slice(0, LARGO)); setError(null); }}
                placeholder="000000"
                placeholderTextColor="rgba(92,107,88,0.45)"
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={LARGO}
                autoFocus
                editable={!verificando}
              />

              {!!error && <Text style={s.error}>{error}</Text>}
              {!error && !!aviso && <Text style={s.aviso}>{aviso}</Text>}

              <TouchableOpacity
                style={[s.enterBtn, verificando && s.enterBtnLoading]}
                onPress={verificar}
                activeOpacity={0.85}
                disabled={verificando}>
                {verificando
                  ? <ActivityIndicator size="small" color="#F7EFE4" />
                  : <Text style={s.enterBtnText}>Confirmar</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => enviarCodigo()}
                disabled={!puedeReenviar}
                activeOpacity={0.7}
                hitSlop={8}>
                <Text style={[s.reenviar, !puedeReenviar && s.reenviarQuieto]}>
                  {reenviando
                    ? 'Enviando…'
                    : espera > 0
                      ? `Reenviar código en ${espera}s`
                      : 'Reenviar código'}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* En el alta, volver la cancela (la limpieza cierra la sesión). En
                el gate, volver es solo volver. */}
            <View style={s.footer}>
              <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                <Text style={s.footerLink}>{esAlta ? 'Cancelar' : 'Ahora no'}</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
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
    lineHeight: 23,
  },
  mail: { fontFamily: ViveFonts.semibold, color: TEXTO },

  form: { gap: 16 },
  input: {
    backgroundColor: 'rgba(86,94,50,0.12)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.65)',
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontFamily: ViveFonts.semibold,
    fontSize: 26,
    color: TEXTO,
    textAlign: 'center',
    // Los dígitos entran de a uno y sin esto la caja se mueve en cada tecla.
    letterSpacing: 10,
  },

  error: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#C0392B',
    textAlign: 'center',
    lineHeight: 18,
  },
  aviso: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: TEXTO_SUAVE,
    textAlign: 'center',
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
  },

  reenviar: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: TERRACOTA,
    textAlign: 'center',
  },
  reenviarQuieto: { color: TEXTO_SUAVE, opacity: 0.7 },

  footer: { alignItems: 'center' },
  footerLink: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: TERRACOTA,
  },
});
