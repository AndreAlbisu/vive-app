// Botones de tiendas y lista de espera, compartidos por la portada y
// /profesionales. Cualquier elemento con `data-stores` se llena acá:
// data-tipo="persona" o "profesional". Un elemento con id `pros-cta` cambia
// de texto cuando haya links de tiendas.
(function () {
  // Links de descarga. Mientras estén vacíos, los botones dicen "Muy pronto"
  // y no llevan a ningún lado. Cuando la app salga, pegar acá las URLs de las
  // tiendas y listo: se actualizan todos los botones de las dos páginas.
  var TIENDAS = {
    ios: '',      // https://apps.apple.com/ar/app/vita/id<número que da App Store Connect>
    android: ''   // https://play.google.com/store/apps/details?id=com.andrealbisu.viveapp
  };

  var ICONOS = {
    ios: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.37 12.64c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.75 2.27-1.6 2.78-.41 6.89 1.15 9.14.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.96-.74 1.39 0 1.78.74 2.99.72 1.24-.02 2.02-1.12 2.77-2.23.88-1.28 1.24-2.52 1.26-2.59-.03-.01-2.4-.92-2.41-3.65zM14.1 5.9c.63-.77 1.06-1.83.94-2.9-.91.04-2.02.61-2.67 1.37-.59.68-1.1 1.77-.96 2.81 1.02.08 2.06-.52 2.69-1.28z"/></svg>',
    android: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.6 2.2c-.2.2-.3.6-.3 1v17.6c0 .4.1.8.3 1l.1.1 9.9-9.9v-.2L3.7 2.1l-.1.1zm13.3 13.1-3.3-3.3v-.2l3.3-3.3.1.1 3.9 2.2c1.1.6 1.1 1.7 0 2.3l-3.9 2.2h-.1zm-.1.1L13.4 12 3.6 21.8c.4.4.9.4 1.6.1l11.6-6.5M16.8 8.6 5.2 2c-.7-.4-1.2-.3-1.6.1l9.8 9.9 3.4-3.4z"/></svg>'
  };
  var NOMBRES = { ios: 'App Store', android: 'Google Play' };
  var HAY_TIENDAS = !!(TIENDAS.ios || TIENDAS.android);

  // Lista de espera (25/09/2026). Mientras no haya links de tiendas, el
  // recuadro de profesionales muestra un formulario para dejar el mail. Escribe por la
  // función `anotarse_lista_espera` (scripts/add-lista-de-espera.sql): la tabla
  // no se puede leer ni escribir con la anon key, y la función tiene tope por IP.
  // El `?ref=` de un link de invitación se guarda con el mail.
  var SUPABASE_URL = 'https://ggygiihhnkjrerpinhha.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdneWdpaWhobmtqcmVycGluaGhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1Mjc5NjEsImV4cCI6MjA5NzEwMzk2MX0.lHPjyKjJIYD_lUTCF7uMBCKj9tCK_67OyrIFkCLQ-BI';
  var REF = (new URLSearchParams(location.search).get('ref') || '').slice(0, 32) || null;
  var AVISO = {
    persona: { boton: 'Avisame', nota: 'Solo para avisarte cuando Vita esté en las tiendas.', listo: 'Listo. Te escribimos a {mail} cuando Vita esté en las tiendas.' },
    profesional: { boton: 'Quiero sumarme', nota: 'Te escribimos para contarte cómo postularte.', listo: 'Gracias. Te escribimos a {mail} para contarte cómo sumarte.' }
  };
  var nAviso = 0;

  function formularioAviso(box, tipo) {
    var txt = AVISO[tipo];
    var id = 'aviso-mail-' + (++nAviso);
    var form = document.createElement('form');
    form.className = 'aviso';
    form.noValidate = true;
    form.innerHTML =
      '<label class="skip" for="' + id + '">Tu mail</label>' +
      '<div class="aviso-fila"><input id="' + id + '" type="email" name="email" autocomplete="email" inputmode="email" placeholder="Tu mail" required maxlength="254">' +
      '<button class="btn" type="submit"></button></div>' +
      '<p class="aviso-nota" aria-live="polite"></p>';
    var input = form.querySelector('input');
    var boton = form.querySelector('button');
    var nota = form.querySelector('.aviso-nota');
    boton.textContent = txt.boton;
    nota.textContent = txt.nota + ' ';
    var priv = document.createElement('a');
    priv.href = './legal/privacidad';
    priv.textContent = 'Privacidad';
    nota.appendChild(priv);

    function error(msg) { nota.textContent = msg; nota.classList.add('error'); }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var mail = input.value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(mail)) { error('Revisá el mail, parece que le falta algo.'); input.focus(); return; }
      boton.disabled = true;
      boton.textContent = 'Enviando…';
      fetch(SUPABASE_URL + '/rest/v1/rpc/anotarse_lista_espera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY },
        body: JSON.stringify({ p_email: mail, p_tipo: tipo, p_ref: REF })
      }).then(function (r) {
        if (r.ok) {
          var listo = document.createElement('p');
          listo.className = 'aviso-listo';
          listo.setAttribute('role', 'status');
          listo.textContent = txt.listo.replace('{mail}', mail);
          form.replaceWith(listo);
          return;
        }
        return r.json().catch(function () { return {}; }).then(function (b) {
          if (b.message === 'email_invalido') error('Revisá el mail, parece que le falta algo.');
          else if (b.message === 'rate_limited') error('Hubo muchos intentos seguidos. Probá de nuevo en un rato.');
          else error('No se pudo guardar. Probá de nuevo o escribinos a vitaappar@gmail.com.');
          boton.disabled = false;
          boton.textContent = txt.boton;
        });
      }).catch(function () {
        error('No se pudo conectar. Revisá tu conexión y probá de nuevo.');
        boton.disabled = false;
        boton.textContent = txt.boton;
      });
    });
    box.classList.remove('stores');
    box.appendChild(form);
  }

  document.querySelectorAll('[data-stores]').forEach(function (box) {
    // 25/09/2026, Andre: las tiendas salen en días, así que para quien busca
    // acompañamiento van los botones ("Muy pronto" hasta que haya links). El
    // formulario queda solo para profesionales, mientras no se pueda postular
    // desde la app publicada.
    if (box.dataset.tipo === 'profesional') {
      if (!HAY_TIENDAS) { formularioAviso(box, 'profesional'); return; }
      var cta = document.getElementById('pros-cta');
      if (cta) cta.textContent = 'Bajate la app y postulate desde ahí.';
    }
    box.classList.add('stores');
    ['ios', 'android'].forEach(function (k) {
      var url = TIENDAS[k];
      var el = document.createElement(url ? 'a' : 'span');
      el.className = 'store';
      if (url) { el.href = url; el.rel = 'noopener'; }
      else { el.setAttribute('aria-disabled', 'true'); }
      el.innerHTML = ICONOS[k] + '<span><small>' + (url ? 'Descargala en' : 'Muy pronto en') + '</small><b>' + NOMBRES[k] + '</b></span>';
      box.appendChild(el);
    });
  });
})();
