// `node scripts/test-plateau.mjs` — plateau detection + cross-domain context
import assert from 'node:assert/strict';
import { detectPlateau, stallContext } from '../src/lib/plateau.ts';

const NOW = new Date('2026-07-11T12:00:00');
const pt = (date, e1rm) => ({ date, e1rm });

// Near-daily weigh-ins whose 7-entry-smoothed change over the window is exactly
// -1.8 kg: one entry at 82.0 then seven at 80.2 (trailing-7 avg settles on 80.2).
const WEIGH_IN_DATES = ['06-11', '06-15', '06-18', '06-21', '06-24', '06-27', '06-30', '07-03'];
const cutWeighIns = WEIGH_IN_DATES.map((md, i) => ({
  date: `2026-${md}`, weight_kg: i === 0 ? 82.0 : 80.2,
}));

// --- detection: a genuine stall ---
// prev block best 103 @ 2026-06-10; recent block max 103 (not >), so stalled.
const stalledSeries = [
  pt('2026-05-20', 100), pt('2026-05-27', 102), pt('2026-06-03', 101), pt('2026-06-10', 103),
  pt('2026-06-17', 102), pt('2026-06-24', 100), pt('2026-07-01', 103), pt('2026-07-08', 101),
];
assert.deepEqual(detectPlateau(stalledSeries, NOW), { stalledSince: '2026-06-10' },
  'stall start is the previous block best date');

// --- still progressing: recent max beats prev max -> not stalled ---
const progressing = stalledSeries.map((p, i) => (i === 6 ? pt(p.date, 106) : p));
assert.equal(detectPlateau(progressing, NOW), null, 'a new peak in recent block is not a stall');

// --- too few sessions in 90 days ---
assert.equal(detectPlateau(stalledSeries.slice(1), NOW), null, '7 sessions < 8 required');

// --- last session too old (>21 days) -> not flagged, even if flat ---
const stale = [
  pt('2026-04-01', 100), pt('2026-04-08', 102), pt('2026-04-15', 101), pt('2026-04-22', 103),
  pt('2026-04-29', 102), pt('2026-05-06', 100), pt('2026-05-13', 103), pt('2026-05-20', 101),
];
assert.equal(detectPlateau(stale, NOW), null, 'no session within 21 days -> not current');

// --- sessions older than 90 days are excluded from the window ---
const withOld = [pt('2026-01-01', 200), ...stalledSeries];
assert.deepEqual(detectPlateau(withOld, NOW), { stalledSince: '2026-06-10' },
  'a >90d-old peak does not defeat the stall');

// --- context: both clauses ---
const both = stallContext({
  stalledSince: '2026-06-10',
  now: NOW,
  unit: 'kg',
  kcalTarget: 2500,
  calorieDays: [
    { date: '2026-06-01', kcal: 3000 }, // outside window, ignored
    { date: '2026-06-15', kcal: 2100 },
    { date: '2026-06-20', kcal: 2100 },
    { date: '2026-07-01', kcal: 2100 },
  ],
  weighIns: [{ date: '2026-06-01', weight_kg: 90 }, ...cutWeighIns], // 06-01 outside window
});
assert.equal(both,
  "You've averaged ~400 kcal under target and lost 1.8 kg since the stall began.");

// --- context: only weight (no target set) ---
assert.equal(
  stallContext({
    stalledSince: '2026-06-10', now: NOW, unit: 'kg', kcalTarget: null,
    calorieDays: [{ date: '2026-06-15', kcal: 2100 }],
    weighIns: cutWeighIns,
  }),
  "You've lost 1.8 kg since the stall began.",
  'no kcal target -> diet clause dropped');

// --- context: only calories (no weigh-ins) ---
assert.equal(
  stallContext({
    stalledSince: '2026-06-10', now: NOW, unit: 'kg', kcalTarget: 2500,
    calorieDays: [{ date: '2026-06-15', kcal: 2900 }],
    weighIns: [],
  }),
  "You've averaged ~400 kcal over target since the stall began.",
  'no weigh-ins -> weight clause dropped, "over" when above target');

// --- context: no data at all -> null ---
assert.equal(
  stallContext({
    stalledSince: '2026-06-10', now: NOW, unit: 'kg', kcalTarget: null,
    calorieDays: [], weighIns: [],
  }),
  null, 'nothing to say -> null');

// --- context: weight formatted to display unit (kg canonical in math) ---
const lbs = stallContext({
  stalledSince: '2026-06-10', now: NOW, unit: 'lbs', kcalTarget: null,
  calorieDays: [],
  weighIns: cutWeighIns,
});
assert.match(lbs, /lost 3\.97 lbs/, '1.8 kg loss shown in lbs');

console.log('test-plateau: all assertions passed');
