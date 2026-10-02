import {
  firmaDeResena, motivoSinPerfil, frasesDeTrabajo, precioParaMostrar, lineaNacionalidad,
  duracionUnica, lineaSesion, lineaProximoLugar, motivoSinReserva,
} from '@/lib/perfilProfesional';
import { etiquetaProfesionalPublica } from '@/lib/tipoProfesional';

describe('firmaDeResena', () => {
  it('nombre e inicial del apellido, nunca el nombre completo', () => {
    expect(firmaDeResena('Martina González')).toBe('Martina G.');
    expect(firmaDeResena('  juan   carlos pérez ')).toBe('Juan C.');
    expect(firmaDeResena('Lucía')).toBe('Lucía');
  });

  it('sin nombre usable firma genérico', () => {
    expect(firmaDeResena(null)).toBe('Alguien de Vita');
    expect(firmaDeResena('   ')).toBe('Alguien de Vita');
    expect(firmaDeResena('Usuario eliminado')).toBe('Alguien de Vita');
  });
});

describe('motivoSinPerfil', () => {
  it('sin filas es que no existe; cualquier otro error es la red', () => {
    expect(motivoSinPerfil({ code: 'PGRST116' })).toBe('no_existe');
    expect(motivoSinPerfil(null)).toBe('no_existe');
    expect(motivoSinPerfil({ code: '' })).toBe('error_red');
    expect(motivoSinPerfil({})).toBe('error_red');
  });
});

describe('frasesDeTrabajo', () => {
  it('frases que se entienden sin la pregunta', () => {
    expect(frasesDeTrabajo('ambos', 'guia', ['rumbo'])).toEqual([
      'Escucha y da herramientas, según lo que necesite cada persona',
      'Propone el camino: marca por dónde empezar y cómo avanzar',
      'Trabaja sobre el rumbo',
    ]);
    expect(frasesDeTrabajo(null, null, ['historia', 'presente', 'rumbo'])).toEqual([
      'Trabaja sobre la historia de la persona, lo que pasa ahora y el rumbo',
    ]);
    expect(frasesDeTrabajo('otra', undefined, ['x'])).toEqual([]);
  });
});

describe('precioParaMostrar', () => {
  const p = { ars: 12000, usd: 50, cobraExterior: true };
  it('pesos en Argentina, dólares afuera si los cobra', () => {
    expect(precioParaMostrar(p, true)).toBe('$12.000');
    expect(precioParaMostrar(p, false)).toBe('USD 50');
    expect(precioParaMostrar({ ...p, cobraExterior: false }, false)).toBe('$12.000');
    expect(precioParaMostrar({ ars: null, usd: null, cobraExterior: false }, true)).toBeNull();
  });
});

describe('etiquetaProfesionalPublica con género', () => {
  it('psicóloga, psicólogo o la forma doble', () => {
    expect(etiquetaProfesionalPublica({ profesion: 'psicologia' }, 'Femenino')).toBe('Psicóloga');
    expect(etiquetaProfesionalPublica({ profesion: 'psicologia' }, 'Masculino')).toBe('Psicólogo');
    expect(etiquetaProfesionalPublica({ profesion: 'psicologia' }, 'No binario')).toBe('Psicólogo/a');
    expect(etiquetaProfesionalPublica({ profesion: 'psicologia' })).toBe('Psicólogo/a');
  });
});

describe('lineaNacionalidad', () => {
  it('gentilicio según el género, o "De <país>" sin género', () => {
    expect(lineaNacionalidad('Argentina', 'Femenino')).toBe('Argentina');
    expect(lineaNacionalidad('Argentina', 'Masculino')).toBe('Argentino');
    expect(lineaNacionalidad('España', 'Femenino')).toBe('Española');
    expect(lineaNacionalidad('Argentina', 'No binario')).toBe('De Argentina');
    expect(lineaNacionalidad('Argentina')).toBe('De Argentina');
    expect(lineaNacionalidad('Alemania', 'Femenino')).toBe('Alemana');
    expect(lineaNacionalidad('Mongolia', 'Femenino')).toBe('De Mongolia');
    expect(lineaNacionalidad(null)).toBeNull();
  });

  it('respeta un gentilicio viejo cargado como texto libre', () => {
    expect(lineaNacionalidad('Argentino')).toBe('Argentino');
  });
});

describe('duracionUnica / lineaSesion', () => {
  it('solo se dice un número si hay uno solo', () => {
    expect(duracionUnica([50, 50, 50])).toBe(50);
    expect(duracionUnica([50, 60])).toBeNull();
    expect(duracionUnica([])).toBeNull();
    expect(duracionUnica([null, undefined, 0])).toBeNull();
    expect(lineaSesion(50)).toBe('Videollamada · 50 min');
    expect(lineaSesion(null)).toBe('Videollamada');
  });
});

describe('lineaProximoLugar', () => {
  // Miércoles 1/10/2026, 12:00 en Argentina (15:00 UTC).
  const ahora = Date.UTC(2026, 9, 1, 15, 0);
  const BA = 'America/Argentina/Buenos_Aires';

  it('hoy, mañana, día de la semana y fecha completa, contados en Argentina', () => {
    expect(lineaProximoLugar('2026-10-01', '18:00', ahora, BA).texto).toBe('Próximo turno: hoy, 18:00');
    expect(lineaProximoLugar('2026-10-02', '09:00', ahora, BA).texto).toBe('Próximo turno: mañana, 09:00');
    expect(lineaProximoLugar('2026-10-05', '10:00', ahora, BA).texto).toBe('Próximo turno: el lunes, 10:00');
    expect(lineaProximoLugar('2026-10-09', '10:00', ahora, BA).texto).toBe('Próximo turno: el viernes 9 de octubre, 10:00');
    expect(lineaProximoLugar('2026-10-02', '09:00', ahora, BA).paraVos).toBeNull();
  });

  it('desde afuera aclara la zona y da la equivalencia', () => {
    const r = lineaProximoLugar('2026-10-02', '18:00', ahora, 'Europe/Madrid');
    expect(r.texto).toBe('Próximo turno: mañana, 18:00 (hora de Argentina)');
    expect(r.paraVos).toBe('23:00 para vos');
  });
});

describe('motivoSinReserva', () => {
  it('dice por qué no se puede reservar', () => {
    expect(motivoSinReserva({ bloqueado: true, suspendido: false }, 'Lucía')).toBe('Bloqueaste a Lucía');
    expect(motivoSinReserva({ bloqueado: false, suspendido: true }, 'Lucía')).toBe('Por ahora no está tomando reservas');
    expect(motivoSinReserva({ bloqueado: false, suspendido: false }, 'Lucía')).toBeNull();
  });
});
