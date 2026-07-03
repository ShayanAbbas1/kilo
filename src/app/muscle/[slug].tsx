import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { ColumnChart } from '@/components/charts';
import { Card, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MuscleExerciseRow, MuscleWeekRow, getMuscleExercises, getMuscleWeeklySets } from '@/db/queries';
import { SLUG_TO_MUSCLES } from '@/lib/body-map';

const WEEKS = 12;

export default function MuscleDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const db = useSQLiteContext();
  const colors = useTheme();
  const muscles = SLUG_TO_MUSCLES[slug] ?? [slug];
  const title = muscles.join(' + ');

  const [weekly, setWeekly] = useState<MuscleWeekRow[]>([]);
  const [exercises, setExercises] = useState<MuscleExerciseRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      const since = new Date(Date.now() - WEEKS * 7 * 86400000).toISOString().slice(0, 10);
      getMuscleWeeklySets(db, muscles, since).then(setWeekly);
      getMuscleExercises(db, muscles, since).then(setExercises);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- muscles derives from slug
    }, [db, slug]),
  );

  const totalSets = weekly.reduce((a, r) => a + r.sets, 0);

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.three, paddingBottom: Spacing.six }}>
      <Stack.Screen options={{ title }} />

      <SectionTitle>
        Working sets per week — last {WEEKS} weeks ({totalSets} total)
      </SectionTitle>
      <Card>
        <ColumnChart
          data={weekly.map((r) => ({ label: `w${r.wk.slice(5)}`, value: r.sets }))}
        />
      </Card>

      <SectionTitle>Trained with</SectionTitle>
      <Card style={{ gap: 2 }}>
        {exercises.length === 0 && (
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            Nothing logged for {title} in the last {WEEKS} weeks.
          </Text>
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
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{e.sets} sets  ›</Text>
          </Pressable>
        ))}
      </Card>
    </ScrollView>
  );
}
