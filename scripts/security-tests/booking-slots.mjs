// Reservas desde la app: solo en un horario ofrecido, y el cliente confirma solo
// con reserva instantánea (supabase/migrations/20260924010000_booking_slot_and_self_confirm.sql).
// `--baseline` corre sin la migración y tiene que FALLAR: prueba que el ataque existía.
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
await db.exec(read('supabase/migrations/20260923020000_require_paid_bookings.sql'));
await db.exec(`create table if not exists coach_availability(coach_id uuid,date date,time text,blocked boolean);
create table if not exists coach_weekly_pattern(coach_id uuid,slot_duration_minutes integer);
create table if not exists reschedule_requests(booking_id uuid,pedida_por text,estado text);
grant select on coach_availability,coach_weekly_pattern,reschedule_requests to authenticated;
insert into coach_availability values('${cid}',current_date+5,'9:00',false),('${cid}',current_date+6,'10:00',true);
insert into coach_weekly_pattern values('${cid}',50);`);
if (!process.argv.includes('--baseline')) await db.exec(read('supabase/migrations/20260924010000_booking_slot_and_self_confirm.sql'));
const user=async(id=uid)=>db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`);
const server=async()=>db.exec(`reset role;select set_config('request.jwt.claim.sub','',false);`);
const ins=(fecha,hora,extra='')=>`insert into bookings(user_id,coach_id,sala_id,coach_name,scheduled_date,scheduled_time${extra?',duration_minutes':''})
  values('${uid}','${cid}','${sid}','x',${fecha},'${hora}'${extra?','+extra:''}) returning id`;

await user();
await blocked(ins('current_date+5','03:17'),'23514');
console.log('PASS hora que el profesional no ofrece: rechazada');
await blocked(ins('current_date+6','10:00'),'23514');
console.log('PASS turno bloqueado: rechazado');
await blocked(ins('current_date-1','9:00'),'23514');
console.log('PASS fecha pasada: rechazada');

const b=(await q(ins('current_date+5','09:00','600'))).rows[0].id;
await server();
const fila=(await q(`select status,duration_minutes from bookings where id='${b}'`)).rows[0];
assert.equal(fila.status,'pendiente');
assert.equal(fila.duration_minutes,50);
console.log('PASS horario ofrecido ("09:00" = "9:00") entra, y la duración la pone la base (600 -> 50)');

await q(`update bookings set payment_status='aprobado' where id='${b}'`);
await user();
await blocked(`update bookings set status='confirmada' where id='${b}'`,'42501');
await server();
assert.equal((await q(`select status from bookings where id='${b}'`)).rows[0].status,'pendiente');
console.log('PASS sin reserva instantánea el cliente no puede confirmar');

await q(`update coaches set instant_booking=true where id='${cid}'`);
await user();
await q(`update bookings set status='confirmada' where id='${b}'`);
await server();
assert.equal((await q(`select status from bookings where id='${b}'`)).rows[0].status,'confirmada');
console.log('PASS con reserva instantánea y pago aprobado el cliente sí confirma');
} finally { await db.close(); }
