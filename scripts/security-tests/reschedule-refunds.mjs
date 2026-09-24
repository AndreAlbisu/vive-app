import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
const db=new PGlite();
const uid='11111111-1111-4111-8111-111111111111', cp='22222222-2222-4222-8222-222222222222', cid='33333333-3333-4333-8333-333333333333', sid='44444444-4444-4444-8444-444444444444';
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
const q=sql=>db.query(sql);
async function blocked(sql,code){await assert.rejects(q(sql),e=>!code||e.code===code)}
try {
await db.exec(`create role authenticated;create role anon;create role service_role;create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth,public to authenticated,anon,service_role;`);
await db.exec(read('scripts/security-tests/fixture.sql'));
await db.exec(`alter table bookings add column tema_origen text;
create function public.is_admin() returns boolean language sql security definer as $$select coalesce((select is_admin from profiles where id=auth.uid()),false)$$;
create table blocked_users(blocker_id uuid,blocked_id uuid);
create function public.are_blocked(a uuid,b uuid) returns boolean language sql security definer as $$select exists(select 1 from blocked_users where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a))$$;
grant select,insert,delete on bookings to authenticated;grant select on coaches,salas to authenticated;
grant select,insert,update on coach_resources to authenticated;grant insert,select,update,delete on notifications to authenticated;`);
for (const n of ['harden-bookings-update.sql','add-late-cancel-server-side.sql','cerrar-notifications-insert.sql','restrict-authenticated-profiles-columns.sql']) await db.exec(read('scripts/'+n));
await db.exec(`insert into profiles(id,email,role,birth_date) values('${uid}','user@example.invalid','user','1990-01-01'),('${cp}','coach@example.invalid','coach','1980-01-01');
insert into coaches(id,profile_id,slug,verified,mp_connected,price_per_session) values('${cid}','${cp}','fixture',true,true,50000);
insert into salas(id,user_id,coach_id) values('${sid}','${uid}','${cp}');`);
await db.exec(read('scripts/security-audit-2026-09-22.sql'));
// Migration is rerunnable.
await db.exec(read('scripts/security-audit-2026-09-22.sql'));
await db.exec(read('supabase/migrations/20260923020000_require_paid_bookings.sql'));
const user=async(id=uid)=>db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`);
const server=async()=>db.exec(`reset role;select set_config('request.jwt.claim.sub','',false);`);

await db.exec(`create table coach_availability(coach_id uuid,date date,time text,blocked boolean);
create function public.avisar(uuid,text,uuid,text,text) returns void language sql as $$select$$;`);
await db.exec(read('scripts/add-reagendar.sql'));
await db.exec(read('scripts/add-proponer-horarios.sql'));
await db.exec(read('scripts/add-contrapropuesta-horario.sql'));
if (!process.argv.includes('--baseline')) await db.exec(read('supabase/migrations/20260924000000_reschedule_refund_integrity.sql'));
async function booking() {
  await server();
  return (await q(`insert into bookings(user_id,coach_id,sala_id,coach_name,scheduled_date,scheduled_time,status,payment_status)
    values('${uid}','${cid}','${sid}','Fixture',
    ((now()+interval '2 hours') at time zone 'America/Argentina/Buenos_Aires')::date,
    to_char((now()+interval '2 hours') at time zone 'America/Argentina/Buenos_Aires','HH24:MI'),
    'confirmada','aprobado') returning id`)).rows[0].id;
}
let proposalDay=3;
async function proposal(b) {
 await user(cp);
 await q(`select proponer_horarios('${b}',array[current_date+${proposalDay++}],array['11:00'])`);
}
const b=await booking();
await proposal(b);
await user();
await q(`select rechazar_horarios('${b}')`);
await server();
const actual=(await q(`select status,cancelled_by,payment_status,cancelled_late from bookings where id='${b}'`)).rows[0];
console.log('Professional proposal rejected within 24h:',actual);
assert.equal(actual.payment_status,'reembolso_pendiente');
assert.equal(actual.cancelled_by,'coach');
assert.equal(actual.cancelled_late,true);
console.log('PASS legitimate professional reschedule refund');
const ordinary=await booking();
await user();
await q(`update bookings set status='cancelada',cancelled_by='coach' where id='${ordinary}'`);
await server();
assert.equal((await q(`select payment_status from bookings where id='${ordinary}'`)).rows[0].payment_status,'aprobado');
console.log('PASS forged responsibility still denied');
const direct=await booking();
await proposal(direct);
await user();
await q(`update bookings set status='cancelada' where id='${direct}'`);
await server();
assert.equal((await q(`select payment_status from bookings where id='${direct}'`)).rows[0].payment_status,'reembolso_pendiente');
console.log('PASS ordinary cancel honors existing professional proposal');
await user();
await blocked(`insert into reschedule_requests(booking_id,pedida_por,fecha,hora) values('${direct}','profesional',current_date+3,'15:00')`,'42501');
await user(cp);
await blocked(`select rechazar_horarios('${direct}')`,'42501');
console.log('PASS clients cannot forge proposal evidence or reject another owner booking');

const unilateral=await booking();
await proposal(unilateral);
await server();
const own=(await q(`select id from reschedule_requests where booking_id='${unilateral}' and estado='pendiente'`)).rows[0].id;
await user(cp);
await blocked(`select responder_reagendado('${own}',true)`);
console.log('PASS professional cannot accept own proposal');
await user();
await q(`select elegir_horario('${own}')`);
console.log('PASS client can still choose professional proposal');
const stale=await booking();
await proposal(stale);
await server();
const staleRequest=(await q(`select id from reschedule_requests where booking_id='${stale}' and estado='pendiente'`)).rows[0].id;
await q(`update bookings set status='cancelada' where id='${stale}'`);
await user();
await blocked(`select elegir_horario('${staleRequest}')`);
console.log('PASS cancelled booking cannot be rescheduled');
const legitimate=await booking();
await server();
const clientRequest=(await q(`insert into reschedule_requests(booking_id,pedida_por,fecha,hora) values('${legitimate}','cliente',current_date+4,'14:00') returning id`)).rows[0].id;
await user(cp);
await blocked(`select responder_reagendado('${clientRequest}',null)`);
await q(`select responder_reagendado('${clientRequest}',true)`);
console.log('PASS professional can accept client request, null is rejected');

await server();
await q(`update coaches set mp_connected=false,accepts_paypal=false,accepts_usdt=false where id='${cid}'`);
await user();
const unpaid=(await q(`insert into bookings(user_id,coach_id,sala_id,coach_name,scheduled_date,scheduled_time)
 values('${uid}','${cid}','${sid}','Fixture',current_date+10,'16:00') returning id,requires_payment`)).rows[0];
assert.equal(unpaid.requires_payment,true);
await blocked(`update bookings set status='confirmada' where id='${unpaid.id}'`,'23514');
console.log('PASS strict payment requirement preserved after new migration');
await server();
await db.exec(read('supabase/migrations/20260924000000_reschedule_refund_integrity.sql'));
console.log('PASS migration rerun');
} finally { await db.close(); }
