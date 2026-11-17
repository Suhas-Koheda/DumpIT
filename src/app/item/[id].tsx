import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import Badge from '@/components/Badge';
import { useDumpStore } from '@/lib/dump-store';
import { usePalette } from '@/lib/theme';
import { fullDate } from '@/lib/time';

export default function DumpDetailScreen() {
  const palette = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, removeItem } = useDumpStore();
  const item = items.find((entry) => entry.id === id);

  if (!item) {
    return (
      <SafeAreaView
        style={[styles.missing, { backgroundColor: palette.bg }]}
        edges={['bottom']}
      >
        <Ionicons name="alert-circle-outline" size={44} color={palette.faint} />
        <Text style={[styles.missingText, { color: palette.muted }]}>
          That dump is gone.
        </Text>
        <Pressable onPress={() => router.back()} style={styles.missingBtn}>
          <Text style={[styles.missingBtnText, { color: palette.accent }]}>Back to inbox</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const confirmDelete = () =>
    Alert.alert('Delete dump?', 'This removes it from your phone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeItem(item.id);
          router.back();
        },
      },
    ]);

  const openUrl = () => {
    if (item.url) Linking.openURL(item.url).catch(() => {});
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: palette.bg }]}
      edges={['bottom']}
    >
      <Stack.Screen options={{ title: 'Dump' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Badge item={item} />
          <Text style={[styles.date, { color: palette.faint }]}>{fullDate(item.createdAt)}</Text>
        </View>

        {item.kind === 'image' && item.imageUri ? (
          <Image
            source={{ uri: item.imageUri }}
            style={[styles.heroImage, { backgroundColor: palette.border }]}
            contentFit="contain"
          />
        ) : null}

        {item.url ? (
          <Pressable
            onPress={openUrl}
            style={[styles.linkCard, { backgroundColor: palette.card, borderColor: palette.border }]}
          >
            <View style={styles.linkRow}>
              <Ionicons name="link" size={16} color={palette.accent} />
              <Text style={[styles.linkHost, { color: palette.accent }]} numberOfLines={1}>
                {item.urlHost ?? item.url}
              </Text>
              <Ionicons name="open-outline" size={16} color={palette.muted} />
            </View>
            <Text style={[styles.linkUrl, { color: palette.muted }]} numberOfLines={2} selectable>
              {item.url}
            </Text>
            <Text style={[styles.openText, { color: palette.accent }]}>OPEN LINK →</Text>
          </Pressable>
        ) : null}

        <Text style={[styles.title, { color: palette.text }]} selectable>
          {item.title}
        </Text>
        {item.text ? (
          <Text style={[styles.body, { color: palette.muted }]} selectable>
            {item.text}
          </Text>
        ) : null}

        <Pressable
          onPress={confirmDelete}
          style={[styles.deleteBtn, { borderColor: palette.danger }]}
        >
          <Ionicons name="trash-outline" size={18} color={palette.danger} />
          <Text style={[styles.deleteText, { color: palette.danger }]}>Delete this dump</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
    gap: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  date: {
    fontSize: 13,
  },
  heroImage: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 16,
  },
  linkCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkHost: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  linkUrl: {
    fontSize: 12,
    lineHeight: 17,
  },
  openText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 29,
  },
  body: {
    fontSize: 15,
    lineHeight: 23,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderWidth: 1,
    borderRadius: 14,
    marginTop: 8,
  },
  deleteText: {
    fontSize: 15,
    fontWeight: '700',
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  missingText: {
    fontSize: 16,
  },
  missingBtn: {
    padding: 12,
  },
  missingBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
