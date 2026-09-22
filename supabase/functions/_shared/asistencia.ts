// Quién se presentó a la sesión, según los registros de conexión de Daily.
//
// 🔴 **Existe porque los Términos prometían algo que nadie ejecutaba.** §9.5 dice
// que si el Profesional no entra en los primeros 10 minutos, el Cliente "no paga
// la Sesión y se le reintegra la totalidad". Hasta el 22/09/2026 no había NADA
// que lo hiciera: `session-attendance` guardaba la evidencia y ahí terminaba. La
// reserva quedaba `confirmada` para siempre, la plata ya liberada al
// Profesional, y el reintegro dependía de que el Cliente reclamara.
//
// Esto no decide sobre plata por su cuenta: devuelve un veredicto. Quién lo
// aplica es `session-attendance`, y solo cuando la sesión ya terminó.
//
// ── La regla, tal cual está escrita en §9.5 ─────────────────────────────────
//
//   · El Profesional no entra en los primeros 10 min       → reintegro
//   · El Profesional se va antes de que entre el Cliente
//     o antes de los 20 min (lo que pase primero)          → reintegro
//   · El Cliente entra con más de 20 min de demora, o no
//     entra                                                → se cobra entera
//   · No se presenta ninguno                               → reintegro
//
// 📌 El orden importa y no es arbitrario. Si el Cliente llega al minuto 25, el
// Profesional que esperó los 20 y se fue **cumplió**: por eso "se fue antes" se
// mide contra `min(cuando entró el cliente, 20 min)` y no contra el final de la
// sesión.
//
// 📌 Se usa `user_id` de cada participante, que Daily devuelve y **es nuestro
// propio id de perfil** (viaja en el meeting token). Verificado contra una
// sesión real del 21/09/2026.

/** Minutos que el Profesional tiene para entrar (§9.5). */
export const ESPERA_PROFESIONAL_MIN = 10;
/** Minutos que el Profesional debe esperar al Cliente (§9.5). */
export const ESPERA_CLIENTE_MIN = 20;

export type Participante = {
  user_id?: string | null;
  /** Unix en SEGUNDOS, como lo manda Daily. */
  join_time?: number | null;
  /** Segundos que estuvo. */
  duration?: number | null;
};

export type Veredicto =
  | { veredicto: 'reembolso'; motivo: 'profesional_no_entro' | 'profesional_se_fue' | 'no_vino_nadie' }
  | { veredicto: 'cobrar'; motivo: 'cliente_no_entro' | 'cliente_llego_tarde' }
  | { veredicto: 'sesion_normal' }
  | { veredicto: 'sin_datos' };

function tramos(participantes: Participante[], id: string) {
  const suyos = participantes.filter(p => p?.user_id === id && Number.isFinite(Number(p?.join_time)));
  if (suyos.length === 0) return null;
  const entradas = suyos.map(p => Number(p.join_time) * 1000);
  const salidas = suyos.map(p => (Number(p.join_time) + Number(p.duration ?? 0)) * 1000);
  return { entro: Math.min(...entradas), salio: Math.max(...salidas) };
}

export function veredictoAsistencia(opts: {
  participantes: Participante[];
  clienteId: string;
  profesionalId: string;
  /** Instante del horario agendado, en ms. */
  inicioMs: number;
}): Veredicto {
  const { participantes, clienteId, profesionalId, inicioMs } = opts;

  // ⚠️ Sin datos no se decide NADA. Daily puede tardar en publicar la sesión, y
  // una lista vacía significa "todavía no sé", no "no vino nadie". Confundir las
  // dos cosas sería reembolsar sesiones que ocurrieron.
  if (!Array.isArray(participantes) || participantes.length === 0) {
    return { veredicto: 'sin_datos' };
  }
  if (!Number.isFinite(inicioMs)) return { veredicto: 'sin_datos' };

  const cliente = tramos(participantes, clienteId);
  const pro = tramos(participantes, profesionalId);

  if (!cliente && !pro) return { veredicto: 'reembolso', motivo: 'no_vino_nadie' };
  if (!pro) return { veredicto: 'reembolso', motivo: 'profesional_no_entro' };
  if (!cliente) return { veredicto: 'cobrar', motivo: 'cliente_no_entro' };

  if (pro.entro > inicioMs + ESPERA_PROFESIONAL_MIN * 60_000) {
    return { veredicto: 'reembolso', motivo: 'profesional_no_entro' };
  }

  // Hasta cuándo tenía que quedarse: hasta que entrara el Cliente, o los 20
  // minutos, lo que pasara primero.
  const debiaQuedarseHasta = Math.min(cliente.entro, inicioMs + ESPERA_CLIENTE_MIN * 60_000);
  if (pro.salio < debiaQuedarseHasta) {
    return { veredicto: 'reembolso', motivo: 'profesional_se_fue' };
  }

  if (cliente.entro > inicioMs + ESPERA_CLIENTE_MIN * 60_000) {
    return { veredicto: 'cobrar', motivo: 'cliente_llego_tarde' };
  }

  return { veredicto: 'sesion_normal' };
}
