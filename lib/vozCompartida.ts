// La voz de Sofía no vive solo en la tarjeta de Inicio: también habla en el
// Diario y en Gratitud. La tarjeta tiene un guardarraíl (`rejectCopy`) y un test
// que barre sus 35 frases; **estas otras superficies no tenían ninguno**, y por
// eso nacieron con el mismo bug dos veces —"cansado" en el Diario, "agradecido"
// en Gratitud—: un adjetivo con género sobre quien lee. Los dos se encontraron a
// mano el 08/09 (`docs/problemas-abiertos.md` C7), y lo que quedó abierto era que
// **nada lo verifica**: el copy vivía suelto en el JSX de cada pantalla, así que
// no había nada enumerable que recorrer.
//
// Este módulo cierra eso con dos cosas:
//  1. Junta ese copy en un BANCO enumerable (`COPY_VOZ_COMPARTIDA`). Las
//     pantallas importan de acá, así que el banco ES lo que se muestra: no puede
//     quedar desincronizado del JSX.
//  2. `rejectVozCompartida()` — el subconjunto de reglas de la voz que valen en
//     CUALQUIER superficie. El test lo corre sobre todo el banco.
//
// 🔴 Por qué un SUBCONJUNTO y no `rejectCopy` entero: varias de sus reglas son
// específicas de la tarjeta y darían falsos positivos acá.
//  · Largo mínimo/máximo: la tarjeta son dos oraciones; un prompt es un título
//    de tres palabras ("¿Qué agradecés hoy?").
//  · `NIVEL_MASCULINO` incluye `tranquilo`, que en "Un día tranquilo" concuerda
//    con "día" y es correcto — lo dice la propia nota de esa regla en
//    `weeklyReflection.ts`.
//  · `CONCORDANCIA_SEMANA`: su sujeto tácito es "la semana", que acá no existe.
//  · Exclamaciones: en la tarjeta están prohibidas; en el Diario
//    ("¡Hoy estás brillando!") es una decisión de Andre TODAVÍA ABIERTA (C7). No
//    se enforce acá para no adelantar una decisión de voz que no es nuestra.
//
// Solo se enforce lo ya decidido y sin ambigüedad de superficie: un adjetivo con
// género dirigido a quien lee, el tuteo, la app poniéndose de testigo, y el
// lenguaje clínico.

export type Prompt = { lead: string; pregunta: string; cierre?: string };

// ─────────────────────────────────────────────────────────────────────────────
// El copy — antes vivía en app/diario.tsx y app/gratitud.tsx
// ─────────────────────────────────────────────────────────────────────────────

// `pregunta` es lo que se responde, `cierre` acompaña.
//
// 🔴 El nivel 2 decía *"Se nota que estás cansado."* — rompía DOS reglas de la
// voz: "se nota que" es la app de testigo, y "cansado" le asigna género a quien
// lee. Ahora las dos las caza `rejectVozCompartida` (test abajo).
export const MOOD_PROMPTS: Record<number, Prompt> = {
  1: { lead: 'Hoy venís con un bajón.',     pregunta: '¿Qué es lo que más te está pesando?',        cierre: 'Soltalo acá, sin filtro.' },
  2: { lead: 'Hoy venís con poca energía.', pregunta: '¿Qué te está drenando la energía estos días?' },
  3: { lead: 'Un día tranquilo.',           pregunta: '¿Qué anduvo dando vueltas por tu cabeza hoy?' },
  4: { lead: 'Venís bien hoy.',             pregunta: '¿Qué fue lo que sumó para sentirte así?' },
  5: { lead: '¡Hoy estás brillando!',       pregunta: '¿Qué hizo especial este día?',              cierre: 'Dejalo guardado acá.' },
};

// La primera vez —sin ninguna entrada todavía— gana la bienvenida aunque haya
// un ánimo elegido.
export const PROMPT_BIENVENIDA: Prompt = {
  lead: 'Este es tu espacio.',
  pregunta: 'Escribí lo que necesites descargar, sin juzgarte.',
};

export const CIERRE_DEFAULT = 'No hay respuesta correcta. Escribí lo que te salga.';

// 🔴 Gratitud preguntaba *"¿Por qué estás agradecido hoy?"* — misma familia que
// "cansado". "agradecido" NO estaba en `NIVEL_MASCULINO`, así que `rejectCopy` no
// lo habría cazado; fue hallazgo manual. La regla de `rejectVozCompartida` es más
// general (cualquier adjetivo con género pegado a un verbo en segunda persona) y
// sí lo caza.
export const GRATITUD_TITULO = '¿Qué agradecés hoy?';
export const GRATITUD_SUBTITULO = 'Tres cosas, grandes o pequeñas.\nLo que importa es que sean tuyas.';

