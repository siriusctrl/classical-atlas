import "@fontsource-variable/noto-serif-sc";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/500-italic.css";
import "./style.css";
import { geoConicConformal } from "d3-geo";
import { interpolateRgb, interpolateZoom, type ZoomView } from "d3-interpolate";
import land from "./data/land.json";
import credits from "../public/media/credits.json";
import { places, type PlaceId, type Side } from "./places";
import { placeNotes } from "./placeNotes";
import {
  allegiance,
  phases,
  regions,
  seas,
  steps,
  type Camera,
  type Beat,
  type Inset,
  type MapText,
  type Mark,
  type Window as Span,
} from "./story";

// Every frame is a pure function of the current step, the time since it was entered, and an
// ambient clock for small idle motion. Navigation, autoplay, and frame capture all just pick
// a step and a time; exploring detaches only the camera.

type XY = [number, number];
type Point = PlaceId | XY;

const SVG = "http://www.w3.org/2000/svg";
const RULER = { from: 432, to: 404, labelled: [431, 421, 413, 404] };

const projection = geoConicConformal()
  .parallels(land.projection.parallels as XY)
  .rotate(land.projection.rotate as XY)
  .scale(land.projection.scale)
  .translate(land.projection.translate as XY);

const toWorld = (point: Point): XY =>
  projection(typeof point === "string" ? (places[point].at as XY) : point) as XY;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const clamp01 = (value: number) => clamp(value, 0, 1);
const smooth = (value: number) => {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
};
const within = (f: number, [start, end]: Span = [0, 1]) => clamp01((f - start) / (end - start));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const backOut = (t: number) => {
  const c = 1.9;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};
const band = (value: number, [a, b, c, d]: [number, number, number, number]) =>
  smooth((value - a) / (b - a)) * (1 - smooth((value - c) / (d - c)));
const indexOf = new Map(steps.map((step, index) => [step.id, index]));
const fixed = (value: number) => value.toFixed(1);

// Story time comes from this clock; video export swaps in a virtual one that advances
// exactly one frame at a time, so the result is independent of how fast the machine is.
let virtualNow: number | undefined;
const clock = (): number => virtualNow ?? performance.now();

// Attribute writes are cached so idle frames touch almost nothing.
const written = new WeakMap<Element, Map<string, string>>();
const set = (element: Element, name: string, value: string | number) => {
  const text = String(value);
  let cache = written.get(element);
  if (!cache) written.set(element, (cache = new Map()));
  if (cache.get(name) === text) return;
  cache.set(name, text);
  element.setAttribute(name, text);
};

const svgElement = <K extends keyof SVGElementTagNameMap>(
  name: K,
  attributes: Record<string, string | number> = {},
  parent?: Element,
) => {
  const element = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  parent?.append(element);
  return element;
};

// ---------- Layout ----------

const mapElement = document.querySelector<HTMLElement>(".map")!;
const svg = document.querySelector<SVGSVGElement>(".map-svg")!;
const dim = document.querySelector<HTMLElement>(".map-dim")!;
const yearNumber = document.querySelector<HTMLElement>(".year-number")!;
const ruler = document.querySelector<HTMLElement>(".ruler")!;
const insetElement = document.querySelector<HTMLElement>(".map-inset")!;
const panel = document.querySelector<HTMLElement>(".panel")!;
const quoteLayer = document.querySelector<HTMLElement>(".quote-layer")!;
const playButton = document.querySelector<HTMLButtonElement>(".play")!;
const speedButton = document.querySelector<HTMLButtonElement>(".speed")!;
const counter = document.querySelector<HTMLElement>(".counter")!;
const progressBar = document.querySelector<HTMLElement>(".autoplay-progress span")!;
const chapters = document.querySelector<HTMLElement>(".chapters")!;
const tooltip = document.querySelector<HTMLElement>(".tooltip")!;
const callout = document.querySelector<HTMLElement>(".callout")!;
const recenter = document.querySelector<HTMLButtonElement>(".recenter")!;
const series = document.querySelector<HTMLElement>(".masthead-series")!;
const tally = document.querySelector<HTMLElement>(".tally")!;
const tallyAthens = document.querySelector<HTMLElement>(".tally-athens")!;
const tallySparta = document.querySelector<HTMLElement>(".tally-sparta")!;

const layout = {
  width: 0,
  height: 0,
  mobile: false,
  fit: 1,
  // The card-mode stage sets the scale; the documentary stage (no card) only moves the
  // centre, so switching modes slides the map instead of rescaling it.
  stage: { x: 0, y: 0, w: 0, h: 0 },
  full: { x: 0, y: 0, w: 0, h: 0 },
  center: { x: 0, y: 0 },
};

const measure = () => {
  layout.width = mapElement.clientWidth;
  layout.height = mapElement.clientHeight;
  layout.mobile = layout.width <= 760;
  // The stage is the part of the screen the cards leave free; cameras centre on it.
  layout.stage = layout.mobile
    ? { x: 0, y: 96, w: layout.width, h: layout.height * 0.5 - 96 }
    : layout.width >= 1100
      ? { x: 500, y: 60, w: layout.width - 500, h: layout.height - 190 }
      : { x: 0, y: 60, w: layout.width, h: layout.height - 190 };
  layout.full = layout.mobile
    ? { x: 0, y: 96, w: layout.width, h: layout.height - 96 - 150 }
    : { x: 0, y: 60, w: layout.width, h: layout.height - 200 };
  layout.fit = Math.min(layout.stage.w / land.width, layout.stage.h / land.height);
  svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
  sizeCanvas();
};

// ---------- Colours ----------

const colorKeys = [
  "athens", "sparta", "neutral", "persia", "grain", "gold", "ember", "char", "field",
  "ruined", "land", "ink", "sea", "sea-light", "halo", "waterline", "coast", "land-shadow",
] as const;
const colors = Object.fromEntries(colorKeys.map((key) => [key, ""])) as Record<(typeof colorKeys)[number], string>;
const readColors = () => {
  const style = getComputedStyle(document.documentElement);
  for (const key of colorKeys) colors[key] = style.getPropertyValue(`--${key}`).trim();
};

// A fixed-seed paper grain, generated once and tiled over the base map.
const grainTile = (() => {
  const size = 220;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d")!;
  const image = context.createImageData(size, size);
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let index = 0; index < size * size; index += 1) {
    const value = 120 + random() * 110;
    image.data.set([value, value * 0.98, value * 0.94, 34 + random() * 30], index * 4);
  }
  context.putImageData(image, 0, 0);
  return canvas;
})();

// ---------- Camera ----------

const viewOf = (camera: Camera): ZoomView => {
  const [x, y] = toWorld(camera.at);
  return [x, y, layout.stage.w / (layout.fit * camera.zoom)];
};

// ---------- Static map ----------

// ---------- Base map (canvas) ----------

// Sea, coastline, waterlines, shadow, influence glows and paper grain share one canvas.
// As SVG, the 20k-point coastline was re-tessellated with non-scaling strokes on every
// camera frame and the blend-mode layers were re-composited; on canvas a still camera
// costs nothing and a moving one is a handful of fills.
const baseCanvas = document.createElement("canvas");
baseCanvas.className = "map-canvas";
baseCanvas.setAttribute("aria-hidden", "true");
mapElement.insertBefore(baseCanvas, svg);
const base = baseCanvas.getContext("2d")!;
const landPath = new Path2D(land.land);
const grainPattern = base.createPattern(grainTile, "repeat")!;
const WATERLINES = [[30, 0.16], [19, 0.26], [11, 0.38], [5, 0.55]] as const;
// The look is chosen, not inherited from the OS: light unless ?theme=dark asks otherwise.
if (new URLSearchParams(window.location.search).get("theme") === "dark") document.documentElement.dataset.theme = "dark";
const darkLook = () => document.documentElement.dataset.theme === "dark";
let pixelRatio = 1;
let baseKey = "";

type Glow = { x: number; y: number; r: number; color: string; alpha: number };
const glows: Glow[] = [];

const sizeCanvas = () => {
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  baseCanvas.width = Math.round(layout.width * pixelRatio);
  baseCanvas.height = Math.round(layout.height * pixelRatio);
  baseKey = "";
};

const withAlpha = (color: string, alpha: number) => {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  const channels = hex
    ? [0, 2, 4].map((offset) => parseInt(hex[1].slice(offset, offset + 2), 16))
    : (color.match(/[\d.]+/g) ?? ["0", "0", "0"]).slice(0, 3).map(Number);
  return `rgba(${channels.join(",")},${clamp01(alpha).toFixed(3)})`;
};

type Spotlight = { x: number; y: number; strength: number };

const drawBase = (s: number, ox: number, oy: number, light: Spotlight | undefined) => {
  const lightKey = light && light.strength > 0.01 ? `${light.x.toFixed(0)},${light.y.toFixed(0)},${light.strength.toFixed(2)}` : "";
  const key = `${ox.toFixed(2)}|${oy.toFixed(2)}|${s.toFixed(5)}|${lightKey}|${glows.map((glow) =>
    `${glow.x.toFixed(0)},${glow.y.toFixed(0)},${glow.r.toFixed(0)},${glow.color},${glow.alpha.toFixed(2)}`).join(";")}`;
  if (key === baseKey) return;
  baseKey = key;
  const { width, height } = layout;
  const context = base;
  context.globalCompositeOperation = "source-over";
  context.globalAlpha = 1;

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const sea = context.createRadialGradient(width * 0.62, height * 0.48, 0, width * 0.62, height * 0.48, Math.hypot(width, height) * 0.62);
  sea.addColorStop(0, colors["sea-light"]);
  sea.addColorStop(1, colors.sea);
  context.fillStyle = sea;
  context.fillRect(0, 0, width, height);

  // World units from here; widths are divided by the scale to stay constant on screen.
  context.setTransform(pixelRatio * s, 0, 0, pixelRatio * s, pixelRatio * ox, pixelRatio * oy);
  context.lineJoin = "round";
  context.strokeStyle = colors.waterline;
  for (const [lineWidth, opacity] of WATERLINES) {
    context.globalAlpha = opacity;
    context.lineWidth = lineWidth / s;
    context.stroke(landPath);
  }
  context.globalAlpha = 0.16;
  context.fillStyle = colors["land-shadow"];
  context.translate(2.5 / s, 4 / s);
  context.fill(landPath, "evenodd");
  context.translate(-2.5 / s, -4 / s);
  context.globalAlpha = 1;
  context.fillStyle = colors.land;
  context.fill(landPath, "evenodd");
  context.strokeStyle = colors.coast;
  context.lineWidth = 0.9 / s;
  context.stroke(landPath);

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.globalCompositeOperation = darkLook() ? "screen" : "multiply";
  for (const glow of glows) {
    if (glow.alpha < 0.01 || glow.r < 1) continue;
    const gradient = context.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, glow.r);
    gradient.addColorStop(0, withAlpha(glow.color, 0.5 * glow.alpha));
    gradient.addColorStop(0.45, withAlpha(glow.color, 0.2 * glow.alpha));
    gradient.addColorStop(1, withAlpha(glow.color, 0));
    context.fillStyle = gradient;
    context.fillRect(glow.x - glow.r, glow.y - glow.r, glow.r * 2, glow.r * 2);
  }
  // The spotlight: the frame darkens slightly away from where the eye should be.
  if (lightKey) {
    const reach = Math.hypot(width, height) * 0.6;
    const vignette = context.createRadialGradient(light!.x, light!.y, 0, light!.x, light!.y, reach);
    const shade = darkLook() ? "#000000" : colors["land-shadow"];
    vignette.addColorStop(0, withAlpha(shade, 0));
    vignette.addColorStop(0.28, withAlpha(shade, 0));
    vignette.addColorStop(1, withAlpha(shade, (darkLook() ? 0.32 : 0.2) * light!.strength));
    context.globalCompositeOperation = "source-over";
    context.fillStyle = vignette;
    context.fillRect(0, 0, width, height);
  }
  context.globalCompositeOperation = darkLook() ? "soft-light" : "multiply";
  context.globalAlpha = 0.55;
  context.fillStyle = grainPattern;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = "source-over";
  context.globalAlpha = 1;
};

const textLayer = svgElement("g", {}, svg);
const traceLayer = svgElement("g", {}, svg);
const wallLayer = svgElement("g", {}, svg);
// Draw order, bottom to top: ground marks (routes, fields), city dots, the moving subjects
// (ships, arrowheads, bursts), then every piece of text, then the tour pins.
const markUnderLayer = svgElement("g", {}, svg);
const placeLayer = svgElement("g", {}, svg);
const markOverLayer = svgElement("g", {}, svg);
const effectLayer = svgElement("g", {}, svg);
const labelLayer = svgElement("g", {}, svg);
const beatLayer = svgElement("g", {}, svg);

// ---------- Projection helpers per frame ----------

let screen = (point: XY): XY => point;
let zoomNow = 1;

const pathData = (points: XY[]) =>
  points.length < 2 ? "" : `M${points.map((point) => screen(point).map(fixed).join(",")).join("L")}`;

// ---------- Region and sea names ----------

const mapTexts = [
  ...regions.map((text) => ({ text, kind: "region" as const })),
  ...seas.map((text) => ({ text, kind: "sea" as const })),
].map(({ text, kind }) => {
  const group = svgElement("g", {}, textLayer);
  const size = text.size ?? (kind === "sea" ? 15 : 14);
  const name = svgElement("text", { class: `${kind}-label`, "text-anchor": "middle", "font-size": size }, group);
  name.textContent = text.name;
  const latin = svgElement("text", {
    class: `${kind}-latin`,
    "text-anchor": "middle",
    "font-size": Math.round(size * 0.86),
    y: Math.round(size * 1.15),
  }, group);
  latin.textContent = text.latin;
  return { text, group, world: toWorld(text.at) };
});

const zoomBand = (text: MapText) => {
  const [low, high] = text.zoom;
  return smooth((zoomNow - low * 0.8) / (low * 0.35)) * (1 - smooth((zoomNow - high) / (high * 0.4)));
};

const renderMapTexts = (dimmed: number, receded: number) => {
  for (const { text, group, world: at } of mapTexts) {
    const alpha = zoomBand(text) * (1 - dimmed) * (1 - 0.6 * receded);
    const [x, y] = screen(at);
    set(group, "opacity", alpha.toFixed(3));
    set(group, "transform", `translate(${fixed(x)},${fixed(y)})${text.rotate ? ` rotate(${text.rotate})` : ""}`);
  }
};

// ---------- Route geometry ----------

type Geometry = { points: XY[]; lengths: number[]; total: number };

