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

### Builds & updates (how the app reaches the phone)

- **JS-only changes (most commits): no build needed.** Pushing to `main` triggers `.eas/workflows/publish-update.yml`, which publishes an EAS Update to the `preview` channel. The installed APK picks it up on next app restart. Manual equivalent: `npx eas-cli update --channel preview --message "..."`.
- **Native changes (new native module, app.json plugins/config, SDK bump): rebuild the APK** with `npx eas-cli build -p android --profile preview`, then install it from the build page link (https://expo.dev/accounts/shayanabbas/projects/kilo/builds). Also bump `version` in app.json — `runtimeVersion` follows it (`appVersion` policy), which is what stops old APKs from receiving updates their native side can't run.
- OTA updates only apply when the update's runtime version matches the installed build's; a mismatch fails safe (app keeps running the bundled JS, no crash).

## Conventions

- **Every change lands via PR.** Create a branch, open a PR, the owner reviews and merges — never push directly to `main`. Merging to `main` is what triggers the OTA publish, so a merged PR *is* a release.
- **README's "Get the app" APK link must stay live.** Any PR with a native change (new APK required) updates that link to the new build's artifact URL in the same PR.
- FEATURES.md is the spec of record. Any commit that ships, changes, or defers a feature updates FEATURES.md **in the same commit** — check the box, one line on what shipped. Nobody will ask for this; it's part of "done".
- This rule propagates: when dispatching a subagent or workflow to build a feature, its task prompt must include the FEATURES.md edit and end with "read AGENTS.md first".
- Weights in kg (REAL), dates as ISO-8601 strings, all in SQLite
- Keep it lazy: no state-management library until React state + SQLite hurts, no component library until hand-rolled styles hurt
