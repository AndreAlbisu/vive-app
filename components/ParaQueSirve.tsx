// El bloque "Para qué sirve" de cada herramienta (25/09/2026).
//
// 📌 Abierto la primera vez que se entra a esa herramienta y plegado después:
// quien ya la conoce no tiene que leerlo cada vez, pero puede volver a abrirlo.
// La marca es del teléfono (AsyncStorage), como las tarjetas de la guía.

import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveFonts } from '@/constants/theme';
import { PARA_QUE } from '@/constants/herramientasParaQue';

const FOREST = '#3F512F';
const FOREST_SOFT = '#566245';

const claveVista = (toolId: string) => `vita_para_que_${toolId}`;

export default function ParaQueSirve({ toolId, style }: { toolId: string; style?: object }) {
  const texto = PARA_QUE[toolId];
  // null hasta leer la marca: así no parpadea abierto para quien ya lo vio.
  const [abierto, setAbierto] = useState<boolean | null>(null);

  useEffect(() => {
    let vivo = true;
    AsyncStorage.getItem(claveVista(toolId))
      .then(v => {
        if (!vivo) return;
        setAbierto(!v);
        if (!v) AsyncStorage.setItem(claveVista(toolId), '1').catch(() => {});
      })
      .catch(() => { if (vivo) setAbierto(false); });
    return () => { vivo = false; };
  }, [toolId]);

  if (!texto || abierto === null) return null;

  return (
    <View style={[s.wrap, style]}>
      <TouchableOpacity
        style={s.head}
        onPress={() => setAbierto(a => !a)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}>
        <MaterialCommunityIcons name="information-outline" size={16} color={FOREST} />
        <Text style={s.titulo}>Para qué sirve</Text>
        <MaterialCommunityIcons name={abierto ? 'chevron-up' : 'chevron-down'} size={18} color={FOREST_SOFT} />
      </TouchableOpacity>
      {abierto && (
        <View style={s.cuerpo}>
          <Text style={s.para}>{texto.para}</Text>
          <Text style={s.linea}><Text style={s.fuerte}>Cuándo: </Text>{texto.cuando}</Text>
          <Text style={s.linea}>{texto.saber}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: 'rgba(255,248,240,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(63,81,47,0.12)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { flex: 1, fontFamily: ViveFonts.semibold, fontSize: 13.5, color: FOREST },
  cuerpo: { marginTop: 8 },
  para: { fontFamily: ViveFonts.medium, fontSize: 13.5, lineHeight: 20, color: FOREST },
  linea: { fontFamily: ViveFonts.regular, fontSize: 13, lineHeight: 19, color: FOREST_SOFT, marginTop: 6 },
  fuerte: { fontFamily: ViveFonts.semibold, color: FOREST },
});
