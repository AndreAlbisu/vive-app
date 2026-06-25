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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ViveColors, ViveFonts } from '@/constants/theme';
import { AXES } from '@/constants/searchData';
import { ScaleCard } from '@/components/ScaleCard';

const shadow = Platform.select({
  ios:     { shadowColor: ViveColors.text, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  android: { elevation: 3 },
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
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── Barra de búsqueda ──────────────────────────────────────── */}
      <View style={s.topBar}>
        <View style={s.searchBar}>
          <MaterialIcons name="search" size={18} color={ViveColors.text} />
          <TextInput
            ref={inputRef}
            style={s.searchInput}
            placeholder="Buscá por nombre, especialidad o tema..."
            placeholderTextColor={`${ViveColors.text}66`}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={handleSearchSubmit}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="close" size={16} color={`${ViveColors.text}88`} />
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
        keyboardShouldPersistTaps="handled">

        <Text style={s.heading}>Explorá por área</Text>
        <Text style={s.subheading}>¿Qué querés trabajar?</Text>

        {AXES.map((axis) => (
          <ScaleCard
            key={axis.id}
            style={[s.axisCard, { borderLeftColor: axis.color, borderLeftWidth: 3 }]}
            onPress={() => handleAxisPress(axis.id)}>
            <View style={[s.axisIconWrap, { backgroundColor: axis.bg }]}>
              <Text style={s.axisEmoji}>{axis.emoji}</Text>
            </View>
            <View style={s.axisTextWrap}>
              <Text style={s.axisLabel}>{axis.label}</Text>
              <Text style={s.axisTopics} numberOfLines={1}>
                {axis.groups.flatMap(g => g.items).slice(0, 4).join(' · ')}
                {axis.groups.flatMap(g => g.items).length > 4 ? ' · ...' : ''}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={axis.color} />
          </ScaleCard>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: ViveColors.background,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 11 : 6,
    gap: 8,
    ...shadow,
  },
  searchInput: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: ViveColors.text,
    padding: 0,
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingLeft: 2,
  },
  cancelText: {
    fontFamily: ViveFonts.medium,
    fontSize: 14,
    color: ViveColors.primary,
  },

  // Content
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 14,
    justifyContent: 'center',
  },
  heading: {
    fontFamily: ViveFonts.semibold,
    fontSize: 18,
    color: ViveColors.text,
    marginBottom: 2,
  },
  subheading: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: `${ViveColors.text}99`,
    marginBottom: 8,
  },

  // Axis card
  axisCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 16,
    gap: 14,
    ...shadow,
  },
  axisIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  axisEmoji: {
    fontSize: 26,
  },
  axisTextWrap: {
    flex: 1,
  },
  axisLabel: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: ViveColors.text,
    marginBottom: 4,
  },
  axisTopics: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: `${ViveColors.text}88`,
  },
});
