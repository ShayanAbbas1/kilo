// `node scripts/test-heads.mjs` — muscle-head heuristics + body-map aggregation
import assert from 'node:assert/strict';
import { muscleEmphasis } from '../src/lib/muscle-heads.ts';
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
assert.equal(one('Bent Over Barbell Row', ['middle back']), 'rhomboids & mid-traps (thickness)');
assert.equal(one('Romanian Deadlift', ['hamstrings']), 'hip-hinge — long head & semis');
assert.equal(one('Seated Leg Curl', ['hamstrings']), 'knee-flexion — all heads incl. short head');
assert.equal(one('Seated Calf Raise', ['calves']), 'soleus (bent-knee)');
assert.equal(one('Standing Calf Raises', ['calves']), 'gastrocnemius (straight-leg)');
assert.equal(one('Barbell Hip Thrust', ['glutes']), 'glute max — hip extension');
assert.deepEqual(muscleEmphasis('Some Unknown Move', ['abdominals']), [], 'no rules for abs → empty');
assert.equal(
  muscleEmphasis('Close-Grip Barbell Bench Press', ['triceps', 'chest']).length, 2,
  'multi-muscle exercises get one emphasis per known muscle');

// body-map aggregation: lats + middle back merge into upper-back, intensity scales to max
const data = toBodyData([
  { muscle: 'lats', sets: 6 },
  { muscle: 'middle back', sets: 6 },
  { muscle: 'chest', sets: 3 },
]);
const upperBack = data.find((d) => d.slug === 'upper-back');
const chest = data.find((d) => d.slug === 'chest');
assert.equal(upperBack.intensity, HEAT_COLORS.length, 'busiest muscle hits top of ramp');
assert.equal(chest.intensity, Math.ceil((3 / 12) * HEAT_COLORS.length));
assert.ok(Object.values(MUSCLE_TO_SLUG).every((s) => typeof s === 'string'));

console.log('test-heads: all assertions passed');
