import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { ScaleCard } from '@/components/ScaleCard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ViveColors, ViveFonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { AppBg } from '@/components/ui/AppBg';
import { VitaWordmark } from '@/components/VitaWordmark';

// Segundo paso de la recuperación de contraseña: acá cae el link del mail que
// manda `AuthContext.resetPassword`.
//
// ⚠️ El link trae `?code=`, no tokens en el fragmento, porque el cliente usa
// `flowType: 'pkce'` (ver lib/supabase.ts). Hay que canjearlo por sesión antes
// de poder cambiar nada — y el canje SOLO funciona en el mismo dispositivo que
// pidió el mail, porque el code verifier vive en su AsyncStorage.
//
// ⚠️ Al canjear, el usuario queda con sesión iniciada. `AuthRedirect`
// (app/_layout.tsx) solo patea fuera de las pantallas de onboarding/auth, y
// `nueva-contrasena` no está en esa lista, así que no nos expulsa antes de que
// la persona ponga la contraseña nueva. Si algún día se agrega a
// ONBOARDING_SCREENS, este flujo se rompe.

type Estado = 'canjeando' | 'listo' | 'invalido' | 'guardado';

const MIN_PASS = 6;

export default function NuevaContrasenaScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();

  const [estado, setEstado] = useState<Estado>('canjeando');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [verPass, setVerPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!code) { setEstado('invalido'); return; }
    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error: e }) => setEstado(e ? 'invalido' : 'listo'))
      .catch(() => setEstado('invalido'));
  }, [code]);

  async function guardar() {
    setError(null);
    if (pass.length < MIN_PASS) { setError(`La contraseña debe tener al menos ${MIN_PASS} caracteres`); return; }
    if (pass !== pass2) { setError('Las contraseñas no coinciden'); return; }

    setGuardando(true);
    const { error: e } = await supabase.auth.updateUser({ password: pass });
    setGuardando(false);
    if (e) { setError('No se pudo cambiar la contraseña. Probá de nuevo'); return; }
    setEstado('guardado');
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

            <View style={s.logoWrap}>
              <VitaWordmark />
            </View>

            {estado === 'canjeando' && (
              <ActivityIndicator color={ViveColors.primary} />
            )}

            {estado === 'invalido' && (
              <View style={s.headingArea}>
                <Text style={s.heading}>Ese link ya no sirve</Text>
                <Text style={s.subheading}>
                  Los links de recuperación duran poco y se usan una sola vez. Además tenés que
                  abrirlo en el mismo teléfono donde lo pediste. Pedí uno nuevo desde el inicio de
                  sesión.
                </Text>
                <ScaleCard
                  style={s.enterBtn}
                  onPress={() => router.replace('/login')}
                  activeOpacity={0.85}>
                  <Text style={s.enterBtnText}>Volver al inicio de sesión</Text>
                </ScaleCard>
              </View>
            )}

            {estado === 'guardado' && (
              <View style={s.headingArea}>
                <Text style={s.heading}>Listo</Text>
                <Text style={s.subheading}>Ya podés entrar con tu contraseña nueva.</Text>
                <ScaleCard
                  style={s.enterBtn}
                  onPress={() => router.replace('/(tabs)' as any)}
                  activeOpacity={0.85}>
                  <Text style={s.enterBtnText}>Entrar</Text>
                </ScaleCard>
              </View>
            )}

            {estado === 'listo' && (
              <>
                <View style={s.headingArea}>
                  <Text style={s.heading}>Elegí una contraseña nueva</Text>
                  <Text style={s.subheading}>Mínimo {MIN_PASS} caracteres.</Text>
                </View>

                <View style={s.form}>
                  <View style={s.inputRow}>
                    <TextInput
                      style={s.inputInner}
                      value={pass}
                      onChangeText={v => { setPass(v); setError(null); }}
                      placeholder="Contraseña nueva"
                      placeholderTextColor="rgba(135,131,92,0.45)"
                      secureTextEntry={!verPass}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity onPress={() => setVerPass(v => !v)} hitSlop={8}>
                      <MaterialCommunityIcons
                        name={verPass ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="rgba(135,131,92,0.80)"
                      />
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={s.input}
                    value={pass2}
                    onChangeText={v => { setPass2(v); setError(null); }}
                    placeholder="Confirmá la contraseña"
                    placeholderTextColor="rgba(135,131,92,0.45)"
                    secureTextEntry={!verPass}
                    autoCapitalize="none"
                  />

                  {error && <Text style={s.serverError}>{error}</Text>}

                  <ScaleCard
                    style={s.enterBtn}
                    onPress={guardar}
                    activeOpacity={0.85}
                    disabled={guardando}>
                    {guardando
                      ? <ActivityIndicator size="small" color="#F7EFE4" />
                      : <Text style={s.enterBtnText}>Guardar contraseña</Text>}
                  </ScaleCard>
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
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
  logoWrap: { alignItems: 'center' },
  headingArea: { alignItems: 'center', gap: 12 },
  heading: {
    fontFamily: ViveFonts.title,
    fontSize: 24,
    color: '#565E32',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subheading: {
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: '#87835C',
    textAlign: 'center',
  },
  form: { gap: 12 },
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
  serverError: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#C4553A',
    textAlign: 'center',
  },
  enterBtn: {
    backgroundColor: '#565E32',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: 8,
    alignSelf: 'stretch',
  },
  enterBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: '#F7EFE4',
    letterSpacing: 0.2,
  },
});
