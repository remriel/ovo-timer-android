import {
  MAX_SECONDS,
  MIN_SECONDS,
  clamp,
  doubleLapProgress,
  formatClock,
  normalizeSeconds,
  remainingFromEndTime,
  secondsAfterDialRotation,
  shortestAngleDelta,
  timerProgress
} from "./timer-engine.js";

const nativePlatform = window.Capacitor?.getPlatform?.() || "web";
if (nativePlatform === "android") {
  document.documentElement.classList.add("native-android");
}

const storageKey = "ovo-timer-state-v1";
const preferencesKey = "ovo-timer-preferences-v1";
const gestureThreshold = 6;
const dragOuterPadding = 28;
const notificationId = 41001;
const notificationChannel = "ovo-alarm-fallback-v3";
const refs = {
  dial: document.querySelector("#timerDial"),
  dialRim: document.querySelector("#dialRim"),
  dialFace: document.querySelector(".dial-face"),
  timerValue: document.querySelector("#timerValue"),
  timerCaption: document.querySelector("#timerCaption"),
  liveStatus: document.querySelector("#liveStatus"),
  presetButtons: Array.from(document.querySelectorAll(".preset")),
  addButtons: Array.from(document.querySelectorAll("[data-add-minutes]")),
  addStatus: document.querySelector("#addStatus"),
  timerScreen: document.querySelector("#timerScreen"),
  settingsScreen: document.querySelector("#settingsScreen"),
  settingsButton: document.querySelector("#settingsButton"),
  backButton: document.querySelector("#backButton"),
  themeButtons: Array.from(document.querySelectorAll("[data-theme-option]")),
  settingsStatus: document.querySelector("#settingsStatus")
};

const themeLabels = {
  dark: "Dark mode",
  light: "Light mode",
  cobalt: "Cobalt night",
  acid: "Acid signal",
  ocean: "Deep ocean",
  ember: "Hot ember",
  forest: "Night forest",
  mono: "Monochrome"
};

let totalSeconds = 25 * 60;
let remainingSeconds = totalSeconds;
let endTime = 0;
let intervalId = 0;
let phase = "idle";
let dialGesture = null;
let nativeAlarmRequest = 0;
let nativeAlarmScheduled = false;
let nativeAlarmQueue = Promise.resolve();
let alarmAudio = null;
let currentScreen = "timer";
let theme = "dark";

if (nativePlatform === "android") {
  // Android WebView can retain a blue accessibility/focus frame on slider-like
  // elements after a touch. The square rim owns the pointer handlers, so both
  // it and the circular face must opt out of Android's touch highlight.
  refs.dial.setAttribute("tabindex", "-1");
  document.documentElement.style.setProperty("-webkit-tap-highlight-color", "transparent", "important");
  refs.dialRim.style.setProperty("-webkit-tap-highlight-color", "transparent", "important");
  refs.dial.style.setProperty("-webkit-tap-highlight-color", "transparent", "important");
}

function savePreferences() {
  try {
    localStorage.setItem(preferencesKey, JSON.stringify({ theme }));
  } catch {
    // Preferences are optional; the current selection still applies in memory.
  }
}

function updateSettingsStatus() {
  if (!refs.settingsStatus) {
    return;
  }

  refs.settingsStatus.textContent = `${themeLabels[theme]} selected.`;
}

function applyTheme(nextTheme, persist = true) {
  theme = Object.hasOwn(themeLabels, nextTheme) ? nextTheme : "dark";
  document.documentElement.dataset.theme = theme;

  refs.themeButtons.forEach((button) => {
    const selected = button.dataset.themeOption === theme;
    button.setAttribute("aria-pressed", String(selected));
    button.classList.toggle("is-selected", selected);
  });

  if (persist) {
    savePreferences();
  }
  updateSettingsStatus();
}

function restorePreferences() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(preferencesKey) || "null");
  } catch {
    saved = null;
  }

  const savedTheme = saved?.theme === "sunset" ? "ember" : saved?.theme;
  applyTheme(savedTheme || "dark", false);
}

