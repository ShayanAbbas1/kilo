// `node scripts/test-tdee.mjs` — adaptive TDEE estimation
import assert from 'node:assert/strict';
import { estimateTdee } from '../src/lib/tdee.ts';

const TODAY = '2026-07-11';
const day = (offset) => {
  const d = new Date(Date.parse(TODAY + 'T00:00:00Z') - offset * 86400000);
  return d.toISOString().slice(0, 10);
};
// daily series over the last n days, newest offset 0
const daily = (n, fn) => Array.from({ length: n }, (_, i) => fn(n - 1 - i)); // offset desc → dates asc

// Maintenance: flat weight, constant intake → TDEE == intake, trend 0
{
  const est = estimateTdee(
    daily(28, (o) => ({ date: day(o), weight_kg: 80 })),
    daily(28, (o) => ({ date: day(o), kcal: 2500 })),
    TODAY,
  );
  assert.ok(est.ok);
  assert.equal(Math.round(est.tdee), 2500);
  assert.equal(est.kgPerWeek, 0);
  assert.equal(Math.round(est.avgIntake), 2500);
}

// Cut: losing 0.1 kg/day on 2000 kcal → TDEE ≈ 2000 + smoothedΔ·7700/span
{
  const est = estimateTdee(
    daily(28, (o) => ({ date: day(o), weight_kg: 80 - 0.1 * (27 - o) })), // 80 → 77.3 ascending by date
    daily(28, (o) => ({ date: day(o), kcal: 2000 })),
    TODAY,
  );
  assert.ok(est.ok);
  // smoothed first point = 80 (no earlier entries), smoothed last = avg of final 7 = 77.3 + 0.3
  const expectedDelta = 77.6 - 80;
  assert.ok(Math.abs(est.tdee - (2000 - (expectedDelta * 7700) / 27)) < 1e-9, `tdee ${est.tdee}`);
  assert.ok(est.kgPerWeek < -0.6 && est.kgPerWeek > -0.7, `kgPerWeek ${est.kgPerWeek}`);
}

// Pre-window weigh-ins smooth the window's first point (linear loss → trailing avg sits 0.3 above raw at both ends)
{
  const est = estimateTdee(
    daily(40, (o) => ({ date: day(o), weight_kg: 84 - 0.1 * (39 - o) })),
    daily(28, (o) => ({ date: day(o), kcal: 2000 })),
    TODAY,
  );
  assert.ok(est.ok);
  assert.ok(Math.abs(est.kgPerWeek - -0.7) < 1e-9, `fully-smoothed linear loss is exactly −0.7 kg/wk, got ${est.kgPerWeek}`);
}

// Too few calorie days → null-style result with a "log N more days" reason
{
  const est = estimateTdee(
    daily(28, (o) => ({ date: day(o), weight_kg: 80 })),
    daily(6, (o) => ({ date: day(o), kcal: 2500 })),
    TODAY,
  );
  assert.equal(est.ok, false);
  assert.match(est.reason, /Log 4 more days of calories/);
}

// Zero-kcal days are missing data: don't count toward the 10, don't drag the average
{
  const cals = [
    ...daily(12, (o) => ({ date: day(o), kcal: 3000 })),
    ...daily(10, (o) => ({ date: day(o + 12), kcal: 0 })),
  ];
  const est = estimateTdee(daily(28, (o) => ({ date: day(o), weight_kg: 80 })), cals, TODAY);
  assert.ok(est.ok);
  assert.equal(Math.round(est.avgIntake), 3000, 'zero days excluded from the intake average');
}

// No weigh-in near the window start → insufficient
{
  const est = estimateTdee(
    daily(10, (o) => ({ date: day(o), weight_kg: 80 })),
    daily(28, (o) => ({ date: day(o), kcal: 2500 })),
    TODAY,
  );
  assert.equal(est.ok, false);
  assert.match(est.reason, /keep weighing in/);
}

// No weigh-in near the window end → insufficient
{
  const est = estimateTdee(
    daily(22, (o) => ({ date: day(o + 6), weight_kg: 80 })),
    daily(28, (o) => ({ date: day(o), kcal: 2500 })),
    TODAY,
  );
  assert.equal(est.ok, false);
  assert.match(est.reason, /No recent weigh-in/);
}

// No weigh-ins at all
assert.equal(estimateTdee([], [], TODAY).ok, false);

console.log('test-tdee: all assertions passed');
