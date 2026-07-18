import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Card, EmptyState, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  PrRow,
  getCalorieDays, getMuscleLastTrained, getMuscleSets, getPeriodSummary, getPrHistory, getWeightTrend,
} from '@/db/queries';
import { todayStr } from '@/lib/dates';
import { useSettings } from '@/lib/settings-context';
import { formatWeight, weightLabel } from '@/lib/units';
import {
  MuscleGap, addDaysToDay, computeMuscleGaps, weekAgoAvg7, weekBounds, withinWeek,
} from '@/lib/weekly-report';

type ReportData = {
  workouts: number;
  workoutsDelta: number;
  tonnageKg: number;
  tonnageDelta: number;
  prs: PrRow[];
  gaps: MuscleGap[];
  daysLogged: number;
  avgKcal: number | null;
  weightNow: number | null;
  weightDelta: number | null;
};

export default function ReportScreen() {
  const db = useSQLiteContext();
  const colors = useTheme();
  const { unit, kcalTarget } = useSettings();
  const [data, setData] = useState<ReportData | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const bounds = weekBounds();
        const [
          throughThisWeek, throughLastWeek, prsRaw, recentMuscles, thisWeekMuscles, lastTrained,
          calorieDaysRaw, weightRows,
        ] = await Promise.all([
          getPeriodSummary(db, bounds.thisWeekStartIso),
          getPeriodSummary(db, bounds.lastWeekStartIso),
          getPrHistory(db, 200),
          getMuscleSets(db, bounds.fourWeeksAgoIso),
          getMuscleSets(db, bounds.thisWeekStartIso),
          getMuscleLastTrained(db),
          getCalorieDays(db, 14),
          getWeightTrend(db, 30),
        ]);
        if (cancelled) return;

        const thisWeekStartDay = todayStr(new Date(bounds.thisWeekStartIso));
        const weekEndDay = addDaysToDay(thisWeekStartDay, 7);
        const weekCalorieDays = withinWeek(calorieDaysRaw, thisWeekStartDay, weekEndDay);
        const { now: weightNow, weekAgo: weightWeekAgo } = weekAgoAvg7(weightRows);
        const lastWeek = {
          workouts: throughLastWeek.workouts - throughThisWeek.workouts,
          tonnage_kg: throughLastWeek.tonnage_kg - throughThisWeek.tonnage_kg,
        };

        setData({
          workouts: throughThisWeek.workouts,
          workoutsDelta: throughThisWeek.workouts - lastWeek.workouts,
          tonnageKg: throughThisWeek.tonnage_kg,
          tonnageDelta: throughThisWeek.tonnage_kg - lastWeek.tonnage_kg,
          prs: prsRaw.filter((pr) => pr.started_at >= bounds.thisWeekStartIso),
          gaps: computeMuscleGaps(
            recentMuscles.map((m) => m.muscle),
            thisWeekMuscles.map((m) => m.muscle),
            lastTrained,
            todayStr(),
          ),
          daysLogged: weekCalorieDays.length,
          avgKcal: weekCalorieDays.length
            ? weekCalorieDays.reduce((a, d) => a + d.kcal, 0) / weekCalorieDays.length
            : null,
          weightNow,
          weightDelta: weightNow != null && weightWeekAgo != null ? weightNow - weightWeekAgo : null,
        });
      })();
      return () => { cancelled = true; };
    }, [db]),
  );

  if (!data) return null; // local SQLite reads are fast — no spinner needed for the first frame

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.three, paddingBottom: Spacing.six }}>
      <SectionTitle>This week</SectionTitle>
      <Card style={{ gap: Spacing.two }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
          {data.workouts} workout{data.workouts === 1 ? '' : 's'}
          {data.workoutsDelta !== 0 && (
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '400' }}>
              {'  '}{data.workoutsDelta > 0 ? '▲' : '▼'} {Math.abs(data.workoutsDelta)} vs last week
            </Text>
          )}
        </Text>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
          {weightLabel(data.tonnageKg, unit)} lifted
          {Math.abs(data.tonnageDelta) > 1e-9 && (
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '400' }}>
              {'  '}{data.tonnageDelta > 0 ? '▲' : '▼'} {weightLabel(Math.abs(data.tonnageDelta), unit)} vs last week
            </Text>
          )}
        </Text>
      </Card>

      <SectionTitle>PRs this week</SectionTitle>
      <Card style={{ gap: 2 }}>
        {data.prs.length === 0 && (
          <EmptyState icon="🏆" title="No PRs this week" hint="Beat a previous best weight to see it here." />
        )}
        {data.prs.map((pr, i) => (
          <Text
            key={i}
            style={{ color: colors.text, fontSize: 15, paddingVertical: 6, fontVariant: ['tabular-nums'] }}
            numberOfLines={1}>
            🏆 {pr.exercise_name} — {weightLabel(pr.weight_kg, unit)} × {pr.reps}
          </Text>
        ))}
      </Card>

      <SectionTitle>Muscle gaps</SectionTitle>
      <Card style={{ gap: 2 }}>
        {data.gaps.length === 0 && (
          <EmptyState icon="✅" title="No gaps" hint="Every muscle you've trained recently got sets this week." />
        )}
        {data.gaps.map((g) => (
          <View key={g.muscle} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
            <Text style={{ color: colors.text, fontSize: 15, flex: 1 }} numberOfLines={1}>{g.muscle}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'] }}>
              {g.reason === 'stale' ? `${g.daysSince}d since last trained` : 'no sets this week'}
            </Text>
          </View>
        ))}
      </Card>

      <SectionTitle>Calories</SectionTitle>
      <Card style={{ gap: Spacing.two }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
          {data.daysLogged} / 7 days logged
        </Text>
        <Text style={{ color: colors.textSecondary, fontVariant: ['tabular-nums'] }}>
          {data.avgKcal != null
            ? `avg ${Math.round(data.avgKcal)} kcal/day${kcalTarget ? ` · target ${kcalTarget}` : ''}`
            : 'No calories logged this week'}
        </Text>
      </Card>

      <SectionTitle>Body weight</SectionTitle>
      <Card style={{ gap: Spacing.two }}>
        {data.weightNow == null ? (
          <EmptyState icon="⚖️" title="No weigh-ins yet" />
        ) : (
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
            {formatWeight(data.weightNow, unit)} {unit} avg
            {data.weightDelta != null && (
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '400' }}>
                {'  '}{data.weightDelta <= 0 ? '▼' : '▲'} {formatWeight(Math.abs(data.weightDelta), unit)} {unit} vs 7 days ago
              </Text>
            )}
          </Text>
        )}
      </Card>
    </ScrollView>
  );
}