const spline = (via: Point[]): Geometry => {
  const control = via.map(toWorld);
  const points: XY[] = [];
  for (let index = 0; index < control.length - 1; index += 1) {
    const p0 = control[index - 1] ?? control[index];
    const p1 = control[index];
    const p2 = control[index + 1];
    const p3 = control[index + 2] ?? p2;
    for (let sample = 0; sample < 16; sample += 1) {
      const t = sample / 16;
      const t2 = t * t;
      const t3 = t2 * t;
      points.push([0, 1].map((axis) =>
        0.5 * (2 * p1[axis] + (-p0[axis] + p2[axis]) * t
          + (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * t2
          + (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * t3),
      ) as XY);
    }
  }
  points.push(control[control.length - 1]);
  const lengths = [0];
  for (let index = 1; index < points.length; index += 1) {
    const [ax, ay] = points[index - 1];
    const [bx, by] = points[index];
    lengths.push(lengths[index - 1] + Math.hypot(bx - ax, by - ay));
  }
  return { points, lengths, total: lengths[lengths.length - 1] };
};

const partial = (geometry: Geometry, u: number) => {
  const target = geometry.total * clamp01(u);
  const points: XY[] = [geometry.points[0]];
  for (let index = 1; index < geometry.points.length; index += 1) {
    if (geometry.lengths[index] >= target) {
      const span = geometry.lengths[index] - geometry.lengths[index - 1] || 1;
      const k = (target - geometry.lengths[index - 1]) / span;
      const [ax, ay] = geometry.points[index - 1];
      const [bx, by] = geometry.points[index];
      points.push([ax + (bx - ax) * k, ay + (by - ay) * k]);
      break;
    }
    points.push(geometry.points[index]);
  }
  return points;
};

// Position and heading in screen space at a fraction along the route.
const pose = (geometry: Geometry, u: number) => {
  const points = partial(geometry, Math.max(u, 0.0005));
  const [bx, by] = screen(points[points.length - 1]);
  const [ax, ay] = screen(points[Math.max(0, points.length - 2)]);
  return { x: bx, y: by, angle: (Math.atan2(by - ay, bx - ax) * 180) / Math.PI };
};

const screenLength = (geometry: Geometry) => geometry.total * (zoomNow * layout.fit);

// A trireme seen from above: ram forward, oar banks as fine ticks.
const SHIP = "M12.5 0 L8 -3.3 L-8 -3.5 L-11.5 -2 L-11.5 2 L-8 3.5 L8 3.3 Z";
const ARROW = "M9 0 L-5 -7.5 L-1.5 0 L-5 7.5 Z";
const CHEVRON = "M3 0 L-2.5 -4.5 L-1 0 L-2.5 4.5 Z";

const bandPolygon = (points: XY[], width: number) => {
  const projected = points.map(screen);
  if (projected.length < 2) return "";
  const left: XY[] = [];
  const right: XY[] = [];
  projected.forEach(([x, y], index) => {
    const [px, py] = projected[Math.max(0, index - 1)];
    const [nx, ny] = projected[Math.min(projected.length - 1, index + 1)];
    const length = Math.hypot(nx - px, ny - py) || 1;
    const t = index / (projected.length - 1);
    // Swell out of the harbour, taper into an arrowhead at the front.
    const w = (width / 2) * (0.55 + 0.45 * smooth(t * 6)) * (index === projected.length - 1 ? 0.15 : 1);
    left.push([x - ((ny - py) / length) * w, y + ((nx - px) / length) * w]);
    right.push([x + ((ny - py) / length) * w, y - ((nx - px) / length) * w]);
  });
  return `M${[...left, ...right.reverse()].map((point) => point.map(fixed).join(",")).join("L")}Z`;
};

// ---------- Marks ----------

type Renderer = (f: number, alpha: number, time: number) => void;

const shipNode = (parent: Element) => svgElement("path", { class: "ship-hull", d: SHIP }, parent);

type MarkLayers = { under: SVGGElement; over: SVGGElement; labels: SVGGElement };
type Box = { x: number; y: number; w: number; h: number };
// Text that place labels must not collide with this frame (route tags).
const labelObstacles: Box[] = [];

const markRenderer = (mark: Mark, { under, over, labels }: MarkLayers): Renderer => {
  const color = () => ("side" in mark ? colors[mark.side] : colors.ink);
  switch (mark.type) {
    case "route": {
      const geometry = spline(mark.via);
      // A pale casing lifts the line off coastlines and city dots.
      const casing = mark.style === "band" ? undefined : svgElement("path", { class: "route-casing" }, under);
      const body = mark.style === "band"
        ? svgElement("path", { class: "route-band" }, under)
        : svgElement("path", { class: "route-line" }, under);
      const chevrons = mark.style === "army"
        ? Array.from({ length: 40 }, () => svgElement("path", { d: CHEVRON }, under))
        : [];
      const head = mark.style === "army" ? svgElement("path", { class: "route-head", d: ARROW }, over) : undefined;
      const wallGlow = mark.style === "wall" ? svgElement("path", { class: "route-line" }, under) : undefined;
      const ticks = mark.style === "wall" ? svgElement("path", { class: "route-line" }, under) : undefined;
      if (wallGlow) under.insertBefore(wallGlow, casing ?? body);
      const tag = mark.tag ? svgElement("text", { class: "route-tag" }, labels) : undefined;
      if (tag) tag.textContent = mark.tag!;
      const ships = Array.from(
        { length: mark.ships ?? (mark.style === "fleet" ? 5 : 0) },
        () => shipNode(over),
      );
      return (f, alpha, time) => {
        const u = easeInOut(within(f, mark.draw));
        const visible = u > 0 ? alpha : 0;
        const drawn = partial(geometry, Math.max(u, 0.001));
        if (mark.style === "band") {
          set(body, "d", bandPolygon(drawn, mark.width ?? 10));
          set(body, "fill", color());
          set(body, "opacity", (visible * (mark.width && mark.width < 3 ? 0.9 : 0.42)).toFixed(3));
        } else {
          const lineWidth = mark.style === "army" ? 2.4 : mark.style === "wall" ? mark.width ?? 3.2 : 1.8;
          set(body, "d", pathData(drawn));
          set(body, "stroke", color());
          set(body, "stroke-width", lineWidth);
          set(body, "stroke-dasharray", mark.style === "fleet" ? "1 4" : "none");
          set(body, "opacity", (visible * (mark.style === "wall" ? 1 : 0.9)).toFixed(3));
          if (casing) {
            set(casing, "d", pathData(drawn));
            set(casing, "stroke-width", lineWidth + 4);
            set(casing, "opacity", (visible * 0.75).toFixed(3));
          }
        }
        if (wallGlow && ticks) {
          set(wallGlow, "d", pathData(drawn));
          set(wallGlow, "stroke", color());
          set(wallGlow, "stroke-width", (mark.width ?? 3.2) * 3.5);
          set(wallGlow, "opacity", (visible * 0.16).toFixed(3));
          // Crenellation ticks on one side, the usual map sign for a fortified line.
          const projected = drawn.map(screen);
          let d = "";
          let carried = 0;
          for (let index = 1; index < projected.length; index += 1) {
            const [ax, ay] = projected[index - 1];
            const [bx, by] = projected[index];
            const length = Math.hypot(bx - ax, by - ay);
            if (length === 0) continue;
            const nx = -(by - ay) / length;
            const ny = (bx - ax) / length;
            for (let at = 9 - carried; at < length; at += 9) {
              const x = ax + ((bx - ax) / length) * at;
              const y = ay + ((by - ay) / length) * at;
              d += `M${fixed(x)},${fixed(y)}L${fixed(x + nx * 5)},${fixed(y + ny * 5)}`;
            }
            carried = (carried + length) % 9;
          }
          set(ticks, "d", d);
          set(ticks, "stroke", color());
          set(ticks, "stroke-width", 1.4);
          set(ticks, "opacity", visible.toFixed(3));
        }
        if (tag) {
          const lead = pose(geometry, u);
          const radians = (lead.angle * Math.PI) / 180;
          const side = mark.tagBelow ? -1 : 1;
          set(tag, "x", fixed(lead.x + Math.sin(radians) * 17 * side));
          set(tag, "y", fixed(lead.y - Math.cos(radians) * 17 * side + 4));
          set(tag, "text-anchor", "middle");
          set(tag, "fill", color());
          const tagAlpha = visible * smooth(u * 8);
          set(tag, "opacity", tagAlpha.toFixed(3));
          if (tagAlpha > 0.05) {
            const width = mark.tag!.length * 12.5;
            const tx = lead.x + Math.sin(radians) * 17 * side;
            const ty = lead.y - Math.cos(radians) * 17 * side + 4;
            labelObstacles.push({ x: tx - width / 2, y: ty - 12, w: width, h: 15 });
          }
        }
        const length = screenLength(geometry);
        // Marching chevrons: spaced along the drawn line, sliding forward as it grows.
        chevrons.forEach((chevron, index) => {
          const spacing = 30 / length;
          const along = u - (index + 0.5) * spacing;
          const shown = along > 0.02 && index * 30 < length;
          const { x, y, angle } = pose(geometry, along);
          set(chevron, "transform", `translate(${fixed(x)},${fixed(y)}) rotate(${fixed(angle)})`);
          set(chevron, "fill", color());
          set(chevron, "opacity", shown ? (visible * 0.75).toFixed(3) : "0");
        });
        if (head) {
          const { x, y, angle } = pose(geometry, u);
          set(head, "transform", `translate(${fixed(x)},${fixed(y)}) rotate(${fixed(angle)})`);
          set(head, "fill", color());
          set(head, "opacity", visible.toFixed(3));
        }
        // A convoy sails in loose formation behind the leading ship.
        ships.forEach((ship, index) => {
          const along = u - index * (17 / length);
          const lateral = ((index % 2) * 2 - 1) * (index === 0 ? 0 : 4.5);
          const { x, y, angle } = pose(geometry, along);
          const radians = (angle * Math.PI) / 180;
          const bob = Math.sin(time * 1.6 + index * 1.3) * 0.6;
          const sx = x - Math.sin(radians) * (lateral + bob);
          const sy = y + Math.cos(radians) * (lateral + bob);
          set(ship, "transform", `translate(${fixed(sx)},${fixed(sy)}) rotate(${fixed(angle)}) scale(0.92)`);
          set(ship, "fill", color());
          set(ship, "opacity", along > 0.003 ? visible.toFixed(3) : "0");
        });
      };
    }
    case "pulse": {
      const rings = [0, 1].map(() => svgElement("circle", { fill: "none" }, over));
      const rays = Array.from({ length: 10 }, () => svgElement("line", { "stroke-linecap": "round" }, over));
      const center = toWorld(mark.place);
      return (f, alpha) => {
        const u = within(f, mark.at);
        const envelope = band(u, [0, 0.12, 0.7, 1]) * alpha;
        const burst = easeOut(within(u, [0, 0.35]));
        const [x, y] = screen(center);
        rings.forEach((ring, index) => {
          const phase = index === 0 ? burst : (u * 1.6) % 1;
          set(ring, "cx", fixed(x));
          set(ring, "cy", fixed(y));
          set(ring, "r", fixed(8 + phase * (index === 0 ? 34 : 26)));
          set(ring, "stroke", color());
          set(ring, "stroke-width", index === 0 ? 2 : 1.2);
          set(ring, "opacity", (envelope * (1 - phase) * (index === 0 ? 1 : 0.7)).toFixed(3));
        });
        rays.forEach((ray, index) => {
          const angle = (index / rays.length) * Math.PI * 2 + 0.3;
          const inner = 10 + burst * 14;
          const outer = inner + 7 * (1 - burst) + 3;
          set(ray, "x1", fixed(x + Math.cos(angle) * inner));
          set(ray, "y1", fixed(y + Math.sin(angle) * inner));
          set(ray, "x2", fixed(x + Math.cos(angle) * outer));
          set(ray, "y2", fixed(y + Math.sin(angle) * outer));
          set(ray, "stroke", color());
          set(ray, "stroke-width", 1.6);
          set(ray, "opacity", (envelope * (1 - burst)).toFixed(3));
        });
      };
    }
    case "blockade": {
      const count = 14;
      const ships = Array.from({ length: count }, () => shipNode(over));
      const [cx, cy] = toWorld(mark.place);
      return (f, alpha, time) => {
        const u = within(f, mark.at);
        const drift = f * 0.5 + time * 0.02;
        ships.forEach((ship, index) => {
          const angle = (index / count) * Math.PI * 2 + drift;
          const appear = backOut(clamp01((u - (index / count) * 0.7) * 5));
          const reach = mark.radius * (1.25 - 0.25 * clamp01(appear));
          const [x, y] = screen([cx + Math.cos(angle) * reach, cy + Math.sin(angle) * reach]);
          set(ship, "transform", `translate(${fixed(x)},${fixed(y)}) rotate(${fixed((angle * 180) / Math.PI + 90)}) scale(0.85)`);
          set(ship, "fill", color());
          set(ship, "opacity", (alpha * clamp01(appear)).toFixed(3));
        });
      };
    }
    case "fields": {
      // Deterministic scatter so every visit draws the same farms.
      let seed = Math.round(mark.center[0] * 1000 + mark.center[1] * 7);
      const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const center = toWorld(mark.center);
      const origin = mark.from ? toWorld(mark.from) : center;
      const plots = Array.from({ length: mark.count }, () => {
        const angle = random() * Math.PI * 2;
        const reach = Math.sqrt(random()) * mark.radius;
        const at: XY = [center[0] + Math.cos(angle) * reach, center[1] + Math.sin(angle) * reach * 0.8];
        return { at, size: 1.3 + random() * 1.5, turn: random() * 60 - 30, rect: svgElement("rect", {}, under), ember: svgElement("circle", {}, under) };
      });
      const far = Math.max(...plots.map(({ at }) => Math.hypot(at[0] - origin[0], at[1] - origin[1])));
      return (f, alpha) => {
        const appear = smooth(within(f, [0, 0.12]));
        const [start, end] = mark.burn ?? [0.3, 0.8];
        const unit = zoomNow * layout.fit;
        for (const plot of plots) {
          const order = Math.hypot(plot.at[0] - origin[0], plot.at[1] - origin[1]) / far;
          const k = within(f, [start + (end - start) * order * 0.85, start + (end - start) * (order * 0.85 + 0.15)]);
          const [x, y] = screen(plot.at);
          const side = plot.size * unit;
          set(plot.rect, "x", fixed(x - side / 2));
          set(plot.rect, "y", fixed(y - side / 2));
          set(plot.rect, "width", fixed(side));
          set(plot.rect, "height", fixed(side * 0.7));
          set(plot.rect, "transform", `rotate(${fixed(plot.turn)} ${fixed(x)} ${fixed(y)})`);
          set(plot.rect, "fill", interpolateRgb(colors.field, colors.char)(smooth(k)));
          set(plot.rect, "opacity", (alpha * appear * 0.85).toFixed(3));
          set(plot.ember, "cx", fixed(x));
          set(plot.ember, "cy", fixed(y));
          set(plot.ember, "r", fixed(side * (0.4 + k * 0.9)));
          set(plot.ember, "fill", colors.ember);
          set(plot.ember, "opacity", k > 0 && k < 1 ? (alpha * Math.sin(Math.PI * k) * 0.7).toFixed(3) : "0");
        }
      };
    }
    case "flow": {
      const geometry = spline(mark.via);
      const coins = Array.from({ length: 12 }, () => svgElement("circle", { r: 3.4 }, over));
      return (f, alpha, time) => {
        const u = within(f, mark.at);
        const envelope = smooth(u * 5) * alpha;
        coins.forEach((coin, index) => {
          const along = (index / coins.length + f * 1.4 + time * 0.03) % 1;
          const { x, y } = pose(geometry, along);
          set(coin, "cx", fixed(x));
          set(coin, "cy", fixed(y));
          set(coin, "fill", colors.gold);
          set(coin, "stroke", colors.land);
          set(coin, "opacity", (envelope * Math.sin(Math.PI * along)).toFixed(3));
        });
      };
    }
  }
};

const stepGroups = steps.map((step) => {
  const layers: MarkLayers = {
    under: svgElement("g", { display: "none" }, markUnderLayer),
    over: svgElement("g", { display: "none" }, markOverLayer),
    labels: svgElement("g", { display: "none" }, labelLayer),
  };
  const renderers = (step.marks ?? []).map((mark) => markRenderer(mark, layers));
  return { groups: Object.values(layers), renderers };
});

// Routes that leave a faint trace for the rest of the story.
const traces = steps.flatMap((step, index) =>
  (step.marks ?? []).flatMap((mark) => {
    if (mark.type !== "route" || !mark.trace) return [];
    const geometry = spline(mark.via);
    const element = svgElement("path", { class: "route-trace" }, traceLayer);
    return [{ index, mark, geometry, element }];
  }),
);

// ---------- Long Walls ----------

const walls = [
  [[23.722, 37.976], [23.643, 37.953]],
  [[23.716, 37.965], [23.652, 37.941]],
  [[23.712, 37.962], [23.69, 37.936]],
].map((line) => ({
  geometry: spline(line as XY[]),
  glow: svgElement("path", { class: "wall", "stroke-width": 9 }, wallLayer),
  element: svgElement("path", { class: "wall", "stroke-width": 2.6 }, wallLayer),
}));
const wallsUp = indexOf.get("pericles")!;
const wallsDown = indexOf.get("surrender")!;

const renderWalls = (P: number) => {
  const built = easeInOut(within(P, [wallsUp + 0.05, wallsUp + 0.4]));
  const fall = smooth(within(P, [wallsDown + 0.25, wallsDown + 0.8]));
  for (const { geometry, glow, element } of walls) {
    const d = pathData(partial(geometry, Math.max(built, 0.001)));
    const opacity = built > 0 ? 1 - fall * 0.9 : 0;
    const dashes = fall > 0 ? `${fixed(7 * (1 - fall) + 0.6)} ${fixed(10 * fall)}` : "none";
    for (const [path, strength] of [[glow, 0.18], [element, 1]] as const) {
      set(path, "d", d);
      set(path, "stroke", colors.athens);
      set(path, "opacity", (opacity * strength).toFixed(3));
      set(path, "stroke-dasharray", dashes);
    }
  }
};

// ---------- Places ----------

const labelledAt = steps.map((step) => new Set(step.labels ?? []));
const placeIds = [...new Set([
  ...(Object.keys(allegiance) as PlaceId[]),
  ...steps.flatMap((step) => step.labels ?? []),
])];

const capitals: Partial<Record<Side, PlaceId>> = { athens: "athens", sparta: "sparta" };
const sideOrder: Record<Side, number> = { athens: 0.05, sparta: 0.32, neutral: 0.55, persia: 0.55 };

type Change = { at: number; side: Side | "ruined" };

const distance = (a: PlaceId, b: PlaceId) => {
  const [ax, ay] = toWorld(a);
  const [bx, by] = toWorld(b);
  return Math.hypot(bx - ax, by - ay);
};

// When a city changes sides within a step, so its colour changes with the narration.
const changeTimes: Record<string, number> = {
  "plataea@plague": 0.8,
  "potidaea@plague": 0.5,
  "thera@plague": 0.9,
  "acanthus@brasidas": 0.32,
  "amphipolis@brasidas": 0.5,
  "melos@melos": 0.72,
  "rhegium@sicily": 0.5,
  "catana@sicily": 0.55,
  "lampsacus@aegospotami": 0.15,
  "cyzicus@cyzicus": 0.55,
  "byzantium@arginusae": 0.02,
};

const changesFor = (id: PlaceId): Change[] =>
  (allegiance[id] ?? []).map(([stepId, side], order) => {
    const index = indexOf.get(stepId)!;
    if (order > 0) {
      const timed = changeTimes[`${id}@${stepId}`];
      const ripple = steps[index].ripple;
      if (timed !== undefined) return { at: index + timed, side };
      if (ripple) return { at: index + ripple.start + Math.min(distance(id, ripple.from) / 1200, 1) * ripple.span, side };
      return { at: index + 0.3, side };
    }
    // First appearance ripples outward from each side's capital.
    const capital = capitals[side as Side];
    const reach = capital ? distance(id, capital) : 0;
    return { at: index + sideOrder[side as Side] + Math.min(reach / 1400, 1) * 0.22, side };
  });

const placeNodes = placeIds.map((id) => {
  const place = places[id];
  const major = id === "athens" || id === "sparta";
  const changes = changesFor(id);
  const group = svgElement("g", {}, placeLayer);
  const ripple = svgElement("circle", { fill: "none", "stroke-width": 1.5 }, group);
  const ring = major ? svgElement("circle", { fill: "none", "stroke-width": 1.3 }, group) : undefined;
  const dot = svgElement("circle", { "stroke-width": 1.6 }, group);
  const label = svgElement("text", { class: `place-label${major ? " is-major" : ""}` }, labelLayer);
  label.textContent = place.name;
  const direction = place.label ?? "e";
  const gap = major ? 14 : 9;
  const dx = direction.includes("e") ? gap : direction.includes("w") ? -gap : 0;
  const dy = direction.includes("n") ? -gap : direction.includes("s") ? gap + 9 : 4.5;
  label.setAttribute("text-anchor", dx > 0 ? "start" : dx < 0 ? "end" : "middle");
  const debris = changes.some((change) => change.side === "ruined")
    ? Array.from({ length: 12 }, () => svgElement("circle", { r: 1.6 }, effectLayer))
    : [];
  return {
    id, world: toWorld(id), major, changes, ripple, ring, dot, label, debris,
    offset: [dx, dy] as XY,
    // Read by hover hit-testing and the tooltip.
    screen: [0, 0] as XY,
    visible: 0,
    side: undefined as Side | "ruined" | undefined,
  };
});

const colorOf = (side: Side | "ruined") => (side === "ruined" ? colors.land : colors[side]);

let hovered: PlaceId | undefined;

// Each step's subject: places it labels, moves through, tours, or changes. Everything else
// recedes so the subject reads first. Steps about the whole balance of power keep all.
const focusAt = steps.map((step, index): Set<PlaceId> | "all" => {
  if (step.focus === "all" || step.quote || step.act || index === 0) return "all";
  const ids = new Set<PlaceId>(step.labels ?? []);
  for (const mark of step.marks ?? []) {
    if ("place" in mark) ids.add(mark.place);
    if ("via" in mark) for (const point of mark.via) if (typeof point === "string") ids.add(point);
  }
  for (const beat of step.beats ?? []) if (typeof beat.at === "string") ids.add(beat.at);
  for (const [id, entries] of Object.entries(allegiance) as [PlaceId, [string, unknown][]][]) {
    if (entries.some(([stepId], order) => order > 0 && stepId === step.id)) ids.add(id);
  }
  return ids;
});
// Outside the subject, cities all but disappear; Athens and Sparta stay faintly as bearings.
const RECEDE = 0.05;
const RECEDE_MAJOR = 0.3;
const focusWeight = (index: number | undefined, id: PlaceId) => {
  if (index === undefined) return 1;
  const focus = focusAt[index];
  if (focus === "all" || focus.has(id)) return 1;
  return id === "athens" || id === "sparta" ? RECEDE_MAJOR : RECEDE;
};

// ---------- Attention director ----------

// Where each city a route passes sits along it, so the city lights up when the route's head
// reaches it instead of being on screen before anything happens there. Stops are the route's
// named places plus any city of the step's subject lying on the line.
type RouteMark = Extract<Mark, { type: "route" }>;
const routeGeometries = steps.map((step) =>
  (step.marks ?? []).flatMap((mark) => (mark.type === "route" ? [{ mark, geometry: spline(mark.via) }] : [])));
const NEAR_ROUTE = Math.hypot(...[0, 1].map((axis) => toWorld([24.12, 38])[axis] - toWorld([24, 38])[axis]));
const routeStops = routeGeometries.map((routes, index) => routes.flatMap(({ mark, geometry }) => {
  const focus = focusAt[index];
  const named = mark.via.filter((point): point is PlaceId => typeof point === "string");
  const ids = new Set([...named, ...(focus === "all" ? [] : focus)]);
  return [...ids].flatMap((id) => {
    const [px, py] = toWorld(id);
    let nearest = 0;
    let distance = Infinity;
    geometry.points.forEach(([x, y], order) => {
      const d = Math.hypot(x - px, y - py);
      if (d < distance) [nearest, distance] = [order, d];
    });
    return named.includes(id) || distance < NEAR_ROUTE
      ? [{ id, at: geometry.lengths[nearest] / geometry.total, mark }]
      : [];
  });
}));
const routeProgress = (mark: RouteMark, f: number) => easeInOut(within(f, mark.draw));

// How a route's arrival reads at a city: `lit` rises to 1 as the head comes in and stays;
// `passing` runs 0 → 1 just after the head goes by, for the swell and the ripple.
const arrivalAt = (index: number, id: PlaceId, f: number) => {
  let lit: number | undefined;
  let passing = 0;
  for (const stop of routeStops[index]) {
    if (stop.id !== id) continue;
    const u = routeProgress(stop.mark, f);
    lit = Math.max(lit ?? 0, u <= 0 ? 0 : smooth((u - stop.at) / 0.05 + 1));
    const phase = within(u - stop.at, [0, 0.1]);
    if (u > 0 && phase > passing && (passing === 0 || phase < 1)) passing = phase;
  }
  return lit === undefined ? undefined : { lit, passing };
};

// The point the eye should be on: the head of a route being drawn, or the beat on tour.
const spotlightAt = (frame: Frame) => {
  for (const { mark, geometry } of routeGeometries[frame.step]) {
    const u = routeProgress(mark, frame.f);
    if (u > 0 && u < 1) {
      const points = partial(geometry, u);
      const [x, y] = screen(points[points.length - 1]);
      return { x, y, strength: Math.sin(Math.PI * u) ** 0.5 };
    }
  }
  if (frame.beat !== undefined && frame.touring > 0) {
    const node = beatNodes[frame.step]?.[frame.beat];
    if (node) {
      const [x, y] = screen(node.world);
      return { x, y, strength: frame.beatAppear * frame.touring };
    }
  }
  return undefined;
};

type LabelCandidate = { node: (typeof placeNodes)[number]; alpha: number; priority: number; box: Box };

const renderPlaces = (frame: Frame, dimmed: number) => {
  const { P, step, previous: lastStep, enter, leave } = frame;
  glows.length = 0;
  const candidates: LabelCandidate[] = [];
  // The score of the war as the map shows it: cities currently on each side.
  const count = { athens: 0, sparta: 0 };
  for (const node of placeNodes) {
    let presence = 0;
    let fill = colors.neutral;
    let stroke = colors.land;
    let ruined = 0;
    let previous: Change | undefined;
    let latest: Change | undefined;
    for (const change of node.changes) {
      const k = smooth(within(P, [change.at, change.at + 0.1]));
      if (P < change.at) break;
      latest = change;
      if (!previous) {
        presence = within(P, [change.at, change.at + 0.1]);
        fill = colorOf(change.side);
      } else {
        fill = interpolateRgb(colorOf(previous.side), colorOf(change.side))(k);
      }
      if (change.side === "ruined") {
        ruined = k;
        stroke = interpolateRgb(colors.land, colors.ruined)(k);
      } else if (previous?.side === "ruined") {
        // Resettled: the survivors return and the city takes a side again.
        ruined = 1 - k;
        stroke = interpolateRgb(colors.ruined, colors.land)(k);
      }
      previous = change;
    }

    const here = labelledAt[step].has(node.id);
    const before = lastStep !== undefined && labelledAt[lastStep].has(node.id);
    const isHovered = hovered === node.id;
    const arrival = arrivalAt(step, node.id, frame.f);
    const swell = arrival && arrival.passing > 0 && arrival.passing < 1 ? Math.sin(Math.PI * arrival.passing) : 0;
    const labelAlpha = Math.max(
      arrival ? (before ? 1 + (arrival.lit - 1) * smooth(enter) : arrival.lit) : here ? (before ? 1 : smooth(enter * 1.6)) : 0,
      !here && before ? 1 - smooth(leave) : 0,
      isHovered ? 1 : 0,
    ) * (1 - dimmed);
    node.side = latest?.side;
    if (presence >= 0.5 && (latest?.side === "athens" || latest?.side === "sparta")) count[latest.side] += 1;

    const [x, y] = screen(node.world);
    const alpha = Math.max(presence > 0 ? 1 : 0, labelAlpha);
    const pop = presence > 0 ? backOut(presence) : labelAlpha;
    const radius = (node.major ? 6 : 4.2) * pop * (isHovered ? 1.45 : 1) * (1 + 0.75 * swell);
    const settled = lastStep === undefined
      ? focusWeight(step, node.id)
      : focusWeight(lastStep, node.id) + (focusWeight(step, node.id) - focusWeight(lastStep, node.id)) * smooth(enter);
    // Route stops wait in the background until the head reaches them.
    const waiting = arrival ? Math.min(settled, RECEDE + (1 - RECEDE) * arrival.lit) : settled;
    const focus = isHovered ? 1 : settled + (waiting - settled) * smooth(enter);
    node.screen = [x, y];
    node.visible = alpha * focus * (1 - dimmed);
    set(node.dot, "cx", fixed(x));
    set(node.dot, "cy", fixed(y));
    set(node.dot, "r", Math.max(radius, 0).toFixed(2));
    set(node.dot, "fill", fill);
    set(node.dot, "stroke", stroke);
    set(node.dot, "opacity", (alpha * focus * (1 - dimmed * 0.6)).toFixed(3));
    if (node.ring) {
      set(node.ring, "cx", fixed(x));
      set(node.ring, "cy", fixed(y));
      set(node.ring, "r", (11 * pop).toFixed(2));
      set(node.ring, "stroke", fill);
      set(node.ring, "opacity", (alpha * 0.7 * focus * (1 - dimmed)).toFixed(3));
    }

    // A ring spreads whenever a city appears or changes hands, or a route reaches it.
    const echo = arrival && arrival.passing > 0 && arrival.passing < 1 ? arrival.passing
      : latest ? within(P, [latest.at, latest.at + 0.16]) : 1;
    set(node.ripple, "cx", fixed(x));
    set(node.ripple, "cy", fixed(y));
    set(node.ripple, "r", fixed(5 + easeOut(echo) * 24));
    set(node.ripple, "stroke", fill === colors.land ? colors.ink : fill);
    set(node.ripple, "opacity", echo > 0 && echo < 1 ? ((1 - echo) * 0.7).toFixed(3) : "0");

    // Influence: a soft field of the city's colour, gone once it is destroyed.
    const glowRadius = clamp(40 * zoomNow * layout.fit, 26, 120);
    // Influence reads at regional scale; in close-ups it would fog the detail.
    const glowZoom = 1 - 0.75 * smooth((zoomNow - 3) / 6);
    glows.push({
      x,
      y,
      r: glowRadius * (0.4 + 0.6 * smooth(presence)),
      color: fill,
      alpha: glowZoom * smooth(presence) * (1 - ruined)
        * (node.changes[0]?.side === "neutral" && fill === colors.neutral ? 0.35 : 1) * (1 - dimmed * 0.5)
        * focus * focus,
    });

    node.debris.forEach((piece, pieceIndex) => {
      const angle = (pieceIndex / node.debris.length) * Math.PI * 2 + pieceIndex;
      const burst = easeOut(ruined);
      const reach = 4 + burst * (14 + (pieceIndex % 3) * 6);
      set(piece, "cx", fixed(x + Math.cos(angle) * reach));
      set(piece, "cy", fixed(y + Math.sin(angle) * reach + burst * burst * 10));
      set(piece, "fill", colors.ruined);
      set(piece, "opacity", ruined > 0 && ruined < 1 ? ((1 - ruined) * 0.8).toFixed(3) : "0");
    });

    const lx = x + node.offset[0];
    const ly = y + node.offset[1];
    set(node.label, "x", fixed(lx));
    set(node.label, "y", fixed(ly));
    if (labelAlpha > 0.02) {
      const size = node.major ? 15 : 13;
      const width = places[node.id].name.length * size * (node.major ? 1.1 : 1) + 4;
      const left = node.offset[0] > 0 ? lx : node.offset[0] < 0 ? lx - width : lx - width / 2;
      candidates.push({
        node,
        alpha: labelAlpha,
        priority: (isHovered ? 8 : 0) + (arrival && arrival.lit > 0.5 ? 6 : 0) + (here ? 4 : 0) + (node.major ? 2 : 0) + focus,
        box: { x: left - 2, y: ly - size, w: width + 4, h: size + 5 },
      });
    } else {
      set(node.label, "opacity", "0");
    }
  }

  if (tallyAthens.textContent !== String(count.athens)) tallyAthens.textContent = String(count.athens);
  if (tallySparta.textContent !== String(count.sparta)) tallySparta.textContent = String(count.sparta);
  tally.style.opacity = (count.athens + count.sparta > 0 ? 1 - dimmed : 0).toFixed(3);

  // Labels never overlap: the most important claims its space first, lesser ones give way.
  const placed: Box[] = [...labelObstacles];
  const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  candidates.sort((a, b) => b.priority - a.priority);
  for (const candidate of candidates) {
    const clear = !placed.some((box) => overlaps(box, candidate.box));
    if (clear) placed.push(candidate.box);
    set(candidate.node.label, "opacity", (clear ? candidate.alpha : 0).toFixed(3));
  }
};

// ---------- Year and ruler ----------

const rulerX = (year: number) => clamp01((RULER.from - year) / (RULER.from - RULER.to)) * 100;
ruler.innerHTML = `<div class="ruler-line"></div>${phases.map((phase) =>
  `<div class="ruler-phase" style="left:${rulerX(phase.from)}%;width:${rulerX(phase.to) - rulerX(phase.from)}%">${phase.name}</div>`,
).join("")}${Array.from({ length: RULER.from - RULER.to + 1 }, (_, offset) => {
  const year = RULER.from - offset;
  const labelled = RULER.labelled.includes(year);
  return `<div class="ruler-year${labelled ? " is-labelled" : ""}" style="left:${rulerX(year)}%">${labelled ? `<span>${year}</span>` : ""}</div>`;
}).join("")}<div class="ruler-progress"></div><div class="ruler-marker"></div>`;
const rulerProgress = ruler.querySelector<HTMLElement>(".ruler-progress")!;
const rulerMarker = ruler.querySelector<HTMLElement>(".ruler-marker")!;

const yearText = (index: number) => {
  const label = steps[index].yearLabel;
  return label ? label.replace(/公元前|年/g, "").replace(/\s*–\s*/, "–").trim() : String(steps[index].year);
};

const renderYear = ({ step, previous, enter }: Frame) => {
  const t = previous === undefined ? 1 : easeInOut(enter);
  const from = steps[previous ?? step].year;
  const to = steps[step].year;
  const year = from + (to - from) * t;
  const label = t >= 0.98 || from === to ? yearText(step) : String(Math.round(year));
  if (yearNumber.textContent !== label) yearNumber.textContent = label;
  rulerProgress.style.width = `${rulerX(year)}%`;
  rulerMarker.style.left = `${rulerX(year)}%`;
};

// ---------- Insets ----------

const media = (file: string) => `${import.meta.env.BASE_URL}media/${file}`;
const insetsOf = (index: number) => {
  const inset = steps[index].inset;
  return inset ? (Array.isArray(inset) ? inset : [inset]) : [];
};

let insetKey = "";
let insetUpdate: ((u: number, time: number) => void) | undefined;

const buildInset = (inset: Inset) => {
  switch (inset.type) {
    case "count": {
      insetElement.innerHTML = `<div class="inset-value"><span class="inset-number">0</span>${
        inset.of ? `<span class="inset-of"> / ${inset.of}</span>` : ""
      }</div><div class="inset-unit">${inset.unit}</div>${inset.note ? `<div class="inset-note">${inset.note}</div>` : ""}`;
      const number = insetElement.querySelector<HTMLElement>(".inset-number")!;
      return (u: number) => {
        number.textContent = Math.round(inset.value * easeOut(u)).toLocaleString("zh-CN");
      };
    }
    case "dots": {
      let html = "";
      for (const [groupIndex, group] of inset.groups.entries()) {
        html += `<div class="inset-group-label">${group.label}</div><div class="inset-dots">`;
        html += Array.from({ length: group.count }, () =>
          `<span class="inset-dot${groupIndex > 0 ? " is-cavalry" : ""}"></span>`).join("");
        html += "</div>";
      }
      insetElement.innerHTML = `${html}<div class="inset-legend">每个点代表 ${inset.per} 人</div>`;
      const dots = [...insetElement.querySelectorAll<HTMLElement>(".inset-dot")];
      return (u: number) => {
        dots.forEach((dot, index) => {
          const k = clamp01((u - (index / dots.length) * 0.8) * 8);
          dot.style.opacity = String(smooth(k));
          dot.style.transform = `scale(${k > 0 ? backOut(k).toFixed(3) : 0})`;
        });
      };
    }
    case "trireme":
      return buildTrireme();
    case "siege":
      return buildSiege();
    case "talent":
      return buildTalent();
    case "ratio": {
      const [first, second] = inset.groups;
      const per = Math.round(second.count / first.count);
      const order: typeof inset.groups = Array.from({ length: first.count }, () =>
        [first, ...Array(per).fill(second)]).flat();
      insetElement.innerHTML = `<div class="inset-kicker">${inset.title}</div>
        <div class="ratio-grid" style="grid-template-columns: repeat(${per + 1}, 1fr)">${order.map((group) =>
          `<span class="ratio-dot" style="--dot: var(--${group.side})"></span>`).join("")}</div>
        <div class="ratio-legend">${inset.groups.map((group) =>
          `<span style="--dot: var(--${group.side})">${group.label}</span>`).join("")}</div>
        <div class="inset-note">${inset.note}</div>`;
      const dots = [...insetElement.querySelectorAll<HTMLElement>(".ratio-dot")];
      return (u: number) => {
        dots.forEach((dot, index) => {
          const k = clamp01((u - (index / dots.length) * 0.75) * 7);
          dot.style.opacity = String(smooth(k));
          dot.style.transform = `scale(${k > 0 ? backOut(k).toFixed(3) : 0})`;
        });
      };
    }
    case "image": {
      const credit = credits.find((entry) => entry.file === inset.file)?.attribution_text ?? "";
      insetElement.innerHTML = `<figure class="inset-figure"><img src="${media(inset.file)}" alt="${inset.caption}" /><figcaption>${inset.caption}<span>${credit}</span></figcaption></figure>`;
      const image = insetElement.querySelector<HTMLElement>("img")!;
      return (u: number) => {
        image.style.transform = `scale(${(1.06 - 0.06 * easeOut(u)).toFixed(4)})`;
      };
    }
    case "note": {
      insetElement.innerHTML = `<div class="inset-kicker">${inset.kicker}</div><div class="note-lines">${inset.lines.map((line) =>
        `<p class="note-line">${line}</p>`).join("")}</div><div class="inset-note">${inset.cite}</div>`;
      const lines = [...insetElement.querySelectorAll<HTMLElement>(".note-line")];
      return (u: number) => {
        lines.forEach((line, index) => {
          const k = smooth((u - index * (0.8 / lines.length)) * 5);
          line.style.opacity = String(k);
          line.style.transform = `translateX(${((1 - k) * -6).toFixed(1)}px)`;
        });
      };
    }
    case "growth": {
      insetElement.innerHTML = `<div class="inset-kicker">${inset.note}</div><div class="inset-bars">
        <div class="inset-bar-row"><span>${inset.from}</span><div class="inset-bar" style="width:${(inset.from / inset.to) * 100}%"></div></div>
        <div class="inset-bar-row"><span class="inset-number">${inset.from}</span><div class="inset-bar is-growing"></div></div>
      </div><div class="inset-note">${inset.unit}</div>`;
      const bar = insetElement.querySelector<HTMLElement>(".is-growing")!;
      const number = insetElement.querySelector<HTMLElement>(".inset-number")!;
      return (u: number) => {
        const value = inset.from + (inset.to - inset.from) * easeOut(u);
        bar.style.width = `${(value / inset.to) * 100}%`;
        number.textContent = String(Math.round(value));
      };
    }
  }
};

// A trireme in profile: three banks of oars, each side 31 / 27 / 27 (62 / 54 / 54 rowers).
const buildTrireme = () => {
  const banks = [
    { name: "上层桨手", count: 62, oars: 31, y: 30, reach: 50 },
    { name: "中层桨手", count: 54, oars: 27, y: 38, reach: 42 },
    { name: "下层桨手", count: 54, oars: 27, y: 46, reach: 34 },
  ];
  const oars = banks.map((bank, bankIndex) =>
    Array.from({ length: bank.oars }, (_, index) => {
      const x = 50 + (index / (bank.oars - 1)) * (160 - bankIndex * 6) + bankIndex * 3;
      return `<line class="oar" data-bank="${bankIndex}" x1="${x.toFixed(1)}" y1="${bank.y}" x2="${(x - 22).toFixed(1)}" y2="${bank.y + bank.reach}" />`;
    }).join(""),
  ).join("");
  insetElement.innerHTML = `<div class="inset-kicker">三列桨战舰 · 约 37 米</div>
    <svg class="trireme" viewBox="0 0 260 96" aria-hidden="true">
      <rect class="water-body" x="0" y="74" width="260" height="22" />
      <line class="water" x1="0" y1="74" x2="260" y2="74" />
      <g class="oars">${oars}</g>
      <path class="hull" d="M10 26 Q 16 50 44 52 L 214 52 Q 232 50 240 44 L 254 46 L 252 40 L 240 38 Q 236 30 238 20 Q 226 28 214 28 L 44 28 Q 22 28 10 26 Z" />
      <path class="deck" d="M30 24 L 222 24" />
      <path class="eye" d="M226 36 a 3 2 0 1 0 0.1 0" />
    </svg>
    <div class="trireme-banks">${banks.map((bank) =>
      `<div class="trireme-bank"><span>${bank.name}</span><b>${bank.count}</b></div>`).join("")}</div>
    <div class="inset-note">170 名桨手，加上军官、水手和甲板兵，一艘船约 200 人。船首的青铜撞角是它的武器；船体轻、空间小，每天都得靠岸做饭过夜。</div>`;
  const lines = [...insetElement.querySelectorAll<SVGLineElement>(".oar")];
  const rows = [...insetElement.querySelectorAll<HTMLElement>(".trireme-bank")];
  return (u: number, time: number) => {
    lines.forEach((line, index) => {
      const bank = Number(line.dataset.bank);
      const shown = smooth((u - bank * 0.18) * 5);
      const sweep = Math.sin(time * 2.4 - bank * 0.25) * 7;
      line.style.opacity = String(shown);
      line.style.transform = `rotate(${sweep.toFixed(2)}deg)`;
      line.style.transformOrigin = `${line.getAttribute("x1")}px ${line.getAttribute("y1")}px`;
      void index;
    });
    rows.forEach((row, index) => {
      row.style.opacity = String(smooth((u - index * 0.18) * 5));
    });
  };
};

// Syracuse, schematically: the Athenian ring wall races the Syracusan cross-wall.
const buildSiege = () => {
  insetElement.classList.add("is-wide");
  insetElement.innerHTML = `<div class="inset-kicker">叙拉古围城 · 示意图，非比例</div>
    <svg class="siege" viewBox="0 0 320 230" aria-hidden="true">
      <path class="siege-sea" d="M320 0 L320 230 L0 230 L0 200 Q 70 200 110 186 Q 150 170 168 186 Q 180 196 196 190 Q 214 182 222 160 Q 236 130 252 112 Q 268 92 274 60 Q 280 30 300 0 Z" />
      <path class="siege-harbour-label" d="" />
      <path class="siege-plateau" d="M40 40 Q 90 20 170 34 Q 236 46 256 92 Q 230 110 196 112 Q 140 116 92 104 Q 50 92 40 40 Z" />
      <path class="siege-city" d="M214 120 Q 236 108 252 116 Q 246 150 226 162 Q 206 160 200 146 Q 202 128 214 120 Z" />
      <path class="siege-ortygia" d="M222 176 Q 232 170 238 176 Q 236 186 226 188 Q 218 184 222 176 Z" />
      <circle class="siege-fort" cx="150" cy="88" r="7" />
      <path class="siege-athens siege-south" d="M150 95 Q 152 130 156 172" />
      <path class="siege-athens siege-north" d="M150 81 Q 158 52 176 24" />
      <path class="siege-syracuse" d="M206 124 Q 170 72 108 58" />
      <path class="siege-gylippus" d="M20 30 Q 60 44 96 58" />
      <path class="siege-gylippus-head" d="M0 0 L-9 -5 L-6 0 L-9 5 Z" />
      <text class="siege-label" x="88" y="34">埃皮波莱高地</text>
      <text class="siege-label" x="208" y="142">叙拉古</text>
      <text class="siege-label" x="118" y="214">大港</text>
      <text class="siege-label is-athens" x="140" y="110" text-anchor="end">圆堡</text>
      <text class="siege-label is-athens siege-note-athens" x="146" y="160" text-anchor="end">雅典环城墙</text>
      <text class="siege-label is-sparta siege-note-syracuse" x="186" y="76">叙拉古横墙</text>
      <text class="siege-label is-sparta siege-note-gylippus" x="10" y="24">吉利普斯</text>
    </svg>
    <div class="inset-note siege-outcome">横墙越过雅典墙线，围城再也无法合拢。</div>`;
  const parts = Object.fromEntries(["south", "north", "syracuse", "gylippus"].map((name) => {
    const path = insetElement.querySelector<SVGPathElement>(name === "syracuse" || name === "gylippus" ? `.siege-${name}` : `.siege-${name}`)!;
    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
    return [name, { path, length }];
  })) as Record<string, { path: SVGPathElement; length: number }>;
  const head = insetElement.querySelector<SVGPathElement>(".siege-gylippus-head")!;
  const notes = ["athens", "syracuse", "gylippus"].map((name) => insetElement.querySelector<SVGTextElement>(`.siege-note-${name}`)!);
  const outcome = insetElement.querySelector<HTMLElement>(".siege-outcome")!;
  const draw = (name: string, k: number) => {
    const { path, length } = parts[name];
    path.style.strokeDashoffset = `${length * (1 - k)}`;
  };
  return (u: number) => {
    draw("south", easeInOut(within(u, [0.02, 0.3])));
    // The northern arm stalls short of the sea: the ring is never closed.
    draw("north", 0.62 * easeInOut(within(u, [0.18, 0.42])));
    draw("syracuse", easeInOut(within(u, [0.36, 0.52])) * 0.45 + easeInOut(within(u, [0.66, 0.86])) * 0.55);
    const march = easeInOut(within(u, [0.5, 0.68]));
    draw("gylippus", march);
    const tip = parts.gylippus.path.getPointAtLength(parts.gylippus.length * Math.max(march, 0.001));
    head.setAttribute("transform", `translate(${tip.x.toFixed(1)},${tip.y.toFixed(1)}) rotate(20)`);
    head.style.opacity = String(march > 0 ? 1 : 0);
    notes[0].style.opacity = String(smooth(within(u, [0.1, 0.2])));
    notes[1].style.opacity = String(smooth(within(u, [0.4, 0.5])));
    notes[2].style.opacity = String(smooth(within(u, [0.52, 0.6])));
    outcome.style.opacity = String(smooth(within(u, [0.86, 0.95])));
  };
};

// One talent pays one trireme crew for about a month.
const buildTalent = () => {
  insetElement.innerHTML = `<div class="inset-kicker">钱就是舰队</div>
    <div class="talent-row" data-row="0"><img class="coin" src="${media("athens-tetradrachm-reverse-600.webp")}" alt="雅典猫头鹰银币" /><div><b>1 塔兰特</b>＝ 6,000 德拉克马</div></div>
    <div class="talent-row" data-row="1"><span class="talent-op">÷</span><div><b>200 人</b>× 每人每天 1 德拉克马</div></div>
    <div class="talent-row" data-row="2"><span class="talent-op">＝</span><div><b>30 天</b>一艘战舰出海一个月</div></div>
    <div class="talent-total" data-row="3"><b class="talent-number">0</b><span>雅典每年约 600 塔兰特贡金，<br />够 50 艘战舰全年出海</span></div>`;
  const rows = [...insetElement.querySelectorAll<HTMLElement>("[data-row]")];
  const number = insetElement.querySelector<HTMLElement>(".talent-number")!;
  return (u: number) => {
    rows.forEach((row, index) => {
      const k = smooth((u - index * 0.2) * 4);
      row.style.opacity = String(k);
      row.style.transform = `translateY(${((1 - k) * 8).toFixed(1)}px)`;
    });
    number.textContent = String(Math.round(50 * easeOut(within(u, [0.6, 1]))));
  };
};

const renderInset = ({ step: index, f, enter, time, touring }: Frame) => {
  const list = insetsOf(index);
  const startOf = (k: number) => list[k]?.at?.[0] ?? 0.1;
  let active = 0;
  for (let k = 1; k < list.length; k += 1) if (f >= startOf(k) - 0.01) active = k;
  const inset = list[active];
  const key = `${index}:${active}`;
  if (insetKey !== key) {
    insetKey = key;
    insetElement.classList.remove("is-wide");
    insetUpdate = inset ? buildInset(inset) : undefined;
  }
  if (!inset || !insetUpdate) {
    insetElement.style.opacity = "0";
    return;
  }
  const [start, end] = inset.at ?? [0.1, 0.6];
  const next = active + 1 < list.length ? startOf(active + 1) : 2;
  const appear = smooth(within(f, [start, start + 0.07]));
  const leave = smooth(within(f, [next - 0.08, next - 0.015]));
  insetElement.style.opacity = String(appear * (1 - leave) * smooth(enter * 2) * (1 - touring));
  insetElement.style.transform = `translateY(${fixed((1 - appear) * 14)}px)`;
  insetUpdate(within(f, [start, end]), time);
};

// ---------- Frame ----------

type Frame = {
  step: number;
  // Fraction of the step's map animation, driven by time.
  f: number;
  // step + f: what allegiances, walls and traces are keyed to.
  P: number;
  previous: number | undefined;
  // 0 → 1 over the camera move into this step.
  enter: number;
  // 0 → 1 as the previous step's marks, labels and dimming fade out.
  leave: number;
  camera: { x: number; y: number; scale: number };
  time: number;
  // The beat whose callout is showing, and how far it has faded in.
  beat: number | undefined;
  beatAppear: number;
  // 1 while the camera is away on a beat; insets step aside for the callouts.
  touring: number;
};

let lastFilter = "";

const dimFor = (index: number | undefined) =>
  index === undefined ? 0
    : index === 0 ? 0.82
    : steps[index].quote ? 0.92
    : steps[index].act ? 0.86
    : steps[index].mood === "night" ? 0.52
    : 0;

const render = (frame: Frame) => {
  const { camera, step, previous, f, P, enter, leave, time } = frame;
  const s = camera.scale;
  zoomNow = s / layout.fit;
  const ox = layout.center.x - camera.x * s;
  const oy = layout.center.y - camera.y * s;
  screen = ([x, y]) => [x * s + ox, y * s + oy];

  // Title and quotes dim the map; the dimming crossfades with the camera move.
  const fade = smooth(leave);
  const dimmed = previous === undefined
    ? dimFor(step)
    : dimFor(previous) + (dimFor(step) - dimFor(previous)) * smooth(enter);
  dim.style.opacity = clamp01(dimmed).toFixed(3);
  series.style.opacity = (step === 0 ? 1 : previous === 0 ? 1 - fade : 0).toFixed(3);
  const blur = step === 0 ? 5 : previous === 0 ? 5 * (1 - fade) : 0;
  const filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "";
  if (filter !== lastFilter) {
    svg.style.filter = baseCanvas.style.filter = filter;
    lastFilter = filter;
  }

  labelObstacles.length = 0;
  stepGroups.forEach(({ groups, renderers }, index) => {
    const current = index === step;
    const outgoing = index === previous && index !== step && fade < 1;
    for (const group of groups) set(group, "display", current || outgoing ? "inline" : "none");
    if (current) renderers.forEach((draw) => draw(f, 1, time));
    else if (outgoing) renderers.forEach((draw) => draw(1, 1 - fade, time));
  });

  // Traces are context for wide views; close-ups would show them as stray lines.
  const wide = 1 - smooth((zoomNow - 2.5) / 2);
  for (const trace of traces) {
    const visible = step > trace.index && wide > 0;
    set(trace.element, "d", visible ? pathData(trace.geometry.points) : "");
    set(trace.element, "stroke", colors[trace.mark.side]);
    set(trace.element, "opacity", (0.6 * wide * (1 - clamp01(dimmed))).toFixed(3));
  }

  // Region and sea names are bearings; when a step has a subject they step back with the cities.
  const subject = (index: number | undefined) => (index === undefined || focusAt[index] === "all" ? 0 : 1);
  renderMapTexts(clamp01(dimmed), previous === undefined ? subject(step) : subject(previous) + (subject(step) - subject(previous)) * smooth(enter));
  renderWalls(P);
  renderPlaces(frame, clamp01(dimmed));
  drawBase(s, ox, oy, spotlightAt(frame));
  renderYear(frame);
  renderInset(frame);
  renderBeats(frame, clamp01(dimmed));
};

// ---------- Beats: pins and callouts ----------

const beatNodes = steps.map((step) => (step.beats ?? []).map((beat, index) => {
  const group = svgElement("g", { class: "beat-pin", display: "none" }, beatLayer);
  svgElement("circle", { r: 10 }, group);
  const number = svgElement("text", { "text-anchor": "middle", y: 4.2 }, group);
  number.textContent = String(index + 1);
  return { beat, group, world: toWorld(beat.at), screen: [0, 0] as XY, visible: 0 };
}));
const leader = svgElement("path", { class: "callout-leader" }, beatLayer);
let calloutKey = "";

const renderBeats = ({ step, f, beat, beatAppear }: Frame, dimmed: number) => {
  const pins = smooth((f - 0.8) / 0.15) * (1 - dimmed);
  beatNodes.forEach((nodes, index) => {
    for (const [order, node] of nodes.entries()) {
      const current = index === step && pins > 0;
      set(node.group, "display", current ? "inline" : "none");
      node.visible = current ? pins : 0;
      if (!current) continue;
      const [x, y] = screen(node.world);
      node.screen = [x, y];
      set(node.group, "transform", `translate(${fixed(x)},${fixed(y)}) scale(${(0.6 + 0.4 * backOut(pins)).toFixed(3)})`);
      set(node.group, "opacity", pins.toFixed(3));
      set(node.group, "class", `beat-pin${order === beat ? " is-active" : ""}`);
    }
  });

  const node = beat === undefined ? undefined : beatNodes[step][beat];
  if (!node || beatAppear <= 0.01) {
    callout.style.opacity = "0";
    set(leader, "opacity", "0");
    return;
  }
  const key = `${step}:${beat}`;
  if (key !== calloutKey) {
    calloutKey = key;
    callout.innerHTML = `<div class="callout-index">${beat! + 1}</div><h3>${node.beat.title}</h3><p>${node.beat.text}</p>`;
  }
  // Beside the pin, away from the story card, kept on screen.
  const [x, y] = node.screen;
  const width = callout.offsetWidth;
  const height = callout.offsetHeight;
  let left = x + 34;
  if (left + width > window.innerWidth - 16) left = x - 34 - width;
  if (!layout.mobile && left < layout.stage.x) left = Math.min(x + 34, window.innerWidth - width - 16);
  let top = y - height - 26;
  if (top < 72) top = y + 26;
  top = clamp(top, 72, window.innerHeight - height - 90);
  left = clamp(left, 12, window.innerWidth - width - 12);
  callout.style.left = `${left.toFixed(1)}px`;
  callout.style.top = `${top.toFixed(1)}px`;
  callout.style.opacity = beatAppear.toFixed(3);
  callout.style.transform = `translateY(${((1 - beatAppear) * 8).toFixed(1)}px)`;
  const ex = clamp(x, left, left + width);
  const ey = clamp(y, top, top + height);
  set(leader, "d", `M${fixed(x)},${fixed(y)}L${fixed(ex)},${fixed(ey)}`);
  set(leader, "opacity", (beatAppear * 0.8).toFixed(3));
};

// ---------- Story text ----------

// Full-screen interludes (quotations and act titles) share the dimmed, centred layout.
const isInterlude = (index: number) => Boolean(steps[index].quote || steps[index].act);

const roman = (value: number) => {
  const table: [number, string][] = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let rest = value;
  let text = "";
  for (const [amount, symbol] of table) {
    while (rest >= amount) {
      text += symbol;
      rest -= amount;
    }
  }
  return text;
};

// Chapter numbers skip the title and the quotations.
let chapterCount = 0;
const chapterOf = steps.map((step, index) =>
  (index === 0 || step.quote || step.act || step.mood === "night" ? undefined : ++chapterCount));
const plainText = (html: string) => html.replace(/<cite>.*?<\/cite>/g, "").replace(/<[^>]+>/g, "");

// How long autoplay holds a step at 1×: enough to read it, never shorter than its animation.

const stepLabel = (index: number) =>
  index === 0 ? "序"
    : steps[index].quote ? "引文"
    : steps[index].act ? steps[index].act!.label
    : steps[index].mood === "night" ? "楔子"
    : roman(chapterOf[index]!);

const stepTitle = (index: number) =>
  steps[index].quote ? `“${plainText(steps[index].quote!.text).slice(0, 18)}…”`
    : steps[index].act ? steps[index].act!.title
    : steps[index].title;

const legendHTML = `<div class="legend">
  <span style="--swatch: var(--athens)">雅典与盟邦</span>
  <span style="--swatch: var(--sparta)">斯巴达与盟邦</span>
  <span style="--swatch: var(--neutral)">中立</span>
  <span style="--swatch: var(--persia)">波斯</span>
  <span class="is-ruined">被毁</span>
</div>`;

const cardElement = (index: number) => {
  const step = steps[index];
  const element = document.createElement("article");
  if (step.act) {
    element.className = "act";
    element.innerHTML = `<div class="act-label">${step.act.label}</div>
      <h2 class="act-title">${step.act.title}</h2>
      <p class="act-line">${step.act.line}</p>`;
    return element;
  }
  if (step.quote) {
    element.className = "quote";
    element.innerHTML = `<span class="quote-mark" aria-hidden="true">“</span>
      <p class="quote-text">${step.quote.text}</p>
      <div class="quote-cite">${step.quote.cite}</div>
      ${step.quote.note ? `<p class="quote-note">${step.quote.note}</p>` : ""}`;
    return element;
  }
  element.className = `card${index === 0 || step.mood === "night" ? " is-opening" : ""}`;
  element.innerHTML = `${index === 0 || step.mood === "night" ? "" : `<span class="card-index">${stepLabel(index)}</span>`}
    <p class="card-kicker">${step.kicker}</p>
    <h2>${step.title}</h2>
    ${step.body.map((paragraph) => `<p>${paragraph}</p>`).join("")}
    ${step.legend ? legendHTML : ""}
    ${index === 0 ? `<div class="opening-actions">
        <button class="begin" type="button"><span class="play-icon" aria-hidden="true"></span>开始播放</button>
        <button class="browse" type="button">自己浏览 →</button>
      </div>
      <p class="hint">滚轮或方向键切换章节 · 拖动地图探索 · 悬停城市查看详情</p>` : ""}`;
  return element;
};

const showCard = (index: number, direction: number) => {
  for (const old of document.querySelectorAll<HTMLElement>(".panel > *, .quote-layer > *")) {
    if (old.classList.contains("is-leaving")) continue;
    old.classList.remove("is-active");
    old.classList.add("is-leaving");
    old.style.setProperty("--shift", `${-direction * 18}px`);
    window.setTimeout(() => old.remove(), 500);
  }
  const element = cardElement(index);
  element.style.setProperty("--shift", `${direction * 22}px`);
  (isInterlude(index) ? quoteLayer : panel).append(element);
  panel.classList.toggle("is-opening", index === 0 || steps[index].mood === "night");
  panel.classList.toggle("is-quote", isInterlude(index));
  requestAnimationFrame(() => requestAnimationFrame(() => element.classList.add("is-active")));
  element.querySelector(".begin")?.addEventListener("click", () => {
    setPlaying(true);
    goTo(1);
  });
  element.querySelector(".browse")?.addEventListener("click", () => goTo(1));
};

// ---------- Attention budget ----------

// Every pause is arithmetic: what the viewer has to take in, measured in one unit — characters
// of reading — and turned into seconds by one rate. Other kinds of information convert into
// that unit at an exchange rate: how much reading each is worth. READING_RATE sets the pace of
// the whole film; WORTH says how dense each kind of information is. Nothing else is timed by hand.
const READING_RATE = 10; // characters a second: brisk silent reading of Chinese
const WORTH = {
  // Noticing one new thing on the map: a city lighting up, a pin, a pulse.
  glance: 3,
  // Reading a figure and holding on to it.
  number: 4,
  // Taking in a photograph, before its caption.
  image: 12,
  // Following a drawn line: screen pixels the eye covers in the time of one character.
  routePixels: 40,
  // Finding text that appears a full screen away from where the eye was.
  refocus: 6,
  // A quotation set as a full-screen moment is savoured, not skimmed.
  savor: 1.6,
};
const seconds = (characters: number) => characters / READING_RATE / state.speed;
const textCost = (html: string) => plainText(html).replace(/\s/g, "").length;

const sentencesOf = (paragraphs: string[]) =>
  paragraphs.flatMap((paragraph) => paragraph.split(/(?<=[。？！])/))
    .map((sentence) => sentence.trim())
    .filter((sentence) => plainText(sentence).trim().length > 0);

// Places, regions and seas a sentence can be about, by name.
const anchorNames = [
  ...placeIds.map((id) => ({ name: places[id].name, id: id as PlaceId | undefined, world: toWorld(id) })),
  ...mapTexts.map(({ text, world }) => ({ name: text.name.replace(/\s+/g, ""), id: undefined, world })),
];
// Athens and Sparta are named in most sentences; they count only when nothing else is named.
const namedIn = (html: string) => {
  const text = plainText(html);
  const named = anchorNames.filter((anchor) => text.includes(anchor.name));
  const specific = named.filter((anchor) => anchor.id !== "athens" && anchor.id !== "sparta");
  return specific.length ? specific : named;
};

// An inset is worth what it shows: measured from its own rendering — words, figures, images.
const insetCosts = new Map<Inset, number>();
const insetCost = (inset: Inset) => {
  const known = insetCosts.get(inset);
  if (known !== undefined) return known;
  const [html, className] = [insetElement.innerHTML, insetElement.className];
  buildInset(inset);
  insetElement.querySelectorAll("figcaption span").forEach((credit) => credit.remove());
  const text = insetElement.textContent ?? "";
  const figures = text.match(/\d[\d,.]*/g)?.length ?? 0;
  const images = insetElement.querySelectorAll("img").length;
  [insetElement.innerHTML, insetElement.className] = [html, className];
  insetKey = "";
  const cost = textCost(text.replace(/\d[\d,.]*/g, "")) + figures * WORTH.number + images * WORTH.image;
  insetCosts.set(inset, cost);
  return cost;
};

const narrated = (index: number, id: PlaceId) => plainText(steps[index].body.join("")).includes(places[id].name);
const screenPixels = (index: number, via: Point[]) => spline(via).total * layout.fit * steps[index].camera.zoom;
const markCost = (index: number, mark: Mark) => {
  switch (mark.type) {
    case "route": {
      // The line, the cities it lights up on the way, and its tag.
      const stops = routeStops[index].filter((stop) => stop.mark === mark);
      return screenPixels(index, mark.via) / WORTH.routePixels + (mark.tag ? textCost(mark.tag) : 0)
        + stops.reduce((total, stop) => total + WORTH.glance + (narrated(index, stop.id) ? 0 : places[stop.id].name.length), 0);
    }
    case "flow": return WORTH.glance + screenPixels(index, mark.via) / WORTH.routePixels;
    default: return WORTH.glance;
  }
};
const markWindow = (mark: Mark): Span =>
  ("draw" in mark && mark.draw) || ("at" in mark && mark.at) || ("burn" in mark && mark.burn) || [0, 1];
const markNames = (index: number, mark: Mark) =>
  mark.type === "route"
    ? routeStops[index].filter((stop) => stop.mark === mark && stop.id !== "athens" && stop.id !== "sparta").map((stop) => places[stop.id].name)
    : "place" in mark ? [places[mark.place].name] : [];

// Something the map shows during a step: when it plays (as a fraction of the step's map
// animation), what it costs, and which sentence brings it in.
type Visual = { kind: "mark" | "inset" | "change" | "label"; window: Span | undefined; cost: number; names: string[] };
const visualsOf = (index: number): Visual[] => {
  const step = steps[index];
  const visuals: Visual[] = (step.marks ?? []).map((mark) => ({ kind: "mark" as const, window: markWindow(mark), cost: markCost(index, mark), names: markNames(index, mark) }));
  for (const inset of insetsOf(index)) visuals.push({ kind: "inset", window: inset.at ?? [0.1, 0.6], cost: insetCost(inset), names: [] });
  // Cities changing hands together read as one pattern, not one by one: a glance that grows
  // with the logarithm of how many there are (Hick's law).
  const changes = placeNodes.flatMap((node) => node.changes
    .filter((change) => Math.floor(change.at) === index && change.at > index)
    .map((change) => ({ at: change.at - index, name: places[node.id].name })));
  if (changes.length) {
    visuals.push({
      kind: "change",
      window: [Math.min(...changes.map((change) => change.at)), Math.max(...changes.map((change) => change.at))],
      cost: WORTH.glance * Math.log2(1 + changes.length),
      names: changes.map((change) => change.name),
    });
  }
  // A label is read once; a name the narration already gave is only recognised.
  const stops = new Set(routeStops[index].map((stop) => stop.id));
  for (const node of placeNodes) {
    if (labelledAt[index].has(node.id) && !stops.has(node.id)) {
      const name = places[node.id].name;
      visuals.push({ kind: "label", window: undefined, cost: WORTH.glance + (narrated(index, node.id) ? 0 : name.length), names: [name] });
    }
  }
  return visuals;
};

// The step as a timeline of narration slots. Each sentence holds for its own reading, the
// look it takes to find it, and everything on the map it brings in: what it names, or else
// what plays at its point in the step. Slots follow each other without gaps.
type Slot = { html: string; start: number; end: number; visuals: Visual[] };
const SUBTITLE_LEAD = 0.35;
const slotCache = new Map<string, Slot[]>();
const subtitlePlan = (index: number): Slot[] => {
  if (index === 0 || isInterlude(index)) return [];
  const key = `${index}|${state.subtitleBase}|${state.speed}|${layout.width}x${layout.height}`;
  const cached = slotCache.get(key);
  if (cached) return cached;
  const step = steps[index];
  const sentences = sentencesOf(step.body);
  const visuals = sentences.map((): Visual[] => []);
  for (const visual of visualsOf(index)) {
    const named = sentences.findIndex((html) => visual.names.some((name) => plainText(html).includes(name)));
    const order = named >= 0 ? named : visual.window ? Math.min(sentences.length - 1, Math.floor(visual.window[0] * sentences.length)) : 0;
    visuals[order].push(visual);
  }
  // How far the eye has to travel to the next sentence, as a share of the screen.
  const scale = layout.fit * step.camera.zoom;
  const diagonal = Math.hypot(layout.width, layout.height);
  let last: XY | undefined;
  let at = state.subtitleBase;
  const slots = sentences.map((html, order) => {
    const anchors = namedIn(html).map((anchor) => anchor.world);
    const here = anchors.length
      ? [anchors.reduce((sum, [x]) => sum + x, 0) / anchors.length, anchors.reduce((sum, [, y]) => sum + y, 0) / anchors.length] as XY
      : last;
    const travel = !last ? 1 : here ? Math.min(1, (Math.hypot(here[0] - last[0], here[1] - last[1]) * scale) / diagonal) : 0;
    last = here ?? last;
    const cost = textCost(html) + WORTH.refocus * travel + visuals[order].reduce((total, visual) => total + visual.cost, 0);
    const slot = { html, start: at, end: at + seconds(cost), visuals: visuals[order] };
    at = slot.end;
    return slot;
  });
  if (slotCache.size > 200) slotCache.clear();
  slotCache.set(key, slots);
  return slots;
};

// Full-screen moments with no narration: the title, act cards and quotations.
const interludeCost = (index: number) => {
  const step = steps[index];
  if (step.quote) return textCost(step.quote.text + (step.quote.note ?? "")) * WORTH.savor;
  if (step.act) return textCost(step.act.title + step.act.line) * WORTH.savor;
  return textCost(step.title + step.body.join(""));
};

// The map animation runs on a fraction f of the step. In documentary mode each visual plays
// across the slot of the sentence that brings it in; in reading mode the animation lasts as
// long as its visuals are worth.
type Cue = { tau: number; f: number };
const cueCache = new Map<string, Cue[]>();
const cuesAt = (index: number): Cue[] => {
  const start = (state.stepMs * 0.55) / 1000;
  const key = `${index}|${state.subtitleBase}|${state.speed}|${start}|${state.documentary.on}|${layout.width}x${layout.height}`;
  const cached = cueCache.get(key);
  if (cached) return cached;
  const cues: Cue[] = [{ tau: start, f: 0 }];
  const slots = state.documentary.on ? subtitlePlan(index) : [];
  if (slots.length) {
    const keys: Cue[] = [];
    for (const slot of slots) {
      for (const visual of slot.visuals) {
        if (!visual.window) continue;
        const [from, to] = visual.window;
        keys.push({ tau: Math.max(slot.start, start), f: from }, { tau: slot.end, f: Math.max(to, from) });
      }
    }
    keys.sort((a, b) => a.f - b.f || a.tau - b.tau);
    for (const cue of keys) {
      const last = cues[cues.length - 1];
      if (cue.f > last.f && cue.tau > last.tau) cues.push(cue);
    }
    const last = cues[cues.length - 1];
    if (last.f < 1) cues.push({ tau: Math.max(last.tau, slots[slots.length - 1].end), f: 1 });
    if (cues[cues.length - 1].tau <= cues[cues.length - 2].tau) cues[cues.length - 1].tau = cues[cues.length - 2].tau + 1e-3;
  } else {
    const worth = visualsOf(index).reduce((total, visual) => total + visual.cost, 0);
    cues.push({ tau: start + seconds(Math.max(worth, WORTH.glance)), f: 1 });
  }
  if (cueCache.size > 200) cueCache.clear();
  cueCache.set(key, cues);
  return cues;
};

// Fraction of a step's map animation at a moment, and the moment it reaches a fraction.
const fractionAt = (index: number, tau: number) => {
  const cues = cuesAt(index);
  for (let order = 1; order < cues.length; order += 1) {
    const [a, b] = [cues[order - 1], cues[order]];
    if (tau < b.tau) return a.f + (b.f - a.f) * clamp01((tau - a.tau) / (b.tau - a.tau));
  }
  return 1;
};
const animationTime = (index: number, f: number) => {
  const cues = cuesAt(index);
  for (let order = 1; order < cues.length; order += 1) {
    const [a, b] = [cues[order - 1], cues[order]];
    if (f <= b.f) return a.tau + (b.tau - a.tau) * clamp01((f - a.f) / (b.f - a.f));
  }
  return cues[cues.length - 1].tau;
};

// ---------- Chapters strip ----------

chapters.innerHTML = steps.map((step, index) =>
  `<button class="chapter${step.quote || step.act ? " is-quote" : ""}" type="button" role="tab" data-step="${index}" aria-label="${stepLabel(index)} ${plainText(stepTitle(index))}"><span class="chapter-tip">${stepLabel(index)} · ${stepTitle(index)}</span></button>`,
).join("");
const chapterButtons = [...chapters.querySelectorAll<HTMLButtonElement>(".chapter")];
chapterButtons.forEach((button, index) => button.addEventListener("click", () => goTo(index)));

// ---------- Story state ----------

const state = {
  step: 0,
  previous: undefined as number | undefined,
  changedAt: 0,
  stepMs: 1,
  camera: { path: undefined as ((t: number) => ZoomView) | undefined, start: 0, ms: 1 },
  explore: undefined as { x: number; y: number; scale: number } | undefined,
  displayed: { x: 0, y: 0, scale: 1 },
  playing: false,
  speed: 1,
  // The guided tour runs while autoplay is on: base is when it starts (seconds into the
  // step) and from is where its first flight begins.
  tour: { on: false, base: 0, from: undefined as ZoomView | undefined },
  // Documentary mode (autoplay): the card gives way to subtitles and the map takes the
  // whole screen. `from` is the blend at the moment of the last switch.
  documentary: { on: false, changedAt: 0, from: 0 },
  // Seconds into the step when its subtitles begin (later if play was pressed mid-step).
  subtitleBase: 0,
  // A camera target that replaces the step's own view, e.g. a beat the reader clicked.
  target: undefined as ZoomView | undefined,
  focusBeat: undefined as number | undefined,
  hoverBeat: undefined as number | undefined,
};

const TOUR_BEATS = 1;
// Autoplay pushes the camera in slowly while it rests, as documentary maps do, and lets the
// push go during the next flight so the motion never stops or jumps.
const DRIFT = 0.045;

// Quintic smootherstep: zero velocity and zero acceleration at both ends, so flights
// leave and settle without the small jolt of a cubic ease.
const glide = (t: number) => {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

const beatView = (index: number, beat: Beat): ZoomView => {
  const [x, y] = toWorld(beat.at);
  const zoom = beat.zoom ?? steps[index].camera.zoom * 2;
  return [x, y, layout.stage.w / (layout.fit * zoom)];
};

// Find the pin after the flight, then read the callout.
const beatHold = (beat: Beat) => seconds(WORTH.glance + WORTH.refocus + textCost(beat.title + beat.text));

// How long a camera flight takes is physics, not attention: van Wijk and Nuij's zoom path
// gives a perceptual duration for the distance and zoom change, slowed for autoplay.
const flightMs = (path: { duration: number }, cinematic: boolean) =>
  cinematic ? clamp(path.duration * 1.35, 1800, 6000) : clamp(path.duration * 0.8, 800, 2200);

type Segment = { path: ((t: number) => ZoomView) & { duration: number }; start: number; end: number; fly: number; beat?: number };
let planKey = "";
let plan: Segment[] = [];

// The tour as a timeline: fly to each beat, hold while it reads, then fly home.
const tourPlan = (index: number, base = state.tour.base, start = state.tour.from) => {
  const key = `${index}:${base}:${state.speed}:${start?.join(",")}:${layout.width}x${layout.height}`;
  if (key === planKey) return plan;
  planKey = key;
  plan = [];
  // A guided tour stops at the first beat only; the rest stay on the map as pins.
  const beats = (steps[index].beats ?? []).slice(0, TOUR_BEATS);
  if (beats.length === 0) return plan;
  let at = base;
  let from = start ?? viewOf(steps[index].camera);
  beats.forEach((beat, order) => {
    const to = beatView(index, beat);
    const path = interpolateZoom(from, to);
    const fly = flightMs(path, true) / 1000;
    const end = at + fly + beatHold(beat);
    plan.push({ path, start: at, end, fly, beat: order });
    at = end;
    from = to;
  });
  // No flight home: the next step's camera move starts from the beat.
  return plan;
};

const viewFromCamera = ({ x, y, scale }: { x: number; y: number; scale: number }): ZoomView =>
  [x, y, layout.stage.w / scale];

// Autoplay flies slower and further-looking; reading by hand keeps moves brisk.
const moveCamera = (to: ZoomView, now: number, cinematic = state.playing) => {
  const path = interpolateZoom(viewFromCamera(state.displayed), to);
  const ms = flightMs(path, cinematic);
  state.camera = { path, start: now, ms };
  return ms;
};

// Push-in factor at a moment in an autoplayed step: grows across each rest, released by
// the flight that follows it.
const driftAt = (index: number, tau: number) => {
  const segments = tourPlan(index);
  const rests: Array<{ from: number; to: number; amount: number; release?: number; fly?: number }> = [];
  let from = state.stepMs / 1000;
  for (const segment of segments) {
    rests.push({ from, to: segment.start, amount: segment === segments[0] ? DRIFT : DRIFT * 0.6, release: segment.start, fly: segment.fly });
    from = segment.start + segment.fly;
  }
  rests.push({ from, to: holdSeconds(index) + 6, amount: segments.length ? DRIFT * 0.6 : DRIFT });
  // The last rest, on the tour's final beat, holds until the next step flies on.
  if (segments.length) rests[rests.length - 1].amount = DRIFT;
  for (const rest of rests) {
    if (tau >= rest.from && tau < rest.to) return rest.amount * glide((tau - rest.from) / Math.max(rest.to - rest.from, 1));
    if (rest.release !== undefined && rest.fly && tau >= rest.release && tau < rest.release + rest.fly) {
      return rest.amount * (1 - glide((tau - rest.release) / rest.fly));
    }
  }
  return 0;
};

const frameAt = (now: number): Frame => {
  const tau = (now - state.changedAt) / 1000;
  const cameraT = clamp01((now - state.camera.start) / state.camera.ms);
  let view = state.camera.path && cameraT < 1
    ? state.camera.path(glide(cameraT))
    : state.target ?? viewOf(steps[state.step].camera);
  let beat = state.focusBeat ?? state.hoverBeat;
  let beatAppear = beat === undefined ? 0 : 1;
  let touring = state.focusBeat === undefined ? 0 : 1;
  if (state.tour.on && !state.explore) {
    const segments = tourPlan(state.step);
    if (segments.length) {
      const first = segments[0].start;
      const last = segments[segments.length - 1].end;
      touring = smooth((tau - first) / 0.5) * (1 - smooth((tau - last + 0.8) / 0.8));
    }
    for (const segment of segments) {
      if (tau < segment.start || tau >= segment.end) continue;
      view = segment.path(glide((tau - segment.start) / segment.fly));
      if (segment.beat !== undefined) {
        beat = segment.beat;
        beatAppear = smooth((tau - segment.start - segment.fly * 0.75) / 0.45)
          * (1 - smooth((tau - segment.end + 0.4) / 0.4));
      }
      break;
    }
    // The tour ends at its last beat; the camera stays there until the next step flies on.
    const lastSegment = segments[segments.length - 1];
    if (lastSegment && tau >= lastSegment.end) view = lastSegment.path(1);
  }
  // A slow push-in while the title holds, and the autoplay drift elsewhere.
  const push = state.step === 0
    ? 1 + 0.06 * smooth(tau / 12)
    : state.tour.on && !state.explore ? 1 + driftAt(state.step, tau) : 1;
  const storyCamera = { x: view[0], y: view[1], scale: (layout.stage.w / view[2]) * push };
  const f = fractionAt(state.step, tau);
  return {
    step: state.step,
    previous: state.previous,
    f,
    P: state.step + f,
    enter: clamp01((now - state.changedAt) / state.stepMs),
    leave: clamp01(tau / 0.5),
    camera: state.explore ?? storyCamera,
    time: now / 1000,
    beat,
    beatAppear,
    touring,
  };
};

const updateChrome = () => {
  const { step } = state;
  counter.textContent = `${stepLabel(step)} / ${roman(chapterCount)}`;
  chapterButtons.forEach((button, index) => {
    button.classList.toggle("is-current", index === step);
    button.classList.toggle("is-past", index < step);
    button.setAttribute("aria-selected", String(index === step));
  });
  document.querySelector<HTMLButtonElement>(".prev")!.disabled = step === 0;
  document.querySelector<HTMLButtonElement>(".next")!.disabled = step === steps.length - 1;
};

function goTo(target: number) {
  const index = clamp(target, 0, steps.length - 1);
  if (index === state.step) {
    if (state.explore) returnToStory();
    return;
  }
  const now = clock();
  const direction = Math.sign(index - state.step);
  state.stepMs = moveCamera(viewOf(steps[index].camera), now);
  state.previous = state.step;
  state.step = index;
  state.changedAt = now;
  state.explore = undefined;
  state.target = undefined;
  state.focusBeat = undefined;
  state.hoverBeat = undefined;
  state.subtitleBase = (state.stepMs / 1000) * SUBTITLE_LEAD;
  state.tour.base = tourStart(index);
  state.tour.from = undefined;
  recenter.hidden = true;
  closeTooltip(true);
  showCard(index, direction);
  updateChrome();
  history.replaceState(null, "", `#${steps[index].id}`);
}

function returnToStory() {
  moveCamera(viewOf(steps[state.step].camera), clock());
  state.explore = undefined;
  state.target = undefined;
  state.focusBeat = undefined;
  recenter.hidden = true;
}

// Fly to a beat and hold its callout open, as if the tour had stopped there.
function focusBeat(order: number) {
  if (state.playing) setPlaying(false);
  const view = beatView(state.step, steps[state.step].beats![order]);
  moveCamera(view, clock());
  state.explore = undefined;
  state.target = view;
  state.focusBeat = order;
  recenter.hidden = false;
}

// ---------- Autoplay ----------

const speeds = [0.75, 1, 1.5, 2];

function documentaryBlend(now: number) {
  const { on, changedAt, from } = state.documentary;
  const t = glide((now - changedAt) / 900);
  return from + ((on ? 1 : 0) - from) * t;
}

function setPlaying(value: boolean) {
  const tau = (clock() - state.changedAt) / 1000;
  if (!value && state.tour.on) {
    const now = clock();
    const active = frameAt(now);
    if (active.beat !== undefined && active.beatAppear > 0.5) {
      // Paused on a beat: keep the camera and its callout where they are.
      state.explore = { ...state.displayed };
      recenter.hidden = false;
      state.focusBeat = active.beat;
    } else {
      // Paused between beats: settle back onto the step's own view.
      state.tour.on = false;
      moveCamera(viewOf(steps[state.step].camera), now, false);
    }
  }
  if (value) {
    state.target = undefined;
    state.focusBeat = undefined;
    if (tau > state.subtitleBase) {
      // Pressed play while reading: narrate this step from now.
      state.subtitleBase = tau + 0.3;
    }
    if (tau > state.tour.base - 0.1 || state.explore) {
      // Resuming mid-step: start the tour from wherever the camera is now, once the
      // narration of this step is done.
      state.tour.base = Math.max(tau + 0.2, tourStart(state.step));
      state.tour.from = viewFromCamera(state.displayed);
      state.explore = undefined;
      recenter.hidden = true;
    }
  }
  state.tour.on = value;
  if (value !== state.documentary.on) {
    state.documentary = { on: value, changedAt: clock(), from: documentaryBlend(clock()) };
    document.body.classList.toggle("is-documentary", value);
  }
  state.playing = value && state.step < steps.length - 1;
  playButton.setAttribute("aria-pressed", String(state.playing));
  playButton.setAttribute("aria-label", state.playing ? "暂停" : "自动播放");
  document.body.classList.toggle("is-playing", state.playing);
}

// The tour waits for both the map animation and the narration.
function tourStart(index: number) {
  const slots = subtitlePlan(index);
  return Math.max(animationTime(index, 1), slots.length ? slots[slots.length - 1].end : 0);
}

// A step holds until everything it shows has been taken in.
const holdSeconds = (index: number, base = state.tour.base, from = state.tour.from) => {
  const animationStart = (state.stepMs * 0.55) / 1000;
  const tour = state.tour.on ? tourPlan(index, base, from) : [];
  const slots = subtitlePlan(index);
  return Math.max(
    animationTime(index, 1),
    isInterlude(index) || index === 0 ? animationStart + seconds(interludeCost(index)) : 0,
    slots.length ? slots[slots.length - 1].end : 0,
    tour.length ? tour[tour.length - 1].end : 0,
  );
};

const tickAutoplay = (now: number) => {
  const elapsed = (now - state.changedAt) / 1000;
  const total = holdSeconds(state.step);
  progressBar.style.transform = `scaleX(${state.playing ? clamp01(elapsed / total).toFixed(4) : 0})`;
  if (!state.playing || elapsed < total) return;
  if (state.step >= steps.length - 1) setPlaying(false);
  else goTo(state.step + 1);
};

playButton.addEventListener("click", () => setPlaying(!state.playing));
speedButton.addEventListener("click", () => {
  state.speed = speeds[(speeds.indexOf(state.speed) + 1) % speeds.length];
  speedButton.textContent = `${state.speed}×`;
});
document.querySelector(".prev")!.addEventListener("click", () => goTo(state.step - 1));
document.querySelector(".next")!.addEventListener("click", () => goTo(state.step + 1));

// ---------- Exploring the map ----------

const stageCenter = () => [layout.center.x, layout.center.y];

const explore = (camera: { x: number; y: number; scale: number }) => {
  state.explore = {
    ...camera,
    scale: clamp(camera.scale, layout.fit * 0.8, layout.fit * 60),
  };
  state.camera.path = undefined;
  recenter.hidden = false;
  if (state.playing) setPlaying(false);
};

// Zoom about a screen point, keeping the world point under it fixed.
const zoomAt = (x: number, y: number, factor: number) => {
  const camera = state.explore ?? state.displayed;
  const [cx, cy] = stageCenter();
  const scale = clamp(camera.scale * factor, layout.fit * 0.8, layout.fit * 60);
  const wx = camera.x + (x - cx) / camera.scale;
  const wy = camera.y + (y - cy) / camera.scale;
  explore({ x: wx - (x - cx) / scale, y: wy - (y - cy) / scale, scale });
};

const pointers = new Map<number, XY>();
let drag: { start: XY; camera: { x: number; y: number; scale: number }; moved: boolean } | undefined;
let pinch: { distance: number; mid: XY; camera: { x: number; y: number; scale: number } } | undefined;

svg.addEventListener("pointerdown", (event) => {
  svg.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, [event.clientX, event.clientY]);
  if (pointers.size === 1) {
    drag = { start: [event.clientX, event.clientY], camera: { ...state.displayed }, moved: false };
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = {
      distance: Math.hypot(b[0] - a[0], b[1] - a[1]),
      mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      camera: { ...state.displayed },
    };
    drag = undefined;
  }
});

svg.addEventListener("pointermove", (event) => {
  if (pointers.has(event.pointerId)) {
    pointers.set(event.pointerId, [event.clientX, event.clientY]);
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const ratio = Math.hypot(b[0] - a[0], b[1] - a[1]) / pinch.distance;
      const [cx, cy] = stageCenter();
      const { camera, mid } = pinch;
      const scale = camera.scale * ratio;
      const wx = camera.x + (mid[0] - cx) / camera.scale;
      const wy = camera.y + (mid[1] - cy) / camera.scale;
      explore({ x: wx - (mid[0] - cx) / scale, y: wy - (mid[1] - cy) / scale, scale });
    } else if (drag) {
      const dx = event.clientX - drag.start[0];
      const dy = event.clientY - drag.start[1];
      if (!drag.moved && Math.hypot(dx, dy) > 5) {
        drag.moved = true;
        svg.classList.add("is-dragging");
      }
      if (drag.moved) explore({ ...drag.camera, x: drag.camera.x - dx / drag.camera.scale, y: drag.camera.y - dy / drag.camera.scale });
    }
    return;
  }
  if (event.pointerType === "mouse" && !pinned) {
    const pin = beatHit(event.clientX, event.clientY);
    state.hoverBeat = pin;
    if (pin !== undefined) {
      closeTooltip();
      return;
    }
    const hit = hitTest(event.clientX, event.clientY, 14);
    if (hit) showTooltip(hit, false);
    else closeTooltip();
  }
});

const endPointer = (event: PointerEvent) => {
  const wasTap = drag && !drag.moved && pointers.size === 1;
  pointers.delete(event.pointerId);
  if (pointers.size < 2) pinch = undefined;
  if (pointers.size === 0) {
    svg.classList.remove("is-dragging");
    if (wasTap) {
      const pin = beatHit(event.clientX, event.clientY, event.pointerType === "mouse" ? 14 : 22);
      if (pin !== undefined) {
        closeTooltip(true);
        focusBeat(pin);
        drag = undefined;
        return;
      }
      if (state.focusBeat !== undefined && !state.playing) state.focusBeat = undefined;
      const hit = hitTest(event.clientX, event.clientY, event.pointerType === "mouse" ? 14 : 24);
      if (hit) showTooltip(hit, true);
      else closeTooltip(true);
    }
    drag = undefined;
  }
};
svg.addEventListener("pointerup", endPointer);
svg.addEventListener("pointercancel", endPointer);
svg.addEventListener("pointerleave", () => {
  state.hoverBeat = undefined;
  if (!pinned && pointers.size === 0) closeTooltip();
});
svg.addEventListener("dblclick", (event) => zoomAt(event.clientX, event.clientY, 1.8));

const [zoomIn, zoomOut] = [".zoom-in", ".zoom-out"].map((selector) => document.querySelector<HTMLButtonElement>(selector)!);
zoomIn.addEventListener("click", () => zoomAt(...(stageCenter() as XY), 1.5));
zoomOut.addEventListener("click", () => zoomAt(...(stageCenter() as XY), 1 / 1.5));
recenter.addEventListener("click", returnToStory);

// ---------- Place tooltips ----------

let pinned: PlaceId | undefined;

const beatHit = (x: number, y: number, radius = 14) => {
  const nodes = beatNodes[state.step] ?? [];
  let best: number | undefined;
  let bestDistance = radius;
  nodes.forEach((node, order) => {
    if (node.visible < 0.5) return;
    const distance = Math.hypot(node.screen[0] - x, node.screen[1] - y);
    if (distance < bestDistance) {
      best = order;
      bestDistance = distance;
    }
  });
  return best;
};

const hitTest = (x: number, y: number, radius: number) => {
  let best: PlaceId | undefined;
  let bestDistance = radius;
  for (const node of placeNodes) {
    if (node.visible < 0.35) continue;
    const distance = Math.hypot(node.screen[0] - x, node.screen[1] - y);
    if (distance < bestDistance) {
      best = node.id;
      bestDistance = distance;
    }
  }
  return best;
};

// Steps a place takes part in, for the tooltip's jump links.
const appearances = new Map<PlaceId, number[]>();
steps.forEach((step, index) => {
  if (index === 0 || step.quote || step.act) return;
  const ids = new Set<PlaceId>(step.labels ?? []);
  for (const mark of step.marks ?? []) {
    if ("place" in mark) ids.add(mark.place);
    if ("via" in mark) for (const point of mark.via) if (typeof point === "string") ids.add(point);
  }
  for (const id of ids) appearances.set(id, [...(appearances.get(id) ?? []), index]);
});

const sideLabel: Record<Side | "ruined", string> = {
  athens: "雅典一方",
  sparta: "斯巴达一方",
  neutral: "中立",
  persia: "波斯",
  ruined: "已被毁",
};

const showTooltip = (id: PlaceId, pin: boolean) => {
  const node = placeNodes.find((candidate) => candidate.id === id)!;
  const place = places[id];
  const note = placeNotes[id];
  const side = node.side;
  const links = (appearances.get(id) ?? []).filter((index) => index !== state.step).slice(0, 6);
  if (hovered !== id || pin !== Boolean(pinned)) {
    tooltip.innerHTML = `<div class="tip-name">${place.name}<span>${place.en}</span></div>
      ${side ? `<div class="tip-side" style="--side: var(--${side === "ruined" ? "ruined" : side})">${sideLabel[side]} · 公元前 ${steps[state.step].year} 年</div>` : ""}
      ${note ? `<p class="tip-note">${note.note}${note.cite ? `<cite>${note.cite}</cite>` : ""}</p>` : ""}
      ${links.length ? `<div class="tip-links"><span>相关章节</span>${links.map((index) =>
        `<button type="button" data-step="${index}">${stepLabel(index)} ${steps[index].title}</button>`).join("")}</div>` : ""}`;
    tooltip.querySelectorAll<HTMLButtonElement>("[data-step]").forEach((button) =>
      button.addEventListener("click", () => goTo(Number(button.dataset.step))));
  }
  hovered = id;
  pinned = pin ? id : undefined;
  tooltip.classList.toggle("is-pinned", pin);
  tooltip.hidden = false;
  if (pin && state.playing) setPlaying(false);
  // Sit beside the city, flipped to stay on screen.
  const [x, y] = node.screen;
  const width = tooltip.offsetWidth;
  const height = tooltip.offsetHeight;
  const left = x + 18 + width > window.innerWidth - 12 ? x - 18 - width : x + 18;
  const top = clamp(y - height / 2, 12, window.innerHeight - height - 12);
  tooltip.style.left = `${Math.max(12, left)}px`;
  tooltip.style.top = `${top}px`;
};

function closeTooltip(force = false) {
  if (pinned && !force) return;
  pinned = undefined;
  hovered = undefined;
  tooltip.hidden = true;
}

// ---------- Wheel, keys, swipes ----------

const canScroll = (element: Element, deltaY: number) =>
  element.scrollHeight > element.clientHeight + 1
  && (deltaY > 0
    ? element.scrollTop + element.clientHeight < element.scrollHeight - 1
    : element.scrollTop > 0);

let wheelIntent = 0;
let wheelDirection = 0;
let wheelCommitted = 0;
let wheelQuiet: number | undefined;
let lastWheelStep = 0;

window.addEventListener("wheel", (event) => {
  if (!sources.hidden) return;
  if (event.ctrlKey) {
    event.preventDefault();
    zoomAt(event.clientX, event.clientY, Math.exp(-event.deltaY * 0.01));
    return;
  }
  const scroller = (event.target as Element).closest?.(".card, .tooltip");
  if (scroller && canScroll(scroller, event.deltaY)) return;
  event.preventDefault();
  const delta = event.deltaY * (event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? window.innerHeight : 1);
  const direction = Math.sign(delta);
  if (direction === 0) return;
  // One gesture moves one step: build intent, then swallow the momentum tail.
  window.clearTimeout(wheelQuiet);
  wheelQuiet = window.setTimeout(() => {
    wheelCommitted = 0;
    wheelIntent = 0;
  }, 220);
  if (wheelCommitted === direction) return;
  if (direction !== wheelDirection) wheelIntent = 0;
  wheelDirection = direction;
  wheelIntent += Math.min(Math.abs(delta), 120);
  if (wheelIntent >= 80 && performance.now() - lastWheelStep > 450) {
    wheelCommitted = direction;
    wheelIntent = 0;
    lastWheelStep = performance.now();
    goTo(state.step + direction);
  }
}, { passive: false });

window.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (!sources.hidden) {
    if (event.key === "Escape") toggleSources(false);
    return;
  }
  const forward = ["ArrowRight", "ArrowDown", "PageDown"];
  const backward = ["ArrowLeft", "ArrowUp", "PageUp"];
  if (forward.includes(event.key)) goTo(state.step + 1);
  else if (backward.includes(event.key)) goTo(state.step - 1);
  else if (event.key === " " && !(event.target instanceof HTMLButtonElement)) setPlaying(!state.playing);
  else if (event.key === "Home") goTo(0);
  else if (event.key === "End") goTo(steps.length - 1);
  else if (event.key === "Escape") closeTooltip(true);
  else return;
  event.preventDefault();
});

