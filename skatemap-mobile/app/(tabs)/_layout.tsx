import { Tabs } from 'expo-router';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { HapticTab } from '@/components/haptic-tab';
import { DisplayFont, Palette } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useUnread } from '@/context/UnreadContext';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function icon(on: IconName, off: IconName) {
  return function TabIcon({ color, focused }: { color: unknown; focused: boolean }) {
    return <Ionicons name={focused ? on : off} size={24} color={color as string} />;
  };
}

/** Asphalt tab bar: Map, Feed, Notifications (with the unread badge) and Profile. */
export default function TabLayout() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { unread } = useUnread();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: Palette.pink,
        tabBarInactiveTintColor: Palette.onAsphaltMuted,
        tabBarStyle: { backgroundColor: Palette.asphalt, borderTopColor: Palette.asphaltRaised, borderTopWidth: 2 },
        tabBarLabelStyle: { fontFamily: DisplayFont.bold, fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase' },
      }}>
      <Tabs.Screen name="index" options={{ title: t('social.map'), tabBarIcon: icon('map', 'map-outline') }} />
      <Tabs.Screen name="feed" options={{ title: t('social.feed'), tabBarIcon: icon('newspaper', 'newspaper-outline') }} />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t('social.notifications'),
          tabBarIcon: icon('notifications', 'notifications-outline'),
          tabBarBadge: user && unread > 0 ? (unread > 99 ? '99+' : unread) : undefined,
          tabBarBadgeStyle: { backgroundColor: Palette.pink, color: Palette.ink, fontWeight: '800' },
        }}
      />
      <Tabs.Screen name="profile" options={{ title: t('social.profile'), tabBarIcon: icon('person-circle', 'person-circle-outline') }} />
    </Tabs>
  );
}
