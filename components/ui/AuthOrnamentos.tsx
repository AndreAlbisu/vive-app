import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// Ornamentos compartidos por las pantallas de autenticación (login, registro y
// la del coach). Viven acá y no en cada pantalla para que no se desincronicen:
// son marca, no decoración de una pantalla.

const LINEA = 'rgba(86,94,50,0.20)';
const PUNTO = 'rgba(86,94,50,0.42)';

/** Reglita fina con un puntito al medio, debajo del wordmark. */
export function ReglaConPunto() {
  return (
    <View style={s.reglaRow}>
      <View style={s.reglaLinea} />
      <View style={s.reglaPunto} />
      <View style={s.reglaLinea} />
    </View>
  );
}

/** Divisor de ancho completo, mismo lenguaje que la reglita: línea · punto · línea.
 *  Reemplaza a la "o" — el punto no se lee como texto y ensucia menos. */
export function DivisorConPunto() {
  return (
    <View style={s.divRow}>
      <View style={s.divLinea} />
      <View style={s.reglaPunto} />
      <View style={s.divLinea} />
    </View>
  );
}

/** Las astas, asomando por la esquina superior derecha. Es el mismo gesto de la
 *  bifurcación —líneas que nacen juntas y se abren conservando una orientación
 *  erguida— recortado en una esquina, para que la marca acompañe sin competir
 *  con el formulario. Cinco líneas anidadas, muy tenues. */
export function LineasEsquina({ opacity = 1 }: { opacity?: number }) {
  const { width, height } = useWindowDimensions();
  const alto = height * 0.30;

  const lineas = [0, 1, 2, 3, 4].map(i => {
    const k = i / 4;
    const x0 = width * (0.62 + 0.055 * k);        // entra por el borde de arriba
    const y1 = alto * (0.34 + 0.30 * k);          // sale por el borde derecho
    return `M ${x0} 0 C ${x0 + width * 0.13} ${alto * 0.16}, ${width * 0.86} ${y1 - alto * 0.12}, ${width} ${y1}`;
  });

  return (
    <View style={[s.esquina, { opacity }]} pointerEvents="none">
      <Svg width={width} height={alto}>
        {lineas.map((d, i) => (
          <Path
            key={i}
            d={d}
            fill="none"
            stroke={LINEA}
            strokeWidth={0.9 - i * 0.06}
            strokeOpacity={0.95 - i * 0.11}
          />
        ))}
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  reglaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reglaLinea: { width: 34, height: 1, backgroundColor: LINEA },
  reglaPunto: { width: 5, height: 5, borderRadius: 2.5, borderWidth: 1, borderColor: PUNTO },
  divRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 2 },
  divLinea: { flex: 1, height: 1, backgroundColor: LINEA },
  esquina: { position: 'absolute', top: 0, right: 0, left: 0 },
});
