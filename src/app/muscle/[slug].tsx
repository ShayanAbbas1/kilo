import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Text } from '@/components/text';
import { BarList, ColumnChart } from '@/components/charts';
import { Card, EmptyState, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  MuscleExerciseRow, MuscleExerciseWeeklyRow, MuscleWeekRow,
  getMuscleExerciseWeekly, getMuscleExercises, getMuscleWeeklySets,
} from '@/db/queries';
import { SLUG_TO_MUSCLES } from '@/lib/body-map';
import { aggregateHeads } from '@/lib/muscle-heads';
import { useSettings } from '@/lib/settings-context';
import { toDisplayWeight } from '@/lib/units';

const WEEKS = 12;
type MuscleMetric = 'sets' | 'tonnage';

export default function MuscleDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const db = useSQLiteContext();
  const colors = useTheme();
  const { unit } = useSettings();
  const muscles = SLUG_TO_MUSCLES[slug] ?? [slug];
  const title = muscles.join(' + ');

  const [weekly, setWeekly] = useState<MuscleWeekRow[]>([]);
  const [exercises, setExercises] = useState<MuscleExerciseRow[]>([]);
  const [exerciseWeekly, setExerciseWeekly] = useState<MuscleExerciseWeeklyRow[]>([]);
  const [metric, setMetric] = useState<MuscleMetric>('sets');
  const [selectedHead, setSelectedHead] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const since = new Date(Date.now() - WEEKS * 7 * 86400000).toISOString().slice(0, 10);
      getMuscleWeeklySets(db, muscles, since).then(setWeekly);
      getMuscleExercises(db, muscles, since).then(setExercises);
      getMuscleExerciseWeekly(db, muscles, since).then(setExerciseWeekly);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- muscles derives from slug
    }, [db, slug]),
  );

  const totalSets = weekly.reduce((a, r) => a + r.sets, 0);
  const totalTonnage = weekly.reduce((a, r) => a + r.tonnage, 0);

  const heads = useMemo(
    () => aggregateHeads(exerciseWeekly, muscles),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- muscles derives from slug
    [exerciseWeekly, slug],
  );
  const activeHead = heads.find((h) => h.head === selectedHead) ?? heads[0];

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.three, paddingBottom: Spacing.six }}>
      <Stack.Screen options={{ title }} />

      <SectionTitle>
        Weekly {metric} — last {WEEKS} weeks (
        {metric === 'tonnage'
          ? `${Math.round(toDisplayWeight(totalTonnage, unit))} ${unit}`
          : totalSets} total)
      </SectionTitle>
      <Card style={{ gap: Spacing.two }}>
        <View style={{ flexDirection: 'row', gap: Spacing.two, alignSelf: 'flex-start' }}>
          {(['sets', 'tonnage'] as MuscleMetric[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMetric(m)}
              style={({ pressed }) => ({
                paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8,
                backgroundColor: metric === m ? colors.tint : colors.backgroundSelected,
                opacity: pressed ? 0.7 : 1,
              })}>
              <Text style={{ color: metric === m ? colors.onTint : colors.text, fontWeight: '600', fontSize: 12 }}>
                {m === 'sets' ? 'Sets' : 'Tonnage'}
              </Text>
            </Pressable>
          ))}
        </View>
        <ColumnChart
          data={weekly.map((r) => ({
            label: `w${r.wk.slice(5)}`,
            value: metric === 'tonnage' ? toDisplayWeight(r.tonnage, unit) : r.sets,
          }))}
          formatValue={(v) => String(Math.round(v))}
        />
      </Card>

      {heads.length > 0 && (
        <>
          <SectionTitle>By head/region</SectionTitle>
          <Card style={{ gap: Spacing.two }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
              {heads.map((h) => (
                <Pressable
                  key={h.head}
                  onPress={() => setSelectedHead(h.head)}
                  style={({ pressed }) => ({
                    paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8,
                    backgroundColor: activeHead?.head === h.head ? colors.tint : colors.backgroundSelected,
                    opacity: pressed ? 0.7 : 1,
                  })}>
                  <Text style={{
                    color: activeHead?.head === h.head ? colors.onTint : colors.text,
                    fontWeight: '600', fontSize: 12,
                  }}>
                    {h.head}
                  </Text>
                </Pressable>
              ))}
            </View>
            {activeHead && (
              <ColumnChart
                data={weekly.map((r) => ({
                  label: `w${r.wk.slice(5)}`,
                  value: activeHead.byWeek.get(r.wk) ?? 0,
                }))}
                formatValue={(v) => String(Math.round(v))}
              />
            )}
            <BarList data={heads.map((h) => ({ label: h.head, value: h.total }))} />
          </Card>
        </>
      )}

      <SectionTitle>Trained with</SectionTitle>
      <Card style={{ gap: 2 }}>
        {exercises.length === 0 && (
          <EmptyState icon="💪" title="Nothing logged" hint={`for ${title} in the last ${WEEKS} weeks.`} />
        )}
        {exercises.map((e) => (
          <Pressable
            key={e.id}
            onPress={() => router.push(`/exercise/${e.id}`)}
            style={({ pressed }) => [
              {
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                paddingVertical: 10, paddingHorizontal: 6, borderRadius: 8,
              },
              pressed && { backgroundColor: colors.backgroundSelected },
            ]}>
            <Text style={{ color: colors.text, fontSize: 15, flex: 1 }} numberOfLines={1}>
              {e.name}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'] }}>{e.sets} sets  ›</Text>
          </Pressable>
        ))}
      </Card>
    </ScrollView>
  );
}
