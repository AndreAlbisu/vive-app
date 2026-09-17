// contactInfoGuard — detecta datos de contacto y vías de pago por fuera de VIVE.
//
// Se usa con DOS severidades según dónde está el texto (medida anti-fuga #2):
//   · PÚBLICO (presentación, especialidad, reseñas, recursos): bloquea. Es un
//     cartel que ve todo el mundo, no una conversación.
//   · PRIVADO (chat, notas compartidas, nota de una recomendación, mensaje al
//     reservar): avisa y deja enviar igual, y registra que pasó y entre quiénes.
//
// 🔴 En lo privado NUNCA bloquear. Es una conversación sobre salud mental: van a
// aparecer "llamame", "mi celular", "efectivo" por motivos que no tienen nada que
// ver con irse de la app. Un bloqueo con falsos positivos enseña a escribir
// "g u a s a p" — que ya no se detecta — y además se pierde el registro. El aviso
// no se pierde nada: disuade al que no es adversario y deja constancia del que sí.
//
// ⚠️ Es una capa del lado del teléfono. La detección en el servidor está
// pendiente a propósito: implica que VIVE revise el contenido de los mensajes, y
// esa finalidad tiene que estar declarada en la política de privacidad ANTES
// (Ley 25.326 — mismo criterio que `payer_fingerprint`).
//
// 📌 Lo que ningún detector va a ver: la videollamada. Si se lo dicen en voz
// alta, no hay texto. Por eso la defensa de fondo no es esto, son los incentivos
// (la comisión que baja, el 0% del link) y la escalera de sanciones.
//
// Medido el 16/09/2026 contra 17 formas comunes de pasarse el contacto: la
// versión anterior detectaba 3. Los casos están en `__tests__/contactInfoGuard.test.ts`,
// junto con los falsos positivos que NO tiene que disparar — que importan igual.

/** Qué tipo de señal se encontró. Va al evento de analítica en vez del texto:
 *  alcanza para medir qué se escapa y qué molesta, sin guardar la conversación. */
export type SenalContacto =
  | 'telefono'
  | 'numero_en_palabras'
  | 'mail'
  | 'link'
  | 'red_social'
  | 'pago_externo'
  | 'fuera_de_la_app'
  | 'pedido_de_contacto';

