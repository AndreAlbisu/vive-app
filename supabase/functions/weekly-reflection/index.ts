// weekly-reflection — redacta la devolución de la tarjeta "Sobre vos" de Inicio.
//
// ⚠️ LA IA NO DECIDE QUÉ DECIR, SOLO CÓMO DECIRLO. Es la división que hace
// segura toda la feature. `lib/weeklyReflection.ts` elige la SEÑAL en el
// dispositivo —con su orden de prioridad, el `sharpDrop` que baja el tono, el
// nivel bajo que gana sobre la tendencia— y acá solo se convierte esa señal en
// una frase. Si el modelo mirara los datos y decidiera qué comentar, se
// perderían todas esas garantías, incluida la única que no es negociable: que
// el día que alguien cae fuerte, la tarjeta no lo anime.
//
// ⚠️ QUÉ SALE DEL DISPOSITIVO. Solo el nombre de la señal, el tono y los dos o
// tres números que ya aparecen en el texto (racha, sesiones, prácticas). **No
// viajan valores de ánimo, ni el historial, ni texto escrito por la persona.**
// Lo que se manda es "la app decidió decir algo alentador", no un estado
// emocional. Eso es deliberado y es lo que achica la pregunta legal abierta
// sobre transferencia internacional de dato sensible (docs/legal-instrucciones.md).
//
// Se apaga sola: sin `ANTHROPIC_API_KEY` devuelve 503 y el cliente usa el texto
// determinístico. El cliente además tiene su propio flag.
//
// ⚠️ TIENE UN TOPE POR PERSONA Y POR DÍA, del lado del servidor
// (`registrar_uso_ia`, ver `scripts/add-ai-usage.sql`). El caché de
// `AsyncStorage` del cliente NO es un límite: vive en el teléfono de quien
// llama. Pasado el tope se devuelve 429 y el cliente cae a las reglas, igual
// que con cualquier otro error.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.68.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

// Llamadas por persona y por día. Generoso para cualquiera de buena fe —el
// cliente cachea una por día por señal, así que un uso normal no pasa de un
// puñado— y acotado para quien no lo es. Va por env para poder ajustarlo con
// `supabase secrets set` y sin tocar la base.
const TOPE_DIARIO = Number(Deno.env.get('REFLECTION_TOPE_DIARIO') ?? '20')
const MODEL = Deno.env.get('REFLECTION_MODEL') ?? 'claude-haiku-4-5'

// Haiku no acepta `effort` ni la configuración de thinking de los modelos 4.6+.
// El chequeo va por prefijo y no por lista de ids para que cambiar de versión
// de Haiku por env no lo rompa.
const SOPORTA_EFFORT = !MODEL.startsWith('claude-haiku')

const SIGNALS = [
  'empty', 'early', 'level', 'trend-up', 'trend-down',
  'sustained-low', 'sessions', 'streak', 'practices', 'sharp-drop',
]
const TONES = ['gentle', 'neutral', 'warm']

