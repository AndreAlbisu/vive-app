import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const GLASS = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';

const RATING_LABELS = ['', 'Muy mala', 'Mala', 'Regular', 'Buena', 'Excelente'];

export default function ReviewScreen() {
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();
  const params = useLocalSearchParams<{ booking_id?: string }>();
  const bookingId = Array.isArray(params.booking_id) ? params.booking_id[0] : params.booking_id;

  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [coachName, setCoachName] = useState('');
  const [coachSpecialty, setCoachSpecialty] = useState('');
  const [coachProfileId, setCoachProfileId] = useState('');
  const [existingReviewId, setExistingReviewId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (authLoading) return;

    // Reviews son unidireccionales (usuario → coach, decisión de producto
    // 01/07/2026) — un coach nunca debería llegar a esta pantalla, ni
    // siquiera por una notificación 'invitacion_review' vieja o mal generada.
    if (role === 'coach') {
      router.replace('/(coach)/reservas');
      return;
    }

    if (!user || !bookingId) { setPageLoading(false); return; }

    async function load() {
      const { data: booking } = await supabase
        .from('bookings')
        .select('coach_id, coach_name, coach_specialty')
        .eq('id', bookingId!)
        .single();

      if (!booking) { setPageLoading(false); return; }

      setCoachName(booking.coach_name ?? 'Tu coach');
      setCoachSpecialty(booking.coach_specialty ?? '');

      const { data: coachRow } = await supabase
        .from('coaches')
        .select('profile_id')
        .eq('id', booking.coach_id)
        .single();

      if (!coachRow) { setPageLoading(false); return; }
      setCoachProfileId(coachRow.profile_id);

      const { data: existing } = await supabase
        .from('reviews')
        .select('id, rating, comment')
        .eq('reviewer_id', user!.id)
        .eq('reviewed_id', coachRow.profile_id)
        .maybeSingle();

      if (existing) {
        setExistingReviewId(existing.id);
        setRating(existing.rating);
        setComment(existing.comment ?? '');
      }

      setPageLoading(false);
    }

    load();
  }, [user, bookingId, role, authLoading, router]);

  const handleSubmit = useCallback(async () => {
    if (rating === 0) {
      Alert.alert('Falta la calificación', 'Tocá las estrellas para calificar la sesión.');
      return;
    }
    if (!coachProfileId || !user || !bookingId) return;

    setSubmitting(true);

    let error: { message: string } | null = null;

    if (existingReviewId) {
      ({ error } = await supabase
        .from('reviews')
        .update({ rating, comment: comment.trim() || null })
        .eq('id', existingReviewId));
    } else {
      ({ error } = await supabase
        .from('reviews')
        .insert({
          booking_id: bookingId,
          reviewer_id: user.id,
          reviewed_id: coachProfileId,
          rating,
          comment: comment.trim() || null,
        }));
    }

    setSubmitting(false);

    if (error) {
      Alert.alert('Error', 'No pudimos guardar tu reseña. Intentá de nuevo.');
      return;
    }

    Alert.alert(
      existingReviewId ? 'Reseña actualizada' : '¡Gracias por tu reseña!',
      existingReviewId
        ? 'Tu reseña fue actualizada correctamente.'
        : 'Tu experiencia ayuda a otros a elegir mejor.',
      [{ text: 'Listo', onPress: () => router.back() }],
    );
  }, [rating, comment, coachProfileId, user, bookingId, existingReviewId, router]);

  if (pageLoading) {
    return (
      <AppBg>
        <SafeAreaView style={s.safe}>
          <View style={s.center}>
            <ActivityIndicator size="large" color={ViveColors.primary} />
          </View>
        </SafeAreaView>
      </AppBg>
    );
  }

  if (!bookingId) {
    return (
      <AppBg>
        <SafeAreaView style={s.safe}>
          <View style={s.center}>
            <Text style={s.errorText}>Invitación no encontrada.</Text>
          </View>
        </SafeAreaView>
      </AppBg>
    );
  }

  return (
    <AppBg>
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back-ios" size={18} color="#565E32" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{existingReviewId ? 'Editar reseña' : 'Dejar reseña'}</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={s.divider} />

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

            <View style={s.coachCard}>
              <View style={s.coachAvatar}>
                <Text style={s.coachAvatarText}>{(coachName.charAt(0) || '?').toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.coachName}>{coachName}</Text>
                {!!coachSpecialty && <Text style={s.coachSpecialty}>{coachSpecialty}</Text>}
              </View>
            </View>

            <Text style={s.label}>¿Cómo fue tu experiencia?</Text>
            <View style={s.starsRow}>
              {[1, 2, 3, 4, 5].map(i => (
                <TouchableOpacity key={i} onPress={() => setRating(i)} activeOpacity={0.7} hitSlop={6}>
                  <MaterialIcons
                    name={i <= rating ? 'star' : 'star-border'}
                    size={44}
                    color="#E8C547"
                  />
                </TouchableOpacity>
              ))}
            </View>
            {rating > 0 && (
              <Text style={s.ratingLabel}>{RATING_LABELS[rating]}</Text>
            )}

            <Text style={[s.label, { marginTop: 28 }]}>Contanos más (opcional)</Text>
            <TextInput
              style={s.textInput}
              placeholder="¿Qué fue lo más valioso de la sesión?"
              placeholderTextColor="rgba(135,131,92,0.45)"
              multiline
              value={comment}
              onChangeText={setComment}
              maxLength={500}
            />
            <Text style={s.charCount}>{comment.length}/500</Text>

            <TouchableOpacity
              style={[s.submitBtn, (submitting || rating === 0) && s.submitBtnDisabled]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={submitting || rating === 0}
            >
              {submitting
                ? <ActivityIndicator size="small" color="#1A1A2E" />
                : <Text style={s.submitBtnText}>{existingReviewId ? 'Actualizar reseña' : 'Publicar reseña'}</Text>
              }
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontFamily: ViveFonts.regular, fontSize: 15, color: '#87835C' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,248,240,0.48)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(86,94,50,0.14)',
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: '#565E32',
    textAlign: 'center',
    marginRight: 36,
  },
  divider: { height: 1, backgroundColor: 'rgba(86,94,50,0.08)' },

  content: {
    padding: 20,
  },

  coachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: GLASS,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 16,
    marginBottom: 28,
  },
  coachAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ViveColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  coachAvatarText: {
    fontFamily: ViveFonts.bold,
    fontSize: 20,
    color: '#FFFFFF',
  },
  coachName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: '#565E32',
  },
  coachSpecialty: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: ViveColors.primary,
    marginTop: 2,
  },

  label: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#565E32',
    marginBottom: 14,
  },

  starsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  ratingLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 14,
    color: '#E8C547',
    marginBottom: 4,
  },

  textInput: {
    backgroundColor: GLASS,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 14,
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: '#565E32',
    minHeight: 110,
    textAlignVertical: 'top',
  },
  charCount: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: 'rgba(135,131,92,0.52)',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 28,
  },

  submitBtn: {
    backgroundColor: '#565E32',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: '#F7EFE4',
  },
});
