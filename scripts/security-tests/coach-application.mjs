import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '../..');
const db = new PGlite();
const uid = '11111111-1111-4111-8111-111111111111';
const admin = '22222222-2222-4222-8222-222222222222';
const psychologist = '33333333-3333-4333-8333-333333333333';
const pending = '44444444-4444-4444-8444-444444444444';
const migration = name => fs.readFileSync(path.join(root, 'supabase/migrations', name), 'utf8');
const q = sql => db.query(sql);
const application = (bio = 'Acompaño con experiencia y cuidado', topics = "array['Duelo','Autoestima']::text[]", specialty = 'Coach') => `
  select public.submit_coach_application(
    '${specialty}','${bio}',${topics},'escucha','acompana',array['presente']::text[],
    '1990-01-01','Prefiero no decir',null,30000,'https://example.com/video',
    ${specialty === 'Psicólogo/a' ? 'null' : 'true'},
    'Pregunto si está a salvo y busco ayuda inmediata si hay riesgo.',
    'Argentina','Córdoba'
  ) as id`;

try {
  await db.exec(`
    create role authenticated; create role anon; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth, public to authenticated, anon;
    create table profiles (
      id uuid primary key, deleted_at timestamptz, birth_date date, gender text,
      role text not null default 'user', is_admin boolean not null default false
    );
    create table coaches (
      id uuid primary key default gen_random_uuid(), profile_id uuid unique references profiles(id),
      verified boolean not null default false, application_status text not null default 'pendiente',
      application_reviewed_at timestamptz, application_notes text, specialty text, bio text,
      price_per_session numeric, nationality text, application_video_url text,
      estilo text, guia text, focos text[]
    );
    create table coach_topics (
      coach_id uuid references coaches(id), topic text, primary key(coach_id, topic)
    );
    create table coach_credentials (
      coach_id uuid references coaches(id), kind text, status text, profesion text
    );
    insert into profiles(id) values ('${uid}');
    insert into profiles(id,is_admin) values ('${admin}',true);
    insert into profiles(id) values ('${psychologist}');
    insert into profiles(id) values ('${pending}');
  `);
  await db.exec(migration('20260924020000_submit_coach_application.sql'));
  await db.exec(`create trigger trg_reset_application_on_edit before update on coaches
    for each row execute function public.reset_application_on_edit();`);
  await db.exec(migration('20260924030000_coach_interview_review.sql'));
  await db.exec(migration('20260925010000_submit_application_practice_limits.sql'));

  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);`);
  await assert.rejects(q(application().replace('true,\n    ', 'false,\n    ')), /postulacion_invalida/);
  const coachId = (await q(application())).rows[0].id;
  assert(coachId);
  await db.exec('reset role');
  assert.equal((await q('select count(*)::int as n from coach_topics')).rows[0].n, 2);
  assert.equal((await q(`select birth_date from profiles where id='${uid}'`)).rows[0].birth_date.toISOString().slice(0, 10), '1990-01-01');

  await assert.rejects(q(`select * from approve_coach_application('${coachId}','${admin}')`), /entrevista_pendiente/);
  assert.equal((await q(`select role from profiles where id='${uid}'`)).rows[0].role, 'user');

  await db.exec(`update coaches set application_status='rechazada' where id='${coachId}';`);
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);`);
  await assert.rejects(q(application('Corta')), /postulacion_invalida/);
  await db.exec('reset role');
  assert.equal((await q(`select application_status from coaches where id='${coachId}'`)).rows[0].application_status, 'rechazada');
  assert.equal((await q('select count(*)::int as n from coach_topics')).rows[0].n, 2);

  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);`);
  await q(application('Acompaño de forma cuidadosa', "array['Hábitos']::text[]"));
  await db.exec('reset role');
  assert.equal((await q(`select application_status from coaches where id='${coachId}'`)).rows[0].application_status, 'pendiente');
  assert.deepEqual((await q('select topic from coach_topics')).rows, [{ topic: 'Hábitos' }]);

  await db.exec(`insert into coach_application_interviews(coach_id,interviewer_id,notes)
    values('${coachId}','${admin}','Entrevista realizada; límites claros.');`);
  await assert.rejects(q(`select * from approve_coach_application('${coachId}','${uid}')`), /no_autorizado/);
  await q(`select * from approve_coach_application('${coachId}','${admin}')`);
  assert.deepEqual((await q(`select verified,application_status from coaches where id='${coachId}'`)).rows[0],
    { verified: true, application_status: 'aprobada' });
  assert.equal((await q(`select role from profiles where id='${uid}'`)).rows[0].role, 'coach');

  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${psychologist}',false);`);
  const psychId = (await q(application(undefined, undefined, 'Psicólogo/a'))).rows[0].id;
  await db.exec('reset role');
  await db.exec(`insert into coach_application_interviews(coach_id,interviewer_id,notes)
    values('${psychId}','${admin}','Entrevista y alcance profesional revisados.');`);
  await assert.rejects(q(`select * from approve_coach_application('${psychId}','${admin}')`), /matricula_pendiente/);
  await assert.rejects(q(`update coaches set verified=true where id='${psychId}'`), /matricula_pendiente/);
  assert.equal((await q(`select role from profiles where id='${psychologist}'`)).rows[0].role, 'user');
  await db.exec(`insert into coach_credentials(coach_id,kind,status,profesion)
    values('${psychId}','matricula','verificada','psicologia');`);
  await q(`select * from approve_coach_application('${psychId}','${admin}')`);
  assert.equal((await q(`select role from profiles where id='${psychologist}'`)).rows[0].role, 'coach');

  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${pending}',false);`);
  const pendingId = (await q(application())).rows[0].id;
  await db.exec('reset role');
  await db.exec(`
    grant select on coaches, coach_topics to anon, authenticated;
    alter table coaches enable row level security;
    alter table coach_topics enable row level security;
    create policy "Coaches are viewable by everyone" on coaches for select using (true);
    create policy "Coaches públicos para todos" on coaches for select using (true);
    create policy "coach_topics_public_read" on coach_topics for select using (true);
    create policy "coach_topics_manage_own" on coach_topics for all to authenticated
      using (coach_id in (select id from coaches where profile_id = auth.uid()))
      with check (coach_id in (select id from coaches where profile_id = auth.uid()));
  `);
  await db.exec(migration('20260924040000_private_pending_coaches.sql'));
  await db.exec('set role anon');
  assert.equal((await q('select count(*)::int as n from coaches')).rows[0].n, 2);
  assert.equal((await q(`select count(*)::int as n from coach_topics where coach_id='${pendingId}'`)).rows[0].n, 0);
  await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${pending}',false);`);
  assert.equal((await q(`select count(*)::int as n from coaches where id='${pendingId}'`)).rows[0].n, 1);
  assert.equal((await q(`select count(*)::int as n from coach_topics where coach_id='${pendingId}'`)).rows[0].n, 2);
  await db.exec('reset role');

  console.log('PASS postulación atómica, reenvío, entrevista, matrícula y privacidad RLS');
} finally {
  await db.close();
}
