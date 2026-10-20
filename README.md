# Classical Atlas

Scroll-driven map stories about the ancient Greek and Roman world, in Chinese. Chapter 1 follows the Peloponnesian War (431–404 BC) along one causal thread: Athens lived like an island fed by sea, Sparta feared its own helots, and the war ended where it began, on the grain route through the Hellespont.

Live: <https://siriusctrl.github.io/classical-atlas/>

## Run

```sh
npm install
npm run dev        # http://localhost:5173/
npm run check      # type-check and build into dist/
```

Move between steps with the wheel, arrow keys, swipes, the controls, or the chapter strip; play turns the story into a paced, video-like sequence. Drag, pinch, double-click, or Ctrl+wheel to explore the map, and hover or tap a city for its note.

`node scripts/export-video.mjs <outdir> 1 3` renders autoplay from step 1 to 3 into a frame-exact MP4 on a virtual clock (with `npm run preview -- --port 4500` running).

`?step=12&t=4` freezes step 12 four seconds after it was entered; `#sicily` deep-links to a step. `window.__atlas.freeze(step, seconds)` does the same from a script.

## How it works

- `src/story.ts` holds the narrative steps, cameras, map marks, insets, full-screen quotes, and the alliance timeline.
- `src/main.ts` renders each frame as a pure function of the current step and the time since it began. Navigation, autoplay, and frame capture all choose a step and a time, so the same scenes can later be rendered to video frame by frame.
- `src/placeNotes.ts` holds the tooltip note for each place.
- `scripts/build-land.mjs` clips Natural Earth 10m land to the Mediterranean, simplifies it, and bakes it into `src/data/land.json` (`npm run build:land`).
- `docs/research.md` is the verified source brief behind the narrative.

See `AGENTS.md` for invariants, content rules, and the verification routine.

## Sources

- Thucydides, *History of the Peloponnesian War*; Xenophon, *Hellenica*; Herodotus; Pseudo-Xenophon, *Constitution of the Athenians*. Quotations are paraphrased in Chinese from English translations (Crawley, Brownson, Godley via Perseus) and cited by book.chapter.section.
- Site coordinates checked against [Pleiades](https://pleiades.stoa.org).
- Coastlines: [Natural Earth](https://www.naturalearthdata.com) (public domain), via `world-atlas`. These are modern coastlines. Sphacteria, missing from Natural Earth 10m, is a hand-traced approximation.
- Artifact photographs and their licenses are listed in `public/media/credits.json`.
- Fonts: Noto Serif SC and Cormorant Garamond (SIL Open Font License), via Fontsource.

## Deploy

Pushes to `main` run `.github/workflows/pages.yml`, which builds with Vite and publishes `dist/` to GitHub Pages.
