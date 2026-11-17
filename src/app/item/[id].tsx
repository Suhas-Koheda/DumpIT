import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Image } from 'expo-image';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import {
  ActivityIndicator,
  Appbar,
  Button,
  Card,
  Chip,
  Divider,
  IconButton,
  Surface,
  TextInput,
  Text,
  useTheme,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Directory, File, Paths } from 'expo-file-system';
import Markdown from 'react-native-markdown-display';
import {
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
} from 'expo-audio';

import Badge from '@/components/Badge';
import KnowledgeMap from '@/components/KnowledgeMap';
import { useDumpStore } from '@/lib/dump-store';
import { fullDate } from '@/lib/time';
import { makeId } from '@/lib/classify';
// whisper.rn ships no root "." export; Metro resolves it via its "react-native" field,
// and the "whisper.rn/index" subpath gives TypeScript the declarations for it.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { initWhisper } = require('whisper.rn') as typeof import('whisper.rn/index');

function newId(): string {
  return makeId();
}
function makeAttachmentEntry(name: string, uri: string, mimeType: string | null, size: number | null) {
  return { id: newId(), name, uri, mimeType, size };
}
function makeMemoEntry(uri: string) {
  return { id: newId(), uri, createdAt: Date.now() };
}
function defaultReminderDate(): Date {
  return new Date(Date.now() + 60 * 60 * 1000);
}
function formatShortDateTime(ts: number): string {
  return new Date(ts)
    .toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    .toUpperCase();
}

