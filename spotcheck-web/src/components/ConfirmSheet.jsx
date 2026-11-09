import { useTranslation } from 'react-i18next';
import Sheet from './Sheet';

/**
 * In-app replacement for window.confirm: a small window over the page, in the product's own type and paint.
 * Mount it only while the question is open; Esc, the scrim and the X all answer "no".
 */
export default function ConfirmSheet({ title, message, confirmLabel, cancelLabel, danger = false, onConfirm, onCancel }) {
  const { t } = useTranslation();
  const footer = (
    <>
      <button type="button" className="btn-outline btn-grow" onClick={onCancel}>{cancelLabel ?? t('common.cancel')}</button>
      <button type="button" className={`${danger ? 'btn-danger-solid' : 'btn-dark'} btn-grow`} onClick={onConfirm}>{confirmLabel}</button>
    </>
  );
  return (
    <Sheet open onClose={onCancel} title={title} footer={footer} variant="window" className="confirm-sheet">
      {message && <p className="detail-desc confirm-message">{message}</p>}
    </Sheet>
  );
}
