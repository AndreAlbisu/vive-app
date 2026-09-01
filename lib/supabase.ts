// Primero de todo y por su efecto secundario: define `crypto.subtle` y
// `TextEncoder`, sin los cuales el PKCE de abajo degrada a método `plain`
// (que es como no tener PKCE). Ver lib/webcrypto.ts.
import '@/lib/webcrypto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

// Las EXPO_PUBLIC_* se inlinean en tiempo de build. Si el build no las tuvo
// (caso típico: .env está gitignoreado y EAS empaqueta respetando .gitignore),
// llegan como undefined, el cliente se crea roto y la app se cuelga cargando
// sin decir por qué. El `!` de arriba es una promesa a TS, no un chequeo.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan EXPO_PUBLIC_SUPABASE_URL y/o EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
    'En local revisá .env; en un build de EAS cargalas con `eas env:set` — .env no viaja al servidor de build.'
  );
}

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
    // 🔴 SIN ESTO EL LOGIN CON GOOGLE NO PUEDE FUNCIONAR, y falla en silencio.
    //
    // El default de supabase-js es `implicit` (GoTrueClient.js:24), que devuelve
    // los tokens en el FRAGMENTO de la URL de retorno (`#access_token=…`).
    // `AuthContext.signInWithGoogle` llama a `exchangeCodeForSession()`, que el
    // propio SDK documenta como "used when flowType is set to pkce": espera un
    // `?code=` en la query y un verificador guardado localmente. Con el flujo
    // implícito no hay ni una cosa ni la otra, así que no hay nada que
    // intercambiar y la sesión nunca se crea.
    //
    // PKCE guarda el code verifier en `storage` — el mismo AsyncStorage de
    // arriba— entre que se abre el navegador y vuelve, así que no hace falta
    // nada más.
    //
    // ⚠️ Cambiar esto afectaría también a los links por mail (confirmación,
    // recuperación de contraseña), que bajo PKCE viajan con `code`. Verificado
    // que no aplica: `exchangeCodeForSession` se usa en un solo lugar de todo el
    // proyecto y no hay ningún `emailRedirectTo` ni `resetPasswordForEmail`.
    flowType: 'pkce',
  },
})

export async function registrarEvento(
  eventName: string,
  properties: Record<string, unknown> = {},
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const { error } = await supabase.from('analytics_events').insert({
    user_id: session?.user?.id ?? null,
    event_name: eventName,
    properties,
  });

  if (error) {
    console.warn(`[registrarEvento] no se pudo anotar "${eventName}":`, error.message);
  }
}

/**
 * El id de la persona si tiene cuenta, o null.
 *
 * 🔴 REEMPLAZA A `ensureAnonSession()`, que intentaba `signInAnonymously()` y
 * **nunca funcionó**: verificado contra la base el 01/09/2026, `auth.users` no
 * tiene una sola fila con `is_anonymous = true`. Cada apertura de una
 * herramienta hacía un round-trip que fallaba y el `.catch(() => {})` de las
 * ocho pantallas se lo comía en silencio.
 *
 * 📝 Y ya no hace falta. La razón de ser de la sesión anónima era poder anotar
 * el uso de una herramienta sin cuenta; eso ahora lo cubre `lib/analytics.ts`,
 * que hila el recorrido con un id de dispositivo y no necesita sesión alguna.
 * Lo único que sigue necesitando cuenta es la FILA en `resource_completions`,
 * porque `user_id` es FK a `auth.users` — y eso es progreso personal, que sin
 * cuenta no tiene dónde vivir ni a quién pertenecer.
 *
 * ⚠️ Volver a habilitar las altas anónimas no es solo prender el switch del
 * panel: el trigger `handle_new_user` escribe `profiles.email`, que es NOT
 * NULL, y un usuario anónimo no tiene email.
 */
export async function usuarioActualId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}