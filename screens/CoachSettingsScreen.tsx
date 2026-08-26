import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveFonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { AppBg } from '@/components/ui/AppBg';
import { deleteMyAccount } from '@/lib/accountDeletion';

/**
 * Ajustes de la APP para el coach — lo que no es "ser profesional en VIVE".
 *
 * 🔴 Esta pantalla NO existía, y no era solo un problema de organización: el
 * coach no tenía forma de llegar a los Términos, a la Política de privacidad,
 * al botón de arrepentimiento ni a dar de baja su cuenta. Todo eso vivía en
 * `ProfileOwnScreen`, que es la pantalla del USUARIO — y un coach nunca la ve,
 * porque `AuthRedirect` lo manda a `(coach)` y `/perfil` le renderiza
 * `CoachProfileScreen`. Dos de esas ausencias son de cumplimiento y no de gusto:
 *
 *   · **Eliminar mi cuenta** — guideline 5.1.1(v) de Apple: toda app con
 *     registro tiene que permitir borrar la cuenta desde adentro, o la rechazan.
 *     `deleteMyAccount()` YA contemplaba al coach (devuelve `coach_con_sesiones`
 *     si tiene sesiones agendadas), o sea que el backend lo previó desde el
 *     principio y la pantalla nunca lo expuso.
 *   · **Botón de arrepentimiento** — Res. 424/2020. Está en la lista del usuario
 *     y hasta en la de invitado, que es lo que la norma pide; faltaba justo en
 *     la del coach, que es quien cobra.
 *
 * La división con `CoachProfileScreen` es por dueño de la pregunta: **el perfil
 * es cómo te ven y cómo trabajás; los ajustes son tu cuenta en la app**.
 */
type ConfigItem = {
  id: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  danger?: boolean;
  onPress: () => void;
};

