// Background nudge for the rest timer: fires only if the app isn't foregrounded
// (foreground handler below suppresses it, since the in-app bar already shows the countdown).
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'rest-timer';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Rest timer',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function scheduleRestDone(seconds: number): Promise<string | null> {
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
  if (id) Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}
