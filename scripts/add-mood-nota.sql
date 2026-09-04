-- add-mood-nota.sql
--
-- `mood_entries.nota` — lo que la persona escribe sobre ese día.
--
-- ⚠️ PENDIENTE DE CORRER al 04/09/2026.
--
-- ── Por qué existe ───────────────────────────────────────────────────────────
-- Es la pieza que le da sentido al paquete para la sesión
-- (`docs/paquete-para-la-sesion.md` §4), y el doc lo dice sin vueltas:
--
--   🔴 "Un check-in solo es un número del 1 al 5 con una fecha. Mandarle al
--   profesional «12 de agosto: bajón» es el mismo problema de informativo e
--   inútil, movido de lugar."
--
-- Mónica no asocia el registro con nada: asocia *"eso que sintió con lo que
-- estaba sucediendo"* — y eso no está en el check-in. El paquete vale por el
-- apareamiento, no por la lista.
--
-- ── Por qué columna y no tabla ───────────────────────────────────────────────
-- Es 1:1 con el día, y `mood_entries` ya tiene `UNIQUE(user_id, entry_date)`.
-- Como columna hereda gratis la RLS own-only, el borrado en la baja de cuenta y
-- el gate de consentimiento. Y sobre todo: **fuerza el apareamiento por
-- construcción** — no se puede escribir una nota sobre un día que no registraste,
-- que es justo lo que le daría sentido.
--
-- ── 🔴 Y por qué NO es el diario ─────────────────────────────────────────────
-- Esta nota y una entrada de diario pueden decir lo mismo y no son lo mismo:
-- **la nota se escribe sabiendo que se va a compartir; el diario se escribió
-- para uno.** Un texto cambia de naturaleza según para quién fue escrito.
--
-- Por eso el paquete arranca con esto y no con el diario, y por eso puede que el
-- diario no haga falta nunca. `paquete-para-la-sesion.md` §9 ya lo pone último.

alter table public.mood_entries
  add column if not exists nota text;

comment on column public.mood_entries.nota is
  'Lo que la persona escribió sobre ese día, para aparearlo con el número en el paquete de la sesión. Se escribe SABIENDO que se va a compartir — no es el diario. Opcional.';

-- Tope de largo: es una nota de un día, no una entrada de diario. El límite es
-- también una señal de para qué es — un campo sin tope invita a escribir ahí lo
-- que va en el diario, y entonces sí estaríamos moviendo lo íntimo de lugar.
alter table public.mood_entries
  drop constraint if exists mood_entries_nota_largo;
alter table public.mood_entries
  add constraint mood_entries_nota_largo check (nota is null or char_length(nota) <= 280);

-- ⚠️ Sin RLS nueva ni grants: `mood_entries` ya tiene sus policies own-only y
-- `authenticated` ya tiene INSERT/UPDATE sobre la tabla (verificado el
-- 03/09/2026 en el barrido de TRUNCATE). La columna nace escribible por su
-- dueño, que es lo correcto acá — a diferencia de `has_matricula`, esto lo
-- escribe la persona sobre sí misma.


-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación después de correr (pegar en el SQL editor, DE A UNA):
--
--   -- 1) la columna existe y es opcional
--   select column_name, data_type, is_nullable
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'mood_entries'
--     and column_name = 'nota';
--   -- esperado: text, YES
--
--   -- 2) el tope está
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.mood_entries'::regclass and conname = 'mood_entries_nota_largo';
--   -- esperado: 1 fila, CHECK (nota IS NULL OR char_length(nota) <= 280)
--
--   -- 3) 🔴 el check-in NO pisa la nota. Es el riesgo real de esta columna:
--   --    `MoodCheckIn` hace upsert on conflict SIN mandar `nota`, y si eso la
--   --    borrara, la persona perdería lo que escribió al cambiar su mood.
--   --    Se prueba a mano con una fila propia:
--   --
--   --    update public.mood_entries set nota = 'prueba' where id = '<UUID de una fila tuya>';
--   --    -- después, desde la app, cambiar el mood de ESE día, y volver a leer:
--   --    select mood_id, nota from public.mood_entries where id = '<mismo UUID>';
--   --    -- esperado: mood_id cambiado, nota = 'prueba' intacta.
--   --    -- Si la nota quedó en NULL, hay que sacar `nota` del upsert del cliente.
