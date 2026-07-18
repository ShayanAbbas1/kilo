# Kilo — Feature Roadmap

Spec of record. Checkboxes track what's shipped. Scope changes get edited here first.

## Phase 1 — Logging (v1: "I can leave Strong")

The bar for done: the owner logs a full real gym session, a weigh-in, and a day of calories in Kilo without wishing for Strong.

### Workout logging (Strong-parity)
- [x] Exercise library seeded from free-exercise-db (873 exercises with muscle groups, instructions)
- [x] Custom exercises (name + muscle group + equipment)
- [x] Start empty workout → add exercises → log sets (weight × reps)
- [x] Previous-session values shown per set (the "what did I do last time" ghost text)
- [x] Set types: warm-up / working / failure (tap the set number to cycle)
- [x] Rest timer — wall-clock in-app countdown after each completed set (survives backgrounding), +15s/skip, duration in settings; high-importance heads-up notification with vibration when rest ends while app is backgrounded/locked, suppressed while app is on screen (build-only — expo-notifications no-ops in Expo Go on Android)
- [x] Edit/delete sets (long-press a set row to delete); delete past workouts — editing a *finished* workout still open
- [x] Routines: save a finished workout as a routine (history detail), start from routine (Workout tab), long-press to delete
- [x] Workout history list + detail view (long-press a workout in the list to delete; also Delete in detail header)

