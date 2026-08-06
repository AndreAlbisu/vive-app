import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { ViveFonts } from '@/constants/theme';
import { getSessionNotes, saveSessionNote } from '@/lib/sessionNotes';

interface Props {
  visible: boolean;
  onClose: () => void;
  bookingId: string;
  userId: string;        // el cliente
  clientName: string;
  onSaved?: () => void;
}

export default function SessionNotesSheet({ visible, onClose, bookingId, userId, clientName, onSaved }: Props) {
  const { user } = useAuth();
  const [privateNote, setPrivateNote] = useState('');
  const [sharedNote, setSharedNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !bookingId) return;
    setLoading(true);
    getSessionNotes(bookingId)
      .then(({ privateNote, sharedNote }) => { setPrivateNote(privateNote); setSharedNote(sharedNote); })
      .finally(() => setLoading(false));
  }, [visible, bookingId]);

  async function handleSave() {
    if (!user || saving) return;
    setSaving(true);
    const base = { bookingId, coachId: user.id, userId };
    const [okPriv, okShared] = await Promise.all([
      saveSessionNote({ ...base, shared: false, content: privateNote }),
      saveSessionNote({ ...base, shared: true, content: sharedNote }),
    ]);
    setSaving(false);
    if (!okPriv || !okShared) {
      Alert.alert('No se pudo guardar', 'Probá de nuevo en unos minutos');
      return;
    }
    onClose();
    onSaved?.();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.flex}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.title}>Notas de la sesión</Text>

            {loading ? (
              <ActivityIndicator size="small" color="#3A4F2A" style={{ marginVertical: 28 }} />
            ) : (
              <>
                <View style={s.labelRow}>
                  <MaterialCommunityIcons name="lock-outline" size={15} color="#87835C" />
                  <Text style={s.label}>Nota privada — solo vos</Text>
                </View>
                <TextInput
                  style={s.input}
                  placeholder="Tu registro de la sesión (el usuario no lo ve)"
                  placeholderTextColor="rgba(135,131,92,0.55)"
                  value={privateNote}
                  onChangeText={setPrivateNote}
                  multiline
                  maxLength={1000}
                />

                <View style={s.labelRow}>
                  <MaterialCommunityIcons name="eye-outline" size={15} color="#3A4F2A" />
                  <Text style={[s.label, { color: '#3A4F2A' }]}>Nota para {clientName} — la ve</Text>
                </View>
                <TextInput
                  style={s.input}
                  placeholder="Qué trabajaron, tarea para la próxima…"
                  placeholderTextColor="rgba(135,131,92,0.55)"
                  value={sharedNote}
                  onChangeText={setSharedNote}
                  multiline
                  maxLength={1000}
                />

                <TouchableOpacity
                  style={[s.saveBtn, saving && s.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.85}>
                  <Text style={s.saveBtnText}>{saving ? 'Guardando…' : 'Guardar notas'}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: '#F7EFE4',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(86,94,50,0.20)',
    alignSelf: 'center', marginBottom: 16,
  },
  title: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 20, color: '#3A4F2A', marginBottom: 18,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  label: {
    fontFamily: ViveFonts.medium,
    fontSize: 13, color: '#87835C',
  },
  input: {
    minHeight: 72,
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.60)',
    borderRadius: 14,
    padding: 14,
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: '#3A4F2A',
    textAlignVertical: 'top',
    marginBottom: 18,
  },
  saveBtn: {
    backgroundColor: '#3A4F2A',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: 'rgba(58,79,42,0.35)' },
  saveBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15, color: '#F3EEDF',
  },
});
