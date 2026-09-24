-- Postulación: qué hace ante un caso que no le corresponde y desde dónde atiende
-- (24/09/2026, docs/postulacion-preguntas.md, huecos 2 y 4).
--
-- 🔴 Hueco 2. La postulación no preguntaba nada sobre los límites de cada uno.
-- Un coach o una nutricionista no pueden tratar lo clínico (Ley 23.277), y
-- cualquier profesional puede encontrarse con alguien en riesgo:
--   · `compromiso_derivar`: coaches y nutricionistas se comprometen a derivar lo
--     que exceda su práctica. Obligatorio para ellos (lo exige la app).
--   · `respuesta_riesgo`: a TODOS, "¿Qué hacés si alguien te cuenta que piensa
--     en hacerse daño?". Se lee a mano al revisar la postulación. No es un
--     examen: dice mucho de quién está del otro lado.
--
-- 🔴 Hueco 4. Se preguntaba la nacionalidad, pero lo que importa es dónde vive y
-- ejerce (matrícula nacional o provincial, cobro, zona horaria, impuestos), y
-- todo el sistema supone Argentina sin haberlo preguntado nunca:
--   · `pais_atencion`, `provincia_atencion` (la provincia, si es Argentina).
--
-- 📌 Las cuatro son PRIVADAS: no se suman al SELECT de `anon`/`authenticated`
-- (el de `coaches` es una lista blanca de columnas). El profesional las
-- recupera por `mi_postulacion()` y el panel por `admin-actions`.
--
-- Idempotente.

alter table public.coaches
  add column if not exists compromiso_derivar boolean,
  add column if not exists respuesta_riesgo text
    check (respuesta_riesgo is null or char_length(respuesta_riesgo) between 20 and 1000),
  add column if not exists pais_atencion text
    check (pais_atencion is null or char_length(pais_atencion) between 2 and 60),
  add column if not exists provincia_atencion text
    check (provincia_atencion is null or char_length(provincia_atencion) between 2 and 60);

-- Las escribe el profesional al postularse y al volver a postularse.
grant insert (compromiso_derivar, respuesta_riesgo, pais_atencion, provincia_atencion) on public.coaches to authenticated;
grant update (compromiso_derivar, respuesta_riesgo, pais_atencion, provincia_atencion) on public.coaches to authenticated;

-- `mi_postulacion()` devuelve también las nuevas, para precargar la segunda
-- vuelta. Cambia la forma de lo que devuelve, así que hay que recrearla.
drop function if exists public.mi_postulacion();
create function public.mi_postulacion()
returns table (
  id uuid, specialty text, bio text, price_per_session numeric, nationality text,
  application_video_url text, application_status text, application_notes text,
  estilo text, guia text, focos text[],
  compromiso_derivar boolean, respuesta_riesgo text, pais_atencion text, provincia_atencion text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.specialty, c.bio, c.price_per_session, c.nationality,
         c.application_video_url, c.application_status, c.application_notes,
         c.estilo, c.guia, c.focos,
         c.compromiso_derivar, c.respuesta_riesgo, c.pais_atencion, c.provincia_atencion
    from public.coaches c
   where c.profile_id = auth.uid();
$$;
-- Antes también la podía llamar `anon` (no devolvía nada, filtra por usuario).
revoke all on function public.mi_postulacion() from public, anon;
grant execute on function public.mi_postulacion() to authenticated;

-- ── VERIFICACIÓN
create temp table _res(chequeo text, resultado text);
insert into _res select 'columnas nuevas', count(*)::text from information_schema.columns
  where table_name = 'coaches' and column_name in ('compromiso_derivar','respuesta_riesgo','pais_atencion','provincia_atencion');
insert into _res select 'anon/authenticated LEEN las nuevas (esperado 0)', count(*)::text
  from information_schema.column_privileges
  where table_name = 'coaches' and grantee in ('anon','authenticated') and privilege_type = 'SELECT'
    and column_name in ('compromiso_derivar','respuesta_riesgo','pais_atencion','provincia_atencion');
insert into _res select 'authenticated puede escribirlas (esperado 8)', count(*)::text
  from information_schema.column_privileges
  where table_name = 'coaches' and grantee = 'authenticated' and privilege_type in ('INSERT','UPDATE')
    and column_name in ('compromiso_derivar','respuesta_riesgo','pais_atencion','provincia_atencion');
insert into _res select 'anon llama mi_postulacion (esperado false)',
  has_function_privilege('anon', 'public.mi_postulacion()', 'execute')::text;
-- El profesional actualiza lo suyo y lo lee de vuelta, con rollback.
do $$
declare c record; r record;
begin
  select id, profile_id into c from coaches limit 1;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', c.profile_id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    update coaches set compromiso_derivar = true,
      respuesta_riesgo = 'Le pregunto si está a salvo y le paso la línea 135; si hay riesgo, pido ayuda.',
      pais_atencion = 'Argentina', provincia_atencion = 'Córdoba'
    where id = c.id;
    select * into r from mi_postulacion();
    reset role;
    raise exception 'r:%/%/%', r.compromiso_derivar, r.pais_atencion, r.provincia_atencion;
  exception when others then
    reset role;
    insert into _res values ('escribe y relee lo suyo (esperado r:true/Argentina/Córdoba)', sqlerrm);
  end;
end $$;
select * from _res;
