import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  intensity?: number;
};

export function GlassCard({ children, style, intensity = 36 }: Props) {
  const flat = StyleSheet.flatten([s.base, style]) as ViewStyle;

  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={intensity} tint="light" style={flat}>
        {children}
      </BlurView>
    );
  }
  return (
    <View style={[flat, s.android]}>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  base: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
    overflow: 'hidden',
  },
  android: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});
