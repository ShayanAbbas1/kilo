/**
 * Linear regression over a (date, value) series -> rate per week + the projected
 * date of reaching a target. Pure module (node-testable): scripts/test-projection.mjs.
 * Self-contained (no cross-lib value imports) like the other pure lib modules here,
 * so it stays runnable directly by node without a bundler.
 */

export type SeriesPoint = { date: string; value: number };
export type Projection = { ratePerWeek: number; projectedDate: string | null };

const MAX_PROJECTION_DAYS = 365;
// ponytail: below this the line is noise, not a trend — no projection, whatever the direction.
const FLAT_RATE_PER_WEEK = 0.01;
const MS_PER_DAY = 86400000;

function parseDay(date: string): number {
  return new Date(date + 'T00:00:00').getTime();
}

/** YYYY-MM-DD in local time — same format as lib/dates.ts's todayStr. */
function formatDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Least-squares line over date/value points -> weekly rate of change and the date
 * the line crosses `target`. Returns null projectedDate when the trend is ~flat,
 * moving away from the target, or would only reach it more than a year from `today`.
 * `today` defaults to the real current date; pass it explicitly in tests.
 */
export function projectToTarget(
  points: SeriesPoint[], target: number, today: string = formatDay(new Date()),
): Projection | null {
  if (points.length < 2) return null;
  const x0 = parseDay(points[0].date);
  const xs = points.map((p) => (parseDay(p.date) - x0) / MS_PER_DAY);
  const ys = points.map((p) => p.value);
  const n = xs.length;
  const xMean = xs.reduce((a, x) => a + x, 0) / n;
  const yMean = ys.reduce((a, y) => a + y, 0) / n;
  const denom = xs.reduce((a, x) => a + (x - xMean) ** 2, 0);
  if (denom === 0) return null; // every point on the same day — no time axis to regress over
  const slope = xs.reduce((a, x, i) => a + (x - xMean) * (ys[i] - yMean), 0) / denom;
  const intercept = yMean - slope * xMean;
  const ratePerWeek = slope * 7;

  if (Math.abs(ratePerWeek) < FLAT_RATE_PER_WEEK) return { ratePerWeek, projectedDate: null };

  const lastFitted = intercept + slope * xs[n - 1];
  const movingAway = target > lastFitted ? slope <= 0 : slope >= 0;
  if (movingAway) return { ratePerWeek, projectedDate: null };

  const xTarget = (target - intercept) / slope; // days since points[0]
  const targetMs = x0 + xTarget * MS_PER_DAY;
  const daysFromToday = (targetMs - parseDay(today)) / MS_PER_DAY;
  if (daysFromToday > MAX_PROJECTION_DAYS) return { ratePerWeek, projectedDate: null };

  return { ratePerWeek, projectedDate: formatDay(new Date(targetMs)) };
}
