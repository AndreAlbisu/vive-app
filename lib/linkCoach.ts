// El link público del coach (`/c/<slug>`) y lo que va con él.
//
// 🔴 POR QUÉ ESTÁ ACÁ Y NO EN UNA PANTALLA. Hasta el 11/09/2026 el link vivía
// solo en la tarjeta "Traé a tus primeros clientes" del Inicio, que se muestra
// únicamente al coach que TODAVÍA no tuvo ninguna reserva. Apenas entraba la
// primera, la tarjeta se iba y el link no aparecía en ningún otro lado: justo
// el coach que ya tiene clientes —el que más lo va a querer compartir— se
// quedaba sin forma de encontrarlo. Ahora también está fijo en el Perfil, y las
// dos pantallas lo arman con estas mismas funciones.

export const SITIO_WEB = 'https://vitaapp.com.ar';

type CoachParaLink = {
  slug: string | null | undefined;
  verified: boolean | null | undefined;
  availability_status: string | null | undefined;
};

/** El link, si el coach TIENE uno: aprobado y con slug. Esté o no en pausa. */
export function linkDelCoach(c: CoachParaLink): string | null {
  return c.verified && c.slug ? `${SITIO_WEB}/c/${c.slug}` : null;
}

/**
 * ¿Se puede mandar a repartir ahora mismo?
 *
 * ⚠️ Aprobado Y activo: son los dos filtros que aplica la página pública
 * (`web/c/index.html`). En pausa, el link muestra "no encontramos este
 * perfil", y mandar eso es peor que no mandar nada.
 */
export function linkCompartible(c: CoachParaLink): boolean {
  return !!linkDelCoach(c) && c.availability_status === 'activo';
}

/** El texto va escrito para que el coach lo mande TAL CUAL. Si tiene que
 *  redactarlo él, no lo manda. */
export function mensajeParaCompartir(link: string): string {
  return `Hola! Ahora podés reservar y pagar nuestras sesiones acá: ${link}\nElegís el horario que te quede bien y listo.`;
}
