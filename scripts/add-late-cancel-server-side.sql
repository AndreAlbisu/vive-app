-- La tardanza de una cancelación la decide la BASE, no el teléfono
-- ------------------------------------------------------------------
-- `trg_mark_refund_on_cancel` lee `cancelled_late` para decidir si corresponde
-- reembolso. Esa columna la venía escribiendo el CLIENTE (`lib/bookingCancel.ts`
-- con `isCancelLate`), y `harden-bookings-update.sql` se la otorgó por `grant`.
-- Dos problemas distintos, los dos de plata:
--
-- 1. 🔴 ERA INCORRECTA FUERA DE ARGENTINA. `isCancelLate` armaba el instante con
--    `new Date(year, month-1, day, h, m)`, que interpreta una hora guardada en
--    horario argentino según la zona DEL DISPOSITIVO. En un teléfono argentino
--    coincide y por eso nunca se vio; desde Madrid el instante caía 5 horas
--    antes, así que alguien cancelando con 29 horas de anticipación quedaba
--    marcado como tardío y perdía un reembolso que le correspondía. Le pegaba
--    justo a los usuarios del riel internacional.
--
-- 2. 🔴 ERA FALSIFICABLE. Ninguna política restringe su VALOR: contra la API
--    directa se podía cancelar una hora antes mandando `cancelled_late = false`
--    y cobrar el reembolso igual. La penalidad por cancelación tardía no era
--    exigible. Mismo patrón que la sesión 104: la pantalla no es la frontera.
--
-- La base tiene todo lo necesario para decidirlo sola — `scheduled_date`,
-- `scheduled_time` y el reloj — así que deja de preguntar.
--
-- ⚠️ POR QUÉ SE PISA EL VALOR EN VEZ DE REVOCAR EL GRANT. Revocar la columna
-- rompería a cualquiera con una build vieja instalada: el flujo de cancelación
-- escribe `status`, `cancelled_by` y `cancelled_late` en un solo UPDATE, y si
-- una columna queda fuera del grant **falla el UPDATE entero** (la lección de la
-- sesión 104). O sea que nadie podría cancelar hasta actualizar la app. Pisando
-- el valor en el trigger, las builds viejas siguen mandando lo que mandaban, se
-- ignora, y el resultado es correcto igual. El `revoke` se puede hacer más
-- adelante, cuando no queden builds viejas — y para entonces será cosmético.

create or replace function public.mark_refund_on_cancel()
returns trigger
language plpgsql
as $$
declare
  inicio timestamptz;
  tardia boolean;
begin
  if new.status = 'cancelada' and old.status is distinct from 'cancelada' then

    -- El instante real de la sesión: la fecha y la hora están guardadas como
    -- texto en horario de Argentina, sin zona. `AT TIME ZONE` con el nombre de
    -- la zona —y no un offset fijo— es el mismo criterio que ya usan
    -- `complete_confirmed_sessions()` y el cron de recordatorios.
    begin
      inicio := ((new.scheduled_date::text || ' ' || new.scheduled_time::text)::timestamp)
                AT TIME ZONE 'America/Argentina/Buenos_Aires';
    exception when others then
      -- Una fila con fecha u hora ilegible no puede decidir sobre plata en
      -- silencio. Se trata como NO tardía: ante la duda se reembolsa, que es el
      -- lado que no perjudica a quien pagó.
      inicio := null;
    end;

    tardia := inicio is not null and now() > inicio - interval '24 hours';

    -- Se PISA lo que haya mandado el cliente. A partir de acá la columna es un
    -- dato derivado, no una entrada: sirve de registro de por qué se reembolsó o
    -- no, y se puede auditar contra scheduled_date/time.
    new.cancelled_late := tardia;

    if new.payment_status = 'aprobado'
       and not (new.cancelled_by is not distinct from 'usuario' and tardia) then
      new.payment_status := 'reembolso_pendiente';
    end if;
  end if;
  return new;
end;
$$;

-- El trigger no cambia: sigue siendo BEFORE UPDATE OF status. Se recrea igual
-- por si el script se corre sobre una base donde no existiera.
drop trigger if exists trg_mark_refund_on_cancel on public.bookings;
create trigger trg_mark_refund_on_cancel
  before update of status on public.bookings
  for each row
  execute function public.mark_refund_on_cancel();


-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación
--
-- 1) La función quedó con el cálculo adentro (tiene que aparecer la zona):
--    select prosrc like '%America/Argentina%' as calcula_zona
--      from pg_proc where proname = 'mark_refund_on_cancel';
--
-- 2) Prueba real, sobre una reserva de prueba PAGADA y con fecha futura lejana.
--    Se manda cancelled_late = true a propósito (mintiendo, como haría un
--    cliente con la zona mal o alguien pegándole a la API):
--
--    update public.bookings
--       set status = 'cancelada', cancelled_by = 'usuario', cancelled_late = true
--     where id = '<UUID DE PRUEBA>';
--
--    select cancelled_late, payment_status from public.bookings where id = '<UUID>';
--    -- esperado: cancelled_late = false (la base lo recalculó y faltaban >24hs)
--    --           payment_status = 'reembolso_pendiente'  ← el reembolso SÍ sale
--
-- 3) El caso inverso, con una reserva a menos de 24hs:
--    -- esperado: cancelled_late = true, payment_status queda en 'aprobado'
