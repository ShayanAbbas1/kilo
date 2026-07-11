import { SQLiteDatabase } from 'expo-sqlite';
import { newId } from '../lib/id';
import { nowIso, todayStr } from '../lib/dates';
import { Unit } from '../lib/units';
import { E1rmPoint, detectPlateau, stallContext } from '../lib/plateau';
import {
  SCHEMA_VERSION,
  BEST_WEIGHT_SQL,
  CALORIE_DAYS_SQL,
  EXERCISE_PROGRESSION_SQL,
  STALL_CANDIDATES_SQL,
  MUSCLE_EXERCISE_WEEKLY_SQL,
  MUSCLE_EXERCISES_SQL,
  MUSCLE_LAST_TRAINED_SQL,
  MUSCLE_SETS_SQL,
  MUSCLE_WEEKLY_SETS_SQL,
  PERIOD_SUMMARY_SQL,
  PREV_SETS_SQL,
  PR_HISTORY_SQL,
  RECENT_EXERCISES_SQL,
  TOP_EXERCISES_SQL,
  WEEKLY_KCAL_SQL,
  WEEKLY_TONNAGE_SQL,
  WEEKLY_WEIGHT_SQL,
  WEIGHT_TREND_SQL,
  WORKOUT_HISTORY_SQL,
  WORKOUT_HISTORY_DAY_SQL,
} from './sql';

// ---------- types ----------

export type Exercise = {
  id: string;
  name: string;
  category: string;
  equipment: string;
  primary_muscles: string; // JSON array string
  secondary_muscles: string;
  instructions: string;
  is_custom: number;
};

export type SetType = 'warmup' | 'working' | 'failure';

export type WorkoutSet = {
  id: string;
  workout_exercise_id: string;
  position: number;
  weight_kg: number | null;
  reps: number | null;
  set_type: SetType;
  completed: number;
  rpe: number | null;
};

export type WorkoutExerciseDetail = {
  id: string;
  exercise_id: string;
  name: string;
  position: number;
  notes: string | null;
  superset_with_next: number; // 1 = linked to the next exercise by position (superset)
  sets: WorkoutSet[];
  prev: PrevSet[];
  best_weight: number | null;
};

export type Workout = {
  id: string;
  started_at: string;
  finished_at: string | null;
  name: string | null;
  notes: string | null;
};

export type PrevSet = {
  position: number;
  weight_kg: number | null;
  reps: number | null;
  set_type: SetType;
};

export type HistoryRow = {
  id: string;
  name: string | null;
  started_at: string;
  finished_at: string;
  exercise_count: number;
  set_count: number;
  tonnage_kg: number;
};

export type WeightRow = { date: string; weight_kg: number; avg7: number };

export type CalorieDay = { date: string; kcal: number; protein_g: number | null; entries: number };

export type CalorieEntry = {
  id: string;
  date: string;
  label: string | null;
  kcal: number;
  protein_g: number | null;
};

// ---------- settings ----------

export async function getSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, value);
}

// ---------- exercises ----------

export async function searchExercises(
  db: SQLiteDatabase, query: string, muscle?: string, equipment?: string,
): Promise<Exercise[]> {
  const clauses = ['name LIKE ?'];
  const params: string[] = [`%${query.trim()}%`];
  if (muscle) { clauses.push('primary_muscles LIKE ?'); params.push(`%"${muscle}"%`); }
  if (equipment) { clauses.push('equipment = ?'); params.push(equipment); }
  return db.getAllAsync<Exercise>(
    `SELECT * FROM exercises WHERE ${clauses.join(' AND ')} ORDER BY is_custom DESC, name LIMIT 100`,
    ...params);
}

/** Distinct exercises by most recent use across any workout (active included). */
export async function getRecentExercises(db: SQLiteDatabase, limit = 8): Promise<Exercise[]> {
  return db.getAllAsync<Exercise>(RECENT_EXERCISES_SQL, limit);
}

