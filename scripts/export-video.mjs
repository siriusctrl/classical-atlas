// Render autoplay to video on a virtual clock: every frame is computed for an exact time and
// screenshotted, so the result is smooth no matter how slow the machine is.
//
//   npm run preview -- --port 4500 &
//   node scripts/export-video.mjs <outdir> [fromStep] [toStep] [fps] [width] [height] [light|dark]
//
// Writes <outdir>/frames/*.jpg, <outdir>/camera.json (the camera on every frame, for
// checking motion), and <outdir>/video.mp4 when ffmpeg is available. ATLAS_NO_FRAMES=1 skips
// screenshots and only logs the camera.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const [out, from = "1", to = "3", fps = "30", width = "1920", height = "1080", scheme = "light"] = process.argv.slice(2);
if (!out) {
  console.error("usage: export-video.mjs <outdir> [fromStep] [toStep] [fps] [width] [height] [light|dark]");
  process.exit(1);
}
const base = process.env.ATLAS_URL ?? "http://localhost:4500/";
const frames = process.env.ATLAS_NO_FRAMES !== "1";
mkdirSync(`${out}/frames`, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) }, colorScheme: scheme });
await page.goto(`${base}${scheme === "dark" ? "?theme=dark" : ""}`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.evaluate((step) => window.__atlas.export.begin(step), Number(from));

const camera = [];
const dt = 1000 / Number(fps);
for (let index = 0; ; index += 1) {
  const state = await page.evaluate((ms) => window.__atlas.export.advance(ms), dt);
  camera.push(state);
  if (frames) await page.screenshot({ path: `${out}/frames/${String(index).padStart(5, "0")}.jpg`, quality: 90, type: "jpeg" });
  if (state.step > Number(to) || !state.playing || index > Number(fps) * 60 * 20) break;
}
writeFileSync(`${out}/camera.json`, JSON.stringify(camera));
await browser.close();
console.log(`${camera.length} frames (${(camera.length / Number(fps)).toFixed(1)}s)`);

if (frames) {
  try {
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-framerate", fps, "-i", `${out}/frames/%05d.jpg`,
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", `${out}/video.mp4`]);
    console.log(`video: ${out}/video.mp4`);
  } catch {
    console.log("ffmpeg not available; frames are in", `${out}/frames`);
  }
}
