// CoachPayoutScreen — dónde el coach carga cómo quiere que le paguemos las
// sesiones internacionales.
//
// Existe solo para el rail del exterior: en las sesiones de Argentina la plata
// va directa a su Mercado Pago y VIVE no transfiere nada. Acá el dinero lo
// cobra VIVE y se lo gira al coach, así que necesitamos su destino.
//
// ⚠️ Los datos NO viven en `coaches`: esa tabla se lee con la anon key sin
// sesión, así que un CBU ahí sería público. Van en `coach_payout_accounts`,
// con RLS de dueño (ver scripts/add-coach-international.sql).

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ViveColors, ViveFonts } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

import {
  cbuError,
  normalizarCbu,
  walletError,
  USDT_NETWORK_FEE_USD,
  type PayoutMethod as Method,
  type PayoutNetwork as Network,
} from '@/lib/payout';

const NETWORKS: { id: Network; label: string; hint: string }[] = [
  { id: 'TRC20',   label: 'TRC20',   hint: 'Tron · la más usada para USDT' },
  { id: 'ERC20',   label: 'ERC20',   hint: 'Ethereum · comisiones más altas' },
  { id: 'POLYGON', label: 'Polygon', hint: 'Comisiones bajas' },
];

export default function CoachPayoutScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [coachId, setCoachId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [method, setMethod] = useState<Method>('transferencia');
  const [cbu, setCbu] = useState('');
  const [alias, setAlias] = useState('');
  const [wallet, setWallet] = useState('');
  const [network, setNetwork] = useState<Network>('TRC20');

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const { data: coachRow } = await supabase
        .from('coaches')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (!coachRow?.id) { setLoading(false); return; }
      setCoachId(coachRow.id);

      const { data: payout } = await supabase
        .from('coach_payout_accounts')
        .select('method, cbu, alias, wallet, network')
        .eq('coach_id', coachRow.id)
        .maybeSingle();

      if (payout) {
        setMethod((payout.method as Method) ?? 'transferencia');
        setCbu(payout.cbu ?? '');
        setAlias(payout.alias ?? '');
        setWallet(payout.wallet ?? '');
        setNetwork((payout.network as Network) ?? 'TRC20');
      }
      setLoading(false);
    })();
  }, [user]);

  const cbuLimpio = normalizarCbu(cbu);
  const errorCbu = method === 'transferencia' && cbuLimpio.length > 0 ? cbuError(cbu) : null;
  const errorWallet = method === 'usdt' && wallet.trim().length > 0
    ? walletError(wallet, network)
    : null;

  const puedeGuardar =
    !!coachId && !saving &&
    (method === 'transferencia'
      ? !cbuError(cbu)
      : !walletError(wallet, network));

  async function guardar() {
    if (!coachId || !puedeGuardar) return;
    setSaving(true);

    // Se limpian los campos del otro método: si alguien cargó CBU, cambió a
    // USDT y guardó, dejar el CBU viejo dando vueltas invita a transferir al
    // destino equivocado cuando alguien mire la fila sin mirar `method`.
    // Tipado explícito y no inferido: con el ternario, TS infiere una unión de
    // dos formas distintas y `upsert` la rechaza por exceso de propiedades.
    const fila: {
      coach_id: string;
      method: Method;
      cbu: string | null;
      alias: string | null;
      wallet: string | null;
      network: Network | null;
    } = method === 'transferencia'
      ? { coach_id: coachId, method, cbu: cbuLimpio, alias: alias.trim() || null, wallet: null, network: null }
      : { coach_id: coachId, method, cbu: null, alias: null, wallet: wallet.trim(), network };

    const { data, error } = await supabase
      .from('coach_payout_accounts')
      .upsert(fila, { onConflict: 'coach_id' })
      .select('coach_id');
    setSaving(false);

    // Postgrest devuelve 0 filas sin error cuando RLS bloquea — mismo criterio
    // que el resto de las pantallas del coach.
    if (error || !data || data.length === 0) {
      Alert.alert('No se pudo guardar', error?.message ?? 'Probá de nuevo en unos minutos');
      return;
    }

    Alert.alert(
      'Datos guardados',
      method === 'usdt'
        ? 'El primer pago te lo vamos a mandar de prueba, por un monto chico, para confirmar juntos que la dirección y la red son correctas.'
        : 'Vamos a usar estos datos para transferirte las sesiones internacionales.',
      [{ text: 'Listo', onPress: () => router.back() }],
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
          <Text style={s.headerTitle}>Cómo te pagamos</Text>
          <View style={s.headerSpacer} />
        </View>

        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color={ViveColors.primary} />
          </View>
        ) : !coachId ? (
          <View style={s.loadingWrap}>
            <Text style={s.emptyText}>Todavía no completaste tu perfil de profesional</Text>
          </View>
        ) : (
          <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
              <Text style={s.subtitle}>
                Solo para las sesiones con personas fuera de Argentina. Esas no te entran por Mercado
                Pago: las cobra VIVE y te las transferimos cada semana, por sesiones ya realizadas.
              </Text>

              <Text style={s.label}>Cómo preferís cobrar</Text>
              <View style={s.methodRow}>
                {(['transferencia', 'usdt'] as Method[]).map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[s.methodCard, method === m && s.methodCardOn]}
                    onPress={() => setMethod(m)}
                    activeOpacity={0.85}>
                    <MaterialCommunityIcons
                      name={m === 'transferencia' ? 'bank-outline' : 'currency-usd'}
                      size={22}
                      color={method === m ? ViveColors.primary : 'rgba(135,131,92,0.72)'}
                    />
                    <Text style={[s.methodTitle, method === m && s.methodTitleOn]}>
                      {m === 'transferencia' ? 'Transferencia' : 'USDT'}
                    </Text>
                    <Text style={s.methodDesc}>
                      {m === 'transferencia'
                        ? 'A tu cuenta en pesos · sin costo'
                        : `Stablecoin en dólares · USD ${USDT_NETWORK_FEE_USD.toFixed(2)} por envío`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* El costo se dice ANTES de elegir y no cuando llega menos plata.
                  Es una vez por transferencia y no por sesión, así que pesa
                  según cuántas sesiones hiciste en la semana — eso es lo que
                  hay que entender, no el número suelto. */}
              {method === 'usdt' && (
                <Text style={s.methodNote}>
                  Enviar USDT tiene un costo de red de USD {USDT_NETWORK_FEE_USD.toFixed(2)} que se
                  descuenta de tu pago. Es por transferencia y no por sesión: si esa semana
                  hiciste cuatro sesiones, se descuenta una sola vez. Con transferencia
                  bancaria no hay costo.
                </Text>
              )}

              {method === 'transferencia' ? (
                <>
                  <Text style={s.label}>CBU</Text>
                  <TextInput
                    style={[s.input, errorCbu && s.inputError]}
                    value={cbu}
                    onChangeText={setCbu}
                    placeholder="22 dígitos"
                    placeholderTextColor="rgba(135,131,92,0.45)"
                    keyboardType="number-pad"
                    maxLength={26}
                  />
                  {errorCbu && <Text style={s.errorText}>{errorCbu}</Text>}

                  <Text style={s.label}>Alias (opcional)</Text>
                  <TextInput
                    style={s.input}
                    value={alias}
                    onChangeText={setAlias}
                    placeholder="mi.alias.banco"
                    placeholderTextColor="rgba(135,131,92,0.45)"
                    autoCapitalize="none"
                  />
                  <Text style={s.hint}>
                    La cuenta tiene que estar a tu nombre. No transferimos a cuentas de terceros.
                  </Text>
                </>
              ) : (
                <>
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
                      <View style={s.flex}>
                        <Text style={[s.netLabel, network === n.id && s.netLabelOn]}>{n.label}</Text>
                        <Text style={s.netHint}>{n.hint}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}

                  <Text style={s.label}>Tu dirección de USDT</Text>
                  <TextInput
                    style={[s.input, s.inputMono, errorWallet && s.inputError]}
                    value={wallet}
                    onChangeText={setWallet}
                    placeholder={network === 'TRC20' ? 'T…' : '0x…'}
                    placeholderTextColor="rgba(135,131,92,0.45)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline
                  />
                  {errorWallet && <Text style={s.errorText}>{errorWallet}</Text>}

                  {/* La advertencia más importante de la pantalla. Un CBU mal
                      cargado rebota; una dirección enviada por la red
                      equivocada se pierde y no hay a quién reclamarle. */}
                  <View style={s.warnCard}>
                    <MaterialCommunityIcons name="alert-outline" size={18} color="#8C4A31" />
                    <Text style={s.warnText}>
                      Copiá la dirección desde tu billetera, no la escribas a mano, y asegurate de que
                      sea de la red que elegiste arriba. Un envío a la red equivocada{' '}
                      <Text style={s.warnStrong}>se pierde y no se puede recuperar</Text>.
                      {'\n\n'}
                      El primer pago te lo mandamos de prueba, por un monto chico, y esperamos que nos
                      confirmes que llegó antes de girarte el resto.
                    </Text>
                  </View>
                </>
              )}

              <TouchableOpacity
                style={[s.saveBtn, !puedeGuardar && s.saveBtnOff]}
                onPress={guardar}
                disabled={!puedeGuardar}
                activeOpacity={0.85}>
                {saving
                  ? <ActivityIndicator size="small" color="#FFF8F0" />
                  : <Text style={s.saveBtnText}>Guardar</Text>}
              </TouchableOpacity>

              <Text style={s.fiscalNote}>
                Cobrar por acá no cambia nada de tu situación fiscal: seguís facturando normalmente,
                pero a VIVE en vez de a la persona.
              </Text>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </AppBg>
  );
}

