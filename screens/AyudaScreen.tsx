import { View, Text, StyleSheet, ScrollView, Pressable, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ViveFonts } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';

// Las líneas de ayuda en crisis. Son las mismas de T&C §5.3 — no un texto
// paralelo, para que no puedan divergir.
//
// ── Tres decisiones de diseño, y ninguna es estética ─────────────────────────
//
// 1. NO PREGUNTA NADA. Ni "¿cómo estás?", ni "¿querés hablar?", ni una carita.
//    Quien llega acá no viene a interactuar con una app. Cada elemento que no
//    sea un número que se pueda tocar es un obstáculo.
//
// 2. NO ES CÁLIDA. El resto de Vita tiene voz; esta pantalla no. Una app que se
//    pone tierna justo acá se está poniendo a sí misma en el medio de algo que
//    no le corresponde. Dice lo que hay y se corre.
//
// 3. 🔴 SE LLEGA TAMBIÉN DESDE EL PERFIL, no solo desde el piso de seguridad.
//    Esto es lo más importante de la pantalla. Si los números solo aparecieran
//    cuando un algoritmo decide que corresponde, no estarían disponibles el día
//    que alguien los necesita y la condición no se cumple — y ese día existe.
//    Un umbral es una heurística; la necesidad no espera a cumplirla.

type Linea = {
  numero: string;
  marcar: string;
  detalle: string;
  urgente?: boolean;
};

// Copiadas de T&C §5.3, con la vigencia verificada al escribirlas.
// ⚠️ Re-verificar antes de cada publicación: un número muerto en un aviso de
// crisis es peor que no ponerlo.
const LINEAS: Linea[] = [
  {
    numero: '911',
    marcar: '911',
    detalle: 'Emergencias. Si hay riesgo para la vida, ahora.',
    urgente: true,
  },
  {
    numero: '135',
    marcar: '135',
    detalle: 'Línea de asistencia al suicida. Gratuita desde CABA y Gran Buenos Aires.',
  },
  {
    numero: '(011) 5275-1135',
    marcar: '01152751135',
    detalle: 'La misma línea, desde todo el país.',
  },
  {
    numero: '0800-345-1435',
    marcar: '08003451435',
    detalle: 'También desde todo el país.',
  },
];

export default function AyudaScreen() {
  const router = useRouter();

  async function llamar(numero: string) {
    const url = `tel:${numero}`;
    // Si el dispositivo no puede llamar —una tablet sin línea, el simulador— el
    // número igual quedó visible arriba. El aviso solo explica por qué no pasó
    // nada al tocar; no deja a nadie sin el dato.
    const puede = await Linking.canOpenURL(url).catch(() => false);
    if (!puede) {
      Alert.alert('No se puede llamar desde este dispositivo', `Marcá ${numero} desde un teléfono.`);
      return;
    }
    await Linking.openURL(url);
  }

  return (
    <AppBg>
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Volver">
            <MaterialCommunityIcons name="chevron-left" size={28} color="#3F512F" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
          <Text style={s.title}>Si necesitás hablar con alguien ahora</Text>
          <Text style={s.intro}>
            Estas líneas atienden las 24 horas, todos los días. Son gratuitas, anónimas
            y confidenciales. No hace falta estar en lo peor para llamar.
          </Text>

          <View style={s.list}>
            {LINEAS.map(l => (
              <Pressable
                key={l.numero}
                style={[s.card, l.urgente && s.cardUrgente]}
                onPress={() => llamar(l.marcar)}
                accessibilityRole="button"
                accessibilityLabel={`Llamar al ${l.numero}. ${l.detalle}`}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.numero, l.urgente && s.numeroUrgente]}>{l.numero}</Text>
                  <Text style={s.detalle}>{l.detalle}</Text>
                </View>
                <MaterialCommunityIcons
                  name="phone"
                  size={20}
                  color={l.urgente ? '#B03A2E' : '#3F512F'}
                />
              </Pressable>
            ))}
          </View>

          {/* Lo mismo que declaran los T&C §5, dicho donde efectivamente
              importa: Vita no es un servicio de emergencia y no puede
              comportarse como si lo fuera. */}
          <Text style={s.pie}>
            Vita no es un servicio de emergencia ni reemplaza la atención profesional.
            Si estás en tratamiento, tu profesional también es alguien a quien escribirle.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  body: { paddingHorizontal: 22, paddingBottom: 48 },
  title: {
    fontFamily: ViveFonts.title, fontSize: 24, lineHeight: 31,
    color: '#2E3624', marginTop: 8, marginBottom: 12,
  },
  intro: {
    fontFamily: ViveFonts.regular, fontSize: 14.5, lineHeight: 22,
    color: '#5F6647', marginBottom: 26,
  },
  list: { gap: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFF8EF', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(63,81,47,0.14)',
    paddingVertical: 16, paddingHorizontal: 18,
  },
  cardUrgente: { borderColor: 'rgba(176,58,46,0.28)', backgroundColor: '#FDF3F1' },
  // Grande a propósito: es el dato de la pantalla, y quien llega acá puede estar
  // leyendo mal.
  numero: {
    fontFamily: ViveFonts.title, fontSize: 22, color: '#2E3624',
    letterSpacing: 0.3, marginBottom: 3,
  },
  numeroUrgente: { color: '#B03A2E' },
  detalle: {
    fontFamily: ViveFonts.regular, fontSize: 12.5, lineHeight: 18, color: '#5F6647',
  },
  pie: {
    fontFamily: ViveFonts.regular, fontSize: 12, lineHeight: 18,
    color: '#8A8B72', marginTop: 28,
  },
});
