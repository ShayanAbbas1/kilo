/**
 * Adaptive TDEE: estimate real daily energy expenditure from weigh-ins +
 * logged calories over a rolling window. Energy balance: if you ate X kcal/day
 * and your (smoothed) weight moved Δkg over d days, you burned
 * X − Δkg·7700/d kcal/day. Pure module — dates are local YYYY-MM-DD strings,
 * weights kg canonical, kcal unit-free.
 */

export type WeighInPoint = { date: string; weight_kg: number };
export type CalorieDayPoint = { date: string; kcal: number };

export type TdeeEstimate =
  | { ok: true; tdee: number; avgIntake: number; kgPerWeek: number; windowDays: number }
  | { ok: false; reason: string };

const KCAL_PER_KG = 7700;
const MIN_CALORIE_DAYS = 10;
const EDGE_DAYS = 4; // a weigh-in must sit within this many days of each window edge

const dayNum = (date: string) => Math.round(Date.parse(date + 'T00:00:00Z') / 86400000);

export function estimateTdee(
  weighIns: WeighInPoint[],
  calorieDays: CalorieDayPoint[],
  today: string,
  windowDays = 28,
): TdeeEstimate {
  const end = dayNum(today);
  const start = end - (windowDays - 1);

  // Same smoothing as the app's weight trend: trailing 7-entry moving average
  // (WEIGHT_TREND_SQL's `ROWS BETWEEN 6 PRECEDING AND CURRENT ROW`), computed
  // over all supplied weigh-ins so pre-window entries smooth the window's start.
  const sorted = [...weighIns].sort((a, b) => (a.date < b.date ? -1 : 1));
  const smoothed = sorted.map((w, i) => {
    const slice = sorted.slice(Math.max(0, i - 6), i + 1);
    return { day: dayNum(w.date), avg: slice.reduce((s, x) => s + x.weight_kg, 0) / slice.length };
  });

  const inWindow = smoothed.filter((w) => w.day >= start && w.day <= end);
  if (inWindow.length === 0) return { ok: false, reason: `No weigh-ins in the last ${windowDays} days` };
  const first = inWindow[0];
  const last = inWindow[inWindow.length - 1];
  if (first.day - start > EDGE_DAYS) {
    return { ok: false, reason: `Not enough weigh-in history yet — keep weighing in for ~${first.day - start} more days` };
  }
  if (end - last.day > EDGE_DAYS) {
    return { ok: false, reason: 'No recent weigh-in — weigh in to update the estimate' };
  }

  // Days with no entries are missing data, not 0 kcal — only logged days count.
  const logged = calorieDays.filter((c) => {
    const d = dayNum(c.date);
    return d >= start && d <= end && c.kcal > 0;
  });
  if (logged.length < MIN_CALORIE_DAYS) {
    const n = MIN_CALORIE_DAYS - logged.length;
    return { ok: false, reason: `Log ${n} more day${n === 1 ? '' : 's'} of calories to estimate your TDEE` };
  }

  const avgIntake = logged.reduce((s, c) => s + c.kcal, 0) / logged.length;
  const span = last.day - first.day; // ≥ windowDays − 2·EDGE_DAYS > 0 given the edge guards
  const deltaKg = last.avg - first.avg;
  return {
    ok: true,
    tdee: avgIntake - (deltaKg * KCAL_PER_KG) / span,
    avgIntake,
    kgPerWeek: (deltaKg / span) * 7,
    windowDays,
  };
}
