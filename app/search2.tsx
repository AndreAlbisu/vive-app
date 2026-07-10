import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ViveColors, ViveFonts } from '@/constants/theme';
import { AXES } from '@/constants/searchData';
import { AppBg } from '@/components/ui/AppBg';

const FOREST      = '#3A4F2A';
const FOREST_SOFT = '#6B7A56';
const TEXT        = '#565E32';
const CREAM_LIGHT = '#F7EFE4';
const GLASS       = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';

const shadow = Platform.select({
  ios:     { shadowColor: TEXT, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6 },
  android: { elevation: 2 },
});

export default function SearchScreen2() {
  const router = useRouter();
  const { axisId } = useLocalSearchParams<{ axisId: string }>();
  const [selected, setSelected] = useState<string | null>(null);

  const axis = AXES.find(a => a.id === axisId) ?? AXES[0];

  function handleVerProfesionales() {
    if (!selected) return;
    router.push({ pathname: '/search3', params: { topic: selected, axisId: axis.id, label: selected } });
  }

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back-ios-new" size={18} color={FOREST} />
          </TouchableOpacity>
        </View>

        {/* ── Título editorial ─────────────────────────────────────────── */}
        <View style={s.titleBlock}>
          <View style={[s.axisChip, { backgroundColor: axis.bg, borderColor: `${axis.color}33` }]}>
            <Text style={s.axisChipEmoji}>{axis.emoji}</Text>
            <Text style={[s.axisChipText, { color: FOREST }]}>{axis.label}</Text>
          </View>
          <Text style={s.title}>¿Con qué querés{'\n'}trabajar?</Text>
        </View>

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
                        active
                          ? { backgroundColor: axis.color, borderColor: axis.color }
                          : { borderColor: `${axis.color}40` },
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
              {selected ? `Ver profesionales en ${selected}` : 'Elegí un tema'}
            </Text>
            {selected && <MaterialIcons name="arrow-forward" size={18} color={CREAM_LIGHT} />}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: GLASS, borderWidth: 1, borderColor: GLASS_BORDER,
    alignItems: 'center', justifyContent: 'center',
  },

  // Título editorial
  titleBlock: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16, gap: 12 },
  axisChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1, borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  axisChipEmoji: { fontSize: 14 },
  axisChipText: { fontFamily: ViveFonts.medium, fontSize: 12.5 },
  title: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 27,
    color: FOREST,
    lineHeight: 33,
  },

  // Content
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 22,
  },
  groupBlock: { gap: 11 },
  groupLabel: {
    fontFamily: ViveFonts.semibold,
    fontSize: 11.5,
    color: FOREST_SOFT,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  chip: {
    borderWidth: 1.5,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 11,
    backgroundColor: GLASS,
  },
  chipText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13.5,
    color: TEXT,
  },
  chipTextActive: {
    color: CREAM_LIGHT,
  },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 12 : 20,
    paddingTop: 12,
  },
  ctaBtn: {
    backgroundColor: ViveColors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Platform.select({
      ios: { shadowColor: ViveColors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10 },
      android: { elevation: 4 },
    }),
  },
  ctaBtnDisabled: {
    backgroundColor: 'rgba(193,105,79,0.35)',
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: CREAM_LIGHT,
  },
});
