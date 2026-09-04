import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { AI_REFLECTION_ENABLED } from '@/constants/features';
import { buildReflection, rejectCopy, type Reflection, type ReflectionInput } from '@/lib/weeklyReflection';

// La devolución del día, redactada por un modelo cuando corresponde y por las
// reglas cuando no.
//
// ── Por qué hay caché ────────────────────────────────────────────────────────
// Sin ella, la tarjeta pediría una frase nueva cada vez que se monta Inicio —
// que es cada vez que volvés a la tab. Además de costar, rompería el efecto:
// un amigo no cambia de opinión sobre cómo venís cada treinta segundos. Se
// genera UNA vez por día y por señal, y se guarda en el dispositivo.
//
// La clave incluye la señal a propósito: si hacés el check-in a la tarde y la
// señal cambia (por ejemplo de `level` a `trend-up`), la frase se regenera en
// vez de quedar contando algo que ya no es cierto.
//
// ── Por qué AsyncStorage y no una tabla ──────────────────────────────────────
// No hace falta migración, y la devolución no tiene por qué existir en el
// servidor: es texto derivado, no un dato de la persona. La contracara es que
// es por dispositivo — quien entre desde dos teléfonos puede ver dos frases
// distintas el mismo día. Es aceptable para lo que es.

const CACHE_PREFIX = 'vita:reflection:';
const FUNCTIONS_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`;

/** Reemplaza el texto de una `Reflection` conservando su señal y su tono. */
function withCopy(base: Reflection, linea: string): Reflection {
  return { ...base, before: linea, bold: '', after: '', source: 'ai' };
}

export function useDailyReflection(userId: string | undefined, input: ReflectionInput): Reflection {
  // Las reglas se calculan siempre y en el acto: son el valor que se muestra
  // mientras el modelo responde, y el que queda si algo falla. La tarjeta
  // nunca aparece vacía ni con un spinner.
  const rules = buildReflection(input);
  const [copy, setCopy] = useState<string | null>(null);

  const key = `${CACHE_PREFIX}${userId}:${input.dayKey}:${rules.signal}`;

  useEffect(() => {
    if (!AI_REFLECTION_ENABLED || !userId) { setCopy(null); return; }
    // Sin datos no hay nada que redactar mejor que la invitación de las reglas,
    // y sería gastar una llamada por cada persona que abre la app sin registrar.
    // `early` (uno o dos registros) va por el mismo camino: lo único honesto que
    // se puede decir ahí es "todavía no sé lo suficiente", y para eso no hace
    // falta un modelo.
    // 🔴 `piso-seguridad` NUNCA lo redacta un modelo. Es requisito escrito en
    // `docs/legal-instrucciones.md`: la reacción ante señales de riesgo es
    // determinística y corre antes de cualquier modelo. Que además sea texto
    // fijo lo hace revisable por una profesional, cosa que una frase generada no
    // puede ser.
    if (rules.signal === 'empty' || rules.signal === 'early' || rules.signal === 'piso-seguridad') {
      setCopy(null); return;
    }

    let cancelled = false;

    (async () => {
      try {
        const cached = await AsyncStorage.getItem(key);
        if (cancelled) return;
        if (cached) { setCopy(cached); return; }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) return;

        const res = await fetch(`${FUNCTIONS_URL}/weekly-reflection`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            signal: rules.signal,
            tone: rules.tone,
            // Solo los números que ya aparecen en el texto. NO viajan valores
            // de ánimo, ni el historial, ni nada escrito por la persona.
            facts: {
              racha: input.streak,
              sesiones: input.sessionsThisWeek,
              practicas: input.resourcesThisWeek + input.writingThisWeek,
            },
          }),
        });

        if (cancelled) return;
        if (!res.ok) return;  // 503 = apagada; 502 = falló. En los dos casos, reglas.

        const { linea } = await res.json();
        if (cancelled || typeof linea !== 'string') return;

        // El mismo guardarraíl que verifican los tests sobre las reglas, ahora
        // sobre lo que escribió el modelo. Si no pasa, no se muestra Y NO SE
        // CACHEA — así el próximo intento puede salir bien en vez de dejar una
        // frase mala fija por 24 horas.
        const motivo = rejectCopy(linea, rules.tone);
        if (motivo) {
          console.warn(`[reflection] descartada (${motivo}): ${linea}`);
          return;
        }

        await AsyncStorage.setItem(key, linea);
        if (!cancelled) setCopy(linea);
      } catch (e) {
        // Sin red, timeout, JSON roto: se queda el texto de las reglas.
        console.warn('[reflection] no se pudo generar:', e);
      }
    })();

    return () => { cancelled = true; };
  }, [key, userId, rules.signal, rules.tone, input.streak, input.sessionsThisWeek, input.resourcesThisWeek, input.writingThisWeek]);

  return copy ? withCopy(rules, copy) : rules;
}
