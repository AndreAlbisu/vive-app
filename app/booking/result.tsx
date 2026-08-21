import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ViveColors } from '@/constants/theme';

// booking/result — adónde aterriza la vuelta de Mercado Pago y de PayPal
// después de pagar. El camino completo es: `back_urls`/`return_url` (https,
// requisito del procesador) → la edge function `booking-return` → 302 a
// `viveapp://booking/result` → acá.
//
// Hay DOS formas de llegar, y hacen falta las dos:
//
//  1. La app siguió viva mientras la persona pagaba (el caso normal). Abajo,
//     en la pila, `BookingScreen_Confirm` está sondeando `payment_status` y va
//     a mandar a `/booking-success` en cuanto lo vea aprobado. Acá NO hay que
//     navegar a ningún lado: alcanza con salirse del medio con un `back()`, y
//     que siga el flujo que ya estaba en curso. Antes esta pantalla mandaba
//     siempre a mis-salas, y eso pisaba justamente ese flujo — la persona
//     terminaba de pagar y aterrizaba en una lista en vez de en la pantalla de
//     "reserva confirmada".
//
//  2. La app venía muerta y este deep link la abrió de cero (el SO la mató
//     mientras estaba en la app de Mercado Pago). No hay ninguna pantalla
//     debajo ni ningún sondeo esperando, así que sí hay que llevarla a algún
//     lado. Va a mis-salas: el resultado del pago ya está en el servidor
//     —`mp-webhook` escribió `payment_status` y confirmó la reserva antes de
//     que MP mostrara "aprobado"— así que la sesión ya figura ahí, confirmada.
export default function BookingResult() {
  const router = useRouter();

  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/mis-salas');
  }, [router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: ViveColors.background }}>
      <ActivityIndicator color={ViveColors.primary} />
    </View>
  );
}
