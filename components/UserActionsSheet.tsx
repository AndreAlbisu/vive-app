import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Alert, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { ViveFonts } from '@/constants/theme';
import { sheetStyles } from '@/components/ui/sheetStyles';
import { blockUser, unblockUser } from '@/lib/blocking';

// Menú del "⋯": las dos acciones de moderación que Apple pide juntas
// (guideline 1.2 — reportar Y bloquear). Antes el "⋯" abría el reporte directo;
// ahora abre esto y el reporte queda como una de las opciones.
//
// Son acciones distintas a propósito y así se le explica al usuario: reportar
// nos avisa a nosotros y no cambia nada para él en el momento; bloquear corta
// el vínculo ya mismo y no nos dice nada. Lo normal es querer las dos, por eso
// después de bloquear se ofrece reportar.

interface Props {
  visible: boolean;
  onClose: () => void;
  /** profiles.id de la otra persona. */
  targetId: string;
  targetName: string;
  blocked: boolean;
  /** Abre el ReportSheet. El padre lo maneja porque la hoja de reporte es suya. */
  onReport: () => void;
  /** Se llama después de bloquear o desbloquear, con el estado nuevo. */
  onBlockChange?: (blocked: boolean) => void;
}

export default function UserActionsSheet({
  visible, onClose, targetId, targetName, blocked, onReport, onBlockChange,
}: Props) {
  const { user } = useAuth();
  const [working, setWorking] = useState(false);

  const firstName = targetName.split(' ')[0] || targetName;

  async function doBlock() {
    if (!user) return;
    setWorking(true);
    const ok = await blockUser(user.id, targetId);
    setWorking(false);
    if (!ok) {
      Alert.alert('No se pudo bloquear', 'Probá de nuevo en unos minutos.');
      return;
    }
    onBlockChange?.(true);
    onClose();
    Alert.alert(
      `Bloqueaste a ${firstName}`,
      'No van a poder escribirse ni reservar sesiones entre ustedes. Podés desbloquear cuando quieras desde tu perfil.',
      [
        { text: 'Listo', style: 'cancel' },
        { text: 'Reportar también', onPress: onReport },
      ],
    );
  }

  function confirmBlock() {
    if (!user) return;
    Alert.alert(
      `¿Bloquear a ${firstName}?`,
      'No van a poder escribirse ni reservar sesiones entre ustedes. Las sesiones ya agendadas no se cancelan solas: si querés, cancelalas aparte.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Bloquear', style: 'destructive', onPress: doBlock },
      ],
    );
  }

  async function doUnblock() {
    if (!user) return;
    setWorking(true);
    const ok = await unblockUser(user.id, targetId);
    setWorking(false);
    if (!ok) {
      Alert.alert('No se pudo desbloquear', 'Probá de nuevo en unos minutos.');
      return;
    }
    onBlockChange?.(false);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={sheetStyles.flex}>
        <TouchableOpacity style={sheetStyles.overlay} activeOpacity={1} onPress={onClose} />
        <View style={sheetStyles.sheet}>
          <View style={sheetStyles.handle} />
          <Text style={s.title}>{targetName}</Text>

          <TouchableOpacity
            style={s.row}
            onPress={() => { onClose(); onReport(); }}
            disabled={working}
            activeOpacity={0.75}>
            <MaterialCommunityIcons name="flag-outline" size={20} color="#87835C" />
            <View style={s.rowBody}>
              <Text style={s.rowLabel}>Reportar</Text>
              <Text style={s.rowHint}>Nos avisás a nosotros. {firstName} no se entera.</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.row}
            onPress={blocked ? doUnblock : confirmBlock}
            disabled={working}
            activeOpacity={0.75}>
            {working
              ? <ActivityIndicator size="small" color="#B5533A" />
              : (
                <MaterialCommunityIcons
                  name={blocked ? 'account-check-outline' : 'account-cancel-outline'}
                  size={20}
                  color={blocked ? '#87835C' : '#B5533A'}
                />
              )}
            <View style={s.rowBody}>
              <Text style={[s.rowLabel, !blocked && s.rowLabelDanger]}>
                {blocked ? `Desbloquear a ${firstName}` : `Bloquear a ${firstName}`}
              </Text>
              <Text style={s.rowHint}>
                {blocked
                  ? 'Vuelven a poder escribirse y reservar.'
                  : 'Corta el chat y las reservas entre ustedes, ya mismo.'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={s.cancelBtn} onPress={onClose} activeOpacity={0.75}>
            <Text style={s.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  title: {
    fontFamily: ViveFonts.title,
    fontSize: 20, color: '#3A4F2A', marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,248,240,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    marginBottom: 10,
  },
  rowBody: { flex: 1, gap: 3 },
  rowLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 15, color: '#3A4F2A',
  },
  rowLabelDanger: { color: '#B5533A' },
  rowHint: {
    fontFamily: ViveFonts.regular,
    fontSize: 12.5, color: 'rgba(135,131,92,0.95)', lineHeight: 17,
  },
  cancelBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  cancelText: {
    fontFamily: ViveFonts.medium,
    fontSize: 15, color: '#87835C',
  },
});
