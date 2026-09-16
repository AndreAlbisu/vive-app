-- limpiar-datos-de-prueba.sql
--
-- Borra las cuentas de prueba, las reseñas sembradas y el contenido sembrado,
-- para que la base no salga a producción con material inventado adentro.
--
-- ⚠️ ESTO BORRA FILAS Y NO SE PUEDE DESHACER. Antes de correrlo:
--    1. Backup de la base (Supabase → Database → Backups, o pg_dump).
--    2. Editar la lista de CONSERVAR de abajo. Lo que no esté ahí, se va.
--    3. Correr el bloque de CONTROL PREVIO solo, leer los números, y recién
--       ahí correr el resto.
--
-- ── Qué se ve el 16/09/2026 DESDE LA APP (consultado con la anon key) ─────────
--
--   coaches                34   ← los 34 con verified=true y application_status='aprobada'
--   coach_availability   2278
--   coach_topics          117
--   coach_weekly_pattern    8
--   coach_resources         8   ← los 8 son [SEED], los 8 'published'
--   reviews                25   ← 24 son cuatro frases repetidas, del 07/08/2026
--   resources               3   ← tabla vieja; una se titula "alto tema"
--
-- 🔴 LOS CEROS ERAN MENTIRA, y el 16/09 se confirmó cuánto. Contando desde el
--    CLI (`supabase inspect db table-stats`, que ve todo), las tablas que la anon
--    key reportaba en cero tienen: **bookings ~185, messages ~154, salas ~53,
--    profiles ~84, mood_entries ~54, journal_entries ~14**. Son estimaciones de
--    `pg_class`, no un count exacto, pero alcanzan para lo que importa:
--    ✅ **Resuelto el 16/09/2026: Andre confirmó que esas reservas son reales
--    pero de prueba.** El script ya pasa por `bookings`, `messages` y `salas`
--    (paso 3 bis). Igual el control previo las cuenta: si el número creció mucho
--    desde los ~185 de esa fecha, mirar antes de borrar.
--
-- 🔴 POR QUÉ LA ANON KEY MENTÍA. Estas tablas dieron 0 con la anon key, pero eso
--    NO quiere decir que estén vacías: `bookings`, `messages`, `salas`, `session_notes`,
--    `notifications`, `mood_entries`, `journal_entries` y todas las tablas por
--    usuario tienen RLS que solo deja ver las filas propias, y la anon key no es
--    de nadie. O sea que un 0 acá significa "no puedo ver", no "no hay".
--    El bloque de CONTROL PREVIO vuelve a contarlas desde el editor SQL, donde
--    sí se ve todo. **Ese es el número que hay que leer antes de borrar nada.**
--    Si `bookings` o `messages` traen filas, PARAR: hay actividad real y esta
--    limpieza deja de ser trivial.
--
--   coach_rebooking_stats y coach_trending_stats son VISTAS, no tablas: se
--   recalculan solas y no hay que tocarlas.
--
-- ── Lo que este script NO hace ────────────────────────────────────────────────
--
--   · No toca `verified` ni `application_status` de los que se conservan. Que
--     los 34 estuvieran en 'aprobada' y verified=true es un problema aparte: hay
--     que decidir qué significa el sello de verificado antes de abrir.
--   · No borra el bucket de storage. Quedan `resource-audio/seed/*.mp3` y los
--     videos de presentación de las cuentas de prueba, que hay que borrar a mano
--     desde Supabase → Storage.
--   · **No borra cuentas de USUARIO de prueba.** Borra los coaches de la lista y
--     todo lo que cuelga de ellos —incluidas las reservas y salas de sus
--     clientes—, pero los ~84 perfiles quedan. Quién de esos es una persona real
--     y quién una prueba es una decisión aparte, y no se puede deducir del
--     esquema.
--   · No impide que alguien vuelva a correr `scripts/seed-recursos.sql`. Ese
--     script busca el primer coach con role='coach' y le cuelga 8 recursos
--     publicados con is_author_declared=true — o sea, declara autoría en nombre
--     de un profesional. No debe correrse nunca más contra la base de verdad.

begin;

-- ── 0. A quién se conserva ────────────────────────────────────────────────────
-- Editar esta lista. Todo coach cuyo slug NO esté acá se borra con todo lo suyo.
create temp table conservar (slug text) on commit drop;
insert into conservar (slug) values
  ('andre');          -- ← agregar acá los slugs que se quedan

create temp table a_borrar on commit drop as
select c.id as coach_id, c.profile_id, c.slug
from public.coaches c
where c.slug is null
   or c.slug not in (select slug from conservar);

-- ── 1. CONTROL PREVIO — correr esto solo, y leerlo, antes de seguir ───────────
select 'coaches a borrar' as que, count(*) as cuantos from a_borrar
union all select 'coaches que quedan', count(*) from public.coaches
  where slug in (select slug from conservar)
