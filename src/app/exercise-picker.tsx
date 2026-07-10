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
  Exercise, addExerciseToWorkout, addRoutineExercise, createCustomExercise, getRecentExercises,
  searchExercises,
} from '@/db/queries';

const MUSCLES = [
  'chest', 'lats', 'middle back', 'lower back', 'shoulders', 'traps',
  'biceps', 'triceps', 'forearms', 'quadriceps', 'hamstrings', 'glutes',
  'calves', 'abdominals', 'abductors', 'adductors', 'neck',
];
const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'kettlebells', 'body only', 'bands', 'other'];

export default function ExercisePicker() {
  const { workoutId, routineId } = useLocalSearchParams<{ workoutId: string; routineId: string }>();
  const db = useSQLiteContext();
  const colors = useTheme();
  const [query, setQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [equipmentFilter, setEquipmentFilter] = useState<string | null>(null);
  const [results, setResults] = useState<Exercise[]>([]);
  const [recent, setRecent] = useState<Exercise[]>([]);
  const [creating, setCreating] = useState(false);
  const [newMuscle, setNewMuscle] = useState(MUSCLES[0]);
  const [newEquipment, setNewEquipment] = useState(EQUIPMENT[0]);

  useEffect(() => {
    getRecentExercises(db).then(setRecent);
  }, [db]);

  useEffect(() => {
    searchExercises(db, query, muscleFilter ?? undefined, equipmentFilter ?? undefined).then(setResults);
  }, [db, query, muscleFilter, equipmentFilter]);

  const pick = async (exerciseId: string) => {
    if (routineId) await addRoutineExercise(db, routineId, exerciseId);
    else await addExerciseToWorkout(db, workoutId, exerciseId);
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

  // Recent-first list: only when the search is otherwise unconstrained (spec: filters skip Recent).
  const showRecent = !creating && !query.trim() && !muscleFilter && !equipmentFilter && recent.length > 0;
  const recentIds = new Set(recent.map((r) => r.id));
  const rest = results.filter((r) => !recentIds.has(r.id));
  type Row = Exercise & { section?: string };
  const listData: Row[] = showRecent
    ? [
        ...recent.map((r, i): Row => (i === 0 ? { ...r, section: 'RECENT' } : r)),
        ...rest.map((r, i): Row => (i === 0 ? { ...r, section: 'ALL' } : r)),
      ]
    : results;

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
          style={styles.chipRow}
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
      {!creating && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipRow}
          contentContainerStyle={{ paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.two }}>
          {EQUIPMENT.map((eq) => (
            <Chip
              key={eq}
              label={eq}
              selected={eq === equipmentFilter}
              onPress={() => setEquipmentFilter(equipmentFilter === eq ? null : eq)}
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
          data={listData}
          keyExtractor={(e) => e.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <>
              {item.section && (
                <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{item.section}</Text>
              )}
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
            </>
          )}
          ListFooterComponent={
            query.trim() ? (
              <Pressable
                onPress={() => setCreating(true)}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.backgroundElement }]}>
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
      style={({ pressed }) => ({
        paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16,
        backgroundColor: selected ? colors.tint : colors.backgroundElement,
        opacity: pressed ? 0.7 : 1,
      })}>
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
  // ScrollView defaults to flexShrink: 1; without shrink 0 the FlatList sibling squashes the chip rows
  chipRow: { flexGrow: 0, flexShrink: 0 },
  sectionHeader: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.5,
    paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: 4,
  },
});
