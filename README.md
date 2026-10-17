# Classical Atlas

Scroll-driven map stories about the ancient Greek and Roman world, in Chinese. Chapter 1 follows the Peloponnesian War (431–404 BC) along one causal thread: Athens lived like an island fed by sea, Sparta feared its own helots, and the war ended where it began, on the grain route through the Hellespont.

Live: <https://siriusctrl.github.io/classical-atlas/>

## Run

```sh
npm install
npm run dev        # http://localhost:5173/
npm run check      # type-check and build into dist/
```

`?p=4.5` freezes the story at a progress value (step index + fraction); `&t=0` fixes the ambient clock. `window.__atlas.render(P, time)` does the same from a script.

## How it works

- `src/story.ts` holds the narrative steps, cameras, map marks, insets, full-screen quotes, and the alliance timeline.
- `src/main.ts` renders each frame as a pure function of story progress. Scrolling, the play button, and frame capture all choose a progress value, so the same scenes can later be rendered to video frame by frame.
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
