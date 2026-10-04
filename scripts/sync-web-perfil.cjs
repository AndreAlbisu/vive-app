// Genera `web/perfil-datos.js`: los textos del perfil del profesional que la
// página pública `/c/<slug>` comparte con la app.
//
// La web no tiene bundler y no puede importar `lib/*.ts`. Copiarlos a mano era
// la forma segura de que la web dijera "Psicólogo/a" el día que la app ya decía
// "Psicóloga". Mismo criterio que `sync-legal.mjs`: la fuente es la app, la web
// lee un archivo generado. `__tests__/webPerfilDatos.test.ts` compara las
// funciones de acá contra las de la app para todos los casos.
//
// Uso: `npm run sync:web-perfil` después de tocar `lib/enfoque.ts`,
// `lib/perfilProfesional.ts` o `lib/tipoProfesional.ts`.

require('sucrase/register');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');
const e = require('../lib/enfoque.ts');
const p = require('../lib/perfilProfesional.ts');

const escuelas = {};
for (const o of [...e.ENFOQUES, ...e.METODOS_COACHING, ...e.ENFOQUES_NUTRICION]) {
  escuelas[o.id] = { label: o.label, desc: o.desc };
}
const fraseEstilo = {};
for (const o of e.ESTILO_OPCIONES_COACH) fraseEstilo[o.id] = p.frasesDeTrabajo(o.id, null, [])[0];
const fraseGuia = {};
for (const o of e.GUIA_OPCIONES_COACH) fraseGuia[o.id] = p.frasesDeTrabajo(null, o.id, [])[0];
const focos = {};
for (const o of e.FOCO_OPCIONES_COACH) focos[o.id] = o.label.toLowerCase();

const datos = { escuelas, fraseEstilo, fraseGuia, focos, gentilicios: p.GENTILICIOS };

const salida = `// GENERADO por scripts/sync-web-perfil.cjs. No editar a mano: la fuente es
// lib/enfoque.ts, lib/perfilProfesional.ts y lib/tipoProfesional.ts.
(function (g) {
  var D = ${JSON.stringify(datos, null, 2)};

  // Misma salida que lib/tipoProfesional.ts → etiquetaProfesionalPublica.
  function profesion(prof, genero) {
    if (prof === 'psicologia') {
      if (genero === 'Femenino') return 'Psicóloga';
      if (genero === 'Masculino') return 'Psicólogo';
      return 'Psicólogo/a';
    }
    if (prof === 'nutricion') return 'Nutricionista';
    return 'Coach';
  }

  // Misma salida que lib/perfilProfesional.ts → lineaNacionalidad.
  function nacionalidad(pais, genero) {
    var p = String(pais || '').trim();
    if (!p) return null;
    var gt = D.gentilicios[p];
    if (gt && genero === 'Masculino') return gt[0];
    if (gt && genero === 'Femenino') return gt[1];
    if (!gt) {
      for (var k in D.gentilicios) {
        if (D.gentilicios[k][0] === p || D.gentilicios[k][1] === p) return p;
      }
    }
    return 'De ' + p;
  }

  // Misma salida que lib/perfilProfesional.ts → frasesDeTrabajo.
  function frases(estilo, guia, focos) {
    var out = [];
    if (D.fraseEstilo[estilo]) out.push(D.fraseEstilo[estilo]);
    if (D.fraseGuia[guia]) out.push(D.fraseGuia[guia]);
    var sobre = (focos || []).filter(function (f) { return D.focos[f]; }).map(function (f) { return D.focos[f]; });
    if (sobre.length) {
      var lista = sobre.length === 1 ? sobre[0] : sobre.slice(0, -1).join(', ') + ' y ' + sobre[sobre.length - 1];
      out.push('Trabaja sobre ' + lista);
    }
    return out;
  }

  // Misma salida que lib/enfoque.ts → opcionesGuardadas.
  function escuelas(ids) {
    return (ids || []).map(function (id) { return D.escuelas[id] && { id: id, label: D.escuelas[id].label, desc: D.escuelas[id].desc }; }).filter(Boolean);
  }

  g.VitaPerfil = { profesion: profesion, nacionalidad: nacionalidad, frases: frases, escuelas: escuelas };
})(typeof window !== 'undefined' ? window : globalThis);
`;

const destino = join(__dirname, '..', 'web', 'perfil-datos.js');
writeFileSync(destino, salida);
console.log('✓ web/perfil-datos.js');
