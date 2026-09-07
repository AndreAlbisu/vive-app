import AsyncStorage from '@react-native-async-storage/async-storage';

// "Se ofrece una vez y se puede descartar" (§6 de `docs/paquete-para-la-sesion.md`).
//
// 🔴 Lo que se guarda es el DESCARTE (el ✕ = "ahora no"), NO el hecho de haberlo
// mostrado. Diferencia clave: si alguien toca "Armar" y vuelve atrás sin mandar,
// el banner tiene que SEGUIR ahí para poder reentrar — es su único punto de
// entrada. Marcar al aceptar lo dejaba sin forma de volver. Solo el "no ahora"
// lo calla, y respeta el "se puede descartar": insistir tras un no sería exigir.
//
// 🔴 Se trackea POR SESIÓN (id de la reserva): cada sesión futura merece su
// ofrecimiento. Un flag global lo callaría para siempre tras el primer descarte.
//
// 📌 Pendiente (refinamiento): marcar también al ENVIAR el paquete, para que no
// reaparezca una vez mandado. Necesita pasarle el bookingId a la pantalla —
// menor, y hoy reaparecer es descartable, no roto.
//
// Va en AsyncStorage y no en la base: preferencia de UI de un dispositivo, no un
// dato a sincronizar. Mismo criterio que `sobreVosMomentoStorage`.

const KEY = (bookingId: string) => `paquete_descartado:${bookingId}`;

export async function yaSeDescarto(bookingId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY(bookingId))) === '1';
  } catch {
    // Fail-open: si no se puede leer, se asume que NO se descartó → se ofrece.
    // El costo de ofrecer de más es un banner descartable; no ofrecer nunca
    // sería perder la feature.
    return false;
  }
}

export async function marcarDescartado(bookingId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY(bookingId), '1');
  } catch {
    // Si no se pudo marcar, se volverá a ofrecer — molesto, no roto.
  }
}
