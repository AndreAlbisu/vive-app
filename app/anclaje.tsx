// Herramienta retirada de la vista (design/recursos-v2-definiciones.md: las
// herramientas de Vita son 4 — Diario, Gratitud, Ruidos y Respiración). La
// pantalla NO se borra: sigue en screens/AnclajeScreen.tsx, entera y funcionando,
// lista para volver o para que un coach le ponga la voz. Lo que se cierra es el
// acceso: sin esto la ruta respondía igual que antes aunque la herramienta no
// estuviera en ninguna grilla, y un hábito o recordatorio viejo aterrizaba en
// una pantalla que el equipo decidió no sostener.
import { Redirect } from 'expo-router';

export default function AnclajeRetirada() {
  return <Redirect href="/(tabs)/recursos" />;
}
