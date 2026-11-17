import Constants from 'expo-constants';

import { embedModelFile, embedModelReady, llmModelFile, llmModelReady } from './ai-models';
import { extractAllUrls, readLinkContent } from './link-reader';
import type { ExtractedEntity } from './types';

/**
 * On-device inference. llama.rn is a native module that only exists in a
 * development build — never in Expo Go — so the module is loaded lazily and
 * every entry point degrades to `null`/`false` when unavailable.
 */

type LlamaModule = any; // llama.rn's types depend on a linked native build; keep the interop loose.

const isExpoGo = Constants.appOwnership === 'expo';

let llamaModule: LlamaModule | null | undefined;

function getLlama(): LlamaModule | null {
  if (isExpoGo) return null;
  if (llamaModule !== undefined) return llamaModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    llamaModule = require('llama.rn');
  } catch {
    llamaModule = null;
  }
  return llamaModule;
}

/** Native runtime exists (development build on a supported device). */
export function engineAvailable(): boolean {
  return getLlama() !== null;
}

let llmContext: any | null = null;
let embedContext: any | null = null;

async function getLlmContext() {
  const llama = getLlama();
  if (!llama) throw new Error('On-device AI is unavailable in Expo Go — use a development build.');
  if (!llmModelReady()) throw new Error('The language model is not downloaded yet.');
  if (!llmContext) {
    llmContext = await llama.initLlama({
      model: llmModelFile().uri,
      n_ctx: 2048,
      n_gpu_layers: 0,
      n_predict: 256,
    });
  }
  return llmContext;
}

async function getEmbedContext() {
  const llama = getLlama();
  if (!llama) throw new Error('On-device AI is unavailable in Expo Go — use a development build.');
  if (!embedModelReady()) throw new Error('The embedding model is not downloaded yet.');
  if (!embedContext) {
    embedContext = await llama.initLlama({
      model: embedModelFile().uri,
      n_ctx: 2048,
      n_gpu_layers: 0,
      embedding: true,
    });
  }
  return embedContext;
}

const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'One or two plain sentences describing what this post/note/link is about.',
    },
    entities: {
      type: 'array',
      description: 'Named things explicitly present in the text: people, organizations, products, dates, amounts, locations.',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'person | organization | product | date | amount | place | topic' },
          value: { type: 'string' },
        },
        required: ['type', 'value'],
        additionalProperties: false,
      },
    },
    todos: {
      type: 'array',
      description: 'Concrete action items explicitly implied or stated in the text. Empty array if none.',
      items: { type: 'string' },
    },
    links: {
      type: 'array',
      description: 'URLs mentioned in the text. Empty array if none.',
      items: { type: 'string' },
    },
  },
  required: ['summary', 'entities', 'todos', 'links'],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = [
  'You analyze small bits of saved content (tweets, posts, articles, screenshots of text, personal notes).',
  'Reply with strict JSON only: summary, entities, todos, links.',
  'summary: 1-2 short sentences, plain words, no hype, no preamble. It MUST describe what the content says, never what the URL is.',
  'If PAGE CONTENT is present, base the analysis on it. If only a URL is present, describe the URL\'s likely content from the URL itself and the provided text.',
  'entities: only things actually in the text; 0-8 entries.',
  'todos: only real action items; else [].',
  'links: URLs in the text; else [].',
  'Never invent details that are not in the input.',
].join(' ');

export interface EngineAnalysis {
  summary: string;
  entities: ExtractedEntity[];
  todos: string[];
  links: string[];
}

function parseAnalysis(raw: string): EngineAnalysis {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  const candidate = start !== -1 && end > start ? raw.slice(start, end + 1) : raw;
  const parsed = JSON.parse(candidate) as Partial<EngineAnalysis>;
  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
    entities: Array.isArray(parsed.entities)
      ? parsed.entities
          .filter(
            (e): e is ExtractedEntity =>
              !!e && typeof e === 'object' && typeof e.value === 'string' && e.value.trim().length > 0
          )
          .map((e) => ({ type: String(e.type ?? 'topic').toLowerCase().trim(), value: e.value.trim() }))
          .slice(0, 8)
      : [],
    todos: Array.isArray(parsed.todos)
      ? parsed.todos.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).slice(0, 6)
      : [],
    links: Array.isArray(parsed.links)
      ? parsed.links.filter((l): l is string => typeof l === 'string' && l.trim().length > 0).slice(0, 6)
      : [],
  };
}

