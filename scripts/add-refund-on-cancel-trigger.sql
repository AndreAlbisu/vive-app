-- add-refund-on-cancel-trigger.sql
--
-- Reembolso automático al cancelar una reserva PAGADA.
--
-- Problema que resuelve: hoy hay 5 caminos que pasan un booking a 'cancelada'
-- (coach rechaza pendiente, coach cancela confirmada, cancelación de
-- competidores por el mismo slot ×2, y expire_pending_bookings), pero ninguno
-- del lado cliente toca payment_status. Un usuario que YA pagó y al que le
-- cancelan la sesión se quedaba sin reembolso: mp-process-refunds solo agarra
-- bookings en 'reembolso_pendiente', y nadie los marcaba salvo el expiry.
--
-- En vez de parchear cada sitio (frágil: cualquier path futuro se olvida), un
-- trigger BEFORE UPDATE centraliza la regla en la base — misma filosofía
-- server-side que expire_pending_bookings.
--
-- Regla (política Andre, 2026-07-15): al pasar a 'cancelada', si el pago estaba
-- 'aprobado', marcar 'reembolso_pendiente' — SALVO que sea una cancelación
-- TARDÍA iniciada por el propio usuario (cancelled_by = 'usuario' AND
-- cancelled_late = true), que pierde el reembolso como penalidad. El usuario que
-- cancela con antelación (>24h antes, cancelled_late = false) SÍ se reembolsa.
-- Coach, competidores por slot y expiry siempre reembolsan (no es culpa del usuario).
--
-- El refund real contra la API de MP lo hace el edge function mp-process-refunds
-- (SQL no puede llamar HTTP). Este trigger solo deja el booking marcado.

create or replace function public.mark_refund_on_cancel()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'cancelada'
     and old.status is distinct from 'cancelada'
     and new.payment_status = 'aprobado'
     and not (new.cancelled_by is not distinct from 'usuario'
              and coalesce(new.cancelled_late, false) = true) then
    new.payment_status := 'reembolso_pendiente';
  end if;
  return new;
end;
$$;

-- BEFORE UPDATE OF status: solo corre cuando el UPDATE toca `status`, y modifica
-- NEW.payment_status antes de escribir (una sola fila, sin UPDATE extra).
drop trigger if exists trg_mark_refund_on_cancel on public.bookings;
create trigger trg_mark_refund_on_cancel
  before update of status on public.bookings
  for each row
  execute function public.mark_refund_on_cancel();

-- Nota: expire_pending_bookings ya setea 'reembolso_pendiente' en su propio
-- UPDATE, así que cuando ese path corre NEW.payment_status ya no es 'aprobado'
-- y el trigger es no-op. Convive sin doble efecto.
