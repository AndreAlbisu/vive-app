import {
  veredictoAsistencia, ESPERA_PROFESIONAL_MIN, ESPERA_CLIENTE_MIN,
} from '../supabase/functions/_shared/asistencia';

const CLIENTE = 'cli-1';
const PRO = 'pro-1';
const INICIO = Date.UTC(2026, 8, 10, 18, 0, 0);   // el instante agendado
const min = (n: number) => n * 60_000;
/** Daily manda `join_time` en segundos. */
const p = (id: string, entraMin: number, duraMin: number) => ({
  user_id: id, join_time: (INICIO + min(entraMin)) / 1000, duration: duraMin * 60,
});
const v = (participantes: any[]) =>
  veredictoAsistencia({ participantes, clienteId: CLIENTE, profesionalId: PRO, inicioMs: INICIO });

describe('§9.5 — quién se presentó', () => {
  it('sesión normal: los dos entran a horario', () => {
    expect(v([p(CLIENTE, 0, 50), p(PRO, 1, 50)])).toEqual({ veredicto: 'sesion_normal' });
  });

  it('el profesional no entra nunca: reintegro', () => {
    expect(v([p(CLIENTE, 0, 30)])).toEqual({ veredicto: 'reembolso', motivo: 'profesional_no_entro' });
  });

  it('el profesional entra tarde, pasados los 10 minutos: reintegro', () => {
    expect(v([p(CLIENTE, 0, 50), p(PRO, ESPERA_PROFESIONAL_MIN + 1, 40)]))
      .toEqual({ veredicto: 'reembolso', motivo: 'profesional_no_entro' });
  });

  // El borde exacto: entrar EN el minuto 10 todavía cuenta como presentarse.
  it('el profesional entra justo en el minuto 10: sesión normal', () => {
    expect(v([p(CLIENTE, 0, 50), p(PRO, ESPERA_PROFESIONAL_MIN, 40)]))
      .toEqual({ veredicto: 'sesion_normal' });
  });

  it('el profesional se va antes de que entre el cliente: reintegro', () => {
    // Entra a horario, se va al minuto 5; el cliente entra al 8.
    expect(v([p(PRO, 0, 5), p(CLIENTE, 8, 30)]))
      .toEqual({ veredicto: 'reembolso', motivo: 'profesional_se_fue' });
  });

  // 🔴 El caso que justifica medir contra `min(entrada del cliente, 20 min)`:
  // el profesional que esperó los 20 y se fue CUMPLIÓ, aunque el cliente
  // apareciera después.
  it('el profesional espera los 20 y el cliente llega al 25: se cobra', () => {
    expect(v([p(PRO, 0, ESPERA_CLIENTE_MIN), p(CLIENTE, 25, 20)]))
      .toEqual({ veredicto: 'cobrar', motivo: 'cliente_llego_tarde' });
  });

  it('el cliente no entra nunca: se cobra', () => {
    expect(v([p(PRO, 0, 25)])).toEqual({ veredicto: 'cobrar', motivo: 'cliente_no_entro' });
  });

  it('no viene nadie: reintegro, y no es culpa del profesional', () => {
    expect(v([p('otro', 0, 5)])).toEqual({ veredicto: 'reembolso', motivo: 'no_vino_nadie' });
  });

  // ⚠️ Lo más importante de todo el archivo: sin datos NO se decide.
  it('sin participantes no decide nada', () => {
    expect(v([])).toEqual({ veredicto: 'sin_datos' });
    expect(veredictoAsistencia({ participantes: [p(CLIENTE, 0, 10)], clienteId: CLIENTE, profesionalId: PRO, inicioMs: NaN }))
      .toEqual({ veredicto: 'sin_datos' });
  });

  // Daily parte la presencia en varios tramos cuando alguien se reconecta: hay
  // que mirar el PRIMERO que entró y el ÚLTIMO que salió, no un tramo suelto.
  it('junta los tramos de quien se reconecta', () => {
    // El profesional entra, se cae al minuto 2 y vuelve hasta el 40.
    expect(v([p(PRO, 0, 2), p(PRO, 3, 37), p(CLIENTE, 1, 40)]))
      .toEqual({ veredicto: 'sesion_normal' });
  });
});
