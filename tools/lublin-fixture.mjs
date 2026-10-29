#!/usr/bin/env node
/**
 * Test fixture for the map city preview (ADR-0044): converts an OpenStreetMap XML extract
 * into a small JSON of `building`, `ground` and `terrain` views in world coordinates
 * (ADR-0042: anchor LUBLIN_ANCHOR on Plac Litewski, equirectangular, x east, z north, metres).
 * Not the real importer (`tools/osm-import`): heights and uses come from simple rules, roads
 * and paths are buffered per segment, and the terrain is a smooth made-up slope in 2 x 2 chunks.
 *
 *   node tools/lublin-fixture.mjs <in.osm> <out.json>   (then ?lublin-preview&data=<url of out.json>)
 *
 * Data © OpenStreetMap contributors (ODbL).
 */
import { readFileSync, writeFileSync } from "node:fs";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: node tools/lublin-fixture.mjs <in.osm> <out.json>");
  process.exit(1);
}

const ANCHOR = { lat: 51.24838, lon: 22.55964, altitude: 198 };
const R = 6371008.8;
const DEG = Math.PI / 180;
const project = (lat, lon) => ({ x: (lon - ANCHOR.lon) * DEG * R * Math.cos(ANCHOR.lat * DEG), z: (lat - ANCHOR.lat) * DEG * R });
const r2 = (v) => Math.round(v * 100) / 100;

// --- OSM XML (only what the fixture needs) -------------------------------------------------
const xml = readFileSync(input, "utf8");
const attr = (s, k) => {
  const m = new RegExp(`\\s${k}="([^"]*)"`).exec(s);
  return m ? m[1] : undefined;
};
const decode = (v) => v.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const tagsOf = (body) => {
  const t = {};
  for (const m of body.matchAll(/<tag k="([^"]*)" v="([^"]*)"\s*\/>/g)) t[m[1]] = decode(m[2]);
  return t;
};
const nodes = new Map();
for (const m of xml.matchAll(/<node\b([^>]*?)(\/>|>([\s\S]*?)<\/node>)/g)) {
  const p = project(Number(attr(m[1], "lat")), Number(attr(m[1], "lon")));
  nodes.set(attr(m[1], "id"), { ...p, tags: m[3] ? tagsOf(m[3]) : {} });
}
const ways = new Map();
for (const m of xml.matchAll(/<way\b([^>]*)>([\s\S]*?)<\/way>/g)) {
  const refs = [...m[2].matchAll(/<nd ref="(\d+)"/g)].map((x) => x[1]);
  ways.set(attr(m[1], "id"), { id: attr(m[1], "id"), refs, tags: tagsOf(m[2]) });
}
const relations = [];
for (const m of xml.matchAll(/<relation\b([^>]*)>([\s\S]*?)<\/relation>/g)) {
  const members = [...m[2].matchAll(/<member type="way" ref="(\d+)" role="([^"]*)"/g)].map((x) => ({ ref: x[1], role: x[2] }));
  relations.push({ id: attr(m[1], "id"), members, tags: tagsOf(m[2]) });
}
const bounds = (() => {
  const b = /<bounds minlat="([\d.]+)" minlon="([\d.]+)" maxlat="([\d.]+)" maxlon="([\d.]+)"/.exec(xml);
  const lo = project(Number(b[1]), Number(b[2]));
  const hi = project(Number(b[3]), Number(b[4]));
  return { minX: lo.x, minZ: lo.z, maxX: hi.x, maxZ: hi.z };
})();

const pointsOf = (refs) => refs.map((r) => nodes.get(r)).filter(Boolean);
const area = (pts) => pts.reduce((s, p, i) => s + p.x * pts[(i + 1) % pts.length].z - pts[(i + 1) % pts.length].x * p.z, 0) / 2;
const centre = (pts) => ({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, z: pts.reduce((s, p) => s + p.z, 0) / pts.length });
const inside = (p, ring) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) c = !c;
  }
  return c;
};
const inBounds = (p) => p.x >= bounds.minX && p.x <= bounds.maxX && p.z >= bounds.minZ && p.z <= bounds.maxZ;
const closedRing = (refs) => {
  const pts = pointsOf(refs);
  if (pts.length > 1 && refs[0] === refs[refs.length - 1]) pts.pop();
  return pts.length >= 3 ? pts : null;
};
/** Joins the outer member ways of a multipolygon into one ring (the largest). */
const outerRing = (rel) => {
  const parts = rel.members.filter((m) => m.role === "outer").map((m) => ways.get(m.ref)?.refs.slice()).filter(Boolean);
  const rings = [];
  while (parts.length) {
    let ring = parts.shift();
    let grown = true;
    while (ring[0] !== ring[ring.length - 1] && grown) {
      grown = false;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const end = ring[ring.length - 1];
        if (p[0] === end) ring = ring.concat(p.slice(1));
        else if (p[p.length - 1] === end) ring = ring.concat(p.slice(0, -1).reverse());
        else continue;
        parts.splice(i, 1);
        grown = true;
        break;
      }
    }
    const pts = closedRing(ring);
    if (pts) rings.push(pts);
  }
  return rings.sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)))[0] ?? null;
};

