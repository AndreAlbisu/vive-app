-- Seguridad 22/09/2026. NUEVO: pendiente de aplicar, no describe producción.
-- Aplicar completo en staging primero. Transaccional; aborta ante conflictos
-- históricos de agenda. No elimina datos para hacer pasar las constraints.
begin;

-- H01: el cliente puede describir una solicitud, nunca un pago.
revoke insert on public.bookings from authenticated, anon;
grant insert (user_id, coach_id, sala_id, coach_name, coach_specialty,
 scheduled_date, scheduled_time, amount, status, user_message, tema_origen,
 duration_minutes, user_tz_observed, user_observation_source, user_observed_at)
 on public.bookings to authenticated;
alter table public.bookings add column if not exists requires_payment boolean not null default true;
-- Solo solicitudes sin cobro iniciado pueden conservar el circuito sin MP.
update public.bookings b set requires_payment = false
from public.coaches c where c.id=b.coach_id and not coalesce(c.mp_connected,false)
 and b.payment_provider='mp' and b.payment_status='no_iniciado'
 and b.preference_id is null and b.usdt_amount is null;

create or replace function public.guard_booking_security() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.coaches%rowtype; actor uuid := auth.uid();
begin
 select * into c from public.coaches where id=new.coach_id;
 if tg_op='INSERT' then
   if c.id is null or not coalesce(c.verified,false) then
     raise exception 'profesional_no_disponible' using errcode='23514';
   end if;
   if not exists(select 1 from public.salas s where s.id=new.sala_id
      and s.user_id=new.user_id and s.coach_id=c.profile_id) then
     raise exception 'sala_invalida' using errcode='23514';
   end if;
   new.requires_payment := coalesce(c.mp_connected,false) or new.payment_provider <> 'mp';
   if current_setting('role',true) = 'authenticated' then
     if new.user_id is distinct from actor then raise exception 'usuario_invalido' using errcode='42501'; end if;
     new.status := 'pendiente';
     new.amount := coalesce(c.price_per_session,c.price_usd);
     new.coach_name := coalesce((select name from public.profiles where id=c.profile_id),'Profesional');
     new.coach_specialty := coalesce(c.specialty,'');
     new.created_at := now();
   end if;
 else
   if new.payment_provider <> 'mp' then new.requires_payment := true; end if;
   if new.status='confirmada' and old.status <> 'confirmada'
      and new.requires_payment and new.payment_status is distinct from 'aprobado' then
     raise exception 'pago_no_acreditado' using errcode='23514';
   end if;
   if old.status in ('cancelada','completada') and new.status is distinct from old.status then
     raise exception 'reserva_finalizada' using errcode='23514';
   end if;
   -- H02: corre antes de trg_mark_refund_on_cancel (orden alfabético).
   if actor is not null then
     if new.status='cancelada' and old.status <> 'cancelada' then
       if actor=old.user_id then new.cancelled_by := 'usuario';
       elsif actor=c.profile_id then new.cancelled_by := 'coach';
       elsif not public.is_admin() then raise exception 'no_autorizado' using errcode='42501';
       end if;
     else
       new.cancelled_by := old.cancelled_by;
       new.cancelled_late := old.cancelled_late;
     end if;
   end if;
 end if;
 return new;
end $$;
drop trigger if exists a_guard_booking_security on public.bookings;
create trigger a_guard_booking_security before insert or update on public.bookings
for each row execute function public.guard_booking_security();
revoke all on function public.guard_booking_security() from public,anon,authenticated;

-- H05: una edición vuelve a moderación; archivar está permitido.
create or replace function public.guard_resource_moderation() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
 if current_user='authenticated' then
   if tg_op='INSERT' then
     new.status := 'pending'; new.rejection_rule := null; new.created_at := now();
   elsif new.status <> 'archived' then
     new.status := 'pending'; new.rejection_rule := null;
   end if;
 end if;
 if length(coalesce(new.body_md,'')) > 20000 then
   raise exception 'lectura_demasiado_larga' using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists guard_resource_moderation on public.coach_resources;
create trigger guard_resource_moderation before insert or update on public.coach_resources
for each row execute function public.guard_resource_moderation();

-- H04: texto canónico para clientes viejos, vinculado a un evento real.
-- Las RPC SECURITY DEFINER y el servidor siguen produciendo avisos propios.
alter table public.notifications add column if not exists client_event_key text;
create unique index if not exists notifications_client_event_unique
 on public.notifications(client_event_key) where client_event_key is not null;
