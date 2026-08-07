// check-deck-pools.ts — calibración de los umbrales del deck v3.
//
// Correr:  npx sucrase-node scripts/check-deck-pools.ts
//
// Por qué existe: v3 cambió los slots de "el máximo gana" a "todos los que
// cruzan la barra entran al sorteo" (ver lib/coachDeckRanking.ts). Las barras
// están puestas a ojo. Si quedan altas, los pools se vacían, rankDeck omite los
// slots sin candidato, y las puertas pasan a mostrar 1 o 2 coaches en vez de 4.
// No tira error ni rompe nada — el deck simplemente se achica en silencio, y
// probándolo con un puñado de coaches de test no se nota.
//
// Este script mira los datos REALES y cuenta, puerta por puerta, cuántos coaches
// caen en cada pool. Importa `isEligibleForSlot` y `DOORS` del código de verdad
// (no una copia del mapeo puerta→tema, que se desincronizaría al primer cambio).
//
// Lee con la anon key, así que ve exactamente lo que ve la app — que es
// justamente lo que hay que calibrar.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

import { DOORS, coachesForDoor } from '../constants/conexionesDoors';
import {
  SLOT_ORDER,
  DECK_SLOTS,
  buildSlotContext,
  isEligibleForSlot,
  MIN_RECOMMEND_RATING,
  MIN_RECOMMEND_REVIEWS,
  MIN_RECOMMEND_REBOOKING,
  MIN_REBOOKING_SAMPLE,
  MIN_TRENDING_BOOKERS,
  NEW_MAX_REVIEWS,
  NEW_MAX_AGE_DAYS,
  type DeckSlotKey,
} from '../lib/coachDeckRanking';
import type { CachedCoach } from '../lib/coachesCache';

// Sin import.meta.url a propósito: sucrase transpila a CommonJS, y esa sintaxis
// hace que Node reparse el archivo como ESM y pierda la resolución sin extensión
// de los imports relativos (`../lib/coachDeckRanking`). Se corre desde la raíz.
const ROOT = process.cwd();

function readEnv(): { url: string; key: string } {
  const raw = readFileSync(join(ROOT, '.env'), 'utf8');
  const get = (name: string) => {
    const line = raw.split('\n').find(l => l.trim().startsWith(`${name}=`));
    if (!line) throw new Error(`Falta ${name} en .env`);
    return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
  };
  return { url: get('EXPO_PUBLIC_SUPABASE_URL'), key: get('EXPO_PUBLIC_SUPABASE_ANON_KEY') };
}

/** Mismo fetch que lib/coachesCache._doFetch — si aquel cambia, este tiene que seguirlo. */
async function fetchCatalog(): Promise<CachedCoach[]> {
  const { url, key } = readEnv();
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await sb
    .from('coaches')
    .select('id, created_at, specialty, bio, price_per_session, nationality, verified, profiles!inner(id, name, avatar_url, gender), coach_topics(topic)')
    .eq('verified', true)
    .eq('availability_status', 'activo')
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) throw new Error(`coaches: ${error.message}`);

  const initial: CachedCoach[] = (data ?? []).map((c: any) => {
    const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
    return {
      id: profile?.id, coachId: c.id, createdAt: c.created_at ?? null,
      name: profile?.name ?? '', specialty: c.specialty ?? '',
      priceFrom: c.price_per_session, nationality: c.nationality ?? '',
      gender: profile?.gender ?? '', avatarUrl: profile?.avatar_url ?? null,
      bio: c.bio ?? null, topics: (c.coach_topics ?? []).map((t: any) => t.topic),
      verified: !!c.verified, avgRating: null, reviewCount: 0,
      rebookingRate: null, completadasCount: 0, recentBookers: 0,
    };
  });

  const profileIds = initial.map(c => c.id).filter(Boolean);
  const coachIds = initial.map(c => c.coachId).filter(Boolean) as string[];
  if (profileIds.length === 0) return initial;

  const [reviews, rebook, trend] = await Promise.all([
    sb.from('reviews').select('reviewed_id, rating').in('reviewed_id', profileIds).eq('is_private', false),
    sb.from('coach_rebooking_stats').select('coach_id, rebooking_rate, completadas_count').in('coach_id', coachIds),
    sb.from('coach_trending_stats').select('coach_id, recent_bookers').in('coach_id', coachIds),
  ]);

  const ratings: Record<string, number[]> = {};
  (reviews.data ?? []).forEach((r: any) => (ratings[r.reviewed_id] ??= []).push(r.rating));
  const rb: Record<string, any> = {};
  (rebook.data ?? []).forEach((r: any) => { rb[r.coach_id] = r; });
  const tr: Record<string, number> = {};
  (trend.data ?? []).forEach((r: any) => { tr[r.coach_id] = r.recent_bookers ?? 0; });

  return initial.map(c => {
    const rs = ratings[c.id] ?? [];
    return {
      ...c,
      reviewCount: rs.length,
      avgRating: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
      rebookingRate: rb[c.coachId!]?.rebooking_rate ?? null,
      completadasCount: rb[c.coachId!]?.completadas_count ?? 0,
      recentBookers: tr[c.coachId!] ?? 0,
    };
  });
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}
function padL(s: string, n: number): string {
  return s.length >= n ? s : ' '.repeat(n - s.length) + s;
}

