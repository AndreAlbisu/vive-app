// Cuándo se puede cambiar el nombre (01/10/2026). La regla que manda vive en la
// base (`trg_limitar_cambio_de_nombre`); esto la repite para que la pantalla lo
// diga antes de que la persona escriba, y traduce el rechazo si igual llega.

export const DIAS_ENTRE_CAMBIOS = 30;
export const MAIL_SOPORTE = 'vitaappar@gmail.com';

/** El nombre que pone el alta cuando el proveedor no trae uno. Reemplazarlo es
 *  completar el nombre, no cambiarlo: no cuenta para los 30 días. */
const PLACEHOLDER = 'Usuario';

export type EstadoNombre =
  | { editable: true; nota: string }
  | { editable: false; nota: string };

function fechaLarga(d: Date): string {
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
}

export function proximoCambio(nameChangedAt: string | null): Date | null {
  if (!nameChangedAt) return null;
  const desde = new Date(nameChangedAt);
  if (Number.isNaN(desde.getTime())) return null;
  return new Date(desde.getTime() + DIAS_ENTRE_CAMBIOS * 24 * 60 * 60 * 1000);
}

export function estadoDelNombre(p: {
  role: string;
  name: string | null;
  nameChangedAt: string | null;
  ahora?: Date;
}): EstadoNombre {
  if (p.role === 'coach') {
    return {
      editable: false,
      nota: `Es el nombre que revisamos al aprobar tu perfil. Si necesitás corregirlo, escribinos a ${MAIL_SOPORTE}`,
    };
  }

  const nombre = p.name?.trim() ?? '';
  if (!nombre || nombre === PLACEHOLDER) {
    return { editable: true, nota: `Después podés cambiarlo una vez cada ${DIAS_ENTRE_CAMBIOS} días` };
  }

  const proximo = proximoCambio(p.nameChangedAt);
  if (proximo && (p.ahora ?? new Date()) < proximo) {
    return { editable: false, nota: `Lo cambiaste hace poco. Vas a poder cambiarlo de nuevo el ${fechaLarga(proximo)}` };
  }

  return { editable: true, nota: `Podés cambiarlo una vez cada ${DIAS_ENTRE_CAMBIOS} días` };
}

/** Si cambiar el nombre ahora arranca la cuenta de los 30 días. */
export function cambioCuentaParaElLimite(nombreAnterior: string | null): boolean {
  const n = nombreAnterior?.trim() ?? '';
  return !!n && n !== PLACEHOLDER;
}

/** Traduce el rechazo de la base. `null` si el error no es de esta regla. */
export function mensajeDeRechazo(error: { message?: string; details?: string | null } | null): string | null {
  const msg = error?.message ?? '';
  if (msg.includes('NOMBRE_BLOQUEADO_PROFESIONAL')) {
    return `Tu nombre de profesional no se puede cambiar desde la app. Escribinos a ${MAIL_SOPORTE}`;
  }
  if (msg.includes('NOMBRE_CAMBIADO_HACE_POCO')) {
    const iso = error?.details ?? '';
    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : null;
    return d
      ? `Ya cambiaste tu nombre hace poco. Vas a poder cambiarlo de nuevo el ${fechaLarga(d)}`
      : 'Ya cambiaste tu nombre hace poco. Vas a poder cambiarlo de nuevo en unos días';
  }
  return null;
}
