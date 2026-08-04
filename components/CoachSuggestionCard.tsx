import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { detectMoodDrop } from '@/lib/moodStats';
import type { MoodEntry } from '@/hooks/useMoodHistory';

// Sugerencia de baja fricción para hablar con un coach, cuando el check-in de
// hoy bajó fuerte respecto al anterior (ver detectMoodDrop en lib/moodStats.ts).
// Mismo lenguaje visual que moodInviteRow de app/diario.tsx — fila compacta,
// no un hero grande — a propósito, esto tiene que sentirse opcional.
//
// Destino del botón, según cuántas salas (chats con coach) ya tenga el
// usuario: ninguna → Conexiones (buscar con quién hablar); una → directo a
// esa sala (mínima fricción); más de una → Mensajes, para que elija.
// Se descartó pedir esto en index.tsx: se resuelve acá mismo, y solo al
// tocar el botón, para no sumar una query en cada carga de Inicio cuando no
// hay baja que mostrar.
export function CoachSuggestionCard({
  userId,
  entries,
}: {
  userId: string | undefined;
  entries: MoodEntry[];
}) {
  const router = useRouter();
  const drop = detectMoodDrop(entries);
  const hasDrop = !!drop;
  const [dismissed, setDismissed] = useState(true); // arranca oculta hasta chequear AsyncStorage — evita flash

  const today = new Date().toISOString().split('T')[0];
  const storageKey = userId ? `vive_coach_suggestion_dismissed_${userId}_${today}` : null;

  useEffect(() => {
    if (!hasDrop || !storageKey) { setDismissed(true); return; }
    AsyncStorage.getItem(storageKey).then(v => setDismissed(v === '1'));
  }, [hasDrop, storageKey]);

  async function handlePress() {
    if (!userId) return;
    const { data } = await supabase.from('salas').select('id').eq('user_id', userId);
    const salas = data ?? [];
    if (salas.length === 0) {
      router.push('/(tabs)/conexiones');
    } else if (salas.length === 1) {
      router.push({ pathname: '/sala', params: { sala_id: salas[0].id } });
    } else {
      router.push('/(tabs)/mis-salas');
    }
  }

  function handleDismiss() {
    setDismissed(true);
    if (storageKey) AsyncStorage.setItem(storageKey, '1');
  }

  if (!drop || dismissed) return null;

  return (
    <View style={s.row}>
      <MaterialCommunityIcons name="hand-heart-outline" size={18} color={ViveColors.primary} />
      <Text style={s.text}>Notamos que veniste bajando. ¿Querés hablar con alguien?</Text>
      <TouchableOpacity style={s.btn} onPress={handlePress} activeOpacity={0.85}>
        <Text style={s.btnText}>Hablar con alguien</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleDismiss} hitSlop={8} style={s.close}>
        <MaterialCommunityIcons name="close" size={15} color="rgba(86,94,50,0.5)" />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(193,105,79,0.10)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(193,105,79,0.20)',
    padding: 14,
    marginTop: 12,
  },
  text: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: ViveColors.text,
    lineHeight: 18,
  },
  btn: {
    backgroundColor: ViveColors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  btnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 12,
    color: '#F7EFE4',
  },
  close: {
    padding: 2,
  },
});
