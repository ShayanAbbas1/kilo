# Kilo — Work Log

Handoff log: newest entry first. Read AGENTS.md (project brief) and FEATURES.md (spec of record) first.

## 2026-07-24 — Violet default theme + screenshot swap

Pre-announce polish, all Violet (the theme owner is sharing):
- **Default theme Ember → Violet** — `DEFAULT_THEME` in `theme.ts` (the `useState` seed in settings-context when no `theme` setting is saved). New installs / users who never picked a theme now get Violet; anyone who explicitly chose a theme keeps it. FEATURES.md theme line updated.
- **Screenshots**: added `live-workout.jpg` (active logging — rest timer, green completed sets, KG/REPS inputs; the "matches Strong" shot the gallery lacked) and replaced `recent-prs.jpg` with the erectors-corrected version (owner fixed a stale "lower back" record on-device). README gallery reworked to a Trendline hero + 3×2 grid (7 shots).

## 2026-07-24 — README screenshots

Owner supplied 6 real-data screenshots (Violet theme) → renamed from WhatsApp filenames to descriptive slugs in `screenshots/` (trendline, muscle-heatmap-sets, exercise-detail, recent-prs, muscle-heatmap-tonnage, workout-detail) and added a captioned 3×2 HTML-table gallery to the README after the "Why it exists" pitch. Pre-release polish before announcing.

## 2026-07-24 — Obtainium install path (README)

