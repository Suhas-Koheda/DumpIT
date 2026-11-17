import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
// Re-exported namespaces confuse the import resolver; pull the enums from their home modules.
import { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
import { IosAuthorizationStatus } from 'expo-notifications/build/NotificationPermissions.types';

export const REMINDER_CHANNEL_ID = 'dumpit-reminders';

/** Call once at app start. Creates the Android channel we schedule on. */
export async function setupNotificationChannel() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: 'DumpIT reminders',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#000000',
    });
  } catch {
    // Best effort — scheduling without a channel still works on most devices.
  }
}

/** Ask for notification permission, only when the user actually sets a reminder. */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (
      current.granted ||
      current.ios?.status === IosAuthorizationStatus.PROVISIONAL
    ) {
      return true;
    }
    const requested = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return (
      requested.granted ||
      requested.ios?.status === IosAuthorizationStatus.PROVISIONAL
    );
  } catch {
    return false;
  }
}

/** Schedule a one-shot local notification for an absolute timestamp. */
export async function scheduleReminderAt(
  title: string,
  body: string,
  at: number
): Promise<string | null> {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `DumpIT — ${title}`.slice(0, 60),
        body: body.slice(0, 200),
        sound: true,
        ...(Platform.OS === 'android' ? { channelId: REMINDER_CHANNEL_ID } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: at,
        ...(Platform.OS === 'android' ? { channelId: REMINDER_CHANNEL_ID } : {}),
      },
    });
    return id;
  } catch {
    return null;
  }
}

export async function cancelReminder(id: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired or never scheduled — harmless.
  }
}
