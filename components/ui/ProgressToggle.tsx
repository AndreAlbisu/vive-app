import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { ViveFonts } from '@/constants/theme';

type Tab = 'hoy' | 'mes';

type Props = {
  value: Tab;
  onChange: (v: Tab) => void;
};

export function ProgressToggle({ value, onChange }: Props) {
  return (
    <View style={s.wrap}>
      {(['hoy', 'mes'] as Tab[]).map(t => (
        <TouchableOpacity
          key={t}
          style={[s.btn, value === t && s.btnActive]}
          onPress={() => onChange(t)}
          activeOpacity={0.8}
        >
          <Text style={[s.text, value === t && s.textActive]}>
            {t === 'hoy' ? 'Hoy' : 'Mes'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    padding: 3,
  },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
  },
  btnActive: { backgroundColor: '#FFFFFF' },
  text: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
  textActive: {
    color: '#C07080',
  },
});
