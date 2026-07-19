import { View, Text, StyleSheet } from 'react-native';
import { ViveFonts } from '@/constants/theme';
import { colors } from '@/theme/tokens';
import { VitaWordmark } from '@/components/VitaWordmark';

type Props = {
  userName?: string;
  right?: React.ReactNode;
};

export function VitaHeader({ userName, right }: Props) {
  return (
    <View style={s.bar}>
      <VitaWordmark />
      {right ?? (
        userName ? (
          <View style={s.avatar}>
            <Text style={s.avatarText}>{userName[0].toUpperCase()}</Text>
          </View>
        ) : null
      )}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 6,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.tintTerracota,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: colors.textPrimary,
  },
});
