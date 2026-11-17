/**
 * On-device OCR via Google ML Kit (Latin script). Lazy + guarded: the native
 * module only exists in a development build, never in Expo Go, so every
 * access goes through `ocrAvailable()` / try-catch.
 */

type MlKitTextRecognition = {
  recognize: (path: string, script?: string) => Promise<{ text: string }>;
};

let cached: MlKitTextRecognition | null | undefined;

function loadModule(): MlKitTextRecognition | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-ml-kit/text-recognition');
    cached = (mod?.default ?? mod) as MlKitTextRecognition;
  } catch {
    cached = null;
  }
  return cached;
}

export function ocrAvailable(): boolean {
  return loadModule() !== null;
}

/** Returns the recognized text (may be empty). Throws when ML Kit is unavailable. */
export async function recognizeText(imagePath: string): Promise<string> {
  const mod = loadModule();
  if (!mod) {
    throw new Error('On-device OCR is unavailable (needs a development build)');
  }
  const result = await mod.recognize(imagePath, 'Latin');
  return (result?.text ?? '').trim();
}
