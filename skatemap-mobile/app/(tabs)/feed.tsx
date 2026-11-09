import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { DisplayFont, MIN_TARGET, Palette, Radius } from '../../constants/theme';
import ScreenBar from '../../components/social/ScreenBar';
import SignInPrompt from '../../components/social/SignInPrompt';
import Avatar from '../../components/social/Avatar';
import SpotCard from '../../components/social/SpotCard';
import { StarRating } from '../../components/ui/PaintBits';
import { timeAgo, type SpotSummary, type UserSummary } from '../../utils/social';
import { formatSessionTime } from '../../components/social/LiveSection';

interface FeedItem {
  id: number;
  type: 'SPOT_CREATED' | 'COMMENTED' | 'RATED' | 'CHECKED_IN' | 'SESSION_CREATED';
  session: { id: number; startsAt: string } | null;
  actor: UserSummary;
  spot: SpotSummary | null;
  comment: string | null;
  rating: number | null;
  createdAt: string;
}

/** What the people you follow have been doing: new spots, comments, first ratings. */
export default function FeedScreen() {
  const { t, i18n } = useTranslation();
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/feed');
      setItems(res.data.items);
      setNextCursor(res.data.nextCursor);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    api.get('/feed')
      .then((res) => {
        if (cancelled) return;
        setItems(res.data.items);
        setNextCursor(res.data.nextCursor);
        setFailed(false);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [user]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await api.get('/feed', { params: { before: nextCursor } });
      setItems((prev) => [...(prev ?? []), ...res.data.items]);
      setNextCursor(res.data.nextCursor);
    } catch {
      // Pull to refresh tries again
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenBar title={t('social.feed')} />
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
              : <Text style={styles.empty}>{failed ? t('social.loadFailed') : t('social.feedEmpty')}</Text>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={Palette.ink} /> : undefined}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <Avatar username={item.actor.username} url={item.actor.avatarUrl} size={40} />
              <View style={styles.body}>
                <View style={styles.line}>
                  <TouchableOpacity
                    disabled={!item.actor.username}
                    onPress={() => router.push({ pathname: '/user/[username]', params: { username: item.actor.username! } } as any)}
                    accessibilityRole="link"
                  >
                    <Text style={styles.actor}>{item.actor.username ?? t('social.deletedUser')}</Text>
                  </TouchableOpacity>
                  <Text style={styles.lineText}>{t(`social.activity.${item.type}`)}</Text>
                  {item.type === 'RATED' && !!item.rating && <StarRating value={item.rating} size={14} label={(n) => `${n} / 5`} />}
                </View>
                <Text style={styles.time}>{timeAgo(item.createdAt, i18n.language)}</Text>
                {!!item.comment && <Text style={styles.quote}>{item.comment}</Text>}
                {!!item.session && <Text style={styles.session}>{formatSessionTime(item.session.startsAt, i18n.language)}</Text>}
                <SpotCard spot={item.spot} />
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.concrete },
  list: { padding: 16, gap: 10, paddingBottom: 32, flexGrow: 1 },
  empty: { color: Palette.inkMuted, fontSize: 16, textAlign: 'center', marginTop: 32, paddingHorizontal: 16 },
  item: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: Radius.card, borderWidth: 2, borderColor: Palette.ink, backgroundColor: Palette.sheet },
  body: { flex: 1, minWidth: 0, gap: 8 },
  line: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, minHeight: 24 },
  actor: { fontWeight: '800', fontSize: 16, color: Palette.ink },
  lineText: { fontSize: 16, color: Palette.ink },
  time: { color: Palette.inkMuted, fontSize: 13, marginTop: -4 },
  quote: { fontSize: 15, color: Palette.ink, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#F2F2EF', borderRadius: 10 },
  more: { minHeight: MIN_TARGET, fontFamily: DisplayFont.bold },
  session: { fontFamily: DisplayFont.black, fontSize: 18, textTransform: 'uppercase', color: Palette.ink },
});