export interface AnalysisInput {
  title: string;
  text: string;
  url: string | null;
  ocrText?: string;
  pageText?: string;
}

const ACTION_SCHEMA = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['read', 'analyze'] },
    url: { type: 'string' },
  },
  required: ['action'],
  additionalProperties: false,
} as const;

const AGENT_SYSTEM = [
  'You are an investigating agent inside a note-taking app.',
  'Goal: understand what the saved item is about.',
  'Each step you see the item, the evidence gathered so far, and the unread links.',
  'Reply with strict JSON only:',
  '{"action":"read","url":"<one of the unread links>"} — open the ONE link that best explains the item right now,',
  'or {"action":"analyze"} — you already have enough to summarize.',
  'Links usually reveal more links (a tweet shares a doc; a t.co hides the destination).',
  'Prefer the unread link that most likely contains the actual content.',
  'Never invent URLs. Never re-read a source you already have.',
  'When you have enough to describe the item, stop investigating.',
].join(' ');

interface EvidenceBlock {
  url: string;
  pageTitle: string | null;
  pageText: string;
}

export interface AgentResult {
  analysis: EngineAnalysis;
  /** Titles of every source the agent actually visited. */
  sources: string[];
  /** Combined evidence text fed to the model (kept for embeddings). */
  pageText: string;
}

function labelFor(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (/(^|\.)x\.com$|(^|\.)twitter\.com$/i.test(host)) return 'X post';
    if (/(^|\.)docs\.google\.com$/.test(host)) return 'Google Doc';
    return host;
  } catch {
    return url;
  }
}

