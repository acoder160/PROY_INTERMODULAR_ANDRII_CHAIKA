import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, normalizeLanguage } from '../i18n';
import '../MapChrome.css';

// Botón con globo + código del idioma; abre una lista con los nombres nativos.
// variant="floating" lo fija arriba a la derecha (páginas de login/registro).
export default function LanguageSwitcher({ variant = 'inline' }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const current = normalizeLanguage(i18n.resolvedLanguage || i18n.language);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const choose = (code) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`lang-switcher ${variant}`}>
      <button
        type="button"
        className="lang-switcher-btn"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('common.language')}
        title={t('common.language')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z" />
        </svg>
        <span>{current.split('-')[0].toUpperCase()}</span>
      </button>

      {open && (
        <ul className="lang-switcher-menu" role="listbox">
          {SUPPORTED_LANGUAGES.map((language) => (
            <li key={language.code}>
              <button
                type="button"
                role="option"
                aria-selected={language.code === current}
                className={language.code === current ? 'active' : ''}
                onClick={() => choose(language.code)}
                lang={language.code}
              >
                {language.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
