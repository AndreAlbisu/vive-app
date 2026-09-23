-- Recovery state for paid bookings and attendance decisions. Deploy before the
-- Edge Functions that use these columns/RPCs.
begin;

alter table public.bookings
  add column if not exists paid_effects_completed_at timestamptz,
  add column if not exists paid_effects_claim_id uuid,
  add column if not exists paid_effects_lock_until timestamptz;

-- Existing confirmed/completed bookings must not replay emails or pushes on
-- deployment. Approved bookings still pending are deliberately left for repair.
update public.bookings
set paid_effects_completed_at = coalesce(paid_at, now())
where payment_status = 'aprobado'
  and status in ('confirmada', 'completada')
  and paid_effects_completed_at is null;

create or replace function public.claim_paid_booking_effects(p_booking uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare b public.bookings%rowtype; claim uuid := gen_random_uuid();
begin
  select * into b from public.bookings where id = p_booking for update;
  if b.id is null or b.payment_status <> 'aprobado'
    or b.status not in ('pendiente', 'confirmada')
    or b.paid_effects_completed_at is not null
    or b.paid_effects_lock_until > now() then
    return null;
  end if;
  update public.bookings
  set paid_effects_claim_id = claim,
      paid_effects_lock_until = now() + interval '3 minutes'
  where id = p_booking;
  return claim;
end $$;

create or replace function public.finish_paid_booking_effects(p_booking uuid, p_claim uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.bookings
  set paid_effects_completed_at = now(), paid_effects_claim_id = null,
      paid_effects_lock_until = null
  where id = p_booking and paid_effects_claim_id = p_claim
    and paid_effects_completed_at is null;
  return found;
end $$;

revoke all on function public.claim_paid_booking_effects(uuid) from public, anon, authenticated;
revoke all on function public.finish_paid_booking_effects(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_paid_booking_effects(uuid) to service_role;
grant execute on function public.finish_paid_booking_effects(uuid, uuid) to service_role;

-- Only one live or already-paid referral discount per person. An unpaid
-- cancelled checkout releases its slot; a paid/refunded one never does.
create unique index if not exists bookings_one_referral_discount_per_user
on public.bookings(user_id) where referral_discount > 0
  and (status <> 'cancelada' or payment_status in
       ('aprobado', 'reembolso_pendiente', 'reembolsado', 'contracargo'));

alter table public.session_attendance
  add column if not exists refund_resolution text not null default 'pending';
alter table public.session_attendance
  drop constraint if exists session_attendance_refund_resolution_check;
alter table public.session_attendance
  add constraint session_attendance_refund_resolution_check
  check (refund_resolution in ('pending', 'due', 'resolved'));
create index if not exists session_attendance_refund_retry
  on public.session_attendance(checked_at)
  where refund_resolution in ('pending', 'due');

-- The completion cron must wait for the refund decision. Otherwise it may
-- change a booking to 'completada' between saving Daily evidence and queuing
-- the refund, making the cancellation impossible.
create or replace function public.complete_confirmed_sessions()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  with completed as (
    update public.bookings b set status = 'completada'
    where b.status = 'confirmada'
      and ((b.scheduled_date::text || ' ' || b.scheduled_time)::timestamp
        at time zone 'America/Argentina/Buenos_Aires')
        + make_interval(mins => coalesce(b.duration_minutes, 60)) < now()
      and exists (
        select 1 from public.session_attendance sa
        where sa.booking_id = b.id
          and sa.refund_resolution = 'resolved'
          and coalesce(sa.max_simultaneous, 0) >= 2
      )
    returning b.id, b.user_id, b.coach_name
  )
  insert into public.notifications (recipient_id, type, booking_id, title, body)
  select user_id, 'invitacion_review', id, '¿Cómo estuvo tu sesión?',
    'Contanos cómo te fue con ' || coalesce(coach_name, 'tu coach')
      || ' — tu reseña ayuda a otros a elegir mejor.'
  from completed;
end $$;

commit;
