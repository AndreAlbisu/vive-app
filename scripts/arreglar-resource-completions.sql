-- arreglar-resource-completions.sql
--
-- 🔴 **`resource_completions` NUNCA guardó una sola fila.** Tiene RLS activada y
--    **cero policies**, así que tanto el INSERT como el SELECT del cliente se
--    deniegan. Verificado contra producción: `select count(*)` = **0**, con la
--    app en uso desde junio.
--
--    Y falla en silencio: `lib/resourceCompletions.ts` hace
--    `await supabase.from('resource_completions').insert({...})` **sin mirar el
--    error**. Nadie se enteró nunca.
--
-- ── Qué estaba muerto por esto ───────────────────────────────────────────────
--
-- Es la tabla donde se anota que alguien terminó una práctica. La escriben ocho
-- pantallas (Respiración, Meditación, Escáner, Anclaje, Sueño, Lecturas, Ruido y
-- el genérico de recursos) y de ella se deriva, según `lib/habits.ts`, el
-- "hecho hoy" de los hábitos. O sea: **la racha, el progreso y la tarjeta de
-- continuar una práctica a medias no funcionaron nunca**.
--
-- 📌 Es el tercer bug de esta familia en dos días, y todos se ven igual: algo
--    que falla en silencio porque nadie mira el error. Los otros dos fueron el
--    recordatorio "tu sesión es mañana" (`to_char` sobre texto) y la
--    cancelación de los competidores del horario (RLS que no deja tocar
--    reservas ajenas). **Un `await` sin `if (error)` es un bug esperando.**
--
-- ── Las policies ─────────────────────────────────────────────────────────────
--
-- Lo mismo que cualquier dato personal: cada quien ve y escribe lo suyo.

create policy resource_completions_select_own on public.resource_completions
  for select to authenticated using (user_id = auth.uid());

create policy resource_completions_insert_own on public.resource_completions
  for insert to authenticated with check (user_id = auth.uid());

-- El progreso de una práctica a medias se pisa a medida que avanza.
create policy resource_completions_update_own on public.resource_completions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Mismo criterio que el resto: `anon` no escribe nada. Sin cuenta no hay
-- progreso personal que anotar (la fila necesita `user_id`).
revoke insert, update, delete on public.resource_completions from anon;
