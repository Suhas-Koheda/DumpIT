import { File, Paths } from 'expo-file-system';

/**
 * Embeddings live in a single JSON map file ({ itemId: number[] }).
 * nomic-embed-text-v1.5 → 768 dimensions, ~6 KB per entry.
 */

export const EMBEDDING_DIMS = 768;

let cache: Record<string, number[]> | null = null;

function embeddingsFile(): File {
  return new File(Paths.document, 'dumpit-embeddings.json');
}

function loadAll(): Record<string, number[]> {
  if (cache) return cache;
  try {
    const raw = embeddingsFile().textSync();
    const parsed = JSON.parse(raw) as Record<string, number[]>;
    cache = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    cache = {};
  }
  return cache;
}

function persist() {
  const file = embeddingsFile();
  try {
    file.writeSync(JSON.stringify(cache ?? {}));
  } catch {
    // Best effort — embeddings are a search index, not source of truth.
  }
}

export function saveEmbedding(id: string, vector: number[]) {
  loadAll()[id] = vector;
  persist();
}

export function getEmbedding(id: string): number[] | null {
  return loadAll()[id] ?? null;
}

export function deleteEmbedding(id: string) {
  const all = loadAll();
  if (id in all) {
    delete all[id];
    persist();
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length && i < b.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Rank item ids by cosine similarity to a query vector. Returns best first. */
export function rankByEmbedding(
  query: number[],
  ids: string[]
): { id: string; score: number }[] {
  const all = loadAll();
  const scored: { id: string; score: number }[] = [];
  for (const id of ids) {
    const vec = all[id];
    if (vec) scored.push({ id, score: cosineSimilarity(query, vec) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}
