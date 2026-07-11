// `node scripts/test-strong-import.mjs` — Strong CSV parse → match → plan → insert
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL, PREV_SETS_SQL } from '../src/db/sql.ts';
import {
  parseStrongCsv, buildMatcher, buildImportPlan, inferEquipment,
} from '../src/lib/strong-import.ts';

// Mimics a real export: semicolon delimiter, every field quoted, Rest Timer and
// Note pseudo-rows, a second workout, a warmup "W" set order, a bodyweight set.
const CSV = [
  '"Workout #";"Date";"Workout Name";"Duration (sec)";"Exercise Name";"Set Order";"Weight (kg)";"Reps";"RPE";"Distance (meters)";"Seconds";"Notes";"Workout Notes"',
  '"1";"2026-01-30 19:37:30";"Legs";"2619";"Hack Squat";"W";"40.0";"10";"";"";"";"";"felt good"',
  '"1";"2026-01-30 19:37:30";"Legs";"2619";"Hack Squat";"1";"80.0";"10";"8";"";"";"";"felt good"',
  '"1";"2026-01-30 19:37:30";"Legs";"2619";"Hack Squat";"Rest Timer";"";"";"";"";"120.0";"";"felt good"',
  '"1";"2026-01-30 19:37:30";"Legs";"2619";"Hack Squat";"2";"80.0";"9";"";"";"";"";"felt good"',
  '"1";"2026-01-30 19:37:30";"Legs";"2619";"Back Extension";"Note";"";"";"";"";"";"slow eccentric";"felt good"',
  '"1";"2026-01-30 19:37:30";"Legs";"2619";"Back Extension";"1";"";"12";"";"";"";"";"felt good"',
  '"2";"2026-02-01 08:00:00";"Push";"3600";"Leg Press";"1";"100";"5";"";"";"";"";""',
  '"2";"2026-02-01 08:00:00";"Push";"3600";"Leg Press";"D";"82,5";"3";"";"";"";"";""', // drop set, comma decimal
].join('\r\n');

const workouts = parseStrongCsv(CSV);
assert.equal(workouts.length, 2);
const [legs, push] = workouts;
assert.equal(legs.id, 'strong_2026-01-30 19:37:30');
assert.equal(legs.name, 'Legs');
assert.equal(legs.notes, 'felt good');
assert.equal(
  new Date(legs.finishedAt).getTime() - new Date(legs.startedAt).getTime(), 2619 * 1000);
assert.equal(legs.exercises.length, 2);

const [hack, back] = legs.exercises;
assert.equal(hack.sets.length, 3); // warmup + 2 working; rest-timer row skipped
assert.deepEqual(hack.sets.map((s) => s.setType), ['warmup', 'working', 'working']);
assert.deepEqual(hack.sets.map((s) => s.position), [1, 2, 3]);
assert.equal(hack.sets[1].weightKg, 80);
assert.equal(hack.sets[1].rpe, 8);
assert.equal(back.notes, 'slow eccentric'); // Note pseudo-row → exercise note
assert.equal(back.sets[0].weightKg, null); // bodyweight set keeps null weight
assert.equal(back.sets[0].reps, 12);
assert.equal(push.exercises[0].sets[0].weightKg, 100);
// "D" drop set kept as a working set; comma decimal parsed
assert.equal(push.exercises[0].sets.length, 2);
assert.equal(push.exercises[0].sets[1].setType, 'working');
assert.equal(push.exercises[0].sets[1].weightKg, 82.5);

// "58m"-style duration → no duration rather than garbage
const durCsv = CSV.replaceAll('"2619"', '"43m 39s"');
const durLegs = parseStrongCsv(durCsv)[0];
assert.equal(durLegs.finishedAt, durLegs.startedAt);

// a multi-line quoted note's continuation "row" is skipped, not a crash
assert.equal(parseStrongCsv(CSV + '\r\n"";"garbage note tail";"";"";"";"";"";"";"";"";"";"";""').length, 2);

// lbs header converts to kg
const lbsCsv = CSV.replace('"Weight (kg)"', '"Weight (lbs)"');
const lbsHack = parseStrongCsv(lbsCsv)[0].exercises[0];
assert.equal(lbsHack.sets[1].weightKg, 36.287); // 80 lb → kg, rounded to 3 decimals

