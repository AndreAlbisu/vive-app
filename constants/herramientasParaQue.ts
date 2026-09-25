// Para qué sirve cada herramienta, y cuándo usarla (25/09/2026, textos
// aprobados por Andre). Pendiente del consejo del 15/09
// (`docs/consejo-herramientas.md`): cada pantalla explicaba CÓMO se usa y no
// PARA QUÉ.
//
// 🔴 Se dice para qué sirve y cuándo, NUNCA un efecto de salud ("calma el
// sistema nervioso", "baja la ansiedad"): T&C §5, ver
// `docs/encuadre-salud-y-responsabilidad.md`.
//
// ⚠️ "Tu profesional no lo ve" es cierto porque `journal_entries` tiene RLS de
// solo el dueño. Si algún día se comparte algo del diario, esta línea cambia en
// el mismo commit. Lo de Sonidos sale de `RuidoScreen` (5, 15 o 30 minutos,
// sigue con la pantalla apagada).

export type ParaQue = { para: string; cuando: string; saber: string };

export const PARA_QUE: Record<string, ParaQue> = {
  diario: {
    para: 'Poner en palabras lo que te pasa, para verlo con un poco de distancia.',
    cuando: 'Cuando algo te da vueltas, o al final del día.',
    saber: 'Queda con su fecha, así podés releer cómo venías. Tu profesional no lo ve.',
  },
  gratitud: {
    para: 'Anotar tres cosas que estuvieron bien, para que el día no quede solo con lo que salió mal.',
    cuando: 'Al terminar el día. Son cinco minutos.',
    saber: 'No tienen que ser grandes: alcanza con que sean tuyas.',
  },
  respiracion: {
    para: 'Frenar un momento y concentrarte en algo simple: el ritmo de tu respiración.',
    cuando: 'Antes de algo que te pone nervioso, o cuando la cabeza va muy rápido. Tres minutos alcanzan.',
    saber: 'Si te sirve, contáselo a tu profesional: puede adaptarla a lo que necesitás.',
  },
  ruido: {
    para: 'Un fondo para dormirte, concentrarte o tapar el ruido de afuera.',
    cuando: 'De noche, o cuando necesitás aislarte un rato.',
    saber: 'Sigue sonando con la pantalla apagada y se corta solo.',
  },
};

/** La línea debajo de "Herramientas de Vita", en Recursos. */
export const HERRAMIENTAS_BAJADA = 'Prácticas cortas para el día a día. No reemplazan una sesión: la acompañan.';
