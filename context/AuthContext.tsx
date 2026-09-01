import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { cancelAllResourceReminders } from '@/lib/resourceReminders';
import { clearBlockedCache } from '@/lib/blocking';
import { LEGAL_VERSION } from '@/constants/legal';
import { AuthModal } from '@/components/AuthModal';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { volcarPendiente } from '@/lib/quizPendiente';
import { enlazarConCuenta } from '@/lib/onboardingAnalytics';

WebBrowser.maybeCompleteAuthSession();

export type UserRole = 'user' | 'coach';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isLoggedIn: boolean;
  role: UserRole;
  /** Solo decide si se MUESTRA la entrada al panel. No autoriza nada:
   *  cada escritura la revalida la edge function `admin-actions` contra el JWT. */
  isAdmin: boolean;
  /** Nombre para mostrar, tomado de `profiles.name` — la misma fuente que ve el
   *  resto de la app (chats, reservas, el coach). No sale de `user_metadata`:
   *  ahí el nombre lo pone el proveedor, y Apple no lo manda nunca en el id
   *  token, así que las cuentas de Apple caían al prefijo del mail — que con
   *  Hide My Email es la cadena aleatoria de `privaterelay.appleid.com`.
   *  `null` mientras no resolvió o si no hay sesión: quien lo use tiene que
   *  tener su propio fallback. */
  displayName: string | null;
  /** Recarga `displayName`/`role`/`isAdmin` desde la base. Lo necesita quien
   *  edite el perfil: el contexto solo se refresca al cambiar la sesión, así
   *  que sin esto el nombre nuevo no llega al home hasta reabrir la app. */
  refreshProfile: () => Promise<void>;
  requestAuth: () => void;
  signInWithEmail: (email: string, password: string) => Promise<string | null>;
  signUpWithEmail: (email: string, password: string, name: string, acceptedTerms?: boolean, ageConfirmed?: boolean) => Promise<string | null>;
  signInWithGoogle: (acceptedTerms?: boolean, ageConfirmed?: boolean) => Promise<string | null>;
  /** Manda el mail de recuperación. Devuelve `null` si salió bien, o el mensaje
   *  de error traducido. Ver `resetPassword` para las dos trampas del flujo. */
  resetPassword: (email: string) => Promise<string | null>;
  signInWithApple: (acceptedTerms?: boolean, ageConfirmed?: boolean) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isLoggedIn: false,
  role: 'user',
  isAdmin: false,
  displayName: null,
  refreshProfile: async () => {},
  requestAuth: () => {},
  signInWithEmail: async () => null,
  signUpWithEmail: async () => null,
  signInWithGoogle: async () => null,
  signInWithApple: async () => null,
  resetPassword: async () => null,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole>('user');
  const [isAdmin, setIsAdmin] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  type Perfil = { role: UserRole; isAdmin: boolean; name: string | null };

  /** Rol, flag de admin y nombre en una sola consulta: los tres salen de la
   *  misma fila y se necesitan en el mismo momento, así que pedirlos por
   *  separado sería un round-trip de más en el arranque. `is_admin` NO habilita
   *  nada por sí solo: solo decide si se muestra la entrada al panel. Cada
   *  escritura la vuelve a validar `admin-actions` contra el JWT, que es donde
   *  manda de verdad.
   *
   *  El `'Usuario'` se normaliza a `null` acá y no en cada pantalla: es el
   *  placeholder que escribe el trigger de alta cuando el proveedor no manda
   *  nombre, o sea la ausencia de dato, y tratarlo como un nombre real haría
   *  que las pantallas saludaran "Hola Usuario" en vez de caer a su fallback. */
  async function fetchProfile(userId: string): Promise<Perfil> {
    const { data } = await supabase
      .from('profiles')
      .select('role, is_admin, name')
      .eq('id', userId)
      .single();
    const nombre = data?.name?.trim();
    return {
      role: (data?.role as UserRole) ?? 'user',
      isAdmin: !!data?.is_admin,
      name: nombre && nombre !== 'Usuario' ? nombre : null,
    };
  }

  function applyProfile({ role: r, isAdmin: a, name: n }: Perfil) {
    setRole(r);
    setIsAdmin(a);
    setDisplayName(n);
  }

  useEffect(() => {
    // El rol se resuelve aparte, sin bloquear el splash inicial (antes
    // esperaba fetchProfile() encadenado a getSession() — dos round-trips de
    // red seguidos antes de poder mostrar cualquier pantalla). getSession()
    // suele resolver de AsyncStorage sin red; fetchProfile() sí pega contra
    // Supabase, pero el usuario ya puede navegar mientras tanto — la
    // redirect de app/index.tsx reacciona sola cuando `role` cambia.
    // El .catch() no es decorativo: `setLoading(false)` vive solo acá adentro,
    // así que si getSession() rechaza (red caída, token que no se puede
    // refrescar) `loading` se queda en true y app/index.tsx muestra el spinner
    // para siempre. Sin sesión resuelta seguimos como anónimos, que es un
    // estado válido y navegable.
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      setLoading(false);
      if (u) fetchProfile(u.id).then(applyProfile);
      else applyProfile({ role: "user", isAdmin: false, name: null });
    }).catch((e) => {
      console.warn('[auth] getSession fallo, sigo como anonimo:', e?.message ?? e);
      setUser(null);
      applyProfile({ role: "user", isAdmin: false, name: null });
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        fetchProfile(u.id).then(applyProfile);
        // Lo que la persona contestó SIN cuenta, en el onboarding guiado o en
        // el quiz de la app. Es el único momento en que se puede escribir:
        // `user_quiz_answers` cuelga de `profiles`. Corre una sola vez (el flag
        // vive adentro) y no bloquea nada — si falla, se reintenta al próximo
        // login.
        void volcarPendiente(u.id);

        // 🔴 El único punto donde el recorrido ANÓNIMO se puede unir con la
        // persona. Todos los eventos del onboarding se escriben sin sesión, o
        // sea con `user_id` en null, e hilados solo por `properties.sesion`;
        // este evento lleva las dos cosas, así que es el que permite preguntar
        // "de los que contestaron X, cuántos terminaron creando una cuenta".
        // Sin él el embudo se corta justo antes de lo que más importa medir.
        void enlazarConCuenta();
      }
      else applyProfile({ role: "user", isAdmin: false, name: null });
    });

    return () => subscription.unsubscribe();
  }, []);

  async function refreshProfile() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    applyProfile(await fetchProfile(session.user.id));
  }

  function requestAuth() {
    if (!user) setModalVisible(true);
  }

  async function signInWithEmail(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return translateError(error.message);
    return null;
  }

  /** Campos de constancia de aceptación, compartidos por los tres caminos de alta.
   *  Nunca escribe `false` ni `null`: así una llamada parcial (p. ej. solo la
   *  edad) no puede pisar una aceptación anterior ni borrar su fecha/versión.
   *  La versión y la fecha van SOLO con los T&C — no las mueve la declaración de
   *  edad, que no es la aceptación de un documento. */
  function acceptanceFields(acceptedTerms: boolean, ageConfirmed: boolean) {
    return {
      ...(acceptedTerms
        ? {
            accepted_terms: true,
            accepted_terms_at: new Date().toISOString(),
            accepted_terms_version: LEGAL_VERSION,
          }
        : {}),
      ...(ageConfirmed ? { age_confirmed: true } : {}),
    };
  }

  async function signUpWithEmail(email: string, password: string, name: string, acceptedTerms = false, ageConfirmed = false): Promise<string | null> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // accepted_terms va también en la metadata del usuario: es lo único que
      // sobrevive si el signUp no devuelve sesión (confirmación de mail activada),
      // y deja el dato en auth.users para poder backfillear después. Lo mismo
      // vale para age_confirmed, que es una declaración del mismo momento.
      options: { data: { name, accepted_terms: acceptedTerms, age_confirmed: ageConfirmed } },
    });
    if (error) {
      // El mensaje que sale a pantalla está traducido y pierde el detalle; el
      // crudo es lo único que sirve para saber qué pasó de verdad.
      console.warn('[auth] signUp falló:', error.message);
      return translateError(error.message);
    }

    // La fila de `profiles` la crea un trigger sobre auth.users, así que para
    // cuando signUp devuelve ya existe — pero nadie le escribía `accepted_terms`:
    // este parámetro llegaba hasta acá y se descartaba en silencio, con lo cual
    // no quedaba constancia de que el usuario aceptara los T&C (necesaria para
    // que la cláusula anti-solicitación sea oponible). Requiere sesión, porque
    // el UPDATE pasa por RLS de dueño.
    if ((acceptedTerms || ageConfirmed) && data.session && data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update(acceptanceFields(acceptedTerms, ageConfirmed))
        .eq('id', data.user.id);
      if (profileError) console.warn('[auth] no se pudo registrar la aceptación:', profileError.message);
    }
    return null;
  }

  /** Marca `profiles.accepted_terms` / `age_confirmed` del usuario ya autenticado.
   *  Se usa desde los flujos sociales, donde la fila de profiles la crea el
   *  trigger de auth.users y no hay un signUp propio donde escribirla.
   *  Nunca escribe `false`: no tiene sentido "desdeclarar" y así una llamada
   *  parcial no puede pisar una declaración anterior.
   *
   *  ⚠️ IDEMPOTENTE A PROPÓSITO: solo escribe lo que todavía está en `false`.
   *  En OAuth no existe "registrarse" vs "iniciar sesión" — es el mismo flujo —
   *  así que esto corre también en cada login de alguien que ya aceptó. Sin el
   *  chequeo previo, `acceptanceFields` le pisaría `accepted_terms_at` con la
   *  fecha de hoy y `accepted_terms_version` con la versión vigente en cada
   *  entrada: se perdería cuándo aceptó de verdad y quedaría "aceptando" solo
   *  versiones nuevas de los T&C sin haber visto nada — que es exactamente la
   *  constancia que estas columnas existen para guardar (§20). */
  async function markAccepted(acceptedTerms: boolean, ageConfirmed: boolean) {
    if (!acceptedTerms && !ageConfirmed) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data: actual, error: readError } = await supabase
      .from('profiles')
      .select('accepted_terms, age_confirmed')
      .eq('id', session.user.id)
      .maybeSingle();
    // Ante la duda no se escribe: pisar una aceptación buena es peor que no
    // registrar una nueva, que además se puede recuperar en el próximo login.
    if (readError) {
      console.warn('[auth] no se pudo leer la aceptación previa:', readError.message);
      return;
    }

    const fields = acceptanceFields(
      acceptedTerms && !actual?.accepted_terms,
      ageConfirmed && !actual?.age_confirmed,
    );
    if (Object.keys(fields).length === 0) return;

    const { error } = await supabase
      .from('profiles')
      .update(fields)
      .eq('id', session.user.id);
    if (error) console.warn('[auth] no se pudo registrar la aceptación:', error.message);
  }

  // `acceptedTerms` / `ageConfirmed` los manda solo el registro (en el login no
  // se re-declara nada). Los flujos sociales no pasan por signUpWithEmail, así
  // que sin esto se creaba la cuenta sin dejar constancia de ninguna de las dos.
  /** Mail de recuperación de contraseña.
   *
   *  ⚠️ El link vuelve con `?code=`, no con tokens en el fragmento: el cliente
   *  usa `flowType: 'pkce'` (ver lib/supabase.ts). Lo canjea
   *  `NuevaContrasenaScreen` con `exchangeCodeForSession`.
   *
   *  ⚠️ Y por lo mismo, **hay que terminar el cambio en el mismo dispositivo
   *  donde se pidió**: el code verifier de PKCE queda en el AsyncStorage de esa
   *  instalación. Abrir el mail en otro teléfono no funciona.
   *
   *  El redirect se arma igual que el de Google —`native` con path explícito,
   *  ver el comentario largo en `signInWithGoogle`— y tiene que estar en la
   *  allowlist de Supabase (Authentication → URL Configuration → Redirect URLs).
   */
  async function resetPassword(email: string): Promise<string | null> {
    const redirectUrl = AuthSession.makeRedirectUri({ native: 'viveapp://nueva-contrasena' });
    console.log('[auth] reset redirect URI:', redirectUrl);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectUrl,
    });
    if (error) return translateError(error.message);
    return null;
  }

  async function signInWithGoogle(acceptedTerms = false, ageConfirmed = false): Promise<string | null> {
    try {
      // 🔴 `makeRedirectUri()` SIN argumentos no devuelve `viveapp://` en un dev
      // build: devuelve `viveapp://192.168.x.x:8081`.
      //
      // Por qué: termina en `Linking.createURL('')`, que arma la URL como
      // `${scheme}://${hostUri}` — y `hostUri` es `Constants.expoConfig.hostUri`,
      // o sea la dirección del servidor de Metro cuando hay uno. En un build
      // standalone ese campo no existe y sí sale `viveapp://`, que es lo único
      // que está en la allowlist de Supabase. De ahí que el login ande (o
      // andaría) en una build de tienda y falle en el dev build — y que el
      // redirect cambie al cambiar de red, que es lo peor de todo.
      //
      // `native` corta ese camino y devuelve la URL tal cual en los entornos
      // `bare` y `standalone` (el dev build es `bare`). En Expo Go la ignora y
      // usa la `exp://…`, que es justo lo que Expo Go necesita.
      // ⚠️ Con PATH, no `viveapp://` pelado. En un dev client, `expo-dev-client`
      // registra el MISMO scheme para su propio launcher, y una URL sin path es
      // la ambigua: el sistema puede entregársela al launcher en vez de a la
      // app, con lo cual `openAuthSessionAsync` nunca ve volver el redirect y la
      // sesión no se crea aunque todo lo demás esté bien. Un path la desambigua.
      const redirectUrl = AuthSession.makeRedirectUri({ native: 'viveapp://auth/callback' });
      // Se loguea a propósito: es el dato que decide si la allowlist matchea, y
      // no se puede saber desde afuera del dispositivo.
      console.log('[auth] redirect URI:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          // Sin esto, si el navegador ya tiene una sesión de Google activa,
          // Google saltea el selector y entra con esa cuenta sin preguntar —
          // imposible crear una cuenta con otro mail desde el mismo teléfono.
          queryParams: { prompt: 'select_account' },
        },
      });

      if (error) return translateError(error.message);
      if (!data?.url) return 'No se pudo iniciar el flujo de Google';

      // ⚠️ Sin `preferEphemeralSession` a propósito. En efímero el navegador
      // arranca sin las cookies de Safari, y ahí Google pierde las cuentas que
      // tiene recordadas: obliga a tipear mail y contraseña en cada inicio de
      // sesión. Compartir la sesión del navegador es lo que hace que aparezcan
      // las cuentas ya guardadas en el dispositivo; el selector lo fuerza
      // `prompt=select_account`, que no necesita sesión efímera.
      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      // Diagnóstico: sin esto no hay forma de saber en cuál de los tres tramos
      // muere el flujo — si no vuelve del navegador, si vuelve sin `code`, o si
      // vuelve bien y falla el canje. La URL se recorta a propósito: lleva el
      // código de autorización.
      console.log('[auth] resultado:', res.type, 'url:', 'url' in res ? String(res.url).slice(0, 120) : '(sin url)');

      if (res.type === 'cancel' || res.type === 'dismiss') return null;

      // ⚠️ `openAuthSessionAsync` también puede devolver 'locked' (ya hay otra
      // sesión de autenticación abierta) u 'opened'. Antes esos casos caían al
      // `return null` final, que quien llama interpreta como ÉXITO: el modal se
      // cerraba, no aparecía ningún error, y la persona seguía sin sesión sin
      // que nada se lo dijera. Cualquier resultado que no sea 'success' es un
      // fallo y tiene que decirlo.
      if (res.type !== 'success') {
        return 'No se pudo completar el inicio de sesión con Google. Probá de nuevo.';
      }

      // Google devuelve el rechazo como parámetro en la URL de retorno, no como
      // un tipo de resultado distinto — sin esto, `exchangeCodeForSession`
      // fallaría con un mensaje del SDK que no le dice nada a nadie.
      if (res.url.includes('error=')) {
        // `[^&#]` por lo mismo que el `code` de más abajo: la URL de retorno
        // trae un `#` final que si no se excluye queda pegado al mensaje.
        const motivo = decodeURIComponent(
          res.url.match(/error_description=([^&#]+)/)?.[1]?.replace(/\+/g, ' ') ?? '',
        );
        return motivo || 'Google rechazó el inicio de sesión';
      }

      // 🔴 `exchangeCodeForSession` espera el CÓDIGO, no la URL de retorno.
      // Manda su argumento tal cual como `auth_code` al servidor, sin parsear
      // nada (ver `_exchangeCodeForSession` en @supabase/auth-js). Pasarle
      // `res.url` entera hacía que GoTrue buscara un flow state para
      // "viveapp://auth/callback?code=…" completo y contestara
      // `invalid flow state, no valid flow state found` — un mensaje que suena a
      // problema de configuración del servidor y era un argumento mal armado.
      //
      // Se extrae con regex y no con `new URL()`: el polyfill de URL de React
      // Native no maneja bien los schemes propios.
      //
      // 🔴 La clase de caracteres excluye `#`, no solo `&`. El redirect vuelve
      // como `viveapp://auth/callback?code=<uuid>#` — con un fragmento vacío al
      // final— y `[^&]+` se llevaba también ese numeral. El código salía con un
      // carácter de más, GoTrue no encontraba ningún flow state para él y
      // contestaba `invalid flow state, no valid flow state found`: un mensaje
      // que suena a sesión vencida o a config del servidor y era un `#`.
      const code = res.url.match(/[?&]code=([^&#]+)/)?.[1];
      if (!code) {
        console.log('[auth] volvió sin código:', res.url.slice(0, 120));
        return 'Google no devolvió el código de acceso. Probá de nuevo.';
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(decodeURIComponent(code));
      if (exchangeError) {
        // El mensaje traducido se lo lleva la persona; el crudo va al log,
        // porque `translateError` colapsa causas distintas en un mismo texto.
        // ⚠️ El SDK borra el code verifier incluso cuando el canje falla, así
        // que un reintento tiene que arrancar el flujo de cero — no alcanza con
        // volver a canjear el mismo código.
        console.log('[auth] falló el canje:', exchangeError.message);
        return translateError(exchangeError.message);
      }
      await markAccepted(acceptedTerms, ageConfirmed);
      return null;
    } catch (e: any) {
      return translateError(e?.message ?? 'error');
    }
  }

  // Nativo (AuthenticationServices vía expo-apple-authentication), no OAuth
  // web como Google — es lo que Apple espera para cumplir la guideline 4.8.
  // El nonce viaja crudo a Apple/Supabase para que Supabase pueda verificar
  // el identityToken contra el hash que ve en el JWT.
  async function signInWithApple(acceptedTerms = false, ageConfirmed = false): Promise<string | null> {
    try {
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) return 'No se pudo completar el inicio de sesión con Apple';

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });

      if (error) return translateError(error.message);
      await markAccepted(acceptedTerms, ageConfirmed);
      await saveAppleName(credential.fullName);
      return null;
    } catch (e: any) {
      if (e?.code === 'ERR_REQUEST_CANCELED') return null;
      return translateError(e?.message ?? 'error');
    }
  }

  /** Persiste el nombre que devuelve Apple en `profiles.name`.
   *
   *  ⚠️ Apple entrega los scopes SOLO en la primera autorización — en los
   *  logins siguientes `fullName` viene con todo en `null`, y no vuelve a
   *  darlo salvo que la persona revoque la app desde Ajustes. Distinto de
   *  Google, que manda el nombre en cada login dentro del id token y por eso
   *  lo levanta el trigger de alta desde `raw_user_meta_data`. Acá el
   *  `identityToken` de Apple no lo lleva, así que si no se guarda en este
   *  momento el perfil queda con el 'Usuario' por defecto del trigger para
   *  siempre.
   *
   *  Solo pisa el placeholder: si la fila ya tiene un nombre real —porque la
   *  persona lo editó, o porque la cuenta venía de otro proveedor y Apple se
   *  vinculó al mismo mail— no se toca. */
  async function saveAppleName(fullName: AppleAuthentication.AppleAuthenticationFullName | null) {
    const nombre = [fullName?.givenName, fullName?.familyName].filter(Boolean).join(' ').trim();
    if (!nombre) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data: actual, error: readError } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', session.user.id)
      .maybeSingle();
    if (readError) {
      console.warn('[auth] no se pudo leer el nombre previo:', readError.message);
      return;
    }
    if (actual?.name && actual.name !== 'Usuario') return;

    const { error } = await supabase.from('profiles').update({ name: nombre }).eq('id', session.user.id);
    if (error) {
      console.warn('[auth] no se pudo guardar el nombre de Apple:', error.message);
      return;
    }
    // El listener de sesión ya corrió `fetchProfile` antes de este UPDATE, así
    // que tiene cacheado el 'Usuario' viejo. Sin esto el nombre recién aparece
    // al reabrir la app, justo en el estreno de la cuenta.
    setDisplayName(nombre);
  }

  async function signOut() {
    // Apagar las notis locales de recordatorios del usuario que se va (si no,
    // siguen firmando aunque nadie esté logueado en el dispositivo).
    await cancelAllResourceReminders().catch(() => {});
    // La lista de bloqueados es module-level: sin esto, el próximo que se
    // loguee en este dispositivo hereda los bloqueos del anterior y no ve
    // coaches que nunca bloqueó.
    clearBlockedCache();
    await supabase.auth.signOut();
    setUser(null);
    applyProfile({ role: "user", isAdmin: false, name: null });
  }

  const isLoggedIn = !!user;

  return (
    <AuthContext.Provider value={{
      user, loading, isLoggedIn, role, isAdmin, displayName, refreshProfile,
      requestAuth, signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple, signOut,
      resetPassword,
    }}>
      {children}
      <AuthModal
        visible={modalVisible}
        onDismiss={() => setModalVisible(false)}
        onLogin={() => setModalVisible(false)}
        signInWithEmail={signInWithEmail}
        signInWithGoogle={signInWithGoogle}
        signInWithApple={signInWithApple}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * 🔴 Constante y no un literal suelto: `CoachLoginScreen` necesita distinguir
 * este caso para ofrecer entrar con Google/Apple, y comparaba contra el texto
 * en INGLÉS de Supabase — que acá ya se tradujo, así que la condición no daba
 * verdadero nunca y todos los errores caían en un genérico. Compartiendo la
 * constante no se pueden volver a despegar.
 */
export const ERR_YA_REGISTRADO = 'Ya existe una cuenta con ese email';

/**
 * ⚠️ Supabase devuelve esto TANTO si la cuenta no existe como si la contraseña
 * está mal — a propósito, para que no se pueda averiguar qué mails están
 * registrados probando de a uno. O sea que este mensaje **no prueba** que la
 * cuenta no exista; es el único caso en el que tiene sentido ofrecer crearla.
 */
export const ERR_CREDENCIALES = 'El email o la contraseña son incorrectos';

function translateError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return ERR_CREDENCIALES;
  if (msg.includes('Email not confirmed')) return 'Confirmá tu email antes de iniciar sesión';
  if (msg.includes('User already registered')) return ERR_YA_REGISTRADO;
  if (msg.includes('Password should be at least')) return 'La contraseña debe tener al menos 6 caracteres';
  if (msg.includes('Unable to validate email') || msg.includes('valid email')) return 'El email no es válido';
  if (msg.includes('rate limit') || msg.includes('too many')) return 'Demasiados intentos. Esperá un momento';
  if (msg.includes('network') || msg.includes('fetch')) return 'Sin conexión. Revisá tu internet';
  return 'Algo salió mal. Intentalo de nuevo';
}
