// time — convertir los horarios de sesión, que están guardados SIN zona.
//
// `bookings.scheduled_date` y `scheduled_time` son texto plano ("2026-08-20",
// "15:00") y representan **hora de Argentina**. La zona no está guardada en
// ningún lado: es una convención, y el que la aplica mal produce un número que
// parece correcto.
//
// 🔴 El bug que motivó este archivo: en todo el cliente la cuenta se hacía con
// `new Date(year, month - 1, day, h, m)`, que interpreta esos componentes en la
// zona **del dispositivo**. En un teléfono en Argentina coincide y por eso nunca
// se vio; en uno en Madrid el instante calculado cae 5 horas antes del real. Eso
// no era cosmético: `isCancelLate` decide si corresponde el reembolso, así que a
// alguien cancelando desde afuera con 29 horas de anticipación la app le
// escribía "cancelación tardía" y el trigger le negaba la plata. Es el mismo
// bug que tenía `create-meeting-room` (sesión 101), del lado del cliente.
//
// ⚠️ La contraparte de servidor es `supabase/functions/_shared/guarantee.ts`
// (`scheduledAtMs`), y los dos crons SQL usan
// `AT TIME ZONE 'America/Argentina/Buenos_Aires'`. Las tres tienen que decir lo
// mismo: si el cliente y la base calculan distinto, la app promete una cosa y la
// base hace otra.

/** La zona, por nombre IANA y no por offset fijo.
 *
 *  Argentina no tiene horario de verano desde 2009, así que hoy `-03:00` da el
 *  mismo resultado. Se usa el nombre igual porque el offset fijo se rompe **en
 *  silencio** el día que vuelva a haberlo —vuelve a discutirse cada par de
 *  años— y lo que se rompería son los reembolsos y las salas de video, una hora
 *  corridas, sin que nada avise. Con el nombre no hay que tocar nada. */
export const AR_TZ = 'America/Argentina/Buenos_Aires';

/** Lo que se usa si el motor de JS no sabe convertir zonas (ver `TZ_SUPPORTED`).
 *  Es el mismo valor que usa hoy el servidor, así que el fallback degrada al
 *  comportamiento actual y no a algo peor. */
const AR_FALLBACK_OFFSET_MS = -3 * 60 * 60_000;

/**
 * ¿El motor sabe convertir a una zona por nombre?
 *
 * No alcanza con preguntar si existe `Intl`: soportar un locale y soportar la
 * opción `timeZone` son cosas distintas, y en Hermes eso dependió de cómo esté
 * compilado. Por eso el chequeo es FUNCIONAL — se convierte un instante cuya
 * respuesta se conoce y se compara. Un feature-detect que solo mira si la API
 * existe devolvería `true` en un motor que después ignora la zona en silencio,
 * que es el peor de los mundos.
 */
export const TZ_SUPPORTED: boolean = (() => {
  try {
    // 2026-01-01T12:00Z son las 09:00 en Argentina (UTC-3, sin DST).
    const s = new Intl.DateTimeFormat('en-US', {
      timeZone: AR_TZ, hour: '2-digit', hour12: false,
    }).format(new Date(Date.UTC(2026, 0, 1, 12, 0, 0)));
    return parseInt(s, 10) === 9;
  } catch {
    return false;
  }
})();

/** Offset de Argentina (en ms) en un instante dado. Positivo al este de UTC. */
function arOffsetMsAt(instantMs: number): number {
  if (!TZ_SUPPORTED) return AR_FALLBACK_OFFSET_MS;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: AR_TZ,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(instantMs));

  const get = (type: string): number => {
    const p = parts.find(x => x.type === type);
    return p ? parseInt(p.value, 10) : 0;
  };
  // Algunas implementaciones devuelven "24" para la medianoche en hour12:false.
  const hour = get('hour') % 24;

  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
  return asIfUtc - instantMs;
}

/**
 * El instante absoluto (epoch ms) de una sesión, a partir de cómo está guardada.
 *
 * Acepta "15:00" y "15:00:00". Devuelve `NaN` si la fecha o la hora son
 * ilegibles — quien llama tiene que decidir qué hacer, igual que hace la edge
 * function `create-meeting-room`, que responde 422 en vez de calcular una
 * ventana absurda a partir de una fila corrupta.
 */
export function scheduledAtMs(date: string, time: string): number {
  const [y, mo, d] = (date ?? '').split('-').map(Number);
  const [h, mi] = (time ?? '').slice(0, 5).split(':').map(Number);
  if (![y, mo, d, h, mi].every(Number.isFinite)) return NaN;

  // Se parte de "como si la hora de pared fuera UTC" y se corrige con el offset
  // que Argentina tiene EN ESE INSTANTE. La segunda pasada solo importa si algún
  // día vuelve el horario de verano: en el salto, el offset del instante
  // estimado puede no ser el del instante real. Sin DST las dos dan igual.
  const asIfUtc = Date.UTC(y, mo - 1, d, h, mi, 0);
  const primera = asIfUtc - arOffsetMsAt(asIfUtc);
  const offsetReal = arOffsetMsAt(primera);
  return asIfUtc - offsetReal;
}

