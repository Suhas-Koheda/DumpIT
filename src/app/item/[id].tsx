import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';

import Badge from '@/components/Badge';
import KnowledgeMap from '@/components/KnowledgeMap';
import { useDumpStore } from '@/lib/dump-store';
import { borders, colors, fonts } from '@/lib/theme';
import { fullDate } from '@/lib/time';

function formatShortDateTime(ts: number): string {
  return new Date(ts)
    .toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
    .toUpperCase();
}

const SOURCE_LABEL: Record<string, string> = {
  share: 'SHARED FROM ANOTHER APP',
  manual: 'ADDED BY HAND',
  sample: 'SAMPLE / SIMULATED SHARE',
};

function defaultReminderDate(): Date {
  return new Date(Date.now() + 60 * 60 * 1000);
}

export default function DumpDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    items,
    updateItem,
    removeItem,
    retryAiAnalysis,
    toggleTodo,
    togglePin,
    setTodoReminder,
    clearTodoReminder,
    aiState,
  } = useDumpStore();
  const item = items.find((entry) => entry.id === id);

  const [noteDraft, setNoteDraft] = useState(item?.note ?? '');
  const [tagsDraft, setTagsDraft] = useState(item?.tags.join(', ') ?? '');
  const [noteFocused, setNoteFocused] = useState(false);
  const [tagsFocused, setTagsFocused] = useState(false);
  const [pickingTodo, setPickingTodo] = useState<number | null>(null);
  const [pickedDate, setPickedDate] = useState(defaultReminderDate);

  if (!item) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.missing}>
          <Text style={styles.missingTitle}>DUMP NOT FOUND</Text>
          <Text style={styles.missingBody}>That dump is gone, traveler.</Text>
          <Pressable style={styles.missingBtn} onPress={() => router.back()}>
            <Text style={styles.missingBtnText}>BACK TO VAULT</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const commitNote = () => {
    if (noteDraft !== item.note) updateItem(item.id, { note: noteDraft.trim() });
  };

  const commitTags = () => {
    const parsed = tagsDraft
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    updateItem(item.id, { tags: parsed });
    setTagsDraft(parsed.join(', '));
  };

  const startPickingReminder = (index: number) => {
    setPickingTodo(index);
    setPickedDate(defaultReminderDate());
  };

  const commitReminder = async (todoIndex: number, date: Date) => {
    if (!item) return;
    const ok = await setTodoReminder(item.id, todoIndex, date.getTime());
    if (!ok) {
      Alert.alert(
        'Could not set reminder',
        'Notifications are blocked for this app, or scheduling failed. Enable notifications for DumpIT in system settings.'
      );
    }
    setPickingTodo(null);
  };

  const handlePickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'dismissed') {
      setPickingTodo(null);
      return;
    }
    if (date) {
      setPickedDate(date);
      if (Platform.OS === 'android' || event.type === 'set') {
        void commitReminder(pickingTodo ?? 0, date);
      }
    }
  };

  const confirmDelete = () => {
    Alert.alert('Burn this dump?', 'This removes it from your phone.', [
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
  };

  const openUrl = () => {
    if (item.url) Linking.openURL(item.url).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: 'DUMP' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <View style={styles.badgeRow}>
            <Badge item={item} />
            {item.ai?.status === 'done' && (
              <View style={styles.categoryChip}>
                <Text style={styles.categoryChipText}>{item.ai.category.toUpperCase()}</Text>
              </View>
            )}
          </View>
          <View style={styles.topRight}>
            <Text style={styles.date}>{fullDate(item.createdAt)}</Text>
            <Pressable onPress={() => togglePin(item.id)} style={[styles.pinChip, item.pinned && styles.pinChipActive]}>
              <Text style={[styles.pinChipText, item.pinned && styles.pinChipTextActive]}>
                {item.pinned ? 'PINNED' : 'PIN'}
              </Text>
            </Pressable>
          </View>
        </View>

        {item.kind === 'image' && item.imageUri ? (
          <Image source={{ uri: item.imageUri }} style={styles.heroImage} contentFit="contain" />
        ) : null}

        {item.url ? (
          <View style={styles.linkCard}>
            <Text style={styles.linkHost}>{item.urlHost ?? item.url}</Text>
            <Text style={styles.linkUrl} numberOfLines={2} selectable>
              {item.url}
            </Text>
            <Pressable style={styles.openBtn} onPress={openUrl}>
              <Text style={styles.openBtnText}>OPEN LINK →</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.title}>{item.title}</Text>
        {item.text ? (
          <Text style={styles.body} selectable>
            {item.text}
          </Text>
        ) : null}

        {/* THE ORACLE — heavier border = more importance */}
        <View style={styles.oracleCard}>
          <View style={styles.oracleHeader}>
            <Text style={styles.oracleTitle}>THE ORACLE SAYS</Text>
            {(item.ai?.status === 'analyzing' || item.ai?.status === 'pending') && aiState === 'ready' ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : null}
          </View>

          {item.ai?.status === 'done' ? (
            <View style={styles.oracleBody}>
              <Text style={styles.oracleSummary}>{item.ai.summary}</Text>

              <KnowledgeMap title={item.title} entities={item.ai.entities} />

              {item.ai.entities.length > 0 && (
                <View style={styles.oracleBlock}>
                  <Text style={styles.oracleLabel}>ENTITIES</Text>
                  <View style={styles.entityRow}>
                    {item.ai.entities.map((entity, index) => (
                      <View key={`${entity.type}-${entity.value}-${index}`} style={styles.entity}>
                        <Text style={styles.entityType}>{entity.type.toUpperCase()}</Text>
                        <Text style={styles.entityValue}>{entity.value}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {item.ai.todos.length > 0 && (
                <View style={styles.oracleBlock}>
                  <Text style={styles.oracleLabel}>TO-DOS</Text>
                  {item.ai.todos.map((todo, index) => {
                    const ai = item.ai!;
                    const done = ai.todosDone.includes(index);
                    const reminder = ai.reminders.find((r) => r.todoIndex === index);
                    return (
                      <View key={index} style={styles.todoRow}>
                        <Pressable
                          onPress={() => toggleTodo(item.id, index)}
                          style={styles.todoMain}
                          hitSlop={6}
                        >
                          <Text style={styles.todoBox}>{done ? '■' : '□'}</Text>
                          <Text style={[styles.todoText, done && styles.todoTextDone]}>
                            {todo}
                          </Text>
                        </Pressable>
                        <View style={styles.todoActions}>
                          {reminder ? (
                            <Text style={styles.reminderAt}>
                              {formatShortDateTime(reminder.at)}
                            </Text>
                          ) : null}
                          <Pressable
                            style={[styles.remindChip, reminder && styles.remindChipActive]}
                            onPress={() =>
                              reminder
                                ? clearTodoReminder(item.id, index)
                                : startPickingReminder(index)
                            }
                          >
                            <Text
                              style={[
                                styles.remindChipText,
                                reminder && styles.remindChipTextActive,
                              ]}
                            >
                              {reminder ? 'CANCEL' : 'REMIND'}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {item.ai.links.length > 0 && (
                <View style={styles.oracleBlock}>
                  <Text style={styles.oracleLabel}>LINKS FOUND</Text>
                  {item.ai.links.map((link, index) => (
                    <Text key={index} style={styles.oracleLink} selectable>
                      {link}
                    </Text>
                  ))}
                </View>
              )}

              {pickingTodo !== null && (
                <DateTimePicker
                  value={pickedDate}
                  mode="datetime"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handlePickerChange}
                />
              )}

              {item.ai.sources.length > 0 && (
                <View style={styles.oracleBlock}>
                  <Text style={styles.oracleLabel}>AGENT VISITED</Text>
                  {item.ai.sources.map((source, index) => (
                    <Text key={index} style={styles.sourceLine}>
                      {String(index + 1).padStart(2, '0')} — {source}
                    </Text>
                  ))}
                </View>
              )}

              {item.ai.pageText ? (
                <View style={styles.oracleBlock}>
                  <Text style={styles.oracleLabel}>PAGE CONTENT (FROM THE LINK)</Text>
                  <Text style={styles.ocrText} selectable>
                    {item.ai.pageText}
                  </Text>
                </View>
              ) : null}

              {item.ai.ocrText ? (
                <View style={styles.oracleBlock}>
                  <Text style={styles.oracleLabel}>SCREENSHOT TEXT (OCR)</Text>
                  <Text style={styles.ocrText} selectable>
                    {item.ai.ocrText}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : item.ai?.status === 'error' ? (
            <View style={styles.oracleBody}>
              <Text style={styles.oracleError}>THE ORACLE STUMBLED: {item.ai.error}</Text>
              <Pressable style={styles.retryBtn} onPress={() => retryAiAnalysis(item.id)}>
                <Text style={styles.retryText}>ASK AGAIN</Text>
              </Pressable>
            </View>
          ) : aiState !== 'ready' ? (
            <View style={styles.oracleBody}>
              <Text style={styles.oracleHint}>
                WAITING FOR THE ORACLE. Download the on-device models from the inbox banner —
                no cloud, no tokens. This dump gets read automatically.
              </Text>
            </View>
          ) : (
            <View style={styles.oracleBody}>
              <Text style={styles.oracleHint}>THE ORACLE IS READING THIS DUMP…</Text>
            </View>
          )}
        </View>

        {/* Note */}
        <Text style={styles.sectionLabel}>NOTE</Text>
        <TextInput
          value={noteDraft}
          onChangeText={setNoteDraft}
          onBlur={() => {
            setNoteFocused(false);
            commitNote();
          }}
          onFocus={() => setNoteFocused(true)}
          placeholder="WHAT DOES THIS ONE MEAN?"
          placeholderTextColor={colors.faint}
          style={[styles.noteInput, noteFocused && styles.inputFocused]}
          multiline
          textAlignVertical="top"
        />

        {/* Tags */}
        <Text style={styles.sectionLabel}>TAGS</Text>
        <TextInput
          value={tagsDraft}
          onChangeText={setTagsDraft}
          onBlur={() => {
            setTagsFocused(false);
            commitTags();
          }}
          onFocus={() => setTagsFocused(true)}
          placeholder="ai, reading, work"
          placeholderTextColor={colors.faint}
          style={[styles.tagsInput, tagsFocused && styles.inputFocused]}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {item.tags.length > 0 && (
          <View style={styles.tagRow}>
            {item.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.source}>{SOURCE_LABEL[item.source] ?? item.source}</Text>
        <Pressable style={styles.deleteBtn} onPress={confirmDelete}>
          <Text style={styles.deleteText}>BURN THIS DUMP</Text>
        </Pressable>
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
    padding: 20,
    paddingBottom: 44,
    gap: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryChip: {
    borderWidth: borders.base,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  categoryChipText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.5,
    color: colors.text,
  },
  pinChip: {
    borderWidth: borders.base,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  pinChipActive: {
    backgroundColor: colors.accent,
  },
  pinChipText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.5,
    color: colors.text,
  },
  pinChipTextActive: {
    color: colors.ink,
  },
  todoTextDone: {
    textDecorationLine: 'line-through',
    color: colors.faint,
  },
  date: {
    fontFamily: fonts.mono,
    color: colors.faint,
    fontSize: 11,
  },
  heroImage: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: colors.sunken,
    borderWidth: borders.thick,
    borderColor: colors.border,
  },
  linkCard: {
    borderWidth: borders.thick,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    padding: 12,
    gap: 8,
  },
  linkHost: {
    fontFamily: fonts.mono,
    color: colors.blue,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    textDecorationLine: 'underline',
  },
  linkUrl: {
    fontFamily: fonts.mono,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  openBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: borders.base,
    borderColor: colors.border,
  },
  openBtnText: {
    fontFamily: fonts.label,
    color: colors.ink,
    fontSize: 11,
    letterSpacing: 1.5,
  },
  title: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 19,
    lineHeight: 24,
  },
  body: {
    fontFamily: fonts.body,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  oracleCard: {
    backgroundColor: colors.bg,
    borderWidth: borders.heavy,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  oracleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: borders.base,
    borderBottomColor: colors.border,
    paddingBottom: 10,
  },
  oracleTitle: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 13,
    letterSpacing: 2,
  },
  oracleBody: {
    gap: 12,
  },
  oracleSummary: {
    fontFamily: fonts.bodySemi,
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  oracleBlock: {
    gap: 6,
  },
  oracleLabel: {
    fontFamily: fonts.label,
    color: colors.faint,
    fontSize: 9,
    letterSpacing: 2,
  },
  entityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  entity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: borders.base,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  entityType: {
    fontFamily: fonts.mono,
    color: colors.faint,
    fontSize: 8,
    letterSpacing: 1,
  },
  entityValue: {
    fontFamily: fonts.bodyMedium,
    color: colors.text,
    fontSize: 11,
  },
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'space-between',
  },
  todoMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    flex: 1,
  },
  todoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reminderAt: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.5,
    color: colors.muted,
  },
  remindChip: {
    borderWidth: borders.base,
    borderColor: colors.border,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  remindChipActive: {
    backgroundColor: colors.accent,
  },
  remindChipText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.text,
  },
  remindChipTextActive: {
    color: colors.ink,
  },
  todoBox: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    lineHeight: 20,
  },
  todoText: {
    flex: 1,
    fontFamily: fonts.body,
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
  },
  oracleLink: {
    fontFamily: fonts.mono,
    color: colors.blue,
    fontSize: 10,
    lineHeight: 16,
    textDecorationLine: 'underline',
  },
  sourceLine: {
    fontFamily: fonts.mono,
    color: colors.muted,
    fontSize: 10,
    lineHeight: 16,
  },
  ocrText: {
    fontFamily: fonts.mono,
    color: colors.muted,
    fontSize: 10,
    lineHeight: 15,
    backgroundColor: colors.sunken,
    borderWidth: borders.base,
    borderColor: colors.border,
    padding: 10,
  },
  oracleError: {
    fontFamily: fonts.body,
    color: colors.error,
    fontSize: 12,
    lineHeight: 17,
  },
  oracleHint: {
    fontFamily: fonts.body,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    borderWidth: borders.thick,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  retryText: {
    fontFamily: fonts.label,
    color: colors.text,
    fontSize: 11,
    letterSpacing: 1.5,
  },
  sectionLabel: {
    fontFamily: fonts.label,
    color: colors.text,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 2,
  },
  noteInput: {
    fontFamily: fonts.mono,
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
    backgroundColor: colors.sunken,
    borderWidth: borders.thick,
    borderColor: colors.border,
    padding: 12,
    minHeight: 88,
  },
  tagsInput: {
    fontFamily: fonts.mono,
    color: colors.text,
    fontSize: 12,
    backgroundColor: colors.sunken,
    borderWidth: borders.thick,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 46,
  },
  inputFocused: {
    borderWidth: borders.heavy,
    padding: 10,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: colors.sunken,
    borderWidth: borders.base,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontFamily: fonts.mono,
    color: colors.muted,
    fontSize: 11,
  },
  source: {
    fontFamily: fonts.mono,
    color: colors.faint,
    fontSize: 10,
    letterSpacing: 1,
    marginTop: 2,
  },
  deleteBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    backgroundColor: colors.error,
    borderWidth: borders.thick,
    borderColor: colors.border,
    marginTop: 6,
  },
  deleteText: {
    fontFamily: fonts.label,
    color: colors.ink,
    fontSize: 12,
    letterSpacing: 2,
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  missingTitle: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 22,
    letterSpacing: 2,
  },
  missingBody: {
    fontFamily: fonts.body,
    color: colors.muted,
    fontSize: 14,
  },
  missingBtn: {
    borderWidth: borders.thick,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  missingBtnText: {
    fontFamily: fonts.label,
    color: colors.text,
    fontSize: 11,
    letterSpacing: 2,
  },
});
