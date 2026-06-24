import { ImageBackground, StyleSheet } from 'react-native';

export function AppBg() {
  return (
    <ImageBackground
      source={require('@/assets/bg-aurora.jpg')}
      style={StyleSheet.absoluteFill}
      resizeMode="cover"
    />
  );
}
