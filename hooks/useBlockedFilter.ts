import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { loadBlockedIds, onBlockedChange, filterBlocked } from '@/lib/blocking';

/**
 * Saca del catálogo a los coaches que este usuario bloqueó.
 *
 * Se aplica en las pantallas y no dentro de `coachesCache` a propósito: el
 * cache también lo consume `CoachVisibilityScreen`, donde el coach mira su
 * standing contra el pool COMPLETO de su puerta. Si el filtro viviera en el
 * cache, un coach que bloqueó a alguien vería un pool más chico y la app le
 * prometería un lugar que el deck de los demás no le va a dar.
 *
 * Mientras la lista de bloqueados no cargó, `filterBlocked` devuelve todo — un
 * frame de más es mejor que un catálogo vacío por una query lenta.
 */
export function useBlockedFilter<T extends { id: string }>(items: T[]): T[] {
  const { user } = useAuth();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!user) return;
    void loadBlockedIds(user.id);
    return onBlockedChange(() => setVersion(v => v + 1));
  }, [user]);

  // `version` no se usa adentro: está en las deps para re-filtrar cuando el
  // cache cambia (bloquear/desbloquear no cambia la identidad de `items`).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => filterBlocked(items), [items, version]);
}
