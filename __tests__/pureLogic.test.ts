import { hayReembolsoAlCancelar, isCancelLate, esperaConfirmacionDelCoach } from '../lib/bookingHelpers';
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

  it('🔴 FALLA CERRADO sin clave: tira en vez de devolver el texto plano', () => {
    // Antes hacía `catch { return text }`, o sea que ante cualquier problema
    // guardaba el mensaje EN CLARO en una columna que todo el sistema trata
    // como obfuscada — y como descifrar es tolerante, se leía bien y nadie se
    // enteraba nunca. Guardar en claro sin decirlo es peor que no guardar.
    jest.resetModules();
    const anterior = process.env.EXPO_PUBLIC_ENCRYPTION_KEY;
    delete process.env.EXPO_PUBLIC_ENCRYPTION_KEY;
    try {
      const sinClave = require('@/lib/encryption');
      expect(() => sinClave.encryptMessage('hola')).toThrow(/EXPO_PUBLIC_ENCRYPTION_KEY/);
      // Descifrar sí es tolerante: hay mensajes viejos guardados en claro y
      // esconderlos sería perder historial de conversaciones reales.
      expect(sinClave.decryptMessage('lo que sea')).toBe('lo que sea');
    } finally {
      process.env.EXPO_PUBLIC_ENCRYPTION_KEY = anterior;
      jest.resetModules();
    }
  });

  it('un emoji partido al medio no rompe el envío', () => {
    // Un sustituto suelto (media mitad de un par) es lo ÚNICO que hacía fallar
    // a `encodeURIComponent`, y por lo tanto la única causa real del camino de
    // error. Llega al pegar texto de otra app o al truncar un emoji.
    const partido = 'mira esto \uD83C';
    expect(() => encryptMessage(partido)).not.toThrow();
    expect(decryptMessage(encryptMessage(partido))).toContain('mira esto');
  });

  // Los dos devuelven la entrada tal cual si algo falla, para no perder
  // mensajes. Un texto plano viejo tiene que sobrevivir a decryptMessage.
  it('descifrar algo que no está cifrado devuelve la entrada, no rompe', () => {
    expect(() => decryptMessage('esto no es base64 válido ñ')).not.toThrow();
  });
});

// 🔴 Decide si al coach se le dice "te esperan". Contar de más lo manda a una
// pantalla donde esas filas no tienen botón; contar de menos le esconde a
// alguien que efectivamente lo está esperando.
describe('esperaConfirmacionDelCoach', () => {
  const base = { status: 'pendiente', payment_status: null, preference_id: null };

  it('sin cobro iniciado, espera al coach', () => {
    // El caso del coach sin Mercado Pago conectado: no hay nada que cobrar.
    expect(esperaConfirmacionDelCoach(base)).toBe(true);
  });

  it('con checkout de Mercado Pago o PayPal abierto, espera a la plata', () => {
    // PayPal guarda su `order.id` en la MISMA columna que Mercado Pago.
    expect(esperaConfirmacionDelCoach({ ...base, payment_status: 'pendiente', preference_id: 'abc' })).toBe(false);
  });

  it('con cobro en USDT sin acreditar, espera a la plata', () => {
    expect(esperaConfirmacionDelCoach({ ...base, payment_status: 'pendiente', usdt_amount: 30.42 })).toBe(false);
  });

  it('pagada y todavía pendiente, sí espera al coach', () => {
    // Instantánea apagada: la plata entró y falta el OK del profesional.
    expect(esperaConfirmacionDelCoach({ ...base, payment_status: 'aprobado', preference_id: 'abc' })).toBe(true);
  });

  it('lo que no está pendiente no espera a nadie', () => {
    expect(esperaConfirmacionDelCoach({ ...base, status: 'confirmada' })).toBe(false);
    expect(esperaConfirmacionDelCoach({ ...base, status: 'cancelada' })).toBe(false);
  });
});

describe('hayReembolsoAlCancelar — siempre se puede cancelar, lo que cambia es la plata', () => {
  // 🔴 Antes se llamaba `canCancelConfirmed` y las pantallas la usaban para
  // BLOQUEAR la cancelación tardía. Eso contradecía a la base: el trigger
  // `mark_refund_on_cancel` acepta la cancelación tardía, marca `cancelled_late`
  // y no reembolsa. Y legalmente pesaba en contra — impedir terminar el contrato
  // es más atacable que cobrar por hacerlo tarde, y chocaba con el derecho de
  // revocación de 10 días, que es irrenunciable (ver `docs/consumo.md`).
  const enHoras = (h: number) => {
    const d = new Date(Date.now() + h * 3600_000);
    // La hora se guarda en hora de Argentina; para el test alcanza con que el
    // helper reciba un instante suficientemente lejos o cerca del borde.
    return {
      fecha: d.toISOString().slice(0, 10),
      hora: `${String(d.getUTCHours()).padStart(2, '0')}:00:00`,
    };
  };

  it('con mucha antelación hay reembolso', () => {
    const { fecha, hora } = enHoras(24 * 7);
    expect(hayReembolsoAlCancelar(fecha, hora)).toBe(true);
  });

  it('a último momento no hay reembolso', () => {
    const { fecha, hora } = enHoras(1);
    expect(hayReembolsoAlCancelar(fecha, hora)).toBe(false);
  });

  it('es exactamente la contracara de isCancelLate — una sola fuente de la regla', () => {
    for (const h of [-5, 1, 12, 23, 25, 48, 24 * 30]) {
      const { fecha, hora } = enHoras(h);
      expect(hayReembolsoAlCancelar(fecha, hora)).toBe(!isCancelLate(fecha, hora));
    }
  });

  // Con datos ilegibles se asume lo conservador: que SÍ hay reembolso. Quien
  // decide de verdad es el trigger, y prometer de menos sobre la plata de otro
  // es peor que prometer de más y que la base corrija.
  it('con una fecha rota no niega el reembolso', () => {
    expect(hayReembolsoAlCancelar('no-es-fecha', '99:99:99')).toBe(true);
  });
});