export default function CoachSettingsScreen() {
  const router = useRouter();
  const { signOut, isAdmin } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSignOut() {
    await signOut();
    router.replace('/');
  }

  // Misma baja que la del usuario y por el mismo camino: `deleteMyAccount` ya
  // distingue el caso del coach con sesiones agendadas, que no puede darse de
  // baja hasta cancelarlas — cada cancelación avisa y reembolsa.
  async function handleDeleteAccount() {
    setDeleting(true);
    const res = await deleteMyAccount();
    setDeleting(false);

    if (res.ok) {
      setDeleteOpen(false);
      await signOut();
      router.replace('/');
      return;
    }
    if (res.reason === 'coach_con_sesiones') {
      setDeleteOpen(false);
      Alert.alert('Tenés sesiones agendadas', res.message);
      return;
    }
    Alert.alert('No se pudo eliminar', res.message);
  }

  // 📝 `/edit-profile` NO está acá aunque suene a "datos de la cuenta". Edita
  // nombre, foto, nacionalidad y fecha de nacimiento — y de esos, los tres
  // primeros son PÚBLICOS (salen en el catálogo y en el perfil que ve el
  // usuario). Su puerta es la tarjeta de identidad del perfil, que es donde se
  // los ve. Ponerla también acá sería el mismo defecto que se acaba de sacar de
  // la sección de sesiones del exterior: dos accesos al mismo destino con dos
  // nombres distintos.
  const cuenta: ConfigItem[] = [
    { id: 'blocked', icon: 'account-cancel-outline', label: 'Cuentas bloqueadas', onPress: () => router.push('/cuentas-bloqueadas') },
    // Solo para admins. Esconderlo no es la protección —`admin-actions` revalida
    // contra el JWT en cada escritura— pero no tiene sentido mostrar una puerta
    // que no se puede abrir. Mismo criterio que en la pantalla del usuario.
    ...(isAdmin ? [{ id: 'admin', icon: 'shield-account-outline' as const, label: 'Administración', onPress: () => router.push('/admin') }] : []),
  ];

  const legales: ConfigItem[] = [
    { id: 'terms', icon: 'file-document-outline', label: 'Términos y condiciones', onPress: () => router.push('/legal?doc=terminos') },
    { id: 'privacy', icon: 'lock-outline', label: 'Política de privacidad', onPress: () => router.push('/legal?doc=privacidad') },
    { id: 'regret', icon: 'undo-variant', label: 'Botón de arrepentimiento', onPress: () => router.push('/legal?doc=arrepentimiento') },
  ];

  const salida: ConfigItem[] = [
    { id: 'logout', icon: 'logout', label: 'Cerrar sesión', danger: true, onPress: handleSignOut },
    { id: 'delete', icon: 'trash-can-outline', label: 'Eliminar mi cuenta', danger: true, onPress: () => setDeleteOpen(true) },
  ];

  const lista = (items: ConfigItem[]) => (
    <View style={s.list}>
      {items.map((item, i) => (
        <TouchableOpacity
          key={item.id}
          style={[s.row, i < items.length - 1 && s.rowDivider]}
          onPress={item.onPress}
          activeOpacity={0.72}
        >
          <MaterialCommunityIcons
            name={item.icon}
            size={20}
            color={item.danger ? '#E05252' : '#87835C'}
            style={s.rowIcon}
          />
          <Text style={[s.rowLabel, item.danger && s.rowLabelDanger]}>{item.label}</Text>
          {!item.danger && (
            <MaterialCommunityIcons name="chevron-right" size={20} color="rgba(135,131,92,0.52)" />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <AppBg>
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(coach)'); }}
            style={s.backBtn}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color="#565E32" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Ajustes</Text>
          <View style={s.headerSide} />
        </View>

        <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
          {/* El puntero al perfil va acá y no al revés: quien entra a "Ajustes"
              buscando su precio o sus horarios tiene que encontrar el camino,
              no un callejón. Es un puntero, no un duplicado — nada de lo que
              vive en el perfil se edita desde esta pantalla. */}
          <TouchableOpacity style={s.pointer} onPress={() => router.push('/perfil')} activeOpacity={0.85}>
            <MaterialCommunityIcons name="account-circle-outline" size={22} color="#565E32" />
            <View style={{ flex: 1 }}>
              <Text style={s.pointerTitle}>Tu perfil profesional</Text>
              <Text style={s.pointerDesc}>Presentación, precios, horarios y cómo te pagamos</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="rgba(135,131,92,0.52)" />
          </TouchableOpacity>

          <Text style={s.groupTitle}>Tu cuenta</Text>
          {lista(cuenta)}

          <Text style={[s.groupTitle, s.groupSpaced]}>Legales</Text>
          {lista(legales)}

          <View style={s.salidaWrap}>{lista(salida)}</View>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Confirmación de baja. Se detalla qué se borra y qué se CONSERVA: lo
            segundo es lo que sorprende, y dejarlo solo en la política no alcanza.
            El texto es el del coach, no el del usuario: lo que se le conserva a
            un profesional son sus reseñas y las reservas de OTRA gente. */}
        <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => setDeleteOpen(false)}>
          <View style={s.delOverlay}>
            <View style={s.delCard}>
              <MaterialCommunityIcons name="alert-circle-outline" size={28} color="#C0392B" />
              <Text style={s.delTitle}>Eliminar tu cuenta</Text>
              <Text style={s.delBody}>
                Esta acción no se puede deshacer. Se borran tu perfil profesional, tu
                presentación, tus temas, tus horarios y tus datos de cobro.
              </Text>
              <Text style={s.delBody}>
                Se conservan de forma anónima las reservas —por obligaciones contables— y
                las reseñas y conversaciones, que figurarán como &quot;Usuario eliminado&quot;.
              </Text>
              <Text style={s.delBody}>
                Si tenés sesiones agendadas no vas a poder darte de baja hasta cancelarlas:
                cada cancelación le avisa a la persona y le devuelve su dinero.
              </Text>

              <TouchableOpacity
                style={[s.delConfirmBtn, deleting && { opacity: 0.6 }]}
                onPress={handleDeleteAccount}
                disabled={deleting}
                activeOpacity={0.85}>
                {deleting
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Text style={s.delConfirmText}>Sí, eliminar mi cuenta</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={s.delCancelBtn}
                onPress={() => setDeleteOpen(false)}
                disabled={deleting}
                activeOpacity={0.8}>
                <Text style={s.delCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: { minWidth: 40 },
  headerSide: { minWidth: 40 },
  headerTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: '#565E32',
  },
  container: { paddingHorizontal: 20, paddingTop: 8 },

  pointer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 28,
  },
  pointerTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#565E32',
  },
  pointerDesc: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: '#87835C',
    marginTop: 2,
  },

  groupTitle: {
    fontFamily: ViveFonts.bold,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: 'rgba(86,94,50,0.55)',
    marginBottom: 10,
  },
  groupSpaced: { marginTop: 28 },

  list: {
    backgroundColor: 'rgba(255,248,240,0.48)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(86,94,50,0.14)',
  },
  rowIcon: { marginRight: 12 },
  rowLabel: {
    flex: 1,
    fontFamily: ViveFonts.medium,
    fontSize: 15,
    color: '#565E32',
  },
  rowLabelDanger: { color: '#E05252' },

  salidaWrap: { marginTop: 28 },

  delOverlay: {
    flex: 1,
    backgroundColor: 'rgba(20,8,38,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  delCard: {
    width: '100%',
    backgroundColor: '#F7EFE4',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  delTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 18,
    color: '#565E32',
  },
  delBody: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: '#87835C',
    textAlign: 'center',
  },
  delConfirmBtn: {
    marginTop: 8,
    alignSelf: 'stretch',
    backgroundColor: '#C0392B',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  delConfirmText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  delCancelBtn: { paddingVertical: 10 },
  delCancelText: {
    fontFamily: ViveFonts.medium,
    fontSize: 14,
    color: '#87835C',
  },
});
