import Constants, { ExecutionEnvironment } from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import api from './api';
import { API_BASE_URL } from '../constants/api';

/**
 * Login con Google por navegador del sistema, para Expo Go (donde no hay módulo nativo).
 * El backend hace el OAuth con Google y devuelve a la app un código de un solo uso; la app lo canjea
 * en /auth/google/exchange con su verificador PKCE, así nadie más puede usar ese código.
 */
export type BrowserSignInResult =
  | { type: 'success'; code: string; verifier: string; attempt: string | null }
  | { type: 'cancel' }
  | { type: 'error'; error: string };

export interface GoogleSessionData {
  username: string;
  token: string;
  refreshToken?: string;
  role?: string;
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Expo Go is the only runtime with an `expoGo` manifest section; `executionEnvironment` alone is not
 * reliable here (it was reported as non-Expo-Go while running in Expo Go).
 */
export function isRunningInExpoGo(): boolean {
  return (
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.appOwnership === 'expo' ||
    Constants.expoGoConfig != null
  );
}

/**
 * Closes any auth screens (/login, /register, /auth/google) on top of /(tabs), or replaces with
 * /(tabs) if an auth screen was at the root of the stack.
 */
let lastLeaveAt = 0;

export function leaveAuthScreens(router: {
  canDismiss: () => boolean;
  dismissAll: () => void;
  replace: (href: any) => void;
}): void {
  // The button, the return route and the root layout can all call this right after sign-in; only the
  // first one navigates, or a second dismissAll finds nothing left to pop (POP_TO_TOP not handled).
  const now = Date.now();
  if (now - lastLeaveAt < 1500) return;
  lastLeaveAt = now;
  if (router.canDismiss()) {
    router.dismissAll();
  } else {
    router.replace('/(tabs)');
  }
}

/**
 * Deep link back into this app: exp://<metro host>/--/<path> in Expo Go,
 * spotcheckmobile://<path> in an installed build.
 */
function returnLink(path: string): string {
  const hostUri = Constants.expoConfig?.hostUri;
  if (isRunningInExpoGo() && hostUri) {
    return `exp://${hostUri.replace(/\/+$/, '')}/--/${path}`;
  }
  return Linking.createURL(path);
}

/**
 * Verifiers of recent attempts, by attempt id. If a sign-in is abandoned (back button, slow server,
 * app restarted) and retried, the browser tab can still finish the OLD attempt; its code only matches
 * the old verifier. Each attempt tags its return link with its id, and the verifiers are kept on the
 * device (for the life of a Google login, 10 minutes) so the right one is found even after a restart.
 */
const STORE_KEY = 'googleSignInAttempts';
const ATTEMPT_TTL_MS = 10 * 60 * 1000;
const MAX_REMEMBERED = 5;
type Attempts = Record<string, { v: string; t: number }>;

async function loadAttempts(): Promise<Attempts> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    const all: Attempts = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    return Object.fromEntries(Object.entries(all).filter(([, a]) => now - a.t < ATTEMPT_TTL_MS));
  } catch {
    return {};
  }
}

async function saveAttempts(attempts: Attempts): Promise<void> {
  const newest = Object.entries(attempts).sort((a, b) => b[1].t - a[1].t).slice(0, MAX_REMEMBERED);
  try { await AsyncStorage.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(newest))); } catch {}
}

/**
 * Deduplicated exchange by one-time code: on Android both WebBrowser.openAuthSessionAsync and Expo
 * Router's /auth/google route can receive the same deep link; sharing the promise ensures the
 * backend's single-use code is only redeemed once.
 */
const exchangesByCode = new Map<string, Promise<GoogleSessionData>>();

