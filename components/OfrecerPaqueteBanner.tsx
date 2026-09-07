import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ViveFonts, ViveColors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { localDayKey } from '@/lib/dates';
import { debeOfrecerse, TOPE_DIAS } from '@/lib/paquete';
import { yaSeDescarto, marcarDescartado } from '@/lib/paqueteOfrecimiento';

// El ofrecimiento del paquete antes de la sesión (paso 2 del §9).
//
// 🔴 PARA ANDRE — es TU feature; el copy y el lugar son primera pasada, restyleá.
// Respeta los no-negociables del §6:
//   · Lo inicia la persona: esto solo OFRECE, y solo cuando corresponde
//     (`debeOfrecerse`: hay sesión próxima ≤3 días, hay registro, no se ofreció).
//   · Se ofrece una vez y se descarta (`yaSeOfrecio`/`marcarOfrecido`, por sesión).
//   · Sin material no molesta (chequea que haya check-ins en la ventana).
//
// Autocontenido: decide solo si mostrarse. Se pone en la sala del cliente con su
// coach; ver el gate `recipientIsCoach` donde se lo monta.

function cuandoTexto(dayKey: string): string {
  const hoy = localDayKey();
  if (dayKey === hoy) return 'hoy';
  // Mañana
  const m = new Date(`${hoy}T00:00:00Z`);
  m.setUTCDate(m.getUTCDate() + 1);
  if (dayKey === m.toISOString().slice(0, 10)) return 'mañana';
  const dias = ['el domingo', 'el lunes', 'el martes', 'el miércoles', 'el jueves', 'el viernes', 'el sábado'];
  const [y, mo, d] = dayKey.split('-').map(Number);
  return dias[new Date(y, mo - 1, d).getDay()];
}

export function OfrecerPaqueteBanner({
  salaId, coachId, coachName, proximaSesion, bookingId,
}: {
  salaId: string;
  coachId?: string;
  coachName: string;
  proximaSesion: string;
  bookingId: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const hoy = localDayKey();
      const desde = new Date(`${hoy}T00:00:00Z`);
      desde.setUTCDate(desde.getUTCDate() - TOPE_DIAS);
      const desdeKey = desde.toISOString().slice(0, 10);

      const [countRes, descartado] = await Promise.all([
        supabase
          .from('mood_entries')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('entry_date', desdeKey),
        yaSeDescarto(bookingId),
      ]);
      if (cancelled) return;

      // `debeOfrecerse` corta si ya se "ofreció"; le pasamos el DESCARTE, que es
      // lo único que debe callarlo (aceptar no lo consume — ver el lib).
      setMostrar(debeOfrecerse({
        proximaSesion,
        hoy,
        yaSeOfrecio: descartado,
        diasConRegistro: countRes.count ?? 0,
      }));
    })();
    return () => { cancelled = true; };
  }, [user, proximaSesion, bookingId]);

  if (!mostrar) return null;

  function abrir() {
    // NO se marca: aceptar abre la pantalla y el banner sigue disponible para
    // reentrar si la persona vuelve sin mandar. Se queda visible detrás.
    router.push({ pathname: '/paquete', params: { sala_id: salaId, coach_id: coachId ?? '', coachName } } as any);
  }

  function descartar() {
    void marcarDescartado(bookingId);
    setMostrar(false);
  }

  return (
    <View style={s.banner}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.titulo}>Tenés sesión {cuandoTexto(proximaSesion)}</Text>
        <Text style={s.sub} numberOfLines={2}>¿Querés armar algo para llevarle a {coachName}?</Text>
      </View>
      <TouchableOpacity onPress={abrir} style={s.armarBtn} activeOpacity={0.85}>
        <Text style={s.armarText}>Armar</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={descartar} hitSlop={10} style={s.cerrar}>
        <Ionicons name="close" size={18} color="rgba(86,94,50,0.55)" />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,248,240,0.7)', borderWidth: 1, borderColor: 'rgba(58,79,42,0.14)',
    borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14,
    marginHorizontal: 16, marginTop: 10,
  },
  titulo: { fontFamily: ViveFonts.semibold, fontSize: 14, color: '#3A4F2A' },
  sub: { fontFamily: ViveFonts.regular, fontSize: 12.5, color: '#6B7A56', marginTop: 2 },
  armarBtn: {
    backgroundColor: ViveColors.primaryInk, borderRadius: 12,
    paddingVertical: 8, paddingHorizontal: 14,
  },
  armarText: { fontFamily: ViveFonts.semibold, fontSize: 13, color: ViveColors.onPrimaryInk },
  cerrar: { padding: 2 },
});
