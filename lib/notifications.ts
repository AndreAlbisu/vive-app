import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[Notifs] Simulador detectado — saltando registro');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Notifs] Permisos denegados por el usuario');
    return null;
  }

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;

    if (!projectId) {
      console.log('[Notifs] Sin projectId — push tokens requieren dev build con EAS');
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id', userId);

    console.log('[Notifs] Token registrado:', token);
    return token;
  } catch (e) {
    console.error('[Notifs] Error obteniendo token:', e);
    return null;
  }
}

// Manda un push al destinatario a través de la edge function `send-push`, que
// busca el `push_token` con service role y valida que el que llama comparta con
// el destinatario la sala o el booking. Best-effort: un fallo no interrumpe el
// flujo (igual que cuando el envío era client-side).
//
// 🔴 Reemplaza el patrón viejo `select push_token` + envío directo a exp.host,
// que obligaba a que CUALQUIER usuario logueado pudiera leer el `push_token` de
// los coaches. Se pasa `salaId` O `bookingId` según el contexto: la función lo
// usa para autorizar el envío. Ver A4 en docs/problemas-abiertos.md.
export async function notifyViaServer(args: {
  salaId?: string;
  bookingId?: string;
  recipientId: string | null | undefined;
  title: string;
  body: string;
}): Promise<void> {
  if (!args.recipientId) return;
  try {
    await supabase.functions.invoke('send-push', {
      body: {
        salaId: args.salaId,
        bookingId: args.bookingId,
        recipientId: args.recipientId,
        title: args.title,
        body: args.body,
      },
    });
  } catch (e) {
    console.warn('[Notifs] no se pudo enviar el push por el servidor:', e);
  }
}
