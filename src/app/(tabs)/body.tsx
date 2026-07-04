import { useCallback, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Button, Card, EmptyState, SectionTitle } from '@/components/ui';
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
  const [proteinText, setProteinText] = useState('');

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
    const protein = parseFloat(proteinText.replace(',', '.'));
    await addCalorieEntry(
      db, today, kcal, labelText.trim() || undefined, isNaN(protein) ? undefined : protein);
    setKcalText('');
    setLabelText('');
    setProteinText('');
    reload();
  };

  const todayKcal = entries.reduce((a, e) => a + e.kcal, 0);
  const todayProtein = entries.reduce((a, e) => a + (e.protein_g ?? 0), 0);

  // vs yesterday's 7-day average: the honest daily signal
  const todayRow = trend.find((r) => r.date === today);
  const prevRow = trend.find((r) => r.date < today);
  const delta = todayRow && prevRow ? todayRow.weight_kg - prevRow.avg7 : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.three, paddingBottom: Spacing.six }}
        keyboardShouldPersistTaps="handled">
        <SectionTitle>
          Today’s weigh-in
          {delta != null
            ? `  ${delta <= 0 ? '▼' : '▲'} ${formatWeight(Math.abs(delta), unit)} ${unit} vs 7-day avg`
            : ''}
        </SectionTitle>
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

        <SectionTitle>
          Calories today {kcalTarget ? `· ${todayKcal} / ${kcalTarget} kcal` : `· ${todayKcal} kcal`}
          {todayProtein > 0 ? ` · ${Math.round(todayProtein)}g protein` : ''}
        </SectionTitle>
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
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.background, flex: 0.9 }]}
              value={proteinText}
              onChangeText={setProteinText}
              keyboardType="decimal-pad"
              placeholder="prot g"
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
              style={({ pressed }) => [styles.entryRow, pressed && { backgroundColor: colors.backgroundSelected }]}>
              <Text style={{ color: colors.text }}>{e.label ?? 'Entry'}</Text>
              <Text style={{ color: colors.textSecondary, fontVariant: ['tabular-nums'] }}>
                {e.kcal} kcal{e.protein_g != null ? ` · ${e.protein_g}g` : ''}
              </Text>
            </Pressable>
          ))}
          {entries.length === 0 && (
            <EmptyState
              icon="🍽️"
              title="No meals logged"
              hint="Log meals separately or one daily total — your call."
            />
          )}
        </Card>

        <SectionTitle>Weight trend</SectionTitle>
        <Card style={{ gap: 6 }}>
          {trend.length === 0 && (
            <EmptyState
              icon="⚖️"
              title="No weigh-ins yet"
              hint="Weigh in daily — the 7-day average smooths out the water-weight noise."
            />
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
              style={({ pressed }) => [styles.entryRow, pressed && { backgroundColor: colors.backgroundSelected }]}>
              <Text style={{ color: colors.text, width: 110, fontVariant: ['tabular-nums'] }}>
                {formatDay(r.date)}
              </Text>
              <Text style={{ color: colors.text, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                {weightLabel(r.weight_kg, unit)}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'] }}>
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
