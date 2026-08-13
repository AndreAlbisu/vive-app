// Cuentas bloqueadas — la lista de a quién bloqueé y el único lugar donde se
// desbloquea sin tener que volver al perfil o al chat de la persona.
//
// Apple pide (guideline 1.2) que bloquear sea posible; que sea reversible desde
// un lugar fijo es lo que evita que un bloqueo por error deje al usuario sin
// forma obvia de deshacerlo — desde el catálogo ya no lo ve, y el chat le
// muestra el aviso pero puede no acordarse de que el menú "⋯" existe.

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Platform, FlatList, Image,
  ActivityIndicator, StatusBar, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ViveColors, ViveFonts } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';
import { useAuth } from '@/context/AuthContext';
import { listBlocked, unblockUser, type BlockedProfile } from '@/lib/blocking';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function BlockedAccountsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [rows, setRows] = useState<BlockedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setRows(await listBlocked(user.id));
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  function confirmUnblock(row: BlockedProfile) {
    const firstName = row.name.split(' ')[0] || row.name;
    Alert.alert(
      `¿Desbloquear a ${firstName}?`,
      'Van a poder volver a escribirse y a reservar sesiones.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desbloquear',
          onPress: async () => {
            if (!user) return;
            setWorking(row.id);
            const ok = await unblockUser(user.id, row.id);
            setWorking(null);
            if (!ok) {
              Alert.alert('No se pudo desbloquear', 'Probá de nuevo en unos minutos.');
              return;
            }
            setRows(prev => prev.filter(r => r.id !== row.id));
          },
        },
      ],
    );
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
          <Text style={s.headerTitle}>Cuentas bloqueadas</Text>
          <View style={s.headerSpacer} />
        </View>

        <FlatList
          data={rows}
          keyExtractor={r => r.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            rows.length > 0 ? (
              <Text style={s.intro}>
                No pueden escribirte ni reservar sesiones con vos, y vos tampoco con ellos.
                No saben que los bloqueaste.
              </Text>
            ) : null
          }
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator size="small" color={ViveColors.primary} style={{ marginTop: 40 }} />
            ) : (
              <View style={s.empty}>
                <MaterialIcons name="block" size={40} color="rgba(135,131,92,0.45)" />
                <Text style={s.emptyTitle}>No bloqueaste a nadie</Text>
                <Text style={s.emptyText}>
                  Podés bloquear a alguien desde su perfil o desde el menú “⋯” de la conversación.
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <View style={s.card}>
              {item.avatarUrl ? (
                <Image source={{ uri: item.avatarUrl }} style={s.avatarImage} />
              ) : (
                <View style={s.avatar}>
                  <MaterialIcons name="person" size={28} color="#C0BAB4" />
                </View>
              )}
              <View style={s.cardInfo}>
                <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
                <Text style={s.cardMeta}>Bloqueado el {formatDate(item.createdAt)}</Text>
              </View>
              <TouchableOpacity
                style={s.unblockBtn}
                onPress={() => confirmUnblock(item)}
                disabled={working === item.id}
                activeOpacity={0.75}>
                {working === item.id
                  ? <ActivityIndicator size="small" color="#565E32" />
                  : <Text style={s.unblockText}>Desbloquear</Text>}
              </TouchableOpacity>
            </View>
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
  intro: {
    fontFamily: ViveFonts.regular,
    fontSize: 13, color: 'rgba(135,131,92,0.95)',
    lineHeight: 19, marginBottom: 4,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,248,240,0.80)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    padding: 14,
    gap: 12,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(192,186,180,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImage: { width: 48, height: 48, borderRadius: 24 },
  cardInfo: { flex: 1, gap: 3 },
  cardName: { fontFamily: ViveFonts.semibold, fontSize: 15, color: '#3A4F2A' },
  cardMeta: { fontFamily: ViveFonts.regular, fontSize: 12.5, color: 'rgba(135,131,92,0.95)' },
  unblockBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(86,94,50,0.30)',
    minWidth: 104,
    alignItems: 'center',
  },
  unblockText: { fontFamily: ViveFonts.medium, fontSize: 13.5, color: '#565E32' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 24 },
  emptyTitle: {
    fontFamily: ViveFonts.semibold, fontSize: 16,
    color: '#565E32', textAlign: 'center', marginTop: 6,
  },
  emptyText: {
    fontFamily: ViveFonts.regular, fontSize: 13.5,
    color: 'rgba(135,131,92,0.95)', textAlign: 'center', lineHeight: 19,
  },
});
