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
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { ViveFonts } from '@/constants/theme';
import { REPORT_REASONS, submitReport, type ReportReason } from '@/lib/reports';
import { sheetStyles } from '@/components/ui/sheetStyles';

interface Props {
  visible: boolean;
  onClose: () => void;
  reportedName: string;
  reportedId: string;
  salaId?: string | null;
  onSubmitted?: () => void;
}

export default function ReportSheet({ visible, onClose, reportedName, reportedId, salaId, onSubmitted }: Props) {
  const { user } = useAuth();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (visible) { setReason(null); setDetails(''); setSending(false); }
  }, [visible]);

  // "Otro" exige contar qué pasó; el resto es opcional.
  const needsDetails = reason === 'otro';
  const canSend = !!reason && !sending && (!needsDetails || details.trim().length > 0);

  async function handleSend() {
    if (!user || !reason || !canSend) return;
    setSending(true);
    const ok = await submitReport(user.id, { reportedId, reason, details, salaId });
    setSending(false);
    if (!ok) {
      Alert.alert('No se pudo enviar', 'Probá de nuevo en unos minutos');
      return;
    }
    onClose();
    onSubmitted?.();
    Alert.alert('Gracias por avisarnos', 'Nuestro equipo va a revisar tu reporte.');
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={sheetStyles.flex}>
        <TouchableOpacity style={sheetStyles.overlay} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={sheetStyles.sheet}>
            <View style={sheetStyles.handle} />
            <Text style={s.title}>Reportar a {reportedName}</Text>
            <Text style={s.subtitle}>Contanos qué pasó. Tu reporte es privado y lo revisa nuestro equipo.</Text>

            <Text style={s.label}>Motivo</Text>
            {REPORT_REASONS.map(r => {
              const on = reason === r.key;
              return (
                <TouchableOpacity
                  key={r.key}
                  style={[s.reasonRow, on && s.reasonRowActive]}
                  onPress={() => setReason(r.key)}
                  activeOpacity={0.75}>
                  <MaterialCommunityIcons
                    name={on ? 'radiobox-marked' : 'radiobox-blank'}
                    size={20}
                    color={on ? '#3A4F2A' : 'rgba(135,131,92,0.55)'}
                  />
                  <Text style={[s.reasonText, on && s.reasonTextActive]}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}

            <TextInput
              style={s.input}
              placeholder={needsDetails ? 'Contanos qué pasó' : 'Agregá un detalle (opcional)'}
              placeholderTextColor="rgba(135,131,92,0.55)"
              value={details}
              onChangeText={setDetails}
              multiline
              maxLength={500}
            />

            <TouchableOpacity
              style={[s.sendBtn, !canSend && s.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!canSend}
              activeOpacity={0.85}>
              <Text style={s.sendBtnText}>{sending ? 'Enviando…' : 'Enviar reporte'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  title: {
    fontFamily: ViveFonts.title,
    fontSize: 20, color: '#3A4F2A', marginBottom: 6,
  },
  subtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 13, color: 'rgba(135,131,92,0.95)', lineHeight: 18, marginBottom: 18,
  },
  label: {
    fontFamily: ViveFonts.medium,
    fontSize: 13, color: '#3A4F2A', marginBottom: 10,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,248,240,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    marginBottom: 8,
  },
  reasonRowActive: {
    backgroundColor: 'rgba(58,79,42,0.08)',
    borderColor: 'rgba(58,79,42,0.30)',
  },
  reasonText: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 14, color: '#87835C',
  },
  reasonTextActive: {
    fontFamily: ViveFonts.medium,
    color: '#3A4F2A',
  },
  input: {
    marginTop: 8,
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
  sendBtn: {
    backgroundColor: '#B5533A',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: 'rgba(181,83,58,0.35)' },
  sendBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15, color: '#F3EEDF',
  },
});
