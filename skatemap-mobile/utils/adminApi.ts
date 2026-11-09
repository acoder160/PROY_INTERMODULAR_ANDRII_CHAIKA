import api from './api';

/** Moderation API (admins only; the backend checks the role on every call). */

export type ModerationFilter = 'REPORTED' | 'NEW' | 'HIDDEN' | 'ALL';

export interface ReportItem {
  id: number;
  reason: string;
  comment: string | null;
  reporter: string;
  createdAt: string;
  status: string;
  weight: number;
}

export interface ModerationItem {
  id: number;
  name: string;
  description: string | null;
  spotType: string;
  difficultyLevel: string;
  mediaUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  createdBy: string;
  createdAt: string | null;
  status: 'VISIBLE' | 'HIDDEN';
  photoStatus: 'OK' | 'HIDDEN';
  reviewedAt: string | null;
  aiVerdict: 'VIOLATION' | 'OK' | 'UNSURE' | null;
  aiReason: string | null;
  reportScore: number;
  reportThreshold: number;
  reportCount: number;
  reasons: Record<string, number>;
  reports: ReportItem[];
  commentCount: number;
  surfaceRating: number;
}

export interface ModerationPage {
  items: ModerationItem[];
  page: number;
  totalPages: number;
  total: number;
}

export interface ModerationCounts {
  reported: number;
  fresh: number;
  hidden: number;
}

export interface SpotComment {
  id: number;
  content: string;
  username: string;
  createdAt: string;
  rating?: number | null;
}

export const fetchQueue = (filter: ModerationFilter, page = 0, size = 20) =>
  api.get<ModerationPage>('/admin/moderation', { params: { filter, page, size } }).then((r) => r.data);

export const fetchCounts = () => api.get<ModerationCounts>('/admin/moderation/counts').then((r) => r.data);

export const keepSpot = (id: number) => api.post(`/admin/spots/${id}/keep`);

export const removeSpot = (id: number, reason?: string) => api.post(`/admin/spots/${id}/remove`, { reason: reason ?? null });

export const removePhoto = (id: number) => api.post(`/admin/spots/${id}/photo`, { action: 'remove' });

export const restorePhoto = (id: number) => api.post(`/admin/spots/${id}/photo`, { action: 'restore' });

export const fetchComments = (spotId: number) =>
  api.get<SpotComment[]>(`/comments/spot/${spotId}`).then((r) => (Array.isArray(r.data) ? r.data : []));

export const deleteComment = (commentId: number) => api.delete(`/admin/comments/${commentId}`);
