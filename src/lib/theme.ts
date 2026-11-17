import { useColorScheme } from 'react-native';

export interface Palette {
  bg: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  faint: string;
  accent: string;
  onAccent: string;
  danger: string;
}

export const palettes: { light: Palette; dark: Palette } = {
  light: {
    bg: '#FAFAF7',
    card: '#FFFFFF',
    border: '#E4E3DD',
    text: '#141414',
    muted: '#5E5E5A',
    faint: '#9A9A94',
    accent: '#3E5C4C',
    onAccent: '#FFFFFF',
    danger: '#BA1A1A',
  },
  dark: {
    bg: '#101013',
    card: '#1B1B21',
    border: '#2A2A33',
    text: '#EDEDEF',
    muted: '#A9A9B2',
    faint: '#6E6E78',
    accent: '#8FB893',
    onAccent: '#10160F',
    danger: '#FFB4AB',
  },
};

export function usePalette(): Palette {
  const scheme = useColorScheme();
  return scheme === 'dark' ? palettes.dark : palettes.light;
}
