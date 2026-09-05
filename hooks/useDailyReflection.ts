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

/** Los datos que esa señal —y solo esa— necesita para escribirse.
 *
 *  Sale del ensayo del 04/09: pasarle los tres números siempre lo llevaba a
 *  hablar del más grande en vez de la señal. Si una señal no interpola nada en
 *  su versión escrita a mano, tampoco necesita números acá. */
function factsDeLaSeñal(rules: Reflection, input: ReflectionInput): Record<string, number | string> {
  switch (rules.signal) {
    case 'sessions':  return { sesiones: input.sessionsThisWeek };
    case 'streak':    return { racha: input.streak };
    case 'practices': return { practicas: input.resourcesThisWeek + input.writingThisWeek };
    // 🔴 `level` viaja con su MARCO, no suelto, y la clave lo lleva adentro.
    //
    // La 2ª corrida del ensayo (04/09) mostró por qué: mandando
    // `{level: "pareja"}` el modelo leyó **pareja sentimental** y escribió *"la
    // pareja está en tu cabeza hoy"* y *"la relación está presente en tu día"* —
    // le hablaba de su relación a alguien que había tenido una semana estable.
    //
    // Y lo destapó el arreglo anterior: antes iban `racha` y `sesiones` al lado,
    // que daban contexto suficiente para desambiguar. Al mandar solo el label, la
    // palabra suelta domina. `level` es la señal que MÁS se muestra, así que le
    // tocaba a casi todos.
    //
    // La clave `la_semana_viene` mete el marco en el dato mismo, donde el modelo
    // no lo puede perder. No alcanza con decirlo en el prompt: el prompt ya lo
    // decía.
    // La etiqueta ya está en `bold` — es lo que la frase escrita a mano resalta.
    // No hace falta recalcularla ni exponerla aparte.
    case 'level':     return rules.bold ? { la_semana_viene: rules.bold } : {};
    // `sharp-drop`, `sustained-low`, `trend-up` y `trend-down` no llevan ningún
    // número en su versión escrita a mano: son sobre una dirección o un día, no
    // sobre una cuenta. Mandarle uno era invitarlo a hablar de eso.
    default:          return {};
  }
}

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
            // 🔴 Solo el número que ESA señal usa, no los tres siempre.
            //
            // El ensayo del 04/09 (`scripts/ensayo-payload-rico.mjs`) mostró que
            // mandar los tres hacía que el modelo **hablara de la señal
            // equivocada**: en `sustained-low` recibía `racha: 5` y contestaba
            // *"hace cinco días que estás acá sin faltar"* — le hablaba de su
            // constancia a alguien que llevaba una semana en el fondo, sin
            // mencionar el bajón. Tres de seis salidas hablaban de otra cosa.
            //
            // El modelo agarra el número más grande que le pasás. Así que se le
            // pasa solo el que su propia frase usaría: mirá las variantes de
            // `buildReflection` y vas a ver que únicamente `sessions`, `streak`,
            // `practices` y `level` interpolan algo. El resto no lleva números.
            //
            // 📌 Efecto lateral bueno: se manda MENOS. Cada número que no viaja
            // es uno menos que justificar.
            facts: factsDeLaSeñal(rules, input),
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