// comma-delimited variant parses the same
const commaCsv = CSV.replaceAll('";"', '","');
assert.equal(parseStrongCsv(commaCsv).length, 2);

// ---------- matcher ----------

const match = buildMatcher([
  { id: 'Hack_Squat', name: 'Hack Squat' },
  { id: 'Leg_Extensions', name: 'Leg Extensions' },
  { id: 'Smith_Incline', name: 'Smith Machine Incline Bench Press' },
  { id: 'Curl_A', name: 'Alpha Curl' },
  { id: 'Curl_B', name: 'Curl Alpha' }, // same token set as Alpha Curl → ambiguous
]);
assert.equal(match('Hack Squat'), 'Hack_Squat'); // exact
assert.equal(match('Leg Extension (Machine)'), 'Leg_Extensions'); // stripped paren + singularized
assert.equal(match('Incline Bench Press (Smith Machine)'), 'Smith_Incline'); // equipment folded in front
assert.equal(match('Back Extension'), null); // no fuzzy guessing
assert.equal(match('Alpha Curl (Cable)'), null); // ambiguous token set → ask the user

assert.equal(inferEquipment('Chest Press (Machine)'), 'machine');
assert.equal(inferEquipment('Shoulder Press (Plate Loaded)'), 'machine');
assert.equal(inferEquipment('Incline Bench Press (Barbell)'), 'barbell');
assert.equal(inferEquipment('Triceps Pushdown (Cable - Straight Bar)'), 'cable');
assert.equal(inferEquipment('Back Extension'), 'other');

// ---------- plan + insert into a real schema ----------

const resolve = (name) => ({ 'Hack Squat': 'Hack_Squat' })[name] ?? `custom_${name}`;
const plan = buildImportPlan(workouts, resolve);
assert.equal(plan.workouts.length, 2);
assert.equal(plan.workout_exercises.length, 3);
assert.equal(plan.sets.length, 6);
// deterministic ids → re-parsing the same file yields the identical plan
assert.deepEqual(plan, buildImportPlan(parseStrongCsv(CSV), resolve));

const db = new DatabaseSync(':memory:');
db.exec(SCHEMA_SQL);
db.prepare("INSERT INTO exercises (id, name) VALUES ('Hack_Squat', 'Hack Squat')").run();
db.prepare("INSERT INTO exercises (id, name) VALUES ('custom_Back Extension', 'Back Extension')").run();
db.prepare("INSERT INTO exercises (id, name) VALUES ('custom_Leg Press', 'Leg Press')").run();
const insert = (table, row) => db.prepare(
  `INSERT INTO ${table} (${Object.keys(row).join(',')}) VALUES (${Object.keys(row).map(() => '?').join(',')})`,
).run(...Object.values(row));
// same skip-existing-workout logic as importStrongWorkouts
const importPlan = (p) => {
  let imported = 0;
  for (const w of p.workouts) {
    if (db.prepare('SELECT 1 FROM workouts WHERE id = ?').get(w.id)) continue;
    insert('workouts', w);
    for (const we of p.workout_exercises) if (we.workout_id === w.id) insert('workout_exercises', we);
    for (const s of p.sets) {
      if (String(s.workout_exercise_id).startsWith(`${w.id}_`)) insert('sets', s);
    }
    imported++;
  }
  return imported;
};
assert.equal(importPlan(plan), 2);
assert.equal(importPlan(plan), 0); // re-import is a no-op
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sets').get().n, 6);

// imported history feeds the ghost-values query (completed sets, finished workout)
const prev = db.prepare(PREV_SETS_SQL).all('Hack_Squat', 'Hack_Squat');
assert.equal(prev.length, 3);
assert.equal(prev[1].weight_kg, 80);

// a workout the user logged in Kilo before importing is untouched
db.prepare("INSERT INTO workouts (id, started_at, finished_at) VALUES ('own', '2026-03-01T10:00:00Z', '2026-03-01T11:00:00Z')").run();
assert.equal(importPlan(plan), 0);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM workouts').get().n, 3);

console.log('test-strong-import: all assertions passed');