export async function getExercise(db: SQLiteDatabase, id: string): Promise<Exercise | null> {
  return db.getFirstAsync<Exercise>('SELECT * FROM exercises WHERE id = ?', id);
}

export async function createCustomExercise(
  db: SQLiteDatabase, name: string, primaryMuscle: string, equipment: string,
): Promise<string> {
  const id = newId();
  await db.runAsync(
    `INSERT INTO exercises (id, name, category, equipment, primary_muscles, is_custom)
     VALUES (?, ?, 'strength', ?, ?, 1)`,
    id, name.trim(), equipment, JSON.stringify([primaryMuscle]));
  return id;
}

// ---------- workouts ----------

export async function getActiveWorkout(db: SQLiteDatabase): Promise<Workout | null> {
  return db.getFirstAsync<Workout>(
    'SELECT * FROM workouts WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1');
}

export async function startWorkout(db: SQLiteDatabase, name?: string): Promise<string> {
  const id = newId();
  await db.runAsync(
    'INSERT INTO workouts (id, started_at, name) VALUES (?, ?, ?)', id, nowIso(), name ?? null);
  return id;
}

export async function getWorkout(db: SQLiteDatabase, id: string): Promise<Workout | null> {
  return db.getFirstAsync<Workout>('SELECT * FROM workouts WHERE id = ?', id);
}

export async function getWorkoutExercises(
  db: SQLiteDatabase, workoutId: string,
): Promise<WorkoutExerciseDetail[]> {
  const rows = await db.getAllAsync<
    { id: string; exercise_id: string; name: string; position: number; notes: string | null;
      superset_with_next: number }
  >(
    `SELECT we.id, we.exercise_id, we.position, we.notes, we.superset_with_next, e.name
     FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id
     WHERE we.workout_id = ? ORDER BY we.position`, workoutId);
  const result: WorkoutExerciseDetail[] = [];
  for (const r of rows) {
    const sets = await db.getAllAsync<WorkoutSet>(
      'SELECT * FROM sets WHERE workout_exercise_id = ? ORDER BY position', r.id);
    const prev = await getPrevSets(db, r.exercise_id);
    const best = await getBestWeight(db, r.exercise_id);
    result.push({ ...r, sets, prev, best_weight: best });
  }
  return result;
}

export async function setWorkoutNotes(
  db: SQLiteDatabase, workoutId: string, notes: string,
): Promise<void> {
  await db.runAsync('UPDATE workouts SET notes = ? WHERE id = ?', notes.trim() || null, workoutId);
}

export async function setExerciseNotes(
  db: SQLiteDatabase, weId: string, notes: string,
): Promise<void> {
  await db.runAsync('UPDATE workout_exercises SET notes = ? WHERE id = ?', notes.trim() || null, weId);
}

export async function getPrevSets(db: SQLiteDatabase, exerciseId: string): Promise<PrevSet[]> {
  return db.getAllAsync<PrevSet>(PREV_SETS_SQL, exerciseId, exerciseId);
}

export async function addExerciseToWorkout(
  db: SQLiteDatabase, workoutId: string, exerciseId: string, minSets = 1,
): Promise<string> {
  const weId = newId();
  const pos = await db.getFirstAsync<{ p: number }>(
    'SELECT COALESCE(MAX(position), 0) + 1 AS p FROM workout_exercises WHERE workout_id = ?', workoutId);
  await db.runAsync(
    'INSERT INTO workout_exercises (id, workout_id, exercise_id, position) VALUES (?, ?, ?, ?)',
    weId, workoutId, exerciseId, pos?.p ?? 1);
  // start with as many empty sets as last session (falling back to minSets)
  const prev = await getPrevSets(db, exerciseId);
  const n = Math.max(minSets, prev.length, 1);
  for (let i = 1; i <= n; i++) {
    await db.runAsync(
      'INSERT INTO sets (id, workout_exercise_id, position, set_type) VALUES (?, ?, ?, ?)',
      newId(), weId, i, prev[i - 1]?.set_type ?? 'working');
  }
  return weId;
}

