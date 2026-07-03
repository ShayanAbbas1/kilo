// Pure SQL, no expo imports — also executed by scripts/test-db.mjs against node:sqlite.

export const SCHEMA_VERSION = 1;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'strength',
  equipment TEXT NOT NULL DEFAULT 'other',
  primary_muscles TEXT NOT NULL DEFAULT '[]',
  secondary_muscles TEXT NOT NULL DEFAULT '[]',
  instructions TEXT NOT NULL DEFAULT '',
  is_custom INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS workouts (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  name TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS workout_exercises (
  id TEXT PRIMARY KEY,
  workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sets (
  id TEXT PRIMARY KEY,
  workout_exercise_id TEXT NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  weight_kg REAL,
  reps INTEGER,
  set_type TEXT NOT NULL DEFAULT 'working',
  completed INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS routines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS routine_exercises (
  id TEXT PRIMARY KEY,
  routine_id TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  position INTEGER NOT NULL,
  target_sets INTEGER NOT NULL DEFAULT 3
);

CREATE TABLE IF NOT EXISTS weigh_ins (
  date TEXT PRIMARY KEY,
  weight_kg REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS calorie_entries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  label TEXT,
  kcal INTEGER NOT NULL,
  protein_g REAL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_we_workout ON workout_exercises(workout_id);
CREATE INDEX IF NOT EXISTS idx_we_exercise ON workout_exercises(exercise_id);
CREATE INDEX IF NOT EXISTS idx_sets_we ON sets(workout_exercise_id);
CREATE INDEX IF NOT EXISTS idx_cal_date ON calorie_entries(date);
CREATE INDEX IF NOT EXISTS idx_workouts_started ON workouts(started_at);
`;

/**
 * Sets the user did for this exercise in their most recent FINISHED workout
 * that contains it — the "previous session" ghost values.
 * Params: exercise_id
 */
export const PREV_SETS_SQL = `
SELECT s.position, s.weight_kg, s.reps, s.set_type
FROM sets s
JOIN workout_exercises we ON we.id = s.workout_exercise_id
WHERE we.exercise_id = ?
  AND s.completed = 1
  AND we.workout_id = (
    SELECT w.id FROM workouts w
    JOIN workout_exercises we2 ON we2.workout_id = w.id
    JOIN sets s2 ON s2.workout_exercise_id = we2.id
    WHERE we2.exercise_id = ? AND w.finished_at IS NOT NULL AND s2.completed = 1
    ORDER BY w.started_at DESC LIMIT 1
  )
ORDER BY s.position;
`;

/**
 * Body-weight entries with a 7-day moving average (over calendar entries,
 * not calendar days — good enough while weigh-ins are near-daily).
 * Params: limit
 */
export const WEIGHT_TREND_SQL = `
SELECT date, weight_kg,
  AVG(weight_kg) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS avg7
FROM weigh_ins
ORDER BY date DESC
LIMIT ?;
`;

/** Daily kcal totals, most recent first. Params: limit */
export const CALORIE_DAYS_SQL = `
SELECT date, SUM(kcal) AS kcal, SUM(protein_g) AS protein_g, COUNT(*) AS entries
FROM calorie_entries
GROUP BY date
ORDER BY date DESC
LIMIT ?;
`;

/** History list: finished workouts with set counts + tonnage. Params: limit */
export const WORKOUT_HISTORY_SQL = `
SELECT w.id, w.name, w.started_at, w.finished_at,
  COUNT(DISTINCT we.exercise_id) AS exercise_count,
  SUM(CASE WHEN s.completed = 1 AND s.set_type != 'warmup' THEN 1 ELSE 0 END) AS set_count,
  SUM(CASE WHEN s.completed = 1 THEN COALESCE(s.weight_kg,0) * COALESCE(s.reps,0) ELSE 0 END) AS tonnage_kg
FROM workouts w
LEFT JOIN workout_exercises we ON we.workout_id = w.id
LEFT JOIN sets s ON s.workout_exercise_id = we.id
WHERE w.finished_at IS NOT NULL
GROUP BY w.id
ORDER BY w.started_at DESC
LIMIT ?;
`;
