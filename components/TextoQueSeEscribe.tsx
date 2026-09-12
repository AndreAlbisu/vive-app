// El texto de Sofía, palabra por palabra.
//
// 🔴 POR QUÉ. La tarjeta de Inicio mostraba primero el texto de las reglas y,
// uno o dos segundos después, lo reemplazaba DE GOLPE por el que redacta la IA.
// Que las palabras entren de a una convierte ese cambio en algo que se lee como
// Sofía escribiendo, y no como la pantalla corrigiéndose.
//
// ⚠️ SOLO CUANDO EL TEXTO ES NUEVO. Quien lo usa le pone `key` = el texto: la
// animación corre al montar, y volver a la pestaña no remonta nada. Animar cada
// visita a Inicio sería cobrarle la animación a alguien que la ve decenas de
// veces por día.
//
// 📌 CADA PALABRA ES SU PROPIO `Animated.Text`, en una fila que envuelve. No se
// puede animar la opacidad de un tramo DENTRO de un `<Text>`: iOS arma el
// párrafo entero como una sola pieza. La accesibilidad no cambia: el contenedor
// de la tarjeta es `accessible` con la frase completa en `accessibilityLabel`,
// así que un lector de pantalla no lee fragmentos.
//
// Con "reducir movimiento" se dibuja igual que antes, de una.

import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';
import { agruparPalabras, type Tramo } from '@/lib/agruparPalabras';

export type { Tramo } from '@/lib/agruparPalabras';

// Curva de salida fuerte: la palabra ya está casi entera en el primer tercio.
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const FUNDIDO_MS = 260;
const PASO_MS = 35;
// Una frase de 30 palabras terminaría a ~1,3 s; se corta antes para que nunca
// haya que esperar a Sofía.
const TOPE_MS = 900;

export function TextoQueSeEscribe({
  tramos,
  style,
  fuerteStyle,
  sinMovimiento,
}: {
  tramos: Tramo[];
  style: StyleProp<TextStyle>;
  fuerteStyle: StyleProp<TextStyle>;
  sinMovimiento: boolean;
}) {
  if (sinMovimiento) {
    return (
      <Text style={style}>
        {tramos.map((t, i) => (t.fuerte ? <Text key={i} style={fuerteStyle}>{t.texto}</Text> : t.texto))}
      </Text>
    );
  }

  // Los márgenes van al contenedor: en cada palabra, un `marginTop` separaría
  // de más cada renglón.
  const { marginTop, marginBottom, marginHorizontal, marginVertical, margin, ...texto } =
    StyleSheet.flatten(style) ?? {};

  return (
    <View style={[s.fila, { marginTop, marginBottom, marginHorizontal, marginVertical, margin }]}>
      {agruparPalabras(tramos).map((palabra, i) => (
        <Animated.Text
          key={i}
          style={texto}
          entering={FadeIn.duration(FUNDIDO_MS).delay(Math.min(i * PASO_MS, TOPE_MS)).easing(EASE_OUT)}
        >
          {palabra.map((p, j) => (p.fuerte ? <Text key={j} style={fuerteStyle}>{p.t}</Text> : p.t))}
        </Animated.Text>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', flexWrap: 'wrap' },
});
