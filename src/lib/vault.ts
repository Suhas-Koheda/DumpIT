import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

import { deleteStoredImage } from './images';
import type { DumpItem, Folder } from './types';

export const VAULT_VERSION = 1;

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function exportVaultJson(items: DumpItem[], folders: Folder[]): string {
  return JSON.stringify(
    {
      app: 'DumpIT',
      version: VAULT_VERSION,
      exportedAt: new Date().toISOString(),
      items,
      folders,
    },
    null,
    2
  );
}

export async function shareExportJson(items: DumpItem[], folders: Folder[]): Promise<void> {
  const file = new File(Paths.cache, `dumpit-vault-${Date.now()}.json`);
  file.write(exportVaultJson(items, folders));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Export DumpIT vault',
    });
  }
}

function itemToHtml(item: DumpItem): string {
  const date = new Date(item.createdAt).toLocaleString();
  const tags = item.tags.map((tag) => `<li>#${esc(tag)}</li>`).join('');
  const todos = (item.ai?.todos ?? [])
    .map(
      (todo, i) =>
        `<li>${item.ai?.todosDone.includes(i) ? '[x]' : '[ ]'} ${esc(todo)}</li>`
    )
    .join('');
  const body = item.body ? `<pre style="white-space:pre-wrap;font-family:monospace">${esc(item.body)}</pre>` : '';
  return `
  <div class="item">
    <div class="meta">${esc(item.kind.toUpperCase())}${item.urlHost ? ` · ${esc(item.urlHost)}` : ''} · ${esc(date)}${item.pinned ? ' · PINNED' : ''}</div>
    <h2>${esc(item.title)}</h2>
    ${item.url ? `<div class="url"><a href="${esc(item.url)}">${esc(item.url)}</a></div>` : ''}
    ${item.text ? `<p class="text">${esc(item.text)}</p>` : ''}
    ${body}
    ${item.note ? `<p class="note"><b>NOTE:</b> ${esc(item.note)}</p>` : ''}
    ${item.ai?.status === 'done' && item.ai.summary ? `<p class="ai"><b>AI:</b> ${esc(item.ai.summary)}</p>` : ''}
    ${todos ? `<ul class="todos">${todos}</ul>` : ''}
    ${tags ? `<ul class="tags">${tags}</ul>` : ''}
  </div>`;
}

export async function shareExportPdf(items: DumpItem[], folders: Folder[]): Promise<void> {
  const exportedAt = new Date().toLocaleString();
  const itemsHtml = [...items]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(itemToHtml)
    .join('\n');
  const foldersHtml = folders.map((f) => `<li><span style="color:${esc(f.color)}">■</span> ${esc(f.name)}</li>`).join('');
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>DumpIT vault export</title>
<style>
  body { font-family: Georgia, serif; color: #111; margin: 32px; }
  h1 { font-size: 28px; border-bottom: 3px solid #000; padding-bottom: 8px; }
  h2 { font-size: 19px; margin: 18px 0 4px; }
  .item { border: 1px solid #333; border-left: 6px solid #000; padding: 14px 16px; margin: 14px 0; page-break-inside: avoid; }
  .meta { font-family: monospace; font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 1px; }
  .url a { color: #0000FF; font-size: 12px; word-break: break-all; }
  .text, .ai, .note { font-size: 14px; line-height: 1.5; }
  ul { margin: 6px 0; }
  .todos li { font-family: monospace; list-style: none; }
  .tags li, .tags { display: inline; margin-right: 8px; font-size: 12px; }
  pre { font-size: 11px; background: #f3f3f3; padding: 8px; border: 1px solid #ddd; }
</style></head>
<body>
<h1>DUMPIT</h1>
<p style="font-family:monospace;font-size:11px">VAULT EXPORT — ${esc(exportedAt)} — ${items.length} ITEMS${folders.length ? ` — ${folders.length} BLOCKS` : ''}</p>
${folders.length ? `<ul>${foldersHtml}</ul>` : ''}
${itemsHtml}
</body></html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Export DumpIT PDF',
    });
  }
}

export interface VaultImport {
  items: DumpItem[];
  folders: Folder[];
}

/** Parse + validate a vault JSON (exported by shareExportJson). */
export function parseVaultJson(raw: string): VaultImport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Not valid JSON');
  }
  const doc = parsed as { app?: string; version?: number; items?: unknown; folders?: unknown };
  if (doc?.app !== 'DumpIT' || !Array.isArray(doc?.items)) {
    throw new Error('Not a DumpIT vault file');
  }
  // Migrate missing fields onto each item; keep image URIs only if they still exist? Not applicable cross-device.
  const items: DumpItem[] = (doc.items as Partial<DumpItem>[]).map((item) => ({
    id: typeof item.id === 'string' ? item.id : `imp-${Math.random().toString(36).slice(2)}`,
    kind: item.kind ?? 'text',
    platform: item.platform ?? null,
    title: typeof item.title === 'string' ? item.title : 'Imported item',
    text: typeof item.text === 'string' ? item.text : '',
    url: item.url ?? null,
    urlHost: item.urlHost ?? null,
    imageUri: null, // file:// blobs don't travel with the JSON
    imageName: item.imageName ?? null,
    note: typeof item.note === 'string' ? item.note : '',
    tags: Array.isArray(item.tags) ? item.tags : [],
    source: item.source === 'share' ? 'share' : 'manual',
    createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
    pinned: Boolean(item.pinned),
    isPrivate: Boolean(item.isPrivate),
    body: item.body ?? null,
    folderId: item.folderId ?? null,
    kanbanState:
      item.kanbanState === 'doing' || item.kanbanState === 'done' ? item.kanbanState : 'todo',
    attachments: [], // file:// attachments don't travel either
    memos: [],
    ai: item.ai ?? null,
  }));
  const folders: Folder[] = Array.isArray(doc.folders)
    ? (doc.folders as Partial<Folder>[]).map((folder, index) => ({
        id: typeof folder.id === 'string' ? folder.id : `imp-folder-${index}-${Date.now()}`,
        name: typeof folder.name === 'string' ? folder.name.slice(0, 40) : `Imported ${index + 1}`,
        color: typeof folder.color === 'string' ? folder.color : '#000000',
      }))
    : [];
  return { items, folders };
}

export function mergeVaults(
  existingItems: DumpItem[],
  existingFolders: Folder[],
  imported: VaultImport
): VaultImport {
  // Folder id remap: imported folders join existing with fresh ids when colliding.
  const folderIdMap = new Map<string, string>();
  const folders = [...existingFolders];
  for (const folder of imported.folders) {
    const clash = folders.find((existing) => existing.id === folder.id);
    const id = clash ? `imp-${folder.id}-${Math.random().toString(36).slice(2, 6)}` : folder.id;
    folderIdMap.set(folder.id, id);
    folders.push({ ...folder, id });
  }
  const seenIds = new Set(existingItems.map((item) => item.id));
  const items = [
    ...existingItems,
    ...imported.items.map((item) => ({
      ...item,
      id: seenIds.has(item.id) ? `imp-${item.id}-${Math.random().toString(36).slice(2, 6)}` : item.id,
      folderId: item.folderId ? (folderIdMap.get(item.folderId) ?? item.folderId) : null,
    })),
  ];
  return { items, folders };
}

export function removeStoredImageUris(items: DumpItem[]) {
  for (const item of items) deleteStoredImage(item.imageUri);
}
