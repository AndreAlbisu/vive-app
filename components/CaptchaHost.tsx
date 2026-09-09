// El único lugar donde vive el widget de Turnstile. Se monta una sola vez, en
// la raíz (`app/_layout.tsx`), y las pantallas de auth no lo tocan: piden un
// token con `pedirCaptchaToken()` y no saben que existe.
//
// 🔴 POR QUÉ IMPERATIVO Y NO UN COMPONENTE POR PANTALLA. El token lo necesitan
// cuatro llamadas repartidas en tres archivos (alta, login, recuperar
// contraseña y reenvío de OTP), y tres de ellas viven dentro de `AuthContext`,
// que no dibuja nada. Poner un widget por pantalla obligaría a pasarle el token
// a `signUpWithEmail`/`signInWithEmail`/`resetPassword` desde afuera y a
// cambiar cada llamador; el desafío quedaría además duplicado en pantallas que
// se montan a la vez. Un host único con una función que devuelve una promesa
// deja las firmas donde están.
//
// 📝 Si no hay site key, esto no dibuja nada y `pedirCaptchaToken()` devuelve
// `undefined`. Ver el comentario de cabecera de `lib/captcha.ts`.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  CAPTCHA_ORIGEN,
  CAPTCHA_SITE_KEY,
  captchaActivo,
  htmlDelWidget,
  registrarCaptchaHost,
} from '@/lib/captcha';

type Resolver = (token: string | undefined) => void;
type Aviso =
  | { tipo: 'token'; token: string }
  | { tipo: 'error'; detalle: string }
  | { tipo: 'listo' }
  | { tipo: 'abierto' }
  | { tipo: 'cerrado' };

export default function CaptchaHost() {
  if (!captchaActivo()) return null;
  return Platform.OS === 'web' ? <CaptchaWeb /> : <CaptchaNativo />;
}

// ── Nativo: el widget vive dentro de un WebView ──────────────────────────────

function CaptchaNativo() {
  const web = useRef<WebView>(null);
  const pendiente = useRef<Resolver | null>(null);
  // Solo se abre cuando Turnstile pasa a modo interactivo. En el camino
  // normal —que es el de casi todo el mundo— nadie ve nada.
  const [desafiando, setDesafiando] = useState(false);

  const responder = useCallback((token: string | undefined) => {
    const resolver = pendiente.current;
    pendiente.current = null;
    resolver?.(token);
  }, []);

  // 🔴 El widget tarda en estar listo (cargar el WebView + bajar el script de
  // Cloudflare + renderizar). Antes de eso `window.ejecutarCaptcha` no existe, y
  // el `&&` de la línea inyectada hacía que no pasara NADA: sin llamada, sin
  // mensaje de vuelta, sin error. El botón quedaba colgado hasta el timeout de
  // 60s. Quien toca "Crear cuenta" apenas abre la app cae justo ahí.
  const listo = useRef(false);
  const enEspera = useRef(false);

  const disparar = useCallback(() => {
    web.current?.injectJavaScript('window.ejecutarCaptcha && window.ejecutarCaptcha(); true;');
  }, []);

  const ejecutar = useCallback((resolver: Resolver) => {
    // Un segundo pedido con uno en curso: se corta el viejo en vez de pisarlo.
    // Sin esto, el `resolve` del anterior no se llama nunca y su `await` queda
    // colgado hasta el timeout.
    pendiente.current?.(undefined);
    pendiente.current = resolver;
    // Si todavía no está listo, se encola: lo dispara el aviso `listo`.
    if (listo.current) disparar();
    else enEspera.current = true;
  }, [disparar]);

  useEffect(() => {
    registrarCaptchaHost(ejecutar);
    return () => {
      registrarCaptchaHost(null);
      pendiente.current?.(undefined);
      pendiente.current = null;
    };
  }, [ejecutar]);

  function alRecibir(crudo: string) {
    let m: Aviso;
    try { m = JSON.parse(crudo); } catch { return; }

    if (m.tipo === 'abierto') { setDesafiando(true); return; }
    // 🔴 `cerrado` NO resuelve: Turnstile lo manda también al salir del modo
    // interactivo que la persona acaba de RESOLVER BIEN, y en ese caso el
    // `callback` con el token llega después. Resolver acá mataría el token
    // bueno con `undefined`. Solo baja el telón; quien contesta es `token` o
    // `error`.
    if (m.tipo === 'cerrado') { setDesafiando(false); return; }
    if (m.tipo === 'listo') {
      listo.current = true;
      if (enEspera.current) { enEspera.current = false; disparar(); }
      return;
    }

    setDesafiando(false);
    enEspera.current = false;
    if (m.tipo === 'token') { responder(m.token); return; }
    console.warn('[captcha] el widget falló:', m.detalle);
    responder(undefined);
  }

  const vista = (
    <WebView
      ref={web}
      source={{ html: htmlDelWidget(CAPTCHA_SITE_KEY!), baseUrl: CAPTCHA_ORIGEN }}
      onMessage={e => alRecibir(e.nativeEvent.data)}
      onError={() => {
        console.warn('[captcha] el WebView no cargó');
        setDesafiando(false);
        responder(undefined);
      }}
      javaScriptEnabled
      domStorageEnabled
      // 🔴 SIN ESTO EL WIDGET NO FUNCIONA. Turnstile dibuja el desafío en un
      // iframe con `srcdoc`, y el `originWhitelist` por defecto de
      // react-native-webview es solo `http://*` y `https://*`: `about:srcdoc`
      // queda afuera, así que RN se lo pasa al sistema para abrirlo como link
      // externo ("Unable to open URL: about:srcdoc. Add about to
      // LSApplicationQueriesSchemes"), el iframe nunca carga y Turnstile
      // contesta `300031` — su error genérico de desafío fallado, que no dice
      // nada de todo esto.
      originWhitelist={['*']}
      // Abrir la lista de orígenes deja al WebView navegar a donde sea, así que
      // acá se vuelve a cerrar a mano: solo lo que el widget necesita de verdad.
      // Lo que no está en la lista no se carga y queda anotado.
      onShouldStartLoadWithRequest={req => {
        const permitido =
          req.url.startsWith('about:') ||
          req.url.startsWith('https://challenges.cloudflare.com') ||
          req.url.startsWith(CAPTCHA_ORIGEN);
        if (!permitido) console.warn('[captcha] navegación bloqueada:', req.url);
        return permitido;
      }}
      // Sin esto el WebView pinta blanco sobre la pantalla mientras está en 0x0
      // en algunos Android.
      style={styles.transparente}
      // El desafío de Turnstile se dibuja adentro del propio WebView, así que
      // cuando hay desafío el WebView tiene que ocupar la pantalla entera.
      containerStyle={desafiando ? styles.lleno : styles.oculto}
    />
  );

  // 🔴 El WebView es el MISMO en los dos casos, y a propósito: recrearlo al
  // abrir el desafío perdería el widget que ya está corriendo `execute()`. Lo
  // que cambia es dónde se dibuja, no cuál es.
  return desafiando
    ? <Modal transparent animationType="fade" onRequestClose={() => setDesafiando(false)}>
        <View style={styles.fondo}>{vista}</View>
      </Modal>
    : <View style={styles.oculto} pointerEvents="none">{vista}</View>;
}

