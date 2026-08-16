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
  requestAuth: () => void;
  signInWithEmail: (email: string, password: string) => Promise<string | null>;
  signUpWithEmail: (email: string, password: string, name: string, acceptedTerms?: boolean, ageConfirmed?: boolean) => Promise<string | null>;
  signInWithGoogle: (acceptedTerms?: boolean, ageConfirmed?: boolean) => Promise<string | null>;
  signInWithApple: (acceptedTerms?: boolean, ageConfirmed?: boolean) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isLoggedIn: false,
  role: 'user',
  isAdmin: false,
  requestAuth: () => {},
  signInWithEmail: async () => null,
  signUpWithEmail: async () => null,
  signInWithGoogle: async () => null,
  signInWithApple: async () => null,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole>('user');
  const [isAdmin, setIsAdmin] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  /** Rol + flag de admin en una sola consulta: los dos salen de la misma fila y
   *  se necesitan en el mismo momento, así que pedirlos por separado sería un
   *  round-trip de más en el arranque. `is_admin` NO habilita nada por sí solo:
   *  solo decide si se muestra la entrada al panel. Cada escritura la vuelve a
   *  validar `admin-actions` contra el JWT, que es donde manda de verdad. */
  async function fetchRole(userId: string): Promise<{ role: UserRole; isAdmin: boolean }> {
    const { data } = await supabase
      .from('profiles')
      .select('role, is_admin')
      .eq('id', userId)
      .single();
    return { role: (data?.role as UserRole) ?? 'user', isAdmin: !!data?.is_admin };
  }

  function applyProfile({ role: r, isAdmin: a }: { role: UserRole; isAdmin: boolean }) {
    setRole(r);
    setIsAdmin(a);
  }

  useEffect(() => {
    // El rol se resuelve aparte, sin bloquear el splash inicial (antes
    // esperaba fetchRole() encadenado a getSession() — dos round-trips de
    // red seguidos antes de poder mostrar cualquier pantalla). getSession()
    // suele resolver de AsyncStorage sin red; fetchRole() sí pega contra
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
      if (u) fetchRole(u.id).then(applyProfile);
      else applyProfile({ role: "user", isAdmin: false });
    }).catch((e) => {
      console.warn('[auth] getSession fallo, sigo como anonimo:', e?.message ?? e);
      setUser(null);
      applyProfile({ role: "user", isAdmin: false });
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) fetchRole(u.id).then(applyProfile);
      else applyProfile({ role: "user", isAdmin: false });
    });

    return () => subscription.unsubscribe();
  }, []);

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
    if (error) return translateError(error.message);

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
   *  parcial no puede pisar una declaración anterior. */
  async function markAccepted(acceptedTerms: boolean, ageConfirmed: boolean) {
    if (!acceptedTerms && !ageConfirmed) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { error } = await supabase
      .from('profiles')
      .update(acceptanceFields(acceptedTerms, ageConfirmed))
      .eq('id', session.user.id);
    if (error) console.warn('[auth] no se pudo registrar la aceptación:', error.message);
  }

  // `acceptedTerms` / `ageConfirmed` los manda solo el registro (en el login no
  // se re-declara nada). Los flujos sociales no pasan por signUpWithEmail, así
  // que sin esto se creaba la cuenta sin dejar constancia de ninguna de las dos.
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
        },
      });

      if (error) return translateError(error.message);
      if (!data?.url) return 'No se pudo iniciar el flujo de Google';

      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

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
        const motivo = decodeURIComponent(
          res.url.match(/error_description=([^&]+)/)?.[1]?.replace(/\+/g, ' ') ?? '',
        );
        return motivo || 'Google rechazó el inicio de sesión';
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(res.url);
      if (exchangeError) return translateError(exchangeError.message);
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
      return null;
    } catch (e: any) {
      if (e?.code === 'ERR_REQUEST_CANCELED') return null;
      return translateError(e?.message ?? 'error');
    }
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
    applyProfile({ role: "user", isAdmin: false });
  }

  const isLoggedIn = !!user;

  return (
    <AuthContext.Provider value={{
      user, loading, isLoggedIn, role, isAdmin,
      requestAuth, signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple, signOut,
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

function translateError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'El email o la contraseña son incorrectos';
  if (msg.includes('Email not confirmed')) return 'Confirmá tu email antes de iniciar sesión';
  if (msg.includes('User already registered')) return 'Ya existe una cuenta con ese email';
  if (msg.includes('Password should be at least')) return 'La contraseña debe tener al menos 6 caracteres';
  if (msg.includes('Unable to validate email') || msg.includes('valid email')) return 'El email no es válido';
  if (msg.includes('rate limit') || msg.includes('too many')) return 'Demasiados intentos. Esperá un momento';
  if (msg.includes('network') || msg.includes('fetch')) return 'Sin conexión. Revisá tu internet';
  return 'Algo salió mal. Intentalo de nuevo';
}
