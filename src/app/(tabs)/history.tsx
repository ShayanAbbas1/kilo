import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Card, EmptyState } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { HistoryRow, WorkoutDay, deleteWorkout, getHistory, getHistoryForDay, getWorkoutDates } from '@/db/queries';
import { monthGrid, weekStreaks } from '@/lib/calendar';
import { durationLabel, formatDay, formatDateTime, todayStr } from '@/lib/dates';
import { useSettings } from '@/lib/settings-context';
import { weightLabel } from '@/lib/units';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function HistoryTab() {
  const db = useSQLiteContext();
  const colors = useTheme();
  const { unit } = useSettings();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [dayRows, setDayRows] = useState<HistoryRow[]>([]);
  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([]);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const refresh = useCallback(() => {
    getHistory(db).then(setRows);
    getWorkoutDates(db).then((days) => {
      setWorkoutDays(days);
      // Deleting a day's only workout leaves a dangling filter — clear it once the day is gone.
      setSelectedDay((cur) =>
        cur && !days.some((d) => todayStr(new Date(d.started_at)) === cur) ? null : cur);
    });
  }, [db]);

  useFocusEffect(refresh);

  const onDelete = (item: HistoryRow) => {
    Alert.alert('Delete workout?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteWorkout(db, item.id);
          refresh();
        },
      },
    ]);
  };

  const daysMap = useMemo(() => {
    const m = new Map<string, WorkoutDay[]>();
    for (const w of workoutDays) {
      const day = todayStr(new Date(w.started_at));
      const arr = m.get(day);
      if (arr) arr.push(w); else m.set(day, [w]);
    }
    return m;
  }, [workoutDays]);

  // Tapped day's workouts fetched directly (not filtered from the 100-row history window,
  // which would show empty for days older than the 100 most recent workouts).
  useEffect(() => {
    if (selectedDay) getHistoryForDay(db, selectedDay).then(setDayRows);
  }, [db, selectedDay, workoutDays]);

  const streak = useMemo(
    () => weekStreaks(new Set(daysMap.keys()), todayStr()),
    [daysMap],
  );

  const grid = useMemo(
    () => monthGrid(viewMonth.year, viewMonth.month),
    [viewMonth],
  );

  const today = todayStr();
  const data = selectedDay ? dayRows : rows;

  const prevMonth = () => setViewMonth(({ year, month }) =>
    month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 });
  const nextMonth = () => setViewMonth(({ year, month }) =>
    month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 });

  return (
    <FlatList
      data={data}
      keyExtractor={(r) => r.id}
      contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six }}
      ListHeaderComponent={
        <View style={{ marginBottom: Spacing.two, gap: Spacing.two }}>
          <Card style={{ gap: Spacing.two }}>
            <View style={styles.monthRow}>
              <Pressable onPress={prevMonth} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                <Text style={{ color: colors.tint, fontSize: 20 }}>‹</Text>
              </Pressable>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
                {MONTH_NAMES[viewMonth.month]} {viewMonth.year}
              </Text>
              <Pressable onPress={nextMonth} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                <Text style={{ color: colors.tint, fontSize: 20 }}>›</Text>
              </Pressable>
            </View>
            <View style={styles.weekRow}>
              {DOW.map((d) => (
                <Text key={d} style={[styles.dowLabel, { color: colors.textSecondary }]}>{d}</Text>
              ))}
            </View>
            {grid.map((week, i) => (
              <View key={i} style={styles.weekRow}>
                {week.map((day, j) => {
                  if (!day) return <View key={j} style={styles.dayCell} />;
                  const has = daysMap.has(day);
                  const isSelected = selectedDay === day;
                  const isToday = day === today;
                  return (
                    <Pressable
                      key={j}
                      disabled={!has}
                      onPress={() => setSelectedDay(isSelected ? null : day)}
                      style={({ pressed }) => [styles.dayCell, has && { opacity: pressed ? 0.5 : 1 }]}>
                      <View
                        style={[
                          styles.dayCircle,
                          isSelected && { backgroundColor: colors.tint },
                          !isSelected && isToday && { borderWidth: 1, borderColor: colors.tint },
                        ]}>
                        <Text style={{ color: isSelected ? colors.onTint : colors.text, fontSize: 13 }}>
                          {Number(day.slice(-2))}
                        </Text>
                      </View>
                      {has && !isSelected && (
                        <View style={[styles.dot, { backgroundColor: colors.tint }]} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
            {streak.current >= 2 && (
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'] }}>
                🔥 {streak.current}-week streak · best {streak.longest}
              </Text>
            )}
          </Card>
          {selectedDay && (
            <Pressable
              onPress={() => setSelectedDay(null)}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                Showing {formatDay(selectedDay)} — Clear
              </Text>
            </Pressable>
          )}
        </View>
      }
      ListEmptyComponent={
        <View style={{ marginTop: Spacing.six }}>
          <EmptyState icon="🏋️" title="No workouts yet" hint="Start one on the Workout tab." />
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/history/${item.id}`)}
          onLongPress={() => onDelete(item)}
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: pressed ? colors.backgroundSelected : colors.backgroundElement },
          ]}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
            {item.name ?? formatDateTime(item.started_at)}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'] }}>
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
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weekRow: { flexDirection: 'row' },
  dowLabel: { flex: 1, textAlign: 'center', fontSize: 12 },
  dayCell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', bottom: 2, width: 4, height: 4, borderRadius: 2 },
});
