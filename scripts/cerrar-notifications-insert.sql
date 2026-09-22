-- cerrar-notifications-insert.sql
--
-- 🔴 **Cualquiera con una cuenta podía mandarle una notificación a cualquiera,
--    con el texto que quisiera.** La policy de INSERT decía, entera:
--
--        with check (auth.role() = 'authenticated')
--
--    O sea que solo pedía estar logueado. `recipient_id`, `title` y `body` eran
--    libres.
--
-- ── Por qué es peor que "una notificación falsa" ─────────────────────────────
--
-- 🔴 **Las notificaciones se MANDAN POR MAIL.** `mail-notificaciones` levanta
--    las que tienen un `type` con plantilla y las manda por Resend **desde
--    `no-responder@vitaapp.com.ar`**, con el `title` como asunto y el `body` como
--    cuerpo. Con DKIM y SPF válidos, porque es nuestro dominio de verdad.
--
--    Y los `profile_id` de los profesionales **son públicos** (están en
--    `coaches`). Así que alcanzaba una cuenta cualquiera para mandarle a todos
--    los profesionales de la plataforma un mail que parece de Vita y pasa todos
--    los controles antispam. Es phishing con nuestra reputación de remitente.
--
-- ── La regla nueva ───────────────────────────────────────────────────────────
--
-- Solo se puede avisar **sobre una reserva de la que sos parte**, y solo **a la
-- otra parte de esa misma reserva**. Nada de avisos sueltos.
--
-- 📌 Lo que el cliente inserta hoy entra entero: el profesional avisando a su
--    cliente (`coachBookingActions`), cualquiera de los dos al cancelar
--    (`bookingCancel`), y la confirmación que el cliente se escribe a sí mismo
--    (`BookingScreen_Confirm`).
--
-- 📌 **Salvo un caso, y es a propósito**: el aviso a los "competidores" del
--    horario (quienes tenían una solicitud pendiente para el mismo turno) lo
--    hacía también el cliente, sobre reservas ajenas. Eso ahora queda bloqueado
--    **y no se pierde nada**: `_shared/booking-effects.ts` ya los cancela y los
--    avisa con service role. De hecho la cancelación del lado del cliente ya no
--    funcionaba —la RLS de `bookings` no la deja tocar reservas ajenas— así que
--    ese bloque venía escribiendo solo la notificación, a medias.
--
-- ⚠️ **Lo que NO cierra**: alguien que SÍ tiene una reserva con un profesional
--    puede mandarle un aviso con texto libre, y ese texto sale por mail. Es la
--    misma superficie que ya le da el chat de la sala, así que no agrega un
--    canal nuevo. Cerrarlo del todo es mover la creación de notificaciones a una
--    función `security definer` como `avisar()`, y son 7 lugares en la app: queda
--    anotado para la tanda de `lib/`.

drop policy if exists notifications_insert_authenticated on public.notifications;

create policy notifications_insert_partes on public.notifications
  for insert to authenticated
  with check (
    booking_id is not null
    and exists (
      select 1
      from public.bookings b
      left join public.coaches c on c.id = b.coach_id
      where b.id = notifications.booking_id
        -- quien escribe tiene que ser parte de esa reserva
        and (b.user_id = auth.uid() or c.profile_id = auth.uid())
        -- y el destinatario, la otra parte (o uno mismo)
        and notifications.recipient_id in (b.user_id, c.profile_id)
    )
  );
