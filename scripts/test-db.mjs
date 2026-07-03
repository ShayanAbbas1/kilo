// Runs the app's actual SQL against node:sqlite (node >= 23). `node scripts/test-db.mjs`
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  SCHEMA_SQL, PREV_SETS_SQL, WEIGHT_TREND_SQL, CALORIE_DAYS_SQL, WORKOUT_HISTORY_SQL,
  EXERCISE_PROGRESSION_SQL, MUSCLE_SETS_SQL, TOP_EXERCISES_SQL, PERIOD_SUMMARY_SQL,
  WEEKLY_WEIGHT_SQL, WEEKLY_TONNAGE_SQL, WEEKLY_KCAL_SQL, BEST_WEIGHT_SQL,
} from '../src/db/sql.ts';

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON;');
db.exec(SCHEMA_SQL);

// --- fixtures: bench press across two finished workouts + one active ---
db.exec(`INSERT INTO exercises (id, name) VALUES ('bench', 'Bench Press'), ('squat', 'Squat');`);

const w = (id, started, finished) => db
  .prepare('INSERT INTO workouts (id, started_at, finished_at) VALUES (?, ?, ?)')
  .run(id, started, finished);
const we = (id, wid, eid, pos) => db
  .prepare('INSERT INTO workout_exercises (id, workout_id, exercise_id, position) VALUES (?, ?, ?, ?)')
  .run(id, wid, eid, pos);
const set = (id, weid, pos, kg, reps, type, done) => db
  .prepare('INSERT INTO sets (id, workout_exercise_id, position, weight_kg, reps, set_type, completed) VALUES (?, ?, ?, ?, ?, ?, ?)')
  .run(id, weid, pos, kg, reps, type, done);

w('w1', '2026-06-20T10:00:00Z', '2026-06-20T11:00:00Z');
we('we1', 'w1', 'bench', 1);
set('s1', 'we1', 1, 50, 10, 'working', 1);
set('s2', 'we1', 2, 55, 8, 'working', 1);

w('w2', '2026-06-27T10:00:00Z', '2026-06-27T11:00:00Z');
we('we2', 'w2', 'bench', 1);
set('s3', 'we2', 1, 20, 12, 'warmup', 1);
set('s4', 'we2', 2, 60, 8, 'working', 1);
set('s5', 'we2', 3, 60, 7, 'working', 1);
set('s6', 'we2', 4, 62.5, 5, 'working', 0); // not completed — must not appear in prev

w('w3', '2026-07-01T10:00:00Z', null); // active workout — must not be "previous"
we('we3', 'w3', 'bench', 1);
set('s7', 'we3', 1, 100, 1, 'working', 1);

// --- prev sets: latest FINISHED workout (w2), completed sets only ---
const prev = db.prepare(PREV_SETS_SQL).all('bench', 'bench');
assert.equal(prev.length, 3, 'prev should have 3 completed sets from w2');
assert.deepEqual(prev.map((r) => r.weight_kg), [20, 60, 60]);
assert.equal(prev[0].set_type, 'warmup');

// --- history: only finished workouts, warmups excluded from set_count ---
const hist = db.prepare(WORKOUT_HISTORY_SQL).all(10);
assert.equal(hist.length, 2, 'active workout must not appear in history');
const h2 = hist.find((r) => r.id === 'w2');
assert.equal(h2.set_count, 2, 'warmup + incomplete sets excluded from count');
assert.equal(h2.tonnage_kg, 20 * 12 + 60 * 8 + 60 * 7, 'tonnage counts completed sets incl. warmups');

// --- weight trend: 7-entry moving average ---
const days = ['2026-06-24', '2026-06-25', '2026-06-26', '2026-06-27', '2026-06-28'];
const kgs = [90, 89.5, 89.7, 89.2, 89.0];
const wi = db.prepare('INSERT INTO weigh_ins (date, weight_kg) VALUES (?, ?)');
days.forEach((d, i) => wi.run(d, kgs[i]));
const trend = db.prepare(WEIGHT_TREND_SQL).all(10);
assert.equal(trend.length, 5);
assert.equal(trend[0].date, '2026-06-28', 'most recent first');
const expectedAvg = kgs.reduce((a, b) => a + b) / kgs.length;
assert.ok(Math.abs(trend[0].avg7 - expectedAvg) < 1e-9, '7-entry moving average');
assert.equal(trend[4].avg7, 90, 'first entry averages itself');