export async function setSupersetWithNext(
  db: SQLiteDatabase, weId: string, on: boolean,
): Promise<void> {
  await db.runAsync(
    'UPDATE workout_exercises SET superset_with_next = ? WHERE id = ?', on ? 1 : 0, weId);
}

export async function removeWorkoutExercise(db: SQLiteDatabase, weId: string): Promise<void> {
  // ponytail: deleting a mid-chain exercise leaves the prev exercise's flag pointing at
  // whatever is now next — acceptable, the chain just re-links. No special handling.
  await db.runAsync('DELETE FROM sets WHERE workout_exercise_id = ?', weId);
  await db.runAsync('DELETE FROM workout_exercises WHERE id = ?', weId);
}

export async function addSet(db: SQLiteDatabase, weId: string): Promise<void> {
  const pos = await db.getFirstAsync<{ p: number }>(
    'SELECT COALESCE(MAX(position), 0) + 1 AS p FROM sets WHERE workout_exercise_id = ?', weId);
  await db.runAsync(
    'INSERT INTO sets (id, workout_exercise_id, position, set_type) VALUES (?, ?, ?, ?)',
    newId(), weId, pos?.p ?? 1, 'working');
}

export async function updateSet(
  db: SQLiteDatabase, setId: string,
  fields: {
    weight_kg?: number | null; reps?: number | null; set_type?: SetType; completed?: boolean;
    rpe?: number | null;
  },
): Promise<void> {
  const cols: string[] = [];
  const vals: (string | number | null)[] = [];
  if ('weight_kg' in fields) { cols.push('weight_kg = ?'); vals.push(fields.weight_kg ?? null); }
  if ('reps' in fields) { cols.push('reps = ?'); vals.push(fields.reps ?? null); }
  if ('rpe' in fields) { cols.push('rpe = ?'); vals.push(fields.rpe ?? null); }
  if (fields.set_type) { cols.push('set_type = ?'); vals.push(fields.set_type); }
  if ('completed' in fields) {
    cols.push('completed = ?', 'completed_at = ?');
    vals.push(fields.completed ? 1 : 0, fields.completed ? nowIso() : null);
  }
  if (!cols.length) return;
  await db.runAsync(`UPDATE sets SET ${cols.join(', ')} WHERE id = ?`, ...vals, setId);
}

export async function deleteSet(db: SQLiteDatabase, setId: string): Promise<void> {
  await db.runAsync('DELETE FROM sets WHERE id = ?', setId);
}

const reopenStashKey = (workoutId: string) => `reopened_finished_at:${workoutId}`;

/**
 * Finish: drop incomplete sets and empty exercises; if nothing was completed,
 * delete the workout entirely. Returns true if the workout was kept.
 */
