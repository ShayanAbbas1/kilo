import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Button, Card, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  PeriodSummary, RoutineRow, Workout,
  createRoutine, deleteRoutine, getActiveWorkout, getPeriodSummary, listRoutines,
  startWorkout, startWorkoutFromRoutine,
} from '@/db/queries';
import { formatDateTime } from '@/lib/dates';
import { useSettings } from '@/lib/settings-context';
import { weightLabel } from '@/lib/units';

/** Monday 00:00 of the current week, local time. */
function startOfWeekIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString();
}

export default function WorkoutTab() {
  const db = useSQLiteContext();
  const colors = useTheme();
  const { unit } = useSettings();
  const [active, setActive] = useState<Workout | null>(null);
  const [routines, setRoutines] = useState<RoutineRow[]>([]);
  const [week, setWeek] = useState<PeriodSummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      getActiveWorkout(db).then(setActive);
      listRoutines(db).then(setRoutines);
      getPeriodSummary(db, startOfWeekIso()).then(setWeek);
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

  const onRoutineLongPress = (r: RoutineRow) => {
    Alert.alert(r.name, undefined, [
      { text: 'Edit', onPress: () => router.push(`/routine/${r.id}`) },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => deleteRoutine(db, r.id).then(() => listRoutines(db).then(setRoutines)),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const onNewRoutine = async () => {
    const id = await createRoutine(db, 'New Routine');
    router.push(`/routine/${id}`);
  };

  return (
    <FlatList
      data={routines}
      keyExtractor={(r) => r.id}
      contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two }}
      ListHeaderComponent={
        <View style={{ marginBottom: Spacing.two }}>
          {week && week.workouts > 0 && (
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: Spacing.two }}>
              This week: {week.workouts} workout{week.workouts === 1 ? '' : 's'} ·{' '}
              {weightLabel(week.tonnage_kg, unit)} lifted
            </Text>
          )}
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
          <SectionTitle>Routines</SectionTitle>
          <Button title="+ New Routine" kind="secondary" onPress={onNewRoutine} />
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
          onLongPress={() => onRoutineLongPress(item)}
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
