import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { useColorScheme } from 'react-native';
import { ShareIntentProvider } from 'expo-share-intent';

import ShareIntentWatcher from '@/components/ShareIntentWatcher';
import { DumpProvider } from '@/lib/dump-store';
import { palettes } from '@/lib/theme';

const isExpoGo = Constants.appOwnership === 'expo';

export default function RootLayout() {
  const scheme = useColorScheme() ?? 'light';
  const palette = palettes[scheme];

  return (
    <DumpProvider>
      <ShareIntentProvider options={{ disabled: isExpoGo, debug: false }}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: palette.bg },
            headerTintColor: palette.text,
            headerTitleStyle: { fontWeight: '800', fontSize: 16 },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: palette.bg },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen
            name="item/[id]"
            options={{ title: 'Dump', headerBackButtonDisplayMode: 'minimal' }}
          />
        </Stack>
        <ShareIntentWatcher />
      </ShareIntentProvider>
    </DumpProvider>
  );
}
