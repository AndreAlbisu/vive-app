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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.68.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const MODEL = Deno.env.get('REFLECTION_MODEL') ?? 'claude-haiku-4-5'

// Haiku no acepta `effort` ni la configuración de thinking de los modelos 4.6+.
// El chequeo va por prefijo y no por lista de ids para que cambiar de versión
// de Haiku por env no lo rompa.
const SOPORTA_EFFORT = !MODEL.startsWith('claude-haiku')

const SIGNALS = [
  'empty', 'level', 'trend-up', 'trend-down',
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

# Reglas que no se rompen
- NUNCA le asignes género a quien lee. No sabés si es varón o mujer. Nada de "venís cansada", "estás solo", "cansado". Si necesitás un adjetivo, que califique a "la semana" o "los días", no a la persona.
- NUNCA diagnostiques ni uses vocabulario clínico: depresión, ansiedad generalizada, trastorno, síntoma, episodio. La app acompaña, no diagnostica.
- NUNCA prometas resultados ni suenes a gurú: "vas a lograr", "el universo", "todo pasa por algo", "solo depende de vos". El brief de marca lo prohíbe expresamente.
- NUNCA uses signos de exclamación, markdown, comillas ni emoji.
- No empieces con "Parece que", "Se nota que", "Veo que" — entrá directo.
- Entre 10 y 30 palabras. Dos oraciones.

# El tono te lo paso yo
- gentle → la persona la está pasando mal. NO la animes, NO le pidas nada, NO celebres. Acusás recibo y te corrés. Arriba de esta tarjeta ya hay otra sugiriéndole hablar con un profesional: no compitas con eso ni agregues una segunda acción.
- neutral → no pasó nada destacable. Que no suene a relleno ni a que falta algo.
- warm → hay algo para reconocer. Reconocelo sin exagerarlo.

# Las señales
- empty: todavía no registró nada. Invitá sin presionar.
- level: la semana viene estable, en el nivel que te paso. El nivel concuerda con "semana" (femenino): decilo como "tu semana viene ___", nunca "venís ___".
- trend-up: mejoró respecto del mes anterior. Hablá SOLO de la dirección, nunca del nivel absoluto.
- trend-down: viene peor que el mes anterior. Solo dirección. Sin dramatizar y sin minimizar.
- sustained-low: hace días que viene abajo. Tono gentle obligado.
- sessions: tuvo sesiones con un profesional esta semana. Es lo más importante que le pasó.
- streak: días seguidos haciendo el check-in.
- practices: veces que usó las herramientas de la app esta semana.
- sharp-drop: hoy cayó fuerte respecto de ayer. Tono gentle obligado.

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
            properties: { linea: { type: 'string' } },
            required: ['linea'],
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