function normalize(s: string): string {
  // minúsculas + sin tildes, para que 'Instágram' / 'número' matcheen igual.
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// ── Datos concretos ──────────────────────────────────────────────────────────
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/;
// "juan @ gmail com", "juan arroba gmail", "juan gmail" — el mail escrito para
// esquivar al regex de arriba. Los dominios van como palabra completa.
const MAIL_ESQUIVADO = /@\s+[a-z]|\barroba\b|\b(gmail|hotmail|outlook|yahoo|icloud)\b|\bpunto com\b/;
// http(s)://, www. o un dominio suelto con TLD común (incluye wa.me, t.me).
const URL = /(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|ar|io|me|ee|link|app|co|ly|ai)\b/;
// 7+ dígitos con separadores → teléfono o CBU/CVU. Las letras cortan la corrida,
// así que "el 15/09 a las 18:00" o "20 años, 15 sesiones" no disparan.
const PHONE = /(?:\d[\s.()-]*){7,}/;
const HANDLE = /@[a-z0-9._]{2,}/;

// ── Plataformas ──────────────────────────────────────────────────────────────
// Incluye las variantes mal escritas a propósito ("guasap", "wasap") y las
// abreviaturas de uso diario ("ig", "insta", "wpp"). "zoom" y "meet" entran
// porque en este contexto casi siempre quieren decir "la sesión, por fuera".
const RED_SOCIAL = new RegExp(
  '\\b(' + [
    'whatsapp', 'whatsap', 'watsap', 'wasap', 'guasap', 'wasa', 'wsp', 'wpp', 'wapp', 'whats',
    'telegram', 'instagram', 'insta', 'ig', 'tiktok', 'facebook', 'fb', 'linkedin',
    'twitter', 'snapchat', 'discord', 'zoom', 'meet', 'skype', 'signal',
  ].join('|') + ')\\b',
);

// ── Plata por fuera ──────────────────────────────────────────────────────────
// 🔴 "transferencia" SOLA no está, y no es un olvido: en psicología es un
// concepto clínico central (transferencia y contratransferencia). Hasta el
// 16/09/2026 estaba, y un psicoanalista no podía guardar su presentación. Lo que
// sí indica pago es la FRASE: "por transferencia", "te transfiero".
// Lo mismo con "efectivo" ("fue muy efectivo") → solo "en efectivo".
const PAGO_EXTERNO = /\b(cbu|cvu|alias|mercado ?pago|mp|uala|brubank|en efectivo|por transferencia|te transfiero|transferime|transferile|te paso los datos para pagar)\b/;

// ── Irse de la app, dicho con todas las letras ───────────────────────────────
// ⚠️ "por fuera" solo NO: "por fuera me muestro bien pero por dentro no" es una
// frase que va a aparecer en una charla terapéutica. Tiene que decir de QUÉ.
const FUERA_DE_LA_APP = /\b((por )?a?fuera de (la app|vive|la plataforma|la aplicacion)|sin (la app|vive|la plataforma|pasar por la app)|sin comision|por privado|te sale mas barato|lo arreglamos entre nosotros)\b/;

// ── Pedir o pasar el contacto ────────────────────────────────────────────────
// Posesivo + dato: "mi celu", "pasame tu número". Sin el posesivo, "se me rompió
// el celular" o "el número de sesiones" disparaban por nada.
const PEDIDO_DE_CONTACTO = /\b((mi|tu|su) (celu|cel|celular|numero|num|nro|telefono|tel|mail|correo|usuario)|te paso mi|pasame tu|agendame|llamame|escribime (al|por)|mandame (un )?(mensaje|audio|mail) (al|por))\b/;

// ── Número dictado en palabras ───────────────────────────────────────────────
// "once cincuenta y cinco cincuenta y cinco cuarenta y cuatro". Lo que dispara es
// una CORRIDA de 6 o más palabras-número seguidas, con "y" permitida en el medio
// — que es como se dicta un teléfono.
//
// 🔴 Seguidas, no en total. La primera versión contaba todas las del mensaje, y
// "una" y "uno" son artículos y pronombres: "fue una semana dura, una de esas
// donde uno siente…" disparaba sin un solo número. Encontrado antes de salir.
const PALABRA_NUMERO = /^(cero|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieci\w+|veinte|veinti\w+|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)$/;
const MIN_PALABRAS_NUMERO = 6;

function corridaDePalabrasNumero(t: string): number {
  let mejor = 0;
  let actual = 0;
  for (const palabra of t.split(/[^a-z0-9]+/).filter(Boolean)) {
    if (PALABRA_NUMERO.test(palabra)) { actual += 1; mejor = Math.max(mejor, actual); }
    else if (palabra !== 'y') actual = 0;   // "cincuenta y cinco" no corta la corrida
  }
  return mejor;
}

/** La primera señal que aparece en el texto, o `null` si no hay ninguna. */
export function detectContactInfo(text: string): SenalContacto | null {
  const t = normalize(text);
  if (EMAIL.test(t) || MAIL_ESQUIVADO.test(t)) return 'mail';
  if (PHONE.test(t)) return 'telefono';
  if (URL.test(t)) return 'link';
  if (HANDLE.test(t) || RED_SOCIAL.test(t)) return 'red_social';
  if (PAGO_EXTERNO.test(t)) return 'pago_externo';
  if (FUERA_DE_LA_APP.test(t)) return 'fuera_de_la_app';
  if (PEDIDO_DE_CONTACTO.test(t)) return 'pedido_de_contacto';
  if (corridaDePalabrasNumero(t) >= MIN_PALABRAS_NUMERO) return 'numero_en_palabras';
  return null;
}

/** true si el texto parece incluir datos de contacto o vías de pago externas. */
export function hasContactInfo(text: string): boolean {
  return detectContactInfo(text) !== null;
}

/**
 * Lo mismo, pero mirando también el mensaje anterior de la misma persona.
 *
 * Existe por UNA evasión concreta: partir el teléfono en dos mensajes ("11 5555"
 * y después "4444"). Solo se junta la cola del anterior con el actual, y solo
 * para teléfonos — juntar mensajes enteros haría disparar cualquier cosa.
 */
export function detectContactInfoAcross(previous: string | null | undefined, text: string): SenalContacto | null {
  const directa = detectContactInfo(text);
  if (directa) return directa;
  if (!previous) return null;
  const cola = normalize(previous).slice(-24);
  return PHONE.test(`${cola} ${normalize(text)}`) ? 'telefono' : null;
}

// ── Datos para cobrar, mandados por el PROFESIONAL ───────────────────────────
//
// 🔴 La ÚNICA excepción a "en lo privado nunca se bloquea", y por qué lo es: un
// teléfono en el chat puede ser inocente; un CBU que manda el coach, no. VIVE
// cobra a la persona y VIVE le paga al coach, así que el coach no tiene ningún
// motivo legítimo para pasarle datos para cobrar. Casi sin falsos positivos, y es
// exactamente el acto que convierte la fuga en plata.
//
// Acotado a propósito a lo inequívoco (decisión de Andre, 16/09/2026):
//   · un CBU/CVU completo — 22 dígitos, con o sin separadores;
//   · un link de cobro (Mercado Pago, PayPal.me, Cafecito);
//   · "alias" seguido de algo con forma de alias (con punto: juan.coach.mp).
// La palabra "alias" suelta NO: "alias el Loco" no es un dato de pago. Lo demás
// (un "pagame en efectivo", un teléfono) sigue siendo aviso, no bloqueo.
//
// ⚠️ Se aplica solo cuando escribe el profesional. Si la persona manda su CBU,
// sigue siendo el aviso de siempre.
const CBU_CVU = /(?:\d[\s.-]*){22}/;
const LINK_DE_COBRO = /\b(mpago\.la|mpago\.li|link\.mercadopago\.com|mercadopago\.com(\.ar)?\/|paypal\.me|paypal\.com\/paypalme|cafecito\.app)/;
const ALIAS_CON_VALOR = /\balias\b[\s:=-]*(es\s+)?[a-z0-9-]+\.[a-z0-9.-]+/;

/** true si el texto trae datos concretos para cobrar por fuera de VIVE. */
export function hasDatosDeCobro(text: string): boolean {
  const t = normalize(text);
  return CBU_CVU.test(t) || LINK_DE_COBRO.test(t) || ALIAS_CON_VALOR.test(t);
}

// Dominios cuyo único propósito es contactar a alguien o llevarlo a otra parte.
// Para el campo de link de un recurso, donde un link es lo esperable: ahí no
// alcanza con "tiene un link", importa ADÓNDE va.
const DOMINIOS_DE_CONTACTO = /(^|\.|\/\/)(instagram\.com|instagr\.am|wa\.me|whatsapp\.com|t\.me|telegram\.me|facebook\.com|fb\.me|m\.me|tiktok\.com|linktr\.ee|beacons\.ai|linkedin\.com|calendly\.com|twitter\.com|x\.com|bit\.ly)(\/|$)/;

/** true si un link apunta a una red social, un linktree o un acortador. */
export function isContactLink(url: string): boolean {
  return DOMINIOS_DE_CONTACTO.test(normalize(url.trim()));
}
