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
- [ ] Rest timer with notification (fires while app is backgrounded)
- [x] Edit/delete sets (long-press a set row to delete); delete past workouts — editing a *finished* workout still open
- [ ] Routines: save a workout as a template, start from template
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
- [x] Units setting: kg/lbs display, metric canonical in DB (plate-sensible increment stepper not yet)
- [x] Export full data as JSON (share sheet → Drive/files) — ships in v1, not later
- [x] Import from a Kilo export (restore on new phone)

## Phase 2 — Analytics (the reason Kilo exists)
- [ ] Per-exercise progression: top-set weight and estimated 1RM over time
- [ ] Volume per muscle group: weekly / monthly / yearly, sets and tonnage
- [ ] Body-weight trend chart with moving average
- [ ] Calorie adherence vs target over time
- [ ] **The Trendline**: body weight + calories + strength on one timeline — "is this cut/bulk working?"
- [ ] Personal records: auto-detected PRs (weight, reps, est. 1RM, volume)

## Phase 3 — Quality of life
- [ ] Supersets
- [ ] Plate calculator
- [ ] RPE/RIR per set (optional field, off by default)
- [ ] Notes on workouts and exercises
- [ ] Home-screen widget / quick actions (log weigh-in from launcher)
- [ ] Dark mode (if not free via system theme already)

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
