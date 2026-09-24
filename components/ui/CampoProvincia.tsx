// Selector de provincia argentina (24/09/2026), para "desde dónde atendés" en
// la postulación. Lista fija de las 24 jurisdicciones: de la provincia depende
// qué matrícula corresponde (provincial o nacional) y no puede ser texto libre.

import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveFonts } from '@/constants/theme';
import { sheetStyles } from '@/components/ui/sheetStyles';

export const PROVINCIAS_AR = [
  'Ciudad de Buenos Aires', 'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes',
  'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén',
  'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero',
  'Tierra del Fuego', 'Tucumán',
];

export default function CampoProvincia({ value, onChange }: { value: string; onChange: (p: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <TouchableOpacity
        style={s.campo}
        onPress={() => setAbierto(true)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={value ? `Provincia: ${value}. Tocá para cambiarla` : 'Elegí la provincia'}>
        <Text style={[s.valor, !value && s.placeholder]} numberOfLines={1}>{value || 'Elegí la provincia'}</Text>
        <MaterialCommunityIcons name="chevron-down" size={20} color="rgba(135,131,92,0.7)" />
      </TouchableOpacity>

      <Modal visible={abierto} animationType="slide" transparent onRequestClose={() => setAbierto(false)}>
        <View style={sheetStyles.flex}>
          <TouchableOpacity style={sheetStyles.overlay} activeOpacity={1} onPress={() => setAbierto(false)} />
          <View style={[sheetStyles.sheet, s.hoja]}>
            <View style={sheetStyles.handle} />
            <Text style={s.titulo}>¿En qué provincia?</Text>
            <ScrollView style={s.lista}>
              {PROVINCIAS_AR.map(p => (
                <TouchableOpacity
                  key={p}
                  style={s.fila}
                  onPress={() => { onChange(p); setAbierto(false); }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected: p === value }}>
                  <Text style={[s.filaTxt, p === value && s.filaTxtOn]}>{p}</Text>
                  {p === value && <MaterialCommunityIcons name="check" size={18} color="#565E32" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  campo: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.65)',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
  },
  valor: { flex: 1, fontFamily: ViveFonts.regular, fontSize: 15, color: '#565E32' },
  placeholder: { color: 'rgba(135,131,92,0.55)' },
  hoja: { maxHeight: '75%' },
  titulo: { fontFamily: ViveFonts.semibold, fontSize: 17, color: '#565E32', marginBottom: 12 },
  lista: { flexGrow: 0 },
  fila: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(86,94,50,0.08)',
  },
  filaTxt: { fontFamily: ViveFonts.regular, fontSize: 15, color: '#565E32' },
  filaTxtOn: { fontFamily: ViveFonts.semibold, color: '#3A4F2A' },
});
