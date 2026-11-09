import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';
import { cleanLabel } from '../../utils/text';
import { apiErrorText, timeAgo } from '../../utils/social';
import { DisplayFont, MIN_TARGET, Palette, Radius } from '../../constants/theme';
import GradientFill from '../ui/GradientFill';
import { StarRating } from '../ui/PaintBits';
import Avatar from './Avatar';
import ReportModal from '../ReportModal';

const COMMENT_ERRORS = { text_rejected: 'social.commentRejected' };

export interface Comment {
  id: number;
  content: string | null;
  username: string | null;
  avatarUrl?: string | null;
  authorDeleted?: boolean;
  createdAt: string;
  editedAt?: string | null;
  deleted?: boolean;
  rating?: number | null;
  parentId?: number | null;
  likeCount: number;
  likedByMe: boolean;
  replies: Comment[];
}

/**
 * Comments of a spot: threads with one level of replies, likes, edit / delete of your own.
 * Top-level comments come newest first, a page at a time ("Load more").
 */
export default function CommentSection({ spotId, me, reloadKey, onCountChange, onBeforeNavigate }: {
  spotId: number;
  me: string | null;
  reloadKey: number;
  onCountChange?: (count: number | string) => void;
  /** Called before leaving for a profile (the sheet closes). */
  onBeforeNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [items, setItems] = useState<Comment[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.get(`/spots/${spotId}/comments`)
      .then((res) => {
        if (cancelled) return;
        setItems(res.data?.items ?? []);
        setNextCursor(res.data?.nextCursor ?? null);
        setFailed(false);
      })
      .catch((e) => {
        // No server is an expected state here (the sheet offers "Try again"): log, no red LogBox
        console.log('Could not load comments:', e?.message ?? e);
        if (!cancelled) setFailed(true);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [spotId, reloadKey, retryKey]);

  useEffect(() => {
    const total = items.reduce((sum, c) => sum + (c.deleted ? 0 : 1) + c.replies.length, 0);
    onCountChange?.(nextCursor ? `${total}+` : total);
  }, [items, nextCursor, onCountChange]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await api.get(`/spots/${spotId}/comments`, { params: { before: nextCursor } });
      setItems((prev) => [...prev, ...(res.data?.items ?? [])]);
      setNextCursor(res.data?.nextCursor ?? null);
    } catch {
      setError(t('popup.commentsFailed'));
    } finally {
      setLoadingMore(false);
    }
  };

  const patchComment = useCallback((id: number, change: (c: Comment) => Partial<Comment>) => {
    setItems((prev) => prev.map((c) => {
      if (c.id === id) return { ...c, ...change(c) };
      if (!c.replies.some((r) => r.id === id)) return c;
      return { ...c, replies: c.replies.map((r) => (r.id === id ? { ...r, ...change(r) } : r)) };
    }));
  }, []);

  const removeComment = useCallback((comment: Comment) => {
    setItems((prev) => prev
      .map((c) => {
        if (c.id === comment.id) {
          return c.replies.length > 0 ? { ...c, deleted: true, content: null, username: null } : null;
        }
        return { ...c, replies: c.replies.filter((r) => r.id !== comment.id) };
      })
      .filter((c): c is Comment => c !== null));
  }, []);

  const addReply = useCallback((threadId: number, reply: Comment) => {
    setItems((prev) => prev.map((c) => (c.id === threadId ? { ...c, replies: [...c.replies, reply] } : c)));
  }, []);

  const openProfile = useCallback((username: string) => {
    onBeforeNavigate?.();
    router.push({ pathname: '/user/[username]', params: { username } } as any);
  }, [onBeforeNavigate, router]);

  const send = async () => {
    const content = draft.trim();
    if (!content) return;
    setSending(true);
    setError(null);
    try {
      const res = await api.post(`/comments/${spotId}`, { content });
      setItems((prev) => [res.data, ...prev]);
      setDraft('');
    } catch (e) {
      setError(apiErrorText(e, t, COMMENT_ERRORS));
    } finally {
      setSending(false);
    }
  };

  if (loading) return <ActivityIndicator size="small" color={Palette.ink} style={{ marginTop: 10 }} />;

  return (
    <View style={styles.list}>
      {failed ? (
        <View style={styles.failed} accessibilityLiveRegion="polite">
          <Text style={styles.empty}>{t('popup.commentsFailed')}</Text>
          <TouchableOpacity style={styles.outlineBtn} onPress={() => { setLoading(true); setRetryKey((k) => k + 1); }} accessibilityRole="button">
            <Ionicons name="refresh" size={18} color={Palette.ink} />
            <Text style={styles.outlineText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : items.length === 0 && <Text style={styles.empty}>{cleanLabel(t('popup.firstComment'))}</Text>}

      {items.map((c) => (
        <View key={c.id}>
          <CommentItem comment={c} threadId={c.id} spotId={spotId} me={me} onPatch={patchComment}
                       onRemove={removeComment} onReplied={addReply} onOpenProfile={openProfile} />
          {c.replies.length > 0 && (
            <View style={styles.replies}>
              {c.replies.map((r) => (
                <CommentItem key={r.id} comment={r} threadId={c.id} spotId={spotId} me={me} onPatch={patchComment}
                             onRemove={removeComment} onReplied={addReply} onOpenProfile={openProfile} />
              ))}
            </View>
          )}
        </View>
      ))}

      {nextCursor !== null && (
        <TouchableOpacity style={[styles.outlineBtn, styles.center]} onPress={loadMore} disabled={loadingMore} accessibilityRole="button">
          {loadingMore ? <ActivityIndicator color={Palette.ink} /> : <Text style={styles.outlineText}>{t('social.loadMore')}</Text>}
        </TouchableOpacity>
      )}

      {error && <Text style={styles.error} accessibilityLiveRegion="assertive">{error}</Text>}

      {me ? (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder={t('social.writeComment')}
            placeholderTextColor={Palette.inkMuted}
            value={draft}
            onChangeText={setDraft}
            maxLength={1000}
            multiline
            accessibilityLabel={t('social.writeComment')}
          />
          <TouchableOpacity style={[styles.sendBtn, (sending || !draft.trim()) && { opacity: 0.6 }]} onPress={send}
                            disabled={sending || !draft.trim()} accessibilityRole="button">
            <GradientFill name="pink" radius={14} />
            {sending ? <ActivityIndicator color={Palette.ink} /> : <Text style={styles.sendText}>{t('popup.send')}</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={[styles.outlineBtn, styles.center]} onPress={() => { onBeforeNavigate?.(); router.push('/login'); }} accessibilityRole="button">
          <Text style={styles.outlineText}>{t('social.signInToComment')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function CommentItem({ comment, threadId, spotId, me, onPatch, onRemove, onReplied, onOpenProfile }: {
  comment: Comment;
  threadId: number;
  spotId: number;
  me: string | null;
  onPatch: (id: number, change: (c: Comment) => Partial<Comment>) => void;
  onRemove: (c: Comment) => void;
  onReplied: (threadId: number, reply: Comment) => void;
  onOpenProfile: (username: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<'edit' | 'reply' | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const mine = Boolean(me) && comment.username === me;

  if (comment.deleted) {
    return <Text style={[styles.item, styles.deleted]}>{t('social.commentDeleted')}</Text>;
  }

  const author = comment.authorDeleted ? t('social.deletedUser') : comment.username || t('common.user');

  const toggleLike = async () => {
    if (!me) return;
    const liked = !comment.likedByMe;
    onPatch(comment.id, (c) => ({ likedByMe: liked, likeCount: c.likeCount + (liked ? 1 : -1) }));
    try {
      const res = liked ? await api.post(`/comments/${comment.id}/like`) : await api.delete(`/comments/${comment.id}/like`);
      onPatch(comment.id, () => ({ likedByMe: res.data.liked, likeCount: res.data.likes }));
    } catch {
      onPatch(comment.id, (c) => ({ likedByMe: !liked, likeCount: c.likeCount + (liked ? -1 : 1) }));
    }
  };

  const open = (next: 'edit' | 'reply') => {
    setError(null);
    setText(next === 'edit' ? comment.content ?? '' : '');
    setMode(mode === next ? null : next);
  };

  const submit = async () => {
    const content = text.trim();
    if (!content) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'edit') {
        const res = await api.patch(`/comments/${comment.id}`, { content });
        onPatch(comment.id, () => ({ content: res.data.content, editedAt: res.data.editedAt }));
      } else {
        const res = await api.post(`/comments/${spotId}`, { content, parentId: comment.id });
        onReplied(threadId, res.data);
      }
      setMode(null);
    } catch (e) {
      setError(apiErrorText(e, t, COMMENT_ERRORS));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    Alert.alert(t('social.deleteCommentConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('social.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/comments/${comment.id}`);
            onRemove(comment);
          } catch (e) {
            setError(apiErrorText(e, t));
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.item}>
      <View style={styles.head}>
        <Avatar username={comment.username} url={comment.avatarUrl} size={28} />
        {comment.username && !comment.authorDeleted ? (
          <TouchableOpacity onPress={() => onOpenProfile(comment.username!)} accessibilityRole="link" hitSlop={8}>
            <Text style={styles.author}>{author}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={[styles.author, styles.authorDeleted]}>{author}</Text>
        )}
        {!!comment.rating && comment.rating > 0 && <StarRating value={comment.rating} size={14} label={(n) => `${n} / 5`} />}
        <Text style={styles.time}>
          {timeAgo(comment.createdAt, i18n.language)}{comment.editedAt ? ` · ${t('social.edited')}` : ''}
        </Text>
      </View>

      {mode !== 'edit' && <Text style={styles.text}>{comment.content}</Text>}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={toggleLike} disabled={!me} accessibilityRole="button"
                          accessibilityLabel={t('social.like')} accessibilityState={{ selected: comment.likedByMe }}>
          <Ionicons name={comment.likedByMe ? 'heart' : 'heart-outline'} size={18} color={comment.likedByMe ? Palette.pink : Palette.inkMuted} />
          {comment.likeCount > 0 && <Text style={styles.actionText}>{comment.likeCount}</Text>}
        </TouchableOpacity>
        {me && (
          <TouchableOpacity style={styles.action} onPress={() => open('reply')} accessibilityRole="button">
            <Ionicons name="return-down-forward-outline" size={18} color={Palette.inkMuted} />
            <Text style={styles.actionText}>{t('social.reply')}</Text>
          </TouchableOpacity>
        )}
        {!!me && !mine && !comment.authorDeleted && (
          <TouchableOpacity style={styles.action} onPress={() => setReporting(true)} accessibilityRole="button" accessibilityLabel={t('report.title')}>
            <Ionicons name="flag-outline" size={18} color={Palette.inkMuted} />
          </TouchableOpacity>
        )}
        {mine && (
          <>
            <TouchableOpacity style={styles.action} onPress={() => open('edit')} accessibilityRole="button" accessibilityLabel={t('social.edit')}>
              <Ionicons name="create-outline" size={18} color={Palette.inkMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={remove} accessibilityRole="button" accessibilityLabel={t('social.delete')}>
              <Ionicons name="trash-outline" size={18} color={Palette.inkMuted} />
            </TouchableOpacity>
          </>
        )}
      </View>

      {reporting && (
        <ReportModal endpoint={`/comments/${comment.id}/reports`} subject={author} onClose={() => setReporting(false)} />
      )}

      {mode && (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            autoFocus
            multiline
            maxLength={1000}
            value={text}
            onChangeText={setText}
            placeholder={mode === 'reply' ? t('social.replyingTo', { username: author }) : ''}
            placeholderTextColor={Palette.inkMuted}
            accessibilityLabel={mode === 'reply' ? t('social.replyingTo', { username: author }) : t('social.edit')}
          />
          <TouchableOpacity style={[styles.sendBtn, (busy || !text.trim()) && { opacity: 0.6 }]} onPress={submit}
                            disabled={busy || !text.trim()} accessibilityRole="button">
            <GradientFill name="pink" radius={14} />
            {busy ? <ActivityIndicator color={Palette.ink} /> : (
              <Text style={styles.sendText}>{mode === 'edit' ? t('social.save') : t('popup.send')}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 10 },
  failed: { alignItems: 'center', gap: 4 },
  empty: { color: Palette.inkMuted, textAlign: 'center', marginTop: 10, fontSize: 15 },
  item: { padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: Palette.hairline },
  deleted: { color: Palette.inkMuted, fontStyle: 'italic' },
  replies: { marginLeft: 32 },
  head: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  author: { fontWeight: '800', fontSize: 14, color: Palette.ink },
  authorDeleted: { color: Palette.inkMuted, fontStyle: 'italic' },
  time: { marginLeft: 'auto', fontSize: 12, color: Palette.inkMuted },
  text: { fontSize: 15, lineHeight: 21, color: Palette.inkMuted },
  actions: { flexDirection: 'row', gap: 4, marginTop: 4 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 40, minHeight: 40, paddingHorizontal: 8, justifyContent: 'center' },
  actionText: { fontSize: 14, fontWeight: '600', color: Palette.inkMuted },
  inputRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  input: { flex: 1, backgroundColor: Palette.white, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, minHeight: MIN_TARGET, maxHeight: 120, borderWidth: 2, borderColor: Palette.ink, fontSize: 16, color: Palette.ink },
  sendBtn: { backgroundColor: Palette.pink, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 16, borderWidth: 2, borderColor: Palette.ink, minHeight: MIN_TARGET },
  sendText: { fontFamily: DisplayFont.black, fontSize: 18, letterSpacing: 0.8, color: Palette.ink, textTransform: 'uppercase' },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: MIN_TARGET, paddingHorizontal: 16, borderRadius: Radius.control, borderWidth: 2, borderColor: Palette.ink, backgroundColor: Palette.white },
  outlineText: { fontFamily: DisplayFont.bold, fontSize: 18, letterSpacing: 0.6, textTransform: 'uppercase', color: Palette.ink },
  center: { alignSelf: 'center', marginTop: 8 },
  error: { color: Palette.danger, fontSize: 14, marginTop: 6 },
});
