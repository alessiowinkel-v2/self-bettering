import {
  colorsDark,
  colorsLight,
  motion,
  radii,
  spacing,
  type,
  type ColorPalette,
  type Motion,
  type Radii,
  type Spacing,
  type TypeStyles,
} from './tokens';

export type ThemeMode = 'dark' | 'light';

export type Theme = {
  mode: ThemeMode;
  colors: ColorPalette;
  type: TypeStyles;
  spacing: Spacing;
  radii: Radii;
  motion: Motion;
};

export const darkTheme: Theme = {
  mode: 'dark',
  colors: colorsDark,
  type,
  spacing,
  radii,
  motion,
};

export const lightTheme: Theme = {
  mode: 'light',
  colors: colorsLight,
  type,
  spacing,
  radii,
  motion,
};

export { ThemeProvider, useTheme, useThemeMode } from './ThemeProvider';
export { useThemeStore, type ThemeOverride } from './useThemeStore';
export type { ColorPalette, ColorRole, TypeRole } from './tokens';
