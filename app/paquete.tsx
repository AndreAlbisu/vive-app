import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  StatusBar, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ViveFonts, ViveColors, ViveMoodColors } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';
import { ScaleCard } from '@/components/ScaleCard';
import { supabase, registrarEvento } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { localDayKey } from '@/lib/dates';
import {
  armarPaquete, componerTextoPaquete, fechaLegiblePaquete,
  TOPE_DIAS, type DiaDelPaquete, type Paquete,
} from '@/lib/paquete';

// ── La pantalla de armado del paquete para la sesión ─────────────────────────
//
// 🔴 PARA ANDRE — es TU propuesta (`docs/paquete-para-la-sesion.md`), y no hay
// mockup, así que el layout es una primera pasada — restyleá a gusto. Lo que
// intenté respetar al pie son tus NO NEGOCIABLES (§6):
//   · Material, no conclusión: se muestra el registro crudo, sin promedios ni
//     tendencias ni nada de "Sobre vos". El paquete lo arma `lib/paquete.ts`.
//   · Se revisa antes de mandar, SIEMPRE: acá se ve completo, se saca cualquier
//     pieza y se editan las notas; el envío final es en el chat.
//   · Va al chat como un mensaje más: NO inserta el mensaje acá. Compone el
//     texto y navega a la sala con `draft`, donde la persona lo revisa una vez
//     más y lo manda ella — reusando `doSendMessage` (encriptación fail-closed,
//     anti-fuga, chequeo de bloqueo). Cero duplicación de esa lógica.
//   · El diario NO entra y NO se ofrece (§8ter). Esta pantalla es el paso 1 del
//     §9: check-ins con fecha + nota propia. El diario (paso 3) queda afuera.
//
// 📌 El ofrecimiento proactivo (paso 2, `debeOfrecerse` en lib/paquete.ts) es
// aparte. Por ahora se llega desde la sala; ver el botón que agregué allá.

export default function PaqueteScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ sala_id?: string; coach_id?: string; coachName?: string }>();
  const salaId = Array.isArray(params.sala_id) ? params.sala_id[0] : params.sala_id;
  const coachId = Array.isArray(params.coach_id) ? params.coach_id[0] : params.coach_id;
  const coachName = (Array.isArray(params.coachName) ? params.coachName[0] : params.coachName) ?? 'tu profesional';

  const hoy = localDayKey();
  const [loading, setLoading] = useState(true);
  const [paquete, setPaquete] = useState<Paquete | null>(null);
  // Piezas sacadas por la persona (§6). dayKeys excluidos del envío.
  const [excluidos, setExcluidos] = useState<Set<string>>(new Set());
  // Texto de la nota por día, editable localmente; se persiste en mood_entries.nota.
  const [notas, setNotas] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      // Ventana amplia (TOPE_DIAS): `armarPaquete` la recorta a "desde la última
      // sesión" o al tope, lo que sea más corto.
      const desde = new Date(`${hoy}T00:00:00Z`);
      desde.setUTCDate(desde.getUTCDate() - TOPE_DIAS);
      const desdeKey = desde.toISOString().slice(0, 10);

      const [moodRes, sesionRes] = await Promise.all([
        supabase
          .from('mood_entries')
          .select('entry_date, mood_id, mood_label, nota')
          .eq('user_id', user.id)
          .gte('entry_date', desdeKey)
          .lte('entry_date', hoy),
        // La última sesión que YA ocurrió con este coach — el arranque natural de
        // la ventana. `armarPaquete` excluye el día de la sesión a propósito.
        coachId
          ? supabase
              .from('bookings')
              .select('scheduled_date')
              .eq('user_id', user.id)
              .eq('coach_id', coachId)
              .eq('status', 'completada')
              .lt('scheduled_date', hoy)
              .order('scheduled_date', { ascending: false })
              .limit(1)
          : Promise.resolve({ data: null }),
      ]);
      if (cancelled) return;

      const entries: DiaDelPaquete[] = (moodRes.data ?? []).map((r: any) => ({
        dayKey: r.entry_date as string,
        moodId: r.mood_id as number,
        moodLabel: r.mood_label as string,
        nota: (r.nota as string | null) ?? null,
      }));
      const ultimaSesion = (sesionRes.data as any)?.[0]?.scheduled_date ?? null;

      const p = armarPaquete({ ultimaSesion, hoy, entries });
      setPaquete(p);
      // Semilla de las notas ya escritas.
      const seed: Record<string, string> = {};
      p.dias.forEach(d => { if (d.nota) seed[d.dayKey] = d.nota; });
      setNotas(seed);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, coachId, hoy]);

  function toggleExcluir(dayKey: string) {
    setExcluidos(prev => {
      const next = new Set(prev);
      if (next.has(dayKey)) next.delete(dayKey); else next.add(dayKey);
      return next;
    });
  }

  // La nota se persiste al terminar de editar (la fila ya existe — es un día con
  // check-in). `.update` toca SOLO `nota`; verificado que el check-in no la pisa.
  async function guardarNota(dayKey: string) {
    if (!user) return;
    const texto = (notas[dayKey] ?? '').trim().slice(0, 280);
    await supabase
      .from('mood_entries')
      .update({ nota: texto || null })
      .eq('user_id', user.id)
      .eq('entry_date', dayKey);
  }

  const incluidos = useMemo(
    () => (paquete?.dias ?? []).filter(d => !excluidos.has(d.dayKey)),
    [paquete, excluidos],
  );

  function enviar() {
    if (!salaId || incluidos.length === 0) return;
    // Se resuelve la nota final de cada día (la edición local manda) y se
    // delega el texto a `componerTextoPaquete` — puro y testeado.
    const conNota = incluidos.map(d => ({ ...d, nota: (notas[d.dayKey] ?? '').trim() || null }));
    const texto = componerTextoPaquete(conNota);
    registrarEvento('paquete_enviado', { dias: incluidos.length, con_nota: conNota.filter(d => d.nota).length }).catch(() => {});
    // Al chat con el borrador: la persona lo revisa una vez más y lo manda ella.
    router.replace({ pathname: '/sala', params: { sala_id: salaId, draft: texto } } as any);
  }

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={s.headerBtn}>
            <Ionicons name="arrow-back" size={22} color={ViveColors.accent} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Para la sesión</Text>
          <View style={s.headerBtn} />
        </View>

        {loading ? (
          <View style={s.center}><ActivityIndicator color={ViveColors.accent} /></View>
        ) : !paquete || paquete.dias.length === 0 ? (
          <View style={s.center}>
            <Text style={s.emptyText}>
              No registraste cómo venías desde la última vez. Cuando anotes algunos
              días, vas a poder armar algo para llevar a la sesión.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.intro}>
              Esto es lo que registraste desde la última vez que se vieron. Es tuyo:
              sacá lo que no quieras y, si querés, agregá qué estaba pasando ese día.
              Después lo mandás a {coachName} por el chat.
            </Text>
            {paquete.ventanaTopeada && (
              <Text style={s.aviso}>Mostrando los últimos {TOPE_DIAS} días.</Text>
            )}

            {paquete.dias.map(d => {
              const fuera = excluidos.has(d.dayKey);
              const color = ViveMoodColors[d.moodId] ?? ViveColors.calm;
              return (
                <View key={d.dayKey} style={[s.dia, fuera && s.diaFuera]}>
                  <View style={s.diaTop}>
                    <View style={s.diaTopLeft}>
                      <View style={[s.moodDot, { backgroundColor: color }]} />
                      <Text style={s.diaFecha}>{fechaLegiblePaquete(d.dayKey)}</Text>
                      <Text style={s.diaMood}>· {d.moodLabel}</Text>
                    </View>
                    <TouchableOpacity onPress={() => toggleExcluir(d.dayKey)} hitSlop={8}>
                      <Ionicons
                        name={fuera ? 'add-circle-outline' : 'close-circle-outline'}
                        size={22}
                        color={fuera ? ViveColors.accent : 'rgba(86,94,50,0.5)'}
                      />
                    </TouchableOpacity>
                  </View>
                  {!fuera && (
                    <TextInput
                      style={s.notaInput}
                      value={notas[d.dayKey] ?? ''}
                      onChangeText={t => setNotas(prev => ({ ...prev, [d.dayKey]: t.slice(0, 280) }))}
                      onEndEditing={() => guardarNota(d.dayKey)}
                      placeholder="¿Qué estaba pasando ese día? (opcional)"
                      placeholderTextColor="rgba(86,94,50,0.45)"
                      multiline
                    />
                  )}
                </View>
              );
            })}

            <ScaleCard
              style={[s.enviar, incluidos.length === 0 && s.enviarOff]}
              onPress={enviar}
              disabled={incluidos.length === 0}
              activeOpacity={0.9}>
              <Text style={s.enviarText}>
                {incluidos.length === 0 ? 'Sacaste todo' : `Enviar a ${coachName}`}
              </Text>
            </ScaleCard>
            <Text style={s.footNote}>
              Lo vas a ver completo en el chat antes de mandarlo.
            </Text>
          </ScrollView>
        )}
      </SafeAreaView>
    </AppBg>
  );
}

