-- USDT, paso 1 de la reactivación (05/10/2026): los montos se reciclan.
--
-- Cada cobro en USDT se reconoce por sus centavos (dos decimales: las billeteras
-- no dejan escribir más), o sea 100 montos por precio. Desde el 22/09 cada monto
-- quedaba reservado PARA SIEMPRE en `usdt_amount_assignments`, aunque la reserva
-- se hubiera abandonado: 100 cobros por precio en toda la vida del sistema. Por
-- eso el riel está suspendido.
--
-- Ahora un monto se LIBERA cuando su reserva deja de esperar el pago (se pagó,
-- se canceló o venció) y vuelve a estar disponible después de una CUARENTENA de
-- 7 días. La cuarentena existe por el pago tardío: si alguien transfiere el
-- monto de una reserva que ya venció, no puede encontrarse con otra reserva
-- esperando esa misma cifra. El límite pasa de "100 para siempre" a "100 por
-- precio cada 7 días".
--
-- No reactiva nada: el riel sigue cerrado por `USDT_LEDGER_WALLET`.

begin;

alter table public.usdt_amount_assignments
  add column if not exists released_at timestamptz;

comment on column public.usdt_amount_assignments.released_at is
  'Cuándo la reserva dueña dejó de esperar el pago. El monto se puede reasignar 7 días después. NULL = en uso.';

-- Los montos anteriores al corte del 22/09 no tienen dueño (`booking_id` null) y
-- nadie los iba a liberar nunca. Entran en cuarentena desde hoy.
update public.usdt_amount_assignments
   set released_at = now()
 where booking_id is null and released_at is null;

-- Y los de reservas que ya no esperan pago.
update public.usdt_amount_assignments a
   set released_at = now()
  from public.bookings b
 where b.id = a.booking_id
   and a.released_at is null
   and (b.status = 'cancelada' or b.payment_status <> 'pendiente');

create or replace function public.usdt_cuarentena()
returns interval
language sql
immutable
set search_path = public, pg_temp
as $$ select interval '7 days' $$;
revoke all on function public.usdt_cuarentena() from public, anon, authenticated;

-- Reserva el monto para la reserva. Si el monto ya tuvo dueño, solo se
-- reasigna cuando ese dueño lo liberó y pasó la cuarentena.
create or replace function public.reserve_usdt_amount() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare owner_id uuid;
begin
  if new.usdt_amount is not null and (tg_op = 'INSERT' or old.usdt_amount is distinct from new.usdt_amount) then
    insert into public.usdt_amount_assignments as a (amount, booking_id)
    values (new.usdt_amount, new.id)
    on conflict (amount) do update
       set booking_id = excluded.booking_id, assigned_at = now(), released_at = null
     where a.released_at is not null
       and a.released_at < now() - public.usdt_cuarentena();
    select booking_id into owner_id from public.usdt_amount_assignments where amount = new.usdt_amount;
    if owner_id is distinct from new.id then
      raise exception 'monto_ya_asignado' using errcode = '23505';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.reserve_usdt_amount() from public, anon, authenticated;

-- Libera el monto cuando la reserva deja de esperar el pago.
create or replace function public.release_usdt_amount() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.usdt_amount is not null
     and (new.status = 'cancelada' or new.payment_status <> 'pendiente')
     and (old.status is distinct from new.status or old.payment_status is distinct from new.payment_status) then
    update public.usdt_amount_assignments
       set released_at = now()
     where booking_id = new.id and amount = new.usdt_amount and released_at is null;
  end if;
  return new;
end $$;
revoke all on function public.release_usdt_amount() from public, anon, authenticated;

drop trigger if exists release_usdt_amount on public.bookings;
create trigger release_usdt_amount
  after update of status, payment_status on public.bookings
  for each row execute function public.release_usdt_amount();

-- Cuántos montos quedan libres para un precio (para avisar antes de quedarse sin stock).
create or replace function public.usdt_montos_libres(p_precio integer)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select 100 - count(*)::int
    from public.usdt_amount_assignments a
   where a.amount > p_precio - 1 and a.amount <= p_precio
     and (a.released_at is null or a.released_at >= now() - public.usdt_cuarentena());
$$;
revoke all on function public.usdt_montos_libres(integer) from public, anon, authenticated;
grant execute on function public.usdt_montos_libres(integer) to service_role;

commit;
