import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import Sheet from './Sheet';
import Avatar from './Avatar';
import SignInPrompt from './SignInPrompt';
import { timeAgo } from '../utils/social';
import '../Social.css';

/**
 * Follows, comments on your spots, replies and likes, in a window over the map. Opening it marks them as read
 * (`onRead` lets the map clear its unread badge). Mount it only while it is open.
 */
export default function NotificationsWindow({ onClose, onRead }) {
  const { t, i18n } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    api.get('/notifications')
      .then((res) => {
        if (cancelled) return;
        setItems(res.data.items);
        setNextCursor(res.data.nextCursor);
        // Shown once as unread (the dot), then cleared on the server
        if (res.data.unread > 0) {
          api.post('/notifications/read').then(() => onRead?.()).catch(() => {});
        }
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [user, onRead]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await api.get('/notifications', { params: { before: nextCursor } });
      setItems((prev) => [...prev, ...res.data.items]);
      setNextCursor(res.data.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  };

  // Both targets leave ?panel= behind: a spot replaces it (the map opens the spot), a profile is another page
  const open = (n) => {
    if (n.type === 'FOLLOW' && n.actor.username) navigate(`/u/${encodeURIComponent(n.actor.username)}`);
    else if (n.spot) navigate(`/map?spot=${n.spot.id}`);
  };

  return (
    <Sheet open onClose={onClose} title={t('social.notifications')} variant="window">
      <div className="social-main in-window">
        {!authLoading && !user && <SignInPrompt onSignIn={() => navigate('/login')} />}
        {user && !items && !failed && <span className="spinner spinner-ink spinner-center" aria-label={t('popup.loading')} />}
        {failed && <p className="social-empty">{t('social.loadFailed')}</p>}
        {items?.length === 0 && <p className="social-empty">{t('social.notificationsEmpty')}</p>}

        <ul className="social-list">
          {items?.map((n) => {
            const actor = n.actor.deleted ? t('social.deletedUser') : n.actor.username;
            return (
              <li key={n.id}>
                <button type="button" className={`notif-row${n.read ? '' : ' is-unread'}`} onClick={() => open(n)}>
                  <Avatar username={n.actor.username} url={n.actor.avatarUrl} size={40} />
                  <span className="notif-body">
                    <span className="notif-line">
                      {n.type !== 'SESSION_REMINDER' && <><strong>{actor}</strong>{' '}</>}
                      {t(`social.notif.${n.type}`, { spot: n.spot?.name ?? '' })}
                    </span>
                    {n.comment && <span className="notif-quote">{n.comment}</span>}
                    <span className="feed-time">{timeAgo(n.createdAt, i18n.language)}</span>
                  </span>
                  {!n.read && <span className="notif-dot" aria-label={t('social.unread')} />}
                </button>
              </li>
            );
          })}
        </ul>

        {nextCursor && (
          <button type="button" className="btn-outline btn-small social-more" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? <span className="spinner spinner-ink" aria-label={t('popup.loading')} /> : t('social.loadMore')}
          </button>
        )}
      </div>
    </Sheet>
  );
}
