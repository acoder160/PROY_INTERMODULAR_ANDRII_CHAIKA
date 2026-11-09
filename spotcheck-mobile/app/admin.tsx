import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { DisplayFont, MIN_TARGET, Palette, Radius } from '../constants/theme';
import GradientFill from '../components/ui/GradientFill';
import { DifficultyMarks, TypeChip } from '../components/ui/PaintBits';
import SwipeCard, { type SwipeDirection } from '../components/admin/SwipeCard';
import AdminCommentsSheet from '../components/admin/AdminCommentsSheet';
import { useAuth } from '../context/AuthContext';
import {
  fetchCounts, fetchQueue, keepSpot, removePhoto, removeSpot, restorePhoto,
  type ModerationCounts, type ModerationFilter, type ModerationItem, type ModerationPage,
} from '../utils/adminApi';

const FILTERS: ModerationFilter[] = ['REPORTED', 'NEW', 'HIDDEN', 'ALL'];
const COUNT_KEY: Partial<Record<ModerationFilter, keyof ModerationCounts>> = { REPORTED: 'reported', NEW: 'fresh', HIDDEN: 'hidden' };
const UNDO_MS = 5000;

type Pending = { item: ModerationItem; kind: 'spot' | 'photo'; timer: ReturnType<typeof setTimeout> };

/**
 * Moderation deck: one spot at a time, Tinder style.
 * → keep · ← remove (5 s to undo) · ↑ reports and comments (delete comments there) · ↓ skip.
 * The buttons under the card do the same for anyone who prefers tapping (and for screen readers).
 */
