import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ViveColors } from '@/constants/theme';

// booking/result — el deep link al que apunta `booking-return` (y el que se le
// pasa a `WebBrowser.openAuthSessionAsync` como redirectUrl) después de pagar
// con MP. En el caso normal, `openAuthSessionAsync` intercepta este redirect
// DENTRO de su propia sesión y nunca llega a navegar de verdad: la promesa se
// resuelve, el browser se cierra solo, y `BookingScreen_Confirm` sigue su
// propio flujo (sondea `payment_status`, después navega a /booking-success).
//
// Esta pantalla es el fallback para cuando eso NO pasa — MP rompe la sesión y
// entrega el redirect a Safari, que lo abre como un deep link real (visto en
// dispositivo el 19/08/2026: "redirigió a Safari, pidió abrir Vita, y ahí
// quedó"). Antes esta ruta no existía, así que abrir la app por acá no tenía
// a dónde ir. El resultado del pago YA está en el servidor (mp-webhook
// escribió payment_status antes de que MP mostrara "aprobado"), así que no
// hace falta leer nada de acá: alcanza con mandar a la persona a ver sus
// sesiones.
export default function BookingResult() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/(tabs)/mis-salas');
  }, [router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: ViveColors.background }}>
      <ActivityIndicator color={ViveColors.primary} />
    </View>
  );
}
