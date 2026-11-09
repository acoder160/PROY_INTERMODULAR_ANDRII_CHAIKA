import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TypeChip } from './PaintBits';
import { CameraIcon } from './Icons';

/** Small spot card for profiles, the feed and saved spots; opens the spot on the map. */
export default function SpotCard({ spot }) {
  const { t } = useTranslation();
  if (!spot) return null;
  const type = (spot.spotType || 'STREET').toUpperCase();
  const thumb = spot.mediaUrl?.includes('/image/upload/')
    ? spot.mediaUrl.replace('/image/upload/', '/image/upload/c_fill,w_240,h_180,q_auto/')
    : spot.mediaUrl;
  return (
    <Link className="spot-card" to={`/map?spot=${spot.id}`}>
      {thumb
        ? <img className="spot-card-img" src={thumb} alt="" loading="lazy" />
        : <span className="spot-card-img spot-card-empty"><CameraIcon size={22} /></span>}
      <span className="spot-card-body">
        <span className="spot-card-name">{spot.name || t('webview.unnamed')}</span>
        <TypeChip type={type} label={t(`types.${type}`, { defaultValue: type })} />
      </span>
    </Link>
  );
}
