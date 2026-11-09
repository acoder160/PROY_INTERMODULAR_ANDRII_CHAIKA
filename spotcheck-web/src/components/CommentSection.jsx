import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import { StarRating } from './PaintBits';
import { HeartIcon, ReplyIcon, EditIcon, TrashIcon, RefreshIcon, FlagIcon } from './Icons';
import ReportSheet from './ReportSheet';
import ConfirmSheet from './ConfirmSheet';
import { cleanLabel } from '../utils/paint';
import { apiErrorText, timeAgo } from '../utils/social';

const COMMENT_ERRORS = { text_rejected: 'social.commentRejected' };

/**
 * Comments of a spot: threads (one level of replies), likes, and edit / delete of your own.
 * The API pages top-level comments newest first; "Load more" asks for the next page.
 */
export default function CommentSection({ spotId, reloadKey, onCountChange }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
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
      .catch(() => { if (!cancelled) setFailed(true); })
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

  // Replace one comment (top-level or reply) wherever it is
  const patchComment = useCallback((id, change) => {
    setItems((prev) => prev.map((c) => {
      if (c.id === id) return { ...c, ...change(c) };
      if (!c.replies.some((r) => r.id === id)) return c;
      return { ...c, replies: c.replies.map((r) => (r.id === id ? { ...r, ...change(r) } : r)) };
    }));
  }, []);

  const removeComment = useCallback((comment) => {
    setItems((prev) => prev
      .map((c) => {
        if (c.id === comment.id) {
          // With replies it stays as a placeholder, like the server does
          return c.replies.length > 0 ? { ...c, deleted: true, content: null, username: null } : null;
        }
        return { ...c, replies: c.replies.filter((r) => r.id !== comment.id) };
      })
      .filter(Boolean));
  }, []);

  const addReply = useCallback((threadId, reply) => {
    setItems((prev) => prev.map((c) => (c.id === threadId ? { ...c, replies: [...c.replies, reply] } : c)));
  }, []);

  const send = async () => {
    const content = draft.trim();
    if (!content) return;
    setSending(true);
    setError(null);
    try {
      const res = await api.post(`/comments/${spotId}`, { content });
      setItems((prev) => [res.data, ...prev]);
      setDraft('');
    } catch (err) {
      setError(apiErrorText(err, t, COMMENT_ERRORS));
    } finally {
      setSending(false);
    }
  };

  if (loading) return <span className="spinner spinner-ink spinner-center" aria-label={t('popup.loading')} />;

  return (
    <div className="comments-list">
      {failed ? (
        <div className="comments-failed" role="status">
          <p className="no-comments">{t('popup.commentsFailed')}</p>
          <button type="button" className="btn-outline btn-small" onClick={() => { setLoading(true); setRetryKey((k) => k + 1); }}>
            <RefreshIcon size={18} />
            <span>{t('common.retry')}</span>
          </button>
        </div>
      ) : items.length === 0 && <p className="no-comments">{cleanLabel(t('popup.firstComment'))}</p>}

      {items.map((c) => (
        <div key={c.id} className="comment-thread">
          <CommentItem comment={c} threadId={c.id} spotId={spotId} me={user?.username}
                       onPatch={patchComment} onRemove={removeComment} onReplied={addReply} />
          {c.replies.length > 0 && (
            <div className="comment-replies">
              {c.replies.map((r) => (
                <CommentItem key={r.id} comment={r} threadId={c.id} spotId={spotId} me={user?.username}
                             onPatch={patchComment} onRemove={removeComment} onReplied={addReply} />
              ))}
            </div>
          )}
        </div>
      ))}

      {nextCursor && (
        <button type="button" className="btn-outline btn-small comment-more" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? <span className="spinner spinner-ink" aria-label={t('popup.loading')} /> : t('social.loadMore')}
        </button>
      )}

      {error && <p className="comment-error" role="alert">{error}</p>}

      {user ? (
        <div className="comment-input-row comment-composer">
          <textarea
            className="comment-input"
            placeholder={t('social.writeComment')}
            aria-label={t('social.writeComment')}
            value={draft}
            maxLength={1000}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
          />
          <button type="button" className="btn-primary btn-send" onClick={send} disabled={sending || !draft.trim()}>
            {sending ? <span className="spinner spinner-ink" aria-label={t('popup.sending')} /> : t('popup.send')}
          </button>
        </div>
      ) : (
        <button type="button" className="btn-outline btn-small comment-login" onClick={() => navigate('/login')}>
          {t('social.signInToComment')}
        </button>
      )}
    </div>
  );
}