function showScreen(screen) {
  currentScreen = screen === "settings" ? "settings" : "timer";
  const settingsVisible = currentScreen === "settings";
  refs.timerScreen.hidden = settingsVisible;
  refs.settingsScreen.hidden = !settingsVisible;
  document.body.classList.toggle("settings-open", settingsVisible);

  if (settingsVisible) {
    refs.backButton?.focus({ preventScroll: true });
  } else {
    refs.settingsButton?.focus({ preventScroll: true });
  }
  window.scrollTo(0, 0);
}

function saveState() {
  const snapshot = {
    totalSeconds,
    remainingSeconds,
    endTime,
    phase
  };

  try {
    localStorage.setItem(storageKey, JSON.stringify(snapshot));
  } catch {
    // The timer remains fully usable when storage is unavailable.
  }
}

function restoreState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!saved) {
      return;
    }

    totalSeconds = normalizeSeconds(saved.totalSeconds) || totalSeconds;
    remainingSeconds = normalizeSeconds(saved.remainingSeconds) || totalSeconds;

    if (saved.phase === "running" && Number.isFinite(saved.endTime)) {
      endTime = Math.min(saved.endTime, Date.now() + MAX_SECONDS * 1000);
      remainingSeconds = remainingFromEndTime(endTime);
      if (remainingSeconds > 0) {
        phase = "running";
        startInterval();
        void scheduleNativeAlarm();
      } else {
        phase = "finished";
      }
    } else if (saved.phase === "paused" && remainingSeconds > 0) {
      phase = "paused";
    } else if (saved.phase === "finished") {
      phase = "finished";
      remainingSeconds = 0;
    } else {
      remainingSeconds = totalSeconds;
    }
  } catch {
    // A corrupt prior snapshot should never prevent the timer from opening.
  }
}

function getStatusCopy() {
  if (phase === "running") {
    return {
      caption: "TIME LEFT",
      live: formatClock(remainingSeconds) + " remaining."
    };
  }

  if (phase === "paused") {
    return {
      caption: "ON HOLD",
      live: "Paused with " + formatClock(remainingSeconds) + " remaining."
    };
  }

  if (phase === "finished") {
    return {
      caption: "TIME UP",
      live: "Time is up."
    };
  }

  return {
    caption: "ON THE DIAL",
    live: formatClock(totalSeconds) + " is loaded."
  };
}

function setWindowTitle() {
  const title = phase === "running"
    ? formatClock(remainingSeconds) + " - Ovo Timer"
    : "Ovo Timer";
  document.title = title;
  window.ovoBridge?.setWindowTitle?.(title);
}

function render() {
  const activeSeconds = phase === "finished" ? 0 : remainingSeconds;
  const progress = timerProgress(totalSeconds, activeSeconds, phase !== "idle");
  const trace = doubleLapProgress(activeSeconds);
  const copy = getStatusCopy();

  refs.dial.style.setProperty("--progress", progress + "turn");
  refs.dialRim.style.setProperty("--trace-outer", trace.outer + "turn");
  refs.dialRim.style.setProperty("--trace-inner", trace.inner + "turn");
  refs.dialRim.classList.toggle("is-outer-full", trace.outer >= 1);
  refs.dialRim.classList.toggle("is-inner-full", trace.inner >= 1);
  refs.dial.dataset.phase = phase;
  refs.timerValue.textContent = formatClock(activeSeconds);
  refs.timerCaption.textContent = copy.caption;
  refs.liveStatus.textContent = copy.live;
  refs.dial.setAttribute("aria-valuenow", String(activeSeconds));
  refs.addButtons.forEach((button) => {
    button.disabled = !["running", "paused"].includes(phase) || remainingSeconds >= MAX_SECONDS;
  });
  refs.addStatus.textContent = remainingSeconds >= MAX_SECONDS && phase !== "finished"
    ? "60-minute limit reached"
    : phase === "running" ? "ADD TIME · KEEP GOING" : phase === "paused" ? "ADD TIME · STAY PAUSED" : "ADD TIME WHILE RUNNING";
  refs.dial.setAttribute("aria-valuetext", formatClock(activeSeconds) + (phase === "running" ? " remaining" : " selected"));
  setWindowTitle();
}

