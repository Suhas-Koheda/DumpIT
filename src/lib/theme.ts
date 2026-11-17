import type { DumpItem } from './types';

/**
 * RawBlock — black-on-white brutalism. 0px radius, no shadows, 3-5px black
 * borders, #0000FF reserved for links. See DESIGN.md.
 */
export const colors = {
  bg: '#FFFFFF',
  card: '#FFFFFF',
  elevated: '#FFFFFF', // heavier border = more importance
  sunken: '#F0F0F0',
  divider: '#000000',
  border: '#000000',
  text: '#000000',
  muted: '#3B3B3B',
  faint: '#767676',
  ink: '#FFFFFF',
  accent: '#000000',
  blue: '#0000FF', // hyperlinks only
  success: '#008000',
  warning: '#FFA500',
  error: '#FF0000',
  successFill: '#008000',
  warningFill: '#FFA500',
  errorFill: '#FF0000',
  disabledBorder: '#CCCCCC',
  disabledFill: '#F5F5F5',
};

export const fonts = {
  display: 'ArchivoBlack_400Regular',
  h1: 'ArchivoBlack_400Regular',
  h2: 'ArchivoBlack_400Regular',
  h3: 'ArchivoBlack_400Regular',
  h4: 'WorkSans_600SemiBold',
  label: 'ArchivoBlack_400Regular',
  body: 'WorkSans_400Regular',
  bodyMedium: 'WorkSans_500Medium',
  bodySemi: 'WorkSans_600SemiBold',
  bodyItalic: 'WorkSans_400Regular', // Work Sans has no italics; keep weight
  mono: 'SpaceMono_400Regular',
};

export const borders = {
  thin: 1,
  base: 2,
  thick: 3,
  heavy: 5,
} as const;

export interface BadgeMeta {
  label: string;
  inverted?: boolean;
}

/** Badge shown on every card — monochrome per RawBlock. */
export function badgeFor(item: DumpItem): BadgeMeta {
  if (item.kind === 'image') return { label: 'SCREENSHOT' };
  if (item.kind === 'text') return { label: 'TEXT' };
  switch (item.platform) {
    case 'x':
      return { label: 'X / TWITTER', inverted: true };
    case 'linkedin':
      return { label: 'LINKEDIN' };
    default:
      return { label: 'LINK' };
  }
}
