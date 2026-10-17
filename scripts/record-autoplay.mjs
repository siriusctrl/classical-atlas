// Record the whole story in autoplay mode as a WebM, and report console errors.
//
//   npm run preview -- --port 4500 &
//   node scripts/record-autoplay.mjs <outdir> [width] [height] [light|dark]
//
// Turn the result into a contact sheet with, for example:
//   ffmpeg -i <outdir>/*.webm -vf "fps=1/4,scale=360:-1,tile=6x8" -frames:v 1 sheet.png
import { chromium } from "@playwright/test";

const [dir, width = "1440", height = "900", scheme = "light"] = process.argv.slice(2);
if (!dir) {
  console.error("usage: record-autoplay.mjs <outdir> [width] [height] [light|dark]");
  process.exit(1);
}
const base = process.env.ATLAS_URL ?? "http://localhost:4500/";
const size = { width: Number(width), height: Number(height) };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: size, colorScheme: scheme, recordVideo: { dir, size } });
const page = await context.newPage();
const errors = [];
page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
page.on("pageerror", (error) => errors.push(String(error)));

await page.goto(base, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.click(".play");
const started = Date.now();
while (Date.now() - started < 15 * 60 * 1000) {
  await page.waitForTimeout(1000);
  if ((await page.getAttribute(".play", "aria-pressed")) === "false") break;
}
console.log(`recorded ${((Date.now() - started) / 1000).toFixed(0)}s, console errors: ${errors.length}`);
for (const error of errors) console.log(`  ${error}`);
await context.close();
await browser.close();
process.exit(errors.length > 0 ? 1 : 0);
