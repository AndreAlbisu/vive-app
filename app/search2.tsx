import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ViveColors, ViveFonts } from '@/constants/theme';
import { AXES } from '@/constants/searchData';

const shadow = Platform.select({
  ios:     { shadowColor: ViveColors.text, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6 },
  android: { elevation: 2 },
});

// mismo bug que en search1.tsx: el restyle "oliva + crema + glass" (ffd928e4)
// puso #565E32 (= ViveColors.text) como fondo del chip, dejando el texto
// invisible sobre su propio fondo en el estado no seleccionado
const GLASS = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';

export default function SearchScreen2() {
  const router = useRouter();
  const { axisId } = useLocalSearchParams<{ axisId: string }>();
  const [selected, setSelected] = useState<string | null>(null);

  const axis = AXES.find(a => a.id === axisId) ?? AXES[0];

  function handleVerProfesionales() {
    if (!selected) return;
    router.push({ pathname: '/search3', params: { topic: selected, axisId: axis.id } });
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name="arrow-back" size={22} color={ViveColors.text} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.emoji}>{axis.emoji}</Text>
          <Text style={s.headerTitle} numberOfLines={1}>{axis.label}</Text>
        </View>
        <View style={s.backBtn} />
      </View>

      <Text style={s.prompt}>¿Con qué querés trabajar?</Text>

      {/* ── Chips por grupo ─────────────────────────────────────────── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}>

        {axis.groups.map((group, gi) => (
          <View key={gi} style={s.groupBlock}>
            {group.group !== '' && (
              <Text style={s.groupLabel}>{group.group}</Text>
            )}
            <View style={s.chipsRow}>
              {group.items.map(topic => {
                const active = selected === topic;
                return (
                  <TouchableOpacity
                    key={topic}
                    style={[
                      s.chip,
                      active && s.chipActive,
                      !active && { borderColor: `${axis.color}55` },
                    ]}
                    onPress={() => setSelected(active ? null : topic)}
                    activeOpacity={0.75}>
                    <Text style={[s.chipText, active && s.chipTextActive]}>
                      {topic}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ── Botón Ver profesionales ──────────────────────────────────── */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.ctaBtn, !selected && s.ctaBtnDisabled]}
          onPress={handleVerProfesionales}
          activeOpacity={selected ? 0.85 : 1}
          disabled={!selected}>
          <Text style={s.ctaText}>
            {selected ? `Ver profesionales en ${selected}` : 'Ver profesionales'}
          </Text>
          <MaterialIcons name="arrow-forward" size={18} color="#565E32" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: ViveColors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  backBtn: {
    width: 36,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emoji: {
    fontSize: 18,
  },
  headerTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: ViveColors.text,
    flexShrink: 1,
  },
  prompt: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: `${ViveColors.text}88`,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },

  // Content
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 20,
  },
  groupBlock: {
    gap: 10,
  },
  groupLabel: {
    fontFamily: ViveFonts.semibold,
    fontSize: 12,
    color: `${ViveColors.text}88`,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    borderWidth: 1.5,
    borderColor: GLASS_BORDER,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: GLASS,
    ...shadow,
  },
  chipActive: {
    backgroundColor: '#FDF0E8',
    borderColor: ViveColors.primary,
  },
  chipText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.text,
  },
  chipTextActive: {
    color: ViveColors.primary,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 12,
    backgroundColor: ViveColors.background,
    borderTopWidth: 1,
    borderTopColor: `${ViveColors.text}12`,
  },
  ctaBtn: {
    backgroundColor: ViveColors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaBtnDisabled: {
    opacity: 0.4,
  },
  ctaText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#565E32',
  },
});
