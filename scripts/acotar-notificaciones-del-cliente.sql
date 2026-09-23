-- acotar-notificaciones-del-cliente.sql
--
-- Auditoría de seguridad, tanda 3 (23/09/2026) — área: mensajería/notificaciones.
--
-- 🔴 HALLAZGO: `notifications_insert_partes` deja que un participante de una
-- reserva le cree notificaciones al otro, con `type` libre entre los ~20 del
-- CHECK. Entre esos hay avisos que son **autoridad de la plataforma**:
-- `postulacion_aprobada`, `credencial_verificada`, `sancion_levantada`,
-- `recurso_publicado`… Un profesional podía mandarle a su cliente un
-- "credencial verificada", y un cliente mandarle a su profesional un
-- "sanción levantada". Se ven igual que los de Vita, porque son los de Vita.
--
-- La app solo crea cuatro: `reserva_nueva`, `reserva_confirmada`,
-- `reserva_rechazada` y `reserva_cancelada` (BookingScreen_Confirm,
-- CoachReservasScreen, lib/coachBookingActions.ts, lib/bookingCancel.ts).
-- El resto los escribe el servidor con service role, que no pasa por RLS.
--
-- ⚠️ Lo que ESTO NO ARREGLA: el título y el cuerpo siguen viniendo del cliente
-- en esos cuatro tipos, así que un participante puede escribir el texto que
-- quiera dentro de un aviso de reserva. Cerrarlo del todo es moverlos al
-- servidor (el texto lo armaría la edge function) y es decisión de producto:
-- queda anotado en problemas-abiertos.md.
--
-- Fecha: 2026-09-23

begin;

drop policy if exists notifications_insert_partes on public.notifications;

create policy notifications_insert_partes on public.notifications
for insert to public
with check (
  type in ('reserva_nueva', 'reserva_confirmada', 'reserva_rechazada', 'reserva_cancelada')
  and booking_id is not null
  and exists (
    select 1
      from public.bookings b
      left join public.coaches c on c.id = b.coach_id
     where b.id = notifications.booking_id
       and (b.user_id = auth.uid() or c.profile_id = auth.uid())
       and (notifications.recipient_id = b.user_id or notifications.recipient_id = c.profile_id)
  )
);

commit;

-- ── VERIFICACIÓN ────────────────────────────────────────────────────────────
create temp table if not exists _r (chequeo text, valor text, ok boolean);
truncate _r;

do $$
declare
  v_user uuid; v_cid uuid; v_cprof uuid; v_sala uuid; v_book uuid;
  v_err_legit text; v_err_falso text;
begin
  select id into v_user from public.profiles where role='user' limit 1;
  select c.id, c.profile_id into v_cid, v_cprof from public.coaches c where c.verified limit 1;

  insert into public.salas (user_id, coach_id) values (v_user, v_cprof) returning id into v_sala;
  insert into public.bookings (user_id, coach_id, sala_id, scheduled_date, scheduled_time, duration_minutes,
                               amount, coach_name, coach_specialty, status, payment_status)
  values (v_user, v_cid, v_sala, current_date + 6, '18:00', 50, 1, 'Prueba', 'Prueba', 'confirmada', 'aprobado')
  returning id into v_book;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', v_user::text,'role','authenticated')::text, true);

    -- Legítima: aviso de reserva al profesional.
    begin
      insert into public.notifications (recipient_id, booking_id, type, title, body)
      values (v_cprof, v_book, 'reserva_cancelada', '[PRUEBA AUDITORIA]', 'texto');
    exception when others then v_err_legit := sqlerrm; end;

    -- Falsa: hacerse pasar por Vita verificando una credencial.
    begin
      insert into public.notifications (recipient_id, booking_id, type, title, body)
      values (v_cprof, v_book, 'credencial_verificada', '[PRUEBA AUDITORIA falsa]', 'texto');
    exception when others then v_err_falso := sqlerrm; end;
  exception when others then null;
  end;
  reset role;

  delete from public.notifications where booking_id = v_book;
  delete from public.bookings where id = v_book;
  delete from public.salas where id = v_sala;

  insert into _r values ('los avisos de reserva siguen funcionando', coalesce('ERROR: ' || v_err_legit, 'ok'), v_err_legit is null);
  insert into _r values ('🔴 fabricar un aviso de la plataforma ahora falla', coalesce(v_err_falso,'NO FALLÓ'), v_err_falso is not null);
  insert into _r values ('limpieza ok',
    (select count(*)::text from public.bookings where id=v_book) || ' / ' || (select count(*)::text from public.salas where id=v_sala),
    not exists (select 1 from public.bookings where id=v_book) and not exists (select 1 from public.salas where id=v_sala));
end $$;

select * from _r;
