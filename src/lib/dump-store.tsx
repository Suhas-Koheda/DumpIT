import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { detectPlatform, extractUrl, hostOf, makeId, readableBlurb } from './classify';
import { deleteStoredImage, storeImage } from './images';
import {
  cancelReminder,
  ensureNotificationPermission,
  scheduleReminderAt,
} from './notifications';
import { agentAnalyze, embedDocument, embedQuery, engineAvailable } from './ai-engine';
import {
  downloadModels,
  llmModelReady,
  embedModelReady,
  TOTAL_MODEL_BYTES,
} from './ai-models';
import { deleteEmbedding, rankByEmbedding, saveEmbedding } from './embeddings';
import { ocrAvailable, recognizeText } from './ocr';
import type { DumpItem, DumpAi, Folder } from './types';

const STORAGE_KEY = 'dumpit.items.v1';
const FOLDERS_KEY = 'dumpit.folders.v1';

export interface SharePayload {
  text?: string | null;
  webUrl?: string | null;
  files?: { path: string; mimeType: string | null; fileName?: string | null }[] | null;
  metaTitle?: string | null;
  source: DumpItem['source'];
}

export type AiState = 'unavailable' | 'needs-download' | 'downloading' | 'ready';

export interface AiProgress {
  stage: 'llm' | 'embed';
  stageFraction: number;
  totalBytes: number;
  receivedBytes: number;
}

interface DumpStore {
  items: DumpItem[];
  hydrated: boolean;
  /** Items imported by the most recent share/simulation. */
  lastImportCount: number;
  aiState: AiState;
  aiProgress: AiProgress | null;
  /** Start the one-time ~550 MB model download (Wi-Fi recommended). */
  enableAiDownload: () => void;
  addFromShare: (payload: SharePayload) => Promise<DumpItem[]>;
  addManualText: (text: string) => Promise<DumpItem>;
  updateItem: (id: string, patch: Partial<Pick<DumpItem, 'note' | 'tags' | 'title'>>) => void;
  /** Re-queue an item for on-device analysis. */
  retryAiAnalysis: (id: string) => void;
  /** Flip one todo's done state. */
  toggleTodo: (id: string, index: number) => void;
  /** Pin / unpin. Pinned items float to the top. */
  togglePin: (id: string) => void;
  /** Schedule (or reschedule) a reminder for one todo. Returns success. */
  setTodoReminder: (id: string, todoIndex: number, at: number) => Promise<boolean>;
  /** Cancel the reminder for one todo. */
  clearTodoReminder: (id: string, todoIndex: number) => void;
  /** Markdown body of an item. */
  setBody: (id: string, body: string) => void;
  setKanbanState: (id: string, state: DumpItem['kanbanState']) => void;
  togglePrivate: (id: string) => void;
  assignFolder: (id: string, folderId: string | null) => void;
  addAttachment: (id: string, attachment: import('./types').DumpAttachment) => void;
  removeAttachment: (id: string, attachmentId: string) => void;
  addMemo: (id: string, memo: import('./types').DumpMemo) => void;
  removeMemo: (id: string, memoId: string) => void;
  folders: Folder[];
  addFolder: (name: string, color: string) => Folder;
  removeFolder: (id: string) => void;
  /** Replace the vault wholesale (used by import). */
  replaceAll: (items: DumpItem[], folders: Folder[]) => void;
  removeItem: (id: string) => void;
  dismissImportBanner: () => void;
  /** Semantic search via on-device embeddings. Null when unavailable. */
  semanticRank: (query: string, ids: string[]) => Promise<{ id: string; score: number }[] | null>;
}

const DumpContext = createContext<DumpStore | null>(null);

export function useDumpStore(): DumpStore {
  const ctx = useContext(DumpContext);
  if (!ctx) throw new Error('useDumpStore must be used within <DumpProvider>');
  return ctx;
}

