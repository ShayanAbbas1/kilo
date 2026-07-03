# Kilo — Work Log

Handoff log: newest entry first. Read AGENTS.md (project brief) and FEATURES.md (spec of record) first.

## 2026-07-04 — Session 1: foundation

**Done:**
- Expo SDK 57 scaffold (TypeScript, expo-router, `src/` layout), expo-sqlite installed
- Exercise seed: `src/data/exercises.json` — 873 exercises processed from free-exercise-db (id, name, category, equipment, primary/secondary muscles, instructions joined with \n). Images dropped deliberately (offline app, 800 images not worth it in v1).
- `src/db/sql.ts` — full schema (exercises, workouts, workout_exercises, sets, routines, routine_exercises, weigh_ins, calorie_entries, settings, meta) + the tricky queries as exported SQL strings: PREV_SETS_SQL (previous-session ghost values), WEIGHT_TREND_SQL (7-entry moving avg via window fn), CALORIE_DAYS_SQL, WORKOUT_HISTORY_SQL. Pure module, no expo imports, so node can run it.
- `src/db/index.ts` — migrate() for SQLiteProvider onInit: WAL, foreign keys, schema, seeds exercises when table empty
- `src/db/queries.ts` — typed CRUD for the whole Phase-1 surface incl. exportAll/importAll (JSON, replace-all restore)
- `src/lib/` — id (time+random slug, no uuid dep), units (kg canonical, kg/lbs display conversion), dates (local-day strings — weigh-in "day" is user-local, not UTC)
- `scripts/test-db.mjs` — runs the real SQL against node:sqlite (node 24). Covers prev-sets edge cases (active workout excluded, incomplete sets excluded), history aggregates (warmups out of set_count, in tonnage), moving average, calorie grouping, weigh-in upsert. Run: `node scripts/test-db.mjs`.

**Decisions:**
- Sets are written to DB as the user logs them (crash-safe, like Strong); finishWorkout() prunes incomplete sets/empty exercises and deletes fully-empty workouts.
- addExerciseToWorkout pre-creates as many empty sets as the previous session had (min 1), copying set types.
- weigh_ins keyed by date (one per day, upsert). Calorie entries are rows; "one daily total" is just a single unlabeled entry.
- No state library, no component library. Emoji tab icons (no @expo/vector-icons in SDK 57 template).

**Next (in order):**
1. Replace template demo screens: tabs (Workout / History / Body), stack layout with SQLiteProvider
2. Active workout screen (`src/app/workout/[id].tsx`): exercise cards, set rows with prev ghost values, complete-set checkmarks, add set, finish/discard
3. Exercise picker modal with search + create-custom
4. History list + workout detail
5. Body tab: weigh-in upsert + trend list, calorie entries + daily target
6. Settings: units toggle, export (needs `npx expo install expo-sharing expo-file-system expo-document-picker`)

**Testing status:** DB layer tested via node. UI untested — needs `npm start` + Expo Go on a phone; owner is on Android.
