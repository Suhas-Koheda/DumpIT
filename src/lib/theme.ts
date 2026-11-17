import type { DumpItem } from './types';

/**
 * Legacy badge export kept for the DumpCard call-site. `tone` picks which
 * Paper container the chip uses; labels are uppercase and terse.
 */
export interface BadgeMeta {
  label: string;
  tone: 'accent' | 'neutral';
}

export function badgeFor(item: DumpItem): BadgeMeta {
  if (item.kind === 'image') return { label: 'SCREENSHOT', tone: 'accent' };
  if (item.kind === 'text') return { label: 'TEXT', tone: 'neutral' };
  switch (item.platform) {
    case 'x':
      return { label: 'X / TWITTER', tone: 'accent' };
    case 'linkedin':
      return { label: 'LINKEDIN', tone: 'neutral' };
    default:
      return { label: 'LINK', tone: 'neutral' };
  }
}
