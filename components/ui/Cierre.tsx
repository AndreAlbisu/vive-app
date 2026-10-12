import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { vibrarGuardado, vibrarLogro } from '@/lib/vibracion';

// El final de una práctica (respiración, meditación, etc.). Antes el contenido
// de "terminaste" reemplazaba al anterior de golpe y en silencio, y quien tenía
// los ojos cerrados no se enteraba. Ahora vibra y entra suave, las dos cosas en
// el mismo instante.
//
// Sin rebote a propósito: sube unos pocos puntos mientras aparece y se queda.

const ENTRA_MS = 420;
const SUBE_PX = 10;

export function Cierre({
  children,
  style,
  tono = 'logro',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  // 'suave' para lo que termina llevando al descanso (sueño): avisa sin despertar.
  tono?: 'logro' | 'suave';
}) {
  const reduced = useReducedMotion();
  const entra = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (tono === 'suave') vibrarGuardado();
    else vibrarLogro();
    Animated.timing(entra, {
      toValue: 1,
      duration: ENTRA_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // Solo al montarse: es el instante en que la práctica termina.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const translateY = entra.interpolate({ inputRange: [0, 1], outputRange: [SUBE_PX, 0] });

  return (
    <Animated.View
      style={[style, { opacity: entra }, !reduced && { transform: [{ translateY }] }]}
    >
      {children}
    </Animated.View>
  );
}
