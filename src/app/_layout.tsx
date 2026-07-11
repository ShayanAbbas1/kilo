import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { useColorScheme } from 'react-native';

import { DB_NAME, migrate } from '@/db';
import { SettingsProvider } from '@/lib/settings-context';
import '@/lib/rest-notification'; // registers notification handler + Android channel once

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SQLiteProvider databaseName={DB_NAME} onInit={migrate}>
        <SettingsProvider>
          <Stack>
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
          </Stack>
        </SettingsProvider>
      </SQLiteProvider>
    </ThemeProvider>
  );
}
