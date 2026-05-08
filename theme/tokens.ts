import type { TextStyle } from 'react-native';

export type ColorRole =
  | 'bg'
  | 'surface'
  | 'surfaceElev'
  | 'textPrimary'
  | 'textSecondary'
  | 'textTertiary'
  | 'accent'
  | 'divider';

export type ColorPalette = Record<ColorRole, string>;

export const colorsDark: ColorPalette = {
  bg: '#100F0D',
  surface: '#1A1815',
  surfaceElev: '#23201B',
  textPrimary: '#ECE7DD',
  textSecondary: '#8C857A',
  textTertiary: '#5A554E',
  accent: '#E8A24C',
  divider: '#26242A',
};

export const colorsLight: ColorPalette = {
  bg: '#F4EFE6',
  surface: '#ECE5D6',
  surfaceElev: '#E3DAC7',
  textPrimary: '#1B1916',
  textSecondary: '#6E665A',
  textTertiary: '#9C9486',
  accent: '#C9802A',
  divider: '#E2DCD0',
};

export type TypeRole =
  | 'display'
  | 'displayXL'
  | 'displayItalic'
  | 'heading'
  | 'body'
  | 'bodyMedium'
  | 'bodyItalicFraunces'
  | 'label'
  | 'caption'
  | 'streakAccent';

export type TypeStyles = Record<TypeRole, TextStyle>;

export const type: TypeStyles = {
  display: {
    fontFamily: 'Fraunces_400Regular',
    fontSize: 32,
    lineHeight: 38,
  },
  displayXL: {
    fontFamily: 'Fraunces_400Regular',
    fontSize: 72,
    lineHeight: 76,
    fontVariant: ['lining-nums'],
  },
  displayItalic: {
    fontFamily: 'Fraunces_400Regular_Italic',
    fontSize: 28,
    lineHeight: 34,
  },
  heading: {
    fontFamily: 'Fraunces_400Regular',
    fontSize: 20,
    lineHeight: 26,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 22,
  },
  bodyMedium: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 22,
  },
  bodyItalicFraunces: {
    fontFamily: 'Fraunces_400Regular_Italic',
    fontSize: 16,
    lineHeight: 22,
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.9,
  },
  caption: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  streakAccent: {
    fontFamily: 'Fraunces_400Regular',
    fontSize: 18,
    lineHeight: 22,
    fontVariant: ['lining-nums'],
  },
};

export const spacing = [0, 4, 8, 12, 16, 24, 32, 48, 64] as const;
export type Spacing = typeof spacing;

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;
export type Radii = typeof radii;

export const touchTarget = {
  minHeight: 44,
} as const;
export type TouchTarget = typeof touchTarget;

export const motion = {
  durations: {
    fast: 120,
    base: 200,
    slow: 320,
  },
  easing: {
    standard: 'ease-out' as const,
  },
} as const;
export type Motion = typeof motion;
