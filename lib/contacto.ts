// contacto — la casilla a la que la gente le escribe a Vita, y cómo abrirla.
//
// 🔴 Existe porque la app decía "escribinos" en varios lugares SIN decir a
// dónde (encontrado el 17/09/2026). El caso más serio era el del coach
// sancionado: la notificación le ofrecía reclamar y no había ningún canal, lo
// que convertía la transparencia de la sanción en decorado.
//
// Es la misma casilla que figura en los Términos (garantía, arrepentimiento) y
// en la Política de Privacidad. Si se crea otra —por ejemplo en `vitaapp.com.ar`,
// que es desde donde salen los mails de la app—, se cambia acá, en
// `admin-actions` (EMAIL_CONTACTO) y en `constants/legal.ts`, los tres juntos.

import { Linking } from 'react-native';

export const EMAIL_CONTACTO = 'vitaappar@gmail.com';

/**
 * Abre el cliente de mail con el asunto ya puesto. Si el teléfono no tiene
 * ninguno configurado, `openURL` falla: se devuelve `false` para que la
 * pantalla muestre la dirección y la persona la copie.
 */
export async function escribirnos(asunto: string, cuerpo = ''): Promise<boolean> {
  const url = `mailto:${EMAIL_CONTACTO}?subject=${encodeURIComponent(asunto)}${cuerpo ? `&body=${encodeURIComponent(cuerpo)}` : ''}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
