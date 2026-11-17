import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/lib/theme';

/** RawBlock loading screen — black block, white mono text, hard edges. */
export default function Loader({ message = 'LOADING' }: { message?: string }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setFrame((f) => (f + 1) % 4), 350);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.root}>
      <Text style={styles.logo}>DUMPIT</Text>
      <Text style={styles.tagline}>Share it. Dump it. Deal with it later.</Text>
      <View style={styles.block}>
        <Text style={styles.blockText}>{message}{ '.'.repeat(frame) }</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  logo: {
    fontFamily: fonts.display,
    fontSize: 64,
    letterSpacing: 4,
    color: colors.text,
    lineHeight: 64,
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    marginBottom: 32,
  },
  block: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderWidth: 0,
  },
  blockText: {
    fontFamily: fonts.mono,
    fontSize: 15,
    letterSpacing: 3,
    color: colors.ink,
    minWidth: 180,
    textAlign: 'center',
  },
});
