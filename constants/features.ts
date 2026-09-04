// Flags de features. Se leen en tiempo de build (Expo inlinea las
// `EXPO_PUBLIC_*`), así que cambiarlas pide recargar la app, no un deploy.

/**
 * ¿La devolución de la tarjeta "Sobre vos" la redacta un modelo?
 *
 * 🔴 **Queda en `false` hasta que haya respuesta legal.** Aunque lo que sale
 * del dispositivo es mínimo —el nombre de la señal, el tono y dos números, sin
 * valores de ánimo ni texto libre— sigue siendo una transferencia
 * internacional que hay que encuadrar.
 *
 * 📌 **La consulta y los pasos para encenderla están en
 * `docs/legal-instrucciones.md`: la pregunta en el Paso 3, qué hacer con cada
 * respuesta posible en el Paso 5.1.** No prendas esto sin pasar por ahí.
 *
 * ⚠️ **Lo que este flag NO protege (chequeo del 01/09/2026).** Tenerlo apagado
 * evita una transferencia anónima de tres enteros. Las transferencias grandes
 * —ánimo, diario, gratitud y mensajes a Supabase, video a Daily, push a Expo,
 * todos en EEUU, que no está en la lista de países adecuados de la AAIP—
 * ocurren igual, con o sin IA. El pendiente real es el instrumento de esas
 * transferencias (pregunta A.3 de `docs/paquete-abogado.md`), y este flag no
 * tiene nada que ver con él. No leas este `false` como "estamos cubiertos".
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

/**
 * ¿La tarjeta "Sobre vos" muestra el **piso de seguridad**?
 *
 * Es el punto donde deja de hacer de amigo: cuando alguien viene registrando el
 * fondo, una voz cálida no alcanza y no puede simular que sí
 * (`docs/la-voz-de-sofia.md` §5 ter).
 *
 * 🔴 **Queda en `false` hasta que el texto esté revisado por una profesional.**
 * La maquinaria está entera y testeada —`lib/pisoSeguridad.ts` decide cuándo, y
 * `buildReflection` tiene la rama arriba de todo—, pero lo que se muestra es la
 * única frase de la app donde equivocarse sale caro de verdad. El umbral lo
 * podemos decidir nosotros (y está justificado en el encabezado de
 * `pisoSeguridad.ts`); el texto no.
 *
 * ✅ **La pantalla de las líneas ya existe** (`/ayuda`, 04/09/2026), con los
 * números de T&C §5.3 tocables. Al construirla apareció que no dependía de la
 * revisión del texto —los números ya están escritos y verificados en los T&C—,
 * así que se separó de este flag. **Queda una sola cosa pendiente, y es un
 * mail.**
 *
 * A diferencia de `AI_REFLECTION_ENABLED`, este flag NO espera nada legal:
 * espera una revisión de contenido y una pantalla.
 */
export const SAFETY_FLOOR_ENABLED = false;
