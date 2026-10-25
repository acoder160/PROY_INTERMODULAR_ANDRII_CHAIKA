import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import languages from './languages.json';
import ar from './locales/ar.json';
import bn from './locales/bn.json';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import eu from './locales/eu.json';
import fr from './locales/fr.json';
import hi from './locales/hi.json';
import id from './locales/id.json';
import it from './locales/it.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import nl from './locales/nl.json';
import pl from './locales/pl.json';
import ptBR from './locales/pt-BR.json';
import ru from './locales/ru.json';
import th from './locales/th.json';
import tr from './locales/tr.json';
import uk from './locales/uk.json';
import vi from './locales/vi.json';
import zhCN from './locales/zh-CN.json';

const resources = {
  ar, bn, de, en, es, eu, fr, hi, id, it, ja, ko, nl, pl, ru, th, tr, uk, vi,
  'pt-BR': ptBR,
  'zh-CN': zhCN,
};

export const SUPPORTED_LANGUAGES = languages as { code: string; name: string; rtl?: boolean }[];
const supportedCodes = SUPPORTED_LANGUAGES.map((language) => language.code);

// Convierte el idioma del teléfono (es-ES, pt-PT, zh-Hans-CN, nb...) a uno de los idiomas soportados
export function normalizeLanguage(tag?: string | null): string {
  if (!tag) return 'en';
  if (supportedCodes.includes(tag)) return tag;
  const primary = tag.split('-')[0];
  if (primary === 'zh') return 'zh-CN';
  if (primary === 'pt') return 'pt-BR';
  return supportedCodes.includes(primary) ? primary : 'en';
}

// El idioma de la interfaz es el del teléfono
export function getDeviceLanguage(): string {
  const [locale] = getLocales();
  return normalizeLanguage(locale?.languageTag ?? locale?.languageCode);
}

// Idioma elegido a mano con el botón de idioma (null = automático, el del teléfono)
const STORAGE_KEY = 'skatemap.language';
let preference: string | null = null;

export function getLanguagePreference(): string | null {
  return preference;
}

export async function setLanguagePreference(code: string | null): Promise<void> {
  preference = code && supportedCodes.includes(code) ? code : null;
  try {
    if (preference) await AsyncStorage.setItem(STORAGE_KEY, preference);
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // si no se puede guardar, el idioma sigue cambiando durante esta sesión
  }
  await i18n.changeLanguage(preference ?? getDeviceLanguage());
}

i18n.use(initReactI18next).init({
  resources: Object.fromEntries(Object.entries(resources).map(([code, translation]) => [code, { translation }])),
  lng: getDeviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

// Si había un idioma elegido a mano, lo recuperamos al arrancar
AsyncStorage.getItem(STORAGE_KEY)
  .then((saved) => {
    if (saved && supportedCodes.includes(saved)) {
      preference = saved;
      if (saved !== i18n.language) i18n.changeLanguage(saved);
    }
  })
  .catch(() => {});

// Si el usuario cambia el idioma del teléfono y vuelve a la app, lo recogemos sin reiniciar
// (solo en modo automático: un idioma elegido a mano no se toca)
AppState.addEventListener('change', (state) => {
  if (state !== 'active' || preference) return;
  const language = getDeviceLanguage();
  if (language !== i18n.language) i18n.changeLanguage(language);
});

export default i18n;
