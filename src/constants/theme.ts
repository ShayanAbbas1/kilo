/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform, TextStyle } from 'react-native';

// Ember palette: warm stone neutrals + ember-orange brand tint. Dark mode stays
// pure-black (OLED, gym-friendly); cards/text are warm-shifted to match the tint.
export const Colors = {
  light: {
    text: '#1C1917',
    background: '#FFFFFF',
    backgroundElement: '#F5F1EC',
    backgroundSelected: '#E9E2D9',
    textSecondary: '#6E6862',
    tint: '#EA580C',
    onTint: '#FFFFFF', // text on a tint-colored surface
    success: '#2E9E4F',
    successBg: '#E5F5E9',
    danger: '#DE3730',
    accent: '#0E9BD8', // cool counterweight to the orange tint (kcal line on the Trendline)
  },
  dark: {
    text: '#F5F1EC',
    background: '#000000',
    backgroundElement: '#1E1A17',
    backgroundSelected: '#2E2721',
    textSecondary: '#A8A29E',
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
