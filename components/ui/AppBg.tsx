import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/theme/tokens';
import { mixHex } from '@/constants/theme';

type Props = {
  children: React.ReactNode;
  /**
   * Tiñe el fondo con el color del camino elegido en la bifurcación. Solo lo
   * pasan las pantallas del onboarding: el resto de la app usa el fondo de
   * siempre.
   */
  tono?: string | null;
};

export function AppBg({ children, tono }: Props) {
  // Mismo gesto que `colors.bgGrad` —del claro al apagado, en diagonal— pero
  // partiendo del tono. Se deriva en vez de listar colores nuevos para que el
  // fondo teñido siga siendo el mismo fondo y no otro diseño.
  const grad = tono
    ? ([mixHex(tono, 0.35), tono, mixHex(tono, -0.05)] as const)
    : colors.bgGrad;

  return (
    <LinearGradient
      colors={grad}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={s.root}
    >
      {children}
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, width: '100%', height: '100%' },
});
