import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Button, Card, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getActiveWorkout, startWorkout, Workout } from '@/db/queries';
import { formatDateTime } from '@/lib/dates';

export default function WorkoutTab() {
  const db = useSQLiteContext();
  const colors = useTheme();
  const [active, setActive] = useState<Workout | null>(null);

  useFocusEffect(
    useCallback(() => {
      getActiveWorkout(db).then(setActive);
    }, [db]),
  );

  const start = async () => {
    const id = await startWorkout(db);
    router.push(`/workout/${id}`);
  };

  return (
    <View style={styles.container}>
      {active ? (
        <Card style={{ gap: Spacing.two }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>
            Workout in progress
          </Text>
          <Text style={{ color: colors.textSecondary }}>
            Started {formatDateTime(active.started_at)}
          </Text>
          <Button title="Resume Workout" onPress={() => router.push(`/workout/${active.id}`)} />
        </Card>
      ) : (
        <>
          <SectionTitle>Quick start</SectionTitle>
          <Button title="Start Empty Workout" onPress={start} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.three },
});
