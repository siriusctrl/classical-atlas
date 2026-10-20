// Find things drawn on top of each other or crowded together: play the documentary on a virtual
// clock, sample the screen, and report every pair of visible elements that overlap where they
// should not, or stand closer than a comfortable clearance.
//
//   npm run preview -- --port 4500 &
//   node scripts/audit-overlaps.mjs [fromStep] [toStep] [samplesPerSecond] [width] [height]
//
// Prints counts by kind and the worst examples; exits 1 when any are found.
import { chromium } from "@playwright/test";

const [from = "1", to = "33", rate = "2", width = "1440", height = "900"] = process.argv.slice(2);
const base = process.env.ATLAS_URL ?? "http://localhost:4500/";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
await page.goto(base, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.evaluate((step) => window.__atlas.export.begin(step), Number(from));

const collect = () => {
  const visibility = (element) => {
    let alpha = 1;
    for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") return 0;
      alpha *= Number(style.opacity);
    }
    return alpha;
  };
  const items = [];
  const add = (kind, element, id = "") => {
    if (visibility(element) < 0.3) return;
    const rect = element.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    items.push({ kind, id, x: rect.left, y: rect.top, w: rect.width, h: rect.height });
    // Text cut off by the edge of the screen.
    if (kind === "label" || kind === "caption" || kind === "callout") {
      if (rect.left < 0 || rect.top < 0 || rect.right > innerWidth || rect.bottom > innerHeight) items.push({ kind: "screen-edge", id, x: rect.left, y: rect.top, w: rect.width, h: rect.height });
    }
  };
  document.querySelectorAll(".place-label").forEach((element) => add("label", element, element.dataset.place));
  document.querySelectorAll(".place-dot").forEach((element) => add("dot", element, element.dataset.place));
  document.querySelectorAll(".beat-pin").forEach((element) => add("pin", element));
  document.querySelectorAll(".route-tag").forEach((element) => add("tag", element, element.textContent));
  document.querySelectorAll(".region-label, .sea-label").forEach((element) => add("maptext", element.parentElement, element.textContent));
  document.querySelectorAll(".caption").forEach((element) => add("caption", element, element.textContent.slice(0, 8)));
  for (const [kind, selector] of [["callout", ".callout"], ["inset", ".map-inset"], ["chrome", ".map-tools"], ["chrome", ".map-year"], ["chrome", ".controls"], ["chrome", ".masthead"], ["chrome", ".chapter-tag"]]) {
    const element = document.querySelector(selector);
    if (element) add(kind, element, selector);
  }
  return items;
};

// Pairs that must not overlap. Dots may touch dots (cities are where they are), and a pin
// may sit on its own city.
const forbidden = new Set([
  "label:label", "dot:label", "label:pin", "label:tag", "label:maptext", "caption:label", "callout:label", "inset:label", "chrome:label",
  "caption:dot", "caption:pin", "caption:tag", "caption:maptext", "caption:caption", "callout:caption", "caption:inset", "caption:chrome",
  "callout:dot", "callout:pin", "callout:tag", "callout:maptext",
  "dot:maptext", "maptext:pin", "maptext:tag", "pin:tag", "dot:tag", "chrome:pin", "chrome:tag", "chrome:dot", "inset:pin", "dot:inset", "chrome:inset", "chrome:callout", "callout:inset",
]);
// Clear space, in pixels, two kinds of element need between them to read as separate and
// unhurried. A pin on its own city (centres within a few pixels) is one marker, not crowding.
const clearance = {
  "label:label": 4, "dot:label": 3, "label:pin": 4, "label:tag": 4, "label:maptext": 3,
  "pin:pin": 6, "dot:pin": 8, "pin:tag": 4, "dot:tag": 3,
  "caption:label": 8, "caption:dot": 8, "caption:pin": 10, "caption:tag": 8, "caption:caption": 12, "caption:inset": 10,
  "callout:dot": 6, "callout:label": 6, "callout:tag": 6,
};
const gapBetween = (a, b) =>
  Math.hypot(Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w)), Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h)));
const centre = (box) => [box.x + box.w / 2, box.y + box.h / 2];
const overlap = (a, b) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

const found = new Map();
const dt = 1000 / Number(rate);
for (let sample = 0; ; sample += 1) {
  const state = await page.evaluate((ms) => window.__atlas.export.advance(ms), dt);
  if (state.step > Number(to) || !state.playing || sample > 20000) break;
  const items = await page.evaluate(collect);
  for (const item of items.filter((candidate) => candidate.kind === "screen-edge")) {
    const key = `cut off ${item.id} @${state.step}`;
    if (!found.has(key)) found.set(key, { pair: "cut off by edge", measure: 1, unit: "", step: state.step, a: item.id, b: "screen", seconds: +(sample / Number(rate)).toFixed(1) });
  }
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const [a, b] = [items[i], items[j]].sort((p, q) => p.kind.localeCompare(q.kind));
      const pair = `${a.kind}:${b.kind}`;
      if (a.kind === "screen-edge" || b.kind === "screen-edge") continue;
      const area = overlap(a, b);
      const [ax, ay] = centre(a);
      const [bx, by] = centre(b);
      if (pair === "dot:pin" && Math.hypot(ax - bx, ay - by) < 4) continue;
      let problem;
      if (forbidden.has(pair) && area >= 6) problem = { pair, measure: Math.round(area), unit: "px² overlap" };
      else if (clearance[pair] !== undefined && area < 6) {
        const gap = gapBetween(a, b);
        if (gap < clearance[pair] - 0.5) problem = { pair: `${pair} crowded`, measure: +(clearance[pair] - gap).toFixed(1), unit: `px short of ${clearance[pair]}` };
      }
      if (!problem) continue;
      const key = `${problem.pair} ${a.id}|${b.id} @${state.step}`;
      const seen = found.get(key);
      if (!seen || problem.measure > seen.measure) found.set(key, { ...problem, step: state.step, a: a.id, b: b.id, seconds: +(sample / Number(rate)).toFixed(1) });
    }
  }
}
await browser.close();

const list = [...found.values()];
const byPair = {};
for (const item of list) byPair[item.pair] = (byPair[item.pair] ?? 0) + 1;
console.log("problems by kind:", JSON.stringify(byPair));
for (const item of list.sort((p, q) => q.measure - p.measure).slice(0, Number(process.env.TOP ?? 40))) {
  console.log(`  ${item.pair.padEnd(22)} step ${String(item.step).padStart(2)}  ${item.a} × ${item.b}  ${item.measure} ${item.unit}  (t≈${item.seconds}s)`);
}
process.exit(list.length ? 1 : 0);
