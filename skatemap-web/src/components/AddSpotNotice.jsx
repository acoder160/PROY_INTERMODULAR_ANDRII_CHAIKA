import { useTranslation } from 'react-i18next';
import Sheet from './Sheet';

// Where the app is published (store page, APK or marketing site). Set it at build time.
const APP_DOWNLOAD_URL = import.meta.env.VITE_APP_DOWNLOAD_URL?.trim() || '';

// Spots are created in the mobile app, which has the camera and the GPS the check needs.
export default function AddSpotNotice({ open, onClose }) {
  const { t } = useTranslation();
  const footer = APP_DOWNLOAD_URL ? (
    <a className="btn-primary btn-grow" href={APP_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">
      <span className="btn-label">{t('addSpot.mobileOnly.get')}</span>
    </a>
  ) : (
    // Sin enlace de descarga no hay nada que pulsar: un botón desactivado parece un fallo, así que solo se cierra
    <button type="button" className="btn-outline btn-grow" onClick={onClose}>
      <span className="btn-label">{t('common.ok')}</span>
    </button>
  );
  return (
    <Sheet open={open} onClose={onClose} title={t('addSpot.mobileOnly.title')} footer={footer}>
      <p className="detail-desc">{t('addSpot.mobileOnly.body')}</p>
    </Sheet>
  );
}
