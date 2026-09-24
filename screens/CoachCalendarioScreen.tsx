// Tu calendario — el profesional suscribe sus sesiones a Google Calendar o al
// calendario del iPhone (24/09/2026, decisión de Andre).
//
// El link lo sirve la función `calendario` y lo emite `mi_link_calendario()`
// (scripts/add-calendario-profesional.sql). Se ve en el calendario de la persona
// y se actualiza solo: sesiones movidas se mueven, canceladas desaparecen.
//
// 📌 Sin nombres de clientes en el calendario, a propósito: se sincroniza y se
// comparte, y el nombre de quien va a terapia no tiene por qué viajar ahí.
//
// 📌 "Copiar" va por el menú de compartir del sistema (que trae "Copiar"): así
// no hace falta sumar una librería nativa de portapapeles.

import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Linking, Share, ScrollView, Platform, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ViveFonts } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';
import { supabase } from '@/lib/supabase';
import { logError } from '@/lib/logging';

const FOREST = '#3A4F2A';
const MUTED = '#87835C';

function urlsDelCalendario(token: string) {
  const https = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/calendario?t=${token}`;
  const webcal = https.replace(/^https:/, 'webcal:');
  // Google no se suscribe desde su app del teléfono: se agrega desde la web.
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
  return { https, webcal, google };
}

export default function CoachCalendarioScreen() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [regenerando, setRegenerando] = useState(false);
  const [error, setError] = useState(false);

  const pedir = useCallback(async (regenerar: boolean) => {
    const { data, error: err } = await supabase.rpc('mi_link_calendario', { p_regenerar: regenerar });
    if (err || typeof data !== 'string') {
      void logError('CoachCalendario: no se pudo obtener el link', err);
      setError(true);
      return null;
    }
    setError(false);
    setToken(data);
    return data;
  }, []);

  useEffect(() => {
    void pedir(false).finally(() => setCargando(false));
  }, [pedir]);

  const urls = token ? urlsDelCalendario(token) : null;

  async function abrir(url: string, siFalla: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('No se pudo abrir', siFalla);
    }
  }

  function regenerar() {
    Alert.alert(
      '¿Generar un link nuevo?',
      'El link actual deja de funcionar: tus sesiones van a desaparecer de los calendarios donde lo agregaste, y vas a tener que agregar el nuevo. Hacelo si compartiste el link con alguien que ya no debería verlo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Generar uno nuevo',
          style: 'destructive',
          onPress: async () => {
            setRegenerando(true);
            const t = await pedir(true);
            setRegenerando(false);
            if (t) Alert.alert('Listo', 'El link anterior ya no funciona. Agregá el nuevo a tu calendario.');
          },
        },
      ],
    );
  }

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7} hitSlop={8}>
            <MaterialIcons name="arrow-back-ios" size={18} color="#565E32" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Tu calendario</Text>
          <View style={s.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={s.body}>
          <Text style={s.lead}>
            Tus sesiones confirmadas aparecen en el calendario de tu teléfono y se actualizan solas: si una se mueve o se cancela, el calendario también cambia.
          </Text>
          <Text style={s.nota}>
            Por privacidad, cada sesión figura como “Sesión · Vita”, sin el nombre de la persona. Para ver con quién es, entrá a Vita.
          </Text>

          {cargando ? (
            <ActivityIndicator color={FOREST} style={{ marginTop: 24 }} />
          ) : error || !urls ? (
            <View style={s.card}>
              <Text style={s.cardTitle}>No pudimos preparar tu link</Text>
              <TouchableOpacity style={s.btnPrimario} onPress={() => { setCargando(true); void pedir(false).finally(() => setCargando(false)); }}>
                <Text style={s.btnPrimarioText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={s.btnPrimario}
                  onPress={() => abrir(urls.webcal, 'Copiá el link y agregalo desde Ajustes › Calendario › Cuentas › Agregar cuenta › Otra › Agregar calendario suscripto.')}
                  activeOpacity={0.85}>
                  <Text style={s.btnPrimarioText}>Agregar al calendario del iPhone</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={Platform.OS === 'ios' ? s.btnSecundario : s.btnPrimario}
                onPress={() => abrir(urls.google, 'Copiá el link y agregalo en calendar.google.com › Otros calendarios › Desde URL.')}
                activeOpacity={0.85}>
                <Text style={Platform.OS === 'ios' ? s.btnSecundarioText : s.btnPrimarioText}>Agregar a Google Calendar</Text>
              </TouchableOpacity>
              <Text style={s.ayuda}>
                Google abre su página web: confirmá con “Agregar”. Puede tardar unas horas en mostrar cambios, porque Google vuelve a leer el calendario cada tanto.
              </Text>

              <TouchableOpacity
                style={s.btnSecundario}
                onPress={() => { void Share.share({ message: urls.https }).catch(() => {}); }}
                activeOpacity={0.85}>
                <Text style={s.btnSecundarioText}>Copiar o compartir el link</Text>
              </TouchableOpacity>
              <Text style={s.ayuda}>
                Para Outlook u otra app de calendario: usá la opción de suscribirte a un calendario desde una URL.
              </Text>

              <View style={s.separador} />
              <Text style={s.cardTitle}>¿Alguien que no debería tiene tu link?</Text>
              <Text style={s.ayuda}>Quien lo tenga ve tus horarios de sesión, nada más. Si lo compartiste de más, generá uno nuevo.</Text>
              <TouchableOpacity onPress={regenerar} disabled={regenerando} activeOpacity={0.7}>
                <Text style={s.link}>{regenerando ? 'Generando…' : 'Generar un link nuevo'}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,248,240,0.62)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontFamily: ViveFonts.semibold, fontSize: 18, color: '#565E32', textAlign: 'center', letterSpacing: -0.2 },
  headerSpacer: { width: 36 },
  body: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  lead: { fontFamily: ViveFonts.regular, fontSize: 15, lineHeight: 22, color: FOREST },
  nota: { fontFamily: ViveFonts.regular, fontSize: 13, lineHeight: 19, color: MUTED, marginBottom: 8 },
  card: { gap: 12, marginTop: 12 },
  cardTitle: { fontFamily: ViveFonts.semibold, fontSize: 14.5, color: FOREST },
  btnPrimario: { backgroundColor: FOREST, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  btnPrimarioText: { fontFamily: ViveFonts.semibold, fontSize: 15, color: '#F3EEDF' },
  btnSecundario: {
    borderWidth: 1, borderColor: 'rgba(58,79,42,0.35)', borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    backgroundColor: 'rgba(255,248,240,0.55)',
  },
  btnSecundarioText: { fontFamily: ViveFonts.semibold, fontSize: 14.5, color: FOREST },
  ayuda: { fontFamily: ViveFonts.regular, fontSize: 12.5, lineHeight: 18, color: MUTED },
  separador: { height: 1, backgroundColor: 'rgba(86,94,50,0.14)', marginVertical: 10 },
  link: { fontFamily: ViveFonts.medium, fontSize: 14, color: '#B4533E', textDecorationLine: 'underline', paddingVertical: 4 },
});
