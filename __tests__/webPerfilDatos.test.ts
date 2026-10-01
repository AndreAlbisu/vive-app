// La página pública `/c/<slug>` lee `web/perfil-datos.js`, generado desde la
// app. Este test asegura que la web y la app digan lo mismo: si alguien toca un
// texto en `lib/` y no corre `npm run sync:web-perfil`, falla acá.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lineaNacionalidad, frasesDeTrabajo } from '@/lib/perfilProfesional';
import { etiquetaProfesionalPublica } from '@/lib/tipoProfesional';
import { opcionesGuardadas, ENFOQUES, METODOS_COACHING, ENFOQUES_NUTRICION } from '@/lib/enfoque';
import { PAISES_FRECUENTES, PAISES_RESTO } from '@/constants/paises';

type Web = {
  profesion: (p: string | null, g?: string | null) => string;
  nacionalidad: (p: string | null, g?: string | null) => string | null;
  frases: (e: string | null, g: string | null, f: string[]) => string[];
  escuelas: (ids: string[]) => { id: string; label: string; desc: string }[];
};

const web: Web = (() => {
  const g: { VitaPerfil?: Web } = {};
  // eslint-disable-next-line no-new-func
  new Function('globalThis', 'window', readFileSync(join(__dirname, '..', 'web', 'perfil-datos.js'), 'utf8'))(g, undefined);
  return g.VitaPerfil!;
})();

const GENEROS = ['Femenino', 'Masculino', 'No binario', 'Prefiero no decir', null];

describe('web/perfil-datos.js dice lo mismo que la app', () => {
  it('nacionalidad, para todos los países y géneros', () => {
    for (const pais of [...PAISES_FRECUENTES, ...PAISES_RESTO, 'Argentino', '', null]) {
      for (const g of GENEROS) expect(web.nacionalidad(pais, g)).toBe(lineaNacionalidad(pais, g));
    }
  });

  it('profesión', () => {
    for (const prof of ['psicologia', 'nutricion', 'coaching', null]) {
      for (const g of GENEROS) expect(web.profesion(prof, g)).toBe(etiquetaProfesionalPublica({ profesion: prof }, g));
    }
  });

  it('frases de cómo trabaja, todas las combinaciones', () => {
    const focos = [[], ['historia'], ['presente', 'rumbo'], ['historia', 'presente', 'rumbo'], ['x']];
    for (const e of ['escucha', 'herramientas', 'ambos', null, 'x']) {
      for (const g of ['guia', 'acompana', 'ambos', null]) {
        for (const f of focos) expect(web.frases(e, g, f)).toEqual(frasesDeTrabajo(e, g, f));
      }
    }
  });

  it('escuelas y metodologías', () => {
    const ids = [...ENFOQUES, ...METODOS_COACHING, ...ENFOQUES_NUTRICION].map(o => o.id);
    expect(web.escuelas([...ids, 'inexistente'])).toEqual(opcionesGuardadas([...ids, 'inexistente']));
  });
});