// Horizontal swipes on the story panel turn the page; vertical ones scroll the card.
let swipe: XY | undefined;
for (const surface of [panel, quoteLayer]) {
  surface.addEventListener("touchstart", (event) => {
    swipe = [event.touches[0].clientX, event.touches[0].clientY];
  }, { passive: true });
  surface.addEventListener("touchend", (event) => {
    if (!swipe) return;
    const dx = event.changedTouches[0].clientX - swipe[0];
    const dy = event.changedTouches[0].clientY - swipe[1];
    swipe = undefined;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) goTo(state.step + (dx < 0 ? 1 : -1));
  }, { passive: true });
}

// ---------- Sources drawer ----------

const sources = document.querySelector<HTMLElement>(".sources")!;
function toggleSources(open: boolean) {
  sources.hidden = !open;
  if (open && state.playing) setPlaying(false);
}
document.querySelector(".sources-open")!.addEventListener("click", () => toggleSources(true));
document.querySelector(".sources-close")!.addEventListener("click", () => toggleSources(false));
sources.addEventListener("click", (event) => {
  if (event.target === sources) toggleSources(false);
});

// ---------- Start ----------

// ?step=12&t=3 (or the older ?p=12.4) freezes a frame for capture and review.
const query = new URLSearchParams(window.location.search);
const legacy = query.get("p");
const frozenStep = query.get("step") ?? (legacy === null ? null : String(Math.floor(Number(legacy))));
const frozenSeconds = query.get("t") !== null && legacy === null
  ? Number(query.get("t"))
  : legacy === null ? 30 : 1.2 + (Number(legacy) % 1) * 6;
