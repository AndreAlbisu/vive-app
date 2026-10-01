// La página del profesional (/c/<slug>) con la vista previa resuelta.
//
// 🔴 Por qué existe: el link de cada profesional se manda por WhatsApp, y
// WhatsApp arma la vista previa leyendo el HTML del servidor, sin ejecutar
// JavaScript. La página pinta el nombre y la foto con JavaScript, así que la
// vista previa salía igual para todos ("Reservá tu sesión en Vita") y sin
// imagen. Un link que llega por chat pidiendo datos y no muestra de quién es
// se parece demasiado a una estafa.
//
// Qué hace: lee `web/c/index.html` y le cambia el título, la descripción y la
// imagen por los del profesional. Nada más: el resto de la página es la misma
// y sigue cargando todo desde el navegador.
//
// ⚠️ Nunca rompe la página. Si la base no contesta, el slug no existe o pasa
// cualquier otra cosa, devuelve el HTML tal cual, con la vista previa genérica.
//
// 📌 `vercel.json` manda `/c/:slug` acá (antes iba directo a `/c`) e incluye el
// HTML en la función con `includeFiles`. Los encabezados de seguridad de
// `vercel.json` se aplican igual, porque van por ruta.

const fs = require('fs');
const path = require('path');

// La misma clave pública de la página (ver el comentario en web/c/index.html):
// solo puede leer lo que la RLS deja leer a `anon`.
const SUPABASE_URL = 'https://ggygiihhnkjrerpinhha.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdneWdpaWhobmtqcmVycGluaGhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1Mjc5NjEsImV4cCI6MjA5NzEwMzk2MX0.lHPjyKjJIYD_lUTCF7uMBCKj9tCK_67OyrIFkCLQ-BI';
const SITIO = 'https://www.vitaapp.com.ar';

let htmlBase = null;
async function leerHtml(req) {
  if (htmlBase) return htmlBase;
  try {
    htmlBase = fs.readFileSync(path.join(process.cwd(), 'web', 'c', 'index.html'), 'utf8');
  } catch {
    // Plan B: la misma página estática, servida por el propio sitio. `/c` (sin
    // slug) no pasa por esta función, así que no hay vuelta en círculo.
    const r = await fetch(`https://${req.headers.host}/c`);
    htmlBase = await r.text();
  }
  return htmlBase;
}

// Misma salida que lib/tipoProfesional.ts → etiquetaProfesionalPublica (y que
// `profesion` en web/perfil-datos.js).
function profesion(prof, genero) {
  if (prof === 'psicologia') {
    if (genero === 'Femenino') return 'Psicóloga';
    if (genero === 'Masculino') return 'Psicólogo';
    return 'Psicólogo/a';
  }
  if (prof === 'nutricion') return 'Nutricionista';
  return 'Coach';
}

const escapar = (t) => String(t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Mismo filtro que la página: sin aprobar, pausado o suspendido no tiene
// página pública, y tampoco vista previa.
async function buscarCoach(slug) {
  const campos = 'profesion,suspendido_hasta,profiles!inner(name,avatar_url,gender)';
  const url = `${SUPABASE_URL}/rest/v1/coaches?slug=eq.${encodeURIComponent(slug)}` +
    `&verified=eq.true&availability_status=eq.activo&select=${campos}&limit=1`;
  const r = await fetch(url, { headers: { apikey: SUPABASE_ANON_KEY }, signal: AbortSignal.timeout(2500) });
  if (!r.ok) return null;
  const coach = (await r.json())[0];
  if (!coach) return null;
  const h = coach.suspendido_hasta;
  if (h && (h === 'infinity' || new Date(h).getTime() > Date.now())) return null;
  return coach;
}

function cambiarMeta(html, atributo, nombre, valor) {
  const re = new RegExp(`<meta ${atributo}="${nombre}" content="[^"]*">`);
  const tag = `<meta ${atributo}="${nombre}" content="${escapar(valor)}">`;
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `${tag}\n</head>`);
}

function sacarMeta(html, atributo, nombre) {
  return html.replace(new RegExp(`<meta ${atributo}="${nombre}" content="[^"]*">\\n?`), '');
}

module.exports = async function handler(req, res) {
  const slug = String((req.query && req.query.slug) || '').slice(0, 100);
  let html = await leerHtml(req);

  try {
    const coach = slug ? await buscarCoach(slug) : null;
    if (coach) {
      const perfil = Array.isArray(coach.profiles) ? coach.profiles[0] : coach.profiles;
      const nombre = (perfil && perfil.name) || 'Profesional';
      const prof = profesion(coach.profesion, perfil && perfil.gender);
      const titulo = `${nombre} · ${prof} en Vita`;
      const desc = 'Sesiones online por videollamada. Conocé cómo trabaja, elegí un horario y reservá, con garantía de primera sesión.';

      html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapar(`${nombre} — Vita`)}</title>`);
      html = cambiarMeta(html, 'name', 'description', `${titulo}. ${desc}`);
      html = cambiarMeta(html, 'property', 'og:title', titulo);
      html = cambiarMeta(html, 'property', 'og:description', desc);
      html = cambiarMeta(html, 'property', 'og:url', `${SITIO}/c/${encodeURIComponent(slug)}`);

      // La foto del profesional, si tiene y es https. Es cuadrada: va como
      // tarjeta chica, y sin las medidas de la imagen genérica.
      const foto = perfil && perfil.avatar_url;
      if (foto && /^https:\/\//.test(foto)) {
        html = cambiarMeta(html, 'property', 'og:image', foto);
        html = cambiarMeta(html, 'property', 'og:image:alt', `Foto de ${nombre}`);
        html = sacarMeta(html, 'property', 'og:image:width');
        html = sacarMeta(html, 'property', 'og:image:height');
        html = cambiarMeta(html, 'name', 'twitter:card', 'summary');
      }
    }
  } catch (e) {
    console.error('[c] vista previa genérica:', e && e.message);
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Cinco minutos en el CDN: un cambio de foto o de nombre se ve enseguida, y
  // un link compartido en un grupo no consulta la base por cada persona.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400');
  res.status(200).send(html);
};
