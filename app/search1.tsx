import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  Keyboard,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ViveColors, ViveFonts } from '@/constants/theme';
import { AXES } from '@/constants/searchData';
import { AppBg } from '@/components/ui/AppBg';
import { ScaleCard } from '@/components/ScaleCard';

const FOREST      = '#3A4F2A';
const FOREST_SOFT = '#6B7A56';
const TEXT        = '#565E32';
const GLASS       = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';

const shadow = Platform.select({
  ios:     { shadowColor: TEXT, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
  android: { elevation: 2 },
});

export default function SearchScreen1() {
  const router  = useRouter();
  const [query, setQuery] = useState('');
  const inputRef = useRef<TextInput>(null);

  function handleCancel() {
    Keyboard.dismiss();
    router.back();
  }

  function handleAxisPress(axisId: string) {
    Keyboard.dismiss();
    router.push({ pathname: '/search2', params: { axisId } });
  }

  function handleSearchSubmit() {
    if (query.trim()) {
      Keyboard.dismiss();
      router.push({ pathname: '/search3', params: { query: query.trim() } });
    }
  }

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        {/* ── Barra de búsqueda ──────────────────────────────────────── */}
        <View style={s.topBar}>
          <View style={s.searchBar}>
            <MaterialIcons name="search" size={19} color={FOREST_SOFT} />
            <TextInput
              ref={inputRef}
              style={s.searchInput}
              placeholder="Buscá por nombre, especialidad o tema…"
              placeholderTextColor={`${TEXT}66`}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              onSubmitEditing={handleSearchSubmit}
              autoFocus
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                <MaterialIcons name="cancel" size={17} color={`${TEXT}66`} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={handleCancel} style={s.cancelBtn} activeOpacity={0.7}>
            <Text style={s.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>

        {/* ── Explorar por eje ───────────────────────────────────────── */}
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          <Text style={s.heading}>Explorá por área</Text>
          <Text style={s.subheading}>¿Qué querés trabajar hoy?</Text>

          {AXES.map((axis) => {
            const topics = axis.groups.flatMap(g => g.items);
            return (
              <ScaleCard
                key={axis.id}
                style={[s.axisCard, { backgroundColor: axis.bg, borderColor: `${axis.color}33` }]}
                onPress={() => handleAxisPress(axis.id)}>
                <View style={s.axisIconWrap}>
                  <Text style={s.axisEmoji}>{axis.emoji}</Text>
                </View>
                <View style={s.axisTextWrap}>
                  <Text style={s.axisLabel}>{axis.label}</Text>
                  <Text style={s.axisTopics} numberOfLines={1}>
                    {topics.slice(0, 4).join(' · ')}{topics.length > 4 ? ' · …' : ''}
                  </Text>
                </View>
                <View style={[s.axisArrow, { backgroundColor: axis.color }]}>
                  <MaterialIcons name="arrow-forward" size={16} color="#FFF" />
                </View>
              </ScaleCard>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 24,
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 12 : 7,
    gap: 9,
    ...shadow,
  },
  searchInput: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: TEXT,
    padding: 0,
  },
  cancelBtn: { paddingVertical: 6, paddingLeft: 2 },
  cancelText: { fontFamily: ViveFonts.medium, fontSize: 14, color: ViveColors.primary },

  // Content
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 40,
    gap: 12,
  },
  heading: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 25,
    color: FOREST,
    lineHeight: 31,
  },
  subheading: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: FOREST_SOFT,
    marginBottom: 8,
    marginTop: 1,
  },

  // Axis card
  axisCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 14,
    ...shadow,
  },
  axisIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  axisEmoji: { fontSize: 26 },
  axisTextWrap: { flex: 1, minWidth: 0 },
  axisLabel: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15.5,
    color: FOREST,
    marginBottom: 3,
  },
  axisTopics: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: FOREST_SOFT,
  },
  axisArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