function clearIntervalTimer() {
  if (intervalId) {
    window.clearInterval(intervalId);
    intervalId = 0;
  }
}

function startInterval() {
  clearIntervalTimer();
  intervalId = window.setInterval(tick, 200);
}

function nativeLocalNotifications() {
  if (nativePlatform !== "android") {
    return null;
  }

  return window.capacitorLocalNotifications?.LocalNotifications
    ?? window.Capacitor?.Plugins?.LocalNotifications
    ?? null;
}

function nativeOvoAlarm() {
  if (
    nativePlatform !== "android"
    || !window.Capacitor?.isPluginAvailable?.("OvoAlarm")
  ) {
    return null;
  }

  return window.ovoNativeAlarm ?? window.Capacitor?.Plugins?.OvoAlarm ?? null;
}

async function ensureNativeAlarmReady() {
  const plugin = nativeLocalNotifications();
  if (!plugin) {
    return null;
  }

  try {
    const permission = await plugin.checkPermissions?.();
    if (permission?.display && permission.display !== "granted") {
      const requested = await plugin.requestPermissions?.();
      if (requested?.display && requested.display !== "granted") {
        return null;
      }
    }

    await plugin.createChannel?.({
      id: notificationChannel,
      name: "Ovo alarm fallback",
      description: "Fallback countdown alerts if Android alarm mode is unavailable",
      importance: 5,
      sound: "ovo_alarm.wav",
      vibration: true,
      lights: true,
      lightColor: "#FFD30A"
    });
    return plugin;
  } catch {
    return null;
  }
}

async function requestNativeAlarmPriorityAccess() {
  const alarm = nativeOvoAlarm();
  if (!alarm) {
    return;
  }

  try {
    const status = await alarm.getStatus();
    if (!status.exactAlarm || !status.fullScreen || !status.doNotDisturb) {
      await alarm.requestPriorityAccess();
    }
  } catch {
    // Android system settings are optional; the alarm still uses the strongest available path.
  }
}

function cancelNativeAlarm() {
  const request = ++nativeAlarmRequest;
  nativeAlarmScheduled = false;
  stopAlarmAudio();
  nativeAlarmQueue = nativeAlarmQueue.catch(() => undefined).then(() => cancelNativeAlarmNow(request));
  return nativeAlarmQueue;
}

async function cancelNativeAlarmNow(request) {

  const alarm = nativeOvoAlarm();
  if (alarm) {
    try {
      await alarm.cancel();
    } catch {
      // Continue cancelling the standard fallback notification below.
    }
  }

  const plugin = nativeLocalNotifications();
  if (!plugin) {
    return request;
  }

  try {
    await plugin.cancel({ notifications: [{ id: notificationId }] });
  } catch {
    // The timer remains usable if notification cancellation is unavailable.
  }

  return request;
}

function scheduleNativeAlarm() {
  const request = ++nativeAlarmRequest;
  nativeAlarmQueue = nativeAlarmQueue.catch(() => undefined).then(() => {
    if (request !== nativeAlarmRequest || phase !== "running") return;
    return scheduleNativeAlarmNow(request);
  });
  return nativeAlarmQueue;
}

async function scheduleNativeAlarmNow(request) {
  const alarm = nativeOvoAlarm();
  if (alarm) {
    try {
      const result = await alarm.schedule({
        at: endTime,
        title: "Ovo Timer",
        body: "Time is up. Stop the alarm."
      });
      if (phase === "running" && endTime && request === nativeAlarmRequest) {
        nativeAlarmScheduled = Boolean(result?.scheduled);
        if (nativeAlarmScheduled) return;
      }
    } catch {
      // The standard Capacitor notification remains a safety fallback.
    }
  }

  const plugin = await ensureNativeAlarmReady();
  if (!plugin || phase !== "running" || !endTime || request !== nativeAlarmRequest) {
    return;
  }

  try {
    await plugin.cancel({ notifications: [{ id: notificationId }] });
    if (phase !== "running" || !endTime || request !== nativeAlarmRequest) {
      return;
    }

    await plugin.schedule({
      notifications: [{
        id: notificationId,
        title: "Ovo Timer",
        body: "Time is up. Your countdown is complete.",
        schedule: {
          at: new Date(endTime),
          allowWhileIdle: true
        },
        channelId: notificationChannel,
        sound: "ovo_alarm.wav",
        ongoing: true,
        autoCancel: false
      }]
    });
    nativeAlarmScheduled = true;
  } catch {
    // The foreground alarm and in-app status remain the fallback.
  }
}

