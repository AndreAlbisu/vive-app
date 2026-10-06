-- Limpieza automática de los datos de cobro de profesionales dados de baja.
--
-- 🔴 EL GAP (CHANGELOG 03/10, pendiente de Andre): cuando un profesional elimina
-- su cuenta, `delete-account` (§3b) borra sus datos de cobro (CBU/alias/PayPal/
-- billetera + conexión con Mercado Pago) SOLO si no queda "plata en movimiento":
-- reintegros o cobros en curso, sesiones dentro de la ventana de garantía, o
-- payouts de PayPal/USDT sin transferir. Si queda algo abierto, los CONSERVA
-- —para que el reintegro salga con el token del profesional y el pago adeudado
-- se haga con su CBU— pero NADA los borra después de que esos pagos se liquidan.
-- Resultado: los datos de cobro de una cuenta ya eliminada quedan colgados para
-- siempre (problema de privacidad, contradice la Política §10).
--
-- ESTO lo cierra: un cron diario re-corre exactamente el mismo chequeo del §3b
-- sobre los profesionales ya dados de baja (`profiles.deleted_at` no nulo) que
-- todavía tienen datos de cobro, y los borra en cuanto ya no queda nada abierto.
--
-- 🔑 Los cuatro criterios de "plata en movimiento" son IDÉNTICOS a
-- `supabase/functions/delete-account/index.ts` §3b. Si cambian allá, cambian acá.
-- La ventana de garantía usa `current_date - 3` (en delete-account eran ~3.1 días
-- desde `now()`); como el cron corre días después de la baja, el margen alcanza.

create or replace function public.limpiar_cobro_profesionales_baja()
returns table (id_coach uuid, limpiado boolean)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  r record;
  hay_abierto boolean;
begin
  for r in
    select co.id as coach_id
    from public.coaches co
    join public.profiles p on p.id = co.profile_id
    where p.deleted_at is not null
      and (co.mp_connected is true
           or exists (select 1 from public.coach_mp_accounts m    where m.coach_id  = co.id)
           or exists (select 1 from public.coach_payout_accounts po where po.coach_id = co.id))
  loop
    -- Mismos 4 criterios que delete-account §3b, en el mismo orden.
    select
         exists (select 1 from public.bookings b
                 where b.coach_id = r.coach_id
                   and b.payment_status in ('pendiente','reembolso_pendiente'))
      or exists (select 1 from public.bookings b
                 where b.coach_id = r.coach_id
                   and b.payment_status = 'aprobado'
                   and b.scheduled_date >= current_date - 3)
      or exists (select 1 from public.bookings b
                 where b.coach_id = r.coach_id
                   and b.status = 'completada' and b.payment_status = 'aprobado'
                   and b.payment_provider in ('paypal','usdt') and b.paid_out_at is null)
      or exists (select 1 from public.guarantee_claims g
                 where g.coach_id = r.coach_id and g.resolved_at is null)
      into hay_abierto;

    if hay_abierto then
      id_coach := r.coach_id; limpiado := false; return next;
      continue;
    end if;

    -- Ya no queda nada abierto: se borra igual que delete-account §3b.
    delete from public.coach_payout_accounts where coach_id = r.coach_id;
    delete from public.coach_mp_accounts     where coach_id = r.coach_id;
    update public.coaches set mp_connected = false where id = r.coach_id;

    id_coach := r.coach_id; limpiado := true; return next;
  end loop;
end
$function$;

-- Solo la corre el cron (service role / postgres). Nunca anon/authenticated.
revoke all on function public.limpiar_cobro_profesionales_baja() from anon, authenticated;

-- Cron diario (05:00 UTC). Es solo SQL, así que pg_cron la llama directo (no HTTP).
-- Idempotente: se desprograma si ya existía, para poder re-correr la migración.
select cron.unschedule('limpiar-cobro-bajas')
where exists (select 1 from cron.job where jobname = 'limpiar-cobro-bajas');

select cron.schedule(
  'limpiar-cobro-bajas',
  '0 5 * * *',
  $cron$ select public.limpiar_cobro_profesionales_baja(); $cron$
);
