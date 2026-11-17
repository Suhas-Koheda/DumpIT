import { useState } from 'react';
import { Pressable, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { verifyPin } from '@/lib/pin';
import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

/**
 * Lock screen — shown on cold start when the vault PIN is set.
 * Renders before the app's theme provider, so it picks colors directly.
 */
export default function UnlockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const systemScheme = useColorScheme();
  const c = (systemScheme === 'dark' ? MD3DarkTheme : MD3LightTheme).colors;
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const digit = (d: string) => {
    setError(false);
    if (pin.length < 12) setPin(pin + d);
  };

  const submit = async () => {
    if (pin.length < 4) return;
    const ok = await verifyPin(pin);
    if (ok) {
      onUnlocked();
    } else {
      setError(true);
      setPin('');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <StatusBar style={systemScheme === 'dark' ? 'light' : 'dark'} />
      <Ionicons name="lock-closed" size={44} color={c.primary} />
      <Text style={{ fontSize: 30, fontWeight: '800', color: c.onBackground }}>DumpIT</Text>
      <Text style={{ fontSize: 15, color: c.onSurfaceVariant }}>The vault is locked</Text>

      <View style={{ flexDirection: 'row', gap: 12, marginVertical: 10 }}>
        {Array.from({ length: Math.max(pin.length, 4) }, (_, i) => (
          <View
            key={i}
            style={{
              width: 15,
              height: 15,
              borderRadius: 7.5,
              backgroundColor: i < pin.length ? c.primary : c.surfaceVariant,
            }}
          />
        ))}
      </View>
      {error ? (
        <Text style={{ fontSize: 13, color: c.error }}>Wrong PIN — try again.</Text>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, width: 236 }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <Pressable key={d} onPress={() => digit(d)} style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: c.surfaceVariant, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 22, color: c.onSurface }}>{d}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => setPin('')} style={{ width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 15, color: c.onSurfaceVariant, fontWeight: '700' }}>CLR</Text>
        </Pressable>
        <Pressable onPress={() => digit('0')} style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: c.surfaceVariant, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 22, color: c.onSurface }}>0</Text>
        </Pressable>
        <Pressable onPress={submit} style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-forward" size={26} color={c.onPrimary} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
