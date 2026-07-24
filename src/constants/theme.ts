/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform, TextStyle } from 'react-native';

// Each theme is a color scheme with a light + dark variant sharing the same token
// keys, so every consumer (useTheme) is palette-agnostic. Ember is the default:
// warm-tinted surfaces + ember-orange brand tint, backgrounds deliberately NOT
// pure black/white (dark = layered espresso, light = warm paper with white cards).
// The other palettes follow the same structure per hue family.
// ponytail: hand-tuned hexes — tweak freely, contrast just needs to hold in both modes.
export const Themes = {
  ember: {
    name: 'Ember',
    light: {
      text: '#221D18',
      background: '#FAF6F1', // warm paper page
      backgroundElement: '#FFFFFF', // cards float on the paper
      backgroundSelected: '#F2EAE0',
      textSecondary: '#6E6862',
      border: '#EAE1D6', // hairline card/input edges
      tint: '#EA580C',
      onTint: '#FFFFFF', // text on a tint-colored surface
      success: '#2E9E4F',
      successBg: '#E5F5E9',
      danger: '#DE3730',
      accent: '#0E9BD8', // cool counterweight to the orange tint (kcal line on the Trendline)
    },
    dark: {
      text: '#F5F1EC',
      background: '#161210', // deep espresso, not stock black
      backgroundElement: '#221C17',
      backgroundSelected: '#332A22',
      textSecondary: '#A69E96',
      border: '#352C24',
      tint: '#FF8A3C',
      onTint: '#221204', // dark text on the bright ember button — higher contrast than white
      success: '#30D158',
      successBg: '#12351C',
      danger: '#FF5C52',
      accent: '#3BBDF8',
    },
  },
  ocean: {
    name: 'Ocean',
    light: {
      text: '#16202B',
      background: '#F4F7FA',
      backgroundElement: '#FFFFFF',
      backgroundSelected: '#E5EDF4',
      textSecondary: '#5B6B79',
      border: '#DCE5EC',
      tint: '#0E7FE0',
      onTint: '#FFFFFF',
      success: '#2E9E4F',
      successBg: '#E5F5E9',
      danger: '#DE3730',
      accent: '#E0700E', // warm counterweight to the blue tint
    },
    dark: {
      text: '#E8EEF4',
      background: '#0E141B',
      backgroundElement: '#18212B',
      backgroundSelected: '#24303C',
      textSecondary: '#93A2B0',
      border: '#2A3742',
      tint: '#4BA3F5',
      onTint: '#04121F',
      success: '#30D158',
      successBg: '#12351C',
      danger: '#FF5C52',
      accent: '#FFB068',
    },
  },
  forest: {
    name: 'Forest',
    light: {
      text: '#172119',
      background: '#F3F8F3',
      backgroundElement: '#FFFFFF',
      backgroundSelected: '#E4F0E6',
      textSecondary: '#5C6B5F',
      border: '#DBE7DD',
      tint: '#0E8F6E', // teal-green brand, kept distinct from the positive green
      onTint: '#FFFFFF',
      success: '#3DAE54',
      successBg: '#E5F5E9',
      danger: '#DE3730',
      accent: '#C7620E', // amber counterweight
    },
    dark: {
      text: '#E7F0E9',
      background: '#0F150F',
      backgroundElement: '#19221A',
      backgroundSelected: '#263127',
      textSecondary: '#97A79A',
      border: '#2A362B',
      tint: '#34C08E',
      onTint: '#04140D',
      success: '#30D158',
      successBg: '#12351C',
      danger: '#FF5C52',
      accent: '#F2A65A',
    },
  },
  violet: {
    name: 'Violet',
    light: {
      text: '#1E1826',
      background: '#F7F4FB',
      backgroundElement: '#FFFFFF',
      backgroundSelected: '#EDE6F6',
      textSecondary: '#665C73',
      border: '#E4DCEE',
      tint: '#7C3AED',
      onTint: '#FFFFFF',
      success: '#2E9E4F',
      successBg: '#E5F5E9',
      danger: '#DE3730',
      accent: '#0E9BD8',
    },
    dark: {
      text: '#F0EBF6',
      background: '#14101B',
      backgroundElement: '#1F1A29',
      backgroundSelected: '#2C2539',
      textSecondary: '#A79EB4',
      border: '#332B41',
      tint: '#A78BFA',
      onTint: '#150A24',
      success: '#30D158',
      successBg: '#12351C',
      danger: '#FF5C52',
      accent: '#3BBDF8',
    },
  },
  slate: {
    name: 'Slate',
    light: {
      text: '#1A1D21',
      background: '#F5F6F7',
      backgroundElement: '#FFFFFF',
      backgroundSelected: '#E8EAED',
      textSecondary: '#646B72',
      border: '#E1E4E7',
      tint: '#334155', // near-monochrome: slate is the brand
      onTint: '#FFFFFF',
      success: '#2E9E4F',
      successBg: '#E5F5E9',
      danger: '#DE3730',
      accent: '#0E9BD8',
    },
    dark: {
      text: '#ECEEF0',
      background: '#101215',
      backgroundElement: '#1A1E22',
      backgroundSelected: '#262B31',
      textSecondary: '#99A1A9',
      border: '#2B3138',
      tint: '#94A3B8',
      onTint: '#0B0E11',
      success: '#30D158',
      successBg: '#12351C',
      danger: '#FF5C52',
      accent: '#3BBDF8',
    },
  },
} as const;

export type ThemeName = keyof typeof Themes;

export const DEFAULT_THEME: ThemeName = 'ember';

export type ThemeMode = 'system' | 'light' | 'dark';

// Type scale: system font (Roboto/SF), consistent roles instead of ad-hoc sizes.
export const Type = {
  /** Big single stats: TDEE, tonnage, timers */
  stat: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  /** Card/exercise titles */
  title: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  body: { fontSize: 16 },
  caption: { fontSize: 13 },
  /** Uppercase section labels */
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase' },
} as const satisfies Record<string, TextStyle>;

export type ThemeColor = keyof (typeof Themes)['ember']['light'];

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
