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
import {
  allegiance,
  phases,
  regions,
  seas,
  steps,
  type Camera,
  type Inset,
  type MapText,
  type Mark,
  type Window as Span,
} from "./story";

// Every frame is a pure function of story progress P (step index + fraction through that
// step) plus an ambient clock for small idle motion. Scrolling, the play button, and frame
// capture all just choose a P.

type XY = [number, number];
type Point = PlaceId | XY;

const SVG = "http://www.w3.org/2000/svg";
const CAMERA_START = 0.6;
const FADE_OUT: Span = [0.8, 0.97];
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
const stepFade = (f: number) => 1 - smooth(within(f, FADE_OUT));
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
const story = document.querySelector<HTMLElement>(".story")!;
const playButton = document.querySelector<HTMLButtonElement>(".play")!;
const series = document.querySelector<HTMLElement>(".masthead-series")!;

const layout = { width: 0, height: 0, mobile: false, fit: 1, stage: { x: 0, y: 0, w: 0, h: 0 } };

const measure = () => {
  layout.width = mapElement.clientWidth;
  layout.height = mapElement.clientHeight;
  layout.mobile = layout.width <= 760;
  // The stage is the part of the screen the cards leave free; cameras centre on it.
  layout.stage = layout.mobile
    ? { x: 0, y: 110, w: layout.width, h: layout.height * 0.42 - 70 }
    : layout.width >= 1100
      ? { x: 490, y: 60, w: layout.width - 490, h: layout.height - 170 }
      : { x: 0, y: 60, w: layout.width, h: layout.height - 170 };
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

let cameraPaths: ((t: number) => ZoomView)[] = [];
const buildCameraPaths = () => {
  cameraPaths = steps.slice(0, -1).map((step, index) =>
    interpolateZoom(viewOf(step.camera), viewOf(steps[index + 1].camera)),
  );
};

const cameraAt = (P: number) => {
  const index = Math.min(Math.floor(P), steps.length - 1);
  const f = P - index;
  const view = index < steps.length - 1 && f > CAMERA_START
    ? cameraPaths[index](easeInOut(within(f, [CAMERA_START, 1])))
    : viewOf(steps[index].camera);
  // A slow push-in while the title holds.
  const push = index === 0 ? 1 + 0.07 * smooth(f / CAMERA_START) : 1;
  return { x: view[0], y: view[1], scale: (layout.stage.w / view[2]) * push };
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
  return { id, world: toWorld(id), major, changes, gradient, stops, glow, ripple, ring, dot, label, debris, offset: [dx, dy] as XY };
});

const colorOf = (side: Side | "ruined") => (side === "ruined" ? colors.land : colors[side]);

const renderPlaces = (P: number, dimmed: number, time: number) => {
  const index = Math.min(Math.floor(P), steps.length - 1);
  const f = P - index;
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
      }
      previous = change;
    }

    const here = labelledAt[index].has(node.id);
    const next = index + 1 < steps.length && labelledAt[index + 1].has(node.id);
    const enter = here ? smooth(within(f, [0.02, 0.2])) : 0;
    const leave = here && !next ? smooth(within(f, [0.78, 0.95])) : 0;
    const arrive = next && !here ? smooth(within(f, [0.75, 0.95])) : 0;
    const labelAlpha = Math.max(enter * (1 - leave), arrive, here && next ? enter : 0) * (1 - dimmed);

    const [x, y] = screen(node.world);
    const alpha = Math.max(presence > 0 ? 1 : 0, labelAlpha);
    const pop = presence > 0 ? backOut(presence) : labelAlpha;
    const radius = (node.major ? 6 : 4.2) * pop;
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

