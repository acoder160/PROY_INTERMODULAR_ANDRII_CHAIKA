import type { TFunction } from 'i18next';
import { API_BASE_URL } from '../constants/api';

/** Share link: the backend serves a link preview (Open Graph) and sends people on to the web map. */
export const shareUrl = (spotId: number) => `${API_BASE_URL}/s/${spotId}`;

/** The API sends LocalDateTime without a zone; the server runs on UTC. */
const parseServerDate = (value: string) =>
  new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);

const STEPS: [Intl.RelativeTimeFormatUnit, number, string][] = [
  ['year', 31536000, 'y'], ['month', 2592000, 'mo'], ['week', 604800, 'w'],
  ['day', 86400, 'd'], ['hour', 3600, 'h'], ['minute', 60, 'min'],
];

/** "5 min ago" in the app language; compact "5min" where the engine has no RelativeTimeFormat. */
export function timeAgo(value: string | null | undefined, lang?: string): string {
  if (!value) return '';
  const seconds = Math.round((parseServerDate(value).getTime() - Date.now()) / 1000);
  const hasRtf = typeof Intl !== 'undefined' && typeof (Intl as any).RelativeTimeFormat === 'function';
  for (const [unit, size, short] of STEPS) {
    if (Math.abs(seconds) >= size) {
      const amount = Math.round(seconds / size);
      if (hasRtf) {
        try {
          return new Intl.RelativeTimeFormat(lang, { numeric: 'auto', style: 'short' }).format(amount, unit);
        } catch { /* fall through */ }
      }
      return `${Math.abs(amount)}${short}`;
    }
  }
  if (hasRtf) {
    try { return new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }).format(0, 'second'); } catch { /* fall through */ }
  }
  return '0min';
}

export function formatMonthYear(value: string | null | undefined, lang?: string): string {
  if (!value) return '';
  try {
    return parseServerDate(value).toLocaleDateString(lang, { month: 'long', year: 'numeric' });
  } catch {
    return parseServerDate(value).getFullYear().toString();
  }
}

/**
 * Error text from an API failure: the translation of its code ("photo_rejected" → errors.photoRejected)
 * when there is one, else the server's English message. {@code overrides} maps a code to another key.
 */
export function apiErrorText(error: any, t: TFunction, overrides: Record<string, string> = {}): string {
  const data = error?.response?.data;
  const code: string | undefined = data?.code;
  if (code && overrides[code]) return t(overrides[code]);
  if (code) {
    const key = `errors.${code.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase())}`;
    const text = t(key, { defaultValue: '' });
    if (text) return text;
  }
  if (typeof data?.message === 'string') return data.message;
  if (typeof data === 'string') return data;
  return t('popup.sendErrorConnection');
}

export interface SpotSummary {
  id: number;
  name: string;
  mediaUrl?: string | null;
  spotType?: string;
  latitude?: number;
  longitude?: number;
}

export interface UserSummary {
  username: string | null;
  avatarUrl?: string | null;
  deleted?: boolean;
}
