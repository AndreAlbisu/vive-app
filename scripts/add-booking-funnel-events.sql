-- Embudo de reservas medido desde la base (punto 4 de docs/investigacion-producto-2026-09-23.md).
--
-- 🔴 Hasta hoy `reserva_confirmada` la emitía el TELÉFONO apenas se insertaba la
-- reserva, antes de abrir el checkout. Contaba como confirmada a quien abandonaba
-- el pago, y no contaba al que pagaba con la app cerrada (el webhook confirma
-- solo). Ahora:
--
--   reserva_creada     → cliente, al insertar la reserva (ex reserva_confirmada)
--   checkout_iniciado  → cliente, al tener la URL de pago (o entrar a USDT)
--   pago_aprobado      → ESTE trigger, cuando payment_status pasa a 'aprobado'
--   reserva_confirmada → ESTE trigger, cuando status pasa a 'confirmada'
--
-- Los dos del servidor llevan `fuente = 'servidor'` y se anotan UNA vez por
-- reserva, colgados de la transición real y no de quién la provocó (webhook,
-- cron de conciliación, coach que acepta o reagendado).
--
-- ⚠️ Nunca frena una reserva: si el insert de analítica falla, se traga el error
-- con un WARNING. Una métrica rota no puede romper un pago.
--
-- Idempotente: se puede correr de nuevo.

create or replace function public.tg_booking_funnel_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if new.payment_status = 'aprobado'
       and (tg_op = 'INSERT' or old.payment_status is distinct from 'aprobado')
       and not exists (
         select 1 from analytics_events
         where event_name = 'pago_aprobado'
           and properties->>'booking_id' = new.id::text
           and properties->>'fuente' = 'servidor')
    then
      insert into analytics_events (user_id, event_name, properties)
      values (new.user_id, 'pago_aprobado', jsonb_build_object(
        'fuente', 'servidor',
        'booking_id', new.id,
        'coach_id', new.coach_id,
        'proveedor', new.payment_provider));
    end if;

    if new.status = 'confirmada'
       and (tg_op = 'INSERT' or old.status is distinct from 'confirmada')
       and not exists (
         select 1 from analytics_events
         where event_name = 'reserva_confirmada'
           and properties->>'booking_id' = new.id::text
           and properties->>'fuente' = 'servidor')
    then
      insert into analytics_events (user_id, event_name, properties)
      values (new.user_id, 'reserva_confirmada', jsonb_build_object(
        'fuente', 'servidor',
        'booking_id', new.id,
        'coach_id', new.coach_id,
        'pagada', new.payment_status = 'aprobado'));
    end if;
  exception when others then
    raise warning 'tg_booking_funnel_events: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.tg_booking_funnel_events() from public, anon, authenticated;

drop trigger if exists trg_booking_funnel_events on public.bookings;
create trigger trg_booking_funnel_events
  after insert or update of status, payment_status on public.bookings
  for each row execute function public.tg_booking_funnel_events();

-- Para que el "una vez por reserva" no recorra la tabla entera.
create index if not exists analytics_events_booking_idx
  on public.analytics_events (event_name, (properties->>'booking_id'))
  where properties ? 'booking_id';

-- Los 160 `reserva_confirmada` viejos se emitieron al CREAR la reserva: pasan a
-- llamarse como lo que eran. Sin esto se mezclarían con los del servidor.
update public.analytics_events
set event_name = 'reserva_creada'
where event_name = 'reserva_confirmada'
  and coalesce(properties->>'fuente', '') <> 'servidor';

-- ── VERIFICACIÓN
-- Sobre una COPIA temporal de `bookings` con el mismo trigger: no toca reservas
-- reales ni apaga `a_guard_booking_security`. Todo termina en rollback.
create temp table _res(chequeo text, resultado text);
do $$
declare
  bid uuid := gen_random_uuid();
  n_pago int; n_conf int;
begin
  begin
    create temp table _bk (like public.bookings including defaults) on commit drop;
    create trigger _bk_funnel after insert or update of status, payment_status on _bk
      for each row execute function public.tg_booking_funnel_events();
    -- Una fila real copiada entera (cumple todos los NOT NULL), con id propio.
    insert into _bk select * from public.bookings limit 1;
    update _bk set id = bid, status = 'pendiente', payment_status = 'pendiente';
    update _bk set payment_status = 'aprobado' where id = bid;
    update _bk set status = 'confirmada' where id = bid;
    -- Ida y vuelta: la segunda confirmación no tiene que duplicar.
    update _bk set status = 'pendiente' where id = bid;
    update _bk set status = 'confirmada' where id = bid;
    select count(*) into n_pago from analytics_events
      where event_name = 'pago_aprobado' and properties->>'booking_id' = bid::text;
    select count(*) into n_conf from analytics_events
      where event_name = 'reserva_confirmada' and properties->>'booking_id' = bid::text;
    raise exception 'rollback_prueba';
  exception when others then
    -- Se anota DESPUÉS del rollback: adentro del bloque se desharía con todo.
    if sqlerrm = 'rollback_prueba' then
      insert into _res values ('pago_aprobado (esperado 1)', n_pago::text),
                              ('reserva_confirmada (esperado 1)', n_conf::text);
    else
      insert into _res values ('prueba', 'inconclusa: ' || sqlerrm);
    end if;
  end;
end $$;
insert into _res select 'reserva_confirmada viejos que quedan (esperado 0)', count(*)::text
  from analytics_events where event_name = 'reserva_confirmada' and coalesce(properties->>'fuente','') <> 'servidor';
insert into _res select 'reserva_creada', count(*)::text
  from analytics_events where event_name = 'reserva_creada';
insert into _res select 'trigger instalado', count(*)::text
  from pg_trigger where tgname = 'trg_booking_funnel_events';
insert into _res select 'eventos de servidor que quedaron de la prueba (esperado 0)', count(*)::text
  from analytics_events where properties->>'fuente' = 'servidor';
select * from _res;
