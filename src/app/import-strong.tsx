import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
// ponytail: legacy FS API — same string-read API the JSON restore uses
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Button, Card, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  createCustomExercise, getExistingWorkoutIds, importStrongWorkouts, listExerciseRefs,
} from '@/db/queries';
import {
  StrongWorkout, buildImportPlan, buildMatcher, inferEquipment, parseStrongCsv,
} from '@/lib/strong-import';
import { Chip, MUSCLES } from './exercise-picker';

type Parsed = {
  workouts: StrongWorkout[];
  newCount: number;
  skipCount: number;
  matched: { name: string; exerciseId: string; matchedName: string }[];
  unmatched: string[];
};

export default function ImportStrongScreen() {
  const db = useSQLiteContext();
  const colors = useTheme();
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  // Strong exercise name → chosen muscle group, for exercises we'll create
  const [muscleFor, setMuscleFor] = useState<Record<string, string>>({});

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    setBusy(true);
    try {
      const text = await FileSystem.readAsStringAsync(res.assets[0].uri);
      const workouts = parseStrongCsv(text);
      const refs = await listExerciseRefs(db);
      const refName = new Map(refs.map((r) => [r.id, r.name]));
      const match = buildMatcher(refs);
      const names = [...new Set(workouts.flatMap((w) => w.exercises.map((e) => e.name)))].sort();
      const matched: Parsed['matched'] = [];
      const unmatched: string[] = [];
      for (const n of names) {
        const id = match(n);
        if (id) matched.push({ name: n, exerciseId: id, matchedName: refName.get(id) ?? id });
        else unmatched.push(n);
      }
      const existing = await getExistingWorkoutIds(db, workouts.map((w) => w.id));
      setMuscleFor({});
      setParsed({
        workouts,
        newCount: workouts.filter((w) => !existing.has(w.id)).length,
        skipCount: existing.size,
        matched,
        unmatched,
      });
    } catch (e) {
      Alert.alert('Could not read file', String(e));
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    if (!parsed || busy) return;
    setBusy(true);
    try {
      const resolution = new Map(parsed.matched.map((m) => [m.name, m.exerciseId]));
      // customs created by an earlier failed attempt are reused by name, not re-created
      const refs = await listExerciseRefs(db);
      const byName = new Map(refs.map((r) => [r.name.trim().toLowerCase(), r.id]));
      for (const name of parsed.unmatched) {
        const id = byName.get(name.trim().toLowerCase())
          ?? await createCustomExercise(db, name, muscleFor[name], inferEquipment(name));
        resolution.set(name, id);
      }
      const plan = buildImportPlan(parsed.workouts, (name) => resolution.get(name)!);
      const { imported, skipped } = await importStrongWorkouts(db, plan);
      Alert.alert(
        'Import complete',
        `${imported} workout${imported === 1 ? '' : 's'} imported` +
          (skipped ? `, ${skipped} already in Kilo (skipped)` : '') + '.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (e) {
      Alert.alert('Import failed', String(e));
    } finally {
      setBusy(false);
    }
  };

  const ready = parsed !== null
    && parsed.newCount > 0
    && parsed.unmatched.every((n) => muscleFor[n]);

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.three, paddingBottom: Spacing.six }}>
      <Card style={{ gap: Spacing.two }}>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
          In Strong: Profile → gear icon → Export Strong Data. Pick the .csv file here.
          Your existing Kilo data is never changed — Strong workouts are added alongside it,
          and re-importing the same file skips what is already in.
        </Text>
        <Button
          title={parsed ? 'Pick a different file' : 'Pick Strong CSV'}
          kind={parsed ? 'secondary' : 'primary'}
          onPress={pickFile}
          disabled={busy}
        />
      </Card>

      {parsed && (
        <>
          <SectionTitle>Found</SectionTitle>
          <Card>
            <Text style={{ color: colors.text, fontSize: 15 }}>
              {parsed.workouts.length} workouts — {parsed.newCount} new
              {parsed.skipCount ? `, ${parsed.skipCount} already in Kilo` : ''}
            </Text>
          </Card>

          {parsed.unmatched.length > 0 && (
            <>
              <SectionTitle>New exercises — pick a muscle group</SectionTitle>
              {parsed.unmatched.map((name) => (
                <Card key={name} style={{ gap: Spacing.two }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{name}</Text>
                  <View style={styles.chips}>
                    {MUSCLES.map((m) => (
                      <Chip
                        key={m}
                        label={m}
                        selected={muscleFor[name] === m}
                        onPress={() => setMuscleFor((prev) => ({ ...prev, [name]: m }))}
                      />
                    ))}
                  </View>
                </Card>
              ))}
            </>
          )}

          {parsed.matched.length > 0 && (
            <>
              <SectionTitle>Matched to the exercise library</SectionTitle>
              <Card style={{ gap: 6 }}>
                {parsed.matched.map((m) => (
                  <Text key={m.name} style={{ color: colors.textSecondary, fontSize: 13 }}>
                    {m.name} → <Text style={{ color: colors.text }}>{m.matchedName}</Text>
                  </Text>
                ))}
              </Card>
            </>
          )}

          <View style={{ marginTop: Spacing.three }}>
            <Button
              title={
                parsed.newCount === 0
                  ? 'Nothing new to import'
                  : ready
                    ? `Import ${parsed.newCount} workout${parsed.newCount === 1 ? '' : 's'}`
                    : `Pick a muscle group for ${parsed.unmatched.filter((n) => !muscleFor[n]).length} exercise(s)`
              }
              onPress={doImport}
              disabled={!ready || busy}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
