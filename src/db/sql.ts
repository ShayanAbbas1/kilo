// Pure SQL, no expo imports — also executed by scripts/test-db.mjs against node:sqlite.

export const SCHEMA_VERSION = 3;

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
  position INTEGER NOT NULL,
  notes TEXT,
  superset_with_next INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sets (
  id TEXT PRIMARY KEY,
  workout_exercise_id TEXT NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  weight_kg REAL,
  reps INTEGER,
  set_type TEXT NOT NULL DEFAULT 'working',
  completed INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  rpe REAL
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
  target_sets INTEGER NOT NULL DEFAULT 3,
  superset_with_next INTEGER NOT NULL DEFAULT 0
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

/** v1 -> v2: RPE per set + per-exercise notes. Applied only to installs upgrading from v1. */
export const MIGRATION_V2_SQL = `
ALTER TABLE sets ADD COLUMN rpe REAL;
ALTER TABLE workout_exercises ADD COLUMN notes TEXT;
`;

/** v2 -> v3: supersets — a flag linking an exercise to the next one by position. */
export const MIGRATION_V3_SQL = `
ALTER TABLE workout_exercises ADD COLUMN superset_with_next INTEGER NOT NULL DEFAULT 0;
ALTER TABLE routine_exercises ADD COLUMN superset_with_next INTEGER NOT NULL DEFAULT 0;
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

/**
 * Per-day progression for one exercise across finished workouts:
 * top weight, best estimated 1RM (Epley), session volume.
 * Params: exercise_id
 */
export const EXERCISE_PROGRESSION_SQL = `
SELECT date(w.started_at) AS day,
  MAX(s.weight_kg) AS top_weight,
  MAX(s.weight_kg * (1 + s.reps / 30.0)) AS est1rm,
  SUM(s.weight_kg * s.reps) AS volume
FROM sets s
JOIN workout_exercises we ON we.id = s.workout_exercise_id
JOIN workouts w ON w.id = we.workout_id
WHERE we.exercise_id = ?
  AND s.completed = 1 AND s.set_type != 'warmup'
  AND s.weight_kg IS NOT NULL AND s.reps IS NOT NULL
  AND w.finished_at IS NOT NULL
GROUP BY day
ORDER BY day;
`;

/**
 * Completed working sets per primary muscle since a date (uses json_each over
 * the exercise's primary_muscles array). Params: since ISO date
 */
export const MUSCLE_SETS_SQL = `
SELECT je.value AS muscle, COUNT(*) AS sets,
  COALESCE(SUM(s.weight_kg * s.reps), 0) AS tonnage
FROM sets s
JOIN workout_exercises we ON we.id = s.workout_exercise_id
JOIN workouts w ON w.id = we.workout_id
JOIN exercises e ON e.id = we.exercise_id,
  json_each(e.primary_muscles) je
WHERE s.completed = 1 AND s.set_type != 'warmup'
  AND w.finished_at IS NOT NULL AND w.started_at >= ?
GROUP BY je.value
ORDER BY sets DESC;
`;

/** Most-trained exercises (by session count). Params: limit */
export const TOP_EXERCISES_SQL = `
SELECT e.id, e.name, COUNT(DISTINCT w.id) AS sessions,
  MAX(s.weight_kg) AS best_weight
FROM sets s
JOIN workout_exercises we ON we.id = s.workout_exercise_id
JOIN workouts w ON w.id = we.workout_id
JOIN exercises e ON e.id = we.exercise_id
WHERE s.completed = 1 AND s.set_type != 'warmup' AND w.finished_at IS NOT NULL
GROUP BY e.id
ORDER BY sessions DESC, e.name
LIMIT ?;
`;

/** Workouts + tonnage since a date (weekly summary). Params: since ISO datetime */
export const PERIOD_SUMMARY_SQL = `
SELECT COUNT(DISTINCT w.id) AS workouts,
  COALESCE(SUM(CASE WHEN s.completed = 1 THEN s.weight_kg * s.reps ELSE 0 END), 0) AS tonnage_kg
FROM workouts w
LEFT JOIN workout_exercises we ON we.workout_id = w.id
LEFT JOIN sets s ON s.workout_exercise_id = we.id
WHERE w.finished_at IS NOT NULL AND w.started_at >= ?;
`;

/**
 * The Trendline inputs — one row per ISO week (%Y-%W): avg body weight,
 * total tonnage, avg daily kcal. LEFT-join style union via three grouped
 * subselects joined in JS (weeks can be missing per series).
 * Params: since date (YYYY-MM-DD) — applied per series.
 */
export const WEEKLY_WEIGHT_SQL = `
SELECT strftime('%Y-%W', date) AS wk, AVG(weight_kg) AS value
FROM weigh_ins WHERE date >= ?
GROUP BY wk ORDER BY wk;
`;

export const WEEKLY_TONNAGE_SQL = `
SELECT strftime('%Y-%W', w.started_at) AS wk,
  SUM(s.weight_kg * s.reps) AS value
FROM sets s
JOIN workout_exercises we ON we.id = s.workout_exercise_id
JOIN workouts w ON w.id = we.workout_id
WHERE s.completed = 1 AND s.weight_kg IS NOT NULL AND s.reps IS NOT NULL
  AND w.finished_at IS NOT NULL AND date(w.started_at) >= ?
GROUP BY wk ORDER BY wk;
`;

export const WEEKLY_KCAL_SQL = `
SELECT wk, AVG(day_kcal) AS value FROM (
  SELECT strftime('%Y-%W', date) AS wk, date, SUM(kcal) AS day_kcal
  FROM calorie_entries WHERE date >= ?
  GROUP BY date
)
GROUP BY wk ORDER BY wk;
`;

/**
 * Weekly working-set counts for a group of muscles (drill-down chart).
 * Params: muscles as a JSON array string, since date
 */
export const MUSCLE_WEEKLY_SETS_SQL = `
SELECT strftime('%Y-%W', w.started_at) AS wk, COUNT(*) AS sets,
  COALESCE(SUM(s.weight_kg * s.reps), 0) AS tonnage
FROM sets s
JOIN workout_exercises we ON we.id = s.workout_exercise_id
JOIN workouts w ON w.id = we.workout_id
JOIN exercises e ON e.id = we.exercise_id,
  json_each(e.primary_muscles) je
WHERE s.completed = 1 AND s.set_type != 'warmup'
  AND w.finished_at IS NOT NULL AND date(w.started_at) >= ?
  AND je.value IN (SELECT value FROM json_each(?))
GROUP BY wk ORDER BY wk;
`;

/**
 * Exercises that trained a muscle group in a period, with working-set counts.
 * Params: since date, muscles JSON array string
 */
export const MUSCLE_EXERCISES_SQL = `
SELECT e.id, e.name, COUNT(*) AS sets
FROM sets s
JOIN workout_exercises we ON we.id = s.workout_exercise_id
JOIN workouts w ON w.id = we.workout_id
JOIN exercises e ON e.id = we.exercise_id,
  json_each(e.primary_muscles) je
WHERE s.completed = 1 AND s.set_type != 'warmup'
  AND w.finished_at IS NOT NULL AND date(w.started_at) >= ?
  AND je.value IN (SELECT value FROM json_each(?))
GROUP BY e.id
ORDER BY sets DESC;
`;

/** Best completed working-set weight ever for an exercise (PR detection). Params: exercise_id */
export const BEST_WEIGHT_SQL = `
SELECT MAX(s.weight_kg) AS best
FROM sets s
JOIN workout_exercises we ON we.id = s.workout_exercise_id
JOIN workouts w ON w.id = we.workout_id
WHERE we.exercise_id = ? AND s.completed = 1 AND s.set_type != 'warmup'
  AND w.finished_at IS NOT NULL;
`;

/**
 * PR history feed: completed non-warmup sets in finished workouts whose weight
 * strictly beats the best of all earlier completed non-warmup sets of that
 * exercise (earlier = workout date, then set position). The first-ever set of
 * an exercise has no running max to beat (NULL), so it's excluded — NULL
 * comparisons are never true, no explicit check needed.
 * Params: limit
 */
export const PR_HISTORY_SQL = `
SELECT started_at, exercise_id, exercise_name, weight_kg, reps FROM (
  SELECT w.started_at AS started_at, e.id AS exercise_id, e.name AS exercise_name,
    s.weight_kg AS weight_kg, s.reps AS reps,
    MAX(s.weight_kg) OVER (
      PARTITION BY e.id ORDER BY w.started_at, s.position
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) AS prev_best
  FROM sets s
  JOIN workout_exercises we ON we.id = s.workout_exercise_id
  JOIN workouts w ON w.id = we.workout_id
  JOIN exercises e ON e.id = we.exercise_id
  WHERE s.completed = 1 AND s.set_type != 'warmup' AND w.finished_at IS NOT NULL
    AND s.weight_kg IS NOT NULL AND s.reps IS NOT NULL
)
WHERE weight_kg > prev_best
ORDER BY started_at DESC
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
