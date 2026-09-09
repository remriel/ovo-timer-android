# Changelog

## 1.0.13

- Added dedicated +1, +2, and +3 minute controls that extend a running timer
  without restarting it, or extend a paused timer without resuming it.
- Capped additions at 60 minutes and disable the controls at the limit while
  preserving the timer's original reset duration.
- Serialized native alarm updates so rapid additions cannot leave Android with
  an older deadline, and enabled exact alarms on Android API 23–30.
- Fixed expired-pause handling, restored idle/finished snapshots, duplicate
  alarm firing on foreground resume, repeated keyboard toggles, secondary
  pointer input, focused-button Space handling, and stale accessibility time.
- Removed the remaining small-screen decorative orange ring so the real two-lap
  progress indicator remains visually accurate on Android.

## 1.0.12

- Removed the permanently filled orange dial border that visually imitated a
  second progress lap and made the timer appear maxed out at 30 minutes.
- Positioned the first duration ring closest to the red time bar; it fills from
  0 to 30 minutes.
- Added a separately rendered outermost duration ring that starts at 30:00,
  reaches halfway at 45:00, and closes only at exactly 60:00.

## 1.0.11

- Kept a visible one-degree seam on every incomplete duration lap so the first
  circle closes only at 30:00 and the second closes only at exactly 60:00.
- Removed the entire screensaver background feature, including its Settings
  controls, animation runtime, persisted mode, CSS, and three generated PNGs.
- Expanded the theme-only Settings screen to eight palettes: Dark, Light,
  Cobalt Night, Acid Signal, Deep Ocean, Hot Ember, Night Forest, and
  Monochrome.
- Replaced the primary pink ring and shortcut blocks with orange. Pink is no
  longer used in the interface palette.

## 1.0.10

- Removed the two translucent wisp layers, including their blur, glow, and
  screen blending, so nothing faint surrounds the dial's solid color rings.
- Kept the selectable Bezier, Flowerbox, and 3D Maze motion behind the timer
  without adding another visual layer to the dial itself.
- Tightened the shortcut grid to match the dial width, reduced button height,
  gaps, borders, shadows, and type, and centered the settings control beneath
  the cleaner three-by-three layout.

## 1.0.9

- Added a separate Settings screen opened from the small gear button below the
  quick-load presets.
- Added three background motion choices inspired by classic screensavers:
  Bezier, Flowerbox, and 3D Maze. The selected generated artwork drifts and
  bounces behind the dial only while a countdown is running.
- Added persistent Dark, Light, Cobalt Night, and Sunset Ink color themes, with
  dark mode kept as the default.
- Centered the timer layout and changed the dial's offset shadows to concentric
  rings so the dial and surrounding traces remain symmetrical.

## 1.0.8

- Added two subtle, offset pipe-style wisps that orbit the dial only while the
  countdown is running, with a reduced-motion fallback that leaves them still.
- Kept the wisps outside the clock face and pointer-free so they never cover
  the timer text or interfere with rim dragging.

## 1.0.7

- Preset buttons now cancel any previous alarm, load their duration, and start
  counting down immediately without requiring a second tap on the dial.
- Guarded rapid preset changes so only the newest selection can schedule the
  Android alarm after the prior alarm has finished cancelling.
- Manual outer-rim changes also start automatically when the gesture ends,
  including Android pointer-cancel endings after the time was changed.

## 1.0.6

- Replaced the five shortcut buttons with a compact three-by-three grid for
  1, 2, 3, 5, 10, 15, 20, 30, and 45 minutes.
- Removed the theme toggle, stored theme preference, and light-theme styles so
  the Windows and Android apps now stay in dark mode at all times.
- Removed the yellow duration orbits' directional shadow and render completed
  laps as solid masked rings, keeping them concentric, evenly spaced, and free
  of the tiny conic-gradient seam at a full lap.

## 1.0.5

- Removed Android's remaining blue tap rectangle from the square rim that owns
  the dial gesture, as well as from the circular clock face.
- Changed rim dragging to continuous two-lap movement: one full turn adds 30
  minutes, 60 minutes is a hard stop, and reversing immediately reduces time
  instead of wrapping back to the beginning.

## 1.0.4

- Replaced Android's standard timer notification with a dedicated native alarm
  path: an exact wake-up when Android permits it, a full-screen lock-screen
  alarm, looping alarm-volume audio, repeated vibration, and an explicit
  `STOP ALARM` action.
- The Android alarm channel now uses the highest available alarm priority,
  public lock-screen visibility, and requests access to exact alarms,
  full-screen alerts, and Do Not Disturb bypass in that order when needed.
- Removed the Android-only dial focus target and tap highlight so starting or
  pausing no longer leaves a blue selection box around the clock.

## 1.0.3

- Added a separate two-lap duration trace around the original circular dial:
  30 minutes fills one orbit and 60 minutes fills both.
- The duration trace follows the chosen time before starting, then visibly
  empties while running or paused so it always reflects time remaining.
- Added a compact, persistent dark/light view toggle while keeping dark mode
  as the initial view.

## 1.0.2

- Increased every visible timer, caption, shortcut, and unit label by 30% for
  easier reading at a glance.

## 1.0.1

- Android now schedules a native alarm notification that can fire while the
  app is backgrounded or the screen is locked.
- Added a 5.6-second repeating alarm sound for Android and extended the
  foreground Web Audio alarm to run for more than five seconds.
- Removed the Android WebView frame and native button focus artifact so the
  dial stays clean and edge-to-edge in dark mode.
- Thickened the colored band and added an invisible outer touch cushion so
  dragging is easier to start accurately on a phone.

## 1.0.0

- First independent cross-platform release of Ovo Timer for Windows and Android.
- Centered, dark-only neo-brutalist countdown clock with the visible progress
  band as the direct time-setting gesture.
- Tap the clock face to start or pause; releasing a band drag starts the new
  countdown. Includes 1, 5, 15, 25, and 45 minute quick shortcuts.
- The clock band begins at the selected position and empties against the
  60-minute dial as time runs out, including while paused.
- Includes a Windows x64 installer, a portable Windows x64 EXE, and an
  installable Android debug APK.

## Package notes

- The Windows executables are not code-signed.
- The Android APK is debug-signed for direct installation; publishing to the
  Play Store would require a release signing key.
