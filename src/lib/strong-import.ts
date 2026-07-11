/**
 * Import workout history from a Strong app CSV export.
 * Pure parsing/matching/planning — no expo imports, so scripts/test-strong-import.mjs
 * can run it under node. DB insertion lives in src/db/queries.ts (importStrongWorkouts).
 */

export type StrongSet = {
  position: number;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
  setType: 'warmup' | 'working' | 'failure';
};

export type StrongExercise = { name: string; notes: string | null; sets: StrongSet[] };

export type StrongWorkout = {
  /** Deterministic id derived from the CSV's raw local datetime — the dedup key. */
  id: string;
  startedAt: string; // ISO
  finishedAt: string; // ISO
  name: string | null;
  notes: string | null;
  exercises: StrongExercise[];
};

const LBS_TO_KG = 0.45359237;

/** Minimal quoted-CSV row splitter; Strong quotes every field. Handles "" escapes. */
function splitRow(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delim) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const num = (s: string | undefined): number | null => {
  const n = parseFloat(s ?? '');
  return isNaN(n) ? null : n;
};

/** Local naive "YYYY-MM-DD HH:MM:SS" → ISO, interpreted in the device timezone. */
const toIso = (local: string) => new Date(local.replace(' ', 'T')).toISOString();

export function parseStrongCsv(text: string): StrongWorkout[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) throw new Error('Empty file');
  const delim = lines[0].includes(';') ? ';' : ',';
  const header = splitRow(lines[0], delim);
  const col = (prefix: string) => header.findIndex((h) => h.toLowerCase().startsWith(prefix));
  const iDate = col('date');
  const iName = col('workout name');
  const iDur = col('duration');
  const iEx = col('exercise name');
  const iOrder = col('set order');
  const iWeight = col('weight');
  const iReps = col('reps');
  const iRpe = col('rpe');
  const iNotes = col('notes');
  const iWNotes = col('workout notes');
  if (iDate < 0 || iEx < 0 || iOrder < 0) throw new Error('Not a Strong CSV export');
  // header says which unit the weight column is in ("Weight (kg)" / "Weight (lbs)")
  const weightFactor = /lb/i.test(header[iWeight] ?? '') ? LBS_TO_KG : 1;

  const workouts = new Map<string, StrongWorkout & { exByName: Map<string, StrongExercise> }>();
  for (const line of lines.slice(1)) {
    const f = splitRow(line, delim);
    const date = f[iDate];
    if (!date) continue;
    let w = workouts.get(date);
    if (!w) {
      const startedAt = toIso(date);
      const durSec = num(f[iDur]) ?? 0;
      w = {
        id: `strong_${date}`,
        startedAt,
        finishedAt: new Date(new Date(startedAt).getTime() + durSec * 1000).toISOString(),
        name: f[iName]?.trim() || null,
        notes: f[iWNotes]?.trim() || null,
        exercises: [],
        exByName: new Map(),
      };
      workouts.set(date, w);
    }
    const exName = f[iEx]?.trim();
    if (!exName) continue;
    let ex = w.exByName.get(exName);
    if (!ex) {
      ex = { name: exName, notes: null, sets: [] };
      w.exByName.set(exName, ex);
      w.exercises.push(ex);
    }
    const order = f[iOrder]?.trim() ?? '';
    const note = f[iNotes]?.trim();
    if (/^rest timer$/i.test(order)) continue;
    if (/^note$/i.test(order)) {
      if (note) ex.notes = ex.notes ? `${ex.notes}\n${note}` : note;
      continue;
    }
    // set rows: numeric order, or W/F-prefixed (warmup/failure) in some Strong versions
    const setType = /^w/i.test(order) ? 'warmup' : /^f/i.test(order) ? 'failure' : 'working';
    if (setType === 'working' && !/^\d+$/.test(order)) continue; // unknown pseudo-row
    const weight = num(f[iWeight]);
    const reps = num(f[iReps]);
    if (weight === null && reps === null) continue;
    ex.sets.push({
      position: ex.sets.length + 1,
      weightKg: weight === null ? null : Math.round(weight * weightFactor * 1000) / 1000,
      reps: reps === null ? null : Math.round(reps),
      rpe: num(f[iRpe]),
      setType,
    });
    if (note) ex.notes = ex.notes ? `${ex.notes}\n${note}` : note;
  }

  return [...workouts.values()]
    .map(({ exByName: _, ...w }) => ({ ...w, exercises: w.exercises.filter((e) => e.sets.length) }))
    .filter((w) => w.exercises.length)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

