import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
// ponytail: legacy FS API — stable string read/write; migrate to the new File class if expo drops legacy
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useSQLiteContext } from 'expo-sqlite';

import { Button, Card, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { exportAll, importAll } from '@/db/queries';
import { useSettings } from '@/lib/settings-context';
import { Unit } from '@/lib/units';
import { todayStr } from '@/lib/dates';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const colors = useTheme();
  const { unit, setUnit, kcalTarget, setKcalTarget } = useSettings();
  const [targetText, setTargetText] = useState(kcalTarget ? String(kcalTarget) : '');
  const [busy, setBusy] = useState(false);

  const saveTarget = () => {
    const n = parseInt(targetText, 10);
    setKcalTarget(isNaN(n) || n <= 0 ? null : n);
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
    <ScrollView contentContainerStyle={{ padding: Spacing.three }}>
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

      <SectionTitle>Daily calorie target</SectionTitle>
      <Card style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'center' }}>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.background, flex: 1 }]}
          value={targetText}
          onChangeText={setTargetText}
          keyboardType="number-pad"
          placeholder="e.g. 2000 (empty = no target)"
          placeholderTextColor={colors.textSecondary}
        />
        <Button title="Save" onPress={saveTarget} />
      </Card>

      <SectionTitle>Backup</SectionTitle>
      <Card style={{ gap: Spacing.two }}>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
          Your data lives only on this phone. Export regularly — a lost phone is a lost history.
        </Text>
        <Button title="Export data (JSON)" onPress={onExport} disabled={busy} />
        <Button title="Restore from export" kind="secondary" onPress={onImport} disabled={busy} />
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
  input: { borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16 },
});
