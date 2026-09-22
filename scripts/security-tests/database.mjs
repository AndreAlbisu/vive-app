import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
const db=new PGlite();
const uid='11111111-1111-4111-8111-111111111111', cp='22222222-2222-4222-8222-222222222222', cid='33333333-3333-4333-8333-333333333333', sid='44444444-4444-4444-8444-444444444444';
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
const q=sql=>db.query(sql);
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS',name)}
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
const user=async(id=uid)=>db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`);
const server=async()=>db.exec(`reset role;select set_config('request.jwt.claim.sub','',false);`);
const insert=(time,extra='')=>`insert into bookings(user_id,coach_id,sala_id,coach_name,scheduled_date,scheduled_time${extra}) values('${uid}','${cid}','${sid}','Fixture',current_date+1,'${time}'`;
await user();
await test('forged paid INSERT denied',()=>blocked(insert('10:00',',payment_status')+`,'aprobado')`,'42501'));
let b;
await test('legitimate INSERT derives price and initial state',async()=>{b=(await q(insert('11:00',',amount,status')+`,1,'confirmada') returning *`)).rows[0];assert.equal(b.status,'pendiente');assert.equal(b.amount,50000)});
await test('forged owner with real room rejected',()=>blocked(`insert into bookings(user_id,coach_id,sala_id,coach_name,scheduled_date,scheduled_time) values('${cp}','${cid}','${sid}','Fixture',current_date+1,'10:30')`));
await test('confirmation without checkout denied',()=>blocked(`update bookings set status='confirmada' where id='${b.id}'`,'23514'));
await test('private fields blocked; public name still readable',async()=>{await blocked(`select birth_date from profiles where id='${cp}'`,'42501');assert.equal((await q(`select name from profiles where id='${cp}'`)).rows.length,1)});
await test('own private profile via RPC only',async()=>{const rows=(await q('select id from get_my_profile()')).rows;assert.deepEqual(rows,[{id:uid}])});
await server();let paid=(await q(insert('12:00',',status,payment_status')+`,'confirmada','aprobado') returning id`)).rows[0].id;
// Force a late cancellation independently of wall-clock time.
await q(`update bookings set scheduled_date=(now() at time zone 'America/Argentina/Buenos_Aires')::date,scheduled_time=to_char(now() at time zone 'America/Argentina/Buenos_Aires','HH24:MI') where id='${paid}'`);
await user();
await test('forged cancellation actor overwritten before refund trigger',async()=>{const x=(await q(`update bookings set status='cancelada',cancelled_by='coach' where id='${paid}' returning cancelled_by,payment_status`)).rows[0];assert.equal(x.cancelled_by,'usuario');assert.equal(x.payment_status,'aprobado')});
await test('cancelled booking cannot reopen',()=>blocked(`update bookings set status='confirmada' where id='${paid}'`,'23514'));
await user(cp);
let resource;
await test('self-publication forced to pending',async()=>{resource=(await q(`insert into coach_resources(coach_id,title,format,source,topic_id,status,is_author_declared,body_md) values('${cid}','Fixture','lectura','native','fixture','published',true,'Text') returning id,status`)).rows[0];assert.equal(resource.status,'pending')});
await server();await q(`update coach_resources set status='published' where id='${resource.id}'`);await user(cp);
await test('editing approved content resets moderation',async()=>{assert.equal((await q(`update coach_resources set body_md='Changed',status='published' where id='${resource.id}' returning status`)).rows[0].status,'pending')});
await test('coach sees own participant age only',async()=>{const rows=(await q(`select * from get_booking_participant_profiles(array['${uid}'::uuid,'${cp}'::uuid])`)).rows;assert.equal(rows.length,1);assert.equal(rows[0].id,uid);assert(!('birth_date' in rows[0]));});
await test('oversized Markdown rejected',()=>blocked(`update coach_resources set body_md=repeat('x',20001) where id='${resource.id}'`,'23514'));
await user();
await test('false confirmation notification denied',()=>blocked(`insert into notifications(recipient_id,type,booking_id,title,body) values('${cp}','reserva_confirmada','${b.id}','Forged','<a>phishing</a>')`));
const notification=`insert into notifications(recipient_id,type,booking_id,title,body) values('${cp}','reserva_nueva','${b.id}','Forged','<a>phishing</a>')`;
await test('legitimate notification canonicalized',async()=>{await q(notification);await server();const x=(await q('select title,body from notifications')).rows[0];assert(!x.body.includes('<a>'));assert(!x.title.includes('Forged'));await user()});
await test('duplicate client event blocked',()=>blocked(notification,'23505'));
await server();
await test('confirmed slot uniqueness normalizes hours',async()=>{await q(insert('09:00',',status,payment_status')+`,'confirmada','aprobado')`);await blocked(insert('9:00',',status,payment_status')+`,'confirmada','aprobado')`,'23505')});
await test('checkout lease single owner and privileged only',async()=>{const x=(await q(`select claim_checkout('${b.id}','mp') as id`)).rows[0].id;assert(x);assert.equal((await q(`select claim_checkout('${b.id}','paypal') as id`)).rows[0].id,null);await user();await blocked(`select claim_checkout('${b.id}','mp')`,'42501');await server()});
await test('USDT amount not reused after cancellation',async()=>{await q(`update bookings set payment_provider='usdt',usdt_amount=49.99 where id='${b.id}'`);await q(`update bookings set status='cancelada' where id='${b.id}'`);const n=(await q(insert('14:00')+`) returning id`)).rows[0].id;await blocked(`update bookings set usdt_amount=49.99 where id='${n}'`,'23505')});
await test('push block and quota fail closed',async()=>{for(let i=0;i<5;i++)assert.equal((await q(`select claim_push('${uid}','${cp}') as ok`)).rows[0].ok,true);assert.equal((await q(`select claim_push('${uid}','${cp}') as ok`)).rows[0].ok,false);await q(`insert into blocked_users values('${cp}','${uid}')`);assert.equal((await q(`select claim_push('${cp}','${uid}') as ok`)).rows[0].ok,false)});
await test('push destination moves between accounts',async()=>{await user();await q(`select register_push_token('ExpoPushToken[fixture]')`);await user(cp);await q(`select register_push_token('ExpoPushToken[fixture]')`);await server();const rows=(await q(`select id from profiles where push_token='ExpoPushToken[fixture]'`)).rows;assert.deepEqual(rows,[{id:cp}])});
console.log(`${passed} database security tests passed (isolated minimal schema)`);
} finally {await db.close()}