// --- Terrain: a made-up slope, 2 x 2 chunks of a 10 m grid sharing their edge rows -------------
const smooth = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
/** Rises east towards the Krakowska Gate, falls north towards the Czechówka valley. */
const ground = (x, z) => 2.6 * (x / 300) - 5 * smooth(60, 420, z) + 1.2 * smooth(-60, -260, z) + 0.6 * Math.sin(x / 47) * Math.cos(z / 61);
const CELL = 10;
const terrains = [];
const X0 = Math.floor(bounds.minX / CELL) * CELL - CELL;
const X1 = Math.ceil(bounds.maxX / CELL) * CELL + CELL;
const Z0 = Math.floor(bounds.minZ / CELL) * CELL - CELL;
const Z1 = Math.ceil(bounds.maxZ / CELL) * CELL + CELL;
const XM = Math.round((X0 + X1) / 2 / CELL) * CELL;
const ZM = Math.round((Z0 + Z1) / 2 / CELL) * CELL;
for (const [xa, xb] of [
  [X0, XM],
  [XM, X1],
]) {
  for (const [za, zb] of [
    [Z0, ZM],
    [ZM, Z1],
  ]) {
    const cols = (xb - xa) / CELL + 1;
    const rows = (zb - za) / CELL + 1;
    const heights = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) heights.push(r2(ground(xa + c * CELL, za + r * CELL)));
    terrains.push({ position: { x: 0, y: 0, z: 0 }, view: { kind: "terrain", grid: { originX: xa, originZ: za, cell: CELL, cols, rows, heights } } });
  }
}
const heightAt = (x, z) => ground(x, z);

// --- Buildings ---------------------------------------------------------------------------
const LEVELS = { apartments: 5, residential: 4, house: 2, yes: 4, commercial: 5, retail: 3, office: 5, hotel: 5, church: 1, garages: 1, garage: 1, shed: 1, school: 4, hospital: 5, university: 4, college: 4, warehouse: 2, toilets: 1, kiosk: 1, public: 4, government: 4 };
const CIVIC = new Set(["school", "hospital", "university", "college", "public", "government", "civic", "townhall", "theatre"]);
const shopNodes = [...nodes.values()].filter((n) => n.tags.shop || ["restaurant", "cafe", "bank", "bar", "pub", "fast_food", "pharmacy", "bureau_de_change"].includes(n.tags.amenity));
const hash = (s) => {
  let h = 2166136261;
  for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
};

const useOf = (t, ring) => {
  const b = t.building;
  if (b === "church" || b === "chapel" || b === "cathedral" || t.amenity === "place_of_worship") return "church";
  if (CIVIC.has(b) || CIVIC.has(t.amenity)) return "civic";
  if (t.historic || t.heritage) return "historic";
  if (["retail", "commercial", "office", "hotel", "kiosk"].includes(b) || t.tourism === "hotel") return "commercial";
  if (["garages", "garage", "shed", "carport"].includes(b)) return "garage";
  if (["warehouse", "industrial"].includes(b)) return "industrial";
  if (shopNodes.some((n) => inside(n, ring))) return "commercial";
  if (["apartments", "residential", "house", "yes"].includes(b)) return "residential";
  return "other";
};

const buildingOf = (id, t, ring) => {
  const c = centre(ring);
  if (!inBounds(c)) return null;
  const a = Math.abs(area(ring));
  const use = useOf(t, ring);
  let levels = Number(t["building:levels"]) || LEVELS[t.building] || 3;
  if (t.building === "yes" && a < 120) levels = 2;
  const look = hash(id);
  const height = Number.parseFloat(t.height) || (use === "church" ? 17 + (look % 7) : levels * 3.4 + (use === "garage" ? 0.4 : 1.4));
  const xs = ring.map((p) => p.x);
  const zs = ring.map((p) => p.z);
  const short = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
  const pitched = use === "church" || ((use === "historic" || use === "residential" || use === "commercial" || use === "civic") && levels <= 5 && (look >> 4) % 10 < 6);
  const roof = t["roof:height"] ? Number.parseFloat(t["roof:height"]) : pitched && use !== "garage" ? Math.min(Math.max(short * 0.28, 2), use === "church" ? 9 : 6) : undefined;
  const y = Math.min(...ring.map((p) => heightAt(p.x, p.z)));
  const view = { kind: "building", outline: ring.map((p) => ({ x: r2(p.x - c.x), z: r2(p.z - c.z) })), height: r2(height), levels, use, look };
  if (roof) view.roof = r2(roof);
  if (t.name) view.name = t.name;
  return { position: { x: r2(c.x), y: r2(y), z: r2(c.z) }, view };
};

