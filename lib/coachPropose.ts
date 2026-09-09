
/**
 * Proponerle un horario a alguien que se está cayendo.
 *
 * 🔴 Por qué existe. La tarjeta "Hace rato que no los ves" ya contestaba
 * *"¿a quién hace mucho que no veo?"* (ver `coachContinuity.ts`), pero su botón
 * decía **"Escribirle"** y abría un chat vacío. Eso deja el trabajo entero del
 * lado del coach en el peor momento: hay que acordarse de los horarios propios,
 * escribirlos a mano y redactar el mensaje incómodo de "¿volvés?".
 *
 * La medida anti-fuga #1 —re-reserva de un toque— existe hace rato para el
 * usuario (`app/(tabs)/conexiones.tsx`). Esto es la mitad que faltaba: que el
 * coach, que es el que se acuerda de la persona, pueda EMPEZAR la re-reserva.
 *
 * La consulta de huecos vive en `coachProposeData.ts` — acá solo lo que se
 * puede probar sin base, mismo corte que `coachVisibility` / `coachVisibilityData`.
 *
 * ⚠️ Lo que NO hace, a propósito: no reserva nada. El coach no puede ocupar la
 * agenda de otro ni cobrarle, así que lo que se manda es una **propuesta** por
 * chat y la reserva la sigue haciendo la persona, por el camino de siempre.
 * Acá se ahorra el trabajo de escribirla, no se saltea el consentimiento.
 */

/** Un hueco libre en la agenda del coach. `date` YYYY-MM-DD, `time` HH:MM. */
export type Hueco = { date: string; time: string };

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * La hora en forma comparable: `HH:MM` con cero inicial.
 *
 * 🔴 Existe porque las dos tablas guardan la hora como TEXTO y **no con el
 * mismo formato**: `coach_availability.time` viene sin cero inicial (`"9:00"`,
 * verificado contra la base) y `bookings.scheduled_time` puede venir con él.
 * Comparar los textos crudos —o recortarlos con `slice(0, 5)`, que es lo que
 * había acá al principio— deja `"9:00"` de un lado y `"09:00"` del otro: **no
 * matchean, y un horario ya ocupado se le ofrece igual a la persona.**
 *
 * Es la misma regla que usa la vista `coach_availability_status`
 * (`lpad(split_part(...), 2, '0')`), que es el precedente del repo para esta
 * comparación. Si cambia una, cambia la otra.
 */
export function horaComparable(t: unknown): string {
  const [h = '', m = ''] = String(t).split(':');
  return `${h.padStart(2, '0')}:${m.slice(0, 2)}`;
}

/** "Jue 11 sep · 15:00". Una fecha de calendario tiene el mismo día en cualquier
 *  zona, así que acá `new Date` con componentes locales es seguro (mismo
 *  criterio que `nextDateLabel` en `CoachHomeScreen`). */
export function etiquetaHueco({ date, time }: Hueco): string {
  const [y, m, d] = date.split('-').map(Number);
  const dia = DIAS[new Date(y, m - 1, d).getDay()];
  return `${dia} ${d} ${MESES[m - 1]} · ${time.slice(0, 5)}`;
}

/**
 * El texto que se siembra en el chat. **Es un borrador, no un envío**: queda en
 * el input para que el coach lo lea, lo corrija o lo borre. Esa es la
 * diferencia entre ahorrarle la parte tediosa y hablar por él.
 *
 * Sin huecos libres no se inventa nada: se abre el chat con el saludo solo, que
 * es exactamente lo que hacía el botón viejo.
 */
export function mensajeDePropuesta(nombre: string, huecos: Hueco[]): string {
  // Un nombre vacío no debería pasar nunca (la card no se dibuja sin nombre),
  // pero el fallback tiene que ser el saludo pelado y no un relleno: cuando el
  // default era 'Hola', el mensaje arrancaba con "Hola Hola, ¿cómo venís?".
  const primerNombre = nombre.trim().split(' ')[0];
  const saludo = primerNombre ? `Hola ${primerNombre}, ¿cómo venís?` : 'Hola, ¿cómo venís?';
  if (huecos.length === 0) return `${saludo} `;

  const lista = huecos.map(h => `· ${etiquetaHueco(h)}`).join('\n');
  const cierre = huecos.length === 1
    ? 'Tengo este horario libre, por si querés que nos veamos:'
    : 'Tengo estos horarios libres, por si querés que nos veamos:';
  return `${saludo} ${cierre}\n${lista}\n`;
}
