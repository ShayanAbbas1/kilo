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

**Two build profiles, two audiences. OTA is a dev tool, not a distribution channel.**

- **`preview` — the owner's phone only.** Has expo-updates enabled on channel `preview`. Pushing to `main` triggers `.eas/workflows/publish-update.yml`, which publishes an EAS Update to that channel; the owner's installed APK picks it up on next app restart. Manual equivalent: `npx eas-cli update --channel preview --message "..."`. Build it with `npx eas-cli build -p android --profile preview`. **This APK is never attached to a GitHub Release.**
- **`production` — everyone else.** Sets `KILO_OTA=off`, which `app.config.js` turns into `updates.enabled: false`, so the build always runs its bundled JS. This is the only APK that goes to a GitHub Release, and the only one IzzyOnDroid mirrors. Downloading and executing code at runtime conflicts with F-Droid ecosystem policy, which is why public builds don't do it. (`updates.enabled` is app-config-only — a build profile can't set it directly, hence the env-var indirection through the dynamic config.)
- **Cutting a release:** bump `version` **and** `android.versionCode` in app.json (`appVersionSource` is `local`, so the repo owns both; `runtimeVersion` follows `version` via the `appVersion` policy). Then `npx eas-cli build -p android --profile production`, download the APK from https://expo.dev/accounts/shayanabbas/projects/kilo/builds, rename it `kilo-v<version>.apk`, and `gh release create v<version> <apk> --title "..." --notes "..."`. Add a `fastlane/metadata/android/en-US/changelogs/<versionCode>.txt` in the same commit — that's what IzzyOnDroid shows as the changelog.
- Public users update by installing a new Release: Obtainium and IzzyOnDroid poll for them automatically, a bare sideloaded APK does not. README recommends Obtainium for exactly this reason.
- Both APKs share one signing key, so a `production` build installs cleanly over a `preview` one and vice versa. **The keystore is unrecoverable if lost** — back it up via `npx eas-cli credentials`.
- OTA updates only apply when the update's runtime version matches the installed build's; a mismatch fails safe (app keeps running the bundled JS, no crash).

## Conventions

- **Every change lands via PR.** Create a branch, open a PR, the owner reviews and merges — never push directly to `main`. Merging to `main` is what triggers the OTA publish, so a merged PR *is* a release.
- **README's "Get the app" link points at `/releases/latest`** — a permanent URL, never hand-edited. A native change (new APK) instead publishes a new GitHub Release with the APK attached (see Builds & updates above); the link resolves to it automatically.
- FEATURES.md is the spec of record. Any commit that ships, changes, or defers a feature updates FEATURES.md **in the same commit** — check the box, one line on what shipped. Nobody will ask for this; it's part of "done".
- This rule propagates: when dispatching a subagent or workflow to build a feature, its task prompt must include the FEATURES.md edit and end with "read AGENTS.md first".
- Weights in kg (REAL), dates as ISO-8601 strings, all in SQLite
- Keep it lazy: no state-management library until React state + SQLite hurts, no component library until hand-rolled styles hurt
