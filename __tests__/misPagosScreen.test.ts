import React from 'react';
const renderer = require('react-test-renderer');
const { act } = renderer;
let mockUser: { id: string } | null = { id: 'one' };
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('@/components/ui/AppBg', () => ({ AppBg: 'AppBg' }));
jest.mock('@/components/SessionIssueSheet', () => 'SessionIssueSheet');
jest.mock('@expo/vector-icons/MaterialIcons', () => 'MaterialIcons');
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('@/lib/pagos', () => ({
  listMisPagos: jest.fn(), estadoDelPago: () => ({ titulo: 'Pagado', detalle: '', tono: 'ok' }),
  montoLegible: () => '$ 1', nombreProveedor: () => 'Mercado Pago',
}));
import MisPagosScreen from '@/screens/MisPagosScreen';
import { listMisPagos } from '@/lib/pagos';
const load = listMisPagos as jest.Mock;
const row = (name: string) => ({ id: name, coach_name: name, scheduled_date: '2026-09-23', scheduled_time: '10:00' });
let tree: any;
async function render() { await act(async () => { tree = renderer.create(React.createElement(MisPagosScreen)); }); }
const text = () => {
  const collect = (node: any): string => typeof node === 'string' ? node : Array.isArray(node) ? node.map(collect).join(' ') : collect(node?.children ?? []);
  return collect(tree.toJSON());
};
afterEach(() => { act(() => tree?.unmount()); load.mockReset(); mockUser = { id: 'one' }; });
it('shows failure instead of empty history, then retries successfully', async () => {
  load.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
  await render();
  expect(text()).toContain('No pudimos cargar tus pagos');
  expect(text()).not.toContain('Todavía no hay pagos');
  const retry = tree.root.findAll((n: any) => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function')[0];
  await act(async () => retry.props.onPress());
  expect(text()).toContain('Todavía no hay pagos');
  expect(text()).not.toContain('No pudimos cargar tus pagos');
});
it('does not keep another account history while the new request is pending', async () => {
  load.mockResolvedValueOnce([row('Private coach')]);
  await render();
  expect(text()).toContain('Private coach');
  load.mockReturnValueOnce(new Promise(() => {}));
  mockUser = { id: 'two' };
  await act(async () => tree.update(React.createElement(MisPagosScreen)));
  expect(text()).not.toContain('Private coach');
  expect(load).toHaveBeenLastCalledWith('two');
});
