import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black';
import {
  WorkSans_400Regular,
  WorkSans_500Medium,
  WorkSans_600SemiBold,
  WorkSans_700Bold,
} from '@expo-google-fonts/work-sans';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ShareIntentProvider } from 'expo-share-intent';

import { useEffect, useState } from 'react';

import ShareIntentWatcher from '@/components/ShareIntentWatcher';
import Loader from '@/components/Loader';
import UnlockScreen from '@/components/UnlockScreen';
import { DumpProvider } from '@/lib/dump-store';
import { setupNotificationChannel } from '@/lib/notifications';
import { isLockEnabled } from '@/lib/pin';
import { colors, fonts } from '@/lib/theme';

// Expo Go cannot load the native share-intent module; running there with the
// hook disabled keeps the whole app testable. A dev build enables real
// share-sheet delivery.
const isExpoGo = Constants.appOwnership === 'expo';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    ArchivoBlack_400Regular,
    WorkSans_400Regular,
    WorkSans_500Medium,
    WorkSans_600SemiBold,
    WorkSans_700Bold,
    SpaceMono_400Regular,
  });

  const [locked, setLocked] = useState<boolean | null>(null);

  useEffect(() => {
    setupNotificationChannel();
    isLockEnabled().then(setLocked);
  }, []);

  if (!fontsLoaded || locked === null) {
    return <Loader message="OPENING THE VAULT" />;
  }

  if (locked) {
    return <UnlockScreen onUnlocked={() => setLocked(false)} />;
  }

  return (
    <SafeAreaProvider>
      <DumpProvider>
        <ShareIntentProvider options={{ disabled: isExpoGo, debug: false }}>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.text,
              headerTitleStyle: { fontFamily: fonts.display, fontSize: 11 },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen
              name="item/[id]"
              options={{ title: 'DUMP', headerShadowVisible: false }}
            />
            <Stack.Screen
              name="add"
              options={{
                presentation: 'modal',
                title: 'NEW DUMP',
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen name="settings" options={{ title: 'CONFIG' }} />
            <Stack.Screen name="board" options={{ title: 'BOARD' }} />
            <Stack.Screen name="calendar" options={{ title: 'CALENDAR' }} />
          </Stack>
          <ShareIntentWatcher />
        </ShareIntentProvider>
      </DumpProvider>
    </SafeAreaProvider>
  );
}
