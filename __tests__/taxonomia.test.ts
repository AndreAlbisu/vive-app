import { AXES, QUIZ_AREAS, TOPIC_TO_AREA } from '@/constants/searchData';
import { DOORS, coachesForDoor, topicOptionsFrom } from '@/constants/conexionesDoors';

// La taxonomía de temas vive repartida en tres mapas que tienen que estar
// sincronizados, y ya se desincronizaron una vez: la regla crítica 19 de
// SCHEMA.md documenta que al agregar subtemas quedaron cuatro sin mapear en
// `TOPIC_TO_AREA` y en el quiz, en silencio.
//
// Nada de eso falla ruidosamente en runtime. Un subtema huérfano simplemente
// hace que un coach que solo trabaje ese tema **no aparezca en ninguna puerta**
// — invisible para el usuario e invisible para quien lo agregó. Estos tests son
// el ruido que faltaba.

const axesSubtemas = AXES.flatMap(a => a.groups.flatMap(g => g.items));
const doorSubtemas = DOORS.flatMap(d => d.subtemas);

describe('taxonomía — AXES es la fuente de verdad', () => {
  it('no tiene subtemas repetidos', () => {
    const dup = axesSubtemas.filter((s, i) => axesSubtemas.indexOf(s) !== i);
    expect(dup).toEqual([]);
  });

  it('cada subtema de AXES llega a exactamente una puerta', () => {
    // Sin huérfanos: un subtema fuera de toda puerta es un coach invisible.
    const huerfanos = axesSubtemas.filter(s => !doorSubtemas.includes(s));
    expect(huerfanos).toEqual([]);

    // Sin duplicados: en dos puertas, el mismo coach aparecería dos veces y la
    // mediana del deck se calcularía sobre un conjunto solapado.
    const enDos = axesSubtemas.filter(s => doorSubtemas.filter(d => d === s).length > 1);
    expect(enDos).toEqual([]);
  });

  it('ninguna puerta inventa un subtema que AXES no tiene', () => {
    // `coach_topics` no tiene CHECK y su lista sale de AXES: un subtema que
    // solo exista en las puertas es una puerta que ningún coach puede llenar.
    const inventados = doorSubtemas.filter(s => !axesSubtemas.includes(s));
    expect(inventados).toEqual([]);
  });

  it('cada subtema tiene área en TOPIC_TO_AREA', () => {
    // Sin entrada acá, el subtema no suma a "Áreas trabajadas" en Progreso.
    const sinArea = axesSubtemas.filter(s => !TOPIC_TO_AREA[s]);
    expect(sinArea).toEqual([]);
  });

  it('TOPIC_TO_AREA no mapea subtemas que ya no existen', () => {
    const fantasmas = Object.keys(TOPIC_TO_AREA).filter(s => !axesSubtemas.includes(s));
    expect(fantasmas).toEqual([]);
  });

  it('el quiz no ofrece subtemas inexistentes', () => {
    // El quiz es un mapa GRUESO y puede omitir subtemas a propósito, pero no
    // puede nombrar uno que no existe: ese camino no matchearía con nadie.
    const quizSubtemas = [...new Set(QUIZ_AREAS.flatMap(q => q.subtemas))];
    const inventados = quizSubtemas.filter(s => !axesSubtemas.includes(s));
    expect(inventados).toEqual([]);
  });
});

describe('taxonomía — las puertas', () => {
  it('tienen id único y al menos un subtema', () => {
    const ids = DOORS.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of DOORS) expect(d.subtemas.length).toBeGreaterThan(0);
  });

  it('tienen etiqueta y bajada no vacías', () => {
    for (const d of DOORS) {
      expect(d.label.trim().length).toBeGreaterThan(0);
      expect(d.tagline.trim().length).toBeGreaterThan(0);
    }
  });

  it('los tres motivos más grandes de coaching tienen puerta', () => {
    // Comunicación (37%), equilibrio vida-trabajo (35%) y autoestima (35%) son
    // los tres primeros del estudio de ICF, y los tres estaban sin cubrir o
    // enterrados. Este test fija que no vuelvan a perderse en un refactor.
    for (const tema of ['Comunicación', 'Equilibrio vida-trabajo', 'Autoestima']) {
      expect(doorSubtemas).toContain(tema);
    }
    // Autoestima con puerta PROPIA, no adentro de "Estado de ánimo".
    const suPuerta = DOORS.find(d => d.subtemas.includes('Autoestima'))!;
    expect(suPuerta.id).toBe('autoestima');
  });
});

