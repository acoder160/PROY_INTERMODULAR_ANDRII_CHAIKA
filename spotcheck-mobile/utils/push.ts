import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo';
import type * as NotificationsModule from 'expo-notifications';
import api from './api';
import { isRunningInExpoGo } from './googleBrowserSignIn';

/**
 * Expo Go can't receive remote pushes (Android, SDK 53+) and expo-notifications throws on channel
 * setup there. So the module is only loaded in a development or store build; in Expo Go and on the
 * web every function here quietly does nothing.
 */
const pushSupported = Platform.OS !== 'web' && !isRunningInExpoGo();

let notificationsModule: typeof NotificationsModule | null = null;
let notificationsUnavailable = false;
function notifications(): typeof NotificationsModule | null {
  if (!pushSupported || notificationsUnavailable) return null;
  if (!notificationsModule) {
    // Expo Go doesn't ship the native side of expo-notifications (ExpoApplication among it), and the
    // Expo Go check above can be fooled when Expo Go reopens the app from a deep link. So look for the
    // native module itself, and never let loading push break the app.
    if (!requireOptionalNativeModule('ExpoApplication') || !requireOptionalNativeModule('ExpoPushTokenManager')) {
      notificationsUnavailable = true;
      return null;
    }
    try {
      notificationsModule = require('expo-notifications') as typeof NotificationsModule;
      // Pushes that arrive while the app is open still show as a banner
      notificationsModule.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
    } catch (error) {
      console.log('Push not available:', (error as Error)?.message ?? error);
      notificationsModule = null;
      notificationsUnavailable = true;
    }
  }
  return notificationsModule;
}

let registeredToken: string | null = null;

/**
 * Asks for permission (once), gets this device's Expo push token and gives it to the backend.
 * Never throws: push is a nice-to-have.
 */
export async function registerForPush(locale: string): Promise<void> {
  const Notifications = notifications();
  if (!Notifications) return;
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'SpotCheck',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#FF4FA3',
      });
    }
    const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await api.post('/push-tokens', { token, platform: Platform.OS, locale });
    registeredToken = token;
  } catch (error) {
    console.log('Push not available:', (error as Error)?.message ?? error);
  }
}

/** On sign-out, before the session is cleared: this device stops getting that account's pushes. */
export async function unregisterPush(): Promise<void> {
  if (!registeredToken) return;
  try {
    await api.post('/push-tokens/unregister', { token: registeredToken });
  } catch {
    // The token dies with the session anyway when the app is uninstalled
  } finally {
    registeredToken = null;
  }
}

/** Where a tapped push should take the user. */
export function routeForPush(data: Record<string, unknown> | undefined): { pathname: string; params?: Record<string, string> } | null {
  if (!data) return null;
  if (data.type === 'FOLLOW' && typeof data.username === 'string') {
    return { pathname: '/user/[username]', params: { username: data.username } };
  }
  if (data.spotId != null) return { pathname: '/(tabs)', params: { spot: String(data.spotId) } };
  return null;
}

/**
 * Calls {@code open} with where to go when a push is tapped, also for the push that launched the
 * app. Returns the unsubscribe function.
 */
export function onPushTapped(open: (target: { pathname: string; params?: Record<string, string> }) => void): () => void {
  const Notifications = notifications();
  if (!Notifications) return () => {};
  const handle = (response: NotificationsModule.NotificationResponse | null) => {
    const target = routeForPush(response?.notification.request.content.data as Record<string, unknown> | undefined);
    if (target) open(target);
  };
  Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
