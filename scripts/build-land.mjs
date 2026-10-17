// Clip Natural Earth 10m land to the Mediterranean and bake it into a planar SVG path.
// The runtime rebuilds the same projection from the saved parameters to place points.
import { readFileSync, writeFileSync } from "node:fs";
import { geoConicConformal, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import { presimplify, simplify } from "topojson-simplify";
import { topology as buildTopology } from "topojson-server";

const WIDTH = 2000;
// World units are roughly 0.85 km; the closest camera zooms about 8x.
const MIN_ISLAND_AREA = 0.6;
const MIN_WEIGHT = 0.06;
// The story never looks outside the core box; the margin keeps the data edge off-screen.
const core = { west: 11.2, east: 30.6, south: 34.6, north: 42.4 };
const margin = { west: 9, east: 8, south: 6, north: 5 };
const bounds = {
  west: core.west - margin.west,
  east: core.east + margin.east,
  south: core.south - margin.south,
  north: core.north + margin.north,
};

const topology = JSON.parse(readFileSync(new URL("../node_modules/world-atlas/land-10m.json", import.meta.url)));
const land = feature(topology, topology.objects.land);

// Natural Earth 10m omits Sphacteria, which one chapter zooms into. This is a hand-traced
// approximation of the island from modern maps, accurate to a few hundred metres.
const sphacteria = [
  [21.664, 36.948], [21.660, 36.946], [21.659, 36.935], [21.657, 36.918], [21.658, 36.905],
  [21.664, 36.903], [21.668, 36.915], [21.671, 36.930], [21.672, 36.944], [21.664, 36.948],
];

const box = (b) => ({
  type: "Polygon",
  coordinates: [[
    // Clockwise, so d3 treats the ring as the small box rather than the rest of the globe.
    [b.west, b.south], [b.west, b.north],
    [b.east, b.north], [b.east, b.south], [b.west, b.south],
  ]],
});
const frame = box(core);
const projection = geoConicConformal().parallels([35, 41]).rotate([-21, 0]);
projection.fitWidth(WIDTH, frame);
const [[, y0], [, y1]] = geoPath(projection).bounds(frame);
const height = Math.ceil(y1 - y0);
projection.translate([projection.translate()[0], projection.translate()[1] - y0]);
const [[cx0, cy0], [cx1, cy1]] = geoPath(projection).bounds(box(bounds));
projection.clipExtent([[cx0, cy0], [cx1, cy1]]);

// Collect projected rings, then simplify in planar world units so detail matches on-screen size.
const rings = [];
let ring;
geoPath(projection, {
  moveTo(x, y) { ring = [[x, y]]; rings.push(ring); },
  lineTo(x, y) { ring.push([x, y]); },
  closePath() { ring.push(ring[0]); },
  arc() {},
})(land);
const area = (points) => Math.abs(points.reduce((sum, [x, y], index) => {
  const [nx, ny] = points[(index + 1) % points.length];
  return sum + x * ny - nx * y;
}, 0) / 2);
rings.push(sphacteria.map((point) => projection(point)));
const kept = rings.filter((points) => points.length > 3 && area(points) > MIN_ISLAND_AREA);
const planar = buildTopology({
  // Rings keep their own geometry; the page fills them even-odd, so seas cut out of the
  // clip rectangle stay open water.
  land: { type: "MultiPolygon", coordinates: kept.map((points) => [points]) },
}, 1e5);
const simplifiedTopology = simplify(presimplify(planar), MIN_WEIGHT);
console.log("rings", rings.length, "kept", kept.length, "points", kept.reduce((n, r) => n + r.length, 0));
const d = geoPath().digits(1)(feature(simplifiedTopology, simplifiedTopology.objects.land));
const out = {
  width: WIDTH,
  height,
  extent: [[cx0, cy0], [cx1, cy1]].map((point) => point.map((value) => Math.round(value))),
  projection: {
    parallels: [35, 41],
    rotate: [-21, 0],
    scale: projection.scale(),
    translate: projection.translate(),
  },
  land: d,
};
writeFileSync(new URL("../src/data/land.json", import.meta.url), JSON.stringify(out));
console.log(`land.json: ${WIDTH}x${height}, ${(d.length / 1024).toFixed(0)} KB path`);
