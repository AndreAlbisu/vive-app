-- exportar-datos-de-usuario.sql — arma la respuesta a un pedido de acceso a datos
-- (Ley 25.326, art. 14; Política §9). SOLO LECTURA. Ver docs/pedido-de-datos.md.
--
-- Uso: reemplazar MAIL_DE_LA_PERSONA (una sola vez, abajo) y correr
--   supabase db query --linked -f scripts/exportar-datos-de-usuario.sql
-- Devuelve una fila con un JSON. Si `perfil` viene null, ese mail no tiene cuenta.
--
-- Qué NO incluye, a propósito:
--   · datos de otras personas (el nombre del cliente en las reservas de un
--     profesional, los mensajes que le escribieron);
--   · las notas PRIVADAS que un profesional escribió sobre la persona (consultar
--     con el abogado antes de entregarlas: son del profesional);
--   · registros internos de Vita (auditoría, evidencia de sanciones).
with objetivo as (
  select id from public.profiles where lower(email) = lower('MAIL_DE_LA_PERSONA')
),
coach as (
  select c.id from public.coaches c join objetivo o on o.id = c.profile_id
),
f as (select
  (select to_jsonb(p) - 'push_token' from public.profiles p join objetivo o on o.id = p.id) as perfil,
  (select jsonb_agg(to_jsonb(x)) from public.user_consents x join objetivo o on o.id = x.user_id) as consentimientos,
  (select jsonb_agg(to_jsonb(x) order by x.created_at) from public.journal_entries x join objetivo o on o.id = x.user_id) as diario,
  (select jsonb_agg(to_jsonb(x) order by x.created_at) from public.gratitude_entries x join objetivo o on o.id = x.user_id) as gratitud,
  (select jsonb_agg(to_jsonb(x) order by x.entry_date) from public.mood_entries x join objetivo o on o.id = x.user_id) as animo,
  (select jsonb_agg(to_jsonb(x)) from public.user_habits x join objetivo o on o.id = x.user_id) as habitos,
  (select jsonb_agg(to_jsonb(x)) from public.user_quiz_answers x join objetivo o on o.id = x.user_id) as cuestionario,
  (select jsonb_agg(to_jsonb(x)) from public.favorite_coaches x join objetivo o on o.id = x.user_id) as favoritos,
  (select jsonb_agg(to_jsonb(x) order by x.created_at) from public.resource_events x join objetivo o on o.id = x.user_id) as recursos_usados,
  (select jsonb_agg(to_jsonb(x)) from public.resource_completions x join objetivo o on o.id = x.user_id) as recursos_completados,
  (select jsonb_agg(to_jsonb(x)) from public.saved_resources x join objetivo o on o.id = x.user_id) as recursos_guardados,
  (select jsonb_agg(to_jsonb(x)) from public.resource_feedback x join objetivo o on o.id = x.user_id) as opiniones_de_recursos,
  (select jsonb_agg(to_jsonb(x) - 'payer_fingerprint' - 'checkout_attempt_id' - 'paid_effects_claim_id' order by x.scheduled_date)
     from public.bookings x join objetivo o on o.id = x.user_id) as reservas_como_cliente,
  -- El contenido de los mensajes está ofuscado: hay que decodificarlo antes de entregarlo (ver el documento).
  (select jsonb_agg(jsonb_build_object('fecha', x.created_at, 'sala', x.sala_id, 'contenido_ofuscado', x.content) order by x.created_at)
     from public.messages x join objetivo o on o.id = x.sender_id) as mensajes_enviados,
  (select jsonb_agg(to_jsonb(x)) from public.reviews x join objetivo o on o.id = x.reviewer_id) as resenas_escritas,
  (select jsonb_agg(to_jsonb(x)) from public.reports x join objetivo o on o.id = x.reporter_id) as reportes_hechos,
  (select jsonb_agg(to_jsonb(x) - 'contexto_tecnico') from public.session_issues x join objetivo o on o.id = x.reporter_id) as problemas_informados,
  (select jsonb_agg(to_jsonb(x) - 'resolved_by') from public.guarantee_claims x join objetivo o on o.id = x.user_id) as garantias,
  (select jsonb_agg(to_jsonb(x)) from public.session_call_feedback x join objetivo o on o.id = x.user_id) as calidad_de_llamadas,
  (select jsonb_agg(jsonb_build_object('fecha', x.created_at, 'contenido', x.content))
     from public.session_notes x join objetivo o on o.id = x.user_id where x.shared) as notas_compartidas_recibidas,
  (select jsonb_agg(jsonb_build_object('fecha', x.created_at, 'tipo', x.type, 'titulo', x.title, 'cuerpo', x.body) order by x.created_at)
     from public.notifications x join objetivo o on o.id = x.recipient_id) as notificaciones,
  (select jsonb_agg(jsonb_build_object('bloqueado', x.blocked_id, 'fecha', x.created_at)) from public.blocked_users x join objetivo o on o.id = x.blocker_id) as bloqueos_hechos,
  (select jsonb_agg(jsonb_build_object('fecha', x.created_at, 'evento', x.event_name, 'datos', x.properties) order by x.created_at)
     from public.analytics_events x join objetivo o on o.id = x.user_id) as eventos_de_uso,
  -- Solo si es profesional
  (select to_jsonb(c) - 'application_notes' from public.coaches c join coach k on k.id = c.id) as perfil_profesional,
  (select jsonb_agg(x.topic) from public.coach_topics x join coach k on k.id = x.coach_id) as temas,
  (select jsonb_agg(to_jsonb(x) - 'file_path') from public.coach_credentials x join coach k on k.id = x.coach_id) as credenciales,
  (select jsonb_agg(to_jsonb(x)) from public.coach_payout_accounts x join coach k on k.id = x.coach_id) as datos_de_cobro,
  (select to_jsonb(x) - 'reviewed_by' from public.identity_verifications x join objetivo o on o.id = x.profile_id) as verificacion_de_identidad,
  (select jsonb_agg(jsonb_build_object('nivel', x.nivel, 'motivo', x.motivo, 'desde', x.created_at, 'hasta', x.hasta, 'levantada', x.revocada_at))
     from public.coach_sanctions x join coach k on k.id = x.coach_id) as medidas_aplicadas,
  (select count(*) from public.bookings x join coach k on k.id = x.coach_id) as cantidad_de_sesiones_como_profesional,
  (select jsonb_agg(jsonb_build_object('fecha', x.created_at, 'compartida', x.shared, 'contenido', x.content))
     from public.session_notes x join objetivo o on o.id = x.coach_id) as notas_que_escribio
)
select jsonb_strip_nulls(to_jsonb(f)) as datos, now() as generado from f;
