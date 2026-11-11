import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { DisplayFont, MIN_TARGET, Palette, Radius } from '../../constants/theme';
import GradientFill from '../ui/GradientFill';
import Avatar from './Avatar';
import SpotCard from './SpotCard';
import ActiveSessions from './ActiveSessions';
import ReportModal from '../ReportModal';
import { formatMonthYear } from '../../utils/social';

type Tab = 'spots' | 'followers' | 'following';
const TABS: Tab[] = ['spots', 'followers', 'following'];

interface Profile {
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
  spots: number;
  ratings: number;
  comments: number;
  followers: number;
  following: number;
  followedByMe: boolean;
  blockedByMe?: boolean;
  me: boolean;
}

/** A skater's profile: who they are, their spots, and who they follow. Shared by the Profile tab and /user/[username]. */
export default function ProfileView({ username }: { username: string }) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');
  const [tab, setTab] = useState<Tab>('spots');
  const [list, setList] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Back from editing the profile or a spot: show the fresh data
  useFocusEffect(useCallback(() => { setReloadKey((k) => k + 1); }, []));

  useEffect(() => {
    let cancelled = false;
    api.get(`/users/${encodeURIComponent(username)}`)
      .then((res) => { if (!cancelled) { setProfile(res.data); setState('ready'); } })
      .catch((err) => { if (!cancelled) setState(err?.response?.status === 404 ? 'missing' : 'failed'); })
      .finally(() => { if (!cancelled) setRefreshing(false); });
    return () => { cancelled = true; };
  }, [username, user, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    api.get(`/users/${encodeURIComponent(username)}/${tab}`)
      .then((res) => { if (!cancelled) setList(res.data ?? []); })
      .catch(() => { if (!cancelled) setList([]); });
    return () => { cancelled = true; };
  }, [username, tab, reloadKey]);

  const [reporting, setReporting] = useState(false);

  const applyBlock = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      const path = `/users/${encodeURIComponent(username)}/block`;
      if (profile.blockedByMe) await api.delete(path); else await api.put(path);
      setProfile({
        ...profile,
        blockedByMe: !profile.blockedByMe,
        followedByMe: false,
        followers: profile.followedByMe ? Math.max(0, profile.followers - 1) : profile.followers,
      });
    } catch {
      Alert.alert(t('popup.sendErrorConnection'));
    } finally {
      setBusy(false);
    }
  };

  const toggleBlock = () => {
    if (!user) { router.push('/login'); return; }
    if (!profile) return;
    if (profile.blockedByMe) { applyBlock(); return; }
    Alert.alert(t('safety.block'), t('safety.blockConfirm', { username }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('safety.block'), style: 'destructive', onPress: applyBlock },
    ]);
  };

  const toggleFollow = async () => {
    if (!user) { router.push('/login'); return; }
    if (!profile) return;
    setBusy(true);
    try {
      const path = `/users/${encodeURIComponent(username)}/follow`;
      const res = profile.followedByMe ? await api.delete(path) : await api.post(path);
      setProfile({ ...profile, followedByMe: res.data.following, followers: res.data.followers });
    } catch {
      Alert.alert(t('popup.sendErrorConnection'));
    } finally {
      setBusy(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert(t('map.logoutConfirm'), user ?? undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('map.logout'), style: 'destructive', onPress: () => { logout().then(() => router.navigate('/(tabs)')); } },
    ]);
  };

  if (state !== 'ready' || !profile) {
    return (
      <View style={styles.center}>
        {state === 'loading'
          ? <ActivityIndicator color={Palette.ink} />
          : <Text style={styles.empty}>{state === 'missing' ? t('social.userNotFound') : t('social.loadFailed')}</Text>}
      </View>
    );
  }

  const counts: Record<Tab, number> = { spots: profile.spots, followers: profile.followers, following: profile.following };

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setReloadKey((k) => k + 1); }} />}
    >
      <View style={styles.card}>
        <View style={styles.headRow}>
          <Avatar username={profile.username} url={profile.avatarUrl} size={80} />
          <View style={styles.headText}>
            <Text style={styles.name} accessibilityRole="header">{profile.username}</Text>
            <Text style={styles.since}>{t('social.memberSince', { date: formatMonthYear(profile.createdAt, i18n.language) })}</Text>
          </View>
        </View>
        {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

        <View style={styles.actions}>
          {profile.me ? (
            <>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => router.push('/profile-edit' as any)} accessibilityRole="button">
                <Ionicons name="create-outline" size={18} color={Palette.ink} />
                <Text style={styles.outlineText}>{t('social.editProfile')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => router.push('/saved' as any)} accessibilityRole="button">
                <Ionicons name="bookmark-outline" size={18} color={Palette.ink} />
                <Text style={styles.outlineText}>{t('social.savedSpots')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={confirmLogout} accessibilityRole="button" accessibilityLabel={t('map.logout')}>
                <Ionicons name="log-out-outline" size={20} color={Palette.ink} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              {!profile.blockedByMe && (
                <TouchableOpacity
                  style={[profile.followedByMe ? styles.outlineBtn : styles.primaryBtn, busy && { opacity: 0.6 }]}
                  onPress={toggleFollow}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityState={{ selected: profile.followedByMe }}
                >
                  {!profile.followedByMe && <GradientFill name="pink" radius={24} />}
                  <Text style={styles.outlineText}>{profile.followedByMe ? t('social.followingState') : t('social.follow')}</Text>
                </TouchableOpacity>
              )}
              {!!user && (
                <>
                  <TouchableOpacity style={[styles.outlineBtn, busy && { opacity: 0.6 }]} onPress={toggleBlock} disabled={busy} accessibilityRole="button">
                    <Text style={styles.outlineText}>{profile.blockedByMe ? t('safety.unblock') : t('safety.block')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => setReporting(true)} accessibilityRole="button" accessibilityLabel={t('report.title')}>
                    <Ionicons name="flag-outline" size={20} color={Palette.ink} />
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </View>
        {reporting && (
          <ReportModal endpoint={`/users/${encodeURIComponent(username)}/reports`} subject={username} onClose={() => setReporting(false)} />
        )}

        <View style={styles.stats}>
          <Text style={styles.statLabel}>{t('social.ratingsCount')} <Text style={styles.statValue}>{profile.ratings}</Text></Text>
          <Text style={styles.statLabel}>{t('social.commentsCount')} <Text style={styles.statValue}>{profile.comments}</Text></Text>
        </View>
      </View>

      {profile.me && <ActiveSessions reloadKey={reloadKey} />}

      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((key) => (
          <TouchableOpacity key={key} style={[styles.tab, tab === key && styles.tabOn]} onPress={() => { if (key !== tab) { setList(null); setTab(key); } }}
                            accessibilityRole="tab" accessibilityState={{ selected: tab === key }}>
            <Text style={[styles.tabText, tab === key && styles.tabTextOn]} numberOfLines={1}>{t(`social.${key}Count`)}</Text>
            <View style={[styles.tabCount, tab === key && styles.tabCountOn]}>
              <Text style={[styles.tabCountText, tab === key && styles.tabCountTextOn]}>{counts[key]}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.list}>
        {list === null && <ActivityIndicator color={Palette.ink} />}
        {list?.length === 0 && <Text style={styles.empty}>{tab === 'spots' ? t('social.noSpotsYet') : t('social.nobodyYet')}</Text>}
        {tab === 'spots' && list?.map((spot) => <SpotCard key={spot.id} spot={spot} />)}
        {tab !== 'spots' && list?.map((person) => (
          <TouchableOpacity key={person.username} style={styles.person} accessibilityRole="button"
                            onPress={() => router.push({ pathname: '/user/[username]', params: { username: person.username } } as any)}>
            <Avatar username={person.username} url={person.avatarUrl} size={40} />
            <Text style={styles.personName} numberOfLines={1}>{person.username}</Text>
            {person.followedByMe && <Text style={styles.personTag}>{t('social.followingState')}</Text>}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: { color: Palette.inkMuted, fontSize: 16, textAlign: 'center', marginVertical: 16 },
  card: { padding: 18, borderRadius: Radius.card, borderWidth: 2, borderColor: Palette.ink, backgroundColor: Palette.sheet, gap: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headText: { flex: 1, minWidth: 0 },
  name: { fontFamily: DisplayFont.black, fontSize: 32, lineHeight: 34, color: Palette.ink, textTransform: 'uppercase' },
  since: { color: Palette.inkMuted, fontSize: 14, marginTop: 2 },
  bio: { fontSize: 16, lineHeight: 22, color: Palette.ink },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primaryBtn: { minHeight: MIN_TARGET, paddingHorizontal: 22, borderRadius: Radius.control, borderWidth: 2, borderColor: Palette.ink, backgroundColor: Palette.pink, alignItems: 'center', justifyContent: 'center' },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: MIN_TARGET, paddingHorizontal: 16, borderRadius: Radius.control, borderWidth: 2, borderColor: Palette.ink, backgroundColor: Palette.white },
  outlineText: { fontFamily: DisplayFont.bold, fontSize: 18, letterSpacing: 0.6, textTransform: 'uppercase', color: Palette.ink },
  iconBtn: { width: MIN_TARGET, height: MIN_TARGET, borderRadius: MIN_TARGET / 2, borderWidth: 2, borderColor: Palette.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.white },
  stats: { flexDirection: 'row', gap: 20 },
  statLabel: { color: Palette.inkMuted, fontSize: 14 },
  statValue: { color: Palette.ink, fontFamily: DisplayFont.black, fontSize: 20 },
  sessions: { gap: 8 },
  sessionsTitle: { fontFamily: DisplayFont.bold, fontSize: 20, letterSpacing: 0.6, textTransform: 'uppercase', color: Palette.ink },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.card, borderWidth: 2, borderColor: Palette.ink, backgroundColor: Palette.sheet },
  sessionText: { flex: 1, minWidth: 0 },
  sessionTime: { fontFamily: DisplayFont.black, fontSize: 18, textTransform: 'uppercase', color: Palette.ink },
  sessionSpot: { fontSize: 15, fontWeight: '700', color: Palette.ink },
  sessionMeta: { fontSize: 13, color: Palette.inkMuted },
  sessionTag: { maxWidth: '35%', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 2, borderColor: Palette.ink, backgroundColor: Palette.white },
  sessionTagHost: { backgroundColor: Palette.asphalt },
  sessionTagText: { fontSize: 13, fontWeight: '800', color: Palette.ink, textTransform: 'uppercase' },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: MIN_TARGET, paddingHorizontal: 8, borderRadius: Radius.control, borderWidth: 2, borderColor: Palette.ink, backgroundColor: Palette.white },
  tabOn: { backgroundColor: Palette.asphalt },
  tabText: { flexShrink: 1, fontFamily: DisplayFont.bold, fontSize: 16, letterSpacing: 0.4, textTransform: 'uppercase', color: Palette.ink },
  tabTextOn: { color: Palette.white },
  tabCount: { minWidth: 24, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: Palette.asphalt, alignItems: 'center', justifyContent: 'center' },
  tabCountOn: { backgroundColor: Palette.white },
  tabCountText: { color: Palette.white, fontFamily: DisplayFont.black, fontSize: 14 },
  tabCountTextOn: { color: Palette.ink },
  list: { gap: 10 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.card, borderWidth: 2, borderColor: Palette.ink, backgroundColor: Palette.sheet },
  personName: { flex: 1, fontWeight: '800', fontSize: 16, color: Palette.ink },
  personTag: { color: Palette.inkMuted, fontSize: 13 },
});
