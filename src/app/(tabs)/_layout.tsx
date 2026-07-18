import { Link, Tabs } from 'expo-router';
import { Text } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

// ponytail: emoji tab icons — no icon package in the SDK 57 template; swap for real icons if it grates
function icon(emoji: string) {
  function TabIcon({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>;
  }
  return TabIcon;
}

export default function TabLayout() {
  const colors = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        headerTitleStyle: { fontWeight: '700' },
        tabBarLabelStyle: { fontWeight: '600' },
        headerRight: () => (
          <Link href="/settings" style={{ fontSize: 20, paddingHorizontal: 16 }}>
            ⚙️
          </Link>
        ),
      }}>
      <Tabs.Screen name="index" options={{ title: 'Workout', tabBarIcon: icon('🏋️') }} />
      <Tabs.Screen name="stats" options={{ title: 'Stats', tabBarIcon: icon('📈') }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: icon('📅') }} />
      <Tabs.Screen name="body" options={{ title: 'Body', tabBarIcon: icon('⚖️') }} />
    </Tabs>
  );
}
