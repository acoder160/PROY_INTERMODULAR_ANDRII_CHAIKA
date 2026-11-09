import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import PageBar from '../components/PageBar';
import SpotCard from '../components/SpotCard';
import SignInPrompt from '../components/SignInPrompt';
import '../Social.css';

export default function SavedPage() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [spots, setSpots] = useState(null);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    api.get('/favorites/spots')
      .then((res) => { if (!cancelled) setSpots(res.data); })
      .catch(() => { if (!cancelled) setSpots([]); });
    return () => { cancelled = true; };
  }, [user]);

  return (
    <div className="admin-page social-page">
      <PageBar title={t('social.savedSpots')} />
      <main className="social-main">
        {!authLoading && !user && <SignInPrompt onSignIn={() => navigate('/login')} />}
        {user && !spots && <span className="spinner spinner-ink spinner-center" aria-label={t('popup.loading')} />}
        {spots?.length === 0 && <p className="social-empty">{t('social.savedEmpty')}</p>}
        <section className="social-list">
          {spots?.map((spot) => <SpotCard key={spot.id} spot={spot} />)}
        </section>
      </main>
    </div>
  );
}