export function exchangeGoogleBrowserCode(
  code: string,
  attemptId?: string | null,
  fallbackVerifier?: string,
): Promise<GoogleSessionData> {
  const existing = exchangesByCode.get(code);
  if (existing) return existing;

  const promise = (async () => {
    const attempts = await loadAttempts();
    const verifier = (attemptId ? attempts[attemptId]?.v : undefined) ?? fallbackVerifier;
    if (!verifier) {
      throw new Error('Missing PKCE verifier for Google sign-in attempt');
    }
    if (attemptId && attempts[attemptId]) {
      delete attempts[attemptId];
      await saveAttempts(attempts);
    }
    const response = await api.post<GoogleSessionData>('/auth/google/exchange', { code, verifier });
    return response.data;
  })();

  exchangesByCode.set(code, promise);
  promise.finally(() => {
    setTimeout(() => exchangesByCode.delete(code), 60_000);
  });
  return promise;
}

export async function startGoogleBrowserSignIn(): Promise<BrowserSignInResult> {
  // PKCE: verificador aleatorio que solo conoce esta app; al backend va su hash SHA-256
  const verifier = base64Url(Crypto.getRandomBytes(32));
  const challenge = (
    await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
      encoding: Crypto.CryptoEncoding.BASE64,
    })
  ).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const attempt = base64Url(Crypto.getRandomBytes(9));
  await saveAttempts({ ...(await loadAttempts()), [attempt]: { v: verifier, t: Date.now() } });

  const baseRedirect = returnLink('auth/google');
  const appRedirect = `${baseRedirect}?a=${attempt}`;
  console.log(
    'Google sign-in: return to', appRedirect,
    `(executionEnvironment=${Constants.executionEnvironment}, appOwnership=${Constants.appOwnership}, expoGo=${!!Constants.expoGoConfig})`
  );
  const startUrl =
    `${API_BASE_URL}/api/auth/google/start` +
    `?redirect=${encodeURIComponent(appRedirect)}&challenge=${encodeURIComponent(challenge)}`;

  // On Android, AppState can change to 'active' a few ms before Linking delivers the redirect URL,
  // causing openAuthSessionAsync to resolve early with 'dismiss'. Keep a direct Linking listener
  // across the call so that redirect URL is never missed.
  let capturedRedirectUrl: string | null = null;
  let notifyRedirect: ((url: string) => void) | null = null;
  const linkSub = Linking.addEventListener('url', (event) => {
    if (event.url.startsWith(baseRedirect)) {
      capturedRedirectUrl = event.url;
      notifyRedirect?.(event.url);
    }
  });

  let redirectUrl: string | null = null;
  try {
    // Default createTask (true): the Google tab gets its own task, so when the redirect brings the
    // app back the tab is left behind instead of covering the app. Old tabs from abandoned attempts
    // are harmless thanks to the attempt id on the return link.
    const result = await WebBrowser.openAuthSessionAsync(startUrl, baseRedirect);
    if (result.type === 'success') {
      redirectUrl = result.url;
    } else if (capturedRedirectUrl) {
      redirectUrl = capturedRedirectUrl;
    } else if (Platform.OS === 'android') {
      redirectUrl = await new Promise<string | null>((resolve) => {
        const timer = setTimeout(() => resolve(capturedRedirectUrl), 700);
        notifyRedirect = (url) => {
          clearTimeout(timer);
          resolve(url);
        };
      });
    }
  } finally {
    linkSub.remove();
  }

  if (!redirectUrl) return { type: 'cancel' };

  console.log('Google sign-in: came back with', redirectUrl.replace(/code=[^&]+/, 'code=***'));
  const { queryParams } = Linking.parse(redirectUrl);
  const code = typeof queryParams?.code === 'string' ? queryParams.code : null;
  const error = typeof queryParams?.error === 'string' ? queryParams.error : null;
  const returnedAttempt = typeof queryParams?.a === 'string' ? queryParams.a : null;
  const attempts = await loadAttempts();
  const matching = returnedAttempt ? attempts[returnedAttempt]?.v : undefined;
  console.log(
    'Google sign-in: came back from attempt', returnedAttempt ?? '(none)',
    returnedAttempt === attempt ? '(this one)' : matching ? '(an earlier one)' : '(unknown)'
  );
  if (code) {
    return { type: 'success', code, verifier: matching ?? verifier, attempt: returnedAttempt ?? attempt };
  }
  return { type: 'error', error: error ?? 'missing_code' };
}
