// Selector de fecha de nacimiento (24/09/2026). Reemplaza al campo donde había
// que tipear DD/MM/AAAA a mano en la postulación y en editar perfil.
//
// 🔴 Por qué importa más de lo que parece: esa fecha es la que prueba la mayoría
// de edad (T&C §3.1) y la que el profesional ve como edad del cliente. Tipeada a
// mano se equivoca sola —un dedo en el año y alguien nace en 2019— y el
// formulario solo se daba cuenta si el resultado era imposible.
//
// 📌 Usa `@react-native-community/datetimepicker`, que YA ESTÁ en el cliente de
// desarrollo (lo usan la agenda del profesional y los recordatorios). No suma
// una dependencia nativa nueva: esa es justamente la trampa que rompió la app
// con el llavero el 23/09.
//
// Las dos plataformas se comportan distinto y por eso están separadas: en
// Android el selector es un diálogo del sistema que se abre y se cierra solo; en
// iOS es una rueda que hay que montar adentro de algo, acá una hoja con su botón
// de confirmar.

import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveFonts } from '@/constants/theme';
import { sheetStyles } from '@/components/ui/sheetStyles';

interface Props {
  /** `yyyy-mm-dd`, o vacío si todavía no eligió. */
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
}

/** Fecha por defecto al abrir: 30 años atrás, que es donde está la mayoría y
 *  ahorra una vuelta larga de rueda. */
function porDefecto(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 30);
  return d;
}

function isoADate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateAIso(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Lo que se lee en el campo: 24/09/1994. */
export function fechaVisible(iso: string): string {
  const d = isoADate(iso);
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function CampoFecha({ value, onChange, placeholder = 'Elegí tu fecha de nacimiento' }: Props) {
  const [abierto, setAbierto] = useState(false);
  // Lo que la rueda muestra mientras la persona gira, antes de confirmar.
  const [borrador, setBorrador] = useState<Date>(() => isoADate(value) ?? porDefecto());

  // 🔴 El tope es HOY y no "hace 18 años": el mínimo de edad se valida al
  // enviar, con su mensaje. Si el selector directamente no dejara elegir, quien
  // tiene 17 no entendería por qué no puede y pensaría que la app está rota.
  const hoy = new Date();

  function abrir() {
    setBorrador(isoADate(value) ?? porDefecto());
    setAbierto(true);
  }

  function onChangeAndroid(event: DateTimePickerEvent, elegida?: Date) {
    setAbierto(false);
    if (event.type === 'dismissed' || !elegida) return;
    onChange(dateAIso(elegida));
  }

  const texto = fechaVisible(value);

  return (
    <>
      <TouchableOpacity
        style={s.campo}
        onPress={abrir}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={texto ? `Fecha de nacimiento: ${texto}. Tocá para cambiarla` : placeholder}>
        <MaterialCommunityIcons name="calendar-blank-outline" size={18} color="rgba(135,131,92,0.75)" />
        <Text style={[s.valor, !texto && s.placeholder]}>{texto || placeholder}</Text>
      </TouchableOpacity>

      {abierto && Platform.OS === 'android' && (
        <DateTimePicker
          mode="date"
          value={borrador}
          maximumDate={hoy}
          onChange={onChangeAndroid}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={abierto} animationType="slide" transparent onRequestClose={() => setAbierto(false)}>
          <View style={sheetStyles.flex}>
            <TouchableOpacity style={sheetStyles.overlay} activeOpacity={1} onPress={() => setAbierto(false)} />
            <View style={sheetStyles.sheet}>
              <View style={sheetStyles.handle} />
              <Text style={s.titulo}>Tu fecha de nacimiento</Text>
              <DateTimePicker
                mode="date"
                display="spinner"
                value={borrador}
                maximumDate={hoy}
                locale="es-AR"
                textColor="#565E32"
                onChange={(_e, elegida) => { if (elegida) setBorrador(elegida); }}
              />
              <TouchableOpacity
                style={s.confirmar}
                onPress={() => { onChange(dateAIso(borrador)); setAbierto(false); }}
                activeOpacity={0.85}
                accessibilityRole="button">
                <Text style={s.confirmarTxt}>Listo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const s = StyleSheet.create({
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.65)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  valor: { flex: 1, fontFamily: ViveFonts.regular, fontSize: 15, color: '#565E32' },
  placeholder: { color: 'rgba(135,131,92,0.65)' },
  titulo: { fontFamily: ViveFonts.semibold, fontSize: 17, color: '#565E32', marginBottom: 4 },
  confirmar: {
    backgroundColor: '#565E32',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  confirmarTxt: { fontFamily: ViveFonts.semibold, fontSize: 16, color: '#F7EFE4' },
});
