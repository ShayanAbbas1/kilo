import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { useColorScheme } from 'react-native';

import { DB_NAME, migrate } from '@/db';
import { SettingsProvider } from '@/lib/settings-context';

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
            <Stack.Screen
              name="exercise-picker"
              options={{ presentation: 'modal', title: 'Add Exercise' }}
            />
            <Stack.Screen name="settings" options={{ presentation: 'modal', title: 'Settings' }} />
          </Stack>
        </SettingsProvider>
      </SQLiteProvider>
    </ThemeProvider>
  );
}
