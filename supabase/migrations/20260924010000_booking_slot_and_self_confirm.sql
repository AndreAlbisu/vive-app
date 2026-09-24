-- Una reserva desde la app solo en un horario que el profesional ofrece, y el
-- cliente solo confirma solo con reserva instantánea (Claude, 24/09/2026,
-- autorizado por Andre; área de Codex, coordinado en el registro de auditoría).
--
-- 🔴 El hallazgo, probado con rollback contra producción: un cliente creaba una
-- reserva a las 03:17 (horario que el profesional nunca ofreció), la pagaba y la
-- pasaba él mismo a 'confirmada' aunque el profesional NO tuviera
-- instant_booking. Si el profesional no se presentaba a una sesión que nunca
-- aceptó, la asistencia le devolvía la plata al cliente y al profesional le
-- quedaba la ausencia. Además el cliente elegía `duration_minutes` sin límite,
-- que mueve la ventana de la videollamada y la evaluación de asistencia.
--
-- Qué cambia:
--   · INSERT de `authenticated`: el horario tiene que existir en
--     coach_availability, sin bloquear, y ser futuro. La duración la pone la
--     base desde coach_weekly_pattern (null = el default de 60 de quien la lee).
--     Las altas con service role (web-book, que valida con slots_libres) no se
--     tocan.
--   · users_confirm_own_paid_booking exige además instant_booking del
--     profesional. Sin eso, confirmar sigue siendo del profesional.
--
-- ⚠️ Esta función es la de producción al 24/09/2026 con SOLO el bloque del
-- INSERT ampliado. No redefinirla desde scripts viejos.

begin;

create or replace function public.guard_booking_security()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  c public.coaches%rowtype;
  actor uuid := auth.uid();
  hhmm text;
  inicio timestamptz;
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
    new.requires_payment := true;
    if current_setting('role',true) = 'authenticated' then
      if new.user_id is distinct from actor then raise exception 'usuario_invalido' using errcode='42501'; end if;
      new.status := 'pendiente';
      new.amount := coalesce(c.price_per_session,c.price_usd);
      new.coach_name := coalesce((select name from public.profiles where id=c.profile_id),'Profesional');
      new.coach_specialty := coalesce(c.specialty,'');
      new.created_at := now();

      -- El horario, contra la agenda del profesional (mismo formato que
      -- bookings_one_confirmed_slot: "9:00" y "09:00" son el mismo turno).
      hhmm := lpad(split_part(new.scheduled_time::text,':',1),2,'0')||':'||
              lpad(split_part(new.scheduled_time::text,':',2),2,'0');
      if new.scheduled_date is null or not exists (
        select 1 from public.coach_availability a
        where a.coach_id=c.id and a.date=new.scheduled_date
          and not coalesce(a.blocked,false)
          and lpad(split_part(a.time,':',1),2,'0')||':'||lpad(split_part(a.time,':',2),2,'0') = hhmm
      ) then
        raise exception 'horario_no_disponible' using errcode='23514';
      end if;
      begin
        inicio := ((new.scheduled_date::text||' '||hhmm)::timestamp) at time zone 'America/Argentina/Buenos_Aires';
      exception when others then
        raise exception 'horario_no_disponible' using errcode='23514';
      end;
      if inicio <= now() then
        raise exception 'horario_no_disponible' using errcode='23514';
      end if;

      new.duration_minutes := (select p.slot_duration_minutes from public.coach_weekly_pattern p
                               where p.coach_id=c.id and p.slot_duration_minutes is not null
                               limit 1);
    end if;
  else
    -- Also covers old pending rows that were created with requires_payment=false.
    new.requires_payment := true;
    if new.status='confirmada' and old.status <> 'confirmada'
       and new.payment_status is distinct from 'aprobado' then
      raise exception 'pago_no_acreditado' using errcode='23514';
    end if;
    if old.status in ('cancelada','completada') and new.status is distinct from old.status then
      raise exception 'reserva_finalizada' using errcode='23514';
    end if;
    if actor is not null then
      if new.status='cancelada' and old.status <> 'cancelada' then
        if actor=old.user_id then
          -- Only server-owned proposals establish professional responsibility.
          -- Never trust cancelled_by supplied by the caller.
          if old.status = 'confirmada' and exists (
            select 1 from public.reschedule_requests r
            where r.booking_id=old.id and r.pedida_por='profesional'
              and r.estado='pendiente'
          ) then new.cancelled_by := 'coach';
          else new.cancelled_by := 'usuario'; end if;
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
end $function$;

drop policy if exists users_confirm_own_paid_booking on public.bookings;
create policy users_confirm_own_paid_booking on public.bookings
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and status = 'confirmada'
    and payment_status = 'aprobado'
    and exists (select 1 from public.coaches c
                where c.id = bookings.coach_id and c.instant_booking));

commit;
