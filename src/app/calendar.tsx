import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useDumpStore } from '@/lib/dump-store';
import { borders, colors, fonts } from '@/lib/theme';
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
  const { items } = useDumpStore();
  const visible = items.filter((item) => !item.isPrivate);

  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string>(() => dayKey(new Date()));

  // Map of YYYY-MM-DD → items whose reminder or creation lands on that day.
  const dayMap = useMemo(() => {
    const map = new Map<string, DumpItem[]>();
    for (const item of visible) {
      const keys = new Set<string>();
      keys.add(dayKey(new Date(item.createdAt)));
      for (const reminder of item.ai?.reminders ?? []) {
        keys.add(dayKey(new Date(reminder.at)));
      }
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
  const monthLabel = cursor.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  // Monday-first grid, 6 weeks.
  const cells: (Date | null)[] = [];
  const firstDay = new Date(year, month, 1);
  const lead = (firstDay.getDay() + 6) % 7; // 0 = Monday
  for (let i = 0; i < lead; i++) cells.push(null);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const itemsOnSelected = dayMap.get(selected) ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Month nav */}
        <View style={styles.monthNav}>
          <Pressable
            style={styles.navBtn}
            onPress={() => setCursor(new Date(year, month - 1, 1))}
          >
            <Text style={styles.navBtnText}>←</Text>
          </Pressable>
          <Text style={styles.monthLabel}>{monthLabel.toUpperCase()}</Text>
          <Pressable
            style={styles.navBtn}
            onPress={() => setCursor(new Date(year, month + 1, 1))}
          >
            <Text style={styles.navBtnText}>→</Text>
          </Pressable>
        </View>

        {/* Weekday headers */}
        <View style={styles.weekRow}>
          {WEEKDAYS.map((day, index) => (
            <Text key={index} style={styles.weekday}>
              {day}
            </Text>
          ))}
        </View>

        {/* Day grid */}
        <View style={styles.grid}>
          {cells.map((date, index) => {
            if (!date) {
              return <View key={`blank-${index}`} style={[styles.cell, styles.cellBlank]} />;
            }
            const key = dayKey(date);
            const dayItems = dayMap.get(key) ?? [];
            const hasReminder = dayItems.some((item) =>
              item.ai?.reminders.some((r) => dayKey(new Date(r.at)) === key)
            );
            const isSelected = selected === key;
            const isToday = dayKey(new Date()) === key;
            return (
              <Pressable
                key={key}
                onPress={() => setSelected(key)}
                style={[
                  styles.cell,
                  dayItems.length > 0 && styles.cellMarked,
                  isToday && styles.cellToday,
                  isSelected && styles.cellSelected,
                ]}
              >
                <Text style={[styles.cellDay, isToday && styles.cellDayToday]}>
                  {date.getDate()}
                </Text>
                {hasReminder && <View style={styles.reminderDot} />}
                {dayItems.length > 0 && <Text style={styles.cellCount}>{dayItems.length}</Text>}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.legend}>
          ■ ITEM · ● REMINDER · TAP A DAY TO SEE IT
        </Text>

        {/* Items on selected day */}
        <Text style={styles.sectionLabel}>
          {selected === dayKey(new Date()) ? 'TODAY' : selected} — {itemsOnSelected.length}
        </Text>
        {itemsOnSelected.length === 0 ? (
          <Text style={styles.empty}>NOTHING ON THIS DAY.</Text>
        ) : (
          itemsOnSelected.map((item) => (
            <Pressable
              key={item.id}
              style={styles.dayItem}
              onPress={() => router.push(`/item/${item.id}`)}
            >
              <Text style={styles.dayItemKind}>
                {item.kind.toUpperCase()}
                {item.ai?.status === 'done' ? ` · ${item.ai.category.toUpperCase()}` : ''}
              </Text>
              <Text style={styles.dayItemTitle} numberOfLines={2}>
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
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: borders.thick,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  navBtn: {
    borderWidth: borders.base,
    borderColor: colors.border,
    width: 44,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.text,
  },
  monthLabel: {
    fontFamily: fonts.display,
    fontSize: 14,
    letterSpacing: 2,
    color: colors.text,
  },
  weekRow: {
    flexDirection: 'row',
    gap: 6,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.muted,
    letterSpacing: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cell: {
    width: '13.6%',
    aspectRatio: 1,
    borderWidth: borders.base,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  cellBlank: {
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  cellMarked: {
    borderWidth: borders.thick,
  },
  cellToday: {
    borderWidth: borders.heavy,
  },
  cellSelected: {
    backgroundColor: colors.accent,
  },
  cellDay: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.text,
  },
  cellDayToday: {
    fontFamily: fonts.mono,
    fontWeight: 'bold',
  },
  reminderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
    position: 'absolute',
    top: 3,
    right: 3,
  },
  cellCount: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.muted,
    position: 'absolute',
    bottom: 2,
    right: 3,
  },
  legend: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.faint,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  sectionLabel: {
    fontFamily: fonts.label,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.text,
    borderTopWidth: borders.base,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  empty: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.faint,
    letterSpacing: 1,
    textAlign: 'center',
    paddingVertical: 24,
  },
  dayItem: {
    borderWidth: borders.base,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 10,
    gap: 4,
  },
  dayItemKind: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.5,
    color: colors.faint,
  },
  dayItemTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },
});
