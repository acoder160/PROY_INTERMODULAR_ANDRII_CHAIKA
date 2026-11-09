import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import Sheet from './Sheet';
import { TypeChip, DifficultyMarks, StarRating, PaintStrip } from './PaintBits';
import { CameraIcon, NavigateIcon, CheckCircleIcon, AlertCircleIcon, ChevronIcon, RefreshIcon, FlagIcon } from './Icons';
import { cleanLabel, directionsUrl, haversineKm } from '../utils/paint';

// Hoja de detalle: equivale a skatemap-mobile/components/SpotDetailsModal.tsx.
// El padre la monta con key={spot.id}, así el estado se reinicia al cambiar de spot.
export default function SpotDetailsSheet({ spot, onClose, onSpotUpdated, onReport, userLocation }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isLoggedIn = Boolean(user);

  const [comments, setComments] = useState([]);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [commentsFailed, setCommentsFailed] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [currentRating, setCurrentRating] = useState(0);
  const [avgRating, setAvgRating] = useState(spot?.surfaceRating || 0);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const inputRef = useRef(null);
  const spotId = spot?.id;

  useEffect(() => {
    if (spotId === undefined) return undefined;
    let cancelled = false;
    (async () => {
      if (isLoggedIn) {
        try {
          const res = await api.get(`/ratings/check/${spotId}`);
          if (cancelled) return;
          if (res.data && res.data.value > 0) {
            setMyRating(res.data.value);
            setHasVoted(true);
          }
        } catch { /* sin voto previo */ }
      }
      try {
        const res = await api.get(`/comments/spot/${spotId}`);
        if (cancelled) return;
        setComments(Array.isArray(res.data) ? res.data : []);
        setCommentsFailed(false);
      } catch {
        if (!cancelled) setCommentsFailed(true);
      } finally {
        if (!cancelled) setIsLoadingComments(false);
      }
    })();
    return () => { cancelled = true; };
  }, [spotId, isLoggedIn, reloadKey]);

  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = setTimeout(() => setSuccessMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  if (!spot) return null;

  const reload = () => {
    setIsLoadingComments(true);
    setReloadKey((k) => k + 1);
  };

  const goToLogin = () => {
    onClose();
    navigate('/login');
  };

  const handleStarPress = (star) => {
    if (!isLoggedIn) {
      if (window.confirm(`${t('auth.loginRequiredTitle')}\n\n${t('auth.loginRequiredRate')}`)) goToLogin();
      return;
    }
    setCurrentRating(star);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSendReview = async () => {
    if (!isLoggedIn) { goToLogin(); return; }
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const response = await api.post(`/ratings/${spot.id}`, { value: currentRating });
      if (newComment.trim().length > 0) {
        await api.post(`/comments/${spot.id}`, { content: newComment });
      }
      setHasVoted(true);
      setMyRating(currentRating);
      setSuccessMessage(t('popup.thanks'));
      if (response.data && response.data.newAverage) setAvgRating(response.data.newAverage);
      reload();
      onSpotUpdated?.();
      setShowComments(true);
    } catch (error) {
      const msg = error.response?.data?.message || error.response?.data;
      setErrorMessage(typeof msg === 'string' ? msg : t('popup.sendErrorConnection'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const spotType = (spot.spotType || spot.type || 'STREET').toUpperCase();
  const difficulty = (spot.difficultyLevel || 'INTERMEDIATE').toUpperCase();
  const distanceKm = userLocation ? haversineKm(userLocation.lat, userLocation.lng, spot.latitude, spot.longitude) : null;
  const distanceText = distanceKm === null ? null : distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`;
  const starLabel = (n) => `${n} / 5`;

  const hero = spot.mediaUrl && !imageFailed ? (
    <img className="detail-image" src={spot.mediaUrl} alt="" onError={() => setImageFailed(true)} />
  ) : (
    <div className="detail-image detail-image-empty" role="img" aria-label={t('popup.noImage')}>
      <CameraIcon size={36} />
    </div>
  );

  return (
    <Sheet
      open
      onClose={onClose}
      hero={hero}
      closeOnHero
      className="detail-sheet"
      heroActions={onReport && (
        <button type="button" className="sheet-close" onClick={() => onReport(spot.id)} aria-label={t('report.title')} title={t('report.title')}>
          <FlagIcon size={20} />
        </button>
      )}
    >
      <h2 className="detail-title">{spot.name || t('webview.unnamed')}</h2>
      <PaintStrip className="detail-strip" />

      <div className="detail-facts">
        <div className="detail-facts-left">
          <TypeChip type={spotType} label={t(`types.${spotType}`, { defaultValue: spotType })} />
          <DifficultyMarks level={difficulty} label={t(`difficulty.${difficulty}`, { defaultValue: difficulty })} />
        </div>
        {distanceText && <span className="detail-distance">{distanceText}</span>}
      </div>

      {spot.description && <p className="detail-desc">{spot.description}</p>}

      <a className="btn-primary detail-directions" href={directionsUrl(spot)} target="_blank" rel="noopener noreferrer">
        <NavigateIcon size={22} />
        <span>{t('popup.directions')}</span>
      </a>

      <div className="rating-box">
        <span className="rating-number">{avgRating.toFixed(1)}</span>
        <div>
          <StarRating value={Math.round(avgRating)} size={22} label={starLabel} />
          <p className="rating-caption">{t('popup.averageRating', { value: avgRating.toFixed(1) })}</p>
        </div>
      </div>

      <div className="rate-box">
        <p className="rate-label">
          {hasVoted ? t('popup.yourVote') : isLoggedIn ? t('popup.rateSpot') : t('popup.rateSpotTap')}
        </p>
        {hasVoted
          ? <StarRating value={myRating} label={starLabel} />
          : <StarRating value={currentRating} onChange={handleStarPress} label={starLabel} />}
      </div>

      {successMessage && (
        <div className="notice notice-success" role="status">
          <CheckCircleIcon size={20} />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="notice notice-error" role="alert">
          <AlertCircleIcon size={20} />
          <span>{errorMessage}</span>
        </div>
      )}

      {!hasVoted && currentRating > 0 && (
        <div className="comment-input-row">
          <textarea
            ref={inputRef}
            className="comment-input"
            placeholder={t('popup.opinionPlaceholder')}
            aria-label={cleanLabel(t('popup.opinionPlaceholder'))}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={2}
          />
          <button type="button" className="btn-primary btn-send" onClick={handleSendReview} disabled={isSubmitting}>
            {isSubmitting ? <span className="spinner spinner-ink" aria-label={t('popup.sending')} /> : t('popup.send')}
          </button>
        </div>
      )}

      <button
        type="button"
        className="accordion-header"
        onClick={() => setShowComments((v) => !v)}
        aria-expanded={showComments}
      >
        <span>{t('popup.comments', { count: comments.length })}</span>
        <ChevronIcon up={showComments} />
      </button>

      {showComments && (
        <div className="comments-list">
          {isLoadingComments ? (
            <span className="spinner spinner-ink spinner-center" aria-label={t('popup.loading')} />
          ) : (
            <>
              {commentsFailed ? (
                <div className="comments-failed" role="status">
                  <p className="no-comments">{t('popup.commentsFailed')}</p>
                  <button type="button" className="btn-outline btn-small" onClick={reload}>
                    <RefreshIcon size={18} />
                    <span>{t('common.retry')}</span>
                  </button>
                </div>
              ) : (
                comments.length === 0 && <p className="no-comments">{cleanLabel(t('popup.firstComment'))}</p>
              )}
              {comments.map((c, index) => (
                <div key={c.id ?? index} className="comment-item">
                  <div className="comment-head">
                    <strong>{c.username || t('common.user')}</strong>
                    {c.rating > 0 && <StarRating value={c.rating} size={14} label={starLabel} />}
                  </div>
                  <p className="comment-text">{c.content}</p>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
