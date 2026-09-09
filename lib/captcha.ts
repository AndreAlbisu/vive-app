// El portero contra el alta masiva de cuentas.
//
// 🔴 POR QUÉ EXISTE, Y QUÉ **NO** RESUELVE. La verificación de mail que ya
// tenemos (`lib/emailVerificado.ts`) no frena a nadie que quiera crear cientos
// de cuentas: para cuando la pantalla del código aparece, `signUp` YA creó la
// fila en `auth.users` y la de `profiles` que cuelga del trigger. Y un script
// que abusa del alta no abre la app — le pega derecho al endpoint de Supabase,
// donde ninguna pantalla nuestra corre. La app es el cliente, no el portero.
//
// El portero real es el CAPTCHA de Supabase Auth (Settings → Authentication →
// Bot and Abuse Protection), que se valida EN EL SERVIDOR antes de crear nada.
// Este archivo es solo la mitad del cliente: conseguir el token que ese
// chequeo del servidor va a pedir.
//
// ⚠️ FALLA ABIERTO A PROPÓSITO, y acá el motivo es distinto al de
// `emailVerificado.ts`. Sin `EXPO_PUBLIC_HCAPTCHA_SITE_KEY` esto devuelve
// `undefined` y las llamadas de auth salen exactamente como salen hoy. Eso es
// lo que hace que prender el CAPTCHA sea un cambio de config y no un
// despliegue coordinado, y es lo que mantiene vivo el desarrollo local sin
// clave. No es un agujero: si el server tiene el CAPTCHA prendido y el cliente
// no manda token, **el server rechaza igual**. Quien decide es el server.

import { Platform } from 'react-native';

export const CAPTCHA_SITE_KEY = process.env.EXPO_PUBLIC_HCAPTCHA_SITE_KEY;

/** El origen que se le declara al WebView. Tiene que estar en los hostnames
 *  permitidos de la site key de hCaptcha (o la verificación de hostname
 *  apagada, que es lo normal para apps nativas: un WebView no tiene dominio). */
export const CAPTCHA_ORIGEN = 'https://vitaapp.com.ar';

export function captchaActivo(): boolean {
  return !!CAPTCHA_SITE_KEY;
}

type Resolver = (token: string | undefined) => void;

/** Lo publica `CaptchaHost` al montarse. Sin host montado no hay forma de
 *  resolver un desafío, así que `pedirCaptchaToken` devuelve `undefined`. */
let ejecutar: ((resolver: Resolver) => void) | null = null;

export function registrarCaptchaHost(fn: ((resolver: Resolver) => void) | null) {
  ejecutar = fn;
}

/**
 * Un token de un solo uso para la próxima llamada de auth.
 *
 * ⚠️ NO se cachea: hCaptcha los quema al validarlos y Supabase valida uno por
 * request. Reusar el de un intento fallido de login haría fallar el siguiente
 * por un motivo que no tiene nada que ver con la contraseña.
 *
 * 📝 El timeout no es un límite de paciencia: el desafío visible puede tardar
 * lo que la persona tarde. Es contra el caso en que el widget nunca contesta
 * (hCaptcha bloqueado en la red, WebView que no cargó) — ahí devolver
 * `undefined` y dejar que el server conteste es mejor que colgar el botón.
 */
export function pedirCaptchaToken(): Promise<string | undefined> {
  if (!captchaActivo() || !ejecutar) return Promise.resolve(undefined);

  return new Promise(resolve => {
    let listo = false;
    const unaVez: Resolver = token => {
      if (listo) return;
      listo = true;
      resolve(token);
    };
    const t = setTimeout(() => {
      console.warn('[captcha] sin respuesta del widget, sigue sin token');
      unaVez(undefined);
    }, 60_000);
    ejecutar!(token => { clearTimeout(t); unaVez(token); });
  });
}

/** El HTML del widget invisible. Se usa dentro de un WebView en nativo; en web
 *  el script se inyecta en el documento real y esto no hace falta. */
export function htmlDelWidget(siteKey: string): string {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}</style>
<script src="https://js.hcaptcha.com/1/api.js?render=explicit&onload=alCargar" async defer></script>
</head><body><div id="c"></div><script>
  var id = null;
  function avisar(m){ window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  function alCargar(){
    id = hcaptcha.render('c', {
      sitekey: ${JSON.stringify(siteKey)},
      size: 'invisible',
      callback: function(t){ avisar({ tipo: 'token', token: t }); },
      'error-callback': function(e){ avisar({ tipo: 'error', detalle: String(e) }); },
      'expired-callback': function(){ avisar({ tipo: 'error', detalle: 'expirado' }); },
      // Cuando hCaptcha decide que esta sesión no le cierra, abre un desafío
      // visible. El WebView mide 0x0 mientras tanto, así que sin estos dos
      // avisos el desafío se dibujaría en un recuadro invisible y el alta
      // quedaría colgada para siempre sin que la persona vea por qué.
      'open-callback': function(){ avisar({ tipo: 'abierto' }); },
      'close-callback': function(){ avisar({ tipo: 'cerrado' }); },
    });
    avisar({ tipo: 'listo' });
  }
  // La llama el host con \`injectJavaScript\`. Se prefiere eso a mandar un
  // \`postMessage\` HACIA el WebView porque el listener correcto difiere entre
  // iOS y Android y es una fuente clásica de mensajes que no llegan nunca.
  window.ejecutarCaptcha = function(){
    if (id === null) { avisar({ tipo: 'error', detalle: 'sin widget' }); return; }
    hcaptcha.reset(id);
    hcaptcha.execute(id);
  };
</script></body></html>`;
}

/** En web no hay WebView: el script va al documento de verdad. */
export const ES_WEB = Platform.OS === 'web';
