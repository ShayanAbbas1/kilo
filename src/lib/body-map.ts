// type-only: keeps this module runtime-free so node can test it
import type { ExtendedBodyPart, Slug } from 'react-native-body-highlighter';

/** free-exercise-db muscle names → body-highlighter slugs */
export const MUSCLE_TO_SLUG: Record<string, Slug> = {
  abdominals: 'abs',
  // ponytail: abductors = glute med/min territory; close enough on a body map
  abductors: 'gluteal',
  adductors: 'adductors',
  biceps: 'biceps',
  calves: 'calves',
  chest: 'chest',
  // erector spinae — no dedicated slug; the lower-back region is the correct visual
  erectors: 'lower-back',
  forearms: 'forearm',
  glutes: 'gluteal',
  hamstrings: 'hamstring',
  lats: 'upper-back',
  neck: 'neck',
  quadriceps: 'quadriceps',
  shoulders: 'deltoids',
  traps: 'trapezius',
  triceps: 'triceps',
};

/** slug → the fexdb muscles it aggregates (for drill-down) */
export const SLUG_TO_MUSCLES: Record<string, string[]> = Object.entries(MUSCLE_TO_SLUG)
  .reduce((acc, [muscle, slug]) => {
    (acc[slug] ??= []).push(muscle);
    return acc;
  }, {} as Record<string, string[]>);

/** 5-step heat ramp, pale → red. Absolute colors, readable on both themes. */
export const HEAT_COLORS = ['#FDD9A0', '#FDB863', '#F9824A', '#EE5A36', '#D7263D'];

/**
 * Aggregate {muscle, sets} rows into body-highlighter data with intensity
 * 1..HEAT_COLORS.length scaled against the busiest muscle.
 */
export function toBodyData(rows: { muscle: string; sets: number }[]): ExtendedBodyPart[] {
  const bySlug = new Map<Slug, number>();
  for (const r of rows) {
    const slug = MUSCLE_TO_SLUG[r.muscle];
    if (!slug) continue;
    bySlug.set(slug, (bySlug.get(slug) ?? 0) + r.sets);
  }
  const max = Math.max(...bySlug.values(), 1);
  return [...bySlug.entries()].map(([slug, sets]) => ({
    slug,
    intensity: Math.max(1, Math.ceil((sets / max) * HEAT_COLORS.length)),
  }));
}
