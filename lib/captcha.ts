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
// 📌 POR QUÉ TURNSTILE Y NO hCAPTCHA. Supabase acepta los dos. hCaptcha cobra
// el modo de baja fricción ("99.9% Passive") como parte de Pro, US$139/mes; en
// el tier gratis el desafío visible aparece seguido, que es exactamente la
// fricción en el alta que la sesión 147 decidió no poner. Turnstile es gratis,
// sin límite de requests, y no interactivo por diseño en vez de por upgrade.
// Del lado de Supabase el campo es el mismo `captchaToken` para los dos, así
// que volver atrás es cambiar este archivo y nada más.
//
// ⚠️ FALLA ABIERTO A PROPÓSITO, y acá el motivo es distinto al de
// `emailVerificado.ts`. Sin `EXPO_PUBLIC_TURNSTILE_SITE_KEY` esto devuelve
// `undefined` y las llamadas de auth salen exactamente como salen hoy. Eso es
// lo que hace que prender el CAPTCHA sea un cambio de config y no un
// despliegue coordinado, y es lo que mantiene vivo el desarrollo local sin
// clave. No es un agujero: si el server tiene el CAPTCHA prendido y el cliente
// no manda token, **el server rechaza igual**. Quien decide es el server.

export const CAPTCHA_SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY;

/** El origen que se le declara al WebView. Tiene que estar en los dominios del
 *  widget en el panel de Cloudflare: un WebView no tiene dominio propio, así
 *  que el que vale es el que declaramos acá. Si cambia el dominio, cambia esto.
 *
 *  ⚠️ Es lo ÚNICO que las claves de prueba no ejercitan — andan en cualquier
 *  dominio a propósito. Ver `docs/anti-abuso-altas.md`. */
export const CAPTCHA_ORIGEN = 'https://vitaapp.com.ar';

export function captchaActivo(): boolean {
  return !!CAPTCHA_SITE_KEY;
}

// 🔴 Al arrancar, y una sola vez. "Sin site key" y "widget funcionando" se ven
// EXACTAMENTE IGUAL desde afuera —alta instantánea, consola limpia— y son cosas
// opuestas: una es el portero puesto y la otra es no tener ninguno. Sin esta
// línea, la única forma de distinguirlos es prender el CAPTCHA en el server y
// ver si la app se rompe, que es tarde.
console.log(captchaActivo()
  ? '[captcha] activo (Turnstile)'
  : '[captcha] SIN site key: las llamadas de auth salen sin token. ' +
    'En local revisá .env (EXPO_PUBLIC_TURNSTILE_SITE_KEY); en un build de EAS, `eas env:list`.');

type Resolver = (token: string | undefined) => void;

/** Lo publica `CaptchaHost` al montarse. Sin host montado no hay forma de
 *  resolver un desafío, así que `pedirCaptchaToken` devuelve `undefined`. */
let ejecutar: ((resolver: Resolver) => void) | null = null;
/** Cierra un desafío abierto. Lo llama el timeout de abajo: si no, el pedido se
 *  resuelve pero el desafío queda dibujado encima de todo, tapando la app. */
let cancelarHost: (() => void) | null = null;

export function registrarCaptchaHost(
  fn: ((resolver: Resolver) => void) | null,
  cancelar: (() => void) | null = null,
) {
  ejecutar = fn;
  cancelarHost = cancelar;
}

/**
 * Un token de un solo uso para la próxima llamada de auth.
 *
 * ⚠️ NO se cachea: Turnstile los quema al validarlos y Supabase valida uno por
 * request. Reusar el de un intento fallido de login haría fallar el siguiente
 * por un motivo que no tiene nada que ver con la contraseña.
 *
 * 📝 El timeout no es un límite de paciencia: el desafío visible puede tardar
 * lo que la persona tarde. Es contra el caso en que el widget nunca contesta
 * (Turnstile bloqueado en la red, WebView que no cargó) — ahí devolver
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
      cancelarHost?.();
      unaVez(undefined);
    }, 60_000);
    ejecutar!(token => {
      clearTimeout(t);
      // Solo en desarrollo: confirma que el token llegó de verdad. En release
      // no va — es ruido por cada login, y el token es material sensible.
      if (__DEV__) console.log('[captcha] token obtenido:', token ? `sí (${token.length} chars)` : 'NO');
      unaVez(token);
    });
  });
}

/** Las opciones de `turnstile.render()`, compartidas por el WebView y por web.
 *
 *  `execution: 'execute'` — no arranca solo al renderizar; lo dispara
 *  `turnstile.execute()` cuando alguien pide un token. Sin esto el widget
 *  gastaría un desafío al abrir la app, y ese token estaría vencido para cuando
 *  se use.
 *
 *  `appearance: 'interaction-only'` — solo se muestra si hace falta que la
 *  persona haga algo. En el camino normal no se ve nada. */
