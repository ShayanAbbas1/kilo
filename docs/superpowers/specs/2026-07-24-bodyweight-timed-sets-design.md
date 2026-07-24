# Bodyweight and timed sets

**Date:** 2026-07-24
**Status:** approved, ready to implement

## Problem

Kilo models every set as `weight_kg × reps`. Two kinds of exercise don't fit:

1. **Bodyweight** — pull-ups, dips, push-ups. They log fine today (`weight_kg` is already
   nullable, and the logging screen accepts blanks) but contribute **zero tonnage**, so 20 sets
   of pull-ups read as no work done in every volume chart. They're also invisible to the
   progression graph, which filters `WHERE s.weight_kg IS NOT NULL`.
2. **Timed** — planks, dead hangs, wall sits. There is no duration column anywhere, so they
   can't be logged at all.

Cardio is explicitly out of scope (`FEATURES.md` non-goals: "No cardio/GPS tracking").

## Model

Follow Strong: a bodyweight exercise labels its weight field **`+kg`** and stores *added* load.
Effective load is `bodyweight + added`, so a pure bodyweight set is `+0` and a weighted pull-up
is `+20`. This gives weighted variants for free without splitting exercise history.

**Bodyweight and timed are orthogonal**, not two values of one enum — a dead hang is both, a
farmer's walk is timed but externally loaded, a pull-up is bodyweight with reps, a bench press is
neither. All four combinations are real, so they are two independent booleans.

## Schema — migration v4 → v5

```sql
ALTER TABLE sets ADD COLUMN duration_seconds INTEGER;
ALTER TABLE sets ADD COLUMN bodyweight_kg REAL;
ALTER TABLE exercises ADD COLUMN is_bodyweight INTEGER NOT NULL DEFAULT 0;
ALTER TABLE exercises ADD COLUMN is_timed INTEGER NOT NULL DEFAULT 0;
```

Added as `MIGRATION_V4_SQL` in `src/db/sql.ts`, applied under `if (oldVersion < 5)` in `migrate()`
(`src/db/index.ts`), with `SCHEMA_VERSION = 5`. The same four columns go into `SCHEMA_SQL` so
fresh installs match migrated ones — `test-db.mjs` already asserts that equivalence and must keep
passing.

Both new `sets` columns are nullable, like `weight_kg` and `reps` already are. A user who never
does a plank never sees a duration field and never stores a non-NULL `duration_seconds`.

### `bodyweight_kg` is a snapshot

Written **at set completion** from the most recently logged `weigh_ins` row. Not joined at query
time, for two reasons:

- A set performed at 80 kg should stay 80 kg in history after the user cuts to 70 kg.
- The alternative is a correlated subquery in eight separate analytics statements.

If no weigh-in exists, `bodyweight_kg` stays NULL and the set contributes only its added weight.
Logging a weigh-in later does **not** retroactively fill earlier sets — history never mutates
under the user.

### Seeding the flags

- `is_bodyweight`: `UPDATE exercises SET is_bodyweight = 1 WHERE equipment = 'body only' AND category != 'stretching'` — 88 of 873 rows. Excluding stretches keeps hamstring stretches out of tonnage.
- `is_timed`: explicit id list, not a name regex. A regex on "hang" catches nine barbell Hang
  Cleans and Hang Snatches, which are rep-based.
  `Plank`, `Side_Bridge`, `One_Handed_Hang`, `Farmers_Walk`,
  `Isometric_Neck_Exercise_-_Front_And_Back`, `Isometric_Neck_Exercise_-_Sides`.

Both run in the migration (for existing installs) and in `seed()` (for fresh ones). Both are
user-overridable per exercise, which is what actually handles the long tail.

## Analytics

Effective load becomes `bodyweight_kg + weight_kg`. One exported constant in `src/db/sql.ts`,
interpolated into each query string — these are already TS template literals, so it is a
substitution, not a refactor:

```ts
export const LOAD_KG = 'COALESCE(s.bodyweight_kg, 0) + COALESCE(s.weight_kg, 0)';
```

Applied at: `EXERCISE_PROGRESSION_SQL`, `STALL_CANDIDATES_SQL`, `MUSCLE_SETS_SQL`,
`PERIOD_SUMMARY_SQL`, `WEEKLY_TONNAGE_SQL`, `MUSCLE_WEEKLY_SETS_SQL`, `WORKOUT_HISTORY_SQL`,
`WORKOUT_HISTORY_DAY_SQL`, plus the JS volume calc in `src/app/history/[id].tsx`.

