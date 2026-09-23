-- cerrar-columnas-postulacion.sql
--
-- Auditoría de seguridad del 23/09/2026 (previa a la v1).
--
-- 🔴 HALLAZGO: la policy de SELECT de `coaches` es `using (true)` —el catálogo
-- es público a propósito— así que **las columnas mandan**. Y `anon` (la clave
-- que viaja dentro de la app publicada) y `authenticated` tenían SELECT sobre
-- cuatro columnas que son de la revisión interna, no del catálogo:
--
--   · `application_notes`       el motivo por el que Vita rechazó una
--                               postulación, escrito por nosotros sobre esa
--                               persona. Es lo más sensible de las cuatro.
--   · `application_status`      quién está pendiente o rechazado.
--   · `application_reviewed_at` cuándo se lo revisó.
--   · `application_video_url`   el video que mandó para postularse (distinto
--                               de `video_url`, que sí es el del perfil).
--
-- Hoy no filtra nada porque los 34 perfiles están aprobados, pero el día que
-- haya un rechazado o un suspendido, su motivo de rechazo queda legible por
-- cualquiera con la anon key. Es el mismo patrón de `restrict-anon-profiles-
-- columns.sql` (08/09): RLS dice qué FILAS, los grants dicen qué COLUMNAS.
--
-- Quién las leía:
--   · el panel de admin → `admin-actions` con service role: NO se ve afectado.
--   · el propio profesional en `CoachApplicationScreen` (para ver el motivo del
--     rechazo y re-postularse) → pasa a `mi_postulacion()`, misma idea que
--     `get_my_profile()` / `email_es_de_coach()`: contesta lo justo sin abrir
--     la columna.
--
-- ⚠️ `suspendido_hasta` NO se toca acá: el catálogo, la ficha y la página
-- pública `/c` filtran por esa columna con la anon key, y filtrar exige SELECT.
-- Cerrarla pide una vista de catálogo (L15 en problemas-abiertos.md).
--
-- Fecha: 2026-09-23

begin;

-- 🔴 El SELECT estaba otorgado sobre la TABLA, no por columnas, y un
-- `revoke select (col)` sobre un grant de tabla NO hace nada (el primer intento
-- de este script devolvió los 8 grants intactos). Hay que quitar el de tabla y
-- volver a otorgar la lista blanca, igual que hizo `restrict-anon-profiles-
-- columns.sql` con `profiles`.
--
-- ⚠️ Toda columna NUEVA de `coaches` que el catálogo necesite leer va a tener
-- que sumarse acá: al no haber grant de tabla, no queda otorgada sola.
revoke select on public.coaches from anon, authenticated;

grant select (
  id, profile_id, specialty, bio, price_per_session, nationality, verified,
  created_at, video_url, instant_booking, availability_status, mp_connected,
  accepts_international, price_usd, accepts_paypal, accepts_usdt, has_matricula,
  slug, suspendido_hasta, estilo, enfoques, guia, focos
) on public.coaches to anon, authenticated;

create or replace function public.mi_postulacion()
returns table (
  id uuid,
  specialty text,
  bio text,
  price_per_session numeric,
  nationality text,
  application_video_url text,
  application_status text,
  application_notes text,
  estilo text,
  guia text,
  focos text[]
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select c.id, c.specialty, c.bio, c.price_per_session, c.nationality,
         c.application_video_url, c.application_status, c.application_notes,
         c.estilo, c.guia, c.focos
    from public.coaches c
   where c.profile_id = auth.uid();
$$;

revoke all on function public.mi_postulacion() from public;
grant execute on function public.mi_postulacion() to authenticated;

comment on function public.mi_postulacion() is
  'La postulación del que llama (auth.uid()). Existe porque las columnas application_* dejaron de ser legibles por anon/authenticated (auditoría 23/09/2026).';

commit;

notify pgrst, 'reload schema';

-- ── VERIFICACIÓN ────────────────────────────────────────────────────────────
create temp table if not exists _res (chequeo text, valor text, ok boolean);
truncate _res;

do $$
declare v int; v_mias int; v_otra int; v_err text; v_coach uuid;
begin
  select count(*) into v from information_schema.column_privileges
   where table_schema='public' and table_name='coaches' and privilege_type='SELECT'
     and grantee in ('anon','authenticated')
     and column_name in ('application_notes','application_status','application_reviewed_at','application_video_url');
  insert into _res values ('grants que quedan sobre las 4 columnas (esperado 0)', v::text, v = 0);

  select count(*) into v from information_schema.column_privileges
   where table_schema='public' and table_name='coaches' and privilege_type='SELECT'
     and grantee='anon' and column_name in ('slug','specialty','suspendido_hasta','verified','availability_status');
  insert into _res values ('el catálogo sigue legible por anon (esperado 5)', v::text, v = 5);

  -- Un profesional real leyendo su propia postulación por la función nueva.
  select profile_id into v_coach from public.coaches limit 1;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', v_coach::text, 'role','authenticated')::text, true);
    select count(*) into v_mias from public.mi_postulacion();
    -- Y que la columna cerrada ya no se pueda leer directo.
    begin
      execute 'select count(*) from public.coaches where application_notes is not null' into v_otra;
    exception when insufficient_privilege then
      v_otra := -1;
    end;
  exception when others then
    v_err := sqlerrm; v_mias := -99;
  end;
  reset role;

  insert into _res values ('la función le devuelve SU postulación (esperado 1)', v_mias::text || coalesce(' err=' || v_err, ''), v_mias = 1);
  insert into _res values ('leer application_notes directo ahora falla (esperado -1)', v_otra::text, v_otra = -1);
end $$;

select * from _res;