function emptyAi(status: DumpAi['status']): DumpAi {
  return {
    status,
    summary: '',
    entities: [],
    todos: [],
    links: [],
    ocrText: '',
    pageText: '',
    sources: [],
    error: null,
    analyzedAt: null,
    category: 'note',
    todosDone: [],
    reminders: [],
  };
}

export function DumpProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<DumpItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [lastImportCount, setLastImportCount] = useState(0);
  const [aiState, setAiState] = useState<AiState>(() =>
    engineAvailable()
      ? llmModelReady() && embedModelReady()
        ? 'ready'
        : 'needs-download'
      : 'unavailable'
  );
  const [aiProgress, setAiProgress] = useState<AiProgress | null>(null);
  const analysisRunningRef = useRef(false);
  const downloadingRef = useRef(false);
  const itemsRef = useRef<DumpItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);

  // Load once on startup. Legacy items gain an AI slot (queued for analysis).
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(FOLDERS_KEY).then((raw) => {
      if (!mounted || !raw) return;
      try {
        const parsed = JSON.parse(raw) as Folder[];
        if (Array.isArray(parsed)) setFolders(parsed);
      } catch {
        // ignore
      }
    });
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as DumpItem[];
            if (Array.isArray(parsed)) {
              setItems(
                parsed.map((item) => ({
                  ...item,
                  pinned: item.pinned ?? false,
                  isPrivate: item.isPrivate ?? false,
                  body: item.body ?? null,
                  folderId: item.folderId ?? null,
                  kanbanState: item.kanbanState ?? 'todo',
                  attachments: item.attachments ?? [],
                  memos: item.memos ?? [],
                  ai: { ...emptyAi('pending'), ...(item.ai ?? {}) },
                }))
              );
            }
          } catch {
            // Corrupted payload — start clean rather than crash.
          }
        }
      })
      .finally(() => mounted && setHydrated(true));
    return () => {
      mounted = false;
    };
  }, []);

  // Keep a live ref for callbacks that shouldn't re-subscribe.
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(folders)).catch(() => {});
  }, [folders, hydrated]);

  // Persist on every change (after hydration).
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {});
  }, [items, hydrated]);

  // Analysis queue: one item at a time, fully on-device.
  useEffect(() => {
    if (aiState !== 'ready' || !hydrated) return;
    if (analysisRunningRef.current) return;

    const next = items.find((item) => item.ai?.status === 'pending');
    if (!next) return;

    analysisRunningRef.current = true;
    const id = next.id;

    const markAnalyzing = () =>
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ai: { ...item.ai!, status: 'analyzing' } } : item))
      );

    const run = async () => {
      // Yield first so no setState runs synchronously inside the effect.
      await new Promise((resolve) => setTimeout(resolve, 0));
      markAnalyzing();
      try {
        // 1) OCR when it's an image dump.
        let ocrText = '';
        if (next.kind === 'image' && next.imageUri && ocrAvailable()) {
          try {
            ocrText = await recognizeText(next.imageUri);
          } catch {
            // OCR failure must not kill the whole analysis.
          }
        }

        // 2) Agentic investigation — the model decides which links to open,
        // including ones nested inside the evidence (tweet → its Google Doc).
        const { analysis, sources, pageText } = await agentAnalyze({
          title: next.title,
          text: next.text,
          url: next.url,
          ocrText,
        });

        // 4) Embedding for semantic search.
        try {
          const embeddingInput = [
            next.title,
            next.text,
            next.url ?? '',
            ocrText,
            pageText,
            analysis.summary,
          ]
            .filter(Boolean)
            .join('\n');
          const vector = await embedDocument(embeddingInput);
          saveEmbedding(id, vector);
        } catch {
          // Embeddings are optional; analysis still lands.
        }

        const titleWasPlaceholder = !next.title || next.title === next.urlHost;
        const firstSource = sources[0]?.replace(/\s*—\s*.*$/, '') ?? null;
        setItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  title:
                    firstSource && titleWasPlaceholder
                      ? firstSource.slice(0, 80)
                      : item.title,
                  ai: {
                    status: 'done',
                    summary: analysis.summary,
                    category: analysis.category,
                    entities: analysis.entities,
                    todos: analysis.todos,
                    todosDone: [],
                    links: analysis.links,
                    ocrText,
                    pageText,
                    sources,
                    error: null,
                    analyzedAt: Date.now(),
                    reminders: [],
                  },
                }
              : item
          )
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  ai: {
                    ...item.ai!,
                    status: 'error',
                    error: message.slice(0, 300),
                    analyzedAt: Date.now(),
                  },
                }
              : item
          )
        );
      } finally {
        analysisRunningRef.current = false;
      }
    };

    run();
  }, [items, aiState, hydrated]);

  const addFromShare = useCallback(async (payload: SharePayload): Promise<DumpItem[]> => {
    const created: Omit<DumpItem, 'id' | 'createdAt'>[] = [];
    const createdAt = Date.now();

    // 1) Media / files first.
    for (const file of payload.files ?? []) {
      const isImage = (file.mimeType ?? '').startsWith('image/');
      if (isImage) {
        try {
          const stored = await storeImage(file.path, file.fileName);
          created.push({
            kind: 'image',
            platform: null,
            title: file.fileName || 'Screenshot',
            text: '',
            url: null,
            urlHost: null,
            imageUri: stored.uri,
            imageName: stored.name,
            note: '',
            tags: [],
            source: payload.source,
            pinned: false,
            isPrivate: false,
            body: null,
            folderId: null,
            kanbanState: 'todo',
            attachments: [],
            memos: [],
            ai: emptyAi('pending'),
          });
        } catch {
          created.push({
            kind: 'text',
            platform: null,
            title: 'Unreadable image',
            text: `An image was shared but could not be read (${file.fileName ?? 'unknown'}).`,
            url: null,
            urlHost: null,
            imageUri: null,
            imageName: null,
            note: '',
            tags: [],
            source: payload.source,
            pinned: false,
            isPrivate: false,
            body: null,
            folderId: null,
            kanbanState: 'todo',
            attachments: [],
            memos: [],
            ai: emptyAi('pending'),
          });
        }
      } else {
        created.push({
          kind: 'text',
          platform: null,
          title: file.fileName ?? 'Shared file',
          text: `Shared file: ${file.fileName ?? file.path} (${file.mimeType ?? 'unknown type'})`,
          url: null,
          urlHost: null,
          imageUri: null,
          imageName: null,
          note: '',
          tags: [],
          source: payload.source,
          pinned: false,
          isPrivate: false,
          body: null,
          folderId: null,
          kanbanState: 'todo',
          attachments: [],
          memos: [],
          ai: emptyAi('pending'),
        });
      }
    }

    // 2) Text / URL.
    const sharedUrl = payload.webUrl ?? extractUrl(payload.text);
    const blurb = readableBlurb(payload.text, sharedUrl);
    if (sharedUrl) {
      created.push({
        kind: 'link',
        platform: detectPlatform(sharedUrl),
        title: payload.metaTitle?.trim() || blurb || hostOf(sharedUrl) || sharedUrl,
        text: blurb,
        url: sharedUrl,
        urlHost: hostOf(sharedUrl),
        imageUri: null,
        imageName: null,
        note: '',
        tags: [],
        source: payload.source,
        pinned: false,
        isPrivate: false,
        body: null,
        folderId: null,
        kanbanState: 'todo',
        attachments: [],
        memos: [],
        ai: emptyAi('pending'),
      });
    } else if (payload.text?.trim()) {
      const text = payload.text.trim();
      created.push({
        kind: 'text',
        platform: null,
        title: text.split('\n')[0].slice(0, 80),
        text,
        url: null,
        urlHost: null,
        imageUri: null,
        imageName: null,
        note: '',
        tags: [],
        source: payload.source,
        pinned: false,
        isPrivate: false,
        body: null,
        folderId: null,
        kanbanState: 'todo',
        attachments: [],
        memos: [],
        ai: emptyAi('pending'),
      });
    }

    const withIds: DumpItem[] = created.map((item, index) => ({
      ...item,
      id: makeId(),
      createdAt: createdAt + index,
    }));
    if (withIds.length > 0) {
      setItems((prev) => [...withIds, ...prev]);
      setLastImportCount(withIds.length);
    }
    return withIds;
  }, []);

  const addManualText = useCallback(
    async (text: string): Promise<DumpItem> => {
      const created = await addFromShare({ text, source: 'manual' });
      return created[0];
    },
    [addFromShare]
  );

  const updateItem = useCallback<DumpStore['updateItem']>((id, patch) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        if (patch.tags) next.tags = sanitizeTags(patch.tags);
        return next;
      })
    );
  }, []);

  const setBody = useCallback((id: string, body: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, body } : item)));
  }, []);

  const setKanbanState = useCallback<DumpStore['setKanbanState']>((id, kanbanState) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, kanbanState } : item)));
  }, []);

  const togglePrivate = useCallback((id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isPrivate: !item.isPrivate } : item)));
  }, []);

  const assignFolder = useCallback((id: string, folderId: string | null) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, folderId } : item)));
  }, []);

  const addAttachment = useCallback((id: string, attachment: import('./types').DumpAttachment) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, attachments: [...item.attachments, attachment] } : item
      )
    );
  }, []);

  const removeAttachment = useCallback((id: string, attachmentId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, attachments: item.attachments.filter((a) => a.id !== attachmentId) }
          : item
      )
    );
  }, []);

  const addMemo = useCallback((id: string, memo: import('./types').DumpMemo) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, memos: [...item.memos, memo] } : item))
    );
  }, []);

  const removeMemo = useCallback((id: string, memoId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, memos: item.memos.filter((m) => m.id !== memoId) } : item
      )
    );
  }, []);

  const addFolder = useCallback<DumpStore['addFolder']>((name, color) => {
    const folder: Folder = { id: makeId(), name: name.trim().slice(0, 40), color };
    setFolders((prev) => [...prev, folder]);
    return folder;
  }, []);

  const removeFolder = useCallback((id: string) => {
    setFolders((prev) => prev.filter((folder) => folder.id !== id));
    setItems((prev) => prev.map((item) => (item.folderId === id ? { ...item, folderId: null } : item)));
  }, []);

  const replaceAll = useCallback((newItems: DumpItem[], newFolders: Folder[]) => {
    setItems(newItems);
    setFolders(newFolders);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      target?.ai?.reminders.forEach((reminder) => cancelReminder(reminder.id));
      if (target?.imageUri) deleteStoredImage(target.imageUri);
      return prev.filter((item) => item.id !== id);
    });
    deleteEmbedding(id);
  }, []);

  const retryAiAnalysis = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ai: emptyAi('pending') } : item))
    );
  }, []);

  const toggleTodo = useCallback((id: string, index: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id || !item.ai) return item;
        const done = new Set(item.ai.todosDone);
        if (done.has(index)) done.delete(index);
        else done.add(index);
        return { ...item, ai: { ...item.ai, todosDone: [...done].sort((a, b) => a - b) } };
      })
    );
  }, []);

  const togglePin = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, pinned: !item.pinned } : item))
    );
  }, []);

  const setTodoReminder = useCallback<DumpStore['setTodoReminder']>(
    async (id, todoIndex, at) => {
      const granted = await ensureNotificationPermission();
      if (!granted) return false;
      const target = itemsRef.current.find((item) => item.id === id);
      const todoText = target?.ai?.todos[todoIndex] ?? 'Todo';
      // Replace any existing reminder for that todo.
      const existing = target?.ai?.reminders.find((r) => r.todoIndex === todoIndex);
      if (existing) await cancelReminder(existing.id);
      const notificationId = await scheduleReminderAt(
        target?.title ?? 'DumpIT',
        todoText,
        at
      );
      if (!notificationId) return false;
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id || !item.ai) return item;
          const reminders = item.ai.reminders.filter((r) => r.todoIndex !== todoIndex);
          reminders.push({ todoIndex, at, id: notificationId });
          return { ...item, ai: { ...item.ai, reminders } };
        })
      );
      return true;
    },
    []
  );

  const clearTodoReminder = useCallback<DumpStore['clearTodoReminder']>((id, todoIndex) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id || !item.ai) return item;
        const target = item.ai.reminders.find((r) => r.todoIndex === todoIndex);
        if (target) cancelReminder(target.id);
        return {
          ...item,
          ai: {
            ...item.ai,
            reminders: item.ai.reminders.filter((r) => r.todoIndex !== todoIndex),
          },
        };
      })
    );
  }, []);

  const dismissImportBanner = useCallback(() => setLastImportCount(0), []);

  const enableAiDownload = useCallback(() => {
    if (downloadingRef.current) return;
    if (!engineAvailable()) return;
    downloadingRef.current = true;
    setAiState('downloading');
    setAiProgress({ stage: 'llm', stageFraction: 0, totalBytes: TOTAL_MODEL_BYTES, receivedBytes: 0 });

    downloadModels((stage, stageFraction, totalFraction) => {
      setAiProgress({
        stage,
        stageFraction,
        totalBytes: TOTAL_MODEL_BYTES,
        receivedBytes: Math.round(TOTAL_MODEL_BYTES * totalFraction),
      });
    })
      .then(() => {
        setAiState('ready');
        setAiProgress(null);
        // Re-queue anything left behind (legacy + disabled items).
        setItems((prev) =>
          prev.map((item) =>
            item.ai && (item.ai.status === 'pending' || item.ai.status === 'disabled' || item.ai.status === 'error')
              ? { ...item, ai: emptyAi('pending') }
              : item.ai === null
                ? { ...item, ai: emptyAi('pending') }
                : item
          )
        );
      })
      .catch((error) => {
        console.warn('AI download failed:', error);
        setAiState('needs-download');
        setAiProgress(null);
      })
      .finally(() => {
        downloadingRef.current = false;
      });
  }, []);

  const semanticRank = useCallback<DumpStore['semanticRank']>(async (query, ids) => {
    if (aiState !== 'ready') return null;
    const vector = await embedQuery(query);
    if (!vector) return null;
    const ranked = rankByEmbedding(vector, ids);
    // Only keep ids we actually have; expose nothing below a floor.
    return ranked.filter((entry) => entry.score > 0.2);
  }, [aiState]);

  const value = useMemo<DumpStore>(
    () => ({
      items,
      hydrated,
      lastImportCount,
      aiState,
      aiProgress,
      enableAiDownload,
      addFromShare,
      addManualText,
      updateItem,
      retryAiAnalysis,
      toggleTodo,
      togglePin,
      setTodoReminder,
      clearTodoReminder,
      setBody,
      setKanbanState,
      togglePrivate,
      assignFolder,
      addAttachment,
      removeAttachment,
      addMemo,
      removeMemo,
      folders,
      addFolder,
      removeFolder,
      replaceAll,
      removeItem,
      dismissImportBanner,
      semanticRank,
    }),
    [
      items,
      hydrated,
      lastImportCount,
      aiState,
      aiProgress,
      enableAiDownload,
      addFromShare,
      addManualText,
      updateItem,
      retryAiAnalysis,
      toggleTodo,
      togglePin,
      setTodoReminder,
      clearTodoReminder,
      setBody,
      setKanbanState,
      togglePrivate,
      assignFolder,
      addAttachment,
      removeAttachment,
      addMemo,
      removeMemo,
      folders,
      addFolder,
      removeFolder,
      replaceAll,
      removeItem,
      dismissImportBanner,
      semanticRank,
    ]
  );

  return <DumpContext.Provider value={value}>{children}</DumpContext.Provider>;
}

function sanitizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().replace(/^#/, '').toLowerCase();
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
  }
  return out.slice(0, 12);
}
