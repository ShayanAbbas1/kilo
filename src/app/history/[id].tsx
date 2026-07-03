import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Button, Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  Workout, WorkoutExerciseDetail, createRoutineFromWorkout, deleteWorkout,
  getActiveWorkout, getWorkout, getWorkoutExercises, reopenWorkout,
} from '@/db/queries';
import { durationLabel, formatDateTime } from '@/lib/dates';
import { useSettings } from '@/lib/settings-context';
import { weightLabel } from '@/lib/units';

export default function WorkoutDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const colors = useTheme();
  const { unit } = useSettings();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<WorkoutExerciseDetail[]>([]);
  const [routineName, setRoutineName] = useState<string | null>(null); // non-null = naming UI open

  useFocusEffect(
    useCallback(() => {
      getWorkout(db, id).then(setWorkout);
      getWorkoutExercises(db, id).then(setExercises);
    }, [db, id]),
  );

  const onDelete = () => {
    Alert.alert('Delete workout?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteWorkout(db, id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.three, gap: Spacing.three }}>
      <Stack.Screen
        options={{
          title: workout?.name ?? 'Workout',
          headerRight: () => (
            <Pressable onPress={onDelete} hitSlop={8}>
              <Text style={{ color: colors.danger, fontSize: 17 }}>Delete</Text>
            </Pressable>
          ),
        }}
      />
      {workout && (
        <Text style={{ color: colors.textSecondary }}>
          {formatDateTime(workout.started_at)}
          {workout.finished_at ? ` · ${durationLabel(workout.started_at, workout.finished_at)}` : ''}
        </Text>
      )}
      {workout?.notes ? (
        <Card>
          <Text style={{ color: colors.text, fontSize: 14, fontStyle: 'italic' }}>
            {workout.notes}
          </Text>
        </Card>
      ) : null}
      {routineName == null ? (
        <View style={{ flexDirection: 'row', gap: Spacing.two }}>
          <Button
            title="Save as Routine"
            kind="secondary"
            style={{ flex: 1 }}
            onPress={() => setRoutineName(workout?.name ?? exercises[0]?.name ?? 'Routine')}
          />
          <Button
            title="Edit"
            kind="secondary"
            style={{ flex: 1 }}
            onPress={async () => {
              const active = await getActiveWorkout(db);
              if (active) {
                Alert.alert('Workout in progress', 'Finish or discard it before editing this one.');
                return;
              }
              await reopenWorkout(db, id);
              router.replace(`/workout/${id}`);
            }}
          />
        </View>
      ) : (
        <Card style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'center' }}>
          <TextInput
            style={{
              flex: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16,
              color: colors.text, backgroundColor: colors.background,
            }}
            value={routineName}
            onChangeText={setRoutineName}
            placeholder="Routine name"
            placeholderTextColor={colors.textSecondary}
            autoFocus
          />
          <Button
            title="Save"
            onPress={async () => {
              if (!routineName.trim()) return;
              await createRoutineFromWorkout(db, id, routineName);
              setRoutineName(null);
              Alert.alert('Routine saved', 'Start it from the Workout tab.');
            }}
          />
        </Card>
      )}
      {exercises.map((ex) => (
        <Card key={ex.id} style={{ gap: 6 }}>
          <Pressable onPress={() => router.push(`/exercise/${ex.exercise_id}`)}>
            <Text style={{ color: colors.tint, fontSize: 16, fontWeight: '600' }}>
              {ex.name} <Text style={{ fontSize: 12 }}>📈</Text>
            </Text>
          </Pressable>
          {ex.sets.map((s, idx) => (
            <View key={s.id} style={{ flexDirection: 'row', gap: Spacing.three }}>
              <Text style={{ color: colors.textSecondary, width: 24, fontWeight: '600' }}>
                {s.set_type === 'warmup' ? 'W' : s.set_type === 'failure' ? 'F' : idx + 1}
              </Text>
              <Text style={{ color: colors.text }}>
                {s.weight_kg != null ? weightLabel(s.weight_kg, unit) : '—'} × {s.reps ?? '—'}
                {s.rpe != null ? ` @ ${s.rpe}` : ''}
              </Text>
            </View>
          ))}
          {ex.notes ? (
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontStyle: 'italic' }}>
              {ex.notes}
            </Text>
          ) : null}
        </Card>
      ))}
    </ScrollView>
  );
}
