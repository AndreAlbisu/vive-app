import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ViveColors, ViveFonts } from '@/constants/theme';

type ChatRoom = {
  id: string;
  userName: string;
  initials: string;
  lastMessage: string;
  date: string;
  unread: number;
  sessionToday?: string;
};

const MOCK_CHATS: ChatRoom[] = [
  {
    id: '1',
    userName: 'Ana López',
    initials: 'AL',
    lastMessage: 'Gracias María, nos vemos el lunes 🙏',
    date: '10:43',
    unread: 0,
    sessionToday: '11:00',
  },
  {
    id: '2',
    userName: 'Carlos Méndez',
    initials: 'CM',
    lastMessage: 'Practiqué la respiración y me ayudó mucho.',
    date: 'Ayer',
    unread: 2,
  },
  {
    id: '3',
    userName: 'Lucía Fernández',
    initials: 'LF',
    lastMessage: '¿Podemos mover la sesión al viernes?',
    date: 'Lun',
    unread: 1,
  },
  {
    id: '4',
    userName: 'Tomás García',
    initials: 'TG',
    lastMessage: 'Recordame enviar el diario de la semana.',
    date: 'Vie',
    unread: 0,
  },
  {
    id: '5',
    userName: 'Valeria Torres',
    initials: 'VT',
    lastMessage: 'Perfecto. Hasta el próximo encuentro.',
    date: '10 jun',
    unread: 0,
  },
];

const cardShadow = Platform.select({
  ios: {
    shadowColor: ViveColors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
});

export default function CoachChatsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Chats</Text>
      </View>

      <ScrollView
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}>

        {MOCK_CHATS.map((chat, idx) => (
          <TouchableOpacity
            key={chat.id}
            style={[s.chatRow, idx < MOCK_CHATS.length - 1 && s.chatRowBorder]}
            onPress={() => router.push('/sala')}
            activeOpacity={0.75}>

            {/* Avatar */}
            <View style={[s.avatar, chat.unread > 0 && s.avatarUnread]}>
              <Text style={s.avatarText}>{chat.initials}</Text>
            </View>

            {/* Info */}
            <View style={s.chatInfo}>
              <View style={s.chatTopRow}>
                <Text style={[s.chatName, chat.unread > 0 && s.chatNameUnread]}>
                  {chat.userName}
                </Text>
                <Text style={s.chatDate}>{chat.date}</Text>
              </View>

              {chat.sessionToday && (
                <Text style={s.sessionLabel}>Sesión hoy a las {chat.sessionToday}</Text>
              )}

              <View style={s.chatBottomRow}>
                <Text
                  style={[s.lastMessage, chat.unread > 0 && s.lastMessageUnread]}
                  numberOfLines={1}>
                  {chat.lastMessage}
                </Text>
                {chat.unread > 0 && (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{chat.unread}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: ViveColors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 14,
    backgroundColor: ViveColors.background,
  },
  title: {
    fontFamily: ViveFonts.semibold,
    fontSize: 26,
    color: ViveColors.text,
  },
  container: {
    paddingHorizontal: 0,
  },

  // Chat list
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    gap: 14,
  },
  chatRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: `${ViveColors.text}08`,
  },

  // Avatar
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: `${ViveColors.accent}30`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarUnread: {
    backgroundColor: `${ViveColors.primary}20`,
    borderWidth: 2,
    borderColor: `${ViveColors.primary}40`,
  },
  avatarText: {
    fontFamily: ViveFonts.bold,
    fontSize: 15,
    color: ViveColors.text,
  },

  // Info
  chatInfo: { flex: 1 },
  chatTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  chatName: {
    fontFamily: ViveFonts.medium,
    fontSize: 15,
    color: ViveColors.text,
  },
  chatNameUnread: {
    fontFamily: ViveFonts.semibold,
  },
  chatDate: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: `${ViveColors.text}55`,
  },

  sessionLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: ViveColors.accent,
    marginBottom: 3,
  },

  chatBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lastMessage: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: `${ViveColors.text}70`,
  },
  lastMessageUnread: {
    fontFamily: ViveFonts.medium,
    color: ViveColors.text,
  },

  // Unread badge
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: ViveColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    flexShrink: 0,
  },
  badgeText: {
    fontFamily: ViveFonts.bold,
    fontSize: 11,
    color: '#FFFFFF',
  },
});