function requestNotificationPermission() {
  if (nativePlatform === "android") {
    void ensureNativeAlarmReady();
    return;
  }

  if (window.ovoBridge || typeof Notification === "undefined") {
    return;
  }

  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => undefined);
  }
}

function startTimer() {
  if (totalSeconds < MIN_SECONDS) {
    totalSeconds = MIN_SECONDS;
    remainingSeconds = MIN_SECONDS;
  }

  if (phase === "finished" || remainingSeconds <= 0) {
    void cancelNativeAlarm();
    remainingSeconds = totalSeconds;
  }

  if (phase === "running") {
    return;
  }

  phase = "running";
  endTime = Date.now() + remainingSeconds * 1000;
  requestNotificationPermission();
  void requestNativeAlarmPriorityAccess();
  void scheduleNativeAlarm();
  startInterval();
  saveState();
  tick();
}

function pauseTimer() {
  if (phase !== "running") {
    return;
  }

  remainingSeconds = remainingFromEndTime(endTime);
  if (remainingSeconds <= 0) {
    finishTimer();
    return;
  }
  clearIntervalTimer();
  endTime = 0;
  phase = remainingSeconds > 0 ? "paused" : "finished";
  void cancelNativeAlarm();
  saveState();
  render();
}

function resetTimer() {
  clearIntervalTimer();
  void cancelNativeAlarm();
  endTime = 0;
  remainingSeconds = totalSeconds;
  phase = "idle";
  saveState();
  render();
}

function loadTimer(seconds) {
  const safeSeconds = clamp(normalizeSeconds(seconds), MIN_SECONDS, MAX_SECONDS);
  clearIntervalTimer();
  totalSeconds = safeSeconds;
  remainingSeconds = safeSeconds;
  endTime = 0;
  phase = "idle";
  saveState();
  render();
  return safeSeconds;
}

function setTimer(seconds) {
  const cancellation = cancelNativeAlarm();
  const safeSeconds = loadTimer(seconds);
  return { cancellation, safeSeconds };
}

async function startLoadedTimer({ cancellation, safeSeconds }) {
  const cancellationRequest = await cancellation;

  if (
    cancellationRequest !== nativeAlarmRequest
    || phase !== "idle"
    || totalSeconds !== safeSeconds
  ) {
    return;
  }

  startTimer();
}

function startPresetTimer(seconds) {
  return startLoadedTimer(setTimer(seconds));
}

function addMinutes(minutes) {
  if (![1, 2, 3].includes(minutes) || !["running", "paused"].includes(phase)) return;
  cancelDialGesture();
  const now = Date.now();
  if (phase === "running") {
    if (endTime <= now) {
      finishTimer();
      return;
    }
    // Extend the existing deadline, preserving fractional seconds and elapsed time.
    endTime = Math.min(endTime + minutes * 60_000, now + MAX_SECONDS * 1000);
    remainingSeconds = remainingFromEndTime(endTime, now);
    void scheduleNativeAlarm();
  } else {
    remainingSeconds = Math.min(MAX_SECONDS, remainingSeconds + minutes * 60);
  }
  saveState();
  render();
}

function toggleTimer() {
  if (phase === "running") {
    pauseTimer();
    return;
  }

  startTimer();
}

function stopAlarmAudio() {
  if (alarmAudio) {
    void alarmAudio.close().catch(() => undefined);
    alarmAudio = null;
  }
}

