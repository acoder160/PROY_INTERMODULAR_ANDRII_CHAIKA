import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { CloseIcon } from './Icons';
import { PaintStrip } from './PaintBits';
import { cleanLabel } from '../utils/paint';

/**
 * Hoja inferior blanca sobre velo de asfalto (como los Modal de la app móvil).
 * En pantallas anchas queda centrada con un ancho máximo. Esc o clic en el velo la cierran.
 * Con varias hojas abiertas (detalle + denuncia) Esc solo cierra la de arriba.
 * `heroActions`: botones extra que van junto a la X sobre la foto (p. ej. denunciar).
 */
export default function Sheet({ open, onClose, title, children, footer, className = '', hero = null, closeOnHero = false, heroActions = null }) {
  const { t } = useTranslation();
  const overlayRef = useRef(null);
  const panelRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    panelRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      const overlays = document.querySelectorAll('.sheet-overlay');
      if (overlays[overlays.length - 1] !== overlayRef.current) return;
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previous instanceof HTMLElement && document.contains(previous)) previous.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const closeButton = (
    <button type="button" className="sheet-close" onClick={onClose} aria-label={cleanLabel(t('form.close'))}>
      <CloseIcon size={22} />
    </button>
  );

  return createPortal(
    <div ref={overlayRef} className="sheet-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={panelRef}
        className={`sheet ${hero ? 'has-hero' : ''} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
      >
        {hero ? (
          <div className="sheet-scroll">
            {closeOnHero && (
              <div className="sheet-hero-actions">
                {heroActions}
                {closeButton}
              </div>
            )}
            {hero}
            <div className="sheet-body">{children}</div>
          </div>
        ) : (
          <>
            <div className="sheet-header">
              <h2 id={titleId} className="sheet-title">{title}</h2>
              {closeButton}
            </div>
            <PaintStrip className="sheet-strip" />
            <div className="sheet-scroll sheet-body">{children}</div>
          </>
        )}
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
