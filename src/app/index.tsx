import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import Badge from '@/components/Badge';
import { useDumpStore } from '@/lib/dump-store';
import { usePalette } from '@/lib/theme';
import { timeAgo } from '@/lib/time';
import type { DumpItem } from '@/lib/types';

export default function InboxScreen() {
  const palette = usePalette();
  const { items, hydrated, removeItem } = useDumpStore();

  const confirmDelete = (item: DumpItem) => {
    Alert.alert('Delete dump?', 'This removes it from your phone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeItem(item.id) },
    ]);
  };

  if (!hydrated) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: palette.bg }]}
        edges={['top']}
      >
        <ActivityIndicator style={styles.loading} size="large" color={palette.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: palette.bg }]}
      edges={['top']}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <View>
          <Text style={[styles.logo, { color: palette.text }]}>DumpIT</Text>
          <Text style={[styles.tagline, { color: palette.muted }]}>
            Share it. Dump it. Deal with it later.
          </Text>
        </View>
        <View style={[styles.countPill, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.countText, { color: palette.accent }]}>{items.length}</Text>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <DumpCard
            item={item}
            palette={palette}
            onPress={() => router.push(`/item/${item.id}`)}
            onDelete={() => confirmDelete(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="download-outline" size={64} color={palette.faint} />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>Nothing here yet</Text>
            <Text style={[styles.emptyHint, { color: palette.muted }]}>
              Share a tweet, a link, an article or a screenshot to DumpIT — it lands here, stored
              on your phone.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function DumpCard({
  item,
  palette,
  onPress,
  onDelete,
}: {
  item: DumpItem;
  palette: ReturnType<typeof usePalette>;
  onPress: () => void;
  onDelete: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.cardTopRow}>
        <Badge item={item} />
        <View style={styles.cardTopRight}>
          <Text style={[styles.time, { color: palette.faint }]}>{timeAgo(item.createdAt)}</Text>
          <Pressable onPress={onDelete} hitSlop={12} accessibilityLabel="Delete">
            <Ionicons name="trash-outline" size={20} color={palette.muted} />
          </Pressable>
        </View>
      </View>

      {item.kind === 'image' && item.imageUri ? (
        <Image
          source={{ uri: item.imageUri }}
          style={[styles.thumb, { backgroundColor: palette.border }]}
          contentFit="cover"
        />
      ) : null}

      <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={2}>
        {item.title}
      </Text>

      {item.text && item.kind !== 'image' ? (
        <Text style={[styles.cardSnippet, { color: palette.muted }]} numberOfLines={2}>
          {item.text}
        </Text>
      ) : null}

      {item.urlHost ? (
        <Text style={[styles.host, { color: palette.accent }]}>{item.urlHost} ↗</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  loading: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  logo: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 13,
    marginTop: 2,
  },
  countPill: {
    minWidth: 44,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  countText: {
    fontSize: 15,
    fontWeight: '800',
  },
  list: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  time: {
    fontSize: 12,
  },
  thumb: {
    width: '100%',
    height: 160,
    borderRadius: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  cardSnippet: {
    fontSize: 13,
    lineHeight: 18,
  },
  host: {
    fontSize: 12,
    fontWeight: '700',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 72,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '700',
  },
  emptyHint: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
