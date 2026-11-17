import { StyleSheet, Text, View } from 'react-native';

import { badgeFor, borders, colors, fonts } from '@/lib/theme';
import type { DumpItem } from '@/lib/types';

export default function Badge({ item }: { item: DumpItem }) {
  const meta = badgeFor(item);
  return (
    <View style={[styles.badge, meta.inverted && styles.inverted]}>
      <Text style={[styles.label, meta.inverted && styles.labelInverted]}>{meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: borders.base,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignSelf: 'flex-start',
    borderRadius: 0,
  },
  inverted: {
    backgroundColor: colors.accent,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.text,
  },
  labelInverted: {
    color: colors.ink,
  },
});
