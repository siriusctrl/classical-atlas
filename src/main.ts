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
// Seconds a step's map animation takes once the camera has (mostly) arrived.
const ANIMATION_SECONDS = 6;
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
const grain = document.querySelector<HTMLElement>(".map-grain")!;
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

const layout = { width: 0, height: 0, mobile: false, fit: 1, stage: { x: 0, y: 0, w: 0, h: 0 } };

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
  layout.fit = Math.min(layout.stage.w / land.width, layout.stage.h / land.height);
  svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
};

// ---------- Colours ----------

const colorKeys = [
  "athens", "sparta", "neutral", "persia", "grain", "gold", "ember", "char", "field",
  "ruined", "land", "ink", "sea", "sea-light", "halo",
] as const;
const colors = Object.fromEntries(colorKeys.map((key) => [key, ""])) as Record<(typeof colorKeys)[number], string>;
const readColors = () => {
  const style = getComputedStyle(document.documentElement);
  for (const key of colorKeys) colors[key] = style.getPropertyValue(`--${key}`).trim();
};

// A fixed-seed paper grain, generated once.
const paintGrain = () => {
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
  grain.style.backgroundImage = `url(${canvas.toDataURL()})`;
};

// ---------- Camera ----------

const viewOf = (camera: Camera): ZoomView => {
  const [x, y] = toWorld(camera.at);
  return [x, y, layout.stage.w / (layout.fit * camera.zoom)];
};

// ---------- Static map ----------

const defs = svgElement("defs", {}, svg);
const seaGradient = svgElement("radialGradient", { id: "sea", cx: "62%", cy: "48%", r: "75%" }, defs);
const seaStops = [0, 1].map((offset) => svgElement("stop", { offset }, seaGradient));
svgElement("rect", { x: 0, y: 0, width: "100%", height: "100%", fill: "url(#sea)" }, svg);

const world = svgElement("g", {}, svg);
for (const [width, opacity] of [[30, 0.16], [19, 0.26], [11, 0.38], [5, 0.55]] as const) {
  svgElement("path", { class: "waterline", d: land.land, "stroke-width": width, opacity }, world);
}
const shadow = svgElement("g", {}, svg);
svgElement("path", { class: "land-shadow", d: land.land }, shadow);
const landGroup = svgElement("g", {}, svg);
svgElement("path", { class: "land", d: land.land }, landGroup);

const glowLayer = svgElement("g", { class: "glows" }, svg);
const textLayer = svgElement("g", {}, svg);
const traceLayer = svgElement("g", {}, svg);
const wallLayer = svgElement("g", {}, svg);
const markLayer = svgElement("g", {}, svg);
const placeLayer = svgElement("g", {}, svg);
const effectLayer = svgElement("g", {}, svg);
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

