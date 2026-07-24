// Everything lives in app.json; this file exists only to make OTA a per-profile
// switch. `updates.enabled` is app-config-only — eas.json build profiles can't
// set it — so the `production` profile flips KILO_OTA=off to build the
// no-OTA APK that ships to GitHub Releases. See AGENTS.md → Builds & updates.
export default ({ config }) => ({
  ...config,
  updates: { ...config.updates, enabled: process.env.KILO_OTA !== 'off' },
});
