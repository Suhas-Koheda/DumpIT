import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

/**
 * DumpIT — stock Material 3 (Paper's own MD3 themes). They carry the full MD3
 * token set with correct on-colors everywhere — maximum contrast, zero guessing.
 * Dark mode is one tap in Settings.
 */
export const lightPaperTheme = {
  ...MD3LightTheme,
  roundness: 4,
};

export const darkPaperTheme = {
  ...MD3DarkTheme,
  roundness: 4,
};

export type ThemeMode = 'system' | 'light' | 'dark';
export const pickScheme = (mode: ThemeMode, systemScheme: 'light' | 'dark') =>
  mode === 'system' ? systemScheme : mode;
