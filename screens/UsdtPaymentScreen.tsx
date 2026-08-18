// UsdtPaymentScreen — la pantalla de cobro en USDT.
//
// No es un checkout: no hay a dónde redirigir. Le mostramos a la persona una
// dirección y un MONTO EXACTO, y ella paga desde su billetera o su exchange.
// El monto no es redondo a propósito — los últimos decimales son lo que después
// permite reconocer la transferencia y acreditarla (ver _shared/usdt.ts). Por
// eso la pantalla insiste en que se mande el monto exacto: redondearlo deja el
// pago sin poder asociarse a la reserva.
//
// La confirmación llega sola: `usdt-check-payments` corre por cron, ve la
// transferencia y marca la reserva. Acá solo sondeamos el estado.

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView,
  ActivityIndicator, StatusBar, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ViveColors, ViveFonts } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';
import { supabase } from '@/lib/supabase';

export default function UsdtPaymentScreen() {
  const router = useRouter();
  const { booking_id } = useLocalSearchParams<{ booking_id?: string }>();

  const [loading, setLoading] = useState(true);
  const [cobro, setCobro] = useState<{ address: string; amount: number; network: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acreditado, setAcreditado] = useState(false);
  const sondeo = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!booking_id) { setError('Falta la reserva'); setLoading(false); return; }
    (async () => {
      const { data, error: err } = await supabase.functions.invoke('usdt-create-payment', {
        body: { booking_id },
      });
      setLoading(false);
      if (err || !data?.address) {
        setError(data?.error ?? 'No se pudo preparar el pago');
        return;
      }
      setCobro(data);
    })();
  }, [booking_id]);

  // Sondeo del estado. El cron tarda hasta un minuto, así que esto corre hasta
  // que la persona se va — sin timeout: irse de la pantalla no cancela el pago,
  // y volver la reencuentra acreditada.
  useEffect(() => {
    if (!cobro || !booking_id || acreditado) return;
    sondeo.current = setInterval(async () => {
      const { data } = await supabase
        .from('bookings')
        .select('payment_status')
        .eq('id', booking_id)
        .maybeSingle();
      if (data?.payment_status === 'aprobado') {
        setAcreditado(true);
        if (sondeo.current) clearInterval(sondeo.current);
      }
    }, 8000);
    return () => { if (sondeo.current) clearInterval(sondeo.current); };
  }, [cobro, booking_id, acreditado]);

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="arrow-back-ios" size={18} color="#565E32" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Pagar con USDT</Text>
          <View style={s.headerSpacer} />
        </View>

        {loading ? (
          <View style={s.centro}><ActivityIndicator size="large" color={ViveColors.primary} /></View>
        ) : error ? (
          <View style={s.centro}><Text style={s.errorText}>{error}</Text></View>
        ) : acreditado ? (
          <View style={s.centro}>
            <MaterialCommunityIcons name="check-circle-outline" size={56} color={ViveColors.accent} />
            <Text style={s.okTitle}>Pago recibido</Text>
            <Text style={s.okDesc}>Tu sesión quedó confirmada.</Text>
            <TouchableOpacity style={s.btn} onPress={() => router.replace('/(tabs)')} activeOpacity={0.85}>
              <Text style={s.btnText}>Listo</Text>
            </TouchableOpacity>
          </View>
        ) : cobro ? (
          <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
            <Text style={s.label}>Mandá exactamente</Text>
            {/* 2 decimales, que es lo máximo que las billeteras dejan tipear
                (verificado en Belo). El identificador son los centavos. */}
            <Text style={s.monto} selectable>{cobro.amount.toFixed(2)} USDT</Text>
            {/* La razón de los decimales raros, dicha antes de que pregunte. */}
            <Text style={s.montoNota}>
              Los centavos identifican tu reserva. Si redondeás el monto, no vamos a poder
              reconocer el pago.
            </Text>

            <Text style={s.label}>Red</Text>
            <View style={s.redCard}>
              <MaterialCommunityIcons name="alert-outline" size={18} color="#8C4A31" />
              <Text style={s.redText}>
                <Text style={s.redStrong}>{cobro.network}</Text> (Tron). Si mandás por otra red, los
                fondos se pierden y no se pueden recuperar.
              </Text>
            </View>

            <Text style={s.label}>A esta dirección</Text>
            {/* 🔴 SIN espacios ni separadores. Se mostraba en bloques de 6 para
                que fuera legible, pero `selectable` copia el texto tal cual se
                renderiza: se copiaba "TQ4T99 n1StNF ..." y ninguna billetera
                acepta una dirección con espacios. La legibilidad no puede costar
                que la dirección sea impegable. */}
            <Text style={s.dir} selectable>{cobro.address}</Text>
            <Text style={s.hint}>
              Mantené presionado para copiar. Verificá que empiece en{' '}
              <Text style={s.hintStrong}>{cobro.address.slice(0, 6)}</Text> y termine en{' '}
              <Text style={s.hintStrong}>{cobro.address.slice(-6)}</Text>.
            </Text>

            <View style={s.esperando}>
              <ActivityIndicator size="small" color={ViveColors.primary} />
              <Text style={s.esperandoText}>
                Esperando el pago. Se confirma solo, en un minuto o menos. Podés cerrar esta pantalla.
              </Text>
            </View>
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,248,240,0.62)', alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: 'rgba(0,0,0,0.5)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  headerTitle: { flex: 1, fontFamily: ViveFonts.semibold, fontSize: 18, color: '#565E32', textAlign: 'center' },
  headerSpacer: { width: 36 },

  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  errorText: { fontFamily: ViveFonts.regular, fontSize: 14, color: '#B5533A', textAlign: 'center' },
  okTitle: { fontFamily: ViveFonts.semibold, fontSize: 20, color: '#565E32', marginTop: 8 },
  okDesc: { fontFamily: ViveFonts.regular, fontSize: 14, color: 'rgba(135,131,92,0.80)' },

  content: { paddingHorizontal: 20, paddingBottom: 48 },
  label: { fontFamily: ViveFonts.semibold, fontSize: 13, color: '#565E32', marginTop: 22, marginBottom: 8 },
  monto: { fontFamily: ViveFonts.semibold, fontSize: 30, color: '#565E32', letterSpacing: -0.5 },
  montoNota: { fontFamily: ViveFonts.regular, fontSize: 12, lineHeight: 17, color: 'rgba(135,131,92,0.78)', marginTop: 6 },

  redCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: 'rgba(214,150,120,0.16)', borderRadius: 14, padding: 14,
  },
  redText: { flex: 1, fontFamily: ViveFonts.regular, fontSize: 12.5, lineHeight: 18, color: '#8C4A31' },
  redStrong: { fontFamily: ViveFonts.semibold },

  dir: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 15, lineHeight: 24, color: '#565E32',
    backgroundColor: 'rgba(255,248,240,0.72)', borderRadius: 14, padding: 14,
  },
  hint: { fontFamily: ViveFonts.regular, fontSize: 12, lineHeight: 17, color: 'rgba(135,131,92,0.72)', marginTop: 8 },
  hintStrong: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#565E32' },

  esperando: {
    flexDirection: 'row', gap: 10, alignItems: 'center',
    marginTop: 28, backgroundColor: 'rgba(255,248,240,0.55)', borderRadius: 14, padding: 14,
  },
  esperandoText: { flex: 1, fontFamily: ViveFonts.regular, fontSize: 12.5, lineHeight: 18, color: 'rgba(135,131,92,0.85)' },

  btn: { marginTop: 18, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 42, backgroundColor: ViveColors.primary },
  btnText: { fontFamily: ViveFonts.semibold, fontSize: 15, color: '#FFF8F0' },
});
