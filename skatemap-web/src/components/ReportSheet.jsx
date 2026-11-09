import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import Sheet from './Sheet';
import { ChoicePill } from './PaintBits';
import { AlertCircleIcon, CheckCircleIcon, FlagIcon } from './Icons';

// Mismas razones que el backend (ReportReason) y que skatemap-mobile/components/ReportModal.tsx
const REPORT_REASONS =['SPAM', 'INAPPROPRIATE', 'FAKE', 'WRONG_LOCATION', 'DANGEROUS', 'OTHER'];
const MAX_COMMENT = 300;

const errorKey = (error) => {
  const code = error.response?.data?.code;
  if (code === 'already_reported' || error.response?.status === 409) return 'report.already';
  if (code === 'own_spot') return 'report.own';
  if (error.response?.status === 429) return 'report.tooMany';
  return 'report.failed';
};

// Hoja "Denunciar": razón obligatoria + detalle opcional. La revisión (IA + admin) va en segundo plano.
export default function ReportSheet({ spot, onClose }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const reasonsId = useId();
  const commentId = useId();
  const [reason, setReason] = useState(null);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent
  const [error, setError] = useState(null);

  useEffect(() => {
    if (status !== 'sent') return undefined;
    const timer = setTimeout(onClose, 2200);
    return () => clearTimeout(timer);
  }, [status, onClose]);

  const submit = async () => {
    if (!reason || status !== 'idle') return;
    setStatus('sending');
    setError(null);
    try {
      await api.post(`/spots/${spot.id}/reports`, { reason, comment: comment.trim() || null });
      setStatus('sent');
    } catch (err) {
      setError(t(errorKey(err)));
      setStatus('idle');
    }
  };

  const footer = !user ? (
    <button type="button" className="btn-primary btn-grow" onClick={() => { onClose(); navigate('/login'); }}>
      {t('common.login')}
    </button>
  ) : status === 'sent' ? null : (
    <button
      type="button"
      className="btn-primary btn-grow"
      onClick={submit}
      disabled={!reason || status === 'sending'}
      aria-busy={status === 'sending'}
    >
      {status === 'sending'
        ? <span className="spinner spinner-ink" aria-label={t('popup.sending')} />
        : <><FlagIcon size={20} /><span className="btn-label">{t('report.send')}</span></>}
    </button>
  );

  return (
    <Sheet open onClose={onClose} title={t('report.title')} footer={footer} className="report-sheet">
      <p className="report-subtitle">{t('report.subtitle', { name: spot.name || t('webview.unnamed') })}</p>

      {!user ? (
        <p className="report-text">{t('report.loginText')}</p>
      ) : status === 'sent' ? (
        <div className="notice notice-success" role="status">
          <CheckCircleIcon size={20} />
          <span>{t('report.sent')}</span>
        </div>
      ) : (
        <>
          <h3 className="sheet-section-title" id={reasonsId}>{t('report.reasonLabel')}</h3>
          <div className="report-reasons" role="radiogroup" aria-labelledby={reasonsId}>
            {REPORT_REASONS.map((r) => (
              <ChoicePill
                key={r}
                display={false}
                selected={reason === r}
                onClick={() => setReason(r)}
                label={t(`report.reasons.${r}`)}
              />
            ))}
          </div>

          <label className="sheet-section-title report-comment-label" htmlFor={commentId}>{t('report.commentLabel')}</label>
          <textarea
            id={commentId}
            className="comment-input report-comment"
            rows={3}
            maxLength={MAX_COMMENT}
            placeholder={t('report.commentPlaceholder')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <p className="report-counter" aria-live="polite">{comment.length} / {MAX_COMMENT}</p>

          {error && (
            <div className="notice notice-error" role="alert">
              <AlertCircleIcon size={20} />
              <span>{error}</span>
            </div>
          )}
        </>
      )}

      <a className="report-legal-link" href="/legal" target="_blank" rel="noopener">
        {t('report.howItWorks')}
      </a>
    </Sheet>
  );
}
