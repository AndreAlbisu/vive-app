// Real TS handlers, mocked auth/database/provider HTTP. No production calls.
const fs=require('fs'), vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const ts=require('typescript'), base=path.resolve(__dirname,'../../supabase/functions');
function load(file,extras={},env={}) {
 let handler;const exports={};
 const globals={exports,Request,Response,URL,Headers,TextEncoder,Uint8Array,Date,Set,Map,Math,JSON,Number,String,Array,console:{log(){},warn(){},error(){}},btoa,atob,crypto:require('node:crypto').webcrypto,Deno:{env:{get:k=>env[k]??'fixture'},serve:h=>handler=h},...extras};
 globals.require=spec=>{
  if(spec.includes('/http/server.ts'))return {serve:h=>handler=h};
  if(spec.includes('supabase-js'))return {createClient:()=>extras.admin};
  if(spec.endsWith('/mp.ts'))return {getFreshCoachToken:async()=> 'fixture-token',verifyWebhookSignature:async()=>true};
  if(spec.endsWith('/commission.ts'))return {commissionPctFor:()=>20,marketplaceFeeFor:(n,p)=>n*p/100,PAIR_SESSION_FILTER:'fixture'};
  if(spec.endsWith('/guarantee.ts'))return {scheduledAtMs:()=>Date.now()};
  if(spec.endsWith('/booking-effects.ts'))return {applyPaidBookingEffects:async()=>{extras.effects?.push('paid')}};
  if(spec.startsWith('.'))return load(path.relative(base,path.resolve(base,path.dirname(file),spec)),extras,env).exports;
  throw Error(spec);
 };
 const compiled=ts.transpileModule(fs.readFileSync(path.join(base,file),'utf8'),{reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 assert(!compiled.diagnostics?.some(x=>x.category===ts.DiagnosticCategory.Error),file+' syntax');
 vm.runInNewContext(compiled.outputText,globals,{filename:file});return {exports,handler};
}
function db(rows={},rpcData=true){const writes=[],reads=[],filters=[];return {writes,reads,filters,auth:{getUser:async()=>({data:{user:{id:'user'}}})},rpc:async(name)=>({data:name==='claim_checkout'?'attempt':rpcData}),from(table){reads.push(table);let patch;const q={};
 for(const op of ['select','eq','neq','or','gt','gte','is','in','not','limit','order'])q[op]=(...args)=>{filters.push([table,op,...args]);return q};
 q.update=p=>{patch=p;writes.push({table,patch:p});return q};
 q.maybeSingle=q.single=async()=>({data:rows[table],count:0});
 q.then=(resolve,reject)=>Promise.resolve({data:patch?(Array.isArray(rows[table])?rows[table].map(x=>({id:x.id})):[{id:'booking'}]):rows[table],count:0}).then(resolve,reject);return q}}}
const req=(body={},webhook=false)=>new Request('https://example.invalid'+(webhook?'?data.id=payment&type=payment':''),{method:'POST',headers:{Authorization:'Bearer fixture','Content-Type':'application/json',...(webhook?{'x-signature':'fixture'}:{})},body:JSON.stringify(body)});
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS',name)}
(async()=>{
 for(const status of ['cancelada','pendiente','completada'])await test('video rejects '+status,async()=>{
  const admin=db({bookings:{id:'booking',user_id:'user',sala_id:'sala',status,payment_status:'aprobado'},salas:{user_id:'user',coach_id:'coach'}});let requests=0;
  const {handler}=load('create-meeting-room/index.ts',{admin,fetch:async()=>{requests++;throw Error('unexpected provider call')}});
  assert.equal((await handler(req({booking_id:'booking'}))).status,409);assert.equal(requests,0);
 });
 await test('confirmed video still creates a join token',async()=>{
  const admin=db({bookings:{id:'booking',user_id:'user',sala_id:'sala',status:'confirmada',payment_status:'aprobado',duration_minutes:60},salas:{user_id:'user',coach_id:'coach'},profiles:{name:'Fixture'}});let minted=false;
  const {handler}=load('create-meeting-room/index.ts',{admin,fetch:async url=>{if(url.endsWith('meeting-tokens'))minted=true;return Response.json(url.endsWith('meeting-tokens')?{token:'fixture-token'}:{url:'https://example.invalid/room',config:{}})}});
  assert.equal((await handler(req({booking_id:'booking'}))).status,200);assert(minted);
 });
 for(const allowed of [false,true])await test('push block/quota '+allowed,async()=>{
  const admin=db({salas:{user_id:'user',coach_id:'coach'},profiles:{push_token:'fixture'}},allowed);let sent=[];
  const {handler}=load('send-push/index.ts',{admin,fetch:async(url,opts)=>{sent.push(JSON.parse(opts.body));return Response.json({})}});
  assert.equal((await handler(req({salaId:'sala',recipientId:'coach',title:'forged',body:'private conversation'}))).status,200);
  assert.equal(sent.length,allowed?1:0);if(allowed)assert(!JSON.stringify(sent).includes('private conversation'));
 });
 for(const [status,payment_status,payment_provider] of [['pendiente','aprobado','mp'],['cancelada','pendiente','mp'],['pendiente','pendiente','paypal'],['pendiente','reembolsado','mp']])await test(`MP rejects ${status}/${payment_status}/${payment_provider}`,async()=>{
  const admin=db({bookings:{id:'booking',user_id:'user',status,payment_status,payment_provider},coaches:{price_per_session:50000}});let calls=0;
  const {handler}=load('mp-create-payment/index.ts',{admin,fetch:async()=>{calls++;throw Error('unexpected')}});
  assert.equal((await handler(req({booking_id:'booking'}))).status,409);assert.equal(calls,0);assert.equal(admin.writes.length,0);
 });
 await test('MP creates ARS checkout with attempt CAS',async()=>{
  const admin=db({bookings:{id:'booking',user_id:'user',coach_id:'coach',status:'pendiente',payment_status:'no_iniciado',payment_provider:'mp',amount:1,currency:'USD'},coaches:{price_per_session:50000}},false);let body;
  const {handler}=load('mp-create-payment/index.ts',{admin,fetch:async(url,opts)=>{body=JSON.parse(opts.body);return Response.json({id:'preference',init_point:'https://example.invalid/pay'})}},{MP_TEST_MODE:'false'});
  const res=await handler(req({booking_id:'booking'}));assert.equal(res.status,200);assert.equal(body.items[0].currency_id,'ARS');assert.equal(body.items[0].unit_price,50000);assert(admin.filters.some(x=>x[2]==='checkout_attempt_id'));
 });
 for(const [pref,amount,currency,expectedStatus] of [['old',50000,'ARS',409],['preference',1,'ARS',409],['preference',50000,'USD',409],['preference',50000,'ARS',200]])await test(`MP webhook ${pref}/${amount}/${currency}`,async()=>{
  const admin=db({bookings:{id:'booking',payment_provider:'mp',preference_id:'preference',payment_status:'pendiente',status:'pendiente',amount:50000,currency:'ARS'},coaches:{id:'coach'}});const effects=[];
  const {handler}=load('mp-webhook/index.ts',{admin,effects,fetch:async url=>Response.json(url.includes('merchant_orders')?{preference_id:pref}:{id:'payment',external_reference:'booking',status:'approved',order:{id:'order'},transaction_amount:amount,currency_id:currency})});
  assert.equal((await handler(req({user_id:123},true))).status,expectedStatus);assert.equal(admin.writes.length,expectedStatus===200?1:0);
 });
 await test('PayPal creates checkout without replacing another rail',async()=>{
  const admin=db({bookings:{id:'booking',user_id:'user',coach_id:'coach',status:'pendiente',payment_status:'no_iniciado',payment_provider:'mp'},coaches:{id:'coach',price_usd:50,accepts_international:true},coach_payout_accounts:{accepts_paypal:true}});
  let orders=0;
  const {handler}=load('paypal-create-payment/index.ts',{admin,fetch:async url=>{if(url.includes('/oauth2/token'))return Response.json({access_token:'fixture',expires_in:300});orders++;return Response.json({id:'order',links:[{rel:'approve',href:'https://example.invalid/pay'}]})}});
  assert.equal((await handler(req({booking_id:'booking'}))).status,200);assert.equal(orders,1);assert(admin.filters.some(x=>x[2]==='checkout_attempt_id'));
 });
 await test('USDT gated until safe ledger is explicitly configured',async()=>{
  const admin=db();const {handler}=load('usdt-create-payment/index.ts',{admin},{USDT_LEDGER_WALLET:'not-the-wallet'});
  assert.equal((await handler(req({booking_id:'booking'}))).status,503);assert.equal(admin.writes.length,0);
 });
 await test('USDT legacy instruction is not reissued after cutover',async()=>{
  const admin=db({bookings:{id:'booking',user_id:'user',status:'pendiente',payment_status:'pendiente',payment_provider:'usdt',usdt_amount:49.99}});
  const {handler}=load('usdt-create-payment/index.ts',{admin});assert.equal((await handler(req({booking_id:'booking'}))).status,409);
 });
 await test('USDT assigns a new amount through the claimed attempt',async()=>{
  const admin=db({bookings:{id:'booking',user_id:'user',coach_id:'coach',status:'pendiente',payment_status:'no_iniciado',payment_provider:'mp'},coaches:{id:'coach',price_usd:50,accepts_international:true},coach_payout_accounts:{accepts_usdt:true}});
  const {handler}=load('usdt-create-payment/index.ts',{admin});const response=await handler(req({booking_id:'booking'}));assert.equal(response.status,200);
  const body=await response.json();assert(body.amount>49&&body.amount<=50);assert(admin.filters.some(x=>x[2]==='checkout_attempt_id'));
 });
 await test('USDT rejects transfers before assignment',async()=>{const {exports:m}=load('_shared/usdt.ts');const t={transaction_id:'old',from:'third-party',to:'wallet',value:'49990000',type:'Transfer',block_timestamp:100,token_info:{address:m.USDT_TRC20_CONTRACT}};
  assert.equal(m.findPayment([t],{direccion:'wallet',monto:49.99,assignedAtMs:101}).kind,'sin_match');assert.equal(m.findPayment([t],{direccion:'wallet',monto:49.99,assignedAtMs:99}).kind,'match');
 });
 await test('notification email escapes body and ignores forged subject',async()=>{
  const admin=db({notifications:[{id:'n',recipient_id:'user',type:'reserva_confirmada',title:'FORGED',body:'<a href="https://example.invalid">Phish</a>',booking_id:'booking'}],profiles:[{id:'user',email:'user@example.invalid'}]});let sent;
  const {handler}=load('mail-notificaciones/index.ts',{admin,fetch:async(url,opts)=>{sent=JSON.parse(opts.body);return Response.json({})}});
  assert.equal((await handler(req())).status,200);assert(sent);assert(!sent.html.includes('<a href="https://example.invalid">'));assert(!sent.subject.includes('FORGED'));assert(sent.html.includes('&lt;a'));
 });
 console.log(`${passed} endpoint security tests passed (mocked services)`);
})().catch(e=>{console.error(e);process.exitCode=1});