const renderYear = (P: number) => {
  const index = Math.min(Math.floor(P), steps.length - 1);
  const t = index < steps.length - 1 ? easeInOut(within(P - index, [CAMERA_START, 1])) : 0;
  const from = steps[index].year;
  const to = steps[Math.min(index + 1, steps.length - 1)].year;
  const year = from + (to - from) * t;
  const label = t <= 0.02 ? yearText(index) : t >= 0.98 ? yearText(index + 1) : String(Math.round(year));
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

const renderInset = (P: number, time: number) => {
  const index = Math.min(Math.floor(P), steps.length - 1);
  const f = P - index;
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
  insetElement.style.opacity = String(appear * (1 - leave) * stepFade(f));
  insetElement.style.transform = `translateY(${fixed((1 - appear) * 14)}px)`;
  insetUpdate(within(f, [start, end]), time);
};

// ---------- Dimming: title and quotes ----------

const quoteSteps = steps.flatMap((step, index) => (step.quote ? [index] : []));
let lastFilter = "";

const dimAt = (P: number) => {
  const opening = 0.82 * (1 - smooth(within(P, [0.5, 0.95])));
  const quotes = Math.max(0, ...quoteSteps.map((index) => 0.92 * band(P - index, [-0.35, 0.05, 0.72, 1.02])));
  return Math.max(opening, quotes);
};

// ---------- Frame ----------

const render = (P: number, time: number) => {
  const camera = cameraAt(P);
  const s = camera.scale;
  zoomNow = s / layout.fit;
  const ox = layout.stage.x + layout.stage.w / 2 - camera.x * s;
  const oy = layout.stage.y + layout.stage.h / 2 - camera.y * s;
  screen = ([x, y]) => [x * s + ox, y * s + oy];
  const transform = `translate(${ox.toFixed(2)},${oy.toFixed(2)}) scale(${s.toFixed(5)})`;
  set(world, "transform", transform);
  set(landGroup, "transform", transform);
  set(shadow, "transform", `translate(${(ox + 2.5).toFixed(2)},${(oy + 4).toFixed(2)}) scale(${s.toFixed(5)})`);

  // The series name belongs to the title; later it would collide with cards scrolling past.
  series.style.opacity = (1 - smooth(within(P, [0.6, 0.95]))).toFixed(3);
  const dimmed = dimAt(P);
  dim.style.opacity = dimmed.toFixed(3);
  const blur = 5 * (1 - smooth(within(P, [0.45, 0.95])));
  const filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "";
  if (filter !== lastFilter) svg.style.filter = lastFilter = filter;

  const index = Math.min(Math.floor(P), steps.length - 1);
  const f = P - index;
  stepGroups.forEach(({ group, renderers }, stepIndex) => {
    const active = stepIndex === index;
    set(group, "display", active ? "inline" : "none");
    if (active) renderers.forEach((draw) => draw(f, stepFade(f), time));
  });

  // Traces are context for wide views; close-ups would show them as stray lines.
  const wide = 1 - smooth((zoomNow - 2.5) / 2);
  for (const trace of traces) {
    const visible = P >= trace.index + 0.8 && wide > 0;
    set(trace.element, "d", visible ? pathData(trace.geometry.points) : "");
    set(trace.element, "stroke", colors[trace.mark.side]);
    set(trace.element, "opacity", (smooth(within(P, [trace.index + 0.8, trace.index + 1])) * 0.6 * wide * (1 - dimmed)).toFixed(3));
  }

  renderMapTexts(dimmed);
  renderWalls(P);
  renderPlaces(P, dimmed, time);
  renderYear(P);
  renderInset(P, time);
};

// ---------- Story cards and scroll ----------

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

let chapter = 0;
story.innerHTML = steps.map((step, index) => {
  if (step.quote) {
    return `<section class="step is-quote" data-step="${index}">
      <article class="card">
        <span class="quote-mark" aria-hidden="true">“</span>
        <p class="quote-text">${step.quote.text}</p>
        <div class="quote-cite">${step.quote.cite}</div>
        ${step.quote.note ? `<p class="quote-note">${step.quote.note}</p>` : ""}
      </article>
    </section>`;
  }
  const opening = index === 0;
  if (!opening) chapter += 1;
  return `<section class="step${opening ? " is-opening" : ""}" data-step="${index}">
    <article class="card">
      ${opening ? "" : `<span class="card-index">${roman(chapter)}</span>`}
      <p class="card-kicker">${step.kicker}</p>
      <h2>${step.title}</h2>
      ${step.body.map((paragraph) => `<p>${paragraph}</p>`).join("")}
      ${step.legend ? `<div class="legend">
        <span style="--swatch: var(--athens)">雅典与盟邦</span>
        <span style="--swatch: var(--sparta)">斯巴达与盟邦</span>
        <span style="--swatch: var(--neutral)">中立</span>
        <span style="--swatch: var(--persia)">波斯</span>
        <span class="is-ruined">被毁</span>
      </div>` : ""}
      ${opening ? `<p class="scroll-hint">向下滚动，或点右上角“自动播放”</p>` : ""}
    </article>
  </section>`;
}).join("");

const sections = [...story.querySelectorAll<HTMLElement>(".step")];
let sectionTops: number[] = [];
let sectionHeights: number[] = [];

const measureSections = () => {
  sectionTops = sections.map((section) => section.offsetTop + story.offsetTop);
  sectionHeights = sections.map((section) => section.offsetHeight);
};

const progressFromScroll = () => {
  const line = window.scrollY + window.innerHeight * (layout.mobile ? 0.62 : 0.5);
  if (line < sectionTops[0]) return 0;
  for (let index = 0; index < sections.length; index += 1) {
    const top = sectionTops[index];
    const height = sectionHeights[index];
    if (line < top + height) return index + (line - top) / height;
  }
  return steps.length - 0.001;
};

// ?p=4.5 freezes the story at a progress value, for capture and review; &t= sets the clock.
const query = new URLSearchParams(window.location.search);
const frozen = query.get("p");
const frozenTime = query.get("t");
let current = frozen === null ? 0 : Number(frozen);

const reveal = new IntersectionObserver((entries) => {
  for (const entry of entries) entry.target.classList.toggle("is-visible", entry.isIntersecting);
}, { threshold: 0.2 });
for (const section of sections) {
  if (frozen === null) reveal.observe(section);
  else section.classList.add("is-visible");
}

const loop = (now: number) => {
  if (frozen === null) current = progressFromScroll();
  const time = frozenTime === null ? now / 1000 : Number(frozenTime);
  render(clamp(current, 0, steps.length - 0.001), time);
  requestAnimationFrame(loop);
};

const relayout = () => {
  measure();
  measureSections();
  buildCameraPaths();
};

const applyScheme = () => {
  readColors();
  for (const [stop, key] of [[seaStops[0], "sea-light"], [seaStops[1], "sea"]] as const) {
    stop.setAttribute("stop-color", colors[key]);
  }
};

applyScheme();
paintGrain();
relayout();
requestAnimationFrame(loop);
window.addEventListener("resize", relayout);
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyScheme);
document.fonts?.ready.then(relayout);

