import { daysFromTodayAr } from './time';

/**
 * Quién se está cayendo — clientes del coach que dejaron de volver.
 *
 * 🔴 Por qué existe. El problema de negocio más caro de un profesional
 * independiente no es conseguir clientes nuevos: es que los que ya tiene dejen
 * de venir sin avisar. La app no le daba **ninguna** forma de verlo: hay
 * reservas y hay chats, que son vistas de eventos sueltos, y ninguna contesta
 * "¿a quién hace mucho que no veo?".
 *
 * Y del lado de Vita es la medida anti-fuga #1 vista desde el otro lado: la
 * "re-reserva de un toque" hoy existe SOLO para el usuario
 * (`app/(tabs)/conexiones.tsx`). El coach —que es el que se acuerda de la
 * persona— no tenía forma de iniciar nada.
 */

/** Una sesión que efectivamente ocurrió. `fecha` en YYYY-MM-DD. */
export type SesionCumplida = { userId: string; fecha: string };

export type PersonaEnRiesgo = {
  userId: string;
  diasSinVerse: number;
  /** Cada cuántos días se veían. `null` si hubo una sola sesión. */
  cadenciaDias: number | null;
  /** Cuántas sesiones cumplieron juntos. */
  sesiones: number;
};

/** Con una sola sesión no hay ritmo del cual desviarse, así que se usa un plazo
 *  fijo. Tres semanas es el punto donde "quedamos en vernos" ya se enfrió. */
export const DIAS_UNA_SOLA_SESION = 21;

/** Piso para los que sí tienen ritmo: sin esto, alguien que venía semanalmente
 *  aparecería como "en riesgo" a los 15 días, que todavía es normal. */
export const DIAS_MINIMO = 14;

/** Techo. Más allá de esto la persona no "se está cayendo": ya se cayó, hace
 *  rato. Mostrarla como algo urgente sería mentir sobre lo que pasó, y encima
 *  empujaría al coach a escribirle a alguien que se fue hace medio año. */
export const DIAS_TECHO = 120;

/** Mediana y no promedio: unas vacaciones en el medio inflan el promedio y
 *  vuelven "normal" un silencio que no lo es. La mediana ignora el outlier. */
function medianaDeHuecos(fechasOrdenadas: string[], ahora: number): number | null {
  if (fechasOrdenadas.length < 2) return null;
  const dias = fechasOrdenadas.map(f => -daysFromTodayAr(f, ahora));
  const huecos: number[] = [];
  for (let i = 1; i < dias.length; i++) huecos.push(Math.abs(dias[i] - dias[i - 1]));
  huecos.sort((a, b) => a - b);
  const m = Math.floor(huecos.length / 2);
  return huecos.length % 2 === 1 ? huecos[m] : Math.round((huecos[m - 1] + huecos[m]) / 2);
}

/**
 * @param sesiones  todas las sesiones `completada` del coach, en cualquier orden
 * @param conProximaSesion  userIds que YA tienen una sesión futura — esos no se
 *   están cayendo aunque haga mucho que no se ven, y ofrecerle al coach que les
 *   escriba "hace mucho que no te veo" cuando tienen turno el jueves lo haría
 *   quedar mal.
 */
export function personasQueSeCaen(
  sesiones: SesionCumplida[],
  conProximaSesion: Set<string>,
  ahora: number = Date.now(),
): PersonaEnRiesgo[] {
  const porPersona = new Map<string, string[]>();
  for (const s of sesiones) {
    if (conProximaSesion.has(s.userId)) continue;
    const arr = porPersona.get(s.userId);
    if (arr) arr.push(s.fecha);
    else porPersona.set(s.userId, [s.fecha]);
  }

  const salida: PersonaEnRiesgo[] = [];
  for (const [userId, fechas] of porPersona) {
    fechas.sort();
    const ultima = fechas[fechas.length - 1];
    const diasSinVerse = -daysFromTodayAr(ultima, ahora);
    if (diasSinVerse > DIAS_TECHO) continue;

    const cadenciaDias = medianaDeHuecos(fechas, ahora);
    const umbral = cadenciaDias == null
      ? DIAS_UNA_SOLA_SESION
      : Math.max(cadenciaDias * 2, DIAS_MINIMO);

    if (diasSinVerse < umbral) continue;
    salida.push({ userId, diasSinVerse, cadenciaDias, sesiones: fechas.length });
  }

  // El que hace más que no viene, primero: es el que está más cerca de perderse.
  return salida.sort((a, b) => b.diasSinVerse - a.diasSinVerse);
}

/** "Hace 3 semanas", "Hace 2 meses". En semanas hasta el mes y medio porque es
 *  la unidad en la que un profesional piensa su agenda. */
export function haceCuanto(dias: number): string {
  if (dias < 14) return `Hace ${dias} días`;
  if (dias < 45) return `Hace ${Math.round(dias / 7)} semanas`;
  const meses = Math.round(dias / 30);
  return meses === 1 ? 'Hace un mes' : `Hace ${meses} meses`;
}
