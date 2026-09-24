// Selector de nacionalidad (24/09/2026). Reemplaza al campo de texto libre que
// había en la postulación y en editar perfil.
//
// 🔴 El problema del texto libre no era la comodidad, era el DATO: cada persona
// escribía lo suyo ("argentino", "Argentina ", "arg") y esa columna la lee el
// filtro de nacionalidad del buscador, que compara texto exacto. Con tres formas
// de escribir el mismo país, el filtro deja afuera a gente que sí corresponde.
//
// 📌 Lista y búsqueda en `constants/paises.ts`. Acá solo la hoja.

import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Modal, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveFonts } from '@/constants/theme';
import { sheetStyles } from '@/components/ui/sheetStyles';
import { buscarPaises } from '@/constants/paises';

interface Props {
  value: string;
  onChange: (pais: string) => void;
  /** Texto cuando todavía no eligió. */
  placeholder?: string;
}

export default function CampoNacionalidad({ value, onChange, placeholder = 'Elegí tu nacionalidad' }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [query, setQuery] = useState('');
  const { frecuentes, resto } = useMemo(() => buscarPaises(query), [query]);
  const vacio = frecuentes.length === 0 && resto.length === 0;

  function elegir(pais: string) {
    onChange(pais);
    setAbierto(false);
    setQuery('');
  }

  return (
    <>
      <TouchableOpacity
        style={s.campo}
        onPress={() => setAbierto(true)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={value ? `Nacionalidad: ${value}. Tocá para cambiarla` : placeholder}>
        <Text style={[s.valor, !value && s.placeholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={20} color="rgba(135,131,92,0.7)" />
      </TouchableOpacity>

      <Modal visible={abierto} animationType="slide" transparent onRequestClose={() => setAbierto(false)}>
        <View style={sheetStyles.flex}>
          <TouchableOpacity style={sheetStyles.overlay} activeOpacity={1} onPress={() => setAbierto(false)} />
          <View style={[sheetStyles.sheet, s.hoja]}>
            <View style={sheetStyles.handle} />
            <Text style={s.titulo}>¿Cuál es tu nacionalidad?</Text>

            <TextInput
              style={s.buscador}
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar país"
              placeholderTextColor="rgba(135,131,92,0.55)"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />

            <ScrollView style={s.lista} keyboardShouldPersistTaps="handled">
              {vacio && <Text style={s.sinResultados}>No encontramos ese país. Probá con otro nombre.</Text>}

              {frecuentes.length > 0 && (
                <>
                  {!query && <Text style={s.grupo}>Más comunes</Text>}
                  {frecuentes.map(p => (
                    <Fila key={p} pais={p} elegido={p === value} onPress={() => elegir(p)} />
                  ))}
                </>
              )}

              {resto.length > 0 && (
                <>
                  {!query && <Text style={s.grupo}>Todos los países</Text>}
                  {resto.map(p => (
                    <Fila key={p} pais={p} elegido={p === value} onPress={() => elegir(p)} />
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Fila({ pais, elegido, onPress }: { pais: string; elegido: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={s.fila}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected: elegido }}>
      <Text style={[s.filaTxt, elegido && s.filaTxtOn]}>{pais}</Text>
      {elegido && <MaterialCommunityIcons name="check" size={18} color="#565E32" />}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.65)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  valor: { flex: 1, fontFamily: ViveFonts.regular, fontSize: 15, color: '#565E32' },
  placeholder: { color: 'rgba(135,131,92,0.65)' },

  // Alto fijo: sin esto la hoja crece con la lista y tapa la pantalla entera.
  hoja: { maxHeight: '80%' },
  titulo: { fontFamily: ViveFonts.semibold, fontSize: 17, color: '#565E32', marginBottom: 12 },
  buscador: {
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: 'rgba(86,94,50,0.16)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: '#565E32',
    marginBottom: 8,
  },
  lista: { marginHorizontal: -4 },
  grupo: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: 'rgba(135,131,92,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(86,94,50,0.08)',
  },
  filaTxt: { fontFamily: ViveFonts.regular, fontSize: 15.5, color: '#565E32' },
  filaTxtOn: { fontFamily: ViveFonts.semibold },
  sinResultados: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: 'rgba(135,131,92,0.85)',
    paddingVertical: 20,
    textAlign: 'center',
  },
});
