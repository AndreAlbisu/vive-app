-- SOLO LECTURA. Dos conflictos históricos completados antes del corte fueron conservados;
-- esta consulta comprueba únicamente el conjunto protegido por el índice nuevo.
-- El resto se ejecuta DESPUÉS, en staging y luego producción.
begin read only;
select coach_id, scheduled_date,
 lpad(split_part(scheduled_time,':',1),2,'0')||':'||lpad(split_part(scheduled_time,':',2),2,'0') as hora,
 count(*) as conflictos
from public.bookings where status='confirmada' or (status='completada' and scheduled_date >= date '2026-09-22')
group by 1,2,3 having count(*)>1;
-- Esperado: false, false, true.
select has_column_privilege('authenticated','public.bookings','payment_status','INSERT') as puede_fabricar_pago,
 has_column_privilege('authenticated','public.profiles','birth_date','SELECT') as puede_leer_fecha_ajena,
 has_column_privilege('authenticated','public.profiles','name','SELECT') as puede_leer_nombre;
select tgname, pg_get_triggerdef(oid) from pg_trigger
where not tgisinternal and tgrelid in ('public.bookings'::regclass,'public.notifications'::regclass,'public.coach_resources'::regclass);
select indexname,indexdef from pg_indexes where indexname in ('bookings_one_confirmed_slot','notifications_client_event_unique');
select proname,prosecdef,proconfig from pg_proc where pronamespace='public'::regnamespace
and proname in ('guard_booking_security','get_my_profile','get_booking_participant_profiles','claim_push','claim_checkout','register_push_token');
select has_function_privilege('authenticated','public.claim_checkout(uuid,text)','execute') as cliente_inicia_cobro_interno,
 has_function_privilege('authenticated','public.claim_push(uuid,uuid)','execute') as cliente_salta_cuota;
-- Esperado: ambos false. Los montos heredados sin dueño exigen conciliación.
select count(*) as asignaciones, count(*) filter(where booking_id is null) as historicas_sin_asignacion
from public.usdt_amount_assignments;
commit;