export async function finishWorkout(db: SQLiteDatabase, workoutId: string): Promise<boolean> {
  await db.runAsync(
    `DELETE FROM sets WHERE completed = 0 AND workout_exercise_id IN
     (SELECT id FROM workout_exercises WHERE workout_id = ?)`, workoutId);
  await db.runAsync(
    `DELETE FROM workout_exercises WHERE workout_id = ?
     AND id NOT IN (SELECT DISTINCT workout_exercise_id FROM sets)`, workoutId);
  const any = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM workout_exercises WHERE workout_id = ?`, workoutId);
  if (!any || any.n === 0) {
    await db.runAsync('DELETE FROM settings WHERE key = ?', reopenStashKey(workoutId));
    await db.runAsync('DELETE FROM workouts WHERE id = ?', workoutId);
    return false;
  }
  // ponytail: if this workout was reopened, restore its original finish time instead of
  // stamping "now" — editing a typo on an old session must not rewrite its date.
  const stashed = await getSetting(db, reopenStashKey(workoutId));
  await db.runAsync('UPDATE workouts SET finished_at = ? WHERE id = ?', stashed ?? nowIso(), workoutId);
  if (stashed) await db.runAsync('DELETE FROM settings WHERE key = ?', reopenStashKey(workoutId));
  return true;
}

/** Reopen a finished workout for editing — it becomes the active workout again. */
export async function reopenWorkout(db: SQLiteDatabase, workoutId: string): Promise<void> {
  // ponytail: stash the original finished_at so re-finishing restores it (see finishWorkout).
  const w = await db.getFirstAsync<{ finished_at: string | null }>(
    'SELECT finished_at FROM workouts WHERE id = ?', workoutId);
  if (w?.finished_at) await setSetting(db, reopenStashKey(workoutId), w.finished_at);
  await db.runAsync('UPDATE workouts SET finished_at = NULL WHERE id = ?', workoutId);
}

export async function discardWorkout(db: SQLiteDatabase, workoutId: string): Promise<void> {
  await db.runAsync(
    `DELETE FROM sets WHERE workout_exercise_id IN
     (SELECT id FROM workout_exercises WHERE workout_id = ?)`, workoutId);
  await db.runAsync('DELETE FROM workout_exercises WHERE workout_id = ?', workoutId);
  await db.runAsync('DELETE FROM settings WHERE key = ?', reopenStashKey(workoutId));
  await db.runAsync('DELETE FROM workouts WHERE id = ?', workoutId);
}

export async function deleteWorkout(db: SQLiteDatabase, workoutId: string): Promise<void> {
  await discardWorkout(db, workoutId);
}

export async function getHistory(db: SQLiteDatabase, limit = 100): Promise<HistoryRow[]> {
  return db.getAllAsync<HistoryRow>(WORKOUT_HISTORY_SQL, limit);
}

/** Finished workouts on one local calendar day (YYYY-MM-DD) — for the calendar tap-day list. */
export async function getHistoryForDay(db: SQLiteDatabase, day: string): Promise<HistoryRow[]> {
  return db.getAllAsync<HistoryRow>(WORKOUT_HISTORY_DAY_SQL, day);
}

export type WorkoutDay = { id: string; name: string | null; started_at: string };

export async function getWorkoutDates(db: SQLiteDatabase): Promise<WorkoutDay[]> {
  return db.getAllAsync<WorkoutDay>(
    'SELECT id, name, started_at FROM workouts WHERE finished_at IS NOT NULL ORDER BY started_at DESC');
}

// ---------- routines ----------

export type RoutineRow = {
  id: string;
  name: string;
  exercise_names: string;
  exercise_count: number;
};

export async function listRoutines(db: SQLiteDatabase): Promise<RoutineRow[]> {
  return db.getAllAsync<RoutineRow>(
    `SELECT r.id, r.name,
       GROUP_CONCAT(e.name, ', ') AS exercise_names,
       COUNT(re.id) AS exercise_count
     FROM routines r
     LEFT JOIN routine_exercises re ON re.routine_id = r.id
     LEFT JOIN exercises e ON e.id = re.exercise_id
     GROUP BY r.id
     ORDER BY r.position, r.name`);
}

export type RoutineExerciseRow = {
  id: string;
  exercise_id: string;
  name: string;
  position: number;
  target_sets: number;
  superset_with_next: number;
};

export async function createRoutine(db: SQLiteDatabase, name: string): Promise<string> {
  const id = newId();
  await db.runAsync('INSERT INTO routines (id, name, position) VALUES (?, ?, 0)', id, name.trim());
  return id;
}

export async function renameRoutine(db: SQLiteDatabase, id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return; // keep previous name, same guard style as setWorkoutNotes
  await db.runAsync('UPDATE routines SET name = ? WHERE id = ?', trimmed, id);
}

export async function getRoutine(
  db: SQLiteDatabase, id: string,
): Promise<{ id: string; name: string } | null> {
  return db.getFirstAsync<{ id: string; name: string }>(
    'SELECT id, name FROM routines WHERE id = ?', id);
}

export async function listRoutineExercises(
  db: SQLiteDatabase, routineId: string,
): Promise<RoutineExerciseRow[]> {
  return db.getAllAsync<RoutineExerciseRow>(
    `SELECT re.id, re.exercise_id, re.position, re.target_sets, re.superset_with_next, e.name
     FROM routine_exercises re JOIN exercises e ON e.id = re.exercise_id
     WHERE re.routine_id = ? ORDER BY re.position`, routineId);
}

export async function addRoutineExercise(
  db: SQLiteDatabase, routineId: string, exerciseId: string, targetSets = 3,
): Promise<void> {
  const pos = await db.getFirstAsync<{ p: number }>(
    'SELECT COALESCE(MAX(position), 0) + 1 AS p FROM routine_exercises WHERE routine_id = ?', routineId);
  await db.runAsync(
    'INSERT INTO routine_exercises (id, routine_id, exercise_id, position, target_sets) VALUES (?, ?, ?, ?, ?)',
    newId(), routineId, exerciseId, pos?.p ?? 1, targetSets);
}

export async function removeRoutineExercise(db: SQLiteDatabase, reId: string): Promise<void> {
  // ponytail: same as removeWorkoutExercise — deleting a mid-chain exercise leaves the
  // prev exercise's superset flag pointing at whatever is now next. Chain just re-links.
  await db.runAsync('DELETE FROM routine_exercises WHERE id = ?', reId);
}

export async function setRoutineTargetSets(
  db: SQLiteDatabase, reId: string, n: number,
): Promise<void> {
  await db.runAsync('UPDATE routine_exercises SET target_sets = ? WHERE id = ?', Math.max(1, n), reId);
}

/** Swap two rows' positions in one transaction — the ▲▼ reorder primitive, no drag-drop dep.
 * superset_with_next stays keyed to the row id, so a swap that splits a ⛓ pair just re-links
 * it to whichever exercise now follows — same simplest-correct behavior as workout reordering. */
export async function swapRoutineExercises(
  db: SQLiteDatabase, reIdA: string, reIdB: string,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    const a = await db.getFirstAsync<{ position: number }>(
      'SELECT position FROM routine_exercises WHERE id = ?', reIdA);
    const b = await db.getFirstAsync<{ position: number }>(
      'SELECT position FROM routine_exercises WHERE id = ?', reIdB);
    if (!a || !b) return;
    await db.runAsync('UPDATE routine_exercises SET position = ? WHERE id = ?', b.position, reIdA);
    await db.runAsync('UPDATE routine_exercises SET position = ? WHERE id = ?', a.position, reIdB);
  });
}

export async function createRoutineFromWorkout(
  db: SQLiteDatabase, workoutId: string, name: string,
): Promise<string> {
  const routineId = newId();
  const exercises = await db.getAllAsync<
    { exercise_id: string; position: number; n: number; superset_with_next: number }
  >(
    `SELECT we.exercise_id, we.position, we.superset_with_next,
       (SELECT COUNT(*) FROM sets s WHERE s.workout_exercise_id = we.id AND s.set_type != 'warmup') AS n
     FROM workout_exercises we WHERE we.workout_id = ? ORDER BY we.position`, workoutId);
  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT INTO routines (id, name) VALUES (?, ?)', routineId, name.trim());
    for (const ex of exercises) {
      await db.runAsync(
        `INSERT INTO routine_exercises (id, routine_id, exercise_id, position, target_sets, superset_with_next)
         VALUES (?, ?, ?, ?, ?, ?)`,
        newId(), routineId, ex.exercise_id, ex.position, Math.max(1, ex.n), ex.superset_with_next);
    }
  });
  return routineId;
}

export async function deleteRoutine(db: SQLiteDatabase, routineId: string): Promise<void> {
  await db.runAsync('DELETE FROM routine_exercises WHERE routine_id = ?', routineId);
  await db.runAsync('DELETE FROM routines WHERE id = ?', routineId);
}

export async function startWorkoutFromRoutine(
  db: SQLiteDatabase, routineId: string,
): Promise<string> {
  const routine = await db.getFirstAsync<{ name: string }>(
    'SELECT name FROM routines WHERE id = ?', routineId);
  const workoutId = await startWorkout(db, routine?.name);
  const exercises = await db.getAllAsync<
    { exercise_id: string; target_sets: number; superset_with_next: number }
  >(
    'SELECT exercise_id, target_sets, superset_with_next FROM routine_exercises WHERE routine_id = ? ORDER BY position',
    routineId);
  for (const ex of exercises) {
    const weId = await addExerciseToWorkout(db, workoutId, ex.exercise_id, ex.target_sets);
    if (ex.superset_with_next) await setSupersetWithNext(db, weId, true);
  }
  return workoutId;
}

// ---------- body: weight ----------

export async function upsertWeighIn(db: SQLiteDatabase, date: string, weightKg: number): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO weigh_ins (date, weight_kg) VALUES (?, ?)', date, weightKg);
}

export async function deleteWeighIn(db: SQLiteDatabase, date: string): Promise<void> {
  await db.runAsync('DELETE FROM weigh_ins WHERE date = ?', date);
}

export async function getWeightTrend(db: SQLiteDatabase, limit = 90): Promise<WeightRow[]> {
  return db.getAllAsync<WeightRow>(WEIGHT_TREND_SQL, limit);
}

// ---------- body: calories ----------

export async function addCalorieEntry(
  db: SQLiteDatabase, date: string, kcal: number, label?: string, proteinG?: number,
): Promise<void> {
  await db.runAsync(
    'INSERT INTO calorie_entries (id, date, label, kcal, protein_g) VALUES (?, ?, ?, ?, ?)',
    newId(), date, label ?? null, kcal, proteinG ?? null);
}

export async function deleteCalorieEntry(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM calorie_entries WHERE id = ?', id);
}

export async function getCalorieDays(db: SQLiteDatabase, limit = 60): Promise<CalorieDay[]> {
  return db.getAllAsync<CalorieDay>(CALORIE_DAYS_SQL, limit);
}

export async function getCalorieEntries(db: SQLiteDatabase, date: string): Promise<CalorieEntry[]> {
  return db.getAllAsync<CalorieEntry>(
    'SELECT * FROM calorie_entries WHERE date = ? ORDER BY rowid', date);
}

// ---------- analytics ----------

export type ProgressionRow = { day: string; top_weight: number; est1rm: number; volume: number };
export type MuscleSetsRow = { muscle: string; sets: number; tonnage: number };
export type TopExerciseRow = { id: string; name: string; sessions: number; best_weight: number | null };
export type PeriodSummary = { workouts: number; tonnage_kg: number };

export async function getExerciseProgression(
  db: SQLiteDatabase, exerciseId: string,
): Promise<ProgressionRow[]> {
  return db.getAllAsync<ProgressionRow>(EXERCISE_PROGRESSION_SQL, exerciseId);
}

export type StalledLift = { id: string; name: string; stalledSince: string; context: string | null };

/**
 * Every stalled lift with its cross-domain context sentence. Detection (pure,
 * tested in src/lib/plateau.ts) runs on each exercise's per-session e1RM series;
 * calorie + weigh-in windows are fetched once and shared across the annotations.
 * Sorted longest-stalled first.
 */
export async function getStalledLifts(
  db: SQLiteDatabase, kcalTarget: number | null, unit: Unit,
): Promise<StalledLift[]> {
  const since = todayStr(new Date(Date.now() - 90 * 86400000));
  const rows = await db.getAllAsync<{ id: string; name: string; day: string; est1rm: number }>(
    STALL_CANDIDATES_SQL, since);

  const byId = new Map<string, { name: string; points: E1rmPoint[] }>();
  for (const r of rows) {
    let g = byId.get(r.id);
    if (!g) { g = { name: r.name, points: [] }; byId.set(r.id, g); }
    g.points.push({ date: r.day, e1rm: r.est1rm });
  }

  const stalled: { id: string; name: string; stalledSince: string }[] = [];
  byId.forEach((g, id) => {
    const p = detectPlateau(g.points);
    if (p) stalled.push({ id, name: g.name, stalledSince: p.stalledSince });
  });
  if (stalled.length === 0) return [];

  const calorieDays = await db.getAllAsync<{ date: string; kcal: number }>(
    'SELECT date, SUM(kcal) AS kcal FROM calorie_entries GROUP BY date');
  const weighIns = await db.getAllAsync<{ date: string; weight_kg: number }>(
    'SELECT date, weight_kg FROM weigh_ins ORDER BY date');

  return stalled
    .map((s) => ({
      ...s,
      context: stallContext({
        stalledSince: s.stalledSince, unit, kcalTarget, calorieDays, weighIns,
      }),
    }))
    .sort((a, b) => a.stalledSince.localeCompare(b.stalledSince));
}

export async function getMuscleSets(db: SQLiteDatabase, sinceIso: string): Promise<MuscleSetsRow[]> {
  return db.getAllAsync<MuscleSetsRow>(MUSCLE_SETS_SQL, sinceIso);
}

export async function getTopExercises(db: SQLiteDatabase, limit = 10): Promise<TopExerciseRow[]> {
  return db.getAllAsync<TopExerciseRow>(TOP_EXERCISES_SQL, limit);
}

export async function getPeriodSummary(db: SQLiteDatabase, sinceIso: string): Promise<PeriodSummary> {
  const row = await db.getFirstAsync<PeriodSummary>(PERIOD_SUMMARY_SQL, sinceIso);
  return row ?? { workouts: 0, tonnage_kg: 0 };
}

export type WeeklyTrend = {
  weeks: string[]; // '%Y-%W' keys, ascending
  weight: (number | null)[];
  tonnage: (number | null)[];
  kcal: (number | null)[];
};

/** Join the three weekly series on the union of their week keys. */
export async function getWeeklyTrend(db: SQLiteDatabase, sinceDate: string): Promise<WeeklyTrend> {
  type Row = { wk: string; value: number };
  const [w, t, k] = await Promise.all([
    db.getAllAsync<Row>(WEEKLY_WEIGHT_SQL, sinceDate),
    db.getAllAsync<Row>(WEEKLY_TONNAGE_SQL, sinceDate),
    db.getAllAsync<Row>(WEEKLY_KCAL_SQL, sinceDate),
  ]);
  const weeks = [...new Set([...w, ...t, ...k].map((r) => r.wk))].sort();
  const series = (rows: Row[]) => {
    const m = new Map(rows.map((r) => [r.wk, r.value]));
    return weeks.map((wk) => m.get(wk) ?? null);
  };
  return { weeks, weight: series(w), tonnage: series(t), kcal: series(k) };
}

export type MuscleWeekRow = { wk: string; sets: number; tonnage: number };
export type MuscleExerciseRow = { id: string; name: string; sets: number };

export async function getMuscleWeeklySets(
  db: SQLiteDatabase, muscles: string[], sinceDate: string,
): Promise<MuscleWeekRow[]> {
  return db.getAllAsync<MuscleWeekRow>(MUSCLE_WEEKLY_SETS_SQL, sinceDate, JSON.stringify(muscles));
}

export async function getMuscleExercises(
  db: SQLiteDatabase, muscles: string[], sinceDate: string,
): Promise<MuscleExerciseRow[]> {
  return db.getAllAsync<MuscleExerciseRow>(MUSCLE_EXERCISES_SQL, sinceDate, JSON.stringify(muscles));
}

export type MuscleExerciseWeeklyRow = {
  wk: string; exercise_name: string; primary_muscles: string; sets: number;
};

export async function getMuscleExerciseWeekly(
  db: SQLiteDatabase, muscles: string[], sinceDate: string,
): Promise<MuscleExerciseWeeklyRow[]> {
  return db.getAllAsync<MuscleExerciseWeeklyRow>(
    MUSCLE_EXERCISE_WEEKLY_SQL, sinceDate, JSON.stringify(muscles));
}

export type MuscleLastTrained = { muscle: string; last_trained: string };

/** Last local day each muscle group was trained, all-time — weekly report staleness check. */
export async function getMuscleLastTrained(db: SQLiteDatabase): Promise<MuscleLastTrained[]> {
  return db.getAllAsync<MuscleLastTrained>(MUSCLE_LAST_TRAINED_SQL);
}

export async function getBestWeight(db: SQLiteDatabase, exerciseId: string): Promise<number | null> {
  const row = await db.getFirstAsync<{ best: number | null }>(BEST_WEIGHT_SQL, exerciseId);
  return row?.best ?? null;
}

export type PrRow = {
  started_at: string;
  exercise_id: string;
  exercise_name: string;
  weight_kg: number;
  reps: number;
};

export async function getPrHistory(db: SQLiteDatabase, limit = 20): Promise<PrRow[]> {
  return db.getAllAsync<PrRow>(PR_HISTORY_SQL, limit);
}

// ---------- export / import ----------

const EXPORT_TABLES = [
  'exercises', 'workouts', 'workout_exercises', 'sets',
  'routines', 'routine_exercises', 'weigh_ins', 'calorie_entries', 'settings',
] as const;

export async function exportAll(db: SQLiteDatabase): Promise<string> {
  const out: Record<string, unknown> = { app: 'kilo', exported_at: nowIso(), schema_version: SCHEMA_VERSION };
  for (const t of EXPORT_TABLES) {
    out[t] = await db.getAllAsync(`SELECT * FROM ${t}`);
  }
  return JSON.stringify(out);
}

export async function listExerciseRefs(db: SQLiteDatabase): Promise<{ id: string; name: string }[]> {
  return db.getAllAsync<{ id: string; name: string }>('SELECT id, name FROM exercises');
}

/** Which of these workout ids already exist (i.e. were imported before). */
export async function getExistingWorkoutIds(db: SQLiteDatabase, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM workouts WHERE id IN (${ids.map(() => '?').join(',')})`, ...ids);
  return new Set(rows.map((r) => r.id));
}

