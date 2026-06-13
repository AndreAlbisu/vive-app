import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ViveColors, ViveFonts } from '@/constants/theme';

// ─── Defaults ────────────────────────────────────────────────────────────────
const DEFAULT_PROFESIONAL = {
  name: 'Laura Méndez',
  specialty: 'Coach de vida',
  age: '34 años',
  nationality: 'Argentina',
  gender: 'Mujer',
  topics: ['Ansiedad', 'Autoestima', 'Relaciones', 'Propósito', 'Estrés'],
  rating: 4.9,
  reviewCount: 127,
  priceFrom: 4500,
};

const REVIEWS = [
  {
    id: '1',
    name: 'Sofía R.',
    text: 'Laura me ayudó a entender patrones que me bloqueaban hace años. Muy recomendable, tiene una escucha increíble.',
    rating: 5,
  },
  {
    id: '2',
    name: 'Matías T.',
    text: 'Cada sesión la siento como un paso concreto hacia adelante. Clara, empática y muy profesional.',
    rating: 5,
  },
  {
    id: '3',
    name: 'Camila V.',
    text: 'Me sorprendió lo mucho que avancé en pocas sesiones. Tiene una forma de guiar que se siente muy natural.',
    rating: 4,
  },
];

// ─── Subcomponentes ───────────────────────────────────────────────────────────
function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <MaterialIcons
          key={i}
          name={i <= Math.round(rating) ? 'star' : 'star-border'}
          size={size}
          color="#E8C547"
        />
      ))}
    </View>
  );
}

