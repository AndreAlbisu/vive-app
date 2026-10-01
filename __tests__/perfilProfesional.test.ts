import { firmaDeResena, motivoSinPerfil, frasesDeTrabajo, precioParaMostrar } from '@/lib/perfilProfesional';
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