Documented Obtainium as the recommended install: README "Get the app" gained an "Auto-updating install" subsection — install Obtainium, add `https://github.com/ShayanAbbas1/kilo`, get auto-updates from GitHub Releases. Included the one-tap `obtainium://add/<url>` deeplink (verified the scheme/format against Obtainium's source — `AndroidManifest.xml` registers `obtainium://`, `DEVELOPER_GUIDE.md` confirms `obtainium://add/<url>`; not `app`). No dev-side setup exists for Obtainium — it's a client that watches releases — so this is docs-only. Next FOSS step: IzzyOnDroid submission.

## 2026-07-24 — Public distribution: GitHub Releases + v1.0.0

Owner wants to start distributing on open-source platforms. First move: make GitHub Releases the canonical APK home instead of the ephemeral `expo.dev/artifacts/...` URL (which changed every native build and forced a README edit each time — that chore is now gone).

- **README** "Get the app" now links to `https://github.com/ShayanAbbas1/kilo/releases/latest` — a permanent, version-agnostic page. Never hand-edited again; new releases just attach a new APK.
- **`v1.0.0` GitHub Release** cut with the current preview APK (110 MB, pulled from the last EAS artifact) attached.
- **OTA unchanged** — expo-updates/EAS free tier stays as-is. Clarified the model in AGENTS.md: OTA is the fast lane for JS between releases; a new GitHub Release is how native changes reach users; both live at once. Walked back an earlier idea to disable OTA for a store variant — only F-Droid *main* needs that, and it's deferred (builds from source, RN/Expo reproducible builds are painful, OTA conflicts with their model).
- **FOSS-store pathway** (documented, not yet executed): GitHub Releases → Obtainium + IzzyOnDroid (both read from releases; IzzyOnDroid only earns a cosmetic `NonFreeNet` label for OTA, still accepted) → announce (Show HN, r/fossdroid, r/fitness). Play Store optional/later.
- No code touched — README/AGENTS.md/FEATURES.md/WORKLOG.md only. FEATURES.md Phase 3 gained the distribution line.

## 2026-07-18 — Cold-start Workout tab (same PR)

Owner has no routines → empty home screen felt dead. Strong-style fix, opus subagent build: with no routines the tab lists the last 3 finished workouts ("Start from a recent workout" — `startWorkoutFromPast` copies exercises in position order, target sets = non-warmup count, supersets preserved, via extracted `WORKOUT_COPY_EXERCISES_SQL` now shared with `createRoutineFromWorkout`); with no history either, three template cards (Upper/Lower/Full Body) whose exercise names are verbatim seed names (verified against `src/data/exercises.json` — there is no plain "Bench Press"/"Deadlift" in free-exercise-db; it's "Barbell Bench Press - Medium Grip" etc.), resolved to ids at tap time via `resolveExerciseIdsByName` (SQL `IN` doesn't preserve order — JS reorders, unresolved skipped) → `startWorkoutFromExercises(ids, 3)`. All start paths share the active-workout guard. New test-db assertions cover copy-from-past ordering/target-sets/superset + name resolution.

## 2026-07-18 — Space Grotesk (same PR)

Owner disliked the system font; wanted Dank Mono — declined (commercial license, public repo = redistribution) and offered free options; owner picked Space Grotesk. Implementation notes:
- `npx expo install expo-font @expo-google-fonts/space-grotesk` auto-added the `expo-font` config plugin to app.json — REVERTED that (plugin = native change = APK rebuild); runtime `useFonts` in `_layout.tsx` works in Expo Go + OTA without it. Root layout returns null until fonts load.
- Android ignores numeric `fontWeight` on custom font families, so `src/components/text.tsx` exports a `Text` wrapper that flattens the style and maps fontWeight → `SpaceGrotesk_<weight>` file (800/900 clamp to 700, the heaviest cut), clearing fontWeight to avoid faux-bold stacking. All 18 Text-using files import it; screens still write plain `fontWeight:`.
- TextInputs can't use the wrapper — each got an explicit `fontFamily` (weight-mapped where they had fontWeight, which was then removed).
- Nav `headerTitleStyle`/`tabBarLabelStyle` take fontFamily directly.
- Space Grotesk has no italic — the two italic note styles will render non-italic on Android; acceptable.
- Checks: tsc, lint, 9 suites. Owner verifies on device.

## 2026-07-18 — Premium pass (same PR as Ember theme)

Owner: ember theme "fine but not premium"; stock black bg lacks personality; read-only vs active workout screens too similar (old problem). Orchestrated: tokens inline, then 4 parallel subagents (history-detail redesign, active-workout live strip, charts, mechanical input-border sweep) + a read-only premium audit; audit's top findings fixed inline.

- **Backgrounds**: dark = layered espresso (`#161210` page → `#221C17` card → `#332A22` selected), light = warm paper `#FAF6F1` with white cards. New `border` token; Card = radius 16 + hairline border; all 14 TextInputs got hairline borders (field radius normalized to 10; the compact in-row set inputs stay 8 deliberately).
- **Read-only vs active** (the named problem): history detail is now a report — Duration/Sets/Volume stat card (22/800 tabular numbers over Type.label captions, hairline column dividers), tighter muted set table. Active workout has an always-visible status strip under the header — ember wash (`tint+'14'`), `● In progress` + `{elapsed}m · {n} sets`; the rest countdown/+15s/Skip takes over the same strip while resting (was a conditional bar). Elapsed left the header title.
- **Charts**: gradient area fill under LineChart primary (tint 18%→0, safe — Point[] has no null gaps), ColumnChart bars round only top corners, TrendChart primary stroke 2.5 vs 1.75 others.
- **Audit fixes**: secondary Button had same fill as Card = invisible on cards → hairline border (transparent on primary to keep geometry); report muscle-gap row could wrap on long names → flex+numberOfLines; weight ± stepper had no pressed state; Delete header action weight-matched to Finish; exercise title 17 on both workout screens.
- Deferred from audit (diminishing returns): unify hand-rolled pills onto Chip, caption sizes 11/12/13 → Type.caption sweep, list-row divider standardization, Type.title adoption sweep.
- Checks: tsc, lint (1 pre-existing warning), 9 test suites. Not eyeballed on device.

Owner asked for a colors/typography pass; picked ember orange + polished system fonts (over violet/green/Inter) via option prompt. All in `theme.ts` since every screen already reads `useTheme()`:

- **Palette**: warm stone neutrals (light `#F5F1EC` cards / warm near-black text; dark keeps pure-black OLED bg with warm-shifted `#1E1A17` cards), tint `#EA580C` light / `#FF8A3C` dark. New `onTint` token — dark text on the bright dark-mode orange beats white for contrast; replaced 9 hardcoded `'#fff'`-on-tint spots (chips, buttons, calendar selected day) across 6 files. `accent` moved orange→cyan because the Trendline's kcal line would have collided with the now-orange weight line.
- **Nav chrome**: `_layout.tsx` builds react-navigation themes from the palette (headers/tab bar were stock); bold header titles + tab labels. `headerTitleStyle` only accepts fontFamily/Size/Weight — no letterSpacing.
- **Type scale**: `Type` in theme.ts (stat/title/body/caption/label, `satisfies Record<string, TextStyle>`); SectionTitle uses `Type.label`, TDEE number uses `Type.stat` (24→30 w/ tight tracking), buttons bumped to 700. Deliberately did NOT sweep all ~100 inline fontSizes — sizes were already consistent (13/16/17); Type is there for new code.
- Verified: tsc, lint, 9 test suites. NOT eyeballed on device — owner should check dark + light before merging.

## 2026-07-18 — Session: all-time + custom date ranges

Owner asked for an "All time" chip on the date-range filter, user-creatable custom ranges, and confirmation that existing ranges are rolling `now − N days` windows.

- **Confirmed**: the only range filter is Stats' muscle-group card (drives heatmap + bar list). All three chips are rolling windows via `daysAgoIso()` (`Date.now() − N*86400000`), not calendar-aligned — 7d/30d/365d as intended. Other screens use fixed windows (90d, 12 weeks, 28d) with no toggle.
- **All-time chip**: `Range` is now `number | 'all'`; `'all'` passes `''` as the `sinceIso` bind — empty string sorts before every ISO timestamp, so `started_at >= ''` matches everything. No SQL change. Asserted in test-db.mjs.
- **Custom ranges**: ＋ chip opens an inline day-count input; new Nd chips merge sorted into the preset row, long-press removes. Persisted as a JSON number array in the existing `settings` KV table under `custom_ranges` (read directly in stats.tsx — not worth a settings-context field for one screen). Selected range itself still resets to 7d on restart, deliberately.
- Checks: tsc, lint, npm test green.

## 2026-07-18 — Save feedback (toasts)

Owner report: saving a weigh-in or calorie entry gave zero feedback — no toast, nothing visible without scrolling. Added `src/lib/toast.ts` (`toast()`: ToastAndroid on Android, Alert fallback on iOS — ponytail-commented, upgrade to a custom toast when iOS becomes a test target). Wired into every previously-silent save: Body tab weigh-in ("Weigh-in saved — 82.5 kg") and calorie add ("Added 650 kcal"), Settings rest timer / calorie target / weight goal (set + cleared variants). Invalid input now toasts a hint ("Enter a valid weight") instead of silently returning — that silent-return was half the confusion. Saves also `Keyboard.dismiss()` so the confirmation isn't hidden behind the keyboard. Workout logging, routines, deletes, imports untouched — they already had visible feedback (rows update in place / Alert confirms).

## 2026-07-04 — Session 3: orchestrated wave (calendar, picker, heads, routines, polish)

PM/architect/implementer pipeline: a Fable architect wrote per-feature specs (scratchpad), sonnet implementers built each in isolated git worktrees off main while another session shipped RPE/notification/supersets in parallel; orchestrator merged, resolved conflicts, verified, pushed.

- **Training calendar + weekly streaks** (History): `src/lib/calendar.ts` pure grid/streak math (monthGrid, weekKey, weekStreaks — weekly not daily; a rest day doesn't break a lifter's streak), tested in `scripts/test-calendar.mjs` (wired into npm test). History ListHeader: month grid w/ dots on training days, today ring, tap-day filter + Clear row, `🔥 N-week streak · best M` (shown when ≥2). UTC→local via todayStr(new Date(started_at)).
- **Picker UX**: RECENT_EXERCISES_SQL (distinct by last use, active workouts count for recency), Recent section only when query+filters empty; equipment chips ANDed with muscle chips (searchExercises gained equipment param).
- **Head-level weekly aggregation**: MUSCLE_EXERCISE_WEEKLY_SQL + aggregateHeads() in muscle-heads.ts (SQL can't run the name regexes; JS maps exercise→emphasis and sums per week). Muscle drill-down gained a "By head/region" card (chips + ColumnChart + BarList). NOTE: sets for an exercise with 2 primary muscles in one slug group count once per muscle — consistent with the heatmap's deliberate SUM semantic, left as is.
- **Routine editor** (`/routine/[id]`): + New Routine on Workout tab, long-press routine → Edit/Delete; rename (write-through), −/+ target-sets stepper, ▲▼ reorder via position swap, add via shared exercise-picker (optional routineId param), superset chain borders preserved through reorder. Routine CRUD/reorder covered in test-db.mjs.
- **Beauty pass**: shared EmptyState component used on 7 screens, pressed states added to ~30 Pressables, paddingBottom rhythm normalized, tabular-nums on all numeric text/charts, success haptic on Finish.
- **Merge notes**: append-conflicts in sql.ts/queries.ts/test-db.mjs resolved by union (PR_HISTORY_SQL from main + RECENT_EXERCISES_SQL from branch, etc). Worktree gotchas for next time: symlinked node_modules shares Metro's cache across worktrees — `expo export` can fail resolving a *sibling worktree's* modules; always `--clear`. Stale `.expo/types` in a fresh checkout fails tsc after merging a branch that added a route; any running dev server on that checkout regenerates it.
- All checks green on main after every merge: tsc, expo lint, npm test (4 suites), expo export android.
- **Adversarial review round** (opus, whole-session diff e1d9d39..HEAD) → 2 MAJOR + 6 MINOR, all fixed: `'localtime'` added everywhere started_at is day/week-bucketed in sql.ts (calendar buckets local in JS; SQL was bucketing UTC — West-of-UTC users got dots and analytics on different days); tap-day now queries the day directly (getHistoryForDay — dots come from ALL workouts, list was limit-100); reopen→re-finish preserves original finished_at (stashed in settings key `reopened_finished_at:<id>`); PR 🏆 raises in-memory best after firing; set delete long-press moved off the row (was swallowing TextInput long-press); rest notification cancelled on screen unmount; exportAll writes real SCHEMA_VERSION; stale tap-day filter cleared when its workouts vanish. Verified clean: migrations v1→v2→v3 all orders, old-export import, kg-canonical writes, superset×reorder/rest interactions. Known-and-accepted: `w.started_at >= ?` UTC-instant range filters (PERIOD_SUMMARY/MUSCLE_SETS) are instant-vs-instant, correct as-is; `%Y-%W` splits the Dec/Jan week (cosmetic, once a year).

## 2026-07-04 — Session 2 (cont. 2): body heatmap + muscle-head granularity

Owner asked for body visualizations and head-level targeting ("long head or short head").

- Dep: react-native-body-highlighter (SVG body, works with our react-native-svg; slugs in its index.d.ts). `src/lib/body-map.ts` maps free-exercise-db muscle names → slugs (lats+middle back both → upper-back and SUM; abductors → gluteal, ponytail-commented), toBodyData() scales sets → intensity 1..5 against the busiest muscle, HEAT_COLORS pale→red.
- Stats muscle card now: front+back BodyHeatmap + heat legend + the BarList, all driven by the same 7d/30d/365d toggle.
- `src/lib/muscle-heads.ts`: regex rules per muscle inferring head/region emphasis from exercise NAME (seed data has no head info; hand-tagging 873 exercises is not happening). Covers chest (incline/decline/fly), biceps (preacher/incline/hammer), triceps (overhead/pushdown/close-grip), delts (lateral/front/rear/press), lats (width vs thickness), hams (hinge vs curl), quads, calves (seated=soleus), glutes, traps. Shown as "◎ emphasis" lines on the exercise page under a Targets card with a mini body map (primary=full tint, secondary=40% tint).
- IMPORTANT for node tests: body-map.ts uses `import type` so node type-stripping keeps it runtime-free — a value import of the CJS package breaks scripts/test-heads.mjs.
- `npm test` now runs both test files (21 head/body assertions + DB suite). All checks green incl. bundle.
- Head-level aggregation (weekly sets per head) deliberately deferred — needs per-set emphasis tagging; the display layer proves the concept first.

## 2026-07-04 — Session 2 (cont.): Trendline, PR flash, notes

- **The Trendline shipped** (flagship): Stats top card, 12 weeks, three normalized lines — body weight (tint), weekly tonnage (green), avg daily kcal (orange). New WEEKLY_WEIGHT/TONNAGE/KCAL_SQL grouped by strftime('%Y-%W'), joined in JS over the union of week keys (getWeeklyTrend). TrendChart component handles per-series normalization + null gaps (pen up/down path building). Theme gained `accent` orange.
- **PR flash**: BEST_WEIGHT_SQL (all-time best completed working weight, finished workouts only — tested it excludes the active workout). getWorkoutExercises now returns best_weight. Completing a working set above it → 🏆 instead of ✔ + success haptic. Transient until reload, by design.
- **Workout notes**: multiline input on active workout (writes through on change), italic card in history detail.
- All checks green. Committed + pushed.

## 2026-07-04 — Session 2: Phase 2 analytics + UX round

Owner confirmed the app runs on device via Expo Go (SDK 57 from expo.dev/go) and asked for more features/better UI.

**Done:**
- Deps: react-native-svg (charts), expo-haptics
- New SQL in sql.ts + tests: EXERCISE_PROGRESSION_SQL (per-day top weight / Epley est-1RM / working volume), MUSCLE_SETS_SQL (json_each over primary_muscles), TOP_EXERCISES_SQL, PERIOD_SUMMARY_SQL. Gotcha caught by test: progression volume excludes warmups by design.
- `src/components/charts.tsx` — hand-rolled, no chart lib: LineChart (svg path, optional secondary series + dashed target), BarList (horizontal, plain Views), ColumnChart (vertical, plain Views, target line, over-target bars go red)
- Stats tab (4th tab): weight 90d chart w/ avg7 + trend delta, sets-per-muscle with 7d/30d/365d segmented control, kcal columns vs target 14d, most-trained exercise list → exercise detail
- `/exercise/[id]`: bests row (weight / est 1RM / session volume), metric-toggle progression chart, session history, seeded how-to instructions. Reachable from: Stats list, active-workout exercise name tap, history detail exercise tap.
- Workout screen: `Workout · 42m` ticking header (5s interval, minute granularity), light haptic on set complete
- Picker: horizontal muscle-filter chips (searchExercises gained optional muscle param — LIKE on the JSON text, good enough)
- Body tab: protein input + daily total, weigh-in ▲▼ delta vs yesterday's avg7
- History detail: Edit button reopens a finished workout (finished_at=NULL → becomes active; guarded if another workout is active)
- Workout tab: "This week: N workouts · X kg lifted"

**Hard-won lesson:** `.expo/types/router.d.ts` (typed routes) is ONLY regenerated by the dev server (`expo start`), not by `expo export`. After adding a route file, tsc fails with stale route types until a dev server briefly runs. Fix used: background `expo start`, poll for the type file, kill it.

**Tested:** tsc, expo lint, node scripts/test-db.mjs (4 new analytics assertions), expo export android — all green. On-device pass of the new Stats/exercise screens still pending owner.

**Next candidates:** the combined Trendline chart (weight+kcal+strength on one timeline — flagship), PR auto-detection with in-workout "new PR" flash, tonnage-per-muscle toggle, supersets, plate calculator, workout notes.

## 2026-07-04 — Session 1 (cont. 3): …and back to SDK 57

Play-Store Expo Go was too old for 56 as well; owner installed Expo Go from https://expo.dev/go which ships SDK 57. Upgraded back: `expo@^57.0.2` (no `sdk-57` dist-tag exists yet — install by version) + `expo install --fix` + clean reinstall. expo-doctor 20/20, tsc/lint/test-db/export green. The rule going forward: match the SDK to the Expo Go on the owner's phone, not to npm `latest`.

## 2026-07-04 — Session 1 (cont. 2): SDK 57 → 56 downgrade

Owner's Expo Go said "project is incompatible with this version" — SDK 57 went stable days ago and Play-Store Expo Go still targets SDK 56. Downgraded: removed unused template deps (@expo/ui, expo-glass-effect, expo-symbols, expo-web-browser, expo-image, expo-device, expo-font), `expo@sdk-56` + `expo install --fix`, clean reinstall to dedupe. expo-doctor 21/21, tsc/lint/test-db/export all green. RN is now 0.85.3. Do not bump the SDK until Expo Go supports it.

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
