# Kilo 🏋️

Free, local-first workout + body-weight + calorie tracker. Android-first via Expo, cross-platform by design.

Built by a lifter who lost 40+ kg tracking all of this manually across paywalled apps. Kilo puts training, weight, and calories on one timeline — free forever.

## 📲 Get the app

**[Download the Android APK](https://expo.dev/artifacts/eas/Noxx-UTdcX6vJvbWMR7uC2LvL7EIQRFM5qYEaStv7lc.apk)** — install it once and it keeps itself current: the app pulls updates over the air on restart. Play Store release is planned; until then this is the official way to get Kilo.

> Installing over an existing Kilo keeps your data. Don't uninstall first — all data lives on-device.

## Why it exists

- **Free forever, no paywall.** No backend, no accounts, no sync servers. All data lives on-device in SQLite; export/import as JSON means your data is always yours.
- **Logging that matches Strong.** Start workout → add exercises → log sets with last session's values as ghost text → rest timer. Routines, supersets, RPE, plate calculator.
- **Analytics no free app has.** Per-exercise progression (est. 1RM / top weight / volume), sets and tonnage per muscle group with an anatomical body heatmap down to muscle-head granularity, PR feed, and **the Trendline** — body weight, weekly tonnage, and calories on one chart.

[FEATURES.md](FEATURES.md) is the spec of record — what's shipped, what's next, and explicit non-goals.

## Stack

- [Expo](https://expo.dev) / React Native, TypeScript, expo-router
- expo-sqlite — on-device DB is the single source of truth (kg canonical, converted at display time)
- Exercise library seeded from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (~870 exercises, public domain) + custom exercises

## Development

```bash
npm install
npm start          # scan the QR with Expo Go on Android
npm run android    # or launch the emulator
```

Note: the rest-timer background notification needs a dev build — expo-notifications silently no-ops in Expo Go on Android.

## Builds

All builds: https://expo.dev/accounts/shayanabbas/projects/kilo/builds

JS-only changes ship over the air on merge to `main` (no new APK). A new APK is only cut for native changes — when that happens, the download link above gets updated in the same PR.
