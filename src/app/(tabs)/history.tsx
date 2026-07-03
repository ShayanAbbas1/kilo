import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { HistoryRow, getHistory } from '@/db/queries';
import { durationLabel, formatDateTime } from '@/lib/dates';
import { useSettings } from '@/lib/settings-context';
import { weightLabel } from '@/lib/units';

export default function HistoryTab() {
  const db = useSQLiteContext();
  const colors = useTheme();
  const { unit } = useSettings();
  const [rows, setRows] = useState<HistoryRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      getHistory(db).then(setRows);
    }, [db]),
  );

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.id}
      contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two }}
      ListEmptyComponent={
        <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.six }}>
          No workouts yet. Finish one and it shows up here.
        </Text>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/history/${item.id}`)}
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: pressed ? colors.backgroundSelected : colors.backgroundElement },
          ]}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
            {item.name ?? formatDateTime(item.started_at)}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            {durationLabel(item.started_at, item.finished_at)} · {item.exercise_count} exercises ·{' '}
            {item.set_count} sets · {weightLabel(item.tonnage_kg, unit)}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, padding: Spacing.three, gap: 4 },
});
