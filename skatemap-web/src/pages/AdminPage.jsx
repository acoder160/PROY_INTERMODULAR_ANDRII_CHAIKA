import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { TypeChip, DifficultyMarks } from '../components/PaintBits';
import {
  AlertCircleIcon, CameraIcon, CheckCircleIcon, ChevronIcon, CloseIcon, FlagIcon, TrashIcon,
} from '../components/Icons';
import { cleanLabel } from '../utils/paint';
import '../MapChrome.css';
import '../Admin.css';

const FILTERS = ['REPORTED', 'NEW', 'HIDDEN', 'ALL'];
const COUNT_KEY = { REPORTED: 'reported', NEW: 'fresh', HIDDEN: 'hidden' };
const PAGE_SIZE = 20;
const UNDO_MS = 5000;

const fetchPage = (filter, page) =>
  api.get('/admin/moderation', { params: { filter, page, size: PAGE_SIZE } }).then((r) => r.data);

const isTyping = (target) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * Consola de moderación. Mismas decisiones que la baraja de la app móvil (app/admin.tsx):
 * → mantener, ← eliminar (con 5 s para deshacer), ↑ comentarios, P quitar foto, espacio saltar, Z deshacer.
 */
export default function AdminPage() {
  const { t, i18n } = useTranslation();
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  const [filter, setFilter] = useState('REPORTED');
  const [counts, setCounts] = useState(null);
  const [items, setItems] = useState(null); // null = cargando
  const [pageInfo, setPageInfo] = useState({ page: 0, totalPages: 0 });
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [toast, setToast] = useState(null); // { kind: 'success'|'error'|'undo', text }
  const pendingRef = useRef(null); // { item, index, run, timer }
  const toastTimer = useRef(null);

  const showToast = useCallback((next) => {
    clearTimeout(toastTimer.current);
    setToast(next);
    if (next.kind !== 'undo') toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const refreshCounts = useCallback(() => {
    api.get('/admin/moderation/counts').then((r) => setCounts(r.data)).catch(() => {});
  }, []);

  const applyPage = useCallback((data, append) => {
    setLoadFailed(false);
    setItems((prev) => (append && prev ? [...prev, ...data.items] : data.items));
    setPageInfo({ page: data.page, totalPages: data.totalPages });
    if (!append) setSelectedId(data.items[0]?.id ?? null);
  }, []);

  const failPage = useCallback((append) => {
    setLoadFailed(true);
    if (!append) setItems([]);
  }, []);

  const loadPage = useCallback((which, page, append) => fetchPage(which, page)
    .then((data) => applyPage(data, append))
    .catch(() => failPage(append)), [applyPage, failPage]);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let cancelled = false;
    fetchPage(filter, 0)
      .then((data) => { if (!cancelled) applyPage(data, false); })
      .catch(() => { if (!cancelled) failPage(false); });
    api.get('/admin/moderation/counts')
      .then((r) => { if (!cancelled) setCounts(r.data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isAdmin, filter, applyPage, failPage]);

  // Ejecuta ya la acción pendiente (otra decisión, cambio de pestaña o salir de la página)
  const flushPending = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    pending.run();
  }, []);

  useEffect(() => () => flushPending(), [flushPending]);

  const selectedIndex = items ? items.findIndex((i) => i.id === selectedId) : -1;
  const selected = selectedIndex >= 0 ? items[selectedIndex] : null;

  // Saca el spot de la lista y selecciona el siguiente
  const takeOut = useCallback((id) => {
    const index = items.findIndex((i) => i.id === id);
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    setSelectedId(next[Math.min(index, next.length - 1)]?.id ?? null);
    setShowComments(false);
  }, [items]);

  const putBack = useCallback((item, index) => {
    setItems((prev) => {
      const next = [...(prev ?? [])];
      next.splice(Math.min(index, next.length), 0, item);
      return next;
    });
    setSelectedId(item.id);
  }, []);

  const patchItem = useCallback((id, patch) => {
    setItems((prev) => prev?.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const failed = useCallback((item, index) => {
    if (item) putBack(item, index);
    showToast({ kind: 'error', text: t('admin.actionFailed') });
  }, [putBack, showToast, t]);

  const keep = useCallback(async (item) => {
    flushPending();
    const index = items.findIndex((i) => i.id === item.id);
    if (filter === 'ALL') patchItem(item.id, { status: 'VISIBLE', photoStatus: 'OK', reportCount: 0, reports: [], reportScore: 0 });
    else takeOut(item.id);
    try {
      await api.post(`/admin/spots/${item.id}/keep`);
      showToast({ kind: 'success', text: t('admin.kept') });
      refreshCounts();
    } catch {
      failed(filter === 'ALL' ? null : item, index);
    }
  }, [items, filter, flushPending, patchItem, takeOut, showToast, refreshCounts, failed, t]);

  // Eliminar el spot o su foto: desaparece al momento y se envía tras 5 s, salvo que se deshaga
  const destructive = useCallback((item, kind) => {
    flushPending();
    const index = items.findIndex((i) => i.id === item.id);
    takeOut(item.id);
    const run = async () => {
      setToast(null);
      try {
        if (kind === 'photo') await api.post(`/admin/spots/${item.id}/photo`, { action: 'remove' });
        else await api.post(`/admin/spots/${item.id}/remove`, { reason: null });
        refreshCounts();
      } catch {
        failed(item, index);
      }
    };
    pendingRef.current = { item, index, run, timer: setTimeout(() => flushPending(), UNDO_MS) };
    showToast({ kind: 'undo', text: kind === 'photo' ? t('admin.photoRemoved') : t('admin.removed') });
  }, [items, flushPending, takeOut, refreshCounts, failed, showToast, t]);

  const undo = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    putBack(pending.item, pending.index);
    setToast(null);
  }, [putBack]);

  const restorePhoto = useCallback(async (item) => {
    try {
      await api.post(`/admin/spots/${item.id}/photo`, { action: 'restore' });
      patchItem(item.id, { photoStatus: 'OK' });
      refreshCounts();
    } catch {
      showToast({ kind: 'error', text: t('admin.actionFailed') });
    }
  }, [patchItem, refreshCounts, showToast, t]);

  const skip = useCallback((item) => {
    if (items.length < 2) return;
    const index = items.findIndex((i) => i.id === item.id);
    const next = [...items.filter((i) => i.id !== item.id), item];
    setItems(next);
    setSelectedId(next[index]?.id ?? next[0].id);
    setShowComments(false);
  }, [items]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || isTyping(event.target)) return;
      if (document.querySelector('.sheet-overlay')) return;
      // event.code: la tecla física, así Z y P funcionan también con teclado ruso, árabe, etc.
      const key = event.code;
      if (key === 'KeyZ') { event.preventDefault(); undo(); return; }
      if (!selected) return;
      if (key === 'ArrowRight') { event.preventDefault(); keep(selected); }
      else if (key === 'ArrowLeft') { event.preventDefault(); destructive(selected, 'spot'); }
      else if (key === 'ArrowUp') { event.preventDefault(); setShowComments((v) => !v); }
      else if (key === 'ArrowDown' || key === 'Space') { event.preventDefault(); skip(selected); }
      else if (key === 'KeyP' && selected.mediaUrl && selected.photoStatus !== 'HIDDEN') { event.preventDefault(); destructive(selected, 'photo'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, keep, destructive, skip, undo]);

  // Lista vacía pero quedan páginas: los spots decididos ya salieron de la cola, así que la página 0 trae nuevos
  useEffect(() => {
    if (!items || items.length > 0 || pageInfo.page + 1 >= pageInfo.totalPages) return undefined;
    let cancelled = false;
    fetchPage(filter, 0)
      .then((data) => { if (!cancelled) applyPage(data, false); })
      .catch(() => { if (!cancelled) failPage(false); });
    return () => { cancelled = true; };
  }, [items, pageInfo, filter, applyPage, failPage]);

  const dateFormat = useMemo(() => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }), [i18n.language]);

  if (loading) return <div className="admin-page admin-loading"><span className="spinner spinner-ink" /></div>;
  if (!isAdmin) return <Navigate to="/map" />;

  const changeFilter = (next) => {
    if (next === filter) return;
    flushPending();
    setItems(null);
    setShowComments(false);
    setFilter(next);
  };

  return (
    <div className="admin-page">
      <header className="admin-bar">
        <h1 className="admin-title">{t('admin.moderation')}</h1>
        <button type="button" className="bar-pill bar-pill-account" onClick={() => navigate('/map')}>
          <span className="bar-pill-text">{t('admin.backToMap')}</span>
        </button>
      </header>

      <nav className="admin-tabs" aria-label={t('admin.moderation')}>
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`admin-tab${filter === f ? ' is-active' : ''}`}
            aria-pressed={filter === f}
            onClick={() => changeFilter(f)}
          >
            <span>{t(`admin.tabs.${f}`)}</span>
            {counts && COUNT_KEY[f] && counts[COUNT_KEY[f]] > 0 && (
              <span className={`admin-tab-count${f === 'REPORTED' ? ' is-hot' : ''}`}>{counts[COUNT_KEY[f]]}</span>
            )}
          </button>
        ))}
      </nav>

      <main className="admin-layout">
        <aside className="admin-list" aria-label={t(`admin.tabs.${filter}`)}>
          {items === null ? (
            <span className="spinner spinner-ink spinner-center" aria-label={t('popup.loading')} />
          ) : items.length === 0 ? (
            <p className="admin-empty">{loadFailed ? t('admin.loadFailed') : t('admin.empty')}</p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`admin-row${item.id === selectedId ? ' is-selected' : ''}`}
                    aria-current={item.id === selectedId}
                    onClick={() => { setSelectedId(item.id); setShowComments(false); }}
                  >
                    <span className="admin-thumb">
                      {item.mediaUrl ? <img src={item.mediaUrl} alt="" loading="lazy" /> : <CameraIcon size={20} />}
                    </span>
                    <span className="admin-row-text">
                      <strong>{item.name}</strong>
                      <span className="admin-row-meta">
                        {item.reportCount > 0 && <span className="admin-score">{item.reportScore} / {item.reportThreshold}</span>}
                        {item.status === 'HIDDEN' && <span className="admin-flag">{t('admin.status.HIDDEN')}</span>}
                        {item.photoStatus === 'HIDDEN' && <span className="admin-flag">{t('admin.status.PHOTO_HIDDEN')}</span>}
                        {item.reportCount === 0 && item.status !== 'HIDDEN' && item.photoStatus !== 'HIDDEN' && (
                          <span>{t('admin.by', { user: item.createdBy })}</span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {items && pageInfo.page + 1 < pageInfo.totalPages && (
            <button type="button" className="btn-outline btn-small admin-more" onClick={() => loadPage(filter, pageInfo.page + 1, true)}>
              {t('admin.loadMore')}
            </button>
          )}
        </aside>

        <section className="admin-detail" aria-live="polite">
          {selected ? (
            <ModerationCard
              key={selected.id}
              item={selected}
              position={selectedIndex + 1}
              total={items.length}
              dateFormat={dateFormat}
              showComments={showComments}
              onToggleComments={() => setShowComments((v) => !v)}
              onKeep={() => keep(selected)}
              onRemove={() => destructive(selected, 'spot')}
              onRemovePhoto={() => destructive(selected, 'photo')}
              onRestorePhoto={() => restorePhoto(selected)}
              onSkip={() => skip(selected)}
              onCommentDeleted={() => patchItem(selected.id, { commentCount: Math.max(0, selected.commentCount - 1) })}
            />
          ) : null}
        </section>
      </main>

      {toast && (
        <div className={`admin-toast admin-toast-${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
          {toast.kind === 'success' && <CheckCircleIcon size={20} />}
          {toast.kind === 'error' && <AlertCircleIcon size={20} />}
          <span>{toast.text}</span>
          {toast.kind === 'undo' && (
            <button type="button" className="admin-toast-undo" onClick={undo}>{t('admin.undo')}</button>
          )}
        </div>
      )}
    </div>
  );
}

function ModerationCard({
  item, position, total, dateFormat, showComments, onToggleComments,
  onKeep, onRemove, onRemovePhoto, onRestorePhoto, onSkip, onCommentDeleted,
}) {
  const { t } = useTranslation();
  const [imageFailed, setImageFailed] = useState(false);
  const type = (item.spotType || 'STREET').toUpperCase();
  const difficulty = (item.difficultyLevel || 'INTERMEDIATE').toUpperCase();
  const reasons = Object.entries(item.reasons || {});
  const formatDate = (value) => (value ? dateFormat.format(new Date(value)) : '');

  return (
    <article className="mod-card">
      <div className="mod-media">
        {item.mediaUrl && !imageFailed ? (
          <img src={item.mediaUrl} alt="" onError={() => setImageFailed(true)} />
        ) : (
          <div className="mod-media-empty"><CameraIcon size={40} /></div>
        )}
        {item.photoStatus === 'HIDDEN' && <span className="mod-media-label">{t('admin.status.PHOTO_HIDDEN')}</span>}
        <span className="mod-position">{position} / {total}</span>
      </div>

      <div className="mod-body">
        <h2 className="mod-title">{item.name}</h2>
        <div className="mod-facts">
          <TypeChip type={type} label={t(`types.${type}`, { defaultValue: type })} />
          <DifficultyMarks level={difficulty} label={t(`difficulty.${difficulty}`, { defaultValue: difficulty })} />
          {item.status === 'HIDDEN' && <span className="admin-flag">{t('admin.status.HIDDEN')}</span>}
        </div>
        <p className="mod-meta">
          {t('admin.by', { user: item.createdBy })} · {formatDate(item.createdAt)}
          {item.latitude != null && (
            <> · <a href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`} target="_blank" rel="noopener noreferrer">{t('admin.openMap')}</a></>
          )}
        </p>
        {item.description && <p className="mod-desc">{item.description}</p>}

        <div className={`mod-ai mod-ai-${(item.aiVerdict || 'NONE').toLowerCase()}`}>
          <h3>{t('admin.aiVerdict')}</h3>
          {item.aiVerdict ? (
            <>
              <p className="mod-ai-verdict">{t(`admin.verdict.${item.aiVerdict}`)}</p>
              {item.aiReason && <p className="mod-ai-reason">{item.aiReason}</p>}
            </>
          ) : (
            <p className="mod-ai-reason">{t('admin.aiNone')}</p>
          )}
        </div>

        {item.reportCount > 0 && (
          <section className="mod-reports">
            <h3>
              <FlagIcon size={18} />
              <span>{t('admin.reportsCount', { count: item.reportCount })}</span>
              <span className="admin-score">{item.reportScore} / {item.reportThreshold}</span>
            </h3>
            <div className="mod-reasons">
              {reasons.map(([reason, n]) => (
                <span key={reason} className="mod-reason">{t(`report.reasons.${reason}`)} × {n}</span>
              ))}
            </div>
            <ul className="mod-report-list">
              {item.reports.map((r) => (
                <li key={r.id}>
                  <span className="mod-report-head">
                    <strong>{r.reporter}</strong>
                    <span>{t(`report.reasons.${r.reason}`)}</span>
                    <span>{formatDate(r.createdAt)}</span>
                    {r.weight < 1 && <span className="mod-weight">{t('admin.weight', { weight: r.weight })}</span>}
                  </span>
                  {r.comment && <q>{r.comment}</q>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <button type="button" className="accordion-header" onClick={onToggleComments} aria-expanded={showComments}>
          <span>{t('admin.commentsCount', { count: item.commentCount })}</span>
          <ChevronIcon up={showComments} />
        </button>
        {showComments && <AdminComments spotId={item.id} onDeleted={onCommentDeleted} />}
      </div>

      <div className="mod-actions">
        <button type="button" className="mod-btn mod-btn-remove" onClick={onRemove} aria-keyshortcuts="ArrowLeft">
          <TrashIcon size={20} /><span>{t('admin.remove')}</span><kbd>←</kbd>
        </button>
        {item.photoStatus === 'HIDDEN' ? (
          <button type="button" className="mod-btn" onClick={onRestorePhoto}>
            <CameraIcon size={20} /><span>{t('admin.restorePhoto')}</span>
          </button>
        ) : item.mediaUrl ? (
          <button type="button" className="mod-btn" onClick={onRemovePhoto} aria-keyshortcuts="P">
            <CameraIcon size={20} /><span>{t('admin.removePhoto')}</span><kbd>P</kbd>
          </button>
        ) : null}
        <button type="button" className="mod-btn mod-btn-ghost" onClick={onSkip} aria-keyshortcuts="Space">
          <span>{t('admin.skip')}</span><kbd>␣</kbd>
        </button>
        <button type="button" className="mod-btn mod-btn-keep" onClick={onKeep} aria-keyshortcuts="ArrowRight">
          <CheckCircleIcon size={20} /><span>{t('admin.keep')}</span><kbd>→</kbd>
        </button>
      </div>
      <p className="mod-shortcuts">{t('admin.shortcuts')}</p>
    </article>
  );
}

function AdminComments({ spotId, onDeleted }) {
  const { t } = useTranslation();
  const [comments, setComments] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get(`/comments/spot/${spotId}`)
      .then((r) => { if (!cancelled) setComments(Array.isArray(r.data) ? r.data : []); })
      .catch(() => { if (!cancelled) { setFailed(true); setComments([]); } });
    return () => { cancelled = true; };
  }, [spotId]);

  const remove = async (comment) => {
    if (!window.confirm(t('admin.confirmDeleteComment'))) return;
    try {
      await api.delete(`/admin/comments/${comment.id}`);
      setComments((prev) => prev.filter((c) => c.id !== comment.id));
      onDeleted();
    } catch {
      setFailed(true);
    }
  };

  if (comments === null) return <span className="spinner spinner-ink spinner-center" aria-label={t('popup.loading')} />;
  return (
    <div className="comments-list">
      {failed && <p className="no-comments">{t('admin.actionFailed')}</p>}
      {comments.length === 0 && !failed && <p className="no-comments">{t('admin.noComments')}</p>}
      {comments.map((c) => (
        <div key={c.id} className="comment-item mod-comment">
          <div className="comment-head">
            <strong>{c.username || t('common.user')}</strong>
            <button type="button" className="mod-comment-delete" onClick={() => remove(c)} aria-label={cleanLabel(t('admin.deleteComment'))}>
              <CloseIcon size={16} />
            </button>
          </div>
          <p className="comment-text">{c.content}</p>
        </div>
      ))}
    </div>
  );
}
