import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/lib/settings-context';
import { platesPerSide } from '@/lib/plates';

export default function PlatesScreen() {
  const { w } = useLocalSearchParams<{ w?: string }>();
  const colors = useTheme();
  const { unit } = useSettings();
  const [text, setText] = useState(w ?? '');

  const target = parseFloat(text.replace(',', '.'));
  const { bar, plates, remainder } = useMemo(
    () => (isNaN(target) ? { bar: 0, plates: [], remainder: 0 } : platesPerSide(target, unit)),
    [target, unit],
  );

  // group plates by size into counts, largest first (plates array is already largest-first)
  const groups: { size: number; count: number }[] = [];
  for (const p of plates) {
    const last = groups[groups.length - 1];
    if (last && last.size === p) last.count++;
    else groups.push({ size: p, count: 1 });
  }

  return (
    <View style={{ flex: 1, padding: Spacing.three, gap: Spacing.three }}>
      <TextInput
        style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundElement }]}
        value={text}
        onChangeText={setText}
        keyboardType="decimal-pad"
        placeholder={`Target weight (${unit})`}
        placeholderTextColor={colors.textSecondary}
        autoFocus
      />

      <Card style={{ gap: Spacing.two }}>
        <Text style={{ color: colors.textSecondary }}>Bar {bar} {unit}</Text>
        {!isNaN(target) && plates.length === 0 && (
          <Text style={{ color: colors.text }}>Nothing to load — bar only.</Text>
        )}
        {groups.map((g) => (
          <Text key={g.size} style={{ color: colors.text, fontSize: 18, fontWeight: '600' }}>
            {g.size} × {g.count}
          </Text>
        ))}
        {remainder > 0 && (
          <Text style={{ color: colors.danger }}>
            {remainder} {unit} per side not loadable
          </Text>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  input: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, fontSize: 18 },
});
