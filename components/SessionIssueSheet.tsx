import { useEffect, useState } from 'react';
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
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveFonts } from '@/constants/theme';
import { sheetStyles } from '@/components/ui/sheetStyles';
import {
  PLAZO_RESPUESTA,
  getProblemaSesion,
  motivosPara,
  reportarProblema,
  textoEstado,
  type MotivoProblema,
  type ProblemaSesion,
  type RolProblema,
} from '@/lib/sessionIssues';

interface Props {
  visible: boolean;
  onClose: () => void;
  bookingId: string;
  rol: RolProblema;
  /** Estado de la sesión en la Sala ("live", "finalizada"…), va al contexto técnico. */
  estadoSesion?: string;
  /** Avisa si hay un caso, para que la Sala cambie el texto del acceso. */
  onCambio?: (tieneCaso: boolean) => void;
}

/**
 * "Tengo un problema con esta sesión". Si la persona ya reportó, muestra su caso
 * y la respuesta; si no, el formulario. Sirve antes, durante y después del
 * horario, y **no pide calificar a nadie**: quien no pudo entrar no tiene por
 * qué ponerle estrellas a una atención que no recibió.
 */
export default function SessionIssueSheet({ visible, onClose, bookingId, rol, estadoSesion, onCambio }: Props) {
  const [loading, setLoading] = useState(false);
  const [caso, setCaso] = useState<ProblemaSesion | null>(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [motivo, setMotivo] = useState<MotivoProblema | null>(null);
  const [detalle, setDetalle] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !bookingId) return;
    let vivo = true;
    setLoading(true);
    setError(null);
    setMotivo(null);
    setDetalle('');
    getProblemaSesion(bookingId).then(c => {
      if (!vivo) return;
      setCaso(c);
      setFormAbierto(!c);
      setLoading(false);
    });
    return () => { vivo = false; };
  }, [visible, bookingId]);

  async function enviar() {
    if (!motivo || enviando) return;
    setEnviando(true);
    setError(null);
    const res = await reportarProblema({ bookingId, motivo, detalle, estadoSesion });
    if (res.ok || res.yaAbierto) {
      const c = await getProblemaSesion(bookingId);
      setCaso(c);
      setFormAbierto(false);
      onCambio?.(!!c);
    } else {
      setError('tope' in res && res.tope
        ? 'Mandaste varios reportes seguidos. Esperá un rato; ya estamos mirando los que llegaron.'
        : 'No se pudo enviar. Revisá tu conexión y probá de nuevo.');
    }
    setEnviando(false);
  }

  const motivos = motivosPara(rol);
  const labelMotivo = (m: MotivoProblema) => motivos.find(x => x.valor === m)?.label ?? m;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={sheetStyles.flex}>
        <TouchableOpacity style={sheetStyles.overlay} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={sheetStyles.sheet}>
            <View style={sheetStyles.handle} />

            {loading ? (
              <ActivityIndicator size="small" color="#3A4F2A" style={{ marginVertical: 28 }} />
            ) : (
              <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {caso && !formAbierto ? (
                  <>
                    <Text style={s.title}>Tu reporte</Text>
                    <View style={s.estadoRow}>
                      <MaterialCommunityIcons
                        name={caso.estado === 'resuelto' ? 'check-circle-outline' : 'clock-outline'}
                        size={16}
                        color="#3A4F2A"
                      />
                      <Text style={s.estado}>{textoEstado(caso.estado)}</Text>
                    </View>
                    <Text style={s.meta}>{labelMotivo(caso.motivo)}</Text>
                    {!!caso.detalle && <Text style={s.detalle}>{caso.detalle}</Text>}

                    {caso.respuesta ? (
                      <View style={s.respuestaBox}>
                        <Text style={s.respuestaLabel}>Respuesta de Vita</Text>
                        <Text style={s.respuesta}>{caso.respuesta}</Text>
                      </View>
                    ) : (
                      <Text style={s.hint}>
                        Te respondemos en {PLAZO_RESPUESTA}. Te avisamos con una notificación y por mail, y la respuesta aparece acá.
                      </Text>
                    )}

                    {caso.estado === 'resuelto' && (
                      <TouchableOpacity onPress={() => setFormAbierto(true)} activeOpacity={0.7}>
                        <Text style={s.link}>Reportar otro problema</Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={s.title}>¿Qué pasó con esta sesión?</Text>
                    <Text style={s.hint}>
                      Lo lee el equipo de Vita, no {rol === 'cliente' ? 'tu profesional' : 'la persona'}. Te respondemos en {PLAZO_RESPUESTA}.
                    </Text>

                    {motivos.map(m => {
                      const elegido = motivo === m.valor;
                      return (
                        <TouchableOpacity
                          key={m.valor}
                          style={[s.opcion, elegido && s.opcionOn]}
                          onPress={() => setMotivo(m.valor)}
                          activeOpacity={0.85}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: elegido }}>
                          <Text style={[s.opcionText, elegido && s.opcionTextOn]}>{m.label}</Text>
                        </TouchableOpacity>
                      );
                    })}

                    <TextInput
                      style={s.input}
                      placeholder="Si querés, contanos un poco más (opcional)"
                      placeholderTextColor="rgba(135,131,92,0.55)"
                      value={detalle}
                      onChangeText={setDetalle}
                      multiline
                      maxLength={500}
                    />

                    {!!error && <Text style={s.error}>{error}</Text>}

                    <TouchableOpacity
                      style={[s.btn, (!motivo || enviando) && s.btnDisabled]}
                      onPress={enviar}
                      disabled={!motivo || enviando}
                      activeOpacity={0.85}>
                      <Text style={s.btnText}>{enviando ? 'Enviando…' : 'Enviar'}</Text>
                    </TouchableOpacity>
                  </>
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
  title: {
    fontFamily: ViveFonts.title,
    fontSize: 20, color: '#3A4F2A', marginBottom: 8,
  },
  hint: {
    fontFamily: ViveFonts.regular,
    fontSize: 13, lineHeight: 19, color: '#87835C', marginBottom: 16,
  },
  opcion: {
    borderWidth: 1,
    borderColor: 'rgba(86,94,50,0.18)',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 8,
    backgroundColor: 'rgba(255,248,240,0.55)',
  },
  opcionOn: { borderColor: '#3A4F2A', backgroundColor: 'rgba(58,79,42,0.08)' },
  opcionText: { fontFamily: ViveFonts.medium, fontSize: 14, color: '#565E32' },
  opcionTextOn: { color: '#3A4F2A' },
  input: {
    minHeight: 72,
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.60)',
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: '#3A4F2A',
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  error: { fontFamily: ViveFonts.regular, fontSize: 13, color: '#B4533E', marginBottom: 12 },
  btn: {
    backgroundColor: '#3A4F2A',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnDisabled: { backgroundColor: 'rgba(58,79,42,0.35)' },
  btnText: { fontFamily: ViveFonts.semibold, fontSize: 15, color: '#F3EEDF' },
  estadoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  estado: { fontFamily: ViveFonts.semibold, fontSize: 14, color: '#3A4F2A' },
  meta: { fontFamily: ViveFonts.medium, fontSize: 13, color: '#87835C', marginBottom: 6 },
  detalle: { fontFamily: ViveFonts.regular, fontSize: 14, lineHeight: 20, color: '#565E32', marginBottom: 14 },
  respuestaBox: {
    backgroundColor: 'rgba(255,248,240,0.75)',
    borderRadius: 14,
    padding: 14,
    marginVertical: 10,
  },
  respuestaLabel: { fontFamily: ViveFonts.semibold, fontSize: 12, color: '#87835C', marginBottom: 6 },
  respuesta: { fontFamily: ViveFonts.regular, fontSize: 14, lineHeight: 20, color: '#3A4F2A' },
  link: {
    fontFamily: ViveFonts.medium,
    fontSize: 14, color: '#3A4F2A', textDecorationLine: 'underline',
    marginTop: 12, paddingVertical: 6,
  },
});
