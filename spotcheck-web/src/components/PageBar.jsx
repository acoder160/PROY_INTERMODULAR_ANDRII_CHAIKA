import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon } from './Icons';

/** Asphalt bar of the social pages: back to the map, title, optional actions on the right. */
export default function PageBar({ title, children }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <header className="admin-bar social-bar">
      <button type="button" className="bar-pill" onClick={() => navigate('/map')} aria-label={t('admin.backToMap')}>
        <ArrowLeftIcon size={20} />
        <span className="bar-pill-text bar-hide-narrow">{t('social.map')}</span>
      </button>
      <h1 className="admin-title social-title">{title}</h1>
      <div className="social-bar-actions">{children}</div>
    </header>
  );
}
