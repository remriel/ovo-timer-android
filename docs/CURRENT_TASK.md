# Current task — 2026-09-08

## Objective
Ship Ovo Timer 1.0.13 with +1/+2/+3 minute extensions during a running countdown, and fix verified bugs. Sync GitHub and upload the APK to Drive.

## State / decisions
- Cloned remriel/ovo-timer-android; initial git state clean. Old handoff refers to renamed cross-platform repository.
- Dedicated add-time controls preserve the exact deadline and interval, support paused timers, cap remaining time at 60 minutes, and leave the original reset duration intact.
- Serialized native schedule/cancel calls so fast taps cannot reorder native alarms.
- Fixed idle/finished restoration, pause-at-expiry skipping the alarm, focused-button Space interception, repeated keyboard toggling, secondary-pointer toggling, stale slider accessibility value, and mobile CSS decorative orange ring.
- Android API 23–30 now uses the exact-alarm path. Scheduled Android alarms are not fired again on foreground resume after dismissal.
- Existing production assets and eight themes retained; no new imagery needed.

## Verification
- npm run check: 24/24 passing, including eight new runtime behavior tests (VM DOM/native adapter, controlled clock).
- Android-sized Playwright checks passed for disabled idle controls, running
  +2 extension, paused extension, the 60-minute cap, all eight Settings themes,
  and the corrected two-lap dial. Console reported zero errors or warnings.
- Captures: `output/playwright/android-v1.0.13-running-plus-two-native.png`
  and `android-v1.0.13-sixty-minute-cap.png`.
- `npm run android:apk` completed with JDK 21 after adding the clone-local,
  ignored Android SDK path. The APK contains the current app bundle and alarm
  audio, with no screensaver assets.
- `npm run build:windows` completed with Electron 44.3.0 and produced the x64
  installer and portable executable. They are not certificate-signed, so
  Windows SmartScreen may warn.
- Artifact sizes and SHA-256:
  - Android APK — 16,023,838 bytes —
    `3026FFDA905DC57089B3FEE27CAE3DFFB9584FB9D2678E543786DB1C92D36E25`
  - Windows setup — 121,050,200 bytes —
    `9F01486958D68DD3B90B5B0DB97CEF593AB9C7EFAC6E6FDD02C7AEEF6DAB8481`
  - Windows portable — 120,720,878 bytes —
    `D27F9B3FCA987AF805053253B835765748C18F125C13389608981F9DFD96674E`
- adb reports no device; emulator lists no AVD. Native on-device tests unavailable.

## Relevant files
src/web/app.js, index.html, styles.css; test/app-behavior.test.js; android/app/src/main/java/com/remriel/ovotimer/OvoAlarmScheduler.java.

## Next
1. Commit and push, publish the public GitHub release, upload the APK to Drive,
   and verify both remote copies.

## Constraints / failed approaches
VM tests must inject a clock-aware remainingFromEndTime wrapper because imported engine functions otherwise use the host Date clock.
No physical Android device or configured emulator is available; do not claim native device validation.