union all select 'reservas que se van', count(*) from public.bookings
  where coach_id in (select coach_id from a_borrar) or user_id in (select profile_id from a_borrar)
union all select 'reservas en total (eran ~185 el 16/09)', count(*) from public.bookings
union all select 'mensajes en total (eran ~154 el 16/09)', count(*) from public.messages
union all select 'check-ins de animo', count(*) from public.mood_entries
union all select 'entradas de diario', count(*) from public.journal_entries;

-- Y la lista, para mirarla con nombre y apellido antes de apretar el gatillo:
select slug, coach_id, profile_id from a_borrar order by slug;

-- ── 2. Lo que cuelga de cada coach ────────────────────────────────────────────
-- El orden importa: coach_resources tiene ON DELETE RESTRICT, así que si algo
-- queda sin borrar, el delete de `coaches` falla y la transacción entera se
-- revierte. Eso es lo que queremos: que falle ruidosamente, no a medias.
delete from public.coach_availability    where coach_id in (select coach_id from a_borrar);
delete from public.coach_weekly_pattern  where coach_id in (select coach_id from a_borrar);
delete from public.coach_topics          where coach_id in (select coach_id from a_borrar);
delete from public.coach_credentials     where coach_id in (select coach_id from a_borrar);
delete from public.coach_mp_accounts     where coach_id in (select coach_id from a_borrar);
delete from public.coach_payout_accounts where coach_id in (select coach_id from a_borrar);
delete from public.coach_resources       where coach_id in (select coach_id from a_borrar);

-- ── 3. Las reseñas sembradas ──────────────────────────────────────────────────
-- Por las dos puntas: las que recibieron las cuentas de prueba y las que
-- escribieron. `reviews` apunta a `profiles`, no a `coaches`.
--
-- 📌 Va ANTES que `bookings`: `reviews.booking_id` es FK a `bookings.id`.
--
-- ⚠️ CORRECCIÓN del 16/09/2026. Antes acá había un segundo delete que borraba
--    "las reseñas colgadas de una reserva que no existe", diciendo que las 24
--    sembradas tenían `booking_id` inventados. **Era un error de lectura**: esa
--    conclusión salió de ver `bookings` en cero con la anon key, y `bookings`
--    tiene ~185 filas. Los `booking_id` de esas reseñas son reales. El delete se
--    sacó porque su criterio no se sostenía; las 24 se van igual, por ser de las
--    cuentas de prueba, que es lo que sí está verificado (cuatro frases
--    repetidas en loop, todas del 07/08/2026).
delete from public.reviews
where reviewed_id in (select profile_id from a_borrar)
   or reviewer_id in (select profile_id from a_borrar);

-- ── 3 bis. Reservas, salas y mensajes ─────────────────────────────────────────
-- 🔴 Andre confirmó el 16/09/2026: las ~185 reservas son **reales pero de
--    prueba**. O sea que se borran; no son historial de nadie.
--
-- 🔴 LA TRAMPA DE LOS DOS `coach_id`, documentada en SCHEMA.md y fácil de pisar
--    acá: `bookings.coach_id` es **`coaches.id`**, y `salas.coach_id` es
--    **`coaches.profile_id`**. No son la misma columna. Usar la que no va deja
--    filas sin borrar y el delete de `coaches` falla por FK — que es el
--    comportamiento que queremos, pero conviene entender por qué falló.
--
-- Borrar `bookings` arrastra en cascada `session_notes`, `session_attendance` y
-- `guarantee_claims` (las tres con ON DELETE CASCADE). No hace falta tocarlas.
delete from public.resource_recommendations
where coach_id in (select coach_id from a_borrar);

-- 🔴 ACÁ ESTÁ EL PROBLEMA QUE LA AUDITORÍA DEL 16/09/2026 DESTAPÓ, y que hay
--    que decidir antes de correr esto.
--
--    De las 185 reservas, **hay plata que se movió de verdad**:
--      · 4 de PayPal en estado `reembolsado`, con monto cargado: 30 + 30 + 30 + 1
--        = **USD 91**, entre el 25 y el 29/08/2026. Son las pruebas con plata
--        real que documenta SCHEMA.md.
--      · 15 en `aprobado` (14 de Mercado Pago + 1 de USDT) y 17 más en
--        `reembolsado` / `reembolso_pendiente`.
--
--    🔴 **La Política de Privacidad §10 dice que las reservas y transacciones se
--    conservan 10 años, disociadas, por obligación contable-fiscal.** Borrar
--    estas filas contradice lo que el producto le promete al usuario y borra el
--    único registro propio de esos movimientos.
--
--    Por eso el delete de abajo **excluye toda reserva donde la plata se movió**.
--    Si Andre decide que esas también se van, se saca el `and` — pero es una
--    decisión con consecuencias fuera del producto, no una preferencia técnica.
--
--    ⚠️ CONSECUENCIA: si un coach de la lista tiene alguna de esas reservas, su
--    fila de `coaches` NO se va a poder borrar (FK). Es a propósito: mejor que
--    falle y se mire, a que se lleve puesto un registro contable en silencio.
--
-- ⚠️ Y OJO: hay **6 reservas `confirmada` con fecha futura** (17 al 26/09/2026).
--    Si alguna es de una persona real esperando una sesión, borrarla la deja sin
--    sesión y sin aviso. Mirarlas una por una:
--      select id, coach_id, user_id, scheduled_date, scheduled_time
--        from public.bookings where status = 'confirmada' and scheduled_date >= current_date;
delete from public.bookings
where (coach_id in (select coach_id from a_borrar)      -- coaches.id
    or user_id  in (select profile_id from a_borrar))
  and coalesce(payment_status, 'no_iniciado') in ('no_iniciado', 'pendiente')
  and coalesce(charged_amount, 0) = 0;