const renderMapTexts = (dimmed: number) => {
  for (const { text, group, world: at } of mapTexts) {
    const alpha = zoomBand(text) * (1 - dimmed);
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

const markRenderer = (mark: Mark, group: SVGGElement): Renderer => {
  const color = () => ("side" in mark ? colors[mark.side] : colors.ink);
  switch (mark.type) {
    case "route": {
      const geometry = spline(mark.via);
      const body = mark.style === "band"
        ? svgElement("path", { class: "route-band" }, group)
        : svgElement("path", { class: "route-line" }, group);
      const chevrons = mark.style === "army"
        ? Array.from({ length: 40 }, () => svgElement("path", { d: CHEVRON }, group))
        : [];
      const head = mark.style === "army" ? svgElement("path", { d: ARROW }, group) : undefined;
      const wallGlow = mark.style === "wall" ? svgElement("path", { class: "route-line" }, group) : undefined;
      const ticks = mark.style === "wall" ? svgElement("path", { class: "route-line" }, group) : undefined;
      if (wallGlow) group.insertBefore(wallGlow, body);
      const tag = mark.tag ? svgElement("text", { class: "route-tag" }, group) : undefined;
      if (tag) tag.textContent = mark.tag!;
      const ships = Array.from(
        { length: mark.ships ?? (mark.style === "fleet" ? 5 : 0) },
        () => shipNode(group),
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
          set(body, "d", pathData(drawn));
          set(body, "stroke", color());
          set(body, "stroke-width", mark.style === "army" ? 2.4 : mark.style === "wall" ? mark.width ?? 3.2 : 1.6);
          set(body, "stroke-dasharray", mark.style === "fleet" ? "1 4" : "none");
          set(body, "opacity", (visible * (mark.style === "wall" ? 1 : 0.85)).toFixed(3));
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
          set(tag, "opacity", (visible * smooth(u * 8)).toFixed(3));
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
      const rings = [0, 1].map(() => svgElement("circle", { fill: "none" }, group));
      const rays = Array.from({ length: 10 }, () => svgElement("line", { "stroke-linecap": "round" }, group));
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
      const ships = Array.from({ length: count }, () => shipNode(group));
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
        return { at, size: 1.3 + random() * 1.5, turn: random() * 60 - 30, rect: svgElement("rect", {}, group), ember: svgElement("circle", {}, group) };
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
      const coins = Array.from({ length: 12 }, () => svgElement("circle", { r: 3.4 }, group));
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
  const group = svgElement("g", { display: "none" }, markLayer);
  const renderers = (step.marks ?? []).map((mark) => markRenderer(mark, group));
  return { group, renderers };
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
  const gradient = svgElement("radialGradient", { id: `glow-${id}` }, defs);
  const stops = [[0, 0.5], [0.45, 0.2], [1, 0]].map(([offset, opacity]) =>
    svgElement("stop", { offset, "stop-opacity": opacity }, gradient));
  const glow = svgElement("circle", { fill: `url(#glow-${id})` }, glowLayer);
  const group = svgElement("g", {}, placeLayer);
  const ripple = svgElement("circle", { fill: "none", "stroke-width": 1.5 }, group);
  const ring = major ? svgElement("circle", { fill: "none", "stroke-width": 1.3 }, group) : undefined;
  const dot = svgElement("circle", { "stroke-width": 1.6 }, group);
  const label = svgElement("text", { class: `place-label${major ? " is-major" : ""}` }, group);
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
    id, world: toWorld(id), major, changes, gradient, stops, glow, ripple, ring, dot, label, debris,
    offset: [dx, dy] as XY,
    // Read by hover hit-testing and the tooltip.
    screen: [0, 0] as XY,
    visible: 0,
    side: undefined as Side | "ruined" | undefined,
  };
});

const colorOf = (side: Side | "ruined") => (side === "ruined" ? colors.land : colors[side]);

let hovered: PlaceId | undefined;

const renderPlaces = (frame: Frame, dimmed: number) => {
  const { P, step, previous: lastStep, enter, leave, time } = frame;
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
    const labelAlpha = Math.max(
      here ? (before ? 1 : smooth(enter * 1.6)) : 0,
      !here && before ? 1 - smooth(leave) : 0,
      isHovered ? 1 : 0,
    ) * (1 - dimmed);
    node.side = latest?.side;

    const [x, y] = screen(node.world);
    const alpha = Math.max(presence > 0 ? 1 : 0, labelAlpha);
    const pop = presence > 0 ? backOut(presence) : labelAlpha;
    const radius = (node.major ? 6 : 4.2) * pop * (isHovered ? 1.45 : 1);
    node.screen = [x, y];
    node.visible = alpha * (1 - dimmed);
    set(node.dot, "cx", fixed(x));
    set(node.dot, "cy", fixed(y));
    set(node.dot, "r", Math.max(radius, 0).toFixed(2));
    set(node.dot, "fill", fill);
    set(node.dot, "stroke", stroke);
    set(node.dot, "opacity", (alpha * (1 - dimmed * 0.6)).toFixed(3));
    if (node.ring) {
      set(node.ring, "cx", fixed(x));
      set(node.ring, "cy", fixed(y));
      set(node.ring, "r", (11 * pop).toFixed(2));
      set(node.ring, "stroke", fill);
      set(node.ring, "opacity", (alpha * 0.7 * (1 - dimmed)).toFixed(3));
    }

    // A ring spreads whenever a city appears or changes hands.
    const echo = latest ? within(P, [latest.at, latest.at + 0.16]) : 1;
    set(node.ripple, "cx", fixed(x));
    set(node.ripple, "cy", fixed(y));
    set(node.ripple, "r", fixed(5 + easeOut(echo) * 24));
    set(node.ripple, "stroke", fill === colors.land ? colors.ink : fill);
    set(node.ripple, "opacity", echo > 0 && echo < 1 ? ((1 - echo) * 0.7).toFixed(3) : "0");

    // Influence: a soft field of the city's colour, gone once it is destroyed.
    const glowRadius = clamp(40 * zoomNow * layout.fit, 26, 120) * (1 + Math.sin(time * 0.7 + x * 0.01) * 0.03);
    // Influence reads at regional scale; in close-ups it would fog the detail.
    const glowZoom = 1 - 0.75 * smooth((zoomNow - 3) / 6);
    set(node.glow, "cx", fixed(x));
    set(node.glow, "cy", fixed(y));
    set(node.glow, "r", fixed(glowRadius * (0.4 + 0.6 * smooth(presence))));
    set(node.glow, "opacity", (glowZoom * smooth(presence) * (1 - ruined) * (node.changes[0]?.side === "neutral" && fill === colors.neutral ? 0.35 : 1) * (1 - dimmed * 0.5)).toFixed(3));
    for (const stop of node.stops) set(stop, "stop-color", fill);

    node.debris.forEach((piece, pieceIndex) => {
      const angle = (pieceIndex / node.debris.length) * Math.PI * 2 + pieceIndex;
      const burst = easeOut(ruined);
      const reach = 4 + burst * (14 + (pieceIndex % 3) * 6);
      set(piece, "cx", fixed(x + Math.cos(angle) * reach));
      set(piece, "cy", fixed(y + Math.sin(angle) * reach + burst * burst * 10));
      set(piece, "fill", colors.ruined);
      set(piece, "opacity", ruined > 0 && ruined < 1 ? ((1 - ruined) * 0.8).toFixed(3) : "0");
    });

    set(node.label, "x", fixed(x + node.offset[0]));
    set(node.label, "y", fixed(y + node.offset[1]));
    set(node.label, "opacity", labelAlpha.toFixed(3));
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
  index === undefined ? 0 : index === 0 ? 0.82 : steps[index].quote ? 0.92 : 0;

const render = (frame: Frame) => {
  const { camera, step, previous, f, P, enter, leave, time } = frame;
  const s = camera.scale;
  zoomNow = s / layout.fit;
  const ox = layout.stage.x + layout.stage.w / 2 - camera.x * s;
  const oy = layout.stage.y + layout.stage.h / 2 - camera.y * s;
  screen = ([x, y]) => [x * s + ox, y * s + oy];
  const transform = `translate(${ox.toFixed(2)},${oy.toFixed(2)}) scale(${s.toFixed(5)})`;
  set(world, "transform", transform);
  set(landGroup, "transform", transform);
  set(shadow, "transform", `translate(${(ox + 2.5).toFixed(2)},${(oy + 4).toFixed(2)}) scale(${s.toFixed(5)})`);

  // Title and quotes dim the map; the dimming crossfades with the camera move.
  const fade = smooth(leave);
  const dimmed = previous === undefined
    ? dimFor(step)
    : dimFor(previous) + (dimFor(step) - dimFor(previous)) * smooth(enter);
  dim.style.opacity = clamp01(dimmed).toFixed(3);
  series.style.opacity = (step === 0 ? 1 : previous === 0 ? 1 - fade : 0).toFixed(3);
  const blur = step === 0 ? 5 : previous === 0 ? 5 * (1 - fade) : 0;
  const filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "";
  if (filter !== lastFilter) svg.style.filter = lastFilter = filter;

  stepGroups.forEach(({ group, renderers }, index) => {
    const current = index === step;
    const outgoing = index === previous && index !== step && fade < 1;
    set(group, "display", current || outgoing ? "inline" : "none");
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

  renderMapTexts(clamp01(dimmed));
  renderWalls(P);
  renderPlaces(frame, clamp01(dimmed));
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
const chapterOf = steps.map((step, index) => (index === 0 || step.quote ? undefined : ++chapterCount));
const plainText = (html: string) => html.replace(/<cite>.*?<\/cite>/g, "").replace(/<[^>]+>/g, "");

// How long autoplay holds a step at 1×: enough to read it, never shorter than its animation.
const readingSeconds = (index: number) => {
  const step = steps[index];
  if (step.quote) return 3.5 + plainText(step.quote.text + (step.quote.note ?? "")).length / 5;
  if (index === 0) return 9;
  return Math.max(ANIMATION_SECONDS + 1.5, 2 + plainText(step.body.join("")).length / 8);
};

const stepLabel = (index: number) =>
  index === 0 ? "序" : steps[index].quote ? "引文" : roman(chapterOf[index]!);

const stepTitle = (index: number) =>
  steps[index].quote ? `“${plainText(steps[index].quote!.text).slice(0, 18)}…”` : steps[index].title;

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
  if (step.quote) {
    element.className = "quote";
    element.innerHTML = `<span class="quote-mark" aria-hidden="true">“</span>
      <p class="quote-text">${step.quote.text}</p>
      <div class="quote-cite">${step.quote.cite}</div>
      ${step.quote.note ? `<p class="quote-note">${step.quote.note}</p>` : ""}`;
    return element;
  }
  element.className = `card${index === 0 ? " is-opening" : ""}`;
  element.innerHTML = `${index === 0 ? "" : `<span class="card-index">${stepLabel(index)}</span>`}
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
  (steps[index].quote ? quoteLayer : panel).append(element);
  panel.classList.toggle("is-opening", index === 0);
  panel.classList.toggle("is-quote", Boolean(steps[index].quote));
  requestAnimationFrame(() => requestAnimationFrame(() => element.classList.add("is-active")));
  element.querySelector(".begin")?.addEventListener("click", () => {
    goTo(1);
    setPlaying(true);
  });
  element.querySelector(".browse")?.addEventListener("click", () => goTo(1));
};

// ---------- Chapters strip ----------

chapters.innerHTML = steps.map((step, index) =>
  `<button class="chapter${step.quote ? " is-quote" : ""}" type="button" role="tab" data-step="${index}" aria-label="${stepLabel(index)} ${plainText(stepTitle(index))}"><span class="chapter-tip">${stepLabel(index)} · ${stepTitle(index)}</span></button>`,
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
  // A camera target that replaces the step's own view, e.g. a beat the reader clicked.
  target: undefined as ZoomView | undefined,
  focusBeat: undefined as number | undefined,
  hoverBeat: undefined as number | undefined,
};

const FLY_SECONDS = 1.4;

const beatView = (index: number, beat: Beat): ZoomView => {
  const [x, y] = toWorld(beat.at);
  const zoom = beat.zoom ?? steps[index].camera.zoom * 2;
  return [x, y, layout.stage.w / (layout.fit * zoom)];
};

const beatHold = (beat: Beat) => (2.4 + plainText(beat.text).length / 9) / state.speed;

type Segment = { path: (t: number) => ZoomView; start: number; end: number; beat?: number };
let planKey = "";
let plan: Segment[] = [];

// The tour as a timeline: fly to each beat, hold while it reads, then fly home.
const tourPlan = (index: number) => {
  const key = `${index}:${state.tour.base}:${state.speed}:${state.tour.from?.join(",")}:${layout.width}x${layout.height}`;
  if (key === planKey) return plan;
  planKey = key;
  plan = [];
  const beats = steps[index].beats ?? [];
  if (beats.length === 0) return plan;
  let at = state.tour.base;
  let from = state.tour.from ?? viewOf(steps[index].camera);
  beats.forEach((beat, order) => {
    const to = beatView(index, beat);
    const end = at + FLY_SECONDS + beatHold(beat);
    plan.push({ path: interpolateZoom(from, to), start: at, end, beat: order });
    at = end;
    from = to;
  });
  plan.push({ path: interpolateZoom(from, viewOf(steps[index].camera)), start: at, end: at + FLY_SECONDS });
  return plan;
};

const viewFromCamera = ({ x, y, scale }: { x: number; y: number; scale: number }): ZoomView =>
  [x, y, layout.stage.w / scale];

const moveCamera = (to: ZoomView, now: number) => {
  const path = interpolateZoom(viewFromCamera(state.displayed), to);
  state.camera = { path, start: now, ms: clamp(path.duration * 0.85, 800, 2600) };
  return state.camera.ms;
};

const frameAt = (now: number): Frame => {
  const tau = (now - state.changedAt) / 1000;
  const cameraT = clamp01((now - state.camera.start) / state.camera.ms);
  let view = state.camera.path && cameraT < 1
    ? state.camera.path(easeInOut(cameraT))
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
      view = segment.path(easeInOut(clamp01((tau - segment.start) / FLY_SECONDS)));
      if (segment.beat !== undefined) {
        beat = segment.beat;
        beatAppear = smooth((tau - segment.start - FLY_SECONDS * 0.75) / 0.45)
          * (1 - smooth((tau - segment.end + 0.4) / 0.4));
      }
      break;
    }
  }
  // A slow push-in while the title holds.
  const push = state.step === 0 ? 1 + 0.06 * smooth(tau / 12) : 1;
  const storyCamera = { x: view[0], y: view[1], scale: (layout.stage.w / view[2]) * push };
  const animationStart = (state.stepMs * 0.55) / 1000;
  const f = clamp01((tau - animationStart) / ANIMATION_SECONDS);
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
  const now = performance.now();
  const direction = Math.sign(index - state.step);
  state.stepMs = moveCamera(viewOf(steps[index].camera), now);
  state.previous = state.step;
  state.step = index;
  state.changedAt = now;
  state.explore = undefined;
  state.target = undefined;
  state.focusBeat = undefined;
  state.hoverBeat = undefined;
  state.tour.base = (state.stepMs * 0.55) / 1000 + ANIMATION_SECONDS * 0.92;
  state.tour.from = undefined;
  recenter.hidden = true;
  closeTooltip(true);
  showCard(index, direction);
  updateChrome();
  history.replaceState(null, "", `#${steps[index].id}`);
}

function returnToStory() {
  moveCamera(viewOf(steps[state.step].camera), performance.now());
  state.explore = undefined;
  state.target = undefined;
  state.focusBeat = undefined;
  recenter.hidden = true;
}

// Fly to a beat and hold its callout open, as if the tour had stopped there.
function focusBeat(order: number) {
  if (state.playing) setPlaying(false);
  const view = beatView(state.step, steps[state.step].beats![order]);
  moveCamera(view, performance.now());
  state.explore = undefined;
  state.target = view;
  state.focusBeat = order;
  recenter.hidden = false;
}

// ---------- Autoplay ----------

const speeds = [0.75, 1, 1.5, 2];

function setPlaying(value: boolean) {
  const tau = (performance.now() - state.changedAt) / 1000;
  if (!value && state.tour.on) {
    // Pausing mid-tour leaves the camera and callout where they are.
    const active = frameAt(performance.now());
    const home = viewOf(steps[state.step].camera);
    if (Math.abs(active.camera.x - home[0]) > 1 || Math.abs(active.camera.scale - layout.stage.w / home[2]) > 0.01) {
      state.explore = { ...state.displayed };
      recenter.hidden = false;
    }
    state.focusBeat = active.beat;
  }
  if (value) {
    state.target = undefined;
    state.focusBeat = undefined;
    if (tau > state.tour.base - 0.1 || state.explore) {
      // Resuming mid-step: start the tour from wherever the camera is now.
      state.tour.base = tau + 0.2;
      state.tour.from = viewFromCamera(state.displayed);
      state.explore = undefined;
      recenter.hidden = true;
    }
  }
  state.tour.on = value;
  state.playing = value && state.step < steps.length - 1;
  playButton.setAttribute("aria-pressed", String(state.playing));
  playButton.setAttribute("aria-label", state.playing ? "暂停" : "自动播放");
  document.body.classList.toggle("is-playing", state.playing);
}

const holdSeconds = (index: number) => {
  const animationStart = (state.stepMs * 0.55) / 1000;
  const tour = tourPlan(index);
  return Math.max(
    animationStart + ANIMATION_SECONDS + 0.8,
    animationStart + readingSeconds(index) / state.speed,
    tour.length ? tour[tour.length - 1].end + 0.6 : 0,
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

const stageCenter = () => [layout.stage.x + layout.stage.w / 2, layout.stage.y + layout.stage.h / 2];

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
  if (index === 0 || step.quote) return;
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
  : legacy === null ? 30 : 1.2 + (Number(legacy) % 1) * ANIMATION_SECONDS;
let frozen: number | undefined = frozenStep === null ? undefined : clamp(Number(frozenStep), 0, steps.length - 1);
// &tour=1 renders the autoplay camera tour, as a video export would.
if (query.get("tour") === "1") state.tour = { on: true, base: 0.55 + ANIMATION_SECONDS * 0.92, from: undefined };

const hashStep = steps.findIndex((step) => `#${step.id}` === window.location.hash);
const initial = frozen ?? (hashStep > 0 ? hashStep : 0);
state.step = initial;
state.changedAt = performance.now() - (frozen === undefined ? 0 : frozenSeconds * 1000);

const loop = (now: number) => {
  const frame = frameAt(frozen === undefined ? now : state.changedAt + frozenSeconds * 1000);
  state.displayed = frame.camera;
  render(frame);
  tickAutoplay(now);
  if (pinned || (hovered && !tooltip.hidden)) {
    // Keep the tooltip attached while the camera moves.
    const node = placeNodes.find((candidate) => candidate.id === (pinned ?? hovered));
    if (node && node.visible < 0.2) closeTooltip(true);
  }
  requestAnimationFrame(loop);
};

const relayout = () => measure();

const applyScheme = () => {
  readColors();
  for (const [stop, key] of [[seaStops[0], "sea-light"], [seaStops[1], "sea"]] as const) {
    stop.setAttribute("stop-color", colors[key]);
  }
};

applyScheme();
paintGrain();
relayout();
showCard(initial, 0);
updateChrome();
requestAnimationFrame(loop);
window.addEventListener("resize", relayout);
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyScheme);
document.fonts?.ready.then(relayout);

(window as typeof window & { __atlas?: unknown }).__atlas = {
  steps: steps.length,
  goTo,
  // Freeze on a step at a time since entering it, for capture.
  freeze: (step: number, seconds: number) => {
    frozen = step;
    state.previous = undefined;
    state.step = step;
    state.changedAt = performance.now() - seconds * 1000;
    showCard(step, 0);
    updateChrome();
  },
};
