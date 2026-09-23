-- Every session requires an accredited payment before confirmation. The old
-- payment-method heuristic left verified coaches without a configured rail
-- eligible for unpaid direct API bookings.
begin;

create or replace function public.guard_booking_security() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  c public.coaches%rowtype;
  actor uuid := auth.uid();
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

drop policy if exists users_confirm_own_paid_booking on public.bookings;
create policy users_confirm_own_paid_booking on public.bookings
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and status = 'confirmada'
    and payment_status = 'aprobado');

drop policy if exists coaches_can_update_own_bookings on public.bookings;
create policy coaches_can_update_own_bookings on public.bookings
  for update to authenticated
  using (coach_id in (select id from public.coaches where profile_id = auth.uid()))
  with check (
    coach_id in (select id from public.coaches where profile_id = auth.uid())
    and (status = 'cancelada'
      or (status = 'confirmada' and payment_status = 'aprobado'))
  );

commit;
