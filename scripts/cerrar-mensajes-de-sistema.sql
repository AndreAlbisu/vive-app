-- cerrar-mensajes-de-sistema.sql
--
-- Auditoría de seguridad, tanda 3 (23/09/2026) — área: mensajería.
--
-- 🔴 HALLAZGO: en la Sala, los mensajes con `sender_type` `system`,
-- `system_confirmed` o `system_cancelled` se dibujan como **avisos oficiales de
-- Vita** (`SalaScreen.tsx`, tarjeta de sistema, sin globo ni autor). El
-- `sender_type` lo elige quien inserta, y la policy de INSERT solo pedía ser
-- participante de la sala: **cualquiera de los dos podía fabricar un aviso de
-- Vita** dentro de su propio chat.
--
-- Qué habilitaba: un profesional diciéndole al cliente "Vita confirmó tu pago,
-- entrá a la sala", o un cliente mostrándole a su profesional una confirmación
-- que nunca existió. Es ingeniería social con el sello de la plataforma.
--
-- 📌 El lado del globo (izquierda/derecha) NO era falsificable: sale de
-- `sender_id` comparado con el usuario actual. Solo la tarjeta de sistema.
--
-- El arreglo, sin romper los caminos legítimos: el cliente puede escribir
-- `system_confirmed` / `system_cancelled` **solo si la reserva de esa sala está
-- de verdad en ese estado** — que es exactamente lo que el cartel afirma. Los
-- escriben hoy `lib/coachBookingActions.ts` (el profesional acepta) y
-- `lib/bookingCancel.ts` (alguien cancela), siempre DESPUÉS de cambiar el
-- estado de la reserva, así que siguen funcionando.
-- `system` a secas queda solo para el servidor (service role, que no pasa por
-- RLS). Nadie lo escribe desde la app.
--
-- Y de paso: `user` solo lo puede mandar el cliente de la sala y `coach` solo
-- el profesional, para que nadie mande un mensaje etiquetado como del otro.
--
-- Fecha: 2026-09-23

begin;

drop policy if exists messages_insert_participantes on public.messages;

create policy messages_insert_participantes on public.messages
for insert to public
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.salas s
     where s.id = messages.sala_id
       and (s.user_id = auth.uid() or s.coach_id = auth.uid())
       and (
         -- Chat normal: cada uno con su etiqueta.
         (messages.sender_type = 'user'  and s.user_id  = auth.uid())
         or (messages.sender_type = 'coach' and s.coach_id = auth.uid())
         -- Avisos: solo si la reserva de la sala está en ese estado.
         or (messages.sender_type = 'system_confirmed' and exists (
               select 1 from public.bookings b
                where b.sala_id = s.id and b.status = 'confirmada'))
         or (messages.sender_type = 'system_cancelled' and exists (
               select 1 from public.bookings b
                where b.sala_id = s.id and b.status = 'cancelada'))
       )
  )
);

commit;

-- ── VERIFICACIÓN ────────────────────────────────────────────────────────────
create temp table if not exists _r (chequeo text, valor text, ok boolean);
truncate _r;

do $$
declare
  v_user uuid; v_cprof uuid; v_sala uuid; v_m1 uuid; v_m2 uuid; v_m3 uuid;
  v_err_falso text; v_err_normal text; v_err_coach text;
begin
  select id into v_user from public.profiles where role='user' limit 1;
  select profile_id into v_cprof from public.coaches where verified limit 1;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', v_user::text,'role','authenticated')::text, true);

    insert into public.salas (user_id, coach_id) values (v_user, v_cprof) returning id into v_sala;

    -- 1. Mensaje normal: tiene que entrar.
    begin
      insert into public.messages (sala_id, sender_id, sender_type, content)
      values (v_sala, v_user, 'user', '[PRUEBA AUDITORIA]') returning id into v_m1;
    exception when others then v_err_normal := sqlerrm; end;

    -- 2. Aviso de Vita fabricado (la sala no tiene reserva confirmada): tiene que fallar.
    begin
      insert into public.messages (sala_id, sender_id, sender_type, content)
      values (v_sala, v_user, 'system_confirmed', '[PRUEBA AUDITORIA falso]') returning id into v_m2;
    exception when others then v_err_falso := sqlerrm; end;

    -- 3. Mensaje etiquetado como del profesional, mandado por el cliente: tiene que fallar.
    begin
      insert into public.messages (sala_id, sender_id, sender_type, content)
      values (v_sala, v_user, 'coach', '[PRUEBA AUDITORIA suplantado]') returning id into v_m3;
    exception when others then v_err_coach := sqlerrm; end;
  exception when others then
    null;
  end;
  reset role;

  delete from public.messages where sala_id = v_sala;
  delete from public.salas where id = v_sala;

  insert into _r values ('el chat normal sigue funcionando', coalesce('ERROR: ' || v_err_normal, 'ok'), v_err_normal is null);
  insert into _r values ('🔴 fabricar un aviso de Vita ahora falla', coalesce(v_err_falso, 'NO FALLÓ'), v_err_falso is not null);
  insert into _r values ('mandar un mensaje como si fuera del otro ahora falla', coalesce(v_err_coach, 'NO FALLÓ'), v_err_coach is not null);
  insert into _r values ('limpieza ok', (select count(*)::text from public.salas where id = v_sala), not exists (select 1 from public.salas where id = v_sala));
end $$;

select * from _r;
