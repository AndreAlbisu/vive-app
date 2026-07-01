import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  FlatList,
  Image,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ViveColors, ViveFonts } from '@/constants/theme';
import { ScaleCard } from '@/components/ScaleCard';
import { supabase } from '@/lib/supabase';
import { AppBg } from '@/components/ui/AppBg';
import { useAuth } from '@/context/AuthContext';
import { useFavoriteCoaches } from '@/hooks/useFavoriteCoaches';

type FavoriteCoach = {
  profileId: string;
  name: string;
  specialty: string;
  priceFrom: number;
  avatarUrl: string | null;
};

const shadow = Platform.select({
  ios: { shadowColor: ViveColors.text, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  android: { elevation: 3 },
});

export default function FavoritosScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { favoriteIds, loaded, toggleFavorite } = useFavoriteCoaches(user?.id);
  const [coaches, setCoaches] = useState<FavoriteCoach[]>([]);
  const [loadingCoaches, setLoadingCoaches] = useState(true);

  const loadCoaches = useCallback(async () => {
    if (!loaded) return;
    const ids = [...favoriteIds];
    if (ids.length === 0) { setCoaches([]); setLoadingCoaches(false); return; }

    setLoadingCoaches(true);
    const { data, error } = await supabase
      .from('coaches')
      .select('specialty, price_per_session, profiles!inner(id, name, avatar_url)')
      .in('profile_id', ids);

    if (error) { console.error('[Favoritos] coaches fetch:', error.message); }

    const rows: FavoriteCoach[] = (data ?? []).map((c: any) => {
      const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
      return {
        profileId: profile?.id as string,
        name: profile?.name as string,
        specialty: c.specialty as string,
        priceFrom: c.price_per_session as number,
        avatarUrl: (profile?.avatar_url ?? null) as string | null,
      };
    });
    setCoaches(rows);
    setLoadingCoaches(false);
  }, [loaded, favoriteIds]);

  useEffect(() => { loadCoaches(); }, [loadCoaches]);

  function goToPerfil(coach: FavoriteCoach) {
    router.push({
      pathname: '/profesional',
      params: {
        profileId: coach.profileId,
        name: coach.name,
        specialty: coach.specialty,
        priceFrom: String(coach.priceFrom),
      },
    });
  }

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="arrow-back-ios" size={18} color="#565E32" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Mis favoritos</Text>
          <View style={s.headerSpacer} />
        </View>

        <FlatList
          data={coaches}
          keyExtractor={c => c.profileId}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            (loadingCoaches || !loaded) ? (
              <ActivityIndicator size="small" color={ViveColors.primary} style={{ marginTop: 40 }} />
            ) : (
              <View style={s.empty}>
                <MaterialIcons name="star-border" size={40} color="rgba(135,131,92,0.45)" />
                <Text style={s.emptyTitle}>Todavía no guardaste ningún coach</Text>
                <Text style={s.emptyText}>Tocá la estrella en el perfil de un coach o en Destacados para guardarlo acá.</Text>
              </View>
            )
          }
          renderItem={({ item: coach }) => (
            <ScaleCard style={s.card} onPress={() => goToPerfil(coach)}>
              {coach.avatarUrl ? (
                <Image source={{ uri: coach.avatarUrl }} style={s.avatarImage} />
              ) : (
                <View style={s.avatar}>
                  <MaterialIcons name="person" size={30} color="#C0BAB4" />
                </View>
              )}
              <View style={s.cardInfo}>
                <Text style={s.cardName} numberOfLines={1}>{coach.name}</Text>
                <Text style={s.cardSpecialty} numberOfLines={1}>{coach.specialty}</Text>
                <Text style={s.cardPrice}>Desde ${coach.priceFrom.toLocaleString('es-AR')}</Text>
              </View>
              <TouchableOpacity
                onPress={() => toggleFavorite(coach.profileId)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}>
                <MaterialIcons name="star" size={22} color={ViveColors.primary} />
              </TouchableOpacity>
            </ScaleCard>
          )}
        />
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,248,240,0.62)',
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: 'rgba(0,0,0,0.5)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  headerTitle: {
    flex: 1, fontFamily: ViveFonts.semibold, fontSize: 18,
    color: '#565E32', textAlign: 'center', letterSpacing: -0.2,
  },
  headerSpacer: { width: 36 },

  list: { paddingHorizontal: 20, paddingBottom: 40, gap: 12, flexGrow: 1 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,248,240,0.80)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    padding: 14,
    gap: 12,
    ...shadow,
  },
  avatar: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#EDE7E0', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarImage: { width: 60, height: 60, borderRadius: 30, flexShrink: 0 },
  cardInfo: { flex: 1 },
  cardName: { fontFamily: ViveFonts.semibold, fontSize: 14, color: ViveColors.text, marginBottom: 2 },
  cardSpecialty: { fontFamily: ViveFonts.medium, fontSize: 12, color: ViveColors.primary, marginBottom: 2 },
  cardPrice: { fontFamily: ViveFonts.regular, fontSize: 11, color: `${ViveColors.text}88` },

  empty: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 30 },
  emptyTitle: { fontFamily: ViveFonts.semibold, fontSize: 16, color: ViveColors.text, textAlign: 'center' },
  emptyText: { fontFamily: ViveFonts.regular, fontSize: 13, color: `${ViveColors.text}88`, textAlign: 'center' },
});
