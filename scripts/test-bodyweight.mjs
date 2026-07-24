// `node scripts/test-bodyweight.mjs` — v5 bodyweight + timed sets: migration, flag
// seeding, effective-load tonnage, and the m:ss input round-trip.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  SCHEMA_SQL, MIGRATION_V4_SQL, SEED_EXERCISE_FLAGS_SQL, BODYWEIGHT_SNAPSHOT_SQL,
  EXERCISE_PROGRESSION_SQL, STALL_CANDIDATES_SQL, MUSCLE_SETS_SQL, PERIOD_SUMMARY_SQL,
  WEEKLY_TONNAGE_SQL, MUSCLE_WEEKLY_SETS_SQL, WORKOUT_HISTORY_SQL, BEST_WEIGHT_SQL,
} from '../src/db/sql.ts';
import { parseDuration, formatDuration } from '../src/lib/dates.ts';

// --- migration: a v4-shaped DB + MIGRATION_V4_SQL matches a fresh SCHEMA_SQL install ---
const oldDb = new DatabaseSync(':memory:');
oldDb.exec(`
  CREATE TABLE exercises (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'strength',
    equipment TEXT NOT NULL DEFAULT 'other',
    primary_muscles TEXT NOT NULL DEFAULT '[]',
    secondary_muscles TEXT NOT NULL DEFAULT '[]',
    instructions TEXT NOT NULL DEFAULT '',
    is_custom INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE sets (
    id TEXT PRIMARY KEY,
    workout_exercise_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    weight_kg REAL,
    reps INTEGER,
    set_type TEXT NOT NULL DEFAULT 'working',
    completed INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    rpe REAL
  );
`);
// pre-existing rows the migration must survive
oldDb.exec(`
  INSERT INTO exercises (id, name, equipment) VALUES ('Pullups', 'Pullups', 'body only');
  INSERT INTO exercises (id, name, equipment, category)
    VALUES ('Hamstring_Stretch', 'Hamstring Stretch', 'body only', 'stretching');
  INSERT INTO exercises (id, name, equipment) VALUES ('Plank', 'Plank', 'body only');
  INSERT INTO exercises (id, name, equipment) VALUES ('Hang_Clean', 'Hang Clean', 'barbell');
  INSERT INTO sets (id, workout_exercise_id, position, weight_kg, reps, completed)
    VALUES ('old1', 'we-old', 1, 60, 5, 1);
`);
oldDb.exec(MIGRATION_V4_SQL);
oldDb.exec(SEED_EXERCISE_FLAGS_SQL);

const freshDb = new DatabaseSync(':memory:');
freshDb.exec(SCHEMA_SQL);
const cols = (d, table) => d.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name).sort();
assert.deepEqual(cols(oldDb, 'sets'), cols(freshDb, 'sets'),
  'v4 sets + MIGRATION_V4_SQL matches fresh SCHEMA_SQL columns');
assert.deepEqual(cols(oldDb, 'exercises'), cols(freshDb, 'exercises'),
  'v4 exercises + MIGRATION_V4_SQL matches fresh SCHEMA_SQL columns');

// migrated tables actually accept the new columns
oldDb.prepare(
  `INSERT INTO sets (id, workout_exercise_id, position, duration_seconds, bodyweight_kg)
   VALUES ('new1', 'we-old', 2, 60, 80)`,
).run();
const migrated = oldDb.prepare('SELECT duration_seconds, bodyweight_kg FROM sets WHERE id = ?').get('new1');
assert.equal(migrated.duration_seconds, 60);
assert.equal(migrated.bodyweight_kg, 80);
assert.equal(oldDb.prepare('SELECT weight_kg FROM sets WHERE id = ?').get('old1').weight_kg, 60,
  'pre-migration history survives');

// --- flag seeding ---
const flags = (id) => oldDb.prepare('SELECT is_bodyweight, is_timed FROM exercises WHERE id = ?').get(id);
assert.equal(flags('Pullups').is_bodyweight, 1, "'body only' is flagged bodyweight");
assert.equal(flags('Hamstring_Stretch').is_bodyweight, 0, 'stretches stay out of tonnage');
assert.equal(flags('Hang_Clean').is_bodyweight, 0, 'loaded exercises are not bodyweight');
assert.equal(flags('Plank').is_timed, 1, 'Plank is in the explicit timed id list');
assert.equal(flags('Hang_Clean').is_timed, 0, 'Hang Clean is rep-based, never timed');
assert.equal(flags('Pullups').is_timed, 0, 'bodyweight does not imply timed');

