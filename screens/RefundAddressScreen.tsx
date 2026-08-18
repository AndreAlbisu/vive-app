// RefundAddressScreen — dónde la persona nos dice a qué dirección devolverle.
//
// 🔴 POR QUÉ NO REUSAMOS LA DIRECCIÓN DEL PAGO. Si pagó desde un exchange
// (Binance, Belo), la dirección que figura como origen es una wallet caliente
// del exchange, compartida por miles de usuarios: un depósito inesperado ahí no
// se le acredita a ella. Devolver a esa dirección es perder la plata. Tiene que
// darnos una dirección suya, y por eso se le pregunta.

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Platform,
  ScrollView, ActivityIndicator, StatusBar, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ViveColors, ViveFonts } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';
import { supabase } from '@/lib/supabase';
import { walletError, type PayoutNetwork } from '@/lib/payout';

const NETWORKS: { id: PayoutNetwork; label: string }[] = [
  { id: 'TRC20', label: 'TRC20 (Tron)' },
  { id: 'ERC20', label: 'ERC20 (Ethereum)' },
  { id: 'POLYGON', label: 'Polygon' },
];

export default function RefundAddressScreen() {
  const router = useRouter();
  const { booking_id } = useLocalSearchParams<{ booking_id?: string }>();

  const [loading, setLoading] = useState(true);
  const [monto, setMonto] = useState<number | null>(null);
  const [yaCargada, setYaCargada] = useState(false);
  const [wallet, setWallet] = useState('');
  const [network, setNetwork] = useState<PayoutNetwork>('TRC20');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!booking_id) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from('bookings')
        .select('usdt_amount, refund_address, refund_network, payment_status')
        .eq('id', booking_id)
        .maybeSingle();
      if (data) {
        setMonto(data.usdt_amount != null ? Number(data.usdt_amount) : null);
        if (data.refund_address) {
          setWallet(data.refund_address);
          setNetwork((data.refund_network as PayoutNetwork) ?? 'TRC20');
          setYaCargada(true);
        }
      }
      setLoading(false);
    })();
  }, [booking_id]);

  const error = wallet.trim() ? walletError(wallet, network) : null;
  const puedeGuardar = !!booking_id && !saving && !walletError(wallet, network);

  async function guardar() {
    if (!puedeGuardar) return;
    setSaving(true);
    const { data, error: err } = await supabase
      .from('bookings')
      .update({ refund_address: wallet.trim(), refund_network: network })
      .eq('id', booking_id)
      .select('id');
    setSaving(false);

    // Postgrest devuelve 0 filas sin error cuando RLS bloquea.
    if (err || !data || data.length === 0) {
      Alert.alert('No se pudo guardar', err?.message ?? 'Probá de nuevo en unos minutos');
      return;
    }
    Alert.alert(
      'Listo',
      'Te vamos a devolver el dinero a esa dirección. Si algo no cierra, te escribimos por acá.',
      [{ text: 'Entendido', onPress: () => router.back() }],
    );
  }

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
          <Text style={s.headerTitle}>Tu devolución</Text>
          <View style={s.headerSpacer} />
        </View>

        {loading ? (
          <View style={s.centro}><ActivityIndicator size="large" color={ViveColors.primary} /></View>
        ) : (
          <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
            <Text style={s.subtitle}>
              {monto != null
                ? `Te tenemos que devolver ${monto.toFixed(2)} USDT. Decinos a qué dirección mandártelos.`
                : 'Decinos a qué dirección querés recibir tu devolución.'}
            </Text>

            {/* La explicación va antes del campo, no después: si la lee cuando
                ya pegó la dirección del exchange, no la va a cambiar. */}
            <View style={s.warnCard}>
              <MaterialCommunityIcons name="information-outline" size={18} color="#8C4A31" />
              <Text style={s.warnText}>
                Tiene que ser una dirección <Text style={s.warnStrong}>tuya</Text>, de tu billetera.
                Si nos pasás la de un exchange desde el que pagaste, el depósito no se te acredita y
                el dinero se pierde.
              </Text>
            </View>

            <Text style={s.label}>Red</Text>
            {NETWORKS.map(n => (
              <TouchableOpacity
                key={n.id}
                style={[s.netRow, network === n.id && s.netRowOn]}
                onPress={() => setNetwork(n.id)}
                activeOpacity={0.85}>
                <MaterialCommunityIcons
                  name={network === n.id ? 'radiobox-marked' : 'radiobox-blank'}
                  size={20}
                  color={network === n.id ? ViveColors.primary : 'rgba(135,131,92,0.5)'}
                />
                <Text style={[s.netLabel, network === n.id && s.netLabelOn]}>{n.label}</Text>
              </TouchableOpacity>
            ))}

            <Text style={s.label}>Tu dirección</Text>
            <TextInput
              style={[s.input, error && s.inputError]}
              value={wallet}
              onChangeText={setWallet}
              placeholder={network === 'TRC20' ? 'T…' : '0x…'}
              placeholderTextColor="rgba(135,131,92,0.45)"
              autoCapitalize="none"
              autoCorrect={false}
              multiline
            />
            {error && <Text style={s.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[s.btn, !puedeGuardar && s.btnOff]}
              onPress={guardar}
              disabled={!puedeGuardar}
              activeOpacity={0.85}>
              {saving
                ? <ActivityIndicator size="small" color="#FFF8F0" />
                : <Text style={s.btnText}>{yaCargada ? 'Actualizar dirección' : 'Guardar'}</Text>}
            </TouchableOpacity>
          </ScrollView>
        )}
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
  },
  headerTitle: { flex: 1, fontFamily: ViveFonts.semibold, fontSize: 18, color: '#565E32', textAlign: 'center' },
  headerSpacer: { width: 36 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  content: { paddingHorizontal: 20, paddingBottom: 48 },
  subtitle: { fontFamily: ViveFonts.regular, fontSize: 14, lineHeight: 21, color: '#565E32', marginBottom: 16 },
  label: { fontFamily: ViveFonts.semibold, fontSize: 13, color: '#565E32', marginTop: 20, marginBottom: 8 },

  warnCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: 'rgba(214,150,120,0.16)', borderRadius: 14, padding: 14,
  },
  warnText: { flex: 1, fontFamily: ViveFonts.regular, fontSize: 12.5, lineHeight: 18, color: '#8C4A31' },
  warnStrong: { fontFamily: ViveFonts.semibold },

  netRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,248,240,0.55)', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  netRowOn: { borderColor: ViveColors.primary, backgroundColor: 'rgba(255,248,240,0.85)' },
  netLabel: { fontFamily: ViveFonts.semibold, fontSize: 14, color: 'rgba(135,131,92,0.85)' },
  netLabelOn: { color: '#565E32' },

  input: {
    backgroundColor: 'rgba(255,248,240,0.62)', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 13, minHeight: 64, textAlignVertical: 'top',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13, color: '#565E32',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  inputError: { borderColor: '#B5533A' },
  errorText: { fontFamily: ViveFonts.regular, fontSize: 12, color: '#B5533A', marginTop: 6 },

  btn: { marginTop: 28, borderRadius: 16, paddingVertical: 15, backgroundColor: ViveColors.primary, alignItems: 'center' },
  btnOff: { opacity: 0.4 },
  btnText: { fontFamily: ViveFonts.semibold, fontSize: 15, color: '#FFF8F0' },
});
