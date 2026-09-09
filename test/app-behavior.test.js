import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import * as engine from "../src/web/timer-engine.js";

const source = readFileSync(new URL("../src/web/app.js", import.meta.url), "utf8").replace(/^import\s*\{[\s\S]*?from "\.\/timer-engine.js";/, "");

function app(saved, alarm) {
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, {
      dataset: {}, style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} },
      attributes: {}, listeners: {}, setAttribute(k, v) { this.attributes[k] = v; },
      addEventListener(k, fn) { this.listeners[k] = fn; }, focus() {}, blur() {}
    });
    return elements.get(id);
  };
  const additions = [1, 2, 3].map((n) => Object.assign(element(`add${n}`), { dataset: { addMinutes: String(n) } }));
  const storage = new Map(saved ? [["ovo-timer-state-v1", JSON.stringify(saved)]] : []);
  const clock = { now: 1_000_000, intervals: 0, alarms: 0 };
  const window = {
    listeners: {}, addEventListener(k, fn) { this.listeners[k] = fn; },
    setInterval() { return ++clock.intervals; }, clearInterval() {}, setTimeout() {}, scrollTo() {},
    ovoBridge: { notify() { clock.alarms++; } },
    ...(alarm ? { Capacitor: { getPlatform: () => "android", isPluginAvailable: () => true }, ovoNativeAlarm: alarm } : {})
  };
  const context = vm.createContext({
    ...engine, window, Date: { now: () => clock.now },
    remainingFromEndTime: (end, now = clock.now) => engine.remainingFromEndTime(end, now),
    HTMLInputElement: class {}, HTMLTextAreaElement: class {},
    localStorage: { getItem: (k) => storage.get(k), setItem: (k, v) => storage.set(k, v) },
    document: { documentElement: element("html"), body: element("body"),
      querySelector: element, querySelectorAll: (s) => s === "[data-add-minutes]" ? additions : [], addEventListener() {} }
  });
  vm.runInContext(source, context);
  return { run: (code) => vm.runInContext(code, context), clock, window, element, additions,
    saved: () => JSON.parse(storage.get("ovo-timer-state-v1")) };
}

test("each increment extends the exact deadline without restarting the interval or original duration", async () => {
  const a = app();
  a.run("startTimer()");
  const deadline = a.run("endTime");
  a.clock.now += 1234;
  a.run("addMinutes(1); addMinutes(2); addMinutes(3)");
  assert.equal(a.run("endTime"), deadline + 360_000);
  assert.equal(a.run("phase"), "running");
  assert.equal(a.run("totalSeconds"), 1500);
  assert.equal(a.clock.intervals, 1);
  assert.equal(a.saved().endTime, deadline + 360_000);
  const restored = app(a.saved());
  assert.equal(restored.run("endTime"), deadline + 360_000);
});

test("paused additions stay paused; resume uses the extended remaining duration", () => {
  const a = app();
  a.run("startTimer(); pauseTimer(); addMinutes(3)");
  assert.equal(a.run("phase"), "paused");
  assert.equal(a.run("endTime"), 0);
  assert.equal(a.run("remainingSeconds"), 1680);
  a.run("startTimer()");
  assert.equal(a.run("endTime"), a.clock.now + 1680_000);
});

test("increments cap remaining time at 60 minutes and reset keeps the original duration", () => {
  const a = app();
  a.run("loadTimer(3590); startTimer(); addMinutes(3)");
  assert.equal(a.run("remainingSeconds"), 3600);
  assert.ok(a.additions.every((b) => b.disabled));
  a.run("resetTimer()");
  assert.equal(a.run("remainingSeconds"), 3590);
});

test("expired timers finish once even if increment or pause happens before the next tick", () => {
  for (const action of ["addMinutes(1)", "pauseTimer()"]) {
    const a = app();
    a.run("loadTimer(10); startTimer()");
    a.clock.now += 10_001;
    a.run(`${action}; tick(); addMinutes(2)`);
    assert.equal(a.run("phase"), "finished");
    assert.equal(a.run("remainingSeconds"), 0);
    assert.equal(a.clock.alarms, 1);
  }
});

test("finished and idle snapshots restore consistent display and phase", () => {
  const finished = app({ phase: "finished", totalSeconds: 300, remainingSeconds: 0, endTime: 0 });
  assert.equal(finished.run("phase"), "finished");
  assert.equal(finished.element("#timerValue").textContent, "00:00");
  const idle = app({ phase: "idle", totalSeconds: 300, remainingSeconds: 20, endTime: 0 });
  assert.equal(idle.run("remainingSeconds"), 300);
});

test("space on a focused button and repeated keys do not toggle the timer", () => {
  const a = app();
  a.run("startTimer()");
  a.window.listeners.keydown({ key: " ", target: { closest: () => ({}) } });
  a.window.listeners.keydown({ key: " ", repeat: true });
  assert.equal(a.run("phase"), "running");
});

test("native scheduling is serialized so rapid increments cannot overwrite the latest deadline", async () => {
  const calls = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const a = app(null, {
    getStatus: async () => ({ exactAlarm: true, fullScreen: true, doNotDisturb: true }),
    schedule: async ({ at }) => { calls.push(at); if (calls.length === 1) await gate; return { scheduled: true }; },
    cancel: async () => calls.push("cancel")
  });
  a.run("startTimer()");
  await new Promise(setImmediate);
  a.run("addMinutes(1); addMinutes(2); addMinutes(3)");
  release();
  await a.run("nativeAlarmQueue");
  assert.equal(calls.length, 2);
  assert.equal(calls.at(-1), a.run("endTime"));
  a.run("pauseTimer()");
  await a.run("nativeAlarmQueue");
  assert.equal(calls.at(-1), "cancel");
});

test("foreground expiry does not re-fire an alarm already owned by Android", async () => {
  let fires = 0;
  const a = app(null, {
    getStatus: async () => ({ exactAlarm: true, fullScreen: true, doNotDisturb: true }),
    schedule: async () => ({ scheduled: true }), fireNow: async () => { fires++; }
  });
  a.run("loadTimer(10); startTimer()");
  await a.run("nativeAlarmQueue");
  a.clock.now += 11_000;
  a.run("tick()");
  await new Promise(setImmediate);
  assert.equal(fires, 0);
  assert.equal(a.run("phase"), "finished");
});
