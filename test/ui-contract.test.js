import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const webRoot = new URL("../src/web/", import.meta.url);
const html = readFileSync(new URL("index.html", webRoot), "utf8");
const app = readFileSync(new URL("app.js", webRoot), "utf8");
const styles = readFileSync(new URL("styles.css", webRoot), "utf8");

test("offers the exact requested quick-load durations", () => {
  const minutes = Array.from(html.matchAll(/class="preset[^"]*" data-minutes="(\d+)"/g))
    .map((match) => Number(match[1]));

  assert.deepEqual(minutes, [1, 2, 3, 5, 10, 15, 20, 30, 45]);
});

test("starts a countdown immediately after a preset is selected", () => {
  assert.match(app, /function startPresetTimer\(seconds\)/);
  assert.match(app, /return startLoadedTimer\(setTimer\(seconds\)\)/);
  assert.match(app, /void startPresetTimer\(Number\(button\.dataset\.minutes\) \* 60\)/);
  assert.match(html, /aria-label="One-tap countdown shortcuts"/);
});

test("starts a manually dragged duration whenever the pointer gesture ends", () => {
  assert.match(app, /dialGesture\.cancellation = cancelNativeAlarm\(\)/);
  assert.match(app, /void startLoadedTimer\(startRequest\)/);
  assert.match(app, /addEventListener\("pointercancel", finishDialGesture\)/);
});

test("keeps theme-only settings on a separate screen with eight persistent colorways", () => {
  assert.match(html, /id="settingsButton"/);
  assert.match(html, /id="settingsScreen"[^>]*hidden/);
  assert.match(html, /data-theme-option="dark"/);
  assert.match(html, /data-theme-option="light"/);
  assert.match(html, /data-theme-option="cobalt"/);
  assert.match(html, /data-theme-option="acid"/);
  assert.match(html, /data-theme-option="ocean"/);
  assert.match(html, /data-theme-option="ember"/);
  assert.match(html, /data-theme-option="forest"/);
  assert.match(html, /data-theme-option="mono"/);
  assert.doesNotMatch(html, /data-screensaver|screensaverLayer|PICK A SCREENSAVER/);
  assert.doesNotMatch(app, /screensaverMode|startScreensaver|renderScreensaverFrame/);
  assert.match(app, /const preferencesKey = "ovo-timer-preferences-v1"/);
  assert.match(app, /function applyTheme\(nextTheme, persist = true\)/);
  assert.match(app, /function showScreen\(screen\)/);
  assert.match(styles, /html\[data-theme="light"\]/);
  assert.match(styles, /html\[data-theme="cobalt"\]/);
  assert.match(styles, /html\[data-theme="acid"\]/);
  assert.match(styles, /html\[data-theme="ocean"\]/);
  assert.match(styles, /html\[data-theme="ember"\]/);
  assert.match(styles, /html\[data-theme="forest"\]/);
  assert.match(styles, /html\[data-theme="mono"\]/);
  assert.match(styles, /color-scheme:\s*dark/);
  assert.match(styles, /color-scheme:\s*light/);
});

test("renders full duration orbits without an offset shadow or conic seam", () => {
  assert.doesNotMatch(styles, /\.selection-trace\s*\{[^}]*drop-shadow/s);
  assert.match(styles, /\.dial-rim\.is-outer-full \.selection-trace-outer/);
  assert.match(styles, /\.dial-rim\.is-inner-full \.selection-trace-inner/);
  assert.match(app, /classList\.toggle\("is-outer-full", trace\.outer >= 1\)/);
  assert.match(app, /classList\.toggle\("is-inner-full", trace\.inner >= 1\)/);
});

test("renders two independent duration laps without a permanently filled color ring", () => {
  assert.doesNotMatch(html, /dial-wisp/);
  assert.doesNotMatch(styles, /\.dial-wisp/);
  assert.doesNotMatch(styles, /mix-blend-mode:\s*screen/);
  assert.doesNotMatch(styles, /--pink|var\(--pink\)|preset-pink/);
  assert.match(styles, /\.selection-trace\s*\{[^}]*z-index:\s*3/s);
  assert.match(styles, /\.selection-trace-outer\s*\{[^}]*inset:\s*-16px/s);
  assert.match(styles, /\.selection-trace-inner\s*\{[^}]*inset:\s*-26px/s);
  assert.match(styles, /\.dial-progress\s*\{[^}]*box-shadow:\s*0 0 0 10px var\(--ink\)/s);
  assert.doesNotMatch(styles, /0 0 0 16px var\(--orange\)/);
  assert.doesNotMatch(styles, /box-shadow:[^;]*var\(--orange\)/);
  assert.match(styles, /\.dial-face\s*\{[^}]*box-shadow:\s*inset 0 0 0 7px var\(--blue\)/s);
});

test("removes the screensaver feature and its moving background layer", () => {
  assert.doesNotMatch(html, /screensaver|flowerbox|bezier|3D MAZE/i);
  assert.doesNotMatch(app, /screensaver|requestAnimationFrame/i);
  assert.doesNotMatch(styles, /screensaver|option-art|option-detail/i);
  assert.equal(existsSync(new URL("../assets/screensaver-bezier.png", import.meta.url)), false);
  assert.equal(existsSync(new URL("../assets/screensaver-flowerbox.png", import.meta.url)), false);
  assert.equal(existsSync(new URL("../assets/screensaver-maze.png", import.meta.url)), false);
});

test("keeps the dial and shortcut layout centered", () => {
  assert.match(styles, /\.timer-layout\s*\{[^}]*justify-items:\s*center/s);
  assert.match(styles, /\.dial-zone\s*\{[^}]*place-items:\s*center/s);
  assert.match(styles, /\.dial-progress\s*\{[^}]*box-shadow:\s*0 0 0 10px var\(--ink\)/s);
  assert.match(styles, /\.side-panel\s*\{[^}]*width:\s*min\(368px, 68vw\)/s);
  assert.match(styles, /\.preset-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3, 1fr\)/s);
  assert.match(styles, /\.preset-grid\s*\{[^}]*gap:\s*7px/s);
  assert.match(styles, /\.preset\s*\{[^}]*min-height:\s*46px/s);
});
