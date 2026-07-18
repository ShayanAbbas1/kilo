import { useEffect, useState } from 'react';
import { Alert, Keyboard, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
// ponytail: legacy FS API — stable string read/write; migrate to the new File class if expo drops legacy
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Button, Card, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { exportAll, getSetting, importAll, setSetting } from '@/db/queries';
import { useSettings } from '@/lib/settings-context';
import { toast } from '@/lib/toast';
import { Unit, formatWeight, fromDisplayWeight } from '@/lib/units';
import { todayStr } from '@/lib/dates';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const colors = useTheme();
  const {
    unit, setUnit, kcalTarget, setKcalTarget, showRpe, setShowRpe, goalWeightKg, setGoalWeightKg,
  } = useSettings();
  const [targetText, setTargetText] = useState(kcalTarget ? String(kcalTarget) : '');
  const [restText, setRestText] = useState('');
  const [goalWeightText, setGoalWeightText] = useState(
    goalWeightKg != null ? formatWeight(goalWeightKg, unit) : '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSetting(db, 'rest_seconds').then((v) => setRestText(v ?? ''));
  }, [db]);

  const saveRest = () => {
    const n = parseInt(restText, 10);
    if (isNaN(n) || n <= 0) { toast('Enter seconds, e.g. 120'); return; }
    setSetting(db, 'rest_seconds', String(n));
    Keyboard.dismiss();
    toast(`Rest timer set to ${n}s`);
  };

  const saveTarget = () => {
    const n = parseInt(targetText, 10);
    const cleared = isNaN(n) || n <= 0;
    setKcalTarget(cleared ? null : n);
    Keyboard.dismiss();
    toast(cleared ? 'Calorie target cleared' : `Calorie target set to ${n} kcal`);
  };

  const saveGoalWeight = () => {
    const n = parseFloat(goalWeightText.replace(',', '.'));
    const cleared = isNaN(n) || n <= 0;
    setGoalWeightKg(cleared ? null : fromDisplayWeight(n, unit));
    Keyboard.dismiss();
    toast(cleared ? 'Weight goal cleared' : `Weight goal set to ${n} ${unit}`);
  };

  const onExport = async () => {
    setBusy(true);
    try {
      const json = await exportAll(db);
      const uri = `${FileSystem.cacheDirectory}kilo-export-${todayStr()}.json`;
      await FileSystem.writeAsStringAsync(uri, json);
      await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Export Kilo data' });
    } catch (e) {
      Alert.alert('Export failed', String(e));
    } finally {
      setBusy(false);
    }
  };

  const onImport = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    Alert.alert('Restore from backup?', 'This replaces ALL current data with the backup.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore', style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            const json = await FileSystem.readAsStringAsync(res.assets[0].uri);
            await importAll(db, json);
            Alert.alert('Restored', 'Your data was imported.');
          } catch (e) {
            Alert.alert('Import failed', String(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.three, paddingBottom: Spacing.six }}>
      <SectionTitle>Units</SectionTitle>
      <Card style={{ flexDirection: 'row', gap: Spacing.two }}>
        {(['kg', 'lbs'] as Unit[]).map((u) => (
          <Button
            key={u}
            title={u}
            kind={unit === u ? 'primary' : 'secondary'}
            style={{ flex: 1 }}
            onPress={() => setUnit(u)}
          />
        ))}
      </Card>

      <SectionTitle>RPE per set</SectionTitle>
      <Card style={{ flexDirection: 'row', gap: Spacing.two }}>
        {([false, true] as const).map((v) => (
          <Button
            key={String(v)}
            title={v ? 'On' : 'Off'}
            kind={showRpe === v ? 'primary' : 'secondary'}
            style={{ flex: 1 }}
            onPress={() => setShowRpe(v)}
          />
        ))}
      </Card>

      <SectionTitle>Daily calorie target</SectionTitle>
      <Card style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'center' }}>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border, flex: 1 }]}
          value={targetText}
          onChangeText={setTargetText}
          keyboardType="number-pad"
          placeholder="e.g. 2000 (empty = no target)"
          placeholderTextColor={colors.textSecondary}
        />
        <Button title="Save" onPress={saveTarget} />
      </Card>

      <SectionTitle>Body weight goal ({unit})</SectionTitle>
      <Card style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'center' }}>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border, flex: 1 }]}
          value={goalWeightText}
          onChangeText={setGoalWeightText}
          keyboardType="decimal-pad"
          placeholder="e.g. 80 (empty = no goal)"
          placeholderTextColor={colors.textSecondary}
        />
        <Button title="Save" onPress={saveGoalWeight} />
      </Card>

      <SectionTitle>Rest timer (seconds)</SectionTitle>
      <Card style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'center' }}>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border, flex: 1 }]}
          value={restText}
          onChangeText={setRestText}
          keyboardType="number-pad"
          placeholder="120"
          placeholderTextColor={colors.textSecondary}
        />
        <Button title="Save" onPress={saveRest} />
      </Card>

      <SectionTitle>Backup</SectionTitle>
      <Card style={{ gap: Spacing.two }}>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
          Your data lives only on this phone. Export regularly — a lost phone is a lost history.
        </Text>
        <Button title="Export data (JSON)" onPress={onExport} disabled={busy} />
        <Button title="Restore from export" kind="secondary" onPress={onImport} disabled={busy} />
      </Card>

      <SectionTitle>Import</SectionTitle>
      <Card style={{ gap: Spacing.two }}>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
          Coming from Strong or Hevy? Bring your workout history — it merges with your Kilo data.
        </Text>
        <Button
          title="Import from Strong / Hevy (CSV)"
          kind="secondary"
          onPress={() => router.push('/import-strong')}
          disabled={busy}
        />
      </Card>

      <View style={{ marginTop: Spacing.five, alignItems: 'center' }}>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          Kilo — free forever, local-first. No accounts, no servers.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  input: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16, borderWidth: StyleSheet.hairlineWidth },
});
