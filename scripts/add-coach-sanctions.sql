-- add-coach-sanctions.sql
--
-- La escalera de sanciones al profesional: advertencia → suspensión → baja.
--
-- ✅ CORRIDO y VERIFICADO el 16/09/2026, desde el CLI (`supabase db query --linked`).
--    Prueba en vivo sobre un coach real, sin dejar rastro: la suspensión llena el
--    espejo sola, una reserva nueva rebota con `coach_suspendido`, la baja queda
--    como 'infinity', levantarla (sin borrar) libera al coach, el CHECK rechaza una
--    suspensión sin fecha y un motivo corto, y `notifications` acepta
--    `sancion_aplicada`. Al final: 0 sanciones, 0 reservas de prueba, 0 coaches
--    suspendidos, 0 avisos.
--
-- ── Por qué ──────────────────────────────────────────────────────────────────
--
-- 🔴 **La app ya promete esto y abajo no hay nada.** `CoachComoFuncionaScreen` le
-- dice al coach que llevarse a alguien afuera "puede terminar en advertencia,
-- suspensión o baja de la cuenta", y T&C §10.2 lo obliga por contrato. Pero lo
-- único que existía para cumplirlo era sacarle `verified` a mano: un interruptor
-- binario que lo borra del catálogo entero, sin motivo guardado, sin registro de
-- que pasó, y sin escalón intermedio. O nada, o el más grande de los tres.
--
-- Decisión de Andre (16/09/2026): **escalera MANUAL con evidencia**. La aplica un
-- admin mirando un caso, nunca un algoritmo. El motivo está en
-- `scripts/diagnostico-fuga.sql` y sigue vigente: hoy hay UN coach con muestra
-- suficiente y la métrica disponible baja por cuatro causas distintas, así que
-- sancionar automáticamente le pegaría a tres inocentes por cada culpable.
-- Esta tabla no cambia eso — al contrario, le da a la decisión humana un lugar
-- donde quedar escrita.
--
-- ── Los tres escalones ───────────────────────────────────────────────────────
--
-- · `advertencia` — NO afecta la visibilidad ni el cobro. Queda registrada y
--   **el coach la ve en su app, con el motivo**. Es el escalón que faltaba.
-- · `suspension` — sale del catálogo y **no puede recibir reservas nuevas**,
--   hasta `hasta`. Decisión de Andre: **las sesiones ya agendadas se respetan**
--   y el chat sigue vivo. Cancelarlas castigaría a clientes que no hicieron nada
--   y cada reembolso saldría de la caja de VIVE.
-- · `baja` — lo mismo pero sin vencimiento (`hasta = 'infinity'`).
--
-- ── Transparencia, que es la mitad del diseño ────────────────────────────────
--
-- 🔴 Una sanción que el sancionado no ve es lo que hace que una plataforma se
-- vuelva odiada: el coach nota que dejó de entrar gente y no sabe por qué, así
-- que asume lo peor y no puede corregir nada. Por eso el RLS le deja LEER sus
-- propias sanciones con el motivo escrito, y por eso `motivo` es NOT NULL: si no
-- hay algo que se le pueda mostrar a la persona, no hay sanción.
--
-- ⚠️ `evidencia` es aparte y **puede quedar en null**: es para el admin (ids de
-- reservas, capturas, lo que sea) y hoy se le muestra al coach junto al motivo.
-- No escribas ahí nada que no le dirías en la cara.

begin;

create table if not exists public.coach_sanctions (
  id           uuid primary key default gen_random_uuid(),
  coach_id     uuid not null references public.coaches(id) on delete cascade,
  nivel        text not null check (nivel in ('advertencia', 'suspension', 'baja')),
  motivo       text not null check (length(btrim(motivo)) >= 10),
  evidencia    text,
  -- Cuándo deja de pesar. Null para `advertencia` (no vence porque no restringe
  -- nada), fecha para `suspension`, 'infinity' para `baja`.
  hasta        timestamptz,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  -- Levantarla no borra la fila: deja constancia de que se levantó y por qué.
  revocada_at  timestamptz,
  revocada_por uuid references public.profiles(id) on delete set null,
  revocada_motivo text,

  -- Una suspensión sin fecha sería una baja encubierta; una advertencia con
  -- fecha sugiere una restricción que no existe. El CHECK cierra los dos.
  constraint coach_sanctions_hasta_coherente check (
    (nivel = 'advertencia' and hasta is null)
    or (nivel = 'suspension' and hasta is not null)
    or (nivel = 'baja'       and hasta is not null)
  )
);

