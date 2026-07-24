import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Text } from '@/components/text';
import { Button } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getExercise, updateCustomExercise } from '@/db/queries';
import { Chip, MUSCLES, EQUIPMENT } from '@/app/exercise-picker';
import { toast } from '@/lib/toast';

export default function EditExercise() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const colors = useTheme();
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState(MUSCLES[0]);
  const [equipment, setEquipment] = useState(EQUIPMENT[0]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getExercise(db, id).then((e) => {
      if (!e || !e.is_custom) { router.back(); return; }
      setName(e.name);
      try { setMuscle((JSON.parse(e.primary_muscles) as string[])[0] ?? MUSCLES[0]); } catch { /* keep default */ }
      setEquipment(e.equipment);
      setLoaded(true);
    });
  }, [db, id]);

  const save = async () => {
    if (!name.trim()) { toast('Name can’t be empty'); return; }
    await updateCustomExercise(db, id, name, muscle, equipment);
    toast('Exercise updated');
    router.back();
  };

  if (!loaded) return null;

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.three, gap: Spacing.three }}>
      <Text style={{ color: colors.textSecondary }}>Name</Text>
      <TextInput
        style={[styles.input, {
          color: colors.text, backgroundColor: colors.backgroundElement, borderColor: colors.border,
        }]}
        value={name}
        onChangeText={setName}
        placeholder="Exercise name"
        placeholderTextColor={colors.textSecondary}
      />

      <Text style={{ color: colors.textSecondary }}>Primary muscle</Text>
      <View style={styles.chips}>
        {MUSCLES.map((m) => (
          <Chip key={m} label={m} selected={m === muscle} onPress={() => setMuscle(m)} />
        ))}
      </View>

      <Text style={{ color: colors.textSecondary }}>Equipment</Text>
      <View style={styles.chips}>
        {EQUIPMENT.map((eq) => (
          <Chip key={eq} label={eq} selected={eq === equipment} onPress={() => setEquipment(eq)} />
        ))}
      </View>

      <Button title="Save" onPress={save} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth, fontFamily: 'SpaceGrotesk_400Regular',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
