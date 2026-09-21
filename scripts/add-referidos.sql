-- add-referidos.sql — M7.
--
-- **Descuento para el que llega invitado; nada para el que invita.** Decidido
-- por Andre el 21/09/2026, junto con el número: **10% de la sesión**, una sola
-- vez, en su primera sesión pagada.
--
-- 🔴 **Sale de la comisión de Vita, nunca del bolsillo del profesional.** Él
--    cobra lo mismo (de hecho unos pesos más, porque la tarifa de Mercado Pago
--    se calcula sobre un monto menor). Implementarlo bajándole el precio a él
--    sería pedirle que pague nuestro marketing.
--
-- 📌 **Por qué no copiamos a Selia, que da 50%.** Ellos retienen la plata y le
--    pagan al que invita con créditos internos, que no cuestan nada hasta que se
--    usan, vencen, y se pierden si la persona se va. Con Mercado Pago el pago va
--    directo a la cuenta del profesional: Vita no tiene dónde guardar un saldo.
--    Ver `docs/competencia-selia.md` §§ 278-284 y 549-556.
--
-- 📌 Las columnas nuevas quedan fuera del alcance del cliente sin hacer nada:
--    el UPDATE de `authenticated` sobre `profiles` es una lista blanca de 10
--    columnas, y estas no entran. Se escriben solo desde las funciones de abajo
--    y desde las edge functions con service role.

alter table public.profiles
  add column if not exists referral_code       text,
  add column if not exists referred_by         uuid references public.profiles(id),
  add column if not exists referral_redeemed_at timestamptz;

create unique index if not exists profiles_referral_code_uniq
  on public.profiles (referral_code) where referral_code is not null;

alter table public.bookings
  add column if not exists referral_discount numeric not null default 0;

comment on column public.bookings.referral_discount is
  'M7: cuánto se le descontó a esta reserva por venir de un referido. Queda guardado para poder auditar por qué el cobro no coincide con el precio del profesional.';

-- ── Un código legible ────────────────────────────────────────────────────────
-- 🔴 Sin I, O, 1 ni 0: son los cuatro que se confunden leyendo un código en la
--    pantalla de otro, que es exactamente como va a viajar este. Mismo alfabeto
--    que `lib/referidos.ts`, que lo valida del lado de la app.
create or replace function public.nuevo_codigo_referido()
returns text language plpgsql as $$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  intento text;
  i int;
begin
  for _ in 1 .. 20 loop
    intento := '';
    for i in 1 .. 6 loop
      intento := intento || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    if not exists (select 1 from public.profiles where referral_code = intento) then
      return intento;
    end if;
  end loop;
  -- 32^6 son mil millones de combinaciones: veinte choques seguidos no es
  -- "mala suerte", es que algo anda mal. Mejor fallar que devolver un duplicado.
  raise exception 'no se pudo generar un codigo' using errcode = 'P0001';
end $$;

-- ── Mi código (se crea la primera vez que se pide) ───────────────────────────
create or replace function public.mi_codigo_referido()
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_cod text;
begin
  if v_uid is null then raise exception 'sin sesion' using errcode = '28000'; end if;

  select referral_code into v_cod from public.profiles where id = v_uid for update;
  if v_cod is not null then return v_cod; end if;

  v_cod := public.nuevo_codigo_referido();
  update public.profiles set referral_code = v_cod where id = v_uid;
  return v_cod;
end $$;

-- ── Canjear el código de otro ────────────────────────────────────────────────
create or replace function public.canjear_codigo(p_codigo text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_cod   text := upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g'));
  v_duenio uuid;
  v_yo    public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'sin sesion' using errcode = '28000'; end if;

  select * into v_yo from public.profiles where id = v_uid for update;
  if v_yo.referred_by is not null then
    raise exception 'ya_tiene_referido' using errcode = 'P0001';
  end if;

  -- ⚠️ El descuento es para quien EMPIEZA. Quien ya pagó una sesión no está
  -- llegando: está volviendo, y ahí el descuento no compra nada.
  if exists (
    select 1 from public.bookings
    where user_id = v_uid and payment_status in ('aprobado', 'reembolsado', 'reembolso_pendiente')
  ) then
    raise exception 'ya_uso_la_app' using errcode = 'P0001';
  end if;

  select id into v_duenio from public.profiles where referral_code = v_cod;
  if v_duenio is null then raise exception 'codigo_inexistente' using errcode = 'P0001'; end if;
  if v_duenio = v_uid then raise exception 'codigo_propio' using errcode = 'P0001'; end if;

  update public.profiles set referred_by = v_duenio where id = v_uid;
  return jsonb_build_object('resultado', 'canjeado');
end $$;

-- ── ¿Le corresponde descuento a esta persona? ────────────────────────────────
-- Lo usa la app para mostrarlo antes de pagar, y las edge functions (con
-- service role) para calcular el cobro. Una sola definición para los dos, que es
-- lo que evita que la pantalla prometa un descuento que el cobro no haga.
create or replace function public.tiene_descuento_referido(p_user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = p_user and referred_by is not null and referral_redeemed_at is null
  );
$$;

revoke all on function public.mi_codigo_referido() from public, anon;
revoke all on function public.canjear_codigo(text) from public, anon;
revoke all on function public.tiene_descuento_referido(uuid) from public, anon;
grant execute on function public.mi_codigo_referido() to authenticated;
grant execute on function public.canjear_codigo(text) to authenticated;
grant execute on function public.tiene_descuento_referido(uuid) to authenticated;
