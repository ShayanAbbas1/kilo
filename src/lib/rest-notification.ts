// Background nudge for the rest timer: fires only if the app isn't foregrounded
// (foreground handler below suppresses it, since the in-app bar already shows the countdown).
// ponytail: expo-notifications throws on import in Expo Go on Android (SDK 53+),
// so load it lazily and no-op there; notifications work again in a dev build.
import { Platform } from 'react-native';

const CHANNEL_ID = 'rest-timer';

let Notifications: typeof import('expo-notifications') | null = null;
try {
  Notifications = require('expo-notifications');
  Notifications!.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications!.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Rest timer',
      importance: Notifications!.AndroidImportance.DEFAULT,
    });
  }
} catch {
  Notifications = null; // Expo Go: in-app rest timer still works without notifications
}

export async function scheduleRestDone(seconds: number): Promise<string | null> {
  if (!Notifications) return null;
  try {
    const perms = await Notifications.getPermissionsAsync();
    const granted = perms.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return null;
    return await Notifications.scheduleNotificationAsync({
      content: { title: 'Rest over', body: 'Time for the next set.' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        channelId: CHANNEL_ID,
      },
    });
  } catch {
    return null; // in-app timer still works without notifications
  }
}

export function cancelRestDone(id: string | null) {
  if (id && Notifications) Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}
