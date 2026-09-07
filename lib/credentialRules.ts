// Las reglas de una credencial: qué tipos hay, qué se puede decir de una, y
// cuándo está lista para mandarse a revisar.
//
// Sin imports a propósito —mismo criterio que `lib/ejesLayout.ts` y
// `_shared/guarantee.ts`—: son las reglas del negocio y tienen que poder
// probarse sin montar la app ni tocar la red. Las consultas viven en
// `lib/coachCredentials.ts`, que sí importa el cliente de Supabase.

export type CredentialKind = 'titulo' | 'matricula' | 'certificacion';
export type CredentialStatus = 'pendiente' | 'verificada' | 'rechazada';

export const KIND_LABEL: Record<CredentialKind, string> = {
  titulo: 'Título',
  matricula: 'Matrícula',
  certificacion: 'Certificación',
};

/** Lo que ve cualquiera en el perfil público. Sin archivo y sin notas: sale de
 *  la vista `coach_credentials_public`, que ya filtra por verificada. */
export type PublicCredential = {
  id: string;
  kind: CredentialKind;
  title: string;
  institution: string | null;
  year: number | null;
  registrationNumber: string | null;
};

export type CredentialInput = {
  kind: CredentialKind;
  title: string;
  institution: string | null;
  year: number | null;
  registrationNumber: string | null;
  filePath: string | null;
};

/** Una línea con lo que se puede decir de la credencial, sin renglones vacíos.
 *  "UBA · 2014", "UBA", "2014", o nada. */
export function lineaCredencial(c: Pick<PublicCredential, 'institution' | 'year'>): string {
  const partes = [c.institution?.trim() || null, c.year ? String(c.year) : null].filter(Boolean);
  return partes.join(' · ');
}

/** Validación previa a guardar. Devuelve el motivo o null si está bien. */
export function validarCredencial(input: CredentialInput): string | null {
  const t = input.title.trim();
  if (t.length < 2) return 'Poné el nombre del título o la certificación';
  if (t.length > 120) return 'El nombre es demasiado largo';
  if (input.year !== null && (input.year < 1950 || input.year > new Date().getFullYear())) {
    return 'Revisá el año';
  }
  // 🔴 La matrícula sin número no verifica nada: el número ES el dato, porque es
  // lo único que un tercero puede chequear por su cuenta.
  if (input.kind === 'matricula' && !input.registrationNumber?.trim()) {
    return 'La matrícula necesita su número (M.N. o M.P.)';
  }
  if (!input.filePath) return 'Falta adjuntar el documento que la respalda';
  return null;
}

// ─── El encuadre de la sesión ────────────────────────────────────────────────
//
// 🔴 Lo que la ley reserva es el ACTO, no el tema ni el título. La Ley 23.277
// deja el diagnóstico, el pronóstico y el tratamiento en manos de quien tiene
// MATRÍCULA — así que la matrícula es el único eje que decide esto, y un título
// sin matrícula no habilita nada. Ver `docs/encuadre-salud-y-responsabilidad.md`
// §2.
//
// ⚠️ Y por eso mismo la matrícula NO sirve como medida de la formación. No
// existe matrícula de coaching, ni de sexología, ni de mindfulness: quien
// trabaja ahí nunca va a poder cargarla y **no le falta nada**. Medir a todos
// contra esa casilla le pone una carencia permanente a media plataforma, que es
// lo que hacía el cartel anterior ("Acompañamiento, no tratamiento") y lo que
// esta separación viene a evitar: una etiqueta dice QUÉ ES LA SESIÓN, la otra
// dice QUÉ VERIFICÓ VITA, y ninguna juzga a la persona.

export type Encuadre = {
  /** Hay matrícula verificada: puede diagnosticar y tratar. */
  habilitado: boolean;
  /**
   * 🔴 El caso más confuso de la app: título verificado (pongamos "Lic. en
   * Psicología") SIN matrícula. El perfil dice "sesiones de acompañamiento" y
   * abajo muestra un título de psicología con el escudo de verificado — las dos
   * cosas son ciertas y se contradicen a la vista, y el usuario le cree al
   * título. Es además el perfil legalmente más riesgoso: se reserva creyendo
   * que es terapia. Necesita una aclaración pegada a esa credencial.
   */
  tituloSinMatricula: boolean;
  /** Lo que se muestra arriba. Nunca la palabra "tratamiento": Vita no sabe si
   *  esta sesión lo es —un matriculado puede dar sesiones que no son clínicas—
   *  y rotularla así sería caracterizar la prestación, justo lo que T&C §5
   *  declara que no hace. */
  etiqueta: string;
};

export function encuadreDeSesion(credenciales: Pick<PublicCredential, 'kind'>[]): Encuadre {
  const habilitado = credenciales.some(c => c.kind === 'matricula');
  return {
    habilitado,
    tituloSinMatricula: !habilitado && credenciales.some(c => c.kind === 'titulo'),
    etiqueta: habilitado ? 'Matrícula verificada' : 'Sesiones de acompañamiento',
  };
}

/**
 * El mismo encuadre cuando lo único que hay a mano es la columna derivada
 * `coaches.has_matricula` — el caso del checkout, que no trae la lista de
 * credenciales.
 *
 * ⚠️ `tituloSinMatricula` queda SIEMPRE en false acá, y es correcto: esa
 * aclaración va pegada a la credencial que la genera, en el bloque Formación
 * del perfil. Fuera de ahí no hay título a la vista que pueda contradecir a la
 * etiqueta, así que no hay nada que desambiguar.
 */
export function encuadreDesdeFlag(hasMatricula: boolean): Encuadre {
  return {
    habilitado: hasMatricula,
    tituloSinMatricula: false,
    etiqueta: hasMatricula ? 'Matrícula verificada' : 'Sesiones de acompañamiento',
  };
}
