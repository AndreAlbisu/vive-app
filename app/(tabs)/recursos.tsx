import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ViveColors, ViveFonts } from '@/constants/theme';
import { FirstTimeTooltip } from '@/components/FirstTimeTooltip';

export default function RecursosScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FirstTimeTooltip
        storageKey="vive_tooltip_recursos"
        icon="book-open-outline"
        title="Recursos para vos"
        description="Videos, audios y guías seleccionados según tu camino. Guardá los que más te sirvan."
        delay={800}
      />
      <View style={styles.container}>
        <Text style={styles.title}>Recursos</Text>
        <Text style={styles.subtitle}>Próximamente — contenido en camino.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: ViveColors.background,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontFamily: ViveFonts.semibold,
    fontSize: 26,
    color: ViveColors.text,
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: ViveColors.text,
    opacity: 0.55,
    textAlign: 'center',
  },
});
