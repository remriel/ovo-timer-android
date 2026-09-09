# Ovo Timer

An original, cross-platform countdown timer that recreates the simple, direct
gesture of the classic Android Ovo timer: choose a duration around the dial,
release, and let the countdown run. This implementation is intentionally
independent: it includes no original Ovo source code or proprietary artwork
and is not affiliated with Ilumbo.

## Screenshots

<p align="center">
  <img src="docs/screenshots/ovo-idle.png" alt="Ovo Timer at 30 minutes with only the first duration ring complete" width="31%" />
  <img src="docs/screenshots/ovo-running.png" alt="Ovo Timer at 45 minutes with the outermost duration ring halfway complete" width="31%" />
  <img src="docs/screenshots/ovo-paused.png" alt="Ovo Timer at 60 minutes with both duration rings complete" width="31%" />
</p>

<p align="center"><em>30:00 first ring · 45:00 outer ring halfway · 60:00 both complete</em></p>

<p align="center">
  <img src="docs/screenshots/ovo-add-time-running.png" alt="Ovo Timer running after two minutes were added" width="40%" />
  <img src="docs/screenshots/ovo-add-time-cap.png" alt="Ovo Timer paused at the 60-minute addition limit" width="40%" />
</p>

<p align="center"><em>Add time without restarting · Hard stop at 60:00</em></p>

## What it does

- Set a countdown from 10 seconds to 60 minutes by dragging the visible
  colored progress band around the clock.
- Follow two independently rendered duration rings around the dial. The inner
  ring fills from 0 to 30 minutes. The outermost ring starts at 30:00, reaches
  halfway at 45:00, and closes at 60:00. Each ring keeps a final seam until its
  exact boundary, and both empty with the remaining time.
- Tap the inner clock face to start or pause. Releasing a progress-band drag
  starts the newly selected countdown; Space pauses/resumes and R resets.
- Choose 1, 2, 3, 5, 10, 15, 20, 30, or 45-minute presets from a compact
  three-by-three shortcut grid. Selecting any preset immediately starts its
  countdown; no second tap on the dial is needed.
- Add 1, 2, or 3 minutes while a countdown is running without restarting it.
  Additions made while paused stay paused, and all additions hard-stop at
  60:00. Reset still returns to the timer's originally selected duration.
- Receive a 5+ second audible finish alarm. Android also schedules a native
  full-screen alarm that can wake the display while the app is backgrounded
  or the screen is locked. It loops alarm-volume sound and vibration until you
  press `STOP ALARM` (allow Android's requested alarm access when prompted).
- Open the separate Settings screen from the small gear button at the bottom of
  the timer. Choose Dark, Light, Cobalt Night, Acid Signal, Deep Ocean, Hot
  Ember, Night Forest, or Monochrome. The selected palette is saved locally.
- Run the exact same responsive experience on Windows and Android, with dark
  mode as the default.

## Build

1. Install Node.js 20+ and run `npm install`.
2. Run `npm run check` for the unit and syntax checks.
3. Run `npm run build:windows` to create Windows installer and portable EXEs.
4. Run `npm run android:add` once, then configure Android Studio / SDK.
5. Run `npm run android:icons` and `npm run android:apk` to create the debug
   APK.

The Windows output is written under `release/windows/`. Android's debug APK is
written under `android/app/build/outputs/apk/debug/`.

## Design

The production backdrop, icon, and settings artwork in `assets/` were created
specifically for this project. The application uses a colorful neo-brutalist
print system: hard black outlines, offset shadows, vivid flat colors, and
screenprint texture.
