import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useDumpStore } from '@/lib/dump-store';
import { borders, colors, fonts } from '@/lib/theme';
import { timeAgo } from '@/lib/time';
import type { DumpItem, KanbanState } from '@/lib/types';

const COLUMNS: { key: KanbanState; title: string }[] = [
  { key: 'todo', title: 'TO DO' },
  { key: 'doing', title: 'DOING' },
  { key: 'done', title: 'DONE' },
];

const NEXT_STATE: Record<KanbanState, KanbanState> = {
  todo: 'doing',
  doing: 'done',
  done: 'todo',
};

/** Kanban board — every dump can be a card. Tap advances its state. */
export default function BoardScreen() {
  const { items, setKanbanState } = useDumpStore();
  const visible = items.filter((item) => !item.isPrivate);

  const columnItems = (state: KanbanState) =>
    visible.filter((item) => item.kanbanState === state);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView horizontal contentContainerStyle={styles.board} showsHorizontalScrollIndicator={false}>
        {COLUMNS.map(({ key, title }) => (
          <View key={key} style={styles.column}>
            <View style={styles.columnHeader}>
              <Text style={styles.columnTitle}>{title}</Text>
              <Text style={styles.columnCount}>{columnItems(key).length}</Text>
            </View>
            <ScrollView style={styles.columnBody} contentContainerStyle={styles.columnCards}>
              {columnItems(key).map((item) => (
                <BoardCard
                  key={item.id}
                  item={item}
                  onAdvance={() => setKanbanState(item.id, NEXT_STATE[item.kanbanState])}
                  onOpen={() => router.push(`/item/${item.id}`)}
                />
              ))}
              {columnItems(key).length === 0 && (
                <Text style={styles.columnEmpty}>NOTHING HERE</Text>
              )}
            </ScrollView>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function BoardCard({
  item,
  onAdvance,
  onOpen,
}: {
  item: DumpItem;
  onAdvance: () => void;
  onOpen: () => void;
}) {
  return (
    <View style={styles.card}>
      <Pressable onPress={onOpen} hitSlop={4}>
        <Text style={styles.cardTitle} numberOfLines={3}>
          {item.title}
        </Text>
        {item.ai?.status === 'done' && (
          <Text style={styles.cardCategory} numberOfLines={1}>
            {item.ai.category.toUpperCase()}
          </Text>
        )}
        <Text style={styles.cardTime}>{timeAgo(item.createdAt)}</Text>
      </Pressable>
      <Pressable style={styles.advanceBtn} onPress={onAdvance}>
        <Text style={styles.advanceText}>→</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  board: {
    padding: 12,
    gap: 12,
  },
  column: {
    width: 264,
    backgroundColor: colors.sunken,
    borderWidth: borders.thick,
    borderColor: colors.border,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: borders.thick,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  columnTitle: {
    fontFamily: fonts.display,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.text,
  },
  columnCount: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.muted,
  },
  columnBody: {
    flex: 1,
  },
  columnCards: {
    padding: 10,
    gap: 10,
    paddingBottom: 24,
  },
  columnEmpty: {
    fontFamily: fonts.mono,
    color: colors.faint,
    fontSize: 10,
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 24,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: borders.base,
    borderColor: colors.border,
    padding: 10,
    gap: 6,
  },
  cardTitle: {
    fontFamily: fonts.bodySemi,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  cardCategory: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.faint,
  },
  cardTime: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.faint,
  },
  advanceBtn: {
    alignSelf: 'flex-end',
    borderWidth: borders.base,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  advanceText: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.text,
  },
});
