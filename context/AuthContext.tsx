import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { AuthModal } from '@/components/AuthModal';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

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
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) setRole(await fetchRole(u.id));
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) setRole(await fetchRole(u.id));
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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) return translateError(error.message);
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
      if (!data?.url) return 'No se pudo iniciar el flujo de Google.';

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

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setRole('user');
  }

  const isLoggedIn = !!user;

  return (
    <AuthContext.Provider value={{
      user, loading, isLoggedIn, role,
      requestAuth, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut,
    }}>
      {children}
      <AuthModal
        visible={modalVisible}
        onDismiss={() => setModalVisible(false)}
        onLogin={() => setModalVisible(false)}
        signInWithEmail={signInWithEmail}
        signInWithGoogle={signInWithGoogle}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

function translateError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'El email o la contraseña son incorrectos.';
  if (msg.includes('Email not confirmed')) return 'Confirmá tu email antes de iniciar sesión.';
  if (msg.includes('User already registered')) return 'Ya existe una cuenta con ese email.';
  if (msg.includes('Password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (msg.includes('Unable to validate email') || msg.includes('valid email')) return 'El email no es válido.';
  if (msg.includes('rate limit') || msg.includes('too many')) return 'Demasiados intentos. Esperá un momento.';
  if (msg.includes('network') || msg.includes('fetch')) return 'Sin conexión. Revisá tu internet.';
  return 'Algo salió mal. Intentalo de nuevo.';
}