/** Todo el copy de voz aplanado a las cadenas que le hablan a la persona, para
 *  que el guardarraíl las recorra todas. Se arma de las constantes de arriba, no
 *  a mano: agregar un prompt nuevo lo mete en el barrido sin tocar el test. */
export function bancoVozCompartida(): string[] {
  const out: string[] = [];
  const agregarPrompt = (p: Prompt) => {
    out.push(p.lead, p.pregunta);
    if (p.cierre) out.push(p.cierre);
  };
  Object.values(MOOD_PROMPTS).forEach(agregarPrompt);
  agregarPrompt(PROMPT_BIENVENIDA);
  out.push(CIERRE_DEFAULT, GRATITUD_TITULO, GRATITUD_SUBTITULO);
  return out;
}

export const COPY_VOZ_COMPARTIDA: string[] = bancoVozCompartida();

// ─────────────────────────────────────────────────────────────────────────────
// El guardarraíl transversal
// ─────────────────────────────────────────────────────────────────────────────

// `\b` de JS no cierra una palabra en español (una vocal acentuada ya es
// "no-palabra"): ver la nota larga en `weeklyReflection.ts`. Mismo remedio.
const FIN = '(?![a-záéíóúüñ])';
const re = (body: string) => new RegExp(body.replace(/#/g, FIN), 'i');

/** 🔴 Adjetivo con género pegado a un verbo en SEGUNDA persona: "estás cansado",
 *  "venís agradecida", "andás perdido". Cuando el sujeto es "vos", cualquier
 *  adjetivo ahí es sobre quien lee — no hay un "la semana"/"el día" que lo
 *  concuerde legítimamente, así que se rechazan los dos géneros.
 *
 *  Generaliza el `GENDERED` de la tarjeta (que solo mira `venís`) a las otras
 *  formas copulativas. Las mismas exclusiones que allá: "venís a …", "venís más
 *  …", "estás para …", "bien/mejor/peor", "atravesando", y el "de estar/andar"
 *  del rodeo. Los gerundios (-ando/-endo) no terminan en -ado/-ido, así que
 *  "estás brillando" no entra solo. */
const GENERO_A_QUIEN_LEE = re(
  '\\b(ven[íi]s|est[áa]s|and[áa]s|segu[íi]s)\\s+' +
  '(?!a |m[áa]s |un |bien|mejor|peor|para |atravesando |de )' +
  '\\w+(ad[oa]|id[oa]|os[oa])#',
);

/** La app poniéndose de testigo. Idéntica a la de `rejectCopy`: la postura no
 *  depende de la pantalla. */
const TESTIGO = /\b(lo veo|te veo|se te nota|se nota que|veo que|noto que)\b/i;

/** Tuteo. La voz es de "vos" en toda la app, no solo en la tarjeta. */
const TUTEO = re('\\b(tienes|puedes|quieres|llevas|vienes|sientes|sabes|debes|haces|necesitas|piensas|empiezas|vuelves|registras|escribes|eres)#');

/** Vocabulario clínico. La app acompaña, no diagnostica — en cualquier pantalla. */
const CLINICAL = /\b(depresi[óo]n|depresiv|ansiedad generalizada|trastorno|s[íi]ntoma|diagn[óo]stic|patol[óo]g|terapia cognitiv|episodio)/i;

export type RechazoVoz =
  | 'genera a la persona'
  | 'la app se pone de testigo'
  | 'tutea'
  | 'lenguaje clínico';

/** ¿Se puede mostrar esta línea en una superficie que habla con la voz de Sofía?
 *  `null` = sí. Si no, el motivo.
 *
 *  📌 A diferencia de `rejectCopy`, esto NO corre en producción: el copy de estas
 *  pantallas es fijo, así que alcanza con un test que lo barra. No hay un modelo
 *  generando nada acá que haya que frenar en vivo. */
export function rejectVozCompartida(text: string): RechazoVoz | null {
  const t = text.trim();
  if (TESTIGO.test(t)) return 'la app se pone de testigo';
  if (GENERO_A_QUIEN_LEE.test(t)) return 'genera a la persona';
  if (TUTEO.test(t)) return 'tutea';
  if (CLINICAL.test(t)) return 'lenguaje clínico';
  return null;
}
