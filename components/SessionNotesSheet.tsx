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
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { ViveFonts } from '@/constants/theme';
import { getSessionNotes, saveSessionNote, type SessionNote } from '@/lib/sessionNotes';
import { fechaLegiblePaquete } from '@/lib/paquete';
import { supabase } from '@/lib/supabase';
import { detectContactInfo, hasDatosDeCobro } from '@/lib/contactInfoGuard';
import { registrarEvento } from '@/lib/supabase';
import { sheetStyles } from '@/components/ui/sheetStyles';

interface Props {
  visible: boolean;
  onClose: () => void;
  bookingId: string;
  userId: string;        // el cliente
  clientName: string;
  /** Todas las notas de la relación (las que ya carga la Sala). El historial
   *  muestra las de OTRAS sesiones; las de esta se editan arriba. */
  history?: SessionNote[];
  onSaved?: () => void;
}

type SesionConNotas = { bookingId: string; fecha: string; privada?: string; compartida?: string };

/** Agrupa por sesión y ordena de la más reciente a la más vieja. La fecha es la
 *  de la SESIÓN (`scheduled_date`), no la de la nota: el coach recuerda "la del
 *  martes", no cuándo escribió. Si la reserva no vino, cae en la de la nota. */
function agruparPorSesion(notas: SessionNote[], fechas: Record<string, string>): SesionConNotas[] {
  const porSesion: Record<string, SesionConNotas> = {};
  for (const n of notas) {
    const g = porSesion[n.bookingId] ??= {
      bookingId: n.bookingId,
      fecha: fechas[n.bookingId] ?? n.createdAt.slice(0, 10),
    };
    if (n.shared) g.compartida = n.content; else g.privada = n.content;
  }
  return Object.values(porSesion).sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** "lun 3 sep", con el año solo si no es el actual. */
function fechaDeSesion(dayKey: string): string {
  const anio = dayKey.slice(0, 4);
  const corta = fechaLegiblePaquete(dayKey);
  return anio === String(new Date().getFullYear()) ? corta : `${corta} ${anio}`;
}

export default function SessionNotesSheet({ visible, onClose, bookingId, userId, clientName, history = [], onSaved }: Props) {
  const { user } = useAuth();
  const [privateNote, setPrivateNote] = useState('');
  const [sharedNote, setSharedNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fechas, setFechas] = useState<Record<string, string>>({});

  const anteriores = history.filter(n => n.bookingId !== bookingId);
  const idsAnteriores = [...new Set(anteriores.map(n => n.bookingId))].sort().join(',');

  // Fecha de cada sesión anterior. Consulta aparte porque `session_notes` no
  // guarda la fecha de la sesión, solo la reserva.
  useEffect(() => {
    if (!visible || !idsAnteriores) return;
    let vivo = true;
    void supabase
      .from('bookings')
      .select('id, scheduled_date')
      .in('id', idsAnteriores.split(','))
      .then(({ data }) => {
        if (!vivo) return;
        setFechas(Object.fromEntries((data ?? []).map(b => [b.id as string, b.scheduled_date as string])));
      });
    return () => { vivo = false; };
  }, [visible, idsAnteriores]);

  const sesionesAnteriores = agruparPorSesion(anteriores, fechas);

  useEffect(() => {
    if (!visible || !bookingId) return;
    setLoading(true);
    getSessionNotes(bookingId)
      .then(({ privateNote, sharedNote }) => { setPrivateNote(privateNote); setSharedNote(sharedNote); })
      .finally(() => setLoading(false));
  }, [visible, bookingId]);

  // Solo se revisa la COMPARTIDA: es la que le llega a la persona. La privada la
  // ve únicamente el coach, así que ahí un teléfono no es un canal de nada.
  // Avisa y deja guardar igual, como el chat — nunca bloquea texto privado.
  function handleSave() {
    if (!user || saving) return;
    if (sharedNote.trim() && hasDatosDeCobro(sharedNote)) {
      registrarEvento('mensaje_contacto_detectado', {
        role: 'coach', canal: 'nota_compartida', senal: 'datos_de_cobro', bloqueado: true,
        booking_id: bookingId, coach_id: user.id, user_id: userId,
      });
      Alert.alert('No se pueden mandar datos para cobrar', 'Los pagos van siempre por Vita: así la persona tiene reembolso y garantía, y vos cobrás sin tener que perseguir a nadie. Sacá el CBU, el alias o el link de pago y volvé a enviar.');
      return;
    }
    const senal = sharedNote.trim() ? detectContactInfo(sharedNote) : null;
    if (!senal) { void doSave(); return; }

    const par = { role: 'coach', canal: 'nota_compartida', senal, booking_id: bookingId, coach_id: user.id, user_id: userId };
    Alert.alert(
      '¿Compartir datos de contacto?',
      `La nota que ve ${clientName || 'la persona'} parece incluir datos de contacto o de pago. Mantené la conversación y los pagos dentro de Vita.`,
      [
        { text: 'Editar', style: 'cancel', onPress: () => registrarEvento('mensaje_contacto_detectado', { ...par, sent_anyway: false }) },
        {
          text: 'Guardar igual',
          style: 'destructive',
          onPress: () => { registrarEvento('mensaje_contacto_detectado', { ...par, sent_anyway: true }); void doSave(); },
        },
      ],
    );
  }

  async function doSave() {
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
      <View style={sheetStyles.flex}>
        <TouchableOpacity style={sheetStyles.overlay} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={sheetStyles.sheet}>
            <View style={sheetStyles.handle} />
            <Text style={s.title}>Notas de la sesión</Text>

            {loading ? (
              <ActivityIndicator size="small" color="#3A4F2A" style={{ marginVertical: 28 }} />
            ) : (
              <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={s.labelRow}>
                  <MaterialCommunityIcons name="lock-outline" size={15} color="#87835C" />
                  <Text style={s.label}>Nota privada, solo para vos</Text>
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
                  <Text style={[s.label, { color: '#3A4F2A' }]}>Nota para {clientName}, la ve</Text>
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

                {sesionesAnteriores.length > 0 && (
                  <View style={s.historial}>
                    <Text style={s.historialTitle}>Sesiones anteriores con {clientName}</Text>
                    {sesionesAnteriores.map(ses => (
                      <View key={ses.bookingId} style={s.histItem}>
                        <Text style={s.histFecha}>{fechaDeSesion(ses.fecha)}</Text>
                        {ses.privada ? (
                          <View style={s.histNota}>
                            <MaterialCommunityIcons name="lock-outline" size={13} color="#87835C" style={s.histIcon} />
                            <Text style={s.histTexto}>{ses.privada}</Text>
                          </View>
                        ) : null}
                        {ses.compartida ? (
                          <View style={s.histNota}>
                            <MaterialCommunityIcons name="eye-outline" size={13} color="#3A4F2A" style={s.histIcon} />
                            <Text style={s.histTexto}>{ses.compartida}</Text>
                          </View>
                        ) : null}
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scroll: { maxHeight: 560 },
  historial: {
    marginTop: 26,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(86,94,50,0.15)',
  },
  historialTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15, color: '#3A4F2A', marginBottom: 12,
  },
  histItem: {
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 8,
  },
  histFecha: {
    fontFamily: ViveFonts.medium,
    fontSize: 12, color: '#87835C',
  },
  histNota: { flexDirection: 'row', gap: 6 },
  histIcon: { marginTop: 2 },
  histTexto: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 14, lineHeight: 20, color: '#3A4F2A',
  },
  title: {
    fontFamily: ViveFonts.title,
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
