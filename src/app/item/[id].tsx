import {
  ActivityIndicator,
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
import type { AgentStep } from '@/lib/types';

export default function DumpDetailScreen() {
  const palette = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, removeItem, rerunAgent } = useDumpStore();
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

        {/* ── THE AGENT — live research steps ─────────────────────── */}
        <AgentPanel item={item} onRerun={() => rerunAgent(item.id)} />

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

function StepIcon({ status, kind, palette }: { status: AgentStep['status']; kind: AgentStep['kind']; palette: ReturnType<typeof usePalette> }) {
  if (status === 'pending') {
    return <Ionicons name="ellipse-outline" size={16} color={palette.faint} />;
  }
  if (status === 'running') {
    return <ActivityIndicator size={14} color={palette.accent} />;
  }
  if (status === 'failed') {
    return <Ionicons name="close-circle" size={16} color={palette.danger} />;
  }
  if (status === 'skipped') {
    return <Ionicons name="remove-circle-outline" size={16} color={palette.faint} />;
  }
  if (kind === 'done') {
    return <Ionicons name="sparkles" size={16} color={palette.accent} />;
  }
  return <Ionicons name="checkmark-circle" size={16} color={palette.accent} />;
}

function AgentPanel({
  item,
  onRerun,
}: {
  item: import('@/lib/types').DumpItem;
  onRerun: () => void;
}) {
  const palette = usePalette();
  const active = item.agent === 'running' || item.agent === 'pending';
  const failed = item.agent === 'failed';

  return (
    <View style={[styles.agentCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <View style={styles.agentHeader}>
        <View style={styles.agentHeaderLeft}>
          <Ionicons name="flash" size={15} color={palette.accent} />
          <Text style={[styles.agentTitle, { color: palette.text }]}>THE AGENT</Text>
        </View>
        <Pressable
          onPress={onRerun}
          hitSlop={8}
          style={[styles.rerunBtn, { borderColor: palette.border }]}
        >
          <Ionicons name="refresh" size={14} color={palette.muted} />
          <Text style={[styles.rerunText, { color: palette.muted }]}>RE-RUN</Text>
        </Pressable>
      </View>

      {/* Step list */}
      {item.steps.length > 0 ? (
        item.steps.map((step) => (
          <View key={step.id} style={styles.stepRow}>
            <StepIcon status={step.status} kind={step.kind} palette={palette} />
            <View style={styles.stepTextWrap}>
              <Text style={[styles.stepLabel, { color: palette.text }]} numberOfLines={1}>
                {step.label}
              </Text>
              {step.detail ? (
                <Text style={[styles.stepDetail, { color: palette.muted }]} numberOfLines={2}>
                  {step.detail}
                </Text>
              ) : null}
            </View>
          </View>
        ))
      ) : active ? (
        <View style={styles.stepRow}>
          <ActivityIndicator size={14} color={palette.accent} />
          <Text style={[styles.stepLabel, { color: palette.muted }]}>Starting…</Text>
        </View>
      ) : null}

      {/* Summary */}
      {item.summary ? (
        <View style={[styles.summaryWrap, { borderTopColor: palette.border }]}>
          <Text style={[styles.summaryLabel, { color: palette.accent }]}>SUMMARY</Text>
          <Text style={[styles.summaryText, { color: palette.text }]} selectable>
            {item.summary}
          </Text>
        </View>
      ) : failed ? (
        <Text style={[styles.stepLabel, { color: palette.danger }]}>
          The agent hit an error. Tap RE-RUN.
        </Text>
      ) : null}
    </View>
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
  agentCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  agentHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  agentTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  rerunBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  rerunText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepTextWrap: {
    flex: 1,
    gap: 2,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  stepDetail: {
    fontSize: 11,
    lineHeight: 15,
  },
  summaryWrap: {
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 4,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 21,
  },
});
