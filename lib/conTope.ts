/**
 * Un límite de tiempo para promesas que pueden no contestar nunca.
 *
 * 🔴 Existe por el arranque de la app (L40). `supabase.auth.getSession()` tiene
 * dos finales previstos —resuelve, o rechaza— y el código cubría los dos. El que
 * no estaba cubierto es el tercero: **que no pase ninguna de las dos cosas**. Una
 * conexión que acepta el socket y después se queda muda (wifi de hotel, datos con
 * señal pero sin tránsito, portal cautivo) deja la promesa pendiente para
 * siempre, y con ella el spinner de la pantalla de entrada.
 *
 * ⚠️ **No cancela nada, y es a propósito.** No hay forma de abortar una promesa
 * ajena, así que la original sigue viva: si contesta tarde, el que llamó decide
 * qué hacer con eso. Acá eso es bueno —una sesión que llega tarde igual sirve— y
 * por eso el helper devuelve `TOPE` en vez de rechazar: un rechazo se confundiría
 * con "falló la red", que es un caso distinto y ya tenía su rama.
 */

/** Lo que devuelve la carrera cuando gana el reloj. Es un símbolo y no `null`
 *  para que no pueda confundirse con un valor legítimo de la promesa. */
export const TOPE = Symbol('tope');

export function conTope<T>(promesa: Promise<T>, ms: number): Promise<T | typeof TOPE> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const reloj = new Promise<typeof TOPE>((resolve) => {
    timer = setTimeout(() => resolve(TOPE), ms);
  });

  // El `finally` no es cosmético: sin él el timer queda vivo hasta que se cumpla
  // el plazo aunque la promesa ya haya contestado, y en un test eso deja el
  // proceso abierto.
  return Promise.race([promesa, reloj]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}
