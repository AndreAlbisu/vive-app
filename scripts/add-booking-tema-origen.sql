-- add-booking-tema-origen.sql
--
-- `bookings.tema_origen` — por qué puerta entró la persona que reservó.
--
-- ⚠️ PENDIENTE DE CORRER.
--
-- ── Por qué ──────────────────────────────────────────────────────────────────
--
-- Una psicóloga, consultada sobre qué necesita saber antes de atender, contestó:
-- nombre, edad, motivo, derivación psiquiátrica, situación de riesgo, derivación
-- por tribunales. De esa lista, el motivo YA se pide al reservar
-- (`bookings.user_message`) — pero es **opcional**, y lo que es opcional a veces
-- no está.
--
-- Esta columna es el piso que no depende de que nadie escriba: la persona eligió
-- una puerta ("Ansiedad y estrés", "Duelo"…) para llegar hasta ese profesional, y
-- hasta hoy ese dato se quedaba en la navegación y no llegaba a la reserva.
--
-- 🔴 **NO es el motivo, y el copy no puede confundirlos.** Es una categoría
-- nuestra, no lo que le pasa a la persona. En la app se muestra como *"buscaba
-- por ansiedad y estrés"* —lenguaje de búsqueda— y separado del entrecomillado
-- del mensaje, que sí es de ella. Si se mezclan, el profesional lee como
-- declaración de la persona algo que dijo la app.
--
-- ── Por qué se guarda la etiqueta y no el id de la puerta ────────────────────
--
-- Se guarda el **texto** de la puerta (`DOORS[].label`) y no su id: lo que hay
-- que poder contestar es "¿qué le estaba pasando a esta persona cuando
-- reservó?", y eso tiene que seguir siendo legible aunque mañana se renombren o
-- se reordenen las puertas. El id apunta a una definición que cambia; la
-- etiqueta guarda lo que la persona efectivamente vio y tocó.
--
-- ⚠️ **`null` significa "no sabemos"**, igual que en `origen`. Queda null en las
-- reservas viejas, en las que entran por el link del coach y en las del buscador
-- libre, donde nadie declaró un tema. Inventarlo sería peor que no tenerlo.
--
-- ── Sobre la confianza en el valor ───────────────────────────────────────────
--
-- 📌 Lo escribe el CLIENTE en el insert, así que es falsificable como
-- `user_message`. No importa: describe la intención de quien reserva, que es
-- suya de todos modos, y no toca plata, permisos ni ranking. El CHECK de largo
-- está para que no se pueda usar la columna como depósito de texto arbitrario.
--
-- 🔴 **Es dato de salud** (Ley 25.326 art. 2 — ver `docs/consentimiento-datos-sensibles.md`,
-- que ya cubre el caso de lo que se revela por deducción). "Entró por Duelo" dice
-- algo sobre la salud de esa persona. Se comparte con UN profesional, el que
-- eligió, dentro de una reserva que ya es de los dos. No sale de ahí.

begin;

alter table public.bookings add column if not exists tema_origen text;

-- Sin lista cerrada a propósito: las puertas se agregan y se renombran en el
-- código (`constants/conexionesDoors.ts`), y un CHECK con los labels de hoy
-- obligaría a una migración cada vez que se toque una palabra. Lo que sí se
-- acota es el largo.
alter table public.bookings drop constraint if exists bookings_tema_origen_len;
alter table public.bookings add constraint bookings_tema_origen_len
  check (tema_origen is null or length(tema_origen) between 1 and 60);

commit;

-- ── VERIFICACIÓN ─────────────────────────────────────────────────────────────

-- 1) La columna existe y es nullable. Esperado: 1 fila, is_nullable = YES.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'bookings' and column_name = 'tema_origen';

-- 2) Después de las primeras reservas: por dónde está entrando la gente, y
--    cuántas llegan sin tema (link del coach, buscador libre, o filas viejas).
select coalesce(tema_origen, '(sin tema)') as puerta, count(*) as reservas
from public.bookings
group by 1
order by reservas desc;

-- 3) La pregunta que de verdad importa para lo que motivó todo esto: cuántas
--    reservas le llegan al profesional SIN nada de contexto — ni motivo escrito
--    ni puerta. Es el número a bajar.
select
  count(*)                                                            as reservas,
  count(*) filter (where user_message is null and tema_origen is null) as a_ciegas
from public.bookings
where status <> 'cancelada';
