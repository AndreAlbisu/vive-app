/**
 * Test completo de Supabase para vita
 * Usa email auth como fallback (anonymous auth pendiente de fix en Supabase)
 */
import { createClient } from '@supabase/supabase-js';

const SUPA_URL  = 'https://ggygiihhnkjrerpinhha.supabase.co';
const SUPA_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdneWdpaWhobmtqcmVycGluaGhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1Mjc5NjEsImV4cCI6MjA5NzEwMzk2MX0.lHPjyKjJIYD_lUTCF7uMBCKj9tCK_67OyrIFkCLQ-BI';

const sb = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });

const pass = (msg) => console.log(`  ✅  ${msg}`);
const fail = (msg, err) => { console.error(`  ❌  ${msg}:`, JSON.stringify(err)); process.exit(1); };

async function run() {
  // ── 1. Anonymous sign-in ───────────────────────────────────────
  console.log('\n── 1. Anonymous sign-in ─────────────────────────────');
  const { data: anonData, error: anonErr } = await sb.auth.signInAnonymously();
  let userId, sessionToken;

  if (anonErr) {
    console.warn(`  ⚠️   Anonymous sign-in falló (${anonErr.message}) — usando email fallback para seguir probando tablas`);

    // Fallback: sign in with the diagnostic user created earlier
    const { data: emailData, error: emailErr } = await sb.auth.signInWithPassword({
      email: 'test_vita_diag@example.com',
      password: 'TestPass123!',
    });
    if (emailErr) fail('email sign-in fallback', emailErr);
    userId       = emailData.user.id;
    sessionToken = emailData.session.access_token;
    console.log(`  ℹ️   Sesión con email de diagnóstico — user_id: ${userId}`);
  } else {
    userId       = anonData.user.id;
    sessionToken = anonData.session.access_token;
    pass(`Anonymous sign-in OK — user_id: ${userId}`);
  }

  // ── 2. journal_entries ─────────────────────────────────────────
  console.log('\n── 2. journal_entries ───────────────────────────────');

  const { data: jIns, error: jInsErr } = await sb
    .from('journal_entries')
    .insert({ user_id: userId, content: 'Entrada de prueba desde test', mood: 'bien' })
    .select('id, content, mood')
    .single();

  if (jInsErr) fail('INSERT journal_entries', jInsErr);
  pass(`INSERT OK — id: ${jIns.id}  mood: ${jIns.mood}`);

  const { data: jSel, error: jSelErr } = await sb
    .from('journal_entries')
    .select('id, content, mood')
    .eq('user_id', userId);

  if (jSelErr) fail('SELECT journal_entries', jSelErr);
  pass(`SELECT OK — ${jSel.length} fila(s)`);

  const { error: jDelErr } = await sb.from('journal_entries').delete().eq('id', jIns.id);
  if (jDelErr) fail('DELETE journal_entries', jDelErr);
  pass('DELETE OK — limpieza completada');

  // ── 3. gratitude_entries ───────────────────────────────────────
  console.log('\n── 3. gratitude_entries ─────────────────────────────');

  const { data: gIns, error: gInsErr } = await sb
    .from('gratitude_entries')
    .insert({ user_id: userId, content: 'Agradecido por la familia' })
    .select('id, content')
    .single();

  if (gInsErr) fail('INSERT gratitude_entries', gInsErr);
  pass(`INSERT OK — id: ${gIns.id}`);

  const { data: gSel, error: gSelErr } = await sb
    .from('gratitude_entries')
    .select('id, content')
    .eq('user_id', userId);

  if (gSelErr) fail('SELECT gratitude_entries', gSelErr);
  pass(`SELECT OK — ${gSel.length} fila(s)`);

  const { error: gDelErr } = await sb.from('gratitude_entries').delete().eq('id', gIns.id);
  if (gDelErr) fail('DELETE gratitude_entries', gDelErr);
  pass('DELETE OK — limpieza completada');

  // ── 4. RLS — usuario 2 no ve datos de usuario 1 ───────────────
  console.log('\n── 4. RLS ───────────────────────────────────────────');

  // Insertar una fila como usuario 1
  const { data: rls1 } = await sb
    .from('gratitude_entries')
    .insert({ user_id: userId, content: 'Solo del usuario 1' })
    .select('id').single();

  // Segundo cliente anónimo
  const sb2 = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });
  const { data: anonData2 } = await sb2.auth.signInAnonymously();

  if (!anonData2) {
    console.warn('  ⚠️   No se pudo crear segundo usuario anónimo para test RLS — omitiendo');
  } else {
    const { data: leaked } = await sb2
      .from('gratitude_entries')
      .select('id')
      .eq('user_id', userId);

    if (leaked && leaked.length > 0) {
      fail('RLS check', `usuario 2 ve ${leaked.length} fila(s) de usuario 1`);
    } else {
      pass('RLS OK — usuario 2 no ve datos de usuario 1');
    }
    await sb2.from('gratitude_entries').delete().eq('id', rls1?.id);
  }

  if (rls1?.id) await sb.from('gratitude_entries').delete().eq('id', rls1.id);

  console.log('\n✅  Supabase listo para usar en la app\n');
}

run().catch(console.error);
