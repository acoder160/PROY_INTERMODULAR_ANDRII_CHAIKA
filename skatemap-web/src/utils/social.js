import api from '../api/axiosConfig';

// The API runs on its own origin ("https://api.example.com/api" → "https://api.example.com")
export const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace(/\/api\/?$/, '');

/** Share link: the backend serves a link preview (Open Graph) and sends people on to the map. */
export const shareUrl = (spotId) => `${API_ORIGIN}/s/${spotId}`;

/**
 * Shares with the system sheet where there is one (phones), otherwise copies the link.
 * Returns 'shared', 'copied' or null (cancelled / not possible).
 */
export async function shareSpot(spot) {
  const url = shareUrl(spot.id);
  if (navigator.share) {
    try {
      await navigator.share({ title: spot.name, url });
      return 'shared';
    } catch {
      return null;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return null;
  }
}

/** The API sends LocalDateTime without a zone; the server runs on UTC. */
const parseServerDate = (value) => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);

/** "5 min ago", "yesterday"... in the UI language. */
export function timeAgo(value, lang) {
  if (!value) return '';
  const seconds = Math.round((parseServerDate(value).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lang || undefined, { numeric: 'auto', style: 'short' });
  const steps = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(0, 'second');
}

export const formatMonthYear = (value, lang) =>
  value ? parseServerDate(value).toLocaleDateString(lang || undefined, { month: 'long', year: 'numeric' }) : '';

/**
 * Uploads a photo straight to Cloudinary with parameters the backend signed for this user
 * (format, size and folder are part of the signature, so they must be sent unchanged).
 */
export async function uploadImage(file) {
  const { data } = await api.get('/cloudinary/signature');
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', data.api_key);
  form.append('timestamp', data.timestamp);
  form.append('signature', data.signature);
  Object.entries(data.params || {}).forEach(([key, value]) => form.append(key, value));
  const response = await fetch(`https://api.cloudinary.com/v1_1/${data.cloud_name}/image/upload`, { method: 'POST', body: form });
  if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
  return (await response.json()).secure_url;
}

/**
 * Error text from an API failure: the translation of its code ("photo_rejected" → errors.photoRejected)
 * when there is one, else the server's English message. {@code overrides} maps a code to another key,
 * e.g. text_rejected on a comment should not talk about "the name or description".
 */
export function apiErrorText(error, t, overrides = {}) {
  const data = error?.response?.data;
  const code = data?.code;
  if (code && overrides[code]) return t(overrides[code]);
  if (code) {
    const key = `errors.${code.replace(/_([a-z])/g, (_, c) => c.toUpperCase())}`;
    const text = t(key, { defaultValue: '' });
    if (text) return text;
  }
  if (typeof data?.message === 'string') return data.message;
  if (typeof data === 'string') return data;
  return t('popup.sendErrorConnection');
}
