import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, BackHandler,
  StyleSheet, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useCerrarSesionAlSalir } from '@/hooks/useCerrarSesionAlSalir';
import { useTonoOnboarding } from '@/hooks/useTonoOnboarding';
import { limpiarAlta } from '@/lib/altaCoach';
import { supabase } from '@/lib/supabase';
import { AppBg } from '@/components/ui/AppBg';
import { AxisIcon } from '@/components/ui/AxisIcon';
import { AXES } from '@/constants/searchData';
import CampoFecha from '@/components/ui/CampoFecha';
import CampoNacionalidad from '@/components/ui/CampoNacionalidad';
import CampoProvincia from '@/components/ui/CampoProvincia';
import {
  ESTILO_OPCIONES_COACH,
  GUIA_OPCIONES_COACH,
  FOCO_OPCIONES_COACH,
  MAX_FOCOS,
  esEstiloCoach,
  esGuiaCoach,
  esFoco,
  type EstiloCoach,
  type GuiaCoach,
  type Foco,
} from '@/lib/enfoque';

const SPECIALTIES = ['Psicólogo/a', 'Coach', 'Nutricionista'];

const GENDER_OPTIONS = ['Prefiero no decir', 'Masculino', 'Femenino', 'No binario'] as const;
type Gender = (typeof GENDER_OPTIONS)[number];

const BIO_MAX = 500;
// La respuesta a la pregunta de riesgo: lo mismo que exige el CHECK de
// `coaches.respuesta_riesgo` (scripts/add-postulacion-derivacion-y-lugar.sql).
const RIESGO_MIN = 20;
const RIESGO_MAX = 1000;

const fadeUp = (anim: Animated.Value) => ({
  opacity: anim,
  transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
});

function isValidUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !!parsed.hostname && !/\s/.test(url);
  } catch {
    return false;
  }
}

/** Años cumplidos a hoy. Cuenta el cumpleaños del año en curso solo si ya pasó. */
function ageFromIso(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  const today = new Date();
  let age = today.getFullYear() - y;
  const monthDiff = today.getMonth() + 1 - m;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d)) age -= 1;
  return age;
}

/** Un bloque del formulario: número, título y una línea de por qué se pide.
 *
 *  🔴 Existe porque el formulario tenía DIEZ secciones del mismo peso visual, una
 *  abajo de la otra, y leerlo era como leer un padrón. Agrupadas en tres bloques
 *  con su propio encabezado, la persona sabe dónde está parada y cuánto falta.
 *  El tilde aparece cuando el bloque está completo: es el único premio que se
 *  puede dar en un formulario largo. */
function Bloque({ n, titulo, desc, listo, children }: {
  n: number; titulo: string; desc: string; listo: boolean; children: React.ReactNode;
}) {
  return (
    <View style={styles.bloque}>
      <View style={styles.bloqueHead}>
        <View style={[styles.bloqueNum, listo && styles.bloqueNumListo]}>
          {listo
            ? <MaterialCommunityIcons name="check" size={15} color="#F7EFE4" />
            : <Text style={styles.bloqueNumTxt}>{n}</Text>}
        </View>
        <View style={styles.bloqueTitulos}>
          <Text style={styles.bloqueTitulo}>{titulo}</Text>
          <Text style={styles.bloqueDesc}>{desc}</Text>
        </View>
      </View>
      <View style={styles.bloqueBody}>{children}</View>
    </View>
  );
}

/** Etiqueta de un campo. Se pinta distinto cuando ese campo es el que frenó el
 *  envío: el mensaje de abajo dice QUÉ pasa y esto dice DÓNDE. */
function Campo({ label, hint, error, contador, children }: {
  label: string; hint?: string; error?: boolean; contador?: string; children: React.ReactNode;
}) {
  return (
    <View style={styles.campo}>
      <View style={styles.labelRow}>
        <Text style={[styles.sectionLabel, error && styles.sectionLabelError]}>{label}</Text>
        {!!contador && <Text style={styles.charCount}>{contador}</Text>}
      </View>
      {!!hint && <Text style={styles.fieldHint}>{hint}</Text>}
      {children}
    </View>
  );
}

