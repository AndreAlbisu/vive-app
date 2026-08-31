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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { guiaHabilitada, marcarVista, numeroDePaso, saltearGuia } from '@/lib/guiaContextual';

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
  // null = esta card no se cuenta (la Sala). Ver `lib/guiaContextual.ts`.
  const [paso, setPaso] = useState<{ paso: number; total: number } | null>(null);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(48)).current;

  useEffect(() => {
    let vivo = true;
    (async () => {
      // El número se lee ANTES de marcar nada, así la card dice cuántas van
      // sin contarse a sí misma.
      const [habilitada, n] = await Promise.all([
        guiaHabilitada(storageKey),
        numeroDePaso(storageKey),
      ]);
      if (!vivo || !habilitada) return;
      setPaso(n);
      setTimeout(() => { if (vivo) setVisible(true); }, delay);
    })();
    return () => { vivo = false; };
  }, [storageKey, delay]);

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
  }, [visible, fadeAnim, slideAnim]);

  /**
   * `persistir` es la diferencia entre cerrarla y darla por vista.
   *
   * 🔴 Tocar fuera cierra SIN marcarla. Antes marcaba, así que un toque
   * accidental —la card aparece sola 800ms después de entrar, es fácil— hacía
   * perder para siempre una explicación que no se puede volver a pedir. Ahora
   * la única forma de que no vuelva es decirlo: "Entendido" o "Saltear".
   */
  function cerrar(persistir: boolean) {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 48, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false);
      if (persistir) void marcarVista(storageKey);
    });
  }

  function saltear() {
    void saltearGuia();
    cerrar(true);
  }

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        {/* Tap outside to dismiss */}
        <TouchableWithoutFeedback onPress={() => cerrar(false)}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <Animated.View style={[styles.card, { transform: [{ translateY: slideAnim }] }]}>
          <View style={[styles.iconWrap, { backgroundColor: iconColor + '1A' }]}>
            <MaterialCommunityIcons name={icon} size={30} color={iconColor} />
          </View>

          {paso && (
            <Text style={styles.contador}>{paso.paso} de {paso.total}</Text>
          )}

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          <TouchableOpacity style={styles.btn} onPress={() => cerrar(true)} activeOpacity={0.82}>
            <Text style={styles.btnText}>Entendido</Text>
          </TouchableOpacity>

          {/* No dice "Siguiente": no hay una próxima card acá y al lado, la
              siguiente aparece cuando la persona llega a esa pantalla. Lo que
              sí hace falta es poder decir que no querés ninguna. */}
          {paso && paso.paso < paso.total && (
            <TouchableOpacity onPress={saltear} hitSlop={8} activeOpacity={0.7}>
              <Text style={styles.saltear}>Saltear la guía</Text>
            </TouchableOpacity>
          )}
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
  contador: {
    fontFamily: ViveFonts.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: ViveColors.text,
    opacity: 0.45,
  },
  saltear: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: ViveColors.text,
    opacity: 0.55,
    textDecorationLine: 'underline',
    paddingVertical: 4,
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
