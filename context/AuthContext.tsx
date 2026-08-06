import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { cancelAllResourceReminders } from '@/lib/resourceReminders';
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
  requestAuth: () => void;
  signInWithEmail: (email: string, password: string) => Promise<string | null>;
  signUpWithEmail: (email: string, password: string, name: string, acceptedTerms?: boolean) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  signInWithApple: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isLoggedIn: false,
  role: 'user',
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
  const [modalVisible, setModalVisible] = useState(false);

  async function fetchRole(userId: string): Promise<UserRole> {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    return (data?.role as UserRole) ?? 'user';
  }

  useEffect(() => {
    // El rol se resuelve aparte, sin bloquear el splash inicial (antes
    // esperaba fetchRole() encadenado a getSession() — dos round-trips de
    // red seguidos antes de poder mostrar cualquier pantalla). getSession()
    // suele resolver de AsyncStorage sin red; fetchRole() sí pega contra
    // Supabase, pero el usuario ya puede navegar mientras tanto — la
    // redirect de app/index.tsx reacciona sola cuando `role` cambia.
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      setLoading(false);
      if (u) fetchRole(u.id).then(setRole);
      else setRole('user');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) fetchRole(u.id).then(setRole);
      else setRole('user');
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

  async function signUpWithEmail(email: string, password: string, name: string, acceptedTerms = false): Promise<string | null> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // accepted_terms va también en la metadata del usuario: es lo único que
      // sobrevive si el signUp no devuelve sesión (confirmación de mail activada),
      // y deja el dato en auth.users para poder backfillear después.
      options: { data: { name, accepted_terms: acceptedTerms } },
    });
    if (error) return translateError(error.message);

    // La fila de `profiles` la crea un trigger sobre auth.users, así que para
    // cuando signUp devuelve ya existe — pero nadie le escribía `accepted_terms`:
    // este parámetro llegaba hasta acá y se descartaba en silencio, con lo cual
    // no quedaba constancia de que el usuario aceptara los T&C (necesaria para
    // que la cláusula anti-solicitación sea oponible). Requiere sesión, porque
    // el UPDATE pasa por RLS de dueño.
    if (acceptedTerms && data.session && data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ accepted_terms: true })
        .eq('id', data.user.id);
      if (profileError) console.warn('[auth] no se pudo registrar accepted_terms:', profileError.message);
    }
    return null;
  }

  async function signInWithGoogle(): Promise<string | null> {
    try {
      const redirectUrl = AuthSession.makeRedirectUri();

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

      if (res.type === 'success') {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(res.url);
        if (exchangeError) return translateError(exchangeError.message);
      } else if (res.type === 'cancel' || res.type === 'dismiss') {
        return null;
      }

      return null;
    } catch (e: any) {
      return translateError(e?.message ?? 'error');
    }
  }

  // Nativo (AuthenticationServices vía expo-apple-authentication), no OAuth
  // web como Google — es lo que Apple espera para cumplir la guideline 4.8.
  // El nonce viaja crudo a Apple/Supabase para que Supabase pueda verificar
  // el identityToken contra el hash que ve en el JWT.
  async function signInWithApple(): Promise<string | null> {
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
    await supabase.auth.signOut();
    setUser(null);
    setRole('user');
  }

  const isLoggedIn = !!user;

  return (
    <AuthContext.Provider value={{
      user, loading, isLoggedIn, role,
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
