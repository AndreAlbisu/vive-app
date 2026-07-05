import { useState, useEffect } from 'react';
import { TouchableOpacity, Alert, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ViveColors } from '@/constants/theme';

/**
 * Botón de "fijar al inicio" (pinned_resources, tope 4).
 * Reutilizable en cualquier pantalla de recurso: las tools de VITA pasan su
 * slug ('ruido', 'diario', ...), los recursos de coaches su uuid.
 * Pensado para ir en el header, reemplazando el spacer de ancho 60.
 */
export function PinButton({ resourceId }: { resourceId: string }) {
  const { user, requestAuth } = useAuth();
  const [pinned, setPinned] = useState(false);
  const [pinCount, setPinCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('pinned_resources')
      .select('resource_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        setPinCount(data?.length ?? 0);
        setPinned((data ?? []).some(p => p.resource_id === resourceId));
      });
  }, [user, resourceId]);

  async function toggle() {
    if (!user) { requestAuth(); return; }

    if (pinned) {
      setPinned(false);
      setPinCount(c => Math.max(0, c - 1));
      await supabase
        .from('pinned_resources')
        .delete()
        .eq('user_id', user.id)
        .eq('resource_id', resourceId);
      return;
    }

    if (pinCount >= 4) {
      Alert.alert('Ya tenés 4 en tu inicio', 'Quitá uno para fijar este.');
      return;
    }

    setPinned(true);
    setPinCount(c => c + 1);
    const { error } = await supabase
      .from('pinned_resources')
      .insert({ user_id: user.id, resource_id: resourceId });
    if (error) {
      // el trigger rechaza el 5to pin aunque el conteo local diga otra cosa
      setPinned(false);
      setPinCount(c => Math.max(0, c - 1));
      Alert.alert('Ya tenés 4 en tu inicio', 'Quitá uno para fijar este.');
    }
  }

  return (
    <View style={s.slot}>
      <TouchableOpacity onPress={toggle} hitSlop={10}>
        <MaterialCommunityIcons
          name={pinned ? 'pin' : 'pin-outline'}
          size={22}
          color={pinned ? ViveColors.primary : 'rgba(135,131,92,0.72)'}
        />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  slot: { width: 60, alignItems: 'flex-end' },
});