// --- fixtures on a fresh v5 DB ---
const db = freshDb;
db.exec(`
  INSERT INTO exercises (id, name, equipment, primary_muscles, is_bodyweight)
    VALUES ('pullup', 'Pull Up', 'body only', '["lats"]', 1);
  INSERT INTO exercises (id, name, equipment, primary_muscles, is_bodyweight, is_timed)
    VALUES ('plank', 'Plank', 'body only', '["abdominals"]', 1, 1);
  INSERT INTO exercises (id, name, equipment, primary_muscles) VALUES ('bench', 'Bench', 'barbell', '["chest"]');
`);
const w = (id, started) => db
  .prepare('INSERT INTO workouts (id, started_at, finished_at) VALUES (?, ?, ?)')
  .run(id, started, started);
const we = (id, wid, eid) => db
  .prepare('INSERT INTO workout_exercises (id, workout_id, exercise_id, position) VALUES (?, ?, ?, 1)')
  .run(id, wid, eid);
const set = (id, weid, pos, kg, reps, bw, dur) => db.prepare(
  `INSERT INTO sets (id, workout_exercise_id, position, weight_kg, reps, bodyweight_kg,
     duration_seconds, set_type, completed)
   VALUES (?, ?, ?, ?, ?, ?, ?, 'working', 1)`,
).run(id, weid, pos, kg, reps, bw, dur);

// weighted pull-up: 80 kg bodyweight + 20 kg added, 10 reps
w('w1', '2026-06-20T10:00:00Z');
we('we1', 'w1', 'pullup');
set('s1', 'we1', 1, 20, 10, 80, null);
// pure bodyweight pull-up: no added weight at all
w('w2', '2026-06-27T10:00:00Z');
we('we2', 'w2', 'pullup');
set('s2', 'we2', 1, null, 10, 80, null);
// no weigh-in ever logged: both weights NULL
w('w3', '2026-07-04T10:00:00Z');
we('we3', 'w3', 'pullup');
set('s3', 'we3', 1, null, 10, null, null);

// --- tonnage: effective load is bodyweight + added ---
const prog = db.prepare(EXERCISE_PROGRESSION_SQL).all('pullup');
assert.equal(prog.length, 2, 'the both-NULL set is filtered out; the other two sessions remain');
assert.equal(prog[0].volume, (80 + 20) * 10, 'weighted pull-up: (bodyweight + added) * reps');
assert.equal(prog[1].volume, 80 * 10, 'pure bodyweight set is bodyweight * reps, not 0');
assert.equal(prog[1].top_weight, null, 'top_weight stays raw added weight — a PR is added load');
assert.equal(prog[0].top_weight, 20);
assert.ok(Math.abs(prog[0].est1rm - 100 * (1 + 10 / 30)) < 1e-9, 'Epley uses effective load');

// --- null filter: a pure bodyweight set reaches progression and stall detection ---
assert.ok(prog.some((r) => r.day === '2026-06-27'), 'pure bodyweight session in progression');
const cand = db.prepare(STALL_CANDIDATES_SQL).all('2026-06-01');
assert.equal(cand.filter((r) => r.id === 'pullup').length, 2, 'pure bodyweight session is a stall candidate');

// --- no weigh-in: contributes 0, crashes nothing ---
const noWeighIn = db.prepare(WORKOUT_HISTORY_SQL).all(10).find((r) => r.id === 'w3');
assert.equal(noWeighIn.tonnage_kg, 0, 'a set with no weight at all contributes 0 tonnage');
assert.equal(noWeighIn.set_count, 1, 'and still counts as a logged set');

// --- timed set: 0 tonnage, absent from progression, but still one set for volume ---
w('w4', '2026-07-11T10:00:00Z');
we('we4', 'w4', 'plank');
set('s4', 'we4', 1, null, null, 80, 90);
assert.equal(db.prepare(EXERCISE_PROGRESSION_SQL).all('plank').length, 0,
  'reps IS NULL keeps timed sets out of progression / est-1RM');
