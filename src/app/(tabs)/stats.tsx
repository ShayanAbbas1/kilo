import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { BarList, ColumnChart, LineChart, Point } from '@/components/charts';
import { Card, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  CalorieDay, MuscleSetsRow, TopExerciseRow, WeightRow,
  getCalorieDays, getMuscleSets, getTopExercises, getWeightTrend,
} from '@/db/queries';
import { useSettings } from '@/lib/settings-context';
import { formatWeight } from '@/lib/units';

type Range = 'week' | 'month' | 'year';
const RANGE_DAYS: Record<Range, number> = { week: 7, month: 30, year: 365 };

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

export default function StatsTab() {
  const db = useSQLiteContext();
  const colors = useTheme();
  const { unit, kcalTarget } = useSettings();
  const [range, setRange] = useState<Range>('week');
  const [weights, setWeights] = useState<WeightRow[]>([]);
  const [muscles, setMuscles] = useState<MuscleSetsRow[]>([]);
  const [calories, setCalories] = useState<CalorieDay[]>([]);
  const [topExercises, setTopExercises] = useState<TopExerciseRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      getWeightTrend(db, 90).then(setWeights);
      getMuscleSets(db, daysAgoIso(RANGE_DAYS[range])).then(setMuscles);
      getCalorieDays(db, 14).then(setCalories);
      getTopExercises(db, 8).then(setTopExercises);
    }, [db, range]),
  );

  const weightPoints: Point[] = [...weights].reverse().map((w) => ({
    label: w.date.slice(5), value: w.weight_kg,
  }));
  const avg7 = [...weights].reverse().map((w) => w.avg7);
  const kcalPoints: Point[] = [...calories].reverse().map((c) => ({
    label: c.date.slice(5), value: c.kcal,
  }));

  const weightDelta =
    weights.length >= 2 ? weights[0].avg7 - weights[weights.length - 1].avg7 : null;

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.three, paddingBottom: Spacing.six }}>
      <SectionTitle>
        Body weight — last 90 days
        {weightDelta != null
          ? ` (${weightDelta > 0 ? '+' : ''}${formatWeight(weightDelta, unit)} ${unit} trend)`
          : ''}
      </SectionTitle>
      <Card>
        <LineChart
          data={weightPoints}
          secondary={avg7}
          formatValue={(v) => `${formatWeight(v, unit)}`}
        />
      </Card>

      <SectionTitle>Sets per muscle group</SectionTitle>
      <Card style={{ gap: Spacing.three }}>
        <View style={{ flexDirection: 'row', gap: Spacing.two }}>
          {(['week', 'month', 'year'] as Range[]).map((r) => (
            <Pressable
              key={r}
              onPress={() => setRange(r)}
              style={{
                flex: 1, paddingVertical: 6, borderRadius: 8, alignItems: 'center',
                backgroundColor: range === r ? colors.tint : colors.backgroundSelected,
              }}>
              <Text style={{ color: range === r ? '#fff' : colors.text, fontWeight: '600', fontSize: 13 }}>
                {r === 'week' ? '7d' : r === 'month' ? '30d' : '365d'}
              </Text>
            </Pressable>
          ))}
        </View>
        <BarList data={muscles.map((m) => ({ label: m.muscle, value: m.sets }))} />
      </Card>

      <SectionTitle>Calories — last 14 days</SectionTitle>
      <Card>
        <ColumnChart data={kcalPoints} target={kcalTarget ?? undefined} />
      </Card>

      <SectionTitle>Exercises</SectionTitle>
      <Card style={{ gap: 2 }}>
        {topExercises.length === 0 && (
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            Finish workouts to see per-exercise progression here.
          </Text>
        )}
        {topExercises.map((e) => (
          <Pressable
            key={e.id}
            onPress={() => router.push(`/exercise/${e.id}`)}
            style={({ pressed }) => [
              {
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                paddingVertical: 10, borderRadius: 8, paddingHorizontal: 6,
              },
              pressed && { backgroundColor: colors.backgroundSelected },
            ]}>
            <Text style={{ color: colors.text, fontSize: 15, flex: 1 }} numberOfLines={1}>
              {e.name}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              {e.sessions}× · best {e.best_weight != null ? `${formatWeight(e.best_weight, unit)} ${unit}` : '—'}{'  ›'}
            </Text>
          </Pressable>
        ))}
      </Card>
    </ScrollView>
  );
}