function ringAlarm() {
  try {
    const AudioApi = window.AudioContext || window.webkitAudioContext;
    if (!AudioApi) {
      return;
    }

    const context = new AudioApi();
    stopAlarmAudio();
    alarmAudio = context;
    const master = context.createGain();
    master.gain.setValueAtTime(0.13, context.currentTime);
    master.connect(context.destination);

    const beepCount = 16;
    const period = 0.34;
    const duration = 0.22;
    for (let index = 0; index < beepCount; index += 1) {
      const offset = index * period;
      const start = context.currentTime + offset;
      const envelope = context.createGain();
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(1, start + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration - 0.012);
      envelope.connect(master);

      const oscillator = context.createOscillator();
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(index % 3 === 1 ? 880 : 660, start);
      oscillator.connect(envelope);
      oscillator.start(start);
      oscillator.stop(start + duration);
    }

    window.setTimeout(() => {
      if (alarmAudio === context) stopAlarmAudio();
    }, 5600);
  } catch {
    // Audio is a nice-to-have, and the visual/native notification still lands.
  }
}

async function notifyFinished() {
  const details = {
    title: "Ovo Timer",
    body: "Time is up. Stop the alarm."
  };

  try {
    const alarm = nativeOvoAlarm();
    if (alarm) {
      // Android owns a scheduled alarm, including dismissal while the app is backgrounded.
      if (nativeAlarmScheduled) return true;
      await alarm.fireNow(details);
      nativeAlarmScheduled = true;
      return true;
    }

    if (nativeLocalNotifications()) {
      if (!nativeAlarmScheduled) {
        const plugin = await ensureNativeAlarmReady();
        await plugin?.schedule({
          notifications: [{
            id: notificationId,
            title: details.title,
            body: details.body,
            channelId: notificationChannel,
            sound: "ovo_alarm.wav",
            ongoing: true,
            autoCancel: false
          }]
        });
      }
      return false;
    }

    if (window.ovoBridge?.notify) {
      await window.ovoBridge.notify(details);
      return false;
    }

    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(details.title, { body: details.body });
    }
  } catch {
    // Notification permissions are controlled by the host operating system.
  }

  return false;
}

function finishTimer() {
  clearIntervalTimer();
  remainingSeconds = 0;
  endTime = 0;
  phase = "finished";
  saveState();
  render();
  if (nativePlatform === "android" && nativeOvoAlarm()) {
    void notifyFinished().then((nativeAlarmTriggered) => {
      if (!nativeAlarmTriggered) {
        ringAlarm();
      }
    });
    return;
  }

  ringAlarm();
  void notifyFinished();
}

function tick() {
  if (phase !== "running") {
    return;
  }

  remainingSeconds = remainingFromEndTime(endTime);
  if (remainingSeconds <= 0) {
    finishTimer();
    return;
  }

  render();
}

function movementExceedsThreshold(gesture, event) {
  return Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) >= gestureThreshold;
}

function dialPosition(event) {
  const dialRect = refs.dial.getBoundingClientRect();
  const faceRect = refs.dialFace.getBoundingClientRect();
  const centerX = dialRect.left + dialRect.width / 2;
  const centerY = dialRect.top + dialRect.height / 2;
  const x = event.clientX - centerX;
  const y = event.clientY - centerY;
  const distance = Math.hypot(x, y);
  const dialRadius = Math.min(dialRect.width, dialRect.height) / 2;
  const faceRadius = Math.min(faceRect.width, faceRect.height) / 2;

  return {
    onClockFace: distance <= faceRadius + 1,
    onProgressBand: distance > faceRadius + 1 && distance <= dialRadius + dragOuterPadding,
    degrees: Math.atan2(x, -y) * (180 / Math.PI)
  };
}

function handleDialPointerDown(event) {
  if (event.button !== 0 || event.isPrimary === false) return;
  cancelDialGesture();
  const position = dialPosition(event);

  if (position.onClockFace) {
    event.preventDefault();
    if (nativePlatform === "android") {
      refs.dial.blur();
    } else {
      refs.dial.focus({ preventScroll: true });
    }
    toggleTimer();
    return;
  }

  if (!position.onProgressBand) {
    return;
  }

  event.preventDefault();
  dialGesture = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    lastDegrees: position.degrees,
    selectedSeconds: totalSeconds,
    cancellation: null,
    changedTime: false
  };
  refs.dialRim.setPointerCapture?.(event.pointerId);
}