### Null-filter fix

`EXERCISE_PROGRESSION_SQL`, `STALL_CANDIDATES_SQL` and `WEEKLY_TONNAGE_SQL` filter
`WHERE s.weight_kg IS NOT NULL`. A pure bodyweight set leaves `weight_kg` blank, so it would be
silently dropped from the progression graph — the exact chart a bodyweight lifter cares about.
Those become:

```sql
s.reps IS NOT NULL AND (s.weight_kg IS NOT NULL OR s.bodyweight_kg IS NOT NULL)
```

### Timed sets in analytics

Timed sets have `reps IS NULL`, so the `reps IS NOT NULL` clause already excludes them from
tonnage and est-1RM. That is intended: seconds × kg is not tonnage. They still count as sets in
`MUSCLE_SETS_SQL`, which is the number that matters for weekly volume per muscle group.

`BEST_WEIGHT_SQL` and `PR_HISTORY_SQL` stay on raw `weight_kg`. A PR on a bodyweight exercise is
about added load; ranking by total would fire a spurious PR every time the user gains weight.

## UI

- **Weight column label** flips from `kg` to `+kg` when `is_bodyweight`. Blank means +0. The
  existing ghost autofill (`src/app/workout/[id].tsx`) carries last session's added weight
  forward unchanged.
- **Duration input** replaces the reps input when `is_timed`. Accepts `90` or `1:30`, stored as
  seconds, rendered back as `m:ss`. Weight column stays visible so a weighted plank works with no
  extra logic.
- **No weigh-in on record**, on a bodyweight exercise: one small tappable line —
  "Add your body weight to track volume →" — routing to the weigh-in screen. Non-blocking; the
  set still logs.
- **Toggles** for both flags on the exercise detail screen; both as params on
  `createCustomExercise` (`src/db/queries.ts`), which currently hardcodes `category = 'strength'`.
- History and workout-detail screens render a timed set's duration where reps would go.

## Deliberate omissions

- **No per-exercise bodyweight multiplier.** A push-up is ~64% of body weight, a pull-up ~100%.
  Counting all at 100% overstates push-up tonnage. The alternative is a coefficient table for 873
  exercises that is wrong in its own way, and neither Strong nor its peers model it. Upgrade path
  if this ever matters: a `bodyweight_factor REAL DEFAULT 1.0` column on `exercises`, multiplied
  into `LOAD_KG`.
- **No backfill of existing history.** No real users yet, so there is nothing to preserve.
- **No cardio, no distance, no GPS.** Explicit non-goal. Would need a `distance_m` column and its
  own analytics, since a 5 km run has no muscle group and no tonnage.
- **No duration field on non-timed exercises.** Time-under-tension is a different feature nobody
  asked for, and it would put a third input on every row of the main logging screen. Same column
  if it's ever wanted — just render it.

## Tests

Extend the existing plain-node harness (`node scripts/test-*.mjs`, real SQL against
`node:sqlite`). New `scripts/test-bodyweight.mjs`, added to the `test` script in `package.json`:

- Migration: a v4-shaped DB plus `MIGRATION_V4_SQL` has the same columns as a fresh `SCHEMA_SQL`
  install, and the migrated tables accept the new columns.
- Seeding: `is_bodyweight` set for `body only` non-stretching rows only; the six timed ids
  flagged; Hang Clean **not** flagged.
- Tonnage: a pull-up set at 80 kg bodyweight with +20 added and 10 reps contributes
  `(80 + 20) * 10`; the same set with no added weight contributes `80 * 10`, not 0.
- Null filter: a pure bodyweight set (`weight_kg IS NULL`, `bodyweight_kg` set) appears in
  `EXERCISE_PROGRESSION_SQL` and `STALL_CANDIDATES_SQL`.
- No weigh-in: a set with both `weight_kg` and `bodyweight_kg` NULL contributes 0 and crashes
  nothing.
- Timed: a plank set (`duration_seconds` set, `reps` NULL) contributes 0 tonnage, is absent from
  progression, and still counts as one set in `MUSCLE_SETS_SQL`.
- PRs: `BEST_WEIGHT_SQL` on a bodyweight exercise ranks by added weight, not total.
- `m:ss` parse/format round-trip (`90` → 90, `1:30` → 90, `90` → `"1:30"`).

`npm test` (all nine existing scripts plus the new one) and `npm run lint` must pass.

## FEATURES.md

Updated in the same commit, per AGENTS.md.
