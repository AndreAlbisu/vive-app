// La frase que hay que escribir para borrar la cuenta.
//
// 🔴 POR QUÉ. Dar de baja es irreversible y dispara reembolsos: un solo botón
// rojo se puede tocar sin querer, o por inercia después de leer dos párrafos.
// Escribir la frase obliga a un acto deliberado, y de paso hace que la persona
// vuelva a mirar la pantalla antes de confirmar.
//
// Vive acá y no adentro de una pantalla porque la baja existe en dos lugares
// —el perfil del usuario y los ajustes del coach— y una frase distinta en cada
// uno sería una trampa: la persona copia la que recuerda y no le funciona.

export const FRASE_BORRAR = 'BORRAR CUENTA';

/**
 * 📝 No distingue mayúsculas ni espacios de más. La fricción que se busca es
 * **escribir las dos palabras**, no acertarle a las mayúsculas: alguien
 * decidido a borrar su cuenta no tiene por qué pelear con el teclado.
 */
export function coincideBorrado(v: string): boolean {
  return v.trim().replace(/\s+/g, ' ').toUpperCase() === FRASE_BORRAR;
}