const buildings = [];
for (const w of ways.values()) {
  if (!w.tags.building || w.tags.building === "no" || w.tags.building === "roof") continue;
  const ring = closedRing(w.refs);
  if (ring) buildings.push(buildingOf(w.id, w.tags, ring));
}
for (const rel of relations) {
  if (!rel.tags.building || rel.tags.type !== "multipolygon") continue;
  const ring = outerRing(rel);
  if (ring) buildings.push(buildingOf(`r${rel.id}`, rel.tags, ring));
}

// --- Ground ------------------------------------------------------------------------------
const grounds = [];
const addGround = (surface, ring) => {
  const c = centre(ring);
  if (!inBounds(c) || Math.abs(area(ring)) < 0.5) return;
  grounds.push({ position: { x: r2(c.x), y: r2(heightAt(c.x, c.z)), z: r2(c.z) }, view: { kind: "ground", surface, outline: ring.map((p) => ({ x: r2(p.x - c.x), z: r2(p.z - c.z) })) } });
};
const disc = (p, r, sides = 8) => Array.from({ length: sides }, (_, k) => ({ x: p.x + Math.cos((k / sides) * Math.PI * 2) * r, z: p.z + Math.sin((k / sides) * Math.PI * 2) * r }));
/** A line buffered per segment, with a disc at each inner joint. */
const strip = (surface, pts, width) => {
  const h = width / 2;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 0.05) continue;
    const nx = (-(b.z - a.z) / len) * h;
    const nz = ((b.x - a.x) / len) * h;
    addGround(surface, [
      { x: a.x + nx, z: a.z + nz },
      { x: a.x - nx, z: a.z - nz },
      { x: b.x - nx, z: b.z - nz },
      { x: b.x + nx, z: b.z + nz },
    ]);
    if (i > 0) addGround(surface, disc(a, h));
  }
};
const ROAD_WIDTH = { primary: 12, secondary: 10, tertiary: 9, residential: 7, unclassified: 6, living_street: 5, service: 4 };
const stone = (t, fallback) => (["sett", "cobblestone", "unhewn_cobblestone"].includes(t.surface) ? "cobble" : t.surface === "paving_stones" && fallback !== "road" ? "square" : fallback);
const areaSurface = (t) => {
  if (t.natural === "water" || t.amenity === "fountain" || t.water) return "water";
  if (["grass", "village_green", "flowerbed", "meadow"].includes(t.landuse) || ["park", "garden"].includes(t.leisure) || ["scrub", "heath", "wood", "grassland"].includes(t.natural)) return "grass";
  if (t.amenity === "parking") return "road";
  if (t.place === "square" || t.highway === "pedestrian" || t["area:highway"]) return stone(t, "square");
  if (t.highway === "footway" && t.area === "yes") return stone(t, "footway");
  if (t.railway === "rail") return "rail";
  return null;
};
// Areas first: grass and squares lie under the roads and paths drawn over them.
for (const w of ways.values()) {
  const t = w.tags;
  if (t.building) continue;
  const closed = w.refs.length > 3 && w.refs[0] === w.refs[w.refs.length - 1];
  const s = closed ? areaSurface(t) : null;
  if (s && (closed && (t.area === "yes" || !t.highway))) {
    const ring = closedRing(w.refs);
    if (ring) addGround(s, ring);
  }
}
for (const rel of relations) {
  const s = rel.tags.type === "multipolygon" ? areaSurface(rel.tags) : null;
  const ring = s ? outerRing(rel) : null;
  if (ring) addGround(s, ring);
}
for (const w of ways.values()) {
  const t = w.tags;
  if (!t.highway && !t.railway) continue;
  if (t.area === "yes") continue;
  const pts = pointsOf(w.refs);
  if (pts.length < 2) continue;
  if (t.railway === "rail" || t.railway === "tram") strip("rail", pts, 3);
  else if (ROAD_WIDTH[t.highway]) strip(stone(t, "road"), pts, Number.parseFloat(t.width) || (t.service === "parking_aisle" ? 3.5 : ROAD_WIDTH[t.highway]));
  else if (t.highway === "pedestrian") strip(stone(t, "square"), pts, Number.parseFloat(t.width) || 9);
  else if (t.highway === "footway" && t.footway === "sidewalk") strip("sidewalk", pts, 2.4);
  else if (t.highway === "footway" && t.footway !== "crossing") strip(stone(t, "footway"), pts, 2);
  else if (t.highway === "path" || t.highway === "steps" || t.highway === "cycleway") strip("footway", pts, 1.8);
}

const views = [...terrains, ...buildings.filter(Boolean), ...grounds];
const out = {
  attribution: "Map data © OpenStreetMap contributors (ODbL). Terrain made up for the fixture.",
  anchor: ANCHOR,
  bounds: { minX: r2(bounds.minX), maxX: r2(bounds.maxX), minZ: r2(bounds.minZ), maxZ: r2(bounds.maxZ) },
  views,
};
writeFileSync(output, `${JSON.stringify(out)}\n`);
const count = (k) => views.filter((v) => v.view.kind === k).length;
console.log(`${output}: ${count("building")} buildings, ${count("ground")} ground surfaces, ${count("terrain")} terrain chunks`);