const abs = db.prepare(MUSCLE_SETS_SQL).all('').find((m) => m.muscle === 'abdominals');
assert.equal(abs.sets, 1, 'a timed set still counts as one set for the muscle group');
assert.equal(abs.tonnage, 0, 'seconds x kg is not tonnage');
const plankWeek = db.prepare(MUSCLE_WEEKLY_SETS_SQL).all('2026-06-01', '["abdominals"]');
assert.equal(plankWeek.reduce((a, r) => a + r.sets, 0), 1);
assert.equal(plankWeek.reduce((a, r) => a + r.tonnage, 0), 0);
assert.equal(db.prepare(WORKOUT_HISTORY_SQL).all(10).find((r) => r.id === 'w4').tonnage_kg, 0,
  'timed set adds no tonnage to workout history');

// --- the effective-load substitution is consistent across every analytics query ---
const lats = db.prepare(MUSCLE_SETS_SQL).all('').find((m) => m.muscle === 'lats');
assert.equal(lats.tonnage, (80 + 20) * 10 + 80 * 10, 'muscle tonnage uses effective load');
assert.equal(db.prepare(PERIOD_SUMMARY_SQL).get('').tonnage_kg, (80 + 20) * 10 + 80 * 10,
  'period summary uses effective load');
assert.equal(db.prepare(WEEKLY_TONNAGE_SQL).all('2026-06-01').reduce((a, r) => a + r.value, 0),
  (80 + 20) * 10 + 80 * 10, 'weekly tonnage uses effective load');
assert.equal(db.prepare(WORKOUT_HISTORY_SQL).all(10).find((r) => r.id === 'w1').tonnage_kg,
  (80 + 20) * 10, 'workout history uses effective load');

// --- PRs rank by added weight, not total ---
assert.equal(db.prepare(BEST_WEIGHT_SQL).get('pullup').best, 20,
  'best is the +20 kg added, not the 100 kg total — gaining weight is not a PR');

// --- bodyweight snapshot: written at completion, only for bodyweight exercises ---
db.exec(`
  INSERT INTO weigh_ins (date, weight_kg) VALUES ('2026-07-01', 82), ('2026-07-15', 79);
  INSERT INTO workouts (id, started_at) VALUES ('w5', '2026-07-20T10:00:00Z');
  INSERT INTO workout_exercises (id, workout_id, exercise_id, position)
    VALUES ('we5a', 'w5', 'pullup', 1), ('we5b', 'w5', 'bench', 2);
  INSERT INTO sets (id, workout_exercise_id, position) VALUES ('s5', 'we5a', 1), ('s6', 'we5b', 1);
`);
const complete = db.prepare(`UPDATE sets SET completed = 1, ${BODYWEIGHT_SNAPSHOT_SQL} WHERE id = ?`);
complete.run('s5');
complete.run('s6');
const bw = (id) => db.prepare('SELECT bodyweight_kg FROM sets WHERE id = ?').get(id).bodyweight_kg;
assert.equal(bw('s5'), 79, 'snapshots the most recent weigh-in');
assert.equal(bw('s6'), null, 'a barbell exercise never gets a bodyweight snapshot');
// a later weigh-in must not rewrite history
db.exec(`INSERT INTO weigh_ins (date, weight_kg) VALUES ('2026-07-21', 77);`);
assert.equal(bw('s5'), 79, 'history does not move when the user weighs in again');

// --- m:ss parse / format round-trip ---
assert.equal(parseDuration('90'), 90);
assert.equal(parseDuration('1:30'), 90);
assert.equal(parseDuration(' 1:30 '), 90, 'whitespace tolerated');
assert.equal(parseDuration('0:45'), 45);
assert.equal(formatDuration(90), '1:30');
assert.equal(formatDuration(45), '0:45');
assert.equal(formatDuration(parseDuration('2:05')), '2:05', 'round-trip');
for (const bad of ['', 'abc', '1:2:3', '-5', '1:', ':30', '1.5']) {
  assert.equal(parseDuration(bad), null, `bad input "${bad}" is null, never NaN`);
}

console.log('test-bodyweight: all assertions passed');