revoke update,delete on public.notifications from authenticated;
grant update (read) on public.notifications to authenticated;
create or replace function public.guard_client_notification() returns trigger
language plpgsql set search_path=public,pg_temp as $$
declare b public.bookings%rowtype;
begin
 if current_user <> 'authenticated' then return new; end if;
 select * into b from public.bookings where id=new.booking_id;
 if b.id is null then raise exception 'reserva_invalida' using errcode='42501'; end if;
 case new.type
 when 'reserva_nueva' then
   if b.status <> 'pendiente' then raise exception 'evento_invalido'; end if;
   new.title := 'Nueva solicitud de sesión';
 when 'reserva_confirmada' then
   if b.status <> 'confirmada' then raise exception 'evento_invalido'; end if;
   new.title := 'Tu sesión está confirmada';
 when 'reserva_cancelada', 'reserva_rechazada' then
   if b.status <> 'cancelada' then raise exception 'evento_invalido'; end if;
   new.type := 'reserva_cancelada'; new.title := 'Se canceló una sesión';
 else raise exception 'evento_solo_servidor' using errcode='42501';
 end case;
 new.body := 'Hay novedades en tu reserva. Entrá a Vita para ver el estado actualizado.';
 new.created_at := now(); new.emailed_at := null; new.read := false;
 new.client_event_key := b.id::text || ':' || new.recipient_id::text || ':' || new.type;
 return new;
end $$;
drop trigger if exists guard_client_notification on public.notifications;
create trigger guard_client_notification before insert on public.notifications
for each row execute function public.guard_client_notification();

-- M04: ninguna cuenta puede leer campos privados de otra por SELECT directo.
-- RPC sin parámetro de identidad, conserva la lectura del perfil propio.
create or replace function public.get_my_profile() returns setof public.profiles
language sql stable security definer set search_path=public,pg_temp as $$
 select * from public.profiles where id=auth.uid();
$$;
revoke all on function public.get_my_profile() from public,anon;
grant execute on function public.get_my_profile() to authenticated;
revoke select on public.profiles from authenticated;
-- REVOKE de tabla no elimina grants históricos por columna.
do $$ declare c record; begin
 for c in select attname from pg_attribute where attrelid='public.profiles'::regclass and attnum>0 and not attisdropped loop
   execute format('revoke select (%I) on public.profiles from authenticated',c.attname);
 end loop;
end $$;
grant select(id,name,avatar_url,gender,role) on public.profiles to authenticated;

-- El profesional ve la edad de SUS consultantes, sin exponer fechas de nacimiento.
create or replace function public.get_booking_participant_profiles(p_ids uuid[])
returns table(id uuid,name text,avatar_url text,edad integer)
language sql stable security definer set search_path=public,pg_temp as $$
 select p.id,p.name,p.avatar_url,extract(year from age(current_date,p.birth_date))::integer
 from public.profiles p where p.id=any(p_ids) and cardinality(p_ids)<=1000
 and exists(select 1 from public.bookings b join public.coaches c on c.id=b.coach_id
   where b.user_id=p.id and c.profile_id=auth.uid()
   and b.status in ('pendiente','confirmada','completada'));
$$;
revoke all on function public.get_booking_participant_profiles(uuid[]) from public,anon;
grant execute on function public.get_booking_participant_profiles(uuid[]) to authenticated;

