// entrada — a dónde va alguien que acaba de entrar a la app con su cuenta.
//
// 🔴 Decisión de Andre, 17/09/2026: la cuenta se pide AL ENTRAR, no adentro.
// Hasta ese día el onboarding, el test, el catálogo y las herramientas andaban
// sin cuenta, y la cuenta se pedía en quince lugares distintos. Esa mitad sin
// cuenta produjo una familia entera de bugs: respuestas del test varadas bajo
// una sesión anónima, conversión inflada, guardias que una sesión anónima
// cruzaba, analítica sin cuenta rota durante semanas. Ahora el recorrido es:
//
//   bienvenida → bifurcación → CUENTA → "¿Cómo te gustaría empezar?" → la app
//
// La pregunta que resuelve este archivo: después de entrar, ¿esta persona tiene
// que ver "¿Cómo te gustaría empezar?" (`/onboarding2`) o ir directo a la app?
// La respuesta es "onboarding2" solo si viene del recorrido de entrada Y la
// cuenta es nueva. Quien ya tenía cuenta y toca "Ya tengo cuenta" desde el
// mismo recorrido va directo: esa pregunta es para quien recién llega.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'vita.entrada.primer_recorrido';

/** Una cuenta creada hace menos de esto se considera recién creada. Holgado a
 *  propósito: incluye el rodeo de verificar el mail, que puede tardar. */
const CUENTA_NUEVA_MS = 60 * 60 * 1000;

/** La marca la pone la bifurcación al elegir "Quiero crecer", antes de ir al
 *  registro. Sobrevive a verificar el mail y a la vuelta de Google o Apple,
 *  que un parámetro de navegación no sobreviviría. */
export async function marcarPrimerRecorrido(): Promise<void> {
  try { await AsyncStorage.setItem(KEY, '1'); } catch { /* sin marca: va a la app, que igual anda */ }
}

// 🔴 Memoizado por usuario. `AuthRedirect` corre varias veces seguidas mientras
// carga el perfil, y la marca se consume en la primera lectura: sin memo, la
// segunda corrida ya no la encontraba y pisaba `/onboarding2` con `/(tabs)`.
let decidido: { userId: string; destino: '/onboarding2' | '/(tabs)' } | null = null;

export async function destinoTrasEntrar(
  user: { id: string; created_at?: string | null },
  role: 'user' | 'coach' | string,
): Promise<string> {
  // El profesional tiene su propio recorrido de alta; esta pregunta no es para él.
  if (role === 'coach') return '/(coach)';
  if (decidido?.userId === user.id) return decidido.destino;

  let marca: string | null = null;
  try {
    marca = await AsyncStorage.getItem(KEY);
    if (marca) await AsyncStorage.removeItem(KEY);
  } catch { /* sin almacenamiento: va a la app */ }

  const creada = user.created_at ? new Date(user.created_at).getTime() : NaN;
  const esNueva = Number.isFinite(creada) && Date.now() - creada < CUENTA_NUEVA_MS;

  const destino = marca && esNueva ? '/onboarding2' : '/(tabs)';
  decidido = { userId: user.id, destino };
  return destino;
}

/** Pantallas que se pueden ver SIN cuenta. Todo lo demás manda al principio.
 *
 *  🔴 `ayuda` está y no se saca: las líneas de crisis no pueden depender de
 *  haber creado una cuenta. `legal` también: los Términos se tienen que poder
 *  leer antes de aceptarlos. `nueva-contrasena` y `verificar-mail` llegan por
 *  un link al mail, con la sesión a medio abrir. */
export const PANTALLAS_SIN_CUENTA = new Set([
  'index', 'onboarding-bifurcacion', 'login', 'register',
  'coach-login', 'nueva-contrasena', 'verificar-mail', 'legal', 'ayuda',
]);
