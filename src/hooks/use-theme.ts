/**
 * Resolves the active palette from the user's chosen theme + mode.
 * Mode 'system' follows the OS; 'light'/'dark' force it.
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Themes } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSettings } from '@/lib/settings-context';

export function useResolvedScheme(): 'light' | 'dark' {
  const os = useColorScheme();
  const { themeMode } = useSettings();
  if (themeMode === 'system') return os === 'dark' ? 'dark' : 'light';
  return themeMode;
}

export function useTheme() {
  const { themeName } = useSettings();
  const scheme = useResolvedScheme();
  return Themes[themeName][scheme];
}
