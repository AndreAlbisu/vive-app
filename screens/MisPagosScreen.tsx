// Mis pagos — en qué está la plata de cada reserva (punto 3 de
// docs/investigacion-producto-2026-09-23.md).
//
// 🔴 Antes no había dónde verlo: al cancelar se prometía la devolución y
// después la persona no tenía ningún lugar donde seguirla, salvo el caso USDT
// sin dirección que avisa `SessionsScreen`. Esto lee el estado de la base cada
// vez que se abre; no guarda nada en el teléfono.
//
// `?booking=<id>` (desde la Sala) resalta esa reserva arriba de todo.
// "Escribinos" abre el mismo reporte de sesión que la Sala (`session_issues`,
// motivo "cobro" a elección de la persona): una sola bandeja para el equipo.

import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, StatusBar, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';
import { useAuth } from '@/context/AuthContext';
import SessionIssueSheet from '@/components/SessionIssueSheet';
import { estadoDelPago, listMisPagos, montoLegible, nombreProveedor, type PagoRow, type Tono } from '@/lib/pagos';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fechaSesion(d: string, t: string): string {
  const [y, m, dd] = d.split('-').map(Number);
  const anio = y === new Date().getFullYear() ? '' : ` ${y}`;
  return `${dd} ${MESES[m - 1]}${anio} · ${t.slice(0, 5)} hs`;
}

const COLOR_TONO: Record<Tono, string> = {
  ok: '#3A6B3E',
  proceso: '#8A6A3B',
  neutro: 'rgba(135,131,92,0.95)',
  atencion: '#B4533E',
};

export default function MisPagosScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { booking } = useLocalSearchParams<{ booking?: string }>();
  const resaltar = Array.isArray(booking) ? booking[0] : booking;

  const [rows, setRows] = useState<PagoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [ayudaCon, setAyudaCon] = useState<string | null>(null);

  // Cada vez que se vuelve a la pantalla: una devolución puede haber cambiado
  // de estado mientras la persona miraba otra cosa.
  useFocusEffect(useCallback(() => {
    if (!user) return;
    let vivo = true;
    listMisPagos(user.id).then(r => {
      if (!vivo) return;
      // La reserva que se pidió ver, primero.
      setRows(resaltar ? [...r.filter(x => x.id === resaltar), ...r.filter(x => x.id !== resaltar)] : r);
      setLoading(false);
    });
    return () => { vivo = false; };
  }, [user, resaltar]));

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7} hitSlop={8}>
            <MaterialIcons name="arrow-back-ios" size={18} color="#565E32" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Mis pagos</Text>
          <View style={s.headerSpacer} />
        </View>

        <FlatList
          data={rows}
          keyExtractor={r => r.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            rows.length > 0 ? (
              <Text style={s.intro}>
                El estado de cada pago y cada devolución, tal como figura en Vita. Esto no es una factura: la sesión la factura tu profesional.
              </Text>
            ) : null
          }
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator size="small" color={ViveColors.primary} style={{ marginTop: 40 }} />
            ) : (
              <View style={s.empty}>
                <MaterialIcons name="receipt-long" size={40} color="rgba(135,131,92,0.45)" />
                <Text style={s.emptyTitle}>Todavía no hay pagos</Text>
                <Text style={s.emptyText}>Cuando reserves una sesión, vas a ver acá en qué está su pago.</Text>
              </View>
            )
          }
          renderItem={({ item }) => {
            const e = estadoDelPago(item);
            return (
              <View style={[s.card, item.id === resaltar && s.cardResaltada]}>
                <View style={s.row}>
                  <Text style={s.coach} numberOfLines={1}>{item.coach_name ?? 'Sesión'}</Text>
                  <Text style={s.monto}>{montoLegible(item)}</Text>
                </View>
                <Text style={s.meta}>
                  {fechaSesion(item.scheduled_date, item.scheduled_time)} · {nombreProveedor(item.payment_provider)}
                  {item.status === 'cancelada' ? ' · sesión cancelada' : ''}
                </Text>

                <Text style={[s.estado, { color: COLOR_TONO[e.tono] }]}>{e.titulo}</Text>
                {!!e.detalle && <Text style={s.detalle}>{e.detalle}</Text>}

                <View style={s.acciones}>
                  {e.accion === 'direccion_usdt' && (
                    <TouchableOpacity
                      style={s.btnPrimario}
                      onPress={() => router.push({ pathname: '/reembolso', params: { booking_id: item.id } })}
                      activeOpacity={0.85}>
                      <Text style={s.btnPrimarioText}>Pasar mi dirección</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => setAyudaCon(item.id)} activeOpacity={0.7} hitSlop={6}>
                    <Text style={s.link}>¿Algo no está bien? Escribinos</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />

        {!!ayudaCon && (
          <SessionIssueSheet
            visible={!!ayudaCon}
            onClose={() => setAyudaCon(null)}
            bookingId={ayudaCon}
            rol="cliente"
            estadoSesion="mis_pagos"
          />
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
  list: { paddingHorizontal: 20, paddingBottom: 40, gap: 12, flexGrow: 1 },
  intro: { fontFamily: ViveFonts.regular, fontSize: 13, color: 'rgba(135,131,92,0.95)', lineHeight: 19, marginBottom: 4 },
  card: {
    backgroundColor: 'rgba(255,248,240,0.80)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    padding: 16,
    gap: 4,
  },
  cardResaltada: { borderColor: '#565E32' },
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  coach: { flex: 1, fontFamily: ViveFonts.semibold, fontSize: 15, color: '#3A4F2A' },
  monto: { fontFamily: ViveFonts.semibold, fontSize: 15, color: '#3A4F2A' },
  meta: { fontFamily: ViveFonts.regular, fontSize: 12.5, color: 'rgba(135,131,92,0.95)' },
  estado: { fontFamily: ViveFonts.semibold, fontSize: 14, marginTop: 10 },
  detalle: { fontFamily: ViveFonts.regular, fontSize: 13.5, lineHeight: 19, color: '#565E32' },
  acciones: { marginTop: 10, gap: 10, alignItems: 'flex-start' },
  btnPrimario: { backgroundColor: '#565E32', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 },
  btnPrimarioText: { fontFamily: ViveFonts.semibold, fontSize: 14, color: '#F7EFE4' },
  link: { fontFamily: ViveFonts.medium, fontSize: 13, color: '#87835C', textDecorationLine: 'underline' },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 80, paddingHorizontal: 24 },
  emptyTitle: { fontFamily: ViveFonts.semibold, fontSize: 16, color: '#565E32' },
  emptyText: { fontFamily: ViveFonts.regular, fontSize: 13.5, color: 'rgba(135,131,92,0.95)', textAlign: 'center', lineHeight: 19 },
});
