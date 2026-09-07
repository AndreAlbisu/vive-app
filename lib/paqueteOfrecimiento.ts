import AsyncStorage from '@react-native-async-storage/async-storage';

// "Se ofrece una vez y se puede descartar" (§6 de `docs/paquete-para-la-sesion.md`).
//
// 🔴 Se trackea POR SESIÓN (id de la reserva), NO global: cada sesión futura
// merece su propio ofrecimiento — es la unidad natural del paquete ("qué pasó
// entre que nos vimos"). Un flag global lo ofrecería una vez en la vida y nunca
// más. Insistir con la MISMA sesión, en cambio, sería pasar de acompañar a
// exigir, que es justo lo que el producto dice no ser.
//
// Va en AsyncStorage y no en la base: es una preferencia de UI de un dispositivo,
// no un dato que haya que sincronizar. Mismo criterio que `sobreVosMomentoStorage`.

const KEY = (bookingId: string) => `paquete_ofrecido:${bookingId}`;

export async function yaSeOfrecio(bookingId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY(bookingId))) === '1';
  } catch {
    // Fail-open: si no se puede leer, se asume que NO se ofreció. El costo de
    // ofrecer de más es un banner descartable; el de no ofrecer nunca es perder
    // la feature entera.
    return false;
  }
}

export async function marcarOfrecido(bookingId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY(bookingId), '1');
  } catch {
    // Si no se pudo marcar, se volverá a ofrecer — molesto, no roto.
  }
}
