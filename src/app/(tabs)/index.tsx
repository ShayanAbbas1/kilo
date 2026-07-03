import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Button, Card, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  RoutineRow, Workout,
  deleteRoutine, getActiveWorkout, listRoutines, startWorkout, startWorkoutFromRoutine,
} from '@/db/queries';
import { formatDateTime } from '@/lib/dates';

export default function WorkoutTab() {
  const db = useSQLiteContext();
  const colors = useTheme();
  const [active, setActive] = useState<Workout | null>(null);
  const [routines, setRoutines] = useState<RoutineRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      getActiveWorkout(db).then(setActive);
      listRoutines(db).then(setRoutines);
    }, [db]),
  );

  const start = async () => {
    const id = await startWorkout(db);
    router.push(`/workout/${id}`);
  };

  const startFromRoutine = async (r: RoutineRow) => {
    if (active) {
      Alert.alert('Workout in progress', 'Finish or discard it before starting another.');
      return;
    }
    const id = await startWorkoutFromRoutine(db, r.id);
    router.push(`/workout/${id}`);
  };

  const onDeleteRoutine = (r: RoutineRow) => {
    Alert.alert(`Delete routine “${r.name}”?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => deleteRoutine(db, r.id).then(() => listRoutines(db).then(setRoutines)),
      },
    ]);
  };

  return (
    <FlatList
      data={routines}
      keyExtractor={(r) => r.id}
      contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two }}
      ListHeaderComponent={
        <View style={{ marginBottom: Spacing.two }}>
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
          {routines.length > 0 && <SectionTitle>Routines</SectionTitle>}
        </View>
      }
      ListEmptyComponent={
        <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center' }}>
          Save a finished workout as a routine to start it with one tap.
        </Text>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => startFromRoutine(item)}
          onLongPress={() => onDeleteRoutine(item)}
          style={({ pressed }) => [
            styles.routineCard,
            { backgroundColor: pressed ? colors.backgroundSelected : colors.backgroundElement },
          ]}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{item.name}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={2}>
            {item.exercise_names ?? 'Empty routine'}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  routineCard: { borderRadius: 12, padding: Spacing.three, gap: 4 },
});