function handleDialPointerMove(event) {
  if (!dialGesture || dialGesture.pointerId !== event.pointerId) {
    return;
  }

  if (!dialGesture.changedTime && !movementExceedsThreshold(dialGesture, event)) {
    return;
  }

  if (!dialGesture.changedTime) {
    dialGesture.changedTime = true;
    dialGesture.cancellation = cancelNativeAlarm();
  }
  refs.dialRim.classList.add("is-dragging");
  const currentDegrees = dialPosition(event).degrees;
  const deltaDegrees = shortestAngleDelta(dialGesture.lastDegrees, currentDegrees);
  dialGesture.lastDegrees = currentDegrees;
  dialGesture.selectedSeconds = secondsAfterDialRotation(
    dialGesture.selectedSeconds,
    deltaDegrees
  );
  loadTimer(dialGesture.selectedSeconds);
}

function cancelDialGesture() {
  if (!dialGesture) {
    return;
  }

  const pointerId = dialGesture.pointerId;
  dialGesture = null;
  refs.dialRim.classList.remove("is-dragging");
  if (refs.dialRim.hasPointerCapture?.(pointerId)) {
    refs.dialRim.releasePointerCapture(pointerId);
  }
}

function finishDialGesture(event) {
  if (!dialGesture || dialGesture.pointerId !== event.pointerId) {
    return;
  }

  const startRequest = dialGesture.changedTime && dialGesture.cancellation
    ? { cancellation: dialGesture.cancellation, safeSeconds: totalSeconds }
    : null;
  cancelDialGesture();

  if (startRequest) {
    void startLoadedTimer(startRequest);
  }
}

function handleDialKeyboard(event) {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  const largeStep = event.shiftKey ? 5 * 60 : 60;
  let handled = true;

  if (event.key === "ArrowRight" || event.key === "ArrowUp") {
    setTimer(totalSeconds + largeStep);
  } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
    setTimer(totalSeconds - largeStep);
  } else if (event.key === "PageUp") {
    setTimer(totalSeconds + 10 * 60);
  } else if (event.key === "PageDown") {
    setTimer(totalSeconds - 10 * 60);
  } else if (event.key === "Enter" || event.key === " ") {
    toggleTimer();
  } else {
    handled = false;
  }

  if (handled) {
    event.preventDefault();
    event.stopPropagation();
  }
}

refs.presetButtons.forEach((button) => {
  button.addEventListener("pointerdown", cancelDialGesture);
  button.addEventListener("click", () => {
    void startPresetTimer(Number(button.dataset.minutes) * 60);
  });
});

refs.addButtons.forEach((button) => {
  button.addEventListener("click", () => addMinutes(Number(button.dataset.addMinutes)));
});

refs.dialRim.addEventListener("pointerdown", handleDialPointerDown);
refs.dialRim.addEventListener("pointermove", handleDialPointerMove);
refs.dialRim.addEventListener("pointerup", finishDialGesture);
refs.dialRim.addEventListener("pointercancel", finishDialGesture);
refs.dialRim.addEventListener("lostpointercapture", finishDialGesture);
refs.dial.addEventListener("keydown", handleDialKeyboard);
refs.dial.addEventListener("focus", () => {
  if (nativePlatform === "android") {
    refs.dial.blur();
  }
});
refs.settingsButton?.addEventListener("click", () => showScreen("settings"));
refs.backButton?.addEventListener("click", () => showScreen("timer"));
refs.themeButtons.forEach((button) => {
  button.addEventListener("click", () => applyTheme(button.dataset.themeOption));
});
window.addEventListener("blur", cancelDialGesture);

window.addEventListener("keydown", (event) => {
  const target = event.target;
  const editing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
  if (event.defaultPrevented || event.repeat || editing || target?.closest?.("button, a, select") || currentScreen !== "timer" || event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }

  if (event.key === " " || event.code === "Space") {
    event.preventDefault();
    toggleTimer();
  } else if (event.key.toLowerCase() === "r") {
    event.preventDefault();
    resetTimer();
  }
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    tick();
  }
});

restorePreferences();
restoreState();
render();
