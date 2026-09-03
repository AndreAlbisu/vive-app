import { Modal, View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { LO_QUE_CUBRE } from '@/lib/consentRules';

// El pedido de consentimiento para tratar datos sensibles.
//
// ── Tres decisiones de diseño que salen de la ley, no del gusto ──────────────
//
// 1. APARECE EN EL PRIMER USO, no en el alta. El consentimiento tiene que ser
//    INFORMADO, y en el registro nadie lee: es ruido entre otros cinco pasos.
//    Acá la persona acaba de tocar una carita, así que el pedido tiene contexto
//    y se entiende qué está aceptando.
//
// 2. "AHORA NO" ES UNA SALIDA REAL Y VISIBLE. La Ley 25.326 art. 7.1 dice que
//    nadie puede ser OBLIGADO a dar datos sensibles, así que esto no puede ser
//    condición para usar la app. El botón de rechazo no va escondido ni en gris
//    clarito: se ve, se toca, y no pasa nada malo.
//
// 3. NO HAY BOTÓN DE CERRAR AL COSTADO. No por atrapar a nadie, sino al revés:
//    un consentimiento tiene que ser un acto, y una X ambigua no dice si
//    aceptaste o no. Las dos salidas están nombradas. El botón físico de atrás
//    en Android cuenta como "ahora no", que es la interpretación segura.

type Props = {
  visible: boolean;
  onResponder: (granted: boolean) => Promise<boolean>;
  /** Recibe lo que la persona respondió — quien abrió el sheet estaba esperando
   *  esa respuesta para seguir o abortar. */
  onCerrar: (granted: boolean) => void;
};

export function ConsentSheet({ visible, onResponder, onCerrar }: Props) {
  const insets = useSafeAreaInsets();
  const [enviando, setEnviando] = useState<null | 'si' | 'no'>(null);

  async function responder(granted: boolean) {
    setEnviando(granted ? 'si' : 'no');
    const ok = await onResponder(granted);
    setEnviando(null);
    // Si falló la red no se cierra: cerrar daría a entender que quedó
    // registrado, y no quedó. La persona reintenta o sale con el botón físico.
    if (ok) onCerrar(granted);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => onCerrar(false)}>
      <View style={s.backdrop}>
        <View style={[s.sheet, { paddingBottom: 24 + insets.bottom }]}>
          <View style={s.grab} />

          <Text style={s.title}>Antes de guardar esto</Text>
          <Text style={s.body}>
            Lo que registrás sobre cómo estás es información sobre tu salud, así que
            necesitamos que nos digas que sí en forma explícita. No alcanza con que
            hayas aceptado los términos.
          </Text>

          <View style={s.list}>
            {LO_QUE_CUBRE.map(linea => (
              <View key={linea} style={s.row}>
                <MaterialCommunityIcons name="circle-small" size={20} color={ViveColors.primary} />
                <Text style={s.rowText}>{linea}</Text>
              </View>
            ))}
          </View>

          <Text style={s.body}>
            Es tuyo y no se comparte con nadie — tampoco con los profesionales — salvo
            que vos decidas mandarlo. Podés cambiar de idea cuando quieras desde tu
            perfil, y pedir que borremos lo guardado.
          </Text>

          <Pressable
            style={[s.primary, enviando && s.disabled]}
            onPress={() => responder(true)}
            disabled={!!enviando}
            accessibilityRole="button"
          >
            {enviando === 'si'
              ? <ActivityIndicator color="#FFF8EF" />
              : <Text style={s.primaryTxt}>Sí, guardalo</Text>}
          </Pressable>

          <Pressable
            style={[s.secondary, enviando && s.disabled]}
            onPress={() => responder(false)}
            disabled={!!enviando}
            accessibilityRole="button"
          >
            <Text style={s.secondaryTxt}>Ahora no</Text>
          </Pressable>

          {/* Esto no es letra chica de cortesía: es el art. 7.1 puesto en
              pantalla. Si no queda claro que se puede decir que no, el
              consentimiento deja de ser libre. */}
          <Text style={s.foot}>
            Si decís que no, el resto de la app funciona igual: reservás sesiones,
            hablás con tu profesional y usás los recursos.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(30,26,18,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFF8EF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 24,
  },
  grab: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(63,81,47,0.18)', alignSelf: 'center', marginBottom: 20,
  },
  title: {
    fontFamily: ViveFonts.title, fontSize: 21, color: '#2E3624',
    marginBottom: 10, letterSpacing: -0.3,
  },
  body: {
    fontFamily: ViveFonts.regular, fontSize: 14, lineHeight: 21,
    color: '#5F6647', marginBottom: 16,
  },
  list: { marginBottom: 18, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 2 },
  rowText: {
    flex: 1, fontFamily: ViveFonts.regular, fontSize: 14, lineHeight: 21, color: '#3F512F',
  },
  primary: {
    backgroundColor: ViveColors.primary, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', marginBottom: 10, minHeight: 50,
    justifyContent: 'center',
  },
  primaryTxt: { fontFamily: ViveFonts.semibold, fontSize: 15, color: '#FFF8EF' },
  secondary: {
    borderRadius: 14, paddingVertical: 13, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(63,81,47,0.25)', marginBottom: 14,
  },
  secondaryTxt: { fontFamily: ViveFonts.semibold, fontSize: 15, color: '#3F512F' },
  foot: {
    fontFamily: ViveFonts.regular, fontSize: 12, lineHeight: 18,
    color: '#8A8B72', textAlign: 'center',
  },
  disabled: { opacity: 0.6 },
});
