// contactInfoGuard — detecta datos de contacto / vías de pago externas en texto
// de cara al público (hoy: bio del coach). Sirve para que el perfil no sea un
// canal para derivar la relación fuera de la app (medida anti-fuga #2, ver
// memoria project_vive_anti_disintermediation).
//
// Es una PRIMERA capa client-side: setea la norma y frena al coach no adversario.
// Una capa server-side (trigger/edge function) queda como posible refuerzo si se
// detecta que alguien la evade a propósito.

function normalize(s: string): string {
  // minúsculas + sacar tildes, para que 'Instágram'/'instagram' matcheen igual.
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/;
// links: http(s)://, www. o dominio suelto con TLD común.
const URL = /(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|ar|io|me|link|app|co)\b/;
// 7+ dígitos permitiendo separadores → teléfono o CBU/CVU. Las letras cortan la
// corrida, así que "20 años, 15 sesiones" no dispara (hay palabras en el medio).
const PHONE = /(?:\d[\s.()-]*){7,}/;
// palabras completas (\b) para no pegarle a "instantáneo", "instalar", etc.
const KEYWORDS = /\b(whatsapp|wasap|wsp|wpp|telegram|instagram|tiktok|facebook|cbu|cvu|alias|transferencia)\b/;
const HANDLE = /@[a-z0-9._]+/; // @usuario de redes

/** true si el texto parece incluir datos de contacto o vías de pago externas. */
export function hasContactInfo(text: string): boolean {
  const t = normalize(text);
  return EMAIL.test(t) || URL.test(t) || PHONE.test(t) || KEYWORDS.test(t) || HANDLE.test(t);
}
