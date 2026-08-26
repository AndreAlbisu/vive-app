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
import { COMMISSION_INTL_FIRST, COMMISSION_INTL_RECURRING } from '@/lib/pricing';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

import {
  walletError,
  paypalEmailError,
  type PayoutNetwork as Network,
} from '@/lib/payout';

// Los rieles por los que el coach puede aceptar cobrar sus sesiones del exterior.
// No es "elegí uno": marca los que acepta, y sus clientes ven exactamente esos.
// Es la regla espejo (D4) — cada reserva se paga por el riel por el que entró.
const RAILS: {
  id: 'paypal' | 'usdt';
  label: string;
  desc: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}[] = [
  { id: 'paypal', label: 'PayPal', desc: 'Dólares a tu cuenta de PayPal', icon: 'wallet-outline' },
  { id: 'usdt', label: 'USDT', desc: 'Stablecoin en dólares, a tu billetera', icon: 'currency-usd' },
];

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

  const [aceptaPaypal, setAceptaPaypal] = useState(false);
  const [aceptaUsdt, setAceptaUsdt] = useState(false);
  const [wallet, setWallet] = useState('');
  const [network, setNetwork] = useState<Network>('TRC20');
  const [paypalEmail, setPaypalEmail] = useState('');

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
        .select('accepts_paypal, accepts_usdt, wallet, network, paypal_email')
        .eq('coach_id', coachRow.id)
        .maybeSingle();

      if (payout) {
        setAceptaPaypal(!!payout.accepts_paypal);
        setAceptaUsdt(!!payout.accepts_usdt);
        setWallet(payout.wallet ?? '');
        setNetwork((payout.network as Network) ?? 'TRC20');
        setPaypalEmail(payout.paypal_email ?? '');
      }
      setLoading(false);
    })();
  }, [user]);

  const errorWallet = aceptaUsdt && wallet.trim().length > 0
    ? walletError(wallet, network)
    : null;

  const errorPaypal = aceptaPaypal && paypalEmail.trim().length > 0
    ? paypalEmailError(paypalEmail)
    : null;

  // Ningún riel aceptado es válido: significa "no atiendo sesiones del exterior".
  // Lo que no se puede es aceptar un riel sin decir adónde mandar la plata — la
  // base tiene el mismo CHECK, y acá está para mostrarlo mientras se escribe.
  const puedeGuardar =
    !!coachId && !saving &&
    (!aceptaPaypal || !paypalEmailError(paypalEmail)) &&
    (!aceptaUsdt || !walletError(wallet, network));

  async function guardar() {
    if (!coachId || !puedeGuardar) return;
    setSaving(true);

    // Se guardan los dos rieles y sus destinos. El destino de un riel apagado NO
    // se borra: la base ya impide aceptar un riel sin destino (CHECK), así que no
    // puede haber un envío al lugar equivocado — y conservarlo evita tener que
    // volver a tipear una wallet si se reactiva.
    // `method` es la columna vieja, la de un método único. Ya no es la fuente de
    // verdad —lo son los dos `accepts_*`— pero se sigue escribiendo por dos
    // motivos. Uno: es el valor que lee un build viejo mientras la migración ya
    // corrió y la app nueva no está en todos los teléfonos; no escribirla lo
    // dejaría mirando el método anterior, que es peor que un método incompleto.
    // Dos: hasta `fix-payout-rails-trigger.sql` la columna era NOT NULL sin
    // default, así que omitirla hacía fallar el upsert entero — y no solo en el
    // alta: Postgres valida el NOT NULL sobre la tupla propuesta ANTES de
    // resolver el `on conflict`, así que tampoco podía guardar quien ya tenía
    // fila.
    //
    // Se deriva del primer riel aceptado QUE TENGA SU DESTINO CARGADO, nunca a
    // secas: los tres CHECK viejos por método (`method <> 'x' or <destino> is
    // not null`) siguen vivos, y escribir 'usdt' sin wallet volvería a hacer
    // fallar el guardado por el otro lado. Sin rieles queda en null, que ahora
    // es un estado válido y es además el que corresponde: "no cobro del exterior".
    const method =
      aceptaPaypal && paypalEmail.trim() ? 'paypal'
      : aceptaUsdt && wallet.trim() ? 'usdt'
      : null;

    const fila = {
      coach_id: coachId,
      method,
      accepts_paypal: aceptaPaypal,
      accepts_usdt: aceptaUsdt,
      paypal_email: aceptaPaypal ? paypalEmail.trim() : (paypalEmail.trim() || null),
      wallet: aceptaUsdt ? wallet.trim() : (wallet.trim() || null),
      network: aceptaUsdt ? network : (wallet.trim() ? network : null),
    };

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
      aceptaUsdt
        ? 'El primer pago en USDT te lo vamos a mandar de prueba, por un monto chico, para confirmar juntos que la dirección y la red son correctas.'
        : 'Vamos a usar estos datos para transferirte las sesiones del exterior.',
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
                {'\n\n'}
                De cada una retenemos {COMMISSION_INTL_FIRST}% la primera vez con cada persona y{' '}
                {COMMISSION_INTL_RECURRING}% de ahí en adelante, e incluye todos los costos de
                cobrarte del exterior y transferirte.
              </Text>

              <Text style={s.label}>Cómo aceptás cobrar</Text>
              <View style={s.methodRow}>
                {RAILS.map(r => {
                  const on = r.id === 'paypal' ? aceptaPaypal : aceptaUsdt;
                  const toggle = () =>
                    r.id === 'paypal' ? setAceptaPaypal(!on) : setAceptaUsdt(!on);
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={[s.methodCard, on && s.methodCardOn]}
                      onPress={toggle}
                      activeOpacity={0.85}>
                      <View style={s.railHead}>
                        <MaterialCommunityIcons
                          name={r.icon}
                          size={22}
                          color={on ? ViveColors.primary : 'rgba(135,131,92,0.72)'}
                        />
                        <View style={s.flex}>
                          <Text style={[s.methodTitle, on && s.methodTitleOn]}>{r.label}</Text>
                          <Text style={s.methodDesc}>{r.desc}</Text>
                        </View>
                        <MaterialCommunityIcons
                          name={on ? 'checkbox-marked' : 'checkbox-blank-outline'}
                          size={22}
                          color={on ? ViveColors.primary : 'rgba(135,131,92,0.5)'}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 🔴 Lo que hay que decir sin vueltas, porque decide cuál conviene:
                  los dos pagan en DÓLARES. El que quiera pesos los convierte él.
                  En PayPal eso es vincular una cuenta y tocar retirar, al mismo
                  cambio que conseguiríamos nosotros; en USDT hay que saber vender
                  cripto. Por eso PayPal es el riel del que quiere pesos. */}
              <Text style={s.methodNote}>
                Los dos te pagan en dólares, y sin costo para vos: la comisión del envío la
                pagamos nosotros.
                {'\n\n'}
                Si querés pesos, PayPal es el más simple: los bajás a tu banco cuando quieras y
                PayPal los convierte. Con USDT vas a necesitar venderlos vos.
                {'\n\n'}
                Solo se te ofrece a clientes del exterior que puedan pagarte por alguno de los
                que marques. Si no marcás ninguno, no recibís sesiones del exterior.
              </Text>

              {aceptaPaypal && (
                <>
                  <Text style={s.label}>Mail de tu cuenta de PayPal</Text>
                  <TextInput
                    style={[s.input, errorPaypal && s.inputError]}
                    value={paypalEmail}
                    onChangeText={setPaypalEmail}
                    placeholder="tumail@ejemplo.com"
                    placeholderTextColor="rgba(135,131,92,0.45)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                  />
                  {errorPaypal && <Text style={s.errorText}>{errorPaypal}</Text>}
                  <Text style={s.hint}>
                    Tiene que ser el mail de una cuenta de PayPal tuya que pueda recibir pagos. Si
                    el mail no tiene cuenta, el envío rebota y lo reintentamos: no se pierde nada.
                  </Text>
                </>
              )}

              {aceptaUsdt && (
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

  methodRow: { flexDirection: 'column', gap: 10 },
  methodCard: {
    flex: 1, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 12,
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderWidth: 1.5, borderColor: 'transparent', gap: 4, ...shadow,
  },
  methodCardOn: { borderColor: ViveColors.primary, backgroundColor: 'rgba(255,248,240,0.85)' },
  railHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
