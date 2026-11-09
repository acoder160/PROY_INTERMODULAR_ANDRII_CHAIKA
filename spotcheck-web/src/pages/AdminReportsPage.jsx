import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import PageBar from '../components/PageBar';
import { apiErrorText, timeAgo } from '../utils/social';
import '../MapChrome.css';
import '../Admin.css';
import '../Social.css';

/** Reports on comments and profiles (spot reports are in the moderation deck). */
export default function AdminReportsPage() {
  const { t, i18n } = useTranslation();
  const { isAdmin, loading } = useAuth();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    api.get('/admin/content-reports')
      .then((res) => setItems(res.data ?? []))
      .catch((err) => { setItems([]); setError(apiErrorText(err, t, {})); });
  }, [t]);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  if (loading) return <div className="admin-page admin-loading"><span className="spinner spinner-ink" /></div>;
  if (!isAdmin) return <Navigate to="/map" />;

  const resolve = async (id, action) => {
    setError(null);
    try {
      await api.post(`/admin/content-reports/${id}/resolve`, { action });
      setItems((list) => list.filter((r) => r.id !== id));
    } catch (err) {
      setError(apiErrorText(err, t, {}));
    }
  };

  return (
    <div className="admin-page social-page">
      <PageBar title={t('safety.queueTitle')}>
        <Link className="bar-pill" to="/admin"><span className="bar-pill-text">{t('admin.moderation')}</span></Link>
      </PageBar>
      <main className="social-main">
        {error && <p className="comment-error" role="alert">{error}</p>}
        {items === null && <div className="admin-loading"><span className="spinner spinner-ink" /></div>}
        {items?.length === 0 && <p className="social-hint">{t('safety.queueEmpty')}</p>}
        <ul className="social-list">
          {items?.map((r) => (
            <li key={r.id} className="comment-item">
              <p className="comment-head">
                <strong>{t(`safety.target.${r.targetType}`)}</strong>
                {r.targetUser && <> · <Link to={`/u/${encodeURIComponent(r.targetUser)}`}>{r.targetUser}</Link></>}
                {' · '}{t(`report.reasons.${r.reason}`)}
                <span className="comment-time"> · {t('safety.by', { username: r.reporter })} · {timeAgo(r.createdAt, i18n.language)}</span>
              </p>
              {r.preview && <p className="comment-text">{r.preview}</p>}
              {r.comment && <p className="social-hint">{r.comment}</p>}
              <div className="comment-actions">
                {r.targetType === 'COMMENT'
                  ? <button type="button" className="btn-outline btn-small" onClick={() => resolve(r.id, 'REMOVE')}>{t('safety.removeComment')}</button>
                  : <button type="button" className="btn-outline btn-small" onClick={() => resolve(r.id, 'CLEAR_PROFILE')}>{t('safety.clearProfile')}</button>}
                <button type="button" className="btn-outline btn-small" onClick={() => resolve(r.id, 'DISMISS')}>{t('safety.dismiss')}</button>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
