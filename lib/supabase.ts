import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
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
