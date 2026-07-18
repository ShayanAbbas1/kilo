import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Text } from '@/components/text';
import { Button, Card, EmptyState } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  RoutineExerciseRow,
  getRoutine, listRoutineExercises, removeRoutineExercise, renameRoutine,
  setRoutineTargetSets, swapRoutineExercises,
} from '@/db/queries';

export default function RoutineEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const colors = useTheme();
  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<RoutineExerciseRow[]>([]);

  const reload = useCallback(() => {
    getRoutine(db, id).then((r) => setName(r?.name ?? ''));
    listRoutineExercises(db, id).then(setExercises);
  }, [db, id]);

  useFocusEffect(reload);

  const onNameChange = (t: string) => {
    setName(t);
    renameRoutine(db, id, t);
  };

  const onRemove = (ex: RoutineExerciseRow) => {
    Alert.alert(`Remove ${ex.name}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: () => removeRoutineExercise(db, ex.id).then(reload),
      },
    ]);
  };

  const onSets = (ex: RoutineExerciseRow, delta: number) => {
    const n = Math.max(1, ex.target_sets + delta);
    setExercises((prev) => prev.map((e) => (e.id === ex.id ? { ...e, target_sets: n } : e)));
    setRoutineTargetSets(db, ex.id, n);
  };

  const onSwap = (a: RoutineExerciseRow, b: RoutineExerciseRow) => {
    swapRoutineExercises(db, a.id, b.id).then(reload);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six }}>
      <Stack.Screen options={{ title: name || 'Routine' }} />
      <TextInput
        style={[styles.nameInput, { color: colors.text, backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
        value={name}
        onChangeText={onNameChange}
        placeholder="Routine name"
        placeholderTextColor={colors.textSecondary}
      />
      {exercises.length === 0 && (
        <EmptyState icon="➕" title="No exercises yet" hint="Add one below to build this routine." />
      )}
      {exercises.map((ex, i) => {
        const isLast = i === exercises.length - 1;
        // a flag on the last row is harmless in the DB but has nothing to link to — skip it in display
        const linksNext = !isLast && !!ex.superset_with_next;
        const linkedFromPrev = i > 0 && !!exercises[i - 1].superset_with_next;
        const inChain = linksNext || linkedFromPrev;
        return (
          <Card
            key={ex.id}
            style={{
              gap: Spacing.two,
              ...(inChain && { borderLeftWidth: 3, borderLeftColor: colors.tint }),
            }}>
            <Pressable
              onPress={() => router.push(`/exercise/${ex.exercise_id}`)}
              onLongPress={() => onRemove(ex)}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
              <Text style={{ color: colors.tint, fontSize: 17, fontWeight: '600' }}>{ex.name}</Text>
            </Pressable>
            <View style={styles.row}>
              <Text style={{ color: colors.textSecondary }}>Target sets</Text>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => onSets(ex, -1)}
                  hitSlop={8}
                  style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                  <Text style={{ color: colors.tint, fontSize: 20, fontWeight: '700' }}>−</Text>
                </Pressable>
                <Text style={[styles.setsCount, { color: colors.text }]}>{ex.target_sets}</Text>
                <Pressable
                  onPress={() => onSets(ex, 1)}
                  hitSlop={8}
                  style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                  <Text style={{ color: colors.tint, fontSize: 20, fontWeight: '700' }}>+</Text>
                </Pressable>
              </View>
              <View style={styles.stepper}>
                {i > 0 && (
                  <Pressable
                    onPress={() => onSwap(ex, exercises[i - 1])}
                    hitSlop={8}
                    style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                    <Text style={{ fontSize: 18, color: colors.textSecondary }}>▲</Text>
                  </Pressable>
                )}
                {!isLast && (
                  <Pressable
                    onPress={() => onSwap(ex, exercises[i + 1])}
                    hitSlop={8}
                    style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                    <Text style={{ fontSize: 18, color: colors.textSecondary }}>▼</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </Card>
        );
      })}
      <Button
        title="+ Add Exercise"
        onPress={() => router.push({ pathname: '/exercise-picker', params: { routineId: id } })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  nameInput: {
    borderRadius: 10, padding: Spacing.three, fontSize: 17,
    borderWidth: StyleSheet.hairlineWidth, fontFamily: 'SpaceGrotesk_600SemiBold',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  setsCount: { minWidth: 24, textAlign: 'center', fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
