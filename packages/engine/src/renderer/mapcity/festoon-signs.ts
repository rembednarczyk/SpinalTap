import { type FestoonSpan, MARKET_FESTOONS, MARKET_NEON_EDGES, type NeonEdge, festoonAt } from "@seki/sim";
import type { MeshSink, Rgba, Vec } from "../mesh-sink";
import type { Box2 } from "./polygon";
import { MAP_SIGN_KIND, signTint } from "./sign-plan";
import { type Uv, quadUv } from "./sink-ops";

/*
 * The flea market's festoons over Plac Zamkowy (`plac-zamkowy-festoons.ts` in the simulation's content) in the map
 * city's signs' mesh of the cell holding each one's middle: the cable a faint line, its bulbs small bright crosses of
 * the signs' tube (warm, every fourth pink or cyan, as the stalls' own garlands and the neon over them), or a
 * neon strip along the whole cable. Additive, both ways, no draw call and no mesh more; seen from the side and from
 * under it. Pattern: a catenary sampled as a polyline (a parabola, its sag small against its length).
 */

/** Pieces of a cable, a bulb every so many metres, a bulb's size and a strip's width (m). */
const PIECES = 16;
const BULB_EVERY = 0.6;
const BULB = 0.16;
const STRIP = 0.07;
const CABLE = 0.02;
/** The bulbs' warm, the accents among them, the strips' neon by turns. */
const WARM = "#ffc46b";
const ACCENTS = ["#ff3fa4", "#38e4ff"] as const;
const STRIPS = ["#ff3fa4", "#38e4ff", "#ffb13b"] as const;

const UV: readonly [Uv, Uv, Uv, Uv] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];
const TUBE: Uv = [0, MAP_SIGN_KIND.tube];

/** A ribbon from `a` to `b`, `w` wide, standing upright and lying flat, each both ways. */
const ribbon = (sink: MeshSink, a: Vec, b: Vec, w: number, color: Rgba): void => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l = Math.hypot(dx, dz) || 1;
  const side = { x: -dz / l, y: 0, z: dx / l };
  const up = { x: 0, y: w / 2, z: 0 };
  const off = { x: (side.x * w) / 2, y: 0, z: (side.z * w) / 2 };
  const quad = (o: Vec, n: Vec): void => {
    const c: [Vec, Vec, Vec, Vec] = [
      { x: a.x - o.x, y: a.y - o.y, z: a.z - o.z },
      { x: b.x - o.x, y: b.y - o.y, z: b.z - o.z },
      { x: b.x + o.x, y: b.y + o.y, z: b.z + o.z },
      { x: a.x + o.x, y: a.y + o.y, z: a.z + o.z },
    ];
    quadUv(sink, c, n, color, UV, TUBE);
    quadUv(sink, [c[1], c[0], c[3], c[2]], { x: -n.x, y: -n.y, z: -n.z }, color, UV, TUBE);
  };
  quad(up, side);
  quad(off, { x: 0, y: 1, z: 0 });
};

/** A bulb at `c`: a small cross of light, seen from any side and from under it. */
const bulb = (sink: MeshSink, c: Vec, color: Rgba): void => {
  const h = BULB / 2;
  ribbon(sink, { x: c.x - h, y: c.y, z: c.z }, { x: c.x + h, y: c.y, z: c.z }, BULB, color);
  ribbon(sink, { x: c.x, y: c.y, z: c.z - h }, { x: c.x, y: c.y, z: c.z + h }, BULB, color);
};

const planOne = (sink: MeshSink, s: FestoonSpan, k: number): void => {
  const length = Math.hypot(s.b.x - s.a.x, s.b.z - s.a.z);
  const neon = STRIPS[k % STRIPS.length]!;
  const line = s.style === "strip" ? signTint(neon, 0.9) : signTint(WARM, 0.12);
  for (let i = 0; i < PIECES; i++) ribbon(sink, festoonAt(s, i / PIECES), festoonAt(s, (i + 1) / PIECES), s.style === "strip" ? STRIP : CABLE, line);
  if (s.style === "strip") return;
  const n = Math.max(1, Math.round(length / BULB_EVERY));
  for (let i = 1; i < n; i++) {
    // A pink or a cyan bulb in four, by turns: the market's warm, with the city's neon in it.
    const accent = (i + k) % 4 === 0 ? ACCENTS[((i + k) / 4) % 2] : undefined;
    const at = festoonAt(s, i / n);
    bulb(sink, { x: at.x, y: at.y - 0.07, z: at.z }, signTint(accent ?? WARM, 1));
  }
};

/** The festoons whose middle lies in a cell of the map city; their count. */
export const planFestoons = (sink: MeshSink, bounds: Box2, spans: readonly FestoonSpan[] = MARKET_FESTOONS): number => {
  let count = 0;
  spans.forEach((s, k) => {
    const mx = (s.a.x + s.b.x) / 2;
    const mz = (s.a.z + s.b.z) / 2;
    if (mx < bounds.minX || mx >= bounds.maxX || mz < bounds.minZ || mz >= bounds.maxZ) return;
    planOne(sink, s, k);
    count++;
  });
  return count;
};

/** A canopy's neon strip: a little wider than a festoon's, a tube of the signs' neon. */
const EDGE_STRIP = 0.12;
const EDGE_BRIGHTNESS = 0.95;

/** The markets' stalls' canopy strips whose middle lies in a cell of the map city (24.11); their count. */
export const planNeonEdges = (sink: MeshSink, bounds: Box2, edges: readonly NeonEdge[] = MARKET_NEON_EDGES): number => {
  let count = 0;
  for (const e of edges) {
    const mx = (e.a.x + e.b.x) / 2;
    const mz = (e.a.z + e.b.z) / 2;
    if (mx < bounds.minX || mx >= bounds.maxX || mz < bounds.minZ || mz >= bounds.maxZ) continue;
    ribbon(sink, e.a, e.b, EDGE_STRIP, signTint(e.color, EDGE_BRIGHTNESS));
    count++;
  }
  return count;
};
