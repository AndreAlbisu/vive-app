// Cifrado del diario y la gratitud: las piezas puras de `lib/wellbeingCrypto.ts`.
//
// Lo que se cuida acá es lo que no se ve usando la app: que en la base NO quede
// el texto, que una entrada no abra con la clave o el dueño equivocados, y que
// las entradas de antes del cifrado se sigan leyendo.

jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
jest.mock('expo-secure-store', () => {
  const mapa = new Map<string, string>();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
    getItemAsync: jest.fn(async (k: string) => mapa.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => { mapa.set(k, v); }),
    deleteItemAsync: jest.fn(async (k: string) => { mapa.delete(k); }),
  };
});

import {
  cifrar, descifrar, estaCifrado, obtenerClave, olvidarClave, NO_SE_PUDO_ABRIR, _internals,
} from '@/lib/wellbeingCrypto';
import { supabase } from '@/lib/supabase';

const invoke = supabase.functions.invoke as jest.Mock;

const CLAVE = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const OTRA = Uint8Array.from({ length: 32 }, (_, i) => 200 - i);
const ANA = '11111111-1111-4111-8111-111111111111';
const BETO = '22222222-2222-4222-8222-222222222222';
const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');

describe('cifrar / descifrar', () => {
  const textos = [
    'Hoy no le dije a nadie cómo estaba.',
    'ñandú, acentos: áéíóú ¿? ¡!',
    'emoji 🌱 y 👩‍👧 compuestos',
    'varias\nlíneas\n\ncon espacios   ',
    'x'.repeat(20000),
  ];

  it.each(textos)('ida y vuelta: %#', (t) => {
    expect(descifrar(cifrar(t, CLAVE, ANA), CLAVE, ANA)).toBe(t);
  });

  it('lo guardado no contiene el texto y lleva la marca', () => {
    const c = cifrar('secreto que no se dice', CLAVE, ANA);
    expect(estaCifrado(c)).toBe(true);
    expect(c).not.toContain('secreto');
    expect(Buffer.from(c.slice(_internals.PREFIJO.length), 'base64').toString('latin1')).not.toContain('secreto');
  });

  it('el mismo texto dos veces no da lo mismo', () => {
    expect(cifrar('igual', CLAVE, ANA)).not.toBe(cifrar('igual', CLAVE, ANA));
  });

  it('no abre con otra clave', () => {
    expect(descifrar(cifrar('hola', CLAVE, ANA), OTRA, ANA)).toBe(NO_SE_PUDO_ABRIR);
  });

  it('no abre en la fila de otra persona', () => {
    expect(descifrar(cifrar('hola', CLAVE, ANA), CLAVE, BETO)).toBe(NO_SE_PUDO_ABRIR);
  });

  it('no abre si lo alteraron', () => {
    const c = cifrar('hola', CLAVE, ANA);
    const roto = c.slice(0, -3) + (c.endsWith('AAA') ? 'BBB' : 'AAA');
    expect(descifrar(roto, CLAVE, ANA)).toBe(NO_SE_PUDO_ABRIR);
  });

  it('sin clave, lo cifrado no se muestra crudo', () => {
    expect(descifrar(cifrar('hola', CLAVE, ANA), null, ANA)).toBe(NO_SE_PUDO_ABRIR);
  });

  it('las entradas de antes del cifrado se leen tal cual, con o sin clave', () => {
    expect(descifrar('entrada vieja en claro', CLAVE, ANA)).toBe('entrada vieja en claro');
    expect(descifrar('entrada vieja en claro', null, ANA)).toBe('entrada vieja en claro');
    expect(estaCifrado('entrada vieja en claro')).toBe(false);
  });

  it('vacío y null: Gratitud guarda vacíos los campos sin llenar', () => {
    expect(cifrar('', CLAVE, ANA)).toBe('');
    expect(descifrar('', CLAVE, ANA)).toBe('');
    expect(descifrar(null, CLAVE, ANA)).toBe('');
  });

  it('falla cerrado con una clave de tamaño incorrecto', () => {
    expect(() => cifrar('hola', new Uint8Array(16), ANA)).toThrow();
  });

  it('un emoji cortado al medio no tira', () => {
    const cortado = 'hola \uD83C';
    expect(descifrar(cifrar(cortado, CLAVE, ANA), CLAVE, ANA)).toBe('hola �');
  });
});

