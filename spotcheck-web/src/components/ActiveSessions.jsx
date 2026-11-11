import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axiosConfig';
import Avatar from './Avatar';
import Sheet from './Sheet';
import ConfirmSheet from './ConfirmSheet';
import { PlanSessionForm } from './LiveSection';
import { EditIcon, TrashIcon } from './Icons';
import { apiErrorText } from '../utils/social';
import { formatSessionTime } from '../utils/live';

/**
 * "Active sessions" on your own profile: the ones you host (who is coming, edit, cancel) and the
 * ones you joined. Editing or cancelling tells everyone who joined, through their notifications.
 */
export default function ActiveSessions({ reloadKey }) {
  const { t, i18n } = useTranslation();
  const [sessions, setSessions] = useState([]);
  const [editing, setEditing] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [error, setError] = useState(null);
  const [localKey, setLocalKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.get('/users/me/sessions')
      .then((res) => { if (!cancelled) setSessions(res.data ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [reloadKey, localKey]);

  const cancelSession = async (s) => {
    setCancelling(null);
    setError(null);
    try {
      await api.delete(`/sessions/${s.id}`);
      setSessions((list) => list.filter((x) => x.id !== s.id));
    } catch (err) {
      setError(apiErrorText(err, t));
    }
  };

  if (sessions.length === 0) return null;

  // For your own sessions the list of who is coming leaves you out
  const coming = (s) => (s.hostedByMe ? s.people.filter((p) => p.username !== s.host.username) : s.people);

  return (
    <section className="my-sessions" aria-labelledby="active-sessions-title">
      <h2 id="active-sessions-title" className="my-sessions-title">{t('live.activeSessions')}</h2>
      {sessions.map((s) => (
        <article key={s.id} className="active-session">
          <Link className="active-session-head" to={`/map?spot=${s.spotId}`}>
            <span className="my-session-text">
              <strong className="my-session-time">{formatSessionTime(s.startsAt, i18n.language)}</strong>
              <span className="my-session-spot">{s.spotName || t('webview.unnamed')}</span>
              {s.note && <span className="active-session-note">{s.note}</span>}
            </span>
            <span className={`my-session-tag${s.hostedByMe ? ' is-host' : ''}`}>
              {s.hostedByMe ? t('live.hosting') : t('live.joined')}
            </span>
          </Link>

          <div className="active-session-people">
            {coming(s).map((p, i) => (
              <Avatar key={p.username ?? `gone-${i}`} username={p.username} url={p.avatarUrl} size={28} />
            ))}
            <span className="my-session-meta">
              {s.hostedByMe
                ? (s.participants > 1 ? t('live.othersGoing', { count: s.participants - 1 }) : t('live.nobodyYet'))
                : t('live.going', { count: s.participants })}
            </span>
          </div>

          {s.hostedByMe && (
            <div className="active-session-actions">
              <button type="button" className="btn-outline btn-small" onClick={() => setEditing(s)}>
                <EditIcon size={18} />
                <span>{t('social.edit')}</span>
              </button>
              <button type="button" className="btn-outline btn-small btn-danger-outline" onClick={() => setCancelling(s)}>
                <TrashIcon size={18} />
                <span>{t('live.cancelSessionAction')}</span>
              </button>
            </div>
          )}
        </article>
      ))}
      {error && <p className="comment-error" role="alert">{error}</p>}

      {editing && (
        <Sheet open onClose={() => setEditing(null)} title={t('live.editSession')}>
          <p className="my-session-spot">{editing.spotName || t('webview.unnamed')}</p>
          {editing.participants > 1 && <p className="my-session-meta">{t('live.editNotice')}</p>}
          <PlanSessionForm
            spotId={editing.spotId}
            session={editing}
            onCancel={() => setEditing(null)}
            onCreated={() => { setEditing(null); setLocalKey((k) => k + 1); }}
          />
        </Sheet>
      )}
      {cancelling && (
        <ConfirmSheet
          danger
          title={t('live.cancelConfirm')}
          message={cancelling.participants > 1 ? t('live.cancelNotice') : undefined}
          confirmLabel={t('live.cancelSessionAction')}
          cancelLabel={t('live.keepSession')}
          onConfirm={() => cancelSession(cancelling)}
          onCancel={() => setCancelling(null)}
        />
      )}
    </section>
  );
}
