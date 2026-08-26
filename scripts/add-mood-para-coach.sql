-- El profesional ve la TENDENCIA de ánimo de su cliente (D)
-- ---------------------------------------------------------------------------
-- 🔴 A LA ESPERA DE LA RESPUESTA DEL ABOGADO (pregunta A.10 de
-- `docs/paquete-abogado.md`). Decisión de Andre el 26/08/2026: construirlo
-- ahora y apagarlo si la respuesta es que no se puede, para no perder tiempo.
-- **Este script ES el interruptor**: sin la función, la app no muestra nada
-- (el cliente ya trata el error como "no hay datos"). Apagarlo es
-- `drop function` — o `MOSTRAR_ANIMO_AL_COACH = false` del lado de la app.
--
-- Por qué una FUNCIÓN y no una policy nueva sobre `mood_entries`:
--
--   1. Una policy le daría al coach las FILAS. Acá no queremos que las vea:
--      queremos que vea un promedio y una dirección. La función devuelve
--      exactamente eso y no hay forma de sacarle más.
--   2. La relación se valida adentro, contra `bookings`, en vez de confiar en
--      que el cliente pregunte solo por sus propios clientes.
--   3. Se apaga borrándola. Una policy hay que acordarse de revertirla bien.
--
-- ⚠️ El DIARIO y la GRATITUD quedan afuera por completo, y no por olvido: son
-- texto libre donde la persona escribe lo que no le dice a nadie. El ánimo es
-- una escala de 1 a 5; el diario es contenido. No se tocan.

create or replace function public.mood_trend_for_client(
  p_user_id uuid,
  p_days int default 14
)
returns table (
  dias_con_registro int,
  promedio numeric,
  ultimo smallint,
  ultimo_dia date,
  -- 'sube' | 'baja' | 'igual', comparando la primera mitad del período con la
  -- segunda. Es una DIRECCIÓN, no un diagnóstico, y así se nombra.
  direccion text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_profile uuid := auth.uid();
  v_desde date := (current_date - (greatest(p_days, 1) || ' days')::interval)::date;
begin
  -- 🔴 La puerta. Solo un coach que EFECTIVAMENTE atendió a esta persona.
  -- `bookings.coach_id` es `coaches.id`; `auth.uid()` es `profiles.id`, que en
  -- el coach es `coaches.profile_id`. Son dos ids con nombres parecidos y
  -- confundirlos acá abriría el ánimo de cualquiera a cualquier coach.
  if not exists (
    select 1
      from public.bookings b
      join public.coaches c on c.id = b.coach_id
     where c.profile_id = v_coach_profile
       and b.user_id = p_user_id
       and b.status in ('completada', 'confirmada')
  ) then
    return;   -- sin filas: para el cliente es indistinguible de "no hay datos"
  end if;

  return query
  with e as (
    select m.mood_id, m.entry_date
      from public.mood_entries m
     where m.user_id = p_user_id
       and m.entry_date >= v_desde
  ),
  mitades as (
    select
      avg(mood_id) filter (where entry_date <  v_desde + ((current_date - v_desde) / 2)) as primera,
      avg(mood_id) filter (where entry_date >= v_desde + ((current_date - v_desde) / 2)) as segunda
      from e
  )
  select
    (select count(*)::int from e),
    (select round(avg(mood_id), 2) from e),
    (select mood_id from e order by entry_date desc limit 1),
    (select entry_date from e order by entry_date desc limit 1),
    case
      when (select primera from mitades) is null or (select segunda from mitades) is null then 'igual'
      when (select segunda from mitades) - (select primera from mitades) >  0.5 then 'sube'
      when (select segunda from mitades) - (select primera from mitades) < -0.5 then 'baja'
      else 'igual'
    end
  -- Piso de muestra: con menos de 3 registros no hay tendencia, hay ruido. Un
  -- solo día malo no puede leerse como "viene cayendo".
  where (select count(*) from e) >= 3;
end;
$$;

revoke all on function public.mood_trend_for_client(uuid, int) from public, anon;
grant execute on function public.mood_trend_for_client(uuid, int) to authenticated;


-- ── Verificación ─────────────────────────────────────────────────────────────
-- 1) Un coach cualquiera NO puede ver a alguien que no atendió. Esperado: 0 filas.
--    (correr logueado como coach, reemplazando el uuid por un usuario ajeno)
--
-- select * from public.mood_trend_for_client('00000000-0000-0000-0000-000000000000');
--
-- 2) Y sigue sin poder leer las filas crudas — la policy no se tocó.
--    Esperado: 0 filas (RLS), NO un error.
--
-- select * from public.mood_entries where user_id <> auth.uid();
--
-- 3) Con un cliente propio y ≥3 registros en la ventana, devuelve UNA fila.


-- ── Apagarlo ─────────────────────────────────────────────────────────────────
-- Si el abogado dice que no:
--   drop function if exists public.mood_trend_for_client(uuid, int);
-- La app ya trata la ausencia como "no hay datos" y no muestra nada.
