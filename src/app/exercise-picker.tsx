import { useEffect, useState } from 'react';
import {
  FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Button } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  Exercise, addExerciseToWorkout, createCustomExercise, searchExercises,
} from '@/db/queries';

const MUSCLES = [
  'chest', 'lats', 'middle back', 'lower back', 'shoulders', 'traps',
  'biceps', 'triceps', 'forearms', 'quadriceps', 'hamstrings', 'glutes',
  'calves', 'abdominals', 'abductors', 'adductors', 'neck',
];
const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'kettlebells', 'body only', 'bands', 'other'];

export default function ExercisePicker() {
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const db = useSQLiteContext();
  const colors = useTheme();
  const [query, setQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [results, setResults] = useState<Exercise[]>([]);
  const [creating, setCreating] = useState(false);
  const [newMuscle, setNewMuscle] = useState(MUSCLES[0]);
  const [newEquipment, setNewEquipment] = useState(EQUIPMENT[0]);

  useEffect(() => {
    searchExercises(db, query, muscleFilter ?? undefined).then(setResults);
  }, [db, query, muscleFilter]);

  const pick = async (exerciseId: string) => {
    await addExerciseToWorkout(db, workoutId, exerciseId);
    router.back();
  };

  const createAndPick = async () => {
    const name = query.trim();
    if (!name) return;
    const id = await createCustomExercise(db, name, newMuscle, newEquipment);
    await pick(id);
  };

  const muscles = (e: Exercise): string => {
    try {
      return (JSON.parse(e.primary_muscles) as string[]).join(', ');
    } catch {
      return '';
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <TextInput
        style={[styles.search, {
          color: colors.text, backgroundColor: colors.backgroundElement,
        }]}
        placeholder="Search exercises…"
        placeholderTextColor={colors.textSecondary}
        value={query}
        onChangeText={(t) => { setQuery(t); setCreating(false); }}
        autoFocus
      />
      {!creating && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.two }}>
          {MUSCLES.map((m) => (
            <Chip
              key={m}
              label={m}
              selected={m === muscleFilter}
              onPress={() => setMuscleFilter(muscleFilter === m ? null : m)}
            />
          ))}
        </ScrollView>
      )}
      {creating ? (
        <View style={{ padding: Spacing.three, gap: Spacing.three }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>
            New exercise: “{query.trim()}”
          </Text>
          <Text style={{ color: colors.textSecondary }}>Primary muscle</Text>
          <View style={styles.chips}>
            {MUSCLES.map((m) => (
              <Chip key={m} label={m} selected={m === newMuscle} onPress={() => setNewMuscle(m)} />
            ))}
          </View>
          <Text style={{ color: colors.textSecondary }}>Equipment</Text>
          <View style={styles.chips}>
            {EQUIPMENT.map((eq) => (
              <Chip key={eq} label={eq} selected={eq === newEquipment} onPress={() => setNewEquipment(eq)} />
            ))}
          </View>
          <Button title="Create & Add" onPress={createAndPick} />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(e) => e.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => pick(item.id)}
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: colors.backgroundElement },
                pressed && { backgroundColor: colors.backgroundElement },
              ]}>
              <Text style={{ color: colors.text, fontSize: 16 }}>
                {item.name}{item.is_custom ? ' ★' : ''}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                {muscles(item)} · {item.equipment}
              </Text>
            </Pressable>
          )}
          ListFooterComponent={
            query.trim() ? (
              <Pressable onPress={() => setCreating(true)} style={styles.row}>
                <Text style={{ color: colors.tint, fontSize: 16, fontWeight: '600' }}>
                  + Create “{query.trim()}”
                </Text>
              </Pressable>
            ) : null
          }
        />
      )}
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16,
        backgroundColor: selected ? colors.tint : colors.backgroundElement,
      }}>
      <Text style={{ color: selected ? '#fff' : colors.text, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  search: {
    margin: Spacing.three, marginBottom: Spacing.two,
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, fontSize: 16,
  },
  row: {
    paddingVertical: 12, paddingHorizontal: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 2,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
