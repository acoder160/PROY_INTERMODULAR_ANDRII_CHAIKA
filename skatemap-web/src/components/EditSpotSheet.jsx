import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axiosConfig';
import Sheet from './Sheet';
import { apiErrorText } from '../utils/social';
import { cleanLabel } from '../utils/paint';

const TYPES = ['STREET', 'PARK', 'RAMPS', 'RAIL', 'LEDGE'];
const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

/** The author fixes texts, type or level. Location and photo stay: they were checked on site. */
export default function EditSpotSheet({ spot, onClose, onSaved }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: spot.name || '',
    description: spot.description || '',
    spotType: (spot.spotType || 'STREET').toUpperCase(),
    difficultyLevel: (spot.difficultyLevel || 'INTERMEDIATE').toUpperCase(),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await api.patch(`/spots/${spot.id}`, form);
      onSaved(res.data);
    } catch (err) {
      setError(apiErrorText(err, t));
      setSaving(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={t('social.editSpot')}>
      <form className="social-form" onSubmit={save}>
        <label className="social-label" htmlFor="edit-spot-name">{t('form.name')}</label>
        <input id="edit-spot-name" className="comment-input" value={form.name} onChange={set('name')} maxLength={100} required />

        <label className="social-label" htmlFor="edit-spot-desc">{cleanLabel(t('form.description'))}</label>
        <textarea id="edit-spot-desc" className="comment-input" value={form.description} onChange={set('description')} maxLength={2000} rows={3} />

        <label className="social-label" htmlFor="edit-spot-type">{t('form.type')}</label>
        <select id="edit-spot-type" className="comment-input" value={form.spotType} onChange={set('spotType')}>
          {TYPES.map((type) => <option key={type} value={type}>{t(`types.${type}`, { defaultValue: type })}</option>)}
        </select>

        <label className="social-label" htmlFor="edit-spot-level">{t('form.level')}</label>
        <select id="edit-spot-level" className="comment-input" value={form.difficultyLevel} onChange={set('difficultyLevel')}>
          {LEVELS.map((level) => <option key={level} value={level}>{t(`difficulty.${level}`, { defaultValue: level })}</option>)}
        </select>

        {error && <p className="comment-error" role="alert">{error}</p>}
        <button type="submit" className="btn-primary" disabled={saving || !form.name.trim()}>
          {saving ? <span className="spinner spinner-ink" aria-label={t('popup.sending')} /> : t('social.save')}
        </button>
      </form>
    </Sheet>
  );
}
