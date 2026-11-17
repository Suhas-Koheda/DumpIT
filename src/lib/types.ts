import type { AgentStep } from './agent';

export type DumpKind = 'text' | 'link' | 'image';
export type Platform = 'x' | 'linkedin' | 'web' | null;
export type AgentStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export type { AgentStep, AgentStepStatus, AgentResult } from './agent';

export interface DumpItem {
  id: string;
  kind: DumpKind;
  platform: Platform;
  title: string;
  text: string;
  url: string | null;
  urlHost: string | null;
  imageUri: string | null;
  imageName: string | null;
  createdAt: number;
  agent: AgentStatus;
  steps: AgentStep[];
  summary: string | null;
  sources: string[];
  extracted: string | null;
}
