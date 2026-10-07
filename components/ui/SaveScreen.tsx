import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
  Platform,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Pattern, Circle as SvgCircle, Rect } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { RachaPill } from '@/components/ui/RachaPill';

// La pieza principal del rediseño: al guardar, una pantalla completa teñida con
// el color de la herramienta. Antes guardabas y no pasaba nada.
//
// Compartida entre Gratitud y Diario para que se sientan hermanas: cambia el
// gradiente, el título, el recap y la invitación cruzada; el resto es idéntico.

export interface RachaPillData {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  color: string;
  tint: string;
}

// Grano en overlay — mismo lenguaje que SurfaceCard (puntitos pseudo-random vía
// <Pattern>, sin depender de un PNG). Generado una vez al cargar el módulo.
const GRAIN_TILE = 48;
const GRAIN_DOTS = Array.from({ length: 46 }, () => ({
  x: Math.random() * GRAIN_TILE,
  y: Math.random() * GRAIN_TILE,
  r: 0.35 + Math.random() * 0.75,
  o: 0.12 + Math.random() * 0.4,
}));

function Grain() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" style={{ opacity: 0.06 }}>
        <Defs>
          <Pattern id="saveGrain" patternUnits="userSpaceOnUse" width={GRAIN_TILE} height={GRAIN_TILE}>
            {GRAIN_DOTS.map((d, i) => (
              <SvgCircle key={i} cx={d.x} cy={d.y} r={d.r} fill="#2E261A" fillOpacity={d.o} />
            ))}
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#saveGrain)" />
      </Svg>
    </View>
  );
}

export function SaveScreen({
  visible,
  onDone,
  gradient,
  title,
  racha,
  recap,
  crossInvite,
  origen,
  reduced = false,
}: {
  visible: boolean;
  onDone: () => void;
  gradient: [string, string];
  title: string;
  racha?: RachaPillData | null;
  recap: ReactNode;
  crossInvite?: { label: string; onPress: () => void };
  origen: string;
  reduced?: boolean;
}) {
  const pop = useRef(new Animated.Value(reduced ? 1 : 0.4)).current;
  // La invitación cruzada aparece una sola vez por origen: quien ya la vio (la
  // haya tomado o no) no la vuelve a ver. La marca es del teléfono.
  const [verInvitacion, setVerInvitacion] = useState(false);

  useEffect(() => {
    if (!visible) return;
    // Pop del check: escala desde 0.4 con rebote.
    pop.setValue(reduced ? 1 : 0.4);
    if (!reduced) {
      Animated.spring(pop, {
        toValue: 1,
        damping: 8,
        stiffness: 170,
        useNativeDriver: true,
      }).start();
    }
    // ¿Mostrar la invitación? Solo si hay una y no se mostró antes.
    if (!crossInvite) { setVerInvitacion(false); return; }
    let vivo = true;
    const clave = `vita_invite_shown_${origen}`;
    AsyncStorage.getItem(clave).then(v => {
      if (!vivo) return;
      if (v) { setVerInvitacion(false); return; }
      setVerInvitacion(true);
      AsyncStorage.setItem(clave, '1').catch(() => {});
    }).catch(() => { if (vivo) setVerInvitacion(false); });
    return () => { vivo = false; };
  }, [visible, reduced, crossInvite, origen, pop]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone}>
      <LinearGradient colors={gradient} style={styles.fill}>
        <Grain />
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.center}>
            <Animated.View style={[styles.check, { transform: [{ scale: pop }] }]}>
              <MaterialCommunityIcons name="check" size={34} color={ViveColors.onPrimaryInk} />
            </Animated.View>

            <Text style={styles.title}>{title}</Text>

            {racha && (
              <View style={styles.rachaWrap}>
                <RachaPill icon={racha.icon} label={racha.label} color={racha.color} tint={racha.tint} />
              </View>
            )}

            <View style={styles.recap}>{recap}</View>
          </View>

          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.85 }]}
              onPress={onDone}
              accessibilityRole="button"
            >
              <Text style={styles.doneText}>Listo</Text>
            </Pressable>

            {verInvitacion && crossInvite && (
              <Pressable
                style={styles.invite}
                onPress={crossInvite.onPress}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
              >
                <Text style={styles.inviteText}>{crossInvite.label}</Text>
              </Pressable>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

const DURAZNO_INK = '#7A3D12';

const styles = StyleSheet.create({
  fill: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  check: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.30)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: ViveFonts.title,
    fontSize: 26,
    color: ViveColors.text,
    textAlign: 'center',
  },
  rachaWrap: { marginTop: -4 },
  recap: {
    alignSelf: 'stretch',
    marginTop: 8,
    gap: 8,
    paddingHorizontal: 8,
  },
  footer: { gap: 18, paddingBottom: 12, alignItems: 'center' },
  doneBtn: {
    alignSelf: 'stretch',
    backgroundColor: ViveColors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: ViveColors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  doneText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: ViveColors.onPrimaryInk,
  },
  invite: {},
  inviteText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13.5,
    color: DURAZNO_INK,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});