async function main() {
  const catalog = await fetchCatalog();

  console.log(`\nCatálogo visible (verified + activo): ${catalog.length} coaches`);
  if (catalog.length === 0) {
    console.log('\n⚠️  Cero coaches. O no hay ninguno verificado y activo, o el RLS de `coaches`');
    console.log('   no deja leer con la anon key. Revisá antes de sacar conclusiones.');
    return;
  }

  console.log(`Umbrales actuales:`);
  console.log(`  recomendado  ≥${MIN_RECOMMEND_RATING}★ y (≥${MIN_RECOMMEND_REVIEWS} reseñas, o ≥${Math.round(MIN_RECOMMEND_REBOOKING * 100)}% reagendamiento con ≥${MIN_REBOOKING_SAMPLE} completadas)`);
  console.log(`  tendencia    ≥${MIN_TRENDING_BOOKERS} personas distintas en 30 días`);
  console.log(`  nuevo        <${NEW_MAX_REVIEWS} reseñas y <${NEW_MAX_AGE_DAYS} días`);
  console.log(`  economico    ≤ mediana de la puerta\n`);

  const W = 26;
  console.log(pad('PUERTA', W) + padL('coaches', 9) + SLOT_ORDER.map(k => padL(k.slice(0, 8), 10)).join('') + padL('slots', 8));
  console.log('─'.repeat(W + 9 + SLOT_ORDER.length * 10 + 8));

  const fillCount: Record<number, number> = {};
  const emptySlots: Record<string, number> = {};

  for (const door of DOORS) {
    const inDoor = coachesForDoor(door, catalog);
    const ctx = buildSlotContext(inDoor);
    const counts = SLOT_ORDER.map(key => inDoor.filter(c => isEligibleForSlot(key as DeckSlotKey, c, ctx)).length);

    // Cuántos slots se llenarían de verdad: cada slot toma un coach distinto, así
    // que el deck no puede mostrar más coaches que los que hay en la puerta.
    const filled = Math.min(counts.filter(n => n > 0).length, inDoor.length);
    fillCount[filled] = (fillCount[filled] ?? 0) + 1;
    counts.forEach((n, i) => { if (n === 0) emptySlots[SLOT_ORDER[i]] = (emptySlots[SLOT_ORDER[i]] ?? 0) + 1; });

    const flag = inDoor.length === 0 ? '  (puerta vacía)' : filled <= 1 ? '  ⚠️' : '';
    console.log(
      pad(door.label, W) + padL(String(inDoor.length), 9) +
      counts.map(n => padL(String(n), 10)).join('') + padL(`${filled}/4`, 8) + flag,
    );
  }

  console.log('\nResumen:');
  for (const n of [4, 3, 2, 1, 0]) {
    if (fillCount[n]) console.log(`  ${fillCount[n]} puerta(s) mostrarían ${n} coach(es)`);
  }
  // Detalle por coach — sin esto no se distingue "umbral demasiado alto" de
  // "todavía no hay datos", que piden decisiones opuestas.
  console.log('\nDetalle por coach:');
  console.log(pad('COACH', 22) + padL('días', 6) + padL('reseñas', 9) + padL('★', 6) + padL('compl.', 8) + padL('reag.', 7) + padL('30d', 6) + padL('precio', 10));
  console.log('─'.repeat(74));
  const now = Date.now();
  for (const c of catalog) {
    const days = c.createdAt ? Math.floor((now - new Date(c.createdAt).getTime()) / 86_400_000) : null;
    console.log(
      pad(c.name || '(sin nombre)', 22) +
      padL(days == null ? '?' : String(days), 6) +
      padL(String(c.reviewCount ?? 0), 9) +
      padL(c.avgRating == null ? '—' : c.avgRating.toFixed(1), 6) +
      padL(String(c.completadasCount ?? 0), 8) +
      padL(c.rebookingRate == null ? '—' : `${Math.round(c.rebookingRate * 100)}%`, 7) +
      padL(String(c.recentBookers ?? 0), 6) +
      padL(c.priceFrom == null ? '—' : `$${c.priceFrom.toLocaleString('es-AR')}`, 10),
    );
  }

  const dead = SLOT_ORDER.filter(k => (emptySlots[k] ?? 0) === DOORS.length);
  if (dead.length) {
    console.log(`\n⚠️  Slots que hoy NO se llenan en NINGUNA puerta: ${dead.map(k => DECK_SLOTS[k as DeckSlotKey].label).join(', ')}`);
    console.log('   Con los datos actuales esos lugares nunca se muestran. Si es por falta de');
    console.log('   volumen es esperable al principio; si es por umbral, hay que bajarlo.');
  }
  console.log('');
}

main().catch(e => { console.error('\n❌', e.message, '\n'); process.exit(1); });
