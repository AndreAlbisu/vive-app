// El token de Turnstile para las páginas web que piden código por mail.
//
// 🔴 POR QUÉ EXISTE. El CAPTCHA de Supabase Auth, una vez prendido, cubre el
// endpoint `/auth/v1/otp` para TODO el mundo, no solo para la app. Estas
// páginas (`/c/<slug>`, el checkout del link del coach, y `/sala`, la
// videollamada desde la compu) le pegan a ese endpoint con un `fetch` directo:
// sin token, el día que se prenda el CAPTCHA **nadie puede entrar por la web**.
//
// Es la contraparte web de `lib/captcha.ts` + `components/CaptchaHost.tsx` de la
// app, y sigue sus mismas reglas:
//   · widget invisible; solo se muestra si Turnstile decide desafiar;
//   · token de un solo uso, pedido justo antes de cada envío (no se cachea);
//   · FALLA ABIERTO: si el widget no carga o no contesta, el pedido sale sin
//     token y decide el servidor. Con el CAPTCHA prendido lo rechaza igual — no
//     es un agujero, es no colgar el botón por un problema de red.
//
// 📌 La site key es PÚBLICA (viaja igual en el bundle de la app). El secret
// vive solo en Supabase. Si se rota la site key, se cambia acá también: esto
// es HTML estático y no lee variables de entorno.
//
// ⚠️ El hostname tiene que estar en los dominios del widget en Cloudflare. Una
// preview de Vercel (*.vercel.app) no lo está, así que ahí el widget falla y el
// pedido sale sin token — con el CAPTCHA prendido, en una preview no se puede
// probar el pedido de código.

(function () {
  var SITE_KEY = '0x4AAAAAAEuYtbTq2-dvlBa4';
  var SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__vitaTurnstileListo';

  var caja = null, ranura = null, widget = null, pendiente = null, cargando = null;

  function mostrar(visible) {
    if (!caja) return;
    caja.style.visibility = visible ? 'visible' : 'hidden';
    caja.style.pointerEvents = visible ? 'auto' : 'none';
  }

  function responder(token) {
    mostrar(false);
    var r = pendiente;
    pendiente = null;
    if (r) r(token);
  }

  // Se prepara al cargar la página y no al tocar el botón: bajar el script y
  // renderizar tarda, y hacerlo recién en el click sumaba esa espera al "Enviando…".
  function preparar() {
    if (cargando) return cargando;
    cargando = new Promise(function (listo) {
      // 🔴 NO `display:none`: con `appearance: 'interaction-only'` el desafío se
      // dibuja acá adentro cuando hace falta, y un contenedor apagado lo dejaría
      // invisible — el botón quedaría colgado sin que se vea por qué. Es el mismo
      // bug que la app resuelve con un Modal.
      caja = document.createElement('div');
      caja.style.cssText =
        'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;' +
        'justify-content:center;background:rgba(0,0,0,0.55);visibility:hidden;pointer-events:none';
      ranura = document.createElement('div');
      caja.appendChild(ranura);
      document.body.appendChild(caja);

      window.__vitaTurnstileListo = function () {
        widget = window.turnstile.render(ranura, {
          sitekey: SITE_KEY,
          execution: 'execute',
          appearance: 'interaction-only',
          callback: function (t) { responder(t); },
          'error-callback': function (e) { console.warn('[captcha] error', e); responder(undefined); return true; },
          'expired-callback': function () { responder(undefined); },
          'timeout-callback': function () { responder(undefined); },
          'unsupported-callback': function () { console.warn('[captcha] navegador no soportado'); responder(undefined); return true; },
          'before-interactive-callback': function () { mostrar(true); },
          // No resuelve: el token bueno llega después por `callback`.
          'after-interactive-callback': function () { mostrar(false); },
        });
        listo(true);
      };

      var s = document.createElement('script');
      s.src = SCRIPT;
      s.async = true;
      s.defer = true;
      s.onerror = function () { console.warn('[captcha] no cargó el script de Cloudflare'); listo(false); };
      document.head.appendChild(s);
      // Red que bloquea a Cloudflare: no se espera para siempre.
      setTimeout(function () { listo(!!widget); }, 10000);
    });
    return cargando;
  }

  /** Un token de un solo uso, o `undefined` si no se pudo conseguir. */
  window.pedirCaptchaToken = function () {
    return preparar().then(function (ok) {
      if (!ok || widget === null) return undefined;
      return new Promise(function (resolve) {
        if (pendiente) pendiente(undefined);   // un pedido viejo no queda colgado
        var t = setTimeout(function () { responder(undefined); }, 60000);
        pendiente = function (token) { clearTimeout(t); resolve(token); };
        try {
          window.turnstile.reset(widget);
          window.turnstile.execute(ranura);
        } catch (e) {
          console.warn('[captcha] execute', e);
          responder(undefined);
        }
      });
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', preparar);
  else preparar();
})();
