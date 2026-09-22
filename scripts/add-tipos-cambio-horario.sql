-- add-tipos-cambio-horario.sql — dos tipos de aviso propios para M15 y M16.
--
-- 🔴 **Corrige un error del mismo día.** Los avisos de reagendado se escribieron
--    reutilizando los tipos que ya existían (`reserva_nueva` y
--    `reserva_cancelada`) "para no tocar el CHECK". Parecía prolijo y estaba mal:
--    `mail-notificaciones` le cuelga a cada tipo un PIE fijo, y esos pies
--    mentían.
--
--      · `reserva_nueva` agrega *"Si no la respondés en 24 horas, se cancela
--        sola"*. Un pedido de cambio de horario **no** se cancela solo, y ese
--        mismo pie le llegaba también al CLIENTE cuando el profesional le
--        proponía horarios, donde no significa nada.
--      · `reserva_cancelada` agrega *"Si habías pagado, te devolvemos todo
--        automáticamente"*. Ese aviso se usaba para decirle a alguien que su
--        cambio fue rechazado y **su sesión sigue en pie**: le prometía una
--        devolución que no iba a llegar nunca.
--
-- 📌 La lección, para la próxima: el tipo de una notificación no es una
--    etiqueta, es una promesa. El texto del cuerpo lo escribe quien la crea,
--    pero el pie lo pone el tipo.

alter table public.notifications drop constraint if exists notifications_type_check;

alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'reserva_nueva', 'reserva_confirmada', 'reserva_rechazada', 'reserva_cancelada',
  'recordatorio_sesion', 'invitacion_review', 'recurso_feedback_umbral',
  'propuesta_publicada', 'propuesta_ajustes', 'postulacion_aprobada',
  'postulacion_rechazada', 'credencial_verificada', 'credencial_rechazada',
  'recurso_publicado', 'recurso_rechazado', 'sancion_aplicada', 'sancion_levantada',
  'profesional_no_disponible', 'profesional_disponible', 'profesional_con_horarios',
  -- Nuevos (21/09/2026): el reagendado tiene sus propios avisos.
  'cambio_pedido',    -- alguien pide o propone mover una sesión
  'cambio_resuelto'   -- se movió, o no se pudo mover
]));
