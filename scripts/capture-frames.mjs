// Capture story frames at chosen progress values.
//
//   npm run preview -- --port 4500 &
//   node scripts/capture-frames.mjs <outdir> <width> <height> <light|dark> <P,P,...> [scroll|frozen]
//
// "scroll" (default) scrolls the real page so cards and map agree; "frozen" uses ?p= and
// hides the cards, which isolates the map. Frames land in <outdir> as 000.png, 001.png, ...
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const [out, width, height, scheme, list, mode = "scroll"] = process.argv.slice(2);
if (!out || !list) {
  console.error("usage: capture-frames.mjs <outdir> <width> <height> <light|dark> <P,P,...> [scroll|frozen]");
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
const values = list.split(",").map(Number);

if (mode === "scroll") await page.goto(base, { waitUntil: "networkidle" });
for (const [index, P] of values.entries()) {
  if (mode === "scroll") {
    // Scroll so the reading line sits at fraction f of step i, matching progressFromScroll().
    await page.evaluate((P) => {
      const sections = [...document.querySelectorAll(".step")];
      const step = Math.floor(P);
      const section = sections[step];
      const line = innerWidth <= 760 ? 0.62 : 0.5;
      const top = section.getBoundingClientRect().top + scrollY;
      scrollTo(0, top + (P - step) * section.offsetHeight - innerHeight * line);
    }, P);
    // Let the card entrance transition finish.
    await page.waitForTimeout(1000);
  } else {
    await page.goto(`${base}?p=${P}&t=0`, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: ".story,.sources{display:none}" });
    await page.waitForTimeout(100);
  }
  await page.screenshot({ path: `${out}/${String(index).padStart(3, "0")}.png` });
}
await browser.close();
