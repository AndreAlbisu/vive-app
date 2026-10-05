-- Decisiones del 04/10/2026, PARTE 1: solo agrega funciones y una tarea diaria.
-- No quita nada: se puede correr antes de publicar la app y la web nuevas.
-- La PARTE 2 (20261004050000) cierra las columnas y va DESPUÉS de publicarlas.

begin;

-- ── 1. Datos de cobro de profesionales dados de baja ─────────────────────────
-- `delete-account` los conserva mientras quede plata en movimiento o haya un
-- cobro de los últimos 180 días (un contracargo de Mercado Pago puede llegar
-- meses después y hay que poder leer ese pago). Esta tarea los borra cuando ya
-- no hacen falta.
create or replace function public.limpiar_cobro_de_bajas()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  listos uuid[];
begin
  select coalesce(array_agg(c.id), '{}') into listos
    from public.coaches c
    join public.profiles p on p.id = c.profile_id
   where p.deleted_at is not null
     and (exists (select 1 from public.coach_payout_accounts a where a.coach_id = c.id)
          or exists (select 1 from public.coach_mp_accounts m where m.coach_id = c.id))
     -- nada abierto: cobros o reintegros en curso, pagos que Vita le debe, reclamos
     and not exists (select 1 from public.bookings b
                      where b.coach_id = c.id and b.payment_status in ('pendiente', 'reembolso_pendiente'))
     and not exists (select 1 from public.bookings b
                      where b.coach_id = c.id and b.status = 'completada' and b.payment_status = 'aprobado'
                        and b.payment_provider in ('paypal', 'usdt') and b.paid_out_at is null)
     and not exists (select 1 from public.guarantee_claims g
                      where g.coach_id = c.id and g.resolved_at is null)
     -- y pasaron 180 días de su último cobro
     and not exists (select 1 from public.bookings b
                      where b.coach_id = c.id
                        and b.payment_status in ('aprobado', 'reembolsado', 'contracargo')
                        and b.scheduled_date >= current_date - 180);

  delete from public.coach_payout_accounts where coach_id = any(listos);
  delete from public.coach_mp_accounts where coach_id = any(listos);
  update public.coaches set mp_connected = false where id = any(listos) and mp_connected;
  return coalesce(array_length(listos, 1), 0);
end;
$$;
revoke all on function public.limpiar_cobro_de_bajas() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'limpiar-cobro-de-bajas') then
    perform cron.unschedule('limpiar-cobro-de-bajas');
  end if;
  perform cron.schedule('limpiar-cobro-de-bajas', '23 6 * * *', $q$select public.limpiar_cobro_de_bajas()$q$);
end $$;

-- ── 2. Quién está suspendido, sin decir hasta cuándo (L15) ───────────────────
-- `coaches.suspendido_hasta` era legible con la clave pública: cualquiera veía
-- la fecha de fin de la suspensión de cada profesional. El catálogo, la ficha y
-- /c solo necesitan saber si HOY recibe reservas.
create or replace function public.profesionales_suspendidos()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id from public.coaches c
   where c.suspendido_hasta is not null and c.suspendido_hasta > now();
$$;
revoke all on function public.profesionales_suspendidos() from public;
grant execute on function public.profesionales_suspendidos() to anon, authenticated, service_role;

-- El propio profesional sí ve su fecha (su panel le muestra "cuenta suspendida").
create or replace function public.mi_suspension()
returns timestamptz
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.suspendido_hasta from public.coaches c
   where c.profile_id = auth.uid() and c.suspendido_hasta > now();
$$;
revoke all on function public.mi_suspension() from public, anon;
grant execute on function public.mi_suspension() to authenticated, service_role;

-- ── 3. Constancia de edad y de aceptación de los Términos (L17) ──────────────
-- La escribía el cliente con un UPDATE directo: con la fecha de su reloj, y
-- pudiendo reescribirla o borrarla. Ahora la escribe el servidor, una sola vez.
create or replace function public.registrar_aceptacion(
  p_terminos boolean,
  p_mayor boolean,
  p_version text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'sin_sesion' using errcode = '42501';
  end if;
  if p_terminos is true then
    update public.profiles
       set accepted_terms = true,
           accepted_terms_at = now(),
           accepted_terms_version = case when p_version ~ '^[0-9a-f]{12}$' then p_version else null end
     where id = uid and accepted_terms is not true;
  end if;
  if p_mayor is true then
    update public.profiles set age_confirmed = true
     where id = uid and age_confirmed is not true;
  end if;
end;
$$;
revoke all on function public.registrar_aceptacion(boolean, boolean, text) from public, anon;
grant execute on function public.registrar_aceptacion(boolean, boolean, text) to authenticated, service_role;

commit;