let frozen: number | undefined = frozenStep === null ? undefined : clamp(Number(frozenStep), 0, steps.length - 1);
// &tour=1 renders the autoplay camera tour, as a video export would.
if (query.get("tour") === "1") {
  state.tour = { on: true, base: 0, from: undefined };
  state.documentary = { on: true, changedAt: -1e9, from: 1 };
}

const hashStep = steps.findIndex((step) => `#${step.id}` === window.location.hash);
const initial = frozen ?? (hashStep > 0 ? hashStep : 0);
state.step = initial;
state.changedAt = clock() - (frozen === undefined ? 0 : frozenSeconds * 1000);
if (state.tour.on) {
  state.tour.base = tourStart(initial);
  document.body.classList.add("is-documentary");
}

const chapterTag = document.querySelector<HTMLElement>(".chapter-tag")!;
let chapterTagKey = -1;

const renderDocumentary = (now: number) => {
  const blend = documentaryBlend(now);
  const card = { x: layout.stage.x + layout.stage.w / 2, y: layout.stage.y + layout.stage.h / 2 };
  const full = { x: layout.full.x + layout.full.w / 2, y: layout.full.y + layout.full.h / 2 };
  layout.center = { x: card.x + (full.x - card.x) * blend, y: card.y + (full.y - card.y) * blend };

  const tau = (now - state.changedAt) / 1000;

  const showTag = state.documentary.on && !isInterlude(state.step) && state.step > 0;
  if (showTag && chapterTagKey !== state.step) {
    chapterTagKey = state.step;
    const stepData = steps[state.step];
    chapterTag.innerHTML = `<span class="chapter-tag-index">${stepLabel(state.step)}</span><span class="chapter-tag-kicker">${stepData.kicker}</span><span class="chapter-tag-title">${stepData.title}</span>`;
  }
  const tagAlpha = showTag ? smooth((tau - 0.3) / 0.6) * (1 - smooth((tau - 5) / 0.8)) : 0;
  chapterTag.style.opacity = tagAlpha.toFixed(3);
};


