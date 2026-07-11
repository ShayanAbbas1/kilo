// `node scripts/test-projection.mjs` — goal projection regression math
import assert from 'node:assert/strict';
import { projectToTarget } from '../src/lib/projection.ts';
import { todayStr } from '../src/lib/dates.ts';

// 8 points, 7 days apart — same date fixture reused across scenarios below.
const DATES = ['2026-05-01', '2026-05-08', '2026-05-15', '2026-05-22', '2026-05-29',
  '2026-06-05', '2026-06-12', '2026-06-19'];
const series = (values) => DATES.map((date, i) => ({ date, value: values[i] }));

const closeTo = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.001, `${msg}: ${a} !~ ${b}`);

// --- on pace: losing 0.5kg/week toward a lower target ---
const losing = series([90, 89.5, 89, 88.5, 88, 87.5, 87, 86.5]);
const onPace = projectToTarget(losing, 80, '2026-06-19');
closeTo(onPace.ratePerWeek, -0.5, 'losing 0.5kg/week');
const expectedDate = new Date(2026, 4, 1);
expectedDate.setDate(expectedDate.getDate() + 140); // (90-80)/(0.5/7) = 140 days from the first point
assert.equal(onPace.projectedDate, todayStr(expectedDate), 'projects the date the line crosses 80kg');

// same trend, but "today" is long after the crossing date — still reports it (only
// the far-future case gets capped away, not the already-past one).
const stillReported = projectToTarget(losing, 80, '2027-06-19');
assert.equal(stillReported.projectedDate, onPace.projectedDate);

// --- moving away: rising while the goal is below the current value ---
const rising = series([90, 90.5, 91, 91.5, 92, 92.5, 93, 93.5]);
const away = projectToTarget(rising, 80, '2026-06-19');
closeTo(away.ratePerWeek, 0.5, 'rising 0.5kg/week');
assert.equal(away.projectedDate, null, 'trending away from the target -> no projected date');

// --- flat: no real trend either way ---
const flat = projectToTarget(series([82, 82, 82, 82, 82, 82, 82, 82]), 80, '2026-06-19');
assert.equal(flat.ratePerWeek, 0);
assert.equal(flat.projectedDate, null, 'flat trend -> no projected date');

// --- capped: real but glacial progress puts the crossing years out ---
const glacial = series([70, 70.02, 70.04, 70.06, 70.08, 70.1, 70.12, 70.14]);
const capped = projectToTarget(glacial, 80, '2026-06-19');
closeTo(capped.ratePerWeek, 0.02, 'slow but positive rate');
assert.equal(capped.projectedDate, null, 'crossing is ~9 years out -> capped to nothing');

// --- not enough data ---
assert.equal(projectToTarget([], 80), null, 'no points -> null');
assert.equal(projectToTarget([{ date: '2026-01-01', value: 80 }], 80), null, 'one point -> null');
assert.equal(
  projectToTarget(
    [{ date: '2026-01-01', value: 80 }, { date: '2026-01-01', value: 82 }], 80,
  ),
  null,
  'same-day points -> no time axis to regress over',
);

console.log('test-projection: all assertions passed');
