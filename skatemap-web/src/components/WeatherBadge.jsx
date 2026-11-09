import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axiosConfig';
import { DropIcon, RainIcon, SunIcon } from './Icons';

const ICONS = { DRY: SunIcon, WET: DropIcon, RAIN: RainIcon };

// "Is it skateable right now?": dry / wet / raining at the spot. Hidden when the weather is unavailable.
export default function WeatherBadge({ spotId }) {
  const { t } = useTranslation();
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get(`/spots/${spotId}/weather`)
      .then((res) => { if (!cancelled) setWeather(res.data); })
      .catch(() => {}); // a 503 or no network: no badge is better than an error
    return () => { cancelled = true; };
  }, [spotId]);

  const Icon = weather && ICONS[weather.condition];
  if (!Icon) return null;
  const label = t(`weather.${weather.condition}`);
  const temp = typeof weather.temperatureC === 'number' ? ` · ${Math.round(weather.temperatureC)}°` : '';
  return (
    <p
      className={`weather-badge ${weather.condition === 'DRY' ? 'is-dry' : 'is-wet'}`}
      aria-label={`${t('weather.label')}: ${label}${temp}`}
    >
      <Icon size={18} />
      <span>{label}{temp}</span>
    </p>
  );
}
