import type { SupabaseClient } from '@supabase/supabase-js';

function jsDayToDbDay(jsDay: number): number {
  // JS: 0=Dom, 1=Lun...6=Sab  →  DB: 1=Lun...6=Sab, 7=Dom
  return jsDay === 0 ? 7 : jsDay;
}

function parseTime(t: string): number {
  // "9:00" → 540, "13:30" → 810
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m ?? 0);
}

function formatTime(totalMinutes: number): string {
  // 540 → "9:00", 810 → "13:30"
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function generateWeeklySlots(
  coachId: string,
  supabaseClient: SupabaseClient,
): Promise<void> {
  const { data: patterns } = await supabaseClient
    .from('coach_weekly_pattern')
    .select('day_of_week, start_time, end_time, slot_duration_minutes')
    .eq('coach_id', coachId);

  if (!patterns?.length) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const slots: { coach_id: string; date: string; time: string }[] = [];

  for (let offset = 0; offset < 56; offset++) {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    const dbDay = jsDayToDbDay(d.getDay());
    const dateStr = formatDate(d);

    for (const p of patterns) {
      if (p.day_of_week !== dbDay) continue;
      const start = parseTime(p.start_time);
      const end   = parseTime(p.end_time);
      const step  = p.slot_duration_minutes;
      for (let t = start; t < end; t += step) {
        slots.push({ coach_id: coachId, date: dateStr, time: formatTime(t) });
      }
    }
  }

  if (!slots.length) return;

  await supabaseClient
    .from('coach_availability')
    .upsert(slots, { onConflict: 'coach_id,date,time', ignoreDuplicates: true });
}
