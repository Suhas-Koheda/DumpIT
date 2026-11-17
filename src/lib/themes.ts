import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

/**
 * DumpIT — Material 3 (Material You-ish). Sage botanical primary on warm
 * paper, dark mode included. Paper's MD3 base is spread first so every
 * required token exists; we override the palette to our own.
 */
export const lightScheme = {
  ...MD3LightTheme.colors,
  primary: '#3E5C4C',
  onPrimary: '#FFFFFF',
  primaryContainer: '#C7EBCE',
  onPrimaryContainer: '#0E2B1C',
  secondary: '#4E6356',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#D0E8D4',
  onSecondaryContainer: '#0F2B1A',
  tertiary: '#415E63',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#C2E7EB',
  onTertiaryContainer: '#001F22',
  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#410002',
  background: '#FAF8EE',
  onBackground: '#1B1D15',
  surface: '#FAF8EE',
  onSurface: '#1B1D15',
  surfaceVariant: '#E3E3D6',
  onSurfaceVariant: '#47483F',
  outline: '#77786D',
  outlineVariant: '#C7C7BA',
  inverseSurface: '#2F312A',
  inverseOnSurface: '#F1F1E6',
  inversePrimary: '#A4D0AC',
};

export const darkScheme = {
  ...MD3DarkTheme.colors,
  primary: '#A4D0AC',
  onPrimary: '#0F3722',
  primaryContainer: '#1F5134',
  onPrimaryContainer: '#C7EFCF',
  secondary: '#B2CDB8',
  onSecondary: '#193423',
  secondaryContainer: '#304A37',
  onSecondaryContainer: '#CDEACF',
  tertiary: '#A7CBD1',
  onTertiary: '#0F373E',
  tertiaryContainer: '#254E55',
  onTertiaryContainer: '#C3E8EE',
  error: '#FFB4AB',
  onError: '#690005',
  errorContainer: '#93000A',
  onErrorContainer: '#FFDAD6',
  background: '#131511',
  onBackground: '#E3E3D8',
  surface: '#131511',
  onSurface: '#E3E3D8',
  surfaceVariant: '#45463C',
  onSurfaceVariant: '#C7C7BA',
  outline: '#919184',
  outlineVariant: '#47483F',
  inverseSurface: '#E3E3D8',
  inverseOnSurface: '#2F312A',
  inversePrimary: '#3E5C4C',
};

export const lightPaperTheme = {
  ...MD3LightTheme,
  colors: lightScheme,
  roundness: 3,
};

export const darkPaperTheme = {
  ...MD3DarkTheme,
  colors: darkScheme,
  roundness: 3,
};

export type ThemeMode = 'system' | 'light' | 'dark';
export const pickScheme = (mode: ThemeMode, systemScheme: 'light' | 'dark') =>
  mode === 'system' ? systemScheme : mode;
