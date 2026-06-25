import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

// Web usa localStorage (con guard SSR); mobile usa AsyncStorage.
const webStorage = {
  getItem: (key: string) =>
    typeof window !== 'undefined' ? window.localStorage.getItem(key) : null,
  setItem: (key: string, value: string) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key);
  },
};
const authStorage = Platform.OS === 'web' ? webStorage : AsyncStorage;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
})

// Verificación de conexión — remover en producción
supabase.from('profiles').select('count').limit(1).then(({ error }) => {
  if (error) {
    console.log('[Supabase] Error de conexión:', error.message)
  } else {
    console.log('[Supabase] Conexión exitosa ✓')
  }
})

export async function registrarEvento(
  eventName: string,
  properties: Record<string, unknown> = {},
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  await supabase.from('analytics_events').insert({
    user_id: session?.user?.id ?? null,
    event_name: eventName,
    properties,
  });
}

export async function ensureAnonSession(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id) return session.user.id;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user!.id;
}