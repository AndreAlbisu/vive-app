-- harden-reviews-insert.sql
--
-- Cierra el agujero de reputación: hasta hoy la política de INSERT de `reviews`
-- era solo `reviewer_id = auth.uid()`. No validaba que el booking fuera del que
-- reseña, ni que la sesión se hubiera hecho, ni que el reseñado fuera el coach
-- de esa reserva. Todo eso lo armaba bien ReviewScreen.tsx — pero la pantalla no
-- es la frontera de seguridad. Contra la API directa, cualquier cuenta con sesión
-- válida podía insertar una reseña de CUALQUIER coach del catálogo reusando un
-- booking_id propio.
--
-- Costo de fabricar reputación antes de esto: N cuentas.
-- Costo después: N sesiones completadas y pagadas.
--
-- Importa ahora porque el deck de Conexiones pasa de "el mejor puntuado gana"
-- a "todo el que cruza la barra entra al sorteo" (ver lib/coachDeckRanking.ts).
-- Una barra sobre estrellas falsificables es decorativa.
--
-- Mismo patrón EXISTS que session_notes_coach_all (ver add-session-notes.sql).
-- Ojo con las dos convenciones de FK (lección 19 de SCHEMA.md):
--   bookings.coach_id  → coaches.id
--   reviews.reviewed_id → profiles.id
-- por eso el join contra `coaches` para cruzar de una a la otra.
--
-- Fecha: 2026-08-07

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Diagnóstico PREVIO — correr esto solo, mirar el resultado, después seguir.
--    Son las reviews que hoy existen y NO pasarían la política nueva. La política
--    solo aplica a inserts futuros (las filas viejas quedan), pero si este número
--    es alto conviene entender por qué antes de cerrar la puerta.
-- ─────────────────────────────────────────────────────────────────────────────
select
  count(*) filter (where b.id is null)                             as sin_booking,
  count(*) filter (where b.id is not null and b.user_id <> r.reviewer_id) as booking_ajeno,
  count(*) filter (where b.id is not null and b.status <> 'completada')   as sesion_no_completada,
  count(*) filter (where b.id is not null and c.profile_id is distinct from r.reviewed_id) as coach_no_coincide,
  count(*)                                                          as total
from public.reviews r
left join public.bookings b on b.id = r.booking_id
left join public.coaches  c on c.id = b.coach_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Reemplazar la política de INSERT.
--    Se borran TODAS las políticas de INSERT existentes sobre reviews en vez de
--    nombrar una: el nombre original no está documentado en SCHEMA.md y no vale
--    la pena que este script falle por eso.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  pol record;
begin
  for pol in
    select polname
    from pg_policy
    where polrelid = 'public.reviews'::regclass
      and polcmd = 'a'   -- 'a' = INSERT
  loop
    execute format('drop policy %I on public.reviews', pol.polname);
    raise notice 'política de INSERT borrada: %', pol.polname;
  end loop;
end $$;

-- Una reseña exige una sesión REAL: propia, completada, y con ese coach.
-- Como el EXISTS cuelga de booking_id, la política además vuelve booking_id
-- obligatorio de hecho (con NULL el exists no matchea nada y el insert falla),
-- sin necesidad de un NOT NULL que rompería las filas históricas.
create policy reviews_insert_completed_session on public.reviews
  for insert to authenticated
  with check (
    reviewer_id = auth.uid()
    and exists (
      select 1
      from public.bookings b
      join public.coaches c on c.id = b.coach_id
      where b.id = reviews.booking_id
        and b.user_id = auth.uid()          -- el booking es de quien reseña
        and b.status = 'completada'         -- la sesión ocurrió
        and c.profile_id = reviews.reviewed_id  -- y es el coach de ESA sesión
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. UPDATE queda como estaba, a propósito.
--    Editar una reseña propia no necesita revalidar la sesión: el trigger
--    reviews_before_update ya hace inmutables reviewer_id / reviewed_id /
--    booking_id, así que una reseña editada sigue apuntando a la misma sesión
--    verificada en el INSERT. Y sigue sin haber política de DELETE (borrar es
--    imposible por RLS) — eso es lo que impide que un coach presione a alguien
--    para que le borre una reseña mala.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Verificación — correr después. Debe listar reviews_insert_completed_session
--    como única política de INSERT, y el WITH CHECK con el exists.
-- ─────────────────────────────────────────────────────────────────────────────
select polname,
       case polcmd when 'a' then 'INSERT' when 'r' then 'SELECT'
                   when 'w' then 'UPDATE' when 'd' then 'DELETE' else 'ALL' end as cmd,
       pg_get_expr(polwithcheck, polrelid) as with_check,
       pg_get_expr(polqual, polrelid)      as using_expr
from pg_policy
where polrelid = 'public.reviews'::regclass
order by polcmd;
