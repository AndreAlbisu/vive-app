import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { File } from 'expo-file-system';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { ViveColors, ViveFonts, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';

const GLASS = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';

type CoachProfile = {
  name: string;
  specialty: string | null;
  bio: string | null;
  price_per_session: number | null;
  nationality: string | null;
  video_url: string | null;
  instant_booking: boolean;
  avatar_url: string | null;
};

type ReceivedReview = {
  rating: number;
  comment: string | null;
  reviewerName: string;
  createdAt: string;
  isPrivate: boolean;
};

function formatReviewDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: '2-digit' });
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0][0] ?? '').toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function CoachProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<CoachProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [noCoachProfile, setNoCoachProfile] = useState(false);
  const [reviews, setReviews] = useState<ReceivedReview[]>([]);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);
  const [savingInstantMode, setSavingInstantMode] = useState(false);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [topics, setTopics] = useState<string[]>([]);

  useEffect(() => {
    if (!user) { setLoadingProfile(false); return; }

    (async () => {
      const [{ data: profileRow }, { data: coachRow }] = await Promise.all([
        supabase.from('profiles').select('name, avatar_url').eq('id', user.id).single(),
        supabase.from('coaches').select('id, specialty, bio, price_per_session, nationality, video_url, instant_booking').eq('profile_id', user.id).maybeSingle(),
      ]);

      setProfile({
        name: profileRow?.name ?? '',
        specialty: coachRow?.specialty ?? null,
        bio: coachRow?.bio ?? null,
        price_per_session: coachRow?.price_per_session ?? null,
        nationality: coachRow?.nationality ?? null,
        video_url: coachRow?.video_url ?? null,
        instant_booking: coachRow?.instant_booking ?? false,
        avatar_url: profileRow?.avatar_url ?? null,
      });
      setCoachId(coachRow?.id ?? null);
      setNoCoachProfile(!coachRow);
      setLoadingProfile(false);
    })();
  }, [user]);

  // Refresca al volver de /coach-topics (después de guardar cambios ahí)
  useFocusEffect(
    useCallback(() => {
      if (!coachId) return;
      supabase
        .from('coach_topics')
        .select('topic')
        .eq('coach_id', coachId)
        .then(({ data }) => setTopics((data ?? []).map(t => t.topic as string)));
    }, [coachId])
  );

  useEffect(() => {
    if (!user) return;

    (async () => {
      const { data: reviewRows } = await supabase
        .from('reviews')
        .select('rating, comment, reviewer_id, created_at, is_private')
        .eq('reviewed_id', user.id)
        .order('created_at', { ascending: false });

      if (!reviewRows || reviewRows.length === 0) {
        setReviewsLoaded(true);
        return;
      }

      const reviewerIds = reviewRows.map(r => r.reviewer_id);
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', reviewerIds);

      const nameMap: Record<string, string> = {};
      profileRows?.forEach(p => { nameMap[p.id] = p.name ?? 'Usuario'; });

      const avg = reviewRows.reduce((s, r) => s + r.rating, 0) / reviewRows.length;
      setAvgRating(Math.round(avg * 10) / 10);
      setReviews(reviewRows.map(r => ({
        rating: r.rating,
        comment: r.comment,
        reviewerName: nameMap[r.reviewer_id] ?? 'Usuario',
        createdAt: r.created_at,
        isPrivate: r.is_private,
      })));
      setReviewsLoaded(true);
    })();
  }, [user]);

  async function handleSignOut() {
    await signOut();
    router.replace('/(tabs)');
  }

  function openPriceEditor() {
    setPriceInput(profile?.price_per_session != null ? String(profile.price_per_session) : '');
    setEditingPrice(true);
  }

  async function savePrice() {
    if (!user) return;
    const parsed = parseInt(priceInput.replace(/[^0-9]/g, ''), 10);
    if (!parsed || parsed <= 0) {
      Alert.alert('Precio inválido', 'Ingresá un monto mayor a 0.');
      return;
    }

    setSavingPrice(true);
    const { data, error } = await supabase
      .from('coaches')
      .update({ price_per_session: parsed })
      .eq('profile_id', user.id)
      .select('price_per_session');
    setSavingPrice(false);

    // Si RLS bloquea el UPDATE, Postgrest no devuelve error — solo
    // 0 filas afectadas. Sin chequear `data`, esto se mostraría como
    // "guardado" en el cliente aunque la base no haya cambiado.
    if (error || !data || data.length === 0) {
      Alert.alert('No se pudo guardar', 'Probá de nuevo en unos minutos.');
      return;
    }

    setProfile(prev => prev ? { ...prev, price_per_session: parsed } : prev);
    setEditingPrice(false);
  }

  async function toggleInstantMode(value: boolean) {
    if (!user || savingInstantMode) return;
    setProfile(prev => prev ? { ...prev, instant_booking: value } : prev);
    setSavingInstantMode(true);

    const { data, error } = await supabase
      .from('coaches')
      .update({ instant_booking: value })
      .eq('profile_id', user.id)
      .select('instant_booking');
    setSavingInstantMode(false);

    if (error || !data || data.length === 0) {
      setProfile(prev => prev ? { ...prev, instant_booking: !value } : prev);
      Alert.alert('No se pudo guardar', 'Probá de nuevo en unos minutos.');
    }
  }

  async function uploadVideo(uri: string, mimeType: string | null | undefined) {
    if (!user) return;
    setUploadingVideo(true);
    try {
      const file = new File(uri);
      const bytes = await file.bytes();
      const path = `${user.id}/video.mp4`;

      const { error: uploadError } = await supabase.storage
        .from('coach-videos')
        .upload(path, bytes, { contentType: mimeType ?? 'video/mp4', upsert: true });

      if (uploadError) {
        Alert.alert('No se pudo subir el video', 'Probá de nuevo en unos minutos.');
        return;
      }

      const { data } = supabase.storage.from('coach-videos').getPublicUrl(path);
      // cache-bust: el path es siempre el mismo (upsert), así que sin esto
      // el celular podría seguir mostrando el video viejo desde caché.
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

      const { data: updateData, error: updateError } = await supabase
        .from('coaches')
        .update({ video_url: publicUrl })
        .eq('profile_id', user.id)
        .select('video_url');

      if (updateError || !updateData || updateData.length === 0) {
        Alert.alert('Video subido', 'Pero no se pudo guardar en tu perfil. Probá de nuevo.');
        return;
      }

      setProfile(prev => prev ? { ...prev, video_url: publicUrl } : prev);
    } finally {
      setUploadingVideo(false);
    }
  }

  async function launchVideoPicker(source: 'camera' | 'library') {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permiso necesario', 'Activá el permiso desde los ajustes del celular para continuar.');
      return;
    }

    let result;
    try {
      result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: 60 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['videos'],
            videoMaxDuration: 60,
            // por default iOS usa la representación "current" del asset, que para videos
            // guardados solo en iCloud (Optimizar almacenamiento) rompe con
            // PHPhotosErrorDomain al no forzar la descarga. "compatible" sí la fuerza.
            preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
            // bug conocido de expo-image-picker (expo/expo#39937): sin esto, videos
            // solo-en-iCloud fallan al seleccionarlos. allowsEditing fuerza la descarga
            // completa antes de devolver el asset porque abre la pantalla de recorte nativa.
            allowsEditing: true,
          });
    } catch (err) {
      console.error('launchVideoPicker error', err);
      Alert.alert(
        source === 'camera' ? 'No se pudo abrir la cámara' : 'No se pudo abrir la galería',
        'Volvé a intentar. Si elegiste un video guardado solo en iCloud, abrilo primero en la app Fotos para descargarlo al celular y probá de nuevo.'
      );
      return;
    }

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    await uploadVideo(asset.uri, asset.mimeType);
  }

  function pickVideo() {
    Alert.alert('Video de perfil', 'Elegí una opción', [
      { text: 'Grabar video', onPress: () => launchVideoPicker('camera') },
      { text: 'Elegir de la galería', onPress: () => launchVideoPicker('library') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function uploadAvatar(uri: string, mimeType: string | null | undefined) {
    if (!user) return;
    setUploadingAvatar(true);
    try {
      const file = new File(uri);
      const bytes = await file.bytes();
      const path = `${user.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, bytes, { contentType: mimeType ?? 'image/jpeg', upsert: true });

      if (uploadError) {
        Alert.alert('No se pudo subir la foto', 'Probá de nuevo en unos minutos.');
        return;
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      // cache-bust: el path es siempre el mismo (upsert), así que sin esto
      // el celular podría seguir mostrando la foto vieja desde caché.
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

      const { data: updateData, error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)
        .select('avatar_url');

      if (updateError || !updateData || updateData.length === 0) {
        Alert.alert('Foto subida', 'Pero no se pudo guardar en tu perfil. Probá de nuevo.');
        return;
      }

      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : prev);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function launchAvatarPicker(source: 'camera' | 'library') {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permiso necesario', 'Activá el permiso desde los ajustes del celular para continuar.');
      return;
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    };
    let result;
    try {
      result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    } catch {
      Alert.alert('No se pudo abrir la cámara', 'Volvé a intentar. Si el problema persiste, revisá que tengas espacio de almacenamiento disponible en el celular.');
      return;
    }

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    await uploadAvatar(asset.uri, asset.mimeType);
  }

  function pickAvatar() {
    Alert.alert('Foto de perfil', 'Elegí una opción', [
      { text: 'Tomar foto', onPress: () => launchAvatarPicker('camera') },
      { text: 'Elegir de la galería', onPress: () => launchAvatarPicker('library') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  const videoPlayer = useVideoPlayer(profile?.video_url ?? null, p => { p.loop = false; });
  const [videoModalVisible, setVideoModalVisible] = useState(false);

  function openVideoModal() {
    setVideoModalVisible(true);
    videoPlayer.play();
  }

  function closeVideoModal() {
    videoPlayer.pause();
    setVideoModalVisible(false);
  }

  const initials = profile?.name ? getInitials(profile.name) : loadingProfile ? '…' : '?';

  return (
    <AppBg>
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        {/* ── Photo + Info ───────────────────────────────────── */}
        <View style={s.identitySection}>
          <View style={s.photoWrap}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={s.photoImage} />
            ) : (
              <View style={s.photoPlaceholder}>
                <Text style={s.photoInitials}>{initials}</Text>
              </View>
            )}
            <TouchableOpacity
              style={s.editPhotoBtn}
              onPress={pickAvatar}
              disabled={uploadingAvatar}
              activeOpacity={0.8}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#F7EFE4" />
              ) : (
                <MaterialCommunityIcons name="camera-outline" size={16} color="#565E32" />
              )}
            </TouchableOpacity>
          </View>

          <Text style={s.coachName}>
            {loadingProfile ? '…' : (profile?.name || '—')}
          </Text>

          {noCoachProfile ? (
            <Text style={s.emptyCoachText}>Todavía no completaste tu perfil de coach</Text>
          ) : (
            <>
              {profile?.specialty ? (
                <Text style={s.coachSpecialty}>{profile.specialty}</Text>
              ) : null}
              {profile?.bio ? (
                <Text style={s.coachBio}>{profile.bio}</Text>
              ) : null}
              {profile?.nationality ? (
                <Text style={s.coachMeta}>{profile.nationality}</Text>
              ) : null}
            </>
          )}

          <TouchableOpacity style={s.editProfileBtn} activeOpacity={0.75} onPress={() => router.push('/edit-profile')}>
            <Text style={s.editProfileBtnText}>Editar perfil</Text>
          </TouchableOpacity>
        </View>

        {/* ── Temas ─────────────────────────────────────────── */}
        <Text style={s.sectionTitle}>Temas que trabajo</Text>
        <View style={s.chipsWrap}>
          {topics.map(topic => (
            <View key={topic} style={s.topicChip}>
              <Text style={s.topicChipText}>{topic}</Text>
            </View>
          ))}
          <TouchableOpacity
            style={s.addChip}
            onPress={() => router.push('/coach-topics')}
            disabled={noCoachProfile}
            activeOpacity={0.7}>
            <MaterialCommunityIcons name="plus" size={14} color={ViveColors.primary} />
            <Text style={s.addChipText}>{topics.length > 0 ? 'Editar' : 'Agregar'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Precios ───────────────────────────────────────── */}
        <Text style={[s.sectionTitle, s.sectionSpaced]}>Precio y paquetes</Text>
        <View style={s.priceCard}>
          {editingPrice ? (
            <View>
              <Text style={s.priceLabel}>Sesión individual</Text>
              <View style={s.priceEditRow}>
                <Text style={s.priceCurrency}>$</Text>
                <TextInput
                  style={s.priceInput}
                  value={priceInput}
                  onChangeText={t => setPriceInput(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor="rgba(135,131,92,0.45)"
                  autoFocus
                  maxLength={7}
                />
              </View>
              <View style={s.priceEditActions}>
                <TouchableOpacity
                  style={s.priceCancelBtn}
                  onPress={() => setEditingPrice(false)}
                  disabled={savingPrice}
                  activeOpacity={0.75}
                >
                  <Text style={s.priceCancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.priceSaveBtn}
                  onPress={savePrice}
                  disabled={savingPrice}
                  activeOpacity={0.85}
                >
                  {savingPrice ? (
                    <ActivityIndicator size="small" color="#565E32" />
                  ) : (
                    <Text style={s.priceSaveBtnText}>Guardar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={s.priceRow}
              onPress={openPriceEditor}
              activeOpacity={0.75}
              disabled={noCoachProfile}
            >
              <Text style={s.priceLabel}>Sesión individual</Text>
              <View style={s.priceValueRow}>
                <Text style={s.priceValue}>
                  {profile?.price_per_session != null
                    ? `$${profile.price_per_session.toLocaleString('es-AR')}`
                    : '—'}
                </Text>
                {!noCoachProfile && (
                  <MaterialCommunityIcons name="pencil-outline" size={15} color={ViveColors.primary} />
                )}
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Modo de reserva ───────────────────────────────── */}
        <Text style={[s.sectionTitle, s.sectionSpaced]}>Modalidad de reserva</Text>
        <View style={s.toggleCard}>
          <View style={s.toggleInfo}>
            <Text style={s.toggleTitle}>{profile?.instant_booking ? 'Instantánea' : 'Con confirmación'}</Text>
            <Text style={s.toggleDesc}>
              {profile?.instant_booking
                ? 'Los usuarios reservan directamente sin esperar tu aprobación.'
                : 'Cada reserva requiere tu confirmación antes de quedar fijada.'}
            </Text>
          </View>
          <Switch
            value={!!profile?.instant_booking}
            onValueChange={toggleInstantMode}
            disabled={noCoachProfile || savingInstantMode}
            trackColor={{ false: `${ViveColors.text}25`, true: ViveColors.accent }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={`${ViveColors.text}25`}
          />
        </View>

        {/* ── Disponibilidad ────────────────────────────────── */}
        <Text style={[s.sectionTitle, s.sectionSpaced]}>Disponibilidad</Text>
        <TouchableOpacity
          style={s.availBtn}
          onPress={() => router.push('/coach-availability')}
          activeOpacity={0.75}
        >
          <MaterialCommunityIcons name="calendar-clock" size={18} color={ViveColors.primary} />
          <Text style={s.availBtnText}>Gestionar disponibilidad</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color="rgba(135,131,92,0.58)" />
        </TouchableOpacity>

        {/* ── Video perfil ──────────────────────────────────── */}
        <Text style={[s.sectionTitle, s.sectionSpaced]}>Video de perfil</Text>
        <View style={s.videoCard}>
          {profile?.video_url ? (
            <TouchableOpacity activeOpacity={0.9} onPress={openVideoModal} style={s.videoPlayerWrap}>
              <VideoView
                player={videoPlayer}
                style={s.videoPlayerWrap}
                contentFit="cover"
                nativeControls={false}
              />
              <View style={s.videoExpandBadge} pointerEvents="none">
                <MaterialCommunityIcons name="fullscreen" size={18} color="#fff" />
              </View>
            </TouchableOpacity>
          ) : (
            <View style={s.videoPlaceholder}>
              <MaterialCommunityIcons name="video-outline" size={36} color="rgba(135,131,92,0.52)" />
              <Text style={s.videoPlaceholderText}>Sin video grabado</Text>
            </View>
          )}
          <TouchableOpacity
            style={s.recordBtn}
            onPress={pickVideo}
            activeOpacity={0.85}
            disabled={uploadingVideo}>
            <MaterialCommunityIcons name="record-circle-outline" size={16} color={ViveColors.primary} />
            <Text style={s.recordBtnText}>
              {uploadingVideo ? 'Subiendo…' : profile?.video_url ? 'Cambiar video' : 'Grabar nuevo video'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Reseñas recibidas ─────────────────────────────── */}
        <Text style={[s.sectionTitle, s.sectionSpaced]}>Reseñas recibidas</Text>
        {!reviewsLoaded ? null : reviews.length === 0 ? (
          <View style={s.reviewsEmpty}>
            <MaterialCommunityIcons name="star-outline" size={28} color="rgba(135,131,92,0.38)" />
            <Text style={s.reviewsEmptyText}>
              Todavía no recibiste reseñas.{'\n'}Aparecerán acá después de cada sesión completada.
            </Text>
          </View>
        ) : (
          <View style={s.reviewsPanel}>
            {/* Resumen de rating */}
            <View style={s.ratingSummary}>
              <Text style={s.ratingBig}>{avgRating?.toFixed(1)}</Text>
              <View style={s.ratingSummaryRight}>
                <View style={s.starsRow}>
                  {[1,2,3,4,5].map(i => (
                    <MaterialIcons
                      key={i}
                      name={i <= Math.round(avgRating ?? 0) ? 'star' : 'star-border'}
                      size={16}
                      color="#E8C547"
                    />
                  ))}
                </View>
                <Text style={s.reviewCount}>{reviews.length} {reviews.length === 1 ? 'reseña' : 'reseñas'}</Text>
              </View>
            </View>

            {/* Lista */}
            <View style={s.reviewsList}>
              {reviews.map((r, i) => (
                <View key={i} style={s.reviewCard}>
                  <View style={s.reviewHeader}>
                    <View style={s.reviewAvatar}>
                      <Text style={s.reviewAvatarText}>{r.reviewerName.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={s.reviewMeta}>
                      <View style={s.reviewNameRow}>
                        <Text style={s.reviewerName}>{r.reviewerName}</Text>
                        {r.isPrivate && (
                          <MaterialIcons name="lock-outline" size={12} color="rgba(135,131,92,0.58)" />
                        )}
                      </View>
                      <View style={s.starsRow}>
                        {[1,2,3,4,5].map(j => (
                          <MaterialIcons
                            key={j}
                            name={j <= r.rating ? 'star' : 'star-border'}
                            size={12}
                            color="#E8C547"
                          />
                        ))}
                      </View>
                    </View>
                    <Text style={s.reviewDate}>{formatReviewDate(r.createdAt)}</Text>
                  </View>
                  {!!r.comment && (
                    <Text style={s.reviewComment}>{r.comment}</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Cerrar sesión ─────────────────────────────────── */}
        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.75}>
          <MaterialCommunityIcons name="logout" size={16} color="#E05252" />
          <Text style={s.signOutText}>Cerrar sesión</Text>
        </TouchableOpacity>

        <View style={{ height: TAB_BAR_CLEARANCE }} />
      </ScrollView>
    </SafeAreaView>

      <Modal
        visible={videoModalVisible}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={closeVideoModal}>
        <View style={s.videoModalBg}>
          <VideoView
            player={videoPlayer}
            style={s.videoModalPlayer}
            contentFit="contain"
            nativeControls
          />
          <TouchableOpacity style={s.videoModalCloseBtn} onPress={closeVideoModal} hitSlop={12}>
            <MaterialCommunityIcons name="close" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  container: { paddingTop: 0, paddingHorizontal: 0 },

  // Identity section
  identitySection: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 24,
    backgroundColor: GLASS,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
    marginBottom: 24,
  },
  photoWrap: { position: 'relative', marginBottom: 16 },
  photoPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: `${ViveColors.primary}25`,
    borderWidth: 2.5,
    borderColor: ViveColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2.5,
    borderColor: ViveColors.primary,
  },
  photoInitials: {
    fontFamily: ViveFonts.bold,
    fontSize: 30,
    color: '#565E32',
  },
  editPhotoBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ViveColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.70)',
  },
  coachName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 22,
    color: '#565E32',
    marginBottom: 4,
  },
  coachSpecialty: {
    fontFamily: ViveFonts.medium,
    fontSize: 14,
    color: ViveColors.primary,
    marginBottom: 4,
  },
  coachBio: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#87835C',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 4,
    paddingHorizontal: 8,
  },
  coachMeta: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#87835C',
    marginBottom: 18,
  },
  emptyCoachText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: 'rgba(135,131,92,0.80)',
    textAlign: 'center',
    marginBottom: 18,
    marginTop: 4,
    paddingHorizontal: 8,
  },
  editProfileBtn: {
    borderWidth: 1.5,
    borderColor: ViveColors.primary,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 22,
    marginTop: 4,
  },
  editProfileBtnText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.primary,
  },

  // Sections
  sectionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#565E32',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  sectionSpaced: { marginTop: 28 },

  // Topics
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 8,
  },
  topicChip: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 20,
    backgroundColor: 'rgba(86,94,50,0.08)',
  },
  topicChipText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: '#565E32',
  },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: `${ViveColors.primary}60`,
    gap: 3,
  },
  addChipText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.primary,
  },

  // Price
  priceCard: {
    backgroundColor: GLASS,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 16,
    marginHorizontal: 20,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceDivider: {
    height: 1,
    backgroundColor: 'rgba(86,94,50,0.08)',
    marginVertical: 12,
  },
  priceLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 14,
    color: '#565E32',
  },
  priceSaving: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: ViveColors.accent,
    marginTop: 2,
  },
  priceValue: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#565E32',
  },
  priceValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: ViveColors.primary,
    paddingBottom: 6,
  },
  priceCurrency: {
    fontFamily: ViveFonts.semibold,
    fontSize: 20,
    color: '#565E32',
    marginRight: 4,
  },
  priceInput: {
    flex: 1,
    fontFamily: ViveFonts.semibold,
    fontSize: 20,
    color: '#565E32',
    padding: 0,
  },
  priceEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  priceCancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  priceCancelBtnText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: '#87835C',
  },
  priceSaveBtn: {
    backgroundColor: ViveColors.primary,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 18,
    minWidth: 80,
    alignItems: 'center',
  },
  priceSaveBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: '#565E32',
  },

  // Toggle
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 16,
    marginHorizontal: 20,
    gap: 16,
  },
  toggleInfo: { flex: 1 },
  toggleTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#565E32',
    marginBottom: 3,
  },
  toggleDesc: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: '#87835C',
    lineHeight: 18,
  },

  availBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 16,
    marginHorizontal: 20,
    gap: 12,
  },
  availBtnText: {
    flex: 1,
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#565E32',
  },

  // Video
  videoCard: {
    backgroundColor: GLASS,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 16,
    marginHorizontal: 20,
    alignItems: 'center',
    gap: 16,
  },
  videoPlaceholder: {
    width: '100%',
    height: 130,
    borderRadius: 12,
    backgroundColor: 'rgba(255,248,240,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(86,94,50,0.14)',
    borderStyle: 'dashed',
  },
  videoPlaceholderText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: 'rgba(135,131,92,0.65)',
  },
  videoPlayerWrap: {
    width: '100%',
    height: 130,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  videoExpandBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoModalBg: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoModalPlayer: {
    width: '100%',
    height: '100%',
  },
  videoModalCloseBtn: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: ViveColors.primary,
  },
  recordBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: ViveColors.primary,
  },

  // Reviews recibidas
  reviewsEmpty: {
    backgroundColor: GLASS,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 24,
    marginHorizontal: 20,
    alignItems: 'center',
    gap: 10,
  },
  reviewsEmptyText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: 'rgba(135,131,92,0.72)',
    textAlign: 'center',
    lineHeight: 20,
  },
  reviewsPanel: {
    marginHorizontal: 20,
    gap: 14,
  },
  ratingSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: GLASS,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 16,
  },
  ratingBig: {
    fontFamily: ViveFonts.bold,
    fontSize: 40,
    color: '#565E32',
    lineHeight: 48,
  },
  ratingSummaryRight: { gap: 4 },
  starsRow: { flexDirection: 'row', gap: 2 },
  reviewCount: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: 'rgba(135,131,92,0.80)',
  },
  reviewsList: { gap: 10 },
  reviewCard: {
    backgroundColor: GLASS,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 14,
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
    backgroundColor: 'rgba(86,94,50,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  reviewAvatarText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#565E32',
  },
  reviewMeta: { flex: 1, gap: 3 },
  reviewNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  reviewerName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: '#565E32',
  },
  reviewDate: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: 'rgba(135,131,92,0.58)',
    flexShrink: 0,
  },
  reviewComment: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#87835C',
    lineHeight: 19,
  },

  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
  },
  signOutText: {
    fontFamily: ViveFonts.medium,
    fontSize: 14,
    color: '#E05252',
  },
});
