import { View, Text, StyleSheet } from 'react-native';
import { ViveFonts } from '@/constants/theme';

/**
 * Con qué se le puede PAGAR a este profesional.
 *
 * 🔴 Existe por la regla espejo (D4): a quien reserva se le ofrecen solo los
 * medios por los que el coach acepta cobrar, y hasta ahora eso se aplicaba
 * recién en la pantalla de confirmar. Alguien del exterior que solo puede pagar
 * con PayPal recorría buscador → perfil → día → horario → confirmar para
 * enterarse ahí de que ese coach solo toma USDT. Cuatro pantallas hasta el
 * callejón. Mostrarlo en la tarjeta lo resuelve antes de entrar.
 *
 * 📝 Se muestran solo los que ACEPTA, no los tres siempre con los que no acepta
 * apagados: una grilla de tres con dos en gris se lee como una carencia del
 * profesional, y no lo es — elegir un riel es una decisión suya, no un puntaje.
 */
export type PaymentBadgesProps = {
  mp?: boolean;
  paypal?: boolean;
  usdt?: boolean;
  /** `true` en superficies chicas: recorta a los dos primeros. */
  compact?: boolean;
};

const RIELES = [
  { key: 'mp', label: 'Mercado Pago', bg: 'rgba(0,158,227,0.12)', ink: '#1B6E8C' },
  { key: 'paypal', label: 'PayPal', bg: 'rgba(0,48,135,0.10)', ink: '#274B8A' },
  { key: 'usdt', label: 'USDT', bg: 'rgba(38,161,123,0.12)', ink: '#1F7A5E' },
] as const;

export function PaymentBadges({ mp, paypal, usdt, compact }: PaymentBadgesProps) {
  const activos = RIELES.filter(r =>
    (r.key === 'mp' && mp) || (r.key === 'paypal' && paypal) || (r.key === 'usdt' && usdt),
  );
  // Sin ningún riel no se dibuja nada. Un coach sin Mercado Pago igual puede
  // recibir reservas —hoy el pago es opcional— así que una fila vacía diría algo
  // falso sobre él.
  if (activos.length === 0) return null;

  const visibles = compact ? activos.slice(0, 2) : activos;
  const resto = activos.length - visibles.length;

  return (
    <View style={s.row}>
      {visibles.map(r => (
        <View key={r.key} style={[s.badge, { backgroundColor: r.bg }]}>
          <Text style={[s.text, { color: r.ink }]} numberOfLines={1}>{r.label}</Text>
        </View>
      ))}
      {resto > 0 && (
        <View style={[s.badge, { backgroundColor: 'rgba(86,94,50,0.08)' }]}>
          <Text style={[s.text, { color: '#87835C' }]}>+{resto}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  text: {
    fontFamily: ViveFonts.medium,
    fontSize: 10,
    letterSpacing: 0.2,
  },
});
