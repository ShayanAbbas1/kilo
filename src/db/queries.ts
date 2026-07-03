import { SQLiteDatabase } from 'expo-sqlite';
import { newId } from '../lib/id';
import { nowIso } from '../lib/dates';
import {
  CALORIE_DAYS_SQL,
  PREV_SETS_SQL,
  WEIGHT_TREND_SQL,
  WORKOUT_HISTORY_SQL,
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
};

export type WorkoutExerciseDetail = {
  id: string;
  exercise_id: string;
  name: string;
  position: number;
  sets: WorkoutSet[];
  prev: PrevSet[];
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

export async function searchExercises(db: SQLiteDatabase, query: string): Promise<Exercise[]> {
  const q = `%${query.trim()}%`;
  return db.getAllAsync<Exercise>(
    `SELECT * FROM exercises WHERE name LIKE ? ORDER BY is_custom DESC, name LIMIT 100`, q);
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
  const rows = await db.getAllAsync<{ id: string; exercise_id: string; name: string; position: number }>(
    `SELECT we.id, we.exercise_id, we.position, e.name
     FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id
     WHERE we.workout_id = ? ORDER BY we.position`, workoutId);
  const result: WorkoutExerciseDetail[] = [];
  for (const r of rows) {
    const sets = await db.getAllAsync<WorkoutSet>(
      'SELECT * FROM sets WHERE workout_exercise_id = ? ORDER BY position', r.id);
    const prev = await getPrevSets(db, r.exercise_id);
    result.push({ ...r, sets, prev });
  }
  return result;
}

export async function getPrevSets(db: SQLiteDatabase, exerciseId: string): Promise<PrevSet[]> {
  return db.getAllAsync<PrevSet>(PREV_SETS_SQL, exerciseId, exerciseId);
}

export async function addExerciseToWorkout(
  db: SQLiteDatabase, workoutId: string, exerciseId: string,
): Promise<string> {
  const weId = newId();
  const pos = await db.getFirstAsync<{ p: number }>(
    'SELECT COALESCE(MAX(position), 0) + 1 AS p FROM workout_exercises WHERE workout_id = ?', workoutId);
  await db.runAsync(
    'INSERT INTO workout_exercises (id, workout_id, exercise_id, position) VALUES (?, ?, ?, ?)',
    weId, workoutId, exerciseId, pos?.p ?? 1);
  // start with as many empty sets as last session (min 1)
  const prev = await getPrevSets(db, exerciseId);
  const n = Math.max(1, prev.length);
  for (let i = 1; i <= n; i++) {
    await db.runAsync(
      'INSERT INTO sets (id, workout_exercise_id, position, set_type) VALUES (?, ?, ?, ?)',
      newId(), weId, i, prev[i - 1]?.set_type ?? 'working');
  }
  return weId;
}

export async function removeWorkoutExercise(db: SQLiteDatabase, weId: string): Promise<void> {
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
  fields: { weight_kg?: number | null; reps?: number | null; set_type?: SetType; completed?: boolean },
): Promise<void> {
  const cols: string[] = [];
  const vals: (string | number | null)[] = [];
  if ('weight_kg' in fields) { cols.push('weight_kg = ?'); vals.push(fields.weight_kg ?? null); }
  if ('reps' in fields) { cols.push('reps = ?'); vals.push(fields.reps ?? null); }
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
    await db.runAsync('DELETE FROM workouts WHERE id = ?', workoutId);
    return false;
  }
  await db.runAsync('UPDATE workouts SET finished_at = ? WHERE id = ?', nowIso(), workoutId);
  return true;
}

export async function discardWorkout(db: SQLiteDatabase, workoutId: string): Promise<void> {
  await db.runAsync(
    `DELETE FROM sets WHERE workout_exercise_id IN
     (SELECT id FROM workout_exercises WHERE workout_id = ?)`, workoutId);
  await db.runAsync('DELETE FROM workout_exercises WHERE workout_id = ?', workoutId);
  await db.runAsync('DELETE FROM workouts WHERE id = ?', workoutId);
}

export async function deleteWorkout(db: SQLiteDatabase, workoutId: string): Promise<void> {
  await discardWorkout(db, workoutId);
}

export async function getHistory(db: SQLiteDatabase, limit = 100): Promise<HistoryRow[]> {
  return db.getAllAsync<HistoryRow>(WORKOUT_HISTORY_SQL, limit);
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

// ---------- export / import ----------

const EXPORT_TABLES = [
  'exercises', 'workouts', 'workout_exercises', 'sets',
  'routines', 'routine_exercises', 'weigh_ins', 'calorie_entries', 'settings',
] as const;

export async function exportAll(db: SQLiteDatabase): Promise<string> {
  const out: Record<string, unknown> = { app: 'kilo', exported_at: nowIso(), schema_version: 1 };
  for (const t of EXPORT_TABLES) {
    out[t] = await db.getAllAsync(`SELECT * FROM ${t}`);
  }
  return JSON.stringify(out);
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