export default function DumpDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    items,
    updateItem,
    removeItem,
    retryAiAnalysis,
    toggleTodo,
    togglePin,
    togglePrivate,
    setTodoReminder,
    clearTodoReminder,
    setBody,
    assignFolder,
    addAttachment,
    removeAttachment,
    addMemo,
    removeMemo,
    setKanbanState,
    folders,
    aiState,
  } = useDumpStore();
  const item = items.find((entry) => entry.id === id);

  const [noteDraft, setNoteDraft] = useState(item?.note ?? '');
  const [tagsDraft, setTagsDraft] = useState(item?.tags.join(', ') ?? '');
  const [bodyDraft, setBodyDraft] = useState(item?.body ?? item?.text ?? '');
  const [bodyEditing, setBodyEditing] = useState(false);
  const [pickingTodo, setPickingTodo] = useState<number | null>(null);
  const [pickedDate, setPickedDate] = useState(defaultReminderDate);
  const [translateTo, setTranslateTo] = useState<string | null>(null);
  const [translation, setTranslation] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [whisperProgress, setWhisperProgress] = useState<number | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  const markdownStyle: Record<string, object> = {
    body: { color: theme.colors.onSurface, fontSize: 16, lineHeight: 24 },
    heading1: { color: theme.colors.onSurface, fontWeight: '800', fontSize: 22, marginTop: 8 },
    heading2: { color: theme.colors.onSurface, fontWeight: '800', fontSize: 18, marginTop: 8 },
    heading3: { color: theme.colors.onSurface, fontWeight: '700', fontSize: 16 },
    strong: { fontWeight: '700' },
    em: { fontStyle: 'italic' },
    code_inline: { fontFamily: 'monospace', backgroundColor: theme.colors.surfaceVariant, fontSize: 12 },
    fence: { fontFamily: 'monospace', backgroundColor: theme.colors.surfaceVariant, fontSize: 11, padding: 8 },
    link: { color: theme.colors.primary, textDecorationLine: 'underline' },
    blockquote: { backgroundColor: theme.colors.surfaceVariant, padding: 10, borderRadius: 10 },
  };

  if (!item) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', gap: 12 }} edges={['bottom']}>
        <Ionicons name="alert-circle-outline" size={48} color={theme.colors.outline} />
        <Text variant="titleMedium">That dump is gone</Text>
        <Button mode="contained" onPress={() => router.back()}>Back to inbox</Button>
      </SafeAreaView>
    );
  }

  const commitNote = () => {
    if (noteDraft !== item.note) updateItem(item.id, { note: noteDraft.trim() });
  };
  const commitTags = () => {
    const parsed = tagsDraft.split(',').map((t) => t.trim()).filter(Boolean);
    updateItem(item.id, { tags: parsed });
    setTagsDraft(parsed.join(', '));
  };
  const commitBody = () => {
    const value = bodyDraft.trim();
    if (value !== (item.body ?? '')) setBody(item.id, value || '');
    setBodyEditing(false);
  };

  const attachFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const dir = new Directory(Paths.document, 'dumpit-attachments');
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const dest = new File(dir, `${newId()}-${asset.name ?? 'file'}`);
    try { await new File(asset.uri).copy(dest); } catch {}
    addAttachment(item.id, makeAttachmentEntry(asset.name ?? 'file', dest.exists ? dest.uri : asset.uri, asset.mimeType ?? null, asset.size ?? null));
  };
  const openAttachment = async (uri: string) => {
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { dialogTitle: 'Open with…' });
  };

  const toggleRecording = async () => {
    if (recorderState.isRecording) {
      await recorder.stop();
      const uri = recorder.uri;
      if (uri) {
        const dir = new Directory(Paths.document, 'dumpit-memos');
        if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
        const dest = new File(dir, `memo-${newId()}.m4a`);
        try { await new File(uri).copy(dest); } catch {}
        addMemo(item.id, makeMemoEntry(dest.exists ? dest.uri : uri));
      }
    } else {
      await recorder.prepareToRecordAsync();
      recorder.record();
    }
  };

  const whisperModelFile = () => {
    const dir = new Directory(Paths.document, 'dumpit-models');
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    return new File(dir, 'ggml-tiny.en.bin');
  };

  const transcribeMemo = async (memoUri: string) => {
    setTranscribing(true);
    try {
      const model = whisperModelFile();
      if (!model.exists || model.size === 0) {
        setWhisperProgress(0);
        const task = File.createDownloadTask(
          'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin',
          model,
          {
            onProgress: ({ bytesWritten, totalBytes }) => {
              const total = totalBytes > 0 ? totalBytes : 77_704_715;
              setWhisperProgress(Math.min(1, bytesWritten / total));
            },
          }
        );
        await task.downloadAsync();
        setWhisperProgress(null);
      }
      const context = await initWhisper({ filePath: model.uri, useGpu: true });
      const { promise } = context.transcribe(memoUri, { language: 'en' });
      const result = await promise;
      const text = result.result?.trim();
      if (text) {
        const next = (bodyDraft.trim() ? bodyDraft.trim() + '\n\n' : '') + text;
        setBodyDraft(next);
        setBody(item.id, next);
      }
    } catch (error) {
      Alert.alert('Transcription failed', error instanceof Error ? error.message : String(error));
    } finally {
      setTranscribing(false);
      setWhisperProgress(null);
    }
  };

  const translate = async (to: 'ru' | 'es' | 'hi' | 'fr') => {
    setTranslating(true);
    setTranslateTo(to);
    setTranslation(null);
    try {
      const { translate, downloadModels, TranslateLanguage } = await import('react-native-mlkit-translation');
      const lang = to === 'ru' ? TranslateLanguage.RUSSIAN : to === 'es' ? TranslateLanguage.SPANISH : to === 'hi' ? TranslateLanguage.HINDI : TranslateLanguage.FRENCH;
      await downloadModels([lang], { wifiOnly: true });
      const input = (item.body ?? item.text ?? item.title).trim().slice(0, 1200) || item.title;
      const out = await translate({ text: input, from: TranslateLanguage.ENGLISH, to: lang });
      setTranslation(out);
    } catch (error) {
      setTranslation(`⚠ ${error instanceof Error ? error.message : 'Translation failed — needs model download (Wi-Fi).'}`);
    } finally {
      setTranslating(false);
    }
  };

  const startPickingReminder = (index: number) => {
    setPickingTodo(index);
    setPickedDate(defaultReminderDate());
  };
  const commitReminder = async (todoIndex: number, date: Date) => {
    const ok = await setTodoReminder(item.id, todoIndex, date.getTime());
    if (!ok) {
      Alert.alert('Could not set reminder', 'Notifications blocked or scheduling failed.');
    }
    setPickingTodo(null);
  };
  const handlePickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'dismissed') return setPickingTodo(null);
    if (date) {
      setPickedDate(date);
      if (Platform.OS === 'android' || event.type === 'set') {
        void commitReminder(pickingTodo ?? 0, date);
      }
    }
  };

  const confirmDelete = () =>
    Alert.alert('Burn this dump?', 'This removes it from your phone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { removeItem(item.id); router.back(); } },
    ]);

  const openUrl = () => { if (item.url) Linking.openURL(item.url).catch(() => {}); };

  const ai = item.ai;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Dump' }} />
      <Appbar.Header elevated={false} style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Dump" titleStyle={{ fontSize: 16, fontWeight: '600' }} />
        <IconButton icon={item.pinned ? 'pin' : 'pin-outline'} iconColor={item.pinned ? theme.colors.primary : theme.colors.onSurfaceVariant} onPress={() => togglePin(item.id)} />
        <IconButton icon={item.isPrivate ? 'lock' : 'lock-open-outline'} iconColor={item.isPrivate ? theme.colors.error : theme.colors.onSurfaceVariant} onPress={() => togglePrivate(item.id)} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Meta row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Badge item={item} />
            {ai?.status === 'done' && (
              <Chip compact style={{ backgroundColor: theme.colors.secondaryContainer }} textStyle={{ color: theme.colors.onSecondaryContainer, fontSize: 10 }}>
                {ai.category.toUpperCase()}
              </Chip>
            )}
          </View>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{fullDate(item.createdAt)}</Text>
        </View>

        {/* Hero image */}
        {item.kind === 'image' && item.imageUri ? (
          <Image source={{ uri: item.imageUri }} style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: 14, backgroundColor: theme.colors.surfaceVariant }} contentFit="contain" />
        ) : null}

        {/* Link card */}
        {item.url ? (
          <Card onPress={openUrl} style={{ backgroundColor: theme.colors.surface }}>
            <Card.Content style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="link" size={16} color={theme.colors.primary} />
                <Text variant="labelMedium" style={{ color: theme.colors.primary, fontWeight: '800', flex: 1 }} numberOfLines={1}>
                  {item.urlHost ?? item.url}
                </Text>
                <Ionicons name="open-outline" size={16} color={theme.colors.onSurfaceVariant} />
              </View>
              <Text variant="bodySmall" selectable numberOfLines={2} style={{ color: theme.colors.onSurfaceVariant }}>{item.url}</Text>
              <Button mode="contained-tonal" compact onPress={openUrl} style={{ alignSelf: 'flex-start' }}>Open link</Button>
            </Card.Content>
          </Card>
        ) : null}

        {/* Title */}
        <Text variant="headlineSmall" style={{ color: theme.colors.onSurface, fontWeight: '800', lineHeight: 30 }}>{item.title}</Text>
        {item.text && item.kind !== 'image' ? (
          <Text variant="bodyMedium" selectable style={{ color: theme.colors.onSurfaceVariant }}>{item.text}</Text>
        ) : null}

        {/* The Oracle */}
        <Card style={{ backgroundColor: ai?.status === 'done' ? theme.colors.surfaceVariant : theme.colors.surfaceVariant }}>
          <Card.Title
            title="The Oracle"
            titleStyle={{ fontWeight: '800', letterSpacing: 1, fontSize: 13 }}
            left={() => <Ionicons name="sparkles" size={18} color={theme.colors.primary} style={{ marginLeft: 16, marginTop: 14 }} />}
            right={() => ((ai?.status === 'analyzing' || ai?.status === 'pending') && aiState === 'ready')
              ? <ActivityIndicator size="small" style={{ marginRight: 16 }} />
              : null}
          />
          <Card.Content style={{ gap: 12 }}>
            {ai?.status === 'done' ? (
              <>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, lineHeight: 19 }}>{ai.summary}</Text>

                <KnowledgeMap title={item.title} entities={ai.entities} />

                {ai.entities.length > 0 && (
                  <View style={{ gap: 6 }}>
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Entities</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {ai.entities.map((e, i) => (
                        <Chip key={i} compact style={{ backgroundColor: theme.colors.secondaryContainer }} textStyle={{ fontSize: 11, color: theme.colors.onSecondaryContainer }}>
                          {e.type}: {e.value}
                        </Chip>
                      ))}
                    </View>
                  </View>
                )}

                {ai.todos.length > 0 && (
                  <View style={{ gap: 6 }}>
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>To-dos</Text>
                    {ai.todos.map((todo, index) => {
                      const done = ai.todosDone.includes(index);
                      const reminder = ai.reminders.find((r) => r.todoIndex === index);
                      return (
                        <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Pressable onPress={() => toggleTodo(item.id, index)} hitSlop={6}>
                            <Ionicons name={done ? 'checkbox' : 'square-outline'} size={20} color={done ? theme.colors.primary : theme.colors.onSurfaceVariant} />
                          </Pressable>
                          <Text variant="bodyMedium" style={{ flex: 1, color: done ? theme.colors.onSurfaceVariant : theme.colors.onSurface, textDecorationLine: done ? 'line-through' : 'none' }} numberOfLines={2}>
                            {todo}
                          </Text>
                          {reminder ? (
                            <Pressable onPress={() => clearTodoReminder(item.id, index)} style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: theme.colors.tertiaryContainer }}>
                              <Text style={{ fontSize: 9, color: theme.colors.onTertiaryContainer }}>{formatShortDateTime(reminder.at)}</Text>
                            </Pressable>
                          ) : null}
                          <IconButton icon="alarm" size={16} onPress={() => startPickingReminder(index)} />
                        </View>
                      );
                    })}
                  </View>
                )}

                {ai.links.length > 0 && (
                  <View style={{ gap: 4 }}>
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Links found</Text>
                    {ai.links.map((link, i) => (
                      <Text key={i} variant="bodySmall" selectable style={{ color: theme.colors.primary }}>{link}</Text>
                    ))}
                  </View>
                )}

                {ai.sources.length > 0 && (
                  <View style={{ gap: 4 }}>
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Agent visited</Text>
                    {ai.sources.map((s, i) => (
                      <Text key={i} variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{String(i + 1).padStart(2, '0')} — {s}</Text>
                    ))}
                  </View>
                )}

                {ai.pageText ? (
                  <View style={{ gap: 4 }}>
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Page content</Text>
                    <Text variant="bodySmall" selectable style={{ color: theme.colors.onSurfaceVariant, fontFamily: 'monospace', fontSize: 10, lineHeight: 15 }}>
                      {ai.pageText}
                    </Text>
                  </View>
                ) : null}

                {ai.ocrText ? (
                  <View style={{ gap: 4 }}>
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Screenshot text (OCR)</Text>
                    <Text variant="bodySmall" selectable style={{ color: theme.colors.onSurfaceVariant, fontFamily: 'monospace', fontSize: 10, lineHeight: 15 }}>
                      {ai.ocrText}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : ai?.status === 'error' ? (
              <View style={{ gap: 10 }}>
                <Text variant="bodySmall" style={{ color: theme.colors.error }}>{ai.error}</Text>
                <Button mode="outlined" compact onPress={() => retryAiAnalysis(item.id)}>Ask again</Button>
              </View>
            ) : aiState !== 'ready' ? (
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Waiting for on-device AI — the models have not downloaded yet (see the inbox banner).
              </Text>
            ) : (
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                The oracle is reading this dump…
              </Text>
            )}
          </Card.Content>
        </Card>

        {pickingTodo !== null && (
          <DateTimePicker value={pickedDate} mode="datetime" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={handlePickerChange} />
        )}

        {/* Note */}
        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, fontWeight: '700' }}>NOTE</Text>
        <TextInput
          value={noteDraft}
          onChangeText={setNoteDraft}
          onBlur={commitNote}
          placeholder="What does this one mean?"
          multiline
          mode="outlined"
          style={{ backgroundColor: theme.colors.surface }}
        />

        {/* Tags */}
        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, fontWeight: '700' }}>TAGS</Text>
        <TextInput
          value={tagsDraft}
          onChangeText={setTagsDraft}
          onBlur={commitTags}
          placeholder="ai, reading, work"
          autoCapitalize="none"
          autoCorrect={false}
          mode="outlined"
          dense
          style={{ backgroundColor: theme.colors.surface }}
        />
        {item.tags.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {item.tags.map((tag) => (
              <Chip key={tag} compact style={{ backgroundColor: theme.colors.surfaceVariant }} textStyle={{ fontSize: 11 }}>#{tag}</Chip>
            ))}
          </View>
        )}

        {/* Markdown body */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, fontWeight: '700' }}>BODY</Text>
          <Button compact mode="text" onPress={() => setBodyEditing((v) => !v)}>
            {bodyEditing ? 'Preview' : 'Edit'}
          </Button>
        </View>
        {bodyEditing ? (
          <>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {['## ', '**', '*', '- ', '[ ] ', '> ', '`'].map((t) => (
                <Chip key={t} compact onPress={() => setBodyDraft((p) => p + t)}>
                  {t === '## ' ? 'H' : t === '- ' ? 'List' : t === '[ ] ' ? 'Todo' : t === '> ' ? 'Quote' : t === '`' ? 'Code' : t}
                </Chip>
              ))}
            </View>
            <TextInput
              value={bodyDraft}
              onChangeText={setBodyDraft}
              onBlur={commitBody}
              placeholder="Write the note here — markdown supported."
              multiline
              mode="outlined"
              style={{ minHeight: 160, backgroundColor: theme.colors.surface, fontFamily: 'monospace' }}
            />
          </>
        ) : (
          <Surface style={{ padding: 12, borderRadius: 14, backgroundColor: theme.colors.surface }}>
            <Markdown style={markdownStyle}>{bodyDraft.trim() || '_Nothing yet. Tap Edit._'}</Markdown>
          </Surface>
        )}

        {/* Blocks + board */}
        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, fontWeight: '700' }}>BLOCK</Text>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Chip compact selected={item.folderId === null} showSelectedOverlay={false} onPress={() => assignFolder(item.id, null)}>None</Chip>
          {folders.map((f) => (
            <Chip
              key={f.id}
              compact
              selected={item.folderId === f.id}
              showSelectedOverlay={false}
              onPress={() => assignFolder(item.id, f.id)}
              avatar={<View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: f.color }} />}
            >
              {f.name}
            </Chip>
          ))}
        </View>

        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, fontWeight: '700' }}>BOARD</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['todo', 'doing', 'done'] as const).map((state) => (
            <Chip key={state} compact mode={item.kanbanState === state ? 'flat' : 'outlined'} showSelectedOverlay={false} selected={item.kanbanState === state} onPress={() => setKanbanState(item.id, state)}>
              {state === 'todo' ? 'To do' : state === 'doing' ? 'Doing' : 'Done'}
            </Chip>
          ))}
        </View>

        {/* Attachments */}
        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, fontWeight: '700' }}>ATTACHMENTS</Text>
        {item.attachments.map((a) => (
          <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surface, borderRadius: 12, padding: 10 }}>
            <Ionicons name="document-attach-outline" size={20} color={theme.colors.onSurfaceVariant} />
            <Pressable style={{ flex: 1 }} onPress={() => openAttachment(a.uri)}>
              <Text variant="bodyMedium" numberOfLines={1} style={{ color: theme.colors.onSurface }}>{a.name}</Text>
            </Pressable>
            <IconButton icon="close" size={16} onPress={() => removeAttachment(item.id, a.id)} />
          </View>
        ))}
        <Button mode="outlined" icon="paperclip" onPress={attachFile}>Attach file</Button>

        {/* Voice memos */}
        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, fontWeight: '700' }}>VOICE MEMOS</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Button
            mode={recorderState.isRecording ? 'contained' : 'contained-tonal'}
            icon={recorderState.isRecording ? 'stop' : 'microphone'}
            onPress={toggleRecording}
          >
            {recorderState.isRecording ? 'Stop' : 'Record'}
          </Button>
          {whisperProgress !== null && (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Whisper {Math.round(whisperProgress * 100)}%
            </Text>
          )}
        </View>
        {item.memos.map((memo) => (
          <MemoRow
            key={memo.id}
            uri={memo.uri}
            onDelete={() => removeMemo(item.id, memo.id)}
            onTranscribe={() => transcribeMemo(memo.uri)}
            transcribing={transcribing}
          />
        ))}

        {/* Translation */}
        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, fontWeight: '700' }}>TRANSLATE (ON-DEVICE)</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['ru', 'es', 'hi', 'fr'] as const).map((lang) => (
            <Chip key={lang} compact selected={translateTo === lang} showSelectedOverlay={false} onPress={() => translate(lang)}>
              {lang.toUpperCase()}
            </Chip>
          ))}
        </View>
        {translating && <ActivityIndicator size="small" />}
        {translation && (
          <Surface style={{ padding: 10, borderRadius: 12, backgroundColor: theme.colors.surface }}>
            <Text variant="bodyMedium" selectable style={{ color: theme.colors.onSurface }}>{translation}</Text>
          </Surface>
        )}

        {/* Danger zone */}
        <Divider style={{ marginVertical: 4 }} />
        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>{sourceLabel(item.source)}</Text>
        <Button mode="contained" icon="fire" buttonColor={theme.colors.errorContainer} textColor={theme.colors.onErrorContainer} onPress={confirmDelete}>
          Burn this dump
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

function sourceLabel(source: string) {
  return source === 'share' ? 'Claimed from the share sheet' : source === 'manual' ? 'Added by hand' : 'Sample / simulated share';
}

function MemoRow({
  uri,
  onDelete,
  onTranscribe,
  transcribing,
}: {
  uri: string;
  onDelete: () => void;
  onTranscribe: () => void;
  transcribing: boolean;
}) {
  const theme = useTheme();
  const player = useAudioPlayer(uri);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {
        setPlaying(false);
        player.seekTo(0);
      }
    });
    return () => sub.remove();
  }, [player]);

  return (
    <Surface style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surface, borderRadius: 12, padding: 8 }}>
      <IconButton
        icon={playing ? 'pause' : 'play'}
        mode="contained-tonal"
        size={18}
        onPress={() => {
          if (playing) { player.pause(); setPlaying(false); } else { player.play(); setPlaying(true); }
        }}
      />
      <Pressable onPress={onTranscribe} disabled={transcribing} style={{ flex: 1 }}>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {transcribing ? 'Transcribing…' : 'Tap to transcribe → body'}
        </Text>
      </Pressable>
      <IconButton icon="delete-outline" size={18} onPress={onDelete} />
    </Surface>
  );
}