// ---------- Narration on the map ----------

// In documentary mode each sentence is written onto the map beside what it talks about —
// the places it names, else where the eye already is — in the clearest nearby space, so
// reading and looking happen in the same place. Captions hold to the map as it drifts.
const narration = document.querySelector<HTMLElement>(".narration")!;
type Caption = { key: string; step: number; element: HTMLElement; world: XY; start: number; end: number; alpha: number };
let captions: Caption[] = [];


// The story camera at rest in this step: where captions are placed and drawn, so a caption
// waits at its spot while the camera is still landing.
const restProjection = (index: number, tau: number) => {
  if (state.explore) return screen;
  const view = state.target ?? viewOf(steps[index].camera);
  const scale = (layout.stage.w / view[2]) * (state.tour.on ? 1 + driftAt(index, tau) : 1);
  const ox = layout.center.x - view[0] * scale;
  const oy = layout.center.y - view[1] * scale;
  return ([x, y]: XY): XY => [x * scale + ox, y * scale + oy];
};

const overlapArea = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const boxGap = (a: Box, b: Box) =>
  Math.hypot(Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w)), Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h)));

// Everything a caption must not cover: the step's cities and their names (including those
// still to light up), its routes including the part not drawn yet, tour pins and the chrome.
const captionObstacles = (index: number, project: (point: XY) => XY, tau: number) => {
  const boxes: Box[] = [];
  const focus = focusAt[index];
  const stops = new Set(routeStops[index].map((stop) => stop.id));
  for (const node of placeNodes) {
    // The step's own subject, not what is still fading out from the step before.
    const relevant = focus === "all" ? node.visible > 0.15 && node.changes.length > 0 : focus.has(node.id) || stops.has(node.id);
    if (!relevant) continue;
    const [x, y] = project(node.world);
    boxes.push({ x: x - 10, y: y - 10, w: 20, h: 20 });
    const size = node.major ? 15 : 13;
    const width = places[node.id].name.length * size * 1.1 + 6;
    const lx = x + node.offset[0];
    const ly = y + node.offset[1];
    const left = node.offset[0] > 0 ? lx : node.offset[0] < 0 ? lx - width : lx - width / 2;
    boxes.push({ x: left - 4, y: ly - size - 2, w: width + 8, h: size + 9 });
  }
  for (const { geometry } of routeGeometries[index]) {
    for (let order = 0; order < geometry.points.length; order += 4) {
      const [x, y] = project(geometry.points[order]);
      boxes.push({ x: x - 14, y: y - 14, w: 28, h: 28 });
    }
  }
  for (const node of beatNodes[index]) {
    const [x, y] = project(node.world);
    boxes.push({ x: x - 16, y: y - 16, w: 32, h: 32 });
  }
  const chrome = [".map-tools", ".map-year", ".controls", ".masthead", ".chapters"];
  if (insetsOf(index).length) chrome.push(".map-inset");
  if (tau < 6) chrome.push(".chapter-tag");
  for (const selector of chrome) {
    const rect = document.querySelector(selector)?.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) boxes.push({ x: rect.left - 14, y: rect.top - 14, w: rect.width + 28, h: rect.height + 28 });
  }
  return boxes;
};

