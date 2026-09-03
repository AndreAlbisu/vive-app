// Las reglas del consentimiento de datos sensibles: qué cubre, y cuándo hay que
// pedirlo. Puro — sin imports, sin red, sin estado. Las consultas viven en
// `lib/consent.ts`; mismo criterio que separa `credentialRules` de
// `coachCredentials`, y `sobreVosMomento` de su storage.
//
// El porqué de todo esto está en `docs/consentimiento-datos-sensibles.md`.
// Resumen: el checkbox de los T&C no alcanza para dato sensible —es genérico y
// va en paquete—, y la Ley 25.326 pide consentimiento EXPRESO. Además la
// Política §3 dice hoy que se otorga "al utilizar las funcionalidades", que es
// consentimiento por conducta y no expreso.

export type ConsentType = 'datos_sensibles_bienestar';

/** Lo último que se registró de un consentimiento. `null` = nunca se preguntó. */
export type ConsentState = {
  granted: boolean;
  grantedAt: string;
  policyVersion: string | null;
} | null;

/** Lo que cubre el opt-in, en el orden en que se le muestra a la persona.
 *
 *  🔴 La última línea se agregó el 03/09/2026 y no es cosmética. "Escuchaste
 *  tres audios de ansiedad esta semana" revela lo mismo sobre la salud mental
 *  que un check-in, solo que por deducción. El TJUE lo fijó en C-184/20: los
 *  datos que por "una operación intelectual de comparación o deducción" revelan
 *  información sensible SON categoría especial. Si la app va a recomendar en
 *  base al comportamiento, el comportamiento entra en el consentimiento. */
export const LO_QUE_CUBRE: string[] = [
  'Cómo venís cada día — tu check-in de ánimo',
  'Lo que escribís en el diario y en gratitud',
  'Qué recursos usás, para poder acercarte los que encajen',
];

/** ¿Hay que pedirlo?
 *
 *  Sin registro se pide. Con un registro revocado también: revocar no es
 *  "nunca más preguntes", es retirar el permiso para el tratamiento en curso —
 *  la persona puede volver a darlo cuando quiera.
 *
 *  ⚠️ Lo que NO hace esta función es re-preguntar cuando cambia la versión de
 *  la Política. Se evaluó y se dejó afuera a propósito: `LEGAL_VERSION` es un
 *  hash del texto completo, así que se mueve con una corrección de tipeo, y
 *  re-pedir el consentimiento por eso lo convertiría en ruido —que es
 *  exactamente cómo un consentimiento deja de ser informado—. Cuando cambie la
 *  FINALIDAD o los destinatarios hay que volver a pedirlo, y eso es una decisión
 *  de producto, no algo que se derive de un hash. Queda pendiente el mecanismo
 *  para forzarlo a mano. */
export function necesitaPedir(estado: ConsentState): boolean {
  if (!estado) return true;
  return !estado.granted;
}

/** ¿Puede la app tratar el dato sensible de esta persona ahora mismo? */
export function puedeTratar(estado: ConsentState): boolean {
  return estado?.granted === true;
}
