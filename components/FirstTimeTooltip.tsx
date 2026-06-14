import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';

type Props = {
  storageKey: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor?: string;
  title: string;
  description: string;
  // Optional delay before showing (ms) — lets the screen animate in first
  delay?: number;
};

export function FirstTimeTooltip({
  storageKey,
  icon,
  iconColor = ViveColors.primary,
  title,
  description,
  delay = 600,
}: Props) {
  const [visible, setVisible] = useState(false);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(48)).current;

  useEffect(() => {
    AsyncStorage.getItem(storageKey).then((val) => {
      if (!val) {
        setTimeout(() => setVisible(true), delay);
      }
    });
  }, []);

  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 22,
        stiffness: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible]);

  function dismiss() {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 48, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false);
      AsyncStorage.setItem(storageKey, '1');
    });
  }

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        {/* Tap outside to dismiss */}
        <TouchableWithoutFeedback onPress={dismiss}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <Animated.View style={[styles.card, { transform: [{ translateY: slideAnim }] }]}>
          <View style={[styles.iconWrap, { backgroundColor: iconColor + '1A' }]}>
            <MaterialCommunityIcons name={icon} size={30} color={iconColor} />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          <TouchableOpacity style={styles.btn} onPress={dismiss} activeOpacity={0.82}>
            <Text style={styles.btnText}>Entendido</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 30, 28, 0.52)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 14,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: ViveFonts.bold,
    fontSize: 20,
    color: ViveColors.text,
    textAlign: 'center',
    lineHeight: 26,
  },
  description: {
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: ViveColors.text,
    opacity: 0.65,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  btn: {
    marginTop: 8,
    backgroundColor: ViveColors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  btnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
