// `node scripts/test-heads.mjs` — muscle-head heuristics + body-map aggregation
import assert from 'node:assert/strict';
import { aggregateHeads, muscleEmphasis } from '../src/lib/muscle-heads.ts';
import { toBodyData, MUSCLE_TO_SLUG, HEAT_COLORS } from '../src/lib/body-map.ts';

const one = (name, muscles) => muscleEmphasis(name, muscles)[0];

assert.equal(one('Barbell Incline Bench Press Medium-Grip', ['chest']), 'upper chest (clavicular head)');
assert.equal(one('Decline Dumbbell Bench Press', ['chest']), 'lower chest (costal region)');
assert.equal(one('Barbell Bench Press', ['chest']), 'mid chest (sternal head)');
assert.equal(one('Dumbbell Flyes', ['chest']), 'chest — stretch/adduction emphasis');
assert.equal(one('Preacher Curl', ['biceps']), 'short head emphasis');
assert.equal(one('Hammer Curls', ['biceps']), 'brachialis & brachioradialis');
assert.equal(one('EZ-Bar Skullcrusher', ['triceps']), 'long head emphasis');
assert.equal(one('Triceps Pushdown', ['triceps']), 'lateral head emphasis');
assert.equal(one('Side Lateral Raise', ['shoulders']), 'side (lateral) delt');
assert.equal(one('Face Pull', ['shoulders']), 'rear (posterior) delt');
assert.equal(one('Wide-Grip Lat Pulldown', ['lats']), 'lats — width (upper lat) emphasis');
assert.equal(one('Bent Over Barbell Row', ['lats']), 'lats — thickness (lower lat) emphasis');
assert.equal(one('Bent Over Barbell Row', ['traps']), 'rhomboids & mid-traps (thickness)');
assert.equal(one('Barbell Shrug', ['traps']), 'upper traps');
assert.equal(one('Romanian Deadlift', ['hamstrings']), 'hip-hinge — long head & semis');
assert.equal(one('Seated Leg Curl', ['hamstrings']), 'knee-flexion — all heads incl. short head');
assert.equal(one('Seated Calf Raise', ['calves']), 'soleus (bent-knee)');
assert.equal(one('Standing Calf Raises', ['calves']), 'gastrocnemius (straight-leg)');
assert.equal(one('Barbell Hip Thrust', ['glutes']), 'glute max — hip extension');
assert.deepEqual(muscleEmphasis('Some Unknown Move', ['abdominals']), [], 'no rules for abs → empty');
assert.equal(
  muscleEmphasis('Close-Grip Barbell Bench Press', ['triceps', 'chest']).length, 2,
  'multi-muscle exercises get one emphasis per known muscle');

// body-map aggregation: intensity scales to the busiest slug
const data = toBodyData([
  { muscle: 'lats', sets: 12 },
  { muscle: 'chest', sets: 3 },
]);
const upperBack = data.find((d) => d.slug === 'upper-back');
const chest = data.find((d) => d.slug === 'chest');
assert.equal(upperBack.intensity, HEAT_COLORS.length, 'busiest muscle hits top of ramp');
assert.equal(chest.intensity, Math.ceil((3 / 12) * HEAT_COLORS.length));
assert.ok(Object.values(MUSCLE_TO_SLUG).every((s) => typeof s === 'string'));

// muscles sharing a slug merge (glutes + abductors -> gluteal)
const merged = toBodyData([{ muscle: 'glutes', sets: 4 }, { muscle: 'abductors', sets: 4 }]);
assert.equal(
  merged.find((d) => d.slug === 'gluteal').intensity, HEAT_COLORS.length,
  'glutes + abductors merge into gluteal');

// aggregateHeads: per-exercise weekly rows -> totals per head/region
const calfRows = [
  { wk: '2026-01', exercise_name: 'Seated Calf Raise', primary_muscles: '["calves"]', sets: 3 },
  { wk: '2026-02', exercise_name: 'Seated Calf Raise', primary_muscles: '["calves"]', sets: 4 },
  { wk: '2026-02', exercise_name: 'Standing Calf Raises', primary_muscles: '["calves"]', sets: 2 },
];
const calfHeads = aggregateHeads(calfRows, ['calves']);
const soleus = calfHeads.find((h) => h.head === 'soleus (bent-knee)');
assert.ok(soleus, 'seated calf raise rows land in soleus');
assert.equal(soleus.total, 7, 'soleus total sums across weeks');
assert.equal(soleus.byWeek.get('2026-01'), 3);
assert.equal(soleus.byWeek.get('2026-02'), 4);
const gastroc = calfHeads.find((h) => h.head === 'gastrocnemius (straight-leg)');
assert.equal(gastroc.total, 2);

const chestRows = [
  { wk: '2026-01', exercise_name: 'Barbell Incline Bench Press', primary_muscles: '["chest"]', sets: 3 },
  { wk: '2026-01', exercise_name: 'Barbell Incline Bench Press', primary_muscles: '["chest"]', sets: 2 },
];
const chestHeads = aggregateHeads(chestRows, ['chest']);
assert.equal(chestHeads.length, 1);
assert.equal(chestHeads[0].head, 'upper chest (clavicular head)', 'incline bench in clavicular');
assert.equal(chestHeads[0].total, 5, 'totals sum correctly');

// muscle outside RULES (e.g. forearms) yields []
assert.deepEqual(
  aggregateHeads(
    [{ wk: '2026-01', exercise_name: 'Wrist Curl', primary_muscles: '["forearms"]', sets: 3 }],
    ['forearms'],
  ),
  [],
  'muscle outside RULES yields []',
);

console.log('test-heads: all assertions passed');
