// Ejecuta la función real contra base y Storage en memoria. No usa red.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');

const file = path.resolve(__dirname, '../../supabase/functions/delete-account/index.ts');
const userId = '11111111-1111-4111-8111-111111111111';
const coachId = '22222222-2222-4222-8222-222222222222';

function fixture({ futureBooking = false, failCredentialsOnce = false, openRefund = false } = {}) {
  const tables = {
    coaches: [{ id: coachId, profile_id: userId, verified: true, availability_status: 'activo',
      bio: 'Identificable', slug: 'nombre-real', application_video_url: 'https://example.com/video' }],
    profiles: [{ id: userId, name: 'Nombre real', email: 'real@example.com' }],
    bookings: [
      ...(futureBooking ? [{ id: 'booking', coach_id: coachId, user_id: 'client',
        status: 'confirmada', scheduled_date: '2099-01-01' }] : []),
      // Reintegro en curso de una sesión cancelada: necesita el token de MP del profesional.
      ...(openRefund ? [{ id: 'reintegro', coach_id: coachId, user_id: 'client', status: 'cancelada',
        scheduled_date: '2020-01-01', payment_status: 'reembolso_pendiente', payment_provider: 'mp' }] : []),
      // Como cliente: una sesión de hoy que ya empezó (no se toca) y una futura (se cancela).
      { id: 'empezada', coach_id: 'otro-coach', user_id: userId, status: 'confirmada',
        scheduled_date: new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), scheduled_time: '0:00' },
      ...(futureBooking ? [] : [{ id: 'por-venir', coach_id: 'otro-coach', user_id: userId, status: 'confirmada',
        scheduled_date: '2099-01-01', scheduled_time: '9:00' }]),
      // Sesión vieja de la misma cuenta como cliente: queda la reserva, no lo que contó.
      { id: 'vieja', coach_id: 'otro-coach', user_id: userId, status: 'completada',
        scheduled_date: '2020-01-01', user_message: 'Vengo por ataques de pánico', tema_origen: 'Ansiedad y estrés' },
    ],
    session_notes: [
      { id: 'sobre-mi', user_id: userId, coach_id: 'otro', content: 'Nota sobre la persona', shared: false },
      { id: 'ajena', user_id: 'otra-persona', coach_id: 'otro', content: 'No se toca', shared: false },
      { id: 'mia-privada', user_id: 'client', coach_id: userId, content: 'Solo la veía yo', shared: false },
      { id: 'mia-compartida', user_id: 'client', coach_id: userId, content: 'También es del cliente', shared: true },
    ],
    coach_calendar_feeds: [{ coach_id: coachId, token: 'secreto' }],
    coach_availability: [{ coach_id: coachId, date: '2099-01-01' }, { coach_id: 'otro-coach', date: '2099-01-01' }],
    coach_weekly_pattern: [{ coach_id: coachId, day_of_week: 1 }],
    coach_payout_accounts: [{ coach_id: coachId, cbu: '0000000000000000000000' }],
    coach_mp_accounts: [{ coach_id: coachId, access_token: 'token' }],
    guarantee_claims: [],
    resource_events: [{ id: 'evento', user_id: userId }, { id: 'evento-ajeno', user_id: 'otra-persona' }],
    coach_credentials: [{ id: 'credential', coach_id: coachId }],
    coach_topics: [{ coach_id: coachId, topic: 'Estrés' }],
    coach_application_interviews: [{ coach_id: coachId, notes: 'Entrevista privada' }],
  };
  const objects = {
    'coach-credentials': new Set([`${userId}/documento.pdf`, `${userId}/huerfano.pdf`]),
    'coach-videos': new Set([`${userId}/video.mp4`]),
    avatars: new Set([`${userId}/avatar.jpg`]),
    'identity-docs': new Set([`${userId}/dni-frente.jpg`, `${userId}/selfie.jpg`]),
  };
  const events = [];
  let authDeleted = false;
  let storageFailure = failCredentialsOnce;

  const admin = {
    auth: {
      getUser: async () => ({ data: { user: authDeleted ? null : { id: userId } }, error: null }),
      admin: { deleteUser: async () => { events.push('auth:delete'); authDeleted = true; return { error: null }; } },
    },
    storage: { from(bucket) { return {
      list: async prefix => ({ data: [...objects[bucket]].filter(p => p.startsWith(`${prefix}/`))
        .map(p => ({ name: p.slice(prefix.length + 1) })), error: null }),
      remove: async paths => {
        events.push(`storage:${bucket}:remove`);
        if (bucket === 'coach-credentials' && storageFailure) {
          storageFailure = false;
          return { error: { message: 'storage temporalmente indisponible' } };
        }
        paths.forEach(p => objects[bucket].delete(p));
        return { error: null };
      },
    }; } },
    from(table) {
      const filters = [];
      let mode = 'select';
      let patch = null;
      const q = {
        select() { return q; },
        eq(col, value) { filters.push(r => r[col] === value); return q; },
        in(col, values) { filters.push(r => values.includes(r[col])); return q; },
        gte(col, value) { filters.push(r => r[col] >= value); return q; },
        is(col, value) { filters.push(r => (r[col] ?? null) === value); return q; },
        update(value) { mode = 'update'; patch = value; return q; },
        delete() { mode = 'delete'; return q; },
        async maybeSingle() { const out = await execute(); return { data: out.data[0] ?? null, error: out.error }; },
        then(resolve, reject) { return execute().then(resolve, reject); },
      };
      async function execute() {
        const rows = tables[table] ?? [];
        const selected = rows.filter(r => filters.every(f => f(r)));
        if (mode === 'update') {
          events.push(`${table}:update`);
          selected.forEach(r => Object.assign(r, patch));
        }
        if (mode === 'delete') {
          events.push(`${table}:delete`);
          tables[table] = rows.filter(r => !selected.includes(r));
        }
        return { data: selected, count: selected.length, error: null };
      }
      return q;
    },
  };

  let handler;
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  assert(!js.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error));
  const globals = {
    exports: {}, Request, Response, Date, JSON, console,
    Deno: { env: { get: () => 'test' } },
    require(spec) {
      if (spec.includes('/http/server.ts')) return { serve: fn => { handler = fn; } };
      if (spec.includes('supabase-js')) return { createClient: () => admin };
      if (spec.endsWith('/cors.ts')) return { WEB_ORIGIN: 'https://example.invalid' };
      throw Error(`Unexpected import: ${spec}`);
    },
  };
  vm.runInNewContext(js.outputText, globals, { filename: file });
  const request = () => new Request('https://example.invalid/delete-account', {
    method: 'POST', headers: { Authorization: 'Bearer test-jwt' },
  });
  return { handler, request, tables, objects, events, get authDeleted() { return authDeleted; } };
}

