import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useUnread } from '../../context/UnreadContext';
import { Palette, Radius } from '../../constants/theme';
import ScreenBar from '../../components/social/ScreenBar';
import SignInPrompt from '../../components/social/SignInPrompt';
import Avatar from '../../components/social/Avatar';
import { openSpotOnMap } from '../../components/social/SpotCard';
import { timeAgo, type SpotSummary, type UserSummary } from '../../utils/social';

interface NotificationItem {
  id: number;
  type: 'FOLLOW' | 'COMMENT_ON_SPOT' | 'REPLY' | 'COMMENT_LIKE' | 'SESSION_JOINED' | 'SESSION_REMINDER' | 'FOLLOWEE_CHECKED_IN';
  actor: UserSummary;
  spot: SpotSummary | null;
  comment: string | null;
  read: boolean;
  createdAt: string;
}

/** Follows, comments on your spots, replies and likes. Opening the tab marks them as read. */
export default function NotificationsScreen() {
  const { t, i18n } = useTranslation();
  const { user, isLoading } = useAuth();
  const { clear } = useUnread();
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      setItems(res.data.items);
      setNextCursor(res.data.nextCursor);
      setFailed(false);
      // Shown once as unread (the pink edge), then cleared on the server and on the tab badge
      if (res.data.unread > 0) {
        clear();
        api.post('/notifications/read').catch(() => {});
      }
    } catch {
      setFailed(true);
    } finally {
      setRefreshing(false);
    }
  }, [clear]);

  // Every visit to the tab: new notifications may have arrived
  useFocusEffect(useCallback(() => {
    if (user) load();
  }, [user, load]));

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await api.get('/notifications', { params: { before: nextCursor } });
      setItems((prev) => [...(prev ?? []), ...res.data.items]);
      setNextCursor(res.data.nextCursor);
    } catch {
      // Pull to refresh tries again
    } finally {
      setLoadingMore(false);
    }
  };

  const open = (n: NotificationItem) => {
    if (n.type === 'FOLLOW' && n.actor.username) {
      router.push({ pathname: '/user/[username]', params: { username: n.actor.username } } as any);
    } else if (n.spot) {
      openSpotOnMap(router, n.spot.id);
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenBar title={t('social.notifications')} />
      {!isLoading && !user ? <SignInPrompt /> : (
        <FlatList
          data={items ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            items === null && !failed
              ? <ActivityIndicator color={Palette.ink} style={{ marginTop: 24 }} />
              : <Text style={styles.empty}>{failed ? t('social.loadFailed') : t('social.notificationsEmpty')}</Text>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={Palette.ink} /> : undefined}
          renderItem={({ item }) => {
            const actor = item.actor.deleted ? t('social.deletedUser') : item.actor.username;
            return (
              <TouchableOpacity style={styles.row} onPress={() => open(item)} accessibilityRole="button">
                <Avatar username={item.actor.username} url={item.actor.avatarUrl} size={40} />
                <View style={styles.body}>
                  <Text style={styles.line}>
                    {/* A reminder is about your session, not about what the host did */}
                    {item.type !== 'SESSION_REMINDER' && <Text style={styles.actor}>{actor} </Text>}
                    {t(`social.notif.${item.type}`, { spot: item.spot?.name ?? '' })}
                  </Text>
                  {!!item.comment && <Text style={styles.quote} numberOfLines={3}>{item.comment}</Text>}
                  <Text style={styles.time}>{timeAgo(item.createdAt, i18n.language)}</Text>
                </View>
                {!item.read && <View style={styles.dot} accessibilityLabel={t('social.unread')} />}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.concrete },
  list: { padding: 16, gap: 10, paddingBottom: 32, flexGrow: 1 },
  empty: { color: Palette.inkMuted, fontSize: 16, textAlign: 'center', marginTop: 32, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: Radius.card, borderWidth: 2, borderColor: Palette.ink, backgroundColor: Palette.sheet },
  body: { flex: 1, minWidth: 0, gap: 6 },
  line: { fontSize: 16, color: Palette.ink },
  actor: { fontWeight: '800' },
  quote: { fontSize: 15, color: Palette.ink, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#F2F2EF', borderRadius: 10 },
  time: { color: Palette.inkMuted, fontSize: 13 },
  dot: { width: 12, height: 12, marginTop: 6, borderRadius: 6, borderWidth: 2, borderColor: Palette.ink, backgroundColor: Palette.pink },
});