export default function CoachApplicationScreen() {
  const router = useRouter();
  // El color del camino elegido en la bifurcación.
  const tonoOnboarding = useTonoOnboarding();
  const { user, signOut } = useAuth();

  // Irse sin enviar cierra la sesión, y la cierra ANTES de que la pantalla se
  // vaya: al alta se llega ya logueado, y una sesión que sobreviva al abandono
  // deja a la persona en el Inicio como usuario final sin haberlo pedido.
  const { marcarTerminado: marcarEnviado, cancelar } = useCerrarSesionAlSalir(true);

  // Mismo motivo que en la verificación: retomando un alta a medias se llega
  // acá con `replace`, la pila queda vacía y `router.back()` no hace nada.
  function volver() {
    void cancelar().then(() => router.replace('/onboarding-bifurcacion'));
  }

  const [specialty, setSpecialty] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [topics, setTopics] = useState<Set<string>>(new Set());
  // 🔴 ISO (`yyyy-mm-dd`) desde el 24/09/2026, no el texto DD/MM/AAAA que se
  // tipeaba a mano: lo elige el calendario, así que no hay nada que parsear.
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<Gender>('Prefiero no decir');
  const [nationality, setNationality] = useState('');
  const [price, setPrice] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  // Cómo trabaja (21/09/2026): obligatorio en el alta. Son las mismas preguntas
  // que se le hacen a la persona en el quiz, así que sin esto el profesional no
  // puede aparecer primero para quien busca su forma de trabajar. La escuela NO
  // va acá: pide matrícula verificada, que llega después del alta.
  const [estilo, setEstilo] = useState<EstiloCoach | null>(null);
  const [guia, setGuia] = useState<GuiaCoach | null>(null);
  const [focos, setFocos] = useState<Foco[]>([]);
  // 24/09/2026 (docs/postulacion-preguntas.md, huecos 2 y 4). Privados: no se
  // muestran en el perfil, los lee el equipo al revisar la postulación.
  const [compromisoDerivar, setCompromisoDerivar] = useState(false);
  const [respuestaRiesgo, setRespuestaRiesgo] = useState('');
  const [paisAtencion, setPaisAtencion] = useState('');
  const [provinciaAtencion, setProvinciaAtencion] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // 🔴 Qué campo frenó el envío (24/09/2026). Antes el único aviso era una caja
  // roja al final de un formulario de dos pantallas y media: decía "Elegí una
  // especialidad" a alguien que tenía que buscar dónde estaba eso. Ahora además
  // se marca el campo, que es donde la persona tiene que mirar.
  const [campoError, setCampoError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Re-postulación. Si ya existe una fila de coach RECHAZADA, esta pantalla
  // pasa de alta a edición: el UNIQUE de `profile_id` hace que un INSERT falle
  // con 23505. ⚠️ Ese índice **no existía hasta el 24/09/2026**: este comentario
  // lo daba por cierto y la base no lo garantizaba (ver
  // `scripts/add-coaches-profile-unico.sql`). Por la app no se llegaba a
  // duplicar —el guard de `CoachLoginScreen` corta antes— pero desde la API sí.
  // con 23505 ("ya tenemos una solicitud"), que era un callejón sin salida —
  // la persona sabía qué corregir por la notificación y no tenía dónde hacerlo.
  const [existingCoachId, setExistingCoachId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(formAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (submitted) {
      Animated.timing(successAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }
  }, [submitted]);

  // El botón físico de Android en la pantalla de "enviado" tiene que hacer lo
  // mismo que el botón de la pantalla: cerrar la sesión y salir. Sin esto, la
  // pila está vacía (se llega con `replace`), así que el back cerraría la app
  // dejando la sesión viva.
  useEffect(() => {
    if (!submitted || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      void signOut().finally(() => router.replace('/'));
      return true;
    });
    return () => sub.remove();
  }, [submitted, signOut, router]);

  // Carga la postulación anterior si la hubo. Solo se prellena cuando está
  // 'rechazada': una 'pendiente' no se toca (ya está en la cola de revisión) y
  // una 'aprobada' se edita desde el perfil de coach, no desde acá.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      // 🔒 Por la RPC y no por `from('coaches')`: desde la auditoría del
      // 23/09/2026 las columnas `application_*` ya no son legibles por `anon`
      // ni por `authenticated` (el motivo de un rechazo es texto que Vita
      // escribe sobre una persona, y la policy de SELECT de `coaches` es
      // `using (true)`). `mi_postulacion()` devuelve solo la fila de quien
      // llama. Ver `scripts/cerrar-columnas-postulacion.sql`.
      const [{ data: filas }, { data: ownProfile }] = await Promise.all([
        supabase.rpc('mi_postulacion'),
        supabase.rpc('get_my_profile').maybeSingle(),
      ]);
      const coach = (filas ?? [])[0] as {
        id: string; specialty: string | null; bio: string | null;
        price_per_session: number | null; nationality: string | null;
        application_video_url: string | null; application_status: string | null;
        application_notes: string | null; estilo: string | null;
        guia: string | null; focos: string[] | null;
        compromiso_derivar: boolean | null; respuesta_riesgo: string | null;
        pais_atencion: string | null; provincia_atencion: string | null;
      } | undefined;

      if (cancelled || !coach || coach.application_status !== 'rechazada') return;

      const { data: savedTopics } = await supabase
        .from('coach_topics').select('topic').eq('coach_id', coach.id);

      if (cancelled) return;

      setExistingCoachId(coach.id);
      setRejectionReason(coach.application_notes ?? null);
      setSpecialty(coach.specialty ?? null);
      setBio(coach.bio ?? '');
      setPrice(coach.price_per_session != null ? String(coach.price_per_session) : '');
      setNationality(coach.nationality ?? '');
      setVideoUrl(coach.application_video_url ?? '');
      setBirthDate((ownProfile as { birth_date?: string | null } | null)?.birth_date ?? '');
      const savedGender = (ownProfile as { gender?: string | null } | null)?.gender;
      if (GENDER_OPTIONS.some(option => option === savedGender)) setGender(savedGender as Gender);
      setTopics(new Set((savedTopics ?? []).map(t => t.topic as string)));
      setEstilo(esEstiloCoach(coach.estilo) ? coach.estilo : null);
      setGuia(esGuiaCoach(coach.guia) ? coach.guia : null);
      setFocos(((coach.focos ?? []) as string[]).filter(esFoco));
      setCompromisoDerivar(!!coach.compromiso_derivar);
      setRespuestaRiesgo(coach.respuesta_riesgo ?? '');
      setPaisAtencion(coach.pais_atencion ?? '');
      setProvinciaAtencion(coach.provincia_atencion ?? '');
    })();

    return () => { cancelled = true; };
  }, [user]);

  function toggleTopic(topic: string) {
    setTopics(prev => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic); else next.add(topic);
      return next;
    });
  }

  function toggleFoco(id: Foco) {
    setFocos(prev => prev.includes(id)
      ? prev.filter(x => x !== id)
      : prev.length >= MAX_FOCOS ? prev : [...prev, id]);
  }

  // Cuánto del formulario está listo. No valida (eso lo hace `handleSubmit`):
  // sirve para que un formulario largo muestre avance en vez de una lista
  // infinita de campos todos iguales.
  const bloque1Listo = !!specialty && bio.trim().length >= 10 && topics.size > 0;
  // Coaches y nutricionistas no pueden tratar lo clínico (Ley 23.277): se les
  // pide el compromiso de derivar. A los psicólogos no, porque lo clínico es su
  // práctica; la pregunta de riesgo sí va para todos.
  const pideCompromiso = specialty === 'Coach' || specialty === 'Nutricionista';
  const riesgoOk = respuestaRiesgo.trim().length >= RIESGO_MIN;
  const lugarOk = !!paisAtencion && (paisAtencion !== 'Argentina' || !!provinciaAtencion);
  const bloque2Listo = !!estilo && !!guia && focos.length > 0 && riesgoOk && (!pideCompromiso || compromisoDerivar);
  const bloque3Listo = !!birthDate && lugarOk
    && !!price.trim() && !isNaN(Number(price)) && Number(price) > 0
    && isValidUrl(videoUrl.trim());
  const listos = [bloque1Listo, bloque2Listo, bloque3Listo].filter(Boolean).length;

  async function handleSubmit() {
    const frenar = (campo: string, msg: string) => { setCampoError(campo); setSubmitError(msg); };
    setCampoError(null);
    if (!specialty) { frenar('specialty', 'Elegí una especialidad'); return; }
    if (bio.trim().length < 10) { frenar('bio', 'Contanos un poco más sobre vos en la presentación'); return; }
    if (topics.size === 0) { frenar('topics', 'Elegí al menos un subtema que trabajás'); return; }
    if (!estilo) { frenar('estilo', 'Contanos cómo acompañás'); return; }
    if (!guia) { frenar('guia', 'Contanos cuánto guiás'); return; }
    if (focos.length === 0) { frenar('focos', 'Elegí sobre qué trabajás'); return; }
    if (pideCompromiso && !compromisoDerivar) {
      frenar('compromiso', 'Confirmá que derivás lo que excede tu práctica');
      return;
    }
    if (!riesgoOk) { frenar('riesgo', 'Contanos en unas líneas qué harías'); return; }
    const birthDateIso = birthDate || null;
    if (!birthDateIso) { frenar('birthDate', 'Elegí tu fecha de nacimiento'); return; }
    // Chequeo duro contra el dato real: es el único lugar del alta donde hay una
    // fecha de nacimiento obligatoria, así que del lado coach la mayoría de edad
    // no queda solo en la declaración de CoachLoginScreen. T&C §3.1.
    if (ageFromIso(birthDateIso) < 18) {
      frenar('birthDate', 'Tenés que ser mayor de 18 años para ofrecer sesiones en Vita');
      return;
    }
    if (!paisAtencion) { frenar('lugar', 'Elegí desde qué país atendés'); return; }
    if (paisAtencion === 'Argentina' && !provinciaAtencion) { frenar('lugar', 'Elegí la provincia desde la que atendés'); return; }
    const priceNumber = Number(price.trim());
    if (!price.trim() || !Number.isFinite(priceNumber) || priceNumber <= 0 || priceNumber >= 1_000_000_000) {
      frenar('price', 'Ingresá un precio válido por sesión');
      return;
    }
    if (!videoUrl.trim()) { frenar('video', 'Ingresá el link de tu video de presentación'); return; }
    if (!isValidUrl(videoUrl.trim()) || !videoUrl.trim().startsWith('https://')) {
      frenar('video', 'Ingresá un link HTTPS válido para tu video');
      return;
    }
    if (!user) { setSubmitError('No encontramos tu sesión. Volvé a ingresar'); return; }

    setSubmitting(true);
    setSubmitError(null);

    // La RPC confirma perfil, coach y temas en una transacción. Nunca se
    // muestra éxito si una de las tres partes quedó sin guardar.
    const { error } = await supabase.rpc('submit_coach_application', {
      p_specialty: specialty,
      p_bio: bio.trim(),
      p_topics: [...topics],
      p_estilo: estilo,
      p_guia: guia,
      p_focos: focos,
      p_birth_date: birthDateIso,
      p_gender: gender,
      p_nationality: nationality.trim() || null,
      p_price: priceNumber,
      p_video_url: videoUrl.trim(),
      p_compromiso_derivar: pideCompromiso ? compromisoDerivar : null,
      p_respuesta_riesgo: respuestaRiesgo.trim(),
      p_pais_atencion: paisAtencion,
      p_provincia_atencion: paisAtencion === 'Argentina' ? provinciaAtencion : null,
    });

    if (error) {
      setSubmitting(false);
      if (error.message.includes('solicitud_no_editable')) {
        setSubmitError('Tu solicitud ya está en revisión. Te avisaremos por mail.');
      } else if (error.message.includes('postulacion_invalida')) {
        setSubmitError('Revisá los datos de la solicitud e intentá de nuevo.');
      } else {
        setSubmitError(`No pudimos enviar tu solicitud. (${error.message})`);
      }
      return;
    }

    // 🔴 EL `signOut()` ESTABA ACÁ Y SE COMÍA LA PANTALLA DE "ENVIADO"
    // (reportado por Andre el 24/09/2026: *"al enviar la postulación solo
    // vuelve a la animación de abrir la app"*).
    //
    // Cerrar la sesión hace que `AuthRedirect` mande a la bienvenida en el
    // acto, así que el `setSubmitted(true)` de abajo pintaba una pantalla que
    // ya no estaba montada: la persona terminaba su postulación y lo único que
    // veía era la app arrancando de nuevo, sin una sola palabra de qué pasó con
    // lo que acababa de mandar.
    //
    // Ahora la sesión se cierra al tocar el botón de esa pantalla. La decisión
    // original se mantiene —no queda una sesión activa que deje usar la app
    // como si ya estuviera aceptado— solo que ocurre un momento después, con
    // la explicación ya leída.
    marcarEnviado();      // envió: no es un abandono, no se borra la cuenta
    await limpiarAlta();  // el alta terminó: ya no hay nada que retomar

    setSubmitting(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <AppBg tono={tonoOnboarding}>
      <SafeAreaView style={styles.container}>
        {/* Scroll: con los tres pasos, en un teléfono chico el contenido no
            entra de una y sin esto el botón queda abajo del borde. */}
        <ScrollView contentContainerStyle={styles.successScroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.successContainer, fadeUp(successAnim)]}>
          <View style={styles.successIcon}>
            <MaterialCommunityIcons name="check-circle-outline" size={64} color={ViveColors.accent} />
          </View>
          <Text style={styles.successTitle}>
            {existingCoachId ? 'Reenviada. Vuelve a la cola' : '¡Listo! Recibimos tu solicitud'}
          </Text>
          <Text style={styles.successSubtitle}>
            {existingCoachId
              ? 'La miramos de nuevo con los cambios que hiciste.'
              : 'Ahora la revisamos nosotros, a mano. No la aprueba un sistema.'}
          </Text>

          {/* 🔴 Qué pasa después, paso por paso (pedido de Andre, 23/09/2026).
              Antes esta pantalla decía una sola línea, "te vamos a contactar
              pronto", y dejaba tres cosas sin explicar que son justo las que
              generan la duda: **que la sesión se cierra** (así que no puede
              entrar a ver nada), por dónde le avisamos, y qué pasa si falta
              algo. Alguien que acaba de dejar sus datos y su video no se queda
              tranquilo con "pronto".

              📌 Sin plazo prometido a propósito: hoy la revisión la hace una
              persona sin un compromiso escrito, y poner "48 horas" acá sería
              inventar una promesa que después hay que cumplir. */}
          <View style={styles.pasos}>
            <View style={styles.paso}>
              <Text style={styles.pasoNum}>1</Text>
              <Text style={styles.pasoTxt}>
                <Text style={styles.pasoFuerte}>Miramos tu perfil y tu video.</Text> Chequeamos que lo que contás de vos
                sea claro para quien busca ayuda.
              </Text>
            </View>
            <View style={styles.paso}>
              <Text style={styles.pasoNum}>2</Text>
              <Text style={styles.pasoTxt}>
                <Text style={styles.pasoFuerte}>Si avanzamos, coordinamos una entrevista</Text> por el mail con el que
                te registraste. Es una conversación para conocerte y entender cómo trabajás.
              </Text>
            </View>
            <View style={styles.paso}>
              <Text style={styles.pasoNum}>3</Text>
              <Text style={styles.pasoTxt}>
                <Text style={styles.pasoFuerte}>Te avisamos la decisión por mail.</Text> Si falta algo, te decimos qué
                corregir. Si aprobamos tu solicitud, entrás con el mismo mail para configurar horarios y cobros.
              </Text>
            </View>
          </View>

          <Text style={styles.successNota}>
            Cerramos tu sesión mientras revisamos la solicitud. Tu perfil aparecerá cuando esté aprobado y tengas
            configurados los medios de cobro. ¿Dudas? Escribinos a vitaappar@gmail.com.
          </Text>
          <TouchableOpacity
            style={styles.successButton}
            onPress={async () => {
              // Acá sí: la persona ya leyó qué sigue. `signOut` dispara solo la
              // vuelta a la bienvenida; el `replace` queda por si el redirect
              // tarda un frame.
              await signOut();
              router.replace('/');
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>Entendido</Text>
          </TouchableOpacity>
        </Animated.View>
        </ScrollView>
      </SafeAreaView>
      </AppBg>
    );
  }

  return (
    <AppBg tono={tonoOnboarding}>
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.header, fadeUp(headerAnim)]}>
            <TouchableOpacity onPress={volver} style={styles.backBtn} hitSlop={8}>
              <MaterialCommunityIcons name="arrow-left" size={20} color="#565E32" />
              <Text style={styles.backText}>Atrás</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={[styles.content, fadeUp(formAnim)]}>
            <View style={styles.titleArea}>
              <Text style={styles.title}>
                {existingCoachId ? 'Corregí y volvé a enviarla' : 'Contanos sobre vos'}
              </Text>
              <Text style={styles.subtitle}>
                Con esta info armamos tu perfil y lo revisamos antes de activar tu cuenta como profesional.
              </Text>

              <View style={styles.progresoWrap}>
                <View style={styles.progresoRow}>
                  <Text style={styles.progresoTxt}>
                    {listos === 3 ? 'Listo para enviar' : `${listos} de 3 bloques completos`}
                  </Text>
                  <Text style={styles.progresoTxt}>{Math.round((listos / 3) * 100)}%</Text>
                </View>
                <View style={styles.progresoBarra}>
                  <View style={[styles.progresoRelleno, { width: `${(listos / 3) * 100}%` }]} />
                </View>
              </View>
            </View>

            {/* Motivo del rechazo anterior. Va arriba de todo y no en un aviso
                que se pueda cerrar: es lo único que dice qué hay que cambiar,
                y sin eso la segunda vuelta sería idéntica a la primera. */}
            {!!rejectionReason && (
              <View style={styles.rejectionBox}>
                <Text style={styles.rejectionLabel}>Qué nos faltó de tu postulación</Text>
                <Text style={styles.rejectionText}>{rejectionReason}</Text>
              </View>
            )}

            <Bloque
              n={1}
              titulo="Tu perfil"
              desc="Es lo que va a leer alguien que busca ayuda y todavía no te conoce."
              listo={bloque1Listo}>

            <Campo label="Especialidad" error={campoError === 'specialty'}>
              <View style={styles.specialtyGrid}>
                {SPECIALTIES.map((s) => {
                  const isSelected = specialty === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setSpecialty(s)}
                      activeOpacity={0.75}
                      style={[
                        styles.chip,
                        isSelected && styles.chipSelected,
                      ]}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                        {s}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Campo>

            <Campo
              label="Presentación breve"
              contador={`${bio.length}/${BIO_MAX}`}
              error={campoError === 'bio'}>
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={bio}
                onChangeText={(t) => setBio(t.slice(0, BIO_MAX))}
                placeholder="Contanos sobre tu experiencia y cómo trabajás"
                placeholderTextColor="rgba(135,131,92,0.45)"
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                autoCorrect
              />
            </Campo>

            <Campo
              label="Temas que trabajás"
              hint="Se usan para que las personas te encuentren buscando lo que les pasa."
              error={campoError === 'topics'}>
              {AXES.map(axis => (
                <View key={axis.id} style={styles.axisBlock}>
                  <View style={styles.axisLabelRow}>
                    <AxisIcon axis={axis} size={15} />
                    <Text style={styles.axisLabel}>{axis.label}</Text>
                  </View>
                  {axis.groups.map((group, gi) => (
                    <View key={gi} style={styles.specialtyGrid}>
                      {group.items.map(topic => {
                        const isSelected = topics.has(topic);
                        return (
                          <TouchableOpacity
                            key={topic}
                            onPress={() => toggleTopic(topic)}
                            activeOpacity={0.75}
                            style={[styles.chip, isSelected && styles.chipSelected]}
                          >
                            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                              {topic}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>
              ))}
            </Campo>
            </Bloque>

            {/* Cómo trabajás (21/09/2026, obligatorio) */}
            <Bloque
              n={2}
              titulo="Cómo trabajás"
              desc="Son las mismas preguntas que le hacemos a quien busca profesional: con esto te sugerimos a quien busca tu forma de trabajar."
              listo={bloque2Listo}>

            <Campo label="Cómo acompañás" error={campoError === 'estilo'}>
              <View style={styles.specialtyGrid}>
                {ESTILO_OPCIONES_COACH.map(op => (
                  <TouchableOpacity
                    key={op.id}
                    onPress={() => setEstilo(op.id)}
                    activeOpacity={0.75}
                    accessibilityHint={op.desc}
                    style={[styles.chip, estilo === op.id && styles.chipSelected]}>
                    <Text style={[styles.chipText, estilo === op.id && styles.chipTextSelected]}>{op.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Campo>

            <Campo label="Cuánto guiás" error={campoError === 'guia'}>
              <View style={styles.specialtyGrid}>
                {GUIA_OPCIONES_COACH.map(op => (
                  <TouchableOpacity
                    key={op.id}
                    onPress={() => setGuia(op.id)}
                    activeOpacity={0.75}
                    accessibilityHint={op.desc}
                    style={[styles.chip, guia === op.id && styles.chipSelected]}>
                    <Text style={[styles.chipText, guia === op.id && styles.chipTextSelected]}>{op.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Campo>

            <Campo label={`Sobre qué trabajás (hasta ${MAX_FOCOS})`} error={campoError === 'focos'}>
              <View style={styles.specialtyGrid}>
                {FOCO_OPCIONES_COACH.map(op => {
                  const activo = focos.includes(op.id);
                  return (
                    <TouchableOpacity
                      key={op.id}
                      onPress={() => toggleFoco(op.id)}
                      activeOpacity={0.75}
                      accessibilityHint={op.desc}
                      style={[styles.chip, activo && styles.chipSelected, !activo && focos.length >= MAX_FOCOS && styles.chipBlocked]}>
                      <Text style={[styles.chipText, activo && styles.chipTextSelected]}>{op.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Campo>

            {/* 24/09/2026. Los límites de cada uno. No salen en el perfil: los
                lee el equipo al revisar (docs/postulacion-preguntas.md, hueco 2). */}
            <View style={styles.limitesSep} />
            <Text style={styles.limitesNota}>
              Estas dos no se muestran en tu perfil: las lee el equipo de Vita al revisar tu postulación.
            </Text>

            {pideCompromiso && (
              <Campo label="Cuando algo excede tu práctica" error={campoError === 'compromiso'}>
                <TouchableOpacity
                  style={styles.checkRow}
                  onPress={() => setCompromisoDerivar(v => !v)}
                  activeOpacity={0.75}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: compromisoDerivar }}>
                  <View style={[styles.checkBox, compromisoDerivar && styles.checkBoxOn]}>
                    {compromisoDerivar && <MaterialCommunityIcons name="check" size={14} color="#F3EEDF" />}
                  </View>
                  <Text style={styles.checkTxt}>
                    Si aparece algo de salud mental que no me corresponde tratar, lo derivo a un profesional de la salud.
                  </Text>
                </TouchableOpacity>
              </Campo>
            )}

            <Campo
              label="¿Qué hacés si alguien te cuenta que piensa en hacerse daño?"
              hint="No buscamos una respuesta de manual: queremos saber cómo lo manejás."
              contador={`${respuestaRiesgo.length}/${RIESGO_MAX}`}
              error={campoError === 'riesgo'}>
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={respuestaRiesgo}
                onChangeText={(t) => setRespuestaRiesgo(t.slice(0, RIESGO_MAX))}
                placeholder="Contanos en unas líneas qué harías"
                placeholderTextColor="rgba(135,131,92,0.45)"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                autoCorrect
              />
            </Campo>
            </Bloque>

            <Bloque
              n={3}
              titulo="Tus datos"
              desc="Lo administrativo: quién sos, cuánto cobrás y un video para conocerte."
              listo={bloque3Listo}>

            <Campo label="Fecha de nacimiento" error={campoError === 'birthDate'}>
              <CampoFecha value={birthDate} onChange={setBirthDate} />
            </Campo>

            <Campo label="Sexo">
              <View style={styles.specialtyGrid}>
                {GENDER_OPTIONS.map((option) => {
                  const isSelected = gender === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      onPress={() => setGender(option)}
                      activeOpacity={0.75}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Campo>

            <Campo
              label="Desde dónde atendés"
              hint="De esto depende qué matrícula corresponde y cómo se te paga."
              error={campoError === 'lugar'}>
              <CampoNacionalidad
                value={paisAtencion}
                onChange={(p) => { setPaisAtencion(p); if (p !== 'Argentina') setProvinciaAtencion(''); }}
                placeholder="Elegí el país"
                titulo="¿Desde qué país atendés?"
              />
              {paisAtencion === 'Argentina' && (
                <View style={{ marginTop: 10 }}>
                  <CampoProvincia value={provinciaAtencion} onChange={setProvinciaAtencion} />
                </View>
              )}
            </Campo>

            <Campo label="Nacionalidad (opcional)">
              <CampoNacionalidad value={nationality} onChange={setNationality} />
            </Campo>

            <Campo
              label="Precio por sesión"
              hint="En pesos. Lo podés cambiar cuando quieras desde tu perfil."
              error={campoError === 'price'}>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                placeholder="Ej: 30000"
                placeholderTextColor="rgba(135,131,92,0.45)"
                keyboardType="numeric"
              />
            </Campo>

            <Campo
              label="Video de presentación"
              hint="Un video corto contándonos quién sos y cómo trabajás. Puede ser de YouTube, Drive o similar."
              error={campoError === 'video'}>
              <TextInput
                style={styles.input}
                value={videoUrl}
                onChangeText={setVideoUrl}
                placeholder="https://..."
                placeholderTextColor="rgba(135,131,92,0.45)"
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Campo>
            </Bloque>
          </Animated.View>
        </ScrollView>

        {/* Barra de envío, fija. El botón vivía al final del scroll: con tres
            bloques arriba, enviar obligaba a recorrer el formulario entero otra
            vez. Y el error aparece ACÁ, pegado al botón que lo disparó. */}
        <SafeAreaView style={styles.footerSafe} edges={['bottom']}>
          <View style={styles.footer}>
            {!!submitError && (
              <View style={styles.errorBox}>
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#C0392B" />
                <Text style={styles.errorText}>{submitError}</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.button, submitting && styles.buttonDisabled]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityState={{ disabled: submitting }}
            >
              <Text style={styles.buttonText}>
                {submitting ? 'Enviando…' : existingCoachId ? 'Volver a enviar' : 'Enviar solicitud'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </AppBg>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 28 },
  rejectionBox: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(181,83,58,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(181,83,58,0.20)',
  },
  rejectionLabel: {
    fontFamily: ViveFonts.semibold,
    fontSize: 12.5,
    color: '#B5533A',
    marginBottom: 4,
  },
  rejectionText: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: '#3A4F2A',
    lineHeight: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: '#87835C',
  },
  content: { paddingHorizontal: 20, paddingTop: 20, gap: 18 },

  // ── Progreso ──────────────────────────────────────────────────────────────
  // Un formulario de tres pantallas de alto sin ninguna señal de avance se
  // siente el doble de largo. La barra no promete rapidez: dice dónde estás.
  progresoWrap: { gap: 7, marginTop: 4 },
  progresoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progresoTxt: { fontFamily: ViveFonts.medium, fontSize: 12.5, color: '#87835C' },
  progresoBarra: { height: 5, borderRadius: 3, backgroundColor: 'rgba(86,94,50,0.12)', overflow: 'hidden' },
  progresoRelleno: { height: '100%', borderRadius: 3, backgroundColor: ViveColors.primary },

  // ── Bloques ───────────────────────────────────────────────────────────────
  // Tarjeta plana, sin sombra: son tres bloques grandes en una pantalla que se
  // scrollea, y tres sombras apiladas convierten el formulario en un montón de
  // objetos flotando. Alcanza con el fondo y el borde para agrupar.
  bloque: {
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(86,94,50,0.10)',
    borderRadius: 20,
    padding: 18,
    gap: 16,
  },
  bloqueHead: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  bloqueNum: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(86,94,50,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  bloqueNumListo: { backgroundColor: ViveColors.primary },
  bloqueNumTxt: { fontFamily: ViveFonts.semibold, fontSize: 13, color: '#565E32' },
  bloqueTitulos: { flex: 1, gap: 2 },
  bloqueTitulo: { fontFamily: ViveFonts.semibold, fontSize: 17, color: '#565E32', letterSpacing: -0.2 },
  bloqueDesc: { fontFamily: ViveFonts.regular, fontSize: 13, color: 'rgba(135,131,92,0.9)', lineHeight: 19 },
  bloqueBody: { gap: 18 },
  campo: { gap: 8 },
  sectionLabelError: { color: '#C0392B' },

  // ── Barra de envío ────────────────────────────────────────────────────────
  // Fija abajo: el botón estaba al final de todo, así que para enviar había que
  // volver a scrollear hasta el fondo. Y el error vive ACÁ, al lado del botón
  // que lo disparó, en vez de en una caja perdida entre los campos.
  footerSafe: {
    backgroundColor: 'rgba(247,239,228,0.97)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(86,94,50,0.12)',
  },
  footer: { paddingHorizontal: 20, paddingVertical: 14, gap: 10 },
  titleArea: { gap: 8 },
  title: {
    fontFamily: ViveFonts.semibold,
    fontSize: 30,
    color: '#565E32',
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  subtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: '#87835C',
    lineHeight: 21,
  },
  sectionLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: '#87835C',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCount: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: 'rgba(135,131,92,0.58)',
  },
  specialtyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  axisBlock: { gap: 8, marginTop: 4 },
  axisLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  axisLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: '#565E32',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,248,240,0.48)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  // 🔴 Oliva lleno, no el verde menta de antes (24/09/2026). El menta venía de
  // `ViveColors.accent` y no aparece en ninguna otra pantalla del profesional:
  // "Cómo trabajo" y los temas ya usan el oliva lleno con texto crema. Con dos
  // verdes distintos para el mismo gesto, la app parecía de dos manos.
  chipSelected: {
    backgroundColor: ViveColors.primary,
    borderColor: ViveColors.primary,
  },
  chipText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#87835C',
  },
  chipBlocked: { opacity: 0.45 },
  chipTextSelected: {
    fontFamily: ViveFonts.semibold,
    color: '#F7EFE4',
  },
  input: {
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: '#565E32',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  bioInput: { minHeight: 120, paddingTop: 14 },
  limitesSep: { height: 1, backgroundColor: 'rgba(86,94,50,0.14)', marginTop: 4, marginBottom: 12 },
  limitesNota: { fontFamily: ViveFonts.regular, fontSize: 12.5, lineHeight: 18, color: '#87835C', marginBottom: 14 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkBox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: 'rgba(86,94,50,0.45)',
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkBoxOn: { backgroundColor: '#565E32', borderColor: '#565E32' },
  checkTxt: { flex: 1, fontFamily: ViveFonts.regular, fontSize: 14, lineHeight: 20, color: '#565E32' },
  fieldHint: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: 'rgba(135,131,92,0.72)',
    lineHeight: 17,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(224,82,82,0.15)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#FF7070',
    flex: 1,
    lineHeight: 18,
  },
  button: {
    backgroundColor: ViveColors.primaryInk,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: '#F7EFE4',
    letterSpacing: 0.3,
  },
  successScroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: 28 },
  successContainer: {
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  successIcon: { marginBottom: 8 },
  pasos: { alignSelf: 'stretch', gap: 14 },
  paso: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  pasoNum: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: '#F7EFE4',
    backgroundColor: '#565E32',
    width: 24, height: 24, borderRadius: 12,
    textAlign: 'center', lineHeight: 24, overflow: 'hidden',
  },
  pasoTxt: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 14.5,
    color: '#87835C',
    lineHeight: 21,
  },
  pasoFuerte: { fontFamily: ViveFonts.semibold, color: '#565E32' },
  successNota: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: 'rgba(135,131,92,0.85)',
    lineHeight: 19,
    textAlign: 'center',
  },
  successTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 26,
    color: '#565E32',
    letterSpacing: -0.3,
    lineHeight: 34,
    textAlign: 'center',
  },
  successSubtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: '#87835C',
    lineHeight: 22,
    textAlign: 'center',
  },
  successButton: {
    backgroundColor: ViveColors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 48,
    alignItems: 'center',
    marginTop: 12,
  },
});
