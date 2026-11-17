import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Card, Text as PaperText, useTheme } from 'react-native-paper';
import { timeAgo } from '@/lib/time';
import type { KanbanState } from '@/lib/types';
import { useDumpStore } from '@/lib/dump-store';

const COLUMNS: { key: KanbanState; title: string }[] = [
  { key: 'todo', title: 'To do' },
  { key: 'doing', title: 'Doing' },
  { key: 'done', title: 'Done' },
];

const NEXT_STATE: Record<KanbanState, KanbanState> = {
  todo: 'doing',
  doing: 'done',
  done: 'todo',
};

/** Kanban board — every dump can be a card. Tap an arrow to advance. */
export default function BoardScreen() {
  const theme = useTheme();
  const { items, setKanbanState } = useDumpStore();
  const visible = items.filter((item) => !item.isPrivate);

  const columnItems = (state: KanbanState) =>
    visible.filter((item) => item.kanbanState === state);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 12, gap: 12 }}>
        {COLUMNS.map(({ key, title }) => (
          <View key={key} style={{ width: 272 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, paddingLeft: 4 }}>
              <PaperText variant="titleSmall" style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
                {title}
              </PaperText>
              <View
                style={{
                  minWidth: 26,
                  alignItems: 'center',
                  backgroundColor: theme.colors.primaryContainer,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: theme.colors.onPrimaryContainer, fontSize: 12, fontWeight: '800' }}>
                  {columnItems(key).length}
                </Text>
              </View>
            </View>
            <ScrollView showsVerticalScrollIndicator contentContainerStyle={{ gap: 10, paddingBottom: 24 }}>
              {columnItems(key).map((item) => (
                <Card
                  key={item.id}
                  mode="elevated"
                  onPress={() => router.push(`/item/${item.id}`)}
                  style={{ backgroundColor: theme.colors.surface }}
                >
                  <Card.Content style={{ gap: 6, paddingVertical: 10 }}>
                    <PaperText variant="bodyMedium" numberOfLines={2} style={{ color: theme.colors.onSurface, fontWeight: '600', lineHeight: 18 }}>
                      {item.title}
                    </PaperText>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 10, color: theme.colors.onSurfaceVariant }}>{timeAgo(item.createdAt)}</Text>
                      <PaperText
                        onPress={() => setKanbanState(item.id, NEXT_STATE[item.kanbanState])}
                        style={{ color: theme.colors.primary, fontWeight: '800', fontSize: 18, paddingHorizontal: 10, paddingVertical: 6 }}
                      >
                        →
                      </PaperText>
                    </View>
                  </Card.Content>
                </Card>
              ))}
              {columnItems(key).length === 0 && (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={{ color: theme.colors.outline, fontSize: 12 }}>Empty</Text>
                </View>
              )}
            </ScrollView>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
