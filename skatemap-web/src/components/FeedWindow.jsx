import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import Sheet from './Sheet';
import Avatar from './Avatar';
import SpotCard from './SpotCard';
import SignInPrompt from './SignInPrompt';
import { StarRating } from './PaintBits';
import { timeAgo } from '../utils/social';
import { formatSessionTime } from '../utils/live';
import '../Social.css';

/**
 * What the people you follow have been doing: new spots, comments, first ratings.
 * A window over the map, so the visitor never leaves it. Mount it only while it is open: each opening loads fresh.
 */
export default function FeedWindow({ onClose }) {
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
    api.get('/feed')
      .then((res) => { if (!cancelled) { setItems(res.data.items); setNextCursor(res.data.nextCursor); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [user]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await api.get('/feed', { params: { before: nextCursor } });
      setItems((prev) => [...prev, ...res.data.items]);
      setNextCursor(res.data.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={t('social.feed')} variant="window">
      <div className="social-main in-window">
        {!authLoading && !user && <SignInPrompt onSignIn={() => navigate('/login')} />}
        {user && !items && !failed && <span className="spinner spinner-ink spinner-center" aria-label={t('popup.loading')} />}
        {failed && <p className="social-empty">{t('social.loadFailed')}</p>}
        {items?.length === 0 && <p className="social-empty">{t('social.feedEmpty')}</p>}

        <ol className="social-list feed-list">
          {items?.map((item) => (
            <li key={item.id} className="feed-item">
              <Avatar username={item.actor.username} url={item.actor.avatarUrl} size={40} />
              <div className="feed-body">
                <p className="feed-line">
                  <Link to={`/u/${encodeURIComponent(item.actor.username)}`}>{item.actor.username}</Link>{' '}
                  {t(`social.activity.${item.type}`)}
                  {item.type === 'RATED' && item.rating > 0 && (
                    <StarRating value={item.rating} size={14} label={(n) => `${n} / 5`} />
                  )}
                  <span className="feed-time"> · {timeAgo(item.createdAt, i18n.language)}</span>
                </p>
                {item.comment && <blockquote className="feed-quote">{item.comment}</blockquote>}
                {item.session && <p className="feed-session">{formatSessionTime(item.session.startsAt, i18n.language)}</p>}
                {/* /map?spot=ID replaces the window's ?panel= param, so opening a spot also closes the window */}
                <SpotCard spot={item.spot} />
              </div>
            </li>
          ))}
        </ol>

        {nextCursor && (
          <button type="button" className="btn-outline btn-small social-more" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? <span className="spinner spinner-ink" aria-label={t('popup.loading')} /> : t('social.loadMore')}
          </button>
        )}
      </div>
    </Sheet>
  );
}
