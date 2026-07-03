# Kilo — Work Log

Handoff log: newest entry first. Read AGENTS.md (project brief) and FEATURES.md (spec of record) first.

## 2026-07-04 — Session 1 (cont.): full Phase-1 UI

**Done:**
- Repo: https://github.com/ShayanAbbas1/kilo (private). gh CLI has two accounts — ShayanAbbas1 must stay the active one for this repo (ShayanCL is the owner's work account, do not push there). Remote is HTTPS + gh credential helper.
- Replaced all template demo screens/components. Kept `src/constants/theme.ts` (added tint/success/successBg/danger), `use-color-scheme`, `use-theme`. Deleted global.css and the `.web` color-scheme variant (not targeting web).
- `src/app/_layout.tsx` — Stack wrapped in SQLiteProvider(onInit=migrate) + SettingsProvider (unit + kcal target context, `src/lib/settings-context.tsx`)
- `(tabs)`: index (start/resume workout), history, body. Emoji tab icons (no icon pkg). ⚙️ header link → settings modal.
- `workout/[id].tsx` — the Strong-parity logging screen: exercise cards, set rows (tap set# cycles working→warmup→failure; W/F labels, working sets numbered), prev-session ghost column + placeholders, completing an empty set adopts ghost values (Strong behavior), long-press set = delete, long-press exercise name = remove exercise, +Add Set, +Add Exercise (picker modal), Finish (header, prunes incomplete via finishWorkout), Discard. State: VM in React state, every edit writes straight to SQLite (crash-safe), controlled inputs so no focus loss.
- `exercise-picker.tsx` — live search (SQL LIKE), rows show muscles+equipment, custom exercises marked ★, "+ Create <query>" → inline muscle/equipment chips form.
- `history/[id].tsx` — read-only detail + Delete in header.
- `body.tsx` — today weigh-in (upsert), calorie entries (meal label optional) with kcal-vs-target, weight trend list w/ avg7, long-press deletes.
- `settings.tsx` — kg/lbs toggle, kcal target, JSON export via expo-sharing (legacy FS API, see ponytail comment), import/restore via document picker (replace-all with confirm).

**Tested:** `npx tsc --noEmit` clean, `expo lint` clean, `node scripts/test-db.mjs` passes, `npx expo export --platform android` bundles (3.5MB hbc). NOT yet run on a device/emulator — first on-device smoke test is the top of the next session.

**Also done same session (task 5):**
- Routines: createRoutineFromWorkout / listRoutines / startWorkoutFromRoutine / deleteRoutine in queries.ts. Save-as-Routine (inline name field) in history detail; routines list on Workout tab (tap = start, long-press = delete). Starting from a routine pre-creates target_sets sets per exercise (prev-session count wins when larger).
- Rest timer: in-app countdown bar on the workout screen after each completed set; +15s / Skip; duration configurable in Settings ('rest_seconds', default 120). Deliberately a decrementing-seconds timer, not wall-clock (react-hooks/purity lint forbids Date.now() in render; drift irrelevant here). No background notification yet.

**Phase 1 is code-complete. All checks green** (tsc, expo lint, node scripts/test-db.mjs, expo export android).

**Known gaps / next:**
1. **On-device smoke test** via `npm start` + Expo Go (owner's Android phone) — nothing has rendered on a real screen yet; expect layout nits in the set-row grid and keyboard behavior
2. Rest timer background notification (expo-notifications)
3. Editing a finished workout (reopen: set finished_at NULL?)
4. Protein UI on calorie entries (DB column exists)
5. Weight-input steppers with plate-sensible increments (+2.5kg / +5lb)
6. Then Phase 2: analytics (charts lib decision pending)

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
