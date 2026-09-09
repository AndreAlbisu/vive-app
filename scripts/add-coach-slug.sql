-- add-coach-slug.sql
--
-- `coaches.slug` — el identificador del profesional en una URL pública.
-- `vitaapp.com.ar/c/sofia-herrera`.
--
-- ✅ CORRIDO el 08/09/2026, y VERIFICADO desde afuera con la anon key:
--   · **34 coaches, 34 con slug, 34 distintos** — el backfill no dejó ninguno
--     afuera ni repitió;
--   · los acentos salieron bien (`Andrés Maldonado` → `andres-maldonado`,
--     `Carla Benítez` → `carla-benitez`, `Joaquín Silva` → `joaquin-silva`), o
--     sea que el `translate` alcanzó y no hizo falta `unaccent`;
--   · **la consulta REAL de la página pública anda sin sesión**: buscar por
--     `slug=eq.joaquin-silva` devuelve el coach con su perfil embebido
--     (`profiles!inner(name, avatar_url, gender)`), que son justo las columnas
--     que `anon` puede leer después de `restrict-anon-profiles-columns.sql`.
--     El camino entero, de la URL al dato, está probado.
--
-- 📝 Un caso a tener en cuenta y que no es un error: hay un coach cuyo nombre es
-- una sola palabra en minúscula ("andre"), y su slug quedó `andre`. Anda, pero
-- los slugs de una palabra chocan más fácil y se identifican peor. Si algún día
-- se ofrece slug personalizado, ese es el primer caso a mirar.
--
-- ── Por qué ahora, antes de decidir la forma del link ────────────────────────
--
-- La decisión de qué hace el link cuando alguien lo toca —reservar y cobrar en
-- web, o mandar a la store— sigue abierta (`docs/camino-del-cliente-1.md` §4).
-- Pero **las dos opciones necesitan lo mismo**: una URL estable que identifique
-- a un profesional, y algo que la renderice públicamente. Esto es la
-- intersección, así que no se tira trabajo con ninguna de las dos.
--
-- ── Tres decisiones que están adentro del código ─────────────────────────────
--
-- 1. 🔴 **El slug NO se actualiza cuando el coach cambia de nombre.** Se calcula
--    una sola vez, al crear la fila, y queda. Un link ya compartido por WhatsApp
--    tiene que seguir funcionando el mes que viene: si el slug siguiera al
--    nombre, cada corrección de tipeo rompería todos los links repartidos. Por
--    eso el trigger es `before insert` y no `before insert or update`.
--
-- 2. 🔴 **El coach no lo puede escribir**, y no hizo falta hacer nada para eso:
--    `lock-privileged-columns.sql` dejó `coaches` con `revoke update` y grants
--    columna por columna, así que **toda columna nueva nace de solo lectura**.
--    Está bien que sea así — un slug editable es una invitación a hacerse pasar
--    por otro (`dra-martinez`) o a ocupar nombres de otros. El día que se quiera
--    dar slug personalizado, es un pedido moderado, no un `update` libre.
--
-- 3. **Se lee público, y eso sí es automático**: `anon` tiene SELECT a nivel
--    tabla sobre `coaches`, así que la columna nueva queda legible sin tocar
--    nada. Es lo que se quiere: la página pública busca por slug sin sesión.
--    ⚠️ Ojo con la asimetría — en `profiles` el SELECT de `anon` ahora es por
--    columnas (`restrict-anon-profiles-columns.sql`) y en `coaches` es por
--    tabla. Si algún día `coaches` gana una columna sensible, no queda cerrada
--    sola.
--
-- 📌 **La ruta lleva prefijo (`/c/<slug>`) a propósito.** Sin él, un slug como
-- `terminos` o `privacidad` chocaría con las páginas que ya viven en
-- `vitaapp.com.ar` (ver `docs/hosting.md`), y no hay lista de palabras
-- reservadas que envejezca bien. Con prefijo, el problema no existe.

begin;

