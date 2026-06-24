import { ImageBackground, StyleSheet } from 'react-native';

type Props = { children: React.ReactNode };

export function AppBg({ children }: Props) {
  return (
    <ImageBackground
      source={require('@/assets/bg-aurora.jpg')}
      style={styles.root}
      resizeMode="cover"
    >
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', height: '100%' },
});
