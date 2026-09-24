/**
 * La cuenta existe pero nunca confirmó el mail ("Confirm email" prendido desde
 * el 24/09/2026). Las pantallas de login la comparan para llevar a la pantalla
 * del código en vez de dejar un error sin salida.
 *
 * Vive acá y no en `AuthContext` porque `AuthModal` también la usa, y el
 * contexto ya importa el modal: importarla desde ahí sería un ciclo.
 */
export const ERR_MAIL_SIN_CONFIRMAR = 'Confirmá tu email antes de iniciar sesión';

/**
 * Largo mínimo de una contraseña NUEVA (alta o cambio). Tiene que coincidir con
 * "Minimum password length" del panel de Supabase (Authentication → Providers →
 * Email). Subido de 6 a 8 el 24/09/2026: con 6 pasan "123456" o "boca12".
 *
 * ⚠️ Solo para crear o cambiar. Nunca al ENTRAR: una cuenta vieja con 6 o 7
 * caracteres tiene que poder seguir entrando (Supabase no la invalida).
 */
export const LARGO_MIN_CONTRASENA = 8;
