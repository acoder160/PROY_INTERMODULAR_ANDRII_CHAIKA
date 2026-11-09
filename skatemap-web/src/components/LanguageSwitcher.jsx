import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, normalizeLanguage } from '../i18n';
import Sheet from './Sheet';
import { ChoicePill } from './PaintBits';
import { GlobeIcon } from './Icons';

const STORAGE_KEY = 'lng';

const readPreference = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

// Botón con globo (48px, contorno blanco sobre asfalto) que abre la hoja de idiomas,
// igual que LanguageModal en la app móvil. variant="floating" lo fija arriba a la derecha (login/registro).
export default function LanguageSwitcher({ variant = 'inline' }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [preference, setPreference] = useState(readPreference);

  const choose = (code) => {
    if (code === null) {
      // Automático: idioma del navegador, sin guardar elección
      i18n.changeLanguage(normalizeLanguage(navigator.language)).then(() => {
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* almacenamiento bloqueado */ }
      });
    } else {
      i18n.changeLanguage(code);
    }
    setPreference(code);
    setOpen(false);
  };

  const current = normalizeLanguage(i18n.resolvedLanguage || i18n.language);

  return (
    <>
      <button
        type="button"
        className={`globe-btn ${variant}`}
        onClick={() => { setPreference(readPreference()); setOpen(true); }}
        aria-haspopup="dialog"
        aria-label={t('common.language')}
        title={t('common.language')}
      >
        <GlobeIcon size={22} />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={t('common.language')}>
        <div className="pill-row" role="radiogroup" aria-label={t('common.language')}>
          <ChoicePill
            selected={preference === null}
            onClick={() => choose(null)}
            label={t('common.languageAuto')}
            display={false}
          />
          {SUPPORTED_LANGUAGES.map((language) => (
            <ChoicePill
              key={language.code}
              selected={preference !== null && current === language.code}
              onClick={() => choose(language.code)}
              label={language.name}
              display={false}
              lang={language.code}
            />
          ))}
        </div>
      </Sheet>
    </>
  );
}
