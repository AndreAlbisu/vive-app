import {
  lineaCredencial, validarCredencial, KIND_LABEL, KIND_LABEL_FORM, formularioFormacion, grupoFormacion, encuadreDeSesion, encuadreDesdeFlag,
  type CredentialInput, type CredentialKind,
} from '@/lib/credentialRules';

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

// ─── El encuadre de la sesión ────────────────────────────────────────────────
// Los cuatro perfiles reales que produce la tabla, más el caso que motivó la
// separación: el título sin matrícula.

describe('encuadreDeSesion', () => {
  const cred = (kind: CredentialKind) => ({ kind });

  it('sin credenciales es acompañamiento', () => {
    const e = encuadreDeSesion([]);
    expect(e.habilitado).toBe(false);
    expect(e.tituloSinMatricula).toBe(false);
    expect(e.etiqueta).toBe('Sesiones de acompañamiento');
  });

  it('una certificación no habilita', () => {
    // Coaching, mindfulness, sexología: formaciones serias para las que no
    // existe matrícula estatal. No les falta nada, y la etiqueta no puede
    // sugerir lo contrario.
    const e = encuadreDeSesion([cred('certificacion')]);
    expect(e.habilitado).toBe(false);
    expect(e.tituloSinMatricula).toBe(false);
  });

  it('un título SIN matrícula no habilita, y se marca aparte', () => {
    // El perfil más confuso de la app: abajo se ve "Lic. en Psicología ✓" y
    // arriba dice acompañamiento. Las dos son ciertas, y sin la aclaración el
    // usuario le cree al título.
    const e = encuadreDeSesion([cred('titulo')]);
    expect(e.habilitado).toBe(false);
    expect(e.tituloSinMatricula).toBe(true);
  });

  it('la matrícula habilita, y entonces el título ya no necesita aclaración', () => {
    const e = encuadreDeSesion([cred('titulo'), cred('matricula')]);
    expect(e.habilitado).toBe(true);
    expect(e.tituloSinMatricula).toBe(false);
    expect(e.etiqueta).toBe('Matrícula verificada');
  });

  it('nunca dice "tratamiento" — Vita no caracteriza la prestación (T&C §5)', () => {
    for (const e of [encuadreDeSesion([]), encuadreDeSesion([cred('matricula')])]) {
      expect(e.etiqueta.toLowerCase()).not.toContain('tratamiento');
    }
  });

  it('encuadreDesdeFlag coincide con la lista, salvo la aclaración del título', () => {
    expect(encuadreDesdeFlag(true)).toEqual(encuadreDeSesion([cred('matricula')]));
    expect(encuadreDesdeFlag(false)).toEqual(encuadreDeSesion([]));
  });
});

describe('el formulario de Formación según la profesión', () => {
  it('la profesión verificada manda; sin ella, lo que eligió al postularse', () => {
    expect(grupoFormacion('psicologia', 'Coach')).toBe('psicologia');
    expect(grupoFormacion('nutricion', null)).toBe('nutricion');
    // Se postuló como nutricionista y la matrícula todavía no está verificada:
    // es justo quien tiene que cargarla, no se lo trata como coach.
    expect(grupoFormacion(null, 'Nutricionista')).toBe('nutricion');
    expect(grupoFormacion(null, 'Psicólogo/a')).toBe('psicologia');
    expect(grupoFormacion(null, 'Coach')).toBe('coaching');
    expect(grupoFormacion(null, null)).toBe('coaching');
  });

  it('el coach arranca en certificación; psicólogos y nutricionistas, en matrícula', () => {
    expect(formularioFormacion('coaching').tipos[0]).toBe('certificacion');
    expect(formularioFormacion('nutricion').tipos[0]).toBe('matricula');
    expect(formularioFormacion('psicologia').tipos[0]).toBe('matricula');
  });

  it('todos pueden cargar los tres tipos', () => {
    (['coaching', 'nutricion', 'psicologia'] as const).forEach(g => {
      expect([...formularioFormacion(g).tipos].sort()).toEqual(['certificacion', 'matricula', 'titulo']);
    });
  });

  it('en el formulario dice "o curso"; en el perfil público no', () => {
    expect(KIND_LABEL_FORM.certificacion).toBe('Certificación o curso');
    expect(KIND_LABEL.certificacion).toBe('Certificación');
  });

  it('ningún texto usa la raya', () => {
    (['coaching', 'nutricion', 'psicologia'] as const).forEach(g => {
      const f = formularioFormacion(g);
      const textos = [...Object.values(f.ayuda), ...Object.values(f.ejemplos).flatMap(e => [e.titulo, e.institucion])];
      textos.forEach(t => expect(t).not.toContain('—'));
    });
  });
});
