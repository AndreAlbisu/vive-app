// Mapeo único mood_id → herramientas sugeridas. Antes había dos mapeos
// hardcodeados independientes — MOOD_CFG en hooks/useRecommendedResource.ts
// (card de Recursos) y MOOD_RECS en components/ResourceSuggestionCard.tsx
// ("Para vos ahora" en Home) — que podían sugerir cosas distintas para el
// mismo mood el mismo día (ej. Cansado: Escáner corporal en Recursos vs.
// Respiración+Gratitud en Home). Unificado sesión 81 porque Joaquín no
// entendía por qué la app se contradecía entre pantallas.
//
// `primary`/`secondary`: ids de TOOL_MAP (constants/tools.ts). `tone`: frase
// corta para la oración de Recursos ("Te sentiste X — {tone}"). `line`: línea
// contextual fija de Home ("Para vos ahora").
export const MOOD_RESOURCES: Record<number, {
  primary: string;
  secondary: string;
  tone: string;
  line: string;
}> = {
  1: { primary: 'diario',      secondary: 'respiracion', tone: 'escribir lo que sentís ayuda a soltarlo',                 line: 'Venís con un bajón. Algo para aflojar un poco:' },
  2: { primary: 'respiracion', secondary: 'gratitud',    tone: 'reconectar con el cuerpo cuando la energía está baja',    line: 'Estás cansado. Para recargar:' },
  3: { primary: 'gratitud',    secondary: 'diario',      tone: 'anotar algo bueno, por chico que sea, suma',              line: 'Día tranquilo. Para sumar algo bueno:' },
  4: { primary: 'gratitud',    secondary: 'diario',      tone: 'anotar qué te hizo bien ayuda a sostenerlo',              line: 'Venís bien. Para sostenerlo:' },
  5: { primary: 'gratitud',    secondary: 'respiracion', tone: 'dejar registro de esto ayuda a que dure',                 line: 'Estás brillando. Para aprovecharlo:' },
};
