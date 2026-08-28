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