async function askAgent(
  context: { completion: (params: unknown, cb?: unknown) => Promise<{ text?: string }> },
  input: AnalysisInput,
  evidence: EvidenceBlock[],
  unread: string[],
  step: number,
  maxSteps: number
): Promise<{ action: 'read' | 'analyze'; url?: string }> {
  const evidenceText = evidence
    .map(
      (block, index) =>
        `[${index + 1}] ${block.pageTitle ?? block.url}\n${block.pageText.slice(0, 500)}`
    )
    .join('\n\n');
  const user = [
    `STEP ${step} OF ${maxSteps}`,
    `SAVED ITEM:`,
    input.title ? `Title: ${input.title}` : null,
    input.text ? `Text: ${input.text}` : null,
    input.ocrText ? `Screenshot text: ${input.ocrText}` : null,
    evidence.length > 0 ? `EVIDENCE SO FAR:\n${evidenceText}` : 'EVIDENCE SO FAR: (none)',
    `UNREAD LINKS:\n${unread.map((u) => `- ${u}`).join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const result = await context.completion({
      messages: [
        { role: 'system', content: AGENT_SYSTEM },
        { role: 'user', content: user },
      ],
      n_predict: 60,
      temperature: 0,
      stop: ['<|im_end|>', '<|endoftext|>'],
      response_format: {
        type: 'json_schema',
        json_schema: { strict: true, schema: ACTION_SCHEMA },
      },
    });
    const raw: string = result.text ?? '';
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end <= start) return { action: 'read' };
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      action?: string;
      url?: string;
    };
    if (parsed.action === 'read' && typeof parsed.url === 'string') {
      return { action: 'read', url: parsed.url };
    }
    if (parsed.action === 'analyze') return { action: 'analyze' };
    return { action: 'read' };
  } catch {
    return { action: 'read' };
  }
}

/**
 * Agentic oracle loop — no fixed pipeline. Each step the model observes the
 * item + all evidence gathered so far + the unread links, then decides:
 * open ONE more link ("read") or finish ("analyze"). Nested links discovered
 * inside evidence (a tweet → its Google Doc, a t.co → its destination) join
 * the candidate set automatically. Bounded by MAX_STEPS; if the model fumbles
 * an action, the executor reads the top unread candidate rather than stall.
 */
export async function agentAnalyze(input: AnalysisInput): Promise<AgentResult> {
  const context = await getLlmContext();
  const sources: string[] = [];
  const evidence: EvidenceBlock[] = [];
  const failed = new Set<string>();
  const seen = new Set<string>();
  const candidates: string[] = [];

  const addCandidates = (urls: string[]) => {
    for (const u of urls) {
      if (!seen.has(u)) {
        seen.add(u);
        candidates.push(u);
      }
    }
  };

  addCandidates([
    ...(input.url ? [input.url] : []),
    ...extractAllUrls([input.text, input.ocrText ?? ''].join(' ')),
  ]);

  const readOne = async (url: string): Promise<boolean> => {
    if (failed.has(url)) return false;
    const read = await readLinkContent(url);
    if (!read.pageText) {
      failed.add(url);
      return false;
    }
    evidence.push({ url, pageTitle: read.pageTitle, pageText: read.pageText });
    sources.push(read.pageTitle ?? labelFor(url));
    // Discover new links from the content (e.g. tweet → its Google Doc).
    addCandidates(extractAllUrls(read.pageText + ' ' + url));
    return true;
  };

  const MAX_STEPS = 4;
  for (let step = 0; step < MAX_STEPS; step++) {
    const unread = candidates.filter(
      (u) => !evidence.some((b) => b.url === u) && !failed.has(u)
    );
    if (unread.length === 0) break; // nothing left to investigate

    // The model decides what to read next — or that it has seen enough.
    const { action, url } = await askAgent(context, input, evidence, unread, step + 1, MAX_STEPS);

    if (action === 'analyze') break;

    const target =
      action === 'read' && url && unread.includes(url) ? url : unread[0]; // fumbled → deterministic fallback
    await readOne(target);
  }

  const pageText = evidence
    .map(
      (block, index) =>
        `[SOURCE ${index + 1}: ${block.pageTitle ?? block.url} — ${block.url}]\n${block.pageText}`
    )
    .join('\n\n')
    .slice(0, 6000);

  const analysis = await analyzeDump({ ...input, pageText });
  return { analysis, sources, pageText };
}

export async function analyzeDump(input: AnalysisInput): Promise<EngineAnalysis> {
  const context = await getLlmContext();
  const body = [
    input.url ? `LINK: ${input.url}` : null,
    input.title ? `TITLE: ${input.title}` : null,
    input.text ? `TEXT: ${input.text}` : null,
    input.ocrText ? `SCREENSHOT TEXT (OCR):\n${input.ocrText}` : null,
    input.pageText ? `PAGE CONTENT (fetched from the link):\n${input.pageText}` : null,
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 5200);

  const result = await context.completion({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Analyze this saved content:\n\n${body}` },
    ],
    n_predict: 220,
    temperature: 0,
    stop: ['<|im_end|>', '<|endoftext|>'],
    response_format: {
      type: 'json_schema',
      json_schema: { strict: true, schema: ANALYSIS_SCHEMA },
    },
  });

  const analysis = parseAnalysis(result.text ?? '');
  if (!analysis.summary) {
    // Fall back to something useful even if the 0.5B model fumbles.
    analysis.summary = (input.text || input.ocrText || input.title).split('\n')[0].slice(0, 140);
  }
  return analysis;
}

export async function embedDocument(text: string): Promise<number[]> {
  const context = await getEmbedContext();
  const input = `search_document: ${text.replace(/\s+/g, ' ').trim().slice(0, 1500)}`;
  const { embedding } = await context.embedding(input);
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error('Embedding model returned no vector');
  }
  return Array.from(embedding);
}

export async function embedQuery(text: string): Promise<number[] | null> {
  try {
    if (!engineAvailable() || !embedModelReady()) return null;
    const context = await getEmbedContext();
    const { embedding } = await context.embedding(
      `search_query: ${text.replace(/\s+/g, ' ').trim().slice(0, 500)}`
    );
    return Array.from(embedding);
  } catch {
    return null;
  }
}
