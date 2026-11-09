import { Linking } from 'react-native';
import { LEGAL_URL } from '../constants/api';

/** Rules & privacy page of the web app; links to it are only shown when EXPO_PUBLIC_WEB_URL is set. */
export const hasLegalPage = LEGAL_URL !== null;

export const openLegalPage = () => {
  if (LEGAL_URL) Linking.openURL(LEGAL_URL).catch(() => {});
};
