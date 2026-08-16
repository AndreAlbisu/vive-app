// Flags de features. Se leen en tiempo de build (Expo inlinea las
// `EXPO_PUBLIC_*`), así que cambiarlas pide recargar la app, no un deploy.

/**
 * ¿La devolución de la tarjeta "Sobre vos" la redacta un modelo?
 *
 * 🔴 **Queda en `false` hasta que haya respuesta legal.** Aunque lo que sale
 * del dispositivo es mínimo —el nombre de la señal, el tono y dos números, sin
 * valores de ánimo ni texto libre— sigue siendo una transferencia
 * internacional que hay que encuadrar. La consulta está redactada en
 * `docs/legal-instrucciones.md`, Paso 3.
 *
 * Con esto en `false` la app usa el texto determinístico de
 * `lib/weeklyReflection.ts`, que es igual el piso cuando no hay red o el
 * modelo falla. Encenderlo no reemplaza nada: cambia quién redacta.
 *
 * Hay un segundo interruptor del lado del servidor: sin `ANTHROPIC_API_KEY`,
 * la edge function devuelve 503 y el cliente cae a las reglas igual.
 */
export const AI_REFLECTION_ENABLED =
  process.env.EXPO_PUBLIC_AI_REFLECTION === 'true';
