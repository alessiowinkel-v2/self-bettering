import {
  colorsDark,
  colorsLight,
  motion,
  radii,
  spacing,
  touchTarget,
  type,
  type ColorPalette,
  type Motion,
  type Radii,
  type Spacing,
  type TouchTarget,
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
  touchTarget: TouchTarget;
};

export const darkTheme: Theme = {
  mode: 'dark',
  colors: colorsDark,
  type,
  spacing,
  radii,
  motion,
  touchTarget,
};

export const lightTheme: Theme = {
  mode: 'light',
  colors: colorsLight,
  type,
  spacing,
  radii,
  motion,
  touchTarget,
};

export { ThemeProvider, useTheme, useThemeMode } from './ThemeProvider';
export { useThemeStore, type ThemeOverride } from './useThemeStore';
export type { ColorPalette, ColorRole, TypeRole } from './tokens';
