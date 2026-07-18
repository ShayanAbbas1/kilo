import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Button, Card } from '@/components/ui';
import { Spacing, Type } from '@/constants/theme';
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

  const totalSets = exercises.reduce((n, ex) => n + ex.sets.length, 0);
  const volumeKg = exercises.reduce(
    (sum, ex) => sum + ex.sets.reduce(
      (s, set) => s + (set.weight_kg != null && set.reps != null ? set.weight_kg * set.reps : 0), 0), 0);
  const summary = workout && [
    { label: 'Duration', value: workout.finished_at ? durationLabel(workout.started_at, workout.finished_at) : '—' },
    { label: 'Sets', value: String(totalSets) },
    { label: 'Volume', value: weightLabel(volumeKg, unit) },
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six }}>
      <Stack.Screen
        options={{
          title: workout?.name ?? 'Workout',
          headerRight: () => (
            <Pressable onPress={onDelete} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
              <Text style={{ color: colors.danger, fontSize: 17, fontWeight: '600' }}>Delete</Text>
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
      {summary ? (
        <Card style={{ flexDirection: 'row' }}>
          {summary.map((st, i) => (
            <View
              key={st.label}
              style={{
                flex: 1, alignItems: 'center', gap: Spacing.one,
                ...(i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border }),
              }}>
              <Text style={[styles.statNum, { color: colors.text }]}>{st.value}</Text>
              <Text style={[Type.label, { color: colors.textSecondary }]}>{st.label}</Text>
            </View>
          ))}
        </Card>
      ) : null}
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
              flex: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16,
              color: colors.text, backgroundColor: colors.background,
              borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
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
      {exercises.map((ex, i) => (
        <Card
          key={ex.id}
          style={{
            gap: 6,
            ...((ex.superset_with_next || exercises[i - 1]?.superset_with_next)
              && { borderLeftWidth: 3, borderLeftColor: colors.tint }),
          }}>
          <Pressable
            onPress={() => router.push(`/exercise/${ex.exercise_id}`)}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <Text style={{ color: colors.tint, fontSize: 17, fontWeight: '600' }}>
              {ex.name} <Text style={{ fontSize: 12 }}>📈</Text>
            </Text>
          </Pressable>
          <View style={{ gap: 2, marginTop: 2 }}>
            {ex.sets.map((s, idx) => (
              <View key={s.id} style={{ flexDirection: 'row', gap: Spacing.three, paddingVertical: 1 }}>
                <Text style={{ color: colors.textSecondary, width: 20, fontWeight: '600', fontSize: 13, fontVariant: ['tabular-nums'] }}>
                  {s.set_type === 'warmup' ? 'W' : s.set_type === 'failure' ? 'F' : idx + 1}
                </Text>
                <Text style={{ color: colors.text, fontVariant: ['tabular-nums'] }}>
                  {s.weight_kg != null ? weightLabel(s.weight_kg, unit) : '—'} × {s.reps ?? '—'}
                  {s.rpe != null ? ` @ ${s.rpe}` : ''}
                </Text>
              </View>
            ))}
          </View>
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

const styles = StyleSheet.create({
  statNum: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
});
