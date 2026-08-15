import {
  isNewCoach,
  passesQualityBar,
  medianPrice,
  isEligibleForSlot,
  buildSlotContext,
  rankDeck,
  NEW_MAX_REVIEWS,
  NEW_MAX_AGE_DAYS,
  MIN_REBOOKING_SAMPLE,
  MIN_RECOMMEND_RATING,
  MIN_RECOMMEND_REVIEWS,
  MIN_RECOMMEND_REBOOKING,
  MIN_TRENDING_BOOKERS,
} from '../lib/coachDeckRanking';
import type { CachedCoach } from '../lib/coachesCache';

const NOW = new Date('2026-08-15T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

let seq = 0;
function coach(over: Partial<CachedCoach> = {}): CachedCoach {
  seq += 1;
  return {
    id: `c${seq}`,
    name: `Coach ${seq}`,
    specialty: 'Coach',
    priceFrom: 10000,
    nationality: 'Argentina',
    gender: '',
    avatarUrl: null,
    bio: null,
    topics: [],
    verified: true,
    avgRating: null,
    reviewCount: 0,
    createdAt: daysAgo(365),
    rebookingRate: null,
    completadasCount: 0,
    recentBookers: 0,
    ...over,
  };
}

// ─── isNewCoach ──────────────────────────────────────────────────────────────
describe('isNewCoach', () => {
  it('es nuevo con pocas reseñas Y poca antigüedad', () => {
    expect(isNewCoach(coach({ reviewCount: 1, createdAt: daysAgo(3) }), NOW)).toBe(true);
  });

  // El AND es el punto de v3: cuando era un OR, un coach que nunca llegaba a 5
  // reseñas quedaba "nuevo" para siempre y diluía la rotación de los que recién
  // llegaban. Estos dos casos son los que un OR dejaría pasar.
  it('NO es nuevo si es viejo, aunque tenga 0 reseñas', () => {
    expect(isNewCoach(coach({ reviewCount: 0, createdAt: daysAgo(200) }), NOW)).toBe(false);
  });

  it('NO es nuevo si tiene muchas reseñas, aunque se haya registrado ayer', () => {
    expect(isNewCoach(coach({ reviewCount: NEW_MAX_REVIEWS, createdAt: daysAgo(1) }), NOW)).toBe(false);
  });

  it('falla cerrado sin createdAt', () => {
    expect(isNewCoach(coach({ reviewCount: 0, createdAt: null }), NOW)).toBe(false);
    expect(isNewCoach(coach({ reviewCount: 0, createdAt: undefined }), NOW)).toBe(false);
  });

  describe('bordes', () => {
    it(`${NEW_MAX_REVIEWS - 1} reseñas todavía es nuevo, ${NEW_MAX_REVIEWS} ya no`, () => {
      expect(isNewCoach(coach({ reviewCount: NEW_MAX_REVIEWS - 1, createdAt: daysAgo(1) }), NOW)).toBe(true);
      expect(isNewCoach(coach({ reviewCount: NEW_MAX_REVIEWS, createdAt: daysAgo(1) }), NOW)).toBe(false);
    });

    it(`justo en ${NEW_MAX_AGE_DAYS} días ya NO es nuevo`, () => {
      expect(isNewCoach(coach({ createdAt: daysAgo(NEW_MAX_AGE_DAYS) }), NOW)).toBe(false);
      expect(isNewCoach(coach({ createdAt: daysAgo(NEW_MAX_AGE_DAYS - 0.01) }), NOW)).toBe(true);
    });
  });
});

// ─── passesQualityBar ────────────────────────────────────────────────────────
describe('passesQualityBar', () => {
  it('el rating es piso en los dos tramos', () => {
    expect(passesQualityBar(coach({ avgRating: MIN_RECOMMEND_RATING - 0.1, reviewCount: 50 }))).toBe(false);
    expect(passesQualityBar(coach({
      avgRating: MIN_RECOMMEND_RATING - 0.1,
      completadasCount: 100, rebookingRate: 0.9,
    }))).toBe(false);
  });

  it('sin rating no pasa', () => {
    expect(passesQualityBar(coach({ avgRating: null, reviewCount: 50 }))).toBe(false);
  });

  describe('con muestra chica manda la cantidad de reseñas', () => {
    it(`pasa con ${MIN_RECOMMEND_REVIEWS} reseñas`, () => {
      expect(passesQualityBar(coach({
        avgRating: MIN_RECOMMEND_RATING, reviewCount: MIN_RECOMMEND_REVIEWS,
        completadasCount: MIN_REBOOKING_SAMPLE - 1,
      }))).toBe(true);
    });

    it(`no pasa con ${MIN_RECOMMEND_REVIEWS - 1}`, () => {
      expect(passesQualityBar(coach({
        avgRating: 5, reviewCount: MIN_RECOMMEND_REVIEWS - 1,
        completadasCount: MIN_REBOOKING_SAMPLE - 1,
      }))).toBe(false);
    });
  });

  describe('con muestra suficiente manda el reagendamiento', () => {
    // Es el punto del diseño: una cuenta falsa puede dejar 5★, pero no puede
    // volver a reservar y pagar sin poner la plata.
    it('5★ con muchas reseñas NO alcanza si el reagendamiento es bajo', () => {
      expect(passesQualityBar(coach({
        avgRating: 5, reviewCount: 100,
        completadasCount: MIN_REBOOKING_SAMPLE, rebookingRate: MIN_RECOMMEND_REBOOKING - 0.01,
      }))).toBe(false);
    });

    it('pasa con reagendamiento en la barra, aunque tenga pocas reseñas', () => {
      expect(passesQualityBar(coach({
        avgRating: MIN_RECOMMEND_RATING, reviewCount: 1,
        completadasCount: MIN_REBOOKING_SAMPLE, rebookingRate: MIN_RECOMMEND_REBOOKING,
      }))).toBe(true);
    });

    it('sin rebookingRate no pasa, aunque tenga la muestra', () => {
      expect(passesQualityBar(coach({
        avgRating: 5, reviewCount: 100,
        completadasCount: 50, rebookingRate: null,
      }))).toBe(false);
    });
  });
});

// ─── medianPrice ─────────────────────────────────────────────────────────────
describe('medianPrice', () => {
  it('cantidad impar: el del medio', () => {
    expect(medianPrice([coach({ priceFrom: 5000 }), coach({ priceFrom: 20000 }), coach({ priceFrom: 9000 })])).toBe(9000);
  });

  it('cantidad par: promedio de los dos del medio', () => {
    expect(medianPrice([
      coach({ priceFrom: 4000 }), coach({ priceFrom: 6000 }),
      coach({ priceFrom: 10000 }), coach({ priceFrom: 20000 }),
    ])).toBe(8000);
  });

  it('descarta precios no finitos', () => {
    expect(medianPrice([
      coach({ priceFrom: 10000 }), coach({ priceFrom: NaN as any }),
      coach({ priceFrom: undefined as any }), coach({ priceFrom: 20000 }),
    ])).toBe(15000);
  });

  it('sin precios devuelve Infinity', () => {
    expect(medianPrice([])).toBe(Infinity);
  });
});

// ─── isEligibleForSlot ───────────────────────────────────────────────────────
describe('isEligibleForSlot', () => {
  const ctx = { medianPrice: 10000, now: NOW };

  it('tendencia exige el piso de reservantes distintos', () => {
    expect(isEligibleForSlot('tendencia', coach({ recentBookers: MIN_TRENDING_BOOKERS }), ctx)).toBe(true);
    expect(isEligibleForSlot('tendencia', coach({ recentBookers: MIN_TRENDING_BOOKERS - 1 }), ctx)).toBe(false);
  });

  it('económico incluye a quien está justo EN la mediana', () => {
    expect(isEligibleForSlot('economico', coach({ priceFrom: 10000 }), ctx)).toBe(true);
    expect(isEligibleForSlot('economico', coach({ priceFrom: 10001 }), ctx)).toBe(false);
  });

  it('sin precio no entra a económico', () => {
    expect(isEligibleForSlot('economico', coach({ priceFrom: undefined as any }), ctx)).toBe(false);
  });
});

// ─── rankDeck ────────────────────────────────────────────────────────────────
describe('rankDeck', () => {
  const recomendado = () => coach({ avgRating: 5, reviewCount: 10, priceFrom: 50000 });
  const tendencia   = () => coach({ recentBookers: 10, priceFrom: 50000 });
  const nuevo       = () => coach({ createdAt: daysAgo(2), priceFrom: 50000 });
  const barato      = () => coach({ priceFrom: 1000 });

  it('un coach aparece una sola vez, aunque califique para varios slots', () => {
    const multi = coach({ avgRating: 5, reviewCount: 10, recentBookers: 10, createdAt: daysAgo(1), priceFrom: 1 });
    const deck = rankDeck([multi], 'u1', NOW);
    expect(deck).toHaveLength(1);
    expect(deck[0].coach.id).toBe(multi.id);
  });

  it('ocupa el slot de MAYOR prioridad para el que califica', () => {
    const multi = coach({ avgRating: 5, reviewCount: 10, recentBookers: 10, createdAt: daysAgo(1), priceFrom: 1 });
    expect(rankDeck([multi], 'u1', NOW)[0].slot.key).toBe('recomendado');
  });

  it('omite los slots sin ningún candidato en vez de etiquetar mal', () => {
    // Solo califica para "nuevo": es caro y no tiene reseñas ni reservantes.
    const solo = coach({ createdAt: daysAgo(2), priceFrom: 99999 });
    const caro = coach({ priceFrom: 100000, createdAt: daysAgo(900) });
    const keys = rankDeck([solo, caro], 'u1', NOW).map(e => e.slot.key);
    expect(keys).toContain('nuevo');
    expect(keys).not.toContain('recomendado');
    expect(keys).not.toContain('tendencia');
  });

  it('nunca devuelve más entradas que slots', () => {
    const muchos = Array.from({ length: 30 }, () => coach({ avgRating: 5, reviewCount: 10, recentBookers: 10, createdAt: daysAgo(1) }));
    expect(rankDeck(muchos, 'u1', NOW).length).toBeLessThanOrEqual(4);
  });

  it('con la puerta vacía devuelve vacío', () => {
    expect(rankDeck([], 'u1', NOW)).toEqual([]);
  });

  // Invariante documentado: la mediana se calcula sobre la puerta COMPLETA, no
  // sobre lo que queda después de que los slots de arriba consumieron coaches.
  // Si no, la barra de "económico" se movería sola según quién ya fue elegido.
  it('la mediana no se mueve cuando los slots de arriba consumen coaches', () => {
    const puerta = [recomendado(), tendencia(), nuevo(), barato()];
    const ctxCompleto = buildSlotContext(puerta, NOW);
    const deck = rankDeck(puerta, 'u1', NOW);
    const eco = deck.find(e => e.slot.key === 'economico');
    expect(eco).toBeDefined();
    // El barato califica contra la mediana de los CUATRO, no contra la de lo
    // que sobró después de sacar tres.
    expect(eco!.coach.priceFrom).toBeLessThanOrEqual(ctxCompleto.medianPrice);
  });

  describe('rotación por sorteo', () => {
    const pool = () => Array.from({ length: 8 }, () => coach({ avgRating: 5, reviewCount: 10 }));

    it('es determinístico: misma semilla, mismo resultado', () => {
      const p = pool();
      expect(rankDeck(p, 'u1', NOW).map(e => e.coach.id))
        .toEqual(rankDeck(p, 'u1', NOW).map(e => e.coach.id));
    });

    it('dos personas distintas ven decks distintos el mismo día', () => {
      const p = pool();
      const a = rankDeck(p, 'usuario-a', NOW).map(e => e.coach.id).join();
      const b = rankDeck(p, 'usuario-b', NOW).map(e => e.coach.id).join();
      expect(a).not.toBe(b);
    });

    it('la misma persona ve otro deck al día siguiente', () => {
      const p = pool();
      const hoy = rankDeck(p, 'u1', NOW).map(e => e.coach.id).join();
      const manana = rankDeck(p, 'u1', new Date(NOW.getTime() + 86_400_000)).map(e => e.coach.id).join();
      expect(hoy).not.toBe(manana);
    });

    it('el anónimo tiene su propia rotación estable', () => {
      const p = pool();
      expect(rankDeck(p, undefined, NOW).map(e => e.coach.id))
        .toEqual(rankDeck(p, undefined, NOW).map(e => e.coach.id));
    });

    it('la rotación no cambia dentro del mismo día', () => {
      const p = pool();
      const manana = rankDeck(p, 'u1', new Date('2026-08-15T01:00:00Z')).map(e => e.coach.id).join();
      const tarde  = rankDeck(p, 'u1', new Date('2026-08-15T20:00:00Z')).map(e => e.coach.id).join();
      expect(manana).toBe(tarde);
    });

    // ⚠️ Fija el comportamiento REAL, que no es el que uno supondría: `dayKey`
    // usa `toISOString()`, o sea UTC, así que el "día" del deck arranca a las
    // 21:00 de Argentina y no a la medianoche. Quien entra a las 22:00 de un
    // lunes ya ve el deck del martes.
    //
    // No rompe nada —la rotación sigue siendo una vez cada 24hs— pero el resto
    // del proyecto sí razona en hora local argentina (`complete_confirmed_sessions`,
    // la ventana de §9.3). Si algún día se decide alinearlo, este test va a
    // fallar: eso es a propósito, para que el cambio sea deliberado.
    it('el día del deck arranca a las 21:00 ART, no a la medianoche (UTC)', () => {
      const p = pool();
      const antes   = rankDeck(p, 'u1', new Date('2026-08-15T23:00:00Z')).map(e => e.coach.id).join(); // 20:00 ART
      const despues = rankDeck(p, 'u1', new Date('2026-08-16T00:30:00Z')).map(e => e.coach.id).join(); // 21:30 ART
      expect(antes).not.toBe(despues);
    });
  });
});
