// ¿Quien llama trae el service role?
//
// 🔴 POR QUÉ EXISTE: las seis functions que solo puede llamar el cron hacían
// `authHeader.includes(SUPABASE_SERVICE_ROLE_KEY)`. Dos problemas, sobre el
// camino más privilegiado que hay en todo el sistema:
//
//   · `includes` es una búsqueda de SUBCADENA, no una igualdad. Cualquier
//     header que CONTENGA la clave pasa, venga como venga: prefijos, sufijos,
//     un header armado a mano con basura alrededor. No es explotable sin tener
//     la clave, pero es un candado que no verifica lo que dice verificar.
//   · La comparación de strings de JavaScript corta en el primer byte que no
//     coincide, así que tarda distinto según cuántos caracteres acertaste. Eso
//     es un canal lateral de tiempo. Sobre HTTP es ruidoso y difícil de
//     explotar, pero no cuesta nada cerrarlo.
//
// Acá se extrae el token del `Bearer` y se compara ENTERO y en tiempo
// constante: siempre recorre los dos hasta el final, y el largo se mezcla en el
// resultado para no filtrarlo por early-return.

function igualEnTiempoConstante(a: string, b: string): boolean {
  const ba = new TextEncoder().encode(a)
  const bb = new TextEncoder().encode(b)
  // El largo sí se compara de una: no es secreto (el de la clave es conocido) y
  // sin esto habría que decidir cómo recorrer dos arreglos de distinto tamaño.
  let dif = ba.length ^ bb.length
  const n = Math.max(ba.length, bb.length)
  for (let i = 0; i < n; i++) {
    dif |= (ba[i] ?? 0) ^ (bb[i] ?? 0)
  }
  return dif === 0
}

/** `true` solo si el header es exactamente `Bearer <service role key>`. */
export function esServiceRole(authHeader: string | null, serviceRoleKey: string): boolean {
  if (!authHeader || !serviceRoleKey) return false
  const m = authHeader.match(/^Bearer\s+(.+)$/)
  if (!m) return false
  return igualEnTiempoConstante(m[1].trim(), serviceRoleKey)
}