delete from public.messages
where sala_id in (
  select id from public.salas
   where coach_id in (select profile_id from a_borrar)  -- profiles.id
      or user_id  in (select profile_id from a_borrar)
);

delete from public.salas
where coach_id in (select profile_id from a_borrar)
   or user_id  in (select profile_id from a_borrar);

-- ── 4. El contenido personal de esas cuentas ──────────────────────────────────
-- Misma lista que `PERSONAL_TABLES` en la edge function `delete-account`, que es
-- la que ya sabe qué cuelga de un usuario. Si alguna de estas tablas tiene filas
-- de las cuentas de prueba, sin esto el borrado de `profiles` falla.
delete from public.journal_entries     where user_id     in (select profile_id from a_borrar);
delete from public.gratitude_entries   where user_id     in (select profile_id from a_borrar);
delete from public.mood_entries        where user_id     in (select profile_id from a_borrar);
delete from public.mood_suggestions    where user_id     in (select profile_id from a_borrar);
delete from public.user_habits         where user_id     in (select profile_id from a_borrar);
delete from public.user_quiz_answers   where user_id     in (select profile_id from a_borrar);
delete from public.resource_reminders  where user_id     in (select profile_id from a_borrar);
delete from public.resource_completions where user_id    in (select profile_id from a_borrar);
delete from public.saved_resources     where user_id     in (select profile_id from a_borrar);
delete from public.pinned_resources    where user_id     in (select profile_id from a_borrar);
delete from public.resource_saves      where user_id     in (select profile_id from a_borrar);
delete from public.resource_feedback   where user_id     in (select profile_id from a_borrar);
delete from public.favorite_coaches    where user_id     in (select profile_id from a_borrar);
delete from public.notifications       where recipient_id in (select profile_id from a_borrar);

-- ── 5. Los coaches y sus cuentas ──────────────────────────────────────────────
delete from public.coaches where id in (select coach_id from a_borrar);
delete from public.profiles where id in (select profile_id from a_borrar);
delete from auth.users  where id in (select profile_id from a_borrar);

-- ── 6. La tabla vieja de recursos ─────────────────────────────────────────────
-- Las 3 filas son de prueba ("Respiracion", "Meditacion leyendo", "alto tema").
-- Mirarlas antes; si alguna es real, sacarla del delete.
-- select id, title, type from public.resources;
delete from public.resources;

-- ── 7. CONTROL POSTERIOR ──────────────────────────────────────────────────────
select 'coaches'            as tabla, count(*) from public.coaches
union all select 'coach_resources',   count(*) from public.coach_resources
union all select 'reviews',           count(*) from public.reviews
union all select 'resources',         count(*) from public.resources
union all select 'coach_availability',count(*) from public.coach_availability
union all select 'coach_topics',      count(*) from public.coach_topics
union all select 'bookings',          count(*) from public.bookings
union all select 'salas',             count(*) from public.salas
union all select 'messages',          count(*) from public.messages
union all select 'session_notes (cae por cascada)', count(*) from public.session_notes;

-- Huérfanos: tiene que dar 0 filas. Si da algo, hay una tabla que este script
-- no conoce y que quedó apuntando a un coach que ya no existe.
select 'coach_resources' as tabla, count(*) as huerfanos from public.coach_resources cr
  where not exists (select 1 from public.coaches c where c.id = cr.coach_id)
union all
select 'reviews', count(*) from public.reviews r
  where not exists (select 1 from public.profiles p where p.id = r.reviewed_id)
union all
select 'bookings', count(*) from public.bookings b
  where not exists (select 1 from public.coaches c where c.id = b.coach_id)
union all
select 'salas', count(*) from public.salas sa
  where not exists (select 1 from public.profiles p where p.id = sa.coach_id)
union all
select 'messages', count(*) from public.messages m
  where not exists (select 1 from public.salas sa where sa.id = m.sala_id);

-- Si todo cierra: commit. Si algo no cuadra: rollback.
commit;
-- rollback;
