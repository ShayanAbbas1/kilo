# Kilo

Free, local-first workout + body-weight + calorie tracker. Android-first via Expo, cross-platform by design. Built by a lifter who lost 40+ kg tracking all of this manually across paywalled apps — Kilo puts training, weight, and calories on one timeline, free forever.

> Expo has changed significantly: read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.
> SDK version must match the Expo Go build on the owner's phone (currently SDK 57, installed from https://expo.dev/go — the Play Store build lags). Verify before bumping the SDK.

## Product principles

- **Free forever, no paywall.** No backend, no accounts, no sync servers — that's what creates paywalls elsewhere. All data lives on-device.
- **Local-first.** SQLite on the phone is the single source of truth. The one non-negotiable consequence: export/backup (JSON to file share/Drive) must exist before anyone has months of data in here.
- **Logging UX follows Strong.** Strong's logging flow is the benchmark: start workout → add exercises → log sets (weight × reps) with previous-session values visible → rest timer. Match it, then improve; don't reinvent.
- **The differentiator is analytics**, not logging: progressive-overload graphs per exercise, sets per muscle group by week/month/year, and the unified trendline (body weight + calories + strength on one chart) that no free app has.
- **Units:** store metric (kg) canonically in the DB, always. Convert at display/input time only, per user setting (kg/lbs). Never store display units.

## Stack

- Expo / React Native, TypeScript, expo-router (file-based navigation)
- expo-sqlite for storage — schema and queries are the heart of the app; treat the DB with data-engineering care
- Exercise database: seeded from [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db) (~800 exercises, public domain, includes muscle groups) + user-created custom exercises
- Charts: pick when analytics phase starts, not before

## Dev

- `npm start` then scan QR with Expo Go on Android for live development
- `npm run android` for emulator
- Owner's daily driver is Android; iOS is a build target, not a test target, for now

## Conventions

- FEATURES.md is the spec of record. Any commit that ships, changes, or defers a feature updates FEATURES.md **in the same commit** — check the box, one line on what shipped. Nobody will ask for this; it's part of "done".
- This rule propagates: when dispatching a subagent or workflow to build a feature, its task prompt must include the FEATURES.md edit and end with "read AGENTS.md first".
- Weights in kg (REAL), dates as ISO-8601 strings, all in SQLite
- Keep it lazy: no state-management library until React state + SQLite hurts, no component library until hand-rolled styles hurt