const FOREST = '#3A4F2A';
const FOREST_SOFT = '#6B7A56';

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 12,
  },
  headerBtn: { width: 30, padding: 4 },
  headerTitle: { fontFamily: ViveFonts.title, fontSize: 18, color: FOREST },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyText: { fontFamily: ViveFonts.regular, fontSize: 14.5, color: FOREST_SOFT, textAlign: 'center', lineHeight: 22 },

  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  intro: { fontFamily: ViveFonts.regular, fontSize: 14, color: FOREST_SOFT, lineHeight: 21, marginBottom: 10 },
  aviso: { fontFamily: ViveFonts.medium, fontSize: 12.5, color: FOREST_SOFT, marginBottom: 14 },

  dia: {
    backgroundColor: 'rgba(255,248,240,0.55)', borderWidth: 1, borderColor: 'rgba(58,79,42,0.12)',
    borderRadius: 16, padding: 14, marginBottom: 10,
  },
  diaFuera: { opacity: 0.5 },
  diaTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  diaTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  moodDot: { width: 12, height: 12, borderRadius: 6 },
  diaFecha: { fontFamily: ViveFonts.semibold, fontSize: 14, color: FOREST },
  diaMood: { fontFamily: ViveFonts.regular, fontSize: 13, color: FOREST_SOFT },
  notaInput: {
    fontFamily: ViveFonts.regular, fontSize: 14, color: FOREST, lineHeight: 20,
    marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(58,79,42,0.14)', minHeight: 24,
  },

  enviar: {
    backgroundColor: ViveColors.primaryInk, borderRadius: 16,
    paddingVertical: 15, alignItems: 'center', marginTop: 14,
  },
  enviarOff: { backgroundColor: 'rgba(86,94,50,0.25)' },
  enviarText: { fontFamily: ViveFonts.semibold, fontSize: 15, color: ViveColors.onPrimaryInk },
  footNote: { fontFamily: ViveFonts.regular, fontSize: 12, color: FOREST_SOFT, textAlign: 'center', marginTop: 10 },
});
