// Cómo se ordena y se rotula la lista de "Tus personas" del coach.
//
// 🔴 POR QUÉ EXISTE: la pantalla se llama "Tus personas" pero estaba construida
// como una bandeja de mensajes — ordenada por `lastMessageAt` y con el dato que
// el profesional viene a buscar (cuándo vuelve a ver a alguien) dibujado en la
// letra más chica y más pálida de la tarjeta. Ver `docs/coach-tus-personas.html`.
//
// Acá afuera y no adentro de la pantalla por el mismo motivo que
// `lib/ejesLayout.ts`: es la regla de negocio del orden, se puede probar sin
// montar nada, y adentro del componente nadie la iba a mirar de nuevo.

/** Mediodía UTC: la diferencia entre dos fechas no puede depender de la hora. */
function aMs(iso: string): number {
  return Date.parse(`${iso}T12:00:00Z`);
}

/** Días de `desde` a `hasta`, los dos en `YYYY-MM-DD`. Negativo si ya pasó. */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aMs(hasta) - aMs(desde)) / 86400000);
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Lo que dice la pastilla de la próxima sesión.
 *
 * 📝 "Hoy" y "mañana" salen como palabra y no como número. Un profesional que
 * mira su lista a la mañana necesita separar lo de hoy de lo de dentro de tres
 * semanas en un vistazo, y "28" no dice eso — "hoy" sí. Del tercer día en
 * adelante la fecha vuelve a ser lo más informativo.
 */
export type ChipProxima =
  | { tipo: 'pronto'; texto: string }
  | { tipo: 'fecha'; dia: string; mes: string };

export function chipProxima(proximaIso: string, hoyIso: string): ChipProxima {
  const dias = diasEntre(hoyIso, proximaIso);
  if (dias <= 0) return { tipo: 'pronto', texto: 'hoy' };
  if (dias === 1) return { tipo: 'pronto', texto: 'mañana' };

  const [, mm, dd] = proximaIso.split('-');
  return { tipo: 'fecha', dia: String(Number(dd)), mes: MESES[Number(mm) - 1] ?? '' };
}

/**
 * El triage real: quién está agendado y quién no.
 *
 * 🔴 Cada grupo se ordena por lo que corresponde, y son criterios OPUESTOS:
 * las agendadas por fecha **ascendente** —lo más próximo primero, que es lo que
 * hay que preparar— y las otras por conversación **descendente**. Un solo
 * criterio para las dos (que es lo que había) hacía que alguien con sesión
 * mañana quedara debajo de alguien que mandó "gracias" hoy.
 *
 * ⚠️ Que la pastilla EXISTA ya es el dato. Por eso la partición es por
 * `proximaIso != null` y no por una etiqueta calculada aparte: el grupo y el
 * adorno de la fila no pueden desincronizarse porque son la misma pregunta.
 */
export type FilaRoster = {
  proximaIso: string | null;
  lastMessageAt: string | null;
};

export function agruparRoster<T extends FilaRoster>(filas: T[]): { agendadas: T[]; sinProxima: T[] } {
  const agendadas = filas.filter(f => !!f.proximaIso);
  const sinProxima = filas.filter(f => !f.proximaIso);

  agendadas.sort((a, b) => (a.proximaIso as string).localeCompare(b.proximaIso as string));

  sinProxima.sort((a, b) => {
    if (!a.lastMessageAt) return 1;
    if (!b.lastMessageAt) return -1;
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });

  return { agendadas, sinProxima };
}

/**
 * La línea de historia de la persona: cuántas sesiones y cuándo fue la última.
 *
 * 🔴 Ya NO nombra la próxima sesión — eso se mudó a la pastilla. Tenerlo en los
 * dos lados sería decir lo mismo dos veces en la misma fila, que es justo el
 * defecto que tenía la etiqueta "✓ SESIÓN ACEPTADA" al lado del texto "Sesión
 * acepta…" cortado.
 *
 * Devuelve vacío cuando no hay nada que decir —alguien que reservó y todavía no
 * tuvo su primera sesión— porque inventar texto para llenar el renglón es
 * exactamente lo que vuelve ilegible una lista.
 */
export function textoHistoria(
  r: { sesiones: number; ultimaIso: string | null },
  haceCuanto: (dias: number) => string,
  hoyIso: string,
): string {
  const partes: string[] = [];
  if (r.sesiones > 0) partes.push(r.sesiones === 1 ? '1 sesión' : `${r.sesiones} sesiones`);
  if (r.ultimaIso) partes.push(haceCuanto(diasEntre(r.ultimaIso, hoyIso)).toLowerCase());
  return partes.join(' · ');
}