-- M02: cuota atómica por emisor y destinatario, solo invocable por backend.
create table if not exists public.push_rate_limits (
 caller uuid not null, recipient uuid not null, window_start timestamptz not null,
 count integer not null, primary key(caller,recipient)
);
alter table public.push_rate_limits enable row level security;
revoke all on public.push_rate_limits from public,anon,authenticated;
create or replace function public.claim_push(p_caller uuid,p_recipient uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer;
begin
 if public.are_blocked(p_caller,p_recipient) then return false; end if;
 insert into public.push_rate_limits as r values(p_caller,p_recipient,now(),1)
 on conflict(caller,recipient) do update set
 count=case when r.window_start < now()-interval '1 minute' then 1 else r.count+1 end,
 window_start=case when r.window_start < now()-interval '1 minute' then now() else r.window_start end
 returning count into n;
 return n <= 5;
end $$;
revoke all on function public.claim_push(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_push(uuid,uuid) to service_role;

-- M03: un token de dispositivo pertenece a una cuenta a la vez. La app debe
-- retirarlo antes de cerrar sesión; los pushes nunca contienen texto del chat.
create or replace function public.register_push_token(p_token text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'sin_sesion' using errcode='42501'; end if;
 if p_token is null or length(p_token)>256 or p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$' then
   raise exception 'token_invalido' using errcode='23514'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_token,0));
 update public.profiles set push_token=null where push_token=p_token and id<>auth.uid();
 update public.profiles set push_token=p_token where id=auth.uid();
end $$;
revoke all on function public.register_push_token(text) from public,anon;
grant execute on function public.register_push_token(text) to authenticated;

-- H06: los montos nunca se reciclan (tampoco después de cancelar/borrar).
-- Compatibilidad con billeteras de 2 decimales. Techo: 100 por precio para toda
-- la vida de esta wallet; al agotarse se necesita otra wallet / direcciones por intento.
create table if not exists public.usdt_amount_assignments (
 amount numeric primary key, booking_id uuid unique, assigned_at timestamptz not null default now()
);
alter table public.usdt_amount_assignments enable row level security;
revoke all on public.usdt_amount_assignments from public,anon,authenticated;
grant select on public.usdt_amount_assignments to service_role;
-- Todo monto anterior al corte requiere conciliación: su historia podría incluir reservas borradas.
insert into public.usdt_amount_assignments(amount,booking_id,assigned_at)
select usdt_amount,null::uuid,min(created_at)
from public.bookings where usdt_amount is not null group by usdt_amount
on conflict(amount) do nothing;
create or replace function public.reserve_usdt_amount() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare owner_id uuid;
begin
 if new.usdt_amount is not null and (tg_op='INSERT' or old.usdt_amount is distinct from new.usdt_amount) then
   insert into public.usdt_amount_assignments(amount,booking_id) values(new.usdt_amount,new.id)
   on conflict(amount) do nothing;
   select booking_id into owner_id from public.usdt_amount_assignments where amount=new.usdt_amount;
   if owner_id is distinct from new.id then raise exception 'monto_ya_asignado' using errcode='23505'; end if;
 end if;
 return new;
end $$;
drop trigger if exists reserve_usdt_amount on public.bookings;
create trigger reserve_usdt_amount before insert or update of usdt_amount on public.bookings
for each row execute function public.reserve_usdt_amount();
revoke all on function public.reserve_usdt_amount() from public,anon,authenticated;

-- M06: la unicidad es transaccional incluso si dos checkouts se confirman juntos.
-- Las dos colisiones históricas completadas antes del corte quedan intactas.
-- Confirmaciones y sesiones completadas desde el corte sí son únicas.
create unique index if not exists bookings_one_confirmed_slot
 on public.bookings(coach_id,scheduled_date,(lpad(split_part(scheduled_time,':',1),2,'0') || ':' || lpad(split_part(scheduled_time,':',2),2,'0')))
 where status='confirmada' or (status='completada' and scheduled_date >= date '2026-09-22');

-- H07: lease persistente para crear checkout, identidad del intento inmutable.
alter table public.bookings add column if not exists checkout_attempt_id uuid;
alter table public.bookings add column if not exists checkout_lock_until timestamptz;
create or replace function public.claim_checkout(p_booking uuid,p_provider text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.bookings%rowtype; attempt uuid := gen_random_uuid();
begin
 select * into b from public.bookings where id=p_booking for update;
 if b.id is null or b.status <> 'pendiente' or b.payment_status not in ('no_iniciado','pendiente','rechazado')
 or b.checkout_lock_until > now() or b.preference_id is not null or b.usdt_amount is not null
 or p_provider not in ('mp','paypal','usdt') then return null; end if;
 update public.bookings set checkout_attempt_id=attempt,checkout_lock_until=now()+interval '2 minutes',
 payment_provider=p_provider,requires_payment=true where id=p_booking;
 return attempt;
end $$;
revoke all on function public.claim_checkout(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_checkout(uuid,text) to service_role;
-- Verificar permisos efectivos: si un grant heredado vuelve a abrirlos, abortar.
do $$ begin
 if has_column_privilege('authenticated','public.bookings','payment_status','INSERT')
 or has_column_privilege('authenticated','public.profiles','birth_date','SELECT') then
   raise exception 'Permisos heredados inesperados: revisar grants antes de desplegar';
 end if;
end $$;
notify pgrst,'reload schema';
commit;
