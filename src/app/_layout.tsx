import {
  SpaceGrotesk_300Light, SpaceGrotesk_400Regular, SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold, useFonts,
} from '@expo-google-fonts/space-grotesk';
import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';

import { DB_NAME, migrate } from '@/db';
import { useResolvedScheme, useTheme } from '@/hooks/use-theme';
import { SettingsProvider } from '@/lib/settings-context';
import '@/lib/rest-notification'; // registers notification handler + Android channel once

// nav chrome (headers, tab bar) on the active app palette instead of react-navigation stock
function Nav() {
  const scheme = useResolvedScheme();
  const c = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider
      value={{
        ...base,
        colors: {
          ...base.colors,
          primary: c.tint,
          background: c.background,
          card: c.background,
          text: c.text,
          border: c.border,
          notification: c.danger,
        },
      }}>
      <Stack screenOptions={{ headerTitleStyle: { fontFamily: 'SpaceGrotesk_700Bold' } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="workout/[id]" options={{ title: 'Workout' }} />
        <Stack.Screen name="history/[id]" options={{ title: 'Workout' }} />
        <Stack.Screen name="routine/[id]" options={{ title: 'Routine' }} />
        <Stack.Screen name="exercise/[id]" options={{ title: 'Exercise' }} />
        <Stack.Screen name="muscle/[slug]" options={{ title: 'Muscle' }} />
        <Stack.Screen
          name="exercise-picker"
          options={{ presentation: 'modal', title: 'Add Exercise' }}
        />
        <Stack.Screen name="settings" options={{ presentation: 'modal', title: 'Settings' }} />
        <Stack.Screen name="plates" options={{ presentation: 'modal', title: 'Plates' }} />
        <Stack.Screen name="report" options={{ presentation: 'modal', title: 'Weekly Report' }} />
        <Stack.Screen
          name="import-strong"
          options={{ presentation: 'modal', title: 'Import Workouts' }}
        />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_300Light, SpaceGrotesk_400Regular, SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold,
  });
  if (!fontsLoaded) return null; // brief blank on cold start beats a font swap flash
  return (
    <SQLiteProvider databaseName={DB_NAME} onInit={migrate}>
      <SettingsProvider>
        <Nav />
      </SettingsProvider>
    </SQLiteProvider>
  );
}
