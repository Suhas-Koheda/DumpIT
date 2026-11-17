import { extractAllUrls, readLinkContent } from './link-reader';
import { modelReady, summarizeEvidence } from './llm';

export type AgentStepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';
export type AgentStepKind = 'tool' | 'think' | 'done';

export interface AgentStep {
  id: string;
  label: string;
  detail?: string;
  status: AgentStepStatus;
  kind: AgentStepKind;
}

export interface AgentResult {
  steps: AgentStep[];
  summary: string;
  sources: string[];
  extracted: string | null;
}

const MAX_READS = 3;

function step(kind: AgentStepKind, label: string): AgentStep {
  return { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, label, status: 'pending', kind };
}

/**
 * Agentic loop: observe → decide which tool to call → collect evidence →
 * decide again. No fixed script beyond the bookkeeping; the order and depth
 * of reads emerges from the content itself.
 */
export async function runAgent(
  input: { title: string; text: string; url: string | null },
  onSteps: (steps: AgentStep[]) => void
): Promise<AgentResult> {
  const steps: AgentStep[] = [];
  const sources: string[] = [];
  const evidenceBlocks: string[] = [];
  const failed = new Set<string>();
  const seen = new Set<string>();
  const candidates: string[] = [];

  const emit = () => onSteps([...steps]);
  const begin = (label: string, kind: AgentStepKind = 'tool') => {
    const s = step(kind, label);
    steps.push(s);
    emit();
    return s;
  };
  const finish = (s: AgentStep, status: AgentStepStatus, detail?: string) => {
    s.status = status;
    if (detail !== undefined) s.detail = detail;
    emit();
  };

  // ── Step 1: scan the dump for links ──────────────────────────────
  const scan = begin('Scanning for links');
  const seedText = [input.title, input.text, input.url ?? ''].filter(Boolean).join(' ');
  for (const u of extractAllUrls(seedText)) {
    if (!seen.has(u)) {
      seen.add(u);
      candidates.push(u);
    }
  }
  if (input.url && !seen.has(input.url)) {
    seen.add(input.url);
    candidates.push(input.url);
  }
  finish(scan, 'done', candidates.length > 0 ? `${candidates.length} link(s) found` : 'No links — text only');

  // ── Step 2: agentic read loop — read the most useful unread link, discover nested links ──
  const readOne = async (url: string): Promise<boolean> => {
    if (failed.has(url)) return false;
    const read = await readLinkContent(url);
    if (!read.pageText) {
      failed.add(url);
      return false;
    }
    evidenceBlocks.push(`[${sources.length + 1}] ${read.pageTitle ?? url}\n${read.pageText}`);
    sources.push(`${read.pageTitle ?? url}`);
    for (const nested of extractAllUrls(read.pageText + ' ' + url)) {
      if (!seen.has(nested)) {
        seen.add(nested);
        candidates.push(nested);
      }
    }
    return true;
  };

  for (let i = 0; i < MAX_READS; i++) {
    const unread = candidates.filter((u) => !evidenceBlocks.some((b) => b.includes(u)));
    const next = unread[0];
    if (!next) break;

    const s = begin(`Reading ${shorten(next)}`);
    const ok = await readOne(next);
    if (ok) {
      const chars = evidenceBlocks[evidenceBlocks.length - 1]?.length ?? 0;
      finish(s, 'done', `${chars.toLocaleString()} chars of evidence`);
    } else {
      finish(s, 'failed', 'Unreadable — link blocked or offline');
    }
  }

  // New nested links that appeared mid-loop were appended above; nothing else to do.

  // ── Step 3: summarize what we have ───────────────────────────────
  const think = begin('Summarizing…', 'think');
  const evidence = evidenceBlocks.join('\n\n').slice(0, 3600);
  let summary: string | null = null;

  if (modelReady()) {
    summary = await summarizeEvidence({
      title: input.title,
      text: input.text,
      evidence,
    });
  }

  if (!summary) {
    // Heuristic fallback: first substantive sentences from the deepest source.
    const sourceText = evidenceBlocks[evidenceBlocks.length - 1] ?? input.text ?? input.title;
    summary = heuristicSummary(sourceText);
  }
  finish(think, 'done', summary ? summary.slice(0, 80) + (summary.length > 80 ? '…' : '') : 'No summary available');

  const done = step('done', 'Research complete');
  done.status = 'done';
  steps.push(done);
  emit();

  return {
    steps,
    summary,
    sources,
    extracted: evidenceBlocks.length > 0 ? evidenceBlocks.join('\n\n') : null,
  };
}

function shorten(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 34 ? u.pathname.slice(0, 34) + '…' : u.pathname;
    return `${u.hostname.replace(/^www\./, '')}${path}`;
  } catch {
    return url.length > 44 ? url.slice(0, 44) + '…' : url;
  }
}

function heuristicSummary(text: string): string {
  const cleaned = text
    .replace(/^\[\d+\] [^\n]+\n/, '') // strip leading "[N] title" header
    .trim();
  const sentences = cleaned.match(/[^.!?\n]+[.!?]+/g) ?? [cleaned];
  const picked = sentences
    .map((s) => s.trim())
    .filter((s) => s.length > 30)
    .slice(0, 2)
    .join(' ');
  const out = picked || cleaned.slice(0, 280);
  return out.length > 400 ? out.slice(0, 400) + '…' : out;
}
