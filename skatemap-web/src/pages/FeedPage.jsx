import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import PageBar from '../components/PageBar';
import Avatar from '../components/Avatar';
import SpotCard from '../components/SpotCard';
import { StarRating } from '../components/PaintBits';
import { timeAgo } from '../utils/social';
import '../Social.css';

/** What the people you follow have been doing: new spots, comments, first ratings. */
export default function FeedPage() {
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
    <div className="admin-page social-page">
      <PageBar title={t('social.feed')} />
      <main className="social-main">
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
      </main>
    </div>
  );
}

export function SignInPrompt({ onSignIn }) {
  const { t } = useTranslation();
  return (
    <div className="social-empty">
      <p>{t('social.signInToSee')}</p>
      <button type="button" className="btn-primary btn-small" onClick={onSignIn}>{t('map.enter')}</button>
    </div>
  );
}
