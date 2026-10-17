// Capture frozen story frames.
//
//   npm run preview -- --port 4500 &
//   node scripts/capture-frames.mjs <outdir> <width> <height> <light|dark> <frames>
//
// <frames> is a comma-separated list of "step:seconds" (seconds since the step was entered,
// e.g. 8:4.5) or legacy progress values like 8.6. Frames land in <outdir> as 000.png, 001.png…
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const [out, width, height, scheme, list] = process.argv.slice(2);
if (!out || !list) {
  console.error("usage: capture-frames.mjs <outdir> <width> <height> <light|dark> <step:seconds,...>");
  process.exit(1);
}
const base = process.env.ATLAS_URL ?? "http://localhost:4500/";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: Number(width), height: Number(height) },
  colorScheme: scheme,
  deviceScaleFactor: 1,
});

for (const [index, token] of list.split(",").entries()) {
  const [step, seconds] = token.split(":");
  const query = seconds === undefined ? `p=${step}` : `step=${step}&t=${seconds}`;
  await page.goto(`${base}?${query}`, { waitUntil: "networkidle" });
  // Let the card entrance transition finish.
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${String(index).padStart(3, "0")}.png` });
}
await browser.close();
