import { useTranslation } from 'react-i18next';
import Sheet from './Sheet';
import { ChoicePill } from './PaintBits';
import { StarIcon } from './Icons';
import { SPOT_TYPE_PAINT, DEFAULT_FILTERS, cleanLabel } from '../utils/paint';

const TYPES = ['ALL', 'STREET', 'PARK', 'RAMPS', 'RAIL', 'LEDGE'];
const DISTANCES = [0, 1, 5, 10];
const RATINGS = [0, 3, 4];

// Mismas opciones y orden que spotcheck-mobile/components/FilterModal.tsx
export default function FilterSheet({ open, onClose, filters, setFilters, resultCount, countPending = false, hasLocation }) {
  const { t, i18n } = useTranslation();
  const isDefault =
    filters.spotType === DEFAULT_FILTERS.spotType &&
    filters.maxDistance === DEFAULT_FILTERS.maxDistance &&
    filters.minRating === DEFAULT_FILTERS.minRating;
  // No data yet (server waking or unreachable): "0" would read as "no spots exist"
  const count = countPending ? '…' : new Intl.NumberFormat(i18n.language).format(resultCount);

  const footer = (
    <>
      <button
        type="button"
        className="btn-outline"
        onClick={() => setFilters(DEFAULT_FILTERS)}
        disabled={isDefault}
      >
        {t('filters.reset')}
      </button>
      <button
        type="button"
        className="btn-primary btn-grow"
        onClick={onClose}
        aria-label={countPending ? t('filters.applyResults') : `${t('filters.applyResults')}: ${count}`}
      >
        <span className="btn-label">{t('filters.applyResults')}</span>
        <span className="count-chip">{count}</span>
      </button>
    </>
  );

  return (
    <Sheet open={open} onClose={onClose} title={t('filters.title')} footer={footer}>
      <h3 className="sheet-section-title" id="filter-type">{t('filters.spotType')}</h3>
      <div className="pill-row" role="radiogroup" aria-labelledby="filter-type">
        {TYPES.map((type) => (
          <ChoicePill
            key={type}
            selected={filters.spotType === type}
            onClick={() => setFilters({ ...filters, spotType: type })}
            label={type === 'ALL' ? t('filters.all') : t(`types.${type}`)}
            paint={type === 'ALL' ? undefined : SPOT_TYPE_PAINT[type]}
          />
        ))}
      </div>

      <h3 className="sheet-section-title" id="filter-distance">
        {hasLocation ? t('filters.maxDistance') : t('filters.maxDistanceGps')}
      </h3>
      <div className="pill-row" role="radiogroup" aria-labelledby="filter-distance">
        {DISTANCES.map((km) => (
          <ChoicePill
            key={km}
            selected={filters.maxDistance === km}
            disabled={km > 0 && !hasLocation}
            onClick={() => setFilters({ ...filters, maxDistance: km })}
            label={km === 0 ? t('filters.anyDistance') : t('filters.under', { km })}
          />
        ))}
      </div>

      <h3 className="sheet-section-title" id="filter-stars">{t('filters.minStars')}</h3>
      <div className="pill-row" role="radiogroup" aria-labelledby="filter-stars">
        {RATINGS.map((r) => (r === 0 ? (
          <ChoicePill
            key={r}
            selected={filters.minRating === 0}
            onClick={() => setFilters({ ...filters, minRating: 0 })}
            label={t('filters.allStars')}
          />
        ) : (
          <ChoicePill
            key={r}
            selected={filters.minRating === r}
            onClick={() => setFilters({ ...filters, minRating: r })}
            ariaLabel={cleanLabel(t('filters.starsOrMore', { n: r }))}
          >
            <span>{r}+</span>
            <StarIcon size={16} filled />
          </ChoicePill>
        )))}
      </div>

      {/* Legend: what the paint on the map means, and where the house rules live */}
      <p className="filter-legend">{t('filters.legend')}</p>
      <a className="report-legal-link" href="/legal">{t('legal.link')}</a>
    </Sheet>
  );
}
