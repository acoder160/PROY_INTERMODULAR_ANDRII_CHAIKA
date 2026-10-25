import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';
import languages from './languages.json';

export const SUPPORTED_LANGUAGES = languages;
const supportedCodes = languages.map((l) => l.code);
const rtlCodes = languages.filter((l) => l.rtl).map((l) => l.code);

// Convierte el idioma del navegador (es-ES, pt-PT, zh-TW, nb...) a uno de los idiomas soportados
export function normalizeLanguage(tag) {
  if (!tag) return 'en';
  if (supportedCodes.includes(tag)) return tag;
  const [primary] = String(tag).split('-');
  if (primary === 'zh') return 'zh-CN';
  if (primary === 'pt') return 'pt-BR';
  return supportedCodes.includes(primary) ? primary : 'en';
}

const applyDocumentLanguage = (lng) => {
  document.documentElement.lang = lng;
  document.documentElement.dir = rtlCodes.includes(lng) ? 'rtl' : 'ltr';
};

// Se resuelve cuando el idioma inicial ya está cargado (evita mostrar las claves un instante)
export const i18nReady = i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .use(resourcesToBackend((lng) => import(`./locales/${lng}.json`)))
  .init({
    fallbackLng: 'en',
    supportedLngs: supportedCodes,
    load: 'currentOnly',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'lng',
      caches: ['localStorage'],
      convertDetectedLanguage: normalizeLanguage,
    },
    react: { useSuspense: false },
  })
  .then(() => applyDocumentLanguage(i18n.resolvedLanguage || 'en'));

i18n.on('languageChanged', (lng) => applyDocumentLanguage(normalizeLanguage(lng)));

export default i18n;