// ── Web: el script va al documento de verdad ─────────────────────────────────

function CaptchaWeb() {
  const pendiente = useRef<Resolver | null>(null);

  useEffect(() => {
    const w = window as any;

    // 🔴 NO se esconde con `display:none`. Con `appearance: 'interaction-only'`
    // el widget se muestra cuando hace falta que la persona haga algo, y un
    // contenedor apagado dejaría ese desafío invisible: el alta quedaría
    // colgada sin que se vea por qué (el mismo bug que en nativo resuelve el
    // Modal). Se mantiene montado y sin ocupar lugar, y se enciende cuando
    // Turnstile avisa que pasa a interactivo.
    const caja = document.createElement('div');
    caja.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;' +
      'justify-content:center;background:rgba(0,0,0,0.55);visibility:hidden;pointer-events:none';
    const ranura = document.createElement('div');
    caja.appendChild(ranura);
    document.body.appendChild(caja);

    const mostrar = (visible: boolean) => {
      caja.style.visibility = visible ? 'visible' : 'hidden';
      caja.style.pointerEvents = visible ? 'auto' : 'none';
    };
    const responder = (token: string | undefined) => {
      mostrar(false);
      const r = pendiente.current;
      pendiente.current = null;
      r?.(token);
    };

    let id: string | undefined;
    function render() {
      id = w.turnstile.render(ranura, {
        sitekey: CAPTCHA_SITE_KEY,
        execution: 'execute',
        appearance: 'interaction-only',
        callback: (t: string) => responder(t),
        'error-callback': () => { responder(undefined); return true; },
        'expired-callback': () => responder(undefined),
        'timeout-callback': () => responder(undefined),
        'unsupported-callback': () => { responder(undefined); return true; },
        'before-interactive-callback': () => mostrar(true),
        // No resuelve, igual que en nativo: el token bueno llega después.
        'after-interactive-callback': () => mostrar(false),
      });
      registrarCaptchaHost(resolver => {
        pendiente.current?.(undefined);
        pendiente.current = resolver;
        w.turnstile.reset(id);
        w.turnstile.execute(ranura);
      });
    }

    // El script se carga una sola vez aunque el efecto vuelva a correr.
    if (w.turnstile?.render) {
      render();
    } else {
      w.alCargarCaptcha = render;
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=alCargarCaptcha';
      s.defer = true;
      s.onerror = () => console.warn('[captcha] no se pudo cargar Turnstile');
      document.head.appendChild(s);
    }

    return () => {
      registrarCaptchaHost(null);
      pendiente.current?.(undefined);
      pendiente.current = null;
      if (id !== undefined) w.turnstile?.remove?.(id);
      caja.remove();
    };
  }, []);

  return null;
}

const styles = StyleSheet.create({
  transparente: { backgroundColor: 'transparent' },
  // 🔴 1x1 y fuera de pantalla, NO 0x0. Un WKWebView con frame de área cero
  // puede no llegar a correr su JavaScript en iOS, que es la clase de falla que
  // se ve como "el widget nunca contesta". `opacity: 0` + `left` negativo lo
  // saca de la vista sin sacarlo del layout.
  oculto: { position: 'absolute', left: -1000, top: 0, width: 1, height: 1, opacity: 0 },
  lleno: { flex: 1 },
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
});
