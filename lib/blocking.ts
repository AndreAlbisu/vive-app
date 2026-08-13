// blocking — bloqueo de usuarios (guideline 1.2 de Apple).
//
// La tabla `blocked_users` (scripts/add-user-blocking.sql) guarda la dirección
// pero el efecto es simétrico: los triggers de `messages` y `bookings` cortan
// el vínculo para los dos lados. Ver el comentario del script.
//
// Acá vive además el CACHE de a quién bloqueé yo. Existe porque las pantallas
// del catálogo (Conexiones, búsqueda, quiz, favoritos) tienen que filtrar en
// render y no pueden pegarle a la base en cada uno: se carga una vez al entrar
// y se invalida al bloquear/desbloquear.

import { supabase, registrarEvento } from '@/lib/supabase';

// ─── Cache de bloqueados ─────────────────────────────────────────────────────

let blockedIds: Set<string> | null = null;
let inflight: Promise<Set<string>> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(fn => fn());
}

/** Suscripción para que las pantallas montadas se re-rendericen al bloquear. */
export function onBlockedChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

async function fetchBlocked(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocked_id')
    .eq('blocker_id', userId);

  if (error) {
    // No cacheamos el fallo: si la query falla, la próxima lo reintenta. Se
    // devuelve vacío en vez de tirar — un error de red no debería dejar la
    // pantalla de Conexiones en blanco.
    console.warn('[blocking] no se pudo leer la lista de bloqueados:', error.message);
    return new Set();
  }
  return new Set((data ?? []).map(r => r.blocked_id as string));
}

/** Carga (o devuelve del cache) los profiles.id que este usuario bloqueó. */
export async function loadBlockedIds(userId: string): Promise<Set<string>> {
  if (blockedIds) return blockedIds;
  if (!inflight) {
    inflight = fetchBlocked(userId).then(set => {
      blockedIds = set;
      inflight = null;
      notify();
      return set;
    });
  }
  return inflight;
}

/** Lo que ya está en memoria. `null` = todavía no se cargó. */
export function getBlockedIds(): Set<string> | null {
  return blockedIds;
}

/** Dispara la carga sin esperarla (mismo patrón que `prefetchCoaches`). */
export function prefetchBlocked(userId: string): void {
  void loadBlockedIds(userId);
}

/** Al cerrar sesión: el próximo usuario no puede heredar esta lista. */
export function clearBlockedCache(): void {
  blockedIds = null;
  inflight = null;
  notify();
}

/**
 * Saca del catálogo a los bloqueados. Antes de que el cache cargue devuelve la
 * lista intacta — un frame mostrando de más es preferible a esconder a todos.
 */
export function filterBlocked<T extends { id: string }>(items: T[]): T[] {
  if (!blockedIds || blockedIds.size === 0) return items;
  return items.filter(i => !blockedIds!.has(i.id));
}

export function isBlocked(profileId: string | null | undefined): boolean {
  return !!profileId && !!blockedIds?.has(profileId);
}

// ─── Acciones ────────────────────────────────────────────────────────────────

/**
 * Bloquea a alguien. Devuelve false si falló (no finge éxito, mismo criterio
 * que `submitReport`).
 */
export async function blockUser(
  blockerId: string,
  blockedId: string,
  reason?: string | null,
): Promise<boolean> {
  const { error } = await supabase
    .from('blocked_users')
    .upsert(
      { blocker_id: blockerId, blocked_id: blockedId, reason: reason ?? null },
      { onConflict: 'blocker_id,blocked_id' },
    );

  if (error) {
    console.warn('[blockUser] no se pudo bloquear:', error.message);
    return false;
  }

  if (blockedIds) { blockedIds.add(blockedId); notify(); }
  void registrarEvento('usuario_bloqueado', { blocked_id: blockedId, reason: reason ?? null });
  return true;
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<boolean> {
  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);

  if (error) {
    console.warn('[unblockUser] no se pudo desbloquear:', error.message);
    return false;
  }

  if (blockedIds) { blockedIds.delete(blockedId); notify(); }
  void registrarEvento('usuario_desbloqueado', { blocked_id: blockedId });
  return true;
}

export type BlockedProfile = {
  id: string;          // profiles.id del bloqueado
  name: string;
  avatarUrl: string | null;
  role: 'user' | 'coach' | null;
  createdAt: string;   // cuándo lo bloqueé
};

/** Lista completa para la pantalla de "Cuentas bloqueadas". */
export async function listBlocked(blockerId: string): Promise<BlockedProfile[]> {
  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocked_id, created_at, profiles!blocked_users_blocked_id_fkey(id, name, avatar_url, role)')
    .eq('blocker_id', blockerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[listBlocked] no se pudo leer:', error.message);
    return [];
  }

  return (data ?? []).map((row: any) => {
    const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.blocked_id as string,
      // El join puede venir vacío si el perfil fue dado de baja: la lápida sigue
      // existiendo pero el RLS de `profiles` solo expone coaches y el propio.
      name: (p?.name ?? 'Cuenta bloqueada') as string,
      avatarUrl: (p?.avatar_url ?? null) as string | null,
      role: (p?.role ?? null) as 'user' | 'coach' | null,
      createdAt: row.created_at as string,
    };
  });
}

/**
 * ¿Hay bloqueo entre estos dos, en cualquier dirección? Va a la base porque el
 * lado bloqueado no puede verlo en su propio cache (el RLS solo expone los
 * bloqueos propios) — es la misma función que usan los triggers.
 */
export async function areBlocked(a: string, b: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('are_blocked', { a, b });
  if (error) {
    console.warn('[areBlocked] no se pudo consultar:', error.message);
    return false;
  }
  return !!data;
}
