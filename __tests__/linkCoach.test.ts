import { linkCompartible, linkDelCoach, mensajeParaCompartir, SITIO_WEB } from '@/lib/linkCoach';

const coach = (o: Partial<{ slug: string | null; verified: boolean; availability_status: string }>) => ({
  slug: 'andre', verified: true, availability_status: 'activo', ...o,
});

describe('linkDelCoach', () => {
  it('aprobado y con slug: tiene link', () => {
    expect(linkDelCoach(coach({}))).toBe(`${SITIO_WEB}/c/andre`);
  });

  it('🔴 en pausa TAMBIÉN tiene link: es suyo, aunque hoy no se pueda compartir', () => {
    expect(linkDelCoach(coach({ availability_status: 'en_pausa' }))).toBe(`${SITIO_WEB}/c/andre`);
  });

  it('sin aprobar, no: la página pública no lo mostraría', () => {
    expect(linkDelCoach(coach({ verified: false }))).toBeNull();
  });

  it('sin slug, no', () => {
    expect(linkDelCoach(coach({ slug: null }))).toBeNull();
  });
});

describe('linkCompartible', () => {
  it('aprobado y activo: sí', () => {
    expect(linkCompartible(coach({}))).toBe(true);
  });

  it('🔴 en pausa, no: el link mostraría "no encontramos este perfil"', () => {
    expect(linkCompartible(coach({ availability_status: 'en_pausa' }))).toBe(false);
  });

  it('sin aprobar, no', () => {
    expect(linkCompartible(coach({ verified: false }))).toBe(false);
  });
});

describe('mensajeParaCompartir', () => {
  it('lleva el link tal cual, listo para mandar', () => {
    expect(mensajeParaCompartir(`${SITIO_WEB}/c/andre`)).toContain(`${SITIO_WEB}/c/andre`);
  });
});
