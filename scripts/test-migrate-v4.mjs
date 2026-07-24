// `node scripts/test-migrate-v4.mjs` — v3->v4 muscle backfill: stock rows are
// re-mapped from the corrected seed; custom exercises and workout history survive.
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SCHEMA_SQL } from '../src/db/sql.ts';

const seed = JSON.parse(readFileSync(new URL('../src/data/exercises.json', import.meta.url)));
const db = new DatabaseSync(':memory:');
db.exec(SCHEMA_SQL);

// A stock exercise as it looked on a v3 install (old, banned-label muscles) ...
const stock = seed.find((e) => e.name === 'Bent Over Barbell Row');
assert.ok(stock, 'fixture exercise present in seed');
db.prepare(
  `INSERT INTO exercises (id, name, category, equipment, primary_muscles, secondary_muscles, is_custom)
   VALUES (?, ?, 'strength', 'barbell', '["middle back"]', '["lower back","biceps"]', 0)`,
).run(stock.id, stock.name);
// ... a user's custom exercise that happens to use an old label (must NOT be touched) ...
db.prepare(
  `INSERT INTO exercises (id, name, category, equipment, primary_muscles, is_custom)
   VALUES ('custom_1', 'My Row', 'strength', 'barbell', '["middle back"]', 1)`,
).run();
// ... and a finished workout referencing the stock exercise (history must survive).
db.prepare("INSERT INTO workouts (id, started_at, finished_at) VALUES ('w1','2026-01-01','2026-01-01')").run();
db.prepare('INSERT INTO workout_exercises (id, workout_id, exercise_id, position) VALUES (?,?,?,0)')
  .run('we1', 'w1', stock.id);

// Replicate backfillMuscles() (src/db/index.ts): re-apply seed muscles to stock rows only.
const upd = db.prepare(
  'UPDATE exercises SET primary_muscles = ?, secondary_muscles = ? WHERE id = ? AND is_custom = 0');
for (const e of seed) {
  upd.run(JSON.stringify(e.primaryMuscles), JSON.stringify(e.secondaryMuscles), e.id);
}

const row = db.prepare('SELECT primary_muscles, secondary_muscles FROM exercises WHERE id = ?').get(stock.id);
assert.deepEqual(JSON.parse(row.primary_muscles), stock.primaryMuscles, 'stock primary re-mapped from seed');
assert.deepEqual(JSON.parse(row.secondary_muscles), stock.secondaryMuscles, 'stock secondary re-mapped from seed');
assert.ok(!JSON.stringify(row).includes('middle back'), 'no middle back on stock row');
assert.ok(!JSON.stringify(row).includes('lower back'), 'no lower back on stock row');

const custom = db.prepare("SELECT primary_muscles FROM exercises WHERE id = 'custom_1'").get();
assert.equal(custom.primary_muscles, '["middle back"]', 'custom exercise left untouched');

const link = db.prepare('SELECT exercise_id FROM workout_exercises WHERE id = ?').get('we1');
assert.equal(link.exercise_id, stock.id, 'workout history still references the exercise (ids stable)');

// Idempotent: running again changes nothing.
for (const e of seed) upd.run(JSON.stringify(e.primaryMuscles), JSON.stringify(e.secondaryMuscles), e.id);
const again = db.prepare('SELECT primary_muscles FROM exercises WHERE id = ?').get(stock.id);
assert.deepEqual(JSON.parse(again.primary_muscles), stock.primaryMuscles, 'backfill is idempotent');

console.log('test-migrate-v4: all assertions passed');
