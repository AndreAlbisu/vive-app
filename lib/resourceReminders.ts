import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

// Motor local de recordatorios (RF1). Fuente de verdad: tabla `resource_reminders`.
// Las notis locales se pierden al reinstalar la app — por eso todo se reconcilia
// (cancelar lo propio + reprogramar desde la base) cada vez que la app abre, en
// vez de solo agregar/quitar de forma incremental. Idempotente.

const ID_PREFIX = 'resource-reminder:';
const ANDROID_CHANNEL_ID = 'reminders';

export type ResourceReminderRow = {
  id: string;
  kind: 'tool' | 'coach_resource';
  ref: string;
  title: string;
  days: number[];   // 0=Dom..6=Sáb (nuestro schema)
  hour: number;
  minute: number;
};

function identifierFor(reminderId: string, day: number): string {
  return `${ID_PREFIX}${reminderId}:${day}`;
}

// resource_reminders.days: 0=Dom..6=Sáb. expo-notifications WEEKLY: weekday
// 1-7 con 1=domingo (mismo orden, corrido en 1).
function toExpoWeekday(day: number): number {
  return day + 1;
}

async function ensurePermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Recordatorios',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

async function cancelAllMine(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const mine = scheduled.filter(n => n.identifier.startsWith(ID_PREFIX));
  await Promise.all(mine.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

/**
 * Cancela todas las notis locales de recordatorios y las reprograma desde
 * `resource_reminders` (solo las `enabled`). Se llama al abrir la app y
 * después de cualquier cambio en la config de recordatorios del usuario.
 * Si no hay permiso de notificaciones, no hace nada (no rompe, no insiste).
 */
export async function reconcileResourceReminders(userId: string): Promise<void> {
  const granted = await ensurePermissions();
  if (!granted) return;
  await ensureAndroidChannel();

  await cancelAllMine();

  const { data, error } = await supabase
    .from('resource_reminders')
    .select('id, kind, ref, title, days, hour, minute')
    .eq('user_id', userId)
    .eq('enabled', true);

  if (error || !data) return;

  for (const reminder of data as ResourceReminderRow[]) {
    for (const day of reminder.days) {
      await Notifications.scheduleNotificationAsync({
        identifier: identifierFor(reminder.id, day),
        content: {
          title: 'Vita',
          body: `Es hora de ${reminder.title}`,
          data: { type: 'resource_reminder', kind: reminder.kind, ref: reminder.ref, reminder_id: reminder.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          channelId: Platform.OS === 'android' ? ANDROID_CHANNEL_ID : undefined,
          weekday: toExpoWeekday(day),
          hour: reminder.hour,
          minute: reminder.minute,
        },
      });
    }
  }
}

/** Cancela todos los recordatorios locales sin tocar la tabla (ej. logout). */
export async function cancelAllResourceReminders(): Promise<void> {
  await cancelAllMine();
}

// ── CRUD (RF2/RF3) — cada mutación reprograma las notis desde la tabla ────────

export type ReminderInput = {
  id?: string;
  kind: 'tool' | 'coach_resource';
  ref: string;
  title: string;
  days: number[];
  hour: number;
  minute: number;
  enabled?: boolean;
};

export type ReminderFull = ResourceReminderRow & { enabled: boolean; created_at: string };

/** Recordatorios del usuario (para "Mis recordatorios" y para saber si un
 *  recurso ya tiene uno). */
export async function listReminders(userId: string): Promise<ReminderFull[]> {
  const { data } = await supabase
    .from('resource_reminders')
    .select('id, kind, ref, title, days, hour, minute, enabled, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data as ReminderFull[] | null) ?? [];
}

/** Crea o actualiza un recordatorio y reprograma. Devuelve el id (o null si falló). */
export async function saveReminder(userId: string, input: ReminderInput): Promise<string | null> {
  const payload = {
    user_id: userId,
    kind: input.kind,
    ref: input.ref,
    title: input.title,
    days: input.days,
    hour: input.hour,
    minute: input.minute,
    enabled: input.enabled ?? true,
    updated_at: new Date().toISOString(),
  };
  let id = input.id ?? null;
  if (id) {
    const { error } = await supabase.from('resource_reminders').update(payload).eq('id', id).eq('user_id', userId);
    if (error) return null;
  } else {
    const { data, error } = await supabase.from('resource_reminders').insert(payload).select('id').single();
    if (error || !data) return null;
    id = data.id as string;
  }
  await reconcileResourceReminders(userId);
  return id;
}

/** Prende/apaga un recordatorio (sin borrarlo) y reprograma. */
export async function setReminderEnabled(userId: string, id: string, enabled: boolean): Promise<void> {
  await supabase.from('resource_reminders').update({ enabled, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId);
  await reconcileResourceReminders(userId);
}

/** Borra un recordatorio y reprograma. Devuelve false si el borrado falló. */
export async function deleteReminder(userId: string, id: string): Promise<boolean> {
  const { error } = await supabase.from('resource_reminders').delete().eq('id', id).eq('user_id', userId);
  await reconcileResourceReminders(userId);
  return !error;
}
