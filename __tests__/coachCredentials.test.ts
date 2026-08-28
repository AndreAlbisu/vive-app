import { lineaCredencial, validarCredencial, KIND_LABEL, type CredentialInput } from '@/lib/credentialRules';

const base: CredentialInput = {
  kind: 'titulo',
  title: 'Lic. en Psicología',
  institution: 'UBA',
  year: 2014,
  registrationNumber: null,
  filePath: 'abc/1.pdf',
};

describe('lineaCredencial', () => {
  it('junta institución y año', () => {
    expect(lineaCredencial({ institution: 'UBA', year: 2014 }))
      .toBe('UBA · 2014');
  });

  it('no deja separadores colgando cuando falta un dato', () => {
    expect(lineaCredencial({ institution: 'UBA', year: null }))
      .toBe('UBA');
    expect(lineaCredencial({ institution: null, year: 2014 }))
      .toBe('2014');
  });

  it('queda vacía si no hay nada que decir, en vez de inventar texto', () => {
    expect(lineaCredencial({ institution: null, year: null }))
      .toBe('');
  });

  it('ignora una institución que es solo espacios', () => {
    expect(lineaCredencial({ institution: '   ', year: 2014 }))
      .toBe('2014');
  });
});

describe('validarCredencial', () => {
  it('acepta una credencial completa', () => {
    expect(validarCredencial(base)).toBeNull();
  });

  it('exige un nombre con sentido', () => {
    expect(validarCredencial({ ...base, title: ' ' })).toMatch(/nombre del título/);
    expect(validarCredencial({ ...base, title: 'a' })).toMatch(/nombre del título/);
    expect(validarCredencial({ ...base, title: 'x'.repeat(121) })).toMatch(/demasiado largo/);
  });

  it('🔴 una matrícula sin número no verifica nada', () => {
    expect(validarCredencial({ ...base, kind: 'matricula', registrationNumber: null }))
      .toMatch(/necesita su número/);
    expect(validarCredencial({ ...base, kind: 'matricula', registrationNumber: '   ' }))
      .toMatch(/necesita su número/);
    expect(validarCredencial({ ...base, kind: 'matricula', registrationNumber: 'M.N. 12345' }))
      .toBeNull();
  });

  it('un título sí puede no tener número', () => {
    expect(validarCredencial({ ...base, kind: 'titulo', registrationNumber: null })).toBeNull();
  });

  it('🔴 sin documento no se puede cargar: es lo único que hace verificable la declaración', () => {
    expect(validarCredencial({ ...base, filePath: null })).toMatch(/documento/);
  });

  it('rechaza años imposibles, incluido el futuro', () => {
    expect(validarCredencial({ ...base, year: 1900 })).toMatch(/año/);
    expect(validarCredencial({ ...base, year: new Date().getFullYear() + 1 })).toMatch(/año/);
    expect(validarCredencial({ ...base, year: new Date().getFullYear() })).toBeNull();
  });

  it('el año es opcional', () => {
    expect(validarCredencial({ ...base, year: null })).toBeNull();
  });
});

describe('KIND_LABEL', () => {
  it('cubre los tres tipos que acepta el CHECK de la base', () => {
    expect(Object.keys(KIND_LABEL).sort()).toEqual(['certificacion', 'matricula', 'titulo']);
  });
});
