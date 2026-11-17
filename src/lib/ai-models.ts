import { Directory, File, Paths } from 'expo-file-system';

/**
 * On-device models, downloaded on demand (never bundled) from HuggingFace.
 * Everything runs offline after the first download.
 */

export const LLM_MODEL = {
  name: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
  url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
  /** ~469 MB */
  size: 491_400_032,
} as const;

export const EMBED_MODEL = {
  name: 'nomic-embed-text-v1.5.Q4_K_M.gguf',
  url: 'https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/main/nomic-embed-text-v1.5.Q4_K_M.gguf',
  /** ~80 MB */
  size: 84_106_624,
} as const;

function modelsDir(): Directory {
  const dir = new Directory(Paths.document, 'dumpit-models');
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

export function llmModelFile(): File {
  return new File(modelsDir(), LLM_MODEL.name);
}

export function embedModelFile(): File {
  return new File(modelsDir(), EMBED_MODEL.name);
}

export function llmModelReady(): boolean {
  const file = llmModelFile();
  return file.exists && file.size > 0;
}

export function embedModelReady(): boolean {
  const file = embedModelFile();
  return file.exists && file.size > 0;
}

export function modelsReady(): boolean {
  return llmModelReady() && embedModelReady();
}

export type DownloadStage = 'llm' | 'embed';

/**
 * Downloads any missing models. Reports combined progress (0..1) via onProgress.
 * Resolves when both models are present; throws on failure (partial downloads
 * are deleted so a retry starts clean).
 */
export async function downloadModels(
  onProgress: (stage: DownloadStage, fractionOfStage: number, totalFraction: number) => void
): Promise<void> {
  const totalBytes = LLM_MODEL.size + EMBED_MODEL.size;
  let bytesBeforeStage = 0;

  for (const stage of ['llm', 'embed'] as const) {
    const spec = stage === 'llm' ? LLM_MODEL : EMBED_MODEL;
    const target = new File(modelsDir(), spec.name);

    if (target.exists && target.size > 0) {
      bytesBeforeStage += spec.size;
      onProgress(stage, 1, bytesBeforeStage / totalBytes);
      continue;
    }

    if (target.exists) target.delete();

    const task = File.createDownloadTask(spec.url, target, {
      onProgress: ({ bytesWritten, totalBytes: expected }) => {
        const total = expected > 0 ? expected : spec.size;
        const fraction = Math.min(1, bytesWritten / total);
        onProgress(stage, fraction, (bytesBeforeStage + bytesWritten) / totalBytes);
      },
    });

    try {
      const result = await task.downloadAsync();
      if (!result) {
        throw new Error('Download was cancelled');
      }
    } catch (error) {
      try {
        if (target.exists) target.delete();
      } catch {
        // ignore cleanup failure
      }
      throw new Error(
        `Model download failed (${stage === 'llm' ? 'Qwen2.5 0.5B' : 'nomic-embed'}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    bytesBeforeStage += spec.size;
  }
}

export const TOTAL_MODEL_BYTES = LLM_MODEL.size + EMBED_MODEL.size;
