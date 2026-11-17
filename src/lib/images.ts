import { Directory, File, Paths } from 'expo-file-system';
import { makeId } from './classify';

const IMAGES_DIR = 'dumpit-images';

function imagesDir(): Directory {
  const dir = new Directory(Paths.document, IMAGES_DIR);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

export interface StoredImage {
  uri: string;
  name: string;
}

/**
 * Copies an incoming shared file (cache-scoped or content:// URI) into the
 * app's document directory so it survives cache evictions.
 */
export async function storeImage(sourceUri: string, originalName?: string | null): Promise<StoredImage> {
  const dir = imagesDir();
  const ext = extensionOf(sourceUri, originalName);
  const name = `shot-${makeId()}${ext}`;
  const src = new File(sourceUri);
  await src.copy(new File(dir, name));
  return { uri: new File(dir, name).uri, name };
}

export function deleteStoredImage(uri: string | null) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Best effort — orphaned files are harmless.
  }
}

function extensionOf(uri: string, originalName?: string | null): string {
  const fromName = originalName?.match(/\.[a-zA-Z0-9]{2,5}$/)?.[0];
  if (fromName) return fromName.toLowerCase();
  const fromUri = uri.split('?')[0].match(/\.[a-zA-Z0-9]{2,5}$/)?.[0];
  if (fromUri) return fromUri.toLowerCase();
  return '.jpg';
}