-- ── slugify ──────────────────────────────────────────────────────────────────
-- Sin `unaccent`: esa extensión puede no estar instalada y no vale la pena
-- pedirla para esto. `translate` cubre el español, que es lo que hay.
create or replace function public.slugify(p_texto text)
returns text
language sql
immutable
as $$
  select nullif(
    trim(both '-' from
      regexp_replace(
        regexp_replace(
          lower(translate(
            coalesce(p_texto, ''),
            'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
            'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
          )),
          '[^a-z0-9]+', '-', 'g'
        ),
        '-{2,}', '-', 'g'
      )
    ),
    ''
  );
$$;

alter table public.coaches add column if not exists slug text;

-- ── Backfill ─────────────────────────────────────────────────────────────────
-- Dos coaches que se llamen igual no pueden compartir slug: al segundo y
-- siguientes se les agrega el número. El `order by id` lo hace determinístico
-- para que dos corridas den lo mismo.
with base as (
  select c.id,
         coalesce(public.slugify(p.name), 'profesional') as s
  from public.coaches c
  left join public.profiles p on p.id = c.profile_id
  where c.slug is null
),
numerado as (
  select id, s, row_number() over (partition by s order by id) as n
  from base
)
update public.coaches c
set slug = case when x.n = 1 then x.s else x.s || '-' || x.n end
from numerado x
where c.id = x.id;

create unique index if not exists coaches_slug_uniq on public.coaches (slug);

alter table public.coaches alter column slug set not null;

-- ── El slug de las filas nuevas ──────────────────────────────────────────────
-- `security definer` porque tiene que leer `profiles.name`, y quien inserta un
-- coach puede no poder leer esa fila. `search_path` fijo por lo de siempre.
create or replace function public.coaches_set_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base      text;
  candidato text;
  n         int := 1;
begin
  if new.slug is not null and new.slug <> '' then
    return new;
  end if;

  select public.slugify(p.name) into base
  from profiles p
  where p.id = new.profile_id;

  -- Un coach sin nombre todavía no debería existir, pero si existe se le da
  -- algo usable en vez de abortar el alta: el slug no vale una fila perdida.
  base      := coalesce(base, 'profesional');
  candidato := base;

  while exists (select 1 from coaches c where c.slug = candidato) loop
    n := n + 1;
    candidato := base || '-' || n;
  end loop;

  new.slug := candidato;
  return new;
end;
$$;

drop trigger if exists trg_coaches_set_slug on public.coaches;

-- ⚠️ Solo `before insert`. Ver la decisión 1 arriba: el slug no sigue al nombre.
create trigger trg_coaches_set_slug
before insert on public.coaches
for each row
execute function public.coaches_set_slug();

commit;

-- ── VERIFICACIÓN ─────────────────────────────────────────────────────────────

-- 1) Todos tienen slug, todos distintos. Esperado: las tres columnas iguales.
select count(*) as coaches, count(slug) as con_slug, count(distinct slug) as distintos
from public.coaches;

-- 2) Cómo quedaron. Ojo acá con nombres raros o vacíos.
select c.slug, p.name
from public.coaches c
left join public.profiles p on p.id = c.profile_id
order by c.slug
limit 20;

-- 3) 🔴 El coach NO puede escribirlo. Esperado: 0 filas.
--    Si aparece algo, `lock-privileged-columns.sql` dejó de cubrir la tabla y
--    hay que revisarlo entero, no solo esta columna.
select column_name
from information_schema.column_privileges
where grantee = 'authenticated'
  and table_schema = 'public'
  and table_name = 'coaches'
  and privilege_type = 'UPDATE'
  and column_name = 'slug';

-- 4) Pero sí se lee sin sesión, que es para lo que existe. Esperado: 1 fila.
select column_name
from information_schema.column_privileges
where grantee = 'anon'
  and table_schema = 'public'
  and table_name = 'coaches'
  and privilege_type = 'SELECT'
  and column_name = 'slug';

-- 5) El trigger quedó solo en INSERT. Esperado: 1 fila, `tgtype` de before-insert.
select tgname, tgtype
from pg_trigger
where tgrelid = 'public.coaches'::regclass
  and tgname = 'trg_coaches_set_slug';
