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
import { runAgent } from './agent';
import type { AgentStep, DumpItem } from './types';

const STORAGE_KEY = 'dumpit.items.v1';

export interface SharePayload {
  text?: string | null;
  webUrl?: string | null;
  files?: { path: string; mimeType: string | null; fileName?: string | null }[] | null;
  metaTitle?: string | null;
}

interface DumpStore {
  items: DumpItem[];
  hydrated: boolean;
  addFromShare: (payload: SharePayload) => Promise<DumpItem[]>;
  removeItem: (id: string) => void;
  rerunAgent: (id: string) => void;
}

const DumpContext = createContext<DumpStore | null>(null);

export function useDumpStore(): DumpStore {
  const ctx = useContext(DumpContext);
  if (!ctx) throw new Error('useDumpStore must be used within <DumpProvider>');
  return ctx;
}

function emptyAgentFields() {
  return {
    agent: 'pending' as const,
    steps: [] as AgentStep[],
    summary: null as string | null,
    sources: [] as string[],
    extracted: null as string | null,
  };
}

export function DumpProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<DumpItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const runningRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted || !raw) return;
        try {
          const parsed = JSON.parse(raw) as Partial<DumpItem>[];
          if (Array.isArray(parsed)) {
            setItems(
              parsed.map((item) => ({
                id: item.id ?? makeId(),
                kind: item.kind ?? 'text',
                platform: item.platform ?? null,
                title: item.title ?? '',
                text: item.text ?? '',
                url: item.url ?? null,
                urlHost: item.urlHost ?? hostOf(item.url ?? ''),
                imageUri: item.imageUri ?? null,
                imageName: item.imageName ?? null,
                createdAt: item.createdAt ?? Date.now(),
                agent:
                  item.agent ??
                  (item.kind === 'image' ? 'skipped' : 'pending'),
                steps: item.steps ?? [],
                summary: item.summary ?? null,
                sources: item.sources ?? [],
                extracted: item.extracted ?? null,
              }))
            );
          }
        } catch {
          // Corrupted data — start clean.
        }
      })
      .finally(() => mounted && setHydrated(true));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {});
  }, [items, hydrated]);

  const addFromShare = useCallback(async (payload: SharePayload): Promise<DumpItem[]> => {
    const created: Omit<DumpItem, 'id' | 'createdAt'>[] = [];
    const now = Date.now();

    for (const file of payload.files ?? []) {
      const isImage = (file.mimeType ?? '').startsWith('image/');
      if (isImage) {
        try {
          const stored = await storeImage(file.path, file.fileName);
          created.push({
            kind: 'image',
            platform: null,
            title: file.fileName || 'Image',
            text: '',
            url: null,
            urlHost: null,
            imageUri: stored.uri,
            imageName: stored.name,
            ...emptyAgentFields(),
            agent: 'skipped',
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
            ...emptyAgentFields(),
            agent: 'skipped',
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
          ...emptyAgentFields(),
          agent: 'skipped',
        });
      }
    }

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
        ...emptyAgentFields(),
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
        ...emptyAgentFields(),
      });
    }

    const withIds: DumpItem[] = created.map((item, index) => ({
      ...item,
      id: makeId(),
      createdAt: now + index,
    }));
    if (withIds.length > 0) {
      setItems((prev) => [...withIds, ...prev]);
    }
    return withIds;
  }, []);

  // Agentic research loop — one item at a time, works offline end-to-end.
  useEffect(() => {
    if (!hydrated || runningRef.current) return;
    const next = items.find((item) => item.agent === 'pending');
    if (!next) return;

    runningRef.current = true;
    const id = next.id;

    const run = async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, agent: 'running' } : item))
      );
      try {
        const result = await runAgent(
          { title: next.title, text: next.text, url: next.url },
          (steps) => {
            setItems((prev) =>
              prev.map((item) => (item.id === id ? { ...item, steps } : item))
            );
          }
        );
        setItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  agent: 'done',
                  steps: result.steps,
                  summary: result.summary,
                  sources: result.sources,
                  extracted: result.extracted,
                }
              : item
          )
        );
      } catch {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, agent: 'failed' } : item
          )
        );
      } finally {
        runningRef.current = false;
      }
    };
    run();
  }, [items, hydrated]);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.imageUri) deleteStoredImage(target.imageUri);
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const rerunAgent = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              agent: 'pending',
              steps: [],
              summary: null,
              sources: [],
              extracted: null,
            }
          : item
      )
    );
  }, []);

  const value = useMemo<DumpStore>(
    () => ({ items, hydrated, addFromShare, removeItem, rerunAgent }),
    [items, hydrated, addFromShare, removeItem, rerunAgent]
  );

  return <DumpContext.Provider value={value}>{children}</DumpContext.Provider>;
}
