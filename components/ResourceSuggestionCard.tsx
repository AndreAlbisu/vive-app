import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { TOOL_MAP } from '@/constants/tools';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { supabase } from '@/lib/supabase';
import type { MoodEntry } from '@/hooks/useMoodHistory';

// Tarjeta "Para vos ahora" en Inicio — recomienda 2 recursos según el mood_id
// del check-in de hoy. Registra en `resource_recommendations` (nueva, ver
// scripts/create-resource-recommendations.sql, coordinada con Andre antes de
// crearse) qué par se mostró, en qué orden, y cuál tocó el usuario — para
// analizar después qué se elige más por estado de ánimo. El orden del par se
// randomiza en cada visualización a propósito, para no sesgar el análisis
// por posición.
const MOOD_RECS: Record<number, { line: string; pair: [string, string] }> = {
  1: { line: 'Venís con un bajón. Algo para aflojar un poco:', pair: ['diario', 'respiracion'] },
  2: { line: 'Estás cansado. Para recargar:', pair: ['respiracion', 'gratitud'] },
  3: { line: 'Día tranquilo. Para sumar algo bueno:', pair: ['gratitud', 'diario'] },
  4: { line: 'Venís bien. Para sostenerlo:', pair: ['gratitud', 'diario'] },
  5: { line: 'Estás brillando. Para aprovecharlo:', pair: ['gratitud', 'respiracion'] },
};
const NO_CHECKIN_LINE = 'Contanos cómo venís hoy y te sugerimos algo a tu medida.';

export function ResourceSuggestionCard({
  userId,
  todayEntry,
}: {
  userId: string | undefined;
  todayEntry: MoodEntry | undefined;
}) {
  const router = useRouter();
  const [order, setOrder] = useState<[string, string] | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const rowIdRef = useRef<string | null>(null);

  const moodId = todayEntry?.mood_id;
  const moodLabel = todayEntry?.mood_label;

  useEffect(() => {
    rowIdRef.current = null;
    setChosen(null);

    if (!userId || !moodId) { setOrder(null); return; }
    const rec = MOOD_RECS[moodId];
    if (!rec) { setOrder(null); return; }

    const pair: [string, string] = Math.random() < 0.5 ? rec.pair : [rec.pair[1], rec.pair[0]];
    setOrder(pair);

    supabase
      .from('resource_recommendations')
      .insert({
        user_id: userId,
        mood_id: moodId,
        mood_label: moodLabel,
        suggested_first: pair[0],
        suggested_second: pair[1],
      })
      .select('id')
      .single()
      .then(({ data }) => { if (data) rowIdRef.current = data.id as string; });
  }, [userId, moodId, moodLabel]);

  function handlePress(resourceId: string) {
    setChosen(resourceId);
    if (rowIdRef.current) {
      supabase.from('resource_recommendations').update({ chosen: resourceId }).eq('id', rowIdRef.current).then(() => {});
    }
    const tool = TOOL_MAP[resourceId];
    if (tool?.route) router.push(tool.route as any);
  }

  if (!userId) return null;

  const rec = moodId ? MOOD_RECS[moodId] : undefined;

  return (
    <SurfaceCard variant="subtle" backgroundColor="rgba(255,248,240,0.62)" borderRadius={18} style={s.card}>
      <View style={s.inner}>
        <Text style={s.eyebrow}>Para vos ahora</Text>
        <Text style={s.line}>{rec ? rec.line : NO_CHECKIN_LINE}</Text>
        {rec && order && (
          <View style={s.optionsRow}>
            {order.map(id => {
              const tool = TOOL_MAP[id];
              if (!tool) return null;
              return (
                <TouchableOpacity
                  key={id}
                  style={[s.option, { backgroundColor: tool.color }, chosen === id && s.optionChosen]}
                  onPress={() => handlePress(id)}
                  activeOpacity={0.85}
                >
                  <Ionicons name={tool.icon} size={20} color={ViveColors.text} />
                  <Text style={s.optionLabel}>{tool.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </SurfaceCard>
  );
}

const s = StyleSheet.create({
  card: {
    marginTop: 12,
  },
  inner: {
    padding: 16,
    gap: 10,
  },
  eyebrow: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: 'rgba(86,94,50,0.55)',
  },
  line: {
    fontFamily: ViveFonts.medium,
    fontSize: 14,
    color: ViveColors.text,
    lineHeight: 20,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  optionChosen: {
    borderColor: ViveColors.accent,
  },
  optionLabel: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: ViveColors.text,
    flexShrink: 1,
  },
});
