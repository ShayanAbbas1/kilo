import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { HistoryRow, WorkoutDay, getHistory, getWorkoutDates } from '@/db/queries';
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
  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([]);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getHistory(db).then(setRows);
      getWorkoutDates(db).then(setWorkoutDays);
    }, [db]),
  );

  const daysMap = useMemo(() => {
    const m = new Map<string, WorkoutDay[]>();
    for (const w of workoutDays) {
      const day = todayStr(new Date(w.started_at));
      const arr = m.get(day);
      if (arr) arr.push(w); else m.set(day, [w]);
    }
    return m;
  }, [workoutDays]);

  const streak = useMemo(
    () => weekStreaks(new Set(daysMap.keys()), todayStr()),
    [daysMap],
  );

  const grid = useMemo(
    () => monthGrid(viewMonth.year, viewMonth.month),
    [viewMonth],
  );

  const today = todayStr();
  const data = selectedDay
    ? rows.filter((r) => todayStr(new Date(r.started_at)) === selectedDay)
    : rows;

  const prevMonth = () => setViewMonth(({ year, month }) =>
    month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 });
  const nextMonth = () => setViewMonth(({ year, month }) =>
    month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 });

  return (
    <FlatList
      data={data}
      keyExtractor={(r) => r.id}
      contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two }}
      ListHeaderComponent={
        <View style={{ marginBottom: Spacing.two, gap: Spacing.two }}>
          <Card style={{ gap: Spacing.two }}>
            <View style={styles.monthRow}>
              <Pressable onPress={prevMonth} hitSlop={8}>
                <Text style={{ color: colors.tint, fontSize: 20 }}>‹</Text>
              </Pressable>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
                {MONTH_NAMES[viewMonth.month]} {viewMonth.year}
              </Text>
              <Pressable onPress={nextMonth} hitSlop={8}>
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
                      style={styles.dayCell}>
                      <View
                        style={[
                          styles.dayCircle,
                          isSelected && { backgroundColor: colors.tint },
                          !isSelected && isToday && { borderWidth: 1, borderColor: colors.tint },
                        ]}>
                        <Text style={{ color: isSelected ? '#fff' : colors.text, fontSize: 13 }}>
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
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                🔥 {streak.current}-week streak · best {streak.longest}
              </Text>
            )}
          </Card>
          {selectedDay && (
            <Pressable onPress={() => setSelectedDay(null)}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                Showing {formatDay(selectedDay)} — Clear
              </Text>
            </Pressable>
          )}
        </View>
      }
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
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weekRow: { flexDirection: 'row' },
  dowLabel: { flex: 1, textAlign: 'center', fontSize: 12 },
  dayCell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', bottom: 2, width: 4, height: 4, borderRadius: 2 },
});