// --- calories: per-day grouping ---
const cal = db.prepare('INSERT INTO calorie_entries (id, date, label, kcal, protein_g) VALUES (?, ?, ?, ?, ?)');
cal.run('c1', '2026-07-01', 'breakfast', 450, 30);
cal.run('c2', '2026-07-01', 'dinner', 800, 55);
cal.run('c3', '2026-07-02', null, 1900, null);
const calDays = db.prepare(CALORIE_DAYS_SQL).all(10);
assert.equal(calDays[0].date, '2026-07-02');
assert.equal(calDays[0].kcal, 1900);
assert.equal(calDays[1].kcal, 1250);
assert.equal(calDays[1].protein_g, 85);
assert.equal(calDays[1].entries, 2);

// --- upsert weigh-in: one per day ---
db.prepare('INSERT OR REPLACE INTO weigh_ins (date, weight_kg) VALUES (?, ?)').run('2026-06-28', 88.8);
assert.equal(db.prepare('SELECT weight_kg FROM weigh_ins WHERE date = ?').get('2026-06-28').weight_kg, 88.8);
assert.equal(db.prepare('SELECT COUNT(*) n FROM weigh_ins').get().n, 5);

// --- analytics: exercise progression (per-day top weight / est 1RM / volume) ---
db.exec(`UPDATE exercises SET primary_muscles = '["chest"]' WHERE id = 'bench';`);
const prog = db.prepare(EXERCISE_PROGRESSION_SQL).all('bench');
assert.equal(prog.length, 2, 'two finished sessions for bench');
assert.equal(prog[0].day, '2026-06-20');
assert.equal(prog[0].top_weight, 55);
assert.ok(Math.abs(prog[0].est1rm - 55 * (1 + 8 / 30)) < 1e-9, 'Epley est 1RM');
assert.equal(prog[1].volume, 60 * 8 + 60 * 7, 'working-set volume only, warmups excluded');

// --- analytics: sets per muscle via json_each (warmups excluded) ---
const muscles = db.prepare(MUSCLE_SETS_SQL).all('2026-06-01');
const chest = muscles.find((m) => m.muscle === 'chest');
assert.equal(chest.sets, 4, '2 working sets in w1 + 2 in w2 (warmup excluded)');
assert.equal(db.prepare(MUSCLE_SETS_SQL).all('2026-06-25').find((m) => m.muscle === 'chest').sets, 2);

// --- analytics: top exercises ---
const top = db.prepare(TOP_EXERCISES_SQL).all(5);
assert.equal(top[0].id, 'bench');
assert.equal(top[0].sessions, 2);
assert.equal(top[0].best_weight, 60);

// --- analytics: period summary ---
const week = db.prepare(PERIOD_SUMMARY_SQL).get('2026-06-25');
assert.equal(week.workouts, 1, 'only w2 since 06-25');
assert.equal(week.tonnage_kg, 20 * 12 + 60 * 8 + 60 * 7);

// --- trendline weekly series ---
const wWeight = db.prepare(WEEKLY_WEIGHT_SQL).all('2026-06-01');
assert.ok(wWeight.length >= 1);
const wk26 = wWeight.find((r) => r.wk === '2026-25'); // week containing 2026-06-24..28
assert.ok(wk26, 'weigh-ins grouped into an ISO-ish week');
const wTon = db.prepare(WEEKLY_TONNAGE_SQL).all('2026-06-01');
assert.equal(wTon.reduce((a, r) => a + r.value, 0),
  50 * 10 + 55 * 8 + 20 * 12 + 60 * 8 + 60 * 7, 'tonnage includes completed warmups, excludes incomplete + active');
const wKcal = db.prepare(WEEKLY_KCAL_SQL).all('2026-06-01');
const kcalWk = wKcal.find((r) => r.wk === '2026-26');
assert.equal(kcalWk.value, (1250 + 1900) / 2, 'avg of daily sums, not avg of entries');

// --- PR detection ---
assert.equal(db.prepare(BEST_WEIGHT_SQL).get('bench').best, 60, 'best excludes active workout (100kg) and warmups');

console.log('test-db: all assertions passed');
