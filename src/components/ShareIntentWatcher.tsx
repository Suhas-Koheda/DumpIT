import { useEffect, useRef } from 'react';

import { useShareIntentContext } from 'expo-share-intent';

import { useDumpStore } from '@/lib/dump-store';

/**
 * Watches the native share intent and imports whatever arrives into the
 * local dump store. Mounted once, high in the tree.
 */
export default function ShareIntentWatcher() {
  const { isReady, hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const { addFromShare } = useDumpStore();
  const importingRef = useRef(false);

  useEffect(() => {
    if (!isReady || !hasShareIntent || importingRef.current) return;

    importingRef.current = true;
    const payload = {
      text: shareIntent.text ?? null,
      webUrl: shareIntent.webUrl ?? null,
      files:
        shareIntent.files?.map((file) => ({
          path: file.path,
          mimeType: file.mimeType ?? null,
          fileName: file.fileName ?? null,
        })) ?? null,
      metaTitle: shareIntent.meta?.title ?? null,
    };

    addFromShare(payload)
      .catch(() => {
        // Swallow — a failed import must not wedge the watcher forever.
      })
      .finally(() => {
        resetShareIntent();
        importingRef.current = false;
      });
  }, [isReady, hasShareIntent, shareIntent, addFromShare, resetShareIntent]);

  return null;
}
