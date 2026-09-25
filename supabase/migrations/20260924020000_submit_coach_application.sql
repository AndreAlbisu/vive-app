-- Una postulación es una sola operación: perfil, coach y temas se confirman
-- juntos. Si falla cualquiera de las escrituras, Postgres revierte todo.
create or replace function public.submit_coach_application(
  p_specialty text,
  p_bio text,
  p_topics text[],
  p_estilo text,
  p_guia text,
  p_focos text[],
  p_birth_date date,
  p_gender text,
  p_nationality text,
  p_price numeric,
  p_video_url text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_coach public.coaches%rowtype;
  v_topics text[];
begin
  if v_user is null then
    raise exception 'sin_sesion' using errcode = '42501';
  end if;

  -- Serializa dos envíos simultáneos de la misma cuenta y confirma que existe.
  perform 1 from public.profiles where id = v_user and deleted_at is null for update;
  if not found then
    raise exception 'perfil_no_disponible' using errcode = '42501';
  end if;

  select * into v_coach from public.coaches where profile_id = v_user for update;
  if found and (v_coach.verified or v_coach.application_status <> 'rechazada') then
    raise exception 'solicitud_no_editable' using errcode = '23514';
  end if;

  v_topics := array(select distinct btrim(t) from unnest(p_topics) t where btrim(t) <> '');
  if p_specialty is null or p_specialty not in ('Psicólogo/a', 'Coach', 'Nutricionista')
     or length(btrim(coalesce(p_bio, ''))) not between 10 and 500
     or coalesce(cardinality(v_topics), 0) = 0
     or p_estilo is null or p_estilo not in ('escucha', 'herramientas', 'ambos')
     or p_guia is null or p_guia not in ('guia', 'acompana', 'ambos')
     or coalesce(cardinality(p_focos), 0) not between 1 and 2
     or p_focos is null
     or array_position(p_focos, null) is not null
     or p_focos[1] not in ('historia', 'presente', 'rumbo')
     or (cardinality(p_focos) = 2 and (p_focos[2] not in ('historia', 'presente', 'rumbo') or p_focos[1] = p_focos[2]))
     or p_birth_date is null or p_birth_date > (current_date - interval '18 years')::date
     or p_gender is null or p_gender not in ('Prefiero no decir', 'Masculino', 'Femenino', 'No binario')
     or length(btrim(coalesce(p_nationality, ''))) = 0
     or p_price is null or p_price::text = 'NaN' or p_price <= 0 or p_price >= 1000000000
     or p_video_url is null or p_video_url !~* '^https://[^/[:space:]]+(/[^[:space:]]*)?$'
  then
    raise exception 'postulacion_invalida' using errcode = '23514';
  end if;

  update public.profiles
     set birth_date = p_birth_date, gender = p_gender
   where id = v_user;

  if v_coach.id is null then
    insert into public.coaches (
      profile_id, specialty, bio, price_per_session, nationality,
      application_video_url, estilo, guia, focos
    ) values (
      v_user, p_specialty, btrim(p_bio), p_price, btrim(p_nationality),
      btrim(p_video_url), p_estilo, p_guia, p_focos
    ) returning * into v_coach;
  else
    update public.coaches
       set specialty = p_specialty,
           bio = btrim(p_bio),
           price_per_session = p_price,
           nationality = btrim(p_nationality),
           application_video_url = btrim(p_video_url),
           estilo = p_estilo,
           guia = p_guia,
           focos = p_focos,
           application_status = 'pendiente',
           application_reviewed_at = null
     where id = v_coach.id;
    delete from public.coach_topics where coach_id = v_coach.id;
  end if;

  insert into public.coach_topics (coach_id, topic)
  select v_coach.id, t from unnest(v_topics) t;

  return v_coach.id;
end;
$$;

revoke all on function public.submit_coach_application(
  text, text, text[], text, text, text[], date, text, text, numeric, text
) from public, anon;
grant execute on function public.submit_coach_application(
  text, text, text[], text, text, text[], date, text, text, numeric, text
) to authenticated;

-- Una actualización administrativa que cambia el estado explícitamente no
-- puede ser interpretada como reenvío de una solicitud rechazada.
create or replace function public.reset_application_on_edit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.application_status = 'rechazada'
     and new.application_status = 'rechazada'
     and (new.specialty, new.bio, new.price_per_session, new.nationality,
          new.application_video_url, new.estilo, new.guia, new.focos)
       is distinct from
         (old.specialty, old.bio, old.price_per_session, old.nationality,
          old.application_video_url, old.estilo, old.guia, old.focos)
  then
    new.application_status := 'pendiente';
    new.application_reviewed_at := null;
  end if;
  return new;
end;
$$;