function ReviewAvatar({ name }: { name: string }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <View style={s.reviewAvatar}>
      <Text style={s.reviewAvatarText}>{initial}</Text>
    </View>
  );
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────
export default function ProfesionalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    name?: string;
    specialty?: string;
    rating?: string;
    reviewCount?: string;
    priceFrom?: string;
  }>();
  const [saved, setSaved] = useState(false);

  const prof = {
    ...DEFAULT_PROFESIONAL,
    ...(params.name && { name: params.name }),
    ...(params.specialty && { specialty: params.specialty }),
    ...(params.rating && { rating: parseFloat(params.rating) }),
    ...(params.reviewCount && { reviewCount: parseInt(params.reviewCount, 10) }),
    ...(params.priceFrom && { priceFrom: parseInt(params.priceFrom, 10) }),
  };

  return (
    <View style={s.root}>
      <SafeAreaView style={s.safe} edges={['top']}>

        {/* ── Botón atrás flotante ─────────────────────────────────────── */}
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name="arrow-back-ios" size={18} color={ViveColors.text} />
        </TouchableOpacity>

      </SafeAreaView>

      {/* ── Scroll ───────────────────────────────────────────────────────── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* ── Foto grande ──────────────────────────────────────────────── */}
        <View style={s.photoContainer}>
          <View style={s.photoPlaceholder}>
            <MaterialIcons name="person" size={90} color="#C0BAB4" />
          </View>

          {/* Badge verificado */}
          <View style={s.verifiedBadge}>
            <MaterialIcons name="verified" size={14} color="#FFFFFF" />
            <Text style={s.verifiedText}>Verificado por VIVE</Text>
          </View>
        </View>

        {/* ── Info básica ──────────────────────────────────────────────── */}
        <View style={s.infoSection}>
          <Text style={s.name}>{prof.name}</Text>
          <Text style={s.specialty}>{prof.specialty}</Text>

          <Text style={s.metaLine}>
            {prof.age} · {prof.nationality} · {prof.gender}
          </Text>

          {/* Chips de temas */}
          <View style={s.chipsRow}>
            {prof.topics.map(topic => (
              <View key={topic} style={s.chip}>
                <Text style={s.chipText}>{topic}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Video de introducción ─────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Video de introducción</Text>
          <TouchableOpacity style={s.videoPlaceholder} activeOpacity={0.8}>
            <View style={s.playBtn}>
              <MaterialIcons name="play-arrow" size={32} color={ViveColors.primary} />
            </View>
            <Text style={s.videoCaption}>
              Conocé a {prof.name.split(' ')[0]} en 1 minuto
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Reviews ──────────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Reseñas</Text>

          {/* Rating general */}
          <View style={s.ratingOverall}>
            <Text style={s.ratingNumber}>{prof.rating}</Text>
            <View style={s.ratingRight}>
              <Stars rating={prof.rating} size={18} />
              <Text style={s.ratingCount}>{prof.reviewCount} reseñas</Text>
            </View>
          </View>

          {/* Lista de reviews */}
          <View style={s.reviewsList}>
            {REVIEWS.map(review => (
              <View key={review.id} style={s.reviewCard}>
                <View style={s.reviewHeader}>
                  <ReviewAvatar name={review.name} />
                  <View style={s.reviewMeta}>
                    <Text style={s.reviewName}>{review.name}</Text>
                    <Stars rating={review.rating} size={12} />
                  </View>
                </View>
                <Text style={s.reviewText}>{review.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Espaciador para el footer sticky */}
        <View style={{ height: 108 }} />
      </ScrollView>

      {/* ── Footer sticky ────────────────────────────────────────────────── */}
      <SafeAreaView style={s.footerSafe} edges={['bottom']}>
        <View style={s.footer}>
          <View style={s.footerTop}>
            <Text style={s.price}>
              Desde ${prof.priceFrom.toLocaleString('es-AR')} por sesión
            </Text>
          </View>
          <View style={s.footerButtons}>
            <TouchableOpacity
              style={s.btnPrimary}
              activeOpacity={0.85}
              onPress={() =>
                router.push({
                  pathname: '/booking-calendar',
                  params: {
                    name: prof.name,
                    specialty: prof.specialty,
                    priceFrom: String(prof.priceFrom),
                  },
                })
              }>
              <Text style={s.btnPrimaryText}>Reservar sesión</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btnSecondary, saved && s.btnSecondaryActive]}
              onPress={() => setSaved(v => !v)}
              activeOpacity={0.8}>
              <MaterialIcons
                name={saved ? 'favorite' : 'favorite-border'}
                size={18}
                color={ViveColors.primary}
              />
              <Text style={s.btnSecondaryText}>
                {saved ? 'Guardado' : 'Guardar en favoritos'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Sombra ──────────────────────────────────────────────────────────────────
const shadow = Platform.select({
  ios: {
    shadowColor: ViveColors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  android: { elevation: 3 },
});

// ─── Estilos ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ViveColors.background,
  },
  safe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backBtn: {
    margin: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(251,246,239,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // ── Foto ──────────────────────────────────────────────────────────────
  photoContainer: {
    width: '100%',
    height: 300,
  },
  photoPlaceholder: {
    flex: 1,
    backgroundColor: '#EDE7E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ViveColors.accent,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 5,
  },
  verifiedText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // ── Info básica ────────────────────────────────────────────────────────
  infoSection: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 8,
  },
  name: {
    fontFamily: ViveFonts.semibold,
    fontSize: 28,
    color: ViveColors.text,
    lineHeight: 36,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  specialty: {
    fontFamily: ViveFonts.medium,
    fontSize: 16,
    color: ViveColors.primary,
    marginBottom: 8,
  },
  metaLine: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: ViveColors.text,
    opacity: 0.6,
    marginBottom: 14,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1.5,
    borderColor: ViveColors.primary,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  chipText: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: ViveColors.primary,
  },

  // ── Sección genérica ──────────────────────────────────────────────────
  section: {
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  sectionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: ViveColors.text,
    marginBottom: 14,
  },

  // ── Video ─────────────────────────────────────────────────────────────
  videoPlaceholder: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    ...shadow,
  },
  playBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FDF0E8',
    borderWidth: 2,
    borderColor: ViveColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoCaption: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: ViveColors.text,
    opacity: 0.6,
  },

  // ── Rating general ────────────────────────────────────────────────────
  ratingOverall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    gap: 14,
    ...shadow,
  },
  ratingNumber: {
    fontFamily: ViveFonts.bold,
    fontSize: 40,
    color: ViveColors.text,
    lineHeight: 48,
  },
  ratingRight: {
    gap: 4,
  },
  ratingCount: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: ViveColors.text,
    opacity: 0.55,
  },

  // ── Reviews ───────────────────────────────────────────────────────────
  reviewsList: {
    gap: 12,
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    ...shadow,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ViveColors.background,
    borderWidth: 1.5,
    borderColor: `${ViveColors.text}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: ViveColors.text,
  },
  reviewMeta: {
    gap: 3,
  },
  reviewName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: ViveColors.text,
  },
  reviewText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: ViveColors.text,
    opacity: 0.7,
    lineHeight: 20,
  },

  // ── Footer sticky ─────────────────────────────────────────────────────
  footerSafe: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: `${ViveColors.text}10`,
    ...Platform.select({
      ios: {
        shadowColor: ViveColors.text,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.07,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
    }),
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 10,
  },
  footerTop: {},
  price: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: ViveColors.text,
  },
  footerButtons: {
    gap: 10,
  },
  btnPrimary: {
    backgroundColor: ViveColors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: ViveColors.primary,
    paddingVertical: 12,
    gap: 8,
  },
  btnSecondaryActive: {
    backgroundColor: '#FDF0E8',
  },
  btnSecondaryText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: ViveColors.primary,
  },
});