// The clearest spot near the subject, close to where the previous caption left the eye.
const placeCaption = (size: { w: number; h: number }, target: Box, obstacles: Box[], previous: Box | undefined) => {
  const frame = { x: 20, y: 64, w: layout.width - 40, h: layout.height - 64 - 96 };
  const candidates: XY[] = [];
  for (const gap of [24, 60, 120]) {
    const xs = [target.x - gap - size.w, target.x + target.w / 2 - size.w / 2, target.x + target.w + gap];
    const ys = [target.y - gap - size.h, target.y + target.h / 2 - size.h / 2, target.y + target.h + gap];
    for (const x of xs) for (const y of ys) candidates.push([x, y]);
  }
  for (let col = 0; col <= 8; col += 1) {
    for (let row = 0; row <= 6; row += 1) {
      candidates.push([frame.x + ((frame.w - size.w) * col) / 8, frame.y + ((frame.h - size.h) * row) / 6]);
    }
  }
  let best: Box | undefined;
  let bestScore = Infinity;
  for (const [x, y] of candidates) {
    const box = { x, y, w: size.w, h: size.h };
    const padded = { x: x - 10, y: y - 8, w: size.w + 20, h: size.h + 16 };
    const outside = x < frame.x || y < frame.y || x + size.w > frame.x + frame.w || y + size.h > frame.y + frame.h;
    let score = outside ? 1e9 : 0;
    for (const obstacle of obstacles) score += overlapArea(padded, obstacle) / 25;
    score += boxGap(box, target) * 1.2;
    if (previous) score += overlapArea(padded, previous) / 10 + boxGap(box, previous) * 0.15;
    if (score < bestScore) [best, bestScore] = [box, score];
  }
  return best!;
};

