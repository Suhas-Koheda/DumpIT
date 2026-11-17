import { Text, View } from 'react-native';
import { usePalette } from '@/lib/theme';
import type { DumpItem } from '@/lib/types';

const LABELS: Record<string, string> = {
  x: 'X / TWITTER',
  linkedin: 'LINKEDIN',
  web: 'LINK',
  text: 'TEXT',
  image: 'SCREENSHOT',
};

/** Small pill badge — what the dump is. */
export default function Badge({ item }: { item: DumpItem }) {
  const palette = usePalette();
  const label =
    item.kind === 'text'
      ? LABELS.text
      : item.kind === 'image'
        ? LABELS.image
        : (item.platform && LABELS[item.platform]) || LABELS.web;
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 5,
        backgroundColor: palette.accent,
      }}
    >
      <Text
        style={{
          fontSize: 9,
          letterSpacing: 1.2,
          fontWeight: '700',
          color: palette.onAccent,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
