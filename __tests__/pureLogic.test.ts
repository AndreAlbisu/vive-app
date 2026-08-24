import { isCancelLate } from '../lib/bookingHelpers';
import { hasContactInfo } from '../lib/contactInfoGuard';
import { encryptMessage, decryptMessage } from '../lib/encryption';

// ─── Ventana de cancelación (§9.1) ───────────────────────────────────────────
// Importa plata: una cancelación TARDÍA del usuario pierde el reembolso
// (trg_mark_refund_on_cancel). Un error de borde acá le cuesta la sesión a
// alguien, o le devuelve plata al que no correspondía.
describe('isCancelLate', () => {
  // isCancelLate lee Date.now() adentro, así que se fija el reloj.
  //
  // ⚠️ El ISO va con `-03:00` explícito, no como hora local sin zona. Sin
  // esto, `new Date(iso)` lo interpreta en la zona de la MÁQUINA que corre el
  // test — coincide por casualidad en Argentina, pero en cualquier otra (este
  // sandbox corre en Sídney, UTC+10) el reloj fijado queda corrido y los
  // casos de borde fallan sin que el código de producción tenga nada que ver
  // (`scheduledAtMs`, que sí usa la zona de Argentina explícita, ya estaba
  // bien). Encontrado el 24/08/2026 corriendo la suite en este sandbox.
  const fixNow = (iso: string) => jest.spyOn(Date, 'now').mockReturnValue(new Date(`${iso}-03:00`).getTime());
  afterEach(() => jest.restoreAllMocks());

  it('no es tardía con más de 24hs de anticipación', () => {
    fixNow('2026-08-10T09:00:00');
    expect(isCancelLate('2026-08-12', '10:00')).toBe(false);
  });

  it('es tardía dentro de las 24hs', () => {
    fixNow('2026-08-11T15:00:00');
    expect(isCancelLate('2026-08-12', '10:00')).toBe(true);
  });

  it('en el borde exacto de 24hs todavía NO es tardía', () => {
    fixNow('2026-08-11T10:00:00');
    expect(isCancelLate('2026-08-12', '10:00')).toBe(false);
  });

  it('un segundo después del borde ya es tardía', () => {
    fixNow('2026-08-11T10:00:01');
    expect(isCancelLate('2026-08-12', '10:00')).toBe(true);
  });

  it('una sesión ya pasada cuenta como tardía', () => {
    fixNow('2026-08-13T10:00:00');
    expect(isCancelLate('2026-08-12', '10:00')).toBe(true);
  });
});

// ─── Anti-fuga: datos de contacto (medida #2) ────────────────────────────────
describe('hasContactInfo', () => {
  it('detecta un email', () => {
    expect(hasContactInfo('escribime a juan@gmail.com')).toBe(true);
  });

  it('detecta links en sus tres formas', () => {
    expect(hasContactInfo('mirá https://midominio.com/algo')).toBe(true);
    expect(hasContactInfo('entrá a www.midominio.com')).toBe(true);
    expect(hasContactInfo('mi web es midominio.com.ar')).toBe(true);
  });

  it('detecta teléfonos y CBU con separadores', () => {
    expect(hasContactInfo('llamame al 351 234 5678')).toBe(true);
    expect(hasContactInfo('CBU 0000003100010000000001')).toBe(true);
    expect(hasContactInfo('mi numero: (011) 4444-5555')).toBe(true);
  });

  it('detecta palabras de contacto y de pago externo', () => {
    for (const w of ['whatsapp', 'wsp', 'telegram', 'instagram', 'cbu', 'cvu', 'alias', 'transferencia']) {
      expect(hasContactInfo(`arreglamos por ${w}`)).toBe(true);
    }
  });

  it('detecta un @usuario', () => {
    expect(hasContactInfo('seguime en @mi.cuenta')).toBe(true);
  });

  it('ignora tildes y mayúsculas', () => {
    expect(hasContactInfo('mi Instágram')).toBe(true);
  });

  // Los falsos positivos importan tanto como los aciertos: esta advertencia
  // aparece en medio de una conversación, y una que salta de más se ignora.
  describe('no dispara con texto legítimo', () => {
    const limpios = [
      'Hola, ¿cómo estás? Nos vemos el martes.',
      'Trabajo con ansiedad y estrés hace 8 años.',
      'Tengo 20 años de experiencia y di 15 sesiones este mes.',
      'La sesión dura 50 minutos.',
      'Podemos empezar a las 15:30 si te queda cómodo.',
      // Palabras que CONTIENEN keywords pero no lo son (por eso van con \b).
      'Es una reserva instantánea, no hace falta instalar nada.',
    ];
    for (const t of limpios) {
      it(`"${t.slice(0, 40)}…"`, () => expect(hasContactInfo(t)).toBe(false));
    }
  });
});

// ─── Cifrado de mensajes ─────────────────────────────────────────────────────
// ⚠️ Esto es XOR + base64: obfuscación, NO cifrado de extremo a extremo. Los
// T&C §15.2 lo dicen explícitamente. Estos tests verifican que el ida y vuelta
// no corrompa mensajes, no que sea seguro — porque no lo es.
describe('encryptMessage / decryptMessage', () => {
  const casos = [
    'hola',
    'Hola, ¿cómo estás?',
    'ñandú, corazón, año',
    'emoji 🌱 y símbolos <>&"\'',
    'saltos\nde\nlínea',
    'a'.repeat(500),
    '',
  ];

  for (const original of casos) {
    it(`ida y vuelta: "${original.slice(0, 24)}${original.length > 24 ? '…' : ''}"`, () => {
      expect(decryptMessage(encryptMessage(original))).toBe(original);
    });
  }

  it('el texto cifrado no es el original', () => {
    const original = 'nos vemos el martes';
    expect(encryptMessage(original)).not.toBe(original);
  });

  // Los dos devuelven la entrada tal cual si algo falla, para no perder
  // mensajes. Un texto plano viejo tiene que sobrevivir a decryptMessage.
  it('descifrar algo que no está cifrado devuelve la entrada, no rompe', () => {
    expect(() => decryptMessage('esto no es base64 válido ñ')).not.toThrow();
  });
});