export const OPCIONES_RENDER = "execution: 'execute', appearance: 'interaction-only'";

/** El HTML del widget. Se usa dentro de un WebView en nativo; en web el script
 *  se inyecta en el documento real y esto no hace falta. */
export function htmlDelWidget(siteKey: string): string {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}
#c{display:flex;align-items:center;justify-content:center;min-height:100vh}</style>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=alCargar" defer></script>
</head><body><div id="c"></div><script>
  var id = null;
  function avisar(m){ window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); }

  // 🔴 Todo lo que pase adentro del WebView es invisible desde afuera: sin esto,
  // un error de JS o un script que no carga se ven igual que "el widget tarda",
  // y el síntoma en la app es un botón colgado sin ninguna pista. Cada motivo
  // sale por la consola de Metro con el prefijo [captcha].
  window.onerror = function(msg, url, linea){
    avisar({ tipo: 'error', detalle: 'js: ' + msg + ' @' + linea });
    return true;
  };
  // Si a los 10s el script de Cloudflare no definió \`turnstile\`, no va a
  // definirlo más: red bloqueada, sin conexión, o el dominio filtrado.
  setTimeout(function(){
    if (typeof turnstile === 'undefined') {
      avisar({ tipo: 'error', detalle: 'el script de Cloudflare no cargó (10s)' });
    }
  }, 10000);

  function alCargar(){
    id = turnstile.render('#c', {
      sitekey: ${JSON.stringify(siteKey)},
      ${OPCIONES_RENDER},
      callback: function(t){ avisar({ tipo: 'token', token: t }); },
      // 🔴 El argumento es el CÓDIGO de error de Turnstile y es el dato que
      // resuelve el diagnóstico: '110200' = el hostname no está en los dominios
      // del widget, que es la falla más probable acá porque el WebView no tiene
      // dominio propio y usa el 'baseUrl' que le declaramos.
      'error-callback': function(e){ avisar({ tipo: 'error', detalle: 'codigo ' + String(e) }); return true; },
      'expired-callback': function(){ avisar({ tipo: 'error', detalle: 'expirado' }); },
      'timeout-callback': function(){ avisar({ tipo: 'error', detalle: 'timeout' }); },
      // 🔴 Navegador que Turnstile no soporta. Sin esto el widget se queda mudo
      // y el \`await\` cuelga hasta el timeout de 60s con el botón trabado.
      'unsupported-callback': function(){ avisar({ tipo: 'error', detalle: 'no soportado' }); return true; },
      // Cuando Turnstile decide que esta sesión no le cierra, pasa a modo
      // interactivo. El WebView mide 1x1 fuera de pantalla mientras tanto, así
      // que sin estos dos avisos el desafío se dibujaría donde nadie lo ve y el
      // alta quedaría colgada para siempre sin que la persona sepa por qué.
      'before-interactive-callback': function(){ avisar({ tipo: 'abierto' }); },
      'after-interactive-callback': function(){ avisar({ tipo: 'cerrado' }); },
    });
    avisar({ tipo: 'listo' });
  }
  // La llama el host con \`injectJavaScript\`. Se prefiere eso a mandar un
  // \`postMessage\` HACIA el WebView porque el listener correcto difiere entre
  // iOS y Android y es una fuente clásica de mensajes que no llegan nunca.
  window.ejecutarCaptcha = function(){
    if (id === null) { avisar({ tipo: 'error', detalle: 'sin widget' }); return; }
    // ⚠️ En try: si 'reset' o 'execute' tiran, sin esto no contesta nadie y el
    // botón queda colgado hasta el timeout de 60s del lado de la app.
    try {
      turnstile.reset(id);
      turnstile.execute('#c');
    } catch (e) {
      avisar({ tipo: 'error', detalle: 'execute: ' + String(e) });
    }
  };
</script></body></html>`;
}
