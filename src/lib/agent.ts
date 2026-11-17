import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';

import { StateGraph, START, END, Annotation } from '@langchain/langgraph/web';

import { extractAllUrls } from './link-reader';
import { modelReady, summarizeEvidence } from './llm';
import { readLinkTool, findLinksTool } from './agent-tools';

// ── State annotation ─────────────────────────────────────────────────────────
export type AgentStepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface AgentStep {
  id: string;
  label: string;
  detail?: string;
  status: AgentStepStatus;
  kind: 'tool' | 'think' | 'done';
}

const AgentState = Annotation.Root({
  input: Annotation<{ title: string; text: string; url: string | null }>(),
  candidates: Annotation<string[]>({ reducer: (_, v) => v, default: () => [] }),
  reads: Annotation<number>({ reducer: (_, v) => v, default: () => 0 }),
  evidenceBlocks: Annotation<string[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
  sources: Annotation<string[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
  steps: Annotation<AgentStep[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
  summary: Annotation<string | null>({ reducer: (_, v) => v, default: () => null }),
});

export interface AgentResult {
  steps: AgentStep[];
  summary: string;
  sources: string[];
  extracted: string | null;
}

const MAX_READS = 3;

function nextId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
function step(label: string, kind: AgentStep['kind'], status: AgentStepStatus = 'running'): AgentStep {
  return { id: nextId(), label, status, kind };
}

// ── Nodes ────────────────────────────────────────────────────────────────────
async function scanNode(state: typeof AgentState.State): Promise<Partial<typeof AgentState.State>> {
  const { input } = state;
  const s = step('Scanning for links', 'tool', 'running');

  const seedText = [input.title, input.text, input.url ?? ''].filter(Boolean).join(' ');
  const found = (await findLinksTool.invoke({ text: seedText })) as string;
  const fromText = JSON.parse(found) as string[];
  const candidates = [...new Set([...(input.url ? [input.url] : []), ...fromText])];

  s.status = 'done';
  s.detail = candidates.length > 0 ? `${candidates.length} link(s) found` : 'No links — text only';

  return { candidates, steps: [s] };
}

async function readNode(state: typeof AgentState.State): Promise<Partial<typeof AgentState.State>> {
  const { candidates, reads, evidenceBlocks, sources } = state;
  const next = candidates.find((u) => !evidenceBlocks.some((b) => b.includes(u)));
  if (!next) {
    return { reads: reads + 1 };
  }

  const s = step(`Reading ${next.length > 44 ? next.slice(0, 44) + '…' : next}`, 'tool', 'running');
  let newEvidence: string[] = [];
  let newSources: string[] = [];
  let newCandidates = state.candidates;

  try {
    const raw = (await readLinkTool.invoke({ url: next })) as string;
    const parsed = JSON.parse(raw) as { ok: boolean; title?: string | null; text?: string; source?: string };
    if (parsed.ok && parsed.text) {
      const title = parsed.title ?? next;
      newEvidence = [`[${sources.length + 1}] ${title} — ${next}\n${parsed.text}`];
      newSources = [title];
      const nested = extractAllUrls(`${parsed.text} ${next}`);
      newCandidates = [...new Set([...state.candidates, ...nested])];
      s.status = 'done';
      s.detail = `${parsed.text.length.toLocaleString()} chars of evidence`;
    } else {
      s.status = 'failed';
      s.detail = 'Unreadable — link blocked or offline';
    }
  } catch {
    s.status = 'failed';
    s.detail = 'Unreadable — link blocked or offline';
  }

  return {
    reads: reads + 1,
    evidenceBlocks: newEvidence,
    sources: newSources,
    candidates: newCandidates,
    steps: [s],
  };
}

async function summarizeNode(state: typeof AgentState.State): Promise<Partial<typeof AgentState.State>> {
  const s = step('Summarizing…', 'think', 'running');

  const evidence = state.evidenceBlocks.join('\n\n').slice(0, 3600);
  let summary: string | null = null;

  if (modelReady()) {
    summary = await summarizeEvidence({
      title: state.input.title,
      text: state.input.text,
      evidence,
    });
  }

  if (!summary) {
    const sourceText = state.evidenceBlocks[state.evidenceBlocks.length - 1] ?? state.input.text ?? state.input.title;
    summary = sourceText.trim().slice(0, 280) || null;
  }

  s.status = 'done';
  s.detail = summary ? summary.slice(0, 80) + (summary.length > 80 ? '…' : '') : 'No summary available';

  return { summary, steps: [s] };
}

async function finalizeNode(state: typeof AgentState.State): Promise<Partial<typeof AgentState.State>> {
  const s = step('Research complete', 'done', 'done');
  return { steps: [s] };
}

function shouldContinue(state: typeof AgentState.State): 'read' | 'summarize' {
  const unread = state.candidates.filter((u) => !state.evidenceBlocks.some((b) => b.includes(u)));
  if (unread.length > 0 && state.reads < MAX_READS) return 'read';
  return 'summarize';
}

const workflow = new StateGraph(AgentState)
  .addNode('scan', scanNode)
  .addNode('read', readNode)
  .addNode('summarize', summarizeNode)
  .addNode('finalize', finalizeNode)
  .addEdge(START, 'scan')
  .addConditionalEdges('scan', shouldContinue, { read: 'read', summarize: 'summarize' })
  .addConditionalEdges('read', shouldContinue, { read: 'read', summarize: 'summarize' })
  .addEdge('summarize', 'finalize')
  .addEdge('finalize', END)
  .compile();

// ── Public API ───────────────────────────────────────────────────────────────
export async function runAgent(
  input: { title: string; text: string; url: string | null },
  onSteps: (steps: AgentStep[]) => void
): Promise<AgentResult> {
  const result = await workflow.invoke(
    { input, candidates: [], reads: 0, evidenceBlocks: [], sources: [], steps: [], summary: null },
    { recursionLimit: 10 }
  );

  // Replay steps through onSteps so the UI can render them live.
  for (let i = 1; i <= result.steps.length; i++) {
    onSteps([...result.steps.slice(0, i)]);
  }

  return {
    steps: result.steps,
    summary: result.summary ?? (result.evidenceBlocks.join('\n\n').trim().slice(0, 280) || ''),
    sources: result.sources,
    extracted: result.evidenceBlocks.length > 0 ? result.evidenceBlocks.join('\n\n') : null,
  };
}

