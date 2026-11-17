import { Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';

import { badgeFor } from '@/lib/theme';
import type { DumpItem } from '@/lib/types';

/** Small tonal chip used on every card — one color per dump type. */
export default function Badge({ item }: { item: DumpItem }) {
  const theme = useTheme();
  const meta = badgeFor(item);
  const c = meta.tone === 'accent' ? theme.colors.primaryContainer : theme.colors.secondaryContainer;
  const on = meta.tone === 'accent' ? theme.colors.onPrimaryContainer : theme.colors.onSecondaryContainer;
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: c }}>
      <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: on }}>{meta.label}</Text>
    </View>
  );
}
