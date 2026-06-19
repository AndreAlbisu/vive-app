import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL      = 'https://ggygiihhnkjrerpinhha.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdneWdpaWhobmtqcmVycGluaGhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1Mjc5NjEsImV4cCI6MjA5NzEwMzk2MX0.lHPjyKjJIYD_lUTCF7uMBCKj9tCK_67OyrIFkCLQ-BI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Garantiza que haya una sesión activa. Si no hay ninguna, inicia sesión
 * anónima. Devuelve el user_id de la sesión actual.
 * Requiere que "Anonymous sign-ins" esté habilitado en:
 * Supabase dashboard → Authentication → Providers → Anonymous.
 */
export async function ensureAnonSession(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id) return session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error(`Supabase anon sign-in failed: ${error.message}`);
  if (!data.user?.id) throw new Error('No user returned from anonymous sign-in');
  return data.user.id;
}
