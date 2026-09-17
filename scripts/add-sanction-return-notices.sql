-- add-sanction-return-notices.sql
--
-- Avisarle a la gente cuando su profesional vuelve.
--
-- ✅ CORRIDO y VERIFICADO el 17/09/2026 desde el CLI, en el orden de abajo. Cron
--    `sanction-returns` programado (jobid 12). Probado disparando el MISMO comando
--    del cron contra tres casos reales, y verificado por la respuesta: una
--    suspensión que terminó hace una hora → avisada; una que terminó hace 20
--    días → omitida_vieja; una vigente → sigue esperando. Segunda corrida: no
--    duplica. Levantar la vigente y correr de nuevo → avisada. Todo borrado
--    después (0 sanciones, 0 avisos, 0 notificaciones, 0 coaches con fecha).
--
-- Tiene DOS partes y el orden importa:
--   1) la tabla — antes de deployar `admin-actions`, que ya escribe en ella;
--   2) el cron — DESPUÉS de deployar `sanction-returns`, o cada hora llama a una
--      función que no existe.
--
-- ── Por qué ──────────────────────────────────────────────────────────────────
--
-- Al suspender o dar de baja a un profesional, `admin-actions` le avisa a quien
-- atendía con él que "no está tomando reservas nuevas" (sin mencionar la
-- sanción). Pero una suspensión vence sola, por fecha, y eso no disparaba nada:
-- la persona se quedaba con la última noticia, que era que ya no estaba. Pedido
-- de Andre, 17/09/2026.
--
-- ── Cómo ─────────────────────────────────────────────────────────────────────
--
-- · Esta tabla anota a quién se avisó y por qué sanción. Sin eso no hay forma de
--   saber a quién decirle después que volvió: la notificación sola no guarda a
--   qué sanción corresponde.
-- · `sanction-returns` corre cada hora y busca avisos cuya sanción ya dejó de
--   pesar —venció o se levantó— de un profesional que no tenga OTRA vigente. A
--   esas personas les manda "volvió a atender en Vita", una sola vez.
-- · `vuelta_resultado` deja constancia también de lo que NO se mandó y por qué:
--   si el profesional ya no está publicado, o si la sanción terminó hace tanto
--   que el aviso llegaría descolgado (el cron estuvo caído, por ejemplo).

begin;

create table if not exists public.sanction_client_notices (
  id                  uuid primary key default gen_random_uuid(),
  sancion_id          uuid not null references public.coach_sanctions(id) on delete cascade,
  user_id             uuid not null references public.profiles(id) on delete cascade,
  avisado_at          timestamptz not null default now(),
  vuelta_avisada_at   timestamptz,
  vuelta_resultado    text check (vuelta_resultado in ('avisada', 'omitida_vieja', 'omitida_no_publicado')),
  -- Una persona, un aviso por sanción. Es también la guarda contra un doble
  -- click en "Aplicar" que dispare la acción dos veces.
  unique (sancion_id, user_id),
  constraint sanction_client_notices_resultado_coherente check (
    (vuelta_avisada_at is null) = (vuelta_resultado is null)
  )
);

-- La consulta del cron: los que todavía esperan el aviso de vuelta.
create index if not exists sanction_client_notices_pendientes_idx
  on public.sanction_client_notices (sancion_id)
  where vuelta_avisada_at is null;

alter table public.sanction_client_notices enable row level security;
revoke all on public.sanction_client_notices from anon, authenticated;

-- El aviso de vuelta tiene su propio tipo: "no disponible" y "volvió" se leen
-- distinto en la campana y conviene poder contarlos por separado.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'reserva_nueva', 'reserva_confirmada', 'reserva_rechazada', 'reserva_cancelada',
    'recordatorio_sesion', 'invitacion_review', 'recurso_feedback_umbral',
    'propuesta_publicada', 'propuesta_ajustes', 'postulacion_aprobada', 'postulacion_rechazada',
    'credencial_verificada', 'credencial_rechazada', 'recurso_publicado', 'recurso_rechazado',
    'sancion_aplicada', 'sancion_levantada', 'profesional_no_disponible', 'profesional_disponible'
  ));

commit;

notify pgrst, 'reload schema';

-- ═══ PARTE 2 — correr DESPUÉS de deployar `sanction-returns` ═════════════════

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'service_role_key') then
    raise exception 'Falta el secret service_role_key en el Vault.';
  end if;
  if (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
     like '%PEGAR_SERVICE_ROLE_KEY%' then
    raise exception 'El secret service_role_key tiene el placeholder sin reemplazar.';
  end if;
end $$;

-- Cada hora, a los 41 minutos: no hace falta más fino que eso para un "volvió",
-- y así no se pisa con los crons de minuto 0 y 17.
select cron.schedule(
  'sanction-returns',
  '41 * * * *',
  $$
  select net.http_post(
    url     := 'https://ggygiihhnkjrerpinhha.supabase.co/functions/v1/sanction-returns',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'
      )
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- ── VERIFICACIÓN ─────────────────────────────────────────────────────────────
-- 1) La tabla, sin grants para clientes. Esperado: 0 filas.
--   select grantee from information_schema.role_table_grants
--    where table_name = 'sanction_client_notices' and grantee in ('anon','authenticated');
-- 2) 🔴 Verificar el cron por la RESPUESTA, no por `active = true` (la lección de
--    julio: el job del placeholder figuraba activo mientras daba 401):
--   select status_code, content from net._http_response order by created desc limit 3;
