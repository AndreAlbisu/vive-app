import { estaSuspendido, buildChecklist, blockingReason, puedeCobrar, type VisibilitySelf } from '@/lib/coachVisibility';

const base = {
  id: 'u1', name: 'Coach', specialty: '', priceFrom: 5000, nationality: '', gender: '',
  avatarUrl: 'x', bio: 'x', topics: ['ansiedad'], verified: true,
  availabilityStatus: 'activo' as const, hasSlotThisWeek: true, hasVideo: true, instantBooking: true,
  acceptsMp: true,
};
const self = (extra: Partial<VisibilitySelf>): VisibilitySelf => ({ ...base, ...extra } as VisibilitySelf);

const AHORA = new Date('2026-09-16T12:00:00Z');

describe('estaSuspendido', () => {
  it('sin sanción no está suspendido', () => {
    expect(estaSuspendido(self({}), AHORA)).toBe(false);
    expect(estaSuspendido(self({ suspendidoHasta: null }), AHORA)).toBe(false);
  });

  it('una fecha futura suspende', () => {
    expect(estaSuspendido(self({ suspendidoHasta: '2026-09-30T00:00:00Z' }), AHORA)).toBe(true);
  });

  it('una fecha pasada ya no suspende — la suspensión se vence sola', () => {
    expect(estaSuspendido(self({ suspendidoHasta: '2026-09-01T00:00:00Z' }), AHORA)).toBe(false);
  });

  // 🔴 El caso que no puede fallar: la BAJA se guarda como 'infinity', que no es
  // una fecha parseable. Sin el chequeo explícito, `new Date('infinity')` da
  // Invalid Date, la comparación es false, y el coach dado de baja se leería
  // como si no tuviera nada — el error más caro posible de esta función.
  it("'infinity' es la baja y suspende para siempre", () => {
    expect(estaSuspendido(self({ suspendidoHasta: 'infinity' }), AHORA)).toBe(true);
  });

  it('una fecha ilegible no suspende a nadie por accidente', () => {
    expect(estaSuspendido(self({ suspendidoHasta: 'cualquier cosa' }), AHORA)).toBe(false);
  });
});

describe('el checklist de visibilidad', () => {
  it('pone la sanción primera y bloqueante, por encima de todo lo demás', () => {
    const items = buildChecklist(self({ suspendidoHasta: '2026-12-01T00:00:00Z' }));
    expect(items[0].key).toBe('sancion');
    expect(blockingReason(items)?.key).toBe('sancion');
  });

  it('sin sanción el checklist no la menciona', () => {
    const items = buildChecklist(self({}));
    expect(items.some(i => i.key === 'sancion')).toBe(false);
  });

  // Un coach suspendido Y sin temas tiene dos problemas, pero el que le impide
  // hacer algo al respecto es la sanción: es el único que no puede resolver solo.
  it('la sanción gana sobre otros bloqueos que el coach sí podría resolver', () => {
    const items = buildChecklist(self({ suspendidoHasta: 'infinity', topics: [] }));
    expect(blockingReason(items)?.key).toBe('sancion');
  });
});

// 24/09/2026. Sin medio de cobro el catálogo no lo muestra: el checklist lo
// tiene que decir, o el coach ve todo en verde y sigue invisible.
describe('el cobro en el checklist', () => {
  it('cualquiera de los tres medios alcanza', () => {
    expect(puedeCobrar({ acceptsMp: true })).toBe(true);
    expect(puedeCobrar({ acceptsPaypal: true })).toBe(true);
    expect(puedeCobrar({ acceptsUsdt: true })).toBe(true);
    expect(puedeCobrar({})).toBe(false);
  });

  it('sin medio de cobro es lo que lo bloquea, y lleva a la sección de cobro', () => {
    const bloqueo = blockingReason(buildChecklist(self({ acceptsMp: false })));
    expect(bloqueo?.key).toBe('cobro');
    expect(bloqueo?.route).toBe('/perfil?seccion=cobro');
  });

  it('con Mercado Pago conectado no bloquea', () => {
    expect(blockingReason(buildChecklist(self({})))).toBeNull();
  });
});
