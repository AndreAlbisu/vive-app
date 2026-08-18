-- Endurecer el UPDATE de `bookings`
-- ---------------------------------
-- 🔴 EL AGUJERO. `bookings_update_own` es UPDATE con `qual = (user_id =
-- auth.uid())` y **sin `with_check`**. Sin with_check, Postgres valida la fila
-- nueva contra el mismo USING: alcanza con que siga siendo suya. O sea que
-- cualquier persona con sesión podía, contra la API directa:
--
--     update bookings set payment_status='aprobado', status='confirmada'
--      where id = <su reserva>;
--
-- ...y tener la sesión confirmada sin pagar. Lo mismo del lado del coach con
-- `coaches_can_update_own_bookings`. La pantalla nunca fue la frontera.
--
-- Que exista `users_cancel_own_booking` —bien hecha, restringida a
-- 'cancelada'— muestra qué pasó: se agregó la política correcta y **la vieja
-- permisiva quedó activa**, anulándola. Con dos políticas del mismo comando,
-- alcanza con que UNA permita.
--
-- QUÉ ESCRIBE LA APP DE VERDAD (verificado en el código, 18/08/2026):
--   usuario → status='confirmada' (la suya, tras pagar) · status='cancelada'
--   coach   → status='confirmada' · status='cancelada'
--   ningún cliente escribe payment_status, payment_id, amount ni usdt_amount.
--
-- Por eso el cierre va en dos capas, igual que `lock-privileged-columns.sql`:
--   1. GRANT por columna: qué campos se pueden tocar.
--   2. Políticas con WITH CHECK: qué valores y bajo qué condiciones.

-- ── 1. Solo estas columnas ───────────────────────────────────────────────────
-- Todo lo demás —payment_status, payment_id, amount, usdt_amount, paid_at,
-- refund_tx_id— pasa a ser de solo lectura para cualquier cliente. Lo escriben
-- las edge functions con service role, que es donde puede validarse de verdad.
revoke update on public.bookings from authenticated;
grant update (
  status,           -- confirmar / cancelar
  cancelled_by,     -- quién canceló (lo escribe el mismo flujo)
  cancelled_late,   -- si fue tardía (lo usa trg_mark_refund_on_cancel)
  refund_address,   -- el usuario carga dónde recibir su reembolso
  refund_network
) on public.bookings to authenticated;

-- ── 2. La política permisiva se va ───────────────────────────────────────────
drop policy if exists bookings_update_own on public.bookings;

-- ── 3. El usuario confirma la suya SOLO si está paga ─────────────────────────
-- `payment_status = 'aprobado'` o directamente no se inició ningún cobro (coach
-- sin Mercado Pago conectado: ahí no hay nada que esperar y es el flujo que ya
-- funcionaba así). Es la misma condición que aplica la pantalla — ahora también
-- en la base, que es la que manda.
drop policy if exists users_confirm_own_paid_booking on public.bookings;
create policy users_confirm_own_paid_booking on public.bookings
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and status = 'confirmada'
    and (
      payment_status = 'aprobado'
      or (preference_id is null and usdt_amount is null)
    )
  );

-- ── 4. El usuario carga su dirección de reembolso ────────────────────────────
-- Sin esto, al sacar la política permisiva se quedaría sin poder escribirla.
-- No toca `status`, así que no habilita confirmar nada.
drop policy if exists users_set_own_refund_address on public.bookings;
create policy users_set_own_refund_address on public.bookings
  for update to authenticated
  using (user_id = auth.uid() and payment_status = 'reembolso_pendiente')
  with check (user_id = auth.uid() and payment_status = 'reembolso_pendiente');

-- ── 5. El coach: confirmar solo si está paga, cancelar siempre ───────────────
-- Cancelar libera el horario y no compromete nada, así que no se condiciona.
-- Confirmar sí: compromete el turno, avisa al usuario y cancela a los
-- competidores del slot.
drop policy if exists coaches_can_update_own_bookings on public.bookings;
create policy coaches_can_update_own_bookings on public.bookings
  for update to authenticated
  using (coach_id in (select id from public.coaches where profile_id = auth.uid()))
  with check (
    coach_id in (select id from public.coaches where profile_id = auth.uid())
    and (
      status = 'cancelada'
      or (
        status = 'confirmada'
        and (
          payment_status = 'aprobado'
          or (preference_id is null and usdt_amount is null)
        )
      )
    )
  );

-- ⚠️ `users_cancel_own_booking` se deja como está: ya restringe a 'cancelada'
-- y es correcta.

-- ── Verificación ─────────────────────────────────────────────────────────────
-- Las políticas que quedaron (no debe haber ninguna UPDATE con with_check NULL):
--   select policyname, cmd, with_check from pg_policies
--    where tablename='bookings' and cmd='UPDATE';
--
-- Las columnas que puede escribir un cliente:
--   select column_name, privilege_type from information_schema.column_privileges
--    where table_name='bookings' and grantee='authenticated' and privilege_type='UPDATE';
--
-- ⚠️ PROBAR DESDE LA APP antes de dar esto por cerrado: reservar y pagar
-- (confirma), cancelar como usuario, y confirmar/rechazar como coach. Si algo
-- devuelve "0 filas afectadas" sin error, es una política que quedó corta.
