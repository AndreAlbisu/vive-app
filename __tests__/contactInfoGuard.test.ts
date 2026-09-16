import { detectContactInfo, detectContactInfoAcross, hasContactInfo, isContactLink } from '@/lib/contactInfoGuard';

// Las 17 formas comunes de pasarse el contacto contra las que se midió el
// detector el 16/09/2026. La versión anterior detectaba 3.
describe('detecta las evasiones comunes', () => {
  const casos: [string, string][] = [
    ['teléfono con espacios', 'mi cel es 11 5555 4444'],
    ['teléfono en palabras', 'once cincuenta y cinco cincuenta y cinco cuarenta y cuatro'],
    ['link de whatsapp', 'wa.me/5491155554444'],
    ['instagram abreviado', 'buscame en ig juanperez'],
    ['insta', 'seguime en insta: juan.coach'],
    ['arroba con espacio', 'juan @ gmail com'],
    ['gmail sin arroba', 'juanperez gmail'],
    ['alias', 'te paso el alias juan.coach.mp'],
    ['mercado pago', 'pagame por mercado pago directo'],
    ['por fuera, explícito', 'si querés lo hacemos por fuera de la app y te sale más barato'],
    ['efectivo', 'la próxima pagame en efectivo'],
    ['zoom', 'hagamos la próxima por zoom'],
    ['llamame', 'llamame y lo arreglamos'],
    ['linkedin', 'agregame en linkedin'],
    ['whatsapp mal escrito', 'escribime al guasap'],
    ['número pedido con palabras', 'mi num: uno uno cinco cinco'],
    ['por privado', 'seguimos por privado'],
  ];
  it.each(casos)('%s', (_nombre, texto) => {
    expect(hasContactInfo(texto)).toBe(true);
  });
});

// 🔴 Tan importantes como las de arriba. Estos textos van a aparecer en una
// charla terapéutica o en la presentación de un profesional, y ninguno es
// irse de la app. Un falso positivo en la bio BLOQUEA guardarla.
describe('NO dispara con lo que es una charla normal', () => {
  const casos: [string, string][] = [
    ['transferencia como concepto clínico', 'Trabajo desde el psicoanálisis: la transferencia es central en el proceso.'],
    ['efectivo como adjetivo', 'fue muy efectivo lo que hablamos la última vez'],
    ['por fuera sin "de la app"', 'por fuera me muestro bien pero por dentro no'],
    ['fecha y hora', 'nos vemos el 15/09 a las 18:00'],
    ['edad y cantidades', 'tengo 34 años y dos hijos, uno de quince'],
    ['me llamó la atención', 'me llamó la atención lo que dijiste'],
    ['el celular sin posesivo', 'se me rompió el celular y no pude entrar'],
    ['número de sesiones', 'cuál es el número de sesiones que recomendás'],
    ['preocupación por pagar', 'tengo miedo de no poder pagar la próxima sesión'],
    ['pagos dentro de la app', 'ya pagué la sesión con la tarjeta'],
    // El que rompió la primera versión: "una" y "uno" son artículos y pronombres.
    ['muchos "una" y "uno" sueltos', 'Fue una semana dura, una de esas donde uno siente que no avanza. Una vez más me pasó, una y otra vez, y uno no sabe qué hacer.'],
    ['bio con "una" repetido', 'Trabajo una sesión por semana, con una mirada integral: uno de mis focos es la ansiedad, y una tercera línea es el estrés de una forma práctica.'],
  ];
  it.each(casos)('%s', (_nombre, texto) => {
    expect(detectContactInfo(texto)).toBeNull();
  });
});

describe('qué señal devuelve', () => {
  it('distingue el tipo, que es lo que va al evento en vez del texto', () => {
    expect(detectContactInfo('juan@gmail.com')).toBe('mail');
    expect(detectContactInfo('11 5555 4444')).toBe('telefono');
    expect(detectContactInfo('buscame en insta')).toBe('red_social');
    expect(detectContactInfo('pagame en efectivo')).toBe('pago_externo');
    expect(detectContactInfo('lo hacemos fuera de la app')).toBe('fuera_de_la_app');
    expect(detectContactInfo('pasame tu celu')).toBe('pedido_de_contacto');
  });
});

describe('el teléfono partido en dos mensajes', () => {
  it('se detecta juntando la cola del mensaje anterior', () => {
    expect(detectContactInfo('4444')).toBeNull();
    expect(detectContactInfoAcross('te paso: 11 5555', '4444')).toBe('telefono');
  });

  it('dos mensajes normales con números no se juntan en un teléfono', () => {
    expect(detectContactInfoAcross('nos vemos a las 18', 'o 19 si llego tarde')).toBeNull();
  });
});

describe('links de un recurso', () => {
  it('bloquea los que van a redes, linktree o acortadores', () => {
    expect(isContactLink('https://instagram.com/juan.coach')).toBe(true);
    expect(isContactLink('https://linktr.ee/juan')).toBe(true);
    expect(isContactLink('wa.me/5491155554444')).toBe(true);
    expect(isContactLink('https://bit.ly/abc')).toBe(true);
  });

  it('deja pasar los que son contenido', () => {
    expect(isContactLink('https://www.youtube.com/watch?v=abc')).toBe(false);
    expect(isContactLink('https://open.spotify.com/episode/xyz')).toBe(false);
  });
});