// One span per character, so the sentence can be written on.
const writeCaption = (element: HTMLElement, html: string) => {
  const template = document.createElement("template");
  template.innerHTML = html.replace(/<cite>.*?<\/cite>/g, "").trim();
  let order = 0;
  const walk = (node: Node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType !== Node.TEXT_NODE) {
        walk(child);
        continue;
      }
      const fragment = document.createDocumentFragment();
      for (const character of child.textContent ?? "") {
        const span = document.createElement("span");
        span.style.setProperty("--i", String(order++));
        span.textContent = character;
        fragment.append(span);
      }
      child.replaceWith(fragment);
    }
  };
  walk(template.content);
  element.replaceChildren(template.content);
};

const WRITE_RATE = 26; // characters per second as a sentence is written on

const renderNarration = (now: number) => {
  const tau = (now - state.changedAt) / 1000;
  const index = state.step;
  const project = restProjection(index, tau);
  const lines = state.documentary.on ? subtitlePlan(index) : [];
  for (const line of lines) {
    const key = `${index}:${line.start.toFixed(3)}`;
    if (tau < line.start - 0.2 || tau > line.end || captions.some((caption) => caption.key === key)) continue;
    const element = document.createElement("p");
    element.className = "caption";
    writeCaption(element, line.html);
    narration.append(element);
    const size = { w: element.offsetWidth, h: element.offsetHeight };

    const anchors = namedIn(line.html)
      .map((anchor) => project(anchor.world))
      .filter(([x, y]) => x > 20 && x < layout.width - 20 && y > 60 && y < layout.height - 90);
    const previous = captions.filter((caption) => caption.step === index).at(-1);
    const previousBox = previous ? { ...boxOf(previous, project), w: previous.element.offsetWidth, h: previous.element.offsetHeight } : undefined;
    if (!anchors.length) {
      if (previousBox) anchors.push([previousBox.x + previousBox.w / 2, previousBox.y + previousBox.h / 2]);
      else {
        const focus = focusAt[index];
        const subject = placeNodes.filter((node) => focus !== "all" && focus.has(node.id)).map((node) => project(node.world))
          .filter(([x, y]) => x > 0 && x < layout.width && y > 0 && y < layout.height);
        anchors.push(...(subject.length ? subject : [[layout.center.x, layout.center.y] as XY]));
      }
    }
    const xs = anchors.map(([x]) => x);
    const ys = anchors.map(([, y]) => y);
    const target = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    const box = placeCaption(size, target, captionObstacles(index, project, tau), previousBox);
    // Stored in world units so the caption rides the map.
    const scale = project([1, 0])[0] - project([0, 0])[0];
    const [ox, oy] = project([0, 0]);
    captions.push({ key, step: index, element, world: [(box.x - ox) / scale, (box.y - oy) / scale], start: line.start, end: line.end, alpha: 0 });
  }

  captions = captions.filter((caption) => {
    const leaving = caption.step !== index ? smooth(tau / 0.35) : 0;
    const appear = smooth((tau - caption.start + 0.2) / 0.45);
    const fade = Math.max(smooth((tau - caption.end + 0.1) / 0.5), leaving, state.documentary.on ? 0 : 1);
    if (caption.step !== index ? leaving >= 1 : fade >= 1 && tau > caption.end) {
      caption.element.remove();
      return false;
    }
    const { x, y } = boxOf(caption, caption.step === index ? project : screen);
    const { style } = caption.element;
    // A caption from the step just left fades from wherever it was.
    if (caption.step === index) caption.alpha = appear * (1 - fade);
    style.opacity = (caption.step === index ? caption.alpha : caption.alpha * (1 - leaving)).toFixed(3);
    style.transform = `translate(${x.toFixed(1)}px, ${(y + (1 - appear) * 8 - fade * 6).toFixed(1)}px)`;
    style.setProperty("--p", ((tau - caption.start + 0.2) * WRITE_RATE * state.speed).toFixed(2));
    return true;
  });
};