// ---------- exercise-name matching ----------

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Order-insensitive, lightly-singularized token key: "Lat Pulldowns (Cable)" ≈ "Cable Lat Pulldown". */
const tokenKey = (s: string) =>
  [...new Set(norm(s).split(' ').map((t) => (t.length > 3 ? t.replace(/s$/, '') : t)))]
    .sort()
    .join(' ');

/** Strong's "(Equipment)" suffix → Kilo equipment value, for created custom exercises. */
export function inferEquipment(strongName: string): string {
  const paren = /\(([^)]*)\)/.exec(strongName)?.[1]?.toLowerCase() ?? '';
  if (paren.includes('smith') || paren.includes('machine') || paren.includes('plate loaded')) return 'machine';
  if (paren.includes('barbell')) return 'barbell';
  if (paren.includes('dumbbell')) return 'dumbbell';
  if (paren.includes('cable')) return 'cable';
  if (paren.includes('kettlebell')) return 'kettlebells';
  if (paren.includes('bodyweight') || paren.includes('body weight')) return 'body only';
  if (paren.includes('band')) return 'bands';
  return 'other';
}

export type ExerciseRef = { id: string; name: string };

/**
 * Conservative matcher: exact normalized name, then unique token-set matches with the
 * "(Equipment)" suffix folded in or stripped. Ambiguous or fuzzy-only → null (ask the user);
 * a wrong auto-match pollutes stats, a missed one just costs a tap.
 */
export function buildMatcher(library: ExerciseRef[]): (strongName: string) => string | null {
  const byNorm = new Map<string, string>();
  const byToken = new Map<string, string | null>(); // null = ambiguous
  for (const e of library) {
    if (!byNorm.has(norm(e.name))) byNorm.set(norm(e.name), e.id);
    const k = tokenKey(e.name);
    byToken.set(k, byToken.has(k) ? null : e.id);
  }
  return (strongName: string) => {
    const exact = byNorm.get(norm(strongName));
    if (exact) return exact;
    const paren = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(strongName);
    const candidates = paren
      ? [strongName, `${paren[2]} ${paren[1]}`, paren[1]]
      : [strongName];
    for (const c of candidates) {
      const hit = byToken.get(tokenKey(c));
      if (hit) return hit;
    }
    return null;
  };
}

// ---------- import plan (row objects, inserted verbatim by importStrongWorkouts) ----------

export type ImportPlan = {
  workouts: Record<string, string | number | null>[];
  workout_exercises: Record<string, string | number | null>[];
  sets: Record<string, string | number | null>[];
};

/**
 * resolve: Strong exercise name → Kilo exercises.id (matched or freshly-created custom).
 * All ids are deterministic from the workout's dedup key, so a re-import produces
 * identical rows and the workout-level skip keeps children consistent.
 */
export function buildImportPlan(
  workouts: StrongWorkout[], resolve: (name: string) => string,
): ImportPlan {
  const plan: ImportPlan = { workouts: [], workout_exercises: [], sets: [] };
  for (const w of workouts) {
    plan.workouts.push({
      id: w.id, started_at: w.startedAt, finished_at: w.finishedAt,
      name: w.name, notes: w.notes,
    });
    w.exercises.forEach((ex, i) => {
      const weId = `${w.id}_e${i + 1}`;
      plan.workout_exercises.push({
        id: weId, workout_id: w.id, exercise_id: resolve(ex.name),
        position: i + 1, notes: ex.notes, superset_with_next: 0,
      });
      for (const s of ex.sets) {
        plan.sets.push({
          id: `${weId}_s${s.position}`, workout_exercise_id: weId, position: s.position,
          weight_kg: s.weightKg, reps: s.reps, set_type: s.setType,
          completed: 1, completed_at: w.finishedAt, rpe: s.rpe,
        });
      }
    });
  }
  return plan;
}
