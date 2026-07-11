// `node scripts/test-weekly-report.mjs` — weekly report card's pure date/aggregation helpers
import assert from 'node:assert/strict';
import {
  addDaysToDay, computeMuscleGaps, weekAgoAvg7, weekBounds, withinWeek,
} from '../src/lib/weekly-report.ts';

function localDay(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// --- weekBounds ---
// 2026-07-04 is a Saturday (see test-calendar.mjs) -> its Monday is 2026-06-29.
const bounds = weekBounds(new Date(2026, 6, 4));
assert.equal(localDay(bounds.thisWeekStartIso), '2026-06-29');
assert.equal(localDay(bounds.lastWeekStartIso), '2026-06-22', '7 days before this week');
assert.equal(localDay(bounds.fourWeeksAgoIso), '2026-06-01', '28 days before this week');

// --- addDaysToDay ---
assert.equal(addDaysToDay('2026-06-29', -7), '2026-06-22');
assert.equal(addDaysToDay('2026-01-01', -1), '2025-12-31', 'year rollover');

// --- withinWeek ---
const days = [{ date: '2026-06-28' }, { date: '2026-06-29' }, { date: '2026-07-05' }, { date: '2026-07-06' }];
assert.deepEqual(
  withinWeek(days, '2026-06-29', '2026-07-06'),
  [{ date: '2026-06-29' }, { date: '2026-07-05' }],
  'end day is exclusive',
);

// --- computeMuscleGaps ---
// today fixed at 2026-07-11. chest trained today (no gap), back 15d ago (stale + zero-this-week
// -> "stale" wins the label), legs 20d ago (same), arms untrained in the last 4 weeks but has a
// stale all-time last-trained date (30d) -> still flagged.
const gaps = computeMuscleGaps(
  ['chest', 'back', 'legs'], // trained in the prior 4 weeks
  ['chest'], // trained this week
  [
    { muscle: 'chest', last_trained: '2026-07-11' },
    { muscle: 'back', last_trained: '2026-06-26' },
    { muscle: 'legs', last_trained: '2026-06-21' },
    { muscle: 'arms', last_trained: '2026-06-11' },
  ],
  '2026-07-11',
);
assert.deepEqual(gaps.map((g) => g.muscle), ['arms', 'legs', 'back'], 'sorted by days-since desc');
assert.ok(gaps.every((g) => g.reason === 'stale'));
assert.equal(gaps.find((g) => g.muscle === 'back').daysSince, 15);
assert.equal(gaps.find((g) => g.muscle === 'legs').daysSince, 20);
assert.equal(gaps.find((g) => g.muscle === 'arms').daysSince, 30);

// a muscle trained in the prior 4 weeks, zero this week, but too recent to be "stale" yet
const freshGap = computeMuscleGaps(
  ['shoulders'], [], [{ muscle: 'shoulders', last_trained: '2026-07-05' }], '2026-07-11',
);
assert.deepEqual(freshGap, [{ muscle: 'shoulders', daysSince: 6, reason: 'zero-this-week' }]);

// nothing recent, nothing stale -> no gaps
assert.deepEqual(
  computeMuscleGaps(['chest'], ['chest'], [{ muscle: 'chest', last_trained: '2026-07-11' }], '2026-07-11'),
  [],
);

// --- weekAgoAvg7 ---
const weightRows = [
  { date: '2026-07-11', avg7: 80.0 },
  { date: '2026-07-10', avg7: 80.2 },
  { date: '2026-07-04', avg7: 81.0 },
  { date: '2026-07-03', avg7: 81.2 },
];
assert.deepEqual(weekAgoAvg7(weightRows), { now: 80.0, weekAgo: 81.0 });
assert.deepEqual(weekAgoAvg7([]), { now: null, weekAgo: null });
// no entry old enough to be "a week ago" -> weekAgo is null, not a wrong nearby value
assert.deepEqual(
  weekAgoAvg7([{ date: '2026-07-11', avg7: 80.0 }]),
  { now: 80.0, weekAgo: null },
);

console.log('test-weekly-report: all assertions passed');
