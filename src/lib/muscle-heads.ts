/**
 * Head/region emphasis inferred from the exercise name — the granularity the
 * seed data doesn't have. Heuristics over 873 names beat hand-tagging them.
 * Pure module (node-testable): scripts/test-heads.mjs.
 */

type Rule = { test: RegExp; emphasis: string };

const RULES: Record<string, Rule[]> = {
  chest: [
    { test: /incline/, emphasis: 'upper chest (clavicular head)' },
    { test: /decline/, emphasis: 'lower chest (costal region)' },
    { test: /fl?ye?s?\b|pec deck|crossover/, emphasis: 'chest — stretch/adduction emphasis' },
    { test: /./, emphasis: 'mid chest (sternal head)' },
  ],
  biceps: [
    { test: /preacher|concentration|spider/, emphasis: 'short head emphasis' },
    { test: /incline.*curl|drag curl/, emphasis: 'long head emphasis' },
    { test: /hammer|reverse|zottman/, emphasis: 'brachialis & brachioradialis' },
    { test: /./, emphasis: 'both heads' },
  ],
  triceps: [
    { test: /overhead|french|skull|behind|extension.*(seated|standing)|triceps extension/, emphasis: 'long head emphasis' },
    { test: /pushdown|push-down|press.?down|kickback/, emphasis: 'lateral head emphasis' },
    { test: /close.?grip|dip/, emphasis: 'all heads — heavy loading' },
    { test: /./, emphasis: 'all heads' },
  ],
  shoulders: [
    { test: /lateral raise|side raise|upright row/, emphasis: 'side (lateral) delt' },
    { test: /rear|reverse|face pull/, emphasis: 'rear (posterior) delt' },
    { test: /front raise/, emphasis: 'front (anterior) delt' },
    { test: /press/, emphasis: 'front & side delts' },
    { test: /./, emphasis: 'deltoids (overall)' },
  ],
  lats: [
    { test: /wide.?grip|pull-?up|pulldown|pull-?down/, emphasis: 'lats — width (upper lat) emphasis' },
    { test: /pullover|straight.?arm/, emphasis: 'lats — long-axis stretch' },
    { test: /row/, emphasis: 'lats — thickness (lower lat) emphasis' },
    { test: /./, emphasis: 'lats' },
  ],
  traps: [
    { test: /shrug/, emphasis: 'upper traps' },
    { test: /row|face pull|rear/, emphasis: 'rhomboids & mid-traps (thickness)' },
    { test: /./, emphasis: 'traps' },
  ],
  hamstrings: [
    { test: /romanian|rdl|stiff|good morning|deadlift/, emphasis: 'hip-hinge — long head & semis' },
    { test: /leg curl|lying curl|seated curl/, emphasis: 'knee-flexion — all heads incl. short head' },
    { test: /./, emphasis: 'hamstrings' },
  ],
  quadriceps: [
    { test: /extension|sissy/, emphasis: 'rectus femoris & vasti isolation' },
    { test: /front squat|hack/, emphasis: 'vasti (quad-dominant) emphasis' },
    { test: /squat|leg press|lunge|split/, emphasis: 'vasti — overall quad' },
    { test: /./, emphasis: 'quadriceps' },
  ],
  calves: [
    { test: /seated/, emphasis: 'soleus (bent-knee)' },
    { test: /./, emphasis: 'gastrocnemius (straight-leg)' },
  ],
  glutes: [
    { test: /thrust|bridge/, emphasis: 'glute max — hip extension' },
    { test: /abduction|clam/, emphasis: 'glute med/min — abduction' },
    { test: /./, emphasis: 'glutes' },
  ],
};

export function muscleEmphasis(exerciseName: string, primaryMuscles: string[]): string[] {
  const name = exerciseName.toLowerCase();
  const out: string[] = [];
  for (const muscle of primaryMuscles) {
    const rules = RULES[muscle];
    if (!rules) continue;
    const hit = rules.find((r) => r.test.test(name));
    if (hit) out.push(hit.emphasis);
  }
  return out;
}

export type HeadWeekly = { head: string; total: number; byWeek: Map<string, number> };

/**
 * Weekly per-exercise set counts (from MUSCLE_EXERCISE_WEEKLY_SQL) -> totals per
 * head/region emphasis. Exercises whose muscle has no RULES entry contribute
 * nothing — that's the heuristic's ceiling (per-set tagging would be the
 * upgrade path, see FEATURES.md); an exercise hitting two matched muscles in
 * the group counts once per emphasis, since it did train both.
 */
export function aggregateHeads(
  rows: { wk: string; exercise_name: string; primary_muscles: string; sets: number }[],
  muscles: string[],
): HeadWeekly[] {
  const byHead = new Map<string, HeadWeekly>();
  for (const row of rows) {
    let primary: string[];
    try {
      primary = JSON.parse(row.primary_muscles);
    } catch {
      continue;
    }
    const matched = primary.filter((m) => muscles.includes(m));
    for (const head of muscleEmphasis(row.exercise_name, matched)) {
      let entry = byHead.get(head);
      if (!entry) {
        entry = { head, total: 0, byWeek: new Map() };
        byHead.set(head, entry);
      }
      entry.total += row.sets;
      entry.byWeek.set(row.wk, (entry.byWeek.get(row.wk) ?? 0) + row.sets);
    }
  }
  return [...byHead.values()].sort((a, b) => b.total - a.total);
}