### Body weight
- [x] Daily weigh-in: one number, date-stamped, two taps from app open
- [x] Edit/delete past entries (long-press to delete; re-save today's to edit)
- [x] 7-day moving average shown alongside raw entries (daily noise demoralizes; the trend is the truth)

### Calories
- [x] Log per-meal entries (label + kcal) or a single daily total — user's choice per day (protein column in DB, no UI yet)
- [x] Daily target setting; today's running total vs target
- [x] No food database in v1 — manual kcal entry only (food DBs are a swamp; revisit in Phase 4)

### Foundation
- [x] SQLite schema: exercises, routines, workouts, workout_exercises, sets, weigh_ins, calorie_entries, settings
- [x] Units setting: kg/lbs display, metric canonical in DB; plate-sensible ± stepper bar (2.5 kg / 5 lb) above the keyboard while a weight input is focused
- [x] Export full data as JSON (share sheet → Drive/files) — ships in v1, not later
- [x] Import from a Kilo export (restore on new phone)

## Phase 2 — Analytics (the reason Kilo exists)
- [x] Stats tab: weight trend chart (90d, raw + 7-day avg lines, trend delta), sets per muscle group (7d/30d/365d, json_each over primary_muscles), calories vs target columns (14d), most-trained exercises list
- [x] Per-exercise progression screen (`/exercise/[id]`): est. 1RM (Epley) / top weight / volume line chart with metric toggle, bests row, session list, how-to instructions. Linked from Stats, workout screen (tap name), history detail.
- [x] **The Trendline**: 12-week combined chart on Stats — body weight, weekly tonnage, avg daily kcal, each normalized to its own range (read the shapes)
- [x] PR flash: completing a working set above the all-time best weight shows 🏆 + success haptic, plus a "Recent PRs" feed on Stats (window-function query, first-ever set per exercise excluded)
- [x] Tonnage per muscle group: Sets/Tonnage toggle on Stats' muscle-group card (heatmap + bar list) and the muscle drill-down's weekly chart, display-unit converted
- [x] **Body heatmap**: front+back anatomical figures on Stats colored by sets per muscle (react-native-body-highlighter), heat legend, follows the 7d/30d/365d toggle; tap a muscle to drill down (`/muscle/[slug]`: 12-week sets chart + exercises that trained it)
- [x] **Muscle-head granularity**: per-exercise emphasis inferred from the name (clavicular/sternal chest, biceps short/long head, triceps heads, delt regions, soleus vs gastroc, …) shown on the exercise page with a mini target-map (primary/secondary highlighted). Heuristics in `src/lib/muscle-heads.ts`, tested.
- [x] **Head-level weekly aggregation**: muscle drill-down's "By head/region" card — chip row + weekly ColumnChart + BarList of sets per head/region, via `aggregateHeads()` over `MUSCLE_EXERCISE_WEEKLY_SQL`
- [x] **Goal projections**: linear-regression `projectToTarget()` (`src/lib/projection.ts`, tested) turns a trend into "on pace by \<date\>". Body weight goal (settings, kg) shows "on pace for X by \<date\>" or "trending away" near the Body tab's weight trend (regression over last 28 days of 7-day-avg weights). Per-exercise est. 1RM goal, set/edit/cleared from the exercise page, shows a projected date or "N% of the way there" (regression over last ~10 sessions). No schema change — both goals live in the `settings` key-value table.
- [x] **Plateau detection with cross-domain context**: "Stalled lifts" card on Stats + "Stalled since" badge on the exercise page flag lifts whose recent-4-session best e1RM ≤ the prior 4's, and explain each with diet (avg kcal vs target) + body-weight (7-day-smoothed) change since the stall. Pure/tested in `src/lib/plateau.ts` over `STALL_CANDIDATES_SQL`.
- [x] **Weekly report card** (`/report` modal, entry point on Stats): this week vs last week — workouts + tonnage (▲▼ delta), PRs hit, muscle gaps (trained in the prior 4 weeks but 0 sets this week, or 14+ days since last trained), calorie days-logged + avg vs target, body-weight 7-day-avg delta. Pure date/gap helpers in `src/lib/weekly-report.ts`, tested.
- [x] **Adaptive TDEE**: Body-tab card estimating real daily energy expenditure over the last 28 days (avg logged intake − 7-day-smoothed weight change × 7700 kcal/kg) with avg intake and implied kg/week trend; needs ≥10 logged calorie days and weigh-ins near both window edges, else a "log N more days" hint. Math in `src/lib/tdee.ts`, tested.

## Phase 3 — Quality of life
- [x] Elapsed-time in workout header, haptic on set completion
- [x] Muscle-group + equipment filter chips (AND'd) in exercise picker, with a Recent section (last-used exercises, active workouts count) shown when search/filters are empty
- [x] Protein per calorie entry + daily protein total
- [x] Weigh-in delta vs 7-day average (▲▼) on Body tab
- [x] Edit a finished workout (reopen from history detail)
- [x] Weekly summary (workouts + tonnage) on Workout tab
- [x] Supersets: ⛓ toggle on each exercise links it to the next (chains fall out naturally); linked cards share a tint left-border and rest is skipped mid-chain. Survives save/start-as-routine.
- [x] Plate calculator (`/plates` modal: per-side breakdown from a target weight, greedy from standard plate sets; ⚖ button on each exercise in the active workout, prefilled from last logged/ghost weight)
- [x] RPE/RIR per set (RPE 0–10, optional field per set, shown when enabled in settings; always shown in history if present)
- [x] Notes on workouts (multiline field on active workout, shown in history) + per-exercise notes (below each exercise's sets, shown in history)
- [x] Training calendar with month grid, weekly streaks (current/longest), tap-day filtering
- [x] Routine editor (`/routine/[id]`): create empty/rename/add/remove exercises, ▲▼ reorder (no drag-drop dep), target-sets stepper; reorder keeps each exercise's superset flag attached to its row, exercise picker reused via a `routineId` param
- [x] Beauty pass: shared `EmptyState` component (emoji + hook line) across every empty list/section, pressed states on every Pressable, `tabular-nums` on all numeric text, consistent scroll padding rhythm (incl. the new calendar/streaks, picker Recent/equipment chips, head-aggregation, and routine-editor surfaces), success haptic on workout finish
- [ ] Home-screen widget / quick actions (log weigh-in from launcher) (needs a dev build — Expo Go can't register launcher widgets; deferred until off Expo Go)
- [x] Dark mode (system theme, all components themed)
- [x] OTA updates — expo-updates + EAS Update on channel `preview`; push to `main` auto-publishes via `.eas/workflows/publish-update.yml`, installed APK updates on next restart (see AGENTS.md → Builds & updates)
- [x] **Import from Strong or Hevy (CSV)** (`/import-strong` modal, entry in Settings): header-sniffed dispatch to a Strong parser (`;`/`,` delimited, kg or lbs, Rest Timer/Note pseudo-rows) or a Hevy parser (`"28 Mar 2025, 17:29"`/ISO dates, weight_kg/weight_lbs column, normal/warmup/failure/dropset set types, superset_id → superset_with_next); quote-aware record splitting keeps multi-line notes intact. Conservative name-matching against the exercise library (exact + token-set with the "(Equipment)" suffix folded in; ambiguous → ask), unmatched exercises get a muscle-group chip picker and become custom exercises (equipment inferred from the name). Additive-only: existing data untouched, deterministic `strong_/hevy_<datetime>` workout ids make re-imports skip what's already in. Parse/match/plan pure in `src/lib/strong-import.ts`, tested.

## Phase 4 — Maybe, later, or never
- [ ] Food database / barcode scanning (only if manual kcal entry proves too much friction)
- [ ] Apple Health / Health Connect sync (weight in/out)
- [ ] Automatic cloud backup (still no accounts — user's own Drive)
- [ ] Play Store release (when the owner has used it for 2+ months and it held up)
- [ ] iOS build + TestFlight

## Explicit non-goals
- No accounts, no server, no sync infrastructure, no paywall — ever
- No social features (feeds, following, sharing workouts)
- No AI coaching / auto-programming
- No cardio/GPS tracking (it's a lifting + body-composition app)