describe('obtenerClave', () => {
  beforeEach(async () => {
    invoke.mockReset();
    await olvidarClave(ANA);
    await olvidarClave(BETO);
  });

  it('la pide una sola vez aunque se la pidan dos veces seguidas', async () => {
    invoke.mockResolvedValue({ data: { v: 1, key: b64(CLAVE) }, error: null });
    const [a, b] = await Promise.all([obtenerClave(ANA), obtenerClave(ANA)]);
    expect(Array.from(a)).toEqual(Array.from(CLAVE));
    expect(b).toBe(a);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('wellbeing-key');
  });

  it('la recupera del llavero sin volver al servidor', async () => {
    invoke.mockResolvedValue({ data: { v: 1, key: b64(CLAVE) }, error: null });
    await obtenerClave(ANA);
    _internals.olvidarTodoEnMemoria(); // como reabrir la app
    invoke.mockReset();
    expect(Array.from(await obtenerClave(ANA))).toEqual(Array.from(CLAVE));
    expect(invoke).not.toHaveBeenCalled();
  });

  it('cerrar sesión la borra del teléfono', async () => {
    invoke.mockResolvedValue({ data: { v: 1, key: b64(CLAVE) }, error: null });
    await obtenerClave(ANA);
    await olvidarClave(ANA);
    invoke.mockReset();
    invoke.mockResolvedValue({ data: null, error: new Error('sin red') });
    await expect(obtenerClave(ANA)).rejects.toThrow();
  });

  it('tira si el servidor falla o devuelve algo que no es una clave', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('500') });
    await expect(obtenerClave(ANA)).rejects.toThrow();
    invoke.mockResolvedValue({ data: { key: b64(new Uint8Array(8)) }, error: null });
    await expect(obtenerClave(ANA)).rejects.toThrow();
    invoke.mockResolvedValue({ data: {}, error: null });
    await expect(obtenerClave(ANA)).rejects.toThrow();
  });

  it('un fallo no queda guardado: el próximo intento vuelve a pedir', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new Error('sin red') });
    await expect(obtenerClave(BETO)).rejects.toThrow();
    invoke.mockResolvedValueOnce({ data: { v: 1, key: b64(OTRA) }, error: null });
    expect(Array.from(await obtenerClave(BETO))).toEqual(Array.from(OTRA));
  });
});

// 🔴 El pedido de acceso a los datos (Ley 25.326, art. 14) se arma con
// `scripts/decodificar-export.mjs`, que repite a mano el formato y la derivación
// de la clave. Si la app y ese script se desalinean, Vita deja de poder
// entregarle su diario a quien lo pide — y nadie se entera hasta ese día.
describe('el script del pedido de datos abre lo que cifra la app', () => {
  it('diario y gratitud vuelven en texto', () => {
    const { createHmac } = require('node:crypto');
    const { spawnSync } = require('node:child_process');
    const maestro = 'secreto-de-juguete-solo-para-este-test-0123456789';
    const clave = new Uint8Array(createHmac('sha256', maestro).update('vita:bienestar:v1:' + ANA).digest());

    const exportado = {
      rows: [{
        generado: 'x',
        datos: {
          perfil: { id: ANA },
          diario: [{ content: cifrar('lo que no le digo a nadie 🌧', clave, ANA) }, { content: 'vieja en claro' }],
          gratitud: [{ item_1: cifrar('el mate con mamá', clave, ANA), item_2: '', item_3: null, content: null }],
          mensajes_enviados: [],
        },
      }],
    };
    const r = spawnSync('node', ['scripts/decodificar-export.mjs'], {
      input: JSON.stringify(exportado),
      env: { ...process.env, WELLBEING_MASTER_KEY: maestro },
    });
    expect(r.status).toBe(0);
    const { datos } = JSON.parse(r.stdout.toString());
    expect(datos.diario.map((e: { content: string }) => e.content)).toEqual(['lo que no le digo a nadie 🌧', 'vieja en claro']);
    expect(datos.gratitud[0].item_1).toBe('el mate con mamá');
  });
});
