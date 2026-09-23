-- cerrar-reserva-sin-pago.sql
--
-- Auditoría de seguridad, tanda 2 (23/09/2026).
--
-- 🔴 HALLAZGO: **cualquier usuario registrado podía confirmar una sesión sin
-- pagarla** con cualquier profesional que no tenga Mercado Pago conectado — hoy
-- 33 de los 34 del catálogo. Probado contra producción y deshecho.
--
-- El camino:
--   1. crea la reserva (el trigger la fuerza a 'pendiente', bien),
--   2. `requires_payment` se calcula como `mp_connected or payment_provider <>
--      'mp'`, y como el proveedor arranca en 'mp', para un profesional sin MP
--      da **false**,
--   3. con `requires_payment = false` el propio guard deja pasar
--      `status = 'confirmada'` con el pago en `no_iniciado`,
--   4. y `create-meeting-room` solo exige 'confirmada' → entra a la sala.
--
-- La regla venía de cuando "sin MP" significaba "no hay nada que cobrar". Hoy
-- es falso: el catálogo exige al menos un riel (MP, PayPal o USDT), así que un
-- profesional sin MP igual cobra, por PayPal o por cripto.
--
-- El arreglo: `requires_payment` mira TODOS los rieles. Y en el update nunca
-- puede bajar a false: una reserva que nació con cobro no puede volverse
-- gratis cambiándole el proveedor.
--
-- ⚠️ No se toca el circuito de las reservas viejas que ya tienen
-- `requires_payment = false` (son de antes y muchas de prueba): el cambio es
-- para las nuevas y para cualquier confirmación futura.
--
-- Fecha: 2026-09-23

begin;

create or replace function public.guard_booking_security() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  c public.coaches%rowtype;
  actor uuid := auth.uid();
  cobra boolean;
begin
  select * into c from public.coaches where id=new.coach_id;

  -- ¿Este profesional puede cobrar por algún lado? Es la pregunta que antes se
  -- hacía solo sobre Mercado Pago.
  cobra := coalesce(c.mp_connected,false)
        or coalesce(c.accepts_paypal,false)
        or coalesce(c.accepts_usdt,false);

  if tg_op='INSERT' then
    if c.id is null or not coalesce(c.verified,false) then
      raise exception 'profesional_no_disponible' using errcode='23514';
    end if;
    if not exists(select 1 from public.salas s where s.id=new.sala_id
       and s.user_id=new.user_id and s.coach_id=c.profile_id) then
      raise exception 'sala_invalida' using errcode='23514';
    end if;
    new.requires_payment := cobra or new.payment_provider <> 'mp';
    if current_setting('role',true) = 'authenticated' then
      if new.user_id is distinct from actor then raise exception 'usuario_invalido' using errcode='42501'; end if;
      new.status := 'pendiente';
      new.amount := coalesce(c.price_per_session,c.price_usd);
      new.coach_name := coalesce((select name from public.profiles where id=c.profile_id),'Profesional');
      new.coach_specialty := coalesce(c.specialty,'');
      new.created_at := now();
    end if;
  else
    -- 🔴 Nunca baja a false: si la reserva ya requería pago, cambiarle el
    -- proveedor no la vuelve gratis.
    new.requires_payment := coalesce(old.requires_payment,false) or cobra or new.payment_provider <> 'mp';
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

commit;

-- ── VERIFICACIÓN ────────────────────────────────────────────────────────────
-- Repite el ataque contra producción y limpia lo que crea, pase lo que pase.
create temp table if not exists _r (chequeo text, valor text, ok boolean);
truncate _r;

do $$
declare
  v_user uuid; v_cid uuid; v_cprof uuid; v_sala uuid; v_book uuid;
  v_req boolean; v_final text; v_pay text; v_err text; v_filas int := -1;
  v_sala2 uuid; v_book2 uuid; v_ok_legit boolean := false; v_err2 text;
begin
  select id into v_user from public.profiles where role='user' limit 1;
  select c.id, c.profile_id into v_cid, v_cprof
    from public.coaches c
   where c.verified and coalesce(c.mp_connected,false) = false
     and (coalesce(c.accepts_paypal,false) or coalesce(c.accepts_usdt,false))
     and (c.suspendido_hasta is null or c.suspendido_hasta < now()) limit 1;
  if v_cid is null then
    -- Si hoy no hay ninguno con PayPal/USDT y sin MP, se prueba con cualquiera sin MP.
    select c.id, c.profile_id into v_cid, v_cprof from public.coaches c
     where c.verified and coalesce(c.mp_connected,false) = false limit 1;
  end if;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', v_user::text, 'role','authenticated')::text, true);
    insert into public.salas (user_id, coach_id) values (v_user, v_cprof) returning id into v_sala;
    insert into public.bookings (user_id, coach_id, sala_id, scheduled_date, scheduled_time, duration_minutes, amount, status)
    values (v_user, v_cid, v_sala, (current_date + 3), '15:00', 50, 1, 'pendiente')
    returning id into v_book;
    select requires_payment into v_req from public.bookings where id = v_book;
    update public.bookings set status = 'confirmada' where id = v_book;
    get diagnostics v_filas = row_count;
  exception when others then
    v_err := sqlerrm; v_filas := 0;
  end;
  reset role;
  select status, payment_status into v_final, v_pay from public.bookings where id = v_book;
  delete from public.bookings where id = v_book;
  delete from public.salas where id = v_sala;

  insert into _r values ('requires_payment de un profesional sin MP (esperado true)', coalesce(v_req::text,'-'), v_req is true);
  insert into _r values ('🔴 confirmar sin pagar ahora falla', coalesce(v_err,'NO FALLÓ'), v_err like '%pago_no_acreditado%');
  insert into _r values ('la reserva NO quedó confirmada', coalesce(v_final,'-') || ' / pago=' || coalesce(v_pay,'-'), coalesce(v_final,'') <> 'confirmada');

  -- Control: con el pago acreditado (lo escribe el servidor), sí se confirma.
  begin
    insert into public.salas (user_id, coach_id) values (v_user, v_cprof) returning id into v_sala2;
    insert into public.bookings (user_id, coach_id, sala_id, scheduled_date, scheduled_time, duration_minutes, amount, status, payment_status)
    values (v_user, v_cid, v_sala2, (current_date + 4), '16:00', 50, 1, 'pendiente', 'aprobado')
    returning id into v_book2;
    update public.bookings set status = 'confirmada' where id = v_book2;
    select status = 'confirmada' into v_ok_legit from public.bookings where id = v_book2;
  exception when others then
    v_err2 := sqlerrm;
  end;
  delete from public.bookings where id = v_book2;
  delete from public.salas where id = v_sala2;
  insert into _r values ('con el pago aprobado sigue pudiendo confirmarse', coalesce(v_ok_legit::text,'-') || coalesce(' err=' || v_err2,''), v_ok_legit);

  insert into _r values ('limpieza ok',
    (select count(*)::text from public.bookings where id in (v_book, v_book2)) || ' reservas / ' ||
    (select count(*)::text from public.salas where id in (v_sala, v_sala2)) || ' salas',
    not exists (select 1 from public.bookings where id in (v_book, v_book2))
    and not exists (select 1 from public.salas where id in (v_sala, v_sala2)));
end $$;

select * from _r;