function CommentItem({ comment, threadId, spotId, me, onPatch, onRemove, onReplied }) {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState(null); // 'edit' | 'reply' | null
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [reporting, setReporting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const mine =Boolean(me) && comment.username === me;

  if (comment.deleted) {
    return <p className="comment-item comment-deleted">{t('social.commentDeleted')}</p>;
  }

  const toggleLike = async () => {
    if (!me) return;
    const liked = !comment.likedByMe;
    // Optimistic: the heart reacts at once and is put back if the request fails
    onPatch(comment.id, (c) => ({ likedByMe: liked, likeCount: c.likeCount + (liked ? 1 : -1) }));
    try {
      const res = liked ? await api.post(`/comments/${comment.id}/like`) : await api.delete(`/comments/${comment.id}/like`);
      onPatch(comment.id, () => ({ likedByMe: res.data.liked, likeCount: res.data.likes }));
    } catch {
      onPatch(comment.id, (c) => ({ likedByMe: !liked, likeCount: c.likeCount + (liked ? -1 : 1) }));
    }
  };

  const open = (next) => {
    setError(null);
    setText(next === 'edit' ? comment.content : '');
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
    } catch (err) {
      setError(apiErrorText(err, t, COMMENT_ERRORS));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setConfirmingDelete(false);
    try {
      await api.delete(`/comments/${comment.id}`);
      onRemove(comment);
    } catch (err) {
      setError(apiErrorText(err, t));
    }
  };

  const starLabel = (n) => `${n} / 5`;
  const author = comment.authorDeleted ? t('social.deletedUser') : comment.username || t('common.user');

  return (
    <div className="comment-item">
      <div className="comment-head">
        <Avatar username={comment.username} url={comment.avatarUrl} size={28} />
        {comment.authorDeleted || !comment.username
          ? <strong className="comment-author is-deleted">{author}</strong>
          : <Link className="comment-author" to={`/u/${encodeURIComponent(comment.username)}`}>{author}</Link>}
        {comment.rating > 0 && <StarRating value={comment.rating} size={14} label={starLabel} />}
        <span className="comment-time">
          {timeAgo(comment.createdAt, i18n.language)}
          {comment.editedAt && ` · ${t('social.edited')}`}
        </span>
      </div>

      {mode === 'edit'
        ? null
        : <p className="comment-text">{comment.content}</p>}

      <div className="comment-actions">
        <button type="button" className={`comment-action${comment.likedByMe ? ' is-on' : ''}`} onClick={toggleLike}
                disabled={!me} aria-pressed={comment.likedByMe} aria-label={t('social.like')}>
          <HeartIcon size={16} filled={comment.likedByMe} />
          {comment.likeCount > 0 && <span>{comment.likeCount}</span>}
        </button>
        {me && (
          <button type="button" className="comment-action" onClick={() => open('reply')} aria-expanded={mode === 'reply'}>
            <ReplyIcon size={16} />
            <span>{t('social.reply')}</span>
          </button>
        )}
        {me && !mine && !comment.authorDeleted && (
          <button type="button" className="comment-action" onClick={() => setReporting(true)} aria-label={t('report.title')}>
            <FlagIcon size={16} />
          </button>
        )}
        {mine && (
          <>
            <button type="button" className="comment-action" onClick={() => open('edit')} aria-label={t('social.edit')}>
              <EditIcon size={16} />
            </button>
            <button type="button" className="comment-action" onClick={() => setConfirmingDelete(true)} aria-label={t('social.delete')}>
              <TrashIcon size={16} />
            </button>
          </>
        )}
      </div>

      {mode && (
        <div className="comment-input-row">
          <textarea
            className="comment-input"
            autoFocus
            rows={2}
            maxLength={1000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={mode === 'reply' ? t('social.replyingTo', { username: author }) : ''}
            aria-label={mode === 'reply' ? t('social.replyingTo', { username: author }) : t('social.edit')}
          />
          <button type="button" className="btn-dark btn-send" onClick={submit} disabled={busy || !text.trim()}>
            {busy ? <span className="spinner spinner-ink" aria-label={t('popup.sending')} /> : mode === 'edit' ? t('social.save') : t('popup.send')}
          </button>
        </div>
      )}
      {error && <p className="comment-error" role="alert">{error}</p>}
      {reporting && (
        <ReportSheet endpoint={`/comments/${comment.id}/reports`} subject={author} onClose={() => setReporting(false)} />
      )}
      {confirmingDelete && (
        <ConfirmSheet
          danger
          title={t('social.deleteCommentConfirm')}
          confirmLabel={t('social.delete')}
          onConfirm={remove}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