const shadow = Platform.select({
  ios: { shadowColor: 'rgba(0,0,0,0.5)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.10, shadowRadius: 4 },
  android: { elevation: 1 },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,248,240,0.62)',
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: 'rgba(0,0,0,0.5)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  headerTitle: {
    flex: 1, fontFamily: ViveFonts.semibold, fontSize: 18,
    color: '#565E32', textAlign: 'center', letterSpacing: -0.2,
  },
  headerSpacer: { width: 36 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyText: {
    fontFamily: ViveFonts.regular, fontSize: 14,
    color: 'rgba(135,131,92,0.80)', textAlign: 'center',
  },

  content: { paddingHorizontal: 20, paddingBottom: 48 },
  subtitle: {
    fontFamily: ViveFonts.regular, fontSize: 13, lineHeight: 19,
    color: 'rgba(135,131,92,0.80)', marginBottom: 22,
  },
  label: {
    fontFamily: ViveFonts.semibold, fontSize: 13,
    color: '#565E32', marginBottom: 8, marginTop: 18,
  },

  methodRow: { flexDirection: 'row', gap: 10 },
  methodCard: {
    flex: 1, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 12,
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderWidth: 1.5, borderColor: 'transparent', gap: 4, ...shadow,
  },
  methodCardOn: { borderColor: ViveColors.primary, backgroundColor: 'rgba(255,248,240,0.85)' },
  methodTitle: { fontFamily: ViveFonts.semibold, fontSize: 14, color: 'rgba(135,131,92,0.85)' },
  methodTitleOn: { color: '#565E32' },
  methodDesc: { fontFamily: ViveFonts.regular, fontSize: 11.5, color: 'rgba(135,131,92,0.70)' },
  methodNote: {
    fontFamily: ViveFonts.regular, fontSize: 12.5, color: '#87835C',
    lineHeight: 18, marginTop: 12,
  },

  input: {
    backgroundColor: 'rgba(255,248,240,0.62)', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 13,
    fontFamily: ViveFonts.regular, fontSize: 15, color: '#565E32',
    borderWidth: 1.5, borderColor: 'transparent', ...shadow,
  },
  inputMono: { fontSize: 13, minHeight: 64, textAlignVertical: 'top' },
  inputError: { borderColor: '#B5533A' },
  errorText: {
    fontFamily: ViveFonts.regular, fontSize: 12,
    color: '#B5533A', marginTop: 6,
  },
  hint: {
    fontFamily: ViveFonts.regular, fontSize: 12, lineHeight: 17,
    color: 'rgba(135,131,92,0.72)', marginTop: 10,
  },

  netRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,248,240,0.55)', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
    borderWidth: 1.5, borderColor: 'transparent', ...shadow,
  },
  netRowOn: { borderColor: ViveColors.primary, backgroundColor: 'rgba(255,248,240,0.85)' },
  netLabel: { fontFamily: ViveFonts.semibold, fontSize: 14, color: 'rgba(135,131,92,0.85)' },
  netLabelOn: { color: '#565E32' },
  netHint: { fontFamily: ViveFonts.regular, fontSize: 11.5, color: 'rgba(135,131,92,0.70)' },

  warnCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: 'rgba(214,150,120,0.16)', borderRadius: 14,
    padding: 14, marginTop: 14,
  },
  warnText: {
    flex: 1, fontFamily: ViveFonts.regular, fontSize: 12.5,
    lineHeight: 18, color: '#8C4A31',
  },
  warnStrong: { fontFamily: ViveFonts.semibold },

  saveBtn: {
    marginTop: 28, borderRadius: 16, paddingVertical: 15,
    backgroundColor: ViveColors.primary, alignItems: 'center',
  },
  saveBtnOff: { opacity: 0.4 },
  saveBtnText: { fontFamily: ViveFonts.semibold, fontSize: 15, color: '#FFF8F0' },

  fiscalNote: {
    fontFamily: ViveFonts.regular, fontSize: 12, lineHeight: 17,
    color: 'rgba(135,131,92,0.72)', marginTop: 16, textAlign: 'center',
  },
});
