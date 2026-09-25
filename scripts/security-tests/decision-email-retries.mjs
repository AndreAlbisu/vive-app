import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '../..');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260924050000_decision_email_retries.sql'), 'utf8');
const db = new PGlite();

try {
  await db.exec(`
    create table notifications (
      id integer primary key,
      type text not null,
      created_at timestamptz not null,
      emailed_at timestamptz
    );
    insert into notifications(id,type,created_at) values
      (1,'postulacion_rechazada',now()-interval '2 days'),
      (2,'postulacion_aprobada',now()-interval '2 hours'),
      (3,'reserva_confirmada',now()-interval '2 days');
  `);
  await db.exec(migration);
  const { rows } = await db.query('select id, emailed_at is not null as marked, mail_completed_at is not null as completed, mail_attempts from notifications order by id');
  assert.deepEqual(rows, [
    { id: 1, marked: true, completed: true, mail_attempts: 0 },
    { id: 2, marked: false, completed: false, mail_attempts: 0 },
    { id: 3, marked: false, completed: false, mail_attempts: 0 },
  ]);
  await db.exec(`insert into notifications(id,type,created_at) values (4,'postulacion_rechazada',now())`);
  const fresh = (await db.query('select emailed_at, mail_attempts from notifications where id=4')).rows[0];
  assert.equal(fresh.emailed_at, null);
  assert.equal(fresh.mail_attempts, 0);
  console.log('PASS backfill seguro y nuevas decisiones pendientes');
} finally {
  await db.close();
}
