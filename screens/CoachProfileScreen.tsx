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
import * as WebBrowser from 'expo-web-browser';
import { useVideoPlayer, VideoView } from 'expo-video';
import { File } from 'expo-file-system';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { hasContactInfo } from '@/lib/contactInfoGuard';
import { ViveColors, ViveFonts, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { priceUsdError } from '@/lib/pricing';
import { faltaParaInternacional, rielesTexto } from '@/lib/payout';
import { AppBg } from '@/components/ui/AppBg';

const GLASS = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';

type CoachProfile = {
  name: string;
  specialty: string | null;
  bio: string | null;
  price_per_session: number | null;
  price_usd: number | null;
  nationality: string | null;
  video_url: string | null;
  instant_booking: boolean;
  accepts_international: boolean;
  accepts_paypal: boolean;
  accepts_usdt: boolean;
  availability_status: 'activo' | 'en_pausa';
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
  const { user } = useAuth();
  const [profile, setProfile] = useState<CoachProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [noCoachProfile, setNoCoachProfile] = useState(false);
  const [reviews, setReviews] = useState<ReceivedReview[]>([]);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceUsdInput, setPriceUsdInput] = useState('');
  const [savingPriceUsd, setSavingPriceUsd] = useState(false);
  const [priceInput, setPriceInput] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  const [savingInstantMode, setSavingInstantMode] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [mpConnected, setMpConnected] = useState(false);
  // Desplegable de las sesiones del exterior. `null` = todavía no lo tocó,
  // así que manda el default: abierto si ya hay algo configurado, cerrado si
  // no. Sin ese default, el coach que YA atiende del exterior abría el perfil
  // y no veía su propio precio.
  const [intlAbierto, setIntlAbierto] = useState<boolean | null>(null);
  const [connectingMp, setConnectingMp] = useState(false);

  useEffect(() => {
    if (!user) { setLoadingProfile(false); return; }

    (async () => {
      const [{ data: profileRow }, { data: coachRow }] = await Promise.all([
        supabase.from('profiles').select('name, avatar_url').eq('id', user.id).single(),
        supabase.from('coaches').select('id, specialty, bio, price_per_session, nationality, video_url, instant_booking, availability_status, mp_connected, accepts_international, accepts_paypal, accepts_usdt, price_usd').eq('profile_id', user.id).maybeSingle(),
      ]);

      setProfile({
        name: profileRow?.name ?? '',
        specialty: coachRow?.specialty ?? null,
        bio: coachRow?.bio ?? null,
        price_per_session: coachRow?.price_per_session ?? null,
        price_usd: coachRow?.price_usd ?? null,
        nationality: coachRow?.nationality ?? null,
        video_url: coachRow?.video_url ?? null,
        instant_booking: coachRow?.instant_booking ?? false,
        accepts_international: coachRow?.accepts_international ?? false,
        accepts_paypal: coachRow?.accepts_paypal ?? false,
        accepts_usdt: coachRow?.accepts_usdt ?? false,
        availability_status: (coachRow?.availability_status ?? 'activo') as 'activo' | 'en_pausa',
        avatar_url: profileRow?.avatar_url ?? null,
      });
      setCoachId(coachRow?.id ?? null);
      setMpConnected(coachRow?.mp_connected ?? false);
      // El input arranca con lo guardado y desde ahí manda él solo.
      setPriceUsdInput(coachRow?.price_usd != null ? String(coachRow.price_usd) : '');
      setNoCoachProfile(!coachRow);
      setLoadingProfile(false);
    })();
  }, [user]);

  // Refresca al volver de /coach-topics y de /coach-datos-cobro.
  //
  // Los tres `accepts_*` son DERIVADOS por trigger desde `coach_payout_accounts`
  // (`add-payout-rails.sql`): esta pantalla no los escribe y no puede
  // adivinarlos. Sin volver a leerlos, quien configuraba un riel y volvía seguía
  // viendo "Desactivadas" hasta reiniciar la app — y esa pantalla es
  // exactamente adonde lo manda esta sección.
  useFocusEffect(
    useCallback(() => {
      if (!coachId) return;

      supabase
        .from('coach_topics')
        .select('topic')
        .eq('coach_id', coachId)
        .then(({ data }) => setTopics((data ?? []).map(t => t.topic as string)));

      supabase
        .from('coaches')
        .select('accepts_international, accepts_paypal, accepts_usdt, price_usd')
        .eq('id', coachId)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) return;
          setProfile(prev => prev && {
            ...prev,
            accepts_international: data.accepts_international ?? false,
            accepts_paypal: data.accepts_paypal ?? false,
            accepts_usdt: data.accepts_usdt ?? false,
            price_usd: data.price_usd ?? null,
          });
        });
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


  function openPriceEditor() {
    setPriceInput(profile?.price_per_session != null ? String(profile.price_per_session) : '');
    setEditingPrice(true);
  }

  async function savePrice() {
    if (!user) return;
    const parsed = parseInt(priceInput.replace(/[^0-9]/g, ''), 10);
    if (!parsed || parsed <= 0) {
      Alert.alert('Precio inválido', 'Ingresá un monto mayor a 0');
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
      Alert.alert('No se pudo guardar', 'Probá de nuevo en unos minutos');
      return;
    }

    setProfile(prev => prev ? { ...prev, price_per_session: parsed } : prev);
    setEditingPrice(false);
  }

  // ⚠️ ENTERO obligatorio, y no es cosmético: el cobro en USDT identifica cada
  // reserva por un monto único donde los decimales son el identificador. Un
  // precio con decimales lo corrompe y la transferencia queda irreconocible.
  async function savePriceUsd() {
    if (!user || savingPriceUsd) return;

    // Vaciar el campo no es un error: es el paso intermedio para escribir otro
    // número. Se restaura lo guardado en silencio en vez de acusar al usuario
    // de haber puesto un precio inválido.
    if (!priceUsdInput.trim()) {
      setPriceUsdInput(profile?.price_usd != null ? String(profile.price_usd) : '');
      return;
    }

    // La regla vive en `lib/pricing.ts` y está duplicada como CHECK en la base.
    // El mínimo existe por la comisión FIJA de PayPal (USD 0,30): como no
    // escala, en precios bajos se come todo — sobre USD 1 el recargo necesario
    // para netear el precio es del 37%.
    const parsed = parseInt(priceUsdInput.replace(/[^0-9]/g, ''), 10);
    const motivo = priceUsdError(priceUsdInput);
    if (motivo) {
      Alert.alert('Precio inválido', motivo);
      return;
    }
    if (parsed === profile?.price_usd) return;   // nada que guardar

    setSavingPriceUsd(true);
    const { data, error } = await supabase
      .from('coaches')
      .update({ price_usd: parsed })
      .eq('profile_id', user.id)
      .select('price_usd');
    setSavingPriceUsd(false);

    if (error || !data || data.length === 0) {
      Alert.alert('No se pudo guardar', 'Probá de nuevo en unos minutos');
      return;
    }
    setProfile(prev => prev ? { ...prev, price_usd: parsed } : prev);
    setPriceUsdInput(String(parsed));
  }

  function openBioEditor() {
    setBioInput(profile?.bio ?? '');
    setEditingBio(true);
  }

  async function saveBio() {
    if (!user) return;
    const trimmed = bioInput.trim();

    // Anti-fuga: la presentación es pública, no puede ser un canal para derivar la
    // relación fuera de la app (teléfono, redes, mail, links, CBU/transferencia).
    if (trimmed && hasContactInfo(trimmed)) {
      Alert.alert(
        'Sacá los datos de contacto',
        'Para tu seguridad y la de los usuarios, la presentación no puede incluir teléfono, redes, mail, links ni datos para pagar por fuera. Mantené la conversación y las reservas dentro de VIVE.',
      );
      return;
    }

    setSavingBio(true);
    const { data, error } = await supabase
      .from('coaches')
      .update({ bio: trimmed || null })
      .eq('profile_id', user.id)
      .select('bio');
    setSavingBio(false);

    // Si RLS bloquea el UPDATE, Postgrest devuelve 0 filas sin error
    if (error || !data || data.length === 0) {
      Alert.alert('No se pudo guardar', 'Probá de nuevo en unos minutos');
      return;
    }

    setProfile(prev => prev ? { ...prev, bio: trimmed || null } : prev);
    setEditingBio(false);
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
      Alert.alert('No se pudo guardar', 'Probá de nuevo en unos minutos');
    }
  }

  // 🔴 Ya NO hay toggle de "sesiones del exterior". `accepts_international` pasó
  // a ser una columna DERIVADA (`scripts/add-payout-rails.sql`): la mantiene un
  // trigger a partir de tener un riel de cobro en dólares configurado y un precio
  // en dólares cargado. El `update` desde la app está revocado a propósito.
  //
  // El motivo: como casilla podía contradecir a los datos — se podía activar sin
  // precio en dólares, y entonces el catálogo lo anunciaba y la pantalla de pago
  // no le podía cobrar. Derivándola, ese estado deja de existir.

  async function toggleAvailability(value: boolean) {
    if (!user || savingAvailability) return;
    const newStatus: 'activo' | 'en_pausa' = value ? 'activo' : 'en_pausa';
    setProfile(prev => prev ? { ...prev, availability_status: newStatus } : prev);
    setSavingAvailability(true);
    const { error } = await supabase
      .from('coaches')
      .update({ availability_status: newStatus })
      .eq('profile_id', user.id);
    setSavingAvailability(false);
    if (error) {
      setProfile(prev => prev ? { ...prev, availability_status: newStatus === 'activo' ? 'en_pausa' : 'activo' } : prev);
      Alert.alert('No se pudo guardar', 'Probá de nuevo en unos minutos');
    }
  }

  async function connectMercadoPago() {
    if (connectingMp || noCoachProfile) return;
    setConnectingMp(true);
    try {
      // Guardarraíl al RECONECTAR (mpConnected=true): coach_mp_accounts guarda un
      // solo token vivo por coach, sin historial — si hay un pago cobrado con la
      // cuenta ACTUAL que todavía puede necesitar reembolso, cambiar de cuenta lo
      // deja huérfano (mp-process-refunds intenta con el token nuevo un pago que
      // pertenece a la cuenta vieja, MP contesta 404 "Payment not found"; pasó de
      // verdad en sesión 88, ver CHANGELOG_SESIONES.md). No aplica al primer
      // connect: sin cuenta conectada todavía no hay nada que pueda orfanarse.
      if (mpConnected && coachId) {
        const { count } = await supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('coach_id', coachId)
          .in('payment_status', ['aprobado', 'reembolso_pendiente']);
        if ((count ?? 0) > 0) {
          Alert.alert(
            'Todavía no podés cambiar de cuenta',
            'Tenés pagos cobrados o reembolsos pendientes de resolver con la cuenta actual. Si cambiás ahora, esos quedan sin poder reembolsarse automáticamente. Esperá a que se resuelvan (o cancelen) antes de reconectar.',
          );
          return;
        }
      }
      const { data, error } = await supabase.functions.invoke('mp-oauth-start');
      if (error || !data?.url) {
        Alert.alert(
          'No disponible aún',
          'La integración con Mercado Pago estará disponible próximamente. Te avisamos cuando esté lista',
        );
        return;
      }
      // preferEphemeralSession: sesión sin cookies compartidas → MP siempre pide
      // login, no reusa la sesión anterior (clave para conectar cuentas distintas).
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        'viveapp://coach/mp-connected',
        { preferEphemeralSession: true },
      );
      if (result.type === 'success') {
        setMpConnected(true);
      }
    } catch {
      Alert.alert('Error', 'No se pudo conectar con Mercado Pago. Intentá de nuevo');
    } finally {
      setConnectingMp(false);
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
        Alert.alert('No se pudo subir el video', 'Probá de nuevo en unos minutos');
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
        Alert.alert('Video subido', 'Pero no se pudo guardar en tu perfil. Probá de nuevo');
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
      Alert.alert('Permiso necesario', 'Activá el permiso desde los ajustes del celular para continuar');
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
        Alert.alert('No se pudo subir la foto', 'Probá de nuevo en unos minutos');
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
        Alert.alert('Foto subida', 'Pero no se pudo guardar en tu perfil. Probá de nuevo');
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
      Alert.alert('Permiso necesario', 'Activá el permiso desde los ajustes del celular para continuar');
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

  const intlConfigurado = !!profile && (
    profile.accepts_international || profile.price_usd != null ||
    profile.accepts_paypal || profile.accepts_usdt
  );
  const intlAbiertoReal = intlAbierto ?? intlConfigurado;

  const faltaInternacional = profile
    ? faltaParaInternacional(profile.price_usd, profile.accepts_paypal, profile.accepts_usdt)
    : null;

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
      <View style={s.topBar}>
        <TouchableOpacity
          onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(coach)'); }}
          hitSlop={10}
          activeOpacity={0.7}
          style={s.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#565E32" />
        </TouchableOpacity>
      </View>
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
                <MaterialCommunityIcons name="camera-outline" size={16} color={ViveColors.onPrimaryInk} />
              )}
            </TouchableOpacity>
          </View>

          <Text style={s.coachName}>
            {loadingProfile ? '…' : (profile?.name || '—')}
          </Text>

          {noCoachProfile ? (
            <Text style={s.emptyCoachText}>Todavía no completaste tu perfil de profesional</Text>
          ) : (
            <>
              {profile?.specialty ? (
                <Text style={s.coachSpecialty}>{profile.specialty}</Text>
              ) : null}
              {profile?.nationality ? (
                <Text style={s.coachMeta}>{profile.nationality}</Text>
              ) : null}
            </>
          )}

          <TouchableOpacity style={s.editProfileBtn} activeOpacity={0.75} onPress={() => router.push('/edit-profile')}>
            {/* Dice QUÉ edita. "Editar perfil" a secas competía con la
                presentación, los temas y el video, que se editan acá mismo sin
                salir — y no había forma de saber cuál de las dos cosas hacía. */}
            <Text style={s.editProfileBtnText}>Editar nombre y foto</Text>
          </TouchableOpacity>
        </View>

        <View style={s.groupHead}>
          <Text style={s.groupTitle}>Tu perfil público</Text>
          <Text style={s.groupHint}>Lo que ve quien entra a tu perfil</Text>
        </View>

        {/* ── Presentación ──────────────────────────────────── */}
        <Text style={s.sectionTitle}>Presentación</Text>
        <View style={s.bioCard}>
          {editingBio ? (
            <View>
              <TextInput
                style={s.bioInput}
                value={bioInput}
                onChangeText={t => setBioInput(t.slice(0, 400))}
                placeholder="Contale a quien te visita quién sos y cómo acompañás. Un par de líneas alcanzan"
                placeholderTextColor="rgba(135,131,92,0.45)"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                autoFocus
              />
              <Text style={s.bioCount}>{bioInput.length}/400</Text>
              <View style={s.priceEditActions}>
                <TouchableOpacity
                  style={s.priceCancelBtn}
                  onPress={() => setEditingBio(false)}
                  disabled={savingBio}
                  activeOpacity={0.75}
                >
                  <Text style={s.priceCancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.priceSaveBtn}
                  onPress={saveBio}
                  disabled={savingBio}
                  activeOpacity={0.85}
                >
                  {savingBio ? (
                    <ActivityIndicator size="small" color={ViveColors.onPrimaryInk} />
                  ) : (
                    <Text style={s.priceSaveBtnText}>Guardar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={s.bioRow}
              onPress={openBioEditor}
              activeOpacity={0.75}
              disabled={noCoachProfile}
            >
              {profile?.bio ? (
                <Text style={s.bioText}>{profile.bio}</Text>
              ) : (
                <Text style={s.bioPlaceholder}>Agregá una presentación breve sobre vos</Text>
              )}
              <MaterialCommunityIcons name="pencil-outline" size={16} color={ViveColors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Temas ─────────────────────────────────────────── */}
        <Text style={[s.sectionTitle, s.sectionSpaced]}>Temas que trabajo</Text>
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

        <View style={s.groupHead}>
          <Text style={s.groupTitle}>Tu trabajo</Text>
          <Text style={s.groupHint}>Cuándo atendés, cuánto cobrás y cómo te pagan</Text>
        </View>

        {/* ── Horarios ──────────────────────────────────────── */}
        {/* 🔴 Antes esta sección se llamaba "Disponibilidad", y esa palabra
            nombraba TRES cosas distintas en la app: este interruptor (que en
            realidad decide si APARECÉS), las franjas horarias de
            `/coach-availability`, y el patrón semanal de adentro de esa. El
            coach que se quería pausar una semana tenía que adivinar entre las
            tres. Ahora cada una dice lo que hace. */}
        <Text style={s.sectionTitle}>Tus horarios</Text>
        <TouchableOpacity
          style={s.availBtn}
          onPress={() => router.push('/coach-availability')}
          activeOpacity={0.75}
        >
          <MaterialCommunityIcons name="calendar-clock" size={18} color={ViveColors.primary} />
          <Text style={s.availBtnText}>Ver y editar tus franjas</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color="rgba(135,131,92,0.58)" />
        </TouchableOpacity>

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
                    <ActivityIndicator size="small" color={ViveColors.onPrimaryInk} />
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
                ? 'Los usuarios reservan directamente sin esperar tu aprobación'
                : 'Cada reserva requiere tu confirmación antes de quedar fijada'}
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

        {/* ── Mercado Pago ──────────────────────────────────── */}
        <Text style={[s.sectionTitle, s.sectionSpaced]}>Mercado Pago</Text>
        <View style={s.toggleCard}>
          <View style={s.toggleInfo}>
            <Text style={s.toggleTitle}>
              {mpConnected ? 'Cuenta conectada' : 'Sin cuenta conectada'}
            </Text>
            <Text style={s.toggleDesc}>
              {mpConnected
                ? 'Los usuarios pueden pagarte directamente desde la app'
                : 'Conectá tu cuenta para recibir pagos a través de la app'}
            </Text>
          </View>
          {mpConnected ? (
            <View style={s.mpConnectedRow}>
              <MaterialCommunityIcons name="check-circle-outline" size={24} color={ViveColors.accent} />
              {/* Reconectar = OAuth con sesión efímera (fuerza login limpio) → el
                  callback hace upsert sobre coach_id y sobreescribe el token con la
                  cuenta nueva. No hace falta desconectar antes. */}
              <TouchableOpacity
                onPress={connectMercadoPago}
                disabled={connectingMp || noCoachProfile}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {connectingMp ? (
                  <ActivityIndicator size="small" color="#009EE3" />
                ) : (
                  <Text style={s.mpSwitchText}>Cambiar</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={s.mpConnectBtn}
              onPress={connectMercadoPago}
              disabled={connectingMp || noCoachProfile}
              activeOpacity={0.85}
            >
              {connectingMp ? (
                <ActivityIndicator size="small" color="#009EE3" />
              ) : (
                <Text style={s.mpConnectBtnText}>Conectar</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Comisión decreciente — incentiva sostener la relación en la app (anti-fuga).
            Sin IVA a propósito (depende de la figura fiscal, TBD). */}
        <View style={s.commissionCard}>
          <MaterialCommunityIcons name="trending-down" size={18} color={ViveColors.accent} />
          <Text style={s.commissionText}>
            <Text style={s.commissionStrong}>20%</Text> en la primera sesión con cada persona y{' '}
            <Text style={s.commissionStrong}>15%</Text> de la segunda en adelante. Te cobramos por
            presentarte a alguien nuevo, no por la relación que construís después: el contador es por
            persona y nunca se reinicia.
          </Text>
        </View>

        {/* ── Sesiones desde el exterior ────────────────────── */}
        <Text style={[s.sectionTitle, s.sectionSpaced]}>Sesiones desde el exterior</Text>

        {/* 🔴 Es un DESPLEGABLE, no un interruptor de la función.
            `accepts_international` es una columna DERIVADA (precio en dólares
            cargado + algún riel aceptado): un switch acá prometería prender algo
            que en realidad se prende solo, y dejaría al coach mirando
            "Activadas" con el catálogo diciendo lo contrario. Lo que se pliega
            es la VISTA, no el estado.
            ⚠️ Y por eso lo de adentro NO puede colgar de `accepts_international`:
            esconder el campo del precio detrás de la columna que se deriva DE
            ese precio es el circuito cerrado que ya arreglamos una vez. Cuelga
            de `intlAbiertoReal`, que es estado de pantalla y arranca abierto si
            ya hay algo cargado. */}
        <TouchableOpacity
          style={s.toggleCard}
          onPress={() => setIntlAbierto(!intlAbiertoReal)}
          activeOpacity={0.85}>
          <View style={s.toggleInfo}>
            <Text style={s.toggleTitle}>
              {profile?.accepts_international ? 'Activadas' : 'Desactivadas'}
            </Text>
            <Text style={s.toggleDesc}>
              {profile?.accepts_international
                ? 'Atendé a personas que viven afuera. Tus horarios no cambian.'
                : 'Se activan solas cuando tengas precio en dólares y un medio de cobro.'}
            </Text>
          </View>
          <MaterialCommunityIcons
            name={intlAbiertoReal ? 'chevron-up' : 'chevron-down'}
            size={22}
            color="rgba(135,131,92,0.6)"
          />
        </TouchableOpacity>

        {/* El aviso de qué falta queda AFUERA del pliegue: es el motivo para
            abrirlo. Escondido adentro, el coach cierra la sección y no se
            entera de que no está apareciendo. */}
        {faltaInternacional && (
          <View style={s.commissionCard}>
            <MaterialCommunityIcons name="alert-outline" size={18} color="#8C4A31" />
            <Text style={s.commissionText}>{faltaInternacional}</Text>
          </View>
        )}

        {intlAbiertoReal && (
          <>
            {/* Precio en dólares. Lo fija el coach, no se convierte desde el
                precio en pesos: el de afuera es una decisión comercial distinta,
                y una conversión dejaría a VIVE en el medio de la discusión de
                cotización cada vez que se mueve el dólar. */}
            <View style={[s.toggleCard, s.stackedCard]}>
              <View style={s.toggleInfo}>
                <Text style={s.toggleTitle}>Precio en dólares</Text>
              </View>
              <View style={s.usdRow}>
                <Text style={s.usdPrefix}>US$</Text>
                <TextInput
                  style={s.usdInput}
                  // ⚠️ `value={priceUsdInput}` a secas, sin `|| precio guardado`.
                  // Con el fallback, borrar el campo lo dejaba vacío por un
                  // instante y volvía a mostrar el valor guardado, así que era
                  // IMPOSIBLE vaciarlo: lo que se tipeaba quedaba pegado
                  // adelante del número viejo.
                  value={priceUsdInput}
                  onChangeText={setPriceUsdInput}
                  onBlur={savePriceUsd}
                  placeholder="50"
                  placeholderTextColor="rgba(135,131,92,0.45)"
                  keyboardType="number-pad"
                  maxLength={5}
                />
                {savingPriceUsd && <ActivityIndicator size="small" color={ViveColors.primary} />}
              </View>
            </View>

            <TouchableOpacity
              style={[s.toggleCard, s.stackedCard]}
              onPress={() => router.push('/coach-datos-cobro')}
              activeOpacity={0.85}
            >
              <View style={s.toggleInfo}>
                <Text style={s.toggleTitle}>Cómo te pagamos</Text>
                <Text style={s.toggleDesc}>
                  {rielesTexto(!!profile?.accepts_paypal, !!profile?.accepts_usdt)}
                </Text>
              </View>
              <MaterialIcons name="arrow-forward-ios" size={16} color="rgba(135,131,92,0.6)" />
            </TouchableOpacity>
          </>
        )}

        <View style={s.groupHead}>
          <Text style={s.groupTitle}>Cómo te encuentran</Text>
          <Text style={s.groupHint}>Si aparecés y en qué lugar</Text>
        </View>

        {/* ── Pausar el perfil ──────────────────────────────── */}
        <Text style={s.sectionTitle}>Aparecer en búsquedas</Text>
        <View style={s.toggleCard}>
          <View style={s.toggleInfo}>
            <Text style={s.toggleTitle}>
              {profile?.availability_status === 'activo' ? 'Aparecés' : 'En pausa'}
            </Text>
            <Text style={s.toggleDesc}>
              {profile?.availability_status === 'activo'
                ? 'Aparecés en búsquedas y podés recibir nuevas reservas'
                : 'No aparecés en búsquedas. Tus sesiones actuales no se ven afectadas'}
            </Text>
          </View>
          <Switch
            value={profile?.availability_status === 'activo'}
            onValueChange={toggleAvailability}
            disabled={noCoachProfile || savingAvailability}
            trackColor={{ false: `${ViveColors.text}25`, true: ViveColors.accent }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={`${ViveColors.text}25`}
          />
        </View>

        {/* 🔴 `/coach-visibilidad` vivía SOLO en Home, a pesar de ser la
            respuesta a "¿por qué no aparezco?" — la misma pregunta que hace el
            interruptor de acá arriba. Se agrega acá y se DEJA la tarjeta de
            Home: esa es un aviso proactivo con contenido propio (en cuántas
            puertas estás, qué te falta), y esta pantalla no es configuración
            sino diagnóstico. Dos puertas a un ESTADO está bien; dos puertas a
            una misma ACCIÓN era el problema, y ese ya se sacó. */}
        <TouchableOpacity
          style={[s.availBtn, { marginTop: 8 }]}
          onPress={() => router.push('/coach-visibilidad')}
          activeOpacity={0.75}
        >
          <MaterialCommunityIcons name="compass-outline" size={18} color={ViveColors.primary} />
          <Text style={s.availBtnText}>Cómo te encuentran</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color="rgba(135,131,92,0.58)" />
        </TouchableOpacity>

        {/* Los títulos son lo primero que mira alguien que no te conoce, así que
            la entrada vive al lado de la visibilidad y no enterrada en ajustes. */}
        <TouchableOpacity
          style={[s.availBtn, { marginTop: 8 }]}
          onPress={() => router.push('/coach-credenciales')}
          activeOpacity={0.75}
        >
          <MaterialCommunityIcons name="school-outline" size={18} color={ViveColors.primary} />
          <Text style={s.availBtnText}>Tus títulos y matrícula</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color="rgba(135,131,92,0.58)" />
        </TouchableOpacity>

        <View style={s.groupHead}>
          <Text style={s.groupTitle}>Tu reputación</Text>
          <Text style={s.groupHint}>Lo que dejaron las personas que atendiste</Text>
        </View>

        {/* ── Reseñas recibidas ─────────────────────────────── */}
        <Text style={s.sectionTitle}>Reseñas recibidas</Text>
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
  usdRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  usdPrefix: { fontFamily: ViveFonts.semibold, fontSize: 14, color: 'rgba(135,131,92,0.75)' },
  usdInput: {
    minWidth: 62, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10,
    backgroundColor: 'rgba(255,248,240,0.72)',
    fontFamily: ViveFonts.semibold, fontSize: 15, color: '#565E32', textAlign: 'right',
  },

  safe: { flex: 1 },
  topBar: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 2 },
  backBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
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
    // Botón de solo ícono: no lo agarró la barrida porque no tiene estilo de
    // texto. Su ícono estaba en 1.78:1 mientras su propio spinner ya venía en
    // crema — el mismo botón se contradecía.
    backgroundColor: ViveColors.primaryInk,
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
  bioCard: {
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    padding: 16,
    marginBottom: 4,
  },
  bioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bioText: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: '#565E32',
    lineHeight: 21,
  },
  bioPlaceholder: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: 'rgba(135,131,92,0.65)',
    lineHeight: 21,
  },
  bioInput: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: '#565E32',
    lineHeight: 21,
    minHeight: 88,
  },
  bioCount: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: 'rgba(135,131,92,0.6)',
    textAlign: 'right',
    marginTop: 4,
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

  // Encabezado de GRUPO — un nivel por encima de `sectionTitle`. Existe porque
  // esta pantalla es un scroll largo con doce secciones, y sin jerarquía todas
  // pesan igual: cobrar en pesos quedaba visualmente al mismo nivel que el
  // video de perfil. El grupo contesta la pregunta que se hace el coach ("¿cómo
  // cobro?") y las secciones de adentro son las partes de esa respuesta.
  groupHead: {
    paddingHorizontal: 20,
    marginTop: 34,
    marginBottom: 10,
    gap: 2,
  },
  groupTitle: {
    fontFamily: ViveFonts.bold,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: 'rgba(86,94,50,0.55)',
  },
  groupHint: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: 'rgba(135,131,92,0.85)',
  },

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
    backgroundColor: ViveColors.primaryInk,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 18,
    minWidth: 80,
    alignItems: 'center',
  },
  priceSaveBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: '#F7EFE4',
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
  // `toggleCard` no trae margen propio arriba a propósito: la mayoría de los
  // usos van pegados debajo de un `sectionTitle` (que ya trae `sectionSpaced`)
  // y sumar otro margen ahí daría un salto de más. Pero cuando un `toggleCard`
  // sigue a OTRA tarjeta (`commissionCard` u otro `toggleCard`) en vez de a un
  // título, esa tarjeta anterior solo empuja espacio hacia ARRIBA de sí misma
  // (`commissionCard.marginTop`), no hacia abajo — así que sin esto quedan
  // pegadas. Ej.: "Sesiones desde el exterior" en `CoachProfileScreen`, donde
  // "Precio en dólares" y "Cómo te pagamos" quedaban tocando la tarjeta de
  // arriba. Mismo valor que `commissionCard.marginTop`, para que el espaciado
  // sea igual venga de un lado o del otro.
  stackedCard: { marginTop: 10 },
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
  commissionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(86,94,50,0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(86,94,50,0.12)',
    padding: 14,
    marginHorizontal: 20,
    marginTop: 10,
    gap: 10,
  },
  commissionText: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: '#87835C',
    lineHeight: 18,
  },
  commissionStrong: {
    fontFamily: ViveFonts.semibold,
    color: '#565E32',
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

  // Mercado Pago
  mpConnectBtn: {
    backgroundColor: 'rgba(0,158,227,0.10)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,158,227,0.28)',
    minWidth: 44,
    alignItems: 'center',
  },
  mpConnectBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: '#009EE3',
  },
  mpConnectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mpSwitchText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: '#009EE3',
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

  blockedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 14,
  },
  blockedText: {
    fontFamily: ViveFonts.medium,
    fontSize: 14,
    color: '#87835C',
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
