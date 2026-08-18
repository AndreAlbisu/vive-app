-- Opt-in internacional del coach + sus datos de cobro
-- ---------------------------------------------------
-- Dos cosas con sensibilidad MUY distinta, y por eso van en lugares distintos:
--
--   1. `coaches.accepts_international` — público a propósito. El usuario del
--      exterior tiene que poder filtrar por esto, igual que filtra por precio o
--      especialidad. No es un dato privado.
--
--   2. Los datos de cobro (CBU / wallet) — tabla aparte, NUNCA en `coaches`.
--      `coaches` se lee con la anon key sin sesión (verificado contra el REST
--      API el 18/08/2026): agregar el CBU ahí lo publicaría a cualquiera que
--      abra la app. Mismo criterio que `coach_mp_accounts`.

-- ── 1. El opt-in ─────────────────────────────────────────────────────────────
alter table public.coaches
  add column if not exists accepts_international boolean not null default false;

-- ⚠️ Sin esto el toggle no funciona: `lock-privileged-columns.sql` hace
-- `revoke update on coaches` y otorga columna por columna. Una columna nueva
-- NO es escribible por el coach hasta que se agrega acá. Falla en silencio
-- desde el cliente (0 filas afectadas, sin error).
grant update (accepts_international) on public.coaches to authenticated;


-- ── 2. Los datos de cobro ────────────────────────────────────────────────────
create table if not exists public.coach_payout_accounts (
  coach_id   uuid primary key references public.coaches(id) on delete cascade,
  method     text not null check (method in ('transferencia', 'usdt')),

  -- transferencia
  cbu        text,
  alias      text,

  -- usdt. La RED es obligatoria y acotada a propósito: una dirección correcta
  -- enviada por la red equivocada pierde los fondos DEFINITIVAMENTE — no
  -- rebota como un CBU mal cargado, no se rastrea y no hay a quién reclamarle.
  wallet     text,
  network    text check (network in ('TRC20', 'ERC20', 'POLYGON')),

  updated_at timestamptz not null default now(),

  -- Coherencia: cada método exige SUS campos. Sin esto se puede guardar
  -- method='usdt' sin wallet y el error recién aparece al ir a pagar.
  constraint payout_transferencia_completa check (
    method <> 'transferencia' or cbu is not null
  ),
  constraint payout_usdt_completa check (
    method <> 'usdt' or (wallet is not null and network is not null)
  ),

  -- Formato. Es la única barrera automática contra un copiado mal hecho, y en
  -- cripto un error acá no se puede deshacer.
  --   CBU: 22 dígitos exactos.
  --   TRC20: empieza con T, 34 caracteres base58.
  --   ERC20 / POLYGON: 0x + 40 hexadecimales.
  constraint payout_cbu_formato check (
    cbu is null or cbu ~ '^[0-9]{22}$'
  ),
  constraint payout_wallet_formato check (
    wallet is null
    or (network = 'TRC20'   and wallet ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$')
    or (network in ('ERC20','POLYGON') and wallet ~ '^0x[0-9a-fA-F]{40}$')
  )
);

alter table public.coach_payout_accounts enable row level security;

-- El coach ve y edita SOLO lo suyo. `coaches.profile_id` es `profiles.id`,
-- que es el auth.uid() — no confundir con `coaches.id` (regla crítica del
-- proyecto: son dos ids distintos con nombres parecidos).
drop policy if exists coach_payout_own on public.coach_payout_accounts;
create policy coach_payout_own on public.coach_payout_accounts
  for all
  to authenticated
  using      (coach_id in (select id from public.coaches where profile_id = auth.uid()))
  with check (coach_id in (select id from public.coaches where profile_id = auth.uid()));

-- El admin LEE (necesita el CBU para transferir) pero NO escribe: nadie edita
-- el dato de cobro de otro, ni siquiera el equipo. Mismo criterio que el resto
-- del panel, donde las escrituras pasan por `admin-actions`.
drop policy if exists coach_payout_select_admin on public.coach_payout_accounts;
create policy coach_payout_select_admin on public.coach_payout_accounts
  for select
  to authenticated
  using (public.is_admin());

-- anon no toca nada, ni por accidente.
revoke all on public.coach_payout_accounts from anon;

create or replace function public.touch_coach_payout_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_touch_coach_payout on public.coach_payout_accounts;
create trigger trg_touch_coach_payout
  before update on public.coach_payout_accounts
  for each row execute function public.touch_coach_payout_updated_at();


-- ── Verificación ─────────────────────────────────────────────────────────────
-- select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--  where table_name = 'coaches' and column_name = 'accepts_international';
--
-- select policyname, cmd from pg_policies
--  where tablename = 'coach_payout_accounts';
--
-- Debe FALLAR con `violates check constraint "payout_wallet_formato"`:
-- una direccion de Ethereum declarada como red Tron.
--
-- ⚠️ El coach_id sale de una subquery y NO de un uuid inventado: con un id
-- inexistente el insert falla por la FOREIGN KEY, no por la validacion, y el
-- error se leeria como que el CHECK funciona cuando en realidad no se probo.
-- El rollback deja todo como estaba pase lo que pase.
--
-- begin;
-- insert into public.coach_payout_accounts (coach_id, method, wallet, network)
-- select id, 'usdt', '0xdAC17F958D2ee523a2206206994597C13D831ec7', 'TRC20'
--   from public.coaches limit 1;
-- rollback;
