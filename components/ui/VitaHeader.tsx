import { View, Text, StyleSheet } from 'react-native';
import { ViveFonts } from '@/constants/theme';

type Props = {
  userName?: string;
  right?: React.ReactNode;
};

export function VitaHeader({ userName, right }: Props) {
  return (
    <View style={s.bar}>
      <Text style={s.logo}>VITA</Text>
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
  logo: {
    fontFamily: ViveFonts.bold,
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: 3,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.32)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});
