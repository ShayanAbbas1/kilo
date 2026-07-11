/**
 * Weekly report card — pure date/aggregation helpers (node-testable, no RN
 * imports, no runtime cross-file imports — same reason calendar.ts/plates.ts
 * stay self-contained: node's type-stripping only erases `import type`, so a
 * value import would break `node scripts/test-weekly-report.mjs`). SQL and
 * screen wiring stay in db/queries.ts and app/report.tsx; the Monday-start
 * calc mirrors lib/dates.ts's startOfWeekIso (same logic, kept separate here).
 */

export type WeekBounds = {
  thisWeekStartIso: string;
  lastWeekStartIso: string;
  fourWeeksAgoIso: string;
};

/**
 * This week's Monday-start, last week's Monday-start, and 4 weeks back — all
 * ISO, ready to feed straight into the existing `since`-style queries
 * (getPeriodSummary, getMuscleSets, ...).
 */
export function weekBounds(ref: Date = new Date()): WeekBounds {
  const start = new Date(ref);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const thisWeekStartIso = start.toISOString();
  const d = new Date(thisWeekStartIso);
  d.setDate(d.getDate() - 7);
  const lastWeekStartIso = d.toISOString();
  d.setDate(d.getDate() - 21);
  const fourWeeksAgoIso = d.toISOString();
  return { thisWeekStartIso, lastWeekStartIso, fourWeeksAgoIso };
}

/** `dayStr` + `days` calendar days, both YYYY-MM-DD local day strings. */
export function addDaysToDay(dayStr: string, days: number): string {
  const [y, m, d] = dayStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Rows within [startDay, endDay) — slices an existing since-less query (e.g. calorie days) down to one week. */
export function withinWeek<T extends { date: string }>(
  rows: T[], startDay: string, endDay: string,
): T[] {
  return rows.filter((r) => r.date >= startDay && r.date < endDay);
}

export type MuscleGap = { muscle: string; daysSince: number | null; reason: 'zero-this-week' | 'stale' };

function daysBetween(dayStr: string, todayDayStr: string): number {
  const [y1, m1, d1] = dayStr.split('-').map(Number);
  const [y2, m2, d2] = todayDayStr.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/**
 * Muscle groups worth flagging: trained in the prior 4 weeks but with 0 sets
 * this week, or not trained in `staleDays`+ days (a muscle can hit both —
 * "stale" wins the label since it's the more urgent gap).
 */
export function computeMuscleGaps(
  recentMuscles: string[],
  thisWeekMuscles: string[],
  lastTrained: { muscle: string; last_trained: string }[],
  todayDayStr: string,
  staleDays = 14,
): MuscleGap[] {
  const thisWeekSet = new Set(thisWeekMuscles);
  const recentSet = new Set(recentMuscles);
  const lastTrainedMap = new Map(lastTrained.map((r) => [r.muscle, r.last_trained]));
  const candidates = new Set([...recentSet, ...lastTrainedMap.keys()]);

  const gaps: MuscleGap[] = [];
  for (const muscle of candidates) {
    const last = lastTrainedMap.get(muscle) ?? null;
    const daysSince = last ? daysBetween(last, todayDayStr) : null;
    const stale = daysSince != null && daysSince >= staleDays;
    const zeroThisWeek = recentSet.has(muscle) && !thisWeekSet.has(muscle);
    if (stale || zeroThisWeek) {
      gaps.push({ muscle, daysSince, reason: stale ? 'stale' : 'zero-this-week' });
    }
  }
  return gaps.sort((a, b) => (b.daysSince ?? -1) - (a.daysSince ?? -1));
}

/**
 * Body-weight 7-day-avg now vs ~7 days ago, from getWeightTrend rows (date
 * DESC). "Ago" matches the closest entry on/before the target day, same
 * closest-available convention as the rest of the app's weight deltas.
 */
export function weekAgoAvg7<T extends { date: string; avg7: number }>(
  rows: T[],
): { now: number | null; weekAgo: number | null } {
  if (rows.length === 0) return { now: null, weekAgo: null };
  const now = rows[0].avg7;
  const targetDay = addDaysToDay(rows[0].date, -7);
  const weekAgoRow = rows.find((r) => r.date <= targetDay);
  return { now, weekAgo: weekAgoRow?.avg7 ?? null };
}
