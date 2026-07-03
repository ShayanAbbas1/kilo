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
- [x] Rest timer — in-app countdown after each completed set, +15s/skip, duration in settings (background notification still open)
- [x] Edit/delete sets (long-press a set row to delete); delete past workouts — editing a *finished* workout still open
- [x] Routines: save a finished workout as a routine (history detail), start from routine (Workout tab), long-press to delete
- [x] Workout history list + detail view

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
- [x] **Muscle-head granularity**: per-exercise emphasis inferred from the name (clavicular/sternal chest, biceps short/long head, triceps heads, delt regions, soleus vs gastroc, …) shown on the exercise page with a mini target-map (primary/secondary highlighted). Heuristics in `src/lib/muscle-heads.ts`, tested. Head-level *aggregation* (sets per head per week) still open.

## Phase 3 — Quality of life
- [x] Elapsed-time in workout header, haptic on set completion
- [x] Muscle-group filter chips in exercise picker
- [x] Protein per calorie entry + daily protein total
- [x] Weigh-in delta vs 7-day average (▲▼) on Body tab
- [x] Edit a finished workout (reopen from history detail)
- [x] Weekly summary (workouts + tonnage) on Workout tab
- [ ] Supersets
- [x] Plate calculator (`/plates` modal: per-side breakdown from a target weight, greedy from standard plate sets; ⚖ button on each exercise in the active workout, prefilled from last logged/ghost weight)
- [x] RPE/RIR per set (RPE 0–10, optional field per set, shown when enabled in settings; always shown in history if present)
- [x] Notes on workouts (multiline field on active workout, shown in history) + per-exercise notes (below each exercise's sets, shown in history)
- [ ] Home-screen widget / quick actions (log weigh-in from launcher)
- [x] Dark mode (system theme, all components themed)

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
