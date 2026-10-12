import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// La respuesta física de la app, en un solo lugar y con tres intensidades.
// Quien la usa elige por lo que pasó (un toque, algo que quedó guardado, algo
// que se logró), no por el tipo de vibración: así la app se siente igual en
// todos lados y se ajusta de una vez.
//
// Ninguna espera ni falla hacia afuera: un teléfono sin motor o con la
// vibración apagada simplemente no vibra.

/** Un toque que cambia algo chico (elegir, marcar). Solo iOS: en Android el
 *  equivalente es demasiado brusco para algo tan liviano. */
export function vibrarToque() {
  if (Platform.OS !== 'ios') return;
  Haptics.selectionAsync().catch(() => {});
}

/** Algo quedó guardado. Suave: es un acuse de recibo, no un festejo. */
export function vibrarGuardado() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
}

/** Algo se logró (una reserva, una práctica terminada). Dos pulsos cortos, lo
 *  bastante claros para notarlos con los ojos cerrados. */
export function vibrarLogro() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
