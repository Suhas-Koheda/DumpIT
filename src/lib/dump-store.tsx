import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { detectPlatform, extractUrl, hostOf, makeId, readableBlurb } from './classify';
import { deleteStoredImage, storeImage } from './images';
import type { DumpItem } from './types';

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
}

const DumpContext = createContext<DumpStore | null>(null);

export function useDumpStore(): DumpStore {
  const ctx = useContext(DumpContext);
  if (!ctx) throw new Error('useDumpStore must be used within <DumpProvider>');
  return ctx;
}

export function DumpProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<DumpItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted || !raw) return;
        try {
          const parsed = JSON.parse(raw) as DumpItem[];
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

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.imageUri) deleteStoredImage(target.imageUri);
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const value = useMemo<DumpStore>(
    () => ({ items, hydrated, addFromShare, removeItem }),
    [items, hydrated, addFromShare, removeItem]
  );

  return <DumpContext.Provider value={value}>{children}</DumpContext.Provider>;
}
