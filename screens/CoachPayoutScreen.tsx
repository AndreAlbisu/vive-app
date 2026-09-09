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
import { COMMISSION_INTL_FIRST, COMMISSION_INTL_RECURRING, COMMISSION_LOCAL_FIRST, COMMISSION_LOCAL_RECURRING, MP_FEE_PCT_OBSERVED } from '@/lib/pricing';
import { desglose, type Riel } from '@/lib/desglosePago';
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
  const [precioArs, setPrecioArs] = useState<number | null>(null);
  const [precioUsd, setPrecioUsd] = useState<number | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const { data: coachRow } = await supabase
        .from('coaches')
        .select('id, price_per_session, price_usd')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (!coachRow?.id) { setLoading(false); return; }
      setCoachId(coachRow.id);
      // Para el desglose de abajo. Si todavía no fijó precio se muestra el
      // ejemplo redondo, que es mejor que no mostrar nada: el punto es que
      // entienda la mecánica, y con su propio número la entiende mejor.
      setPrecioArs((coachRow.price_per_session as number | null) ?? null);
      setPrecioUsd((coachRow.price_usd as number | null) ?? null);

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
              {/* ── Hipertransparencia con el coach ──────────────────────────
                  🔴 Decisión de Andre, 08/09/2026: el coach tiene que poder ver
                  POR QUÉ cobramos lo que cobramos, y eso empieza por un número
                  que la app nunca le decía.

                  Hasta hoy esta pantalla decía "retenemos 20%" y **no mencionaba
                  la tarifa de Mercado Pago**, que en el riel local la paga él
                  (en el split, el `collector` es su cuenta). Leía 20 y recibía
                  76. El dato existía en `SCHEMA.md` y en los T&C §8.5, o sea en
                  dos lugares donde no va a entrar nunca. La comisión sin el neto
                  no es transparencia, es la mitad cómoda.

                  Por eso lo que se muestra grande es **lo que le queda**, y el
                  porcentaje de comisión es una línea del desglose, no el
                  titular. La matemática vive en `lib/desglosePago.ts`. */}
              <Text style={s.bloqueTitulo}>Qué pasa con la plata</Text>
              <Text style={s.subtitle}>
                Todo lo de acá abajo es sobre una sesión con alguien nuevo, que es cuando más
                retenemos. A partir de la segunda con esa misma persona baja, y no se reinicia
                nunca.
              </Text>

              {([
                { riel: 'mp' as Riel, titulo: 'En Argentina', precio: precioArs ?? 20000, moneda: '$', suyo: precioArs != null },
                { riel: 'paypal' as Riel, titulo: 'Del exterior', precio: precioUsd ?? 50, moneda: 'USD ', suyo: precioUsd != null },
              ]).map(({ riel, titulo, precio, moneda, suyo }) => {
                const d = desglose(precio, riel, 'primera');
                const fmt = (n: number) => `${moneda}${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
                return (
                  <View key={riel} style={s.desgloseCard}>
                    <View style={s.desgloseHead}>
                      <Text style={s.desgloseTitulo}>{titulo}</Text>
                      {!suyo && <Text style={s.desgloseEjemplo}>ejemplo</Text>}
                    </View>

                    <View style={s.desgloseFila}>
                      <Text style={s.desgloseLbl}>Paga la persona</Text>
                      <Text style={s.desgloseVal}>{fmt(d.cliente)}</Text>
                    </View>
                    {d.procesador?.loPaga === 'coach' && (
                      <View style={s.desgloseFila}>
                        <Text style={s.desgloseLbl}>Mercado Pago, por cobrar  ≈</Text>
                        <Text style={s.desgloseVal}>−{fmt(d.procesador.monto)}</Text>
                      </View>
                    )}
                    <View style={s.desgloseFila}>
                      <Text style={s.desgloseLbl}>VIVE</Text>
                      <Text style={s.desgloseVal}>−{fmt(d.vive)}</Text>
                    </View>
                    <View style={[s.desgloseFila, s.desgloseTotal]}>
                      <Text style={s.desgloseLblFuerte}>Te queda</Text>
                      <Text style={s.desgloseValFuerte}>{fmt(d.coach)}</Text>
                    </View>

                    <Text style={s.desgloseNota}>
                      {riel === 'mp'
                        ? `Lo cobrás vos, directo a tu Mercado Pago. Esa tarifa de ≈${MP_FEE_PCT_OBSERVED}% te la cobra Mercado Pago a vos, no nosotros: en este riel el que vende sos vos y le pagás a tu propio procesador, como cualquiera que cobre con MP. El número exacto depende del plazo de acreditación que tengas configurado.`
                        : 'Estas no te entran por Mercado Pago: las cobra VIVE y te las transferimos cada semana, por sesiones ya realizadas. Acá el procesador nos cobra a nosotros, así que sale de nuestra parte y a vos te llega limpio — por eso retenemos 5 puntos más que en Argentina.'}
                    </Text>
                  </View>
                );
              })}

              {/* El porqué de cada número. Es la parte que convierte el desglose
                  en transparencia: sin esto son tres restas. */}
              <View style={s.porqueCard}>
                <Text style={s.porqueTitulo}>Por qué cobramos lo que cobramos</Text>

                <Text style={s.porqueItem}>
                  <Text style={s.porqueB}>{COMMISSION_LOCAL_FIRST}% la primera sesión con cada persona. </Text>
                  Es lo que cuesta traerte a alguien que no te conocía.
                </Text>
                <Text style={s.porqueItem}>
                  <Text style={s.porqueB}>{COMMISSION_LOCAL_RECURRING}% de ahí en adelante, para siempre. </Text>
                  Cuando esa persona vuelve, ya no te la estamos presentando.{' '}
                  <Text style={s.porqueB}>Te cobramos por presentarte a alguien, no por tu relación
                  con esa persona.</Text>
                </Text>
                <Text style={s.porqueItem}>
                  <Text style={s.porqueB}>{COMMISSION_INTL_FIRST}% y {COMMISSION_INTL_RECURRING}% en el exterior. </Text>
                  Son los mismos dos tramos más 5 puntos, y esos 5 puntos no son margen: es lo que
                  cuesta cobrar afuera y transferirte, que ahí lo pagamos nosotros y en Argentina lo
                  pagás vos. Por eso, al final, te queda casi lo mismo por los dos caminos.
                </Text>
                <Text style={s.porqueItem}>
                  <Text style={s.porqueB}>Nada más. </Text>
                  No hay costo de alta, ni mensualidad, ni cargo por cancelar, ni comisión sobre lo
                  que te reembolsamos. Si una sesión se cae, no cobramos nada.
                </Text>
              </View>

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
  bloqueTitulo: { fontFamily: ViveFonts.semibold, fontSize: 16, color: '#565E32', marginBottom: 6 },
  desgloseCard: {
    backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(135,131,92,0.18)', marginBottom: 12,
  },
  desgloseHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  desgloseTitulo: { fontFamily: ViveFonts.semibold, fontSize: 14, color: '#565E32' },
  desgloseEjemplo: {
    fontFamily: ViveFonts.regular, fontSize: 10, color: 'rgba(135,131,92,0.75)',
    backgroundColor: 'rgba(135,131,92,0.10)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2,
  },
  desgloseFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  desgloseLbl: { fontFamily: ViveFonts.regular, fontSize: 13, color: 'rgba(135,131,92,0.90)' },
  desgloseVal: { fontFamily: ViveFonts.regular, fontSize: 13, color: 'rgba(135,131,92,0.90)' },
  desgloseTotal: { borderTopWidth: 1, borderTopColor: 'rgba(135,131,92,0.18)', marginTop: 6, paddingTop: 8 },
  desgloseLblFuerte: { fontFamily: ViveFonts.semibold, fontSize: 14, color: '#565E32' },
  desgloseValFuerte: { fontFamily: ViveFonts.semibold, fontSize: 16, color: '#565E32' },
  desgloseNota: {
    fontFamily: ViveFonts.regular, fontSize: 11, lineHeight: 16,
    color: 'rgba(135,131,92,0.72)', marginTop: 10,
  },
  porqueCard: { marginTop: 4, marginBottom: 8 },
  porqueTitulo: { fontFamily: ViveFonts.semibold, fontSize: 14, color: '#565E32', marginBottom: 10 },
  porqueItem: {
    fontFamily: ViveFonts.regular, fontSize: 13, lineHeight: 19,
    color: 'rgba(135,131,92,0.88)', marginBottom: 10,
  },
  porqueB: { fontFamily: ViveFonts.semibold, color: '#565E32' },
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
