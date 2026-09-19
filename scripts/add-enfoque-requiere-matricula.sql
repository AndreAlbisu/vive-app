-- add-enfoque-requiere-matricula.sql
--
-- M14, segunda parte: la escuela solo la puede declarar quien tiene matrícula
-- verificada por Vita.
--
-- El agujero que cierra: `coaches.enfoques` nació abierta a cualquier perfil, y
-- las seis opciones son escuelas de PSICOLOGÍA. Un coach sin matrícula marcando
-- "psicoanalítico" está insinuando en su perfil que es psicólogo, que es
-- exactamente lo que el buscador (03/09) y el quiz (17/09) dejaron de deducir
-- del texto libre. La escuela no llega al matching, pero sí queda impresa en el
-- perfil, que es donde la persona decide.
--
-- No alcanza con esconder la pregunta en la pantalla: si el profesional la
-- contestó y DESPUÉS le revocan la matrícula, la escuela le queda puesta para
-- siempre. Por eso la regla vive acá.
--
-- 🔴 Y por eso es un trigger y NO un CHECK. `has_matricula` la mantiene
-- `trg_sync_matricula` desde `coach_credentials`: con un CHECK, revocar una
-- credencial a alguien que ya declaró su escuela haría fallar ese update, o
-- sea que la app no podría revocar una matrícula. Un dato viejo en un perfil es
-- malo; no poder revocar una credencial es peor. El trigger, en cambio, vacía
-- el enfoque solo en el momento de la revocación.
--
-- `estilo` NO se toca: lo contesta cualquier profesional, con matrícula o sin
-- ella, y es lo único que mira el quiz.
--
-- Fecha: 2026-09-17

begin;

create or replace function public.enfoques_requieren_matricula()
returns trigger language plpgsql as $$
begin
  -- Sin matrícula verificada no hay escuela que mostrar. Se vacía en silencio
  -- en vez de rechazar: el caso normal no es alguien haciendo trampa, es una
  -- revocación de credencial, y ahí fallar rompería la revocación.
  if not coalesce(new.has_matricula, false) then
    new.enfoques := '{}'::text[];
  end if;
  return new;
end $$;

drop trigger if exists trg_enfoques_requieren_matricula on public.coaches;
create trigger trg_enfoques_requieren_matricula
  before insert or update on public.coaches
  for each row execute function public.enfoques_requieren_matricula();

-- Backfill: hoy no hay ninguna fila con enfoques (la columna nació vacía esta
-- misma tarde), pero si en el futuro se vuelve a correr, limpia lo que quedó.
update public.coaches
   set enfoques = '{}'::text[]
 where coalesce(array_length(enfoques, 1), 0) > 0
   and not coalesce(has_matricula, false);

commit;

notify pgrst, 'reload schema';

-- ── VERIFICACIÓN ────────────────────────────────────────────────────────────
do $$
declare v_trg boolean; v_sucias int;
begin
  create temp table if not exists _res (chequeo text, valor text, ok boolean); truncate _res;

  select exists (
    select 1 from pg_trigger
     where tgrelid = 'public.coaches'::regclass
       and tgname = 'trg_enfoques_requieren_matricula'
       and not tgisinternal
  ) into v_trg;
  insert into _res values ('trigger instalado', case when v_trg then 'sí' else 'FALTA' end, v_trg);

  select count(*) into v_sucias from public.coaches
   where coalesce(array_length(enfoques, 1), 0) > 0 and not coalesce(has_matricula, false);
  insert into _res values ('perfiles con escuela y sin matrícula (esperado 0)', v_sucias::text, v_sucias = 0);
end $$;
select * from _res;
