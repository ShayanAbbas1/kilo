import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { BarList, ColumnChart, LineChart, Point, TrendChart } from '@/components/charts';
import { BodyHeatmap } from '@/components/body-heatmap';
import { Card, EmptyState, SectionTitle } from '@/components/ui';
import { HEAT_COLORS, toBodyData } from '@/lib/body-map';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  CalorieDay, MuscleSetsRow, PrRow, StalledLift, TopExerciseRow, WeeklyTrend, WeightRow,
  getCalorieDays, getMuscleSets, getPrHistory, getSetting, getStalledLifts, getTopExercises,
  getWeeklyTrend, getWeightTrend, setSetting,
} from '@/db/queries';
import { formatDateTime, formatDay } from '@/lib/dates';
import { useSettings } from '@/lib/settings-context';
import { formatWeight, toDisplayWeight, weightLabel } from '@/lib/units';

type Range = number | 'all'; // rolling window in days, or all-time
const PRESET_DAYS = [7, 30, 365];
type MuscleMetric = 'sets' | 'tonnage';

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

// '' sorts before every ISO timestamp, so `started_at >= ''` matches all rows = all-time.
function rangeSince(r: Range): string {
  return r === 'all' ? '' : daysAgoIso(r);
}

export default function StatsTab() {
  const db = useSQLiteContext();
  const colors = useTheme();
  const { unit, kcalTarget } = useSettings();
  const [range, setRange] = useState<Range>(7);
  const [customRanges, setCustomRanges] = useState<number[]>([]);
  const [newDays, setNewDays] = useState<string | null>(null); // null = add-input hidden
  const [muscleMetric, setMuscleMetric] = useState<MuscleMetric>('sets');
  const [weights, setWeights] = useState<WeightRow[]>([]);
  const [muscles, setMuscles] = useState<MuscleSetsRow[]>([]);
  const [calories, setCalories] = useState<CalorieDay[]>([]);
  const [topExercises, setTopExercises] = useState<TopExerciseRow[]>([]);
  const [trend, setTrend] = useState<WeeklyTrend | null>(null);
  const [prs, setPrs] = useState<PrRow[]>([]);
  const [stalled, setStalled] = useState<StalledLift[]>([]);

  useEffect(() => {
    getSetting(db, 'custom_ranges').then((v) => v && setCustomRanges(JSON.parse(v)));
  }, [db]);

  const saveCustomRanges = (next: number[]) => {
    setCustomRanges(next);
    setSetting(db, 'custom_ranges', JSON.stringify(next));
  };

  const addCustomRange = () => {
    const days = parseInt(newDays ?? '', 10);
    setNewDays(null);
    if (!Number.isFinite(days) || days <= 0) return;
    if (!PRESET_DAYS.includes(days) && !customRanges.includes(days)) {
      saveCustomRanges([...customRanges, days]);
    }
    setRange(days);
  };

  const chips: Range[] = [
    ...[...new Set([...PRESET_DAYS, ...customRanges])].sort((a, b) => a - b),
    'all',
  ];

  useFocusEffect(
    useCallback(() => {
      getWeightTrend(db, 90).then(setWeights);
      getMuscleSets(db, rangeSince(range)).then(setMuscles);
      getCalorieDays(db, 14).then(setCalories);
      getTopExercises(db, 8).then(setTopExercises);
      getWeeklyTrend(db, daysAgoIso(84).slice(0, 10)).then(setTrend);
      getPrHistory(db, 10).then(setPrs);
      getStalledLifts(db, kcalTarget, unit).then(setStalled);
    }, [db, range, kcalTarget, unit]),
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

  const lastOf = (vals: (number | null)[]): number | null => {
    for (let i = vals.length - 1; i >= 0; i--) if (vals[i] != null) return vals[i];
    return null;
  };

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.three, paddingBottom: Spacing.six }}>
      <Pressable onPress={() => router.push('/report')} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        <Card style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: Spacing.three,
        }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>📅 Weekly report</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 18 }}>›</Text>
        </Card>
      </Pressable>
      {stalled.length > 0 && (
        <>
          <SectionTitle>Stalled lifts</SectionTitle>
          <Card style={{ gap: 2 }}>
            {stalled.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => router.push(`/exercise/${s.id}`)}
                style={({ pressed }) => [
                  { paddingVertical: 10, borderRadius: 8, paddingHorizontal: 6, gap: 2 },
                  pressed && { backgroundColor: colors.backgroundSelected },
                ]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: colors.text, fontSize: 15, flex: 1 }} numberOfLines={1}>
                    ⚠️ {s.name}
                  </Text>
                  <Text style={{ color: colors.accent, fontSize: 13, fontVariant: ['tabular-nums'] }}>
                    flat since {formatDay(s.stalledSince)}{'  ›'}
                  </Text>
                </View>
                {s.context && (
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{s.context}</Text>
                )}
              </Pressable>
            ))}
          </Card>
        </>
      )}

      <SectionTitle>The Trendline — 12 weeks, is it working?</SectionTitle>
      <Card>
        {trend && (
          <TrendChart
            labels={trend.weeks.map((w) => `w${w.slice(5)}`)}
            series={[
              {
                label: 'weight', color: colors.tint, values: trend.weight,
                current: lastOf(trend.weight) != null
                  ? `${formatWeight(lastOf(trend.weight)!, unit)} ${unit}` : '—',
              },
              {
                label: 'lifted/wk', color: colors.success, values: trend.tonnage,
                current: lastOf(trend.tonnage) != null
                  ? `${formatWeight(lastOf(trend.tonnage)!, unit)} ${unit}` : '—',
              },
              {
                label: 'kcal/day', color: colors.accent, values: trend.kcal,
                current: lastOf(trend.kcal) != null ? `${Math.round(lastOf(trend.kcal)!)}` : '—',
              },
            ]}
          />
        )}
        <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 6 }}>
          Each line scaled to its own range — read the shapes: weight down, lifted steady = a good cut.
        </Text>
      </Card>

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
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
          {chips.map((r) => (
            <Pressable
              key={String(r)}
              onPress={() => setRange(r)}
              onLongPress={
                typeof r === 'number' && customRanges.includes(r)
                  ? () => {
                      saveCustomRanges(customRanges.filter((d) => d !== r));
                      if (range === r) setRange(7);
                    }
                  : undefined
              }
              style={({ pressed }) => ({
                paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center',
                backgroundColor: range === r ? colors.tint : colors.backgroundSelected,
                opacity: pressed ? 0.7 : 1,
              })}>
              <Text style={{ color: range === r ? colors.onTint : colors.text, fontWeight: '600', fontSize: 13 }}>
                {r === 'all' ? 'All' : `${r}d`}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => setNewDays(newDays == null ? '' : null)}
            style={({ pressed }) => ({
              paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center',
              backgroundColor: colors.backgroundSelected, opacity: pressed ? 0.7 : 1,
            })}>
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>＋</Text>
          </Pressable>
        </View>
        {newDays != null && (
          <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'center' }}>
            <TextInput
              style={{
                flex: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8,
                color: colors.text, backgroundColor: colors.background, fontSize: 13,
              }}
              value={newDays}
              onChangeText={setNewDays}
              keyboardType="number-pad"
              placeholder="days, e.g. 90"
              placeholderTextColor={colors.textSecondary}
              autoFocus
              onSubmitEditing={addCustomRange}
            />
            <Pressable
              onPress={addCustomRange}
              style={({ pressed }) => ({
                paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8,
                backgroundColor: colors.tint, opacity: pressed ? 0.7 : 1,
              })}>
              <Text style={{ color: colors.onTint, fontWeight: '600', fontSize: 13 }}>Add</Text>
            </Pressable>
          </View>
        )}
        <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
          ＋ adds a custom window · long-press a custom chip to remove it
        </Text>
        <View style={{ flexDirection: 'row', gap: Spacing.two, alignSelf: 'flex-start' }}>
          {(['sets', 'tonnage'] as MuscleMetric[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMuscleMetric(m)}
              style={({ pressed }) => ({
                paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8,
                backgroundColor: muscleMetric === m ? colors.tint : colors.backgroundSelected,
                opacity: pressed ? 0.7 : 1,
              })}>
              <Text style={{
                color: muscleMetric === m ? colors.onTint : colors.text, fontWeight: '600', fontSize: 12,
              }}>
                {m === 'sets' ? 'Sets' : 'Tonnage'}
              </Text>
            </Pressable>
          ))}
        </View>
        {/* toBodyData buckets relative to the busiest muscle, so feeding it either
            metric's value under `sets` is enough to make the heatmap follow it too. */}
        <BodyHeatmap
          data={toBodyData(muscleMetric === 'tonnage'
            ? muscles.map((m) => ({ muscle: m.muscle, sets: m.tonnage }))
            : muscles)}
          onPressSlug={(slug) => router.push(`/muscle/${slug}`)}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center' }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
            fewer {muscleMetric === 'tonnage' ? 'kg' : 'sets'}
          </Text>
          {HEAT_COLORS.map((c) => (
            <View key={c} style={{ width: 14, height: 8, borderRadius: 2, backgroundColor: c }} />
          ))}
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>more</Text>
        </View>
        <BarList
          data={muscles.map((m) => ({
            label: m.muscle,
            value: muscleMetric === 'tonnage' ? toDisplayWeight(m.tonnage, unit) : m.sets,
          }))}
          formatValue={(v) => String(Math.round(v))}
        />
      </Card>

      <SectionTitle>Recent PRs</SectionTitle>
      <Card style={{ gap: 2 }}>
        {prs.length === 0 && (
          <EmptyState icon="🏆" title="No PRs yet" hint="Beat a previous best weight to see it here." />
        )}
        {prs.map((pr, i) => (
          <Pressable
            key={i}
            onPress={() => router.push(`/exercise/${pr.exercise_id}`)}
            style={({ pressed }) => [
              {
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                paddingVertical: 10, borderRadius: 8, paddingHorizontal: 6,
              },
              pressed && { backgroundColor: colors.backgroundSelected },
            ]}>
            <Text
              style={{ color: colors.text, fontSize: 15, flex: 1, fontVariant: ['tabular-nums'] }}
              numberOfLines={1}>
              🏆 {pr.exercise_name} — {weightLabel(pr.weight_kg, unit)} × {pr.reps}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'] }}>
              {formatDateTime(pr.started_at)}{'  ›'}
            </Text>
          </Pressable>
        ))}
      </Card>

      <SectionTitle>Calories — last 14 days</SectionTitle>
      <Card>
        <ColumnChart data={kcalPoints} target={kcalTarget ?? undefined} />
      </Card>

      <SectionTitle>Exercises</SectionTitle>
      <Card style={{ gap: 2 }}>
        {topExercises.length === 0 && (
          <EmptyState
            icon="📊"
            title="No exercises yet"
            hint="Finish workouts to see per-exercise progression here."
          />
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
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'] }}>
              {e.sessions}× · best {e.best_weight != null ? `${formatWeight(e.best_weight, unit)} ${unit}` : '—'}{'  ›'}
            </Text>
          </Pressable>
        ))}
      </Card>
    </ScrollView>
  );
}
