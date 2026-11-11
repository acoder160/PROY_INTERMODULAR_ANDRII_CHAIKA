import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import Sheet from './Sheet';
import { TypeChip, DifficultyMarks, StarRating, PaintStrip } from './PaintBits';
import { CameraIcon, NavigateIcon, CheckCircleIcon, AlertCircleIcon, ChevronIcon, FlagIcon, BookmarkIcon, ShareIcon, EditIcon, TrashIcon } from './Icons';
import CommentSection from './CommentSection';
import EditSpotSheet from './EditSpotSheet';
import ConfirmSheet from './ConfirmSheet';
import LiveSection from './LiveSection';
import WeatherBadge from './WeatherBadge';
import { apiErrorText, shareSpot } from '../utils/social';
import { cleanLabel, directionsUrl, haversineKm } from '../utils/paint';
import useIsPhone from '../utils/useIsPhone';

// Hoja de detalle: equivale a spotcheck-mobile/components/SpotDetailsModal.tsx.
// El padre la monta con key={spot.id}, así el estado se reinicia al cambiar de spot.
export default function SpotDetailsSheet({ spot, onClose, onSpotUpdated, onSpotDeleted, onReport, isFavorite, onToggleFavorite, liveCount = 0, userLocation }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isLoggedIn = Boolean(user);

  const [commentCount, setCommentCount] = useState(null); // null until the comments have loaded
  const [editing, setEditing] = useState(false);
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
  // On phones the sheet first "peeks" (the map and the spot stay visible above it); the handle opens it fully
  const isPhone = useIsPhone();
  const [peek, setPeek] = useState(true);
  const [confirm, setConfirm] = useState(null); // null | 'delete' | 'login': in-app questions instead of window.confirm
  const [showLive, setShowLive] = useState(liveCount > 0); // folded unless someone is skating here right now
  const isOwner = isLoggedIn && spot?.createdBy === user?.username;
  const [imageFailed, setImageFailed] = useState(false);
  const inputRef = useRef(null);
  const spotId = spot?.id;

  useEffect(() => {
    if (spotId === undefined || !isLoggedIn) return undefined;
    let cancelled = false;
    api.get(`/ratings/check/${spotId}`)
      .then((res) => {
        if (cancelled || !(res.data?.value > 0)) return;
        setMyRating(res.data.value);
        setHasVoted(true);
      })
      .catch(() => { /* sin voto previo */ });
    return () => { cancelled = true; };
  }, [spotId, isLoggedIn]);

  const onCountChange = useCallback((count) => setCommentCount(count), []);

  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = setTimeout(() => setSuccessMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  if (!spot) return null;

  const reload = () => setReloadKey((k) => k + 1);


  const share = async () => {
    const result = await shareSpot(spot);
    if (result === 'copied') setSuccessMessage(t('social.linkCopied'));
  };

  const deleteSpot = async () => {
    setConfirm(null);
    try {
      await api.delete(`/spots/${spot.id}`);
      onSpotDeleted?.(spot.id);
      onClose();
    } catch (err) {
      setErrorMessage(apiErrorText(err, t));
    }
  };

  const goToLogin = () => {
    onClose();
    navigate('/login');
  };

  const handleStarPress = (star) => {
    if (!isLoggedIn) {
      setConfirm('login');
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
      ariaLabel={spot.name || t('webview.unnamed')}
      peek={peek}
      onPeekChange={isPhone ? setPeek : null}
      className="detail-sheet"
      heroActions={onToggleFavorite && (
        <button
          type="button"
          className={`sheet-close${isFavorite ? ' is-on' : ''}`}
          onClick={() => onToggleFavorite(spot.id)}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? t('social.saved') : t('social.save')}
          title={isFavorite ? t('social.saved') : t('social.save')}
        >
          <BookmarkIcon size={20} filled={isFavorite} />
        </button>
      )}
    >
      <h2 className="detail-title">{spot.name || t('webview.unnamed')}</h2>
      <PaintStrip className="detail-strip" />
      {spot.createdBy && !spot.createdBy.startsWith('deleted_') && (
        <p className="detail-author">
          {t('social.addedBy')}{' '}
          <Link to={`/u/${encodeURIComponent(spot.createdBy)}`} onClick={onClose}>{spot.createdBy}</Link>
        </p>
      )}

      {/* The decision first: what it is, how far, how good, and the one pink button to go there */}
      <div className="detail-facts">
        <div className="detail-facts-left">
          <TypeChip type={spotType} label={t(`types.${spotType}`, { defaultValue: spotType })} />
          <DifficultyMarks level={difficulty} label={t(`difficulty.${difficulty}`, { defaultValue: difficulty })} />
        </div>
        {distanceText && <span className="detail-distance">{distanceText}</span>}
      </div>

      <div className="rating-box">
        <span className="rating-number">{avgRating.toFixed(1)}</span>
        <div>
          <StarRating value={Math.round(avgRating)} size={22} label={starLabel} />
          <p className="rating-caption">{t('popup.averageRating', { value: avgRating.toFixed(1) })}</p>
        </div>
      </div>

      <a className="btn-primary detail-directions" href={directionsUrl(spot)} target="_blank" rel="noopener noreferrer">
        <NavigateIcon size={22} />
        <span>{t('popup.directions')}</span>
      </a>

      <WeatherBadge spotId={spot.id} />

      {spot.description && <p className="detail-desc">{spot.description}</p>}

      <div className="detail-actions is-secondary">
        <button type="button" className="btn-outline btn-small" onClick={share}>
          <ShareIcon size={18} />
          <span>{t('social.share')}</span>
        </button>
        {isOwner && (
          <>
            <button type="button" className="btn-outline btn-small" onClick={() => setEditing(true)} aria-label={t('social.editSpot')}>
              <EditIcon size={18} />
            </button>
            <button type="button" className="btn-outline btn-small" onClick={() => setConfirm('delete')} aria-label={t('social.deleteSpot')}>
              <TrashIcon size={18} />
            </button>
          </>
        )}
      </div>

      <button
        type="button"
        className="accordion-header"
        onClick={() => setShowLive((v) => !v)}
        aria-expanded={showLive}
      >
        <span className="accordion-title">
          {t('live.title')}
          {liveCount > 0 && <span className="count-chip">{liveCount}</span>}
        </span>
        <ChevronIcon up={showLive} />
      </button>
      {/* Mounted while folded too, so the sessions and the count are already loaded when it opens */}
      <div hidden={!showLive}>
        <LiveSection spot={spot} liveCount={liveCount} onClose={onClose} />
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
          <button type="button" className="btn-dark btn-send" onClick={handleSendReview} disabled={isSubmitting}>
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
        <span>{commentCount === null ? t('social.commentsCount') : t('popup.comments', { count: commentCount })}</span>
        <ChevronIcon up={showComments} />
      </button>

      {/* Mounted while folded too, so the header can show the count */}
      <div hidden={!showComments}>
        <CommentSection spotId={spot.id} reloadKey={reloadKey} onCountChange={onCountChange} />
      </div>

      {onReport && (
        <button type="button" className="detail-report" onClick={() => onReport(spot.id)}>
          <FlagIcon size={16} />
          <span>{t('report.title')}</span>
        </button>
      )}

      {confirm === 'delete' && (
        <ConfirmSheet
          danger
          title={t('social.deleteSpot')}
          message={t('social.deleteSpotConfirm')}
          confirmLabel={t('social.delete')}
          onConfirm={deleteSpot}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'login' && (
        <ConfirmSheet
          title={t('auth.loginRequiredTitle')}
          message={t('auth.loginRequiredRate')}
          confirmLabel={t('common.login')}
          onConfirm={() => { setConfirm(null); goToLogin(); }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {editing && (
        <EditSpotSheet
          spot={spot}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); setSuccessMessage(t('social.saved')); onSpotUpdated?.(); }}
        />
      )}
    </Sheet>
  );
}
