// AyudaAhoraLink — el acceso a las líneas de crisis ANTES de tener cuenta.
//
// 🔴 Existe por la decisión del 17/09/2026 de pedir la cuenta al entrar. Hasta
// ese día, a la pantalla de crisis se llegaba desde el Perfil, que andaba sin
// cuenta. Con el Perfil detrás del registro, alguien en crisis que abría la app
// por primera vez no tenía ningún camino a los números: la pantalla estaba
// habilitada sin cuenta, pero nada llevaba a ella.
//
// Va en las pantallas previas a la cuenta (bifurcación, registro, login).
// Discreto a propósito —no puede competir con la decisión que esas pantallas
// piden—, pero siempre visible: la necesidad no espera a que la persona se
// registre. Mismo criterio que `AyudaScreen`: no pregunta nada, lleva y ya.

import { Pressable, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ViveFonts } from '@/constants/theme';

export function AyudaAhoraLink({ color = '#3F512F' }: { color?: string }) {
  const router = useRouter();
  return (
    <Pressable
      style={s.fila}
      onPress={() => router.push('/ayuda')}
      hitSlop={10}
      accessibilityRole="link"
      accessibilityLabel="¿Necesitás ayuda ahora? Ver líneas de ayuda en crisis">
      <MaterialCommunityIcons name="lifebuoy" size={15} color={color} />
      <Text style={[s.texto, { color }]}>¿Necesitás ayuda ahora?</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  texto: { fontFamily: ViveFonts.medium, fontSize: 13, textDecorationLine: 'underline' },
});