/** La fecha de HOY en Argentina, como "YYYY-MM-DD".
 *
 *  No es lo mismo que la fecha de hoy del dispositivo: a la 01:00 en Madrid en
 *  Argentina siguen siendo las 20:00 del día anterior. Todo lo que diga "hoy",
 *  "mañana" o "faltan N días" sobre una sesión tiene que contar en días
 *  argentinos, porque en días argentinos está guardada. */
export function todayInAr(now: number = Date.now()): string {
  const shifted = new Date(now + arOffsetMsAt(now));
  const y = shifted.getUTCFullYear();
  const mo = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

/** Días de calendario entre hoy (en Argentina) y una fecha guardada. 0 = hoy. */
export function daysFromTodayAr(date: string, now: number = Date.now()): number {
  const hoy = todayInAr(now);
  const [ay, am, ad] = hoy.split('-').map(Number);
  const [by, bm, bd] = (date ?? '').split('-').map(Number);
  if (![by, bm, bd].every(Number.isFinite)) return NaN;
  // Se comparan mediodías UTC para que ningún borde de día ni offset mueva el
  // resultado: la diferencia entre dos fechas de calendario es entera.
  const a = Date.UTC(ay, am - 1, ad, 12);
  const b = Date.UTC(by, bm - 1, bd, 12);
  return Math.round((b - a) / 86_400_000);
}

// ─── Mostrarle la hora al usuario ────────────────────────────────────────────

/** La zona del dispositivo, por nombre. */
export function deviceTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || AR_TZ;
  } catch {
    return AR_TZ;
  }
}

/** Los componentes de un instante, leídos en una zona cualquiera. Todo pasa por
 *  `Intl` y NUNCA por los métodos locales de `Date` (`getHours`, `getDate`…),
 *  que siempre responden en la zona del dispositivo: usarlos acá haría que la
 *  función solo se pudiera probar mudando la máquina de país. */
function partsInTz(instantMs: number, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(instantMs));
  const get = (type: string): number => {
    const p = parts.find(x => x.type === type);
    return p ? parseInt(p.value, 10) : 0;
  };
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour') % 24, mi: get('minute') };
}

/**
 * ¿El usuario está en otra hora que Argentina, ahora mismo?
 *
 * Se compara el offset y no el nombre de la zona: alguien en Montevideo o en
 * São Paulo (en invierno) ve exactamente la misma hora, así que mostrarle una
 * "conversión" que dice lo mismo dos veces es ruido, no ayuda.
 */
export function deviceIsOffArgentina(now: number = Date.now(), tz: string = deviceTz()): boolean {
  if (!TZ_SUPPORTED) return false;
  const p = partsInTz(now, tz);
  const asIfUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
  // Se redondea al minuto: `partsInTz` no trae segundos, así que comparar contra
  // el instante crudo daría distinto siempre.
  const userOffsetMs = asIfUtc - Math.floor(now / 60_000) * 60_000;
  return userOffsetMs !== arOffsetMsAt(now);
}

export type LocalEquivalent = {
  /** "07:00" — la misma sesión, en la hora del usuario. */
  time: string;
  /** -1, 0 o +1: si para el usuario cae el día anterior, el mismo o el siguiente. */
  dayShift: number;
  /** "lunes", "martes"… el día en la zona del usuario. */
  weekday: string;
};

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/**
 * La misma sesión vista desde donde está el usuario.
 *
 * 🔴 Lo que importa acá no es la hora, es el DÍA. Las 21:00 de Argentina son las
 * 07:00 del día SIGUIENTE en Bangkok: alguien que lee "21:00" y no ve el
 * corrimiento reserva para el día equivocado y se entera cuando no aparece
 * nadie. Por eso `dayShift` es parte del resultado y no un detalle que la
 * pantalla pueda decidir ignorar.
 *
 * `tz` se puede pasar explícito — es lo que vuelve a esta función probable sin
 * tener que mudar la máquina de país.
 */
export function localEquivalent(date: string, time: string, tz: string = deviceTz()): LocalEquivalent | null {
  const ms = scheduledAtMs(date, time);
  if (!Number.isFinite(ms) || !TZ_SUPPORTED) return null;

  const p = partsInTz(ms, tz);
  const hh = String(p.h).padStart(2, '0');
  const mm = String(p.mi).padStart(2, '0');

  // El corrimiento se mide contra la fecha ARGENTINA de la sesión, que es la que
  // la persona está leyendo en pantalla.
  const [y, mo, d] = date.split('-').map(Number);
  const diaAr = Date.UTC(y, mo - 1, d, 12);
  const diaUser = Date.UTC(p.y, p.mo - 1, p.d, 12);
  const dayShift = Math.round((diaUser - diaAr) / 86_400_000);

  return { time: `${hh}:${mm}`, dayShift, weekday: DIAS[new Date(diaUser).getUTCDay()] };
}

/** Frase corta para mostrar debajo de un horario argentino. `null` si el
 *  usuario está en la misma hora que Argentina y no hay nada que aclarar. */
export function localEquivalentLabel(date: string, time: string, tz: string = deviceTz()): string | null {
  if (!deviceIsOffArgentina(Date.now(), tz)) return null;
  const eq = localEquivalent(date, time, tz);
  if (!eq) return null;
  if (eq.dayShift === 0) return `${eq.time} para vos`;
  // Con corrimiento de día se nombra el día explícitamente: "07:00 del martes"
  // se entiende sin tener que calcular nada.
  return `${eq.time} del ${eq.weekday} para vos`;
}
