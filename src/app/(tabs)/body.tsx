import { useCallback, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Button, Card, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  CalorieEntry, WeightRow,
  addCalorieEntry, deleteCalorieEntry, deleteWeighIn,
  getCalorieEntries, getWeightTrend, upsertWeighIn,
} from '@/db/queries';
import { formatDay, todayStr } from '@/lib/dates';
import { useSettings } from '@/lib/settings-context';
import { formatWeight, fromDisplayWeight, weightLabel } from '@/lib/units';

export default function BodyTab() {
  const db = useSQLiteContext();
  const colors = useTheme();
  const { unit, kcalTarget } = useSettings();

  const [trend, setTrend] = useState<WeightRow[]>([]);
  const [weightText, setWeightText] = useState('');
  const [entries, setEntries] = useState<CalorieEntry[]>([]);
  const [kcalText, setKcalText] = useState('');
  const [labelText, setLabelText] = useState('');

  const today = todayStr();

  const reload = useCallback(() => {
    getWeightTrend(db, 30).then((rows) => {
      setTrend(rows);
      const t = rows.find((r) => r.date === today);
      setWeightText(t ? formatWeight(t.weight_kg, unit) : '');
    });
    getCalorieEntries(db, today).then(setEntries);
  }, [db, today, unit]);

  useFocusEffect(reload);

  const saveWeight = async () => {
    const n = parseFloat(weightText.replace(',', '.'));
    if (isNaN(n) || n <= 0) return;
    await upsertWeighIn(db, today, fromDisplayWeight(n, unit));
    reload();
  };

  const addEntry = async () => {
    const kcal = parseInt(kcalText, 10);
    if (isNaN(kcal) || kcal <= 0) return;
    await addCalorieEntry(db, today, kcal, labelText.trim() || undefined);
    setKcalText('');
    setLabelText('');
    reload();
  };

  const todayKcal = entries.reduce((a, e) => a + e.kcal, 0);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.three, paddingBottom: Spacing.six }}
        keyboardShouldPersistTaps="handled">
        <SectionTitle>Today’s weigh-in</SectionTitle>
        <Card style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'center' }}>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.background, flex: 1 }]}
            value={weightText}
            onChangeText={setWeightText}
            keyboardType="decimal-pad"
            placeholder={`Weight (${unit})`}
            placeholderTextColor={colors.textSecondary}
          />
          <Button title="Save" onPress={saveWeight} />
        </Card>

        <SectionTitle>Calories today {kcalTarget ? `· ${todayKcal} / ${kcalTarget} kcal` : `· ${todayKcal} kcal`}</SectionTitle>
        <Card style={{ gap: Spacing.two }}>
          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.background, flex: 1.4 }]}
              value={labelText}
              onChangeText={setLabelText}
              placeholder="Meal (optional)"
              placeholderTextColor={colors.textSecondary}
            />
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.background, flex: 1 }]}
              value={kcalText}
              onChangeText={setKcalText}
              keyboardType="number-pad"
              placeholder="kcal"
              placeholderTextColor={colors.textSecondary}
            />
            <Button title="Add" onPress={addEntry} />
          </View>
          {entries.map((e) => (
            <Pressable
              key={e.id}
              onLongPress={() =>
                Alert.alert('Delete entry?', undefined, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete', style: 'destructive',
                    onPress: () => deleteCalorieEntry(db, e.id).then(reload),
                  },
                ])
              }
              style={styles.entryRow}>
              <Text style={{ color: colors.text }}>{e.label ?? 'Entry'}</Text>
              <Text style={{ color: colors.textSecondary }}>{e.kcal} kcal</Text>
            </Pressable>
          ))}
          {entries.length === 0 && (
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              Log meals separately or one daily total — your call.
            </Text>
          )}
        </Card>

        <SectionTitle>Weight trend</SectionTitle>
        <Card style={{ gap: 6 }}>
          {trend.length === 0 && (
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              Weigh in daily — the 7-day average smooths out the water-weight noise.
            </Text>
          )}
          {trend.map((r) => (
            <Pressable
              key={r.date}
              onLongPress={() =>
                Alert.alert(`Delete weigh-in ${r.date}?`, undefined, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete', style: 'destructive',
                    onPress: () => deleteWeighIn(db, r.date).then(reload),
                  },
                ])
              }
              style={styles.entryRow}>
              <Text style={{ color: colors.text, width: 110 }}>{formatDay(r.date)}</Text>
              <Text style={{ color: colors.text, fontWeight: '600' }}>
                {weightLabel(r.weight_kg, unit)}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                avg {formatWeight(r.avg7, unit)}
              </Text>
            </Pressable>
          ))}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16,
  },
  entryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 4,
  },
});