create index if not exists coach_sanctions_coach_idx
  on public.coach_sanctions (coach_id, created_at desc);

-- La consulta del trigger: sanciones vigentes que restringen.
create index if not exists coach_sanctions_vigentes_idx
  on public.coach_sanctions (coach_id, hasta)
  where revocada_at is null and nivel <> 'advertencia';

alter table public.coach_sanctions enable row level security;

-- 🔴 El coach LEE las suyas — es la transparencia, no una concesión.
drop policy if exists coach_sanctions_select_own on public.coach_sanctions;
create policy coach_sanctions_select_own on public.coach_sanctions
  for select to authenticated
  using (coach_id in (select id from public.coaches where profile_id = auth.uid()));

-- Sin políticas de INSERT/UPDATE/DELETE a propósito: las escribe SOLO el service
-- role desde `admin-actions`. Un coach no se sanciona ni se perdona a sí mismo.


-- ─────────────────────────────────────────────────────────────────────────────
-- El espejo en `coaches`, que es lo que leen el catálogo y el trigger de reservas.
--
-- Se deriva por trigger y NO se puede escribir desde el cliente. Regla espejo,
-- mismo patrón que `accepts_international` — y con la lección de aquella vez
-- presente: la función resuelve el coach desde la fila de `coach_sanctions`, que
-- es la única tabla a la que este trigger cuelga, sin `coalesce` de campos que
-- no existen en el registro (eso fue lo que rompió `sync_accepts_international`).

alter table public.coaches add column if not exists suspendido_hasta timestamptz;

comment on column public.coaches.suspendido_hasta is
  'Derivada de coach_sanctions por trigger. NULL = sin restricción. Futuro = suspendido. infinity = baja. No la escribe el cliente.';

create or replace function public.sync_coach_suspension()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  afectado uuid;
begin
  afectado := coalesce(new.coach_id, old.coach_id);

  update public.coaches c
     set suspendido_hasta = (
       select max(s.hasta)
         from public.coach_sanctions s
        where s.coach_id = afectado
          and s.revocada_at is null
          and s.nivel <> 'advertencia'
          and s.hasta > now()
     )
   where c.id = afectado;

  return null;  -- AFTER trigger: el valor de retorno no se usa
end;
$$;

drop trigger if exists trg_sync_coach_suspension on public.coach_sanctions;
create trigger trg_sync_coach_suspension
  after insert or update or delete on public.coach_sanctions
  for each row execute function public.sync_coach_suspension();

-- 🔴 El coach no puede levantarse la suspensión solo. `coaches` SÍ tiene update
-- para el dueño (así edita su perfil), así que sin este revoke la columna sería
-- editable desde el cliente como cualquier otra.
revoke update (suspendido_hasta) on public.coaches from authenticated;
revoke update (suspendido_hasta) on public.coaches from anon;


-- ─────────────────────────────────────────────────────────────────────────────
-- Enforcement: no entran reservas NUEVAS contra un coach suspendido.
--
-- BEFORE INSERT y no una policy, por el mismo motivo que el bloqueo entre
-- usuarios: las policies de `bookings` se crearon a mano en el panel y no están
-- versionadas, así que reescribirlas desde acá es reescribir algo que no podemos
-- leer. Un trigger es aditivo y aplica venga de donde venga el insert — la app,
-- `web-book` con service role, o SQL a mano.
--
-- ⚠️ Solo INSERT. Las reservas que ya existen siguen su curso, se atienden y se
-- cobran: es la decisión de Andre y además es lo correcto con quien ya pagó.

create or replace function public.tg_block_bookings_coach_suspendido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hasta timestamptz;
begin
  select c.suspendido_hasta into hasta
    from public.coaches c
   where c.id = new.coach_id;   -- ⚠️ bookings.coach_id ES coaches.id (regla 1 de SCHEMA.md)

  if hasta is not null and hasta > now() then
    raise exception 'coach_suspendido: este profesional no está recibiendo reservas'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_block_bookings_coach_suspendido on public.bookings;
