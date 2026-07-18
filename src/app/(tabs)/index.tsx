import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Text } from '@/components/text';
import { Button, Card, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  HistoryRow, PeriodSummary, RoutineRow, Workout,
  createRoutine, deleteRoutine, getActiveWorkout, getHistory, getPeriodSummary, listRoutines,
  resolveExerciseIdsByName, startWorkout, startWorkoutFromExercises, startWorkoutFromPast,
  startWorkoutFromRoutine,
} from '@/db/queries';
import { formatDateTime, startOfWeekIso } from '@/lib/dates';
import { useSettings } from '@/lib/settings-context';
import { weightLabel } from '@/lib/units';

// Pre-built cold-start templates. Names are verbatim from the free-exercise-db seed
// (src/data/exercises.json) — resolved to ids at tap time, unresolved ones skipped.
const TEMPLATES: { name: string; exercises: string[] }[] = [
  {
    name: 'Upper Body',
    exercises: ['Barbell Bench Press - Medium Grip', 'Bent Over Barbell Row',
      'Barbell Shoulder Press', 'Wide-Grip Lat Pulldown', 'Barbell Curl', 'Triceps Pushdown'],
  },
  {
    name: 'Lower Body',
    exercises: ['Barbell Squat', 'Romanian Deadlift', 'Leg Press',
      'Lying Leg Curls', 'Standing Calf Raises'],
  },
  {
    name: 'Full Body',
    exercises: ['Barbell Squat', 'Barbell Bench Press - Medium Grip', 'Barbell Deadlift',
      'Pullups', 'Barbell Shoulder Press'],
  },
];

export default function WorkoutTab() {
  const db = useSQLiteContext();
  const colors = useTheme();
  const { unit } = useSettings();
  const [active, setActive] = useState<Workout | null>(null);
  const [routines, setRoutines] = useState<RoutineRow[]>([]);
  const [recent, setRecent] = useState<HistoryRow[]>([]);
  const [week, setWeek] = useState<PeriodSummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      getActiveWorkout(db).then(setActive);
      listRoutines(db).then(setRoutines);
      getHistory(db, 3).then(setRecent);
      getPeriodSummary(db, startOfWeekIso()).then(setWeek);
    }, [db]),
  );

  const guardActive = () => {
    if (active) {
      Alert.alert('Workout in progress', 'Finish or discard it before starting another.');
      return true;
    }
    return false;
  };

  const start = async () => {
    const id = await startWorkout(db);
    router.push(`/workout/${id}`);
  };

  const startFromRoutine = async (r: RoutineRow) => {
    if (guardActive()) return;
    const id = await startWorkoutFromRoutine(db, r.id);
    router.push(`/workout/${id}`);
  };

  const startFromPast = async (h: HistoryRow) => {
    if (guardActive()) return;
    const id = await startWorkoutFromPast(db, h.id);
    router.push(`/workout/${id}`);
  };

  const startFromTemplate = async (t: (typeof TEMPLATES)[number]) => {
    if (guardActive()) return;
    const ids = await resolveExerciseIdsByName(db, t.exercises);
    if (!ids.length) {
      Alert.alert("Can't start", 'None of those exercises are in your library.');
      return;
    }
    const id = await startWorkoutFromExercises(db, ids, 3);
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
      contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six }}
      ListHeaderComponent={
        <View style={{ marginBottom: Spacing.two }}>
          {week && week.workouts > 0 && (
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: Spacing.two, fontVariant: ['tabular-nums'] }}>
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
        recent.length > 0 ? (
          <View style={{ gap: Spacing.two }}>
            <SectionTitle>Start from a recent workout</SectionTitle>
            {recent.map((h) => (
              <Pressable
                key={h.id}
                onPress={() => startFromPast(h)}
                style={({ pressed }) => [
                  styles.routineCard,
                  { backgroundColor: pressed ? colors.backgroundSelected : colors.backgroundElement },
                ]}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
                  {h.name ?? formatDateTime(h.started_at)}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'] }}>
                  {h.exercise_count} exercise{h.exercise_count === 1 ? '' : 's'} · {h.set_count} set{h.set_count === 1 ? '' : 's'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={{ gap: Spacing.two }}>
            <SectionTitle>Start with a template</SectionTitle>
            {TEMPLATES.map((t) => (
              <Pressable
                key={t.name}
                onPress={() => startFromTemplate(t)}
                style={({ pressed }) => [
                  styles.routineCard,
                  { backgroundColor: pressed ? colors.backgroundSelected : colors.backgroundElement },
                ]}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{t.name}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={2}>
                  {t.exercises.join(', ')}
                </Text>
              </Pressable>
            ))}
          </View>
        )
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