(window as typeof window & { __atlas?: unknown }).__atlas = {
  steps: steps.length,
  render: (P: number, time = 0) => {
    current = P;
    render(P, time);
  },
};

// ---------- Play ----------

let playing = false;
let lastTime = 0;

const setPlaying = (value: boolean) => {
  playing = value;
  playButton.setAttribute("aria-pressed", String(value));
  playButton.querySelector(".play-label")!.textContent = value ? "暂停" : "自动播放";
  if (value) {
    lastTime = performance.now();
    requestAnimationFrame(tick);
  }
};

// About seven seconds a step, lingering while a card is centred; quotes hold a little longer.
const tick = (time: number) => {
  if (!playing) return;
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;
  const index = Math.min(Math.floor(current), steps.length - 1);
  const height = sectionHeights[index] ?? window.innerHeight;
  const f = current - index;
  const hold = steps[index].quote ? 0.6 : 0.75;
  const pace = f > 0.2 && f < 0.6 ? hold : 1.15;
  window.scrollBy(0, (height / 6.5) * pace * dt);
  if (current >= steps.length - 0.02) {
    setPlaying(false);
    return;
  }
  requestAnimationFrame(tick);
};

playButton.addEventListener("click", () => setPlaying(!playing));
for (const type of ["wheel", "touchstart", "keydown"] as const) {
  window.addEventListener(type, () => playing && setPlaying(false), { passive: true });
}
