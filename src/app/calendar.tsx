import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Appbar, Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';

import { useDumpStore } from '@/lib/dump-store';
import type { DumpItem } from '@/lib/types';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Month grid — every day that has a reminder or an item is marked. */
export default function CalendarScreen() {
  const theme = useTheme();
  const { items } = useDumpStore();
  const visible = items.filter((item) => !item.isPrivate);

  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string>(() => dayKey(new Date()));

  const dayMap = useMemo(() => {
    const map = new Map<string, DumpItem[]>();
    for (const item of visible) {
      const keys = new Set<string>();
      keys.add(dayKey(new Date(item.createdAt)));
      for (const r of item.ai?.reminders ?? []) keys.add(dayKey(new Date(r.at)));
      for (const key of keys) {
        const list = map.get(key) ?? [];
        list.push(item);
        map.set(key, list);
      }
    }
    return map;
  }, [visible]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const cells: (Date | null)[] = [];
  const firstDay = new Date(year, month, 1);
  const lead = (firstDay.getDay() + 6) % 7;
  for (let i = 0; i < lead; i++) cells.push(null);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const itemsOnSelected = dayMap.get(selected) ?? [];
  const todayKey = dayKey(new Date());

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
      <Appbar.Header elevated={false} style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Calendar" titleStyle={{ fontSize: 17, fontWeight: '600' }} />
      </Appbar.Header>
      <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }}>
        {/* Month navigation */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
          <Ionicons
            name="chevron-back"
            size={26}
            color={theme.colors.onSurfaceVariant}
            onPress={() => setCursor(new Date(year, month - 1, 1))}
          />
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
            {monthLabel}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={26}
            color={theme.colors.onSurfaceVariant}
            onPress={() => setCursor(new Date(year, month + 1, 1))}
          />
        </View>

        {/* Weekday headers */}
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {WEEKDAYS.map((d, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.onSurfaceVariant }}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Day grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {cells.map((date, index) => {
            if (!date) return <View key={`blank-${index}`} style={{ width: '13.1%', aspectRatio: 1 }} />;
            const key = dayKey(date);
            const dayItems = dayMap.get(key) ?? [];
            const isSelected = selected === key;
            const isToday = todayKey === key;
            return (
              <Pressable
                key={key}
                onPress={() => setSelected(key)}
                style={{
                  width: '13.1%',
                  aspectRatio: 1,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isSelected
                    ? theme.colors.primary
                    : dayItems.length
                      ? theme.colors.primaryContainer
                      : theme.colors.surfaceVariant,
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: isToday || isSelected ? '800' : '500',
                    color: isSelected ? theme.colors.onPrimary : theme.colors.onSurface,
                  }}
                >
                  {date.getDate()}
                </Text>
                {dayItems.length > 0 ? (
                  <Text style={{ fontSize: 9, fontWeight: '700', color: isSelected ? theme.colors.onPrimary : theme.colors.onPrimaryContainer }}>
                    {dayItems.length}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {/* Items on selected day */}
        <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
          {selected === todayKey ? 'Today' : selected} — {itemsOnSelected.length}
        </Text>
        {itemsOnSelected.length === 0 ? (
          <Text variant="bodyMedium" style={{ color: theme.colors.outline, textAlign: 'center', paddingVertical: 24 }}>
            Nothing lands on this day.
          </Text>
        ) : (
          itemsOnSelected.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => router.push(`/item/${item.id}`)}
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: 14,
                padding: 12,
                gap: 4,
              }}
            >
              <Text style={{ fontSize: 10, letterSpacing: 1, color: theme.colors.onSurfaceVariant, textTransform: 'uppercase' }}>
                {item.kind}{item.ai?.status === 'done' ? ` · ${item.ai.category}` : ''}
              </Text>
              <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: '600', color: theme.colors.onSurface, lineHeight: 21 }}>
                {item.title}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