describe('coachesForDoor', () => {
  const coach = (topics: string[]) => ({ topics });

  it('incluye al coach si comparte cualquier subtema de la puerta', () => {
    const puerta = DOORS.find(d => d.id === 'comunicacion')!;
    const dentro = [coach(['Comunicación']), coach(['Asertividad']), coach(['Comunicación', 'Pareja'])];
    const fuera = [coach(['Pareja']), coach([])];
    expect(coachesForDoor(puerta, [...dentro, ...fuera])).toHaveLength(3);
  });

  it('una puerta sin coaches devuelve lista vacía, no rompe', () => {
    // Es el estado REAL de las puertas nuevas hasta que los coaches editen su
    // perfil: `coach_topics` no tiene CHECK y nadie tiene los subtemas nuevos.
    const puerta = DOORS.find(d => d.id === 'autoestima')!;
    expect(coachesForDoor(puerta, [coach(['Sueño']), coach(['Pareja'])])).toEqual([]);
  });
});

describe('topicOptionsFrom — opciones del filtro derivadas del dato', () => {
  const coach = (topics: string[]) => ({ topics });

  it('solo ofrece subtemas que algún coach trabaja', () => {
    // El caso que motiva la función: `Comunicación` existe en la taxonomía pero
    // al 16/08 no lo trabaja nadie. Ofrecerlo daría un filtro que devuelve cero.
    const grupos = topicOptionsFrom([coach(['Pareja', 'Familia']), coach(['Sueño'])]);
    const ofrecidos = grupos.flatMap(g => g.subtemas);
    expect(ofrecidos.sort()).toEqual(['Familia', 'Pareja', 'Sueño']);
    expect(ofrecidos).not.toContain('Comunicación');
  });

  it('omite las puertas que quedarían sin ningún tema', () => {
    // Un encabezado sin nada debajo es peor que no mostrar la sección.
    const grupos = topicOptionsFrom([coach(['Sueño'])]);
    expect(grupos).toHaveLength(1);
    // `descanso` se dividió en `sueno` + `energia` el 27/08/2026.
    expect(grupos[0].id).toBe('sueno');
    expect(grupos.every(g => g.subtemas.length > 0)).toBe(true);
  });

  it('agrupa por puerta y respeta su orden', () => {
    const grupos = topicOptionsFrom([coach(['Propósito', 'Ansiedad', 'Sueño'])]);
    expect(grupos.map(g => g.id)).toEqual(['ansiedad', 'sueno', 'proposito']);
  });

  it('sin coaches no ofrece nada, en vez de ofrecer los 38', () => {
    // Si devolviera la taxonomía completa, una lista vacía mostraría un filtro
    // lleno de opciones que no llevan a nadie.
    expect(topicOptionsFrom([])).toEqual([]);
  });

  it('no repite un subtema que comparten varios coaches', () => {
    const grupos = topicOptionsFrom([coach(['Pareja']), coach(['Pareja']), coach(['Pareja', 'Familia'])]);
    const relaciones = grupos.find(g => g.id === 'relaciones')!;
    expect(relaciones.subtemas).toEqual(['Pareja', 'Familia']);
  });

  it('ignora temas que un coach tenga y la taxonomía ya no', () => {
    // `coach_topics` no tiene CHECK: puede quedar una fila con un tema viejo
    // después de renombrarlo. No debe aparecer como opción de filtro.
    const grupos = topicOptionsFrom([coach(['Pareja', 'Tema Que Ya No Existe'])]);
    expect(grupos.flatMap(g => g.subtemas)).toEqual(['Pareja']);
  });
});
