import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const db = new PGlite();
const user = '11111111-1111-4111-8111-111111111111';
const coach = '22222222-2222-4222-8222-222222222222';
const booking = '33333333-3333-4333-8333-333333333333';
const sql = file => fs.readFileSync(path.join(root, file), 'utf8');
const query = statement => db.query(statement);

try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create function auth.uid() returns uuid language sql as $$select null::uuid$$;`);
  await db.exec(sql('scripts/security-tests/fixture.sql'));
  await db.exec(`alter table bookings add column referral_discount numeric default 0;
    create table session_attendance (
      booking_id uuid primary key references bookings(id),
      checked_at timestamptz not null default now(),
      max_simultaneous integer,
      raw jsonb,
      participants_count integer
    );
    insert into profiles(id,email,role) values('${user}','user@example.invalid','user');
    insert into coaches(id,slug) values('${coach}','fixture');
    insert into bookings(id,user_id,coach_id,coach_name,scheduled_date,scheduled_time,
      status,payment_status,referral_discount)
      values('${booking}','${user}','${coach}','Fixture',current_date-2,'09:00',
      'pendiente','aprobado',10);`);

  await db.exec(sql('supabase/migrations/20260923010000_payment_integrity.sql'));
  assert.equal((await query(`select claim_paid_booking_effects('${booking}') as id`)).rows[0].id !== null, true);
  assert.equal((await query(`select claim_paid_booking_effects('${booking}') as id`)).rows[0].id, null);
  const claim = (await query(`select paid_effects_claim_id as id from bookings where id='${booking}'`)).rows[0].id;
  assert.equal((await query(`select finish_paid_booking_effects('${booking}','${claim}') as ok`)).rows[0].ok, true);
  assert.equal((await query(`select claim_paid_booking_effects('${booking}') as id`)).rows[0].id, null);
  console.log('PASS paid effects are claimed once and marked complete');

  await assert.rejects(query(`insert into bookings(user_id,coach_id,coach_name,scheduled_date,scheduled_time,
    referral_discount) values('${user}','${coach}','Fixture',current_date+1,'10:00',10)`),
    error => error.code === '23505');
  await query(`update bookings set status='cancelada',payment_status='pendiente' where id='${booking}'`);
  await query(`insert into bookings(user_id,coach_id,coach_name,scheduled_date,scheduled_time,
    referral_discount) values('${user}','${coach}','Fixture',current_date+1,'10:00',10)`);
  console.log('PASS one active referral discount; abandoned checkout releases it');

  const confirmed = (await query(`insert into bookings(user_id,coach_id,coach_name,
    scheduled_date,scheduled_time,status,payment_status)
    values('${user}','${coach}','Fixture',current_date-2,'11:00','confirmada','aprobado')
    returning id`)).rows[0].id;
  await query(`insert into session_attendance(booking_id,max_simultaneous,raw,participants_count)
    values('${confirmed}',2,'{"data":[]}',2)`);
  await query('select complete_confirmed_sessions()');
  assert.equal((await query(`select status from bookings where id='${confirmed}'`)).rows[0].status,'confirmada');
  await query(`update session_attendance set refund_resolution='resolved' where booking_id='${confirmed}'`);
  await query('select complete_confirmed_sessions()');
  assert.equal((await query(`select status from bookings where id='${confirmed}'`)).rows[0].status,'completada');
  console.log('PASS session completion waits for refund decision');

  await db.exec(sql('supabase/migrations/20260923010000_payment_integrity.sql'));
  console.log('PASS migration can be rerun');
} finally {
  await db.close();
}
