// `node scripts/test-calendar.mjs` — calendar grid + week-streak math
import assert from 'node:assert/strict';
import { monthGrid, weekKey, weekStreaks } from '../src/lib/calendar.ts';

// --- monthGrid ---
// Feb 2026 starts on a Sunday (Mon-first grid → 6 leading nulls in row 1).
const feb2026 = monthGrid(2026, 1);
assert.deepEqual(feb2026[0], [null, null, null, null, null, null, '2026-02-01']);
assert.equal(feb2026[0].length, 7, 'every week row has 7 cells');
assert.equal(feb2026.flat().filter((d) => d !== null).length, 28, 'Feb 2026 has 28 days');
assert.equal(feb2026.flat().filter(Boolean).at(-1), '2026-02-28');

// July 2026 starts on a Wednesday → 2 leading nulls.
const jul2026 = monthGrid(2026, 6);
assert.deepEqual(jul2026[0].slice(0, 2), [null, null]);
assert.equal(jul2026[0][2], '2026-07-01');

// --- weekKey ---
assert.equal(weekKey('2026-07-04'), '2026-06-29', 'Saturday belongs to Monday of that week');
assert.equal(weekKey('2026-06-29'), '2026-06-29', 'Monday is its own week key');
// Year boundary: Jan 1 2026 is a Thursday → week key falls back into Dec 2025.
assert.equal(weekKey('2026-01-01'), '2025-12-29');

// --- weekStreaks ---
// today = 2026-07-02 (Thursday), whose week starts Monday 2026-06-29.
// Two consecutive prior weeks with a workout, nothing logged yet this week —
// current still counts back from last week instead of zeroing.
const s1 = weekStreaks(new Set(['2026-06-15', '2026-06-22']), '2026-07-02');
assert.equal(s1.current, 2, 'no workout yet this week still counts back from last week');
assert.equal(s1.longest, 2);

// This week already has a workout (2026-07-01 falls in the 06-29 week) → it counts too.
const s2 = weekStreaks(new Set(['2026-06-15', '2026-06-22', '2026-07-01']), '2026-07-02');
assert.equal(s2.current, 3);
assert.equal(s2.longest, 3);

// Gap week (06-22 and 06-29 both empty) resets current but longest remembers the earlier run.
const s3 = weekStreaks(
  new Set(['2026-06-01', '2026-06-08', '2026-06-15']), '2026-07-02',
);
assert.equal(s3.current, 0, 'a full empty week between last workout and today resets current');
assert.equal(s3.longest, 3, 'the June 1-15 run of 3 is remembered as longest');

// Empty set → zero everything.
const s4 = weekStreaks(new Set(), '2026-07-02');
assert.equal(s4.current, 0);
assert.equal(s4.longest, 0);

console.log('test-calendar: all assertions passed');
