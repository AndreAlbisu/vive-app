import { agruparPalabras } from '@/lib/agruparPalabras';

// Lo que se ve, palabra por palabra: los pedazos en negrita entre asteriscos.
const ver = (g: ReturnType<typeof agruparPalabras>) =>
  g.map(p => p.map(x => (x.fuerte ? `*${x.t}*` : x.t)).join(''));

describe('agruparPalabras', () => {
  it('parte en palabras con su espacio, menos la última', () => {
    expect(ver(agruparPalabras([{ texto: 'Algo se acomodó.' }]))).toEqual(['Algo ', 'se ', 'acomodó.']);
  });

  it('🔴 la negrita pegada a un signo queda en la MISMA palabra', () => {
    // El caso real de la voz: "Días difíciles, y los registrás igual."
    const g = agruparPalabras([
      { texto: '' },
      { texto: 'Días difíciles', fuerte: true },
      { texto: ', y los registrás igual.' },
    ]);
    expect(ver(g)).toEqual(['*Días* ', '*difíciles*, ', 'y ', 'los ', 'registrás ', 'igual.']);
  });

  it('negrita en el medio, separada por espacios', () => {
    const g = agruparPalabras([
      { texto: 'Hace ' },
      { texto: '6 días', fuerte: true },
      { texto: ' que venís.' },
    ]);
    expect(ver(g)).toEqual(['Hace ', '*6* ', '*días* ', 'que ', 'venís.']);
  });

  it('colapsa los espacios repetidos, como <Text>', () => {
    expect(ver(agruparPalabras([{ texto: 'uno   dos' }]))).toEqual(['uno ', 'dos']);
  });

  it('tramos vacíos o solo espacios no generan palabras', () => {
    expect(agruparPalabras([{ texto: '' }, { texto: '   ' }])).toEqual([]);
  });
});