const boxOf = (caption: Caption, project: (point: XY) => XY) => {
  const [x, y] = project(caption.world);
  return { x, y };
};

const step = (now: number) => {
  renderDocumentary(now);
  const frame = frameAt(frozen === undefined ? now : state.changedAt + frozenSeconds * 1000);
  state.displayed = frame.camera;
  render(frame);
  renderNarration(frozen === undefined ? now : state.changedAt + frozenSeconds * 1000);
  tickAutoplay(now);
  if (pinned || (hovered && !tooltip.hidden)) {
    // Keep the tooltip attached while the camera moves.
    const node = placeNodes.find((candidate) => candidate.id === (pinned ?? hovered));
    if (node && node.visible < 0.2) closeTooltip(true);
  }
  if (virtualNow !== undefined) {
    // Card fades are CSS transitions in real time; in export they follow the virtual clock.
    const card = document.querySelector<HTMLElement>(".panel > .is-active, .quote-layer > .is-active");
    if (card) card.style.opacity = smooth((now - state.changedAt) / 600).toFixed(3);
  }
  return frame;
};

const loop = (now: number) => {
  step(virtualNow ?? now);
  requestAnimationFrame(loop);
};

const relayout = () => {
  measure();
  renderDocumentary(clock());
};

const applyScheme = () => {
  readColors();
  baseKey = "";
};

applyScheme();
relayout();
showCard(initial, 0);
updateChrome();
requestAnimationFrame(loop);
window.addEventListener("resize", relayout);
document.fonts?.ready.then(relayout);

(window as typeof window & { __atlas?: unknown }).__atlas = {
  steps: steps.length,
  goTo,
  // The attention budget of every step, for checking pacing.
  timing: () => steps.map((stepData, index) => {
    const slots = subtitlePlan(index);
    return {
      id: stepData.id,
      hold: +holdSeconds(index, tourStart(index), undefined).toFixed(1),
      animation: +(animationTime(index, 1) - animationTime(index, 0)).toFixed(1),
      subtitles: slots.length ? +slots[slots.length - 1].end.toFixed(1) : 0,
      beats: stepData.beats?.length ?? 0,
    };
  }),
  // Where the film's time goes, in characters of reading, by kind of information.
  budget: () => {
    const totals: Record<string, number> = { text: 0, refocus: 0, mark: 0, inset: 0, change: 0, label: 0, beat: 0, interlude: 0 };
    steps.forEach((stepData, index) => {
      if (index === 0 || isInterlude(index)) totals.interlude += interludeCost(index);
      for (const slot of subtitlePlan(index)) {
        const visual = slot.visuals.reduce((total, item) => total + item.cost, 0);
        totals.text += textCost(slot.html);
        totals.refocus += (slot.end - slot.start) * READING_RATE * state.speed - textCost(slot.html) - visual;
        for (const item of slot.visuals) totals[item.kind] += item.cost;
      }
      for (const beat of (stepData.beats ?? []).slice(0, TOUR_BEATS)) totals.beat += beatHold(beat) * READING_RATE * state.speed;
    });
    return Object.fromEntries(Object.entries(totals).map(([kind, chars]) => [kind, `${Math.round(chars)} chars · ${(seconds(chars) / 60).toFixed(1)} min`]));
  },
  // Where a city is drawn right now, for tests that hover it.
  placeScreen: (id: PlaceId) => placeNodes.find((node) => node.id === id)?.screen,
  // Deterministic video export: begin autoplay from a step on a virtual clock, then
  // advance it frame by frame and screenshot each frame.
  export: {
    begin: (from: number) => {
      virtualNow = 1000;
      document.body.classList.add("is-export");
      state.step = Math.max(0, from - 1);
      state.previous = undefined;
      state.changedAt = virtualNow - 120_000;
      state.camera.path = undefined;
      showCard(state.step, 0);
      setPlaying(true);
      goTo(from);
    },
    advance: (milliseconds: number) => {
      virtualNow = (virtualNow ?? 0) + milliseconds;
      const frame = step(virtualNow);
      return { step: state.step, x: frame.camera.x, y: frame.camera.y, scale: frame.camera.scale, playing: state.playing };
    },
  },
  // Freeze on a step at a time since entering it, for capture.
  freeze: (step: number, seconds: number) => {
    frozen = step;
    state.previous = undefined;
    state.step = step;
    state.changedAt = clock() - seconds * 1000;
    showCard(step, 0);
    updateChrome();
  },
};