(async () => {
  const blocked = fixture({ futureBooking: true });
  assert.equal((await blocked.handler(blocked.request())).status, 409);
  assert.equal(blocked.tables.coaches[0].verified, true);
  assert.equal(blocked.authDeleted, false);

  const retry = fixture({ failCredentialsOnce: true });
  assert.equal((await retry.handler(retry.request())).status, 500);
  assert.equal(retry.tables.coaches[0].verified, false);
  assert.equal(retry.authDeleted, false);
  assert.equal((await retry.handler(retry.request())).status, 200);
  assert.equal(retry.authDeleted, true);
  assert.equal(retry.tables.coaches[0].bio, null);
  assert.equal(retry.tables.coaches[0].application_video_url, null);
  assert.equal(retry.tables.coaches[0].slug, `deleted-${coachId}`);
  assert.equal(retry.tables.profiles[0].name, 'Usuario eliminado');
  const vieja = retry.tables.bookings.find(b => b.id === 'vieja');
  assert.equal(vieja.user_message, null);
  assert.equal(vieja.tema_origen, null);
  assert.equal(vieja.status, 'completada');
  assert.equal(retry.tables.bookings.find(b => b.id === 'empezada').status, 'confirmada');
  assert.equal(retry.tables.bookings.find(b => b.id === 'por-venir').status, 'cancelada');
  assert.deepEqual(retry.tables.session_notes.map(n => n.id), ['ajena', 'mia-compartida']);
  assert.equal(retry.tables.coach_calendar_feeds.length, 0);
  assert.deepEqual(retry.tables.coach_availability.map(a => a.coach_id), ['otro-coach']);
  assert.equal(retry.tables.coach_weekly_pattern.length, 0);
  assert.equal(retry.tables.coach_payout_accounts.length, 0);
  assert.equal(retry.tables.coach_mp_accounts.length, 0);
  assert.equal(retry.tables.coaches[0].mp_connected, false);
  assert.deepEqual(retry.tables.resource_events.map(e => e.id), ['evento-ajeno']);
  assert.equal(retry.tables.coach_credentials.length, 0);
  assert.equal(retry.tables.coach_topics.length, 0);
  assert.equal(retry.tables.coach_application_interviews.length, 0);
  for (const paths of Object.values(retry.objects)) assert.equal(paths.size, 0);
  assert(retry.events.indexOf('coaches:update') < retry.events.indexOf('storage:coach-credentials:remove'));
  assert.equal(retry.events.at(-1), 'auth:delete');
  // Con un reintegro en curso, los datos de cobro se quedan: sin el token de
  // Mercado Pago del profesional ese reintegro no tiene por dónde salir.
  const conPlata = fixture({ openRefund: true });
  assert.equal((await conPlata.handler(conPlata.request())).status, 200);
  assert.equal(conPlata.tables.coach_payout_accounts.length, 1);
  assert.equal(conPlata.tables.coach_mp_accounts.length, 1);
  assert.equal(conPlata.tables.coach_calendar_feeds.length, 0);
  assert.equal(conPlata.authDeleted, true);

  console.log('PASS baja: bloqueo por reserva, despublicación, limpieza, texto de reservas y notas, agenda y datos de cobro, reintento');
})().catch(error => { console.error(error); process.exitCode = 1; });
