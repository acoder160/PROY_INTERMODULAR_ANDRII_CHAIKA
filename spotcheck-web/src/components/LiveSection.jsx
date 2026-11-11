import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import ConfirmSheet from './ConfirmSheet';
import { apiErrorText } from '../utils/social';
import { formatSessionTime } from '../utils/live';

// <input type="datetime-local"> wants local "YYYY-MM-DDTHH:mm"
const toLocalInput = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/**
 * Live part of the spot sheet: who is skating here now (with "I'm here" on site) and the planned
 * sessions. {@code liveCount} comes from the map's live socket; when it changes, the list reloads.
 */
export default function LiveSection({ spot, liveCount, onClose }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [live, setLive] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [cancelling, setCancelling] = useState(null); // the session whose cancel is being confirmed

  useEffect(() => {
    let cancelled = false;
    api.get(`/spots/${spot.id}/live`).then((res) => { if (!cancelled) setLive(res.data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [spot.id, liveCount, user]);

  useEffect(() => {
    let cancelled = false;
    api.get(`/spots/${spot.id}/sessions`).then((res) => { if (!cancelled) setSessions(res.data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [spot.id, user, reloadKey]);

  const requireLogin = () => {
    onClose?.();
    navigate('/login');
  };

  const checkIn = () => {
    if (!user) { requireLogin(); return; }
    if (!navigator.geolocation) { setError(t('live.needLocation')); return; }
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await api.post(`/spots/${spot.id}/checkin`, { latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          setLive(res.data);
        } catch (err) {
          setError(apiErrorText(err, t));
        } finally {
          setBusy(false);
        }
      },
      () => { setError(t('live.needLocation')); setBusy(false); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  const leave = async () => {
    setBusy(true);
    try {
      await api.delete(`/spots/${spot.id}/checkin`);
      setLive((l) => l && { ...l, count: Math.max(0, l.count - 1), checkedInHere: false,
        skaters: l.skaters.filter((s) => s.username !== user?.username) });
    } finally {
      setBusy(false);
    }
  };

  const replaceSession = (updated) => setSessions((list) => list.map((s) => (s.id === updated.id ? updated : s)));

  const toggleJoin = async (session) => {
    if (!user) { requireLogin(); return; }
    try {
      const res = session.joinedByMe
        ? await api.delete(`/sessions/${session.id}/join`)
        : await api.post(`/sessions/${session.id}/join`);
      replaceSession(res.data);
    } catch (err) {
      setError(apiErrorText(err, t));
    }
  };

  const cancel = async (session) => {
    setCancelling(null);
    try {
      await api.delete(`/sessions/${session.id}`);
      setSessions((list) => list.filter((s) => s.id !== session.id));
    } catch (err) {
      setError(apiErrorText(err, t));
    }
  };

  const count = live?.count ?? liveCount;

  return (
    <section className="live-section" aria-label={t('live.title')}>
      <div className="live-now">
        <span className={`live-dot${count > 0 ? ' is-on' : ''}`} aria-hidden="true" />
        <p className="live-now-text">{count > 0 ? t('live.skatingNow', { count }) : t('live.nobody')}</p>
        {live?.checkedInHere ? (
          <button type="button" className="btn-outline btn-small" onClick={leave} disabled={busy}>{t('live.leave')}</button>
        ) : (
          <button type="button" className="btn-outline btn-small" onClick={checkIn} disabled={busy}>
            {busy ? <span className="spinner spinner-ink" aria-label={t('popup.loading')} /> : t('live.imHere')}
          </button>
        )}
      </div>
      {live?.skaters?.length > 0 && (
        <ul className="live-people">
          {live.skaters.map((s, i) => (
            <li key={s.username ?? `deleted-${i}`}>
              {s.username
                ? <Link to={`/u/${encodeURIComponent(s.username)}`} onClick={onClose} title={s.username}><Avatar username={s.username} url={s.avatarUrl} size={32} /></Link>
                : <Avatar username="?" size={32} />}
            </li>
          ))}
        </ul>
      )}

      <div className="live-sessions-head">
        <h3 className="live-title">{t('live.sessions')}</h3>
        {!planning && (
          <button type="button" className="btn-outline btn-small" onClick={() => (user ? setPlanning(true) : requireLogin())}>
            {t('live.planSession')}
          </button>
        )}
      </div>

      {planning && (
        <PlanSessionForm spotId={spot.id} onCancel={() => setPlanning(false)}
                         onCreated={() => { setPlanning(false); setReloadKey((k) => k + 1); }} />
      )}

      {sessions?.length === 0 && !planning && <p className="no-comments">{t('live.noSessions')}</p>}
      <ul className="live-session-list">
        {sessions?.map((s) => (
          <li key={s.id} className="live-session">
            <div className="live-session-main">
              <p className="live-session-time">{formatSessionTime(s.startsAt, i18n.language)}</p>
              {s.note && <p className="live-session-note">{s.note}</p>}
              <p className="live-session-meta">
                {s.host.username ? t('live.hostedBy', { username: s.host.username }) : t('social.deletedUser')}
                {' · '}{t('live.going', { count: s.participants })}
              </p>
            </div>
            {s.hostedByMe ? (
              <button type="button" className="btn-outline btn-small btn-danger" onClick={() => setCancelling(s)}>{t('live.cancelSession')}</button>
            ) : (
              <button type="button" className={s.joinedByMe ? 'btn-dark btn-small' : 'btn-outline btn-small'}
                      onClick={() => toggleJoin(s)} aria-pressed={s.joinedByMe}>
                {s.joinedByMe ? t('live.joined') : t('live.join')}
              </button>
            )}
          </li>
        ))}
      </ul>

      {error && <p className="comment-error" role="alert">{error}</p>}

      {cancelling && (
        <ConfirmSheet
          danger
          title={t('live.cancelConfirm')}
          confirmLabel={t('live.cancelSessionAction')}
          cancelLabel={t('live.keepSession')}
          onConfirm={() => cancel(cancelling)}
          onCancel={() => setCancelling(null)}
        />
      )}
    </section>
  );
}

/**
 * Plan a session at a spot, or (with `session`) change the time and note of one you host.
 * Used by the spot sheet and by "Active sessions" on your profile.
 */
export function PlanSessionForm({ spotId, session = null, onCancel, onCreated }) {
  const { t } = useTranslation();
  const now = new Date();
  const [when, setWhen] = useState(() => {
    if (session) return toLocalInput(new Date(session.startsAt));
    const d = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    return toLocalInput(d);
  });
  const [note, setNote] = useState(session?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = { startsAt: new Date(when).toISOString(), note };
      if (session) await api.patch(`/sessions/${session.id}`, body);
      else await api.post(`/spots/${spotId}/sessions`, body);
      onCreated();
    } catch (err) {
      setError(apiErrorText(err, t, { text_rejected: 'social.commentRejected' }));
      setSaving(false);
    }
  };

  return (
    <form className="social-form live-plan" onSubmit={submit}>
      <label className="social-label" htmlFor="session-when">{t('live.when')}</label>
      <input id="session-when" type="datetime-local" className="comment-input" value={when} required
             min={toLocalInput(now)} max={toLocalInput(new Date(now.getTime() + 30 * 86400000))}
             onChange={(e) => setWhen(e.target.value)} />
      <label className="social-label" htmlFor="session-note">{t('live.note')}</label>
      <input id="session-note" className="comment-input" value={note} maxLength={200}
             placeholder={t('live.notePlaceholder')} onChange={(e) => setNote(e.target.value)} />
      {error && <p className="comment-error" role="alert">{error}</p>}
      <div className="live-plan-actions">
        <button type="button" className="btn-outline btn-small" onClick={onCancel}>{t('common.cancel')}</button>
        <button type="submit" className="btn-dark btn-small" disabled={saving || !when}>
          {saving ? <span className="spinner spinner-ink" aria-label={t('popup.sending')} /> : session ? t('social.save') : t('live.create')}
        </button>
      </div>
    </form>
  );
}