/**
 * Insert a Strong import plan (src/lib/strong-import.ts). Additive only — existing
 * data is never touched: a workout whose deterministic id already exists (a prior
 * import of the same file) is skipped whole, children included.
 */
export async function importStrongWorkouts(
  db: SQLiteDatabase,
  plan: { workouts: Record<string, string | number | null>[];
    workout_exercises: Record<string, string | number | null>[];
    sets: Record<string, string | number | null>[] },
): Promise<{ imported: number; skipped: number }> {
  const insert = (table: string, row: Record<string, string | number | null>) => {
    const keys = Object.keys(row);
    return db.runAsync(
      `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
      ...keys.map((k) => row[k]));
  };
  let imported = 0;
  let skipped = 0;
  await db.withTransactionAsync(async () => {
    for (const w of plan.workouts) {
      const exists = await db.getFirstAsync('SELECT 1 FROM workouts WHERE id = ?', String(w.id));
      if (exists) { skipped++; continue; }
      await insert('workouts', w);
      for (const we of plan.workout_exercises) {
        if (we.workout_id === w.id) await insert('workout_exercises', we);
      }
      for (const s of plan.sets) {
        if (String(s.workout_exercise_id).startsWith(`${w.id}_`)) await insert('sets', s);
      }
      imported++;
    }
  });
  return { imported, skipped };
}

/** Restore from a Kilo export. Replaces all current data. */
export async function importAll(db: SQLiteDatabase, json: string): Promise<void> {
  const data = JSON.parse(json);
  if (data.app !== 'kilo') throw new Error('Not a Kilo export file');
  await db.withTransactionAsync(async () => {
    for (const t of [...EXPORT_TABLES].reverse()) {
      await db.runAsync(`DELETE FROM ${t}`);
    }
    for (const t of EXPORT_TABLES) {
      const rows = (data[t] ?? []) as Record<string, string | number | null>[];
      for (const row of rows) {
        const keys = Object.keys(row);
        await db.runAsync(
          `INSERT INTO ${t} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
          ...keys.map((k) => row[k]));
      }
    }
  });
}
