import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppBg } from '@/components/ui/AppBg';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export default function CoachApplicationStatusScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void supabase.rpc('mi_postulacion').then(({ data, error: loadError }) => {
      if (!active) return;
      if (loadError || !data?.length) setError(true);
      else setSpecialty(data[0].specialty ?? null);
      setLoading(false);
    });
    return () => { active = false; };
  }, [user]);

  return (
    <AppBg>
      <SafeAreaView style={s.container}>
        {loading ? <ActivityIndicator color={ViveColors.accent} /> : (
          <View style={s.content}>
            <Text style={s.title}>Tu solicitud está en revisión</Text>
            {error ? (
              <Text style={s.body}>No pudimos consultar el estado. Cerrá sesión y volvé a intentar.</Text>
            ) : (
              <>
                <Text style={s.body}>
                  Revisamos tu perfil y te escribimos al mail para coordinar la entrevista previa. Te avisaremos la decisión o qué información falta.
                </Text>
                <Text style={s.body}>
                  {specialty === 'Psicólogo/a' || specialty === 'Nutricionista'
                    ? 'Para aprobar tu solicitud necesitamos verificar tu matrícula. Podés subirla ahora desde Formación.'
                    : 'Podés cargar tu formación y las certificaciones que quieras que Vita verifique.'}
                </Text>
                <TouchableOpacity style={s.primary} onPress={() => router.push('/coach-credenciales')}>
                  <Text style={s.primaryText}>Cargar formación y credenciales</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={s.secondary} onPress={async () => {
              await signOut();
              router.replace('/');
            }}>
              <Text style={s.secondaryText}>Cerrar sesión</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  content: { gap: 18 },
  title: { color: ViveColors.text, fontFamily: ViveFonts.semibold, fontSize: 28 },
  body: { color: ViveColors.text, fontFamily: ViveFonts.regular, fontSize: 15, lineHeight: 23 },
  primary: { backgroundColor: ViveColors.primaryInk, borderRadius: 16, padding: 18, alignItems: 'center' },
  primaryText: { color: ViveColors.onPrimaryInk, fontFamily: ViveFonts.semibold, fontSize: 15 },
  secondary: { padding: 12, alignItems: 'center' },
  secondaryText: { color: ViveColors.text, fontFamily: ViveFonts.medium, fontSize: 14 },
});
