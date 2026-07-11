/**
 * Plateau detection with cross-domain context — the "unified timeline" thesis
 * made actionable. Pure module (node-testable): scripts/test-plateau.mjs.
 *
 * Detection works on a per-session best e1RM series; the context sentence
 * explains a stall with diet + body-weight data over the stall window.
 */

// Self-contained like the other node-tested pure libs (muscle-heads, plates): only
// a type import from units, which erases at build/strip time so there's no runtime
// cross-module resolution. The two tiny value helpers below mirror dates/units.
import type { Unit } from './units';

const DAY_MS = 86400000;
const KG_PER_LB = 0.45359237;

/** Local-date YYYY-MM-DD — mirrors dates.todayStr, kept local to stay self-contained. */
function localDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** kg -> display-unit string — mirrors units.formatWeight (2-dp, trailing zeros trimmed). */
function fmtWeight(kg: number, unit: Unit): string {
  const v = unit === 'kg' ? kg : kg / KG_PER_LB;
  return String(Math.round(v * 100) / 100);
}

/** One session: its local day (YYYY-MM-DD) and the best estimated 1RM logged that day. */
export type E1rmPoint = { date: string; e1rm: number };
export type Plateau = { stalledSince: string };

/**
 * Stalled when: ≥8 sessions in the last 90 days, the last session is within 21
 * days, and the max e1RM of the most recent 4 sessions is ≤ the max of the 4
 * sessions before them. Returns the stall start (date of the previous block's
 * best), or null if the lift is still progressing / has too little recent data.
 * `points` must be one entry per session day, ascending by date.
 */
export function detectPlateau(points: E1rmPoint[], now: Date = new Date()): Plateau | null {
  const since90 = localDay(new Date(now.getTime() - 90 * DAY_MS));
  const within = points.filter((p) => p.date >= since90);
  if (within.length < 8) return null;

  const last = within[within.length - 1];
  if (last.date < localDay(new Date(now.getTime() - 21 * DAY_MS))) return null;

  const prev4 = within.slice(-8, -4);
  const recent4 = within.slice(-4);
  const recentMax = Math.max(...recent4.map((p) => p.e1rm));
  const prevBest = prev4.reduce((a, b) => (b.e1rm > a.e1rm ? b : a));
  if (recentMax > prevBest.e1rm) return null;

  return { stalledSince: prevBest.date };
}

export type ContextCalorieDay = { date: string; kcal: number };
export type ContextWeighIn = { date: string; weight_kg: number };

/**
 * One-sentence cross-domain context for a stall window [stalledSince, now]:
 * avg daily kcal vs target (only days with logged calories) and 7-day-smoothed
 * body-weight change. Each clause is dropped if its data is missing; returns
 * null when neither clause can be produced. Weight math is in kg (canonical),
 * formatted to the display unit.
 */
export function stallContext(args: {
  stalledSince: string;
  now?: Date;
  unit: Unit;
  kcalTarget: number | null;
  calorieDays: ContextCalorieDay[];
  weighIns: ContextWeighIn[];
}): string | null {
  const now = args.now ?? new Date();
  const end = localDay(now);
  const inWindow = (d: string) => d >= args.stalledSince && d <= end;

  const clauses: string[] = [];

  // Diet: avg of days that actually have logged calories, vs the settings target.
  if (args.kcalTarget != null) {
    const days = args.calorieDays.filter((c) => inWindow(c.date));
    if (days.length > 0) {
      const avg = days.reduce((a, c) => a + c.kcal, 0) / days.length;
      const delta = Math.round(Math.abs(avg - args.kcalTarget) / 10) * 10;
      if (delta > 0) {
        clauses.push(`averaged ~${delta} kcal ${avg < args.kcalTarget ? 'under' : 'over'} target`);
      }
    }
  }

  // Body weight: 7-entry trailing average (matches WEIGHT_TREND_SQL's smoothing),
  // change from first to last smoothed value in the window.
  const weighs = args.weighIns.filter((w) => inWindow(w.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (weighs.length >= 2) {
    const smooth = weighs.map((_, i) => {
      const s = weighs.slice(Math.max(0, i - 6), i + 1);
      return s.reduce((a, w) => a + w.weight_kg, 0) / s.length;
    });
    const changeKg = smooth[smooth.length - 1] - smooth[0];
    if (Math.abs(changeKg) >= 0.1) {
      clauses.push(
        `${changeKg < 0 ? 'lost' : 'gained'} ${fmtWeight(Math.abs(changeKg), args.unit)} ${args.unit}`);
    }
  }

  if (clauses.length === 0) return null;
  return `You've ${clauses.join(' and ')} since the stall began.`;
}
