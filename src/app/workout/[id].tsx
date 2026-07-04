import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';

import { Button, Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  PrevSet, SetType, WorkoutExerciseDetail,
  addSet, deleteSet, discardWorkout, finishWorkout, getSetting, getWorkout,
  getWorkoutExercises, removeWorkoutExercise, setExerciseNotes, setSupersetWithNext,
  setWorkoutNotes, updateSet,
} from '@/db/queries';
import { cancelRestDone, scheduleRestDone } from '@/lib/rest-notification';
import { useSettings } from '@/lib/settings-context';
import { formatWeight, fromDisplayWeight, weightLabel } from '@/lib/units';

type VMSet = {
  id: string;
  set_type: SetType;
  completed: boolean;
  weightText: string;
  repsText: string;
  rpeText: string;
  pr?: boolean;
};

type VMExercise = {
  weId: string;
  exerciseId: string;
  name: string;
  notes: string;
  supersetWithNext: boolean; // linked to the next exercise (superset)
  prev: PrevSet[];
  bestWeight: number | null;
  sets: VMSet[];
};

const NEXT_TYPE: Record<SetType, SetType> = { working: 'warmup', warmup: 'failure', failure: 'working' };

export default function ActiveWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const colors = useTheme();
  const { unit, showRpe } = useSettings();
  const [exercises, setExercises] = useState<VMExercise[]>([]);
  const [restSec, setRestSec] = useState(120);
  const [elapsedMin, setElapsedMin] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);

  const [notes, setNotes] = useState('');
  // which weight input is focused — drives the plate-increment bar above the keyboard
  const [weightFocus, setWeightFocus] = useState<{ weId: string; setId: string } | null>(null);

  useEffect(() => {
    getWorkout(db, id).then((w) => {
      setStartedAt(w?.started_at ?? null);
      setNotes(w?.notes ?? '');
    });
  }, [db, id]);

  // minute-granularity elapsed clock in the header
  useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();
    const iv = setInterval(() => {
      const next = Math.floor((Date.now() - start) / 60000);
      setElapsedMin(next); // same-value updates bail out, no re-render
    }, 5000);
    return () => clearInterval(iv);
  }, [startedAt]);
  // ponytail: decrementing-seconds timer, not wall-clock — drifts ~ms/tick, irrelevant for rest
  const [restLeft, setRestLeft] = useState<number | null>(null);
  // background notification for when rest ends while the app is backgrounded/locked;
  // suppressed by the foreground handler, so no extra handling needed when it fires in-app
  const restNotifId = useRef<string | null>(null);
  const rearmRestNotif = useCallback((seconds: number) => {
    cancelRestDone(restNotifId.current);
    restNotifId.current = null;
    scheduleRestDone(seconds).then((notifId) => { restNotifId.current = notifId; });
  }, []);
  const clearRestNotif = useCallback(() => {
    cancelRestDone(restNotifId.current);
    restNotifId.current = null;
  }, []);
  // cancel any pending rest notification on unmount (e.g. back-swipe out of the workout).
  // clearRestNotif is stable ([] deps), so this runs cleanup only on unmount, not re-renders;
  // Finish/Discard already clear it and a double-clear is a harmless no-op.
  useEffect(() => clearRestNotif, [clearRestNotif]);

  useEffect(() => {
    getSetting(db, 'rest_seconds').then((v) => {
      const n = v ? parseInt(v, 10) : NaN;
      if (!isNaN(n) && n > 0) setRestSec(n);
    });
  }, [db]);

  useEffect(() => {
    if (restLeft == null) return;
    const t = setTimeout(() => setRestLeft((l) => (l == null || l <= 1 ? null : l - 1)), 1000);
    return () => clearTimeout(t);
  }, [restLeft]);

  const toVM = useCallback(
    (rows: WorkoutExerciseDetail[]): VMExercise[] =>
      rows.map((r) => ({
        weId: r.id,
        exerciseId: r.exercise_id,
        name: r.name,
        notes: r.notes ?? '',
        supersetWithNext: !!r.superset_with_next,
        prev: r.prev,
        bestWeight: r.best_weight,
        sets: r.sets.map((s) => ({
          id: s.id,
          set_type: s.set_type,
          completed: !!s.completed,
          weightText: s.weight_kg == null ? '' : formatWeight(s.weight_kg, unit),
          repsText: s.reps == null ? '' : String(s.reps),
          rpeText: s.rpe == null ? '' : String(s.rpe),
        })),
      })),
    [unit],
  );

  const reload = useCallback(() => {
    getWorkoutExercises(db, id).then((rows) => setExercises(toVM(rows)));
  }, [db, id, toVM]);

  useFocusEffect(reload);

  const patchSet = (weId: string, setId: string, patch: Partial<VMSet>) => {
    setExercises((prev) =>
      prev.map((e) =>
        e.weId === weId
          ? { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }
          : e,
      ),
    );
  };

  const onWeightChange = (weId: string, setId: string, text: string) => {
    patchSet(weId, setId, { weightText: text });
    const n = parseFloat(text.replace(',', '.'));
    updateSet(db, setId, { weight_kg: isNaN(n) ? null : fromDisplayWeight(n, unit) });
  };

  const onRepsChange = (weId: string, setId: string, text: string) => {
    patchSet(weId, setId, { repsText: text });
    const n = parseInt(text, 10);
    updateSet(db, setId, { reps: isNaN(n) ? null : n });
  };

  const onRpeChange = (weId: string, setId: string, text: string) => {
    patchSet(weId, setId, { rpeText: text });
    const n = parseFloat(text.replace(',', '.'));
    updateSet(db, setId, { rpe: isNaN(n) ? null : Math.min(10, Math.max(0, n)) });
  };

  const patchExercise = (weId: string, patch: Partial<VMExercise>) => {
    setExercises((prev) => prev.map((e) => (e.weId === weId ? { ...e, ...patch } : e)));
  };

  const onNotesChange = (weId: string, text: string) => {
    patchExercise(weId, { notes: text });
    setExerciseNotes(db, weId, text);
  };

  const onToggleSuperset = (ex: VMExercise) => {
    const on = !ex.supersetWithNext;
    patchExercise(ex.weId, { supersetWithNext: on });
    setSupersetWithNext(db, ex.weId, on);
  };

  const onToggleComplete = (ex: VMExercise, s: VMSet, idx: number) => {
    if (!s.completed) {
      // adopt ghost values if user typed nothing (Strong behavior)
      const ghost = ex.prev[idx];
      let { weightText, repsText } = s;
      if (!weightText && ghost?.weight_kg != null) {
        weightText = formatWeight(ghost.weight_kg, unit);
        updateSet(db, s.id, { weight_kg: ghost.weight_kg });
      }
      if (!repsText && ghost?.reps != null) {
        repsText = String(ghost.reps);
        updateSet(db, s.id, { reps: ghost.reps });
      }
      // PR check: beat the all-time best working weight for this exercise
      const kgNow = fromDisplayWeight(parseFloat(weightText.replace(',', '.')), unit);
      const isPr =
        s.set_type !== 'warmup' &&
        ex.bestWeight != null && !isNaN(kgNow) && kgNow > ex.bestWeight;
      patchSet(ex.weId, s.id, { completed: true, weightText, repsText, pr: isPr });
      // raise the in-memory best so a later set in the same session doesn't re-fire the 🏆
      if (isPr) patchExercise(ex.weId, { bestWeight: kgNow });
      updateSet(db, s.id, { completed: true });
      // supersets: no rest mid-chain — go straight to the paired exercise (Strong behavior)
      if (!ex.supersetWithNext) {
        setRestLeft(restSec);
        rearmRestNotif(restSec);
      }
      if (isPr) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      patchSet(ex.weId, s.id, { completed: false });
      updateSet(db, s.id, { completed: false });
    }
  };

  const onCycleType = (ex: VMExercise, s: VMSet) => {
    const t = NEXT_TYPE[s.set_type];
    patchSet(ex.weId, s.id, { set_type: t });
    updateSet(db, s.id, { set_type: t });
  };

  const onDeleteSet = (s: VMSet) => {
    Alert.alert('Delete set?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSet(db, s.id).then(reload) },
    ]);
  };

  const onRemoveExercise = (ex: VMExercise) => {
    Alert.alert(`Remove ${ex.name}?`, 'All its sets in this workout will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: () => removeWorkoutExercise(db, ex.weId).then(reload),
      },
    ]);
  };

  const onFinish = () => {
    Alert.alert('Finish workout?', 'Incomplete sets will be discarded.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        onPress: async () => {
          clearRestNotif();
          const kept = await finishWorkout(db, id);
          if (kept) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          else Alert.alert('Nothing logged', 'Empty workout was discarded.');
          router.dismissTo('/(tabs)');
        },
      },
    ]);
  };

  const onDiscard = () => {
    Alert.alert('Discard workout?', 'This deletes the whole workout.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard', style: 'destructive',
        onPress: async () => {
          clearRestNotif();
          await discardWorkout(db, id);
          router.dismissTo('/(tabs)');
        },
      },
    ]);
  };

  const openPlates = (ex: VMExercise) => {
    const lastWeighted = [...ex.sets].reverse().find((s) => s.weightText);
    const w = lastWeighted?.weightText
      ?? (ex.prev[0]?.weight_kg != null ? formatWeight(ex.prev[0].weight_kg, unit) : undefined);
    router.push({ pathname: '/plates', params: w ? { w } : {} });
  };

  // plate-sensible step in display units
  const weightStep = unit === 'kg' ? 2.5 : 5;

  const bumpWeight = (delta: number) => {
    if (!weightFocus) return;
    const ex = exercises.find((e) => e.weId === weightFocus.weId);
    const idx = ex?.sets.findIndex((x) => x.id === weightFocus.setId) ?? -1;
    if (!ex || idx < 0) return;
    const s = ex.sets[idx];
    const ghost = ex.prev[idx];
    const base = parseFloat(s.weightText.replace(',', '.'));
    const cur = !isNaN(base) ? base
      : ghost?.weight_kg != null ? parseFloat(formatWeight(ghost.weight_kg, unit)) : 0;
    const next = Math.max(0, Math.round((cur + delta) * 100) / 100);
    onWeightChange(weightFocus.weId, weightFocus.setId, String(next));
  };

  // label: warmup 'W', failure 'F', working sets numbered 1..n
  const setLabel = (sets: VMSet[], idx: number): string => {
    const s = sets[idx];
    if (s.set_type === 'warmup') return 'W';
    if (s.set_type === 'failure') return 'F';
    let n = 0;
    for (let i = 0; i <= idx; i++) if (sets[i].set_type !== 'warmup') n++;
    return String(n);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: elapsedMin != null && elapsedMin > 0 ? `Workout · ${elapsedMin}m` : 'Workout',
          headerRight: () => (
            <Pressable onPress={onFinish} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
              <Text style={{ color: colors.tint, fontSize: 17, fontWeight: '600' }}>Finish</Text>
            </Pressable>
          ),
        }}
      />
      {restLeft != null && (
        <View style={[styles.restBar, { backgroundColor: colors.backgroundElement }]}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
            Rest {fmtCountdown(restLeft)}
          </Text>
          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            <Pressable
              onPress={() => { setRestLeft((l) => (l ?? 0) + 15); rearmRestNotif((restLeft ?? 0) + 15); }}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
              <Text style={{ color: colors.tint, fontWeight: '600' }}>+15s</Text>
            </Pressable>
            <Pressable
              onPress={() => { setRestLeft(null); clearRestNotif(); }}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Skip</Text>
            </Pressable>
          </View>
        </View>
      )}
      <ScrollView
        contentContainerStyle={{ padding: Spacing.three, gap: Spacing.three }}
        keyboardShouldPersistTaps="handled">
        {exercises.map((ex, i) => {
          const inChain = ex.supersetWithNext || !!exercises[i - 1]?.supersetWithNext;
          const isLast = i === exercises.length - 1;
          return (
          <Card
            key={ex.weId}
            style={{
              gap: Spacing.two,
              ...(inChain && { borderLeftWidth: 3, borderLeftColor: colors.tint }),
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Pressable
                style={({ pressed }) => [{ flex: 1 }, { opacity: pressed ? 0.5 : 1 }]}
                onPress={() => router.push(`/exercise/${ex.exerciseId}`)}
                onLongPress={() => onRemoveExercise(ex)}>
                <Text style={{ color: colors.tint, fontSize: 17, fontWeight: '600' }}>
                  {ex.name} <Text style={{ fontSize: 12 }}>📈</Text>
                </Text>
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
                {!isLast && (
                  <Pressable
                    onPress={() => onToggleSuperset(ex)}
                    hitSlop={8}
                    style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                    <Text style={{ fontSize: 18, color: ex.supersetWithNext ? colors.tint : colors.textSecondary }}>⛓</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => openPlates(ex)}
                  hitSlop={8}
                  style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                  <Text style={{ fontSize: 18, color: colors.textSecondary }}>⚖</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.headerRow}>
              <Text style={[styles.colSet, styles.colHead, { color: colors.textSecondary }]}>SET</Text>
              <Text style={[styles.colPrev, styles.colHead, { color: colors.textSecondary }]}>PREVIOUS</Text>
              <Text style={[styles.colInput, styles.colHead, { color: colors.textSecondary }]}>{unit.toUpperCase()}</Text>
              <Text style={[styles.colInput, styles.colHead, { color: colors.textSecondary }]}>REPS</Text>
              {showRpe && (
                <Text style={[styles.colRpe, styles.colHead, { color: colors.textSecondary }]}>RPE</Text>
              )}
              <Text style={[styles.colCheck, styles.colHead, { color: colors.textSecondary }]}>✓</Text>
            </View>
            {ex.sets.map((s, idx) => {
              const ghost = ex.prev[idx];
              return (
                  <View
                    key={s.id}
                    style={[
                      styles.setRow,
                      s.completed && { backgroundColor: colors.successBg, borderRadius: 8 },
                    ]}>
                    {/* long-press to delete lives on the set label only — inside the
                        weight/reps inputs it would clash with text selection */}
                    <Pressable
                      style={({ pressed }) => [styles.colSet, { opacity: pressed ? 0.5 : 1 }]}
                      onPress={() => onCycleType(ex, s)}
                      onLongPress={() => onDeleteSet(s)}
                      hitSlop={8}>
                      <Text style={{
                        color: s.set_type === 'failure' ? colors.danger
                          : s.set_type === 'warmup' ? colors.textSecondary : colors.text,
                        fontWeight: '600', textAlign: 'center',
                      }}>
                        {setLabel(ex.sets, idx)}
                      </Text>
                    </Pressable>
                    <Text
                      style={[styles.colPrev, { color: colors.textSecondary, fontVariant: ['tabular-nums'] }]}
                      numberOfLines={1}>
                      {ghost && ghost.weight_kg != null
                        ? `${weightLabel(ghost.weight_kg, unit)} × ${ghost.reps ?? '—'}`
                        : '—'}
                    </Text>
                    <TextInput
                      style={[styles.colInput, styles.input, { color: colors.text, backgroundColor: colors.background }]}
                      value={s.weightText}
                      onChangeText={(t) => onWeightChange(ex.weId, s.id, t)}
                      onFocus={() => setWeightFocus({ weId: ex.weId, setId: s.id })}
                      onBlur={() => setWeightFocus(null)}
                      keyboardType="decimal-pad"
                      placeholder={ghost?.weight_kg != null ? formatWeight(ghost.weight_kg, unit) : ''}
                      placeholderTextColor={colors.textSecondary}
                      selectTextOnFocus
                    />
                    <TextInput
                      style={[styles.colInput, styles.input, { color: colors.text, backgroundColor: colors.background }]}
                      value={s.repsText}
                      onChangeText={(t) => onRepsChange(ex.weId, s.id, t)}
                      keyboardType="number-pad"
                      placeholder={ghost?.reps != null ? String(ghost.reps) : ''}
                      placeholderTextColor={colors.textSecondary}
                      selectTextOnFocus
                    />
                    {showRpe && (
                      <TextInput
                        style={[styles.colRpe, styles.input, { color: colors.text, backgroundColor: colors.background }]}
                        value={s.rpeText}
                        onChangeText={(t) => onRpeChange(ex.weId, s.id, t)}
                        keyboardType="decimal-pad"
                        placeholder="-"
                        placeholderTextColor={colors.textSecondary}
                        selectTextOnFocus
                      />
                    )}
                    <Pressable
                      style={({ pressed }) => [styles.colCheck, { opacity: pressed ? 0.5 : 1 }]}
                      onPress={() => onToggleComplete(ex, s, idx)}
                      hitSlop={8}>
                      <Text style={{
                        fontSize: 18, textAlign: 'center',
                        color: s.completed ? colors.success : colors.textSecondary,
                      }}>
                        {s.completed ? (s.pr ? '🏆' : '✔') : '○'}
                      </Text>
                    </Pressable>
                  </View>
              );
            })}
            <Button
              title="+ Add Set"
              kind="secondary"
              style={{ backgroundColor: colors.backgroundSelected, paddingVertical: 8 }}
              onPress={() => addSet(db, ex.weId).then(reload)}
            />
            <TextInput
              style={{
                borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, fontSize: 13, minHeight: 32,
                color: colors.textSecondary, backgroundColor: colors.background,
              }}
              value={ex.notes}
              onChangeText={(t) => onNotesChange(ex.weId, t)}
              placeholder="Exercise notes…"
              placeholderTextColor={colors.textSecondary}
              multiline
            />
          </Card>
          );
        })}

        <Button
          title="+ Add Exercise"
          onPress={() => router.push({ pathname: '/exercise-picker', params: { workoutId: id } })}
        />
        <TextInput
          style={{
            borderRadius: 10, padding: Spacing.three, fontSize: 15, minHeight: 44,
            color: colors.text, backgroundColor: colors.backgroundElement,
          }}
          value={notes}
          onChangeText={(t) => { setNotes(t); setWorkoutNotes(db, id, t); }}
          placeholder="Workout notes…"
          placeholderTextColor={colors.textSecondary}
          multiline
        />
        <Button title="Discard Workout" kind="danger" onPress={onDiscard} />
      </ScrollView>
      {weightFocus != null && (
        <View style={[styles.stepBar, { backgroundColor: colors.backgroundElement }]}>
          {[-weightStep, weightStep].map((d) => (
            <Pressable
              key={d}
              onPress={() => bumpWeight(d)}
              hitSlop={8}
              style={[styles.stepBtn, { backgroundColor: colors.backgroundSelected }]}>
              <Text style={{ color: colors.tint, fontSize: 16, fontWeight: '700' }}>
                {d > 0 ? '+' : '−'}{Math.abs(d)} {unit}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function fmtCountdown(totalSec: number): string {
  const s = Math.max(0, totalSec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  restBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: Spacing.three,
  },
  setRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    paddingVertical: 4,
  },
  stepBar: {
    flexDirection: 'row', gap: Spacing.two,
    paddingVertical: 8, paddingHorizontal: Spacing.three,
  },
  stepBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  colHead: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  colSet: { width: 32 },
  colPrev: { flex: 1.2, fontSize: 13, textAlign: 'center' },
  colInput: { flex: 1 },
  colRpe: { flex: 0.7 },
  colCheck: { width: 32 },
  input: {
    borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8,
    fontSize: 16, fontWeight: '600', textAlign: 'center', fontVariant: ['tabular-nums'],
  },
});
