/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform, TextStyle } from 'react-native';

// Ember palette: warm-tinted surfaces + ember-orange brand tint. Backgrounds are
// deliberately NOT pure black/white — dark is layered espresso (page → card →
// selected, each a step lighter), light is warm paper with white cards.
export const Colors = {
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
} as const;

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

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

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
