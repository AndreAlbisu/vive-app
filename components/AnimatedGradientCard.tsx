import { useRef, useEffect } from 'react';
import { View, Animated, Easing, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// VIVE brand colors used for aurora effect
const C = {
  terracota: '#E8743B',
  verde: '#6BBF8A',
  azul: '#5B8DB8',
} as const;

type Props = {
  style?: ViewStyle | ViewStyle[];
  children: React.ReactNode;
};

export function AnimatedGradientCard({ style, children }: Props) {
  const anim1 = useRef(new Animated.Value(0)).current; // period 9s
  const anim2 = useRef(new Animated.Value(0)).current; // period 7s, naturally out of phase

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim1, { toValue: 1, duration: 4500, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(anim1, { toValue: 0, duration: 4500, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(anim2, { toValue: 1, duration: 3500, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(anim2, { toValue: 0, duration: 3500, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const layer1Style = {
    opacity: anim1.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.88, 0] }),
    transform: [
      { translateX: anim1.interpolate({ inputRange: [0, 1], outputRange: [-28, 28] }) },
      { translateY: anim1.interpolate({ inputRange: [0, 1], outputRange: [-14, 14] }) },
    ],
  };

  const layer2Style = {
    opacity: anim2.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.72, 0] }),
    transform: [
      { translateX: anim2.interpolate({ inputRange: [0, 1], outputRange: [22, -22] }) },
      { translateY: anim2.interpolate({ inputRange: [0, 1], outputRange: [11, -11] }) },
    ],
  };

  return (
    <View style={[style, { overflow: 'hidden' }]}>
      {/* Static base: terracota → azul */}
      <LinearGradient
        colors={[C.terracota, C.azul]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Layer 1: azul → verde, barre en diagonal */}
      <Animated.View style={[StyleSheet.absoluteFill, layer1Style]}>
        <LinearGradient
          colors={[C.azul, C.verde]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {/* Layer 2: verde → terracota, barre en sentido contrario */}
      <Animated.View style={[StyleSheet.absoluteFill, layer2Style]}>
        <LinearGradient
          colors={[C.verde, C.terracota]}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {/* Velo oscuro muy sutil para legibilidad */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.10)' }]} />
      {children}
    </View>
  );
}
