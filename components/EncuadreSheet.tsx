import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ViveColors, ViveFonts } from '@/constants/theme';
import type { Encuadre } from '@/lib/credentialRules';

// Qué tipo de sesión es esta, explicado entero.
//
// ── Por qué existe este sheet ────────────────────────────────────────────────
//
// Antes esto era un cartel fijo arriba del perfil que decía "Acompañamiento, no
// tratamiento — Vita no verificó una matrícula habilitante". Decía la verdad y
// estaba mal: empezaba con una negación, tenía forma de aviso de error y se
// leía como una acusación contra alguien que no hizo nada malo. La distinción
// hay que hacerla igual (Ley 23.277, `docs/encuadre-salud-y-responsabilidad.md`
// §2), pero el lugar de la explicación larga no es arriba de todo — ahí asusta.
//
// Queda en tres niveles: la ETIQUETA de una línea siempre visible, la
// EXPLICACIÓN acá a un toque, y la EVIDENCIA abajo en Formación. Nadie entiende
// la diferencia entre acompañamiento y tratamiento por dos palabras en una pill;
// se entiende acá o no se entiende en ningún lado.
//
// 🔴 Se muestran SIEMPRE las dos categorías, en las dos variantes del sheet. Si
// al perfil sin matrícula solo se le contara lo que no puede hacer, seguiría
// siendo el cartel viejo con otra forma. Explicar el par completo convierte el
// dato en información para decidir en vez de en un juicio sobre la persona.
//
// ⚠️ Redacción, tres cuidados heredados del cartel que reemplaza:
// · Se afirma lo que Vita verificó, no lo que la persona es. Que no haya
//   matrícula cargada acá no prueba que no la tenga en la realidad.
// · No se nombra la profesión: `kind = 'matricula'` dice que hay una matrícula
//   verificada, no de qué profesión. El título es texto libre.
// · No se dice que esta sesión "es un tratamiento". La matrícula habilita, no
//   describe lo que va a pasar en la sesión.

type Props = {
  visible: boolean;
  encuadre: Encuadre;
  onCerrar: () => void;
};

export function EncuadreSheet({ visible, encuadre, onCerrar }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <Pressable style={s.backdrop} onPress={onCerrar}>
        {/* El contenido no cierra al tocarse: acá se lee, y un tap perdido
            mientras se scrollea no puede tirar abajo la explicación. */}
        <Pressable style={[s.sheet, { paddingBottom: 20 + insets.bottom }]} onPress={() => {}}>
          <View style={s.grab} />

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            <Text style={s.title}>Qué tipo de sesión es esta</Text>

            <Text style={s.body}>
              En Vita hay dos tipos de profesional, y la diferencia no la marca el tema
              del que hablan sino qué pueden hacer con vos.
            </Text>

            <View style={[s.card, encuadre.habilitado && s.cardOn]}>
              <View style={s.cardHead}>
                <MaterialCommunityIcons name="hand-heart-outline" size={18} color="#6B7A56" />
                <Text style={s.cardTitle}>Acompañamiento</Text>
              </View>
              <Text style={s.cardBody}>
                Coaches, facilitadores y profesionales con formación no matriculada.
                Trabajan con vos sobre hábitos, decisiones, vínculos o cómo estás
                viviendo algo. No diagnostican ni tratan, y no reemplazan a un
                profesional de la salud.
              </Text>
            </View>

            <View style={[s.card, encuadre.habilitado && s.cardOn]}>
              <View style={s.cardHead}>
                <MaterialCommunityIcons name="shield-check" size={18} color="#42542F" />
                <Text style={s.cardTitle}>Atención en salud</Text>
              </View>
              <Text style={s.cardBody}>
                Profesionales con matrícula habilitante. En Argentina, el diagnóstico y
                el tratamiento están reservados por ley a quien la tiene (Ley 23.277).
                Es a quien corresponde acudir si lo que buscás es atención clínica.
              </Text>
            </View>

            <View style={s.divider} />

            <Text style={s.subtitle}>Este profesional</Text>
            <Text style={s.body}>
              {encuadre.habilitado
                ? 'Vita chequeó su matrícula habilitante. El número está más abajo, en Formación, y podés verificarlo por tu cuenta en el colegio profesional que corresponda.'
                : 'Vita no verificó una matrícula habilitante para este profesional, así que sus sesiones son de acompañamiento. Más abajo, en Formación, está todo lo que sí verificamos.'}
            </Text>

            {/* Para muchas formaciones serias —coaching, sexología, mindfulness—
                no existe matrícula que sacar. Sin esta línea, la ausencia se
                lee como un incumplimiento y no lo es. */}
            {!encuadre.habilitado && (
              <Text style={s.note}>
                Para muchas formaciones no existe una matrícula estatal que obtener. Que
                no figure no significa que a esta persona le falte algo — significa que
                su trabajo es de acompañamiento y no de atención clínica.
              </Text>
            )}

            <View style={s.divider} />

            <Text style={s.foot}>
              Si estás pasando por una urgencia, llamá al 911, a la línea de salud mental
              135 (CABA y GBA, gratis) o al 0800-345-1435.
            </Text>
          </ScrollView>

          <Pressable style={s.close} onPress={onCerrar} accessibilityRole="button">
            <Text style={s.closeTxt}>Entendido</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(30,26,18,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFF8EF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 24, maxHeight: '88%',
  },
  grab: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(63,81,47,0.18)', alignSelf: 'center', marginBottom: 18,
  },
  title: {
    fontFamily: ViveFonts.title, fontSize: 21, color: '#2E3624',
    marginBottom: 10, letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: ViveFonts.semibold, fontSize: 15, color: '#2E3624', marginBottom: 8,
  },
  body: {
    fontFamily: ViveFonts.regular, fontSize: 14, lineHeight: 21,
    color: '#5F6647', marginBottom: 16,
  },
  card: {
    backgroundColor: 'rgba(107,122,86,0.07)', borderRadius: 14,
    padding: 14, marginBottom: 10,
  },
  // Nada resalta la variante de la persona: las dos categorías se explican
  // igual. El dato de cuál le toca a este profesional va abajo, en su propio
  // párrafo, y no como un premio o un castigo visual acá arriba.
  cardOn: {},
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 },
  cardTitle: { fontFamily: ViveFonts.semibold, fontSize: 14.5, color: '#2E3624' },
  cardBody: {
    fontFamily: ViveFonts.regular, fontSize: 13.5, lineHeight: 20, color: '#5F6647',
  },
  divider: {
    height: 1, backgroundColor: 'rgba(63,81,47,0.10)', marginTop: 8, marginBottom: 18,
  },
  note: {
    fontFamily: ViveFonts.regular, fontSize: 13, lineHeight: 19.5,
    color: '#6B7A56', marginBottom: 4,
  },
  foot: {
    fontFamily: ViveFonts.regular, fontSize: 12.5, lineHeight: 18.5,
    color: '#87835C', marginBottom: 8,
  },
  close: {
    backgroundColor: ViveColors.primary, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 14,
  },
  closeTxt: { fontFamily: ViveFonts.semibold, fontSize: 15, color: '#FFF8EF' },
});
