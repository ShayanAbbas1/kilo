import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  Workout, WorkoutExerciseDetail, deleteWorkout, getWorkout, getWorkoutExercises,
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
      {exercises.map((ex) => (
        <Card key={ex.id} style={{ gap: 6 }}>
          <Text style={{ color: colors.tint, fontSize: 16, fontWeight: '600' }}>{ex.name}</Text>
          {ex.sets.map((s, idx) => (
            <View key={s.id} style={{ flexDirection: 'row', gap: Spacing.three }}>
              <Text style={{ color: colors.textSecondary, width: 24, fontWeight: '600' }}>
                {s.set_type === 'warmup' ? 'W' : s.set_type === 'failure' ? 'F' : idx + 1}
              </Text>
              <Text style={{ color: colors.text }}>
                {s.weight_kg != null ? weightLabel(s.weight_kg, unit) : '—'} × {s.reps ?? '—'}
              </Text>
            </View>
          ))}
        </Card>
      ))}
    </ScrollView>
  );
}
