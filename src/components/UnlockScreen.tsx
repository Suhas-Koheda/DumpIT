import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { verifyPin } from '@/lib/pin';
import { borders, colors, fonts } from '@/lib/theme';

/** Hard lock screen — shown on cold start when the vault PIN is set. */
export default function UnlockScreen({ onUnlocked }: { onUnlocked: () => void }) {
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
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.root}>
        <Text style={styles.logo}>DUMPIT</Text>
        <Text style={styles.tagline}>THE VAULT IS LOCKED</Text>

        <View style={styles.dotsRow}>
          {Array.from({ length: Math.max(pin.length, 4) }, (_, i) => (
            <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
          ))}
        </View>
        <Text style={[styles.error, error && styles.errorVisible]}>WRONG PIN. AGAIN.</Text>

        <View style={styles.pad}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <Pressable key={d} style={styles.key} onPress={() => digit(d)}>
              <Text style={styles.keyText}>{d}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.key} onPress={() => setPin('')}>
            <Text style={styles.keyText}>C</Text>
          </Pressable>
          <Pressable style={styles.key} onPress={() => digit('0')}>
            <Text style={styles.keyText}>0</Text>
          </Pressable>
          <Pressable style={[styles.key, styles.keyGo]} onPress={submit}>
            <Text style={[styles.keyText, styles.keyGoText]}>→</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    padding: 24,
  },
  logo: {
    fontFamily: fonts.display,
    fontSize: 44,
    letterSpacing: 6,
    color: colors.text,
  },
  tagline: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 3,
    color: colors.faint,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  dot: {
    width: 14,
    height: 14,
    borderWidth: borders.base,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  dotFilled: {
    backgroundColor: colors.accent,
  },
  error: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.error,
    opacity: 0,
  },
  errorVisible: {
    opacity: 1,
  },
  pad: {
    width: 260,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  key: {
    width: 74,
    height: 64,
    borderWidth: borders.thick,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyGo: {
    backgroundColor: colors.accent,
  },
  keyText: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.text,
  },
  keyGoText: {
    color: colors.ink,
    fontSize: 26,
  },
});
