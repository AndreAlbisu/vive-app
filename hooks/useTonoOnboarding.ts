import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { colorDeTono, leerTono, TONOS } from '@/constants/onboardingTonos';

/**
 * El color del camino que la persona eligió en la bifurcación, para que las
 * pantallas que siguen lo lleven puesto.
 *
 * 🔴 Primero el parámetro de ruta y después lo guardado, en ese orden y no al
 * revés. La pantalla que recibe la transición trae el tono en la URL y lo tiene
 * en el PRIMER cuadro; leerlo de AsyncStorage es asíncrono, así que arrancaría
 * en crema y cambiaría de color un cuadro después — un parpadeo justo cuando la
 * capa de la transición se está desvaneciendo, que es lo peor posible.
 *
 * Devuelve `null` mientras no se sepa, y las pantallas caen a su fondo normal.
 */
export function useTonoOnboarding(): string | null {
  const { tono } = useLocalSearchParams<{ tono?: string }>();
  const delParam = colorDeTono(tono);

  const [guardado, setGuardado] = useState<string | null>(null);

  useEffect(() => {
    if (delParam) return;   // ya lo tenemos, no hace falta ir al storage
    let vivo = true;
    leerTono().then(t => { if (vivo && t) setGuardado(TONOS[t]); });
    return () => { vivo = false; };
  }, [delParam]);

  return delParam ?? guardado;
}
