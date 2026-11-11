import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ChevronIcon, CloseIcon } from './Icons';
import { PaintStrip } from './PaintBits';
import { cleanLabel } from '../utils/paint';

/**
 * Hoja inferior blanca sobre velo de asfalto (como los Modal de la app móvil).
 * En pantallas anchas queda centrada con un ancho máximo. Esc o clic en el velo la cierran.
 * Con varias hojas abiertas (detalle + denuncia) Esc solo cierra la de arriba.
 * `heroActions`: botones extra que van junto a la X sobre la foto (p. ej. denunciar).
 * `variant="window"`: ventana centrada sobre el mapa (feed, notificaciones) en vez de hoja pegada abajo.
 * `onPeekChange` + `peek`: hoja que "se asoma" (teléfono): sin velo, el mapa sigue visible y vivo, con un asa para
 * abrirla del todo (toque o deslizar arriba) o cerrarla (deslizar abajo). `peek` = true es la versión corta.
 */
export default function Sheet({ open, onClose, title, children, footer, className = '', hero = null, closeOnHero = false, heroActions = null, variant = 'sheet', peek = false, onPeekChange = null, ariaLabel }) {
  const { t } = useTranslation();
  const overlayRef = useRef(null);
  const panelRef = useRef(null);
  const dragStartY = useRef(null);
  const peekDrag = useRef(null); // { y, onControl } while a finger is down on the peeking sheet
  const titleId = useId();
  const peekable = typeof onPeekChange === 'function';

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    panelRef.current?.focus();
    // Hoja modal (no "peek"): el fondo no se desplaza y Tab no se escapa a la página de debajo
    const modal = !peekable;
    const previousOverflow = document.body.style.overflow;
    if (modal) document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      const overlays = document.querySelectorAll('.sheet-overlay');
      const isTop = overlays[overlays.length - 1] === overlayRef.current;
      if (event.key === 'Escape') {
        if (isTop) onClose();
        return;
      }
      if (event.key !== 'Tab' || !modal || !isTop || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) { event.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (modal) document.body.style.overflow = previousOverflow;
      if (previous instanceof HTMLElement && document.contains(previous)) previous.focus();
    };
  }, [open, onClose, peekable]);

  if (!open) return null;

  const closeButton = (
    <button
      type="button"
      className="sheet-close"
      onClick={(e) => {
        e.stopPropagation();
        onClose?.();
      }}
      aria-label={cleanLabel(t('form.close'))}
    >
      <CloseIcon size={22} />
    </button>
  );

  // Asa: toque alterna; deslizar arriba abre, abajo cierra la versión corta o la abierta (la pliega)
  const onHandleDown = (event) => {
    dragStartY.current = event.clientY;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onHandleUp = (event) => {
    if (dragStartY.current === null) return;
    const delta = event.clientY - dragStartY.current;
    dragStartY.current = null;
    if (delta < -30) onPeekChange(false);
    else if (delta > 30) { if (peek) onClose(); else onPeekChange(true); }
    else onPeekChange(!peek);
  };
  const handle = peekable && (
    <button
      type="button"
      className="sheet-handle"
      aria-expanded={!peek}
      aria-label={peek ? t('popup.expand') : t('popup.collapse')}
      onPointerDown={onHandleDown}
      onPointerUp={onHandleUp}
      onPointerCancel={() => { dragStartY.current = null; }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPeekChange(!peek); } }}
    >
      <span aria-hidden="true" />
    </button>
  );
  const peeking = peekable && peek;

  // The short version only had the small handle to open it, and nothing inside it scrolls, so on phones it felt
  // stuck half open. Now the whole sheet works like the handle: swipe up or tap anywhere that is not a control
  // opens it, swipe down closes it. Buttons and links inside keep doing their own thing.
  const onPeekDown = (event) => {
    if (!peeking || event.target.closest('.sheet-handle')) return;
    peekDrag.current = {
      y: event.clientY,
      onControl: Boolean(event.target.closest('button, a, input, textarea, select, label, [role="button"]')),
    };
  };
  const onPeekUp = (event) => {
    const start = peekDrag.current;
    peekDrag.current = null;
    if (!start || !peeking) return;
    const delta = event.clientY - start.y;
    if (delta < -30) onPeekChange(false);
    else if (delta > 30) onClose();
    else if (Math.abs(delta) < 10 && !start.onControl) onPeekChange(false);
  };

  return createPortal(
    <div
      ref={overlayRef}
      className={`sheet-overlay${variant === 'window' ? ' is-window' : ''}${peekable ? ' is-peekable' : ''}`}
      onMouseDown={(e) => { if (!peekable && e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        className={`sheet ${hero ? 'has-hero' : ''} ${peeking ? 'is-peek' : ''} ${className}`}
        role="dialog"
        aria-modal={peekable ? 'false' : 'true'}
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel}
        tabIndex={-1}
        onPointerDown={peekable ? onPeekDown : undefined}
        onPointerUp={peekable ? onPeekUp : undefined}
        onPointerCancel={peekable ? () => { peekDrag.current = null; } : undefined}
      >
        {handle}
        {hero ? (
          <>
            {closeOnHero && (
              <div className="sheet-hero-actions">
                {heroActions}
                {closeButton}
              </div>
            )}
            <div className="sheet-scroll">
              {hero}
              <div className="sheet-body">{children}</div>
            </div>
          </>
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
        {peeking && (
          // Visible way to open the rest: the text is cut at the fade, the button says there is more
          <div className="sheet-peek-more">
            <button type="button" className="btn-dark" onClick={() => onPeekChange(false)}>
              <ChevronIcon up size={20} />
              {t('popup.expand')}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
