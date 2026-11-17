import { Directory, File, Paths } from 'expo-file-system';
import Constants from 'expo-constants';

/**
 * Tiny on-device summarizer. Everything stays on the phone. If the model
 * isn't downloaded, callers fall back to a heuristic summary.
 */

export const LLM_MODEL = {
  name: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
  url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
  size: 491_400_032,
} as const;

const isExpoGo = Constants.appOwnership === 'expo';

export function modelsDir(): Directory {
  const dir = new Directory(Paths.document, 'dumpit-models');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export function modelFile(): File {
  return new File(modelsDir(), LLM_MODEL.name);
}

export function modelReady(): boolean {
  if (isExpoGo) return false;
  const file = modelFile();
  return file.exists && file.size > 0;
}

// llama.rn ships no root "." export; Metro resolves it via the "react-native" field.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { initLlama } = require('llama.rn') as typeof import('llama.rn');

let llmContext: any | null = null;

async function getLlmContext() {
  if (!modelReady()) return null;
  if (!llmContext) {
    llmContext = await initLlama({
      model: modelFile().uri,
      n_ctx: 2048,
      n_gpu_layers: 0,
    });
  }
  return llmContext;
}

export async function summarizeEvidence(input: {
  title: string;
  text: string;
  evidence: string;
}): Promise<string | null> {
  const context = await getLlmContext();
  if (!context) return null;

  const body = [
    input.title ? `Item: ${input.title}` : null,
    input.text ? `Shared text: ${input.text}` : null,
    input.evidence ? `Page content found by the reader:\n${input.evidence.slice(0, 3200)}` : null,
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 4200);

  try {
    const result = await context.completion({
      messages: [
        {
          role: 'system',
          content:
            'You summarize saved content (tweets, posts, articles, docs). Reply with ONE or TWO short sentences describing what the content actually says — facts, not meta commentary. No preamble, no quotes.',
        },
        { role: 'user', content: body },
      ],
      n_predict: 120,
      temperature: 0,
      stop: ['<|im_end|>', '<|endoftext|>'],
    });
    const text: string = (result.text ?? '').trim();
    return text.length > 0 ? text.slice(0, 400) : null;
  } catch {
    return null;
  }
}

/** Download the model with progress 0..1. Throws on failure and deletes partial files. */
export async function downloadModel(
  onProgress: (fraction: number) => void
): Promise<void> {
  const target = modelFile();
  if (target.exists && target.size > 0) return;
  if (target.exists) target.delete();

  const task = File.createDownloadTask(LLM_MODEL.url, target, {
    onProgress: ({ bytesWritten, totalBytes }) => {
      const total = totalBytes > 0 ? totalBytes : LLM_MODEL.size;
      onProgress(Math.min(1, bytesWritten / total));
    },
  });
  const result = await task.downloadAsync();
  if (!result) {
    if (target.exists) target.delete();
    throw new Error('Download cancelled');
  }
}
