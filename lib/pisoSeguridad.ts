// El piso de seguridad — cuándo la tarjeta deja de hacer de amigo.
//
// Puro: sin red, sin estado, sin `Date.now()` adentro. Separado de
// `weeklyReflection.ts` porque es la única señal cuya condición mira la
// SECUENCIA de registros y no promedios, y porque merece sus propios tests.
//
// ── Para qué existe ──────────────────────────────────────────────────────────
// `docs/la-voz-de-sofia.md` §5 ter: *"Si alguien registra el fondo varios días
// seguidos, una voz cálida no alcanza y no puede simular que sí. Tiene que haber
// un punto donde deja de hacer de amigo y dice algo real sobre buscar ayuda."*
//
// Hoy `sharp-drop` acompaña un mal día y `sustained-low` un mal tramo. Los dos
// están bien para lo que son. Lo que no había era el punto donde la app admite
// su límite.
//
// 📌 Segunda razón, de la investigación del 01/09: si Vita integra la cadena de
// comercialización del art. 40 de la Ley 24.240 —y el precedente Mercado Libre
// dice que probablemente sí—, este mecanismo es parte de la **diligencia**, no
// un detalle de tono. Ver `docs/encuadre-salud-y-responsabilidad.md`.
//
// ── 🔴 Por qué el umbral NO sale de un instrumento clínico ───────────────────
// La tentación era tomar el corte de una escala estándar (el PHQ-9 usa "más de
// la mitad de los días durante dos semanas"). **Sería un error**, y no por
// prolijidad: un umbral derivado de un instrumento diagnóstico convierte a Vita
// en una herramienta de screening, que es exactamente la línea que
// `encuadre-salud-y-responsabilidad.md` dice no cruzar — ahí la derivación se
// vuelve triage.
//
// Por eso el umbral es deliberadamente **grueso**. No afirma "cumplís
// criterios": afirma "esto viene pasando hace rato", que es un hecho sobre lo
// que la persona registró y no una lectura clínica de su estado. Solo tiene que
// cumplir dos cosas: no gritar lobo, y no ser tan raro que nunca aparezca.

/** Un registro de ánimo, con su día. Ordenados del MÁS RECIENTE al más viejo —
 *  mismo contrato que devuelve `useMoodHistory`. */
export type RegistroAnimo = { moodId: number; dayKey: string };

/** Cuántos registros seguidos abajo hacen falta. */
export const REGISTROS_SEGUIDOS = 5;

/** El más viejo de esos registros tiene que caer dentro de esta ventana. */
export const VENTANA_DIAS = 14;

/** Qué se considera "abajo" en la escala de 1 a 5. */
export const UMBRAL_ANIMO = 2;

function diasEntre(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const ms = Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd);
  return Math.abs(Math.round(ms / 86400000));
}

/** ¿Corresponde mostrar el piso de seguridad?
 *
 *  Se cuentan **los últimos REGISTROS**, no días de calendario. La gente no
 *  registra todos los días, así que contar días haría que la señal se saltee por
 *  un fin de semana sin abrir la app — y saltearse justo ahí es el peor modo de
 *  falla posible. Contar registros es robusto a los huecos.
 *
 *  La ventana de VENTANA_DIAS existe para el problema opuesto: cinco registros
 *  bajos repartidos en dos meses no son un tramo malo sostenido, son cinco días
 *  malos sueltos. Sin la ventana, la señal se dispararía por eso.
 *
 *  ⚠️ `entries` tiene que venir ordenado del más reciente al más viejo. Si llega
 *  al revés, la función mira los cinco registros más ANTIGUOS y contesta sobre
 *  un tramo que ya pasó. */
export function detectarPisoSeguridad(entries: RegistroAnimo[], hoy: string): boolean {
  if (entries.length < REGISTROS_SEGUIDOS) return false;

  const ultimos = entries.slice(0, REGISTROS_SEGUIDOS);
  if (!ultimos.every(e => e.moodId <= UMBRAL_ANIMO)) return false;

  // El más viejo de los cinco es el último del corte, porque vienen en orden
  // descendente.
  const masViejo = ultimos[ultimos.length - 1].dayKey;
  return diasEntre(hoy, masViejo) <= VENTANA_DIAS;
}