create trigger trg_block_bookings_coach_suspendido
  before insert on public.bookings
  for each row execute function public.tg_block_bookings_coach_suspendido();

-- ─────────────────────────────────────────────────────────────────────────────
-- El aviso al coach — `notifications.type`.
--
-- 🔴 Acá se rompe, a conciencia, la "regla no punitiva" que este proyecto aplicó
-- para el descarte de una propuesta de recurso (`add-notifications-propuesta-types.sql`).
-- El criterio de aquella vez era que una push de descarte no es accionable y por
-- eso solo hiere. Una sanción es lo contrario: trae el motivo, dice qué escalón
-- es, y lo que se espera es que cambie una conducta. Además **el coach tiene que
-- enterarse por nosotros y no por notar que dejó de entrar gente** — es el mismo
-- criterio de `postulacion_rechazada`, que también avisa algo malo.
--
-- La lista repite TODOS los valores vigentes (última fuente:
-- `add-resource-status-notification.sql`) porque el CHECK se reemplaza entero.

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'reserva_nueva',
    'reserva_confirmada',
    'reserva_rechazada',
    'reserva_cancelada',
    'recordatorio_sesion',
    'invitacion_review',
    'recurso_feedback_umbral',
    'propuesta_publicada',
    'propuesta_ajustes',
    'postulacion_aprobada',
    'postulacion_rechazada',
    'credencial_verificada',
    'credencial_rechazada',
    'recurso_publicado',
    'recurso_rechazado',
    'sancion_aplicada',
    'sancion_levantada'
  ));

commit;

notify pgrst, 'reload schema';

-- ── VERIFICACIÓN ─────────────────────────────────────────────────────────────

-- 1) La tabla y la columna existen.
select table_name, column_name from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'coach_sanctions' and column_name in ('nivel','motivo','hasta','revocada_at'))
    or (table_name = 'coaches' and column_name = 'suspendido_hasta'))
order by table_name, column_name;

-- 2) 🔴 El coach NO puede escribir su propia suspensión. Esperado: 0 filas.
--
--    ⚠️ Solo `authenticated`, y no es un descuido. `anon` tiene UPDATE a nivel de
--    TABLA sobre `coaches` (default privileges de Supabase), y un revoke de
--    columna no parte un permiso de tabla — así que `anon` aparece siempre acá,
--    con este script o sin él. **No habilita nada**: la única policy de UPDATE es
--    `coaches_update_own`, `TO authenticated` y con `profile_id = auth.uid()`, así
--    que el RLS rebota todo update de `anon`. Visto el 16/09/2026. Si algún día
--    alguien crea una policy de UPDATE para `public`, esto deja de ser inofensivo.
select grantee, column_name from information_schema.column_privileges
where table_schema = 'public' and table_name = 'coaches'
  and column_name = 'suspendido_hasta' and privilege_type = 'UPDATE'
  and grantee = 'authenticated';

-- 3) 🔴 Nadie puede insertarse una sanción desde el cliente. Esperado: solo la
--    policy de SELECT.
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'coach_sanctions';

-- 4) Prueba en vivo sobre un coach de prueba (correr suelto, y REVERTIR).
--    Poné el id en las tres y mirá que la reserva rebote:
-- insert into public.coach_sanctions (coach_id, nivel, motivo, hasta)
--   values ('<COACH_ID>', 'suspension', 'prueba de la escalera, borrar', now() + interval '1 day');
-- select id, suspendido_hasta from public.coaches where id = '<COACH_ID>';   -- debe tener fecha
-- -- un insert de booking contra ese coach debe fallar con 'coach_suspendido'
-- delete from public.coach_sanctions where motivo = 'prueba de la escalera, borrar';
-- select id, suspendido_hasta from public.coaches where id = '<COACH_ID>';   -- vuelve a null

-- 5) El estado de la escalera, que es lo que va a mirar el panel:
select c.id, p.name,
       s.nivel, s.motivo, s.hasta, s.created_at, s.revocada_at
from public.coach_sanctions s
join public.coaches c on c.id = s.coach_id
join public.profiles p on p.id = c.profile_id
order by s.created_at desc;
