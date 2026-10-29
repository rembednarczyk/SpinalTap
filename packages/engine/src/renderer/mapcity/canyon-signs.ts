import { prng } from "../city-kit-data";
import type { MeshSink, Rgba, Vec } from "../mesh-sink";
import { type Span, spanBillboard } from "./canyon-plan";
import { type FacadeFrame, type Wall } from "./facade-frame";
import { MAP_SIGN_KIND } from "./sign-plan";
import { type Uv, quadUv } from "./sink-ops";
import { stackTiers } from "./vertical-plan";

/**
 * The light of vertical Lublin 2077 over the streets (ADR-0051), in the cell's additive sign
 * mesh (no draw call of its own):
 * - billboards hung over the street, both faces readable along it, and banners sticking out
 *   of the upper floors, with Polish and Japanese ads from the ads atlas;
 * - ads on the superstructures' walls that face the street;
 * - curtains of neon strips hanging from the cables;
 * - beams of light from the billboards down to the street and a low mist in the canyons.
 * `lite` (a phone) keeps the ads and drops the curtains, beams and mist.
 */

/** Ads atlas: four landscape cells (2:1) on top, eight banners (1:4) below. */
export const AD_LANDSCAPE = ["LUBLIN 2077 ルブリン", "SEKI 関重工", "CEBULARZ 玉葱パン", "KOZIOŁEK COLA コーラ"] as const;
export const AD_BANNERS = ["ラーメン", "ホテル", "薬局", "居酒屋", "KINO", "BAR", "カラオケ", "24H"] as const;

const NEON = ["#ff2e88", "#00e5ff", "#ffb000", "#b46cff", "#39ff8a"] as const;

const tint = (hex: string, a: number): Rgba => {
  const n = parseInt(hex.slice(1, 7), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
};

const UV: readonly [Uv, Uv, Uv, Uv] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];
const UV_MIRROR: readonly [Uv, Uv, Uv, Uv] = [
  [1, 0],
  [0, 0],
  [0, 1],
  [1, 1],
];

/** An upright quad centred at c, spanning `w` along `side` and `h` up, both faces readable. */
const twoFaced = (sink: MeshSink, c: Vec, side: { x: number; z: number }, w: number, h: number, color: Rgba, uv2: Uv): void => {
  const p = (s: number, t: number): Vec => ({ x: c.x + side.x * s * (w / 2), y: c.y + t * (h / 2), z: c.z + side.z * s * (w / 2) });
  const corners = [p(-1, -1), p(1, -1), p(1, 1), p(-1, 1)] as const;
  const n = { x: -side.z, y: 0, z: side.x };
  // Seen from the side `n` points to, `side` runs to the left: that face reads its UVs mirrored.
  quadUv(sink, corners, n, color, UV_MIRROR, uv2);
  quadUv(sink, corners, { x: -n.x, y: 0, z: -n.z }, color, UV, uv2);
};

/** A billboard's two faces and, unless lite, its beam of light down to the street. */
const billboard = (sink: MeshSink, s: Span, lite: boolean): void => {
  const bb = spanBillboard(s);
  if (!bb) return;
  const side = { x: -bb.n.z, z: bb.n.x };
  twoFaced(sink, bb.c, side, bb.w, bb.h, tint(bb.color, 1), [bb.cell, MAP_SIGN_KIND.ad]);
  if (lite) return;
  // The beam: a trapezoid under the board, widening to the street, brightest at the board.
  const top = bb.c.y - bb.h / 2;
  const foot = s.base + 0.2;
  const spread = bb.w * 0.8;
  const p = (sx: number, y: number): Vec => ({ x: bb.c.x + side.x * sx, y, z: bb.c.z + side.z * sx });
  const corners = [p(-spread, foot), p(spread, foot), p(bb.w / 2, top), p(-bb.w / 2, top)] as const;
  const n = { x: bb.n.x, y: 0, z: bb.n.z };
  quadUv(sink, corners, n, tint(bb.color, 0.5), UV, [s.seed, MAP_SIGN_KIND.beam]);
  quadUv(sink, corners, { x: -n.x, y: 0, z: -n.z }, tint(bb.color, 0.5), UV, [s.seed, MAP_SIGN_KIND.beam]);
};

/** A curtain of neon strips hanging from a line across the street. */
const curtain = (sink: MeshSink, s: Span, rand: () => number): void => {
  const y = Math.min(s.top - 1.5, s.base + 6 + rand() * 6);
  if (y < s.base + 5) return;
  const across = { x: (s.b.x - s.a.x) / s.width, z: (s.b.z - s.a.z) / s.width };
  const off = (rand() - 0.5) * 6;
  const from = s.width * (0.1 + rand() * 0.3);
  const to = s.width * (0.6 + rand() * 0.3);
  const colors = [NEON[Math.floor(rand() * NEON.length)] ?? "#ff2e88", NEON[Math.floor(rand() * NEON.length)] ?? "#00e5ff"];
  for (let t = from, k = 0; t < to; t += 0.45, k++) {
    const len = 1.2 + rand() * 3.2;
    const c = { x: s.a.x + across.x * t + s.along.x * off, y: y - len / 2, z: s.a.z + across.z * t + s.along.z * off };
    twoFaced(sink, c, across, 0.09, len, tint(colors[k % 2] as string, 0.85), [0, MAP_SIGN_KIND.tube]);
  }
};

