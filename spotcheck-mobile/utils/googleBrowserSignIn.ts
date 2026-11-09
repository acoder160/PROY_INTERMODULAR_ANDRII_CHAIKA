import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { API_BASE_URL } from '../constants/api';

/**
 * Login con Google por navegador del sistema, para Expo Go (donde no hay módulo nativo).
 * El backend hace el OAuth con Google y devuelve a la app un código de un solo uso; la app lo canjea
 * en /auth/google/exchange con su verificador PKCE, así nadie más puede usar ese código.
 */
export type BrowserSignInResult =
  | { type: 'success'; code: string; verifier: string }
  | { type: 'cancel' }
  | { type: 'error'; error: string };

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Expo Go is the only runtime with an `expoGo` manifest section; `executionEnvironment` alone is not
 * reliable here (it was reported as non-Expo-Go while running in Expo Go).
 */
function isRunningInExpoGo(): boolean {
  return (
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.appOwnership === 'expo' ||
    Constants.expoGoConfig != null
  );
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

export async function startGoogleBrowserSignIn(): Promise<BrowserSignInResult> {
  // PKCE: verificador aleatorio que solo conoce esta app; al backend va su hash SHA-256
  const verifier = base64Url(Crypto.getRandomBytes(32));
  const challenge = (
    await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
      encoding: Crypto.CryptoEncoding.BASE64,
    })
  ).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const appRedirect = returnLink('auth/google');
  console.log(
    'Google sign-in: return to', appRedirect,
    `(executionEnvironment=${Constants.executionEnvironment}, appOwnership=${Constants.appOwnership}, expoGo=${!!Constants.expoGoConfig})`
  );
  const startUrl =
    `${API_BASE_URL}/api/auth/google/start` +
    `?redirect=${encodeURIComponent(appRedirect)}&challenge=${encodeURIComponent(challenge)}`;

  const result = await WebBrowser.openAuthSessionAsync(startUrl, appRedirect);
  if (result.type !== 'success') return { type: 'cancel' };

  const { queryParams } = Linking.parse(result.url);
  const code = typeof queryParams?.code === 'string' ? queryParams.code : null;
  const error = typeof queryParams?.error === 'string' ? queryParams.error : null;
  if (code) return { type: 'success', code, verifier };
  return { type: 'error', error: error ?? 'missing_code' };
}
