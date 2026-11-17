import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { useEffect, useState } from 'react';
import { ShareIntentProvider } from 'expo-share-intent';

import ShareIntentWatcher from '@/components/ShareIntentWatcher';
import Loader from '@/components/Loader';
import UnlockScreen from '@/components/UnlockScreen';
import { DumpProvider, useDumpStore } from '@/lib/dump-store';
import { setupNotificationChannel } from '@/lib/notifications';
import { isLockEnabled } from '@/lib/pin';
import { darkPaperTheme, lightPaperTheme, pickScheme } from '@/lib/themes';

const isExpoGo = Constants.appOwnership === 'expo';

function InnerLayout() {
  const { themeMode } = useDumpStore();
  const systemScheme = useColorScheme();
  const scheme = pickScheme(themeMode, systemScheme === 'dark' ? 'dark' : 'light');
  const paperTheme = scheme === 'dark' ? darkPaperTheme : lightPaperTheme;
  const colors = paperTheme.colors;

  return (
    <PaperProvider theme={paperTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.onSurface,
          headerTitleStyle: { fontWeight: '600', fontSize: 16 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="item/[id]"
          options={{ title: 'Dump', headerBackButtonDisplayMode: 'minimal' }}
        />
        <Stack.Screen
          name="add"
          options={{ presentation: 'modal', title: 'New dump', headerShadowVisible: false }}
        />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="board" options={{ title: 'Board' }} />
        <Stack.Screen name="calendar" options={{ title: 'Calendar' }} />
      </Stack>
      <ShareIntentWatcher />
    </PaperProvider>
  );
}

export default function RootLayout() {
  const [locked, setLocked] = useState<boolean | null>(null);

  useEffect(() => {
    setupNotificationChannel();
    isLockEnabled().then(setLocked);
  }, []);

  if (locked === null) {
    return <Loader message="Opening the vault" />;
  }

  if (locked) {
    return <UnlockScreen onUnlocked={() => setLocked(false)} />;
  }

  return (
    <SafeAreaProvider>
      <DumpProvider>
        <ShareIntentProvider options={{ disabled: isExpoGo, debug: false }}>
          <InnerLayout />
        </ShareIntentProvider>
      </DumpProvider>
    </SafeAreaProvider>
  );
}
