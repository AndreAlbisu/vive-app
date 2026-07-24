import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { DEFAULT_HABIT_TOOL_IDS } from '@/constants/tools';

// Rutina de hábitos del usuario = filas de `user_habits` (solo la elección de
// prácticas). El "hecho hoy" NO vive acá: se deriva de `resource_completions`
// vía useResourceProgress (completedToday). Ver scripts/add-user-habits.sql.

const seedKey = (userId: string) => `vita_habits_seeded_${userId}`;

/**
 * Devuelve los tool_id de la rutina del usuario, en orden.
 * La PRIMERA vez (0 filas y sin flag de sembrado) siembra la rutina por defecto.
 * Si el usuario borró todos sus hábitos a propósito, el flag evita re-sembrar.
 */
export async function loadHabits(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('user_habits')
    .select('tool_id')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });

  let ids = (data ?? []).map(r => r.tool_id as string);

  if (ids.length === 0) {
    const seeded = await AsyncStorage.getItem(seedKey(userId));
    if (!seeded) {
      await supabase.from('user_habits').insert(
        DEFAULT_HABIT_TOOL_IDS.map((tool_id, i) => ({ user_id: userId, tool_id, sort_order: i })),
      );
      await AsyncStorage.setItem(seedKey(userId), '1');
      ids = [...DEFAULT_HABIT_TOOL_IDS];
    }
  }

  return ids;
}

/** Agrega una práctica a la rutina (al final). Idempotente por el UNIQUE (user_id, tool_id). */
export async function addHabit(userId: string, toolId: string, sortOrder: number): Promise<void> {
  await supabase
    .from('user_habits')
    .upsert(
      { user_id: userId, tool_id: toolId, sort_order: sortOrder },
      { onConflict: 'user_id,tool_id', ignoreDuplicates: true },
    );
}

/** Quita una práctica de la rutina. */
export async function removeHabit(userId: string, toolId: string): Promise<void> {
  await supabase
    .from('user_habits')
    .delete()
    .eq('user_id', userId)
    .eq('tool_id', toolId);
}
