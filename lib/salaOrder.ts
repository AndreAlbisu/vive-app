// Cómo se ordena la lista de Mensajes del USUARIO.
//
// 🔴 POR QUÉ EXISTE: no había orden. La consulta de `salas` no llevaba
// `.order()` y la pantalla guardaba las filas como las devolvía Postgres, así
// que la posición era arbitraria: el chat más reciente podía quedar tercero,
// debajo de dos salas sin un solo mensaje. El campo para ordenar ya se
// calculaba (`lastMessageRaw` en `SessionsScreen`) y no lo leía nadie.
//
// ⚠️ NO es `agruparRoster` de `lib/coachRoster.ts`, y la diferencia es a
// propósito. El coach ordena por PRÓXIMA SESIÓN: entra a preparar a quién ve
// mañana, sobre 20 personas. El usuario entra a seguir una conversación, sobre
// tres o cuatro, y ahí lo más reciente es lo más probable. Un criterio único
// para las dos pantallas rompería una de las dos.
//
// Afuera de la pantalla por el mismo motivo que `lib/ejesLayout.ts` y
// `lib/coachRoster.ts`: es la regla del orden, se puede probar sin montar nada,
// y adentro del componente nadie la iba a mirar de nuevo.

export type FilaSala = {
  lastMessageRaw: string | null;
  createdAt: string | null;
};

/**
 * Con mensajes primero, del más reciente al más viejo. Las salas sin ningún
 * mensaje van todas después.
 *
 * 🔴 Las vacías NO se mezclan por fecha con el resto. Una sala recién creada es
 * más nueva que cualquier conversación, así que un solo timestamp para todas
 * pondría arriba justamente las filas que no tienen nada para leer. Son dos
 * cosas distintas: una conversación y una relación que todavía no arrancó.
 *
 * 📝 Entre las vacías manda la sala más nueva: si acabás de reservar con
 * alguien, esa es la que vas a querer abrir, no la que quedó muerta en marzo.
 *
 * Es pura: `filter` devuelve arrays nuevos, así que `filas` no se toca.
 */
export function ordenarSalas<T extends FilaSala>(filas: T[]): T[] {
  const conMensajes = filas.filter(f => !!f.lastMessageRaw);
  const vacias = filas.filter(f => !f.lastMessageRaw);

  conMensajes.sort(
    (a, b) => Date.parse(b.lastMessageRaw as string) - Date.parse(a.lastMessageRaw as string),
  );

  // `createdAt` es NOT NULL en la base; el guard es por si la consulta deja de
  // pedir la columna, para que el orden degrade en vez de dar NaN.
  vacias.sort((a, b) => {
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });

  return [...conMensajes, ...vacias];
}
