/**
 * La cuenta existe pero nunca confirmó el mail ("Confirm email" prendido desde
 * el 24/09/2026). Las pantallas de login la comparan para llevar a la pantalla
 * del código en vez de dejar un error sin salida.
 *
 * Vive acá y no en `AuthContext` porque `AuthModal` también la usa, y el
 * contexto ya importa el modal: importarla desde ahí sería un ciclo.
 */
export const ERR_MAIL_SIN_CONFIRMAR = 'Confirmá tu email antes de iniciar sesión';
