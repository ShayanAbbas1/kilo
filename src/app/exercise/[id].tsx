import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { LineChart, Point } from '@/components/charts';
import { BodyHeatmap } from '@/components/body-heatmap';
import { Button, Card, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  Exercise, ProgressionRow, getExercise, getExerciseProgression, getSetting, setSetting,
} from '@/db/queries';
import { MUSCLE_TO_SLUG } from '@/lib/body-map';
import { muscleEmphasis } from '@/lib/muscle-heads';
import { projectToTarget } from '@/lib/projection';
import { useSettings } from '@/lib/settings-context';
import { formatDay } from '@/lib/dates';
import { formatWeight, fromDisplayWeight } from '@/lib/units';

const goalKey = (exerciseId: string) => `goal_e1rm_${exerciseId}`;

function parseMuscles(json: string): string[] {
  try { return JSON.parse(json) as string[]; } catch { return []; }
}

type Metric = 'est1rm' | 'top_weight' | 'volume';
const METRIC_LABEL: Record<Metric, string> = {
  est1rm: 'Est. 1RM',
  top_weight: 'Top weight',
  volume: 'Volume',
};

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const colors = useTheme();
  const { unit } = useSettings();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [rows, setRows] = useState<ProgressionRow[]>([]);
  const [metric, setMetric] = useState<Metric>('est1rm');
  const [goalKg, setGoalKg] = useState<number | null>(null);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');

  useFocusEffect(
    useCallback(() => {
      getExercise(db, id).then(setExercise);
      getExerciseProgression(db, id).then(setRows);
      getSetting(db, goalKey(id)).then((v) => setGoalKg(v ? Number(v) : null));
    }, [db, id]),
  );

  const points: Point[] = rows.map((r) => ({ label: r.day.slice(5), value: r[metric] }));
  const fmt = (v: number) => `${formatWeight(v, unit)}`;

  const bestWeight = rows.length ? Math.max(...rows.map((r) => r.top_weight)) : null;
  const best1rm = rows.length ? Math.max(...rows.map((r) => r.est1rm)) : null;
  const bestVolume = rows.length ? Math.max(...rows.map((r) => r.volume)) : null;

  // e1RM goal: regression over the last ~10 sessions' est. 1RM (rows is day-ascending already).
  const e1rmProjection = goalKg != null
    ? projectToTarget(rows.slice(-10).map((r) => ({ date: r.day, value: r.est1rm })), goalKg)
    : null;
  const goalPct = goalKg != null && best1rm != null ? Math.round((best1rm / goalKg) * 100) : null;

  const startEditGoal = () => {
    setGoalInput(goalKg != null ? formatWeight(goalKg, unit) : '');
    setEditingGoal(true);
  };
  const saveGoal = () => {
    const n = parseFloat(goalInput.replace(',', '.'));
    if (isNaN(n) || n <= 0) return;
    const kg = fromDisplayWeight(n, unit);
    setSetting(db, goalKey(id), String(kg));
    setGoalKg(kg);
    setEditingGoal(false);
  };
  const clearGoal = () => {
    Alert.alert('Clear goal?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: () => {
          setSetting(db, goalKey(id), '');
          setGoalKg(null);
          setEditingGoal(false);
        },
      },
    ]);
  };

  const primary = exercise ? parseMuscles(exercise.primary_muscles) : [];
  const secondary = exercise ? parseMuscles(exercise.secondary_muscles) : [];
  const emphasis = exercise ? muscleEmphasis(exercise.name, primary) : [];
  const bodyData = [
    ...primary.map((m) => MUSCLE_TO_SLUG[m]).filter(Boolean)
      .map((slug) => ({ slug, intensity: 2 })),
    ...secondary.map((m) => MUSCLE_TO_SLUG[m]).filter(Boolean)
      .map((slug) => ({ slug, intensity: 1 })),
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.three, paddingBottom: Spacing.six }}>
      <Stack.Screen options={{ title: exercise?.name ?? 'Exercise' }} />

      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
        <Stat label={`Best ${unit}`} value={bestWeight != null ? fmt(bestWeight) : '—'} />
        <Stat label="Est. 1RM" value={best1rm != null ? fmt(best1rm) : '—'} />
        <Stat label="Best session" value={bestVolume != null ? fmt(bestVolume) : '—'} />
      </View>

      <View style={{ marginTop: Spacing.two }}>
        {editingGoal ? (
          <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'center' }}>
            <TextInput
              style={{
                flex: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16,
                color: colors.text, backgroundColor: colors.backgroundElement,
              }}
              value={goalInput}
              onChangeText={setGoalInput}
              keyboardType="decimal-pad"
              placeholder={`Est. 1RM goal (${unit})`}
              placeholderTextColor={colors.textSecondary}
              autoFocus
            />
            <Button title="Save" onPress={saveGoal} />
            {goalKg != null && <Button title="Clear" kind="danger" onPress={clearGoal} />}
          </View>
        ) : (
          <Pressable onPress={startEditGoal}>
            <Text style={{ color: colors.tint, fontWeight: '600', fontSize: 13 }}>
              {goalKg != null ? `🎯 Goal: ${fmt(goalKg)} ${unit} · edit` : '🎯 Set an est. 1RM goal'}
            </Text>
          </Pressable>
        )}
        {goalKg != null && !editingGoal && (
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
            {e1rmProjection?.projectedDate
              ? `On pace by ${formatDay(e1rmProjection.projectedDate)}`
              : goalPct != null
                ? goalPct >= 100 ? 'Goal reached 🎉' : `${goalPct}% of the way there`
                : null}
          </Text>
        )}
      </View>

      <SectionTitle>Targets</SectionTitle>
      <Card style={{ gap: Spacing.two }}>
        <BodyHeatmap data={bodyData} colors={[colors.tint + '66', colors.tint]} scale={0.65} />
        <Text style={{ color: colors.text, fontSize: 14 }}>
          <Text style={{ fontWeight: '600' }}>Primary: </Text>{primary.join(', ') || '—'}
          {secondary.length > 0 && (
            <Text style={{ color: colors.textSecondary }}>   ·   Secondary: {secondary.join(', ')}</Text>
          )}
        </Text>
        {emphasis.map((e) => (
          <Text key={e} style={{ color: colors.tint, fontSize: 13, fontWeight: '600' }}>
            ◎ {e}
          </Text>
        ))}
      </Card>

      <SectionTitle>Progression</SectionTitle>
      <Card style={{ gap: Spacing.three }}>
        <View style={{ flexDirection: 'row', gap: Spacing.two }}>
          {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMetric(m)}
              style={({ pressed }) => ({
                flex: 1, paddingVertical: 6, borderRadius: 8, alignItems: 'center',
                backgroundColor: metric === m ? colors.tint : colors.backgroundSelected,
                opacity: pressed ? 0.7 : 1,
              })}>
              <Text style={{ color: metric === m ? '#fff' : colors.text, fontWeight: '600', fontSize: 12 }}>
                {METRIC_LABEL[m]}
              </Text>
            </Pressable>
          ))}
        </View>
        <LineChart data={points} formatValue={fmt} />
      </Card>

      <SectionTitle>Sessions</SectionTitle>
      <Card style={{ gap: 6 }}>
        {rows.length === 0 && (
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            No finished sessions with this exercise yet.
          </Text>
        )}
        {[...rows].reverse().map((r) => (
          <View key={r.day} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.text, width: 110 }}>{formatDay(r.day)}</Text>
            <Text style={{ color: colors.text, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
              {fmt(r.top_weight)} {unit}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'] }}>
              vol {fmt(r.volume)}
            </Text>
          </View>
        ))}
      </Card>

      {exercise?.instructions ? (
        <>
          <SectionTitle>How to</SectionTitle>
          <Card>
            <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21 }}>
              {exercise.instructions}
            </Text>
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const colors = useTheme();
  return (
    <Card style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{label}</Text>
    </Card>
  );
}