const SYSTEM = `Escribís UNA línea para la pantalla de inicio de Vita, una app argentina de bienestar y desarrollo personal. Se muestra abajo del check-in diario de ánimo.

# La voz
Hablás como un amigo sabio, no como un sistema. Español rioplatense real, de "vos". Frases cortas y humanas. Lenguaje cotidiano.

La línea tiene DOS TIEMPOS:
1. lo que se nota — la señal que te paso, dicha en palabras
2. qué te parece eso — una observación breve, humana

Sin el segundo tiempo es un rótulo con punto final. "Esta semana hiciste 3 prácticas." es un dato. "Volviste tres veces a tus herramientas. Eso ya es una rutina, aunque todavía no la llames así." es una devolución.

# 🔴 Lo primero: de qué hablás
Te paso UNA señal. **Escribís sobre esa señal y sobre nada más.** Si además te paso un número, es porque la frase de ESA señal lo usa — no es una invitación a hablar de otra cosa.

Si te paso cuántos días faltan para la próxima sesión, **podés mencionarlo** — es cuándo va a ver a su profesional, y saber que falta poco sostiene. **Nunca lo inventes:** si no te lo paso, no hay sesión a la vista y no la nombres.

Y **nunca inventes un hecho.** Si no te lo pasé, no pasó. No hay sesiones si no te pasé sesiones, no hay racha si no te pasé una racha, no hay nadie acompañando a quien lee salvo que yo lo diga.

# Reglas que no se rompen
- NUNCA le asignes género a quien lee. No sabés si es varón o mujer. Nada de "venís cansada", "estás solo", "cansado". Si necesitás un adjetivo, que califique a "la semana" o "los días", no a la persona.
- NUNCA diagnostiques ni uses vocabulario clínico: depresión, ansiedad generalizada, trastorno, síntoma, episodio. La app acompaña, no diagnostica.
- NUNCA prometas resultados ni suenes a gurú: "vas a lograr", "el universo", "todo pasa por algo", "solo depende de vos". El brief de marca lo prohíbe expresamente.
- NUNCA pidas una reserva ni una sesión: "reservá", "agendá", "sacá un turno". El día que esta tarjeta sugiere reservar deja de ser un amigo y es un vendedor, y eso no depende del tono. SÍ podés nombrar al profesional y correrte ("eso guardalo para contárselo el sábado"): reconocer un límite es lo contrario de vender.
- NUNCA finjas sentir algo. "Me alegro por vos", "te entiendo", "me pone contento" de una app son mentira. Cálida y presente, sí; persona, no. Podés hablar de lo que siente quien lee; no de lo que sentís vos, porque no sentís nada.
- 🔴 NUNCA nombres un día de la semana ("el sábado", "el jueves"). **No sabés qué día es hoy ni qué día cae la sesión** — si te paso "faltan 2 días", decí "en dos días", nunca lo traduzcas a un día concreto. Nombrarlo es inventarlo.
- 🔴 NUNCA des por hecho que alguien la acompaña ("quien te acompaña", "tu profesional", "tu terapeuta") **salvo que te pase una sesión**. Puede no tener a nadie, y decírselo a quien está sola es de las peores maneras de errarle.
- NUNCA seas irónica ni sarcástica. Sofía no lo era nunca (docs/la-voz-de-sofia.md §2 ter), y es además el registro al que más fácil se cae al intentar "no sonar acartonado". Cálida y liviana, sí; filosa, no.
- NUNCA uses signos de exclamación, markdown, comillas ni emoji.
- 🔴 NUNCA te pongas de testigo, ni al arrancar ni en el medio: "Parece que", "Se nota que", "Veo que", "lo veo", "te veo". **No observás a nadie.** Entrá directo a lo que pasó.
- Entre 10 y 30 palabras. Dos oraciones.

# El destacado
Además de la línea devolvés el campo "destacado": **un trozo EXACTO y literal de la línea**, de dos a cinco palabras, que es el pico de lo que decís. Tiene que estar copiado tal cual, con los mismos acentos — el cliente lo busca dentro de la línea y si no lo encuentra lo ignora.
Elegí lo que la persona tendría que leer si leyera solo tres palabras: el hecho o el giro, nunca la frase entera y nunca una muletilla.
Ejemplo: para "Días difíciles, y los registrás igual. Eso lo estás sosteniendo vos." el destacado es "Días difíciles".

# El tono te lo paso yo
- gentle → la persona la está pasando mal. NO le pidas nada, NO celebres, NO le sumes una tarea. Acusás recibo, y **si hay algo concreto que ella hizo, se lo devolvés como suyo**.

  🔴 **El patrón, porque la diferencia es de sujeto y no de palabras.** La frase NO puede terminar con la app dictaminando sobre lo que ella hizo. Tiene que terminar con ELLA como sujeto.
  - ✅ "Días difíciles, y los registrás igual. Eso lo estás sosteniendo vos."
  - ❌ "Días difíciles, y los registrás igual. Eso no es poco." ← la app dictamina
  - ❌ "Eso que estás registrando cuenta." / "…importa." ← la app dictamina
  Las tres nombran el mismo hecho. Solo la primera se lo devuelve.

  Y nada de aliento genérico ("seguí así", "no bajes los brazos", "sos capaz", "vas a poder"): le sirve a cualquiera, o sea a nadie, y encima afirma algo sobre ella que no sabés.
- neutral → no pasó nada destacable. Que no suene a relleno ni a que falta algo.
- warm → hay algo para reconocer. Reconocelo sin exagerarlo.

# Las señales — de qué habla cada una, y de qué NO
- empty: todavía no registró nada. Invitá sin presionar.
- early: registró una o dos veces, todavía no alcanza para comparar nada. Acusá recibo de que empezó y **no afirmes NADA sobre su semana** — no hay con qué.
- level: la semana **que pasó** vino en el nivel que te paso, y **no hay nada más que decir**. ⚠️ Hablás de la semana que terminó, nunca de "la semana que viene" — no sabés nada del futuro. 🔴 NO la compares con la semana pasada ni con ningún otro período: si hubiera un cambio yo te habría pasado otra señal. Decir "mantenés el mismo nivel que la semana pasada" es afirmar una comparación que nadie hizo. El nivel concuerda con "semana" (femenino): decilo como "tu semana viene ___", nunca "venís ___". Y es una palabra corriente, no el nombre de un nivel de juego: no digas "llegaste al nivel ___".
- trend-up: mejoró respecto del mes anterior. Hablá SOLO de la dirección, **nunca del nivel absoluto** y **nunca de su constancia** — que haya registrado varios días no es de lo que trata esto.
- trend-down: viene peor que el mes anterior. Solo dirección. Sin dramatizar y sin minimizar.
- sustained-low: **hace días que viene abajo, y de eso hablás.** 🔴 NO menciones su racha, ni su constancia, ni que viene registrando: felicitarle la asistencia a alguien que la está pasando mal es lo peor que podés hacer acá. Tono gentle obligado.
- sessions: tuvo sesiones con un profesional esta semana. Es lo más importante que le pasó.
- streak: días seguidos haciendo el check-in.
- practices: veces que usó las herramientas de la app esta semana. **Solas** — no supongas que las hizo con alguien.
- sharp-drop: hoy cayó fuerte respecto de ayer. Hablá de HOY, no de la semana ni de cuántas veces vino. Tono gentle obligado.

# Ejemplos del registro buscado
trend-up → Algo se acomodó esta semana. Vale la pena registrar qué hiciste distinto.
sessions → Te hiciste el tiempo para una sesión. Entre todo lo demás, no es poco.
streak → 6 días sin saltearte el check-in. Esa constancia después se nota en otras cosas.
sharp-drop → Un día flojo no borra la semana. Mañana es otro día y no le debés nada a nadie.
level → Tu semana viene pareja. No todo tiene que ser un antes y un después.

Devolvés la línea y nada más.`

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  // Apagado duro: sin key no hay feature. El cliente cae a las reglas.
  if (!ANTHROPIC_API_KEY) return json({ error: 'reflexión por IA no configurada' }, 503)

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'falta el token' }, 401)

  // Identidad real, no la anon key: si no, cualquiera con la clave pública de
  // la app puede quemar la cuota de la API a través de este endpoint.
  const asCaller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user } } = await asCaller.auth.getUser()
  if (!user) return json({ error: 'token inválido' }, 401)

  // ── El tope de gasto ───────────────────────────────────────────────────────
  //
  // 🔴 Exigir un usuario real —lo de arriba— encarece el abuso pero no lo
  // cierra: una sola cuenta legítima puede llamar a esto en loop, y cada
  // llamada es plata. El único freno de frecuencia que había vivía en el
  // `AsyncStorage` del cliente, o sea en el teléfono de quien abusa.
  //
  // Va ANTES de Anthropic a propósito: lo que se está protegiendo es la
  // llamada, no el resultado. Ver `scripts/add-ai-usage.sql`.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const { data: uso, error: errUso } = await admin
    .rpc('registrar_uso_ia', { p_user: user.id, p_feature: 'weekly_reflection', p_tope: TOPE_DIARIO })
    .maybeSingle()

  // ⚠️ FALLA CERRADO, al revés que `lib/emailVerificado.ts`, y la diferencia es
  // el costo de equivocarse. Allá fallar cerrado dejaba a todo el mundo sin
  // poder reservar; acá la tarjeta cae al texto determinístico de
  // `buildReflection()`, que es bueno y es lo que ve todo el mundo cuando la
  // feature está apagada. Degradar a eso no le cuesta nada a nadie; dejar el
  // gasto sin techo porque una consulta falló, sí.
  if (errUso) {
    console.error('[weekly-reflection] no se pudo registrar el uso:', errUso.message)
    return json({ error: 'no se pudo verificar el uso' }, 503)
  }
  // `!uso` no debería pasar —la función devuelve siempre una fila— pero si pasa
  // se corta igual: la regla de arriba es fallar cerrado, y "no sé cuántas
  // llevás" no es permiso para seguir.
  if (!uso) {
    console.error('[weekly-reflection] registrar_uso_ia no devolvió fila')
    return json({ error: 'no se pudo verificar el uso' }, 503)
  }
  if (!uso.permitido) {
    console.warn(`[weekly-reflection] tope diario alcanzado: ${user.id} (${uso.usadas})`)
    return json({ error: 'tope diario alcanzado' }, 429)
  }

  let body: { signal?: string; tone?: string; facts?: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'body inválido' }, 400)
  }

  // Se validan contra listas cerradas: lo que llega del cliente termina adentro
  // de un prompt, así que no puede ser texto arbitrario.
  if (!body.signal || !SIGNALS.includes(body.signal)) return json({ error: 'señal desconocida' }, 400)
  if (!body.tone || !TONES.includes(body.tone)) return json({ error: 'tono desconocido' }, 400)

  // Solo números y la etiqueta de nivel. Cualquier otra cosa se descarta —
  // es la barrera que impide que se filtre texto libre o valores de ánimo.
  const facts: Record<string, number | string> = {}
  for (const [k, v] of Object.entries(body.facts ?? {})) {
    if (typeof v === 'number' && Number.isFinite(v)) facts[k] = v
    else if (k === 'level' && typeof v === 'string' && v.length <= 20) facts[k] = v
  }

  try {
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 200,
      system: SYSTEM,
      // Sin thinking y con esfuerzo bajo: es reescribir una señal en una
      // oración, no razonar. Pensar acá solo agrega latencia en la pantalla
      // que más se abre.
      //
      // 🔴 Los dos parámetros son de la familia 4.6+ y NO existen en Haiku 4.5:
      // mandarle `effort` devuelve 400, así que con REFLECTION_MODEL apuntando
      // a Haiku la función fallaría con error en vez de caer al fallback. En
      // Haiku sobran igual — no piensa salvo que se lo pidan explícitamente, que
      // es justo el comportamiento que estas dos líneas buscan en los modelos
      // nuevos (varios de ellos SÍ piensan por defecto).
      ...(SOPORTA_EFFORT ? { thinking: { type: 'disabled' as const } } : {}),
      output_config: {
        ...(SOPORTA_EFFORT ? { effort: 'low' as const } : {}),
        // Salida estructurada para no tener que limpiar preámbulos del tipo
        // "Acá va la línea:".
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              linea: { type: 'string' },
              // El trozo a destacar. Es una decisión de PRESENTACIÓN: el cliente
              // parte `linea` por acá y lo pinta más fuerte, igual que las frases
              // escritas a mano. Si no coincide con nada, el cliente lo ignora y
              // muestra la línea plana — nunca rompe.
              destacado: { type: 'string' },
            },
            required: ['linea', 'destacado'],
            additionalProperties: false,
          },
        },
      },
      messages: [{
        role: 'user',
        content: `señal: ${body.signal}\ntono: ${body.tone}\ndatos: ${JSON.stringify(facts)}`,
      }],
    })

    const block = message.content.find((b: { type: string }) => b.type === 'text')
    const raw = block && 'text' in block ? (block as { text: string }).text : ''
    const linea = JSON.parse(raw)?.linea

    if (typeof linea !== 'string' || !linea.trim()) {
      return json({ error: 'el modelo no devolvió una línea' }, 502)
    }

    // ⚠️ El guardarraíl de contenido corre en el CLIENTE (`rejectCopy` en
    // lib/weeklyReflection.ts), no acá: es el mismo código que ya tiene tests y
    // así no hay dos definiciones de qué es aceptable. Acá solo se comprueba
    // que haya texto.
    return json({ linea: linea.trim(), model: MODEL })
  } catch (e) {
    console.error('[weekly-reflection]', e)
    return json({ error: 'no se pudo generar' }, 502)
  }
})
