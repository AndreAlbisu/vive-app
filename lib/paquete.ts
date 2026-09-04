// El paquete para la sesión — qué entra, qué ventana, y cuándo ofrecerlo.
//
// Puro: sin red, sin estado, sin `Date.now()` adentro. El diseño completo está
// en `docs/paquete-para-la-sesion.md`; acá viven las reglas que ese documento
// deja decididas, para poder revisarlas antes de que exista una pantalla.
//
// ── Qué es, en una línea ─────────────────────────────────────────────────────
// Antes de una sesión, la persona arma con lo que registró desde la última vez,
// lo revisa, y se lo manda a su profesional por el chat. No es un panel, no es
// un permiso, no es una conclusión de la app.
//
// ── 🔴 El principio que ordena todo: MATERIAL, NO CONCLUSIÓN ─────────────────
// Sale de la consulta a Mónica Grando: *"en sesión se trabaja y se asocia eso
// que sintió con lo que estaba sucediendo"*. **La asociación es el acto
// terapéutico y ocurre EN SESIÓN.** Por eso el paquete lleva el registro crudo y
// nunca una lectura de la app — ni promedios, ni tendencias, ni "tu ánimo sube
// después de las sesiones". Eso cierra un tema que le corresponde abrir al
// profesional.
//
// Y por eso también las devoluciones de "Sobre vos" quedan afuera: son palabras
// de la app, no de la persona.

/** Un día de la ventana, con lo que la persona registró ese día. */
export type DiaDelPaquete = {
  dayKey: string;
  moodId: number;
  moodLabel: string;
  /** Lo que ella escribió sobre ese día. Opcional y suyo — es el apareamiento
   *  que le da sentido al número, ver §4 del doc. */
  nota?: string | null;
};

export type Paquete = {
  desde: string;
  hasta: string;
  dias: DiaDelPaquete[];
  /** `true` si la ventana se cortó por el tope y no por una sesión anterior. */
  ventanaTopeada: boolean;
};

/** Tope de la ventana cuando no hay sesión anterior de dónde arrancar.
 *
 *  El doc pide "desde la última sesión" porque es la unidad natural del trabajo
 *  —"qué pasó entre que nos vimos"—, pero la primera vez no hay tal cosa. Sin un
 *  tope, alguien que registra hace tres meses manda noventa días, y ahí aparece
 *  el otro modo de falla que el doc nombra: **un paquete que nadie va a leer**. */
export const TOPE_DIAS = 30;

/** Con cuánta anticipación se ofrece armarlo. */
export const OFRECER_DESDE_DIAS = 3;

function diasEntre(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000);
}

function restarDias(dayKey: string, n: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - n));
  return dt.toISOString().slice(0, 10);
}

/** Arma el paquete con lo que hay en la ventana.
 *
 *  `ultimaSesion` es el día de la última sesión que ya ocurrió, o `null` si es
 *  la primera. `entries` puede venir en cualquier orden — se devuelven del más
 *  viejo al más nuevo, que es como se lee una secuencia de días.
 *
 *  ⚠️ El día de la última sesión NO entra: la ventana es lo que pasó DESPUÉS de
 *  verse. Incluirlo mezclaría material ya conversado con material nuevo. */
export function armarPaquete(params: {
  ultimaSesion: string | null;
  hoy: string;
  entries: DiaDelPaquete[];
}): Paquete {
  const { ultimaSesion, hoy, entries } = params;

  const topeMinimo = restarDias(hoy, TOPE_DIAS);
  const desdeSesion = ultimaSesion ? restarDias(ultimaSesion, -1) : null;
  const ventanaTopeada = !desdeSesion || desdeSesion < topeMinimo;
  const desde = ventanaTopeada ? topeMinimo : desdeSesion!;

  const dias = entries
    .filter(e => e.dayKey >= desde && e.dayKey <= hoy)
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey));

  return { desde, hasta: hoy, dias, ventanaTopeada };
}

/** ¿Corresponde ofrecerle armar el paquete?
 *
 *  🔴 Tres cosas que el doc marca como no negociables y que están acá:
 *
 *  · **Lo inicia la persona.** Esta función decide si se le OFRECE, nunca si se
 *    arma o se manda. El profesional no puede pedirlo.
 *  · **Se ofrece una vez y se puede descartar.** `yaSeOfrecio` corta. *"Si
 *    insiste, la app deja de acompañar y pasa a exigir — que es exactamente lo
 *    que este producto dice no ser."*
 *  · **Sin material no se ofrece.** Proponerle armar algo a quien no registró
 *    nada es pedirle trabajo para producir una hoja en blanco.
 */
export function debeOfrecerse(params: {
  /** Día de la próxima sesión agendada, o `null` si no hay. */
  proximaSesion: string | null;
  hoy: string;
  yaSeOfrecio: boolean;
  diasConRegistro: number;
}): boolean {
  const { proximaSesion, hoy, yaSeOfrecio, diasConRegistro } = params;
  if (yaSeOfrecio) return false;
  if (!proximaSesion) return false;
  if (diasConRegistro === 0) return false;

  const faltan = diasEntre(proximaSesion, hoy);
  // Una sesión que ya pasó no se prepara, y una a un mes tampoco: ofrecerlo con
  // demasiada anticipación es pedirle que arme algo que va a quedar viejo.
  return faltan >= 0 && faltan <= OFRECER_DESDE_DIAS;
}
