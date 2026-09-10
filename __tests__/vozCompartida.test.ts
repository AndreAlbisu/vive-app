import {
  COPY_VOZ_COMPARTIDA,
  rejectVozCompartida,
} from '@/lib/vozCompartida';

describe('rejectVozCompartida — barrido del banco (regresión C7)', () => {
  // El equivalente a lo que la tarjeta hace con sus 35 frases: ninguna línea de
  // voz de las OTRAS superficies puede violar las reglas transversales. Si
  // alguien agrega un prompt con un adjetivo de género, este test se cae.
  it.each(COPY_VOZ_COMPARTIDA)('está limpio: "%s"', (linea) => {
    expect(rejectVozCompartida(linea)).toBeNull();
  });

  it('el banco no está vacío (se arma de las constantes reales)', () => {
    expect(COPY_VOZ_COMPARTIDA.length).toBeGreaterThan(10);
  });
});

describe('rejectVozCompartida — caza los dos bugs históricos', () => {
  it('🔴 Diario: "Se nota que estás cansado" (testigo + género)', () => {
    // El testigo gana en el orden, pero cualquiera de los dos lo rechaza.
    expect(rejectVozCompartida('Se nota que estás cansado.')).not.toBeNull();
    expect(rejectVozCompartida('Hoy estás cansado.')).toBe('genera a la persona');
  });

  it('🔴 Gratitud: "¿Por qué estás agradecido hoy?" — que NIVEL_MASCULINO no cazaba', () => {
    expect(rejectVozCompartida('¿Por qué estás agradecido hoy?')).toBe('genera a la persona');
  });

  it('caza los dos géneros y otras formas copulativas', () => {
    expect(rejectVozCompartida('Hoy estás cansada.')).toBe('genera a la persona');
    expect(rejectVozCompartida('Venís perdido últimamente.')).toBe('genera a la persona');
    expect(rejectVozCompartida('Andás bajoneado hoy.')).toBe('genera a la persona');
  });
});

describe('rejectVozCompartida — NO da falsos positivos donde el otro rechazo sería un error', () => {
  it('"Un día tranquilo" pasa: concuerda con "día", no con la persona', () => {
    // En la tarjeta NIVEL_MASCULINO lo rechaza (ahí el sujeto es "la semana");
    // acá no hay verbo en segunda persona delante, así que es correcto dejarlo.
    expect(rejectVozCompartida('Un día tranquilo.')).toBeNull();
  });

  it('"Dejalo guardado acá" pasa: "guardado" concuerda con "lo", no con quien lee', () => {
    expect(rejectVozCompartida('Dejalo guardado acá.')).toBeNull();
  });

  it('la exclamación NO se enforce acá (decisión de Andre abierta)', () => {
    expect(rejectVozCompartida('¡Hoy estás brillando!')).toBeNull();
  });

  it('gerundios y "venís bien/más" no se confunden con adjetivo de género', () => {
    expect(rejectVozCompartida('Hoy estás brillando fuerte.')).toBeNull();
    expect(rejectVozCompartida('Venís bien hoy, se nota en lo que escribís.')).not.toBe('genera a la persona');
    expect(rejectVozCompartida('Venís más liviano que otras semanas.')).toBeNull();
  });
});