/** Low mist over the street of a main span: two soft sheets near the ground. */
const mist = (sink: MeshSink, s: Span): void => {
  const across = { x: (s.b.x - s.a.x) / s.width, z: (s.b.z - s.a.z) / s.width };
  const reach = 9;
  for (const h of [0.5, 1.3]) {
    const p = (t: number, o: number): Vec => ({ x: s.a.x + across.x * t + s.along.x * o, y: s.base + h, z: s.a.z + across.z * t + s.along.z * o });
    quadUv(sink, [p(0, -reach), p(s.width, -reach), p(s.width, reach), p(0, reach)], { x: 0, y: 1, z: 0 }, tint("#9fb4ff", 1), UV, [s.seed, MAP_SIGN_KIND.mist]);
  }
};

const streetWalls = (f: FacadeFrame): Wall[] => f.walls.filter((w) => !w.blind && w.length >= 6);

/** Banners sticking out of the upper floors of the street walls. */
const banners = (sink: MeshSink, f: FacadeFrame, rand: () => number): void => {
  const c = f.b.clutter ?? 0;
  const zone = f.eave - f.b.base;
  if (zone < 9) return;
  for (const w of streetWalls(f)) {
    if (rand() > c * 0.7) continue;
    const dx = (w.b.x - w.a.x) / w.length;
    const dz = (w.b.z - w.a.z) / w.length;
    const u = rand() < 0.5 ? 1.2 : w.length - 1.2;
    const h = Math.min(4.2, zone - f.ground - 1.5);
    if (h < 2) continue;
    const y = f.eave - 0.8 - h / 2;
    const centre = { x: w.a.x + dx * u + w.nx * 1.0, y, z: w.a.z + dz * u + w.nz * 1.0 };
    twoFaced(sink, centre, { x: w.nx, z: w.nz }, h / 4, h, tint(NEON[Math.floor(rand() * NEON.length)] ?? "#ff2e88", 1), [4 + Math.floor(rand() * 8), MAP_SIGN_KIND.ad]);
  }
};

/** An ad flat on the superstructure's wall that faces the street best. */
const stackAd = (sink: MeshSink, f: FacadeFrame, rand: () => number): void => {
  const tiers = stackTiers(f);
  const street = streetWalls(f).sort((a, b) => b.length - a.length)[0];
  if (tiers.length === 0 || !street || rand() > 0.25 + 0.5 * (f.b.clutter ?? 0)) return;
  const t = tiers.reduce((best, x) => (x.y1 - x.y0 > best.y1 - best.y0 ? x : best), tiers[0] as (typeof tiers)[number]);
  let wall: { a: { x: number; z: number }; b: { x: number; z: number }; n: { x: number; z: number }; len: number } | null = null;
  for (let i = 0; i < t.ring.length; i++) {
    const a = t.ring[i] as { x: number; z: number };
    const b = t.ring[(i + 1) % t.ring.length] as { x: number; z: number };
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const n = { x: (b.z - a.z) / len, z: -(b.x - a.x) / len };
    if (n.x * street.nx + n.z * street.nz > 0.7 && (!wall || len > wall.len)) wall = { a, b, n, len };
  }
  if (!wall) return;
  const w = Math.min(wall.len * 0.75, 10);
  const h = Math.min(w / 2, (t.y1 - t.y0) * 0.8);
  const c = { x: (wall.a.x + wall.b.x) / 2 + wall.n.x * 0.15, y: (t.y0 + t.y1) / 2, z: (wall.a.z + wall.b.z) / 2 + wall.n.z * 0.15 };
  const side = { x: (wall.b.x - wall.a.x) / wall.len, z: (wall.b.z - wall.a.z) / wall.len };
  const p = (s: number, k: number): Vec => ({ x: c.x + side.x * s * (h * 2) * 0.5, y: c.y + k * (h / 2), z: c.z + side.z * s * (h * 2) * 0.5 });
  quadUv(sink, [p(-1, -1), p(1, -1), p(1, 1), p(-1, 1)], { x: wall.n.x, y: 0, z: wall.n.z }, tint(NEON[Math.floor(rand() * NEON.length)] ?? "#00e5ff", 1), UV, [Math.floor(rand() * 4), MAP_SIGN_KIND.ad]);
};

/** The sign mesh's share of vertical Lublin for one cell. */
export const planCanyonSigns = (sink: MeshSink, frames: readonly FacadeFrame[], spans: readonly Span[], lite: boolean): void => {
  for (const f of frames) {
    if ((f.b.clutter ?? 0) <= 0) continue;
    const rand = prng((f.b.look ^ 0xad5) >>> 0);
    banners(sink, f, rand);
    stackAd(sink, f, rand);
  }
  for (const s of spans) {
    const rand = prng(Math.floor(s.seed * 0xfffffff) ^ 0x5c1);
    billboard(sink, s, lite);
    if (lite) continue;
    if (rand() < s.clutter * 0.5) curtain(sink, s, rand);
    // Mist only down the busy canyons: a quiet lane (the Rynek) keeps its clear air and needs no sign mesh for it.
    if (s.main && s.clutter >= 0.4) mist(sink, s);
  }
};
