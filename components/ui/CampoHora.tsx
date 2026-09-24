// Campo para elegir una hora (24/09/2026). Hermano de `CampoFecha`: en iOS abre
// una hoja con la rueda y "Listo"; en Android, el diálogo del sistema.
//
// 🔴 Reemplaza al `display="compact"` de iOS en el horario semanal, que al tocar
// el botón propio montaba DEBAJO una segunda cápsula gris con la misma hora, que
// había que volver a tocar para abrir el selector. Dos controles para un solo
// dato, y el segundo sin el estilo de la app.

import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { sheetStyles } from '@/components/ui/sheetStyles';

interface Props {
  /** Lo que va arriba del valor: "Desde", "Hasta". */
  label: string;
  /** Título de la hoja en iOS. */
  titulo: string;
  value: Date | null;
  /** Dónde arranca la rueda si todavía no eligió. */
  porDefecto: Date;
  onChange: (d: Date) => void;
}

/** De a 15 minutos: nadie arranca un bloque a las 10:07, y la rueda es más corta. */
const PASO_MINUTOS = 15;

export function horaVisible(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function CampoHora({ label, titulo, value, porDefecto, onChange }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState<Date>(value ?? porDefecto);

  function abrir() {
    setBorrador(value ?? porDefecto);
    setAbierto(true);
  }

  function onChangeAndroid(event: DateTimePickerEvent, elegida?: Date) {
    setAbierto(false);
    if (event.type === 'dismissed' || !elegida) return;
    onChange(elegida);
  }

  return (
    <>
      <TouchableOpacity
        style={[s.campo, value !== null && s.campoElegido]}
        onPress={abrir}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={value ? `${label} ${horaVisible(value)}. Tocá para cambiarla` : `${label}: elegí la hora`}>
        <Text style={s.label}>{label}</Text>
        <Text style={[s.valor, value === null && s.placeholder]}>
          {value ? horaVisible(value) : '--:--'}
        </Text>
      </TouchableOpacity>

      {abierto && Platform.OS === 'android' && (
        <DateTimePicker mode="time" is24Hour value={borrador} onChange={onChangeAndroid} />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={abierto} animationType="slide" transparent onRequestClose={() => setAbierto(false)}>
          <View style={sheetStyles.flex}>
            <TouchableOpacity style={sheetStyles.overlay} activeOpacity={1} onPress={() => setAbierto(false)} />
            <View style={sheetStyles.sheet}>
              <View style={sheetStyles.handle} />
              <Text style={s.titulo}>{titulo}</Text>
              <DateTimePicker
                mode="time"
                display="spinner"
                value={borrador}
                minuteInterval={PASO_MINUTOS}
                locale="es-AR"
                textColor="#565E32"
                onChange={(_e, elegida) => { if (elegida) setBorrador(elegida); }}
              />
              <TouchableOpacity
                style={s.confirmar}
                onPress={() => { onChange(borrador); setAbierto(false); }}
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
    flex: 1,
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.65)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  campoElegido: {
    borderColor: `${ViveColors.primary}55`,
    backgroundColor: `${ViveColors.primary}0D`,
  },
  label: { fontFamily: ViveFonts.medium, fontSize: 12, color: 'rgba(135,131,92,0.85)' },
  valor: { fontFamily: ViveFonts.semibold, fontSize: 20, color: '#565E32', marginTop: 2 },
  placeholder: { color: 'rgba(135,131,92,0.5)' },
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
