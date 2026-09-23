-- add-retirar-propuestas.sql — el profesional puede retirar lo que propuso.
--
-- 🔴 Faltaba desde que se construyó M16 (21/09). Un profesional proponía dos
--    horarios, después se le liberaba el original, y **no tenía forma de dar
--    marcha atrás**: las opciones seguían en pie y el cliente podía elegir una
--    que ya no servía. Lo único que se podía hacer era proponer OTRA cosa, que
--    reemplaza la tanda anterior, o sea que para retirar había que ofrecer algo
--    nuevo aunque no hubiera nada que ofrecer.
--
-- 📌 Se retira POR RESERVA y no por opción: las tres opciones de una propuesta
--    son una sola oferta, no tres. Retirar media oferta no significa nada.
--
-- 📌 Quedan en `vencida` y no se borran. La tabla es el registro de qué se
--    ofreció y qué pasó con eso; borrar la fila haría desaparecer la
--    conversación entera si alguna vez hay que reconstruirla.
--
-- ⚠️ **Le avisa al cliente**, y no es un detalle: si ya vio las opciones en la
--    Sala y desaparecen sin explicación, lo que queda es una app que cambia sola.

create or replace function public.retirar_propuestas(p_booking uuid)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_b   public.bookings%rowtype;
  v_n   int;
begin
  if v_uid is null then raise exception 'sin sesion' using errcode = '28000'; end if;

  select * into v_b from public.bookings where id = p_booking for update;
  if not found then raise exception 'no existe' using errcode = 'P0001'; end if;

  -- Solo el profesional de esa reserva. El cliente no retira una oferta ajena:
  -- lo suyo es elegir una o pedir la plata (`rechazar_horarios`).
  if not exists (
    select 1 from public.coaches c where c.id = v_b.coach_id and c.profile_id = v_uid
  ) then
    raise exception 'no es tu sesion' using errcode = '42501';
  end if;

  update public.reschedule_requests
     set estado = 'vencida', resolved_at = now()
   where booking_id = v_b.id and estado = 'pendiente' and pedida_por = 'profesional';
  get diagnostics v_n = row_count;

  if v_n = 0 then raise exception 'sin_propuestas' using errcode = 'P0001'; end if;

  perform public.avisar(v_b.user_id, 'cambio_resuelto', v_b.id,
    'Se retiraron los horarios propuestos',
    'Tu profesional dio marcha atrás con el cambio. Tu sesión sigue en su horario de siempre.');

  return jsonb_build_object('resultado', 'retiradas', 'cuantas', v_n);
end $$;

revoke all on function public.retirar_propuestas(uuid) from public, anon;
grant execute on function public.retirar_propuestas(uuid) to authenticated;
