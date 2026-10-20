// Find things drawn on top of each other: play the documentary on a virtual clock, sample the
// screen, and report every pair of visible elements whose boxes overlap where they should not.
//
//   npm run preview -- --port 4500 &
//   node scripts/audit-overlaps.mjs [fromStep] [toStep] [samplesPerSecond] [width] [height]
//
// Prints overlap counts by kind and the worst examples; exits 1 when any are found.
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
  "dot:maptext", "maptext:pin", "maptext:tag", "pin:tag", "dot:tag", "chrome:pin", "chrome:tag", "chrome:dot", "inset:pin", "dot:inset",
]);
const overlap = (a, b) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

const found = new Map();
const dt = 1000 / Number(rate);
for (let sample = 0; ; sample += 1) {
  const state = await page.evaluate((ms) => window.__atlas.export.advance(ms), dt);
  if (state.step > Number(to) || !state.playing || sample > 20000) break;
  const items = await page.evaluate(collect);
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const [a, b] = [items[i], items[j]].sort((p, q) => p.kind.localeCompare(q.kind));
      const pair = `${a.kind}:${b.kind}`;
      if (!forbidden.has(pair)) continue;
      // A city's own dot and its own label: the label sits beside the dot by design, but
      // must still clear it.
      const area = overlap(a, b);
      if (area < 6) continue;
      const key = `${pair} ${a.id}|${b.id} @${state.step}`;
      const seen = found.get(key);
      if (!seen || area > seen.area) found.set(key, { pair, step: state.step, a: a.id, b: b.id, area: Math.round(area), seconds: +(sample / Number(rate)).toFixed(1) });
    }
  }
}
await browser.close();

const list = [...found.values()];
const byPair = {};
for (const item of list) byPair[item.pair] = (byPair[item.pair] ?? 0) + 1;
console.log("overlaps by kind:", JSON.stringify(byPair));
for (const item of list.sort((p, q) => q.area - p.area).slice(0, Number(process.env.TOP ?? 40))) {
  console.log(`  ${item.pair.padEnd(16)} step ${String(item.step).padStart(2)}  ${item.a} × ${item.b}  ${item.area}px²  (t≈${item.seconds}s)`);
}
process.exit(list.length ? 1 : 0);
