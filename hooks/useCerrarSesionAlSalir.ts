import { useEffect, useRef } from 'react';
import { useNavigation } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { limpiarAlta, pasoDelAlta } from '@/lib/altaCoach';
import { deleteMyAccount } from '@/lib/accountDeletion';

/**
 * Abandonar el alta **borra la cuenta**, no solo cierra la sesión.
 *
 * 🔴 Cerrar sesión no alcanzaba: la cuenta quedaba existiendo con
 * `role = 'user'` y sin fila en `coaches`, así que al volver a intentar con el
 * mismo mail el login entraba bien y el guard de `validateAndNavigate` la leía
 * como **un usuario final que quiere postularse** — "esta cuenta ya está
 * registrada como usuario, usá otro mail". La persona quedaba bloqueada de su
 * propia dirección por haber cancelado.
 *
 * Abandonar tiene que no dejar nada. La función `delete-account` reescribe el
 * mail a `deleted-<uuid>@vita.invalid`, así que **libera la dirección** y se
 * puede volver a empezar con la misma.
 *
 * ⚠️ Solo se borra si hay un alta en curso. Esa marca se pone únicamente para
 * cuentas que ESTE flujo acaba de crear (`isNewSignup`), así que es la garantía
 * de que nunca se toca una cuenta que ya existía. Es una acción destructiva:
 * el guard vale aunque hoy no haya forma de llegar sin la marca.
 *
 * 📝 Si el borrado falla igual se sigue: se limpia y se cierra sesión. Dejar a
 * la persona atrapada en la pantalla porque no se pudo borrar sería peor que
 * la cuenta huérfana.
 */
async function abandonarAlta(): Promise<void> {
  if (await pasoDelAlta()) {
    const res = await deleteMyAccount();
    if (!res.ok) console.warn('[alta] no se pudo borrar la cuenta abandonada:', res.message);
  }
  await limpiarAlta();
}

/**
 * Cierra la sesión cuando la persona se va de una pantalla del alta sin
 * terminarla.
 *
 * 🔴 POR QUÉ EXISTE. Al alta de coach se llega **ya logueado**: `signUpWithEmail`
 * crea la cuenta y abre sesión, y recién después manda al formulario. Si la
 * persona abandona, esa sesión queda viva con `profiles.role = 'user'` y el
 * `AuthRedirect` de `app/_layout.tsx` la manda derecho al Inicio — entra a la
 * app como usuario final sin haber terminado nada ni haberlo pedido.
 *
 * 🔴 POR QUÉ `beforeRemove` Y NO la limpieza de `useFocusEffect`. Esa fue la
 * primera versión y **perdía una carrera**: `signOut()` es asíncrono, así que
 * se disparaba mientras la navegación ya había ocurrido, y el `AuthRedirect`
 * alcanzaba a ver la sesión todavía viva en una pantalla de onboarding. La
 * persona terminaba igual en el Inicio, solo que un instante después.
 *
 * `beforeRemove` **frena la salida**, cierra la sesión, y recién entonces deja
 * ir. Para cuando la pantalla se desmonta ya no hay sesión que redirigir. De
 * paso cubre las tres salidas —el botón, el back de Android y el gesto de
 * deslizar— con un solo mecanismo.
 *
 * ⚠️ Todo por refs: con `signOut` o `activo` en las dependencias, un re-render
 * del contexto volvería a suscribir el listener en medio del formulario.
 */
export function useCerrarSesionAlSalir(activo: boolean) {
  const navigation = useNavigation();
  const { signOut } = useAuth();

  const terminado = useRef(false);
  const signOutRef = useRef(signOut);
  signOutRef.current = signOut;
  const activoRef = useRef(activo);
  activoRef.current = activo;

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove' as never, (e: unknown) => {
      const ev = e as { preventDefault: () => void; data: { action: unknown } };
      // Salió por la puerta buena (envió, o confirmó el código): la sesión es
      // justamente lo que tiene que seguir viva.
      if (terminado.current || !activoRef.current) return;

      ev.preventDefault();
      void abandonarAlta().then(() => signOutRef.current()).finally(() => {
        // La misma acción que se frenó, ya sin sesión detrás.
        (navigation as unknown as { dispatch: (a: unknown) => void }).dispatch(ev.data.action);
      });
    });
    return unsub;
  }, [navigation]);

  return {
    /** Llamar ANTES de navegar cuando la persona sí terminó el paso. */
    marcarTerminado: () => { terminado.current = true; },

    /**
     * Abandonar a propósito, desde un botón.
     *
     * 🔴 Existe porque `router.back()` NO alcanza: cuando se retoma un alta a
     * medias, el arranque llega con `router.replace` y **la pila queda vacía**,
     * así que el botón de volver no hacía absolutamente nada. Acá se hace la
     * limpieza y el que llama navega a donde corresponda, sin depender de que
     * haya historia detrás.
     */
    cancelar: async () => {
      terminado.current = true;   // la limpieza de `beforeRemove` ya no hace falta
      await abandonarAlta();
      await signOutRef.current();
    },
  };
}
