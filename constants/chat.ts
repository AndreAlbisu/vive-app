// Límites del chat.

/**
 * Cuánto puede tener un mensaje del chat.
 *
 * 🔴 **No es un número de estilo: lo fija el paquete para la sesión.** El input
 * es el mismo por el que pasa el paquete —se compone en `/paquete` y llega acá
 * como borrador para que la persona lo revise y lo mande ella (`draft`)—, así
 * que un límite por debajo de su peor caso **trunca en silencio material que
 * alguien eligió deliberadamente mandarle a su profesional**, y lo trunca por el
 * final: se pierden los días más recientes, que son los que más importan.
 *
 * ⚠️ **Estaba en 500 y no alcanzaba ni de lejos.** Con `TOPE_DIAS = 30` y
 * `TOPE_NOTA = 280` el peor caso son ~9.300 caracteres; incluso sin una sola
 * nota, 30 días son ~800. Los 500 se pasaban **a los 18 días sin notas, o a los
 * 2 con notas al tope**. Nunca fue un límite pensado para un mensaje compuesto
 * por la app: era el tope de tipeo de un chat, y el paquete no se tipea.
 *
 * 📌 La base no impone nada: `messages.content` es `text` pelado (SCHEMA.md), y
 * lo que se guarda es el XOR+base64, que infla ~33%. Nada de esto se acerca a un
 * límite real.
 *
 * Un test en `__tests__/paqueteTexto.test.ts` ata las dos puntas: si alguien
 * sube `TOPE_DIAS` o `TOPE_NOTA` por encima de esto, falla.
 */
export const MAX_LARGO_MENSAJE = 10000;