export default function AdminScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAdmin, isLoading } = useAuth();

  const [filter, setFilter] = useState<ModerationFilter>('REPORTED');
  const [counts, setCounts] = useState<ModerationCounts | null>(null);
  const [deck, setDeck] = useState<ModerationItem[] | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [commentsFor, setCommentsFor] = useState<ModerationItem | null>(null);
  const [toast, setToast] = useState<{ kind: 'undo' | 'error' | 'success'; text: string } | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((next: { kind: 'undo' | 'error' | 'success'; text: string }) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(next);
    if (next.kind !== 'undo') toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const refreshCounts = useCallback(() => {
    fetchCounts().then(setCounts).catch(() => {});
  }, []);

  // State only changes once the server answers (these are called from effects)
  const applyPage = useCallback((page: ModerationPage) => {
    setLoadFailed(false);
    setDeck(page.items);
    setTotalPages(page.totalPages);
  }, []);
  const failPage = useCallback(() => {
    setLoadFailed(true);
    setDeck([]);
  }, []);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let cancelled = false;
    fetchQueue(filter, 0, 20)
      .then((page) => { if (!cancelled) applyPage(page); })
      .catch(() => { if (!cancelled) failPage(); });
    fetchCounts()
      .then((c) => { if (!cancelled) setCounts(c); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isAdmin, filter, reloadKey, applyPage, failPage]);

  // The deck ran out but the server has more: decided spots have left the queue, so page 0 is new
  useEffect(() => {
    if (!deck || deck.length > 0 || totalPages <= 1 || loadFailed) return undefined;
    let cancelled = false;
    fetchQueue(filter, 0, 20)
      .then((page) => { if (!cancelled) applyPage(page); })
      .catch(() => { if (!cancelled) failPage(); });
    return () => { cancelled = true; };
  }, [deck, totalPages, loadFailed, filter, applyPage, failPage]);

  const commitPending = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    setToast((current) => (current?.kind === 'undo' ? null : current));
    try {
      if (pending.kind === 'photo') await removePhoto(pending.item.id);
      else await removeSpot(pending.item.id);
      refreshCounts();
    } catch {
      setDeck((prev) => [pending.item, ...(prev ?? [])]);
      showToast({ kind: 'error', text: t('admin.actionFailed') });
    }
  }, [refreshCounts, showToast, t]);

  useEffect(() => () => { commitPending(); }, [commitPending]);

  const top = deck?.[0] ?? null;
  const next = deck?.[1] ?? null;

  const dropTop = useCallback(() => setDeck((prev) => (prev ? prev.slice(1) : prev)), []);

  const keep = useCallback(async (item: ModerationItem) => {
    commitPending();
    dropTop();
    try {
      await keepSpot(item.id);
      refreshCounts();
    } catch {
      setDeck((prev) => [item, ...(prev ?? [])]);
      showToast({ kind: 'error', text: t('admin.actionFailed') });
    }
  }, [commitPending, dropTop, refreshCounts, showToast, t]);

  const destructive = useCallback((item: ModerationItem, kind: 'spot' | 'photo') => {
    commitPending();
    dropTop();
    pendingRef.current = { item, kind, timer: setTimeout(() => { commitPending(); }, UNDO_MS) };
    showToast({ kind: 'undo', text: kind === 'photo' ? t('admin.photoRemoved') : t('admin.removed') });
  }, [commitPending, dropTop, showToast, t]);

  const undo = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    setDeck((prev) => [pending.item, ...(prev ?? [])]);
    setToast(null);
  }, []);

  const skip = useCallback(() => {
    setDeck((prev) => (prev && prev.length > 1 ? [...prev.slice(1), prev[0]] : prev));
  }, []);

  const restore = useCallback(async (item: ModerationItem) => {
    try {
      await restorePhoto(item.id);
      setDeck((prev) => prev?.map((i) => (i.id === item.id ? { ...i, photoStatus: 'OK' } : i)) ?? prev);
      refreshCounts();
    } catch {
      showToast({ kind: 'error', text: t('admin.actionFailed') });
    }
  }, [refreshCounts, showToast, t]);

  const onSwipe = useCallback((direction: SwipeDirection) => {
    if (!top) return;
    if (direction === 'right') keep(top);
    else if (direction === 'left') destructive(top, 'spot');
    else if (direction === 'up') setCommentsFor(top);
    else skip();
  }, [top, keep, destructive, skip]);

  const labels = useMemo(() => ({
    right: t('admin.keep'),
    left: t('admin.remove'),
    up: t('admin.comments'),
    down: t('admin.skip'),
  }), [t]);

  if (isLoading) return <View style={styles.center}><ActivityIndicator color={Palette.white} /></View>;
  if (!isAdmin) return <Redirect href="/" />;

  return (
    <GestureHandlerRootView style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <GradientFill name="topBar" />
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t('admin.backToMap')}
        >
          <Ionicons name="arrow-back" size={22} color={Palette.white} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">{t('admin.moderation')}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
        {FILTERS.map((f) => {
          const active = f === filter;
          const key = COUNT_KEY[f];
          const count = key && counts ? counts[key] : 0;
          return (
            <TouchableOpacity
              key={f}
              onPress={() => { if (!active) { commitPending(); setDeck(null); setFilter(f); } }}
              style={[styles.tab, active && styles.tabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t(`admin.tabs.${f}`)}</Text>
              {count > 0 && (
                <View style={[styles.tabCount, f === 'REPORTED' && styles.tabCountHot]}>
                  <Text style={styles.tabCountText}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <Text style={styles.hint}>{t('admin.swipeHint')}</Text>

      <View style={styles.deckArea}>
        {deck === null ? (
          <ActivityIndicator color={Palette.ink} size="large" />
        ) : !top ? (
          <View style={styles.empty}>
            <Ionicons name={loadFailed ? 'cloud-offline-outline' : 'checkmark-circle'} size={56} color={loadFailed ? Palette.inkMuted : Palette.positive} />
            <Text style={styles.emptyText}>{loadFailed ? t('admin.loadFailed') : t('admin.empty')}</Text>
            <TouchableOpacity onPress={() => { setDeck(null); setReloadKey((k) => k + 1); }} style={styles.retryBtn} accessibilityRole="button">
              <Ionicons name="refresh" size={18} color={Palette.ink} />
              <Text style={styles.retryText}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {next && (
              <View style={[styles.cardBox, styles.nextCard]} pointerEvents="none">
                <SpotCardContent item={next} />
              </View>
            )}
            <SwipeCard key={top.id} onSwipe={onSwipe} labels={labels} style={styles.cardBox}>
              <SpotCardContent item={top} position={`1 / ${deck.length}`} />
            </SwipeCard>
          </>
        )}
      </View>

      {top && (
        <View style={[styles.actions, { paddingBottom: insets.bottom + 12 }]}>
          <ActionButton icon="close" label={t('admin.remove')} tone="danger" onPress={() => destructive(top, 'spot')} />
          {top.photoStatus === 'HIDDEN' ? (
            <ActionButton icon="image-outline" label={t('admin.restorePhoto')} onPress={() => restore(top)} />
          ) : top.mediaUrl ? (
            <ActionButton icon="camera-outline" label={t('admin.removePhoto')} onPress={() => destructive(top, 'photo')} />
          ) : null}
          <ActionButton icon="chatbubbles-outline" label={t('admin.comments')} badge={top.commentCount} onPress={() => setCommentsFor(top)} />
          <ActionButton icon="arrow-down" label={t('admin.skip')} onPress={skip} />
          <ActionButton icon="checkmark" label={t('admin.keep')} tone="positive" onPress={() => keep(top)} />
        </View>
      )}

      {toast && (
        <View style={[styles.toast, toast.kind === 'error' && styles.toastError, { bottom: insets.bottom + 100 }]} accessibilityLiveRegion="polite">
          <Text style={styles.toastText} numberOfLines={2}>{toast.text}</Text>
          {toast.kind === 'undo' && (
            <TouchableOpacity onPress={undo} style={styles.undoBtn} accessibilityRole="button">
              <Text style={styles.undoText}>{t('admin.undo')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <AdminCommentsSheet
        key={commentsFor?.id ?? 'none'}
        item={commentsFor}
        onClose={() => setCommentsFor(null)}
        onDeleted={(spotId) => setDeck((prev) => prev?.map((i) => (i.id === spotId ? { ...i, commentCount: Math.max(0, i.commentCount - 1) } : i)) ?? prev)}
      />
    </GestureHandlerRootView>
  );
}

function SpotCardContent({ item, position }: { item: ModerationItem; position?: string }) {
  const { t, i18n } = useTranslation();
  const type = (item.spotType || 'STREET').toUpperCase();
  const difficulty = (item.difficultyLevel || 'INTERMEDIATE').toUpperCase();
  const reasons = Object.entries(item.reasons || {});
  const date = item.createdAt ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(item.createdAt)) : '';
  const verdictColor = item.aiVerdict === 'VIOLATION' ? Palette.danger : item.aiVerdict === 'OK' ? Palette.positive : Palette.ink;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.media}>
        {item.mediaUrl ? (
          <Image source={{ uri: item.mediaUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : (
          <View style={styles.mediaEmpty}>
            <GradientFill name="concrete" diagonal />
            <Ionicons name="camera-outline" size={40} color={Palette.inkMuted} />
          </View>
        )}
        {item.photoStatus === 'HIDDEN' && <Text style={[styles.badge, styles.badgeDanger, styles.badgeLeft]}>{t('admin.status.PHOTO_HIDDEN')}</Text>}
        {!!position && <Text style={[styles.badge, styles.badgeRight]}>{position}</Text>}
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
        <View style={styles.facts}>
          <TypeChip type={type} label={t(`types.${type}`, { defaultValue: type })} />
          <DifficultyMarks level={difficulty} label={t(`difficulty.${difficulty}`, { defaultValue: difficulty })} />
          {item.status === 'HIDDEN' && <Text style={styles.flag}>{t('admin.status.HIDDEN')}</Text>}
        </View>
        <Text style={styles.meta} numberOfLines={1}>{t('admin.by', { user: item.createdBy })} · {date}</Text>
        {!!item.description && <Text style={styles.desc} numberOfLines={3}>{item.description}</Text>}

        {item.reportCount > 0 && (
          <View style={styles.reportsRow}>
            <Text style={styles.score}>{item.reportScore} / {item.reportThreshold}</Text>
            {reasons.slice(0, 3).map(([reason, n]) => (
              <Text key={reason} style={styles.reason} numberOfLines={1}>{t(`report.reasons.${reason}`)} × {n}</Text>
            ))}
          </View>
        )}

        <View style={styles.ai}>
          <Text style={styles.aiLabel}>{t('admin.aiVerdict')}</Text>
          {item.aiVerdict ? (
            <>
              <Text style={[styles.aiVerdict, { color: verdictColor }]}>{t(`admin.verdict.${item.aiVerdict}`)}</Text>
              {!!item.aiReason && <Text style={styles.aiReason} numberOfLines={3}>{item.aiReason}</Text>}
            </>
          ) : (
            <Text style={styles.aiReason}>{t('admin.aiNone')}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

function ActionButton({ icon, label, onPress, tone, badge }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  tone?: 'danger' | 'positive';
  badge?: number;
}) {
  const color = tone === 'danger' ? Palette.danger : Palette.ink;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.actionBtn, tone === 'danger' && styles.actionDanger, tone === 'positive' && styles.actionPositive]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={26} color={color} />
      {!!badge && badge > 0 && (
        <View style={styles.actionBadge}><Text style={styles.actionBadgeText}>{badge}</Text></View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.concrete },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.asphalt },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: Palette.asphalt,
  },
  backBtn: {
    width: MIN_TARGET,
    height: MIN_TARGET,
    borderRadius: MIN_TARGET / 2,
    borderWidth: 2,
    borderColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flexShrink: 1,
    fontFamily: DisplayFont.black,
    fontSize: 30,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: Palette.white,
  },
  tabsScroll: { flexGrow: 0 },
  tabs: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  tab: {
    minHeight: MIN_TARGET,
    paddingHorizontal: 14,
    borderRadius: Radius.control,
    borderWidth: 2,
    borderColor: Palette.ink,
    backgroundColor: Palette.sheet,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabActive: { backgroundColor: Palette.asphalt },
  tabText: { fontFamily: DisplayFont.bold, fontSize: 18, letterSpacing: 0.6, textTransform: 'uppercase', color: Palette.ink },
  tabTextActive: { color: Palette.white },
  tabCount: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: Palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCountHot: { backgroundColor: Palette.pink },
  tabCountText: { fontFamily: DisplayFont.black, fontSize: 14, color: Palette.ink },

  deckArea: { flex: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, justifyContent: 'center' },
  cardBox: { position: 'absolute', top: 14, left: 16, right: 16, bottom: 8 },
  nextCard: {
    backgroundColor: Palette.sheet,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: Palette.ink,
    overflow: 'hidden',
    transform: [{ scale: 0.95 }, { translateY: 14 }],
    opacity: 0.7,
  },

  media: { height: '42%', minHeight: 150, backgroundColor: Palette.concrete },
  mediaEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Palette.white,
    backgroundColor: Palette.asphalt,
    color: Palette.white,
    fontFamily: DisplayFont.bold,
    fontSize: 15,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    overflow: 'hidden',
  },
  badgeLeft: { left: 12 },
  badgeRight: { right: 12 },
  badgeDanger: { backgroundColor: Palette.danger },
  cardBody: { flex: 1, padding: 16, gap: 8 },
  cardTitle: { fontFamily: DisplayFont.black, fontSize: 28, lineHeight: 30, letterSpacing: 0.4, textTransform: 'uppercase', color: Palette.ink },
  facts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  flag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#FCE8E6',
    color: Palette.danger,
    fontFamily: DisplayFont.bold,
    fontSize: 14,
    textTransform: 'uppercase',
    overflow: 'hidden',
  },
  meta: { fontSize: 13, color: Palette.inkMuted },
  desc: { fontSize: 15, lineHeight: 21, color: Palette.ink },
  reportsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  score: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Palette.ink,
    backgroundColor: Palette.pink,
    fontFamily: DisplayFont.black,
    fontSize: 15,
    color: Palette.ink,
    overflow: 'hidden',
  },
  reason: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Palette.ink,
    fontSize: 13,
    fontWeight: '700',
    color: Palette.ink,
    maxWidth: '100%',
  },
  ai: { marginTop: 'auto', padding: 12, borderRadius: Radius.card, borderWidth: 2, borderColor: Palette.ink, backgroundColor: '#F4F4F1' },
  aiLabel: { fontFamily: DisplayFont.bold, fontSize: 14, letterSpacing: 0.6, textTransform: 'uppercase', color: Palette.inkMuted },
  aiVerdict: { fontFamily: DisplayFont.black, fontSize: 20, textTransform: 'uppercase' },
  aiReason: { marginTop: 2, fontSize: 14, lineHeight: 19, color: Palette.inkMuted },

  empty: { alignItems: 'center', gap: 12, paddingHorizontal: 24 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Palette.ink, textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: MIN_TARGET,
    paddingHorizontal: 16,
    borderRadius: Radius.control,
    borderWidth: 2,
    borderColor: Palette.ink,
    backgroundColor: Palette.sheet,
  },
  retryText: { fontFamily: DisplayFont.bold, fontSize: 17, textTransform: 'uppercase', color: Palette.ink },

  actions: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  actionBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: Palette.ink,
    backgroundColor: Palette.sheet,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  actionDanger: { borderColor: Palette.danger },
  actionPositive: { backgroundColor: Palette.green, width: 64, height: 64, borderRadius: 32 },
  actionBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    backgroundColor: Palette.asphalt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBadgeText: { fontFamily: DisplayFont.black, fontSize: 13, color: Palette.white },
  hint: { marginTop: 8, paddingHorizontal: 16, textAlign: 'center', fontSize: 13, color: Palette.inkMuted },

  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 10,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: Palette.white,
    backgroundColor: Palette.asphalt,
  },
  toastError: { backgroundColor: Palette.danger },
  toastText: { flex: 1, color: Palette.white, fontSize: 15, fontWeight: '700' },
  undoBtn: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Palette.ink,
    backgroundColor: Palette.pink,
    justifyContent: 'center',
  },
  undoText: { fontFamily: DisplayFont.black, fontSize: 16, letterSpacing: 0.8, textTransform: 'uppercase', color: Palette.ink },
});
