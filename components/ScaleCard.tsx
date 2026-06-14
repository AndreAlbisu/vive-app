import { useRef } from 'react';
import { Animated, TouchableOpacity, TouchableOpacityProps } from 'react-native';

const AnimatedPress = Animated.createAnimatedComponent(TouchableOpacity);

export function ScaleCard({
  style,
  onPressIn,
  onPressOut,
  activeOpacity = 0.95,
  children,
  ...props
}: TouchableOpacityProps) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <AnimatedPress
      {...(props as any)}
      activeOpacity={activeOpacity}
      style={[style, { transform: [{ scale }] }] as any}
      onPressIn={(e: any) => {
        Animated.spring(scale, {
          toValue: 0.97,
          useNativeDriver: true,
          damping: 20,
          stiffness: 300,
        }).start();
        onPressIn?.(e);
      }}
      onPressOut={(e: any) => {
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          damping: 14,
          stiffness: 180,
        }).start();
        onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPress>
  );
}
