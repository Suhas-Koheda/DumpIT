import { useEffect, useState } from 'react';
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

import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Directory, File, Paths } from 'expo-file-system';
import Markdown from 'react-native-markdown-display';
import
{
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
} from 'expo-audio';

import { initWhisper } from 'whisper.rn/index';

import Badge from '@/components/Badge';
import KnowledgeMap from '@/components/KnowledgeMap';
import { useDumpStore } from '@/lib/dump-store';
import { borders, colors, fonts } from '@/lib/theme';
import { fullDate } from '@/lib/time';
import { makeId } from '@/lib/classify';

/** Module-level helpers keep Date.now() out of the component body. */
function newId(): string {
  return makeId();
}
function makeAttachmentEntry(name: string, uri: string, mimeType: string | null, size: number | null) {
  return { id: newId(), name, uri, mimeType, size };
}
function makeMemoEntry(uri: string) {
  return { id: newId(), uri, createdAt: Date.now() };
}

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

const markdownStyle = {
  body: { color: colors.text, fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  heading1: { color: colors.text, fontFamily: fonts.display, fontSize: 22, marginTop: 8 },
  heading2: { color: colors.text, fontFamily: fonts.display, fontSize: 17, marginTop: 8 },
  heading3: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 15 },
  strong: { fontFamily: fonts.bodySemi },
  em: { fontStyle: 'italic' as const },
  code_inline: { fontFamily: fonts.mono, backgroundColor: colors.sunken, fontSize: 12 },
  fence: { fontFamily: fonts.mono, backgroundColor: colors.sunken, fontSize: 11, padding: 8 },
  link: { color: colors.blue, textDecorationLine: 'underline' as const },
  blockquote: { backgroundColor: colors.sunken, borderColor: colors.border, borderWidth: 2, padding: 8 },
  bullet_list_content: { fontFamily: fonts.body },
  list_item: { marginBottom: 2 },
};

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
    <View style={styles.memoRow}>
      <Pressable
        style={styles.memoPlayBtn}
        onPress={() => {
          if (playing) {
            player.pause();
            setPlaying(false);
          } else {
            player.play();
            setPlaying(true);
          }
        }}
      >
        <Text style={styles.memoPlayText}>{playing ? 'PAUSE' : 'PLAY'}</Text>
      </Pressable>
      <Pressable style={styles.memoTranscribeBtn} onPress={onTranscribe} disabled={transcribing}>
        <Text style={styles.memoTranscribeText}>{transcribing ? 'TRANSCRIBING…' : 'TRANSCRIBE'}</Text>
      </Pressable>
      <Pressable onPress={onDelete} style={styles.memoDeleteBtn} hitSlop={8}>
        <Text style={styles.memoDeleteText}>DEL</Text>
      </Pressable>
    </View>
  );
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
  const [noteFocused, setNoteFocused] = useState(false);
  const [tagsFocused, setTagsFocused] = useState(false);
  const [pickingTodo, setPickingTodo] = useState<number | null>(null);
  const [pickedDate, setPickedDate] = useState(defaultReminderDate);
  const [bodyDraft, setBodyDraft] = useState(item?.body ?? item?.text ?? '');
  const [bodyEditing, setBodyEditing] = useState(false);
  const [translateTo, setTranslateTo] = useState<string | null>(null);
  const [translation, setTranslation] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [whisperProgress, setWhisperProgress] = useState<number | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

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

  const commitBody = () => {
    const value = bodyDraft.trim();
    if (value !== (item?.body ?? '')) setBody(item!.id, value || '');
    if (value === '') setBody(item!.id, '');
  };

  const attachFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const dir = new Directory(Paths.document, 'dumpit-attachments');
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const name = `${makeId()}-${asset.name ?? 'file'}`;
    const dest = new File(dir, name);
    try {
      await new File(asset.uri).copy(dest);
    } catch {
      // best effort — keep reference to cache copy instead
    }
    addAttachment(item!.id, makeAttachmentEntry(asset.name ?? 'file', dest.exists ? dest.uri : asset.uri, asset.mimeType ?? null, asset.size ?? null));
  };

  const openAttachment = async (uri: string) => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { dialogTitle: 'Open with…' });
    }
  };

  const toggleRecording = async () => {
    if (recorderState.isRecording) {
      await recorder.stop();
      const uri = recorder.uri;
      if (uri) {
        const dir = new Directory(Paths.document, 'dumpit-memos');
        if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
        const dest = new File(dir, `memo-${newId()}.m4a`);
        try {
          await new File(uri).copy(dest);
        } catch {
          // keep cache uri
        }
        addMemo(item!.id, makeMemoEntry(dest.exists ? dest.uri : uri));
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
      setTranscribing(true);
      const context = await initWhisper({ filePath: model.uri, useGpu: true });
      const { promise } = context.transcribe(memoUri, { language: 'en' });
      const result = await promise;
      const text = result.result?.trim();
      if (text) {
        const next = (bodyDraft.trim() ? bodyDraft.trim() + '\n\n' : '') + `**REF:** ${text}`;
        setBodyDraft(next);
        setBody(item!.id, next);
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
      const { translate, downloadModels, TranslateLanguage } = await import(
        'react-native-mlkit-translation'
      );
      const lang =
        to === 'ru' ? TranslateLanguage.RUSSIAN
        : to === 'es' ? TranslateLanguage.SPANISH
        : to === 'hi' ? TranslateLanguage.HINDI
        : TranslateLanguage.FRENCH;
      await downloadModels([lang], { wifiOnly: true });
      const input =
        (item!.body ?? item!.text ?? item!.title).trim().slice(0, 1200) || item!.title;
      const out = await translate({ text: input, from: TranslateLanguage.ENGLISH, to: lang });
      setTranslation(out);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Translation failed — needs model download (Wi-Fi).';
      setTranslation(`⚠ ${message}`);
    } finally {
      setTranslating(false);
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
            <Pressable onPress={() => togglePrivate(item.id)} style={[styles.pinChip, item.isPrivate && styles.pinChipActive]}>
              <Text style={[styles.pinChipText, item.isPrivate && styles.pinChipTextActive]}>
                {item.isPrivate ? 'PRIVATE' : 'MAKE PRIVATE'}
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

        {/* Blocks / folders */}
        <Text style={styles.sectionLabel}>BLOCK</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.folderPickRow}>
          <Pressable
            onPress={() => assignFolder(item.id, null)}
            style={[styles.folderChip, item.folderId === null && styles.folderChipActive]}
          >
            <View style={[styles.folderDot, { backgroundColor: colors.bg }]} />
            <Text style={styles.folderChipText}>NONE</Text>
          </Pressable>
          {folders.map((folder) => {
            const active = item.folderId === folder.id;
            return (
              <Pressable
                key={folder.id}
                onPress={() => assignFolder(item.id, folder.id)}
                style={[styles.folderChip, active && styles.folderChipActive]}
              >
                <View style={[styles.folderDot, { backgroundColor: folder.color }]} />
                <Text style={styles.folderChipText} numberOfLines={1}>
                  {folder.name.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Kanban state */}
        <Text style={styles.sectionLabel}>BOARD</Text>
        <View style={styles.kanbanRow}>
          {(['todo', 'doing', 'done'] as const).map((state) => {
            const active = item.kanbanState === state;
            return (
              <Pressable
                key={state}
                onPress={() => setKanbanState(item.id, state)}
                style={[styles.kanbanChip, active && styles.kanbanChipActive]}
              >
                <Text style={styles.kanbanChipText}>{state.toUpperCase()}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Rich body (markdown) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>BODY — MARKDOWN</Text>
          <Pressable onPress={() => setBodyEditing((v) => !v)} style={styles.smallBtn}>
            <Text style={styles.smallBtnText}>{bodyEditing ? 'PREVIEW' : 'EDIT'}</Text>
          </Pressable>
        </View>
        {bodyEditing ? (
          <>
            <View style={styles.toolbar}>
              {['## ', '**', '*', '- ', '[ ] ', '> ', '`'].map((token) => (
                <Pressable
                  key={token}
                  style={styles.toolChip}
                  onPress={() => setBodyDraft((prev) => prev + token)}
                >
                  <Text style={styles.toolChipText}>
                    {token === '## ' ? 'H' : token === '- ' ? 'LIST' : token === '[ ] ' ? 'TODO' : token === '> ' ? 'QUOTE' : token === '`' ? 'CODE' : token}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={bodyDraft}
              onChangeText={setBodyDraft}
              onBlur={commitBody}
              placeholder="Write the note here — markdown supported."
              placeholderTextColor={colors.faint}
              style={styles.bodyInput}
              multiline
              textAlignVertical="top"
            />
          </>
        ) : (
          <View style={styles.bodyPreview}>
            <Markdown style={markdownStyle}>{bodyDraft.trim() || '_Nothing yet. Tap EDIT._'}</Markdown>
          </View>
        )}

        {/* Attachments */}
        <Text style={styles.sectionLabel}>ATTACHMENTS</Text>
        {item.attachments.map((attachment) => (
          <View key={attachment.id} style={styles.attachmentRow}>
            <Pressable style={styles.attachmentMain} onPress={() => openAttachment(attachment.uri)}>
              <Text style={styles.attachmentName} numberOfLines={1}>
                {attachment.name.toUpperCase()}
              </Text>
              {attachment.size != null && (
                <Text style={styles.attachmentSize}>{Math.round(attachment.size / 1024)} KB</Text>
              )}
            </Pressable>
            <Pressable onPress={() => removeAttachment(item.id, attachment.id)} style={styles.smallBtn}>
              <Text style={styles.smallBtnText}>DEL</Text>
            </Pressable>
          </View>
        ))}
        <Pressable style={styles.btnGhost} onPress={attachFile}>
          <Text style={styles.btnGhostText}>+ ATTACH FILE (PDF / TXT)</Text>
        </Pressable>

        {/* Voice memos + dictation */}
        <Text style={styles.sectionLabel}>VOICE MEMO</Text>
        <View style={styles.memoControls}>
          <Pressable
            style={[styles.recordBtn, recorderState.isRecording && styles.recordBtnActive]}
            onPress={toggleRecording}
          >
            <Text style={[styles.recordBtnText, recorderState.isRecording && styles.recordBtnTextActive]}>
              {recorderState.isRecording ? '■ STOP' : '● RECORD'}
            </Text>
          </Pressable>
          {whisperProgress !== null && (
            <View style={styles.whisperProgress}>
              <Text style={styles.whisperProgressText}>
                WHISPER {Math.round(whisperProgress * 100)}%
              </Text>
              <View style={styles.whisperBar}>
                <View style={[styles.whisperFill, { width: `${Math.round(whisperProgress * 100)}%` }]} />
              </View>
            </View>
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

        {/* Translate (on-device) */}
        <Text style={styles.sectionLabel}>TRANSLATE (ON-DEVICE)</Text>
        <View style={styles.translateRow}>
          {(['ru', 'es', 'hi', 'fr'] as const).map((lang) => (
            <Pressable
              key={lang}
              style={[styles.translateChip, translateTo === lang && styles.translateChipActive]}
              onPress={() => translate(lang)}
            >
              <Text style={styles.translateChipText}>
                {lang === 'ru' ? 'RUS' : lang === 'es' ? 'SPA' : lang === 'hi' ? 'HIN' : 'FRA'}
              </Text>
            </Pressable>
          ))}
        </View>
        {translating && <Text style={styles.translating}>TRANSLATING… (first call downloads the model)</Text>}
        {translation && (
          <Text style={styles.translationBox} selectable>
            {translation}
          </Text>
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
  memoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: borders.base,
    borderColor: colors.border,
    padding: 8,
  },
  memoPlayBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  memoPlayText: {
    fontFamily: fonts.label,
    color: colors.ink,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  memoTranscribeBtn: {
    borderWidth: borders.base,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flex: 1,
    alignItems: 'center',
  },
  memoTranscribeText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.text,
  },
  memoDeleteBtn: {
    borderWidth: borders.base,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  memoDeleteText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text,
  },
  recordBtn: {
    borderWidth: borders.thick,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  recordBtnActive: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  recordBtnText: {
    fontFamily: fonts.label,
    color: colors.text,
    fontSize: 12,
    letterSpacing: 2,
  },
  recordBtnTextActive: {
    color: colors.ink,
  },
  memoControls: {
    gap: 8,
  },
  whisperProgress: {
    gap: 4,
  },
  whisperProgressText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.muted,
  },
  whisperBar: {
    height: 14,
    backgroundColor: colors.sunken,
    borderWidth: borders.base,
    borderColor: colors.border,
  },
  whisperFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  translateRow: {
    flexDirection: 'row',
    gap: 8,
  },
  translateChip: {
    borderWidth: borders.thick,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  translateChipActive: {
    backgroundColor: colors.accent,
  },
  translateChipText: {
    fontFamily: fonts.label,
    color: colors.text,
    fontSize: 11,
    letterSpacing: 2,
  },
  translating: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 0.5,
  },
  translationBox: {
    fontFamily: fonts.body,
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    borderWidth: borders.base,
    borderColor: colors.border,
    backgroundColor: colors.sunken,
    padding: 10,
  },
  folderPickRow: {
    gap: 8,
    paddingVertical: 2,
  },
  folderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: borders.base,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  folderChipActive: {
    backgroundColor: colors.accent,
  },
  folderDot: {
    width: 12,
    height: 12,
    borderWidth: borders.thin,
    borderColor: colors.border,
  },
  folderChipText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.text,
    flexShrink: 1,
  },
  kanbanRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kanbanChip: {
    flex: 1,
    borderWidth: borders.thick,
    borderColor: colors.border,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  kanbanChipActive: {
    backgroundColor: colors.accent,
  },
  kanbanChipText: {
    fontFamily: fonts.label,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.text,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  smallBtn: {
    borderWidth: borders.base,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallBtnText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.text,
  },
  toolbar: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  toolChip: {
    borderWidth: borders.base,
    borderColor: colors.border,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: colors.sunken,
  },
  toolChipText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text,
  },
  bodyInput: {
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
    backgroundColor: colors.sunken,
    borderWidth: borders.thick,
    borderColor: colors.border,
    padding: 12,
    minHeight: 140,
  },
  bodyPreview: {
    borderWidth: borders.base,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    padding: 12,
    minHeight: 100,
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: borders.base,
    borderColor: colors.border,
    padding: 8,
  },
  attachmentMain: {
    flex: 1,
    gap: 2,
  },
  attachmentName: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.text,
  },
  attachmentSize: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.faint,
  },
  btnGhost: {
    borderWidth: borders.thick,
    borderColor: colors.border,
    borderStyle: 'dashed',
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnGhostText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.muted,
  },
});
